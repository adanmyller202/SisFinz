/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import { Resend } from 'resend';
import { initializeApp, getApps, getApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Helper to get Admin instances
function getAdmin() {
  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: applicationDefault(),
        projectId: firebaseConfig.projectId,
      });
  const dbId = firebaseConfig.firestoreDatabaseId;
  const db = dbId && dbId !== '(default)'
    ? getFirestore(app, dbId)
    : getFirestore(app);
  return { db, auth: getAuth(app) };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase client configuration for secure server-side exact lookup
let firebaseConfig: any = {};
try {
  const rawConfig = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8');
  firebaseConfig = JSON.parse(rawConfig);
} catch (e) {
  console.warn('Could not load firebase-applet-config.json in server:', e);
}

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

app.use(express.json({ limit: '5mb' }));

// DEBUG: Log all requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});

// Rate limiting in-memory store for exact user lookup (sliding window)
// Max 15 searches per IP per 60 seconds to prevent enumeration/scraping attacks
const searchRateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 15;

  const timestamps = (searchRateLimitMap.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    searchRateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  searchRateLimitMap.set(ip, timestamps);
  return true;
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Secure Exact-Email User Lookup with Abuse & Rate-Limiting Protection (Server Token Verified)
app.post('/api/search-user', async (req, res) => {
  try {
    const apiKey = firebaseConfig.apiKey;
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

    if (!projectId || !apiKey) {
      res.status(500).json({ error: 'Configuração do Firestore indisponível no servidor.' });
      return;
    }

    // 1. Enforce Firebase ID Token in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticação não fornecido no header Authorization.' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (!idToken) {
      res.status(401).json({ error: 'Token de autenticação vazio.' });
      return;
    }

    // 2. Cryptographic token verification on Google Identity Toolkit
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
    const verifyResp = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!verifyResp.ok) {
      res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
      return;
    }

    const verifyData: any = await verifyResp.json();
    const verifiedUser = verifyData.users?.[0];
    if (!verifiedUser || !verifiedUser.localId) {
      res.status(401).json({ error: 'Falha ao identificar usuário autenticado a partir do token.' });
      return;
    }

    const verifiedUid = verifiedUser.localId;

    // 3. Dual Rate Limiting: IP-based AND Authenticated UID-based (15 requests/min)
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

    if (!checkRateLimit(`ip:${clientIp}`) || !checkRateLimit(`uid:${verifiedUid}`)) {
      res.status(429).json({
        error: 'Muitas tentativas de busca. Por segurança, aguarde um minuto antes de tentar novamente.',
      });
      return;
    }

    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'E-mail é obrigatório para busca.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.length < 3 || cleanEmail.length > 150 || !cleanEmail.includes('@')) {
      res.status(400).json({ error: 'Formato de e-mail inválido.' });
      return;
    }

    // Deterministic SHA-256 hash of email for exact document matching
    const emailHash = crypto.createHash('sha256').update(cleanEmail).digest('hex');

    // Exact REST document lookup on user_directory_lookup
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/user_directory_lookup/${emailHash}?key=${apiKey}`;
    const response = await fetch(url);

    if (response.status === 404) {
      res.json({ found: false, user: null });
      return;
    }

    if (!response.ok) {
      // Fallback: check user_directory by querying runQuery on exact email
      const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery?key=${apiKey}`;
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: 'user_directory' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'email' },
              op: 'EQUAL',
              value: { stringValue: cleanEmail },
            },
          },
          limit: 1,
        },
      };

      const qResp = await fetch(runQueryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody),
      });

      if (qResp.ok) {
        const qData: any = await qResp.json();
        const firstDoc = qData?.[0]?.document;
        if (firstDoc?.fields) {
          res.json({
            found: true,
            user: {
              uid: firstDoc.fields.uid?.stringValue,
              email: firstDoc.fields.email?.stringValue,
              displayName: firstDoc.fields.displayName?.stringValue,
            },
          });
          return;
        }
      }

      res.json({ found: false, user: null });
      return;
    }

    const docData: any = await response.json();
    const fields = docData.fields || {};

    // Return strictly minimal non-sensitive identity metadata for invitation
    res.json({
      found: true,
      user: {
        uid: fields.uid?.stringValue,
        email: fields.email?.stringValue,
        displayName: fields.displayName?.stringValue,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/search-user:', err);
    res.status(500).json({ error: 'Erro ao processar busca de usuário.' });
  }
});


// OTP Password Recovery Endpoints
console.log('Registering route /api/request-otp');
app.post('/api/request-otp', async (req, res) => {
  console.log('========== BACKEND API REQUEST-OTP HIT ==========');
  let resetId = 'unknown';
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'E-mail é obrigatório.' });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();

    const projectId = firebaseConfig.projectId;
    const apiKey = firebaseConfig.apiKey;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

    // Generate 6-digit code and a unique resetId for this specific attempt
    const code = crypto.randomInt(100000, 999999).toString();
    resetId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store in Firestore using REST API with a unique document ID for this resetId
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/password_resets/${resetId}?key=${apiKey}`;
    const firestoreResp = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          email: { stringValue: cleanEmail },
          code: { stringValue: code },
          expiresAt: { timestampValue: expiresAt },
        },
      }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (!firestoreResp.ok) {
        const errData = await firestoreResp.text();
        console.error('Firestore PATCH failed:', errData);
        throw new Error(`Erro ao salvar OTP: ${errData}`);
    }

    // Send Email via Resend
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY missing');
      res.status(503).json({ error: 'Serviço de e-mail não configurado' });
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log(`Sending OTP email to: ${cleanEmail}, resetId: ${resetId}`);
    
    const emailResp = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: cleanEmail,
      subject: 'Código de recuperação - SisFinz',
      text: `Olá,\n\nSeu código para recuperar sua senha do SisFinz é: ${code}\n\nEste código vence em 10 minutos.\n\nSe você não solicitou este código, ignore esta mensagem.\n\nEquipe SisFinz`,
    });
    console.log('Resend response for:', resetId, emailResp);

    res.json({ success: true, resetId });
  } catch (err: any) {
    console.error(`Error in /api/request-otp (resetId: ${resetId}):`, err);
    res.status(500).json({ error: err.message || 'Erro ao solicitar código.' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, code, resetId } = req.body;
    if (!email || !code || !resetId) {
      res.status(400).json({ error: 'Dados incompletos.' });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();

    const projectId = firebaseConfig.projectId;
    const apiKey = firebaseConfig.apiKey;
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

    // Consultar o documento específico pelo resetId
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/password_resets/${resetId}?key=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.log('OTP document not found for resetId:', resetId);
      res.status(400).json({ error: 'Código inválido ou expirado.' });
      return;
    }

    const data: any = await resp.json();
    const storedEmail = data.fields.email.stringValue;
    const storedCode = data.fields.code.stringValue;
    const expiresAt = new Date(data.fields.expiresAt.timestampValue).getTime();
    const now = Date.now();

    if (storedEmail !== cleanEmail || storedCode !== code.trim() || now > expiresAt) {
      console.log('OTP validation failed for:', resetId, 'EmailMatch:', storedEmail === cleanEmail, 'CodeMatch:', storedCode === code.trim(), 'Expired:', now > expiresAt);
      res.status(400).json({ error: 'Código inválido ou expirado.' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in /api/verify-otp:', err);
    res.status(500).json({ error: 'Erro ao verificar código.' });
  }
});

app.post('/api/reset-password-with-otp', async (req, res) => {
  try {
    const { email, code, resetId, newPassword } = req.body;
    
    // Robust input validation
    if (typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ success: false, error: 'E-mail inválido.' });
      return;
    }
    if (typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ success: false, error: 'Código inválido.' });
      return;
    }
    if (typeof resetId !== 'string' || !resetId.trim()) {
      res.status(400).json({ success: false, error: 'Identificador de reset inválido.' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'Senha inválida (mínimo 6 caracteres).' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const { db, auth } = getAdmin();

    // 1. VERIFY OTP
    const resetRef = db.collection('password_resets').doc(resetId);
    const resetDoc = await resetRef.get();
    
    if (!resetDoc.exists) {
      res.status(400).json({ success: false, error: 'Sessão de recuperação não encontrada.' });
      return;
    }

    const data = resetDoc.data();
    if (!data) {
      res.status(400).json({ success: false, error: 'Falha ao ler dados de recuperação.' });
      return;
    }

    // Accessing fields directly (Admin SDK maps fields automatically)
    // Important: expiresAt was saved via REST as { timestampValue: expiresAt }
    // When read via Admin SDK, if it was an ISO string, it remains a string.
    // If it was a real Timestamp, it has .toDate().
    const storedEmail = (data.email || '').toLowerCase();
    const storedCode = (data.code || '').trim();
    let expiryDate: Date;
    
    if (data.expiresAt && typeof data.expiresAt.toDate === 'function') {
      expiryDate = data.expiresAt.toDate();
    } else {
      expiryDate = new Date(data.expiresAt);
    }

    if (storedEmail !== cleanEmail || storedCode !== code.trim() || Date.now() > expiryDate.getTime()) {
      res.status(400).json({ success: false, error: 'Código inválido ou expirado.' });
      return;
    }

    // 2. UPDATE PASSWORD
    const user = await auth.getUserByEmail(cleanEmail);
    await auth.updateUser(user.uid, { password: newPassword });

    // 3. CLEANUP
    await resetRef.delete();

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error in /api/reset-password-with-otp:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Erro ao redefinir senha.'
    });
  }
});

// AI Chat Assistant endpoint for Mone
app.post('/api/mone', async (req, res) => {
  try {
    const { message, history = [], context = {} } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const {
      currentBalance = 0,
      currency = 'BRL',
      language = 'pt',
      bills = [],
      incomes = [],
      expenses = [],
      goals = [],
      lastActionItem = null,
    } = context;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7);

    const billsSummary = bills.map((b: any) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
      dueDate: b.dueDate,
      category: b.category,
      recurrence: b.recurrence,
      recurrenceMonthsCount: b.recurrenceMonthsCount,
    }));

    const incomesSummary = incomes.map((i: any) => ({
      id: i.id,
      name: i.name,
      amount: i.amount,
      expectedDay: i.expectedDay,
      category: i.category,
    }));

    const recentExpensesSummary = (expenses || []).slice(-20).map((e: any) => ({
      id: e.id,
      name: e.name,
      amount: e.amount,
      date: e.date,
      category: e.category,
    }));

    const goalsSummary = (goals || []).map((g: any) => ({
      id: g.id,
      title: g.title,
      targetAmount: g.targetAmount,
    }));

    const conversationHistoryStr = (history || [])
      .slice(-8)
      .map((m: any) => `${m.sender === 'user' ? 'Usuário' : 'Mone'}: "${m.text}"`)
      .join('\n');

    const systemPrompt = `Você é o Mone, o cérebro financeiro do aplicativo Mone.
Sua missão é identificar a intenção do usuário em linguagem natural e retornar uma estrutura JSON precisa com a ação real a ser executada no banco de dados e uma resposta curta, natural e direta.

Contexto financeiro do usuário:
- Data atual: ${todayStr} (Mês: ${currentMonthStr})
- Moeda ativa: ${currency}
- Idioma preferido: ${language === 'pt' ? 'Português' : language === 'es' ? 'Español' : 'English'}
- Saldo atual em conta: ${currentBalance}
- Último item manipulado nesta conversa: ${lastActionItem ? JSON.stringify(lastActionItem) : 'Nenhum'}
- Contas cadastradas: ${JSON.stringify(billsSummary)}
- Receitas cadastradas: ${JSON.stringify(incomesSummary)}
- Despesas recentes: ${JSON.stringify(recentExpensesSummary)}
- Metas de economia: ${JSON.stringify(goalsSummary)}

Histórico recente da conversa:
${conversationHistoryStr || 'Nenhuma mensagem anterior.'}

REGRAS DE RESPOSTA E EXECUÇÃO (MUITO RIGOROSO):
1. Respostas ULTRA DIRETAS e CURTAS, focadas exclusivamente no que foi perguntado ou executado.
2. NUNCA diga saudações repetitivas como "Olá, sou Mone...", "Excelente notícia!", "É importante registrar..." nem dê conselhos morais se o usuário não pediu.
3. NUNCA mostre termos técnicos como "Cálculo Interno Direto", nomes de tabelas ou JSON na resposta de texto.
4. Se o usuário fizer uma pergunta matemática (ex: "quanto é 50.000 + 50.000?"), intent: "math", directResponse: "100.000."
5. SE O USUÁRIO PEDIR PARA MODIFICAR/EDITAR DADOS DE UMA CONTA OU REGISTRO EXISTENTE:
   - Alterar vencimento ou data de conta existente (ex: "mudar o vencimento da compra da sapatilha para o dia 20", "alterar vencimento da sapatilha para dia 20", "trocar data da conta de luz para o dia 10"):
     intent: "update_bill"
     name: "Compra da sapatilha" (ou o nome correspondente encontrado)
     matchedId: id da conta correspondente encontrada em Contas cadastradas
     dueDay: 20
     directResponse: "Vencimento de Compra da sapatilha alterado para o dia 20."
   - Alterar valor de conta existente (ex: "mudar valor da sapatilha para 150", "alterar conta de internet para 130"):
     intent: "update_bill"
     name: "Compra da sapatilha"
     matchedId: id da conta correspondente
     amount: 150
     directResponse: "Valor de Compra da sapatilha alterado para $ 150."
   - Alterar valor de despesa (ex: "mudar valor do uber para 35"):
     intent: "update_expense"
     name: "Uber"
     matchedId: id da despesa
     amount: 35
     directResponse: "Despesa de Uber alterada para $ 35."
   - Alterar receita ou salário (ex: "mudar meu salário para 55 mil"):
     intent: "update_income"
     name: "Salário"
     matchedId: id da receita
     amount: 55000
     directResponse: "Salário alterado para $ 55.000."
6. SE O USUÁRIO PEDIR PARA CRIAR REGISTROS:
   - Compra parcelada (ex: "comprei um tênis de 200 mil em 5 vezes", "compra de tênis de 200.000 em 5 parcelas vencendo dia 17"):
     intent: "add_installment_bill"
     name: "Compra de tênis"
     totalAmount: 200000
     installmentsCount: 5
     amount: 40000
     dueDay: 17
     directResponse: "Pronto. Compra de tênis criada em 5 parcelas de $ 40.000, todo dia 17."
   - Despesa avulsa (ex: "gastei 2500 pesos de uber agora", "adicione despesa de 4000 de uber hoje"):
     intent: "add_expense"
     name: "Uber"
     amount: 2500
     category: "Transporte"
     directResponse: "Despesa de Uber de $ 2.500 adicionada."
   - Receita (ex: "recebi 50 mil de salário", "adicione receita de 1500"):
     intent: "add_income"
     name: "Salário"
     amount: 50000
     isRecurring: true se salário
     directResponse: "Receita de Salário de $ 50.000 adicionada."
   - Conta regular (ex: "minha internet vence todo dia 10"):
     Se faltar o valor e não existir conta: intent: "ask_clarification", directResponse: "Qual é o valor da sua conta de internet?"
     Se tiver valor: intent: "add_bill", name: "Internet", amount: 120, dueDay: 10, directResponse: "Pronto. Conta Internet de $ 120 criada para todo dia 10."
7. OUTRAS AÇÕES:
   - Marcar como pago (ex: "paguei a academia", "marca a sapatilha como paga"):
     intent: "mark_bill_paid"
     name: nome da conta
     matchedBillId: id correspondente
     directResponse: "Pronto. Academia marcada como paga."
   - Corrigir item anterior (ex: "na verdade foi 3000, não 2500"):
     intent: "correct_last_item"
     newAmount: 3000
     directResponse: "Corrigido. Valor alterado para $ 3.000."
   - Excluir item (ex: "apaga a despesa de uber", "excluir conta da academia", "excluir compra da sapatilha"):
     intent: "delete_item"
     name: nome do item
     itemType: "bill" | "expense" | "income"
     matchedId: id do item correspondente
     directResponse: "Registro excluído."
   - Consultas (quanto gastei com transporte este mês?, quanto vou receber em novembro?, tenho algo para pagar em novembro?, qual meu saldo?):
     intent: "query_spending" | "query_incomes" | "query_bills" | "query_balance" | "query_forecast"
     targetMonth: "YYYY-MM"
     directResponse: resposta direta e exata.

REGRA ABSOLUTA:
NUNCA use 'general_query' quando o usuário pedir para criar, alterar data, alterar vencimento, alterar valor ou excluir um registro. Identifique a conta ou registro nas listas fornecidas e retorne a intenção de modificação correspondente.

FORMATO DE RESPOSTA (ESTRITAMENTE JSON):
{
  "intent": "add_expense" | "add_income" | "add_installment_bill" | "add_bill" | "update_bill" | "update_expense" | "update_income" | "mark_bill_paid" | "correct_last_item" | "delete_item" | "create_goal" | "query_spending" | "query_incomes" | "query_bills" | "query_balance" | "query_forecast" | "ask_clarification" | "general_query" | "math",
  "data": {
    "name": "string",
    "amount": number,
    "totalAmount": number,
    "installmentsCount": number,
    "dueDay": number,
    "expectedDay": number,
    "isRecurring": boolean,
    "targetMonth": "YYYY-MM",
    "category": "string",
    "matchedId": "string",
    "matchedBillId": "string",
    "itemType": "expense" | "bill" | "income",
    "newAmount": number,
    "newName": "string"
  },
  "directResponse": "string"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\nMensagem do usuário: "${message}"`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 300,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const rawText = response.text?.trim() || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {
        intent: 'general_query',
        directResponse: rawText,
      };
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('Error in /api/mone:', err);
    res.status(500).json({
      error: 'Failed to process Mone request',
      details: err?.message || String(err),
    });
  }
});

// Ping route
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();

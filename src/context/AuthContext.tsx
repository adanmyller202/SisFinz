import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase/config';
import { hashEmail } from '../utils/crypto';

export interface OAuthDiagnostics {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  isStandalone: boolean;
  authDomain: string;
  authState: string;
  redirectResultStatus: 'pending' | 'success' | 'null' | 'error';
  redirectErrorCode?: string;
  redirectErrorMessage?: string;
  timestamp: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  oauthDiagnostics: OAuthDiagnostics | null;
  clearAuthError: () => void;
  signUp: (name: string, email: string, password: string, keepSignedIn: boolean) => Promise<void>;
  signIn: (email: string, password: string, keepSignedIn: boolean) => Promise<void>;
  signInWithGoogle: (keepSignedIn: boolean) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  requestOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, code: string, resetId: string) => Promise<void>;
  resetPasswordWithOTP: (email: string, code: string, resetId: string, newPassword: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Já existe uma conta cadastrada com este e-mail. Faça login ou recupere sua senha.';
    case 'auth/invalid-email':
      return 'O formato do e-mail é inválido.';
    case 'auth/operation-not-allowed':
      return 'Operação não permitida. O provedor de autenticação (Email/Senha ou Google) precisa estar habilitado no console do Firebase.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Escolha uma senha com pelo menos 6 caracteres.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/user-not-found':
      return 'Nenhuma conta encontrada com este e-mail.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/network-request-failed':
      return 'Erro de conexão de rede. Verifique sua internet e tente novamente.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas sem sucesso. Por segurança, o acesso foi temporariamente bloqueado.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta com este e-mail usando outro método de acesso (como Google). Faça login com o método original.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'O processo de login foi cancelado pelo usuário.';
    case 'auth/popup-blocked':
      return 'O pop-up de login foi bloqueado pelo navegador. Tentando redirecionamento...';
    case 'auth/unauthorized-domain':
      return 'Domínio não autorizado no console do Firebase para autenticação Google.';
    case 'auth/web-storage-unsupported':
      return 'O armazenamento do navegador não é suportado ou foi bloqueado pelo Safari ITP.';
    default:
      return 'Ocorreu um erro na autenticação. Verifique os dados e tente novamente.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [oauthDiagnostics, setOauthDiagnostics] = useState<OAuthDiagnostics | null>(null);

  useEffect(() => {
    let isMounted = true;
    let unsubListener: (() => void) | null = null;

    const initializeAuth = async () => {
      const isStandalone =
        typeof window !== 'undefined' &&
        ((window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
          window.matchMedia('(display-mode: standalone)').matches);

      const diagInfo: OAuthDiagnostics = {
        hostname: typeof window !== 'undefined' ? window.location.hostname : '',
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        search: typeof window !== 'undefined' ? window.location.search || '(vazio)' : '',
        hash: typeof window !== 'undefined' ? window.location.hash || '(vazio)' : '',
        isStandalone,
        authDomain: (auth.app.options as { authDomain?: string })?.authDomain || 'não especificado',
        authState: auth.currentUser ? `Autenticado (${auth.currentUser.uid})` : 'Não autenticado',
        redirectResultStatus: 'pending',
        timestamp: new Date().toLocaleTimeString(),
      };

      try {
        // Ensure local persistence for session state
        await setPersistence(auth, browserLocalPersistence);

        // Check and process redirect result if returning from Google OAuth redirect
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult && redirectResult.user && isMounted) {
          console.log('[AuthContext] Google redirect success for user:', redirectResult.user.uid);
          diagInfo.redirectResultStatus = 'success';
          diagInfo.authState = `Autenticado (${redirectResult.user.uid})`;
          if (isMounted) setOauthDiagnostics({ ...diagInfo });

          await syncUserProfile(redirectResult.user);
          setUser(redirectResult.user);
        } else {
          diagInfo.redirectResultStatus = 'null';
          if (isMounted) setOauthDiagnostics({ ...diagInfo });
        }
      } catch (err: unknown) {
        console.error('[AuthContext] Error processing getRedirectResult:', err);
        const code = (err as { code?: string })?.code || '';
        const rawMsg = (err as Error)?.message || String(err);
        diagInfo.redirectResultStatus = 'error';
        diagInfo.redirectErrorCode = code || 'erro_desconhecido';
        diagInfo.redirectErrorMessage = rawMsg;
        if (isMounted) setOauthDiagnostics({ ...diagInfo });

        if (
          code &&
          code !== 'auth/popup-closed-by-user' &&
          code !== 'auth/cancelled-popup-request'
        ) {
          const msg = mapAuthErrorMessage(code);
          if (isMounted) {
            setAuthError(`Erro no retorno do login Google (${code}): ${msg}`);
          }
        }
      } finally {
        if (!isMounted) return;

        // Attach state observer ONLY AFTER redirect result check completes
        unsubListener = onAuthStateChanged(auth, async (currentUser) => {
          if (!isMounted) return;
          setUser(currentUser);
          if (currentUser) {
            try {
              await syncUserProfile(currentUser);
            } catch (syncErr) {
              console.warn('[AuthContext] User directory sync error:', syncErr);
            }
          }
          setLoading(false);
        });
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      if (unsubListener) {
        unsubListener();
      }
    };
  }, []);

  const clearAuthError = () => setAuthError(null);

  // Sync user profile in Firestore and searchable user_directory
  const syncUserProfile = async (u: User, displayName?: string) => {
    const userDocRef = doc(db, 'users', u.uid);
    const directoryDocRef = doc(db, 'user_directory', u.uid);
    const resolvedName = displayName || u.displayName || u.email?.split('@')[0] || 'Usuário';
    const emailLower = (u.email || '').toLowerCase().trim();
    const now = new Date().toISOString();

    try {
      const existing = await getDoc(userDocRef);
      if (!existing.exists()) {
        await setDoc(userDocRef, {
          userId: u.uid,
          displayName: resolvedName,
          email: u.email || '',
          createdAt: now,
          updatedAt: now,
        });
      } else if (displayName && existing.data()?.displayName !== displayName) {
        await setDoc(
          userDocRef,
          {
            displayName,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      // Keep directory entry synced for partner invitations by email
      if (emailLower) {
        const directoryPayload = {
          uid: u.uid,
          email: emailLower,
          displayName: resolvedName,
          updatedAt: now,
        };
        await setDoc(directoryDocRef, directoryPayload, { merge: true });

        // Also write to user_directory_lookup using deterministic SHA-256 hash of email
        // This permits exact single-document lookup while list/enumeration is strictly prohibited
        try {
          const emailHash = await hashEmail(emailLower);
          const lookupDocRef = doc(db, 'user_directory_lookup', emailHash);
          await setDoc(lookupDocRef, directoryPayload, { merge: true });
        } catch (lookupErr) {
          console.warn('Sync lookup doc error:', lookupErr);
        }
      }
    } catch (err) {
      console.warn('Sync profile error:', err);
    }
  };

  const signUp = async (name: string, email: string, password: string, keepSignedIn: boolean) => {
    setAuthError(null);
    try {
      await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      try {
        await sendEmailVerification(cred.user);
      } catch (err) {
        console.warn('Could not send verification email:', err);
      }
      await syncUserProfile(cred.user, name.trim());
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signIn = async (email: string, password: string, keepSignedIn: boolean) => {
    setAuthError(null);
    try {
      await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await syncUserProfile(cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const isStandaloneMode = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
      (window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  };

  const signInWithGoogle = async (_keepSignedIn: boolean) => {
    setAuthError(null);

    // Call signInWithPopup IMMEDIATELY without awaiting setPersistence first
    // to preserve transient user gesture activation in WebKit / iOS Safari PWA
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred && cred.user) {
        await syncUserProfile(cred.user);
      }
    } catch (popupErr: unknown) {
      const code = (popupErr as { code?: string })?.code || '';
      console.warn('[AuthContext] signInWithPopup error code:', code, popupErr);

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return; // User cancelled
      }

      // Fallback to redirect if popup is blocked or unsupported
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        isStandaloneMode()
      ) {
        console.log('[AuthContext] Falling back to signInWithRedirect...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: unknown) {
          const rCode = (redirectErr as { code?: string })?.code || '';
          const msg = mapAuthErrorMessage(rCode);
          setAuthError(`Erro no redirecionamento Google (${rCode}): ${msg}`);
          throw redirectErr;
        }
      }

      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const requestOTP = async (email: string) => {
    setAuthError(null);
    try {
      const resp = await fetch('/api/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Falha ao solicitar código');
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao solicitar código de recuperação.');
      throw err;
    }
  };

  const verifyOTP = async (email: string, code: string, resetId: string) => {
    setAuthError(null);
    try {
      const resp = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, resetId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Código inválido ou expirado');
    } catch (err: any) {
      setAuthError(err.message || 'Código inválido ou expirado.');
      throw err;
    }
  };

  const resetPasswordWithOTP = async (email: string, code: string, resetId: string, newPassword: string) => {
    setAuthError(null);
    try {
      const resp = await fetch('/api/reset-password-with-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, resetId, newPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Falha ao redefinir senha');
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao redefinir senha.');
      throw err;
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      if (typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('mc_fin_') || key.startsWith('money_challenge_'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch {}
      }
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const sendVerificationEmail = async () => {
    setAuthError(null);
    try {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await sendEmailVerification(auth.currentUser);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const reloadUser = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setUser({ ...auth.currentUser });
        return auth.currentUser.emailVerified;
      }
      return false;
    } catch (err) {
      console.warn('Reload user error:', err);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        oauthDiagnostics,
        clearAuthError,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        requestOTP,
        verifyOTP,
        resetPasswordWithOTP,
        signOutUser,
        sendVerificationEmail,
        reloadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

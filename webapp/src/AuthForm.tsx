import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { logAudit } from './auditHelper';
import { REGISTRATION_ROLES, ROLES } from './roles';
import { getAuthRedirectUrl } from './authRedirects';
import type { ArtVaultRole } from './roles';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: 'popup' | 'redirect';
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface AuthFormProps {
  onLoginComplete: (data: any, profile?: any) => void;
  banMessage: string | null;
  setBanMessage: (msg: string | null) => void;
  setIsValidatingLogin: (v: boolean) => void;
  showMfaChallenge: boolean;
  setShowMfaChallenge: (v: boolean) => void;
  mfaFactorIds: string[];
  setMfaFactorIds: (ids: string[]) => void;
}

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '365434914690-os7tc8fj7tb731v9tf1j33enjggt54ct.apps.googleusercontent.com';

const TRUSTED_INTERNAL_DOMAINS = new Set(['artvault.com']);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '20minutemail.com',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'sharklasers.com',
  'getairmail.com',
  'trashmail.com',
  'maildrop.cc',
  'dispostable.com',
  'fakeinbox.com',
  'emailondeck.com',
  'moakt.com',
  'mohmal.com',
]);

const COMMON_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'zohomail.com',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'fastmail.com',
  'tutanota.com',
  'tuta.com',
  'hey.com',
  'pm.me',
  'live.com.ph',
  'yahoo.com.ph',
]);

function validateRegistrationEmail(rawEmail: string): string | null {
  const trimmedEmail = rawEmail.trim().toLowerCase();
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!basicEmailPattern.test(trimmedEmail)) {
    return 'Please enter a valid email address.';
  }

  const [, domain = ''] = trimmedEmail.split('@');
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1] || '';

  if (TRUSTED_INTERNAL_DOMAINS.has(domain)) return null;

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return 'Temporary or disposable email addresses are not allowed.';
  }

  if (domain.includes('..') || domain.startsWith('-') || domain.endsWith('-')) {
    return 'Please use a valid email domain.';
  }

  if (!/^[a-z0-9.-]+$/.test(domain) || !/^[a-z]{2,24}$/.test(tld)) {
    return 'Please use a valid email domain.';
  }

  if (!COMMON_EMAIL_DOMAINS.has(domain)) {
    return 'Please use a supported email provider such as Gmail, Yahoo, Outlook, iCloud, Proton, Zoho, or ArtVault.';
  }

  return null;
}

function clearLocalSupabaseAuthStorage() {
  if (typeof window === 'undefined') return;

  [window.localStorage, window.sessionStorage].forEach((storage) => {
    Object.keys(storage).forEach((key) => {
      if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
        storage.removeItem(key);
      }
    });
  });
}

function loadGoogleIdentityScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google sign-in could not load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google sign-in could not load.'));
    document.head.appendChild(script);
  });
}

export default function AuthForm({
  onLoginComplete,
  banMessage,
  setBanMessage,
  setIsValidatingLogin,
  showMfaChallenge,
  setShowMfaChallenge,
  mfaFactorIds,
  setMfaFactorIds,
}: AuthFormProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname === '/admin';

  // All form state is now LOCAL to this component — 
  // keystrokes no longer re-render the entire App tree
  const [activeForm, setActiveForm] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<ArtVaultRole>('user');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const loginGoogleButtonRef = useRef<HTMLDivElement | null>(null);
  const registerGoogleButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    if (mode === 'register') {
      setActiveForm('register');
    } else if (mode === 'login') {
      setActiveForm('login');
    }
  }, [location.search]);

  const validateAdminAccess = (profile: any, isAdminLogin: boolean): string | null => {
    if (isAdminLogin && profile?.role !== 'admin') {
      return 'Access denied. Only administrators can log in here.';
    }
    if (!isAdminLogin && profile?.role === 'admin') {
      return 'Admins must log in through the /admin portal.';
    }
    return null;
  };

  const validateProfileStatus = async (profile: any, userId: string): Promise<string | null> => {
    if (!profile) return null;

    if (profile.status === 'banned') {
      await supabase.auth.signOut();
      return 'Access Denied: Your account has been permanently banned.';
    }

    if (profile.status === 'suspended' && profile.suspension_end) {
      const endDate = new Date(profile.suspension_end);
      if (endDate > new Date()) {
        await supabase.auth.signOut();
        return `Access Denied: Account suspended until ${endDate.toLocaleString()}.`;
      } else {
        await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', userId);
      }
    }
    return null;
  };

  const checkMfaRequirements = async (mfaData: any): Promise<boolean> => {
    if (mfaData && mfaData.nextLevel === 'aal2' && mfaData.currentLevel === 'aal1') {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.data && factors.data.totp.length > 0) {
        const verifiedFactors = factors.data.totp.filter((f: any) => f.status === 'verified');
        if (verifiedFactors.length > 0) {
          verifiedFactors.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setMfaFactorIds(verifiedFactors.map((f: any) => f.id));
          setShowMfaChallenge(true);
          return true;
        }
      }
    }
    return false;
  };

  const handleLogin = async (e: React.FormEvent, isAdminLogin = false) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setIsValidatingLogin(true);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      if (data?.user) {
        const [profileResponse, mfaResponse] = await Promise.all([
          supabase.from('profiles').select('role, status, suspension_end').eq('id', data.user.id).single(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        ]);

        const profile = profileResponse.data;
        const mfaData = mfaResponse.data;

        const statusError = await validateProfileStatus(profile, data.user.id);
        if (statusError) {
          setError(statusError);
          setBanMessage(statusError);
          setLoading(false);
          setIsValidatingLogin(false);
          return;
        }

        const adminError = validateAdminAccess(profile, isAdminLogin);
        if (adminError) {
          await supabase.auth.signOut();
          setError(adminError);
          toast.error(adminError);
          setLoading(false);
          setIsValidatingLogin(false);
          return;
        }

        const requiresMfa = await checkMfaRequirements(mfaData);
        if (requiresMfa) {
          setLoading(false);
          setIsValidatingLogin(false);
          return;
        }

        onLoginComplete(data, profile);
      } else {
        setLoading(false);
        setIsValidatingLogin(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
      toast.error(err.message || 'Login failed. Please try again.');
      setLoading(false);
      setIsValidatingLogin(false);
    }
  };

  const handleGoogleCredential = useCallback(async (response: { credential?: string }) => {
    if (!response.credential) {
      setError('Google sign-in did not return a credential. Please try again.');
      toast.error('Google sign-in failed.');
      setLoading(false);
      setIsValidatingLogin(false);
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    setIsValidatingLogin(true);
    clearLocalSupabaseAuthStorage();

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential,
    });

    if (error || !data?.user) {
      const message = error?.message || 'Google sign-in failed. Please try again.';
      setError(message);
      toast.error(message);
      setLoading(false);
      setIsValidatingLogin(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status, suspension_end')
      .eq('id', data.user.id)
      .single();

    const statusError = await validateProfileStatus(profile, data.user.id);
    if (statusError) {
      setError(statusError);
      setBanMessage(statusError);
      setLoading(false);
      setIsValidatingLogin(false);
      return;
    }

    const adminError = validateAdminAccess(profile, false);
    if (adminError) {
      await supabase.auth.signOut();
      setError(adminError);
      toast.error(adminError);
      setLoading(false);
      setIsValidatingLogin(false);
      return;
    }

    const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const requiresMfa = await checkMfaRequirements(mfaData);
    if (requiresMfa) {
      setLoading(false);
      setIsValidatingLogin(false);
      return;
    }

    onLoginComplete(data, profile);
    setLoading(false);
  }, [onLoginComplete, setBanMessage, setIsValidatingLogin]);

  useEffect(() => {
    if (isAdminRoute || showMfaChallenge) return;

    const target = activeForm === 'login' ? loginGoogleButtonRef.current : registerGoogleButtonRef.current;
    if (!target) return;

    let cancelled = false;
    target.innerHTML = '';

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !target) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          ux_mode: 'popup',
        });
        window.google.accounts.id.renderButton(target, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: Math.min(target.clientWidth || 360, 400),
        });
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
      target.innerHTML = '';
    };
  }, [activeForm, handleGoogleCredential, isAdminRoute, showMfaChallenge]);

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setIsValidatingLogin(true);

    let mfaSuccess = false;
    let lastError = null;

    for (const factorId of mfaFactorIds) {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        lastError = challenge.error;
        continue;
      }

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: mfaCode
      });

      if (!verify.error) {
        mfaSuccess = true;
        break;
      } else {
        lastError = verify.error;
      }
    }

    if (!mfaSuccess) {
      setError("Verification error: " + (lastError?.message || "Invalid TOTP code"));
      toast.error("Invalid TOTP code. Please try again.");
      setLoading(false); 
      setIsValidatingLogin(false);
      return;
    }

    // MFA verified successfully
    setShowMfaChallenge(false);
    const { data } = await supabase.auth.getUser();
    onLoginComplete({ user: data.user });
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const emailValidationError = validateRegistrationEmail(normalizedEmail);
    if (emailValidationError) {
      setError(emailValidationError);
      toast.error(emailValidationError);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/home'),
        data: {
          name,
          username,
          role
        }
      }
    });

    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      if (data?.user?.id) {
        logAudit('User Registration', `New account created: @${username}`, data.user.id);
      }
      setSuccess('Registration successful! Please check your email to verify.');
      toast.success('Registration successful! Check email to verify.');
    }
    setLoading(false);
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1001] flex items-center justify-center bg-[#e5e0d8]/80 backdrop-blur-md p-4"
      >
        {!isAdminRoute && (
          <button 
            onClick={() => navigate('/')} 
            className="absolute top-6 right-8 text-zinc-500 hover:text-zinc-900 text-3xl transition-colors z-50"
          >
            x
          </button>
        )}
        
        {banMessage && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed inset-0 bg-[#fdfbf7]/90 z-[99999] flex justify-center items-center p-4"
          >
            <div className="bg-white p-10 rounded-2xl text-center max-w-md w-full border border-red-500/50 shadow-[0_10px_40px_rgba(239,68,68,0.2)]">
                <div className="text-5xl mb-6" aria-hidden="true">!</div>
                <h2 className="text-red-500 mb-4 text-2xl font-bold">Account Restricted</h2>
                <p className="text-zinc-600 mb-8 text-base leading-relaxed">{banMessage}</p>
                <button 
                  onClick={() => setBanMessage(null)} 
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-colors"
                >
                  Acknowledge
                </button>
            </div>
          </motion.div>
        )}

        <motion.div 
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="container max-w-md w-full relative"
        >
          <div className="flex flex-col items-center mb-8 text-center">
            {/* Logo Container - Handles large transparent image bounds */}
            <div className="relative w-full h-16 flex items-center justify-center mb-4">
              <img 
                src="/Artlogo.png" 
                alt="ArtVault Logo" 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-auto filter brightness-0 pointer-events-none" 
              />
            </div>
            <h2 className="text-4xl text-zinc-900 mb-2 mt-4" style={{ fontFamily: 'var(--font-heading)' }}>
              {isAdminRoute ? 'Admin Portal' : activeForm === 'register' ? 'Join the Studio' : 'Welcome Back'}
            </h2>
            <p className="text-zinc-500 text-base font-medium">
              {isAdminRoute ? 'Secure access to ArtVault administration.' : activeForm === 'register' ? 'Join the community and share your work.' : 'Access your creative portfolio.'}
            </p>
          </div>

        {showMfaChallenge && (
          <div className="form-box active">
            <h2>Two-Factor Authentication</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', textAlign: 'center', fontSize: '14px' }}>
              Please enter the 6-digit code from Google Authenticator to verify your identity.
            </p>
            {error && <div className="alert error">{error}</div>}
            
            <form onSubmit={e => handleMfaSubmit(e)}>
              <div className="form-group">
                <input 
                  type="text" 
                  value={mfaCode} 
                  onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))} 
                  required 
                  className="form-control"
                  placeholder="123456"
                  maxLength={6}
                  style={{ letterSpacing: mfaCode.length > 0 ? '8px' : 'normal', textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}
                />
              </div>
              
              <button type="submit" disabled={loading || mfaCode.length !== 6}>
                {loading ? 'Verifying...' : 'Verify Secure Code'}
              </button>
            </form>
            <div className="form-footer">
              <a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut(); setShowMfaChallenge(false); setIsValidatingLogin(false); }}>
                Cancel and Logout
              </a>
            </div>
          </div>
        )}
        
        {!isAdminRoute && activeForm === 'login' && !showMfaChallenge && (
          <div className="form-box active">
            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}

            <form onSubmit={(e) => handleLogin(e, false)}>
              <div className="form-group">
                <label htmlFor="login_email">Email Address</label>
                <input 
                  type="email" 
                  id="login_email" 
                  className="form-control" 
                  placeholder="Enter your email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="login_pass">Password</label>
                <input 
                  type="password" 
                  id="login_pass" 
                  className="form-control" 
                  placeholder="Enter your password" 
                  required 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Authenticating...' : 'Enter Studio'}
              </button>

              <div style={{ marginTop: '24px' }} className="w-full flex justify-center">
                <div ref={loginGoogleButtonRef} className="w-full flex justify-center" aria-label="Continue with Google" />
              </div>

              <div className="form-footer">
                New to ArtVault?{' '}
                <a href="#" onClick={(e) => { 
                  e.preventDefault(); 
                  setError(''); setSuccess('');
                  setActiveForm('register'); 
                }}>
                  Create an Artist Profile
                </a>
              </div>

            </form>
          </div>
        )}

        {isAdminRoute && !showMfaChallenge && (
          <div className="form-box active" style={{ borderTop: '4px solid #7494ec' }}>
            <div style={{ fontSize: '42px', textAlign: 'center', marginBottom: '15px', fontWeight: 700 }}>AV</div>
            
            <div style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(234, 179, 8, 0.2)', fontSize: '14px' }}>
              <strong>Restricted Access:</strong> This area is for administrators only.
            </div>

            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}

            <form onSubmit={(e) => handleLogin(e, true)}>
              <div className="form-group">
                <label htmlFor="admin_email">Admin Email</label>
                <input 
                  type="email" 
                  id="admin_email" 
                  className="form-control" 
                  placeholder="Enter your admin email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ borderColor: 'rgba(116, 148, 236, 0.5)' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="admin_pass">Password</label>
                <input 
                  type="password" 
                  id="admin_pass" 
                  className="form-control" 
                  placeholder="Enter your password" 
                  required 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ borderColor: 'rgba(116, 148, 236, 0.5)' }}
                />
              </div>

              <button type="submit" disabled={loading} style={{ background: '#7494ec', marginTop: '20px' }}>
                {loading ? 'Authenticating...' : 'Login as Administrator'}
              </button>
            </form>
          </div>
        )}

        {!isAdminRoute && activeForm === 'register' && !showMfaChallenge && (
          <div className="form-box active">

            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="reg_name">Artist/Full Name</label>
                <input 
                  type="text" 
                  id="reg_name" 
                  className="form-control" 
                  placeholder="e.g. Leonardo da Vinci" 
                  required 
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg_username">Username</label>
                <input 
                  type="text" 
                  id="reg_username" 
                  className="form-control" 
                  placeholder="e.g. leonardo" 
                  required 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg_email">Email Address</label>
                <input 
                  type="email" 
                  id="reg_email" 
                  className="form-control" 
                  placeholder="e.g. leo@gmail.com"
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <div className="text-sm text-zinc-500 mt-2 leading-snug">
                  Use a real inbox. Temporary or fake-looking email domains are blocked.
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg_pass">Password</label>
                <input 
                  type="password" 
                  id="reg_pass" 
                  className="form-control" 
                  placeholder="Create a secure password" 
                  required 
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg_role" className="block text-sm font-semibold text-zinc-800 mb-3" style={{ color: 'var(--text-primary)' }}>What brings you to ArtVault?</label>
                <select
                  id="reg_role"
                  className="form-control"
                  value={role}
                  onChange={(e) => setRole(e.target.value as ArtVaultRole)}
                  style={{ appearance: 'auto', cursor: 'pointer' }}
                >
                  {REGISTRATION_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLES[r].label}
                    </option>
                  ))}
                </select>
                <div className="text-sm text-zinc-500 mt-2 leading-snug">
                  {ROLES[role].description}
                </div>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Registering...' : 'Onboard Account'}
              </button>

              <div style={{ marginTop: '24px' }} className="w-full flex justify-center">
                <div ref={registerGoogleButtonRef} className="w-full flex justify-center" aria-label="Continue with Google" />
              </div>

              <div className="text-center mt-6 text-zinc-600 text-sm">
                Already registered?{' '}
                <a href="#" className="text-[#4a3424] hover:text-[#382619] font-semibold" onClick={(e) => { 
                  e.preventDefault(); 
                  setError(''); setSuccess('');
                  navigate('/login?mode=login');
                }}>
                  Sign In to Studio
                </a>
              </div>
            </form>
          </div>
        )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { Shield, User, Image as ImageIcon } from 'lucide-react';
import Avatar from './Avatar';
import { checkImageIsSafe } from './nsfwHelper';
import { logAudit } from './auditHelper';
import './Dashboard.css';

export default function Settings({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Security specific
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarToken, setAvatarToken] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar must be less than 2MB');
      return;
    }

    setAvatarLoading(true);

    // NSFW AI Moderation
    const isSafe = await checkImageIsSafe(file);
    if (!isSafe) {
      toast.error('Upload blocked: Avatar contains explicit or inappropriate content.');
      setAvatarLoading(false);
      return;
    }

    const filePath = `${user.id}/avatar`;
    const { error } = await supabase.storage.from('artworks').upload(filePath, file, {
      upsert: true,
      cacheControl: '0'
    });

    if (error) {
      toast.error('Error uploading avatar: ' + error.message);
    } else {
      toast.success('Profile picture updated!');
      const token = Date.now().toString();
      setAvatarToken(token);
      window.dispatchEvent(new CustomEvent('avatarUpdated', { detail: { userId: user.id, token } }));
    }
    setAvatarLoading(false);
  };

  async function fetchProfile() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
    }
    
    // Check MFA Status
    const mfaData = await supabase.auth.mfa.listFactors();
    if (mfaData.data && mfaData.data.totp.length > 0) {
      const verifiedFactor = mfaData.data.totp.find(f => f.status === 'verified');
      if (verifiedFactor) {
        setMfaEnabled(true);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;
    
    if (newPassword !== confirmPassword) {
      toast.error("Error: New passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    
    // Verify current password first by attempting a sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (signInError) {
      toast.error("Error: Incorrect current password.");
      setPasswordLoading(false);
      return;
    }

    // Now update to the new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    
    if (updateError) {
      toast.error("Error updating password: " + updateError.message);
    } else {
      logAudit('Password Changed', 'User securely updated their password.');
      toast.success("Password updated successfully.");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setPasswordLoading(false);
  };

  const handleEnrollMfa = async () => {
    setMfaLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({ 
      factorType: 'totp',
      issuer: 'ArtVault',
      friendlyName: user.email
    });
    if (error) {
      toast.error("Error enrolling MFA: " + error.message);
    } else if (data) {
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
    }
    setMfaLoading(false);
  };

  const handleVerifyMfa = async () => {
    if (!factorId || !verifyCode) return;
    setMfaLoading(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      toast.error("Challenge error: " + challenge.error.message);
      setMfaLoading(false);
      return;
    }
    
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: verifyCode
    });
    
    if (verify.error) {
      toast.error("Verification error: " + verify.error.message);
    } else {
      logAudit('MFA Enabled', 'User enabled Two-Factor Authentication (TOTP).');
      toast.success("MFA Successfully Enabled!");
      setMfaEnabled(true);
      setQrCode(null);
      setVerifyCode('');
    }
    setMfaLoading(false);
  };

  const handleUnenrollMfa = async () => {
    if (!confirm('Are you sure you want to disable 2FA? This will make your account less secure.')) return;
    setMfaLoading(true);
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.data && factors.data.totp.length > 0) {
      const verifiedFactors = factors.data.totp.filter(f => f.status === 'verified');
      let successCount = 0;
      for (const factor of verifiedFactors) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (!error) successCount++;
      }
      if (successCount > 0) {
        setMfaEnabled(false);
        logAudit('MFA Disabled', 'User disabled Two-Factor Authentication.');
        toast.success("MFA completely disabled.");
      } else {
        toast.error("Failed to disable MFA.");
      }
    }
    setMfaLoading(false);
  };

  if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}>Loading Settings...</div>;

  return (
    <div className="settings-container">
      {/* Settings Sidebar */}
      <div className="settings-sidebar">
        <ul className="sidebar-menu">
          <li>
            <button className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              <User size={18} /> Profile Details
            </button>
          </li>
          <li>
            <button className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
              <Shield size={18} /> Security & 2FA
            </button>
          </li>
        </ul>
      </div>

      {/* Main Content */}
      <div className="settings-content">
        <div className="settings-header">
          <h2>
            {activeTab === 'profile' && 'Profile Settings'}
            {activeTab === 'security' && 'Security & TOTP'}
          </h2>
          <p>
            {activeTab === 'profile' && 'Manage your public persona and portfolio details'}
            {activeTab === 'security' && 'Protect your account with Two-Factor Authentication'}
          </p>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="content-card">
            <h3>Personal Information</h3>
            <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <Avatar userId={user.id} name={profile?.name || 'User'} size={80} updateToken={avatarToken} />
              </div>
              <div>
                <input type="file" accept="image/png, image/jpeg, image/gif, image/svg+xml" style={{ display: 'none' }} ref={fileInputRef} onChange={handleAvatarUpload} />
                <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={avatarLoading}>
                  {avatarLoading ? 'Uploading...' : 'Change Profile Picture'}
                </button>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>JPG, PNG or GIF. Max size 2MB.</p>
              </div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Full Name</label>
              <input type="text" className="search-input" defaultValue={profile?.name} readOnly style={{ opacity: 0.7 }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Username</label>
              <input type="text" className="search-input" defaultValue={profile?.username} readOnly style={{ opacity: 0.7 }} />
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>To change your details, please contact an administrator.</p>

            <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>My Studio</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>Access your personalized dashboard to view and upload your artworks.</p>
            <Link to={`/profile/${user.id}`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
               <ImageIcon size={16} /> Enter Studio Dashboard
            </Link>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="content-card">
            <h3>Change Password</h3>
            <form onSubmit={handlePasswordChange} style={{ marginBottom: '40px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Current Password</label>
                <input 
                  type="password" 
                  className="search-input" 
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password..." 
                  required 
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>New Password</label>
                <input 
                  type="password" 
                  className="search-input" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password..." 
                  minLength={6}
                  required 
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Confirm New Password</label>
                <input 
                  type="password" 
                  className="search-input" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password..." 
                  minLength={6}
                  required 
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={passwordLoading}>
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <hr style={{ border: 'none', borderTop: '1px solid var(--panel-border)', margin: '30px 0' }} />

            <h3>Google Authenticator (TOTP)</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Protect your account by requiring a 6-digit code from Google Authenticator every time you sign in.
            </p>
            
            {mfaEnabled ? (
              <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                <p style={{ color: '#4ade80', margin: '0 0 15px 0', fontWeight: 'bold' }}>✅ Two-Factor Authentication is currently ON.</p>
                <button className="btn btn-danger" onClick={handleUnenrollMfa} disabled={mfaLoading}>
                  Disable Authenticator
                </button>
              </div>
            ) : qrCode ? (
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '20px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                <p style={{ marginBottom: '15px' }}>1. Scan this QR code with Google Authenticator:</p>
                <div style={{ marginBottom: '20px', background: 'white', display: 'inline-block', padding: '10px', borderRadius: '8px' }}>
                  <img src={qrCode} alt="Google Authenticator QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
                </div>
                <p style={{ marginBottom: '15px' }}>2. Enter the 6-digit code generated by the app:</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    className="search-input" 
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 123456" 
                    maxLength={6}
                    style={{ width: '150px', letterSpacing: '2px', textAlign: 'center' }}
                  />
                  <button className="btn btn-primary" onClick={handleVerifyMfa} disabled={mfaLoading || verifyCode.length !== 6}>
                    Verify & Enable
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={handleEnrollMfa} disabled={mfaLoading}>
                <Shield size={16} /> Setup Google Authenticator
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

export default function Avatar({ userId, name, size = 40, updateToken = '' }: { userId: string, name: string, size?: number, updateToken?: string }) {
  const [error, setError] = useState(false);
  const [localToken, setLocalToken] = useState(updateToken);
  
  useEffect(() => {
    setError(false);
    setLocalToken(updateToken);
  }, [userId, updateToken]);

  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      if (e.detail && e.detail.userId === userId) {
        setLocalToken(e.detail.token);
        setError(false);
      }
    };
    window.addEventListener('avatarUpdated', handleAvatarUpdate as EventListener);
    return () => window.removeEventListener('avatarUpdated', handleAvatarUpdate as EventListener);
  }, [userId]);

  const avatarUrl = `https://exaaahqhnesijbdixjzc.supabase.co/storage/v1/object/public/artworks/${userId}/avatar${localToken ? `?t=${localToken}` : ''}`;

  if (error) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        fontWeight: 'bold', 
        fontSize: size * 0.4 
      }}>
        {name ? name.charAt(0).toUpperCase() : 'U'}
      </div>
    );
  }

  return (
    <img 
      src={avatarUrl} 
      alt={name} 
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
      onError={() => setError(true)}
    />
  );
}

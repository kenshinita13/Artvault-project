import { useState, useEffect } from 'react';

export default function Avatar({
  userId,
  name,
  size = 40,
  updateToken = '',
  shape = 'circle',
}: {
  userId: string;
  name: string;
  size?: number;
  updateToken?: string;
  shape?: 'circle' | 'square';
}) {
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
        width: size, 
        height: size, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#241d18',
        color: '#f7f2e9',
        fontSize: `${size * 0.4}px`, 
        fontWeight: 'bold',
        borderRadius: shape === 'square' ? '2px' : '50%',
        flexShrink: 0
      }}>
        {name ? name.charAt(0).toUpperCase() : 'U'}
      </div>
    );
  }

  return (
    <img 
      src={avatarUrl} 
      alt={name} 
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: shape === 'square' ? '2px' : '50%', display: 'block', flexShrink: 0 }}
      onError={() => setError(true)}
    />
  );
}

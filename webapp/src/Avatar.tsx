import { useState, useEffect } from 'react';

export default function Avatar({ userId, name, size = 40, updateToken = '' }: { userId: string, name: string, size?: number, updateToken?: string }) {
  const [error, setError] = useState(false);
  
  useEffect(() => {
    setError(false);
  }, [userId, updateToken]);

  const avatarUrl = `https://exaaahqhnesijbdixjzc.supabase.co/storage/v1/object/public/artworks/${userId}/avatar${updateToken ? `?t=${updateToken}` : ''}`;

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
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      onError={() => setError(true)}
    />
  );
}

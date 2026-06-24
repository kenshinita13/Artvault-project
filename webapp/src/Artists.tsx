import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Avatar from './Avatar';
import './Dashboard.css';

interface ArtistProfile {
  id: string;
  name: string;
  username: string;
  role: string;
  total_uploads: number;
}

export default function Artists() {
  const [artists, setArtists] = useState<ArtistProfile[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchArtists() {
    setLoading(true);

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*');

    if (profileError) {
      console.error(profileError);
      setLoading(false);
      return;
    }

    const { data: artworks, error: artError } = await supabase
      .from('artworks')
      .select('user_id');

    if (artError) {
      console.error(artError);
      setLoading(false);
      return;
    }

    const uploadCounts = (artworks || []).reduce((acc: Record<string, number>, art: any) => {
      acc[art.user_id] = (acc[art.user_id] || 0) + 1;
      return acc;
    }, {});

    const fullProfiles = (profiles || []).map((p: any) => ({
      ...p,
      total_uploads: uploadCounts[p.id] || 0
    }));

    fullProfiles.sort((a, b) => b.total_uploads - a.total_uploads);
    setArtists(fullProfiles);
    setLoading(false);
  }

  useEffect(() => {
    fetchArtists();
  }, []);

  return (
    <main className="directory-container">
      <div className="directory-header">
        <h2>ArtVault Contributors</h2>
        <p>Browse collection holders, curators, and registered artwork portfolios</p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading directory...</p>
      ) : artists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
          <span className="registry-empty-icon">AV</span>
          <h4 style={{ marginTop: '15px' }}>No Contributors Found</h4>
        </div>
      ) : (
        <div className="profiles-grid">
          {artists.map(artist => (
            <div key={artist.id} className="profile-card">
              <div className="avatar-placeholder" style={{ padding: 0, overflow: 'hidden' }}>
                <Avatar userId={artist.id} name={artist.name} size={60} />
              </div>
              <div className="artist-name">{artist.name}</div>
              <div className="artist-handle">@{artist.username}</div>

              <div className={`artist-badge ${artist.role === 'admin' ? 'admin-badge' : ''}`}>
                {artist.role === 'admin' ? 'Administrator' : 'Collection Contributor'}
              </div>

              <div className="artist-stats">
                <div className="stat-item">
                  Registered Works <strong>{artist.total_uploads}</strong>
                </div>
              </div>

              <Link to={`/profile/${artist.id}`} className="btn btn-primary" style={{ width: '100%', marginTop: 'auto' }}>
                View Collection Profile
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

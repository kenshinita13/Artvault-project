import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
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
    // Fetch profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*');

    if (profileError) {
      console.error(profileError);
      setLoading(false);
      return;
    }

    // Fetch upload counts
    // In Supabase, doing an aggregate join is easiest done by a separate count query or an RPC.
    // For simplicity with small datasets, we'll just fetch all artworks and count them in memory.
    const { data: artworks, error: artError } = await supabase
      .from('artworks')
      .select('user_id');

    if (artError) {
      console.error(artError);
      setLoading(false);
      return;
    }

    const uploadCounts = artworks.reduce((acc: Record<string, number>, art: any) => {
      acc[art.user_id] = (acc[art.user_id] || 0) + 1;
      return acc;
    }, {});

    const fullProfiles = profiles.map((p: any) => ({
      ...p,
      total_uploads: uploadCounts[p.id] || 0
    }));

    // Sort by uploads descending
    fullProfiles.sort((a, b) => b.total_uploads - a.total_uploads);

    setArtists(fullProfiles);
  };

  useEffect(() => {
    fetchArtists();
  }, []);

  return (
    <main className="directory-container">
      <div className="directory-header">
        <h2>👥 ArtVault Creators</h2>
        <p>Discover and browse portfolio studios of our digital artists</p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading directory...</p>
      ) : artists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '48px' }}>👥</span>
          <h4 style={{ marginTop: '15px' }}>No Artists Found</h4>
        </div>
      ) : (
        <div className="profiles-grid">
          {artists.map(artist => (
            <div key={artist.id} className="profile-card">
              <div className="avatar-placeholder">
                {artist.name ? artist.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="artist-name">{artist.name}</div>
              <div className="artist-handle">@{artist.username}</div>
              
              <div className={`artist-badge ${artist.role === 'admin' ? 'admin-badge' : ''}`}>
                {artist.role === 'admin' ? '🛡️ Administrator' : '🎨 Artist'}
              </div>

              <div className="artist-stats">
                <div className="stat-item">
                  🎨 Creations: <strong>{artist.total_uploads}</strong>
                </div>
              </div>

              <Link to={`/profile/${artist.id}`} className="btn btn-primary" style={{ width: '100%', marginTop: 'auto' }}>
                View Studio Profile
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

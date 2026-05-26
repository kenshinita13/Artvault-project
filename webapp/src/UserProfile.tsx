import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { Trash2, X, Upload } from 'lucide-react';
import Avatar from './Avatar';
import Lightbox from './Lightbox';
import './Dashboard.css';

interface Profile {
  id: string;
  name: string;
  username: string;
  role: string;
}

interface Artwork {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  profiles?: Profile;
}

export default function UserProfile({ currentUser }: { currentUser: any }) {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Lightbox State
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  
  // Upload Modal State
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (id) {
      fetchUserProfile();
    }
  }, [id]);

  async function fetchUserProfile() {
    setLoading(true);
    
    // Fetch profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError) {
      console.error(profileError);
      setLoading(false);
      return;
    }
    setProfile(profileData);

    // Fetch artworks for this profile
    const { data: artworksData, error: artError } = await supabase
      .from('artworks')
      .select('*, profiles(name, username, role)')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (!artError && artworksData) {
      setArtworks(artworksData as unknown as Artwork[]);
    }
    
    setLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;

    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage Upload Error:', uploadError);
        throw new Error(`Storage failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('artworks')
        .getPublicUrl(filePath);

      if (!urlData || !urlData.publicUrl) {
        throw new Error('Failed to generate public URL for the uploaded image.');
      }

      const { error: dbError } = await supabase
        .from('artworks')
        .insert({
          title,
          description,
          image_url: urlData.publicUrl,
          user_id: currentUser.id
        });

      if (dbError) {
        console.error('Database Insert Error:', dbError);
        throw new Error(`Database failed: ${dbError.message}`);
      }

      toast.success('Artwork published successfully!');
      setTitle('');
      setDescription('');
      setFile(null);
      setShowUpload(false);
      fetchUserProfile();
    } catch (error: any) {
      console.error('Full Upload Exception:', error);
      alert('Error uploading: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, artwork: Artwork) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      const pathParts = artwork.image_url.split('/artworks/');
      if (pathParts.length > 1) {
        await supabase.storage.from('artworks').remove([pathParts[1]]);
      }

      await supabase.from('artworks').delete().eq('id', artwork.id);
      setArtworks(artworks.filter(a => a.id !== artwork.id));
      if (activeArtwork?.id === artwork.id) {
        setActiveArtwork(null);
      }
    } catch (error: any) {
      toast.error('Error deleting: ' + error.message);
    }
  };

  if (loading) {
    return <div style={{ padding: '100px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Studio...</div>;
  }

  if (!profile) {
    return <div style={{ padding: '100px', textAlign: 'center', color: 'var(--danger)' }}>Studio not found.</div>;
  }

  return (
    <>
      <main className="studio-container">
        
        {/* Header Card */}
        <div className="studio-header-card">
          <div className="studio-avatar" style={{ padding: 0, overflow: 'hidden' }}>
            <Avatar userId={profile.id} name={profile.name} size={100} />
          </div>
          <div className="studio-meta">
            <h1>{profile.name}</h1>
            <div className="studio-username">@{profile.username}</div>
            <div className="studio-badges">
              <span className={`badge ${profile.role === 'admin' ? 'admin' : ''}`}>
                {profile.role === 'admin' ? '🛡️ Administrator' : '🎨 Artist'}
              </span>
              <span className="badge">
                🖼️ {artworks.length} Creations
              </span>
            </div>
          </div>
          {(currentUser.id?.toLowerCase() === profile.id?.toLowerCase() || currentUser.user_metadata?.role === 'admin') && (
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
                <Upload size={16} /> Post Artwork
              </button>
            </div>
          )}
        </div>

        {/* Gallery Grid Layout */}
        {artworks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '48px' }}>🖼️</span>
            <h4 style={{ marginTop: '15px' }}>No Artworks Yet</h4>
            <p style={{ marginTop: '5px' }}>This studio is currently empty.</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {artworks.map(artwork => (
              <div key={artwork.id} className="art-card" onClick={() => setActiveArtwork(artwork)}>
                <div className="art-preview">
                  <img src={artwork.image_url} alt={artwork.title} />
                </div>
                <div className="art-details">
                  <div className="art-title">{artwork.title}</div>
                  <div className="art-desc-preview">{artwork.description || 'No description provided.'}</div>
                  
                  <div className="art-meta">
                    <span className="art-date">{new Date(artwork.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="art-actions">
                    {(currentUser.id === artwork.user_id || currentUser.user_metadata?.role === 'admin') && (
                      <button onClick={(e) => handleDelete(e, artwork)} className="btn btn-danger" style={{ flex: 1 }}>
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {activeArtwork && (
        <Lightbox 
          artwork={activeArtwork} 
          artistName={profile.name} 
          onClose={() => setActiveArtwork(null)} 
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px' }}>📤 Post to Your Studio</h3>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpload}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Artwork Title</label>
                  <input 
                    type="text" 
                    className="search-input" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Starry Night" 
                    required 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Description</label>
                  <textarea 
                    className="search-input" 
                    style={{ height: '100px', resize: 'vertical' }}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Tell the community about your artwork..."
                  ></textarea>
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Select Image</label>
                  <div className="file-upload-wrapper">
                    <span style={{ fontSize: '24px', marginBottom: '5px' }}>📁</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {file ? file.name : 'Click to choose file'}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                      required 
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '25px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={uploading}>
                    {uploading ? 'Publishing...' : 'Publish to Studio'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

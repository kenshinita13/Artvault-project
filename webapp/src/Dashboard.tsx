import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { Upload, Trash2, X } from 'lucide-react';
import Avatar from './Avatar';
import Lightbox from './Lightbox';
import { checkImageIsSafe } from './nsfwHelper';
import './Dashboard.css';

interface Artwork {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  profiles?: {
    username: string;
    name: string;
  };
}

export default function Dashboard({ user }: { user: any }) {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Upload Modal State
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  const [file, setFile] = useState<File | null>(null);
  
  const [deleteModalArtwork, setDeleteModalArtwork] = useState<Artwork | null>(null);
  const [userRole, setUserRole] = useState<string>('user');

  useEffect(() => {
    fetchArtworks();
    fetchUserRole();
  }, []);

  async function fetchUserRole() {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (data) {
      setUserRole(data.role);
    }
  }

  async function fetchArtworks() {
    setLoading(true);
    // Fetch artworks along with the profile of the artist
    const { data, error } = await supabase
      .from('artworks')
      .select(`
        *,
        profiles (
          username,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setArtworks(data as unknown as Artwork[]);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;

    try {
      setUploading(true);
      
      // NSFW AI Moderation
      const isSafe = await checkImageIsSafe(file);
      if (!isSafe) {
        toast.error('Upload blocked: Image contains explicit or inappropriate content.');
        setUploading(false);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('artworks')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('artworks')
        .insert({
          title,
          description,
          image_url: urlData.publicUrl,
          user_id: user.id
        });

      if (dbError) throw dbError;

      toast.success('Artwork published successfully!');
      setTitle('');
      setDescription('');
      setFile(null);
      setShowUpload(false);
      fetchArtworks();
    } catch (error: any) {
      toast.error('Error uploading: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, artwork: Artwork) => {
    e.stopPropagation();
    setDeleteModalArtwork(artwork);
  };

  const confirmDelete = async () => {
    if (!deleteModalArtwork) return;

    try {
      const pathParts = deleteModalArtwork.image_url.split('/artworks/');
      if (pathParts.length > 1) {
        await supabase.storage.from('artworks').remove([pathParts[1]]);
      }

      await supabase.from('artworks').delete().eq('id', deleteModalArtwork.id);
      setArtworks(artworks.filter(a => a.id !== deleteModalArtwork.id));
      toast.success('Artwork deleted successfully.');
      setDeleteModalArtwork(null);
    } catch (error: any) {
      toast.error('Error deleting: ' + error.message);
    }
  };

  return (
    <>
      <main className="gallery-container">
        <div className="gallery-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2>🌟 Global Showcase</h2>
              <p>Explore creative artworks published by our artists</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <Upload size={16} /> Post Image
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading gallery...</p>
        ) : artworks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '48px' }}>🔍</span>
            <h4 style={{ marginTop: '15px' }}>No Artworks Found</h4>
            <p style={{ marginTop: '5px' }}>The gallery is currently empty.</p>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Avatar userId={artwork.user_id} name={artwork.profiles?.name || 'Unknown Artist'} size={24} />
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {artwork.profiles?.name || 'Unknown Artist'}
                      </span>
                    </div>
                    <span>{new Date(artwork.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="art-actions">
                    {(user.id === artwork.user_id || userRole === 'admin') && (
                      <button onClick={(e) => handleDeleteClick(e, artwork)} className="btn btn-danger" style={{ flex: 1 }}>
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
          artistName={activeArtwork.profiles?.name || 'Unknown Artist'} 
          onClose={() => setActiveArtwork(null)} 
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px' }}>📤 Post New Artwork</h3>
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
                    placeholder="Tell the showcase community about your artwork..."
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
                    {uploading ? 'Publishing...' : 'Publish Showcase'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteModalArtwork && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)' }}>Delete Artwork</h3>
              <button onClick={() => setDeleteModalArtwork(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                Are you sure you want to delete <strong>{deleteModalArtwork.title}</strong>? 
                This action cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteModalArtwork(null)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmDelete} style={{ flex: 1 }}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

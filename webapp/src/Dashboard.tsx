import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { Upload, X } from 'lucide-react';
import { checkImageIsSafe } from './nsfwHelper';
import InteractiveBentoGallery from './components/blocks/interactive-bento-gallery';
import Lightbox from './Lightbox';
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
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  
  // Upload Modal State
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    fetchArtworks();
  }, [searchQuery]);

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
      let fetchedArtworks = data as unknown as Artwork[];
      
      // Client-side filtering if search query exists
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        fetchedArtworks = fetchedArtworks.filter(a => 
          a.title.toLowerCase().includes(q) || 
          (a.description && a.description.toLowerCase().includes(q)) ||
          (a.profiles?.name && a.profiles.name.toLowerCase().includes(q)) ||
          (a.profiles?.username && a.profiles.username.toLowerCase().includes(q))
        );
      }
      
      setArtworks(fetchedArtworks);
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

  return (
    <>
      <main className="gallery-container">
        <div className="gallery-header" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
            {user && (
              <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ zIndex: 10 }}>
                <Upload size={16} /> Post Image
              </button>
            )}
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
          <div style={{ marginTop: '-40px' }}>
            <InteractiveBentoGallery 
              mediaItems={artworks.map((a, i) => {
                const patterns = [
                  "col-span-1 row-span-2",
                  "col-span-2 row-span-1",
                  "col-span-1 row-span-2",
                  "col-span-1 row-span-2",
                  "col-span-2 row-span-1",
                  "col-span-2 row-span-1",
                  "col-span-1 row-span-2",
                ];
                return {
                  id: a.id,
                  type: (a.image_url && (a.image_url.toLowerCase().endsWith('.mp4') || a.image_url.toLowerCase().endsWith('.webm'))) ? 'video' : 'image',
                  title: a.title,
                  desc: `Posted by @${a.profiles?.username || a.profiles?.name || 'Unknown'}`,
                  url: a.image_url,
                  span: patterns[i % patterns.length]
                };
              })}
              title="Gallery Shots Collection"
              description="Drag and explore our curated collection of shots."
              onItemClick={(item) => {
                const selected = artworks.find(a => a.id === item.id);
                if (selected) setActiveArtwork(selected);
              }}
            />
          </div>
        )}
      </main>


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

      {activeArtwork && (
        <Lightbox 
          artwork={activeArtwork} 
          artistName={activeArtwork.profiles?.username || 'Unknown Artist'}
          onClose={() => setActiveArtwork(null)} 
        />
      )}

    </>
  );
}

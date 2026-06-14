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

// Global cache to instantly load artworks when navigating between pages
let cachedArtworks: Artwork[] | null = null;

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            resolve(file); // fallback if compression fails
          }
        }, 'image/jpeg', 0.85); // 85% quality provides massive size reduction with almost no visual loss
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function Dashboard({ user }: { user: any }) {
  const [artworks, setArtworks] = useState<Artwork[]>(cachedArtworks || []);
  const [loading, setLoading] = useState(!cachedArtworks);
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
  }, []);

  async function fetchArtworks() {
    if (!cachedArtworks) setLoading(true);
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
      cachedArtworks = data as unknown as Artwork[];
      setArtworks(cachedArtworks);
    }
    setLoading(false);
  };

  const filteredArtworks = artworks.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return a.title.toLowerCase().includes(q) || 
      (a.description && a.description.toLowerCase().includes(q)) ||
      (a.profiles?.name && a.profiles.name.toLowerCase().includes(q)) ||
      (a.profiles?.username && a.profiles.username.toLowerCase().includes(q));
  });

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

      // Compress the image before uploading to save massive bandwidth and storage
      let fileToUpload = file;
      let fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      
      // We don't compress GIFs or non-images to preserve animations/video
      if (file.type.startsWith('image/') && fileExt !== 'gif') {
        fileToUpload = await compressImage(file);
        fileExt = 'jpg';
      }

      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(filePath, fileToUpload);

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
        <div className="gallery-header" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            {user && (
              <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ zIndex: 10, whiteSpace: 'nowrap' }}>
                <Upload size={16} /> Post Image
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading gallery...</p>
        ) : filteredArtworks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '48px' }}>🔍</span>
            <h4 style={{ marginTop: '15px' }}>No Artworks Found</h4>
            <p style={{ marginTop: '5px' }}>{searchQuery ? "No artworks match your search." : "The gallery is currently empty."}</p>
          </div>
        ) : (
          <div style={{ marginTop: '0' }}>
            <InteractiveBentoGallery 
              mediaItems={filteredArtworks.map((a, i) => {
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
                const selected = filteredArtworks.find(a => a.id === item.id);
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
          currentUser={user}
        />
      )}

    </>
  );
}

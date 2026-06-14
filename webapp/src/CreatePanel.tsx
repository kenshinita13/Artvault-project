import { useState } from 'react';
import { X, ImagePlus, FolderPlus, Upload } from 'lucide-react';
import { supabase } from './supabaseClient';
import { checkImageIsSafe } from './nsfwHelper';
import toast from 'react-hot-toast';

interface CreatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  categories: { id: string; name: string; slug: string }[];
  onArtworkCreated?: () => void;
  onBoardCreated?: () => void;
}

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
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }) : file);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function CreatePanel({ isOpen, onClose, user, categories, onArtworkCreated, onBoardCreated }: CreatePanelProps) {
  const [activeTab, setActiveTab] = useState<'menu' | 'artwork' | 'board'>('menu');
  
  // Artwork form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Board form
  const [boardName, setBoardName] = useState('');
  const [boardDesc, setBoardDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);

  const resetAndClose = () => {
    setActiveTab('menu');
    setTitle(''); setDescription(''); setFile(null); setSelectedCategories([]);
    setBoardName(''); setBoardDesc(''); setIsPrivate(false);
    onClose();
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    setUploading(true);

    try {
      const isSafe = await checkImageIsSafe(file);
      if (!isSafe) { toast.error('Upload blocked: Inappropriate content detected.'); setUploading(false); return; }

      let fileToUpload = file;
      let fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      if (file.type.startsWith('image/') && fileExt !== 'gif') {
        fileToUpload = await compressImage(file);
        fileExt = 'jpg';
      }

      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('artworks').upload(filePath, fileToUpload);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('artworks').getPublicUrl(filePath);

      const { data: artwork, error: dbError } = await supabase.from('artworks').insert({
        title, description, image_url: urlData.publicUrl, user_id: user.id
      }).select().single();
      if (dbError) throw dbError;

      // Tag with categories
      if (selectedCategories.length > 0 && artwork) {
        await supabase.from('artwork_categories').insert(
          selectedCategories.map(catId => ({ artwork_id: artwork.id, category_id: catId }))
        );
      }

      toast.success('Artwork published!');
      resetAndClose();
      onArtworkCreated?.();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) return;
    setCreatingBoard(true);
    const { error } = await supabase.from('boards').insert({
      user_id: user.id, name: boardName.trim(), description: boardDesc.trim(), is_private: isPrivate
    });
    if (error) toast.error('Failed to create board');
    else { toast.success('Board created!'); resetAndClose(); onBoardCreated?.(); }
    setCreatingBoard(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Dimmed overlay */}
      <div
        onClick={resetAndClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 99998, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '380px', maxWidth: '90vw',
        height: '100vh', background: 'rgba(18,18,24,0.98)', borderRight: '1px solid rgba(255,255,255,0.08)',
        zIndex: 99999, display: 'flex', flexDirection: 'column',
        boxShadow: '10px 0 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
        animation: 'slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff' }}>
            {activeTab === 'menu' ? 'Create' : activeTab === 'artwork' ? 'Post Artwork' : 'New Board'}
          </h2>
          <button onClick={resetAndClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', transition: 'all 0.2s' }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ─── Menu View ─── */}
          {activeTab === 'menu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => setActiveTab('artwork')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px', cursor: 'pointer', color: '#fff', textAlign: 'left', transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.3)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ImagePlus size={22} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Post Artwork</p>
                  <p style={{ margin: 0, color: '#888', fontSize: '13px', marginTop: '2px' }}>Upload your image with title, description, and tags</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('board')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px', cursor: 'pointer', color: '#fff', textAlign: 'left', transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.3)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FolderPlus size={22} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Create Board</p>
                  <p style={{ margin: 0, color: '#888', fontSize: '13px', marginTop: '2px' }}>Organize your favorite artworks into a collection</p>
                </div>
              </button>
            </div>
          )}

          {/* ─── Post Artwork Form ─── */}
          {activeTab === 'artwork' && (
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <button type="button" onClick={() => setActiveTab('menu')} style={{ background: 'none', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: '13px', padding: 0, textAlign: 'left', fontWeight: 600 }}>
                ← Back to menu
              </button>

              {/* File upload area */}
              <div style={{ border: '2px dashed rgba(168,85,247,0.3)', borderRadius: '16px', padding: '30px', textAlign: 'center', cursor: 'pointer', position: 'relative', background: file ? 'rgba(168,85,247,0.05)' : 'transparent', transition: 'all 0.2s' }}>
                <Upload size={28} style={{ color: '#a855f7', marginBottom: '8px' }} />
                <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>{file ? file.name : 'Click or drop image here'}</p>
                <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} required style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your artwork a name" required className="search-input" />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell the story behind your art..." className="search-input" style={{ height: '80px', resize: 'vertical' }} />
              </div>

              {/* Category Tags */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      style={{
                        padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid',
                        background: selectedCategories.includes(cat.id) ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                        borderColor: selectedCategories.includes(cat.id) ? '#a855f7' : 'rgba(255,255,255,0.1)',
                        color: selectedCategories.includes(cat.id) ? '#c084fc' : '#999',
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={uploading} style={{ width: '100%', marginTop: '8px' }}>
                {uploading ? 'Publishing...' : '🎨 Publish Artwork'}
              </button>
            </form>
          )}

          {/* ─── Create Board Form ─── */}
          {activeTab === 'board' && (
            <form onSubmit={handleCreateBoard} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <button type="button" onClick={() => setActiveTab('menu')} style={{ background: 'none', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: '13px', padding: 0, textAlign: 'left', fontWeight: 600 }}>
                ← Back to menu
              </button>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Board Name</label>
                <input type="text" value={boardName} onChange={e => setBoardName(e.target.value)} placeholder='e.g. "Renaissance Masterpieces"' required className="search-input" />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Description (optional)</label>
                <textarea value={boardDesc} onChange={e => setBoardDesc(e.target.value)} placeholder="Describe this collection..." className="search-input" style={{ height: '80px', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="create-private" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#a855f7' }} />
                <label htmlFor="create-private" style={{ color: '#999', fontSize: '14px', cursor: 'pointer' }}>Make this board private</label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={creatingBoard} style={{ width: '100%', marginTop: '8px' }}>
                {creatingBoard ? 'Creating...' : '📁 Create Board'}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

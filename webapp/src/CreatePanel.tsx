import { useState, useEffect } from 'react';
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
  adminMode?: boolean;
  allUsers?: any[];
  defaultTargetUserId?: string | null;
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
          resolve(blob ? new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' }) : file);
        }, 'image/webp', 0.90);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const formatFileSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function CreatePanel({ isOpen, onClose, user, categories, onArtworkCreated, onBoardCreated, adminMode, allUsers = [], defaultTargetUserId }: CreatePanelProps) {
  const [activeTab, setActiveTab] = useState<'menu' | 'artwork' | 'board'>('menu');
  
  // Admin user selection
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (adminMode && defaultTargetUserId && allUsers.length > 0) {
      setTargetUserId(defaultTargetUserId);
      const targetUser = allUsers.find(u => u.id === defaultTargetUserId);
      if (targetUser) {
        setUserSearchQuery(targetUser.name || targetUser.username || targetUser.email || 'Unnamed');
      }
    }
  }, [adminMode, defaultTargetUserId, allUsers]);

  const filteredUsers = allUsers.filter(u => 
    u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
    u.username?.toLowerCase().includes(userSearchQuery.toLowerCase())
  ).slice(0, 10);

  const effectiveUserId = adminMode && targetUserId ? targetUserId : user.id;

  // Board Selection
  const [userBoards, setUserBoards] = useState<any[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');

  useEffect(() => {
    let active = true;
    async function fetchBoards() {
      if (!effectiveUserId) {
        setUserBoards([]);
        return;
      }
      const { data } = await supabase.from('boards').select('id, name').eq('user_id', effectiveUserId).order('name');
      if (active && data) setUserBoards(data);
    }
    if (isOpen) {
      fetchBoards();
    }
    return () => { active = false; };
  }, [effectiveUserId, isOpen]);
  
  // Artwork form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [artistName, setArtistName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [currentHashtag, setCurrentHashtag] = useState('');
  const [materialUsed, setMaterialUsed] = useState('');
  const [artStyle, setArtStyle] = useState('');
  const [collector, setCollector] = useState('');
  const [price, setPrice] = useState('');
  const [creationYear, setCreationYear] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [uploading, setUploading] = useState(false);

  // Board form
  const [boardName, setBoardName] = useState('');
  const [boardDesc, setBoardDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);

  const resetAndClose = () => {
    setActiveTab('menu');
    setTitle(''); setDescription(''); setFile(null); setArtistName(''); setSelectedCategories([]);
    setHashtags([]); setCurrentHashtag(''); setMaterialUsed(''); setArtStyle('');
    setCollector(''); setPrice(''); setCreationYear(''); setDimensions('');
    setBoardName(''); setBoardDesc(''); setIsPrivate(false);
    setTargetUserId(''); setUserSearchQuery(''); setIsDropdownOpen(false);
    setSelectedBoardId('');
    onClose();
  };

  const extractColor = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          resolve("#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1));
        } else {
          resolve("#2a2a35");
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => resolve("#2a2a35");
    });
  };

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      const tag = currentHashtag.trim().replace(/^#/, '');
      if (tag && !hashtags.includes(tag)) {
        setHashtags([...hashtags, tag]);
      }
      setCurrentHashtag('');
    }
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    if (adminMode && !targetUserId) {
      toast.error('Please select an artist to post on behalf of.');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(`Image must be 10MB or smaller. Selected file is ${formatFileSize(file.size)}.`);
      return;
    }
    setUploading(true);

    try {
      const isSafe = await checkImageIsSafe(file);
      if (!isSafe) { toast.error('Upload blocked: Inappropriate content detected.'); setUploading(false); return; }

      let fileToUpload = file;
      let fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      if (file.type.startsWith('image/') && fileExt !== 'gif') {
        fileToUpload = await compressImage(file);
        fileExt = 'webp';
      }

      if (fileToUpload.size > MAX_UPLOAD_SIZE) {
        toast.error(`Compressed image is still above 10MB (${formatFileSize(fileToUpload.size)}). Please choose a smaller image.`);
        setUploading(false);
        return;
      }

      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${effectiveUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('artworks').upload(filePath, fileToUpload);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('artworks').getPublicUrl(filePath);
      
      const extractedColor = file.type.startsWith('image/') ? await extractColor(fileToUpload) : '#2a2a35';

      const { data: artwork, error: dbError } = await supabase.from('artworks').insert({
        title, description, image_url: urlData.publicUrl, user_id: effectiveUserId,
        artist_name: artistName.trim() || null,
        tags: hashtags, material_used: materialUsed, art_style: artStyle,
        collector_or_pricing: collector, price: price ? Number(price) : null, creation_year: creationYear,
        dimensions,
        dominant_color: extractedColor
      }).select().single();
      if (dbError) throw dbError;

      // Tag with categories
      if (selectedCategories.length > 0 && artwork) {
        await supabase.from('artwork_categories').insert(
          selectedCategories.map(catId => ({ artwork_id: artwork.id, category_id: catId }))
        );
      }

      // Add to portfolio
      if (selectedBoardId && artwork) {
        await supabase.from('board_items').insert({
          board_id: selectedBoardId,
          artwork_id: artwork.id
        });
      }

      toast.success('Artwork registered in the catalog.');
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
    if (adminMode && !targetUserId) {
      toast.error('Please select an artist to create the portfolio for.');
      return;
    }
    setCreatingBoard(true);
    const { error } = await supabase.from('boards').insert({
      user_id: effectiveUserId, name: boardName.trim(), description: boardDesc.trim(), is_private: isPrivate
    });
    if (error) toast.error('Failed to create portfolio');
    else { toast.success('Portfolio created.'); resetAndClose(); onBoardCreated?.(); }
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
        height: '100vh', background: '#fdfbf7', borderRight: '1px solid #e5e0d8',
        zIndex: 99999, display: 'flex', flexDirection: 'column',
        boxShadow: '10px 0 40px rgba(0,0,0,0.1)', backdropFilter: 'blur(20px)',
        animation: 'slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e5e0d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#1a1a1a' }}>
            {activeTab === 'menu' ? 'Create Record' : activeTab === 'artwork' ? 'Register Artwork' : 'New Portfolio'}
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
                  background: 'rgba(0,0,0,0.04)', border: '1px solid #e5e0d8',
                  borderRadius: '16px', cursor: 'pointer', color: '#1a1a1a', textAlign: 'left', transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(74, 52, 36, 0.1)'; e.currentTarget.style.borderColor = 'rgba(74, 52, 36, 0.3)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e5e0d8'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #4a3424, #382619)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fdfbf7' }}>
                  <ImagePlus size={22} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Register Artwork</p>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px', marginTop: '2px' }}>Create a catalog entry with image, metadata, and provenance notes</p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('board')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px',
                  background: 'rgba(0,0,0,0.04)', border: '1px solid #e5e0d8',
                  borderRadius: '16px', cursor: 'pointer', color: '#1a1a1a', textAlign: 'left', transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(74, 52, 36, 0.1)'; e.currentTarget.style.borderColor = 'rgba(74, 52, 36, 0.3)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e5e0d8'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #4a3424, #382619)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fdfbf7' }}>
                  <FolderPlus size={22} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Create Portfolio</p>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px', marginTop: '2px' }}>Organize works by artist, collector, or collection</p>
                </div>
              </button>
            </div>
          )}

          {/* ─── Post Artwork Form ─── */}
          {activeTab === 'artwork' && (
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <button type="button" onClick={() => setActiveTab('menu')} style={{ background: 'none', border: 'none', color: '#4a3424', cursor: 'pointer', fontSize: '13px', padding: 0, textAlign: 'left', fontWeight: 600 }}>
                Back to menu
              </button>

              {adminMode && (
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Post on behalf of (Artist)</label>
                  <input 
                    type="text" 
                    value={userSearchQuery}
                    onChange={e => {
                      setUserSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if (targetUserId) setTargetUserId(''); // clear selection if they type again
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    placeholder="Search name or username..."
                    className="search-input"
                    style={{ width: '100%' }}
                  />
                  {isDropdownOpen && userSearchQuery && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e0d8', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px' }}>
                      {filteredUsers.length > 0 ? filteredUsers.map(u => (
                        <div 
                          key={u.id}
                          onClick={() => {
                            setTargetUserId(u.id);
                            setUserSearchQuery(u.name || u.username || u.email || 'Unnamed');
                            setIsDropdownOpen(false);
                          }}
                          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f0e8' }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>{u.name || 'Unnamed'}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>@{u.username || 'unknown'}</div>
                        </div>
                      )) : (
                        <div style={{ padding: '10px 12px', color: '#888', fontSize: '13px' }}>No users found.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* File upload area */}
              <div style={{ border: '2px dashed rgba(74, 52, 36, 0.3)', borderRadius: '16px', padding: '30px', textAlign: 'center', cursor: 'pointer', position: 'relative', background: file ? 'rgba(74, 52, 36, 0.05)' : 'transparent', transition: 'all 0.2s' }}>
                <Upload size={28} style={{ color: '#4a3424', marginBottom: '8px' }} />
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>{file ? `${file.name} (${formatFileSize(file.size)})` : 'Click or drop image here'}</p>
                <p style={{ color: '#8c6e3d', fontSize: '11px', margin: '6px 0 0', letterSpacing: '0.5px', textTransform: 'uppercase' }}>10MB maximum, optimized to WebP</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const selected = e.target.files?.[0] || null;
                    if (selected && selected.size > MAX_UPLOAD_SIZE) {
                      toast.error(`Image must be 10MB or smaller. Selected file is ${formatFileSize(selected.size)}.`);
                      e.currentTarget.value = '';
                      setFile(null);
                      return;
                    }
                    setFile(selected);
                  }}
                  required
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Artwork Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Nocturne in Gold" required className="search-input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Original Creator / Artist</label>
                <input
                  type="text"
                  value={artistName}
                  onChange={e => setArtistName(e.target.value)}
                  placeholder="e.g. Vincent van Gogh; leave blank if this is your own work"
                  className="search-input"
                  style={{ width: '100%' }}
                />
                <p style={{ margin: '6px 0 0', color: '#8a8178', fontSize: '11px', lineHeight: 1.5 }}>
                  The logged-in account remains the registered owner of this record.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Catalog Notes</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Provenance, exhibition history, condition notes, or collection context" className="search-input" style={{ height: '80px', resize: 'vertical' }} />
              </div>

              {/* Hashtags */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#666', fontSize: '13px', fontWeight: 600 }}>Catalog Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {hashtags.map((tag, idx) => (
                    <span key={idx} style={{ background: 'rgba(74, 52, 36, 0.1)', color: '#4a3424', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      #{tag}
                      <button type="button" onClick={() => setHashtags(hashtags.filter(t => t !== tag))} style={{ background: 'none', border: 'none', color: '#4a3424', cursor: 'pointer', padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
                <input type="text" value={currentHashtag} onChange={e => setCurrentHashtag(e.target.value)} onKeyDown={handleHashtagKeyDown} placeholder="Type a tag and press Enter" className="search-input" />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Material Used</label>
                  <select value={materialUsed} onChange={e => setMaterialUsed(e.target.value)} className="search-input" style={{ width: '100%', appearance: 'none' }}>
                    <option value="">Select Material</option>
                    <option value="Oil on canvas">Oil on canvas</option>
                    <option value="Acrylic on canvas">Acrylic on canvas</option>
                    <option value="Watercolor on paper">Watercolor on paper</option>
                    <option value="Charcoal on paper">Charcoal on paper</option>
                    <option value="Graphite on paper">Graphite on paper</option>
                    <option value="Pastel on paper">Pastel on paper</option>
                    <option value="Gouache">Gouache</option>
                    <option value="Fresco">Fresco</option>
                    <option value="Mixed Media (Traditional)">Mixed Media (Traditional)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Year Created</label>
                  <input type="text" value={creationYear} onChange={e => setCreationYear(e.target.value)} placeholder="e.g. 1889" className="search-input" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Art Style</label>
                <input type="text" value={artStyle} onChange={e => setArtStyle(e.target.value)} placeholder="e.g. Renaissance portrait, modern abstraction" className="search-input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Dimensions</label>
                <input type="text" value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="e.g. 23 x 46 in, framed" className="search-input" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Collector / Status</label>
                  <input type="text" value={collector} onChange={e => setCollector(e.target.value)} placeholder="e.g. Private Collection, Available" className="search-input" style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Price</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 5000" className="search-input" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Category Tags */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '13px', fontWeight: 600 }}>Portfolio Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      style={{
                        padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid',
                        background: selectedCategories.includes(cat.id) ? 'rgba(74, 52, 36, 0.1)' : 'rgba(0,0,0,0.04)',
                        borderColor: selectedCategories.includes(cat.id) ? '#4a3424' : '#e5e0d8',
                        color: selectedCategories.includes(cat.id) ? '#4a3424' : '#666',
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add to Portfolio / Board */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '13px', fontWeight: 600 }}>Add to Portfolio (Optional)</label>
                <select 
                   value={selectedBoardId} 
                   onChange={e => setSelectedBoardId(e.target.value)}
                   className="search-input" 
                   style={{ width: '100%', appearance: 'none' }}
                >
                  <option value="">No portfolio</option>
                  {userBoards.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary" disabled={uploading} style={{ width: '100%', marginTop: '8px' }}>
                {uploading ? 'Registering...' : 'Register Artwork'}
              </button>
            </form>
          )}

          {/* ─── Create Board Form ─── */}
          {activeTab === 'board' && (
            <form onSubmit={handleCreateBoard} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <button type="button" onClick={() => setActiveTab('menu')} style={{ background: 'none', border: 'none', color: '#4a3424', cursor: 'pointer', fontSize: '13px', padding: 0, textAlign: 'left', fontWeight: 600 }}>
                Back to menu
              </button>
              
              {adminMode && (
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Create for (Artist)</label>
                  <input 
                    type="text" 
                    value={userSearchQuery}
                    onChange={e => {
                      setUserSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if (targetUserId) setTargetUserId(''); // clear selection if they type again
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    placeholder="Search name or username..."
                    className="search-input"
                    style={{ width: '100%' }}
                  />
                  {isDropdownOpen && userSearchQuery && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e0d8', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px' }}>
                      {filteredUsers.length > 0 ? filteredUsers.map(u => (
                        <div 
                          key={u.id}
                          onClick={() => {
                            setTargetUserId(u.id);
                            setUserSearchQuery(u.name || u.username || u.email || 'Unnamed');
                            setIsDropdownOpen(false);
                          }}
                          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f0e8' }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>{u.name || 'Unnamed'}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>@{u.username || 'unknown'}</div>
                        </div>
                      )) : (
                        <div style={{ padding: '10px 12px', color: '#888', fontSize: '13px' }}>No users found.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Portfolio Name</label>
                <input type="text" value={boardName} onChange={e => setBoardName(e.target.value)} placeholder='e.g. "Renaissance Masterpieces"' required className="search-input" />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Description (optional)</label>
                <textarea value={boardDesc} onChange={e => setBoardDesc(e.target.value)} placeholder="Describe this collection..." className="search-input" style={{ height: '80px', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="create-private" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#a855f7' }} />
                <label htmlFor="create-private" style={{ color: '#999', fontSize: '14px', cursor: 'pointer' }}>Make this portfolio private</label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={creatingBoard} style={{ width: '100%', marginTop: '8px' }}>
                {creatingBoard ? 'Creating...' : 'Create Portfolio'}
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

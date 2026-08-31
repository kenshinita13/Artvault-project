import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Lightbox from './Lightbox';
import { resolveArtworkImageUrl } from './imageUtils';
import { ArrowLeft, Lock, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Artwork {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  profiles?: {
    name: string;
    username: string;
  };
}

interface Board {
  id: string;
  name: string;
  description: string;
  is_private: boolean;
  user_id: string;
}

export default function CollageView({ user }: { user: any }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);

  useEffect(() => {
    if (id) fetchCollage();
  }, [id]);

  const fetchCollage = async () => {
    setLoading(true);
    // Fetch collage details
    const { data: boardData, error: boardError } = await supabase
      .from('boards')
      .select('*')
      .eq('id', id)
      .single();

    if (boardError || !boardData) {
      toast.error('Collage not found or access denied');
      navigate('/home', { replace: true });
      return;
    }
    setBoard(boardData);

    // Fetch items inside collage
    const { data: itemsData } = await supabase
      .from('board_items')
      .select('artwork_id, artworks(*, profiles(name, username))')
      .eq('board_id', id)
      .order('created_at', { ascending: false });

    if (itemsData) {
      const formattedArtworks = itemsData.map((item: any) => item.artworks).filter(Boolean);
      setArtworks(formattedArtworks);
    }
    setLoading(false);
  };

  const handleRemoveItem = async (e: React.MouseEvent, artworkId: string) => {
    e.stopPropagation();
    if (!window.confirm('Remove this artwork from the collage?')) return;
    
    const { error } = await supabase.from('board_items').delete().eq('board_id', id).eq('artwork_id', artworkId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setArtworks(prev => prev.filter(a => a.id !== artworkId));
    toast.success('Removed from collage');
  };

  if (loading) {
    return <div style={{ padding: '100px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Collage...</div>;
  }

  if (!board) return null;

  const isOwner = user?.id === board.user_id;

  return (
    <>
      <main className="gallery-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '30px' }}>
          <button 
            onClick={() => {
              if (window.history.length > 2) {
                navigate(-1);
              } else {
                navigate(`/profile/${board.user_id}?tab=collages`);
              }
            }} 
            style={{ background: 'rgba(0,0,0,0.04)', border: 'none', color: 'var(--charcoal, #1c1917)', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', transition: 'background 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '32px', margin: 0, fontWeight: 800 }}>{board.name}</h1>
              {board.is_private && <Lock size={20} style={{ color: 'var(--text-secondary)' }} />}
            </div>
            {board.description && <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>{board.description}</p>}
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '13px', fontWeight: 600 }}>{artworks.length} saved artworks</p>
          </div>
        </div>

        {/* Gallery Grid */}
        {artworks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '48px' }}>🖼️</span>
            <h4 style={{ marginTop: '15px' }}>This collage is empty</h4>
            <p style={{ marginTop: '5px' }}>Save artworks here to build your collection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-start w-full">
            {artworks.map(artwork => (
              <div key={artwork.id} className="art-card" onClick={() => setActiveArtwork(artwork)} role="button" tabIndex={0}>
                <div className="art-preview">
                  <img src={resolveArtworkImageUrl(artwork.image_url)} alt={artwork.title} />
                </div>
                <div className="art-details">
                  <div className="art-title">{artwork.title}</div>
                  <div className="art-desc-preview">by {artwork.profiles?.name || artwork.profiles?.username}</div>
                  
                  {isOwner && (
                    <div className="art-actions" style={{ marginTop: '10px' }}>
                      <button onClick={(e) => handleRemoveItem(e, artwork.id)} className="btn btn-secondary" style={{ flex: 1, color: '#ef4444' }}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  )}
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
          artistName={activeArtwork.profiles?.name || activeArtwork.profiles?.username || 'Unknown'} 
          onClose={() => setActiveArtwork(null)}
          currentUser={user}
        />
      )}
    </>
  );
}

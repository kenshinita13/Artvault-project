import { useState, useRef, useEffect } from 'react';
import { X, Flag } from 'lucide-react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';

interface LightboxProps {
  artwork: any;
  artistName: string;
  onClose: () => void;
}

export default function Lightbox({ artwork, artistName, onClose }: LightboxProps) {
  const [fullscreen, setFullscreen] = useState(false);
  
  // Panning state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  // Reset panning when exiting fullscreen
  useEffect(() => {
    if (!fullscreen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [fullscreen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!fullscreen) return;
    e.preventDefault(); // Prevent default image drag
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!fullscreen || !isDragging) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReport = async () => {
    const reason = prompt("Why are you reporting this artwork? (e.g., Inappropriate content, Copyright violation)");
    if (!reason) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to report.");
        return;
      }

      const { error } = await supabase.from('reports').insert({
        artwork_id: artwork.id,
        reporter_id: user.id,
        reason: reason
      });

      if (error) throw error;
      toast.success("Report submitted to administrators for review.");
    } catch (err: any) {
      toast.error("Error submitting report: " + err.message);
      console.error(err);
    }
  };

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={onClose}>
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <div 
          className={`lightbox-img-wrapper ${fullscreen ? 'fullscreen' : ''}`} 
          onClick={() => !fullscreen && setFullscreen(true)}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: fullscreen ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in', overflow: 'hidden' }}
        >
          {fullscreen && (
            <button className="fullscreen-close" onClick={(e) => { e.stopPropagation(); setFullscreen(false); }} style={{ zIndex: 100 }}>
              <X size={20} />
            </button>
          )}
          <img 
            src={artwork.image_url} 
            alt={artwork.title} 
            style={fullscreen ? { transform: `translate(${position.x}px, ${position.y}px)`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' } : {}}
            draggable={false}
          />
          {!fullscreen && <div className="zoom-indicator">🔍 Click Image to Zoom</div>}
        </div>
        {!fullscreen && (
          <div className="lightbox-info">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <h2 className="lightbox-title">{artwork.title}</h2>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '24px', cursor: 'pointer', padding: 0 }}>
                <X size={24} />
              </button>
            </div>
            <div className="lightbox-artist">By {artistName}</div>
            
            <div className="lightbox-desc-title">Description</div>
            <div className="lightbox-desc">{artwork.description || 'No description provided for this artwork.'}</div>
            
            <div className="lightbox-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Published on: {new Date(artwork.created_at).toLocaleDateString()}</span>
              <button 
                onClick={handleReport} 
                style={{ background: 'none', border: 'none', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}
              >
                <Flag size={14} /> Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

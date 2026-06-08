import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  
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

  const confirmReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to report.");
        return;
      }

      const { error } = await supabase.from('reports').insert({
        artwork_id: artwork.id,
        reporter_id: user.id,
        reason: reportReason
      });

      if (error) throw error;
      toast.success("Report submitted to administrators for review.");
      setReportModalOpen(false);
      setReportReason('');
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
            <div className="lightbox-artist">
              By <Link to={`/profile/${artwork.user_id}`} onClick={onClose} style={{ color: '#a855f7', textDecoration: 'none', fontWeight: 'bold' }}>{artistName}</Link>
            </div>
            
            <div className="lightbox-desc-title">Description</div>
            <div className="lightbox-desc">{artwork.description || 'No description provided for this artwork.'}</div>
            
            <div className="lightbox-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Published on: {new Date(artwork.created_at).toLocaleDateString()}</span>
              <button 
                onClick={() => setReportModalOpen(true)} 
                style={{ background: 'none', border: 'none', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px' }}
              >
                <Flag size={14} /> Report
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="modal" style={{ zIndex: 1000000 }} onClick={(e) => { e.stopPropagation(); setReportModalOpen(false); }}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)' }}>Report Artwork</h3>
              <button onClick={() => setReportModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={confirmReport}>
                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Reason for Reporting</label>
                  <textarea 
                    className="search-input" 
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    style={{ height: '100px', resize: 'vertical' }}
                    placeholder="e.g., Inappropriate content, Copyright violation, Spam"
                    required 
                  ></textarea>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setReportModalOpen(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger" style={{ flex: 1 }}>
                    Submit Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

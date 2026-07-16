import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import './LandingPage.css';

const fallbackImages = [
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1578301978018-3005759f48f7?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1557672172-298e090bd0f1?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1541961017774-22349e4a1262?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=800&auto=format&fit=crop",
];

const features = [
  {
    icon: "⊛",
    title: "Provenance Tracking",
    desc: "Document the complete historical journey of each work — from creation through exhibitions, auctions, and private collections."
  },
  {
    icon: "◈",
    title: "Ownership Chain",
    desc: "Maintain an immutable, chronological record of ownership transfers, verified by legal documentation and certificates."
  },
  {
    icon: "⊕",
    title: "Legal Document Vault",
    desc: "Securely archive Bills of Sale, Transfer Agreements, Estate Documentation, Loan Agreements, and Exhibition Contracts."
  },
  {
    icon: "◎",
    title: "Certificate Repository",
    desc: "Store Certificates of Authenticity, Expert Appraisals, and Provenance Verification documents with version control."
  },
  {
    icon: "⊞",
    title: "Audit Trail System",
    desc: "Every action is permanently recorded. Records cannot be deleted — only archived, superseded, or amended."
  },
  {
    icon: "◇",
    title: "Enterprise Governance",
    desc: "Role-based access for Executive Administrators, Collection Directors, Legal Officers, Curators, and Archivists."
  },
];

const collections = [
  { label: "Classical Art" },
  { label: "Fine Art" },
  { label: "Modern Art" },
  { label: "Sculptures" },
  { label: "Historical Artifacts" },
  { label: "Rare Collections" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [heroImages, setHeroImages] = useState<string[]>(fallbackImages.slice(0, 3));
  const [activeImage, setActiveImage] = useState(0);
  const dbUrlsRef = useRef<string[]>([]);

  // Rotate hero image
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveImage(prev => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Fetch real artworks for hero
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('artworks')
        .select('image_url')
        .order('created_at', { ascending: false })
        .limit(6);
      if (data && data.length >= 3) {
        const urls = data.map((d: any) => d.image_url).filter(Boolean);
        dbUrlsRef.current = urls;
        setHeroImages(urls.slice(0, 3));
      }
    };
    fetch();
  }, []);

  return (
    <div className="landing-page" style={{ background: '#f5f0e8', color: '#1c1917', fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>

      {/* ═══════════════════════════════════
          TOP NAVIGATION
          ═══════════════════════════════════ */}
      <header className="landing-header" style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '72px',
        background: 'rgba(245, 240, 232, 0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #d6cfc3', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px'
      }}>
        {/* Logo */}
        <Link className="landing-brand" to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
          <img src="/Artlogo.png" alt="ArtVault" style={{ height: 36, objectFit: 'contain', filter: 'brightness(0)' }} />
          <div className="landing-brand-copy">
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, letterSpacing: '3px', color: '#1c1917', lineHeight: 1 }}>
              ARTVAULT
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: '#78716c', letterSpacing: '2.5px', textTransform: 'uppercase', marginTop: 3 }}>
              Enterprise Edition
            </div>
          </div>
        </Link>

        {/* Center Nav */}
        <nav className="landing-primary-nav" style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          {[
            { label: 'Collections', action: () => document.getElementById('collections-section')?.scrollIntoView({ behavior: 'smooth' }) },
            { label: 'Provenance', action: () => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' }) },
            { label: 'Governance', action: () => document.getElementById('governance-section')?.scrollIntoView({ behavior: 'smooth' }) },
            { label: 'About', action: () => navigate('/about') },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              style={{ background: 'none', border: 'none', fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#78716c', letterSpacing: '0.5px', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#1c1917')}
              onMouseLeave={e => (e.currentTarget.style.color = '#78716c')}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="landing-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="landing-sign-in"
            onClick={() => navigate('/login?mode=login')}
            style={{ background: 'none', border: 'none', fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#44403c', cursor: 'pointer', fontWeight: 500 }}
          >
            Sign In
          </button>
          <button
            className="landing-request-access"
            onClick={() => navigate('/login?mode=register')}
            style={{
              background: '#1c1917', color: '#f5f0e8',
              border: '1px solid #1c1917', borderRadius: 4,
              padding: '9px 22px', fontFamily: "'Inter', sans-serif",
              fontSize: 12, fontWeight: 600, letterSpacing: '1.5px',
              textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#8c6e3d'; (e.currentTarget as HTMLElement).style.borderColor = '#8c6e3d'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1c1917'; (e.currentTarget as HTMLElement).style.borderColor = '#1c1917'; }}
          >
            Request Access
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════
          HERO — Full-bleed Museum Masthead
          ═══════════════════════════════════ */}
      <section className="landing-hero" style={{ paddingTop: 72, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="landing-hero-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 72px)' }}>

          {/* Left: Text */}
          <div className="landing-hero-copy" style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '80px 64px 80px 64px',
            borderRight: '1px solid #d6cfc3'
          }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#b8975a', marginBottom: 24 }}>
                ArtVault Enterprise Edition
              </div>

              <h1 className="landing-hero-title" style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', serif", fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: 400, lineHeight: 1.1, color: '#1c1917', margin: '0 0 32px 0' }}>
                Preserving<br />
                <em style={{ fontStyle: 'italic', color: '#8c6e3d' }}>Heritage.</em><br />
                Protecting<br />
                Ownership.
              </h1>

              <p className="landing-hero-description" style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, lineHeight: 1.8, color: '#44403c', maxWidth: 420, marginBottom: 44 }}>
                ArtVault is the institution-grade archival platform trusted by museums, galleries, foundations, estates, and private collectors to maintain the permanent record of fine art and rare collections.
              </p>

              <div className="landing-hero-actions" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 56 }}>
                <button
                  onClick={() => navigate('/home')}
                  style={{
                    padding: '14px 32px', background: '#1c1917', color: '#f5f0e8',
                    border: '1px solid #1c1917', borderRadius: 4,
                    fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600,
                    letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s'
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#8c6e3d'; (e.currentTarget as HTMLElement).style.borderColor = '#8c6e3d'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1c1917'; (e.currentTarget as HTMLElement).style.borderColor = '#1c1917'; }}
                >
                  View Collection Registry
                </button>
                <button
                  onClick={() => navigate('/login?mode=register')}
                  style={{
                    padding: '14px 32px', background: 'transparent', color: '#1c1917',
                    border: '1px solid #d6cfc3', borderRadius: 4,
                    fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600,
                    letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s'
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#b8975a'; (e.currentTarget as HTMLElement).style.color = '#8c6e3d'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d6cfc3'; (e.currentTarget as HTMLElement).style.color = '#1c1917'; }}
                >
                  Request Institutional Access
                </button>
              </div>

              {/* Collection Types */}
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: '#78716c', marginBottom: 12 }}>
                  Supported Collections
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {collections.map(c => (
                    <span key={c.label} style={{
                      padding: '4px 12px', borderRadius: 20,
                      border: '1px solid #d6cfc3', background: '#ede7d9',
                      fontFamily: "'Inter', sans-serif", fontSize: 12,
                      color: '#44403c', letterSpacing: '0.3px'
                    }}>
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right: Rotating Artwork Masthead */}
          <div className="landing-hero-art" style={{ position: 'relative', overflow: 'hidden', background: '#0d0c0a' }}>
            {heroImages.map((src, i) => (
              <motion.img
                key={src + i}
                src={src}
                alt="Featured collection artwork"
                className="landing-hero-image"
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: i === activeImage ? 1 : 0 }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
              />
            ))}
            {/* Museum label overlay */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '48px 40px 36px',
              background: 'linear-gradient(to top, rgba(13,12,10,0.85) 0%, transparent 100%)',
            }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase', color: '#b8975a', marginBottom: 6 }}>
                Collection Registry
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: '#f5f0e8', fontWeight: 400 }}>
                Fine Art &amp; Heritage Archive
              </div>
            </div>
            {/* Dot indicators */}
            <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 6 }}>
              {heroImages.map((_, i) => (
                <button key={i} onClick={() => setActiveImage(i)} aria-label={`Show featured artwork ${i + 1}`} aria-pressed={i === activeImage} style={{
                  width: i === activeImage ? 20 : 8, height: 8,
                  background: i === activeImage ? '#b8975a' : 'rgba(245,240,232,0.3)',
                  border: 'none', borderRadius: 4, cursor: 'pointer', transition: 'all 0.3s', padding: 0
                }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          INSTITUTION STATEMENT
          ═══════════════════════════════════ */}
      <section className="landing-responsive-section" style={{ background: '#1c1917', padding: '80px 64px', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#b8975a', marginBottom: 20 }}>
            Our Mission
          </div>
          <blockquote style={{
            fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(22px, 3.5vw, 38px)',
            fontStyle: 'italic', fontWeight: 400, color: '#f5f0e8',
            maxWidth: 860, margin: '0 auto 24px', lineHeight: 1.5
          }}>
            "ArtVault serves as a trusted system of record — focused on provenance, ownership integrity, legal documentation, and the historical preservation of humanity's cultural heritage."
          </blockquote>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#78716c', letterSpacing: '1px' }}>
            — ArtVault Enterprise Charter
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════
          ENTERPRISE FEATURES
          ═══════════════════════════════════ */}
      <section id="features-section" className="landing-responsive-section" style={{ padding: '100px 64px', background: '#f5f0e8' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#b8975a', marginBottom: 16, textAlign: 'center' }}>
              Platform Capabilities
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, textAlign: 'center', color: '#1c1917', marginBottom: 70, lineHeight: 1.2 }}>
              Enterprise-Grade Archival<br />for Serious Institutions
            </h2>
          </motion.div>

          <div className="landing-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2, border: '1px solid #d6cfc3' }}>
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="landing-feature-item"
                style={{
                  background: '#fdfaf5', padding: '40px 36px',
                  borderRight: '1px solid #d6cfc3', borderBottom: '1px solid #d6cfc3',
                  transition: 'background 0.25s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#ede7d9')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fdfaf5')}
              >
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: '#b8975a', marginBottom: 18, lineHeight: 1 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: '#1c1917', marginBottom: 12 }}>
                  {f.title}
                </h3>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, lineHeight: 1.75, color: '#44403c' }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          ROLES — Enterprise Structure / Collections
          ═══════════════════════════════════ */}
      <section id="collections-section" className="landing-responsive-section" style={{ padding: '100px 64px', background: '#ede7d9', borderTop: '1px solid #d6cfc3' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#b8975a', marginBottom: 16 }}>
              Governance Structure
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 600, color: '#1c1917', marginBottom: 56, lineHeight: 1.2 }}>
              Purpose-Built Roles for<br />Institutional Responsibility
            </h2>
          </motion.div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {[
              { role: 'Executive Administrator', desc: 'Platform governance & security' },
              { role: 'Collection Director', desc: 'Collection management authority' },
              { role: 'Legal Officer', desc: 'Documentation & legal compliance' },
              { role: 'Curator', desc: 'Artwork review & authentication' },
              { role: 'Archivist', desc: 'Historical records preservation' },
              { role: 'Artist', desc: 'Artwork submission & portfolio' },
              { role: 'Collector', desc: 'Collection & transfer management' },
              { role: 'Viewer', desc: 'Public collection access' },
            ].map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                style={{
                  background: '#fdfaf5', border: '1px solid #d6cfc3',
                  borderRadius: 4, padding: '18px 24px',
                  textAlign: 'left', minWidth: 200, flex: '1 1 220px', maxWidth: 280
                }}
              >
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: '#1c1917', marginBottom: 4 }}>
                  {r.role}
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#78716c', letterSpacing: '0.3px' }}>
                  {r.desc}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          CTA — Institutional Access / Governance
          ═══════════════════════════════════ */}
      <section id="governance-section" className="landing-responsive-section" style={{ padding: '100px 64px', background: '#1c1917', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#b8975a', marginBottom: 20 }}>
            Begin Archival
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 400, fontStyle: 'italic', color: '#f5f0e8', marginBottom: 20, lineHeight: 1.2 }}>
            Your Collection Deserves<br />a Permanent Record
          </h2>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#78716c', maxWidth: 520, margin: '0 auto 44px', lineHeight: 1.8 }}>
            Join the institutions and collectors who trust ArtVault to safeguard the ownership, provenance, and legal integrity of their collections.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/login?mode=register')}
              style={{
                padding: '16px 40px', background: '#b8975a', color: '#1c1917',
                border: '1px solid #b8975a', borderRadius: 4,
                fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700,
                letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#8c6e3d'; (e.currentTarget as HTMLElement).style.color = '#f5f0e8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#b8975a'; (e.currentTarget as HTMLElement).style.color = '#1c1917'; }}
            >
              Open an Account
            </button>
            <button
              onClick={() => navigate('/home')}
              style={{
                padding: '16px 40px', background: 'transparent', color: '#f5f0e8',
                border: '1px solid rgba(245,240,232,0.2)', borderRadius: 4,
                fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600,
                letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.25s'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,240,232,0.5)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,240,232,0.2)'; }}
            >
              Browse Registry
            </button>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════
          FOOTER
          ═══════════════════════════════════ */}
      <footer className="landing-footer" style={{ background: '#0d0c0a', padding: '48px 64px', borderTop: '1px solid #2c2825' }}>
        <div className="landing-footer-inner" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, letterSpacing: '3px', color: '#f5f0e8', marginBottom: 4 }}>
              ARTVAULT
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#78716c', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Preserving Heritage. Protecting Ownership.
            </div>
          </div>
          <div className="landing-footer-links" style={{ display: 'flex', gap: 32 }}>
            {([
              { label: 'Collections', action: () => document.getElementById('collections-section')?.scrollIntoView({ behavior: 'smooth' }) },
              { label: 'Provenance',  action: () => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' }) },
              { label: 'Governance',  action: () => document.getElementById('governance-section')?.scrollIntoView({ behavior: 'smooth' }) },
              { label: 'Sign In',     action: () => navigate('/login?mode=login') },
            ] as { label: string; action: () => void }[]).map(item => (
              <button
                key={item.label}
                onClick={item.action}
                style={{ background: 'none', border: 'none', fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#78716c', cursor: 'pointer', letterSpacing: '0.5px', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#b8975a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#78716c')}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#44403c', letterSpacing: '0.5px' }}>
            © {new Date().getFullYear()} ArtVault Enterprise. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}

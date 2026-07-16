import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './About.css';

export default function About({ user }: { user: any }) {
  const navigate = useNavigate();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('Occasional Art Vault updates, straight to your inbox.');

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNewsletterSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setNewsletterMessage(
      newsletterEmail.trim()
        ? 'Thank you. Newsletter signup will be connected before deployment.'
        : 'Enter an email address to join the Art Vault update list.'
    );
  };

  return (
    <div className="about-page">
      <div style={{ padding: '20px 5%', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <button 
          onClick={() => navigate(-1)} 
          className="about-btn-ghost" 
          style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', border: 'none', cursor: 'pointer' }}
        >
          <span>←</span> Go Back
        </button>
      </div>

      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section className="about-hero">
        <div className="about-hero-left">
          <p className="about-section-label">ABOUT ART VAULT</p>
          <h1 className="about-hero-title">
            A better way to collect, catalog, and preserve art.
          </h1>
          <p className="about-hero-desc">
            Art Vault is an enterprise-grade archival and collection management platform built for museums,
            galleries, foundations, estates, private collectors, and artists. We make it simple to organize
            your collection, authenticate provenance, and preserve the stories behind the art you love.
          </p>
          <button className="about-btn-dark" onClick={() => scrollToSection('mission')}>
            Our Mission →
          </button>
        </div>
        <div className="about-hero-right">
          <img src="/about_hero.png" alt="Gallery wall with framed artworks" className="about-hero-img" />
        </div>
      </section>

      {/* ── FOUR PILLARS ─────────────────────────────────────────── */}
      <section className="about-pillars">
        <div className="about-pillar">
          <div className="about-pillar-icon">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
          </div>
          <h3 className="about-pillar-title">Catalog</h3>
          <p className="about-pillar-desc">Organize your art with powerful tools to catalog, tag, and archive every detail — provenance, dimensions, materials, and more.</p>
        </div>
        <div className="about-pillar">
          <div className="about-pillar-icon">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <h3 className="about-pillar-title">Discover</h3>
          <p className="about-pillar-desc">Explore thousands of classical, fine art, and historical works. Stay informed about provenance and authenticated collections.</p>
        </div>
        <div className="about-pillar">
          <div className="about-pillar-icon">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
          </div>
          <h3 className="about-pillar-title">Preserve</h3>
          <p className="about-pillar-desc">Your collection is yours — private, secure, and always accessible. Institution-grade archiving for every piece you own.</p>
        </div>
        <div className="about-pillar">
          <div className="about-pillar-icon">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
          </div>
          <h3 className="about-pillar-title">Community</h3>
          <p className="about-pillar-desc">Connect with collectors, curators, and institutions who share your passion for preserving art heritage.</p>
        </div>
      </section>

      {/* ── OUR STORY ────────────────────────────────────────────── */}
      <section className="about-story" id="mission">
        <div className="about-story-left">
          <p className="about-section-label">OUR STORY</p>
          <h2 className="about-story-title">Why We Built<br />Art Vault</h2>
          <p className="about-story-text">
            We have always believed that art has the power to inspire, challenge, and connect us. But as collectors and institutions ourselves, we found that managing a collection was harder than it should be.
          </p>
          <p className="about-story-text">
            Spreadsheets, boxes of receipts, lost provenance: there had to be a better way.
          </p>
          <p className="about-story-text">
            So we built Art Vault. A place where every piece of art has a home, every detail has a place, and every collector has the tools to preserve what matters most.
          </p>
        </div>
        <div className="about-story-center">
          <img src="/about_portrait.png" alt="Art Vault founder" className="about-story-img" />
        </div>
        <div className="about-story-right">
          <p className="about-section-label">FOUNDERS</p>
          <h3 className="about-founders-title">Built by collectors</h3>
          <p className="about-founders-text">
            Art Vault is shaped by years of collecting, cataloging, and listening to the needs of collectors and institutions who care about the story behind each work.
          </p>
        </div>
      </section>

      {/* ── FEATURES SHOWCASE ────────────────────────────────────── */}
      <section className="about-features">
        <div className="about-features-left">
          <p className="about-section-label">BUILT FOR COLLECTORS</p>
          <h2 className="about-features-title">Everything You Need, All in One Place</h2>
          <p className="about-features-desc">
            From cataloging and tracking to provenance and collection insights, Art Vault gives you complete control of your collection.
          </p>
        </div>
        <div className="about-features-right">
          <div className="about-collection-card">
            <div className="about-collection-header">
              <span className="about-collection-title">Collection Registry</span>
              <Link to="/home" className="about-collection-cta">View Registry →</Link>
            </div>
            <div className="about-collection-stats">
              <div className="about-stat-box">
                <span className="about-stat-label">Registered Artworks</span>
                <span className="about-stat-value">10,000+</span>
              </div>
              <div className="about-stat-box">
                <span className="about-stat-label">Verified Artists</span>
                <span className="about-stat-value">2,400+</span>
              </div>
              <div className="about-stat-box">
                <span className="about-stat-label">Institutions</span>
                <span className="about-stat-value">150+</span>
              </div>
            </div>
            <div className="about-feature-list">
              {[
                'Provenance & ownership chain tracking',
                'Material, medium & dimension records',
                'Secure document & certificate storage',
                'Advanced search & filtering',
                'Role-based institutional access',
              ].map((f, i) => (
                <div key={i} className="about-feature-item">
                  <span className="about-feature-check">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ROADMAP ──────────────────────────────────────────────── */}
      <section className="about-roadmap" id="roadmap">
        <div className="about-roadmap-left">
          <p className="about-section-label">ROADMAP</p>
          <h2 className="about-roadmap-title">Where We're<br />Headed</h2>
          <p className="about-roadmap-desc">
            We are building toward richer collection management, stronger discovery, and better tools for the institutions and galleries who keep art moving.
          </p>
        </div>
        <div className="about-roadmap-right">
          {[
            {
              icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"/></svg>,
              status: 'Next',
              label: 'Gallery Workspaces',
              desc: 'Tools for galleries to manage artists, inventory, exhibitions, and staff access.',
            },
            {
              icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/></svg>,
              status: 'Next',
              label: 'Collection Sharing',
              desc: 'Privacy-first public collection paths with previews, sharing controls, and follow activity.',
            },
            {
              icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>,
              status: 'Upcoming',
              label: 'Market & Sales',
              desc: 'Member-to-member interest, sale tracking, and value signals for collected artworks.',
            },
            {
              icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
              status: 'Upcoming',
              label: 'Data Quality',
              desc: 'Duplicate detection, reporting, and admin review workflows to keep records trustworthy.',
            },
          ].map((item, i) => (
            <div key={i} className="about-roadmap-item">
              <div className="about-roadmap-icon">{item.icon}</div>
              <div className="about-roadmap-dot" />
              <span className={`about-roadmap-status ${item.status === 'Next' ? 'next' : 'upcoming'}`}>{item.status}</span>
              <h4 className="about-roadmap-label">{item.label}</h4>
              <p className="about-roadmap-desc-item">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA SECTION ──────────────────────────────────────────── */}
      <section className="about-cta">
        <div className="about-cta-left">
          <p className="about-section-label">{user ? 'YOUR ART VAULT' : 'JOIN OUR COMMUNITY'}</p>
          <h2 className="about-cta-title">Your Art. Your Archive.<br />Your Legacy.</h2>
          <p className="about-cta-desc">
            {user
              ? 'Continue building your archive, reviewing your registered works, and preserving the history behind your collection.'
              : 'Thousands of collectors already trust Art Vault to preserve and grow their collections. Create your free account and start building your archive today.'}
          </p>
          <div className="about-cta-actions">
            {user ? (
              <Link to={`/profile/${user.id}`} className="about-btn-dark">View Your Profile →</Link>
            ) : (
              <Link to="/login" className="about-btn-dark">Create Your Account →</Link>
            )}
            <Link to={user ? '/registry' : '/home'} className="about-btn-ghost">
              {user ? 'Browse Registry →' : 'Explore Artworks →'}
            </Link>
          </div>
        </div>
        <div className="about-cta-right">
          <img src="/about_community.png" alt="Art supplies and collection" className="about-cta-img" />
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="about-footer">
        <div className="about-footer-inner">
          <div className="about-footer-brand">
            <div className="about-footer-logo">
              <img src="/Artlogo.png" alt="ArtVault" style={{ height: 28, filter: 'brightness(0)', marginRight: 8 }} />
              <span className="about-footer-logo-text">ART VAULT</span>
            </div>
            <p className="about-footer-tagline">Catalog. Discover. Preserve.</p>
          </div>

          <div className="about-footer-col">
            <p className="about-footer-col-title">COMPANY</p>
            <Link to="/about" className="about-footer-link active">About Us</Link>
            <button onClick={() => scrollToSection('roadmap')} className="about-footer-link" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>Features & Roadmap</button>
            <Link to={user ? '/settings' : '/login'} className="about-footer-link">
              {user ? 'Account Settings' : 'Membership'}
            </Link>
          </div>

          <div className="about-footer-col">
            <p className="about-footer-col-title">EXPLORE</p>
            <Link to="/home" className="about-footer-link">Discover</Link>
            <Link to="/artists" className="about-footer-link">Artists</Link>
            <Link to="/registry" className="about-footer-link">Exhibitions</Link>
            <Link to="/registry" className="about-footer-link">Collections</Link>
          </div>

          <div className="about-footer-col">
            <p className="about-footer-col-title">RESOURCES</p>
            <button onClick={() => scrollToSection('mission')} className="about-footer-link" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>Welcome Guide</button>
            <Link to="/about" className="about-footer-link">Contact</Link>
          </div>

          <div className="about-footer-col">
            <p className="about-footer-col-title">NEWSLETTER</p>
            <form className="about-footer-newsletter" onSubmit={handleNewsletterSubmit}>
              <input
                type="email"
                placeholder="you@example.com"
                className="about-footer-input"
                value={newsletterEmail}
                onChange={event => setNewsletterEmail(event.target.value)}
              />
              <button className="about-footer-send" type="submit">-&gt;</button>
            </form>
            <p className="about-footer-newsletter-note">{newsletterMessage}</p>
          </div>
        </div>

        <div className="about-footer-bottom">
          <span>© 2026 Art Vault. All rights reserved.</span>
          <div className="about-footer-bottom-links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/about">Contact</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

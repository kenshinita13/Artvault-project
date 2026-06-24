import { Link } from 'react-router-dom';
import './About.css';

type LegalPageProps = {
  type: 'privacy' | 'terms';
};

export default function LegalPage({ type }: LegalPageProps) {
  const isPrivacy = type === 'privacy';

  return (
    <main className="about-page legal-page">
      <section className="legal-page-inner">
        <p className="about-section-label">ART VAULT POLICY</p>
        <h1 className="about-hero-title">{isPrivacy ? 'Privacy Policy' : 'Terms of Service'}</h1>
        <p className="about-hero-desc">
          {isPrivacy
            ? 'Art Vault stores collection records, artwork metadata, account details, and uploaded media only for platform use, catalog management, moderation, and secure archival access.'
            : 'Art Vault is a capstone collection management platform for registering, browsing, and preserving artwork records. Users remain responsible for the accuracy and rights status of works they upload.'}
        </p>

        <div className="legal-section-grid">
          <article className="legal-section-card">
            <h2>{isPrivacy ? 'Information We Store' : 'Registered Records'}</h2>
            <p>
              {isPrivacy
                ? 'Account profiles, artwork images, original creator names, valuations, collection metadata, and moderation records may be stored in Supabase to support the registry.'
                : 'The account that uploads a work is treated as the registered owner of the digital record. The original creator field identifies who created the artwork itself.'}
            </p>
          </article>

          <article className="legal-section-card">
            <h2>{isPrivacy ? 'Access and Security' : 'User Responsibility'}</h2>
            <p>
              {isPrivacy
                ? 'Role-based access, authentication, and admin review tools protect account and collection data. Sensitive operational access remains restricted to authorized roles.'
                : 'Users should only upload works they are allowed to register or display, and should provide truthful creator, provenance, material, and valuation information.'}
            </p>
          </article>

          <article className="legal-section-card">
            <h2>{isPrivacy ? 'Platform Use' : 'Moderation'}</h2>
            <p>
              {isPrivacy
                ? 'Data may be used to render the gallery, filter the registry, verify metadata completeness, moderate reports, and improve collection browsing.'
                : 'Art Vault may restrict, remove, or review records that are inaccurate, inappropriate, duplicated, or outside the intended fine-art registry scope.'}
            </p>
          </article>
        </div>

        <div className="legal-page-actions">
          <Link to="/about" className="about-btn-ghost">Back to About</Link>
          <Link to="/registry" className="about-btn-dark">View Registry</Link>
        </div>
      </section>
    </main>
  );
}

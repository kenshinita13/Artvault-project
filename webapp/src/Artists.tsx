import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Avatar from './Avatar';
import { isPublic, ROLES } from './roles';
import './Dashboard.css';

interface ArtistProfile {
  id: string;
  name: string;
  username: string;
  role: string;
  total_uploads: number;
}

export default function Artists() {
  const [artists, setArtists] = useState<ArtistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLetter, setActiveLetter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('all');

  async function fetchArtists() {
    setLoading(true);

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*');

    if (profileError) {
      console.error(profileError);
      setLoading(false);
      return;
    }

    const { data: artworks, error: artError } = await supabase
      .from('artworks')
      .select('user_id');

    if (artError) {
      console.error(artError);
      setLoading(false);
      return;
    }

    const uploadCounts = (artworks || []).reduce((acc: Record<string, number>, art: any) => {
      acc[art.user_id] = (acc[art.user_id] || 0) + 1;
      return acc;
    }, {});

    const fullProfiles = (profiles || [])
      .filter((p: any) => isPublic(p.role || 'user'))
      .map((p: any) => ({
        ...p,
        total_uploads: uploadCounts[p.id] || 0
      }));

    fullProfiles.sort((a, b) => {
      const nameCompare = (a.name || a.username || '').localeCompare(b.name || b.username || '');
      return nameCompare || b.total_uploads - a.total_uploads;
    });
    setArtists(fullProfiles);
    setLoading(false);
  }

  useEffect(() => {
    fetchArtists();
  }, []);

  const artistLetters = useMemo(() => {
    const letters = new Set<string>();
    artists.forEach((artist) => {
      const label = (artist.name || artist.username || '').trim();
      const first = label.charAt(0).toUpperCase();
      letters.add(/^[A-Z]$/.test(first) ? first : '#');
    });
    return ['All', ...Array.from(letters).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    })];
  }, [artists]);

  const filteredArtists = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return artists.filter((artist) => {
      const label = (artist.name || artist.username || '').trim();
      const first = label.charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(first) ? first : '#';
      const matchesLetter = activeLetter === 'All' || letter === activeLetter;
      const matchesRole = roleFilter === 'all' || artist.role === roleFilter;
      const matchesSearch = !search || [
        artist.name,
        artist.username,
        ROLES[artist.role as keyof typeof ROLES]?.label,
      ].filter(Boolean).some((value) => value.toLowerCase().includes(search));

      return matchesLetter && matchesRole && matchesSearch;
    });
  }, [activeLetter, artists, roleFilter, searchTerm]);

  const groupedArtists = useMemo(() => {
    return filteredArtists.reduce((groups: Record<string, ArtistProfile[]>, artist) => {
      const label = (artist.name || artist.username || '').trim();
      const first = label.charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(first) ? first : '#';
      groups[letter] = [...(groups[letter] || []), artist];
      return groups;
    }, {});
  }, [filteredArtists]);

  const groupedLetters = Object.keys(groupedArtists).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  const hasActiveFilters = searchTerm.trim() !== '' || activeLetter !== 'All' || roleFilter !== 'all';

  const publicRoleOptions = Array.from(new Set(artists.map((artist) => artist.role)))
    .filter((role) => isPublic(role))
    .sort((a, b) => (ROLES[a as keyof typeof ROLES]?.label || a).localeCompare(ROLES[b as keyof typeof ROLES]?.label || b));

  return (
    <main className="directory-container">
      <div className="directory-header">
        <span className="directory-kicker">Artist Registry</span>
        <h2>ArtVault Contributors</h2>
        <p>Browse collection holders, artists, and registered artwork portfolios by name</p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading directory...</p>
      ) : artists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
          <span className="registry-empty-icon">AV</span>
          <h4 style={{ marginTop: '15px' }}>No Contributors Found</h4>
        </div>
      ) : (
        <section className="artist-directory-shell">
          <aside className="artist-directory-index" aria-label="Artist alphabetical filter">
            {artistLetters.map((letter) => (
              <button
                key={letter}
                type="button"
                className={`artist-index-letter ${activeLetter === letter ? 'active' : ''}`}
                onClick={() => setActiveLetter(letter)}
              >
                {letter}
              </button>
            ))}
          </aside>

          <div className="artist-directory-main">
            <div className="artist-directory-toolbar">
              <div className="artist-search-field">
                <span>Search</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Artist name, handle, or role"
                  aria-label="Search artists"
                />
              </div>

              <label className="artist-filter-field">
                <span>Role</span>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="all">All public roles</option>
                  {publicRoleOptions.map((role) => (
                    <option key={role} value={role}>
                      {ROLES[role as keyof typeof ROLES]?.label || role}
                    </option>
                  ))}
                </select>
              </label>

              <div className="artist-directory-count" aria-live="polite">
                <strong>{filteredArtists.length}</strong>
                <span>{filteredArtists.length === 1 ? 'profile' : 'profiles'}</span>
              </div>

              <button
                type="button"
                className="artist-directory-reset"
                onClick={() => {
                  setSearchTerm('');
                  setActiveLetter('All');
                  setRoleFilter('all');
                }}
                disabled={!hasActiveFilters}
              >
                Reset
              </button>
            </div>

            {filteredArtists.length === 0 ? (
              <div className="artist-empty-state">
                <span className="registry-empty-icon">AV</span>
                <h4>No Matching Artists</h4>
                <p>Try another name, handle, role, or alphabet filter.</p>
              </div>
            ) : (
              <div className="artist-letter-sections">
                {groupedLetters.map((letter) => (
                  <section key={letter} className="artist-letter-section" aria-labelledby={`artist-letter-${letter}`}>
                    <div className="artist-letter-heading" id={`artist-letter-${letter}`}>
                      <span>{letter}</span>
                      <small>{groupedArtists[letter].length} {groupedArtists[letter].length === 1 ? 'profile' : 'profiles'}</small>
                    </div>

                    <div className="artist-list">
                      {groupedArtists[letter].map((artist) => {
                        const roleLabel = ROLES[artist.role as keyof typeof ROLES]?.label || 'Contributor';

                        return (
                          <article key={artist.id} className="artist-directory-row">
                            <div className="artist-row-avatar">
                              <Avatar userId={artist.id} name={artist.name || artist.username} size={54} />
                            </div>

                            <div className="artist-row-identity">
                              <h3>{artist.name || 'Unnamed Contributor'}</h3>
                              <span>@{artist.username || 'unlisted'}</span>
                            </div>

                            <div className="artist-row-role">
                              {roleLabel}
                            </div>

                            <div className="artist-row-count">
                              <strong>{artist.total_uploads}</strong>
                              <span>Registered Works</span>
                            </div>

                            <Link to={`/profile/${artist.id}`} className="artist-row-link">
                              View Profile
                            </Link>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

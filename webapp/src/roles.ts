// ─── ArtVault Role System ────────────────────────────────────────
// Central role definitions used across the entire application.

export type ArtVaultRole = 'admin' | 'moderator' | 'curator' | 'artist' | 'user';

export const ROLES: Record<ArtVaultRole, { label: string; color: string; bg: string; border: string; description: string }> = {
  admin: {
    label: 'Administrator',
    color: '#991b1b',
    bg: 'rgba(153,27,27,0.08)',
    border: 'rgba(153,27,27,0.25)',
    description: 'Full platform access — role management, account deletion, edit any artist folder.',
  },
  moderator: {
    label: 'Moderator',
    color: '#92400e',
    bg: 'rgba(146,64,14,0.08)',
    border: 'rgba(146,64,14,0.25)',
    description: 'Content moderation — access and edit all art folders, manage reports and tickets.',
  },
  curator: {
    label: 'Curator',
    color: '#0f766e',
    bg: 'rgba(15,118,110,0.08)',
    border: 'rgba(15,118,110,0.25)',
    description: 'Collection curation — upload and annotate artwork entries in the registry.',
  },
  artist: {
    label: 'Artist',
    color: '#b8975a',
    bg: 'rgba(184,151,90,0.08)',
    border: 'rgba(184,151,90,0.25)',
    description: 'Artwork submission — upload and manage personal artwork entries in the registry.',
  },
  user: {
    label: 'Collector',
    color: '#78716c',
    bg: 'rgba(120,113,108,0.08)',
    border: 'rgba(120,113,108,0.25)',
    description: 'Collection browsing — discover and explore the Art Vault registry.',
  },
};

/** Staff roles — hidden from public frontend, cannot post artworks */
export const STAFF_ROLES: ArtVaultRole[] = ['admin', 'moderator'];

/** Roles that can access the Admin Panel (full access) */
export const ADMIN_ROLES: ArtVaultRole[] = ['admin'];

/** Roles that can access the Moderation Panel */
export const MODERATION_ROLES: ArtVaultRole[] = ['admin', 'moderator'];

/** Roles allowed to upload/post artworks (staff are excluded) */
export const UPLOAD_ROLES: ArtVaultRole[] = ['curator', 'artist'];

/** Public roles — shown in artist listings and public profiles */
export const PUBLIC_ROLES: ArtVaultRole[] = ['curator', 'artist', 'user'];

/** Roles a visitor can select during public signup. Staff and curator roles require admin assignment. */
export const REGISTRATION_ROLES: ArtVaultRole[] = ['artist', 'user'];

/** Check if a role has admin panel access */
export const canAccessAdmin = (role: string): boolean =>
  ADMIN_ROLES.includes(role as ArtVaultRole);

/** Check if a role has moderation panel access */
export const canAccessModeration = (role: string): boolean =>
  MODERATION_ROLES.includes(role as ArtVaultRole);

/** Check if a role can upload artworks */
export const canUpload = (role: string): boolean =>
  UPLOAD_ROLES.includes(role as ArtVaultRole);

/** Check if a role is a staff role (hidden from public) */
export const isStaff = (role: string): boolean =>
  STAFF_ROLES.includes(role as ArtVaultRole);

/** Check if a role is public (shown in artist listings) */
export const isPublic = (role: string): boolean =>
  PUBLIC_ROLES.includes(role as ArtVaultRole);

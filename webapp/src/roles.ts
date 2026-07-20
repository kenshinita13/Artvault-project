// ─── ArtVault Role System ────────────────────────────────────────
// Central role definitions used across the entire application.

export type ArtVaultRole = 'admin' | 'moderator' | 'curator' | 'artist' | 'user';

export const ROLES: Record<ArtVaultRole, { label: string; color: string; bg: string; border: string; description: string; capabilities: readonly string[] }> = {
  admin: {
    label: 'Administrator',
    color: '#991b1b',
    bg: 'rgba(153,27,27,0.08)',
    border: 'rgba(153,27,27,0.25)',
    description: 'Platform governance, account administration, and complete collection oversight.',
    capabilities: ['Manage users and roles', 'Manage every registry record and portfolio', 'Review reports, audit logs, and Discover display'],
  },
  moderator: {
    label: 'Moderator',
    color: '#92400e',
    bg: 'rgba(146,64,14,0.08)',
    border: 'rgba(146,64,14,0.25)',
    description: 'Content enforcement without access to account roles or platform governance.',
    capabilities: ['Review reports and tickets', 'Edit or remove registry records', 'No user-role or audit-log access'],
  },
  curator: {
    label: 'Curator',
    color: '#0f766e',
    bg: 'rgba(15,118,110,0.08)',
    border: 'rgba(15,118,110,0.25)',
    description: 'Collection cataloging and metadata stewardship across the public registry.',
    capabilities: ['Register owned artwork records', 'Annotate registry metadata and categories', 'Cannot remove other users\' records or manage accounts'],
  },
  artist: {
    label: 'Artist',
    color: '#b8975a',
    bg: 'rgba(184,151,90,0.08)',
    border: 'rgba(184,151,90,0.25)',
    description: 'Artwork submission and management for records owned by the account.',
    capabilities: ['Register personal artwork records', 'Manage owned works and portfolios', 'Feature selected works on the public profile'],
  },
  user: {
    label: 'Collector',
    color: '#78716c',
    bg: 'rgba(120,113,108,0.08)',
    border: 'rgba(120,113,108,0.25)',
    description: 'Collection discovery and organization without catalog publishing access.',
    capabilities: ['Browse the registry and public profiles', 'View public artist portfolios and report records', 'No artwork publishing or staff access'],
  },
};

/** Staff roles — hidden from public frontend, cannot post artworks */
export const STAFF_ROLES: ArtVaultRole[] = ['admin', 'moderator'];

/** Roles that can access the Admin Panel (full access) */
export const ADMIN_ROLES: ArtVaultRole[] = ['admin'];

/** Roles that can access the Moderation Panel */
export const MODERATION_ROLES: ArtVaultRole[] = ['admin', 'moderator'];

/** Roles that use the consolidated collection operations console */
export const STAFF_CONSOLE_ROLES: ArtVaultRole[] = ['admin', 'moderator', 'curator'];

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

/** Check if a role can enter the consolidated staff console */
export const canAccessStaffConsole = (role: string): boolean =>
  STAFF_CONSOLE_ROLES.includes(role as ArtVaultRole);

/** Check if a role can annotate records across the registry */
export const canCurateRegistry = (role: string): boolean =>
  STAFF_CONSOLE_ROLES.includes(role as ArtVaultRole);

/** Check if a role can upload artworks */
export const canUpload = (role: string): boolean =>
  UPLOAD_ROLES.includes(role as ArtVaultRole);

/** Check if a role is a staff role (hidden from public) */
export const isStaff = (role: string): boolean =>
  STAFF_ROLES.includes(role as ArtVaultRole);

/** Check if a role is public (shown in artist listings) */
export const isPublic = (role: string): boolean =>
  PUBLIC_ROLES.includes(role as ArtVaultRole);

// ── Image URL & Google Drive Sharing Utility ────────────────────────

export const IMAGE_URL_REPLACEMENTS: Record<string, string> = {
  'https://www.artic.edu/iiif/2/8f9f77a5-003f-a185-873d-8c0f71cf5cf1/full/843,/0/default.jpg':
    'https://upload.wikimedia.org/wikipedia/commons/1/15/Adolph_Menzel_-_Halbfigur_eines_alten_Mannes_%281855%29.jpg',
  'https://www.artic.edu/iiif/2/7f753e93-8579-abab-6c79-1a35ff67ba53/full/843,/0/default.jpg':
    'https://upload.wikimedia.org/wikipedia/commons/1/1b/Adolph_Menzel%2C_Study_of_a_Woman%2C_c._1875-1890%2C_NGA_56918.jpg',
};

/**
 * Extracts a Google Drive file ID from various link formats:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/uc?export=view&id=FILE_ID
 * - https://docs.google.com/file/d/FILE_ID/...
 * - https://lh3.googleusercontent.com/d/FILE_ID
 */
export function extractGoogleDriveFileId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Pattern 1: /file/d/{id} or /d/{id}
  const fileMatch = trimmed.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{20,})/);
  if (fileMatch) return fileMatch[1];

  // Pattern 2: ?id={id} or &id={id}
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idParamMatch) return idParamMatch[1];

  // Pattern 3: googleusercontent.com/d/{id}
  const lh3Match = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/);
  if (lh3Match) return lh3Match[1];

  return null;
}

/**
 * Checks if a given URL is a Google Drive or Docs link.
 */
export function isGoogleDriveUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return Boolean(
    extractGoogleDriveFileId(url) ||
    url.includes('drive.google.com') ||
    url.includes('docs.google.com') ||
    url.includes('googleusercontent.com/d/')
  );
}

/**
 * Converts a Google Drive sharing link into a high-performance, direct live embed URL.
 */
export function convertGoogleDriveSharingUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const fileId = extractGoogleDriveFileId(trimmed);

  if (fileId) {
    // High-performance Google User Content CDN endpoint for live image viewing
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
}

/**
 * Resolves artwork image URLs including Google Drive sharing links and known museum mirror fallbacks.
 */
export function resolveArtworkImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let resolved = convertGoogleDriveSharingUrl(url);
  if (IMAGE_URL_REPLACEMENTS[resolved]) {
    resolved = IMAGE_URL_REPLACEMENTS[resolved];
  }
  return resolved;
}

/**
 * Supabase/Cloud image optimization helper — serves WebP at requested size and quality.
 */
export function optimizedArtworkUrl(url: string, width: number, quality = 80): string {
  url = resolveArtworkImageUrl(url);
  if (!url || !url.includes('supabase.co')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&quality=${quality}`;
}

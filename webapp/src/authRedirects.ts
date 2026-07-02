const PRODUCTION_SITE_URL = 'https://artvault-project.vercel.app';

export function getAuthRedirectUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const origin = isLocalhost ? window.location.origin : PRODUCTION_SITE_URL;

  return `${origin}${normalizedPath}`;
}

/**
 * Production Security Headers Middleware
 * 
 * Adds defense-in-depth HTTP security headers that Helmet alone does not
 * fully configure. These headers mitigate:
 * 
 * - Strict-Transport-Security: Forces HTTPS for 1 year + subdomains (prevents SSL stripping)
 * - X-Content-Type-Options: nosniff (prevents MIME-type sniffing attacks)
 * - X-Frame-Options: DENY (prevents clickjacking via iframe embedding)
 * - Referrer-Policy: strict-origin-when-cross-origin (limits referrer leakage)
 * - Permissions-Policy: Disables camera, microphone, geolocation, payment APIs
 * - Content-Security-Policy: Restricts script/style/image sources to prevent XSS
 * 
 * The CSP is configured to work with React/Vite production builds:
 * - 'self' for scripts and styles (Vite bundles are same-origin)
 * - 'unsafe-inline' for styles only (React inline styles + Vite CSS injection)
 * - fonts.googleapis.com and fonts.gstatic.com for Google Fonts
 * - data: and blob: for image sources (file previews, icons)
 */
export function securityHeaders(req, res, next) {
  // Force HTTPS for 1 year including subdomains
  // Cloud Run terminates TLS, but this header ensures browser-side enforcement
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Prevent browsers from MIME-sniffing a response away from the declared Content-Type
  // Mitigates attacks where an uploaded file with .txt extension contains executable HTML
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Block this page from being embedded in iframes (prevents clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');

  // Control how much referrer information is sent with requests
  // 'strict-origin-when-cross-origin' sends origin only for cross-origin, full URL for same-origin
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict browser features the application does not need
  // Reduces attack surface by disabling unnecessary APIs
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );

  // Content Security Policy for the API backend
  // Since frontend is now a separate service, backend only serves JSON responses
  // This CSP is deliberately restrictive because backend should never serve HTML
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  );

  next();
}

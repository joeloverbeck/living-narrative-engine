import helmet from 'helmet';
import { randomBytes } from 'crypto';

/**
 * Enhanced security middleware with CSP nonces and additional security headers
 * @param {object} options - Configuration options
 * @param {boolean} options.enableNonce - Whether to enable CSP nonces (default: true)
 * @param {boolean} options.strictCSP - Whether to use strict CSP policies (default: true)
 * @returns {Function} Enhanced Helmet middleware with security headers configured
 */
export const createSecurityMiddleware = (options = {}) => {
  const { enableNonce = true, strictCSP = true } = options;

  return (req, res, next) => {
    // Generate CSP nonce if enabled
    let nonce = null;
    if (enableNonce) {
      // Generate 16-character hex nonce using randomBytes
      nonce = randomBytes(8).toString('hex');
      req.cspNonce = nonce;
      res.locals.cspNonce = nonce;
    } else {
      // Explicitly set to null when nonce is disabled
      req.cspNonce = null;
      res.locals.cspNonce = null;
    }

    // Build CSP directives with nonce support
    const cspDirectives = {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    };

    // Add nonce to script and style sources if enabled
    if (enableNonce && nonce) {
      cspDirectives.scriptSrc.push(`'nonce-${nonce}'`);
      cspDirectives.styleSrc.push(`'nonce-${nonce}'`);
    }

    // Add unsafe-inline only if not using strict CSP and no nonce
    if (!strictCSP && !enableNonce) {
      cspDirectives.styleSrc.push("'unsafe-inline'");
    }

    // Apply enhanced helmet configuration
    const helmetMiddleware = helmet({
      contentSecurityPolicy: {
        directives: cspDirectives,
        reportOnly: false,
      },
      crossOriginEmbedderPolicy: { policy: 'require-corp' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    });

    // Apply helmet middleware first
    helmetMiddleware(req, res, (err) => {
      if (err) return next(err);

      // Add additional security headers
      addEnhancedSecurityHeaders(res, nonce);
      next();
    });
  };
};

/**
 * Adds enhanced security headers beyond what Helmet provides
 * @param {object} res - Express response object
 * @param {string|null} nonce - CSP nonce if available
 */
function addEnhancedSecurityHeaders(res, nonce) {
  // Permissions Policy (Feature Policy successor)
  res.setHeader(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=()',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()',
    ].join(', ')
  );

  // Note: Clear-Site-Data header removed to prevent browser credential conflicts
  // This header was causing net::ERR_FAILED errors when used with fetch() omit credentials
  // Clear Site Data should only be used for specific logout scenarios, not API endpoints

  // Expect-CT header for Certificate Transparency
  res.setHeader('Expect-CT', 'max-age=86400, enforce');

  // Server information hiding
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  // Cache control for sensitive responses
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Add CSP nonce to response header for client-side access
  if (nonce) {
    res.setHeader('X-CSP-Nonce', nonce);
  }

  // Add security timestamp for monitoring
  res.setHeader('X-Security-Applied', new Date().toISOString());
}

/**
 * Creates middleware for Content Security Policy nonce generation
 * This is a standalone middleware for cases where full security middleware isn't needed
 * @param {object} options - Configuration options
 * @param {number} options.nonceLength - Length of generated nonce (default: 16)
 * @returns {Function} Express middleware
 */
export const createCSPNonceMiddleware = (options = {}) => {
  const { nonceLength = 16 } = options;

  return (req, res, next) => {
    // Generate cryptographically secure nonce of the requested length
    // Use randomBytes to support arbitrary lengths
    const byteLength = Math.ceil(nonceLength / 2);
    const nonce = randomBytes(byteLength)
      .toString('hex')
      .substring(0, nonceLength);

    // Attach nonce to request and response
    req.cspNonce = nonce;
    res.locals.cspNonce = nonce;

    // Set nonce in response header for client-side scripts
    res.setHeader('X-CSP-Nonce', nonce);

    next();
  };
};

/**
 * Creates a security configuration validator middleware
 * @param {object} options - Configuration options
 * @returns {Function} Express middleware that validates security configuration
 */
export const createSecurityConfigValidator = (options = {}) => {
  const { logger = console } = options;

  return (req, res, next) => {
    // Validate that required security headers are being set
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Strict-Transport-Security',
      'Content-Security-Policy',
    ];

    // Check after response is sent
    res.on('finish', () => {
      try {
        const missingHeaders = requiredHeaders.filter(
          (header) => !res.getHeader(header)
        );

        if (missingHeaders.length > 0) {
          logger.warn('Missing required security headers', {
            missingHeaders,
            url: req.originalUrl,
            method: req.method,
            correlationId: req.correlationId,
          });
        }
      } catch (error) {
        // Handle errors gracefully without disrupting the response
        // Since this is after the response is sent, we can only log the error
        logger.error('Error checking security headers', {
          error: error.message,
          url: req.originalUrl,
          method: req.method,
        });
      }
    });

    next();
  };
};

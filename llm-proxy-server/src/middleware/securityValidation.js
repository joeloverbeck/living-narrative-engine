/**
 * @file Enhanced security validation middleware
 * @description Advanced security headers validation, correlation IDs, and security event logging
 * Addresses security improvements identified in the comprehensive analysis report
 */

import { randomUUID } from 'crypto';

/**
 * Security validation configuration
 */
const SECURITY_CONFIG = {
  // Maximum header value lengths to prevent buffer overflow attacks
  MAX_HEADER_VALUE_LENGTH: 8192,
  MAX_HEADER_NAME_LENGTH: 128,
  MAX_HEADERS_COUNT: 100,

  // Content Security Policy validation
  CSP_DIRECTIVE_WHITELIST: [
    'default-src',
    'script-src',
    'style-src',
    'img-src',
    'connect-src',
    'font-src',
    'object-src',
    'media-src',
    'frame-src',
    'sandbox',
    'report-uri',
    'child-src',
    'form-action',
    'frame-ancestors',
    'plugin-types',
    'base-uri',
    'report-to',
    'worker-src',
    'manifest-src',
  ],

  // Required security headers for enhanced protection
  REQUIRED_SECURITY_HEADERS: [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
    'strict-transport-security',
  ],

  // Suspicious header patterns that indicate potential attacks
  SUSPICIOUS_HEADER_PATTERNS: [
    /eval\s*\(/i, // JavaScript eval attempts
    /<script/i, // Script injection
    /javascript:/i, // JavaScript protocol
    /data:text\/html/i, // Data URI HTML
    /vbscript:/i, // VBScript protocol
    /onload=/i, // Event handler injection
    /onerror=/i, // Error handler injection
    /\${.*}/, // Template literal injection
    /<%.*%>/, // Server-side template injection
  ],
};

/**
 * Generates a correlation ID for request tracking
 * @param {object} req - Express request object
 * @returns {string} Unique correlation ID
 */
function generateCorrelationId(req) {
  // Check if correlation ID already exists in headers
  const existingId =
    req.headers['x-correlation-id'] || req.headers['x-request-id'];

  if (existingId && typeof existingId === 'string' && existingId.length <= 64) {
    // Validate existing ID format (UUID-like or alphanumeric)
    if (/^[a-zA-Z0-9\-_]{8,64}$/.test(existingId)) {
      return existingId;
    }
  }

  // Generate new correlation ID
  return randomUUID();
}

/**
 * Validates Content Security Policy header value
 * @param {string} cspValue - CSP header value
 * @returns {object} Validation result
 */
function validateCSPHeader(cspValue) {
  if (!cspValue || typeof cspValue !== 'string') {
    return { isValid: false, reason: 'CSP header must be a non-empty string' };
  }

  if (cspValue.length > SECURITY_CONFIG.MAX_HEADER_VALUE_LENGTH) {
    return { isValid: false, reason: 'CSP header value too long' };
  }

  // Parse CSP directives
  const directives = cspValue
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  for (const directive of directives) {
    const [directiveName] = directive.split(/\s+/);

    if (!SECURITY_CONFIG.CSP_DIRECTIVE_WHITELIST.includes(directiveName)) {
      return {
        isValid: false,
        reason: `Unknown CSP directive: ${directiveName}`,
        directive: directiveName,
      };
    }

    // Check for dangerous CSP values
    if (
      directive.includes("'unsafe-eval'") ||
      directive.includes("'unsafe-inline'")
    ) {
      return {
        isValid: false,
        reason: 'Unsafe CSP directive detected',
        directive: directiveName,
        unsafeValue: directive.includes("'unsafe-eval'")
          ? 'unsafe-eval'
          : 'unsafe-inline',
      };
    }
  }

  return { isValid: true, directiveCount: directives.length };
}

/**
 * Validates security-related headers
 * @param {object} headers - Request headers object
 * @returns {object} Validation result with security assessment
 */
function validateSecurityHeaders(headers) {
  const result = {
    isValid: true,
    warnings: [],
    errors: [],
    suspiciousPatterns: [],
    securityScore: 100,
    correlationId: null,
  };

  // Check headers count to prevent resource exhaustion
  const headerCount = Object.keys(headers).length;
  if (headerCount > SECURITY_CONFIG.MAX_HEADERS_COUNT) {
    result.errors.push({
      type: 'EXCESSIVE_HEADERS',
      message: `Too many headers: ${headerCount} (max: ${SECURITY_CONFIG.MAX_HEADERS_COUNT})`,
      severity: 'high',
    });
    result.isValid = false;
    result.securityScore -= 50;
  }

  // Validate each header
  for (const [name, value] of Object.entries(headers)) {
    const lowerName = name.toLowerCase();

    // Check header name length
    if (name.length > SECURITY_CONFIG.MAX_HEADER_NAME_LENGTH) {
      result.errors.push({
        type: 'HEADER_NAME_TOO_LONG',
        header: name,
        length: name.length,
        severity: 'medium',
      });
      result.securityScore -= 10;
    }

    // Check header value length
    const valueStr = String(value);
    if (valueStr.length > SECURITY_CONFIG.MAX_HEADER_VALUE_LENGTH) {
      result.errors.push({
        type: 'HEADER_VALUE_TOO_LONG',
        header: name,
        length: valueStr.length,
        severity: 'medium',
      });
      result.securityScore -= 10;
    }

    // Check for suspicious patterns in header values
    for (const pattern of SECURITY_CONFIG.SUSPICIOUS_HEADER_PATTERNS) {
      if (pattern.test(valueStr)) {
        result.suspiciousPatterns.push({
          header: name,
          pattern: pattern.source,
          value: valueStr.substring(0, 100), // Truncate for logging
          severity: 'high',
        });
        result.securityScore -= 25;
      }
    }

    // Specific header validations
    switch (lowerName) {
      case 'content-security-policy':
        const cspValidation = validateCSPHeader(valueStr);
        if (!cspValidation.isValid) {
          result.errors.push({
            type: 'INVALID_CSP',
            header: 'content-security-policy',
            reason: cspValidation.reason,
            directive: cspValidation.directive,
            severity: 'high',
          });
          result.securityScore -= 30;
        }
        break;

      case 'x-forwarded-host':
      case 'host':
        // Validate host header for host header injection
        if (/[<>\"'&]/.test(valueStr)) {
          result.errors.push({
            type: 'HOST_HEADER_INJECTION',
            header: name,
            severity: 'high',
          });
          result.securityScore -= 40;
        }
        break;

      case 'x-forwarded-for':
      case 'x-real-ip':
        // Basic IP validation (detailed validation happens elsewhere)
        if (!/^[\d\.\:a-fA-F\,\s\[\]]+$/.test(valueStr)) {
          result.warnings.push({
            type: 'SUSPICIOUS_IP_HEADER',
            header: name,
            severity: 'medium',
          });
          result.securityScore -= 5;
        }
        break;

      case 'user-agent':
        // Check for suspiciously long or empty user agents
        if (valueStr.length === 0) {
          result.warnings.push({
            type: 'EMPTY_USER_AGENT',
            severity: 'low',
          });
          result.securityScore -= 2;
        } else if (valueStr.length > 512) {
          result.warnings.push({
            type: 'EXCESSIVE_USER_AGENT_LENGTH',
            length: valueStr.length,
            severity: 'medium',
          });
          result.securityScore -= 5;
        }
        break;

      case 'referer':
      case 'origin':
        // Validate referrer/origin headers for suspicious content
        try {
          if (valueStr !== 'null' && valueStr.length > 0) {
            new URL(valueStr); // Validate URL format
          }
        } catch {
          result.warnings.push({
            type: 'INVALID_URL_HEADER',
            header: name,
            severity: 'medium',
          });
          result.securityScore -= 5;
        }
        break;
    }
  }

  // Check for missing security headers
  for (const requiredHeader of SECURITY_CONFIG.REQUIRED_SECURITY_HEADERS) {
    if (!headers[requiredHeader]) {
      result.warnings.push({
        type: 'MISSING_SECURITY_HEADER',
        header: requiredHeader,
        severity: 'low',
      });
      result.securityScore -= 3;
    }
  }

  // Determine overall validity
  if (result.errors.length > 0) {
    result.isValid = false;
  }

  // Ensure security score doesn't go below 0
  result.securityScore = Math.max(0, result.securityScore);

  return result;
}

/**
 * Creates security validation middleware with correlation ID injection
 * @param {object} options - Configuration options
 * @param {object} options.logger - Logger instance
 * @param {boolean} options.blockSuspicious - Whether to block suspicious requests
 * @param {number} options.minSecurityScore - Minimum required security score
 * @returns {Function} Express middleware
 */
export function createSecurityValidationMiddleware(options = {}) {
  const {
    logger = console,
    blockSuspicious = true,
    minSecurityScore = 70,
  } = options;

  return (req, res, next) => {
    // Generate and inject correlation ID
    const correlationId = generateCorrelationId(req);
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    // Validate security headers
    const validation = validateSecurityHeaders(req.headers);
    validation.correlationId = correlationId;

    // Attach validation result to request for other middleware
    req.securityValidation = validation;

    // Log security events
    if (
      validation.suspiciousPatterns.length > 0 ||
      validation.errors.length > 0
    ) {
      const securityEvent = {
        correlationId,
        timestamp: new Date().toISOString(),
        requestUrl: req.originalUrl,
        requestMethod: req.method,
        clientIP: req.ip,
        userAgent: req.headers['user-agent'],
        securityScore: validation.securityScore,
        errors: validation.errors,
        suspiciousPatterns: validation.suspiciousPatterns,
        warnings: validation.warnings,
      };

      if (validation.errors.length > 0) {
        if (logger.warn && typeof logger.warn === 'function') {
          logger.warn('Security validation errors detected', securityEvent);
        }
      }

      if (validation.suspiciousPatterns.length > 0) {
        if (logger.error && typeof logger.error === 'function') {
          logger.error('Suspicious security patterns detected', securityEvent);
        }
      }
    }

    // Block request if security score is too low and blocking is enabled
    if (blockSuspicious && validation.securityScore < minSecurityScore) {
      if (logger.error && typeof logger.error === 'function') {
        logger.error('Request blocked due to low security score', {
          correlationId,
          securityScore: validation.securityScore,
          minRequired: minSecurityScore,
          errors: validation.errors,
          suspiciousPatterns: validation.suspiciousPatterns,
        });
      }

      return res.status(400).json({
        error: {
          message: 'Request failed security validation',
          code: 'SECURITY_VALIDATION_FAILED',
          correlationId,
          details: {
            securityScore: validation.securityScore,
            minRequired: minSecurityScore,
            issueCount:
              validation.errors.length + validation.suspiciousPatterns.length,
          },
        },
      });
    }

    // Log successful validation for monitoring
    if (validation.isValid && validation.securityScore >= minSecurityScore) {
      if (logger.debug && typeof logger.debug === 'function') {
        logger.debug('Security validation passed', {
          correlationId,
          securityScore: validation.securityScore,
          warningCount: validation.warnings.length,
        });
      }
    }

    next();
  };
}

/**
 * Creates CSP nonce generation middleware
 * @param {object} options - Configuration options
 * @returns {Function} Express middleware that generates CSP nonces
 */
export function createCSPNonceMiddleware(options = {}) {
  const { nonceLength = 16 } = options;

  return (req, res, next) => {
    // Generate cryptographically secure nonce
    const nonce = randomUUID().replace(/-/g, '').substring(0, nonceLength);

    // Attach nonce to request and response
    req.cspNonce = nonce;
    res.locals.cspNonce = nonce;

    // Set nonce in response header for client-side scripts
    res.setHeader('X-CSP-Nonce', nonce);

    next();
  };
}

/**
 * Validates specific security headers and returns detailed analysis
 * @param {object} headers - Headers object to validate
 * @returns {object} Detailed validation analysis
 */
export function analyzeSecurityHeaders(headers) {
  const analysis = {
    score: 0,
    maxScore: 100,
    recommendations: [],
    securityLevel: 'unknown',
    details: {},
  };

  // Check for HSTS
  const hsts = headers['strict-transport-security'];
  if (hsts) {
    analysis.score += 20;
    analysis.details.hsts = { present: true, value: hsts };

    if (hsts.includes('includeSubDomains')) {
      analysis.score += 5;
    }
    if (hsts.includes('preload')) {
      analysis.score += 5;
    }
  } else {
    analysis.recommendations.push({
      header: 'Strict-Transport-Security',
      suggestion: 'Add HSTS header for enhanced HTTPS security',
      impact: 'high',
    });
    analysis.details.hsts = { present: false };
  }

  // Check for CSP
  const csp = headers['content-security-policy'];
  if (csp) {
    analysis.score += 25;
    const cspValidation = validateCSPHeader(csp);
    analysis.details.csp = {
      present: true,
      valid: cspValidation.isValid,
      directives: cspValidation.directiveCount || 0,
    };
  } else {
    analysis.recommendations.push({
      header: 'Content-Security-Policy',
      suggestion: 'Implement CSP to prevent XSS attacks',
      impact: 'high',
    });
    analysis.details.csp = { present: false };
  }

  // Check other security headers
  const securityHeaders = {
    'x-content-type-options': 10,
    'x-frame-options': 15,
    'x-xss-protection': 10,
    'referrer-policy': 10,
  };

  for (const [header, points] of Object.entries(securityHeaders)) {
    if (headers[header]) {
      analysis.score += points;
      analysis.details[header.replace(/-/g, '_')] = { present: true };
    } else {
      analysis.recommendations.push({
        header,
        suggestion: `Add ${header} header for enhanced security`,
        impact: 'medium',
      });
      analysis.details[header.replace(/-/g, '_')] = { present: false };
    }
  }

  // Determine security level
  if (analysis.score >= 80) {
    analysis.securityLevel = 'excellent';
  } else if (analysis.score >= 60) {
    analysis.securityLevel = 'good';
  } else if (analysis.score >= 40) {
    analysis.securityLevel = 'fair';
  } else {
    analysis.securityLevel = 'poor';
  }

  return analysis;
}

/**
 * Security validation utility functions
 */
export const SecurityValidationUtils = {
  generateCorrelationId,
  validateCSPHeader,
  validateSecurityHeaders,
  analyzeSecurityHeaders,
  SECURITY_CONFIG,
};

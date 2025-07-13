import { body, header, validationResult } from 'express-validator';
import {
  VALIDATION_HEADER_NAME_MAX_LENGTH,
  VALIDATION_HEADER_VALUE_MAX_LENGTH,
  VALIDATION_LLM_ID_MAX_LENGTH,
  SECURITY_IPV6_LOOPBACK_ADDRESSES,
  SECURITY_IPV6_PRIVATE_PREFIXES,
  SECURITY_DANGEROUS_HEADER_NAMES,
  SECURITY_DANGEROUS_HEADER_PATTERN,
} from '../config/constants.js';

/**
 * Sanitizes headers to prevent header injection and prototype pollution attacks
 * @param {object} headers - Headers object to sanitize
 * @returns {object} Sanitized headers
 */
const sanitizeHeaders = (headers) => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  // Create a clean object without prototype to prevent pollution
  const sanitized = Object.create(null);
  // eslint-disable-next-line no-control-regex
  const dangerousCharacters = /[\r\n\x00]/g;

  for (const [key, value] of Object.entries(headers)) {
    // Skip if key or value contains dangerous characters
    if (
      dangerousCharacters.test(key) ||
      dangerousCharacters.test(String(value))
    ) {
      continue;
    }

    // Check for prototype pollution attempts
    const lowerKey = key.toLowerCase();
    if (
      SECURITY_DANGEROUS_HEADER_NAMES.includes(lowerKey) ||
      SECURITY_DANGEROUS_HEADER_PATTERN.test(key)
    ) {
      continue; // Skip dangerous header names
    }

    // Only allow alphanumeric, dash, and underscore in header names
    const cleanKey = key.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (
      cleanKey &&
      cleanKey.length > 0 &&
      cleanKey.length <= VALIDATION_HEADER_NAME_MAX_LENGTH
    ) {
      // Additional check for cleaned key to prevent pollution after cleaning
      const cleanLowerKey = cleanKey.toLowerCase();
      if (SECURITY_DANGEROUS_HEADER_NAMES.includes(cleanLowerKey)) {
        continue; // Skip if cleaned key is still dangerous
      }

      // Ensure value is a string and truncate if too long
      const cleanValue = String(value).substring(
        0,
        VALIDATION_HEADER_VALUE_MAX_LENGTH
      );

      // Use bracket notation to safely set property without prototype chain
      sanitized[cleanKey] = cleanValue;
    }
  }

  return sanitized;
};

/**
 * Validation middleware for LLM proxy requests
 * @returns {Array} Array of validation middleware
 */
export const validateLlmRequest = () => {
  return [
    // Validate llmId
    body('llmId')
      .exists()
      .withMessage('llmId is required')
      .isString()
      .withMessage('llmId must be a string')
      .trim()
      .notEmpty()
      .withMessage('llmId cannot be empty')
      .isLength({ min: 1, max: VALIDATION_LLM_ID_MAX_LENGTH })
      .withMessage(
        `llmId must be between 1 and ${VALIDATION_LLM_ID_MAX_LENGTH} characters`
      )
      .matches(/^[a-zA-Z0-9\-_]+$/)
      .withMessage(
        'llmId can only contain alphanumeric characters, hyphens, and underscores'
      ),

    // Validate targetPayload
    body('targetPayload')
      .exists()
      .withMessage('targetPayload is required')
      .isObject()
      .withMessage('targetPayload must be an object')
      .custom((value) => {
        // Ensure targetPayload is not empty
        if (Object.keys(value).length === 0) {
          throw new Error('targetPayload cannot be empty');
        }
        return true;
      }),

    // Validate targetHeaders if present
    body('targetHeaders')
      .optional()
      .isObject()
      .withMessage('targetHeaders must be an object if provided')
      .customSanitizer(sanitizeHeaders),

    // Validate that no extra fields are present
    body().custom((value) => {
      const allowedFields = ['llmId', 'targetPayload', 'targetHeaders'];
      const providedFields = Object.keys(value);
      const extraFields = providedFields.filter(
        (field) => !allowedFields.includes(field)
      );

      if (extraFields.length > 0) {
        throw new Error(`Unexpected fields: ${extraFields.join(', ')}`);
      }
      return true;
    }),
  ];
};

/**
 * Validation middleware for request headers
 * @returns {Array} Array of header validation middleware
 */
export const validateRequestHeaders = () => {
  return [
    // Validate content-type
    header('content-type')
      .exists()
      .withMessage('Content-Type header is required')
      .contains('application/json')
      .withMessage('Content-Type must be application/json'),

    // Sanitize all headers to prevent injection
    header('*').customSanitizer((value) => {
      if (typeof value !== 'string') return value;
      // Remove any carriage returns, line feeds, or null bytes
      // eslint-disable-next-line no-control-regex
      return value.replace(/[\r\n\x00]/g, '');
    }),
  ];
};

/**
 * Middleware to handle validation errors
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {void}
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((err) => ({
      field: err.path || err.param,
      value: err.value,
      message: err.msg,
    }));

    return res.status(400).json({
      error: true,
      message: 'Client request validation failed.',
      stage: 'request_validation',
      details: {
        validationErrors: errorDetails,
      },
      originalStatusCode: 400,
    });
  }

  next();
};

/**
 * Checks if an IPv6 address is a loopback address
 * @param {string} hostname - The hostname to check
 * @returns {boolean} Whether the address is IPv6 loopback
 */
const isIPv6Loopback = (hostname) => {
  // Remove brackets if present
  const cleanHostname = hostname.replace(/[[\]]/g, '');

  // Check against known loopback addresses
  return SECURITY_IPV6_LOOPBACK_ADDRESSES.some((loopback) => {
    const cleanLoopback = loopback.replace(/[[\]]/g, '');
    return cleanHostname.toLowerCase() === cleanLoopback.toLowerCase();
  });
};

/**
 * Checks if an IPv6 address is in a private/internal range
 * @param {string} hostname - The hostname to check
 * @returns {boolean} Whether the address is IPv6 private
 */
const isIPv6Private = (hostname) => {
  // Remove brackets if present
  const cleanHostname = hostname.replace(/[[\]]/g, '').toLowerCase();

  // Get the first part of the IPv6 address for prefix matching
  const firstPart = cleanHostname.split(':')[0];

  // Check against private prefixes (hex prefixes)
  return SECURITY_IPV6_PRIVATE_PREFIXES.some((prefix) => {
    return firstPart.startsWith(prefix.toLowerCase());
  });
};

/**
 * Checks if a hostname is an IPv6 address
 * @param {string} hostname - The hostname to check
 * @returns {boolean} Whether the hostname is IPv6
 */
const isIPv6Address = (hostname) => {
  // IPv6 addresses in URLs are enclosed in brackets
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return true;
  }

  // Also check for IPv6 patterns without brackets (less common but possible)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Pattern.test(hostname);
};

/**
 * URL validation function to prevent SSRF attacks
 * @param {string} url - URL to validate
 * @returns {boolean} Whether the URL is safe
 */
export const isUrlSafe = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    // Only allow HTTPS protocol
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }

    // Prevent localhost and private network access
    const hostname = parsedUrl.hostname.toLowerCase();
    const dangerousHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '[::1]',
      '::0',
      '::',
      '[::]',
      '0:0:0:0:0:0:0:1',
      '0:0:0:0:0:0:0:0',
    ];

    if (dangerousHosts.includes(hostname)) {
      return false;
    }

    // Enhanced IPv6 validation
    if (isIPv6Address(hostname)) {
      if (isIPv6Loopback(hostname) || isIPv6Private(hostname)) {
        return false;
      }
    }

    // Check for IPv4 private IP ranges
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Pattern.test(hostname)) {
      const parts = hostname.split('.').map(Number);

      // Validate IPv4 octets are in valid range
      if (parts.some((part) => part < 0 || part > 255)) {
        return false;
      }

      // 10.0.0.0/8
      if (parts[0] === 10) return false;
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return false;
      // 169.254.0.0/16 (link-local)
      if (parts[0] === 169 && parts[1] === 254) return false;
      // 127.0.0.0/8 (loopback) - additional coverage
      if (parts[0] === 127) return false;
      // 0.0.0.0/8 (this network)
      if (parts[0] === 0) return false;
      // 224.0.0.0/4 (multicast)
      if (parts[0] >= 224 && parts[0] <= 239) return false;
      // 240.0.0.0/4 (reserved)
      if (parts[0] >= 240) return false;
    }

    return true;
  } catch {
    return false;
  }
};

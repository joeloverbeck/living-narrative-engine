import { body, header, validationResult } from 'express-validator';
import {
  VALIDATION_HEADER_NAME_MAX_LENGTH,
  VALIDATION_HEADER_VALUE_MAX_LENGTH,
  VALIDATION_LLM_ID_MAX_LENGTH,
  SECURITY_DANGEROUS_HEADER_NAMES,
  SECURITY_DANGEROUS_HEADER_PATTERN,
} from '../config/constants.js';
import {
  isIPv6Hostname,
  isIPv6AddressSafeForSSRF,
  extractIPv6FromHostname,
} from '../utils/ipv6Utils.js';

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

    // Use specific error message if there's only one error, otherwise use generic message
    const message =
      errorDetails.length === 1
        ? errorDetails[0].message
        : 'Client request validation failed.';

    return res.status(400).json({
      error: true,
      message: message,
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
 * Validation middleware for debug log requests
 * @returns {Array} Array of validation middleware
 */
export const validateDebugLogRequest = () => {
  return [
    // Validate that logs is present and is an array
    body('logs')
      .exists()
      .withMessage('logs field is required')
      .isArray()
      .withMessage('logs must be an array')
      .custom((logs) => {
        if (logs.length === 0) {
          throw new Error('logs array cannot be empty');
        }
        if (logs.length > 5000) {
          throw new Error('logs array cannot contain more than 5000 entries');
        }
        return true;
      }),

    // Validate each log entry in the array
    body('logs.*').isObject().withMessage('each log entry must be an object'),

    // Validate level field for each log entry
    body('logs.*.level')
      .exists()
      .withMessage('level is required for each log entry')
      .isString()
      .withMessage('level must be a string')
      .isIn(['debug', 'info', 'warn', 'error'])
      .withMessage('level must be one of: debug, info, warn, error'),

    // Validate message field for each log entry
    body('logs.*.message')
      .exists()
      .withMessage('message is required for each log entry')
      .isString()
      .withMessage('message must be a string')
      .trim()
      .notEmpty()
      .withMessage('message cannot be empty')
      .isLength({ max: 10000 })
      .withMessage('message cannot exceed 10000 characters'),

    // Validate timestamp field for each log entry
    body('logs.*.timestamp')
      .exists()
      .withMessage('timestamp is required for each log entry')
      .isString()
      .withMessage('timestamp must be a string')
      .isISO8601()
      .withMessage('timestamp must be a valid ISO 8601 datetime'),

    // Validate optional category field
    body('logs.*.category')
      .optional()
      .isString()
      .withMessage('category must be a string if provided')
      .isLength({ min: 1, max: 100 })
      .withMessage('category must be between 1 and 100 characters'),

    // Validate optional source field
    body('logs.*.source')
      .optional()
      .isString()
      .withMessage('source must be a string if provided')
      .isLength({ min: 1, max: 500 })
      .withMessage('source must be between 1 and 500 characters'),

    // Validate optional sessionId field (UUID v4 format)
    body('logs.*.sessionId')
      .optional()
      .isString()
      .withMessage('sessionId must be a string if provided')
      .isUUID(4)
      .withMessage('sessionId must be a valid UUID v4'),

    // Validate optional metadata field
    body('logs.*.metadata')
      .optional()
      .isObject()
      .withMessage('metadata must be an object if provided')
      .custom((metadata) => {
        // Basic size check to prevent abuse
        const serialized = JSON.stringify(metadata);
        if (serialized.length > 50000) {
          throw new Error(
            'metadata object is too large (max 50KB when serialized)'
          );
        }
        return true;
      }),

    // Validate that no extra fields are present at root level
    body().custom((value) => {
      const allowedFields = ['logs'];
      const providedFields = Object.keys(value);
      const extraFields = providedFields.filter(
        (field) => !allowedFields.includes(field)
      );

      if (extraFields.length > 0) {
        throw new Error(
          `Unexpected fields in request body: ${extraFields.join(', ')}`
        );
      }
      return true;
    }),
  ];
};

/**
 * Enhanced IPv6 validation using comprehensive IPv6 utilities
 * These functions replace the previous incomplete regex-based validation
 * with robust ipaddr.js-based validation that handles all IPv6 edge cases
 */

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

    // Enhanced IPv6 validation using comprehensive utilities
    if (isIPv6Hostname(hostname)) {
      // Use SSRF-safe validation for IPv6 addresses
      const ipv6Address = extractIPv6FromHostname(hostname);
      if (ipv6Address && !isIPv6AddressSafeForSSRF(ipv6Address)) {
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

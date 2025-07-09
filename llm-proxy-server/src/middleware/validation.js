import { body, header, validationResult } from 'express-validator';

/**
 * Sanitizes headers to prevent header injection attacks
 * @param {object} headers - Headers object to sanitize
 * @returns {object} Sanitized headers
 */
const sanitizeHeaders = (headers) => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const sanitized = {};
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

    // Only allow alphanumeric, dash, and underscore in header names
    const cleanKey = key.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (cleanKey && cleanKey.length > 0 && cleanKey.length <= 100) {
      // Ensure value is a string and truncate if too long
      const cleanValue = String(value).substring(0, 1000);
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
      .isLength({ min: 1, max: 100 })
      .withMessage('llmId must be between 1 and 100 characters')
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
      '[::1]',
      '[::0]',
    ];

    if (dangerousHosts.includes(hostname)) {
      return false;
    }

    // Check for private IP ranges
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(hostname)) {
      const parts = hostname.split('.').map(Number);
      // 10.0.0.0/8
      if (parts[0] === 10) return false;
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return false;
      // 169.254.0.0/16 (link-local)
      if (parts[0] === 169 && parts[1] === 254) return false;
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * @file Error formatting utilities for secure error handling in production environments
 */

/**
 * @typedef {object} SecureErrorDetails
 * @description Structured error details that are safe for client consumption
 * @property {string} message - Human-readable error message
 * @property {string} stage - Machine-readable stage identifier
 * @property {object} details - Additional error context
 */

/**
 * List of sensitive field names that should be filtered in production
 * @private
 */
const SENSITIVE_FIELDS = [
  'apiKey',
  'apikey',
  'api_key',
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'auth',
  'authorization',
  'internalPath',
  'stackTrace',
  'stack',
  'connectionString',
  'connectionUrl',
  'privateKey',
  'publicKey',
  'key',
];

/**
 * Filters sensitive fields from an object in production environment
 * @private
 * @param {object} details - The details object to filter
 * @returns {object} Filtered details object
 */
function filterSensitiveFields(details) {
  if (!details || typeof details !== 'object') {
    return details;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    return details;
  }

  const filtered = {};
  for (const [key, value] of Object.entries(details)) {
    const keyLower = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(
      (sensitiveField) => keyLower === sensitiveField.toLowerCase()
    );

    if (!isSensitive) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Sanitizes an error message for client consumption based on environment
 * @param {Error | string} error - The error object or message
 * @param {string} stage - The error stage identifier
 * @param {string} [customMessage] - Custom message for production (optional)
 * @returns {SecureErrorDetails} Sanitized error details
 */
export function sanitizeErrorForClient(error, stage, customMessage = null) {
  const isProduction = process.env.NODE_ENV === 'production';

  let message;
  let originalErrorMessage;
  let errorName = 'Error';

  if (error instanceof Error) {
    errorName = error.name;
    if (isProduction) {
      message = customMessage || 'Internal server error occurred';
      originalErrorMessage = 'Internal error occurred';
    } else {
      message = error.message;
      originalErrorMessage = error.message;
    }
  } else if (typeof error === 'string') {
    if (isProduction) {
      message = customMessage || 'Internal server error occurred';
      originalErrorMessage = 'Internal error occurred';
    } else {
      message = error;
      originalErrorMessage = error;
    }
  } else {
    message = customMessage || 'Unknown error occurred';
    originalErrorMessage = isProduction
      ? 'Internal error occurred'
      : 'Unknown error';
  }

  return {
    message,
    stage,
    details: {
      originalErrorMessage,
      errorName,
    },
  };
}

/**
 * Creates secure error details object with filtered sensitive information
 * @param {string} message - The error message
 * @param {string} stage - The error stage identifier
 * @param {object} details - Additional error details
 * @param {Error} [originalError] - Original error object (optional)
 * @returns {SecureErrorDetails} Secure error details
 */
export function createSecureErrorDetails(
  message,
  stage,
  details = {},
  originalError = null
) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Filter sensitive fields from details
  const filteredDetails = filterSensitiveFields(details);

  // Add original error message if provided
  if (originalError) {
    if (isProduction) {
      filteredDetails.originalErrorMessage = 'Internal error occurred';
    } else {
      filteredDetails.originalErrorMessage = originalError.message;
    }
  } else if (!filteredDetails.originalErrorMessage) {
    filteredDetails.originalErrorMessage = isProduction
      ? 'Internal error occurred'
      : message;
  }

  return {
    message,
    stage,
    details: filteredDetails,
  };
}

/**
 * Safely formats an error for logging purposes
 * @param {Error} error - The error to format
 * @param {object} [context] - Additional context
 * @returns {object} Formatted error for logging
 */
export function formatErrorForLogging(error, context = {}) {
  const isProduction = process.env.NODE_ENV === 'production';

  const logData = {
    message: error.message,
    name: error.name,
    ...filterSensitiveFields(context),
  };

  // In development, include stack trace
  if (!isProduction && error.stack) {
    logData.stack = error.stack;
  }

  return logData;
}

/**
 * Creates a production-safe error response for HTTP endpoints
 * @param {number} statusCode - HTTP status code
 * @param {string} stage - Error stage identifier
 * @param {string} message - Error message
 * @param {object} details - Error details
 * @param {Error} [originalError] - Original error (optional)
 * @returns {object} HTTP error response object
 */
export function createSecureHttpErrorResponse(
  statusCode,
  stage,
  message,
  details = {},
  originalError = null
) {
  const secureDetails = createSecureErrorDetails(
    message,
    stage,
    details,
    originalError
  );

  return {
    error: {
      message: secureDetails.message,
      code: stage,
      details: secureDetails.details,
    },
  };
}

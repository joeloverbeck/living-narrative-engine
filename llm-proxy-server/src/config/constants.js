// llm-proxy-server/src/config/constants.js

/**
 * @file Centralized application constants.
 * This module exports various constant values used throughout the application
 * to ensure consistency, improve maintainability, and enhance code readability.
 */

/**
 * An array of local API types that do not require a proxy-managed API key.
 * These typically refer to models running locally or on infrastructure that
 * handles authentication differently (e.g., Ollama, local TGI instances).
 *
 * @type {string[]}
 */
export const LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY = [
  'ollama',
  'llama_cpp_server_openai_compatible',
  'tgi_openai_compatible',
];

/**
 * Standard Content-Type value for JSON payloads.
 *
 * @type {string}
 */
export const CONTENT_TYPE_JSON = 'application/json';

/**
 * HTTP 'Content-Type' header name.
 *
 * @type {string}
 */
export const HTTP_HEADER_CONTENT_TYPE = 'Content-Type';

/**
 * HTTP 'Authorization' header name.
 *
 * @type {string}
 */
export const HTTP_HEADER_AUTHORIZATION = 'Authorization';

/**
 * The prefix for Bearer token authentication scheme.
 * Includes the trailing space.
 *
 * @type {string}
 */
export const AUTH_SCHEME_BEARER_PREFIX = 'Bearer ';

/**
 * Default character encoding 'utf-8'.
 *
 * @type {string}
 */
export const DEFAULT_ENCODING_UTF8 = 'utf-8';

/**
 * HTTP 'POST' method.
 *
 * @type {string}
 */
export const HTTP_METHOD_POST = 'POST';

/**
 * HTTP 'OPTIONS' method.
 *
 * @type {string}
 */
export const HTTP_METHOD_OPTIONS = 'OPTIONS';

/**
 * An array of HTTP status codes that are considered retryable for idempotent operations
 * or when the server indicates a temporary overload or unavailability.
 *
 * @type {number[]}
 */
export const RETRYABLE_HTTP_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Placeholder string for LLM ID in logs when the ID is not applicable or unavailable.
 *
 * @type {string}
 */
export const LOG_LLM_ID_NOT_APPLICABLE = 'N/A';

/**
 * Placeholder string for LLM ID in logs for unhandled errors.
 *
 * @type {string}
 */
export const LOG_LLM_ID_UNHANDLED_ERROR = 'N/A_UNHANDLED';

/**
 * Placeholder string for LLM ID in logs when proxy is not operational.
 *
 * @type {string}
 */
export const LOG_LLM_ID_PROXY_NOT_OPERATIONAL = 'N/A_PROXY_NOT_OPERATIONAL';

/**
 * Placeholder string for LLM ID in logs when request validation fails.
 *
 * @type {string}
 */
export const LOG_LLM_ID_REQUEST_VALIDATION_FAILED = 'N/A_VALIDATION';

// Note: Other potential constants like default retry parameters (maxRetries, delays)
// are currently handled as localized fallbacks within specific services (e.g., LlmRequestService)
// if not provided by LLM configurations. They are not centralized here unless they become
// more broadly shared or represent "magic values" used across multiple, unrelated modules.
// Error stage strings are also generally kept specific to their context of use for clarity,
// unless a specific stage string is intended to be reused identically across services for the same logical error.

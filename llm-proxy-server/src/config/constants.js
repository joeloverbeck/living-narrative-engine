// llm-proxy-server/src/dependencyInjection/constants.js

/**
 * @file Centralized application constants.
 * This module exports various constant values used throughout the application
 * to ensure consistency, improve maintainability, and enhance code readability.
 */

/**
 * An array of local API types that do not require a proxy-managed API key.
 * These typically refer to models running locally or on infrastructure that
 * handles authentication differently (e.g., Ollama, local TGI instances).
 * @type {string[]}
 */
export const LOCAL_API_TYPES_REQUIRING_NO_PROXY_KEY = [
  'ollama',
  'llama_cpp_server_openai_compatible',
  'tgi_openai_compatible',
];

/**
 * Standard Content-Type value for JSON payloads.
 * @type {string}
 */
export const CONTENT_TYPE_JSON = 'application/json';

/**
 * HTTP 'Content-Type' header name.
 * @type {string}
 */
export const HTTP_HEADER_CONTENT_TYPE = 'Content-Type';

/**
 * HTTP 'Authorization' header name.
 * @type {string}
 */
export const HTTP_HEADER_AUTHORIZATION = 'Authorization';

/**
 * The prefix for Bearer token authentication scheme.
 * Includes the trailing space.
 * @type {string}
 */
export const AUTH_SCHEME_BEARER_PREFIX = 'Bearer ';

/**
 * Default character encoding 'utf-8'.
 * @type {string}
 */
export const DEFAULT_ENCODING_UTF8 = 'utf-8';

/**
 * HTTP 'POST' method.
 * @type {string}
 */
export const HTTP_METHOD_POST = 'POST';

/**
 * HTTP 'OPTIONS' method.
 * @type {string}
 */
export const HTTP_METHOD_OPTIONS = 'OPTIONS';

/**
 * An array of HTTP status codes that are considered retryable for idempotent operations
 * or when the server indicates a temporary overload or unavailability.
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
 * @type {string}
 */
export const LOG_LLM_ID_NOT_APPLICABLE = 'N/A';

/**
 * Placeholder string for LLM ID in logs for unhandled errors.
 * @type {string}
 */
export const LOG_LLM_ID_UNHANDLED_ERROR = 'N/A_UNHANDLED';

/**
 * Placeholder string for LLM ID in logs when proxy is not operational.
 * @type {string}
 */
export const LOG_LLM_ID_PROXY_NOT_OPERATIONAL = 'N/A_PROXY_NOT_OPERATIONAL';

/**
 * Placeholder string for LLM ID in logs when request validation fails.
 * @type {string}
 */
export const LOG_LLM_ID_REQUEST_VALIDATION_FAILED = 'N/A_VALIDATION';

/**
 * Cache configuration constants
 */

/**
 * Default cache TTL (Time To Live) in milliseconds - 5 minutes.
 * @type {number}
 */
export const CACHE_DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Default maximum number of entries in cache.
 * @type {number}
 */
export const CACHE_DEFAULT_MAX_SIZE = 1000;

/**
 * API key cache TTL in milliseconds - 5 minutes.
 * Used specifically for caching API keys to reduce file system reads.
 * @type {number}
 */
export const API_KEY_CACHE_TTL = 5 * 60 * 1000;

/**
 * Enhanced cache configuration constants for optimized LRU implementation
 */

/**
 * Default maximum memory usage for cache in bytes - 50MB.
 * @type {number}
 */
export const CACHE_DEFAULT_MAX_MEMORY_BYTES = 50 * 1024 * 1024;

/**
 * Default cache cleanup interval in milliseconds - 1 minute.
 * @type {number}
 */
export const CACHE_DEFAULT_CLEANUP_INTERVAL = 60 * 1000;

/**
 * Minimum cache cleanup interval in milliseconds - 30 seconds.
 * @type {number}
 */
export const CACHE_MIN_CLEANUP_INTERVAL = 30 * 1000;

/**
 * Maximum cache cleanup interval in milliseconds - 10 minutes.
 * @type {number}
 */
export const CACHE_MAX_CLEANUP_INTERVAL = 10 * 60 * 1000;

/**
 * HTTP Agent configuration constants
 */

/**
 * Default keep-alive setting for HTTP agents.
 * @type {boolean}
 */
export const HTTP_AGENT_KEEP_ALIVE = true;

/**
 * Default maximum number of sockets per host.
 * @type {number}
 */
export const HTTP_AGENT_MAX_SOCKETS = 50;

/**
 * Default maximum number of free sockets to keep open per host.
 * @type {number}
 */
export const HTTP_AGENT_MAX_FREE_SOCKETS = 10;

/**
 * Default socket timeout in milliseconds - 120 seconds.
 * Increased to 120 seconds to align with LLM API endpoint timeout
 * and prevent premature timeout during long-running LLM generations.
 * @type {number}
 */
export const HTTP_AGENT_TIMEOUT = 120000;

/**
 * Default free socket timeout in milliseconds - 30 seconds.
 * @type {number}
 */
export const HTTP_AGENT_FREE_SOCKET_TIMEOUT = 30000;

/**
 * Default maximum total sockets across all hosts.
 * @type {number}
 */
export const HTTP_AGENT_MAX_TOTAL_SOCKETS = 500;

/**
 * Interval for cleaning up idle agents in milliseconds - 5 minutes.
 * @type {number}
 */
export const HTTP_AGENT_CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Maximum idle time for agents before cleanup in milliseconds - 5 minutes.
 * @type {number}
 */
export const HTTP_AGENT_MAX_IDLE_TIME = 5 * 60 * 1000;

/**
 * Enhanced HTTP Agent configuration constants for adaptive cleanup
 */

/**
 * Base cleanup interval for adaptive cleanup in milliseconds - 5 minutes.
 * @type {number}
 */
export const HTTP_AGENT_ADAPTIVE_BASE_CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Minimum cleanup interval for adaptive cleanup in milliseconds - 1 minute.
 * @type {number}
 */
export const HTTP_AGENT_ADAPTIVE_MIN_CLEANUP_INTERVAL = 60 * 1000;

/**
 * Maximum cleanup interval for adaptive cleanup in milliseconds - 15 minutes.
 * @type {number}
 */
export const HTTP_AGENT_ADAPTIVE_MAX_CLEANUP_INTERVAL = 15 * 60 * 1000;

/**
 * Memory threshold for aggressive cleanup in MB - 100MB.
 * @type {number}
 */
export const HTTP_AGENT_MEMORY_THRESHOLD_MB = 100;

/**
 * High load threshold in requests per minute - 60 requests.
 * @type {number}
 */
export const HTTP_AGENT_HIGH_LOAD_REQUESTS_PER_MIN = 60;

/**
 * Default TTL for salvaged responses in milliseconds - 2 minutes.
 * Provides a wider recovery window for long-running completions.
 * @type {number}
 */
export const SALVAGE_DEFAULT_TTL = 2 * 60 * 1000;

/**
 * Default maximum number of salvaged responses to retain in memory.
 * @type {number}
 */
export const SALVAGE_MAX_ENTRIES = 1000;

/**
 * Rate limiting configuration constants
 * Environment-aware settings: Development has much higher limits than production
 */

/**
 * General API rate limiting window in milliseconds - 15 minutes.
 * @type {number}
 */
export const RATE_LIMIT_GENERAL_WINDOW_MS = 15 * 60 * 1000;

/**
 * Maximum general API requests per window.
 * Higher limits for development to support game initialization logging.
 * @type {number}
 */
export const RATE_LIMIT_GENERAL_MAX_REQUESTS =
  process.env.NODE_ENV === 'production' ? 100 : 2000;

/**
 * LLM API rate limiting window in milliseconds - 1 minute.
 * @type {number}
 */
export const RATE_LIMIT_LLM_WINDOW_MS = 60 * 1000;

/**
 * Maximum LLM API requests per window.
 * Higher limits for development to support rapid prototyping and testing.
 * @type {number}
 */
export const RATE_LIMIT_LLM_MAX_REQUESTS =
  process.env.NODE_ENV === 'production' ? 10 : 100;

/**
 * Maximum authentication requests per window.
 * @type {number}
 */
export const RATE_LIMIT_AUTH_MAX_REQUESTS = 5;

/**
 * Enhanced rate limiting configuration constants for proxy awareness
 */

/**
 * Timeout for suspicious pattern tracking in milliseconds - 1 hour.
 * @type {number}
 */
export const RATE_LIMIT_PATTERN_TRACKING_TIMEOUT = 60 * 60 * 1000;

/**
 * Maximum suspicious score for adaptive rate limiting.
 * @type {number}
 */
export const RATE_LIMIT_MAX_SUSPICIOUS_SCORE = 10;

/**
 * Threshold for triggering strict rate limiting.
 * @type {number}
 */
export const RATE_LIMIT_SUSPICIOUS_THRESHOLD = 3;

/**
 * Common proxy headers for client IP extraction.
 * @type {string[]}
 */
export const RATE_LIMIT_PROXY_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'x-client-ip',
  'x-forwarded',
  'forwarded-for',
  'forwarded',
];

/**
 * Memory leak prevention constants for rate limiting suspicious patterns map
 */

/**
 * Maximum number of entries in suspicious patterns map to prevent memory leaks.
 * @type {number}
 */
export const RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_SIZE = 10000;

/**
 * Cleanup interval for suspicious patterns map in milliseconds - 5 minutes.
 * @type {number}
 */
export const RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Maximum age for suspicious pattern entries in milliseconds - 2 hours.
 * @type {number}
 */
export const RATE_LIMIT_SUSPICIOUS_PATTERNS_MAX_AGE = 2 * 60 * 60 * 1000;

/**
 * Batch size for cleaning up expired entries to prevent blocking.
 * @type {number}
 */
export const RATE_LIMIT_SUSPICIOUS_PATTERNS_CLEANUP_BATCH_SIZE = 100;

/**
 * Minimum time between cleanup operations in milliseconds - 1 minute.
 * @type {number}
 */
export const RATE_LIMIT_SUSPICIOUS_PATTERNS_MIN_CLEANUP_INTERVAL = 60 * 1000;

/**
 * Debug Logging configuration constants
 */

/**
 * Default enabled state for debug logging.
 * @type {boolean}
 */
export const DEBUG_LOGGING_ENABLED = true;

/**
 * Default path for debug log files.
 * @type {string}
 */
export const DEBUG_LOGGING_DEFAULT_PATH = './logs';

/**
 * Default retention period in days for debug logs.
 * @type {number}
 */
export const DEBUG_LOGGING_DEFAULT_RETENTION_DAYS = 7;

/**
 * Default maximum file size for debug log files.
 * @type {string}
 */
export const DEBUG_LOGGING_DEFAULT_MAX_FILE_SIZE = '10MB';

/**
 * Default write buffer size for batching log writes.
 * @type {number}
 */
export const DEBUG_LOGGING_DEFAULT_WRITE_BUFFER_SIZE = 100;

/**
 * Default flush interval in milliseconds for writing buffered logs.
 * @type {number}
 */
export const DEBUG_LOGGING_DEFAULT_FLUSH_INTERVAL = 1000;

/**
 * Default maximum concurrent write operations.
 * @type {number}
 */
export const DEBUG_LOGGING_DEFAULT_MAX_CONCURRENT_WRITES = 5;

/**
 * Default cleanup schedule in cron format (daily at 2 AM).
 * @type {string}
 */
export const DEBUG_LOGGING_DEFAULT_CLEANUP_SCHEDULE = '0 2 * * *';

/**
 * Default enabled state for automatic cleanup.
 * @type {boolean}
 */
export const DEBUG_LOGGING_DEFAULT_CLEANUP_ENABLED = true;

/**
 * Default compression setting for log files.
 * @type {boolean}
 */
export const DEBUG_LOGGING_DEFAULT_COMPRESSION = false;

/**
 * Validation configuration constants
 */

/**
 * Maximum length for header names in validation.
 * @type {number}
 */
export const VALIDATION_HEADER_NAME_MAX_LENGTH = 100;

/**
 * Maximum length for header values in validation.
 * @type {number}
 */
export const VALIDATION_HEADER_VALUE_MAX_LENGTH = 1000;

/**
 * Maximum length for LLM ID in validation.
 * @type {number}
 */
export const VALIDATION_LLM_ID_MAX_LENGTH = 100;

/**
 * Security validation constants
 */

/**
 * Maximum request payload size in bytes - 10MB as recommended for security.
 * @type {number}
 */
export const SECURITY_MAX_REQUEST_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Default request payload size in bytes - 1MB for normal operations.
 * @type {string}
 */
export const SECURITY_DEFAULT_REQUEST_SIZE = '1mb';

/**
 * Enhanced request payload size for large payloads - 10MB.
 * @type {string}
 */
export const SECURITY_MAX_REQUEST_SIZE = '10mb';

/**
 * IPv6 address patterns for security validation
 */

/**
 * IPv6 loopback addresses that should be blocked for SSRF protection.
 * @type {string[]}
 */
export const SECURITY_IPV6_LOOPBACK_ADDRESSES = [
  '::1',
  '::0',
  '0:0:0:0:0:0:0:1',
  '0:0:0:0:0:0:0:0',
];

/**
 * IPv6 private/internal address prefixes that should be blocked for SSRF protection.
 * @type {string[]}
 */
export const SECURITY_IPV6_PRIVATE_PREFIXES = [
  'fc',
  'fd', // Unique Local Addresses (fc00::/7 and fd00::/8)
  'fe8',
  'fe9',
  'fea',
  'feb', // Link-Local Addresses (fe80::/10)
  'fec',
  'fed',
  'fee',
  'fef', // Site-Local Addresses (fec0::/10) - deprecated but still blocked
  'ff', // Multicast Addresses (ff00::/8)
];

/**
 * Header pollution protection constants
 */

/**
 * Dangerous header names that should be blocked to prevent prototype pollution.
 * @type {string[]}
 */
export const SECURITY_DANGEROUS_HEADER_NAMES = [
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toString',
  'valueOf',
];

/**
 * Pattern for detecting potentially dangerous header names (case-insensitive).
 * @type {RegExp}
 */
export const SECURITY_DANGEROUS_HEADER_PATTERN =
  /^(__proto__|constructor|prototype)$/i;

/**
 * Payload sanitization constants
 */

/**
 * Maximum length for payload content before truncation in logs.
 * @type {number}
 */
export const PAYLOAD_SANITIZATION_MAX_LENGTH = 70;

/**
 * Ellipsis string used when truncating payload content.
 * @type {string}
 */
export const PAYLOAD_SANITIZATION_ELLIPSIS = '...';

/**
 * Error response constants
 */

/**
 * Maximum length for error body preview in logs.
 * @type {number}
 */
export const ERROR_BODY_PREVIEW_LENGTH = 500;

/**
 * Maximum length for short error previews in logs.
 * @type {number}
 */
export const ERROR_PREVIEW_SHORT_LENGTH = 100;

// Note: Other potential constants like default retry parameters (maxRetries, delays)
// are currently handled as localized fallbacks within specific services (e.g., LlmRequestService)
// if not provided by LLM configurations. They are not centralized here unless they become
// more broadly shared or represent "magic values" used across multiple, unrelated modules.
// Error stage strings are also generally kept specific to their context of use for clarity,
// unless a specific stage string is intended to be reused identically across services for the same logical error.

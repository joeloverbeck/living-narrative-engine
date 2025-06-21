// --- FILE: src/llms/retryHttpClient.js ---

import { IHttpClient } from './interfaces/IHttpClient.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../constants/eventIds.js';
import { fetchWithRetry, initLogger } from '../utils/index.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('./interfaces/IHttpClient.js').HttpClientRequestOptions} HttpClientRequestOptions
 * @typedef {import('./interfaces/IHttpClient.js').HttpMethod} HttpMethod
 */

/* ---------------------------------------------------------------- *
 * Constants & helper utilities (unchanged)             *
 * ---------------------------------------------------------------- */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10_000;

const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/* ---------------------------------------------------------------- *
 * Custom HttpClientError                       *
 * ---------------------------------------------------------------- */
export class HttpClientError extends Error {
  url;
  status;
  responseBody;
  attempts;
  isRetryableFailure;

  constructor(
    message,
    { url, status, responseBody, attempts, isRetryableFailure, cause }
  ) {
    super(message);
    this.name = 'HttpClientError';
    this.url = url;
    this.status = status;
    this.responseBody = responseBody;
    this.attempts = attempts;
    this.isRetryableFailure = isRetryableFailure;
    if (cause) this.cause = cause;
    if (Error.captureStackTrace) Error.captureStackTrace(this, HttpClientError);
  }
}

/* ---------------------------------------------------------------- *
 * RetryHttpClient                          *
 * ---------------------------------------------------------------- */
export class RetryHttpClient extends IHttpClient {
  /** @type {ILogger}              */ #logger;
  /** @type {ISafeEventDispatcher} */ #dispatcher;
  /** @type {number} */ #defaultMaxRetries;
  /** @type {number} */ #defaultBaseDelayMs;
  /** @type {number} */ #defaultMaxDelayMs;

  /**
   * @param {object} params
   * @param {ILogger} params.logger
   * @param {ISafeEventDispatcher} params.dispatcher
   * @param {number} [params.defaultMaxRetries]
   * @param {number} [params.defaultBaseDelayMs]
   * @param {number} [params.defaultMaxDelayMs]
   */
  constructor({
    logger,
    dispatcher,
    defaultMaxRetries = DEFAULT_MAX_RETRIES,
    defaultBaseDelayMs = DEFAULT_BASE_DELAY_MS,
    defaultMaxDelayMs = DEFAULT_MAX_DELAY_MS,
  }) {
    super();

    /* ---------------- Dependency validation ---------------- */
    this.#logger = initLogger('RetryHttpClient', logger);
    // *** CORRECTED VALIDATION: Check for `dispatch` ***
    if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
      logger.error(
        'RetryHttpClient: Missing or invalid SafeEventDispatcher with .dispatch(...)'
      );
      throw new Error('RetryHttpClient: dispatcher dependency invalid.');
    }
    this.#dispatcher = dispatcher;

    /* ---------------- Config validation (unchanged) --------- */
    this.#defaultMaxRetries =
      typeof defaultMaxRetries === 'number' && defaultMaxRetries >= 0
        ? defaultMaxRetries
        : DEFAULT_MAX_RETRIES;
    this.#defaultBaseDelayMs =
      typeof defaultBaseDelayMs === 'number' && defaultBaseDelayMs >= 0
        ? defaultBaseDelayMs
        : DEFAULT_BASE_DELAY_MS;
    this.#defaultMaxDelayMs =
      typeof defaultMaxDelayMs === 'number' &&
      defaultMaxDelayMs >= this.#defaultBaseDelayMs
        ? defaultMaxDelayMs
        : Math.max(this.#defaultBaseDelayMs, DEFAULT_MAX_DELAY_MS);

    this.#logger.debug('RetryHttpClient: Instance created.', {
      maxRetries: this.#defaultMaxRetries,
      baseDelayMs: this.#defaultBaseDelayMs,
      maxDelayMs: this.#defaultMaxDelayMs,
    });
  }

  /* ---------------- Private helpers ---------------- */
  #calculateDelay(attempt) {
    if (attempt <= 0) return 0;
    const delay = Math.min(
      this.#defaultBaseDelayMs * 2 ** (attempt - 1),
      this.#defaultMaxDelayMs
    );
    const jitter = (Math.random() * 0.4 - 0.2) * delay; // ±20 %
    return Math.max(0, Math.floor(delay + jitter));
  }

  #emitWarning(message, { statusCode, url, raw }) {
    const details = {
      statusCode,
      url,
      raw,
      timestamp: new Date().toISOString(),
    };
    // *** CORRECTED METHOD CALL ***
    this.#dispatcher.dispatch(SYSTEM_WARNING_OCCURRED_ID, {
      message,
      details,
    });
  }

  #emitError(message, { statusCode, url, raw, stack }) {
    const details = {
      statusCode,
      url,
      raw,
      timestamp: new Date().toISOString(),
      stack,
    };
    // *** CORRECTED METHOD CALL ***
    this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message,
      details,
    });
  }

  /* ---------------------------------------------------------------- *
   * request                             *
   * ---------------------------------------------------------------- */
  /**
   * @override
   * @param {string} url
   * @param {HttpClientRequestOptions} options
   * @returns {Promise<any>}
   */
  async request(url, options) {
    this.#logger.debug(
      `RetryHttpClient.request: Initiating request to ${url}`,
      { method: options.method }
    );
    let attempt = 0;
    let lastError = null;

    while (attempt <= this.#defaultMaxRetries) {
      attempt += 1;
      try {
        this.#logger.debug(
          `RetryHttpClient.request: Attempt ${attempt}/${
            this.#defaultMaxRetries + 1
          } → ${url}`
        );
        const silentDispatcher = { dispatch: async () => true };
        const result = await fetchWithRetry(
          url,
          options,
          1,
          this.#defaultBaseDelayMs,
          this.#defaultMaxDelayMs,
          silentDispatcher,
          this.#logger
        );
        return result;
      } catch (err) {
        lastError = err;
        const status = err.status;
        const raw = err.body ?? err.message;
        const isRetryable =
          status === undefined || RETRYABLE_STATUS_CODES.includes(status);

        if (isRetryable && attempt <= this.#defaultMaxRetries) {
          const delay = this.#calculateDelay(attempt);
          if (status !== undefined) {
            this.#emitWarning(
              `Retryable HTTP error ${status} on ${url} (attempt ${attempt}/${
                this.#defaultMaxRetries + 1
              })`,
              {
                statusCode: status,
                url,
                raw: typeof raw === 'string' ? raw.slice(0, 200) : raw,
              }
            );
          } else {
            this.#emitWarning(
              `Network error contacting ${url} (attempt ${attempt}/${
                this.#defaultMaxRetries + 1
              })`,
              { statusCode: undefined, url, raw }
            );
          }
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }

        if (status !== undefined) {
          this.#emitError(
            `HTTP error ${status} from ${url} after ${attempt} attempts`,
            {
              statusCode: status,
              url,
              raw,
              stack: err.stack,
            }
          );
        } else {
          this.#emitError(
            `Network failure contacting ${url} after ${attempt} attempts`,
            { statusCode: undefined, url, raw, stack: err.stack }
          );
        }
        throw lastError;
      }
    }

    throw lastError;
  }
}

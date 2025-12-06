/**
 * @file Response Salvage Service for caching and recovering LLM responses
 * @see ../handlers/llmRequestController.js
 */

import crypto from 'crypto';
import {
  SALVAGE_DEFAULT_TTL,
  SALVAGE_MAX_ENTRIES,
} from '../config/constants.js';

/**
 * Service for caching and salvaging successful LLM responses that couldn't be delivered
 */
export class ResponseSalvageService {
  /** @type {Map<string, object>} */
  #salvageCache;

  /** @type {object} */
  #logger;

  /** @type {number} */
  #defaultTtl;

  /** @type {Map<string, NodeJS.Timeout>} */
  #expirationTimers;

  /**
   * Creates a ResponseSalvageService instance
   * @param {object} logger - Logger instance
   * @param {object} options - Configuration options
   * @param {number} [options.defaultTtl] - Default TTL in milliseconds (30 seconds)
   * @param {number} [options.maxEntries] - Maximum salvaged responses to cache
   */
  constructor(logger, options = {}) {
    if (!logger) throw new Error('ResponseSalvageService: logger is required');

    this.#logger = logger;
    this.#defaultTtl = options.defaultTtl || SALVAGE_DEFAULT_TTL;
    this.#salvageCache = new Map();
    this.#expirationTimers = new Map();

    this.#logger.debug('ResponseSalvageService: Instance created', {
      defaultTtl: this.#defaultTtl,
      maxEntries: options.maxEntries || SALVAGE_MAX_ENTRIES,
    });
  }

  /**
   * Generates a request signature for caching
   * @param {string} llmId - LLM identifier
   * @param {object} targetPayload - Request payload
   * @returns {string} Request signature hash
   */
  #generateSignature(llmId, targetPayload) {
    const data = JSON.stringify({
      llmId,
      model: targetPayload.model,
      messages: targetPayload.messages,
      temperature: targetPayload.temperature,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Salvages a successful LLM response for later recovery
   * @param {string} requestId - Request correlation ID
   * @param {string} llmId - LLM identifier
   * @param {object} targetPayload - Original request payload
   * @param {object} responseData - Successful response data
   * @param {number} statusCode - HTTP status code
   * @param {number} [ttl] - Time to live in milliseconds
   */
  salvageResponse(
    requestId,
    llmId,
    targetPayload,
    responseData,
    statusCode,
    ttl
  ) {
    const signature = this.#generateSignature(llmId, targetPayload);
    const expirationMs = ttl || this.#defaultTtl;

    const salvageEntry = {
      requestId,
      llmId,
      signature,
      responseData,
      statusCode,
      salvageTimestamp: Date.now(),
      expiresAt: Date.now() + expirationMs,
    };

    // Clear existing timer if present
    if (this.#expirationTimers.has(requestId)) {
      clearTimeout(this.#expirationTimers.get(requestId));
    }

    // Store by both request ID and signature for flexible retrieval
    this.#salvageCache.set(requestId, salvageEntry);
    this.#salvageCache.set(signature, salvageEntry);

    // Set expiration timer
    const timer = setTimeout(() => {
      this.#expireEntry(requestId, signature);
    }, expirationMs);

    this.#expirationTimers.set(requestId, timer);

    this.#logger.info(
      `ResponseSalvageService: Salvaged response for request ${requestId}`,
      {
        requestId,
        llmId,
        signature: signature.substring(0, 16) + '...',
        ttl: expirationMs,
        statusCode,
      }
    );
  }

  /**
   * Expires a salvaged entry
   * @private
   * @param {string} requestId - Request ID
   * @param {string} signature - Request signature
   */
  #expireEntry(requestId, signature) {
    this.#salvageCache.delete(requestId);
    this.#salvageCache.delete(signature);
    this.#expirationTimers.delete(requestId);

    this.#logger.debug(
      `ResponseSalvageService: Expired salvaged response for request ${requestId}`,
      { requestId }
    );
  }

  /**
   * Retrieves a salvaged response by request ID
   * @param {string} requestId - Request correlation ID
   * @returns {object|null} Salvaged response or null if not found/expired
   */
  retrieveByRequestId(requestId) {
    const entry = this.#salvageCache.get(requestId);

    if (!entry) {
      this.#logger.debug(
        `ResponseSalvageService: No salvaged response found for request ${requestId}`,
        { requestId }
      );
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.#expireEntry(requestId, entry.signature);
      return null;
    }

    this.#logger.info(
      `ResponseSalvageService: Retrieved salvaged response for request ${requestId}`,
      {
        requestId,
        llmId: entry.llmId,
        ageMs: Date.now() - entry.salvageTimestamp,
      }
    );

    return {
      responseData: entry.responseData,
      statusCode: entry.statusCode,
      salvageTimestamp: entry.salvageTimestamp,
      requestId: entry.requestId,
      llmId: entry.llmId,
    };
  }

  /**
   * Retrieves a salvaged response by request signature (for duplicate requests)
   * @param {string} llmId - LLM identifier
   * @param {object} targetPayload - Request payload
   * @returns {object|null} Salvaged response or null if not found/expired
   */
  retrieveBySignature(llmId, targetPayload) {
    const signature = this.#generateSignature(llmId, targetPayload);
    const entry = this.#salvageCache.get(signature);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.#expireEntry(entry.requestId, signature);
      return null;
    }

    this.#logger.info(
      `ResponseSalvageService: Retrieved salvaged response by signature`,
      {
        requestId: entry.requestId,
        llmId: entry.llmId,
        ageMs: Date.now() - entry.salvageTimestamp,
      }
    );

    return {
      responseData: entry.responseData,
      statusCode: entry.statusCode,
      salvageTimestamp: entry.salvageTimestamp,
      requestId: entry.requestId,
      llmId: entry.llmId,
      fromCache: true,
    };
  }

  /**
   * Gets statistics about salvaged responses
   * @returns {object} Statistics object
   */
  getStats() {
    // Count unique entries (cache has duplicates by ID and signature)
    const uniqueEntries = new Set();
    for (const [, value] of this.#salvageCache.entries()) {
      if (value.requestId) {
        uniqueEntries.add(value.requestId);
      }
    }

    return {
      salvaged: uniqueEntries.size,
      totalCacheEntries: this.#salvageCache.size,
      activeTimers: this.#expirationTimers.size,
    };
  }

  /**
   * Clears all salvaged responses (for testing/cleanup)
   */
  clear() {
    // Clear all timers
    for (const timer of this.#expirationTimers.values()) {
      clearTimeout(timer);
    }

    this.#salvageCache.clear();
    this.#expirationTimers.clear();

    this.#logger.debug(
      'ResponseSalvageService: Cleared all salvaged responses'
    );
  }

  /**
   * Cleanup method for graceful shutdown
   */
  cleanup() {
    this.clear();
    this.#logger.info('ResponseSalvageService: Cleanup complete');
  }
}

export default ResponseSalvageService;

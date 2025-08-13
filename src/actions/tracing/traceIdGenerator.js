/**
 * @file Shared trace ID generator for consistent naming across services
 * @see actionTraceOutputService.js
 * @see traceQueueProcessor.js
 */

/**
 * File naming strategies for browser-compatible trace storage
 *
 * @enum {string}
 */
export const NamingStrategy = {
  TIMESTAMP_FIRST: 'timestamp_first', // 2024-01-15_103045_core-go_abc123
  ACTION_FIRST: 'action_first', // core-go_2024-01-15_103045_abc123
  SEQUENTIAL: 'sequential', // trace_000001_core-go_20240115103045
};

/**
 * Timestamp formats for browser-compatible storage
 *
 * @enum {string}
 */
export const TimestampFormat = {
  COMPACT: 'compact', // 20240115_103045
  UNIX: 'unix', // 1705315845123
  HUMAN: 'human', // 2024-01-15_10h30m45s
};

/**
 * Shared trace ID generator class
 */
export class TraceIdGenerator {
  #namingStrategy;
  #timestampFormat;
  #includeHash;
  #hashLength;
  #sequenceCounter;

  /**
   * Constructor
   *
   * @param {object} options - Configuration options
   * @param {string} [options.strategy] - Naming strategy
   * @param {string} [options.timestampFormat] - Timestamp format
   * @param {boolean} [options.includeHash] - Whether to include hash
   * @param {number} [options.hashLength] - Length of hash
   */
  constructor(options = {}) {
    this.#namingStrategy = options.strategy || NamingStrategy.TIMESTAMP_FIRST;
    this.#timestampFormat = options.timestampFormat || TimestampFormat.COMPACT;
    this.#includeHash = options.includeHash !== false;
    this.#hashLength = options.hashLength || 6;
    this.#sequenceCounter = 0;
  }

  /**
   * Generate unique ID for trace
   *
   * @param {object} trace - Trace object
   * @returns {string} Unique trace ID
   */
  generateId(trace) {
    // Extract metadata from trace
    const timestamp = Date.now();
    let actionId = 'unknown';

    if (trace.actionId) {
      actionId = trace.actionId;
    } else if (
      trace.getTracedActions &&
      typeof trace.getTracedActions === 'function'
    ) {
      const tracedActions = trace.getTracedActions();
      if (tracedActions.size > 0) {
        actionId = Array.from(tracedActions.keys())[0];
      }
    }

    const metadata = {
      actionId,
      timestamp,
      error: trace.execution?.error || trace.error || false,
    };

    // Generate ID based on configured strategy
    switch (this.#namingStrategy) {
      case NamingStrategy.TIMESTAMP_FIRST:
        return this.#generateTimestampFirst(metadata);

      case NamingStrategy.ACTION_FIRST:
        return this.#generateActionFirst(metadata);

      case NamingStrategy.SEQUENTIAL:
        return this.#generateSequential(metadata);

      default:
        return this.#generateTimestampFirst(metadata);
    }
  }

  /**
   * Generate timestamp-first trace ID format
   *
   * @private
   * @param {object} metadata - Trace metadata
   * @returns {string} Formatted trace ID
   */
  #generateTimestampFirst(metadata) {
    const parts = [
      this.#formatTimestamp(metadata.timestamp),
      this.#sanitizeActionId(metadata.actionId),
    ];

    if (metadata.error) {
      parts.push('ERROR');
    }

    if (this.#includeHash) {
      parts.push(this.#generateWebHash(metadata));
    }

    return parts.join('_');
  }

  /**
   * Generate action-first trace ID format
   *
   * @private
   * @param {object} metadata - Trace metadata
   * @returns {string} Formatted trace ID
   */
  #generateActionFirst(metadata) {
    const parts = [
      this.#sanitizeActionId(metadata.actionId),
      this.#formatTimestamp(metadata.timestamp),
    ];

    if (metadata.error) {
      parts.push('ERROR');
    }

    if (this.#includeHash) {
      parts.push(this.#generateWebHash(metadata));
    }

    return parts.join('_');
  }

  /**
   * Generate sequential trace ID format
   *
   * @private
   * @param {object} metadata - Trace metadata
   * @returns {string} Formatted trace ID
   */
  #generateSequential(metadata) {
    const sequence = ++this.#sequenceCounter;
    const parts = [
      'trace',
      String(sequence).padStart(6, '0'),
      this.#sanitizeActionId(metadata.actionId),
      this.#formatTimestamp(metadata.timestamp),
    ];

    if (metadata.error) {
      parts.push('ERROR');
    }

    return parts.join('_');
  }

  /**
   * Format timestamp for browser-compatible file naming
   *
   * @private
   * @param {number} timestamp - Unix timestamp
   * @returns {string} Formatted timestamp
   */
  #formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    switch (this.#timestampFormat) {
      case TimestampFormat.COMPACT:
        return [
          date.getUTCFullYear(),
          String(date.getUTCMonth() + 1).padStart(2, '0'),
          String(date.getUTCDate()).padStart(2, '0'),
          '_',
          String(date.getUTCHours()).padStart(2, '0'),
          String(date.getUTCMinutes()).padStart(2, '0'),
          String(date.getUTCSeconds()).padStart(2, '0'),
        ].join('');

      case TimestampFormat.UNIX:
        return String(timestamp);

      case TimestampFormat.HUMAN:
        return [
          date.getUTCFullYear(),
          '-',
          String(date.getUTCMonth() + 1).padStart(2, '0'),
          '-',
          String(date.getUTCDate()).padStart(2, '0'),
          '_',
          String(date.getUTCHours()).padStart(2, '0'),
          'h',
          String(date.getUTCMinutes()).padStart(2, '0'),
          'm',
          String(date.getUTCSeconds()).padStart(2, '0'),
          's',
        ].join('');

      default:
        return this.#formatTimestamp(timestamp);
    }
  }

  /**
   * Sanitize action ID for browser-compatible storage keys
   *
   * @private
   * @param {string} actionId - Raw action ID
   * @returns {string} Sanitized action ID
   */
  #sanitizeActionId(actionId) {
    if (!actionId) return 'unknown';

    // Replace namespace colon and other special chars with dashes
    return (
      actionId
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/^[.\s]+|[.\s]+$/g, '')
        .substring(0, 30) || 'unknown'
    );
  }

  /**
   * Generate browser-compatible hash for uniqueness
   *
   * @private
   * @param {object} metadata - Trace metadata
   * @returns {string} Short hash string
   */
  #generateWebHash(metadata) {
    // Simple hash for browser compatibility
    const data = JSON.stringify({
      ...metadata,
      random: Math.random(),
      timestamp: performance.now(),
    });

    // Use simple string hash algorithm
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Ensure the hash is long enough by padding with zeros if needed
    const hexHash = Math.abs(hash).toString(16);
    return hexHash
      .padStart(this.#hashLength, '0')
      .substring(0, this.#hashLength);
  }

  /**
   * Get current configuration
   *
   * @returns {object} Current configuration
   */
  getConfiguration() {
    return {
      strategy: this.#namingStrategy,
      timestampFormat: this.#timestampFormat,
      includeHash: this.#includeHash,
      hashLength: this.#hashLength,
    };
  }

  /**
   * Reset sequence counter (useful for testing)
   */
  resetSequence() {
    this.#sequenceCounter = 0;
  }
}

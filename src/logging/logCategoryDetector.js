/**
 * @file Log category detection utility with enhanced patterns and caching
 * @see remoteLogger.js
 */

/**
 * LRU (Least Recently Used) cache implementation for category detection
 */
class LRUCache {
  /**
   * @param {number} maxSize - Maximum number of entries in the cache
   */
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache
   *
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set a value in the cache
   *
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Add to end
    this.cache.set(key, value);
    // Remove oldest if over limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Check if cache has a key
   *
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns {object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

/**
 * @typedef {object} CategoryPattern
 * @property {RegExp} pattern - Regular expression pattern
 * @property {number} priority - Priority level (higher = higher priority)
 */

/**
 * @typedef {object} DetectorConfig
 * @property {number} [cacheSize] - Maximum cache size
 * @property {boolean} [enableCache] - Enable/disable caching
 * @property {object} [customPatterns] - Custom category patterns
 */

/**
 * Log category detector with enhanced patterns and caching
 */
class LogCategoryDetector {
  /**
   * @private
   * @type {Map<string, CategoryPattern>}
   */
  #patterns;

  /**
   * @private
   * @type {LRUCache|null}
   */
  #cache;

  /**
   * @private
   * @type {boolean}
   */
  #cacheEnabled;

  /**
   * @private
   * @type {number}
   */
  #detectionCount;

  /**
   * @private
   * @type {number}
   */
  #cacheHits;

  /**
   * Creates a LogCategoryDetector instance
   *
   * @param {DetectorConfig} [config] - Configuration options
   */
  constructor(config = {}) {
    const {
      cacheSize = 200, // Reduced from 1000 to 200 for better memory efficiency
      enableCache = true,
      customPatterns = {},
    } = config;

    this.#cacheEnabled = enableCache;
    this.#cache = enableCache ? new LRUCache(cacheSize) : null;
    this.#detectionCount = 0;
    this.#cacheHits = 0;

    // Initialize patterns with priorities
    this.#patterns = new Map();
    this.#initializePatterns(customPatterns);
  }

  /**
   * Initialize category detection patterns
   *
   * @private
   * @param {object} customPatterns - Custom patterns to merge
   */
  #initializePatterns(customPatterns) {
    // Priority 1: Error patterns (highest priority)
    this.#patterns.set('error', {
      pattern:
        /\berror\b(?!\s+log)|exception|failed|failure|catch|throw|stack\s*trace/i,
      priority: 100,
    });

    // Priority 2: Specific domain patterns (high priority)
    this.#patterns.set('ecs', {
      pattern:
        /EntityManager|ComponentManager|SystemManager|entity\s+(actor|player|npc|item)|component\s+\w+|system\s+(physics|render|input)|\bECS\b/i,
      priority: 95,
    });

    this.#patterns.set('engine', {
      pattern:
        /GameEngine|engineState|gameSession|gameEngine|game\s*loop|tick\s*rate|engine\s+(start|stop|init)/i,
      priority: 90,
    });

    this.#patterns.set('ai', {
      pattern:
        /\bAI\b|\bLLM\b|\bnotes\b|\bthoughts\b|memory\s+system|prompt|decision|neural|model\s+(loaded|trained)|inference|embedding/i,
      priority: 90,
    });

    this.#patterns.set('anatomy', {
      pattern:
        /\banatomy\b|body\s*part|descriptor|blueprint\s+(created|loaded)|\blimb\b|\borgan\b|\btissue\b|\bmuscle\b|\bbone\b/i,
      priority: 90,
    });

    this.#patterns.set('persistence', {
      pattern:
        /\bsave\b|\bload\b|persist|storage|serializ|deserializ|backup|restore|checkpoint/i,
      priority: 85,
    });

    this.#patterns.set('actions', {
      pattern:
        /\baction\b|\btarget\b|resolution|candidate|discovery|\bexecute\b|\bperform\b|\binvoke\b/i,
      priority: 85,
    });

    this.#patterns.set('turns', {
      pattern:
        /turn|round|cycle|turnManager|roundManager|phase|step|iteration/i,
      priority: 85,
    });

    this.#patterns.set('events', {
      pattern:
        /event|dispatch|listener|eventBus|emit|subscribe|publish|observer|handler/i,
      priority: 85,
    });

    this.#patterns.set('validation', {
      pattern:
        /\bvalidat|\bschema\b|\bajv\b|\binvalid|constraint|\brule\b|\bverify\b|\bcheck\b/i,
      priority: 85,
    });

    // Priority 3: General domain patterns (medium priority)
    this.#patterns.set('ui', {
      pattern:
        /\bUI\b|Renderer|domUI|\bdisplay\b|\bmodal\b|\bbutton\b|\bwidget\b|\bview\b|\blayout\b|\bstyle\b|\bcss\b/i,
      priority: 70,
    });

    this.#patterns.set('network', {
      pattern:
        /\bfetch\b|\bhttp\b|\brequest\b|\bresponse\b|\bxhr\b|\bajax\b|\bapi\b|endpoint|websocket|\bsocket\b/i,
      priority: 70,
    });

    this.#patterns.set('configuration', {
      pattern:
        /\bconfig\b|configuration|\bsettings\b|\boptions\b|preferences|\bsetup\b/i,
      priority: 65,
    });

    this.#patterns.set('initialization', {
      pattern:
        /\binit\b|bootstrap|startup|initializ|\bmount\b|\bunmount\b|\bready\b/i,
      priority: 65,
    });

    this.#patterns.set('performance', {
      pattern:
        /\bperformance\b|\btiming\b|\blatency\b|\bduration\b|benchmark|profil|optimi|\bspeed\b|\bslow\b|\bfast\b/i,
      priority: 60,
    });

    // Merge custom patterns
    for (const [category, pattern] of Object.entries(customPatterns)) {
      if (pattern instanceof RegExp) {
        this.#patterns.set(category, {
          pattern,
          priority: 50, // Custom patterns get medium priority by default
        });
      } else if (pattern && pattern.pattern && pattern.priority) {
        this.#patterns.set(category, pattern);
      }
    }
  }

  /**
   * Simple hash function for cache keys to reduce memory usage
   *
   * @private
   * @param {string} str - String to hash
   * @returns {string} Hash string
   */
  #hashString(str) {
    // Use first 50 chars + length + simple checksum for cache key
    // This reduces memory while maintaining good cache hit rates
    const maxLen = 50;
    const prefix = str.substring(0, maxLen);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${prefix}:${str.length}:${hash}`;
  }

  /**
   * Detect category from log message
   *
   * @param {string} message - Log message
   * @returns {string|undefined} Detected category or undefined
   */
  detectCategory(message) {
    if (!message || typeof message !== 'string') {
      return undefined;
    }

    this.#detectionCount++;

    // Generate cache key using hash for memory efficiency
    const cacheKey = this.#cacheEnabled && this.#cache ? this.#hashString(message) : null;

    // Check cache first
    if (cacheKey && this.#cache.has(cacheKey)) {
      this.#cacheHits++;
      return this.#cache.get(cacheKey);
    }

    // Find matching categories with their priorities
    const matches = [];
    for (const [category, { pattern, priority }] of this.#patterns) {
      if (pattern.test(message)) {
        matches.push({ category, priority });
      }
    }

    // Sort by priority (highest first) and select the best match
    let detectedCategory = undefined;
    if (matches.length > 0) {
      matches.sort((a, b) => b.priority - a.priority);
      detectedCategory = matches[0].category;
    }

    // Cache the result using hashed key
    if (cacheKey && this.#cache) {
      this.#cache.set(cacheKey, detectedCategory);
    }

    return detectedCategory;
  }

  /**
   * Batch detect categories for multiple messages
   *
   * @param {string[]} messages - Array of log messages
   * @returns {(string|undefined)[]} Array of detected categories
   */
  detectCategories(messages) {
    return messages.map((message) => this.detectCategory(message));
  }

  /**
   * Clear the cache
   */
  clearCache() {
    if (this.#cache) {
      this.#cache.clear();
    }
    this.#cacheHits = 0;
    this.#detectionCount = 0;
  }

  /**
   * Get detector statistics
   *
   * @returns {object} Statistics about detection and caching
   */
  getStats() {
    const cacheStats = this.#cache ? this.#cache.getStats() : null;
    const hitRate =
      this.#detectionCount > 0
        ? (this.#cacheHits / this.#detectionCount) * 100
        : 0;

    return {
      detectionCount: this.#detectionCount,
      cacheHits: this.#cacheHits,
      cacheHitRate: `${hitRate.toFixed(2)}%`,
      cacheEnabled: this.#cacheEnabled,
      cacheStats,
      patternCount: this.#patterns.size,
    };
  }

  /**
   * Add or update a category pattern
   *
   * @param {string} category - Category name
   * @param {RegExp} pattern - Pattern to match
   * @param {number} [priority] - Priority level
   */
  addPattern(category, pattern, priority = 50) {
    this.#patterns.set(category, { pattern, priority });
    // Clear cache when patterns change
    this.clearCache();
  }

  /**
   * Remove a category pattern
   *
   * @param {string} category - Category to remove
   */
  removePattern(category) {
    this.#patterns.delete(category);
    // Clear cache when patterns change
    this.clearCache();
  }

  /**
   * Get all registered patterns
   *
   * @returns {object} Object mapping categories to patterns
   */
  getPatterns() {
    const patterns = {};
    for (const [category, { pattern, priority }] of this.#patterns) {
      patterns[category] = {
        pattern: pattern.toString(),
        priority,
      };
    }
    return patterns;
  }
}

export default LogCategoryDetector;
export { LRUCache };

/**
 * @file Log metadata enrichment utility with configurable collection levels
 * @see remoteLogger.js
 */

/**
 * @typedef {object} SourceLocation
 * @property {string} file - File name
 * @property {number} line - Line number
 * @property {number} [column] - Column number
 */

/**
 * @typedef {object} BrowserMetadata
 * @property {string} userAgent - Browser user agent
 * @property {string} url - Current page URL
 * @property {object} [viewport] - Viewport dimensions
 * @property {object} [screen] - Screen dimensions
 */

/**
 * @typedef {object} PerformanceMetadata
 * @property {number} timing - Performance.now() value
 * @property {object} [memory] - Memory usage information
 * @property {object} [navigation] - Navigation timing data
 */

/**
 * @typedef {'minimal'|'standard'|'full'} MetadataLevel
 */

/**
 * @typedef {object} EnricherConfig
 * @property {MetadataLevel} [level] - Metadata collection level
 * @property {boolean} [enableSource] - Enable source detection
 * @property {boolean} [enablePerformance] - Enable performance metrics
 * @property {boolean} [enableBrowser] - Enable browser metadata
 * @property {boolean} [lazyLoadExpensive] - Use requestIdleCallback for expensive operations
 * @property {Function} [ErrorConstructor] - Error constructor to use for stack trace generation
 */

/**
 * Log metadata enricher with configurable collection levels
 */
class LogMetadataEnricher {
  /**
   * @private
   * @type {MetadataLevel}
   */
  #level;

  /**
   * @private
   * @type {boolean}
   */
  #enableSource;

  /**
   * @private
   * @type {boolean}
   */
  #enablePerformance;

  /**
   * @private
   * @type {boolean}
   */
  #enableBrowser;

  /**
   * @private
   * @type {boolean}
   */
  #lazyLoadExpensive;

  /**
   * @private
   * @type {Map<string, RegExp>}
   */
  #browserPatterns;

  /**
   * @private
   * @type {Function}
   */
  #ErrorConstructor;

  /**
   * Creates a LogMetadataEnricher instance
   *
   * @param {EnricherConfig} [config] - Configuration options
   */
  constructor(config = {}) {
    const {
      level = 'standard',
      enableSource = true,
      enablePerformance = true,
      enableBrowser = true,
      lazyLoadExpensive = false,
      ErrorConstructor = Error,
    } = config;

    this.#level = level;
    this.#enableSource = enableSource;
    this.#enablePerformance = enablePerformance;
    this.#enableBrowser = enableBrowser;
    this.#lazyLoadExpensive = lazyLoadExpensive;
    this.#ErrorConstructor = ErrorConstructor;

    // Initialize browser-specific regex patterns for stack parsing
    this.#browserPatterns = new Map([
      // Chrome/Edge: "at function (file:line:col)" or "at file:line:col"
      ['chrome', /at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/],
      // Firefox: "function@file:line:col"
      ['firefox', /@(.+?):(\d+):(\d+)/],
      // Safari: "function@file:line:col" or "file:line:col"
      ['safari', /(?:.*?@)?(.+?):(\d+)(?::(\d+))?/],
    ]);
  }

  /**
   * Enrich log entry with metadata
   *
   * @param {object} logEntry - Basic log entry
   * @param {any[]} [originalArgs] - Original log arguments
   * @returns {Promise<object>} Enriched log entry
   */
  async enrichLogEntry(logEntry, originalArgs = []) {
    const enriched = { ...logEntry };

    // Build metadata object based on level
    const metadata = await this.#collectMetadata(originalArgs);

    // Add source location if enabled
    if (
      this.#enableSource &&
      (this.#level !== 'minimal' || logEntry.level === 'error')
    ) {
      const source = this.detectSource();
      if (source) {
        enriched.source = source;
      }
      
      // Add source category for better categorization
      const sourceCategory = this.detectSourceCategory();
      enriched.sourceCategory = sourceCategory;
    }

    enriched.metadata = metadata;
    return enriched;
  }

  /**
   * Synchronous version of enrichLogEntry
   *
   * @param {object} logEntry - Basic log entry
   * @param {any[]} [originalArgs] - Original log arguments
   * @returns {object} Enriched log entry
   */
  enrichLogEntrySync(logEntry, originalArgs = []) {
    const enriched = { ...logEntry };

    // Build metadata object based on level
    const metadata = this.#collectMetadataSync(originalArgs);

    // Add source location if enabled
    if (
      this.#enableSource &&
      (this.#level !== 'minimal' || logEntry.level === 'error')
    ) {
      const source = this.detectSource();
      if (source) {
        enriched.source = source;
      }
      
      // Add source category for better categorization
      const sourceCategory = this.detectSourceCategory();
      enriched.sourceCategory = sourceCategory;
    }

    enriched.metadata = metadata;
    return enriched;
  }

  /**
   * Sanitize arguments to create lightweight copies
   * Prevents holding references to large objects
   *
   * @private
   * @param {any[]} args - Original arguments
   * @returns {any[]} Sanitized arguments
   */
  #sanitizeArgs(args) {
    return args.map((arg) => {
      // For objects, only keep essential properties
      if (arg && typeof arg === 'object') {
        // For errors, keep message and stack
        if (arg instanceof Error) {
          return {
            type: 'Error',
            message: arg.message,
            stack: arg.stack,
          };
        }
        // For large objects, just keep type info
        const keys = Object.keys(arg);
        if (keys.length > 10) {
          return {
            type: 'Object',
            keyCount: keys.length,
            sample: keys.slice(0, 3),
          };
        }
        // For small objects, create shallow copy
        try {
          return JSON.parse(JSON.stringify(arg));
        } catch {
          return { type: 'Object', toString: String(arg) };
        }
      }
      // Primitives are fine
      return arg;
    });
  }

  /**
   * Collect metadata based on configuration level (async)
   *
   * @private
   * @param {any[]} originalArgs - Original log arguments
   * @returns {Promise<object>} Collected metadata
   */
  async #collectMetadata(originalArgs) {
    const metadata = {};

    // Always include original args if present, but sanitize them to reduce memory
    // retention by avoiding holding references to large objects
    if (originalArgs.length > 0) {
      metadata.originalArgs = this.#sanitizeArgs(originalArgs);
    }

    // Minimal level: only essential data
    if (this.#level === 'minimal') {
      if (typeof window !== 'undefined' && window.location) {
        metadata.url = window.location.href;
      }
      return metadata;
    }

    // Standard level: balanced metadata
    if (this.#level === 'standard' || this.#level === 'full') {
      // Browser metadata
      if (this.#enableBrowser && typeof window !== 'undefined') {
        metadata.browser = this.#collectBrowserMetadata();
      }

      // Performance metadata
      if (this.#enablePerformance && typeof performance !== 'undefined') {
        metadata.performance = this.#collectPerformanceMetadata();
      }
    }

    // Full level: comprehensive metadata
    if (this.#level === 'full') {
      // Additional expensive operations
      if (
        this.#lazyLoadExpensive &&
        typeof requestIdleCallback !== 'undefined'
      ) {
        await new Promise((resolve) => {
          requestIdleCallback(
            () => {
              // Collect expensive metadata during idle time
              if (
                typeof performance !== 'undefined' &&
                performance.getEntriesByType
              ) {
                const navigationTiming =
                  performance.getEntriesByType('navigation')[0];
                if (navigationTiming && metadata.performance) {
                  metadata.performance.navigation = {
                    domContentLoaded: navigationTiming.domContentLoadedEventEnd,
                    loadComplete: navigationTiming.loadEventEnd,
                    responseTime:
                      navigationTiming.responseEnd -
                      navigationTiming.requestStart,
                  };
                }
              }
              resolve();
            },
            { timeout: 50 }
          ); // 50ms timeout for idle callback
        });
      } else if (
        typeof performance !== 'undefined' &&
        performance.getEntriesByType
      ) {
        // Collect immediately if not using lazy loading
        const navigationTiming = performance.getEntriesByType('navigation')[0];
        if (navigationTiming && metadata.performance) {
          metadata.performance.navigation = {
            domContentLoaded: navigationTiming.domContentLoadedEventEnd,
            loadComplete: navigationTiming.loadEventEnd,
            responseTime:
              navigationTiming.responseEnd - navigationTiming.requestStart,
          };
        }
      }

      // Environment information
      if (typeof window !== 'undefined') {
        metadata.environment = {
          language: navigator.language,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
          doNotTrack: navigator.doNotTrack,
        };
      }
    }

    return metadata;
  }

  /**
   * Collect metadata synchronously
   *
   * @private
   * @param {any[]} originalArgs - Original log arguments
   * @returns {object} Collected metadata
   */
  #collectMetadataSync(originalArgs) {
    const metadata = {};

    // Always include original args if present, but sanitize them to reduce memory
    // retention by avoiding holding references to large objects
    if (originalArgs.length > 0) {
      metadata.originalArgs = this.#sanitizeArgs(originalArgs);
    }

    // Minimal level: only essential data
    if (this.#level === 'minimal') {
      if (typeof window !== 'undefined' && window.location) {
        metadata.url = window.location.href;
      }
      return metadata;
    }

    // Standard level: balanced metadata
    if (this.#level === 'standard' || this.#level === 'full') {
      // Browser metadata
      if (this.#enableBrowser && typeof window !== 'undefined') {
        metadata.browser = this.#collectBrowserMetadata();
      }

      // Performance metadata
      if (this.#enablePerformance && typeof performance !== 'undefined') {
        metadata.performance = this.#collectPerformanceMetadata();
      }
    }

    // Full level: comprehensive metadata (skip expensive async operations in sync mode)
    if (this.#level === 'full') {
      // Environment information
      if (typeof window !== 'undefined') {
        metadata.environment = {
          language: navigator.language,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
          doNotTrack: navigator.doNotTrack,
        };
      }
    }

    return metadata;
  }

  /**
   * Collect browser-specific metadata
   *
   * @private
   * @returns {BrowserMetadata} Browser metadata
   */
  #collectBrowserMetadata() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return undefined;
    }

    const browser = {
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Add viewport dimensions
    if (this.#level !== 'minimal') {
      browser.viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Add screen dimensions for full level
      if (this.#level === 'full' && typeof screen !== 'undefined') {
        browser.screen = {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth,
        };
      }
    }

    return browser;
  }

  /**
   * Collect performance metadata
   *
   * @private
   * @returns {PerformanceMetadata} Performance metadata
   */
  #collectPerformanceMetadata() {
    if (typeof performance === 'undefined') {
      return undefined;
    }

    const perf = {
      timing: performance.now(),
    };

    // Memory information (if available)
    if (performance.memory) {
      perf.memory = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
      };

      // Calculate memory usage percentage for full level
      if (this.#level === 'full') {
        perf.memory.usagePercent = (
          (performance.memory.usedJSHeapSize /
            performance.memory.jsHeapSizeLimit) *
          100
        ).toFixed(2);
      }
    }

    return perf;
  }

  /**
   * Detect source location from stack trace
   *
   * @param {number} [skipFrames] - Number of stack frames to skip
   * @returns {string|undefined} Source location as "file:line"
   */
  detectSource(skipFrames = 4) {
    try {
      const stack = new this.#ErrorConstructor().stack;
      if (!stack) return undefined;

      const lines = stack.split('\n');

      // Dynamic depth detection - skip internal frames
      for (let i = skipFrames; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !this.#isInternalFrame(line)) {
          const parsed = this.#parseStackLine(line);
          if (parsed) {
            return parsed;
          }
        }
      }
    } catch {
      // Ignore source detection errors
    }
    return undefined;
  }

  /**
   * Detect source category from stack trace
   *
   * @param {number} [skipFrames] - Number of stack frames to skip
   * @returns {string} Source category (defaults to 'general')
   */
  detectSourceCategory(skipFrames = 4) {
    try {
      const stack = new this.#ErrorConstructor().stack;
      if (!stack) return 'general';

      const lines = stack.split('\n');

      // Dynamic depth detection - skip internal frames
      for (let i = skipFrames; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !this.#isInternalFrame(line)) {
          // Try each browser pattern to extract full path
          for (const [, pattern] of this.#browserPatterns) {
            const match = line.match(pattern);
            if (match) {
              const fullPath = match[1];
              return this.#mapPathToCategory(fullPath);
            }
          }
        }
      }
    } catch {
      // Ignore source detection errors
    }
    return 'general';
  }

  /**
   * Check if a stack frame is internal to the logger
   *
   * @private
   * @param {string} line - Stack trace line
   * @returns {boolean} True if internal frame
   */
  #isInternalFrame(line) {
    const internalFiles = [
      'remoteLogger.js',
      'logMetadataEnricher.js',
      'logCategoryDetector.js',
      'consoleLogger.js',
      'loggerStrategy.js',
    ];

    return internalFiles.some((file) => line.includes(file));
  }

  /**
   * Parse a stack trace line to extract file and line number
   *
   * @private
   * @param {string} line - Stack trace line
   * @returns {string|undefined} Parsed source location
   */
  #parseStackLine(line) {
    // Try each browser pattern
    for (const [, pattern] of this.#browserPatterns) {
      const match = line.match(pattern);
      if (match) {
        const file = match[1];
        const lineNumber = match[2];

        // Extract just the filename from the path
        const fileName = file.split('/').pop().split('\\').pop();

        return `${fileName}:${lineNumber}`;
      }
    }

    return undefined;
  }



  /**
   * Map file path to logical category
   *
   * @private
   * @param {string} fullPath - Full file path
   * @returns {string} Category name
   */
  #mapPathToCategory(fullPath) {
    if (!fullPath) return 'general';

    // Normalize path separators
    const normalizedPath = fullPath.replace(/\\/g, '/');

    // Define category mappings - ordered by expected frequency for performance
    const categoryMappings = [
      // Most common directories first
      { pattern: /\/src\/actions\//, category: 'actions' },
      { pattern: /\/src\/logic\//, category: 'logic' },
      { pattern: /\/src\/entities\//, category: 'entities' },
      { pattern: /\/src\/domUI\//, category: 'domUI' },
      { pattern: /\/src\/events\//, category: 'events' },
      { pattern: /\/src\/scopeDsl\//, category: 'scopeDsl' },
      { pattern: /\/src\/engine\//, category: 'engine' },
      { pattern: /\/src\/ai\//, category: 'ai' },
      { pattern: /\/src\/loaders\//, category: 'loaders' },
      { pattern: /\/src\/logging\//, category: 'logging' },
      
      // Infrastructure and configuration
      { pattern: /\/src\/dependencyInjection\//, category: 'dependencyInjection' },
      { pattern: /\/src\/initializers\//, category: 'initializers' },
      { pattern: /\/src\/config\//, category: 'config' },
      { pattern: /\/src\/configuration\//, category: 'configuration' },
      { pattern: /\/src\/constants\//, category: 'constants' },
      
      // Service layer
      { pattern: /\/src\/services\//, category: 'services' },
      { pattern: /\/src\/utils\//, category: 'utils' },
      { pattern: /\/src\/storage\//, category: 'storage' },
      { pattern: /\/src\/persistence\//, category: 'persistence' },
      
      // Domain-specific
      { pattern: /\/src\/characterBuilder\//, category: 'characterBuilder' },
      { pattern: /\/src\/prompting\//, category: 'prompting' },
      { pattern: /\/src\/anatomy\//, category: 'anatomy' },
      { pattern: /\/src\/clothing\//, category: 'clothing' },
      { pattern: /\/src\/turns\//, category: 'turns' },
      { pattern: /\/src\/scheduling\//, category: 'scheduling' },
      
      // Error handling and types
      { pattern: /\/src\/errors\//, category: 'errors' },
      { pattern: /\/src\/types\//, category: 'types' },
      { pattern: /\/src\/interfaces\//, category: 'interfaces' },
      { pattern: /\/src\/validation\//, category: 'validation' },
      
      // Additional subsystems
      { pattern: /\/src\/alerting\//, category: 'alerting' },
      { pattern: /\/src\/context\//, category: 'context' },
      { pattern: /\/src\/adapters\//, category: 'adapters' },
      { pattern: /\/src\/query\//, category: 'query' },
      { pattern: /\/src\/input\//, category: 'input' },
      { pattern: /\/src\/testing\//, category: 'testing' },
      { pattern: /\/src\/modding\//, category: 'modding' },
      { pattern: /\/src\/data\//, category: 'data' },
      { pattern: /\/src\/shared\//, category: 'shared' },
      { pattern: /\/src\/bootstrapper\//, category: 'bootstrapper' },
      { pattern: /\/src\/commands\//, category: 'commands' },
      { pattern: /\/src\/models\//, category: 'models' },
      { pattern: /\/src\/llms\//, category: 'llms' },
      { pattern: /\/src\/pathing\//, category: 'pathing' },
      { pattern: /\/src\/formatting\//, category: 'formatting' },
      { pattern: /\/src\/ports\//, category: 'ports' },
      { pattern: /\/src\/shutdown\//, category: 'shutdown' },
      { pattern: /\/src\/common\//, category: 'common' },
      
      // Generator-specific directories
      { pattern: /\/src\/thematicDirection\//, category: 'thematicDirection' },
      { pattern: /\/src\/clichesGenerator\//, category: 'clichesGenerator' },
      { pattern: /\/src\/coreMotivationsGenerator\//, category: 'coreMotivationsGenerator' },
      { pattern: /\/src\/thematicDirectionsManager\//, category: 'thematicDirectionsManager' },
      
      // Test files
      { pattern: /\/tests\//, category: 'tests' },
      
      // LLM proxy server
      { pattern: /\/llm-proxy-server\//, category: 'llm-proxy' },
    ];

    // Check each pattern
    for (const { pattern, category } of categoryMappings) {
      if (pattern.test(normalizedPath)) {
        return category;
      }
    }

    // Default category for unmatched paths
    return 'general';
  }

  /**
   * Get current configuration
   *
   * @returns {object} Current configuration
   */
  getConfig() {
    return {
      level: this.#level,
      enableSource: this.#enableSource,
      enablePerformance: this.#enablePerformance,
      enableBrowser: this.#enableBrowser,
      lazyLoadExpensive: this.#lazyLoadExpensive,
    };
  }

  /**
   * Update configuration
   *
   * @param {EnricherConfig} config - New configuration
   */
  updateConfig(config) {
    if (config.level !== undefined) {
      this.#level = config.level;
    }
    if (config.enableSource !== undefined) {
      this.#enableSource = config.enableSource;
    }
    if (config.enablePerformance !== undefined) {
      this.#enablePerformance = config.enablePerformance;
    }
    if (config.enableBrowser !== undefined) {
      this.#enableBrowser = config.enableBrowser;
    }
    if (config.lazyLoadExpensive !== undefined) {
      this.#lazyLoadExpensive = config.lazyLoadExpensive;
    }
  }
}

export default LogMetadataEnricher;

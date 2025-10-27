/**
 * @file Graceful degradation system for mod validation
 * @description Provides fallback strategies and partial result generation when errors occur
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Degradation strategies
 * @enum {string}
 */
export const DegradationStrategy = {
  SKIP_FILE: 'SKIP_FILE',
  USE_CACHED: 'USE_CACHED',
  USE_DEFAULT: 'USE_DEFAULT',
  PARTIAL_EXTRACTION: 'PARTIAL_EXTRACTION',
  REDUCED_VALIDATION: 'REDUCED_VALIDATION',
  BASIC_PARSING: 'BASIC_PARSING',
  NO_DEGRADATION: 'NO_DEGRADATION'
};

/**
 * Manages graceful degradation for mod validation failures
 */
class GracefulDegradation {
  #logger;
  #degradationStrategies;
  #cache;
  #defaults;
  #degradationHistory;
  
  /**
   * Creates a new GracefulDegradation instance
   * 
   * @param {object} dependencies - Dependencies
   * @param {import('../utils/loggerUtils.js').ILogger} dependencies.logger - Logger instance
   * @param {object} [dependencies.cache] - Cache for previous results
   * @param {object} [dependencies.defaults] - Default values for different contexts
   */
  constructor({ logger, cache = new Map(), defaults = {} }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    
    this.#logger = logger;
    this.#cache = cache;
    this.#defaults = defaults;
    this.#degradationStrategies = new Map();
    this.#degradationHistory = [];
    
    // Register default strategies
    this.#registerDefaultStrategies();
  }
  
  /**
   * Registers a degradation strategy for a specific error type
   * 
   * @param {string} errorType - Type of error
   * @param {Function} strategy - Strategy function
   */
  registerStrategy(errorType, strategy) {
    this.#degradationStrategies.set(errorType, strategy);
    this.#logger.debug(`Registered degradation strategy for ${errorType}`);
  }
  
  /**
   * Applies degradation for an error
   * 
   * @param {Error} error - The error that occurred
   * @param {object} context - Error context
   * @returns {object} Degradation result with partial data
   */
  applyDegradation(error, context) {
    const errorType = this.#determineErrorType(error);
    const strategy = this.#selectStrategy(errorType, context);
    
    this.#logger.info(`Applying degradation strategy: ${strategy}`, {
      errorType,
      context: {
        file: context.filePath,
        mod: context.modId
      }
    });
    
    const result = this.#executeStrategy(strategy, error, context);
    
    // Record degradation event
    this.#recordDegradation(errorType, strategy, result.success);
    
    return result;
  }
  
  /**
   * Gets degradation statistics
   * 
   * @returns {object} Degradation statistics
   */
  getStatistics() {
    const stats = {
      totalDegradations: this.#degradationHistory.length,
      byStrategy: {},
      successRate: 0,
      recentDegradations: []
    };
    
    // Count by strategy
    let successes = 0;
    for (const record of this.#degradationHistory) {
      const strategy = record.strategy;
      if (!stats.byStrategy[strategy]) {
        stats.byStrategy[strategy] = {
          count: 0,
          successes: 0
        };
      }
      stats.byStrategy[strategy].count++;
      if (record.success) {
        stats.byStrategy[strategy].successes++;
        successes++;
      }
    }
    
    // Calculate success rate
    if (this.#degradationHistory.length > 0) {
      stats.successRate = (successes / this.#degradationHistory.length) * 100;
    }
    
    // Get recent degradations
    stats.recentDegradations = this.#degradationHistory.slice(-10).map(record => ({
      timestamp: record.timestamp,
      errorType: record.errorType,
      strategy: record.strategy,
      success: record.success
    }));
    
    return stats;
  }
  
  /**
   * Clears degradation cache and history
   */
  reset() {
    this.#cache.clear();
    this.#degradationHistory = [];
    this.#logger.debug('Graceful degradation reset');
  }
  
  /**
   * Gets or creates default value for a context
   * 
   * @param {string} contextType - Type of context (e.g., 'mod', 'component')
   * @param {object} context - Context details
   * @returns {any} Default value
   */
  getDefaultValue(contextType, context) {
    // Check if we have a specific default
    const key = `${contextType}.${context.id || context.name || 'default'}`;
    if (this.#defaults[key]) {
      return this.#defaults[key];
    }
    
    // Return generic defaults by type
    switch (contextType) {
      case 'mod':
        return {
          id: context.modId || 'unknown',
          references: new Map(),
          errors: [],
          partial: true
        };
        
      case 'component':
        return {
          id: context.componentId || 'unknown',
          data: {},
          partial: true
        };
        
      case 'references':
        return new Map();
        
      case 'validation':
        return {
          valid: false,
          errors: ['Degraded validation'],
          partial: true
        };
        
      default:
        return null;
    }
  }
  
  /**
   * Registers default degradation strategies
   * 
   * @private
   */
  #registerDefaultStrategies() {
    // File access errors - try cache or skip
    this.registerStrategy('ACCESS', (error, context) => {
      // Check cache first
      const cached = this.#checkCache(context);
      if (cached) {
        return {
          strategy: DegradationStrategy.USE_CACHED,
          data: cached,
          success: true
        };
      }
      
      // Skip the file
      return {
        strategy: DegradationStrategy.SKIP_FILE,
        data: null,
        success: true,
        message: 'File skipped due to access error'
      };
    });
    
    // Corruption errors - try partial extraction
    this.registerStrategy('CORRUPTION', (error, context) => {
      if (context.partialData) {
        return {
          strategy: DegradationStrategy.PARTIAL_EXTRACTION,
          data: context.partialData,
          success: true,
          partial: true
        };
      }

      // Try basic parsing
      return this.#executeStrategy(DegradationStrategy.BASIC_PARSING, error, context);
    });
    
    // Timeout errors - use reduced validation
    this.registerStrategy('TIMEOUT', (error, context) => {
      return {
        strategy: DegradationStrategy.REDUCED_VALIDATION,
        data: this.#performReducedValidation(context),
        success: true,
        reduced: true
      };
    });
    
    // Security errors - no degradation allowed
    this.registerStrategy('SECURITY', (error, context) => {
      return {
        strategy: DegradationStrategy.NO_DEGRADATION,
        data: null,
        success: false,
        blocked: true,
        message: 'Security violation - no degradation allowed'
      };
    });
  }
  
  /**
   * Determines error type from error object
   * 
   * @private
   * @param {Error} error - Error to analyze
   * @returns {string} Error type
   */
  #determineErrorType(error) {
    if (error.code) {
      return error.code;
    }
    
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('enoent') || message.includes('not found')) {
      return 'ACCESS';
    }
    if (message.includes('corruption') || message.includes('malformed')) {
      return 'CORRUPTION';
    }
    if (message.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (message.includes('security') || message.includes('violation')) {
      return 'SECURITY';
    }
    
    return 'UNKNOWN';
  }
  
  /**
   * Selects appropriate degradation strategy
   * 
   * @private
   * @param {string} errorType - Type of error
   * @param {object} context - Error context
   * @returns {string} Selected strategy
   */
  #selectStrategy(errorType, context) {
    if (context?.forceNoDegradation) {
      return DegradationStrategy.NO_DEGRADATION;
    }

    // Check if we have a registered strategy for this error type
    if (this.#degradationStrategies.has(errorType)) {
      return errorType;
    }
    
    // Check context hints
    if (context.allowSkip) {
      return DegradationStrategy.SKIP_FILE;
    }
    if (context.hasCache) {
      return DegradationStrategy.USE_CACHED;
    }
    if (context.hasDefault) {
      return DegradationStrategy.USE_DEFAULT;
    }
    
    // Default strategies by error type
    switch (errorType) {
      case 'ACCESS':
        return DegradationStrategy.SKIP_FILE;
      case 'CORRUPTION':
        return DegradationStrategy.PARTIAL_EXTRACTION;
      case 'TIMEOUT':
        return DegradationStrategy.REDUCED_VALIDATION;
      default:
        return DegradationStrategy.USE_DEFAULT;
    }
  }
  
  /**
   * Executes a degradation strategy
   * 
   * @private
   * @param {string} strategy - Strategy to execute
   * @param {Error} error - Original error
   * @param {object} context - Error context
   * @returns {object} Strategy result
   */
  #executeStrategy(strategy, error, context) {
    // Check for custom strategy handler
    if (this.#degradationStrategies.has(strategy)) {
      const handler = this.#degradationStrategies.get(strategy);
      return handler(error, context);
    }
    
    // Execute built-in strategies
    switch (strategy) {
      case DegradationStrategy.SKIP_FILE:
        return {
          strategy,
          data: null,
          success: true,
          skipped: true,
          message: `Skipped file: ${context.filePath}`
        };
        
      case DegradationStrategy.USE_CACHED:
        const cached = this.#checkCache(context);
        return {
          strategy,
          data: cached,
          success: !!cached,
          fromCache: true
        };
        
      case DegradationStrategy.USE_DEFAULT:
        const defaultValue = this.getDefaultValue(context.type || 'unknown', context);
        return {
          strategy,
          data: defaultValue,
          success: true,
          isDefault: true
        };
        
      case DegradationStrategy.PARTIAL_EXTRACTION:
        return {
          strategy,
          data: context.partialData || {},
          success: true,
          partial: true
        };
        
      case DegradationStrategy.REDUCED_VALIDATION:
        return {
          strategy,
          data: this.#performReducedValidation(context),
          success: true,
          reduced: true
        };
        
      case DegradationStrategy.BASIC_PARSING:
        return {
          strategy,
          data: this.#attemptBasicParsing(context),
          success: true,
          basic: true,
          partial: true
        };

      default:
        return {
          strategy: DegradationStrategy.NO_DEGRADATION,
          data: null,
          success: false,
          message: 'No degradation available'
        };
    }
  }
  
  /**
   * Checks cache for previous results
   * 
   * @private
   * @param {object} context - Context to check
   * @returns {any} Cached data or null
   */
  #checkCache(context) {
    const cacheKey = context.cacheKey || 
                     context.filePath || 
                     `${context.modId}:${context.componentId}`;
    
    if (this.#cache.has(cacheKey)) {
      this.#logger.debug(`Cache hit for ${cacheKey}`);
      return this.#cache.get(cacheKey);
    }
    
    return null;
  }
  
  /**
   * Attempts basic parsing of data
   * 
   * @private
   * @param {object} context - Context with data
   * @returns {object} Parsed data
   */
  #attemptBasicParsing(context) {
    const result = {
      partial: true,
      basicParse: true
    };
    
    // Try to extract basic information
    if (context.rawData) {
      try {
        // Attempt to extract IDs using regex
        const idMatch = context.rawData.match(/"id"\s*:\s*"([^"]+)"/);
        if (idMatch) {
          result.id = idMatch[1];
        }
        
        // Extract references
        const refPattern = /([a-zA-Z][a-zA-Z0-9_-]*):([a-zA-Z][a-zA-Z0-9_-]*)/g;
        const references = new Set();
        let match;
        while ((match = refPattern.exec(context.rawData)) !== null) {
          references.add(`${match[1]}:${match[2]}`);
        }
        
        if (references.size > 0) {
          result.references = Array.from(references);
        }
      } catch (parseError) {
        this.#logger.debug(`Basic parsing failed: ${parseError.message}`);
      }
    }
    
    return result;
  }
  
  /**
   * Performs reduced validation
   * 
   * @private
   * @param {object} context - Validation context
   * @returns {object} Reduced validation result
   */
  #performReducedValidation(context) {
    return {
      valid: 'unknown',
      reduced: true,
      checks: {
        syntax: 'skipped',
        references: 'skipped',
        schema: 'skipped'
      },
      message: 'Reduced validation due to resource constraints'
    };
  }
  
  /**
   * Records degradation event
   * 
   * @private
   * @param {string} errorType - Type of error
   * @param {string} strategy - Strategy applied
   * @param {boolean} success - Whether degradation succeeded
   */
  #recordDegradation(errorType, strategy, success) {
    const record = {
      timestamp: new Date().toISOString(),
      errorType,
      strategy,
      success
    };
    
    this.#degradationHistory.push(record);
    
    // Limit history size
    if (this.#degradationHistory.length > 500) {
      this.#degradationHistory.shift();
    }
  }
}

export { GracefulDegradation };
export default GracefulDegradation;
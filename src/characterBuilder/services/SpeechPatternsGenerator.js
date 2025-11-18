/**
 * @file Service for generating speech patterns via LLM
 * @description Main service for speech patterns generation following established pattern
 * @see CharacterBuilderService.js
 * @see CoreMotivationsGenerator.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  buildSpeechPatternsGenerationPrompt,
  SPEECH_PATTERNS_RESPONSE_SCHEMA,
  SPEECH_PATTERNS_LLM_PARAMS,
  PROMPT_VERSION_INFO,
} from '../prompts/speechPatternsPrompts.js';
import {
  SpeechPatternsGenerationError,
  SpeechPatternsResponseProcessingError,
  SpeechPatternsValidationError,
} from '../errors/SpeechPatternsGenerationError.js';
import { SpeechPatternsResponseProcessor } from './SpeechPatternsResponseProcessor.js';
import { CHARACTER_BUILDER_EVENTS } from './characterBuilderService.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../llms/llmJsonService.js').LlmJsonService} LlmJsonService
 * @typedef {import('../../turns/adapters/configurableLLMAdapter.js').ConfigurableLLMAdapter} ConfigurableLLMAdapter
 * @typedef {import('../../llms/interfaces/ILLMConfigurationManager.js').ILLMConfigurationManager} ILLMConfigurationManager
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../llms/interfaces/ITokenEstimator.js').ITokenEstimator} ITokenEstimator
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 */

/**
 * @typedef {object} SpeechPatternsGenerationResult
 * @property {string} characterName - Character name
 * @property {Array<object>} speechPatterns - Generated speech patterns
 * @property {string} generatedAt - Generation timestamp
 * @property {object} metadata - Generation metadata
 */

/**
 * Retry configuration for LLM requests
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  jitterFactor: 0.3, // 30% jitter to prevent thundering herd
};

/**
 * Circuit breaker configuration for preventing cascading failures
 */
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5, // Number of failures before opening circuit
  resetTimeout: 60000, // 1 minute before attempting to close circuit
  monitoringWindow: 300000, // 5 minutes monitoring window
};

/**
 * Service for generating character speech patterns via LLM
 * Following the established three-service pattern used by other character builder services
 */
export class SpeechPatternsGenerator {
  #logger;
  // eslint-disable-next-line no-unused-private-class-members
  #_llmJsonService;
  #llmStrategyFactory;
  #llmConfigManager;
  #eventBus;
  #tokenEstimator;
  #responseProcessor;

  // Circuit breaker state
  #circuitBreakerState = 'closed'; // 'closed', 'open', 'half-open'
  #consecutiveFailures = 0;
  #lastFailureTime = null;
  #circuitResetTimer = null;

  // Request deduplication and caching
  #requestCache = new Map(); // LRU cache for responses
  #pendingRequests = new Map(); // Track in-flight requests
  #cacheMaxSize = 10;
  #cacheTTL = 300000; // 5 minutes

  /**
   * Create a new SpeechPatternsGenerator instance
   *
   * @param {object} dependencies - Service dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {LlmJsonService} dependencies.llmJsonService - LLM JSON processing service
   * @param {ConfigurableLLMAdapter} dependencies.llmStrategyFactory - LLM adapter (provides strategy factory functionality)
   * @param {ILLMConfigurationManager} dependencies.llmConfigManager - LLM configuration manager
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for dispatching events
   * @param {ITokenEstimator} [dependencies.tokenEstimator] - Token estimation service (optional)
   * @param {ISchemaValidator} [dependencies.schemaValidator] - Schema validation service (optional)
   */
  constructor({
    logger,
    llmJsonService,
    llmStrategyFactory,
    llmConfigManager,
    eventBus,
    tokenEstimator,
    schemaValidator,
  }) {
    validateDependency(logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(llmJsonService, 'LlmJsonService', null, {
      requiredMethods: ['clean', 'parseAndRepair'],
    });
    validateDependency(llmStrategyFactory, 'ConfigurableLLMAdapter', null, {
      requiredMethods: ['getAIDecision'],
    });
    validateDependency(llmConfigManager, 'ILLMConfigurationManager', null, {
      requiredMethods: [
        'loadConfiguration',
        'getActiveConfiguration',
        'setActiveConfiguration',
      ],
    });
    validateDependency(eventBus, 'ISafeEventDispatcher', null, {
      requiredMethods: ['dispatch'],
    });

    // Optional dependencies
    if (tokenEstimator) {
      validateDependency(tokenEstimator, 'ITokenEstimator', null, {
        requiredMethods: ['estimateTokens'],
      });
    }

    if (schemaValidator) {
      validateDependency(schemaValidator, 'ISchemaValidator', null, {
        requiredMethods: ['validateAgainstSchema'],
      });
    }

    this.#logger = logger;
    this.#_llmJsonService = llmJsonService;
    this.#llmStrategyFactory = llmStrategyFactory;
    this.#llmConfigManager = llmConfigManager;
    this.#eventBus = eventBus;
    this.#tokenEstimator = tokenEstimator;

    // Create response processor
    this.#responseProcessor = new SpeechPatternsResponseProcessor({
      logger,
      llmJsonService,
      schemaValidator,
    });

    this.#logger.debug('SpeechPatternsGenerator initialized', {
      promptVersion: PROMPT_VERSION_INFO.version,
    });
  }

  /**
   * Generate speech patterns using established LLM integration pattern
   *
   * @param {object} characterData - Character definition data
   * @param {object} options - Generation options
   * @param {string} [options.llmConfigId] - Specific LLM configuration ID
   * @param {string} [options.focusType] - Focus area (EMOTIONAL_FOCUS, SOCIAL_FOCUS, etc.)
   * @param {number} [options.patternCount] - Number of patterns to generate
   * @param {AbortSignal} [options.abortSignal] - Abort signal for cancellation
   * @returns {Promise<SpeechPatternsGenerationResult>} Generated speech patterns
   */
  async generateSpeechPatterns(characterData, options = {}) {
    const startTime = Date.now();

    // Generate cache key for deduplication
    const cacheKey = this.#generateCacheKey(characterData, options);

    // Check cache first
    const cachedResponse = this.#getCachedResponse(cacheKey);
    if (cachedResponse) {
      this.#logger.info('SpeechPatternsGenerator: Returning cached response', {
        cacheKey,
        age: Date.now() - cachedResponse.timestamp,
      });

      // Dispatch cached event
      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_CACHE_HIT,
        {
          cacheKey,
          timestamp: new Date().toISOString(),
        }
      );

      return cachedResponse.data;
    }

    // Check if there's already a pending request for the same data
    if (this.#pendingRequests.has(cacheKey)) {
      this.#logger.info('SpeechPatternsGenerator: Deduplicating request', {
        cacheKey,
      });

      // Return the existing promise
      return this.#pendingRequests.get(cacheKey);
    }

    // Create a new promise for this request
    const requestPromise = this.#executeGeneration(
      characterData,
      options,
      cacheKey,
      startTime
    );

    // Store as pending request
    this.#pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;

      // Cache the successful result
      this.#setCachedResponse(cacheKey, result);

      return result;
    } finally {
      // Clean up pending request
      this.#pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Execute the actual generation logic
   *
   * @private
   * @param {object} characterData - Character data
   * @param {object} options - Options
   * @param {string} cacheKey - Cache key
   * @param {number} startTime - Start timestamp
   * @returns {Promise<object>} Generation result
   */
  async #executeGeneration(characterData, options, cacheKey, startTime) {
    try {
      this.#logger.info('SpeechPatternsGenerator: Starting generation', {
        characterDataSize: JSON.stringify(characterData).length,
        focusType: options.focusType,
        patternCount: options.patternCount,
      });

      // Dispatch start event
      this.#logger.debug(
        'Dispatching speech patterns generation started event'
      );
      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_STARTED,
        {
          characterData: characterData,
          options: options,
          timestamp: new Date().toISOString(),
        }
      );

      // Validate input
      this.#validateCharacterData(characterData);

      // Build prompt
      const prompt = this.#buildPrompt(characterData, options);

      // Estimate tokens if service available
      if (this.#tokenEstimator) {
        const estimatedTokens = this.#tokenEstimator.estimateTokens(prompt);
        this.#logger.debug('Prompt token estimation', { estimatedTokens });
      }

      // Call LLM
      const rawResponse = await this.#callLLM(prompt, options);

      // Process response
      const parsedResponse = await this.#parseResponse(rawResponse, {
        characterName: this.#extractCharacterName(characterData),
      });

      // Validate and enhance
      const result = this.#validateAndEnhance(parsedResponse, options);

      // Dispatch success event
      this.#logger.debug(
        'Dispatching speech patterns generation completed event'
      );
      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_COMPLETED,
        {
          result: result,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }
      );

      this.#logger.info(
        'SpeechPatternsGenerator: Successfully generated speech patterns',
        {
          patternCount: result.speechPatterns.length,
          processingTime: Date.now() - startTime,
          characterName: result.characterName,
        }
      );

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.#logger.error('SpeechPatternsGenerator: Generation failed', {
        error: error.message,
        processingTime,
      });

      // Dispatch error event
      this.#logger.debug('Dispatching speech patterns generation failed event');
      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_FAILED,
        {
          error: error.message,
          processingTime,
          timestamp: new Date().toISOString(),
        }
      );

      if (error instanceof SpeechPatternsGenerationError) {
        throw error;
      }

      throw new SpeechPatternsGenerationError(
        `Failed to generate speech patterns: ${error.message}`,
        error
      );
    }
  }

  /**
   * Validate character data input
   *
   * @private
   * @param {object} characterData - Character data to validate
   */
  #validateCharacterData(characterData) {
    if (!characterData || typeof characterData !== 'object') {
      throw new SpeechPatternsValidationError(
        'Character data is required and must be an object'
      );
    }

    // Check for basic character components
    // Handle both direct character data format and nested components structure
    let hasCharacterComponents = false;

    // Check if character data has colon-separated keys at top level (direct format)
    hasCharacterComponents = Object.keys(characterData).some((key) =>
      key.includes(':')
    );

    // If not found at top level, check for nested components structure (character definition format)
    if (
      !hasCharacterComponents &&
      characterData.components &&
      typeof characterData.components === 'object'
    ) {
      hasCharacterComponents = Object.keys(characterData.components).some(
        (key) => key.includes(':')
      );
    }

    if (!hasCharacterComponents) {
      throw new SpeechPatternsValidationError(
        'Character data must contain at least one character component (format: "component:field"). ' +
          'Expected either direct component data or nested under "components" key.'
      );
    }

    // Check for reasonable content depth
    const contentLength = JSON.stringify(characterData).length;
    if (contentLength < 50) {
      throw new SpeechPatternsValidationError(
        'Character data appears insufficient for speech pattern generation'
      );
    }
  }

  /**
   * Build LLM prompt using prompt service
   *
   * @private
   * @param {object} characterData - Character data
   * @param {object} options - Generation options
   * @returns {string} Built prompt
   */
  #buildPrompt(characterData, options) {
    try {
      return buildSpeechPatternsGenerationPrompt(characterData, options);
    } catch (error) {
      throw new SpeechPatternsGenerationError(
        `Failed to build prompt: ${error.message}`,
        error
      );
    }
  }

  /**
   * Call LLM service with prepared prompt
   *
   * @private
   * @param {string} prompt - Prepared prompt
   * @param {object} options - Generation options
   * @returns {Promise<string>} LLM response
   */
  async #callLLM(prompt, options) {
    // Check circuit breaker state
    if (this.#circuitBreakerState === 'open') {
      if (this.#shouldAttemptReset()) {
        this.#circuitBreakerState = 'half-open';
        this.#logger.info(
          'Circuit breaker entering half-open state, attempting reset'
        );
      } else {
        throw new SpeechPatternsGenerationError(
          'Service temporarily unavailable due to repeated failures. Please try again later.',
          { circuitBreakerOpen: true }
        );
      }
    }

    // Retry configuration
    const retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...(options.retryConfig || {}),
    };
    let lastError = null;

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Check if operation was aborted
        if (options.abortSignal?.aborted) {
          throw new Error('Operation aborted');
        }

        // Set active configuration if specified
        if (options.llmConfigId) {
          await this.#llmConfigManager.setActiveConfiguration(
            options.llmConfigId
          );
        }

        const requestOptions = {
          toolSchema: SPEECH_PATTERNS_RESPONSE_SCHEMA,
          toolName: 'generate_speech_patterns',
          toolDescription: 'Generate speech patterns for character development',
          ...SPEECH_PATTERNS_LLM_PARAMS,
        };

        this.#logger.debug('Calling LLM for speech patterns generation', {
          promptLength: prompt.length,
          requestOptions,
          attempt,
          maxRetries: retryConfig.maxRetries,
        });

        const response = await this.#llmStrategyFactory.getAIDecision(
          prompt,
          options.abortSignal || null,
          requestOptions
        );

        // Success - reset circuit breaker
        this.#onSuccess();

        return response;
      } catch (error) {
        lastError = error;

        // Record failure for circuit breaker
        this.#onFailure();

        // Check if error is retryable
        if (
          !this.#isRetryableError(error) ||
          attempt >= retryConfig.maxRetries
        ) {
          this.#logger.error(`LLM request failed after ${attempt} attempts`, {
            error: error.message,
            attempt,
            isRetryable: this.#isRetryableError(error),
          });

          throw new SpeechPatternsGenerationError(
            `LLM request failed after ${attempt} attempts: ${error.message}`,
            error
          );
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.#calculateRetryDelay(attempt, retryConfig);

        this.#logger.warn(`LLM request failed, retrying in ${delay}ms`, {
          error: error.message,
          attempt,
          nextAttempt: attempt + 1,
          delay,
        });

        // Dispatch retry event
        this.#eventBus.dispatch(
          CHARACTER_BUILDER_EVENTS.SPEECH_PATTERNS_GENERATION_RETRY,
          {
            attempt,
            maxRetries: retryConfig.maxRetries,
            delay,
            error: error.message,
            timestamp: new Date().toISOString(),
          }
        );

        // Wait before retry (unless aborted)
        await this.#delay(delay, options.abortSignal);
      }
    }

    // Should not reach here, but handle edge case
    throw new SpeechPatternsGenerationError(
      `LLM request failed after ${retryConfig.maxRetries} attempts`,
      lastError
    );
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   *
   * @private
   * @param {number} attempt - Current attempt number
   * @param {object} config - Retry configuration
   * @returns {number} Delay in milliseconds
   */
  #calculateRetryDelay(attempt, config) {
    const exponentialDelay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * config.jitterFactor * exponentialDelay;

    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Delay for specified milliseconds with abort support
   *
   * @private
   * @param {number} ms - Milliseconds to delay
   * @param {AbortSignal} [abortSignal] - Optional abort signal
   * @returns {Promise<void>}
   */
  async #delay(ms, abortSignal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);

      if (abortSignal) {
        const abortHandler = () => {
          clearTimeout(timer);
          reject(new Error('Delay aborted'));
        };

        if (abortSignal.aborted) {
          abortHandler();
        } else {
          abortSignal.addEventListener('abort', abortHandler, { once: true });
        }
      }
    });
  }

  /**
   * Check if error is retryable
   *
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean}
   */
  #isRetryableError(error) {
    // Don't retry on abort
    if (error.name === 'AbortError' || error.message === 'Operation aborted') {
      return false;
    }

    // Don't retry validation errors
    if (error instanceof SpeechPatternsValidationError) {
      return false;
    }

    // Don't retry if circuit breaker is open
    if (error.circuitBreakerOpen) {
      return false;
    }

    // Retry on network errors, timeouts, and temporary failures
    const retryableMessages = [
      'timeout',
      'network',
      'ECONNRESET',
      'ETIMEDOUT',
      'unavailable',
      'rate limit',
      '429', // Too Many Requests
      '502', // Bad Gateway
      '503', // Service Unavailable
      '504', // Gateway Timeout
    ];

    return retryableMessages.some((msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }

  /**
   * Handle successful request for circuit breaker
   *
   * @private
   */
  #onSuccess() {
    if (this.#circuitBreakerState === 'half-open') {
      this.#logger.info('Circuit breaker reset to closed state');
    }

    this.#circuitBreakerState = 'closed';
    this.#consecutiveFailures = 0;
    this.#lastFailureTime = null;

    if (this.#circuitResetTimer) {
      clearTimeout(this.#circuitResetTimer);
      this.#circuitResetTimer = null;
    }
  }

  /**
   * Handle failed request for circuit breaker
   *
   * @private
   */
  #onFailure() {
    this.#consecutiveFailures++;
    this.#lastFailureTime = Date.now();

    if (this.#consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      if (this.#circuitBreakerState !== 'open') {
        this.#circuitBreakerState = 'open';
        this.#logger.error('Circuit breaker opened due to repeated failures', {
          consecutiveFailures: this.#consecutiveFailures,
          threshold: CIRCUIT_BREAKER_CONFIG.failureThreshold,
        });

        // Dispatch circuit breaker event
        this.#eventBus.dispatch(
          CHARACTER_BUILDER_EVENTS.CIRCUIT_BREAKER_OPENED,
          {
            service: 'SpeechPatternsGenerator',
            consecutiveFailures: this.#consecutiveFailures,
            resetTimeout: CIRCUIT_BREAKER_CONFIG.resetTimeout,
            timestamp: new Date().toISOString(),
          }
        );

        // Schedule automatic reset attempt
        this.#scheduleCircuitReset();
      }
    }
  }

  /**
   * Check if circuit should attempt reset
   *
   * @private
   * @returns {boolean}
   */
  #shouldAttemptReset() {
    const timeSinceLastFailure = Date.now() - this.#lastFailureTime;
    return timeSinceLastFailure >= CIRCUIT_BREAKER_CONFIG.resetTimeout;
  }

  /**
   * Schedule automatic circuit breaker reset
   *
   * @private
   */
  #scheduleCircuitReset() {
    this.#circuitResetTimer = setTimeout(() => {
      this.#logger.info('Attempting automatic circuit breaker reset');
      this.#circuitBreakerState = 'half-open';
      this.#circuitResetTimer = null;
    }, CIRCUIT_BREAKER_CONFIG.resetTimeout);
  }

  /**
   * Generate cache key for request deduplication
   *
   * @private
   * @param {object} characterData - Character data
   * @param {object} options - Options
   * @returns {string} Cache key
   */
  #generateCacheKey(characterData, options) {
    // Create a deterministic key from character data and options
    const keyData = {
      characterData: JSON.stringify(characterData),
      focusType: options.focusType,
      patternCount: options.patternCount,
      llmConfigId: options.llmConfigId,
    };

    // Simple hash function for key generation
    const str = JSON.stringify(keyData);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `speech_patterns_${hash}`;
  }

  /**
   * Get cached response if available and not expired
   *
   * @private
   * @param {string} cacheKey - Cache key
   * @returns {object|null} Cached response or null
   */
  #getCachedResponse(cacheKey) {
    const cached = this.#requestCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.#cacheTTL) {
      this.#requestCache.delete(cacheKey);
      return null;
    }

    // Move to end (LRU)
    this.#requestCache.delete(cacheKey);
    this.#requestCache.set(cacheKey, cached);

    return cached;
  }

  /**
   * Set cached response with LRU eviction
   *
   * @private
   * @param {string} cacheKey - Cache key
   * @param {object} data - Data to cache
   */
  #setCachedResponse(cacheKey, data) {
    // Implement LRU eviction
    if (this.#requestCache.size >= this.#cacheMaxSize) {
      // Delete oldest entry (first in Map)
      const firstKey = this.#requestCache.keys().next().value;
      this.#requestCache.delete(firstKey);

      this.#logger.debug('Cache eviction', {
        evictedKey: firstKey,
        reason: 'cache size limit',
      });
    }

    this.#requestCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    this.#logger.debug('Response cached', {
      cacheKey,
      cacheSize: this.#requestCache.size,
    });
  }

  /**
   * Clear cache (useful for memory management)
   *
   * @public
   */
  clearCache() {
    const size = this.#requestCache.size;
    this.#requestCache.clear();
    this.#logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   *
   * @public
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.#requestCache.entries());
    const now = Date.now();

    return {
      size: this.#requestCache.size,
      maxSize: this.#cacheMaxSize,
      ttl: this.#cacheTTL,
      entries: entries.map(([key, value]) => ({
        key,
        age: now - value.timestamp,
        expired: now - value.timestamp > this.#cacheTTL,
      })),
    };
  }

  /**
   * Parse LLM response using response processor
   *
   * @private
   * @param {string} rawResponse - Raw LLM response
   * @param {object} context - Generation context
   * @returns {Promise<object>} Parsed response
   */
  async #parseResponse(rawResponse, context) {
    try {
      return await this.#responseProcessor.processResponse(
        rawResponse,
        context
      );
    } catch (error) {
      throw new SpeechPatternsResponseProcessingError(
        `Failed to parse LLM response: ${error.message}`,
        error
      );
    }
  }

  /**
   * Validate and enhance final response
   *
   * @private
   * @param {object} parsedResponse - Parsed response
   * @param {object} options - Generation options
   * @returns {object} Validated and enhanced result
   */
  #validateAndEnhance(parsedResponse, options) {
    try {
      // Additional business logic validation
      this.#validateBusinessRules(parsedResponse, options);

      // Enhance with additional metadata
      return {
        ...parsedResponse,
        metadata: {
          ...parsedResponse.metadata,
          generatorVersion: PROMPT_VERSION_INFO.version,
          generationOptions: options,
          qualityScore: this.#calculateQualityScore(parsedResponse),
        },
      };
    } catch (error) {
      throw new SpeechPatternsValidationError(
        `Response validation failed: ${error.message}`,
        [],
        error
      );
    }
  }

  /**
   * Validate business rules for generated patterns
   *
   * @private
   * @param {object} response - Parsed response
   * @param {object} options - Generation options
   */
  #validateBusinessRules(response, options) {
    const patterns = response.speechPatterns;

    // Check minimum pattern count
    const minPatterns = options.patternCount
      ? Math.max(3, Math.floor(options.patternCount * 0.7))
      : 3;
    if (patterns.length < minPatterns) {
      throw new Error(
        `Insufficient patterns generated: ${patterns.length} < ${minPatterns}`
      );
    }

    // Check for duplicate patterns
    const uniquePatterns = new Set(
      patterns.map((p) => p.pattern.toLowerCase())
    );
    if (uniquePatterns.size < patterns.length * 0.8) {
      throw new Error('Too many similar patterns detected');
    }

    // Check pattern quality
    const lowQualityPatterns = patterns.filter(
      (p) => p.pattern.length < 5 || p.example.length < 3
    );
    if (lowQualityPatterns.length > patterns.length * 0.2) {
      throw new Error('Too many low-quality patterns detected');
    }
  }

  /**
   * Calculate quality score for generated patterns
   *
   * @private
   * @param {object} response - Parsed response
   * @returns {number} Quality score (0-1)
   */
  #calculateQualityScore(response) {
    const patterns = response.speechPatterns;
    let score = 0;

    // Pattern count score (25%)
    const countScore = Math.min(patterns.length / 20, 1) * 0.25;
    score += countScore;

    // Pattern quality score (50%)
    const avgPatternLength =
      patterns.reduce((sum, p) => sum + p.pattern.length, 0) / patterns.length;
    const avgExampleLength =
      patterns.reduce((sum, p) => sum + p.example.length, 0) / patterns.length;
    const qualityScore =
      ((avgPatternLength / 50 + avgExampleLength / 30) / 2) * 0.5;
    score += Math.min(qualityScore, 0.5);

    // Diversity score (15%)
    const uniqueFirstWords = new Set(
      patterns.map((p) => p.pattern.split(' ')[0].toLowerCase())
    );
    const diversityScore = (uniqueFirstWords.size / patterns.length) * 0.15;
    score += diversityScore;

    // Circumstances coverage score (10%)
    const patternsWithCircumstances = patterns.filter(
      (p) => p.circumstances && p.circumstances.trim()
    );
    const circumstancesScore =
      (patternsWithCircumstances.length / patterns.length) * 0.1;
    score += circumstancesScore;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Extract character name from character data
   *
   * @private
   * @param {object} characterData - Character data
   * @returns {string} Character name
   */
  #extractCharacterName(characterData) {
    // Handle nested components structure (character definition format)
    if (
      characterData.components &&
      typeof characterData.components === 'object'
    ) {
      const nameComponent = characterData.components['core:name'];
      if (nameComponent) {
        // Check for both .text and .name fields
        if (nameComponent.text) {
          return nameComponent.text;
        }
        if (nameComponent.name) {
          return nameComponent.name;
        }
      }

      // Try other possible name fields in components
      for (const [key, value] of Object.entries(characterData.components)) {
        if (key.includes('name') && value && typeof value === 'object') {
          if (value.text) {
            return value.text;
          }
          if (value.name) {
            return value.name;
          }
        }
      }
    }

    // Try to find name in direct format (legacy support)
    const nameComponent = characterData['core:name'];
    if (nameComponent) {
      if (nameComponent.text) {
        return nameComponent.text;
      }
      if (nameComponent.name) {
        return nameComponent.name;
      }
    }

    // Try other possible name fields in direct format
    for (const [key, value] of Object.entries(characterData)) {
      if (key.includes('name') && value && typeof value === 'object') {
        if (value.text) {
          return value.text;
        }
        if (value.name) {
          return value.name;
        }
      }
    }

    return 'Character';
  }

  /**
   * Get service information and capabilities
   *
   * @returns {object} Service info
   */
  getServiceInfo() {
    return {
      name: 'SpeechPatternsGenerator',
      version: PROMPT_VERSION_INFO.version,
      capabilities: [
        'NC-21 content generation',
        'Multiple focus types',
        'Flexible pattern counts',
        'Quality scoring',
        'Response validation',
      ],
      supportedFocusTypes: [
        'EMOTIONAL_FOCUS',
        'SOCIAL_FOCUS',
        'PSYCHOLOGICAL_FOCUS',
        'RELATIONSHIP_FOCUS',
      ],
      llmParameters: SPEECH_PATTERNS_LLM_PARAMS,
    };
  }
}

export default SpeechPatternsGenerator;

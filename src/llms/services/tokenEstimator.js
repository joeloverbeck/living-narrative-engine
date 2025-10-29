/**
 * @file Token estimation service implementation
 * @see src/llms/services/tokenEstimator.js
 */

import { ITokenEstimator } from '../interfaces/ITokenEstimator.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { encode as cl100kEncode } from 'gpt-tokenizer';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ITokenEstimator.js').TokenBudget} TokenBudget
 * @typedef {import('../interfaces/ITokenEstimator.js').TokenValidationResult} TokenValidationResult
 */

/**
 * Model to encoding mapping
 *
 * @type {Record<string, string>}
 */
const MODEL_TO_ENCODING = {
  'gpt-3.5-turbo': 'cl100k_base',
  'gpt-4': 'cl100k_base',
  'gpt-4o': 'cl100k_base',
  'gpt-4o-mini': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'claude-3-opus': 'cl100k_base',
  'claude-3-sonnet': 'cl100k_base',
  'claude-3-haiku': 'cl100k_base',
  'claude-2.1': 'cl100k_base',
  'claude-2': 'cl100k_base',
  // Old completions / embeddings
  'text-davinci-003': 'p50k_base',
  'code-davinci-002': 'p50k_base',
  'text-curie-001': 'r50k_base',
  'text-embedding-ada-002': 'cl100k_base',
};

/**
 * @class TokenEstimator
 * @implements {ITokenEstimator}
 * @description Estimates and validates token counts for LLM prompts
 */
export class TokenEstimator extends ITokenEstimator {
  #logger;
  #encoderCache = new Map();
  #encoderLoader;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {function(string): Promise<Function>|function(string): Function} [dependencies.encoderLoader] - Optional encoder loader
   */
  constructor({ logger, encoderLoader } = {}) {
    super();
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    if (encoderLoader && typeof encoderLoader !== 'function') {
      throw new Error('TokenEstimator: encoderLoader must be a function');
    }
    this.#logger = logger;
    this.#encoderLoader = encoderLoader
      ? async (encodingName) => encoderLoader(encodingName)
      : this.#getEncoder.bind(this);
    this.#logger.debug('TokenEstimator: Instance created.');
  }

  /**
   * @async
   * @param {string} text
   * @param {string} [model]
   * @returns {Promise<number>}
   */
  async estimateTokens(text, model = 'gpt-3.5-turbo') {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    try {
      const encodingName = this.getEncodingForModel(model);
      const encodeFn = await this.#encoderLoader(encodingName);
      const tokens = encodeFn(text).length;

      this.#logger.debug('TokenEstimator: Estimated tokens', {
        model,
        encoding: encodingName,
        textLength: text.length,
        tokenCount: tokens,
      });

      return tokens;
    } catch (err) {
      this.#logger.warn(
        `TokenEstimator: Tokenization failed for model '${model}': ${err.message}. Using fallback estimation.`
      );
      // Fallback: rough word count estimation
      return this.#fallbackTokenEstimation(text);
    }
  }

  /**
   * @async
   * @param {string} text
   * @param {number} limit
   * @param {string} [model]
   * @returns {Promise<TokenValidationResult>}
   */
  async validateTokenLimit(text, limit, model = 'gpt-3.5-turbo') {
    const estimatedTokens = await this.estimateTokens(text, model);
    const isValid = estimatedTokens <= limit;
    const isNearLimit = this.isNearTokenLimit(estimatedTokens, limit);

    const result = {
      isValid,
      estimatedTokens,
      availableTokens: limit,
      isNearLimit,
    };

    if (!isValid) {
      result.excessTokens = estimatedTokens - limit;
    }

    this.#logger.debug('TokenEstimator: Token validation result', {
      model,
      limit,
      estimatedTokens,
      isValid,
      isNearLimit,
      excessTokens: result.excessTokens,
    });

    return result;
  }

  /**
   * @param {number} contextTokenLimit
   * @param {number} [maxOutputTokens]
   * @returns {TokenBudget}
   */
  getTokenBudget(contextTokenLimit, maxOutputTokens = 150) {
    if (typeof contextTokenLimit !== 'number' || contextTokenLimit <= 0) {
      throw new Error(
        'TokenEstimator: contextTokenLimit must be a positive number'
      );
    }

    if (typeof maxOutputTokens !== 'number' || maxOutputTokens < 0) {
      throw new Error(
        'TokenEstimator: maxOutputTokens must be a non-negative number'
      );
    }

    const availableForPrompt = Math.max(0, contextTokenLimit - maxOutputTokens);

    const budget = {
      totalLimit: contextTokenLimit,
      reservedTokens: maxOutputTokens,
      availableForPrompt,
    };

    this.#logger.debug('TokenEstimator: Calculated token budget', budget);

    return budget;
  }

  /**
   * @param {string} model
   * @returns {string}
   */
  getEncodingForModel(model) {
    const encoding = MODEL_TO_ENCODING[model] || 'cl100k_base';

    this.#logger.debug('TokenEstimator: Determined encoding for model', {
      model,
      encoding,
    });

    return encoding;
  }

  /**
   * @param {number} tokenCount
   * @param {number} limit
   * @param {number} [threshold]
   * @returns {boolean}
   */
  isNearTokenLimit(tokenCount, limit, threshold = 0.9) {
    if (typeof tokenCount !== 'number' || typeof limit !== 'number') {
      return false;
    }

    if (threshold < 0 || threshold > 1) {
      throw new Error('TokenEstimator: threshold must be between 0 and 1');
    }

    return tokenCount >= limit * threshold;
  }

  /**
   * @private
   * @async
   * @param {string} encodingName
   * @returns {Promise<Function>}
   */
  async #getEncoder(encodingName) {
    // Check cache first
    if (this.#encoderCache.has(encodingName)) {
      return this.#encoderCache.get(encodingName);
    }

    let encodeFn;

    // CL100K encoder is already imported at the top
    if (encodingName === 'cl100k_base') {
      encodeFn = cl100kEncode;
    } else {
      // Lazy-load other encoders
      try {
        const module = await import(
          /* @vite-ignore */ `gpt-tokenizer/encoding/${encodingName}`
        );
        encodeFn = module.encode;
      } catch (err) {
        this.#logger.warn(
          `TokenEstimator: Failed to load encoder for '${encodingName}', falling back to cl100k_base. Error: ${err.message}`
        );
        encodeFn = cl100kEncode;
      }
    }

    // Cache the encoder function
    this.#encoderCache.set(encodingName, encodeFn);
    return encodeFn;
  }

  /**
   * @private
   * @param {string} text
   * @returns {number}
   */
  #fallbackTokenEstimation(text) {
    // Simple word-based estimation
    // Average tokens per word is roughly 1.3 for English text
    const words = text.split(/\s+/).filter(Boolean).length;
    const estimatedTokens = Math.ceil(words * 1.3);

    this.#logger.debug('TokenEstimator: Used fallback estimation', {
      textLength: text.length,
      wordCount: words,
      estimatedTokens,
    });

    return estimatedTokens;
  }
}

export default TokenEstimator;

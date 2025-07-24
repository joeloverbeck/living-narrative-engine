/**
 * @file Unit tests for TokenEstimator service
 * @see src/llms/services/tokenEstimator.js
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TokenEstimator } from '../../../../src/llms/services/tokenEstimator.js';

describe('TokenEstimator', () => {
  let tokenEstimator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    tokenEstimator = new TokenEstimator({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      expect(tokenEstimator).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TokenEstimator: Instance created.'
      );
    });

    it('should throw error with invalid logger', () => {
      expect(() => new TokenEstimator({ logger: null })).toThrow(
        'Missing required dependency: ILogger.'
      );
      expect(() => new TokenEstimator({ logger: {} })).toThrow(
        "Invalid or missing method 'info' on dependency 'ILogger'."
      );
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for a simple text', async () => {
      const text = 'Hello, world!';
      const count = await tokenEstimator.estimateTokens(text);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it('should estimate tokens for a longer text', async () => {
      const text =
        'This is a longer text that should have more tokens. '.repeat(10);
      const count = await tokenEstimator.estimateTokens(text);
      expect(count).toBeGreaterThan(50);
    });

    it('should handle empty text', async () => {
      const count = await tokenEstimator.estimateTokens('');
      expect(count).toBe(0);
    });

    it('should use word approximation for unknown models', async () => {
      const text = 'This is a test sentence with several words.';
      const count = await tokenEstimator.estimateTokens(text, 'unknown-model');
      // Should successfully use cl100k_base encoding as fallback
      expect(count).toBeGreaterThan(5);
      expect(count).toBeLessThan(15);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TokenEstimator: Determined encoding for model',
        expect.objectContaining({
          model: 'unknown-model',
          encoding: 'cl100k_base',
        })
      );
    });

    it('should handle tokenizer errors gracefully', async () => {
      // Test with a text that might cause tokenizer issues
      const text = '🌟 Special unicode characters 你好 世界';
      const count = await tokenEstimator.estimateTokens(text);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle text with various unicode characters', async () => {
      // Test with various unicode characters to ensure robust encoding
      const texts = [
        'Hello world! 🌍',
        'Chinese text: 你好世界',
        'Arabic text: مرحبا بالعالم',
        'Russian text: Привет мир',
        'Emoji text: 🚀 🎉 ⭐ 💫',
        'Mixed: Hello 世界! 🌟'
      ];
      
      for (const text of texts) {
        const count = await tokenEstimator.estimateTokens(text);
        expect(count).toBeGreaterThan(0);
        expect(typeof count).toBe('number');
      }
    });

    it('should handle non-string input gracefully', async () => {
      const count1 = await tokenEstimator.estimateTokens(null);
      const count2 = await tokenEstimator.estimateTokens(undefined);
      const count3 = await tokenEstimator.estimateTokens(123);
      
      expect(count1).toBe(0);
      expect(count2).toBe(0);
      expect(count3).toBe(0);
    });
  });

  describe('validateTokenLimit', () => {
    it('should validate text within limits', async () => {
      const text = 'Short text';
      const limit = 1000;
      const result = await tokenEstimator.validateTokenLimit(text, limit);

      expect(result.isValid).toBe(true);
      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.availableTokens).toBe(limit);
      expect(result.isNearLimit).toBe(false);
      expect(result.excessTokens).toBeUndefined();
    });

    it('should invalidate text exceeding limits', async () => {
      const text = 'Very long text '.repeat(1000);
      const limit = 10;
      const result = await tokenEstimator.validateTokenLimit(text, limit);

      expect(result.isValid).toBe(false);
      expect(result.estimatedTokens).toBeGreaterThan(limit);
      expect(result.availableTokens).toBe(limit);
      expect(result.excessTokens).toBeGreaterThan(0);
      expect(result.isNearLimit).toBe(true); // Should be true since it exceeds limit
    });

    it('should detect when near limit', async () => {
      const text = 'This is a test text that should be near the limit';
      const estimatedTokens = await tokenEstimator.estimateTokens(text);
      const limit = Math.floor(estimatedTokens * 1.05); // 5% above estimated

      const result = await tokenEstimator.validateTokenLimit(text, limit);

      expect(result.isValid).toBe(true);
      expect(result.isNearLimit).toBe(true);
    });
  });

  describe('getTokenBudget', () => {
    it('should calculate token budget with default output tokens', () => {
      const contextLimit = 4096;
      const budget = tokenEstimator.getTokenBudget(contextLimit);

      expect(budget.totalLimit).toBe(4096);
      expect(budget.reservedTokens).toBe(150); // default
      expect(budget.availableForPrompt).toBe(3946);
    });

    it('should calculate token budget with custom output tokens', () => {
      const contextLimit = 8192;
      const maxOutputTokens = 500;
      const budget = tokenEstimator.getTokenBudget(
        contextLimit,
        maxOutputTokens
      );

      expect(budget.totalLimit).toBe(8192);
      expect(budget.reservedTokens).toBe(500);
      expect(budget.availableForPrompt).toBe(7692);
    });

    it('should handle edge case where output tokens exceed context limit', () => {
      const contextLimit = 100;
      const maxOutputTokens = 200;
      const budget = tokenEstimator.getTokenBudget(
        contextLimit,
        maxOutputTokens
      );

      expect(budget.totalLimit).toBe(100);
      expect(budget.reservedTokens).toBe(200);
      expect(budget.availableForPrompt).toBe(0); // Math.max prevents negative values
    });

    it('should throw error for invalid contextTokenLimit', () => {
      expect(() => tokenEstimator.getTokenBudget('invalid')).toThrow(
        'TokenEstimator: contextTokenLimit must be a positive number'
      );
      expect(() => tokenEstimator.getTokenBudget(0)).toThrow(
        'TokenEstimator: contextTokenLimit must be a positive number'
      );
      expect(() => tokenEstimator.getTokenBudget(-100)).toThrow(
        'TokenEstimator: contextTokenLimit must be a positive number'
      );
      expect(() => tokenEstimator.getTokenBudget(null)).toThrow(
        'TokenEstimator: contextTokenLimit must be a positive number'
      );
    });

    it('should throw error for invalid maxOutputTokens', () => {
      expect(() => tokenEstimator.getTokenBudget(1000, 'invalid')).toThrow(
        'TokenEstimator: maxOutputTokens must be a non-negative number'
      );
      expect(() => tokenEstimator.getTokenBudget(1000, -10)).toThrow(
        'TokenEstimator: maxOutputTokens must be a non-negative number'
      );
      expect(() => tokenEstimator.getTokenBudget(1000, null)).toThrow(
        'TokenEstimator: maxOutputTokens must be a non-negative number'
      );
    });
  });

  describe('getEncodingForModel', () => {
    it('should return cl100k_base for GPT-4 models', () => {
      expect(tokenEstimator.getEncodingForModel('gpt-4')).toBe('cl100k_base');
      expect(tokenEstimator.getEncodingForModel('gpt-4-turbo')).toBe(
        'cl100k_base'
      );
      expect(tokenEstimator.getEncodingForModel('gpt-3.5-turbo')).toBe(
        'cl100k_base'
      );
    });

    it('should return cl100k_base for Claude models', () => {
      expect(tokenEstimator.getEncodingForModel('claude-3-opus')).toBe(
        'cl100k_base'
      );
      expect(tokenEstimator.getEncodingForModel('claude-3-sonnet')).toBe(
        'cl100k_base'
      );
    });

    it('should return cl100k_base for unknown models', () => {
      expect(tokenEstimator.getEncodingForModel('unknown-model')).toBe(
        'cl100k_base'
      );
      expect(tokenEstimator.getEncodingForModel('')).toBe('cl100k_base');
      expect(tokenEstimator.getEncodingForModel(null)).toBe('cl100k_base');
    });

    it('should return p50k_base for older models', () => {
      expect(tokenEstimator.getEncodingForModel('text-davinci-003')).toBe('p50k_base');
      expect(tokenEstimator.getEncodingForModel('code-davinci-002')).toBe('p50k_base');
    });

    it('should return r50k_base for curie models', () => {
      expect(tokenEstimator.getEncodingForModel('text-curie-001')).toBe('r50k_base');
    });
  });

  describe('isNearTokenLimit', () => {
    it('should return true when near default threshold (90%)', () => {
      expect(tokenEstimator.isNearTokenLimit(91, 100)).toBe(true);
      expect(tokenEstimator.isNearTokenLimit(90, 100)).toBe(true);
    });

    it('should return false when below default threshold', () => {
      expect(tokenEstimator.isNearTokenLimit(89, 100)).toBe(false);
      expect(tokenEstimator.isNearTokenLimit(50, 100)).toBe(false);
    });

    it('should use custom threshold', () => {
      expect(tokenEstimator.isNearTokenLimit(81, 100, 0.8)).toBe(true);
      expect(tokenEstimator.isNearTokenLimit(79, 100, 0.8)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(tokenEstimator.isNearTokenLimit(100, 100)).toBe(true);
      expect(tokenEstimator.isNearTokenLimit(150, 100)).toBe(true); // over limit
      expect(tokenEstimator.isNearTokenLimit(0, 100)).toBe(false);
    });

    it('should return false for non-number inputs', () => {
      expect(tokenEstimator.isNearTokenLimit('100', 100)).toBe(false);
      expect(tokenEstimator.isNearTokenLimit(100, '100')).toBe(false);
      expect(tokenEstimator.isNearTokenLimit(null, 100)).toBe(false);
      expect(tokenEstimator.isNearTokenLimit(100, null)).toBe(false);
      expect(tokenEstimator.isNearTokenLimit(undefined, 100)).toBe(false);
      expect(tokenEstimator.isNearTokenLimit(100, undefined)).toBe(false);
    });

    it('should throw error for invalid threshold values', () => {
      expect(() => tokenEstimator.isNearTokenLimit(50, 100, -0.1)).toThrow(
        'TokenEstimator: threshold must be between 0 and 1'
      );
      expect(() => tokenEstimator.isNearTokenLimit(50, 100, 1.1)).toThrow(
        'TokenEstimator: threshold must be between 0 and 1'
      );
    });
  });

  describe('additional coverage scenarios', () => {
    it('should handle encoder caching correctly', async () => {
      const text = 'Test caching behavior';
      
      // First call should cache the encoder
      const count1 = await tokenEstimator.estimateTokens(text, 'gpt-4');
      const count2 = await tokenEstimator.estimateTokens(text, 'gpt-4');
      
      // Both calls should return the same result
      expect(count1).toBe(count2);
      expect(count1).toBeGreaterThan(0);
    });

    it('should handle different model encodings', async () => {
      const text = 'Test text for model encoding';
      
      // Test different model types to ensure they use correct encodings
      const count1 = await tokenEstimator.estimateTokens(text, 'gpt-4');
      const count2 = await tokenEstimator.estimateTokens(text, 'text-davinci-003');
      const count3 = await tokenEstimator.estimateTokens(text, 'text-curie-001');
      
      // All should return valid counts
      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);
      expect(count3).toBeGreaterThan(0);
      
      // Verify encoding detection was logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TokenEstimator: Determined encoding for model',
        expect.objectContaining({
          model: 'text-davinci-003',
          encoding: 'p50k_base'
        })
      );
    });

    it('should test edge cases with threshold validation bounds', () => {
      // Test exact boundary values for threshold
      expect(() => tokenEstimator.isNearTokenLimit(50, 100, 0)).not.toThrow();
      expect(() => tokenEstimator.isNearTokenLimit(50, 100, 1)).not.toThrow();
      expect(tokenEstimator.isNearTokenLimit(50, 100, 0)).toBe(true); // 0% threshold
      expect(tokenEstimator.isNearTokenLimit(50, 100, 1)).toBe(false); // 100% threshold
    });

    it('should handle token budget edge cases', () => {
      // Test with minimum valid values
      const budget1 = tokenEstimator.getTokenBudget(1, 0);
      expect(budget1.totalLimit).toBe(1);
      expect(budget1.reservedTokens).toBe(0);
      expect(budget1.availableForPrompt).toBe(1);
      
      // Test with very large values
      const budget2 = tokenEstimator.getTokenBudget(100000, 50000);
      expect(budget2.totalLimit).toBe(100000);
      expect(budget2.reservedTokens).toBe(50000);
      expect(budget2.availableForPrompt).toBe(50000);
    });
  });
});

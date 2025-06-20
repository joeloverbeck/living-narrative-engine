// tests/llms/strategies/base/baseCompletionLLMStrategy.test.js
// --- UPDATED FILE START ---

import { BaseCompletionLLMStrategy } from '../../../../../src/llms/strategies/base/baseCompletionLLMStrategy.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

// Mock Logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Reset mocks before each test
beforeEach(() => {
  mockLogger.debug.mockClear();
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
});

describe('BaseCompletionLLMStrategy', () => {
  describe('_constructPromptPayload', () => {
    const gameSummary = 'Player is in the kitchen.';
    const trimmedGameSummary = gameSummary.trim();
    let strategy;

    beforeEach(() => {
      strategy = new BaseCompletionLLMStrategy(mockLogger);
    });

    // Test Refactored: promptFrame is ignored.
    test('should use gameSummary as prompt, ignoring string promptFrame', () => {
      const llmConfig = {
        apiType: 'ollama',
        promptFrame: 'You are a helpful assistant.',
      };
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test Refactored: promptFrame is ignored, so no warning about it.
    test('should use gameSummary as prompt, ignoring empty string promptFrame, and not log warning', () => {
      const llmConfig = { apiType: 'custom_api', promptFrame: '   ' };
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test Refactored: promptFrame object properties (system) are ignored.
    test('should use gameSummary as prompt, ignoring promptFrame.system', () => {
      const llmConfig = {
        apiType: 'ollama',
        promptFrame: { system: 'System instruction.' },
      };
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      // The specific debug log about *applying* 'promptFrame.system' should not be present
      // as promptFrame is ignored entirely by _constructPromptPayload.
      // The initial debug log stating promptFrame will be ignored is tested elsewhere.
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining("Applying 'promptFrame.system'")
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test Refactored: promptFrame object properties (user_prefix, user_suffix) are ignored.
    test('should use gameSummary as prompt, ignoring promptFrame user_prefix and user_suffix', () => {
      const llmConfig = {
        apiType: 'ollama',
        promptFrame: { user_prefix: 'Prefix:', user_suffix: ':Suffix' },
      };
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test Refactored: promptFrame object is ignored.
    test('should use gameSummary as prompt, ignoring combined system, user_prefix, and user_suffix from object promptFrame', () => {
      const llmConfig = {
        apiType: 'ollama',
        promptFrame: {
          system: 'Sys.',
          user_prefix: 'Pre ',
          user_suffix: ' Post',
        },
      };
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test Refactored: promptFrame is ignored, so no warning.
    test('should use gameSummary as prompt, ignoring empty object promptFrame, and not log warning', () => {
      const llmConfig = { apiType: 'custom_completion', promptFrame: {} };
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test Refactored: promptFrame is ignored, so no warning.
    test('should use gameSummary as prompt, ignoring object promptFrame with empty string values, and not log warning', () => {
      const llmConfig = {
        apiType: 'custom_completion',
        promptFrame: { system: '  ', user_prefix: '\t', user_suffix: '' },
      };
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test Refactored: promptFrame is ignored, so no warning.
    test('should use gameSummary as prompt, ignoring null promptFrame, and not log warning', () => {
      const llmConfig = { apiType: 'another_custom_api', promptFrame: null };
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // This test remains largely the same as promptFrame being undefined is ignored, and no warning is expected.
    test('should handle undefined promptFrame and not log warning', () => {
      const llmConfig = { apiType: 'ollama', promptFrame: undefined };
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // This test remains largely the same as promptFrame being null is ignored, and no warning is expected.
    test('should not log warning if promptFrame is missing (null) for any apiType (BaseCompletion context)', () => {
      const llmConfig = { apiType: 'openai', promptFrame: null }; // apiType here is illustrative
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe(trimmedGameSummary);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test Refactored: promptFrame is ignored. Focus is on gameSummary trimming.
    test('should trim gameSummary content in the final prompt', () => {
      const dirtyGameSummary = '  Summary to be trimmed.  ';
      const llmConfig = { apiType: 'ollama', promptFrame: 'Instruction.' }; // promptFrame is ignored
      const result = strategy._constructPromptPayload(
        dirtyGameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe('Summary to be trimmed.');
    });

    // Test Refactored: promptFrame is ignored. Focus is on empty gameSummary.
    test('should handle empty gameSummary, resulting in an empty prompt string', () => {
      const emptyGameSummary = '';
      const llmConfig = { apiType: 'ollama', promptFrame: 'Instruction.' }; // promptFrame is ignored
      const result = strategy._constructPromptPayload(
        emptyGameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe('');
    });

    // Test Refactored: promptFrame is ignored. Focus is on whitespace-only gameSummary.
    test('should correctly handle gameSummary being only whitespace, resulting in an empty prompt string', () => {
      const whitespaceGameSummary = '   \n\t   ';
      const llmConfig = { apiType: 'ollama', promptFrame: 'Instruction.' }; // promptFrame is ignored
      const result = strategy._constructPromptPayload(
        whitespaceGameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result.prompt).toBe('');
    });

    test('should log debug messages for ignored promptFrame and prompt preview', () => {
      const currentApiType = 'ollama_test';
      const llmConfig = {
        apiType: currentApiType,
        promptFrame: 'System Frame.',
      }; // promptFrame will be ignored
      const currentgameSummary = 'Test game summary for logging.';
      const expectedTrimmedSummary = currentgameSummary.trim();

      strategy._constructPromptPayload(
        currentgameSummary,
        llmConfig.promptFrame,
        llmConfig
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `BaseCompletionLLMStrategy._constructPromptPayload for apiType '${currentApiType}'. gameSummary (finalPromptString) length: ${currentgameSummary.length}. llmConfig.promptFrame will be ignored.`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `BaseCompletionLLMStrategy._constructPromptPayload: Using finalPromptString as the 'prompt'. Preview: ${expectedTrimmedSummary.substring(0, 100)}`
        )
      );
    });

    test('output structure should always be { prompt: string }', () => {
      const llmConfig = { apiType: 'ollama', promptFrame: null }; // promptFrame is ignored
      const result = strategy._constructPromptPayload(
        gameSummary,
        llmConfig.promptFrame,
        llmConfig
      );
      expect(result).toHaveProperty('prompt');
      expect(typeof result.prompt).toBe('string');
      // Specifically check it's the trimmed gameSummary
      expect(result.prompt).toBe(trimmedGameSummary);
    });
  });
});

// --- UPDATED FILE END ---

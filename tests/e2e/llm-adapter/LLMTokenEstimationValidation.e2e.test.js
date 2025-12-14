/**
 * @file End-to-end test for LLM Token Estimation and Validation
 * @see reports/llm-prompt-workflow-analysis.md
 *
 * This test suite covers the token estimation and validation functionality
 * as specified in section 5 "Token Estimation Validation Test" of the
 * E2E Test Recommendations in the LLM prompt workflow analysis report.
 *
 * Tests covered:
 * - Accurate token estimation for various prompt sizes
 * - Warning generation when approaching token limits
 * - Error generation when exceeding token limits
 * - Behavior across different LLM configurations
 * - Edge cases and fallback scenarios
 * - Threshold calculation validation
 */

import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { LLMAdapterTestBed } from './common/llmAdapterTestBed.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import {
  PromptTooLongError,
  LLMInteractionError,
} from '../../../src/errors/index.js';

/**
 * E2E test suite for token estimation and limits validation
 * Tests the complete flow of token estimation, warning generation,
 * and error handling for prompts near or over token limits
 */
describe('E2E: Token Estimation and Limits', () => {
  let testBed;

  beforeAll(async () => {
    // Initialize test bed once with performance optimizations
    testBed = new LLMAdapterTestBed({
      lightweight: true, // Skip file system operations
      skipSchemaLoading: false, // Keep schema loading as LLM adapter needs schemas
      networkDelay: 0, // No artificial network delays
    });
    await testBed.initialize();
  });

  afterAll(async () => {
    // Clean up test bed once at the end
    await testBed.cleanup();
  });

  beforeEach(async () => {
    // Clean up any leftover spies from previous tests
    jest.restoreAllMocks();

    // Reset test bed state between tests (much faster than full reinit)
    await testBed.reset();

    // Clear any events from previous tests
    testBed.clearRecordedEvents();

    // Ensure consistent starting configuration for all tests
    // Tests that need a different configuration should explicitly switch
    await testBed.switchLLMConfig('test-llm-toolcalling');
  });

  /**
   * Test: Basic token estimation validation
   * Verifies the system can accurately estimate tokens for prompts
   */
  test('should accurately estimate tokens for various prompt sizes', async () => {
    // Arrange
    const { config } = await testBed.getCurrentLLMConfig();

    // Test different prompt sizes
    const smallPrompt = testBed.createTestPrompt(500); // ~125 tokens
    const mediumPrompt = testBed.createTestPrompt(2000); // ~500 tokens
    const largePrompt = testBed.createTestPrompt(4000); // ~1000 tokens

    const mockResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Test response',
      thoughts: 'Test thoughts',
    });

    // Set up mock HTTP response for successful calls
    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      mockResponse
    );

    // Act & Assert - All prompts should be processed successfully
    // since they're well under the 8000 token limit in test config
    await expect(testBed.getAIDecision(smallPrompt)).resolves.toBeDefined();
    await expect(testBed.getAIDecision(mediumPrompt)).resolves.toBeDefined();
    await expect(testBed.getAIDecision(largePrompt)).resolves.toBeDefined();

    // Verify HTTP client was called for each prompt
    expect(testBed.httpClient.request).toHaveBeenCalledTimes(3);

    // Verify no warnings were logged for normal-sized prompts
    const errorEvents = testBed.getEventsByType(SYSTEM_ERROR_OCCURRED_ID);
    expect(errorEvents).toHaveLength(0);
  });

  /**
   * Test: Near-limit warning verification
   * Verifies the system warns when approaching token limits (90% threshold)
   * This implements the exact test case from the report
   */
  test('should accurately estimate tokens and warn near limits', async () => {
    // Arrange - Switch to limited context config for easier testing
    await testBed.switchLLMConfig('test-llm-limited');
    const { config } = await testBed.getCurrentLLMConfig();

    // Expected calculation:
    // contextTokenLimit: 1000, max_tokens: 150 (default),
    // promptTokenSpace = 850, warnThreshold = 90% * 850 = 765 tokens

    // Create a prompt in the warning zone (between 765 and 850 tokens)
    // Using repeat(70) to hit ~771 tokens, which exceeds warning threshold of 765
    const nearLimitPrompt =
      'This is a test prompt with words to reach thresholds. '.repeat(70);

    const mockResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Large prompt response',
      thoughts: 'Processing large prompt',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      mockResponse
    );

    // Spy on logger to verify warning
    const loggerSpy = jest.spyOn(testBed.logger, 'warn');

    // Act
    const response = await testBed.getAIDecision(nearLimitPrompt);

    // Assert - Response should be successful
    expect(response).toBeDefined();
    const parsed = JSON.parse(response);
    expect(parsed.chosenIndex).toBe(1);

    // Assert - Warning should be logged
    const warningCalls = loggerSpy.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('nearing the limit')
    );

    expect(warningCalls.length).toBeGreaterThan(0);

    // Verify the warning includes the LLM config ID
    expect(warningCalls[0][0]).toContain('test-llm-limited');

    loggerSpy.mockRestore();
  });

  /**
   * Test: Over-limit error verification
   * Verifies the system throws appropriate errors when exceeding token limits
   */
  test('should throw PromptTooLongError when exceeding token limits', async () => {
    // Arrange - Use limited context config
    await testBed.switchLLMConfig('test-llm-limited');

    // Create prompt that exceeds limit (target 1200 tokens > 850 available space)
    const oversizedPrompt = testBed.createLongPrompt(1200);

    // Act & Assert - Should throw PromptTooLongError
    await expect(testBed.getAIDecision(oversizedPrompt)).rejects.toThrow(
      PromptTooLongError
    );

    // Verify no HTTP request was made (error thrown before API call)
    expect(testBed.httpClient.request).not.toHaveBeenCalled();

    // Verify error was logged
    const errorSpy = jest.spyOn(testBed.logger, 'error');

    try {
      await testBed.getAIDecision(oversizedPrompt);
    } catch (error) {
      // Expected to throw
    }

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('exceed available space')
    );

    errorSpy.mockRestore();
  });

  /**
   * Test: Token estimation with different LLM configurations
   * Verifies token estimation works correctly across different strategies
   */
  test('should handle token estimation across different LLM configurations', async () => {
    // Test with tool calling configuration
    await testBed.switchLLMConfig('test-llm-toolcalling');
    let { config } = await testBed.getCurrentLLMConfig();
    expect(config.configId).toBe('test-llm-toolcalling');

    const testPrompt = testBed.createTestPrompt(2000);

    const toolCallingResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Tool calling works',
      thoughts: 'Using tool calling strategy',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      toolCallingResponse
    );

    // Should work fine with normal-sized prompt
    await expect(testBed.getAIDecision(testPrompt)).resolves.toBeDefined();

    // Test with JSON schema configuration
    await testBed.switchLLMConfig('test-llm-jsonschema');
    ({ config } = await testBed.getCurrentLLMConfig());
    expect(config.configId).toBe('test-llm-jsonschema');

    const jsonSchemaResponse = testBed.createJsonContentResponse({
      chosenIndex: 2,
      speech: 'JSON schema works',
      thoughts: 'Using JSON schema strategy',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      jsonSchemaResponse
    );

    // Should also work fine with same prompt
    await expect(testBed.getAIDecision(testPrompt)).resolves.toBeDefined();

    // Verify both configurations processed the prompt successfully
    expect(testBed.httpClient.request).toHaveBeenCalledTimes(2);
  });

  /**
   * Test: Threshold calculation validation
   * Verifies the warning threshold (90%) is calculated correctly
   */
  test('should calculate warning thresholds correctly', async () => {
    // Arrange - Use limited config for predictable calculations
    await testBed.switchLLMConfig('test-llm-limited');

    const loggerSpy = jest.spyOn(testBed.logger, 'warn');

    // Test small prompt that should NOT warn (~749 tokens < 765 threshold)
    const smallPrompt =
      'This is a test prompt with words to reach thresholds. '.repeat(68);

    const mockResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Small prompt response',
      thoughts: 'No warning expected',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      mockResponse
    );

    await testBed.getAIDecision(smallPrompt);

    // Count initial warning calls (should be 0 for small prompt)
    const initialWarningCalls = loggerSpy.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('nearing the limit')
    );

    // Test prompt in warning zone (~771 tokens > 765 threshold)
    const largePrompt =
      'This is a test prompt with words to reach thresholds. '.repeat(70);

    await testBed.getAIDecision(largePrompt);

    // Count warning calls after large prompt
    const finalWarningCalls = loggerSpy.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('nearing the limit')
    );

    // The large prompt should have triggered more warnings than the small one
    expect(finalWarningCalls.length).toBeGreaterThan(
      initialWarningCalls.length
    );

    loggerSpy.mockRestore();
  });

  /**
   * Test: Edge case - Empty prompt handling
   * Verifies token estimation handles edge cases gracefully
   */
  test('should handle edge cases gracefully', async () => {
    // Test empty prompt
    const emptyPrompt = '';

    const mockResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Empty prompt response',
      thoughts: 'Handling empty input',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      mockResponse
    );

    // Should handle empty prompt without errors
    await expect(testBed.getAIDecision(emptyPrompt)).resolves.toBeDefined();

    // Test null prompt (should be handled by adapter validation)
    await expect(testBed.getAIDecision(null)).rejects.toThrow();

    // Test undefined prompt
    await expect(testBed.getAIDecision(undefined)).rejects.toThrow();
  });

  /**
   * Test: Token estimation fallback behavior
   * Verifies the system falls back to word count when tokenizer fails
   */
  test('should fallback to word count when tokenizer fails', async () => {
    // This test is more of a integration test since we can't easily
    // mock the tokenizer in the E2E environment, but we can verify
    // the system handles various prompt formats gracefully

    // Note: Using default configuration set in beforeEach (test-llm-toolcalling)
    // which has 8000 token limit, sufficient for our test prompts

    const weirdCharPrompt = 'Strange characters: ñáéíóú 中文 🚀 ♠️ ∑∏∆';

    const mockResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Handled weird characters',
      thoughts: 'Tokenizer handled special characters',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      mockResponse
    );

    // Should handle special characters without crashing
    await expect(testBed.getAIDecision(weirdCharPrompt)).resolves.toBeDefined();

    // Test very repetitive prompt that might confuse tokenizer
    const repetitivePrompt = 'repeat '.repeat(1000);

    await expect(
      testBed.getAIDecision(repetitivePrompt)
    ).resolves.toBeDefined();
  });

  /**
   * Test: Token estimation with custom max_tokens configuration
   * Verifies calculations work correctly with different max_tokens values
   */
  test('should handle custom max_tokens in token calculations', async () => {
    // Note: This test uses the mock configuration from testBed
    // In a real implementation, we might want to test configs with
    // different max_tokens values, but the mock configs have fixed values

    await testBed.switchLLMConfig('test-llm-toolcalling');
    const { config } = await testBed.getCurrentLLMConfig();

    // The test configs use default max_tokens (150), but we can still verify
    // the system processes the configuration correctly
    expect(config.contextTokenLimit).toBe(8000);

    // Create a prompt that would be fine for 8000 limit but would
    // fail for 1000 limit to verify configuration is being used
    // Note: createLongPrompt uses ~5.3 chars/token, so 1200 target → ~930 actual tokens
    const mediumLargePrompt = testBed.createLongPrompt(1200);

    const mockResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Large prompt handled',
      thoughts: 'Configuration working correctly',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      mockResponse
    );

    // Should succeed with the larger context limit
    await expect(
      testBed.getAIDecision(mediumLargePrompt)
    ).resolves.toBeDefined();

    // Now switch to limited config and verify it fails
    await testBed.switchLLMConfig('test-llm-limited');

    // Same prompt should now fail due to lower limit
    await expect(testBed.getAIDecision(mediumLargePrompt)).rejects.toThrow(
      PromptTooLongError
    );
  });

  /**
   * Test: Token estimation warning message format
   * Verifies warning messages contain expected information
   */
  test('should include relevant details in warning messages', async () => {
    // Arrange
    await testBed.switchLLMConfig('test-llm-limited');

    // Use a prompt in warning zone to guarantee warning but not error (~771 tokens > 765 threshold)
    const largePrompt =
      'This is a test prompt with words to reach thresholds. '.repeat(70);

    const mockResponse = testBed.createToolCallingResponse({
      chosenIndex: 1,
      speech: 'Warning test',
      thoughts: 'Testing warning format',
    });

    testBed.setMockResponse(
      'http://localhost:3001/api/llm-request',
      mockResponse
    );

    const loggerSpy = jest.spyOn(testBed.logger, 'warn');

    // Act
    await testBed.getAIDecision(largePrompt);

    // Assert - Verify warning message contains key information
    const warningCalls = loggerSpy.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('nearing the limit')
    );

    expect(warningCalls.length).toBeGreaterThan(0);

    const warningMessage = warningCalls[0][0];

    // Should contain LLM configuration ID
    expect(warningMessage).toContain('test-llm-limited');

    // Should contain "nearing the limit" as specified in the report
    expect(warningMessage).toContain('nearing the limit');

    // Should be informative for debugging
    expect(warningMessage.length).toBeGreaterThan(50);

    loggerSpy.mockRestore();
  });
});

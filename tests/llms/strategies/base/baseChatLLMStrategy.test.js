// tests/llms/strategies/base/baseChatLLMStrategy.test.js
// --- FILE START ---

import {BaseChatLLMStrategy} from '../../../../src/llms/strategies/base/baseChatLLMStrategy.js';
import {beforeEach, describe, expect, jest, test} from "@jest/globals";

// Mock Logger
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

describe('BaseChatLLMStrategy', () => {
    let strategy;

    beforeEach(() => {
        mockLogger.debug.mockClear();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        strategy = new BaseChatLLMStrategy(mockLogger); // Instantiate with the mock logger
    });

    describe('_constructPromptPayload', () => {
        const gameSummary = "Current game state summary.";
        const llmConfigOpenAI = {apiType: 'openai'}; // Example llmConfig
        const llmConfigOpenRouter = {apiType: 'openrouter'};

        test('should always create a single user message with the gameSummary', () => {
            const result = strategy._constructPromptPayload(gameSummary, llmConfigOpenAI);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).not.toHaveBeenCalled(); // No warnings should be logged now
        });

        test('should trim the gameSummary content for the user message', () => {
            const dirtyGameSummary = "  Trimmed summary.  ";
            const expectedCleanSummary = "Trimmed summary.";
            const result = strategy._constructPromptPayload(dirtyGameSummary, llmConfigOpenAI);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: expectedCleanSummary});
        });

        test('should handle an empty gameSummary string', () => {
            const emptyGameSummary = "";
            const result = strategy._constructPromptPayload(emptyGameSummary, llmConfigOpenAI);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: ""});
        });

        test('should correctly handle a gameSummary that is only whitespace', () => {
            const whitespaceGameSummary = "   \t   ";
            const result = strategy._constructPromptPayload(whitespaceGameSummary, llmConfigOpenAI);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: ""}); // After trim
        });

        test('should log debug messages for construction and preview', () => {
            const localGameSummary = "A different game state."; // Length 23
            const localLlmConfig = {apiType: 'openrouter'};

            strategy._constructPromptPayload(localGameSummary, localLlmConfig);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                `BaseChatLLMStrategy._constructPromptPayload for apiType '${localLlmConfig.apiType}'. gameSummary (finalPromptString) length: ${localGameSummary.length}.`
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "BaseChatLLMStrategy._constructPromptPayload: Constructed 'messages' array. The prompt built by PromptBuilder is the sole user message content.",
                [{role: 'user', contentPreview: localGameSummary}] // Assuming length < 70 for preview
            );
        });

        test('output structure should always be { messages: Array } with valid message objects', () => {
            const result = strategy._constructPromptPayload(gameSummary, llmConfigOpenRouter);
            expect(result).toHaveProperty('messages');
            expect(Array.isArray(result.messages)).toBe(true);
            expect(result.messages).toHaveLength(1); // Always one message now

            const message = result.messages[0];
            expect(message).toHaveProperty('role', 'user');
            expect(typeof message.content).toBe('string');
        });

        test('should correctly log apiType from llmConfig', () => {
            const customLlmConfig = {apiType: 'custom_api_type'};
            strategy._constructPromptPayload(gameSummary, customLlmConfig);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`apiType '${customLlmConfig.apiType}'`),
                // more specific if needed: `BaseChatLLMStrategy._constructPromptPayload for apiType '${customLlmConfig.apiType}'. gameSummary (finalPromptString) length: ${gameSummary.length}.`
            );
        });

        test('should handle llmConfig without an apiType gracefully in logging (though unlikely)', () => {
            // This test is more about robustness of the logging line itself if llmConfig is malformed upstream.
            // The method itself doesn't validate llmConfig structure beyond accessing apiType for the log.
            const malformedLlmConfig = {}; // No apiType
            strategy._constructPromptPayload(gameSummary, malformedLlmConfig);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `BaseChatLLMStrategy._constructPromptPayload for apiType 'undefined'. gameSummary (finalPromptString) length: ${gameSummary.length}.`
            );
        });
    });
});
// --- FILE END ---
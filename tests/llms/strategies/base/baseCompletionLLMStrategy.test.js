// tests/llms/strategies/base/BaseCompletionLLMStrategy.test.js
// --- UPDATED FILE START ---

import {BaseCompletionLLMStrategy} from '../../../../src/llms/strategies/base/BaseCompletionLLMStrategy.js'; // Adjusted path
import {beforeEach, describe, expect, jest, test} from "@jest/globals";


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
        const gameSummary = "Player is in the kitchen.";
        let strategy;

        beforeEach(() => {
            strategy = new BaseCompletionLLMStrategy(mockLogger);
        });

        test('should prepend promptFrame string to gameSummary', () => {
            const llmConfig = {apiType: 'ollama', promptFrame: "You are a helpful assistant."};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe("You are a helpful assistant.\n\nPlayer is in the kitchen.");
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should handle empty string promptFrame as if null/undefined and log warning', () => {
            const llmConfig = {apiType: 'custom_api', promptFrame: "   "};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe(gameSummary);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("promptFrame is missing or effectively empty for apiType 'custom_api'")
            );
        });

        test('should use promptFrame.system as a prefix if promptFrame is an object', () => {
            const llmConfig = {
                apiType: 'ollama',
                promptFrame: {system: "System instruction."}
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe("System instruction.\n\nPlayer is in the kitchen.");
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("Applying 'promptFrame.system' as a prefix for apiType 'ollama'")
            );
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should use promptFrame user_prefix and user_suffix if promptFrame is an object', () => {
            const llmConfig = {
                apiType: 'ollama',
                promptFrame: {user_prefix: "Prefix:", user_suffix: ":Suffix"}
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe("Prefix: Player is in the kitchen. :Suffix");
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should combine system, user_prefix, and user_suffix from object promptFrame', () => {
            const llmConfig = {
                apiType: 'ollama',
                promptFrame: {system: "Sys.", user_prefix: "Pre ", user_suffix: " Post"}
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe("Sys.\n\nPre Player is in the kitchen. Post");
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should handle empty object promptFrame and log warning for relevant apiType', () => {
            const llmConfig = {apiType: 'custom_completion', promptFrame: {}};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe(gameSummary);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("promptFrame is missing or effectively empty for apiType 'custom_completion'")
            );
        });

        test('should handle object promptFrame with empty string values and log warning for relevant apiType', () => {
            const llmConfig = {
                apiType: 'custom_completion',
                promptFrame: {system: "  ", user_prefix: "\t", user_suffix: ""}
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe(gameSummary);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("promptFrame is missing or effectively empty for apiType 'custom_completion'")
            );
        });

        test('should handle null promptFrame and log warning for relevant apiType', () => {
            const llmConfig = {apiType: 'another_custom_api', promptFrame: null};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe(gameSummary);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("promptFrame is missing or effectively empty for apiType 'another_custom_api'")
            );
        });

        test('should handle undefined promptFrame and not log warning for localApiTypes (e.g. ollama)', () => {
            const llmConfig = {apiType: 'ollama', promptFrame: undefined};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe(gameSummary);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should not log warning if promptFrame is missing for chatApiTypes (as this is BaseCompletion)', () => {
            const llmConfig = {apiType: 'openai', promptFrame: null};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe(gameSummary);
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should trim gameSummary content in the final prompt when gameSummary is not empty', () => {
            const dirtyGameSummary = "  Summary to be trimmed.  ";
            const llmConfig = {apiType: 'ollama', promptFrame: "Instruction."};
            const result = strategy._constructPromptPayload(dirtyGameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe("Instruction.\n\nSummary to be trimmed.");
        });

        test('should handle empty gameSummary and preserve prefix newlines', () => {
            const emptyGameSummary = "";
            const llmConfig = {apiType: 'ollama', promptFrame: "Instruction."};
            const result = strategy._constructPromptPayload(emptyGameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe("Instruction.\n\n");
        });

        test('should correctly handle gameSummary being only whitespace and preserve prefix newlines', () => {
            const whitespaceGameSummary = "   ";
            const llmConfig = {apiType: 'ollama', promptFrame: "Instruction."};
            const result = strategy._constructPromptPayload(whitespaceGameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.prompt).toBe("Instruction.\n\n");
        });

        test('should log debug messages for construction and preview', () => {
            const llmConfig = {apiType: 'ollama', promptFrame: "System."};
            strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("BaseCompletionLLMStrategy._constructPromptPayload: Constructing prompt."),
                expect.any(Object)
            );
            // Corrected assertion: expect a single string argument for the preview log
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("BaseCompletionLLMStrategy._constructPromptPayload: Constructed single 'prompt' string. Preview:")
            );
        });

        test('output structure should always be { prompt: string }', () => {
            const llmConfig = {apiType: 'ollama', promptFrame: null};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result).toHaveProperty('prompt');
            expect(typeof result.prompt).toBe('string');
        });
    });
});

// --- UPDATED FILE END ---
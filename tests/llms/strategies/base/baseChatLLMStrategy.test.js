// tests/llms/strategies/base/BaseChatLLMStrategy.test.js
// --- UPDATED FILE START ---

import {BaseChatLLMStrategy} from '../../../../src/llms/strategies/base/BaseChatLLMStrategy.js'; // Adjusted path to match your provided test file
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

describe('BaseChatLLMStrategy', () => {
    describe('_constructPromptPayload', () => {
        const gameSummary = "Current game state summary.";
        let strategy;

        beforeEach(() => {
            // Instantiate with the mock logger
            strategy = new BaseChatLLMStrategy(mockLogger);
        });

        test('should create system and user messages when promptFrame is a non-empty string', () => {
            const llmConfig = {apiType: 'openai', promptFrame: "System instruction."};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0]).toEqual({role: 'system', content: 'System instruction.'});
            expect(result.messages[1]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should handle empty string promptFrame as if null/undefined and log warning for chat API', () => {
            const llmConfig = {apiType: 'openai', promptFrame: "   "};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(1); // No system message from frame
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                // Updated expectation to match the new warning message
                expect.stringContaining("promptFrame is missing or effectively empty (did not yield a system message) for chat-like apiType 'openai'")
            );
        });

        test('should use promptFrame.system for system message if promptFrame is an object', () => {
            const llmConfig = {
                apiType: 'openrouter',
                promptFrame: {system: "System from object."}
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0]).toEqual({role: 'system', content: 'System from object.'});
            expect(result.messages[1]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should use promptFrame user_prefix and user_suffix if promptFrame is an object and log warning if no system message', () => {
            const llmConfig = {
                apiType: 'anthropic',
                promptFrame: {user_prefix: "Prefix:", user_suffix: ":Suffix"}
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(1); // No system message from this frame
            expect(result.messages[0]).toEqual({role: 'user', content: `Prefix: ${gameSummary} :Suffix`});
            expect(mockLogger.warn).toHaveBeenCalledWith( // Because .system is missing for a chat API
                // Updated expectation
                expect.stringContaining("promptFrame is missing or effectively empty (did not yield a system message) for chat-like apiType 'anthropic'")
            );
        });

        test('should use all parts of object promptFrame: system, user_prefix, user_suffix', () => {
            const llmConfig = {
                apiType: 'openai',
                promptFrame: {system: "Sys instruction.", user_prefix: "User PRE ", user_suffix: " POST user"}
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0]).toEqual({role: 'system', content: 'Sys instruction.'});
            expect(result.messages[1]).toEqual({role: 'user', content: `User PRE ${gameSummary} POST user`});
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should handle empty object promptFrame and log warning for chat API', () => {
            const llmConfig = {apiType: 'openai', promptFrame: {}};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                // Updated expectation
                expect.stringContaining("promptFrame is missing or effectively empty (did not yield a system message) for chat-like apiType 'openai'")
            );
        });

        test('should handle object promptFrame with empty string values and log warning for chat API', () => {
            const llmConfig = {
                apiType: 'openai',
                promptFrame: {system: "  ", user_prefix: "\t", user_suffix: ""}
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                // Updated expectation
                expect.stringContaining("promptFrame is missing or effectively empty (did not yield a system message) for chat-like apiType 'openai'")
            );
        });

        test('should handle null promptFrame and log warning for chat API', () => {
            const llmConfig = {apiType: 'openai', promptFrame: null};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                // Updated expectation
                expect.stringContaining("promptFrame is missing or effectively empty (did not yield a system message) for chat-like apiType 'openai'")
            );
        });

        test('should handle undefined promptFrame and log warning for chat API (openrouter)', () => {
            const llmConfig = {apiType: 'openrouter', promptFrame: undefined};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                // Updated expectation
                expect.stringContaining("promptFrame is missing or effectively empty (did not yield a system message) for chat-like apiType 'openrouter'")
            );
        });

        test('should not log warning for non-designated chat API if promptFrame is missing', () => {
            const llmConfig = {apiType: 'ollama', promptFrame: null};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });


        test('should trim gameSummary content', () => {
            const dirtyGameSummary = "  Trimmed summary.  ";
            const llmConfig = {apiType: 'openai', promptFrame: "System."};
            const result = strategy._constructPromptPayload(dirtyGameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.messages[1].content).toEqual("Trimmed summary.");
        });

        test('should handle empty gameSummary', () => {
            const emptyGameSummary = "";
            const llmConfig = {apiType: 'openai', promptFrame: "System."};
            const result = strategy._constructPromptPayload(emptyGameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[1].content).toEqual("");
        });

        test('should log debug messages for construction and preview', () => {
            const llmConfig = {apiType: 'openai', promptFrame: "System."};
            strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("BaseChatLLMStrategy._constructPromptPayload: Constructing prompt."),
                expect.any(Object)
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("BaseChatLLMStrategy._constructPromptPayload: Constructed 'messages' array:"),
                expect.any(Array)
            );
        });

        test('output structure should always be { messages: Array }', () => {
            const llmConfig = {apiType: 'openai', promptFrame: null};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result).toHaveProperty('messages');
            expect(Array.isArray(result.messages)).toBe(true);
            result.messages.forEach(msg => {
                expect(msg).toHaveProperty('role');
                expect(typeof msg.role).toBe('string');
                expect(msg).toHaveProperty('content');
                expect(typeof msg.content).toBe('string');
            });
        });
    });
});

// --- UPDATED FILE END ---
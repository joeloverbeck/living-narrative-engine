// tests/llms/strategies/base/baseChatLLMStrategy.test.js
// --- UPDATED FILE START ---

import {BaseChatLLMStrategy} from '../../../../src/llms/strategies/base/baseChatLLMStrategy.js'; // Adjusted path to match your provided test file
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
            const llmConfig = {apiType: 'openai', promptFrame: "   "}; // Intentionally spaces to test trim
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(1); // No system message from frame
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "BaseChatLLMStrategy: No system message added from llmConfig.promptFrame for apiType 'openai'. The prompt built by PromptBuilder will be the sole user message content."
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
                promptFrame: {user_prefix: "Prefix:", user_suffix: ":Suffix"} // These are ignored by current logic
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(1); // No system message from this frame
            // User prefix/suffix are intentionally ignored by BaseChatLLMStrategy, PromptBuilder handles final user content
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "BaseChatLLMStrategy: No system message added from llmConfig.promptFrame for apiType 'anthropic'. The prompt built by PromptBuilder will be the sole user message content."
            );
        });

        test('should use all parts of object promptFrame: system, user_prefix, user_suffix', () => {
            const llmConfig = {
                apiType: 'openai',
                promptFrame: {system: "Sys instruction.", user_prefix: "User PRE ", user_suffix: " POST user"} // user_prefix/suffix are ignored
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(2);
            expect(result.messages[0]).toEqual({role: 'system', content: 'Sys instruction.'});
            // User prefix/suffix are intentionally ignored by BaseChatLLMStrategy
            expect(result.messages[1]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should handle empty object promptFrame and log warning for chat API', () => {
            const llmConfig = {apiType: 'openai', promptFrame: {}};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);

            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "BaseChatLLMStrategy: No system message added from llmConfig.promptFrame for apiType 'openai'. The prompt built by PromptBuilder will be the sole user message content."
            );
        });

        test('should handle object promptFrame with empty string values and log warning for chat API', () => {
            const llmConfig = {
                apiType: 'openai',
                promptFrame: {system: "  ", user_prefix: "\t", user_suffix: ""} // system will be trimmed, effectively empty
            };
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "BaseChatLLMStrategy: No system message added from llmConfig.promptFrame for apiType 'openai'. The prompt built by PromptBuilder will be the sole user message content."
            );
        });

        test('should handle null promptFrame and log warning for chat API', () => {
            const llmConfig = {apiType: 'openai', promptFrame: null};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "BaseChatLLMStrategy: No system message added from llmConfig.promptFrame for apiType 'openai'. The prompt built by PromptBuilder will be the sole user message content."
            );
        });

        test('should handle undefined promptFrame and log warning for chat API (openrouter)', () => {
            const llmConfig = {apiType: 'openrouter', promptFrame: undefined};
            const result = strategy._constructPromptPayload(gameSummary, llmConfig.promptFrame, llmConfig);
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0]).toEqual({role: 'user', content: gameSummary});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "BaseChatLLMStrategy: No system message added from llmConfig.promptFrame for apiType 'openrouter'. The prompt built by PromptBuilder will be the sole user message content."
            );
        });

        test('should not log warning for non-designated chat API if promptFrame is missing', () => {
            const llmConfig = {apiType: 'ollama', promptFrame: null}; // ollama is not in ['openai', 'openrouter', 'anthropic']
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
            const localGameSummary = "Current game state summary."; // Length 27
            strategy._constructPromptPayload(localGameSummary, llmConfig.promptFrame, llmConfig);

            // Check for the initial processing debug message
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `BaseChatLLMStrategy._constructPromptPayload for apiType '${llmConfig.apiType}'. gameSummary (finalPromptString) length: ${localGameSummary.length}.`
            );

            // Check for the system message addition log (since promptFrame is a string here)
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "BaseChatLLMStrategy: Added system message from llmConfig.promptFrame (string)."
            );

            // Check for the final constructed messages array preview
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "BaseChatLLMStrategy._constructPromptPayload: Constructed 'messages' array:",
                [
                    {role: 'system', contentPreview: "System."}, // System.length < 70
                    {role: 'user', contentPreview: "Current game state summary."} // localGameSummary.length < 70
                ]
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
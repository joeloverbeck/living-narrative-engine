// tests/turns/services/LLMResponseProcessor.test.js
// --- FILE START ---

import {LLMResponseProcessor} from '../../../src/turns/services/LLMResponseProcessor.js';
import {FALLBACK_AI_ACTION} from '../../../src/turns/constants/aiConstants.js';
import {jest, describe, beforeEach, test, expect} from '@jest/globals';

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

describe('LLMResponseProcessor', () => {
    /** @type {LLMResponseProcessor} */
    let processor;
    /** @type {ReturnType<typeof mockLogger>} */
    let logger;
    const actorId = 'testActor123';
    const baseFallbackResolvedParams = FALLBACK_AI_ACTION.resolvedParameters || {};

    beforeEach(() => {
        processor = new LLMResponseProcessor();
        logger = mockLogger();
        jest.clearAllMocks(); // Clear mocks before each test
    });

    // --- Constructor Tests ---
    describe('constructor', () => {
        test('should create an instance of LLMResponseProcessor', () => {
            expect(processor).toBeInstanceOf(LLMResponseProcessor);
        });
    });

    // --- _createProcessingFallbackAction Tests ---
    describe('_createProcessingFallbackAction', () => {
        test('should create a fallback action with correct structure and details', () => {
            const errorContext = 'test_error';
            const problematicOutput = {detail: 'some problem'};
            const fallbackAction = processor._createProcessingFallbackAction(errorContext, actorId, problematicOutput);

            expect(fallbackAction).toEqual({
                actionDefinitionId: FALLBACK_AI_ACTION.actionDefinitionId,
                commandString: `AI LLM Processing Error for ${actorId}: ${errorContext}. Waiting.`,
                resolvedParameters: {
                    ...baseFallbackResolvedParams,
                    errorContext: `llm_processing:${errorContext}`,
                    actorId: actorId,
                    problematicOutput: problematicOutput,
                },
            });
        });

        test('should include base resolvedParameters from FALLBACK_AI_ACTION', () => {
            const errorContext = 'another_error';
            const fallbackAction = processor._createProcessingFallbackAction(errorContext, actorId);
            const expectedResolvedParameters = {
                ...baseFallbackResolvedParams,
                errorContext: `llm_processing:${errorContext}`,
                actorId: actorId,
                problematicOutput: null,
            };
            expect(fallbackAction.resolvedParameters).toEqual(expectedResolvedParameters);
        });

        test('should set problematicOutput to null if not provided', () => {
            const errorContext = 'yet_another_error';
            const fallbackAction = processor._createProcessingFallbackAction(errorContext, actorId);
            expect(fallbackAction.resolvedParameters.problematicOutput).toBeNull();
        });
    });

    // --- processResponse Method Tests ---
    describe('processResponse', () => {
        // --- Valid Inputs ---
        describe('Valid Inputs', () => {
            test('should process a valid JSON string with all fields', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'core:move',
                    resolvedParameters: {direction: 'north'},
                    commandString: 'go north',
                });
                const result = processor.processResponse(llmResponse, actorId, logger);

                expect(result).toEqual({
                    actionDefinitionId: 'core:move',
                    resolvedParameters: {direction: 'north'},
                    commandString: 'go north',
                });
                expect(logger.info).toHaveBeenCalledWith(`LLMResponseProcessor: Successfully transformed LLM output to ITurnAction for actor ${actorId}. Action: core:move`);
                expect(logger.debug).toHaveBeenCalledWith(`LLMResponseProcessor: Transformed ITurnAction details for ${actorId}:`, {
                    actorId,
                    action: result
                });
                expect(logger.error).not.toHaveBeenCalled();
                expect(logger.warn).not.toHaveBeenCalled();
            });

            test('should process valid JSON with resolvedParameters as an empty object', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'core:wait',
                    resolvedParameters: {},
                    commandString: 'Wait a moment',
                });
                const result = processor.processResponse(llmResponse, actorId, logger);

                expect(result).toEqual({
                    actionDefinitionId: 'core:wait',
                    resolvedParameters: {},
                    commandString: 'Wait a moment',
                });
                expect(logger.info).toHaveBeenCalled();
                expect(logger.debug).toHaveBeenCalled();
            });

            test('should generate default commandString if missing', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'custom:action',
                    resolvedParameters: {param1: 'value1'},
                });
                const result = processor.processResponse(llmResponse, actorId, logger);

                expect(result).toEqual({
                    actionDefinitionId: 'custom:action',
                    resolvedParameters: {param1: 'value1'},
                    commandString: `AI Action (${actorId}): custom:action`,
                });
                expect(logger.info).toHaveBeenCalled();
                expect(logger.debug).toHaveBeenCalled();
            });

            test('should generate default commandString if commandString is an empty string', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'core:look',
                    resolvedParameters: {},
                    commandString: '  ', // Whitespace only
                });
                const result = processor.processResponse(llmResponse, actorId, logger);

                expect(result).toEqual({
                    actionDefinitionId: 'core:look',
                    resolvedParameters: {},
                    commandString: `AI Action (${actorId}): core:look`,
                });
                expect(logger.info).toHaveBeenCalled();
                expect(logger.debug).toHaveBeenCalled();
            });

            test('should trim actionDefinitionId and commandString', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: '  core:interact  ',
                    resolvedParameters: {target: 'lever'},
                    commandString: '  pull the lever   ',
                });
                const result = processor.processResponse(llmResponse, actorId, logger);
                expect(result).toEqual({
                    actionDefinitionId: 'core:interact',
                    resolvedParameters: {target: 'lever'},
                    commandString: 'pull the lever',
                });
                expect(logger.info).toHaveBeenCalled();
            });
        });

        // --- Invalid/Malformed JSON Inputs ---
        describe('Invalid/Malformed JSON Inputs', () => {
            test('should return fallback for malformed JSON string (syntax error)', () => {
                const malformedJson = '{"actionDefinitionId": "core:speak", "resolvedParameters": {"message": "Hello"}, "commandString": "say Hello"'; // Missing closing brace
                const result = processor.processResponse(malformedJson, actorId, logger);

                expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                expect(result.resolvedParameters.errorContext).toBe('llm_processing:json_parse_error');
                expect(result.resolvedParameters.actorId).toBe(actorId);
                expect(result.resolvedParameters.problematicOutput).toBe(malformedJson);
                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}.`),
                    expect.objectContaining({
                        actorId,
                        rawResponse: malformedJson,
                        error: expect.any(SyntaxError)
                    })
                );
            });

            test('should return fallback for llmJsonResponse being null', () => {
                const result = processor.processResponse(null, actorId, logger);
                expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                expect(result.resolvedParameters.errorContext).toBe('llm_processing:json_parse_error'); // Consistent with catch block
                expect(result.resolvedParameters.actorId).toBe(actorId);
                expect(result.resolvedParameters.problematicOutput).toBeNull();
                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error: LLM JSON response is null or undefined.`),
                    expect.objectContaining({
                        actorId,
                        rawResponse: null,
                        error: expect.any(Error)
                    })
                );
            });

            test('should return fallback for llmJsonResponse being undefined', () => {
                const result = processor.processResponse(undefined, actorId, logger);
                expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                expect(result.resolvedParameters.errorContext).toBe('llm_processing:json_parse_error'); // Consistent with catch block
                expect(result.resolvedParameters.actorId).toBe(actorId);
                expect(result.resolvedParameters.problematicOutput).toBeNull();
                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error: LLM JSON response is null or undefined.`),
                    expect.objectContaining({
                        actorId,
                        rawResponse: undefined,
                        error: expect.any(Error)
                    })
                );
            });

            const nonObjectJsonValues = [
                {value: JSON.stringify("a string"), type: 'string', expectedOutput: "a string"},
                {value: JSON.stringify(true), type: 'boolean', expectedOutput: true},
                {value: JSON.stringify([1, 2, 3]), type: 'array', expectedOutput: [1, 2, 3]},
                {value: JSON.stringify(123), type: 'number', expectedOutput: 123},
            ];
            nonObjectJsonValues.forEach(item => {
                test(`should return fallback for valid JSON that is a ${item.type} not an object`, () => {
                    const result = processor.processResponse(item.value, actorId, logger);
                    expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                    expect(result.resolvedParameters.errorContext).toBe('llm_processing:invalid_output_type');
                    expect(result.resolvedParameters.actorId).toBe(actorId);
                    expect(result.resolvedParameters.problematicOutput).toEqual(item.expectedOutput);
                    expect(logger.error).toHaveBeenCalledWith(
                        // Corrected expectation for the logged type string:
                        `LLMResponseProcessor: LLM output for actor ${actorId} is not a valid object after parsing. Received type: ${item.type === 'array' ? 'array' : typeof item.expectedOutput}, Value:`,
                        {actorId, output: item.expectedOutput}
                    );
                });
            });

            test('should return fallback for valid JSON that is null literal', () => {
                const jsonNull = JSON.stringify(null); // "null"
                const result = processor.processResponse(jsonNull, actorId, logger);
                expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                expect(result.resolvedParameters.errorContext).toBe('llm_processing:invalid_output_type');
                expect(result.resolvedParameters.actorId).toBe(actorId);
                expect(result.resolvedParameters.problematicOutput).toBeNull();
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMResponseProcessor: LLM output for actor ${actorId} is not a valid object after parsing. Received type: object, Value:`, // typeof null is 'object'
                    {actorId, output: null}
                );
            });
        });

        // --- Invalid Action Structure in JSON ---
        describe('Invalid Action Structure in JSON', () => {
            test('should return fallback if actionDefinitionId key is missing', () => {
                const llmResponse = JSON.stringify({
                    // actionDefinitionId missing
                    resolvedParameters: {target: 'door'},
                    commandString: 'use door'
                });
                const parsedJson = JSON.parse(llmResponse);
                const result = processor.processResponse(llmResponse, actorId, logger);

                expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                expect(result.resolvedParameters.errorContext).toBe('llm_processing:missing_or_invalid_actionDefinitionId');
                expect(result.resolvedParameters.actorId).toBe(actorId);
                expect(result.resolvedParameters.problematicOutput).toEqual(parsedJson);
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMResponseProcessor: Invalid or missing 'actionDefinitionId' in LLM output for actor ${actorId}. Received:`,
                    {actorId, output: parsedJson}
                );
            });

            const invalidActionIds = [
                {value: null, description: 'null'},
                {value: '', description: 'empty string'},
                {value: '   ', description: 'whitespace string'},
                {value: 123, description: 'a number'},
                {value: true, description: 'a boolean'},
                {value: {}, description: 'an object'},
                {value: [], description: 'an array'},
            ];
            invalidActionIds.forEach(item => {
                test(`should return fallback if actionDefinitionId is ${item.description}`, () => {
                    const llmResponse = JSON.stringify({
                        actionDefinitionId: item.value,
                        resolvedParameters: {key: 'value'},
                        commandString: 'do something'
                    });
                    const parsedJson = JSON.parse(llmResponse);
                    const result = processor.processResponse(llmResponse, actorId, logger);

                    expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                    expect(result.resolvedParameters.errorContext).toBe('llm_processing:missing_or_invalid_actionDefinitionId');
                    expect(result.resolvedParameters.actorId).toBe(actorId);
                    expect(result.resolvedParameters.problematicOutput).toEqual(parsedJson);
                    expect(logger.error).toHaveBeenCalledWith(
                        `LLMResponseProcessor: Invalid or missing 'actionDefinitionId' in LLM output for actor ${actorId}. Received:`,
                        {actorId, output: parsedJson}
                    );
                });
            });

            const nonObjectResolvedParamsOrArray = [
                {value: "a string", description: 'a string'},
                {value: 123, description: 'a number'},
                {value: true, description: 'a boolean'},
                {value: [], description: 'an array'}, // Array should now also default to {}
            ];

            nonObjectResolvedParamsOrArray.forEach(item => {
                test(`should default resolvedParameters to {} and warn if it is ${item.description}`, () => {
                    const llmResponse = JSON.stringify({
                        actionDefinitionId: 'core:test',
                        resolvedParameters: item.value, // Invalid type or array
                        commandString: 'test command'
                    });
                    const parsedJson = JSON.parse(llmResponse);
                    const result = processor.processResponse(llmResponse, actorId, logger);

                    expect(result).toEqual({
                        actionDefinitionId: 'core:test',
                        resolvedParameters: {}, // Should default to empty object
                        commandString: 'test command',
                    });
                    expect(logger.warn).toHaveBeenCalledWith(
                        `LLMResponseProcessor: 'resolvedParameters' in LLM output for actor ${actorId} is not an object or is null. Defaulting to empty object. Received:`,
                        {actorId, output: parsedJson}
                    );
                    expect(logger.error).not.toHaveBeenCalled();
                    expect(logger.info).toHaveBeenCalled();
                });
            });

            test('should default resolvedParameters to {} and warn if it is null', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'core:perform',
                    resolvedParameters: null, // Explicitly null
                    commandString: 'perform action'
                });
                const parsedJson = JSON.parse(llmResponse);
                const result = processor.processResponse(llmResponse, actorId, logger);

                expect(result).toEqual({
                    actionDefinitionId: 'core:perform',
                    resolvedParameters: {}, // Should default to empty object
                    commandString: 'perform action',
                });
                expect(logger.warn).toHaveBeenCalledWith(
                    `LLMResponseProcessor: 'resolvedParameters' in LLM output for actor ${actorId} is not an object or is null. Defaulting to empty object. Received:`,
                    {actorId, output: parsedJson}
                );
                expect(logger.error).not.toHaveBeenCalled();
                expect(logger.info).toHaveBeenCalled();
            });
        });

        test('fallback action should always include the llm_processing prefix in errorContext', () => {
            const malformedJson = '{"invalid';
            const result = processor.processResponse(malformedJson, actorId, logger);
            expect(result.resolvedParameters.errorContext).toMatch(/^llm_processing:/);
            expect(result.resolvedParameters.actorId).toBe(actorId);
            expect(result.resolvedParameters.problematicOutput).toBe(malformedJson);
        });

    });
});

// --- FILE END ---
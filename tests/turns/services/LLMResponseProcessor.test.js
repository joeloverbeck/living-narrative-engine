// tests/turns/services/LLMResponseProcessor.test.js
// --- FILE START ---

import {LLMResponseProcessor} from '../../../src/turns/services/LLMResponseProcessor.js';
// Import the schema ID, not FALLBACK_AI_ACTION directly as its structure might differ from our processor's base fallback
import {LLM_TURN_ACTION_SCHEMA_ID} from '../../../src/turns/schemas/llmOutputSchemas.js';
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

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ISchemaValidator>}
 */
const mockSchemaValidator = () => ({
    validate: jest.fn().mockReturnValue({isValid: true, errors: []}), // Default to valid
    isSchemaLoaded: jest.fn().mockReturnValue(true), // Default to schema being loaded
});

// Define the base structure of the fallback action used by the processor
const BASE_FALLBACK_WAIT_ACTION_STRUCTURE = {
    actionDefinitionId: 'core:wait',
    commandString: 'wait', // This will be overridden by _createProcessingFallbackAction
    speech: '',
};


describe('LLMResponseProcessor', () => {
    /** @type {LLMResponseProcessor} */
    let processor;
    /** @type {ReturnType<typeof mockLogger>} */
    let logger;
    /** @type {ReturnType<typeof mockSchemaValidator>} */
    let schemaValidatorMock;
    const actorId = 'testActor123';

    beforeEach(() => {
        jest.clearAllMocks();
        logger = mockLogger();
        schemaValidatorMock = mockSchemaValidator();
        // Ensure the mock correctly reports the schema as loaded for the constructor check
        schemaValidatorMock.isSchemaLoaded.mockImplementation((schemaId) => schemaId === LLM_TURN_ACTION_SCHEMA_ID);

        processor = new LLMResponseProcessor({schemaValidator: schemaValidatorMock});
    });

    // --- Constructor Tests ---
    describe('constructor', () => {
        test('should create an instance of LLMResponseProcessor', () => {
            expect(processor).toBeInstanceOf(LLMResponseProcessor);
            expect(schemaValidatorMock.isSchemaLoaded).toHaveBeenCalledWith(LLM_TURN_ACTION_SCHEMA_ID);
        });

        test('should throw error if schemaValidator is missing', () => {
            expect(() => new LLMResponseProcessor({})).toThrow(
                "LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods."
            );
        });

        test('should throw error if schemaValidator is invalid (missing validate)', () => {
            const invalidSchemaMock = {isSchemaLoaded: jest.fn().mockReturnValue(true)};
            expect(() => new LLMResponseProcessor({schemaValidator: invalidSchemaMock})).toThrow(
                "LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods."
            );
        });

        test('should throw error if schemaValidator is invalid (missing isSchemaLoaded)', () => {
            const invalidSchemaMock = {validate: jest.fn().mockReturnValue({isValid: true, errors: []})};
            expect(() => new LLMResponseProcessor({schemaValidator: invalidSchemaMock})).toThrow(
                "LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods."
            );
        });

        test('should warn if the specific LLM schema is not loaded', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
            });
            const tempSchemaValidatorMock = mockSchemaValidator(); // New mock for this specific test
            tempSchemaValidatorMock.isSchemaLoaded.mockReturnValue(false); // Simulate schema not loaded
            new LLMResponseProcessor({schemaValidator: tempSchemaValidatorMock});
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                `LLMResponseProcessor: Schema with ID '${LLM_TURN_ACTION_SCHEMA_ID}' is not loaded in the provided schema validator. Validation will fail if this schema is required.`
            );
            consoleWarnSpy.mockRestore();
        });
    });

    // --- _createProcessingFallbackAction Tests ---
    describe('_createProcessingFallbackAction', () => {
        test('should create a fallback action with correct structure and log details', () => {
            const errorContext = 'test_error';
            const problematicOutput = {detail: 'some problem'};
            const fallbackAction = processor['_createProcessingFallbackAction'](errorContext, actorId, logger, problematicOutput);

            const expectedCommandString = `AI LLM Processing Error for ${actorId}: ${errorContext}. Executing fallback: wait.`;
            expect(fallbackAction).toEqual({
                ...BASE_FALLBACK_WAIT_ACTION_STRUCTURE,
                commandString: expectedCommandString,
            });
            expect(logger.error).toHaveBeenCalledWith(
                `LLMResponseProcessor: Creating fallback action for actor ${actorId} due to ${errorContext}.`,
                expect.objectContaining({
                    actorId,
                    errorContext,
                    problematicOutput,
                    fallbackAction: {
                        ...BASE_FALLBACK_WAIT_ACTION_STRUCTURE,
                        commandString: expectedCommandString,
                    }
                })
            );
        });

        test('should create fallback and log correctly if problematicOutput is not provided', () => {
            const errorContext = 'another_error';
            const fallbackAction = processor['_createProcessingFallbackAction'](errorContext, actorId, logger); // problematicOutput is undefined
            const expectedCommandString = `AI LLM Processing Error for ${actorId}: ${errorContext}. Executing fallback: wait.`;

            expect(fallbackAction).toEqual({
                ...BASE_FALLBACK_WAIT_ACTION_STRUCTURE,
                commandString: expectedCommandString,
            });
            // If problematicOutput is undefined when calling, it will use the default 'null' from the method signature.
            expect(logger.error).toHaveBeenCalledWith(
                `LLMResponseProcessor: Creating fallback action for actor ${actorId} due to ${errorContext}.`,
                expect.objectContaining({
                    actorId,
                    errorContext,
                    problematicOutput: null,
                    fallbackAction: {
                        ...BASE_FALLBACK_WAIT_ACTION_STRUCTURE,
                        commandString: expectedCommandString,
                    }
                })
            );
        });
    });

    // --- processResponse Method Tests ---
    describe('processResponse', () => {
        // --- Valid Inputs ---
        describe('Valid Inputs', () => {
            test('should process a valid JSON string with all fields', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'core:move',
                    commandString: 'go north',
                    speech: 'Moving north',
                });
                schemaValidatorMock.validate.mockReturnValue({isValid: true, errors: []});
                const result = processor.processResponse(llmResponse, actorId, logger);

                expect(result).toEqual({
                    actionDefinitionId: 'core:move',
                    commandString: 'go north',
                    speech: 'Moving north',
                });
                expect(logger.info).toHaveBeenCalledWith(`LLMResponseProcessor: Successfully validated and transformed LLM output to ITurnAction for actor ${actorId}. Action: core:move`);
                expect(logger.debug).toHaveBeenCalledWith(`LLMResponseProcessor: Transformed ITurnAction details for ${actorId}:`, {
                    actorId,
                    action: result,
                });
                expect(schemaValidatorMock.validate).toHaveBeenCalledWith(LLM_TURN_ACTION_SCHEMA_ID, JSON.parse(llmResponse));
            });

            test('should process valid JSON with empty speech', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'core:wait',
                    commandString: 'Wait a moment',
                    speech: ""
                });
                schemaValidatorMock.validate.mockReturnValue({isValid: true, errors: []});
                const result = processor.processResponse(llmResponse, actorId, logger);
                expect(result).toEqual({
                    actionDefinitionId: 'core:wait',
                    commandString: 'Wait a moment',
                    speech: "",
                });
                expect(logger.debug).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                    action: expect.objectContaining({speech: ""})
                }));
            });

            test('should trim actionDefinitionId and commandString', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: '  core:interact  ',
                    commandString: '  pull the lever   ',
                    speech: "Okay"
                });
                schemaValidatorMock.validate.mockReturnValue({isValid: true, errors: []});
                const result = processor.processResponse(llmResponse, actorId, logger);
                expect(result).toEqual({
                    actionDefinitionId: 'core:interact',
                    commandString: 'pull the lever',
                    speech: "Okay",
                });
            });
        });

        describe('Invalid/Malformed JSON Inputs', () => {
            test('should return fallback for malformed JSON string (syntax error)', () => {
                const malformedJson = '{"actionDefinitionId": "core:speak", "commandString": "say Hello"'; // missing closing brace
                const errorContext = 'json_parse_error';
                const result = processor.processResponse(malformedJson, actorId, logger);

                const expectedCommandString = `AI LLM Processing Error for ${actorId}: ${errorContext}. Executing fallback: wait.`;
                expect(result.actionDefinitionId).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.actionDefinitionId);
                expect(result.commandString).toBe(expectedCommandString);

                // Check the first logger.error call (from the catch block in processResponse)
                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error:`), // Check for the general error prefix
                    expect.objectContaining({
                        rawResponse: malformedJson,
                        actorId,
                        error: expect.any(SyntaxError) // Check that a SyntaxError object was logged
                    })
                );
                // Check the second logger.error call (from _createProcessingFallbackAction)
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMResponseProcessor: Creating fallback action for actor ${actorId} due to ${errorContext}.`,
                    expect.objectContaining({problematicOutput: malformedJson})
                );
            });

            test('should return fallback for llmJsonResponse being null', () => {
                const errorContext = 'json_parse_error';
                const result = processor.processResponse(null, actorId, logger);
                const expectedCommandString = `AI LLM Processing Error for ${actorId}: ${errorContext}. Executing fallback: wait.`;
                expect(result.actionDefinitionId).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.actionDefinitionId);
                expect(result.commandString).toBe(expectedCommandString);
                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error: LLM JSON response is null, undefined, or empty.`),
                    expect.objectContaining({rawResponse: null, error: expect.any(Error)})
                );
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMResponseProcessor: Creating fallback action for actor ${actorId} due to ${errorContext}.`,
                    expect.objectContaining({problematicOutput: null})
                );
            });

            test('should return fallback for llmJsonResponse being undefined', () => {
                const errorContext = 'json_parse_error';
                const result = processor.processResponse(undefined, actorId, logger);
                const expectedCommandString = `AI LLM Processing Error for ${actorId}: ${errorContext}. Executing fallback: wait.`;
                expect(result.actionDefinitionId).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.actionDefinitionId);
                expect(result.commandString).toBe(expectedCommandString);

                // Check the first logger.error call for the specific error message when input is null/undefined
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error: LLM JSON response is null, undefined, or empty.. Response:`,
                    expect.objectContaining({
                        rawResponse: undefined,
                        actorId,
                        error: expect.objectContaining({message: "LLM JSON response is null, undefined, or empty."})
                    })
                );
                // Check the second logger.error call (from _createProcessingFallbackAction)
                // When 'undefined' is passed to a parameter with a default (e.g., problematicOutput = null), the default is used.
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMResponseProcessor: Creating fallback action for actor ${actorId} due to ${errorContext}.`,
                    expect.objectContaining({problematicOutput: null}) // Corrected to expect null due to default parameter behavior
                );
            });

            const nonObjectJsonValues = [
                {valueStr: JSON.stringify("a string"), parsed: "a string", description: 'a string literal'},
                {valueStr: JSON.stringify(true), parsed: true, description: 'a boolean literal'},
                {valueStr: JSON.stringify([1, 2, 3]), parsed: [1, 2, 3], description: 'an array literal'},
                {valueStr: JSON.stringify(123), parsed: 123, description: 'a number literal'},
                {valueStr: JSON.stringify(null), parsed: null, description: 'a null literal'},
            ];

            nonObjectJsonValues.forEach(item => {
                test(`should return fallback for valid JSON that is ${item.description}`, () => {
                    const errorContext = 'json_schema_validation_error';
                    const mockValidationErrors = [{message: "should be object"}];
                    schemaValidatorMock.validate.mockReturnValueOnce({
                        isValid: false,
                        errors: mockValidationErrors
                    });
                    const result = processor.processResponse(item.valueStr, actorId, logger);
                    const expectedCommandString = `AI LLM Processing Error for ${actorId}: ${errorContext}. Executing fallback: wait.`;

                    expect(result.actionDefinitionId).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.actionDefinitionId);
                    expect(result.commandString).toBe(expectedCommandString);
                    expect(logger.error).toHaveBeenCalledWith(
                        `LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}. Errors:`,
                        expect.objectContaining({validationErrors: mockValidationErrors, parsedJson: item.parsed})
                    );
                    expect(logger.error).toHaveBeenCalledWith(
                        `LLMResponseProcessor: Creating fallback action for actor ${actorId} due to ${errorContext}.`,
                        expect.objectContaining({
                            problematicOutput: {
                                parsedJsonAttempt: item.parsed,
                                validationErrors: mockValidationErrors
                            }
                        })
                    );
                });
            });
        });

        describe('Schema Validation Failures', () => {
            const testSchemaFailure = (description, llmResponsePartial, expectedInstancePath = '') => {
                test(`should return fallback if ${description}`, () => {
                    const errorContext = 'json_schema_validation_error';
                    let baseLlmObject = {
                        actionDefinitionId: 'core:valid',
                        commandString: 'valid command',
                        speech: 'valid speech',
                    };

                    if (llmResponsePartial === undefined && expectedInstancePath) {
                        delete baseLlmObject[expectedInstancePath];
                    } else {
                        baseLlmObject = {...baseLlmObject, ...llmResponsePartial};
                    }

                    const llmResponse = JSON.stringify(baseLlmObject);
                    const parsedJson = JSON.parse(llmResponse);

                    const mockErrors = [{
                        instancePath: expectedInstancePath || (Object.keys(llmResponsePartial || {})[0] || ''),
                        message: `is invalid for ${description}`
                    }];
                    schemaValidatorMock.validate.mockReturnValueOnce({isValid: false, errors: mockErrors});

                    const result = processor.processResponse(llmResponse, actorId, logger);
                    const expectedCommandString = `AI LLM Processing Error for ${actorId}: ${errorContext}. Executing fallback: wait.`;

                    expect(result.actionDefinitionId).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.actionDefinitionId);
                    expect(result.commandString).toBe(expectedCommandString);
                    expect(logger.error).toHaveBeenCalledWith(
                        `LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}. Errors:`,
                        expect.objectContaining({validationErrors: mockErrors, parsedJson})
                    );
                    expect(logger.error).toHaveBeenCalledWith(
                        `LLMResponseProcessor: Creating fallback action for actor ${actorId} due to ${errorContext}.`,
                        expect.objectContaining({
                            problematicOutput: {
                                parsedJsonAttempt: parsedJson,
                                validationErrors: mockErrors
                            }
                        })
                    );
                });
            };

            testSchemaFailure('actionDefinitionId key is missing', undefined, 'actionDefinitionId');
            testSchemaFailure('commandString key is missing', undefined, 'commandString');
            testSchemaFailure('speech key is missing', undefined, 'speech');

            testSchemaFailure('actionDefinitionId is null', {actionDefinitionId: null});
            testSchemaFailure('actionDefinitionId is empty string', {actionDefinitionId: ""});
            testSchemaFailure('actionDefinitionId is a number', {actionDefinitionId: 123});
            testSchemaFailure('commandString is null', {commandString: null});
            testSchemaFailure('commandString is empty string', {commandString: ""});
            testSchemaFailure('speech is a number', {speech: 123});
        });

        test('fallback commandString should reflect the specific error context', () => {
            const llmResponse = JSON.stringify({actionDefinitionId: 123});
            const errorContext = 'json_schema_validation_error';
            schemaValidatorMock.validate.mockReturnValueOnce({
                isValid: false,
                errors: [{instancePath: "actionDefinitionId", message: "should be string"}]
            });
            const result = processor.processResponse(llmResponse, actorId, logger);
            const expectedCommandString = `AI LLM Processing Error for ${actorId}: ${errorContext}. Executing fallback: wait.`;
            expect(result.commandString).toBe(expectedCommandString);
            expect(logger.error).toHaveBeenCalledWith(
                `LLMResponseProcessor: Creating fallback action for actor ${actorId} due to ${errorContext}.`,
                expect.anything()
            );
        });
    });
});

// --- FILE END ---
// tests/turns/services/LLMResponseProcessor.test.js
// --- FILE START ---

import {LLMResponseProcessor} from '../../../src/turns/services/LLMResponseProcessor.js';
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

const BASE_FALLBACK_WAIT_ACTION_STRUCTURE = {
    actionDefinitionId: 'core:wait',
    commandString: 'wait',
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
        schemaValidatorMock.isSchemaLoaded.mockImplementation((schemaId) => schemaId === LLM_TURN_ACTION_SCHEMA_ID);
        processor = new LLMResponseProcessor({schemaValidator: schemaValidatorMock});
    });

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
            const tempSchemaValidatorMock = mockSchemaValidator();
            tempSchemaValidatorMock.isSchemaLoaded.mockReturnValue(false);
            new LLMResponseProcessor({schemaValidator: tempSchemaValidatorMock});
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                `LLMResponseProcessor: Schema with ID '${LLM_TURN_ACTION_SCHEMA_ID}' is not loaded in the provided schema validator. Validation will fail if this schema is required.`
            );
            consoleWarnSpy.mockRestore();
        });
    });

    describe('_createProcessingFallbackAction', () => {
        test('should create a fallback action with correct structure and log details', () => {
            const errorContext = 'test_error';
            // This object is passed as `errorDetailsInput`
            const errorDetailsInput = {customDetail: 'some problem'};
            const fallbackAction = processor['_createProcessingFallbackAction'](errorContext, actorId, logger, errorDetailsInput);

            expect(fallbackAction.actionDefinitionId).toEqual(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.actionDefinitionId);
            expect(fallbackAction.commandString).toEqual(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.commandString);
            expect(fallbackAction.speech).toEqual(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.speech);
            expect(fallbackAction.llmProcessingFailureInfo.errorContext).toEqual(errorContext);

            const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;
            expect(logger.error).toHaveBeenCalledWith(
                `LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`,
                expect.objectContaining({
                    actorId,
                    errorContext,
                    // For a generic error context, problematicOutputDetailsForLog in _createProcessingFallbackAction
                    // becomes errorDetailsInput if it's not one of the specific contexts that cherry-pick fields.
                    problematicOutputDetails: errorDetailsInput,
                    llmFailureInfo: fallbackAction.llmProcessingFailureInfo,
                    fallbackActionTaken: fallbackAction
                })
            );
        });

        test('should create fallback and log correctly if errorDetailsInput is not provided', () => {
            const errorContext = 'another_error';
            const fallbackAction = processor['_createProcessingFallbackAction'](errorContext, actorId, logger); // errorDetailsInput is null

            const expectedFallbackAction = {
                ...BASE_FALLBACK_WAIT_ACTION_STRUCTURE,
                llmProcessingFailureInfo: {
                    errorContext: errorContext,
                }
            };
            expect(fallbackAction).toEqual(expectedFallbackAction);

            const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;
            expect(logger.error).toHaveBeenCalledWith(
                `LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`,
                expect.objectContaining({
                    actorId,
                    errorContext,
                    problematicOutputDetails: null, // Because errorDetailsInput was null
                    llmFailureInfo: fallbackAction.llmProcessingFailureInfo,
                    fallbackActionTaken: expectedFallbackAction
                })
            );
        });
    });

    describe('processResponse', () => {
        describe('Valid Inputs', () => {
            test('should process a valid JSON string with all fields', async () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'core:move',
                    commandString: 'go north',
                    speech: 'Moving north',
                });
                schemaValidatorMock.validate.mockReturnValue({isValid: true, errors: []});
                const result = await processor.processResponse(llmResponse, actorId, logger);

                expect(result).toEqual({
                    actionDefinitionId: 'core:move',
                    commandString: 'go north',
                    speech: 'Moving north',
                });
                expect(logger.info).toHaveBeenCalledWith(`LLMResponseProcessor: Successfully validated and transformed LLM output to ProcessedTurnAction for actor ${actorId}. Action: core:move`);
                expect(logger.debug).toHaveBeenCalledWith(`LLMResponseProcessor: Transformed ProcessedTurnAction details for ${actorId}:`, {
                    actorId,
                    action: result,
                });
                expect(schemaValidatorMock.validate).toHaveBeenCalledWith(LLM_TURN_ACTION_SCHEMA_ID, JSON.parse(llmResponse));
            });

            test('should process valid JSON with empty speech', async () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'core:wait',
                    commandString: 'Wait a moment',
                    speech: ""
                });
                schemaValidatorMock.validate.mockReturnValue({isValid: true, errors: []});
                const result = await processor.processResponse(llmResponse, actorId, logger);
                expect(result).toEqual({
                    actionDefinitionId: 'core:wait',
                    commandString: 'Wait a moment',
                    speech: "",
                });
                expect(logger.debug).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                    action: expect.objectContaining({speech: ""})
                }));
            });

            test('should trim actionDefinitionId and commandString', async () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: '  core:interact  ',
                    commandString: '  pull the lever   ',
                    speech: "Okay"
                });
                schemaValidatorMock.validate.mockReturnValue({isValid: true, errors: []});
                const result = await processor.processResponse(llmResponse, actorId, logger);
                expect(result).toEqual({
                    actionDefinitionId: 'core:interact',
                    commandString: 'pull the lever',
                    speech: "Okay",
                });
            });
        });

        describe('Invalid/Malformed JSON Inputs', () => {
            test('should return fallback for malformed JSON string (syntax error)', async () => {
                const malformedJson = '{"actionDefinitionId": "core:speak", "commandString": "say Hello"';
                // errorContext determined by parseAndRepairJson (will be 'json_parse_error' due to JsonProcessingError)
                const result = await processor.processResponse(malformedJson, actorId, logger);

                expect(result.actionDefinitionId).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.actionDefinitionId);
                expect(result.commandString).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.commandString);
                expect(result.speech).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.speech);
                expect(result.llmProcessingFailureInfo).toBeDefined();
                expect(result.llmProcessingFailureInfo.errorContext).toBe('json_parse_error');
                expect(result.llmProcessingFailureInfo.rawResponse).toBe(malformedJson);


                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Failed to parse/repair LLM JSON response for actor ${actorId}. Error:`),
                    expect.objectContaining({
                        rawResponse: malformedJson,
                        actorId,
                        errorName: 'JsonProcessingError',
                    })
                );
                const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${result.llmProcessingFailureInfo.errorContext}.`;
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`,
                    expect.objectContaining({
                        actorId,
                        errorContext: result.llmProcessingFailureInfo.errorContext,
                        // problematicOutputDetails for json_parse_error will be the rawLlmResponse (or cleaned if available from error)
                        problematicOutputDetails: malformedJson,
                        fallbackActionTaken: result
                    })
                );
            });

            test('should return fallback for llmJsonResponse being null', async () => {
                const errorContext = 'invalid_input_type';
                const result = await processor.processResponse(null, actorId, logger);

                expect(result.commandString).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.commandString);
                expect(result.llmProcessingFailureInfo).toBeDefined();
                expect(result.llmProcessingFailureInfo.errorContext).toBe(errorContext);
                expect(result.llmProcessingFailureInfo.rawResponse).toBeNull();

                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Invalid input type for LLM JSON response for actor ${actorId}. Error:`),
                    expect.objectContaining({rawResponse: null, errorName: 'TypeError'})
                );
                const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`,
                    expect.objectContaining({
                        problematicOutputDetails: null, // rawLlmResponse (null) passed as errorDetailsInput
                        fallbackActionTaken: result
                    })
                );
            });

            test('should return fallback for llmJsonResponse being undefined', async () => {
                const errorContext = 'invalid_input_type';
                const result = await processor.processResponse(undefined, actorId, logger);

                expect(result.commandString).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.commandString);
                expect(result.llmProcessingFailureInfo).toBeDefined();
                expect(result.llmProcessingFailureInfo.errorContext).toBe(errorContext);
                expect(result.llmProcessingFailureInfo.rawResponse).toBeUndefined();

                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Invalid input type for LLM JSON response for actor ${actorId}. Error:`),
                    expect.objectContaining({
                        rawResponse: undefined,
                        errorName: 'TypeError'
                    })
                );
                const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;
                expect(logger.error).toHaveBeenCalledWith(
                    `LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`,
                    expect.objectContaining({
                        problematicOutputDetails: undefined, // rawLlmResponse (undefined) passed as errorDetailsInput
                        fallbackActionTaken: result
                    })
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
                test(`should return fallback for valid JSON that is ${item.description}`, async () => {
                    const errorContext = 'json_schema_validation_error';
                    const mockValidationErrors = [{message: "should be object"}];
                    schemaValidatorMock.validate.mockImplementation((schemaId, dataToValidate) => {
                        if (typeof dataToValidate !== 'object' || dataToValidate === null || Array.isArray(dataToValidate)) {
                            return {isValid: false, errors: mockValidationErrors};
                        }
                        return {isValid: true, errors: []};
                    });

                    const result = await processor.processResponse(item.valueStr, actorId, logger);

                    expect(result.commandString).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.commandString);
                    expect(result.llmProcessingFailureInfo).toBeDefined();
                    expect(result.llmProcessingFailureInfo.errorContext).toBe(errorContext);
                    expect(result.llmProcessingFailureInfo.parsedResponse).toEqual(item.parsed);
                    expect(result.llmProcessingFailureInfo.validationErrors).toEqual(mockValidationErrors);

                    expect(logger.error).toHaveBeenCalledWith(
                        `LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}. Errors:`,
                        expect.objectContaining({validationErrors: mockValidationErrors, parsedJson: item.parsed})
                    );
                    const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;
                    expect(logger.error).toHaveBeenCalledWith(
                        `LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`,
                        expect.objectContaining({
                            errorContext: 'json_schema_validation_error',
                            // CORRECTED: problematicOutputDetails should be the parsed value itself
                            problematicOutputDetails: item.parsed,
                            fallbackActionTaken: result,
                            llmFailureInfo: expect.objectContaining({
                                rawResponse: item.valueStr,
                                parsedResponse: item.parsed,
                                validationErrors: mockValidationErrors
                            })
                        })
                    );
                });
            });
        });

        describe('Schema Validation Failures', () => {
            const testSchemaFailure = (description, llmResponsePartial, expectedInstancePath = '') => {
                test(`should return fallback if ${description}`, async () => {
                    const errorContext = 'json_schema_validation_error';
                    let baseLlmObject = {
                        actionDefinitionId: 'core:valid',
                        commandString: 'valid command',
                        speech: 'valid speech',
                    };

                    if (llmResponsePartial === undefined && expectedInstancePath) {
                        const tempBase = {...baseLlmObject};
                        delete tempBase[expectedInstancePath];
                        baseLlmObject = tempBase;
                    } else if (llmResponsePartial !== undefined) {
                        baseLlmObject = {...baseLlmObject, ...llmResponsePartial};
                    }

                    const llmResponse = JSON.stringify(baseLlmObject);
                    const parsedJson = JSON.parse(llmResponse);

                    const mockErrors = [{
                        instancePath: expectedInstancePath || (Object.keys(llmResponsePartial || {})[0] || ''),
                        message: `is invalid for ${description}`
                    }];
                    schemaValidatorMock.validate.mockReturnValueOnce({isValid: false, errors: mockErrors});

                    const result = await processor.processResponse(llmResponse, actorId, logger);

                    expect(result.commandString).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.commandString);
                    expect(result.llmProcessingFailureInfo).toBeDefined();
                    expect(result.llmProcessingFailureInfo.errorContext).toBe(errorContext);
                    expect(result.llmProcessingFailureInfo.parsedResponse).toEqual(parsedJson);
                    expect(result.llmProcessingFailureInfo.validationErrors).toEqual(mockErrors);

                    expect(logger.error).toHaveBeenCalledWith(
                        `LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}. Errors:`,
                        expect.objectContaining({validationErrors: mockErrors, parsedJson})
                    );
                    const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;
                    expect(logger.error).toHaveBeenCalledWith(
                        `LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`,
                        expect.objectContaining({
                            errorContext: 'json_schema_validation_error',
                            // CORRECTED: problematicOutputDetails should be the parsed JSON object
                            problematicOutputDetails: parsedJson,
                            fallbackActionTaken: result,
                            llmFailureInfo: expect.objectContaining({
                                rawResponse: llmResponse,
                                parsedResponse: parsedJson,
                                validationErrors: mockErrors
                            })
                        })
                    );
                });
            };

            testSchemaFailure('actionDefinitionId key is missing', undefined, 'actionDefinitionId');
            testSchemaFailure('commandString key is missing', undefined, 'commandString');
            testSchemaFailure('speech key is missing', undefined, 'speech');
            testSchemaFailure('actionDefinitionId is null', {actionDefinitionId: null}, 'actionDefinitionId');
            testSchemaFailure('actionDefinitionId is empty string', {actionDefinitionId: ""}, 'actionDefinitionId');
            testSchemaFailure('actionDefinitionId is a number', {actionDefinitionId: 123}, 'actionDefinitionId');
            testSchemaFailure('commandString is null', {commandString: null}, 'commandString');
            testSchemaFailure('commandString is empty string', {commandString: ""}, 'commandString');
            testSchemaFailure('speech is a number', {speech: 123}, 'speech');
        });

        test('fallback now has clean commandString, error context is in llmProcessingFailureInfo', async () => {
            const llmResponse = JSON.stringify({actionDefinitionId: 123});
            const errorContext = 'json_schema_validation_error';
            const mockValidationErrors = [{instancePath: "actionDefinitionId", message: "should be string"}];
            schemaValidatorMock.validate.mockReturnValueOnce({
                isValid: false,
                errors: mockValidationErrors
            });
            const result = await processor.processResponse(llmResponse, actorId, logger);
            const parsedLlmResponse = JSON.parse(llmResponse);

            expect(result.commandString).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.commandString);
            expect(result.actionDefinitionId).toBe(BASE_FALLBACK_WAIT_ACTION_STRUCTURE.actionDefinitionId);

            expect(result.llmProcessingFailureInfo).toBeDefined();
            expect(result.llmProcessingFailureInfo.errorContext).toBe(errorContext);
            expect(result.llmProcessingFailureInfo.parsedResponse).toEqual(parsedLlmResponse);
            expect(result.llmProcessingFailureInfo.validationErrors).toEqual(mockValidationErrors);
            expect(result.llmProcessingFailureInfo.rawResponse).toBe(llmResponse);


            const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;
            expect(logger.error).toHaveBeenCalledWith(
                `LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`,
                expect.objectContaining({
                    actorId,
                    errorContext,
                    // CORRECTED: problematicOutputDetails should be the parsed JSON object
                    problematicOutputDetails: parsedLlmResponse,
                    fallbackActionTaken: result,
                    llmFailureInfo: expect.objectContaining({
                        rawResponse: llmResponse,
                        parsedResponse: parsedLlmResponse,
                        validationErrors: mockValidationErrors
                    })
                })
            );
        });
    });
});

// --- FILE END ---
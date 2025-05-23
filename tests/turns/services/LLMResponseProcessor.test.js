// tests/turns/services/LLMResponseProcessor.test.js
// --- FILE START ---

import {LLMResponseProcessor} from '../../../src/turns/services/LLMResponseProcessor.js';
import {FALLBACK_AI_ACTION} from '../../../src/turns/constants/aiConstants.js';
import {LLM_TURN_ACTION_SCHEMA_ID} from '../../../src/turns/schemas/llmOutputSchemas.js'; // Import the schema ID
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


describe('LLMResponseProcessor', () => {
    /** @type {LLMResponseProcessor} */
    let processor;
    /** @type {ReturnType<typeof mockLogger>} */
    let logger;
    /** @type {ReturnType<typeof mockSchemaValidator>} */
    let schemaValidatorMock;
    const actorId = 'testActor123';
    const baseFallbackResolvedParams = FALLBACK_AI_ACTION.resolvedParameters || {};

    beforeEach(() => {
        jest.clearAllMocks(); // Moved to the beginning
        logger = mockLogger();
        schemaValidatorMock = mockSchemaValidator();
        schemaValidatorMock.isSchemaLoaded.mockImplementation((schemaId) => schemaId === LLM_TURN_ACTION_SCHEMA_ID);

        processor = new LLMResponseProcessor({schemaValidator: schemaValidatorMock});
        // Note: jest.clearAllMocks() was here, moved to the top of beforeEach
    });

    // --- Constructor Tests ---
    describe('constructor', () => {
        test('should create an instance of LLMResponseProcessor', () => {
            // Processor is created in beforeEach, which now runs AFTER clearAllMocks for its internal calls
            // but BEFORE this test's expects. The isSchemaLoaded IS called during new LLMResponseProcessor.
            // The beforeEach for schemaValidatorMock.isSchemaLoaded setup is vital.
            expect(processor).toBeInstanceOf(LLMResponseProcessor);
            expect(schemaValidatorMock.isSchemaLoaded).toHaveBeenCalledWith(LLM_TURN_ACTION_SCHEMA_ID);
        });

        test('should throw error if schemaValidator is missing', () => {
            expect(() => new LLMResponseProcessor({})).toThrow(
                "LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods."
            );
        });

        test('should throw error if schemaValidator is invalid (missing validate)', () => {
            // Create a fresh mock for this specific failing constructor scenario
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
            // Need to create a new mock for this specific constructor scenario
            const tempSchemaValidatorMock = mockSchemaValidator();
            tempSchemaValidatorMock.isSchemaLoaded.mockImplementation((schemaId) => {
                if (schemaId === LLM_TURN_ACTION_SCHEMA_ID) return false;
                return true;
            });
            new LLMResponseProcessor({schemaValidator: tempSchemaValidatorMock}); // This call will trigger the warn
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                `LLMResponseProcessor: Schema with ID '${LLM_TURN_ACTION_SCHEMA_ID}' is not loaded in the provided schema validator. Validation will fail if this schema is required.`
            );
            consoleWarnSpy.mockRestore();
        });
    });

    // --- _createProcessingFallbackAction Tests ---
    describe('_createProcessingFallbackAction', () => {
        test('should create a fallback action with correct structure and details', () => {
            const errorContext = 'test_error';
            const problematicOutput = {detail: 'some problem'};
            const fallbackAction = processor['_createProcessingFallbackAction'](errorContext, actorId, problematicOutput);

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
            const fallbackAction = processor['_createProcessingFallbackAction'](errorContext, actorId);
            const expectedResolvedParameters = {
                ...baseFallbackResolvedParams,
                errorContext: `llm_processing:${errorContext}`,
                actorId: actorId,
            };
            expect(fallbackAction.resolvedParameters).toEqual(expectedResolvedParameters);
        });


        test('should not include problematicOutput in resolvedParameters if not provided', () => {
            const errorContext = 'yet_another_error';
            const fallbackAction = processor['_createProcessingFallbackAction'](errorContext, actorId);
            expect(fallbackAction.resolvedParameters).not.toHaveProperty('problematicOutput');
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
                    speech: 'Moving north',
                });
                schemaValidatorMock.validate.mockReturnValue({isValid: true, errors: []});
                const result = processor.processResponse(llmResponse, actorId, logger);

                expect(result).toEqual({
                    actionDefinitionId: 'core:move',
                    resolvedParameters: {direction: 'north'},
                    commandString: 'go north',
                });
                expect(logger.info).toHaveBeenCalledWith(`LLMResponseProcessor: Successfully validated and transformed LLM output to ITurnAction for actor ${actorId}. Action: core:move`);
                expect(logger.debug).toHaveBeenCalledWith(`LLMResponseProcessor: Transformed ITurnAction details for ${actorId}:`, {
                    actorId,
                    action: result,
                    speechOutput: "Moving north"
                });
                expect(schemaValidatorMock.validate).toHaveBeenCalledWith(LLM_TURN_ACTION_SCHEMA_ID, JSON.parse(llmResponse));
            });

            test('should process valid JSON with resolvedParameters as an empty object and empty speech', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: 'core:wait',
                    resolvedParameters: {},
                    commandString: 'Wait a moment',
                    speech: ""
                });
                schemaValidatorMock.validate.mockReturnValue({isValid: true, errors: []});
                const result = processor.processResponse(llmResponse, actorId, logger);
                expect(result).toEqual({
                    actionDefinitionId: 'core:wait',
                    resolvedParameters: {},
                    commandString: 'Wait a moment',
                });
                expect(logger.debug).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({speechOutput: ""}));
            });

            test('should trim actionDefinitionId and commandString', () => {
                const llmResponse = JSON.stringify({
                    actionDefinitionId: '  core:interact  ',
                    resolvedParameters: {target: 'lever'},
                    commandString: '  pull the lever   ',
                    speech: "Okay"
                });
                schemaValidatorMock.validate.mockReturnValue({isValid: true, errors: []});
                const result = processor.processResponse(llmResponse, actorId, logger);
                expect(result).toEqual({
                    actionDefinitionId: 'core:interact',
                    resolvedParameters: {target: 'lever'},
                    commandString: 'pull the lever',
                });
            });
        });

        describe('Invalid/Malformed JSON Inputs', () => {
            test('should return fallback for malformed JSON string (syntax error)', () => {
                const malformedJson = '{"actionDefinitionId": "core:speak", "commandString": "say Hello"';
                const result = processor.processResponse(malformedJson, actorId, logger);
                expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                expect(result.resolvedParameters.errorContext).toBe('llm_processing:json_parse_error');
                expect(result.resolvedParameters.problematicOutput).toBe(malformedJson);
            });

            test('should return fallback for llmJsonResponse being null', () => {
                const result = processor.processResponse(null, actorId, logger);
                expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                expect(result.resolvedParameters.errorContext).toBe('llm_processing:json_parse_error');
                // If llmJsonResponse is null, problematicOutput passed to _createProcessingFallbackAction is null.
                // The current _createProcessingFallbackAction logic:
                // if (problematicOutput !== null && typeof problematicOutput !== 'undefined')
                // This means the 'problematicOutput' key will NOT be set.
                expect(result.resolvedParameters).not.toHaveProperty('problematicOutput'); // Changed from toBeNull()
                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error: LLM JSON response is null, undefined, or empty.`),
                    expect.objectContaining({rawResponse: null})
                );
            });

            test('should return fallback for llmJsonResponse being undefined', () => {
                const result = processor.processResponse(undefined, actorId, logger);
                expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                expect(result.resolvedParameters.errorContext).toBe('llm_processing:json_parse_error');
                expect(result.resolvedParameters).not.toHaveProperty('problematicOutput');
                expect(logger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`LLMResponseProcessor: Failed to parse LLM JSON response for actor ${actorId}. Error: LLM JSON response is null, undefined, or empty.`),
                    expect.objectContaining({rawResponse: undefined})
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
                    schemaValidatorMock.validate.mockReturnValueOnce({
                        isValid: false,
                        errors: [{message: "should be object"}]
                    });
                    const result = processor.processResponse(item.valueStr, actorId, logger);
                    expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                    expect(result.resolvedParameters.errorContext).toBe('llm_processing:json_schema_validation_error');
                    expect(result.resolvedParameters.problematicOutput).toEqual({
                        parsedJsonAttempt: item.parsed,
                        validationErrors: [{message: "should be object"}]
                    });
                });
            });
        });

        describe('Schema Validation Failures', () => {
            const testSchemaFailure = (description, llmResponsePartial) => {
                test(`should return fallback if ${description}`, () => {
                    const llmResponse = JSON.stringify({
                        actionDefinitionId: 'core:valid',
                        commandString: 'valid command',
                        resolvedParameters: {},
                        speech: '',
                        ...llmResponsePartial
                    });
                    const parsedJson = JSON.parse(llmResponse);
                    const mockErrors = [{
                        instancePath: Object.keys(llmResponsePartial)[0] || '',
                        message: `is invalid for ${description}`
                    }];
                    schemaValidatorMock.validate.mockReturnValueOnce({isValid: false, errors: mockErrors});

                    const result = processor.processResponse(llmResponse, actorId, logger);
                    expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION.actionDefinitionId);
                    expect(result.resolvedParameters.errorContext).toBe('llm_processing:json_schema_validation_error');
                    expect(result.resolvedParameters.problematicOutput).toEqual({
                        parsedJsonAttempt: parsedJson,
                        validationErrors: mockErrors
                    });
                });
            };

            testSchemaFailure('actionDefinitionId key is missing', {actionDefinitionId: undefined});
            testSchemaFailure('commandString key is missing', {commandString: undefined});
            testSchemaFailure('resolvedParameters key is missing', {resolvedParameters: undefined});
            testSchemaFailure('speech key is missing', {speech: undefined});
            testSchemaFailure('actionDefinitionId is null', {actionDefinitionId: null});
            testSchemaFailure('actionDefinitionId is empty string', {actionDefinitionId: ""});
            testSchemaFailure('actionDefinitionId is a number', {actionDefinitionId: 123});
            testSchemaFailure('commandString is null', {commandString: null});
            testSchemaFailure('commandString is empty string', {commandString: ""});
            testSchemaFailure('resolvedParameters is a string', {resolvedParameters: "not-an-object"});
            testSchemaFailure('speech is a number', {speech: 123});
        });

        test('fallback action should always include the llm_processing prefix in errorContext', () => {
            const llmResponse = JSON.stringify({actionDefinitionId: 123});
            schemaValidatorMock.validate.mockReturnValueOnce({
                isValid: false,
                errors: [{message: "some schema error"}]
            });
            const result = processor.processResponse(llmResponse, actorId, logger);
            expect(result.resolvedParameters.errorContext).toMatch(/^llm_processing:/);
            expect(result.resolvedParameters.errorContext).toBe('llm_processing:json_schema_validation_error');
        });
    });
});

// --- FILE END ---
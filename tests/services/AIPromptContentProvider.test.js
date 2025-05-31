// tests/services/AIPromptContentProvider.test.js
// --- FILE START ---

import {AIPromptContentProvider} from '../../src/services/AIPromptContentProvider.js';
import {
    DEFAULT_FALLBACK_CHARACTER_NAME,
    ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING,
    // PROMPT_FALLBACK_UNKNOWN_LOCATION is not directly asserted for locationName,
    // as "an unknown place" is used per ticket.
} from '../../src/constants/textDefaults.js';
import {jest, describe, beforeEach, test, expect, afterEach} from '@jest/globals';

/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/interfaces/IPromptStaticContentService.js').IPromptStaticContentService} IPromptStaticContentService */
/** @typedef {import('../../src/turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../../src/types/promptData.js').PromptData} PromptData */
/** @typedef {import('../../src/services/AIPromptContentProvider.js').RawPerceptionLogEntry} RawPerceptionLogEntry */


/**
 * @returns {jest.Mocked<ILogger>}
 */
const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

describe('AIPromptContentProvider', () => {
    /** @type {AIPromptContentProvider} */
    let provider;
    /** @type {jest.Mocked<ILogger>} */
    let mockLoggerInstance;
    /** @type {jest.Mocked<IPromptStaticContentService>} */
    let mockPromptStaticContentService;

    // Spy for the new instance method
    /** @type {jest.SpyInstance} */
    let validateGameStateForPromptingSpy;

    // Spies for other instance methods
    /** @type {jest.SpyInstance} */
    let getTaskDefinitionContentSpy;
    /** @type {jest.SpyInstance} */
    let getCharacterPersonaContentSpy;
    /** @type {jest.SpyInstance} */
    let getCharacterPortrayalGuidelinesContentSpy;
    /** @type {jest.SpyInstance} */
    let getContentPolicyContentSpy;
    /** @type {jest.SpyInstance} */
    let getWorldContextContentSpy;
    /** @type {jest.SpyInstance} */
    let getAvailableActionsInfoContentSpy;
    /** @type {jest.SpyInstance} */
    let getFinalInstructionsContentSpy;

    const MOCK_TASK_DEF = "Mocked Task Definition";
    const MOCK_PERSONA = "Mocked Persona";
    const MOCK_PORTRAYAL = "Mocked Portrayal Guidelines";
    const MOCK_POLICY = "Mocked Content Policy";
    const MOCK_WORLD_CONTEXT = "Mocked World Context";
    const MOCK_ACTIONS_INFO = "Mocked Available Actions";
    const MOCK_FINAL_INSTR = "Mocked Final Instructions";

    beforeEach(() => {
        mockLoggerInstance = mockLogger();
        mockPromptStaticContentService = {
            getCoreTaskDescriptionText: jest.fn().mockReturnValue(MOCK_TASK_DEF),
            getCharacterPortrayalGuidelines: jest.fn().mockReturnValue(MOCK_PORTRAYAL),
            getNc21ContentPolicyText: jest.fn().mockReturnValue(MOCK_POLICY),
            getFinalLlmInstructionText: jest.fn().mockReturnValue(MOCK_FINAL_INSTR),
        };

        provider = new AIPromptContentProvider({
            promptStaticContentService: mockPromptStaticContentService
        });


        // Spy on the new instance method and provide a default mock implementation
        validateGameStateForPromptingSpy = jest.spyOn(provider, 'validateGameStateForPrompting')
            .mockReturnValue({isValid: true, errorContent: null});

        // Spy on other instance methods called by getPromptData
        // These methods in AIPromptContentProvider now delegate to promptStaticContentService.
        // Spying on them directly intercepts the call before delegation, which is suitable
        // if we want to test getPromptData's assembly logic independently of the
        // actual content returned by the delegated methods.
        // The mockPromptStaticContentService above ensures that if these spies were removed
        // and the actual methods were called, they would delegate to functions returning
        // the MOCK_ values.
        getTaskDefinitionContentSpy = jest.spyOn(provider, 'getTaskDefinitionContent').mockReturnValue(MOCK_TASK_DEF);
        getCharacterPersonaContentSpy = jest.spyOn(provider, 'getCharacterPersonaContent').mockReturnValue(MOCK_PERSONA);
        getCharacterPortrayalGuidelinesContentSpy = jest.spyOn(provider, 'getCharacterPortrayalGuidelinesContent').mockReturnValue(MOCK_PORTRAYAL);
        getContentPolicyContentSpy = jest.spyOn(provider, 'getContentPolicyContent').mockReturnValue(MOCK_POLICY);
        getWorldContextContentSpy = jest.spyOn(provider, 'getWorldContextContent').mockReturnValue(MOCK_WORLD_CONTEXT);
        getAvailableActionsInfoContentSpy = jest.spyOn(provider, 'getAvailableActionsInfoContent').mockReturnValue(MOCK_ACTIONS_INFO);
        getFinalInstructionsContentSpy = jest.spyOn(provider, 'getFinalInstructionsContent').mockReturnValue(MOCK_FINAL_INSTR);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getPromptData', () => {
        test('should throw an error if gameStateDto is null (validation fails)', async () => {
            // Configure the spy to simulate validateGameStateForPrompting's behavior when gameStateDto is null
            validateGameStateForPromptingSpy.mockImplementation((gameStateDto, logger) => {
                if (!gameStateDto) {
                    logger?.error("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is null or undefined.");
                    return {isValid: false, errorContent: ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING};
                }
                return {isValid: true, errorContent: null}; // Should not reach here in this test path
            });

            await expect(provider.getPromptData(null, mockLoggerInstance))
                .rejects
                .toThrow(ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING);

            // Check that validateGameStateForPrompting was called and logged its specific error
            expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(null, mockLoggerInstance);
            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                "AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is null or undefined."
            );
            // Check that getPromptData also logged the failure from validation
            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                `AIPromptContentProvider.getPromptData: Critical game state validation failed. Reason: ${ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING}`
            );
        });

        test('should throw an error if validateGameStateForPrompting returns isValid false', async () => {
            const dummyGameStateDto = {actorState: {}}; // Dummy DTO
            const criticalErrorMsg = "Simulated critical state failure from validation";
            validateGameStateForPromptingSpy.mockReturnValueOnce({isValid: false, errorContent: criticalErrorMsg});

            await expect(provider.getPromptData(dummyGameStateDto, mockLoggerInstance))
                .rejects
                .toThrow(criticalErrorMsg); // Error message should now be what validateGameStateForPrompting provides

            expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(dummyGameStateDto, mockLoggerInstance);
            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                `AIPromptContentProvider.getPromptData: Critical game state validation failed. Reason: ${criticalErrorMsg}`
            );
        });

        test('should use default fallbacks for missing optional data in gameStateDto', async () => {
            /** @type {AIGameStateDTO} */
            const minimalDto = {
                actorState: {id: 'actor123'}, // Assume validateGameStateForPrompting deems this part OK
                actorPromptData: null,
                currentUserInput: undefined,
                perceptionLog: null,
                currentLocation: undefined,
                // availableActions: undefined, // This was missing in original test data, but getAvailableActionsInfoContent is spied
            };
            // Ensure validateGameStateForPrompting is explicitly set to valid for this test case,
            // overriding the default mock if necessary for clarity or specific sub-validation behavior.
            validateGameStateForPromptingSpy.mockReturnValueOnce({isValid: true, errorContent: null});


            const promptData = await provider.getPromptData(minimalDto, mockLoggerInstance);

            expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(minimalDto, mockLoggerInstance);
            expect(promptData.characterName).toBe(DEFAULT_FALLBACK_CHARACTER_NAME);
            expect(promptData.userInputContent).toBe("");
            expect(promptData.perceptionLogArray).toEqual([]);
            expect(promptData.locationName).toBe("an unknown place");

            expect(getCharacterPortrayalGuidelinesContentSpy).toHaveBeenCalledWith(DEFAULT_FALLBACK_CHARACTER_NAME);
            expect(getCharacterPersonaContentSpy).toHaveBeenCalledWith(minimalDto, mockLoggerInstance);
        });

        test('should correctly assemble PromptData with all fields from a full gameStateDto', async () => {
            const testCharName = 'Test Character';
            const testUserInput = 'What is happening?';
            const testLocationName = 'The Eerie Sanctum';

            /** @type {RawPerceptionLogEntry[]} */
            const testRawPerceptionInput = [{
                descriptionText: 'A strange noise',
                timestamp: 1, // Corrected: Jest expects number for timestamp if used as such. Assuming it's a number or stringifiable.
                perceptionType: 'sight',
                eventId: 'evt-001',
                actorId: 'act-002',
                targetId: 'tgt-003'
            }];

            /** @type {AIGameStateDTO} */
            const fullDto = {
                actorState: {id: 'actorTest'},
                actorPromptData: {name: testCharName, description: 'A curious adventurer.'},
                currentUserInput: testUserInput,
                perceptionLog: testRawPerceptionInput,
                currentLocation: {
                    name: testLocationName,
                    description: 'A place of mystery.',
                    exits: [],
                    characters: []
                },
                availableActions: [],
            };
            validateGameStateForPromptingSpy.mockReturnValueOnce({isValid: true, errorContent: null});


            const promptData = await provider.getPromptData(fullDto, mockLoggerInstance);

            const expectedMappedPerceptionLog = [{
                content: 'A strange noise',
                timestamp: 1,
                type: 'sight',
                eventId: 'evt-001',
                actorId: 'act-002',
                targetId: 'tgt-003'
            }];


            expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(fullDto, mockLoggerInstance);
            expect(promptData).toEqual({
                taskDefinitionContent: MOCK_TASK_DEF,
                characterPersonaContent: MOCK_PERSONA,
                portrayalGuidelinesContent: MOCK_PORTRAYAL,
                contentPolicyContent: MOCK_POLICY,
                worldContextContent: MOCK_WORLD_CONTEXT,
                availableActionsInfoContent: MOCK_ACTIONS_INFO,
                userInputContent: testUserInput,
                finalInstructionsContent: MOCK_FINAL_INSTR,
                perceptionLogArray: expectedMappedPerceptionLog,
                characterName: testCharName,
                locationName: testLocationName,
            });

            expect(getTaskDefinitionContentSpy).toHaveBeenCalled();
            expect(getCharacterPersonaContentSpy).toHaveBeenCalledWith(fullDto, mockLoggerInstance);
            expect(getCharacterPortrayalGuidelinesContentSpy).toHaveBeenCalledWith(testCharName);
            expect(getContentPolicyContentSpy).toHaveBeenCalled();
            expect(getWorldContextContentSpy).toHaveBeenCalledWith(fullDto, mockLoggerInstance);
            expect(getAvailableActionsInfoContentSpy).toHaveBeenCalledWith(fullDto, mockLoggerInstance);
            expect(getFinalInstructionsContentSpy).toHaveBeenCalled();
            expect(mockLoggerInstance.info).toHaveBeenCalledWith("AIPromptContentProvider.getPromptData: PromptData assembled successfully.");
        });

        test('should correctly use DEFAULT_FALLBACK_CHARACTER_NAME if actorPromptData.name is missing', async () => {
            /** @type {AIGameStateDTO} */
            const dtoWithoutCharName = {
                actorState: {id: 'actorNoName'},
                actorPromptData: {description: 'Nameless one'}, // name is missing
                currentUserInput: "Input",
                perceptionLog: [],
                currentLocation: {name: "Someplace", description: '', exits: [], characters: []},
                // availableActions: [], // This was missing, ensure it's covered if needed
            };
            validateGameStateForPromptingSpy.mockReturnValueOnce({isValid: true, errorContent: null});

            const promptData = await provider.getPromptData(dtoWithoutCharName, mockLoggerInstance);
            expect(promptData.characterName).toBe(DEFAULT_FALLBACK_CHARACTER_NAME);
            expect(getCharacterPortrayalGuidelinesContentSpy).toHaveBeenCalledWith(DEFAULT_FALLBACK_CHARACTER_NAME);
        });

        test('should use empty string if currentUserInput is null or undefined', async () => {
            /** @type {AIGameStateDTO} */
            const dtoNullInput = {actorState: {}, actorPromptData: {name: 'Char'}, currentUserInput: null};
            /** @type {AIGameStateDTO} */
            const dtoUndefinedInput = {actorState: {}, actorPromptData: {name: 'Char'}, currentUserInput: undefined};

            validateGameStateForPromptingSpy.mockReturnValue({isValid: true, errorContent: null});

            let promptData = await provider.getPromptData(dtoNullInput, mockLoggerInstance);
            expect(promptData.userInputContent).toBe("");
            expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(dtoNullInput, mockLoggerInstance);


            promptData = await provider.getPromptData(dtoUndefinedInput, mockLoggerInstance);
            expect(promptData.userInputContent).toBe("");
            expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(dtoUndefinedInput, mockLoggerInstance);
        });

        test('should use empty array if perceptionLog is null or undefined', async () => {
            /** @type {AIGameStateDTO} */
            const dtoNullLog = {actorState: {}, actorPromptData: {name: 'Char'}, perceptionLog: null};
            /** @type {AIGameStateDTO} */
            const dtoUndefinedLog = {actorState: {}, actorPromptData: {name: 'Char'}, perceptionLog: undefined};
            validateGameStateForPromptingSpy.mockReturnValue({isValid: true, errorContent: null});

            let promptData = await provider.getPromptData(dtoNullLog, mockLoggerInstance);
            expect(promptData.perceptionLogArray).toEqual([]);

            promptData = await provider.getPromptData(dtoUndefinedLog, mockLoggerInstance);
            expect(promptData.perceptionLogArray).toEqual([]);
        });

        test('should use "an unknown place" if currentLocation or its name is missing', async () => {
            /** @type {AIGameStateDTO} */
            const dtoNullLocation = {actorState: {}, actorPromptData: {name: 'Char'}, currentLocation: null};
            /** @type {AIGameStateDTO} */
            const dtoUndefinedLocation = {actorState: {}, actorPromptData: {name: 'Char'}, currentLocation: undefined};
            /** @type {AIGameStateDTO} */
            const dtoLocationNoName = {
                actorState: {},
                actorPromptData: {name: 'Char'},
                currentLocation: {description: 'A place with no name.', name: undefined, exits: [], characters: []}
            };
            validateGameStateForPromptingSpy.mockReturnValue({isValid: true, errorContent: null});


            let promptData = await provider.getPromptData(dtoNullLocation, mockLoggerInstance);
            expect(promptData.locationName).toBe("an unknown place");

            promptData = await provider.getPromptData(dtoUndefinedLocation, mockLoggerInstance);
            expect(promptData.locationName).toBe("an unknown place");

            promptData = await provider.getPromptData(dtoLocationNoName, mockLoggerInstance);
            expect(promptData.locationName).toBe("an unknown place");
        });

        test('should throw error if an internal content getter throws', async () => {
            /** @type {AIGameStateDTO} */
            const dummyDto = {actorState: {}, actorPromptData: {name: 'Test'}};
            const internalErrorMsg = "Internal persona generation failed";

            validateGameStateForPromptingSpy.mockReturnValueOnce({isValid: true, errorContent: null});
            // Simulate an error from one of the content gathering methods
            getCharacterPersonaContentSpy.mockImplementationOnce(() => {
                throw new Error(internalErrorMsg);
            });

            await expect(provider.getPromptData(dummyDto, mockLoggerInstance))
                .rejects
                .toThrow(`AIPromptContentProvider.getPromptData: Failed to assemble PromptData due to internal error: ${internalErrorMsg}`);

            expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(dummyDto, mockLoggerInstance);
            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                `AIPromptContentProvider.getPromptData: Error during assembly of PromptData components: ${internalErrorMsg}`,
                expect.objectContaining({error: expect.any(Error)})
            );
        });
    });

    describe('validateGameStateForPrompting', () => {
        // This `beforeEach` is specific to the 'validateGameStateForPrompting' describe block.
        // The provider instance created in the outer `beforeEach` is used.
        // We need to ensure 'validateGameStateForPromptingSpy' is restored if it was spied on
        // provider from the outer scope, to test its actual implementation here.
        beforeEach(() => {
            // Restore the spy on the actual method to test its own logic
            if (validateGameStateForPromptingSpy) {
                validateGameStateForPromptingSpy.mockRestore();
            }
            // Ensure other spies that might interfere are also restored or not active if not needed
            if (getTaskDefinitionContentSpy) getTaskDefinitionContentSpy.mockRestore();
            if (getCharacterPersonaContentSpy) getCharacterPersonaContentSpy.mockRestore();
            // etc. for other spies if they could be called by validateGameStateForPrompting (though unlikely)
        });

        test('should return isValid: false and specific error if gameStateDto is null', () => {
            const result = provider.validateGameStateForPrompting(null, mockLoggerInstance);
            expect(result).toEqual({isValid: false, errorContent: ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING});
            expect(mockLoggerInstance.error).toHaveBeenCalledWith("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is null or undefined.");
        });

        test('should return isValid: true but log error if actorState is missing (current logic)', () => {
            const gameState = {actorPromptData: {name: "Test"}}; // Missing actorState
            // @ts-ignore - Intentionally passing incomplete DTO for testing
            const result = provider.validateGameStateForPrompting(gameState, mockLoggerInstance);
            expect(result.isValid).toBe(true); // As per current logic in AIPromptContentProvider
            expect(result.errorContent).toBeNull();
            expect(mockLoggerInstance.error).toHaveBeenCalledWith("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is missing 'actorState'. This might affect prompt data completeness indirectly.");
        });

        test('should return isValid: true but log warning if actorPromptData is missing (current logic)', () => {
            const gameState = {actorState: {id: "test"}}; // Missing actorPromptData
            // @ts-ignore - Intentionally passing incomplete DTO for testing
            const result = provider.validateGameStateForPrompting(gameState, mockLoggerInstance);
            expect(result.isValid).toBe(true); // As per current logic
            expect(result.errorContent).toBeNull();
            expect(mockLoggerInstance.warn).toHaveBeenCalledWith("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is missing 'actorPromptData'. Character info will be limited or use fallbacks.");
        });

        test('should return isValid: true for a valid gameStateDto', () => {
            /** @type {AIGameStateDTO} */
            const gameState = {
                actorState: {id: "actor1"},
                actorPromptData: {name: "Valid Actor"},
                currentLocation: {name: "Valid Location", description: "", exits: [], characters: []},
                perceptionLog: [],
                availableActions: [],
                currentUserInput: ""
            };
            const result = provider.validateGameStateForPrompting(gameState, mockLoggerInstance);
            expect(result).toEqual({isValid: true, errorContent: null});
            expect(mockLoggerInstance.error).not.toHaveBeenCalled();
            expect(mockLoggerInstance.warn).not.toHaveBeenCalled();
        });
    });
});

// --- FILE END ---
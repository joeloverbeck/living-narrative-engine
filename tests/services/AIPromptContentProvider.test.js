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
/** @typedef {import('../../src/turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../../src/types/promptData.js').PromptData} PromptData */

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
        provider = new AIPromptContentProvider();
        mockLoggerInstance = mockLogger();

        // Spy on the new instance method and provide a default mock implementation
        validateGameStateForPromptingSpy = jest.spyOn(provider, 'validateGameStateForPrompting')
            .mockReturnValue({isValid: true, errorContent: null});

        // Spy on other instance methods called by getPromptData
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
            const testPerception = [{description: 'A strange noise', timestamp: 1, type: 'sight'}]; // Made type a valid AIPerceptionLogEntryDTO
            const testLocationName = 'The Eerie Sanctum';

            /** @type {AIGameStateDTO} */
            const fullDto = {
                actorState: {id: 'actorTest'},
                actorPromptData: {name: testCharName, description: 'A curious adventurer.'},
                currentUserInput: testUserInput,
                perceptionLog: testPerception,
                currentLocation: {
                    name: testLocationName,
                    description: 'A place of mystery.',
                    exits: [],
                    characters: []
                }, // Added exits and characters for AILocationSummaryDTO
                availableActions: [],
            };
            validateGameStateForPromptingSpy.mockReturnValueOnce({isValid: true, errorContent: null});


            const promptData = await provider.getPromptData(fullDto, mockLoggerInstance);

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
                perceptionLogArray: testPerception,
                characterName: testCharName,
                locationName: testLocationName,
            });

            expect(getTaskDefinitionContentSpy).toHaveBeenCalled();
            expect(getCharacterPersonaContentSpy).toHaveBeenCalledWith(fullDto, mockLoggerInstance);
            expect(getCharacterPortrayalGuidelinesContentSpy).toHaveBeenCalledWith(testCharName);
            // ... other getter calls
            expect(mockLoggerInstance.info).toHaveBeenCalledWith("AIPromptContentProvider.getPromptData: PromptData assembled successfully.");
        });

        test('should correctly use DEFAULT_FALLBACK_CHARACTER_NAME if actorPromptData.name is missing', async () => {
            /** @type {AIGameStateDTO} */
            const dtoWithoutCharName = {
                actorState: {id: 'actorNoName'},
                actorPromptData: {description: 'Nameless one'},
                currentUserInput: "Input",
                perceptionLog: [],
                currentLocation: {name: "Someplace", description: '', exits: [], characters: []}, // Added missing fields for AILocationSummaryDTO
            };
            validateGameStateForPromptingSpy.mockReturnValueOnce({isValid: true, errorContent: null});

            const promptData = await provider.getPromptData(dtoWithoutCharName, mockLoggerInstance);
            expect(promptData.characterName).toBe(DEFAULT_FALLBACK_CHARACTER_NAME);
            expect(getCharacterPortrayalGuidelinesContentSpy).toHaveBeenCalledWith(DEFAULT_FALLBACK_CHARACTER_NAME);
        });

        test('should use empty string if currentUserInput is null or undefined', async () => {
            /** @type {AIGameStateDTO} */
            const dtoNullInput = {actorState: {}, actorPromptData: {name: 'Char'}, currentUserInput: null};
            const dtoUndefinedInput = {actorState: {}, actorPromptData: {name: 'Char'}, currentUserInput: undefined};

            // Reset the general mock for validateGameStateForPrompting to ensure it's fresh for each call if needed,
            // or rely on the beforeEach setup if it's sufficient.
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
            const dtoUndefinedLocation = {actorState: {}, actorPromptData: {name: 'Char'}, currentLocation: undefined};
            const dtoLocationNoName = {
                actorState: {},
                actorPromptData: {name: 'Char'},
                currentLocation: {description: 'A place with no name.', name: undefined, exits: [], characters: []} // Ensure 'name' is explicitly undefined for test
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

            validateGameStateForPromptingSpy.mockReturnValueOnce({isValid: true, errorContent: null}); // Validation passes
            getCharacterPersonaContentSpy.mockImplementationOnce(() => { // But a subsequent getter fails
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

    // New describe block for validateGameStateForPrompting
    describe('validateGameStateForPrompting', () => {
        // Restore default mock for other spies if they were changed in getPromptData tests.
        // This is generally handled by afterEach -> jest.restoreAllMocks(), but good to be mindful.

        beforeEach(() => {
            // We are testing validateGameStateForPrompting directly, so we don't want to mock it.
            // We need to restore its original implementation for these specific tests.
            if (validateGameStateForPromptingSpy) {
                validateGameStateForPromptingSpy.mockRestore();
            }
            // We might still want to spy on it to check if logger is called, but without changing its behavior for these tests.
            // Or, we can re-spy without mockReturnValue to observe calls.
            // For simplicity, let's call the actual method and verify logger calls.
            // If we need to verify its return for various inputs, direct calls are fine.
        });

        test('should return isValid: false and specific error if gameStateDto is null', () => {
            const result = provider.validateGameStateForPrompting(null, mockLoggerInstance);
            expect(result).toEqual({isValid: false, errorContent: ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING});
            expect(mockLoggerInstance.error).toHaveBeenCalledWith("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is null or undefined.");
        });

        test('should return isValid: true but log error if actorState is missing (current logic)', () => {
            const gameState = {actorPromptData: {name: "Test"}}; // Missing actorState
            // @ts-ignore to allow testing incomplete DTO
            const result = provider.validateGameStateForPrompting(gameState, mockLoggerInstance);
            expect(result.isValid).toBe(true); // Current logic does not make this a critical failure for isValid
            expect(result.errorContent).toBeNull();
            expect(mockLoggerInstance.error).toHaveBeenCalledWith("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is missing 'actorState'. This might affect prompt data completeness indirectly.");
        });

        test('should return isValid: true but log warning if actorPromptData is missing (current logic)', () => {
            const gameState = {actorState: {id: "test"}}; // Missing actorPromptData
            // @ts-ignore to allow testing incomplete DTO
            const result = provider.validateGameStateForPrompting(gameState, mockLoggerInstance);
            expect(result.isValid).toBe(true); // Current logic does not make this a critical failure for isValid
            expect(result.errorContent).toBeNull();
            expect(mockLoggerInstance.warn).toHaveBeenCalledWith("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is missing 'actorPromptData'. Character info will be limited or use fallbacks.");
        });

        test('should return isValid: true for a valid gameStateDto', () => {
            const gameState = {
                actorState: {id: "actor1"},
                actorPromptData: {name: "Valid Actor"},
                currentLocation: {name: "Valid Location", description: "", exits: [], characters: []},
                perceptionLog: [],
                availableActions: []
            };
            const result = provider.validateGameStateForPrompting(gameState, mockLoggerInstance);
            expect(result).toEqual({isValid: true, errorContent: null});
            expect(mockLoggerInstance.error).not.toHaveBeenCalled();
            expect(mockLoggerInstance.warn).not.toHaveBeenCalled();
        });
    });
});

// --- FILE END ---
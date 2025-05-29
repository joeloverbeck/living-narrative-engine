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
    /** @type {jest.SpyInstance} */
    let checkCriticalGameStateSpy;

    // Spies for instance methods
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

        // Spy on the static method and provide a default mock implementation
        checkCriticalGameStateSpy = jest.spyOn(AIPromptContentProvider, 'checkCriticalGameState')
            .mockReturnValue({isValid: true, errorContent: null});

        // Spy on instance methods called by getPromptData
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
        test('should throw an error if gameStateDto is null', async () => {
            await expect(provider.getPromptData(null, mockLoggerInstance))
                .rejects
                .toThrow('AIPromptContentProvider.getPromptData: gameStateDto is required to assemble PromptData.');
            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                "AIPromptContentProvider.getPromptData: Critical - gameStateDto is null or undefined. Cannot assemble PromptData."
            );
        });

        test('should throw an error if checkCriticalGameState returns isValid false', async () => {
            const dummyGameStateDto = {actorState: {}};
            const criticalErrorMsg = "Simulated critical state failure";
            checkCriticalGameStateSpy.mockReturnValueOnce({isValid: false, errorContent: criticalErrorMsg});

            await expect(provider.getPromptData(dummyGameStateDto, mockLoggerInstance))
                .rejects
                .toThrow(`AIPromptContentProvider.getPromptData: Invalid or incomplete game state: ${criticalErrorMsg}`);
            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                `AIPromptContentProvider.getPromptData: Critical game state check failed: ${criticalErrorMsg}. Cannot reliably assemble PromptData.`
            );
        });

        test('should use default fallbacks for missing optional data in gameStateDto', async () => {
            /** @type {AIGameStateDTO} */
            const minimalDto = {
                // actorState is needed for checkCriticalGameState to pass by default in this test setup
                actorState: {id: 'actor123'},
                actorPromptData: null, // Test fallback for characterName
                currentUserInput: undefined, // Test fallback for userInputContent
                perceptionLog: null, // Test fallback for perceptionLogArray
                currentLocation: undefined, // Test fallback for locationName
            };
            checkCriticalGameStateSpy.mockReturnValueOnce({isValid: true, errorContent: null});


            const promptData = await provider.getPromptData(minimalDto, mockLoggerInstance);

            expect(promptData.characterName).toBe(DEFAULT_FALLBACK_CHARACTER_NAME);
            expect(promptData.userInputContent).toBe("");
            expect(promptData.perceptionLogArray).toEqual([]);
            expect(promptData.locationName).toBe("an unknown place");

            // Ensure underlying getters are still called, portrayal guidelines with fallback name
            expect(getCharacterPortrayalGuidelinesContentSpy).toHaveBeenCalledWith(DEFAULT_FALLBACK_CHARACTER_NAME);
            expect(getCharacterPersonaContentSpy).toHaveBeenCalledWith(minimalDto, mockLoggerInstance);
            // ... other getters ...
        });

        test('should correctly assemble PromptData with all fields from a full gameStateDto', async () => {
            const testCharName = 'Test Character';
            const testUserInput = 'What is happening?';
            const testPerception = [{event: 'A strange noise'}];
            const testLocationName = 'The Eerie Sanctum';

            /** @type {AIGameStateDTO} */
            const fullDto = {
                actorState: {id: 'actorTest'},
                actorPromptData: {name: testCharName, description: 'A curious adventurer.'},
                currentUserInput: testUserInput,
                perceptionLog: testPerception,
                currentLocation: {name: testLocationName, description: 'A place of mystery.'},
                availableActions: [], // Passed to getAvailableActionsInfoContent
            };
            checkCriticalGameStateSpy.mockReturnValueOnce({isValid: true, errorContent: null});


            const promptData = await provider.getPromptData(fullDto, mockLoggerInstance);

            expect(checkCriticalGameStateSpy).toHaveBeenCalledWith(fullDto, mockLoggerInstance);
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

            // Verify calls to underlying methods
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
                actorPromptData: {description: 'Nameless one'}, // No name field
                currentUserInput: "Input",
                perceptionLog: [],
                currentLocation: {name: "Someplace"},
            };
            checkCriticalGameStateSpy.mockReturnValueOnce({isValid: true, errorContent: null});

            const promptData = await provider.getPromptData(dtoWithoutCharName, mockLoggerInstance);
            expect(promptData.characterName).toBe(DEFAULT_FALLBACK_CHARACTER_NAME);
            expect(getCharacterPortrayalGuidelinesContentSpy).toHaveBeenCalledWith(DEFAULT_FALLBACK_CHARACTER_NAME);
        });

        test('should use empty string if currentUserInput is null or undefined', async () => {
            /** @type {AIGameStateDTO} */
            const dtoNullInput = {actorState: {}, actorPromptData: {name: 'Char'}, currentUserInput: null};
            const dtoUndefinedInput = {actorState: {}, actorPromptData: {name: 'Char'}, currentUserInput: undefined};
            checkCriticalGameStateSpy.mockReturnValue({isValid: true, errorContent: null});


            let promptData = await provider.getPromptData(dtoNullInput, mockLoggerInstance);
            expect(promptData.userInputContent).toBe("");

            promptData = await provider.getPromptData(dtoUndefinedInput, mockLoggerInstance);
            expect(promptData.userInputContent).toBe("");
        });

        test('should use empty array if perceptionLog is null or undefined', async () => {
            /** @type {AIGameStateDTO} */
            const dtoNullLog = {actorState: {}, actorPromptData: {name: 'Char'}, perceptionLog: null};
            const dtoUndefinedLog = {actorState: {}, actorPromptData: {name: 'Char'}, perceptionLog: undefined};
            checkCriticalGameStateSpy.mockReturnValue({isValid: true, errorContent: null});

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
                currentLocation: {description: 'A place with no name.'}
            };
            checkCriticalGameStateSpy.mockReturnValue({isValid: true, errorContent: null});


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
            getCharacterPersonaContentSpy.mockImplementationOnce(() => {
                throw new Error(internalErrorMsg);
            });
            checkCriticalGameStateSpy.mockReturnValueOnce({isValid: true, errorContent: null});


            await expect(provider.getPromptData(dummyDto, mockLoggerInstance))
                .rejects
                .toThrow(`AIPromptContentProvider.getPromptData: Failed to assemble PromptData due to internal error: ${internalErrorMsg}`);

            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                `AIPromptContentProvider.getPromptData: Error during assembly of PromptData components: ${internalErrorMsg}`,
                expect.objectContaining({error: expect.any(Error)})
            );
        });
    });
});

// --- FILE END ---
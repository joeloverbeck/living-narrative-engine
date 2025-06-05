// tests/services/AIPromptContentProvider.test.js
// --- FILE START ---

import { AIPromptContentProvider } from '../../src/prompting/AIPromptContentProvider.js';
import {
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_LOCATION_NAME,
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
  DEFAULT_FALLBACK_ACTION_ID,
  DEFAULT_FALLBACK_ACTION_COMMAND,
  DEFAULT_FALLBACK_ACTION_NAME,
  DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW,
  ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING,
  PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS,
  PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE,
  PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS,
  PROMPT_FALLBACK_UNKNOWN_LOCATION,
  PROMPT_FALLBACK_NO_EXITS,
  PROMPT_FALLBACK_ALONE_IN_LOCATION,
  PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE,
} from '../../src/constants/textDefaults.js';
import { ensureTerminalPunctuation } from '../../src/utils/textUtils.js';
import {
  jest,
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
} from '@jest/globals';

/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/interfaces/IPromptStaticContentService.js').IPromptStaticContentService} IPromptStaticContentService */
/** @typedef {import('../../src/interfaces/IPerceptionLogFormatter.js').IPerceptionLogFormatter} IPerceptionLogFormatter */
/** @typedef {import('../../src/interfaces/IGameStateValidationServiceForPrompting.js').IGameStateValidationServiceForPrompting} IGameStateValidationServiceForPrompting */
/** @typedef {import('../../src/turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../../src/types/promptData.js').PromptData} PromptData */
/** @typedef {import('../../src/prompting/AIPromptContentProvider.js').RawPerceptionLogEntry} RawPerceptionLogEntry */

/**
 * @returns {jest.Mocked<ILogger>}
 */
const mockLoggerFn = () => ({
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
  /** @type {jest.Mocked<IPerceptionLogFormatter>} */
  let mockPerceptionLogFormatterInstance;
  /** @type {jest.Mocked<IGameStateValidationServiceForPrompting>} */
  let mockGameStateValidationServiceInstance;

  // Spies for instance methods called by getPromptData or other methods
  /** @type {jest.SpyInstance} */
  let validateGameStateForPromptingSpy;
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

  const MOCK_TASK_DEF = 'Mocked Task Definition';
  const MOCK_PERSONA = 'Mocked Persona';
  const MOCK_PORTRAYAL = 'Mocked Portrayal Guidelines';
  const MOCK_POLICY = 'Mocked Content Policy';
  const MOCK_WORLD_CONTEXT = 'Mocked World Context';
  const MOCK_ACTIONS_INFO = 'Mocked Available Actions';
  const MOCK_FINAL_INSTR = 'Mocked Final Instructions';
  const MOCK_FORMATTED_PERCEPTION = [{ content: 'mockPerception' }];

  beforeEach(() => {
    mockLoggerInstance = mockLoggerFn();
    mockPromptStaticContentService = {
      getCoreTaskDescriptionText: jest.fn().mockReturnValue(MOCK_TASK_DEF),
      getCharacterPortrayalGuidelines: jest
        .fn()
        .mockReturnValue(MOCK_PORTRAYAL),
      getNc21ContentPolicyText: jest.fn().mockReturnValue(MOCK_POLICY),
      getFinalLlmInstructionText: jest.fn().mockReturnValue(MOCK_FINAL_INSTR),
    };

    mockPerceptionLogFormatterInstance = {
      format: jest.fn().mockReturnValue(MOCK_FORMATTED_PERCEPTION),
    };

    mockGameStateValidationServiceInstance = {
      validate: jest
        .fn()
        .mockReturnValue({ isValid: true, errorContent: null }),
    };

    // Instantiate with all mocks
    provider = new AIPromptContentProvider({
      logger: mockLoggerInstance,
      promptStaticContentService: mockPromptStaticContentService,
      perceptionLogFormatter: mockPerceptionLogFormatterInstance,
      gameStateValidationService: mockGameStateValidationServiceInstance,
    });

    // Spy on the provider's own methods that are either delegating or complex internal logic
    validateGameStateForPromptingSpy = jest.spyOn(
      provider,
      'validateGameStateForPrompting'
    );
    getTaskDefinitionContentSpy = jest.spyOn(
      provider,
      'getTaskDefinitionContent'
    );
    getCharacterPersonaContentSpy = jest.spyOn(
      provider,
      'getCharacterPersonaContent'
    );
    getCharacterPortrayalGuidelinesContentSpy = jest.spyOn(
      provider,
      'getCharacterPortrayalGuidelinesContent'
    );
    getContentPolicyContentSpy = jest.spyOn(
      provider,
      'getContentPolicyContent'
    );
    getWorldContextContentSpy = jest.spyOn(provider, 'getWorldContextContent');
    getAvailableActionsInfoContentSpy = jest.spyOn(
      provider,
      'getAvailableActionsInfoContent'
    );
    getFinalInstructionsContentSpy = jest.spyOn(
      provider,
      'getFinalInstructionsContent'
    );

    // Default mock implementations for spies used in getPromptData
    validateGameStateForPromptingSpy.mockReturnValue({
      isValid: true,
      errorContent: null,
    });
    getTaskDefinitionContentSpy.mockReturnValue(MOCK_TASK_DEF);
    getCharacterPersonaContentSpy.mockReturnValue(MOCK_PERSONA);
    getCharacterPortrayalGuidelinesContentSpy.mockReturnValue(MOCK_PORTRAYAL);
    getContentPolicyContentSpy.mockReturnValue(MOCK_POLICY);
    getWorldContextContentSpy.mockReturnValue(MOCK_WORLD_CONTEXT);
    getAvailableActionsInfoContentSpy.mockReturnValue(MOCK_ACTIONS_INFO);
    getFinalInstructionsContentSpy.mockReturnValue(MOCK_FINAL_INSTR);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize correctly with all mocked dependencies', () => {
      expect(provider).toBeInstanceOf(AIPromptContentProvider);
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'AIPromptContentProvider initialized with new services.'
      );
    });

    test('should throw error if logger is not provided', () => {
      expect(
        () =>
          new AIPromptContentProvider({
            // @ts-ignore
            logger: null,
            promptStaticContentService: mockPromptStaticContentService,
            perceptionLogFormatter: mockPerceptionLogFormatterInstance,
            gameStateValidationService: mockGameStateValidationServiceInstance,
          })
      ).toThrow('AIPromptContentProvider: Logger is required.');
    });

    test('should throw error if PromptStaticContentService is not provided', () => {
      expect(
        () =>
          new AIPromptContentProvider({
            logger: mockLoggerInstance,
            // @ts-ignore
            promptStaticContentService: null,
            perceptionLogFormatter: mockPerceptionLogFormatterInstance,
            gameStateValidationService: mockGameStateValidationServiceInstance,
          })
      ).toThrow(
        'AIPromptContentProvider: PromptStaticContentService is required.'
      );
    });

    test('should throw error if PerceptionLogFormatter is not provided', () => {
      expect(
        () =>
          new AIPromptContentProvider({
            logger: mockLoggerInstance,
            promptStaticContentService: mockPromptStaticContentService,
            // @ts-ignore
            perceptionLogFormatter: null,
            gameStateValidationService: mockGameStateValidationServiceInstance,
          })
      ).toThrow('AIPromptContentProvider: PerceptionLogFormatter is required.');
    });

    test('should throw error if GameStateValidationServiceForPrompting is not provided', () => {
      expect(
        () =>
          new AIPromptContentProvider({
            logger: mockLoggerInstance,
            promptStaticContentService: mockPromptStaticContentService,
            perceptionLogFormatter: mockPerceptionLogFormatterInstance,
            // @ts-ignore
            gameStateValidationService: null,
          })
      ).toThrow(
        'AIPromptContentProvider: GameStateValidationServiceForPrompting is required.'
      );
    });
  });

  describe('Static Content Getter Methods (Delegation)', () => {
    beforeEach(() => {
      // Restore spies on these specific methods to test their actual implementation (delegation)
      if (getTaskDefinitionContentSpy)
        getTaskDefinitionContentSpy.mockRestore();
      if (getCharacterPortrayalGuidelinesContentSpy)
        getCharacterPortrayalGuidelinesContentSpy.mockRestore();
      if (getContentPolicyContentSpy) getContentPolicyContentSpy.mockRestore();
      if (getFinalInstructionsContentSpy)
        getFinalInstructionsContentSpy.mockRestore();
    });

    test('getTaskDefinitionContent should call service and return its value', () => {
      const expected = 'Static Task Def Content';
      mockPromptStaticContentService.getCoreTaskDescriptionText.mockReturnValue(
        expected
      );
      const result = provider.getTaskDefinitionContent();
      expect(
        mockPromptStaticContentService.getCoreTaskDescriptionText
      ).toHaveBeenCalledTimes(1);
      expect(result).toBe(expected);
    });

    test('getCharacterPortrayalGuidelinesContent should call service and return its value', () => {
      const charName = 'TestChar';
      const expected = `Guidelines for ${charName}`;
      mockPromptStaticContentService.getCharacterPortrayalGuidelines.mockReturnValue(
        expected
      );
      const result = provider.getCharacterPortrayalGuidelinesContent(charName);
      expect(
        mockPromptStaticContentService.getCharacterPortrayalGuidelines
      ).toHaveBeenCalledWith(charName);
      expect(result).toBe(expected);
    });

    test('getContentPolicyContent should call service and return its value', () => {
      const expected = 'Static Policy Content';
      mockPromptStaticContentService.getNc21ContentPolicyText.mockReturnValue(
        expected
      );
      const result = provider.getContentPolicyContent();
      expect(
        mockPromptStaticContentService.getNc21ContentPolicyText
      ).toHaveBeenCalledTimes(1);
      expect(result).toBe(expected);
    });

    test('getFinalInstructionsContent should call service and return its value', () => {
      const expected = 'Static Final Instructions';
      mockPromptStaticContentService.getFinalLlmInstructionText.mockReturnValue(
        expected
      );
      const result = provider.getFinalInstructionsContent();
      expect(
        mockPromptStaticContentService.getFinalLlmInstructionText
      ).toHaveBeenCalledTimes(1);
      expect(result).toBe(expected);
    });
  });

  describe('validateGameStateForPrompting (Delegation)', () => {
    beforeEach(() => {
      // Restore the spy on provider.validateGameStateForPrompting to test its actual implementation.
      if (validateGameStateForPromptingSpy) {
        validateGameStateForPromptingSpy.mockRestore();
      }
    });

    test('should call gameStateValidationService.validate with gameStateDto and return its result', () => {
      const dummyGameStateDto = { actorState: { id: 'test' } };
      const expectedValidationResult = { isValid: true, errorContent: null };
      mockGameStateValidationServiceInstance.validate.mockReturnValue(
        expectedValidationResult
      );

      // @ts-ignore
      const result = provider.validateGameStateForPrompting(
        dummyGameStateDto,
        mockLoggerInstance
      );

      expect(
        mockGameStateValidationServiceInstance.validate
      ).toHaveBeenCalledWith(dummyGameStateDto);
      expect(result).toEqual(expectedValidationResult);
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
        'AIPromptContentProvider.validateGameStateForPrompting: Delegating to GameStateValidationServiceForPrompting.'
      );
    });

    test('should pass logger argument to service if service expected it (but current service does not)', () => {
      // This test confirms that the logger argument to validateGameStateForPrompting
      // is NOT passed down to the current mockGameStateValidationServiceInstance.validate,
      // as the service is expected to use its own injected logger.
      // The `logger` parameter in `validateGameStateForPrompting` is for interface compliance.
      const dummyGameStateDto = { actorState: { id: 'test2' } };
      const passedLogger = mockLoggerFn(); // A different logger instance
      mockGameStateValidationServiceInstance.validate.mockReturnValue({
        isValid: true,
        errorContent: null,
      });

      // @ts-ignore
      provider.validateGameStateForPrompting(dummyGameStateDto, passedLogger);

      expect(
        mockGameStateValidationServiceInstance.validate
      ).toHaveBeenCalledWith(dummyGameStateDto);
      // Crucially, `passedLogger` is not expected to be an argument to the service's validate method.
    });

    test('should return what the validation service returns, e.g. failure', () => {
      const dummyGameStateDto = { actorState: { id: 'test-fail' } };
      const expectedValidationResult = {
        isValid: false,
        errorContent: 'Validation service failure',
      };
      mockGameStateValidationServiceInstance.validate.mockReturnValue(
        expectedValidationResult
      );

      // @ts-ignore
      const result = provider.validateGameStateForPrompting(
        dummyGameStateDto,
        mockLoggerInstance
      );

      expect(
        mockGameStateValidationServiceInstance.validate
      ).toHaveBeenCalledWith(dummyGameStateDto);
      expect(result).toEqual(expectedValidationResult);
    });
  });

  describe('getPromptData', () => {
    // The spies are set up in the main beforeEach and are active here.
    // validateGameStateForPromptingSpy controls validation outcome for these tests.

    test('should throw an error if validation fails (e.g. gameStateDto is null)', async () => {
      validateGameStateForPromptingSpy.mockReturnValue({
        isValid: false,
        errorContent: ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING,
      });
      // The parameter logger passed to getPromptData
      const passedLogger = mockLoggerFn();

      await expect(provider.getPromptData(null, passedLogger)).rejects.toThrow(
        ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING
      );

      expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(
        null,
        passedLogger
      );
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        // instance logger used for internal error
        `AIPromptContentProvider.getPromptData: Critical game state validation failed. Reason: ${ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING}`
      );
    });

    test('should throw an error if validateGameStateForPrompting returns isValid false with a specific message', async () => {
      const dummyGameStateDto = { actorState: {} }; // Dummy DTO
      const criticalErrorMsg =
        'Simulated critical state failure from validation';
      validateGameStateForPromptingSpy.mockReturnValueOnce({
        isValid: false,
        errorContent: criticalErrorMsg,
      });
      const passedLogger = mockLoggerFn();

      await expect(
        provider.getPromptData(dummyGameStateDto, passedLogger)
      ).rejects.toThrow(criticalErrorMsg);

      expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(
        dummyGameStateDto,
        passedLogger
      );
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        // instance logger
        `AIPromptContentProvider.getPromptData: Critical game state validation failed. Reason: ${criticalErrorMsg}`
      );
    });

    test('should use default fallbacks for missing optional data in gameStateDto', async () => {
      /** @type {AIGameStateDTO} */
      const minimalDto = {
        actorState: { id: 'actor123' }, // Required by some validation logic path
        actorPromptData: null,
        currentUserInput: undefined,
        perceptionLog: null,
        currentLocation: undefined,
        availableActions: undefined, // ensure all fields that might be accessed are considered
      };
      validateGameStateForPromptingSpy.mockReturnValueOnce({
        isValid: true,
        errorContent: null,
      });
      mockPerceptionLogFormatterInstance.format.mockReturnValueOnce([]); // for null perceptionLog
      const passedLogger = mockLoggerFn();

      const promptData = await provider.getPromptData(minimalDto, passedLogger);

      expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(
        minimalDto,
        passedLogger
      );
      expect(promptData.characterName).toBe(DEFAULT_FALLBACK_CHARACTER_NAME);
      expect(promptData.userInputContent).toBe('');
      expect(promptData.perceptionLogArray).toEqual([]);
      expect(promptData.locationName).toBe('an unknown place'); // As per SUT's specific fallback

      // Check that content getters were called with appropriate args
      expect(getCharacterPortrayalGuidelinesContentSpy).toHaveBeenCalledWith(
        DEFAULT_FALLBACK_CHARACTER_NAME
      );
      expect(getCharacterPersonaContentSpy).toHaveBeenCalledWith(
        minimalDto,
        mockLoggerInstance
      ); // uses instance logger
      expect(getWorldContextContentSpy).toHaveBeenCalledWith(
        minimalDto,
        mockLoggerInstance
      );
      expect(getAvailableActionsInfoContentSpy).toHaveBeenCalledWith(
        minimalDto,
        mockLoggerInstance
      );

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'AIPromptContentProvider.getPromptData: PromptData assembled successfully.'
      );
    });

    test('should correctly assemble PromptData with all fields from a full gameStateDto', async () => {
      const testCharName = 'Test Character';
      const testUserInput = 'What is happening?';
      const testLocationName = 'The Eerie Sanctum';

      /** @type {RawPerceptionLogEntry[]} */
      const testRawPerceptionInput = [
        { descriptionText: 'A strange noise', timestamp: 'ts1' },
      ];
      const formattedPerceptions = [
        { content: 'A strange noise formatted', timestamp: 'ts1' },
      ];
      mockPerceptionLogFormatterInstance.format.mockReturnValueOnce(
        formattedPerceptions
      );

      /** @type {AIGameStateDTO} */
      const fullDto = {
        actorState: { id: 'actorTest' },
        actorPromptData: {
          name: testCharName,
          description: 'A curious adventurer.',
        },
        currentUserInput: testUserInput,
        perceptionLog: testRawPerceptionInput,
        currentLocation: {
          name: testLocationName,
          description: 'A place of mystery.',
          exits: [],
          characters: [],
        },
        availableActions: [
          {
            id: 'action1',
            name: 'Test Action',
            command: 'do_test',
            description: 'A test action.',
          },
        ],
      };
      validateGameStateForPromptingSpy.mockReturnValueOnce({
        isValid: true,
        errorContent: null,
      });
      const passedLogger = mockLoggerFn();

      const promptData = await provider.getPromptData(fullDto, passedLogger);

      expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(
        fullDto,
        passedLogger
      );
      expect(mockPerceptionLogFormatterInstance.format).toHaveBeenCalledWith(
        testRawPerceptionInput
      );

      // Now include thoughtsArray: [] in the expected object:
      expect(promptData).toEqual({
        taskDefinitionContent: MOCK_TASK_DEF,
        characterPersonaContent: MOCK_PERSONA,
        portrayalGuidelinesContent: MOCK_PORTRAYAL,
        contentPolicyContent: MOCK_POLICY,
        worldContextContent: MOCK_WORLD_CONTEXT,
        availableActionsInfoContent: MOCK_ACTIONS_INFO,
        userInputContent: testUserInput,
        finalInstructionsContent: MOCK_FINAL_INSTR,
        notesArray: [],
        perceptionLogArray: formattedPerceptions,
        characterName: testCharName,
        locationName: testLocationName,
        thoughtsArray: [],
      });

      // Verify that the internal (spied) getter methods were called correctly
      expect(getTaskDefinitionContentSpy).toHaveBeenCalled();
      expect(getCharacterPersonaContentSpy).toHaveBeenCalledWith(
        fullDto,
        mockLoggerInstance
      ); // uses instance logger
      expect(getCharacterPortrayalGuidelinesContentSpy).toHaveBeenCalledWith(
        testCharName
      );
      expect(getContentPolicyContentSpy).toHaveBeenCalled();
      expect(getWorldContextContentSpy).toHaveBeenCalledWith(
        fullDto,
        mockLoggerInstance
      ); // uses instance logger
      expect(getAvailableActionsInfoContentSpy).toHaveBeenCalledWith(
        fullDto,
        mockLoggerInstance
      ); // uses instance logger
      expect(getFinalInstructionsContentSpy).toHaveBeenCalled();
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'AIPromptContentProvider.getPromptData: PromptData assembled successfully.'
      );
    });

    test('should throw error if an internal content getter (e.g. getCharacterPersonaContent) throws', async () => {
      /** @type {AIGameStateDTO} */
      const dummyDto = { actorState: {}, actorPromptData: { name: 'Test' } }; // Minimal valid DTO
      const internalErrorMsg = 'Internal persona generation failed';

      validateGameStateForPromptingSpy.mockReturnValueOnce({
        isValid: true,
        errorContent: null,
      });
      // Restore original method for getCharacterPersonaContent then mock it to throw
      getCharacterPersonaContentSpy.mockRestore(); // remove general spy
      jest
        .spyOn(provider, 'getCharacterPersonaContent')
        .mockImplementation(() => {
          // specific mock
          throw new Error(internalErrorMsg);
        });
      const passedLogger = mockLoggerFn();

      await expect(
        provider.getPromptData(dummyDto, passedLogger)
      ).rejects.toThrow(
        `AIPromptContentProvider.getPromptData: Failed to assemble PromptData due to internal error: ${internalErrorMsg}`
      );

      expect(validateGameStateForPromptingSpy).toHaveBeenCalledWith(
        dummyDto,
        passedLogger
      );
      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        // instance logger
        `AIPromptContentProvider.getPromptData: Error during assembly of PromptData components: ${internalErrorMsg}`,
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('Dynamic Content Methods', () => {
    // For these tests, we call the methods directly, not relying on getPromptData.
    // We will also restore the spies on these methods so we test their actual implementation.

    let minimalGameStateDto;

    beforeEach(() => {
      // Restore spies for dynamic content methods to test their actual implementations
      if (getCharacterPersonaContentSpy)
        getCharacterPersonaContentSpy.mockRestore();
      if (getWorldContextContentSpy) getWorldContextContentSpy.mockRestore();
      if (getAvailableActionsInfoContentSpy)
        getAvailableActionsInfoContentSpy.mockRestore();

      minimalGameStateDto = {
        actorState: { id: 'char1' }, // For validation paths if any were deeper
        actorPromptData: { name: 'Hero' },
        currentUserInput: 'Hello',
        perceptionLog: [],
        currentLocation: {
          name: 'Tavern',
          description: 'A cozy place.',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };
    });

    describe('getCharacterPersonaContent', () => {
      test('should return full persona string with all details', () => {
        const dto = {
          ...minimalGameStateDto,
          actorPromptData: {
            name: 'Sir Reginald',
            description: 'A brave knight.',
            personality: 'Gallant and Stoic.',
            profile: 'Born in a noble family, trained in swordsmanship.',
            likes: 'Justice, good ale.',
            dislikes: 'Dragons, injustice.',
            secrets: 'Afraid of spiders.',
            speechPatterns: ['Verily!', 'Forsooth!'],
          },
        };
        const result = provider.getCharacterPersonaContent(
          dto,
          mockLoggerInstance
        );

        expect(result).toContain('YOU ARE Sir Reginald.');
        expect(result).toContain('Your Description: A brave knight.');
        expect(result).toContain('Your Personality: Gallant and Stoic.');
        expect(result).toContain(
          'Your Profile / Background: Born in a noble family, trained in swordsmanship.'
        );
        expect(result).toContain('Your Likes: Justice, good ale.');
        expect(result).toContain('Your Dislikes: Dragons, injustice.');
        expect(result).toContain('Your Secrets: Afraid of spiders.');
        expect(result).toContain(
          'Your Speech Patterns:\n- Verily!\n- Forsooth!'
        );
        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          'AIPromptContentProvider: Formatting character persona content.'
        );
      });

      test('should return PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE if actorPromptData is null but actorState exists', () => {
        const dto = {
          ...minimalGameStateDto,
          actorPromptData: null,
          actorState: { id: 'someActor' },
        };
        const result = provider.getCharacterPersonaContent(
          dto,
          mockLoggerInstance
        );
        expect(result).toBe(PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE);
        expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
          'AIPromptContentProvider: actorPromptData is missing in getCharacterPersonaContent. Using fallback.'
        );
      });

      test('should return PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS if actorPromptData and actorState are null', () => {
        const dto = {
          ...minimalGameStateDto,
          actorPromptData: null,
          actorState: null,
        };
        const result = provider.getCharacterPersonaContent(
          dto,
          mockLoggerInstance
        );
        expect(result).toBe(PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS);
        expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
          'AIPromptContentProvider: actorPromptData is missing in getCharacterPersonaContent. Using fallback.'
        );
      });

      test('should use DEFAULT_FALLBACK_CHARACTER_NAME if name is missing', () => {
        const dto = {
          ...minimalGameStateDto,
          actorPromptData: { description: 'A wanderer.' },
        };
        const result = provider.getCharacterPersonaContent(
          dto,
          mockLoggerInstance
        );
        expect(result).toContain(`YOU ARE ${DEFAULT_FALLBACK_CHARACTER_NAME}.`);
      });

      test('should return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS for truly minimal/default data', () => {
        const dtoDefaultName = {
          ...minimalGameStateDto,
          actorPromptData: { name: DEFAULT_FALLBACK_CHARACTER_NAME },
        };
        let result = provider.getCharacterPersonaContent(
          dtoDefaultName,
          mockLoggerInstance
        );
        expect(result).toBe(PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS);

        const dtoNoDetails = { ...minimalGameStateDto, actorPromptData: {} }; // only empty object
        result = provider.getCharacterPersonaContent(
          dtoNoDetails,
          mockLoggerInstance
        );
        expect(result).toBe(PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS);

        const dtoNullNameAndRest = {
          ...minimalGameStateDto,
          actorPromptData: { name: null, description: null, personality: null },
        };
        result = provider.getCharacterPersonaContent(
          dtoNullNameAndRest,
          mockLoggerInstance
        );
        expect(result).toBe(PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS);
      });

      test('should correctly format optional attributes, skipping empty ones', () => {
        const dto = {
          ...minimalGameStateDto,
          actorPromptData: {
            name: 'Test Character',
            description: 'Desc.',
            personality: '  Friendly  ',
            profile: '', // empty
            likes: null, // null
            secrets: 'A big one.',
          },
        };
        const result = provider.getCharacterPersonaContent(
          dto,
          mockLoggerInstance
        );
        expect(result).toContain('Your Personality: Friendly');
        expect(result).not.toContain('Your Profile / Background:');
        expect(result).not.toContain('Your Likes:');
        expect(result).toContain('Your Secrets: A big one.');
      });
    });

    describe('getWorldContextContent', () => {
      test('should return full world context with location, exits, and characters', () => {
        const dto = {
          ...minimalGameStateDto,
          currentLocation: {
            name: 'The Grand Hall',
            description: 'A vast and ornate hall.',
            exits: [
              { direction: 'north', targetLocationName: 'The Library' },
              { direction: 'south', targetLocationId: 'loc_throne_room' },
            ],
            characters: [
              { name: 'Guard Captain', description: 'Stern and watchful.' },
              { name: 'Jester', description: 'Wearing colorful attire.' },
            ],
          },
        };
        const result = provider.getWorldContextContent(dto, mockLoggerInstance);

        expect(result).toContain('CURRENT SITUATION');
        expect(result).toContain('Location: The Grand Hall.');
        expect(result).toContain('Description: A vast and ornate hall.');

        expect(result).toContain('Exits from your current location:');
        expect(result).toContain('- Towards north leads to The Library.');
        expect(result).toContain(`- Towards south leads to loc_throne_room.`);
        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Formatted 2 items for section "Exits from your current location"'
          )
        );

        expect(result).toContain(
          'Other characters present in this location (you cannot speak as them):'
        );
        expect(result).toContain(
          '- Guard Captain - Description: Stern and watchful.'
        );
        expect(result).toContain(
          '- Jester - Description: Wearing colorful attire.'
        );
        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Formatted 2 items for section "Other characters present in this location (you cannot speak as them)"'
          )
        );

        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          'AIPromptContentProvider: Formatting world context content.'
        );
      });

      test('should return PROMPT_FALLBACK_UNKNOWN_LOCATION if currentLocation is null', () => {
        const dto = { ...minimalGameStateDto, currentLocation: null };
        const result = provider.getWorldContextContent(dto, mockLoggerInstance);
        expect(result).toBe(PROMPT_FALLBACK_UNKNOWN_LOCATION);
        expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
          'AIPromptContentProvider: currentLocation is missing in getWorldContextContent. Using fallback.'
        );
      });

      test('should use fallbacks for missing location details, exits, and characters', () => {
        const dto = {
          ...minimalGameStateDto,
          currentLocation: {
            name: null, // Will use DEFAULT_FALLBACK_LOCATION_NAME
            description: '  ', // Will become "" after ensureTerminalPunctuation
            exits: [],
            characters: null, // Will be treated as empty by _formatListSegment
          },
        };
        const result = provider.getWorldContextContent(dto, mockLoggerInstance);

        expect(result).toContain(
          `Location: ${DEFAULT_FALLBACK_LOCATION_NAME}.`
        );
        // If description is "  ", it becomes "" after ensureTerminalPunctuation.
        expect(result).toContain(`Description: `);
        expect(result).not.toContain(
          `Description: ${ensureTerminalPunctuation(DEFAULT_FALLBACK_DESCRIPTION_RAW)}`
        );

        expect(result).toContain('Exits from your current location:');
        expect(result).toContain(PROMPT_FALLBACK_NO_EXITS);
        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Section "Exits from your current location" is empty'
          )
        );

        expect(result).toContain(
          'Other characters present in this location (you cannot speak as them):'
        );
        expect(result).toContain(PROMPT_FALLBACK_ALONE_IN_LOCATION);
        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Section "Other characters present in this location (you cannot speak as them)" is empty'
          )
        );
      });

      test('should handle exits with missing target names by using target IDs or fallback', () => {
        const dto = {
          ...minimalGameStateDto,
          currentLocation: {
            name: 'Crossroads',
            description: 'Many paths.',
            exits: [
              { direction: 'east', targetLocationId: 'village_east_gate' },
              { direction: 'west' },
            ],
            characters: [],
          },
        };
        const result = provider.getWorldContextContent(dto, mockLoggerInstance);
        expect(result).toContain('- Towards east leads to village_east_gate.');
        expect(result).toContain(
          `- Towards west leads to ${DEFAULT_FALLBACK_LOCATION_NAME}.`
        );
      });
    });

    describe('getAvailableActionsInfoContent', () => {
      test('should list available actions with all details', () => {
        const dto = {
          ...minimalGameStateDto,
          availableActions: [
            {
              id: 'act_look',
              command: 'look_around',
              name: 'Look Around',
              description: 'Observe your surroundings.',
            },
            {
              id: 'act_talk',
              command: 'talk_to_npc',
              name: 'Talk to NPC',
              description: 'Engage in conversation.',
            },
          ],
        };
        const result = provider.getAvailableActionsInfoContent(
          dto,
          mockLoggerInstance
        );

        expect(result).toContain(
          'Consider these available actions when deciding what to do:'
        );
        expect(result).toContain(
          '- "Look Around" (actionDefinitionId: "act_look", commandString: "look_around"). Description: Observe your surroundings.'
        );
        expect(result).toContain(
          '- "Talk to NPC" (actionDefinitionId: "act_talk", commandString: "talk_to_npc"). Description: Engage in conversation.'
        );
        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          'AIPromptContentProvider: Formatting available actions info content.'
        );
        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Formatted 2 items for section "Consider these available actions when deciding what to do"'
          )
        );
      });

      test('should return PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE if no actions are available', () => {
        const dtoNull = { ...minimalGameStateDto, availableActions: null };
        let result = provider.getAvailableActionsInfoContent(
          dtoNull,
          mockLoggerInstance
        );
        expect(result).toContain(
          'Consider these available actions when deciding what to do:'
        );
        expect(result).toContain(PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE);
        expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
          'AIPromptContentProvider: No available actions provided. Using fallback message for list segment.'
        );
        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Section "Consider these available actions when deciding what to do" is empty, using empty message.'
          )
        );

        mockLoggerInstance.warn.mockClear();
        mockLoggerInstance.debug.mockClear();
        const dtoEmpty = { ...minimalGameStateDto, availableActions: [] };
        result = provider.getAvailableActionsInfoContent(
          dtoEmpty,
          mockLoggerInstance
        );
        expect(result).toContain(PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE);
        expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
          'AIPromptContentProvider: No available actions provided. Using fallback message for list segment.'
        );
        expect(mockLoggerInstance.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Section "Consider these available actions when deciding what to do" is empty, using empty message.'
          )
        );
      });

      test('should use fallbacks for missing action details', () => {
        const dto = {
          ...minimalGameStateDto,
          availableActions: [
            { id: 'act1' }, // missing command, name, desc
            { command: 'cmd2', name: 'Action Two' }, // missing id, desc
          ],
        };
        const result = provider.getAvailableActionsInfoContent(
          dto,
          mockLoggerInstance
        );

        const expectedAction1 = `- "${DEFAULT_FALLBACK_ACTION_NAME}" (actionDefinitionId: "act1", commandString: "${DEFAULT_FALLBACK_ACTION_COMMAND}"). Description: ${ensureTerminalPunctuation(DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW)}`;
        const expectedAction2 = `- "Action Two" (actionDefinitionId: "${DEFAULT_FALLBACK_ACTION_ID}", commandString: "cmd2"). Description: ${ensureTerminalPunctuation(DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW)}`;

        expect(result).toContain(expectedAction1);
        expect(result).toContain(expectedAction2);
      });
    });
  });
});

// --- FILE END ---

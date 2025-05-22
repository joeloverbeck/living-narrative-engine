// tests/turns/strategies/aiPlayerStrategy.test.js
// --- FILE START ---

import {AIPlayerStrategy} from '../../../src/turns/strategies/aiPlayerStrategy.js';
import {
    DESCRIPTION_COMPONENT_ID,
    EXITS_COMPONENT_ID,
    NAME_COMPONENT_ID,
    PERCEPTION_LOG_COMPONENT_ID,
    POSITION_COMPONENT_ID
} from "../../../src/constants/componentIds.js"; // Adjust path as needed
import {jest, describe, beforeEach, test, expect, afterEach} from '@jest/globals';

// --- Mock Implementations ---

/**
 * @returns {jest.Mocked<import('../../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter>}
 */
const mockLlmAdapter = () => ({
    generateAction: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

class MockEntity {
    /**
     * @param {string} id
     * @param {Record<string, any>} componentsData
     */
    constructor(id = `mock-entity-${Math.random().toString(36).substring(2, 9)}`, componentsData = {}) {
        this.id = id;
        this.componentsData = new Map(Object.entries(componentsData));
        this.name = componentsData[NAME_COMPONENT_ID]?.text || `Mock Entity ${id}`;

        this.getComponentData = jest.fn((componentId) => this.componentsData.get(componentId));
        this.hasComponent = jest.fn((componentId) => this.componentsData.has(componentId));
    }
}

/**
 * @returns {jest.Mocked<ReturnType<typeof import('../../../src/entities/entityManager.js').default>>}
 */
const mockEntityManager = () => ({
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(() => []),
    // Add other methods if AIPlayerStrategy starts using them
});

/**
 * @returns {jest.Mocked<ReturnType<typeof import('../../../src/actions/actionDiscoverySystem.js').default>>}
 */
const mockActionDiscoverySystem = () => ({
    getValidActions: jest.fn(async () => []),
});


/**
 * Creates a mock actor instance.
 * @param {string} [id='actor1']
 * @param {Record<string, any>} [components={}]
 * @returns {MockEntity}
 */
const createMockActor = (id = 'actor1', components = {}) => {
    return new MockEntity(id, components);
};

/**
 * Fallback action base structure for comparison.
 */
const FALLBACK_AI_ACTION_BASE = Object.freeze({
    actionDefinitionId: 'core:wait',
    resolvedParameters: {errorContext: 'unknown_error'},
});


describe('AIPlayerStrategy', () => {
    /** @type {ReturnType<typeof mockLlmAdapter>} */
    let llmAdapter;
    /** @type {ReturnType<typeof mockLogger>} */
    let currentLoggerGlobalMock; // Used for _getSafeLogger tests where context provides this

    beforeEach(() => {
        llmAdapter = mockLlmAdapter();
        currentLoggerGlobalMock = mockLogger();

        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
        jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        jest.spyOn(console, 'info').mockImplementation(() => {
        });
        jest.spyOn(console, 'debug').mockImplementation(() => {
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // --- Constructor Tests ---
    describe('constructor', () => {
        test('should successfully create an instance with a valid llmAdapter', () => {
            expect(() => new AIPlayerStrategy({llmAdapter})).not.toThrow();
            const instance = new AIPlayerStrategy({llmAdapter});
            expect(instance).toBeInstanceOf(AIPlayerStrategy);
        });

        test('should throw an error if llmAdapter is not provided', () => {
            expect(() => new AIPlayerStrategy({})).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.");
            expect(console.error).toHaveBeenCalledWith(
                "AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.",
                {providedAdapter: undefined}
            );
        });

        test('should throw an error if llmAdapter is null', () => {
            expect(() => new AIPlayerStrategy({llmAdapter: null})).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.");
            expect(console.error).toHaveBeenCalledWith(
                "AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.",
                {providedAdapter: null}
            );
        });

        test('should throw an error if llmAdapter is an object without generateAction method', () => {
            const invalidAdapter = {};
            expect(() => new AIPlayerStrategy({llmAdapter: invalidAdapter})).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.");
            expect(console.error).toHaveBeenCalledWith(
                "AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.",
                {providedAdapter: invalidAdapter}
            );
        });

        test('should throw an error if llmAdapter.generateAction is not a function', () => {
            const invalidAdapter = {generateAction: 'not-a-function'};
            expect(() => new AIPlayerStrategy({llmAdapter: invalidAdapter})).toThrow("AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.");
            expect(console.error).toHaveBeenCalledWith(
                "AIPlayerStrategy: Constructor requires a valid ILLMAdapter instance with a generateAction method.",
                {providedAdapter: invalidAdapter}
            );
        });
    });

    // --- _getSafeLogger Tests ---
    describe('_getSafeLogger', () => {
        let instance;

        beforeEach(() => {
            instance = new AIPlayerStrategy({llmAdapter});
        });

        test('should return logger from context if valid', () => {
            const mockContext = {getLogger: jest.fn(() => currentLoggerGlobalMock)};
            const logger = instance._getSafeLogger(mockContext);
            expect(logger).toBe(currentLoggerGlobalMock);
            expect(mockContext.getLogger).toHaveBeenCalledTimes(1);
        });

        test('should return console fallback if context is null', () => {
            const logger = instance._getSafeLogger(null);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback if context is undefined', () => {
            const logger = instance._getSafeLogger(undefined);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback if context.getLogger is not a function', () => {
            const mockContext = {getLogger: 'not-a-function'};
            const logger = instance._getSafeLogger(mockContext);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback if context.getLogger returns null', () => {
            const mockContext = {getLogger: jest.fn(() => null)};
            const logger = instance._getSafeLogger(mockContext);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback if logger from context does not have an error method', () => {
            const faultyLogger = {info: jest.fn(), warn: jest.fn(), debug: jest.fn()}; // Missing error
            const mockContext = {getLogger: jest.fn(() => faultyLogger)};
            const logger = instance._getSafeLogger(mockContext);
            expect(typeof logger.error).toBe('function');
            logger.error("test error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test error");
        });

        test('should return console fallback and log internal error if getLogger itself throws', () => {
            const error = new Error("getLogger failed");
            const mockContext = {
                getLogger: jest.fn(() => {
                    throw error;
                })
            };
            const logger = instance._getSafeLogger(mockContext);

            expect(typeof logger.error).toBe('function');
            expect(console.error).toHaveBeenCalledWith("AIPlayerStrategy: Error retrieving logger from context, using console. Error:", error);
            logger.error("test subsequent error");
            expect(console.error).toHaveBeenCalledWith("[AIPlayerStrategy (fallback logger)]", "test subsequent error");
        });
    });

    // --- _createFallbackAction Tests ---
    describe('_createFallbackAction', () => {
        let instance;

        beforeEach(() => {
            instance = new AIPlayerStrategy({llmAdapter});
        });

        test('should create a fallback action with default actorId and given errorContext', () => {
            const errorContext = 'test_error_context';
            const fallbackAction = instance._createFallbackAction(errorContext);

            expect(fallbackAction).toEqual({
                actionDefinitionId: FALLBACK_AI_ACTION_BASE.actionDefinitionId,
                commandString: `AI Error for UnknownActor: ${errorContext}. Waiting.`,
                resolvedParameters: {
                    ...FALLBACK_AI_ACTION_BASE.resolvedParameters,
                    errorContext: errorContext,
                    actorId: 'UnknownActor',
                },
            });
        });

        test('should create a fallback action with specified actorId and errorContext', () => {
            const errorContext = 'specific_error';
            const actorId = 'actor123';
            const fallbackAction = instance._createFallbackAction(errorContext, actorId);

            expect(fallbackAction).toEqual({
                actionDefinitionId: FALLBACK_AI_ACTION_BASE.actionDefinitionId,
                commandString: `AI Error for ${actorId}: ${errorContext}. Waiting.`,
                resolvedParameters: {
                    ...FALLBACK_AI_ACTION_BASE.resolvedParameters,
                    errorContext: errorContext,
                    actorId: actorId,
                },
            });
        });

        test('should not log anything itself (delegates logging to caller)', () => {
            // This test implicitly relies on the fact that _createFallbackAction doesn't use a logger.
            // If it were to use _getSafeLogger, we might need to mock that specifically here too.
            // For now, just ensure no global console calls are made if it were to accidentally use it.
            instance._createFallbackAction('some_error', 'some_actor');
            // Check against the global console spies, not a specific logger instance.
            expect(console.error).not.toHaveBeenCalled();
            expect(console.warn).not.toHaveBeenCalled();
            expect(console.info).not.toHaveBeenCalled();
        });
    });

    // --- _transformAndValidateLLMOutput Tests ---
    describe('_transformAndValidateLLMOutput', () => {
        let instance;
        /** @type {ReturnType<typeof mockLogger>} */
        let testLogger;

        beforeEach(() => {
            instance = new AIPlayerStrategy({llmAdapter});
            testLogger = mockLogger();
        });

        test('should transform and validate a correct LLM output', () => {
            const parsedJson = {
                actionDefinitionId: 'core:move',
                resolvedParameters: {direction: 'north'},
                commandString: 'go north',
            };
            const actorId = 'actor-test';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result).toEqual({
                actionDefinitionId: 'core:move',
                resolvedParameters: {direction: 'north'},
                commandString: 'go north',
            });
            expect(testLogger.info).toHaveBeenCalledWith(
                `AIPlayerStrategy: Successfully transformed LLM output to ITurnAction for actor ${actorId}. Action: core:move`
            );
            expect(testLogger.debug).toHaveBeenCalledWith(
                `AIPlayerStrategy: Transformed ITurnAction details for ${actorId}:`,
                result
            );
            expect(testLogger.error).not.toHaveBeenCalled();
            expect(testLogger.warn).not.toHaveBeenCalled();
        });

        test('should return fallback action if parsedJson is null', () => {
            const actorId = 'actor-null-json';
            const result = instance._transformAndValidateLLMOutput(null, actorId, testLogger);

            expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION_BASE.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe('invalid_llm_output_type');
            expect(result.resolvedParameters.actorId).toBe(actorId);
            expect(testLogger.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: LLM output for actor ${actorId} is not a valid object after parsing. Received:`,
                null
            );
        });

        test('should return fallback action if parsedJson is not an object', () => {
            const actorId = 'actor-string-json';
            const result = instance._transformAndValidateLLMOutput("not-an-object", actorId, testLogger);

            expect(result.resolvedParameters.errorContext).toBe('invalid_llm_output_type');
            expect(result.resolvedParameters.actorId).toBe(actorId);
            expect(testLogger.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: LLM output for actor ${actorId} is not a valid object after parsing. Received:`,
                "not-an-object"
            );
        });

        test('should return fallback action if actionDefinitionId is missing', () => {
            const parsedJson = {resolvedParameters: {}, commandString: 'do something'};
            const actorId = 'actor-no-actionid';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.resolvedParameters.errorContext).toBe('missing_or_invalid_actionDefinitionId');
            expect(result.resolvedParameters.actorId).toBe(actorId);
            expect(testLogger.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Invalid or missing 'actionDefinitionId' in LLM output for actor ${actorId}. Received:`,
                parsedJson
            );
        });

        test('should return fallback action if actionDefinitionId is an empty string', () => {
            const parsedJson = {actionDefinitionId: ' ', resolvedParameters: {}, commandString: 'do something'};
            const actorId = 'actor-empty-actionid';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.resolvedParameters.errorContext).toBe('missing_or_invalid_actionDefinitionId');
            expect(result.resolvedParameters.actorId).toBe(actorId);
        });

        test('should default resolvedParameters to {} if missing and log a warning', () => {
            const parsedJson = {actionDefinitionId: 'core:wait', commandString: 'wait'};
            const actorId = 'actor-no-params';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result).toEqual({
                actionDefinitionId: 'core:wait',
                resolvedParameters: {},
                commandString: 'wait',
            });
            expect(testLogger.warn).toHaveBeenCalledWith(
                `AIPlayerStrategy: 'resolvedParameters' in LLM output for actor ${actorId} is not an object or is null. Defaulting to empty object. Received:`,
                parsedJson
            );
            expect(testLogger.info).toHaveBeenCalled();
        });

        test('should default resolvedParameters to {} if null and log a warning', () => {
            const parsedJson = {actionDefinitionId: 'core:wait', resolvedParameters: null, commandString: 'wait'};
            const actorId = 'actor-null-params';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.resolvedParameters).toEqual({});
            expect(testLogger.warn).toHaveBeenCalled();
        });

        test('should default resolvedParameters to {} if not an object and log a warning', () => {
            const parsedJson = {
                actionDefinitionId: 'core:wait',
                resolvedParameters: "not-an-object",
                commandString: 'wait'
            };
            const actorId = 'actor-string-params';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.resolvedParameters).toEqual({});
            expect(testLogger.warn).toHaveBeenCalled();
        });

        test('should use provided resolvedParameters if it is a valid object', () => {
            const params = {key: 'value'};
            const parsedJson = {actionDefinitionId: 'core:act', resolvedParameters: params, commandString: 'act'};
            const actorId = 'actor-valid-params';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.resolvedParameters).toEqual(params);
            expect(testLogger.warn).not.toHaveBeenCalled();
        });

        test('should default commandString if missing', () => {
            const parsedJson = {actionDefinitionId: 'core:interact', resolvedParameters: {}};
            const actorId = 'actor-no-command';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.commandString).toBe('AI Action: core:interact');
            expect(testLogger.info).toHaveBeenCalled();
        });

        test('should default commandString if an empty string', () => {
            const parsedJson = {actionDefinitionId: 'core:interact', resolvedParameters: {}, commandString: '   '};
            const actorId = 'actor-empty-command';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.commandString).toBe('AI Action: core:interact');
        });

        test('should use provided commandString if valid and trim it', () => {
            const parsedJson = {
                actionDefinitionId: 'core:speak',
                resolvedParameters: {},
                commandString: '  Hello World  '
            };
            const actorId = 'actor-valid-command';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.commandString).toBe('Hello World');
        });

        test('should trim actionDefinitionId', () => {
            const parsedJson = {
                actionDefinitionId: '  core:move  ',
                resolvedParameters: {direction: 'north'},
                commandString: 'go north',
            };
            const actorId = 'actor-trimmed-actionid';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.actionDefinitionId).toBe('core:move');
            expect(result.commandString).toBe('go north');
            expect(testLogger.info).toHaveBeenCalledWith(
                `AIPlayerStrategy: Successfully transformed LLM output to ITurnAction for actor ${actorId}. Action: core:move`
            );
        });

        test('should correctly default commandString when actionDefinitionId is trimmed', () => {
            const parsedJson = {actionDefinitionId: '  core:special  ', resolvedParameters: {}};
            const actorId = 'actor-trim-default-command';
            const result = instance._transformAndValidateLLMOutput(parsedJson, actorId, testLogger);

            expect(result.actionDefinitionId).toBe('core:special');
            expect(result.commandString).toBe('AI Action: core:special');
        });
    });

    // --- decideAction Tests ---
    describe('decideAction', () => {
        /** @type {AIPlayerStrategy} */
        let instance;
        /** @type {ReturnType<typeof mockLlmAdapter>} */
        let currentLlmAdapter_decideAction; // Specific LLM adapter for decideAction's scope
        /** @type {MockEntity} */
        let mockActor_decideAction; // Specific actor for decideAction's scope
        /** @type {ReturnType<typeof mockEntityManager>} */
        let mockEntityManagerInstance_decideAction; // Specific EM for decideAction's scope
        /** @type {ReturnType<typeof mockActionDiscoverySystem>} */
        let mockActionDiscoverySystemInstance_decideAction; // Specific ADS for decideAction's scope
        /** @type {ReturnType<typeof mockLogger>} */
        let capturedLogger_decideAction; // Specific logger for decideAction's scope

        const createDecideActionMockContext = (actorEntity, overrides = {}) => {
            const defaultLogger = mockLogger();
            capturedLogger_decideAction = defaultLogger; // Capture this specific logger
            mockEntityManagerInstance_decideAction = mockEntityManager();
            mockActionDiscoverySystemInstance_decideAction = mockActionDiscoverySystem();

            return {
                getLogger: jest.fn(() => capturedLogger_decideAction),
                getActor: jest.fn(() => actorEntity),
                getEntityManager: jest.fn(() => mockEntityManagerInstance_decideAction),
                getActionDiscoverySystem: jest.fn(() => mockActionDiscoverySystemInstance_decideAction),
                game: {worldName: 'TestWorld'},
                ...overrides,
            };
        };

        beforeEach(() => {
            currentLlmAdapter_decideAction = mockLlmAdapter();
            instance = new AIPlayerStrategy({llmAdapter: currentLlmAdapter_decideAction});
            mockActor_decideAction = createMockActor('player1', {
                [NAME_COMPONENT_ID]: {text: 'Hero'},
                [DESCRIPTION_COMPONENT_ID]: {text: 'A brave adventurer.'},
                [POSITION_COMPONENT_ID]: {locationId: 'startRoom'},
                [PERCEPTION_LOG_COMPONENT_ID]: {
                    logEntries: [
                        {descriptionText: 'A bird chirped.', timestamp: 1, perceptionType: 'sound'},
                        {descriptionText: 'You see a door.', timestamp: 2, perceptionType: 'sight'},
                    ]
                }
            });
        });

        test('should return fallback action if context is null', async () => {
            const result = await instance.decideAction(null);
            expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION_BASE.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe('null_turn_context');
            expect(console.error).toHaveBeenCalledWith( // Uses fallback logger early
                "[AIPlayerStrategy (fallback logger)]",
                "AIPlayerStrategy: Critical - ITurnContext is null or undefined."
            );
        });

        test('should return fallback action if context.getActor() returns null', async () => {
            const context = createDecideActionMockContext(null); // actor is null
            const result = await instance.decideAction(context);

            expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION_BASE.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe('missing_actor_in_context');
            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith("AIPlayerStrategy: Critical - Actor not available or ID missing in ITurnContext.");
        });

        test('should return fallback action if actor has no ID', async () => {
            const actorWithoutId = new MockEntity(undefined); // Simulate actor with no id
            actorWithoutId.id = undefined; // Ensure id is undefined
            const context = createDecideActionMockContext(actorWithoutId);
            const result = await instance.decideAction(context);

            expect(result.actionDefinitionId).toBe(FALLBACK_AI_ACTION_BASE.actionDefinitionId);
            expect(result.resolvedParameters.errorContext).toBe('missing_actor_in_context');
            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith("AIPlayerStrategy: Critical - Actor not available or ID missing in ITurnContext.");
        });

        test('HAPPY PATH: should correctly process context, generate prompt, call LLM, and return transformed action', async () => {
            mockActor_decideAction = createMockActor('heroId', {
                [NAME_COMPONENT_ID]: {text: 'Sir Reginald'},
                [DESCRIPTION_COMPONENT_ID]: {text: 'A Knight of Renown'},
                [POSITION_COMPONENT_ID]: {locationId: 'castleHall'},
                [PERCEPTION_LOG_COMPONENT_ID]: {
                    logEntries: [
                        {descriptionText: 'A guard nods at you.', timestamp: 100, perceptionType: 'sight'},
                        {descriptionText: 'You hear a faint hum.', timestamp: 101, perceptionType: 'sound'},
                    ]
                }
            });
            const context = createDecideActionMockContext(mockActor_decideAction);
            const locationEntity = new MockEntity('castleHall', {
                [NAME_COMPONENT_ID]: {text: 'Grand Castle Hall'},
                [DESCRIPTION_COMPONENT_ID]: {text: 'A vast hall with high ceilings.'},
                [EXITS_COMPONENT_ID]: [
                    {direction: 'north', target: 'throneRoom'},
                    {direction: 'south', target: 'courtyard'}
                ]
            });
            mockEntityManagerInstance_decideAction.getEntityInstance.mockImplementation((id) => {
                if (id === 'castleHall') return locationEntity;
                if (id === 'npc1') return new MockEntity('npc1', {
                    [NAME_COMPONENT_ID]: {text: 'Guard Captain'},
                    [DESCRIPTION_COMPONENT_ID]: {text: 'Stern-looking.'}
                });
                return null;
            });
            mockEntityManagerInstance_decideAction.getEntitiesInLocation.mockReturnValue(['heroId', 'npc1']);
            const availableActions = [
                {
                    id: 'core:move',
                    command: 'move <direction>',
                    name: 'Move',
                    description: 'Move to an adjacent location.'
                },
                {id: 'core:look', command: 'look', name: 'Look', description: 'Examine your surroundings.'},
                {id: 'core:speak', command: 'speak <target> <message>', name: 'Speak', description: 'Talk to someone.'}
            ];
            mockActionDiscoverySystemInstance_decideAction.getValidActions.mockResolvedValue(availableActions);
            const llmResponse = {
                actionDefinitionId: 'core:move',
                resolvedParameters: {direction: 'north'},
                commandString: 'move north'
            };
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify(llmResponse));

            const resultAction = await instance.decideAction(context);

            expect(capturedLogger_decideAction.info).toHaveBeenCalledWith(`AIPlayerStrategy: decideAction called for actor ${mockActor_decideAction.id}.`);
            expect(capturedLogger_decideAction.debug).toHaveBeenCalledWith(expect.stringContaining('Generated location summary for actor'), expect.anything());
            expect(capturedLogger_decideAction.debug).toHaveBeenCalledWith(expect.stringContaining('Retrieved 2 perception log entries for actor'));
            expect(capturedLogger_decideAction.info).toHaveBeenCalledWith(expect.stringContaining('Generated LLM prompt for actor'));
            expect(currentLlmAdapter_decideAction.generateAction).toHaveBeenCalledTimes(1);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("You're Sir Reginald. Description: A Knight of Renown.");
            expect(generatedPrompt).toContain("You're in the location Grand Castle Hall. Description: A vast hall with high ceilings.");
            expect(generatedPrompt).toContain("Exits: north to throneRoom, south to courtyard.");
            expect(generatedPrompt).toContain("Characters here: Guard Captain (Stern-looking.).");
            expect(generatedPrompt).toContain("Recent events:\n- A guard nods at you.\n- You hear a faint hum.");
            expect(generatedPrompt).toContain("Your available actions are:\n- move <direction> (Move to an adjacent location.)\n- look (Examine your surroundings.)\n- speak <target> <message> (Talk to someone.)");
            expect(generatedPrompt).toContain("Apart from picking one among the available actions, you have the opportunity to speak. It's not obligatory. Use your reasoning to determine if you should talk in this context.");
            expect(capturedLogger_decideAction.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Received LLM JSON response for actor ${mockActor_decideAction.id}: ${JSON.stringify(llmResponse)}`);
            expect(capturedLogger_decideAction.info).toHaveBeenCalledWith(`AIPlayerStrategy: Successfully transformed LLM output to ITurnAction for actor ${mockActor_decideAction.id}. Action: ${llmResponse.actionDefinitionId}`);
            expect(resultAction).toEqual(llmResponse);
            expect(capturedLogger_decideAction.error).not.toHaveBeenCalled();
        });

        test('should handle actor with no POSITION_COMPONENT_ID', async () => {
            mockActor_decideAction = createMockActor('playerNoPos', {[NAME_COMPONENT_ID]: {text: 'Floating Being'}});
            mockActor_decideAction.componentsData.delete(POSITION_COMPONENT_ID); // remove position
            mockActor_decideAction.hasComponent = jest.fn(id => mockActor_decideAction.componentsData.has(id)); // re-mock hasComponent for this instance

            const context = createDecideActionMockContext(mockActor_decideAction);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);

            expect(capturedLogger_decideAction.info).toHaveBeenCalledWith(`AIPlayerStrategy: Actor ${mockActor_decideAction.id} has no position component or locationId. Cannot generate location summary.`);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Your current location is unknown.");
            expect(generatedPrompt).not.toContain("You're in the location");
        });

        test('should handle actor with POSITION_COMPONENT_ID but no locationId', async () => {
            mockActor_decideAction = createMockActor('playerNoLocId', { // New actor for this test
                [NAME_COMPONENT_ID]: {text: 'Lost Soul'},
                [POSITION_COMPONENT_ID]: {locationId: null} // Has component, but locationId is null
            });
            const context = createDecideActionMockContext(mockActor_decideAction);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);

            expect(capturedLogger_decideAction.info).toHaveBeenCalledWith(`AIPlayerStrategy: Actor ${mockActor_decideAction.id} has no position component or locationId. Cannot generate location summary.`);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Your current location is unknown.");
        });

        test('should handle missing EntityManager in context', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction, {getEntityManager: () => null}); // Override EM
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);

            expect(capturedLogger_decideAction.warn).toHaveBeenCalledWith(`AIPlayerStrategy: EntityManager not available through context for actor ${mockActor_decideAction.id}. Cannot fetch location details.`);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Your current location is unknown.");
        });

        test('should handle location entity not found by EntityManager', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(null); // Location not found
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);

            const expectedLocationId = mockActor_decideAction.getComponentData(POSITION_COMPONENT_ID).locationId;
            expect(capturedLogger_decideAction.warn).toHaveBeenCalledWith(`AIPlayerStrategy: Location entity for ID '${expectedLocationId}' not found via EntityManager for actor ${mockActor_decideAction.id}.`);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Your current location is unknown.");
        });

        test('should use default name and description if location entity lacks them', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            // Ensure actor is in a location for which getEntityInstance will be called
            const actorLocationId = mockActor_decideAction.getComponentData(POSITION_COMPONENT_ID).locationId;
            const locationEntityNoDetails = new MockEntity(actorLocationId, {[EXITS_COMPONENT_ID]: []}); // No NAME or DESCRIPTION
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(locationEntityNoDetails);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);

            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("You're in the location Unknown Location. Description: No description available.");
            expect(capturedLogger_decideAction.debug).toHaveBeenCalledWith(
                `AIPlayerStrategy: Generated location summary for actor ${mockActor_decideAction.id} in location ${actorLocationId}:`,
                expect.objectContaining({name: 'Unknown Location', description: 'No description available.'})
            );
        });

        test('should handle location with no EXITS_COMPONENT_ID', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const actorLocationId = mockActor_decideAction.getComponentData(POSITION_COMPONENT_ID).locationId;
            const locationNoExitsComp = new MockEntity(actorLocationId, {
                [NAME_COMPONENT_ID]: {text: 'Sealed Chamber'},
                [DESCRIPTION_COMPONENT_ID]: {text: 'A room with no obvious exits component.'}
                // No EXITS_COMPONENT_ID
            });
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(locationNoExitsComp);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("There are no obvious exits.");
        });

        test('should handle location with EXITS_COMPONENT_ID not being an array', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const actorLocationId = mockActor_decideAction.getComponentData(POSITION_COMPONENT_ID).locationId;
            const locationMalformedExits = new MockEntity(actorLocationId, {
                [NAME_COMPONENT_ID]: {text: 'Weird Room'},
                [DESCRIPTION_COMPONENT_ID]: {text: 'Exits are strange here.'},
                [EXITS_COMPONENT_ID]: {not: 'an array'} // Malformed exits
            });
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(locationMalformedExits);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("There are no obvious exits.");
        });

        test('should handle location with empty EXITS_COMPONENT_ID array', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const actorLocationId = mockActor_decideAction.getComponentData(POSITION_COMPONENT_ID).locationId;
            const locationEmptyExits = new MockEntity(actorLocationId, {
                [NAME_COMPONENT_ID]: {text: 'Cul-de-sac'},
                [DESCRIPTION_COMPONENT_ID]: {text: 'A dead end.'},
                [EXITS_COMPONENT_ID]: [] // Empty exits array
            });
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(locationEmptyExits);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("There are no obvious exits.");
        });

        test('should filter out malformed exits (missing direction, target, or "Unmarked Exit")', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const actorLocationId = mockActor_decideAction.getComponentData(POSITION_COMPONENT_ID).locationId;
            const locationPartialExits = new MockEntity(actorLocationId, {
                [NAME_COMPONENT_ID]: {text: 'Tricky Room'},
                [DESCRIPTION_COMPONENT_ID]: {text: 'Some exits are not clear.'},
                [EXITS_COMPONENT_ID]: [
                    {direction: 'north', target: 'validTarget1'},
                    {target: 'noDirectionTarget'}, // Missing direction
                    {direction: 'east'}, // Missing target
                    {direction: 'Unmarked Exit', target: 'unmarkedTarget'},
                    {direction: 'south', target: 'validTarget2'},
                ]
            });
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(locationPartialExits);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Exits: north to validTarget1, south to validTarget2.");
        });

        test('should handle no other characters in location (getEntitiesInLocation returns empty)', async () => {
            const actorLocationId = 'aloneRoom_loc_id';
            mockActor_decideAction = createMockActor('playerAlone', {
                [NAME_COMPONENT_ID]: {text: 'Solo Adventurer'},
                [POSITION_COMPONENT_ID]: {locationId: actorLocationId},
                [PERCEPTION_LOG_COMPONENT_ID]: {logEntries: []} // Clear perception for simplicity
            });
            const context = createDecideActionMockContext(mockActor_decideAction);
            const locationEntity = new MockEntity(actorLocationId, {[NAME_COMPONENT_ID]: {text: 'Solitary Place'}});
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(locationEntity);
            // IMPORTANT: Ensure getEntitiesInLocation is for the correct location ID
            mockEntityManagerInstance_decideAction.getEntitiesInLocation.mockImplementation(locId => {
                if (locId === actorLocationId) return [mockActor_decideAction.id]; // Only actor itself
                return [];
            });
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("You are alone here.");
        });

        test('should handle getEntitiesInLocation returning null', async () => {
            const actorLocationId = 'errorRoom_loc_id';
            mockActor_decideAction = createMockActor('playerErrorLoc', {
                [NAME_COMPONENT_ID]: {text: 'Glitch Seeker'},
                [POSITION_COMPONENT_ID]: {locationId: actorLocationId},
                [PERCEPTION_LOG_COMPONENT_ID]: {logEntries: []}
            });
            const context = createDecideActionMockContext(mockActor_decideAction);
            const locationEntity = new MockEntity(actorLocationId, {[NAME_COMPONENT_ID]: {text: 'Glitchy Place'}});
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(locationEntity);
            mockEntityManagerInstance_decideAction.getEntitiesInLocation.mockImplementation(locId => {
                if (locId === actorLocationId) return null; // Simulates an issue for this location
                return [];
            });
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("You are alone here."); // Should default to this
        });

        test('should handle other characters missing name/description', async () => {
            const actorLocationId = 'nameless_crowd_loc';
            mockActor_decideAction = createMockActor('observer', {
                [NAME_COMPONENT_ID]: {text: 'Observer'},
                [POSITION_COMPONENT_ID]: {locationId: actorLocationId},
                [PERCEPTION_LOG_COMPONENT_ID]: {logEntries: []}
            });
            const context = createDecideActionMockContext(mockActor_decideAction);

            const locationEntity = new MockEntity(actorLocationId, {[NAME_COMPONENT_ID]: {text: 'Crowded Room'}});
            const npcNameless = new MockEntity('npcNameless', {}); // No name/desc components
            const npcNoDesc = new MockEntity('npcNoDesc', {[NAME_COMPONENT_ID]: {text: 'Mysterious Figure'}});

            mockEntityManagerInstance_decideAction.getEntityInstance.mockImplementation((id) => {
                if (id === actorLocationId) return locationEntity;
                if (id === 'npcNameless') return npcNameless;
                if (id === 'npcNoDesc') return npcNoDesc;
                return null;
            });
            mockEntityManagerInstance_decideAction.getEntitiesInLocation.mockImplementation(locId => {
                if (locId === actorLocationId) return [mockActor_decideAction.id, 'npcNameless', 'npcNoDesc'];
                return [];
            });
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Characters here: Unnamed Character (No description available.), Mysterious Figure (No description available.).");
        });

        test('should log error and continue if location summary generation throws an error', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const locError = new Error("Failed to get location details");
            mockEntityManagerInstance_decideAction.getEntityInstance.mockImplementation(() => { // This mock applies to any getEntityInstance call
                throw locError;
            });
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({
                actionDefinitionId: 'core:wait',
                commandString: 'wait'
            }));

            await instance.decideAction(context);

            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Error generating location summary for actor ${mockActor_decideAction.id}: ${locError.message}`,
                locError
            );
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Your current location is unknown."); // Should fallback gracefully
            expect(currentLlmAdapter_decideAction.generateAction).toHaveBeenCalled(); // Still attempts to generate action
        });

        test('should handle missing getActionDiscoverySystem on context', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction, {getActionDiscoverySystem: undefined});
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);

            expect(capturedLogger_decideAction.warn).toHaveBeenCalledWith(`AIPlayerStrategy: ITurnContext has no getActionDiscoverySystem() – skipping action discovery for actor ${mockActor_decideAction.id}.`);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Your available actions are:\nYou have no specific actions available right now.");
        });

        test('should handle getActionDiscoverySystem returning null', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction, {getActionDiscoverySystem: () => null});
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);
            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith(
                expect.stringContaining(`AIPlayerStrategy: Error while discovering actions for actor ${mockActor_decideAction.id}:`),
                expect.any(TypeError) // e.g., "Cannot read properties of null (reading 'getValidActions')"
            );
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Your available actions are:\nYou have no specific actions available right now.");
        });

        test('should handle error during getValidActions call', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const adsError = new Error("ADS failure");
            mockActionDiscoverySystemInstance_decideAction.getValidActions.mockRejectedValue(adsError);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);

            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Error while discovering actions for actor ${mockActor_decideAction.id}: ${adsError.message}`,
                adsError
            );
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Your available actions are:\nYou have no specific actions available right now.");
        });

        test('should handle empty array from getValidActions', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            mockActionDiscoverySystemInstance_decideAction.getValidActions.mockResolvedValue([]); // No actions available
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);

            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Your available actions are:\nYou have no specific actions available right now.");
            expect(capturedLogger_decideAction.error).not.toHaveBeenCalled();
        });

        test('should correctly format available actions in prompt (with name, command, description)', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const actions = [
                {id: 'a1', command: 'do_x', name: 'Action X', description: 'Performs X.'},
                {id: 'a2', command: 'do_y', name: 'Action Y', description: null}, // No description
                {id: 'a3', command: 'do_z', name: null, description: 'Performs Z.'}, // No name
                {id: 'a4', command: 'do_w', name: 'Action W'}, // No description field
            ];
            mockActionDiscoverySystemInstance_decideAction.getValidActions.mockResolvedValue(actions);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];

            expect(generatedPrompt).toContain("Your available actions are:");
            expect(generatedPrompt).toContain("- do_x (Performs X.)");
            expect(generatedPrompt).toContain("- do_y (Action Y)"); // Uses name if description is null
            expect(generatedPrompt).toContain("- do_z (Performs Z.)"); // Uses description if name is null
            expect(generatedPrompt).toContain("- do_w (Action W)"); // Uses name if description field is missing
        });

        test('should handle actor with no PERCEPTION_LOG_COMPONENT_ID', async () => {
            mockActor_decideAction = createMockActor('playerNoPerception', {[NAME_COMPONENT_ID]: {text: 'Oblivious One'}});
            mockActor_decideAction.componentsData.delete(PERCEPTION_LOG_COMPONENT_ID);
            mockActor_decideAction.hasComponent = jest.fn(id => mockActor_decideAction.componentsData.has(id)); // Re-mock

            const context = createDecideActionMockContext(mockActor_decideAction);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);

            expect(capturedLogger_decideAction.info).toHaveBeenCalledWith(`AIPlayerStrategy: Actor ${mockActor_decideAction.id} does not have a '${PERCEPTION_LOG_COMPONENT_ID}' component. No perception log included.`);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Recent events:\nNone.");
        });

        test('should handle PERCEPTION_LOG_COMPONENT_ID with missing logEntries', async () => {
            // Use the default mockActor_decideAction which has the component
            mockActor_decideAction.componentsData.set(PERCEPTION_LOG_COMPONENT_ID, {logEntries: undefined}); // Corrupt data
            const context = createDecideActionMockContext(mockActor_decideAction);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);
            expect(capturedLogger_decideAction.info).toHaveBeenCalledWith(`AIPlayerStrategy: Actor ${mockActor_decideAction.id} has '${PERCEPTION_LOG_COMPONENT_ID}' but 'logEntries' are missing or malformed.`);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Recent events:\nNone.");
        });

        test('should handle PERCEPTION_LOG_COMPONENT_ID with logEntries not being an array', async () => {
            mockActor_decideAction.componentsData.set(PERCEPTION_LOG_COMPONENT_ID, {logEntries: "not-an-array"}); // Corrupt data
            const context = createDecideActionMockContext(mockActor_decideAction);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);

            expect(capturedLogger_decideAction.info).toHaveBeenCalledWith(`AIPlayerStrategy: Actor ${mockActor_decideAction.id} has '${PERCEPTION_LOG_COMPONENT_ID}' but 'logEntries' are missing or malformed.`);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Recent events:\nNone.");
        });

        test('should handle PERCEPTION_LOG_COMPONENT_ID with empty logEntries array', async () => {
            mockActor_decideAction.componentsData.set(PERCEPTION_LOG_COMPONENT_ID, {logEntries: []}); // Empty but valid
            const context = createDecideActionMockContext(mockActor_decideAction);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);
            expect(capturedLogger_decideAction.debug).toHaveBeenCalledWith(`AIPlayerStrategy: Retrieved 0 perception log entries for actor ${mockActor_decideAction.id}.`);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Recent events:\nNone.");
        });

        test('should handle perception log entries with missing descriptionText (results in "undefined" in prompt)', async () => {
            mockActor_decideAction.componentsData.set(PERCEPTION_LOG_COMPONENT_ID, {
                logEntries: [
                    {descriptionText: 'Something happened.', timestamp: 1, perceptionType: 'generic'},
                    {timestamp: 2, perceptionType: 'mystery'} // Missing descriptionText
                ]
            });
            const context = createDecideActionMockContext(mockActor_decideAction);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Recent events:\n- Something happened.\n- undefined");
        });

        test('should log error and continue if perception log retrieval throws an error', async () => {
            const perceptionError = new Error("Cannot access memories");
            const originalGetComponentData = mockActor_decideAction.getComponentData;
            // Modify the getComponentData for the specific mockActor instance in this test
            mockActor_decideAction.getComponentData = jest.fn((componentId) => {
                if (componentId === PERCEPTION_LOG_COMPONENT_ID) {
                    throw perceptionError;
                }
                return originalGetComponentData.call(mockActor_decideAction, componentId); // Use call to maintain 'this' context if original method uses it
            });

            const context = createDecideActionMockContext(mockActor_decideAction);
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);

            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Error retrieving perception log for actor ${mockActor_decideAction.id}: ${perceptionError.message}`,
                perceptionError
            );
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("Recent events:\nNone."); // Fallback for perception log
            expect(currentLlmAdapter_decideAction.generateAction).toHaveBeenCalled(); // Still attempts to generate action
        });

        test('should return fallback action if llmAdapter.generateAction throws an error', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const llmError = new Error("LLM service unavailable");
            currentLlmAdapter_decideAction.generateAction.mockRejectedValue(llmError);

            const resultAction = await instance.decideAction(context);

            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error during decideAction for actor ${mockActor_decideAction.id}: ${llmError.message}`,
                llmError
            );
            expect(resultAction.actionDefinitionId).toBe(FALLBACK_AI_ACTION_BASE.actionDefinitionId);
            expect(resultAction.resolvedParameters.errorContext).toMatch(/^unhandled_decide_action_error:.*/);
        });

        test('should return fallback action if llmAdapter.generateAction returns non-JSON string', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const nonJsonResponse = "This is not JSON.";
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(nonJsonResponse);

            const resultAction = await instance.decideAction(context);

            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith(
                expect.stringContaining(`AIPlayerStrategy: Failed to parse LLM JSON response for actor ${mockActor_decideAction.id}.`),
                expect.any(SyntaxError)
            );
            expect(resultAction.resolvedParameters.errorContext).toBe('llm_response_parse_error');
        });

        test('should return fallback action from _transformAndValidateLLMOutput if LLM returns valid JSON but invalid structure', async () => {
            const context = createDecideActionMockContext(mockActor_decideAction);
            const invalidLlmContent = {someOtherField: 'data'}; // Missing actionDefinitionId
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify(invalidLlmContent));

            const resultAction = await instance.decideAction(context);

            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Invalid or missing 'actionDefinitionId' in LLM output for actor ${mockActor_decideAction.id}. Received:`,
                invalidLlmContent
            );
            expect(resultAction.resolvedParameters.errorContext).toBe('missing_or_invalid_actionDefinitionId');
        });

        test('should use default actor name and description in prompt if components are missing', async () => {
            mockActor_decideAction = createMockActor('actorNoDetails'); // Fresh actor, no components by default from createMockActor
            // Ensure POSITION_COMPONENT_ID exists for location processing, but NAME and DESC do not.
            mockActor_decideAction.componentsData.set(POSITION_COMPONENT_ID, {locationId: 'someplace'});
            // Explicitly ensure NAME and DESCRIPTION are not on componentsData for this actor
            mockActor_decideAction.componentsData.delete(NAME_COMPONENT_ID);
            mockActor_decideAction.componentsData.delete(DESCRIPTION_COMPONENT_ID);
            // Update hasComponent and getComponentData for this specific actor instance
            mockActor_decideAction.hasComponent = jest.fn(id => mockActor_decideAction.componentsData.has(id));
            mockActor_decideAction.getComponentData = jest.fn(id => mockActor_decideAction.componentsData.get(id));


            const context = createDecideActionMockContext(mockActor_decideAction);
            const locationEntity = new MockEntity('someplace', {[NAME_COMPONENT_ID]: {text: 'A Room'}});
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(locationEntity);
            mockEntityManagerInstance_decideAction.getEntitiesInLocation.mockReturnValue([]); // No other entities for simplicity
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("You're Unknown Name. Description: No description available.");
        });

        test('should return fallback action for an unexpected general error during decideAction', async () => {
            const unexpectedError = new Error("Something completely unexpected broke!");
            // Sabotage a call *after* initial actor ID check and logger retrieval
            const originalGetCompData = mockActor_decideAction.getComponentData;
            mockActor_decideAction.getComponentData = jest.fn((componentId) => {
                if (componentId === NAME_COMPONENT_ID) { // Let it fail when trying to get actor's name for prompt
                    throw unexpectedError;
                }
                return originalGetCompData.call(mockActor_decideAction, componentId);
            });

            const context = createDecideActionMockContext(mockActor_decideAction);
            // Minimal setup for EM to avoid other errors masking this one
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(null); // Location not found is fine

            const resultAction = await instance.decideAction(context);

            expect(capturedLogger_decideAction.error).toHaveBeenCalledWith(
                `AIPlayerStrategy: Unhandled error during decideAction for actor ${mockActor_decideAction.id}: ${unexpectedError.message}`,
                unexpectedError
            );
            expect(resultAction.resolvedParameters.errorContext).toMatch(/^unhandled_decide_action_error:.*/);
        });

        test('should correctly build prompt string when actor name is available but description is not', async () => {
            mockActor_decideAction = createMockActor('actorOnlyName', {
                [NAME_COMPONENT_ID]: {text: 'Lone Wolf'},
                [POSITION_COMPONENT_ID]: {locationId: 'wilderness'},
                // NO DESCRIPTION_COMPONENT_ID
            });
            const context = createDecideActionMockContext(mockActor_decideAction);
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(new MockEntity('wilderness', {[NAME_COMPONENT_ID]: {text: 'The Wilds'}}));
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("You're Lone Wolf. Description: No description available.");
        });

        test('should correctly build prompt string when actor description is available but name is not', async () => {
            mockActor_decideAction = createMockActor('actorOnlyDesc'); // Start fresh
            mockActor_decideAction.componentsData.set(DESCRIPTION_COMPONENT_ID, {text: 'A mysterious entity.'});
            mockActor_decideAction.componentsData.set(POSITION_COMPONENT_ID, {locationId: 'shadows'});
            mockActor_decideAction.componentsData.delete(NAME_COMPONENT_ID); // Ensure no name component data

            // Update mocks for this specific actor instance
            mockActor_decideAction.hasComponent = jest.fn(id => mockActor_decideAction.componentsData.has(id));
            mockActor_decideAction.getComponentData = jest.fn(id => mockActor_decideAction.componentsData.get(id));


            const context = createDecideActionMockContext(mockActor_decideAction);
            mockEntityManagerInstance_decideAction.getEntityInstance.mockReturnValue(new MockEntity('shadows', {[NAME_COMPONENT_ID]: {text: 'The Shadows'}}));
            currentLlmAdapter_decideAction.generateAction.mockResolvedValue(JSON.stringify({actionDefinitionId: 'core:wait'}));

            await instance.decideAction(context);
            const generatedPrompt = currentLlmAdapter_decideAction.generateAction.mock.calls[0][0];
            expect(generatedPrompt).toContain("You're Unknown Name. Description: A mysterious entity.");
        });

    }); // End of describe('decideAction')
}); // End of describe('AIPlayerStrategy')

// --- FILE END ---
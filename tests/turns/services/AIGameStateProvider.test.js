// tests/turns/services/AIGameStateProvider.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect, afterEach} from '@jest/globals';
import {AIGameStateProvider} from '../../../src/turns/services/AIGameStateProvider.js';
import {
    NAME_COMPONENT_ID,
    DESCRIPTION_COMPONENT_ID,
    POSITION_COMPONENT_ID,
    EXITS_COMPONENT_ID,
    PERCEPTION_LOG_COMPONENT_ID,
    PERSONALITY_COMPONENT_ID,
    PROFILE_COMPONENT_ID,
    LIKES_COMPONENT_ID,
    DISLIKES_COMPONENT_ID,
    SECRETS_COMPONENT_ID,
    SPEECH_PATTERNS_COMPONENT_ID
} from '../../../src/constants/componentIds.js';
import {
    DEFAULT_FALLBACK_LOCATION_NAME as DEFAULT_LOCATION_NAME_CONST,
    DEFAULT_FALLBACK_EXIT_DIRECTION as DEFAULT_EXIT_DIRECTION_CONST
} from '../../../src/constants/textDefaults.js';

// -----------------------------------------------------------------------------
// Mock implementations
// -----------------------------------------------------------------------------

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
    constructor(
        id = `mock-entity-${Math.random().toString(36).substring(2, 9)}`,
        componentsData = {},
        presentComponents = []
    ) {
        this.id = id;
        this._componentsData = componentsData;
        this._presentComponents = new Set(presentComponents);
        Object.keys(componentsData).forEach(k => this._presentComponents.add(k));

        this.getComponentData = jest.fn(compId =>
            compId in this._componentsData ? this._componentsData[compId] : undefined
        );
        this.hasComponent = jest.fn(compId => this._presentComponents.has(compId));
    }

    // ----------------------------- NEW ---------------------------------------
    /** Mimic Entity.componentEntries – iterable of [id, data] pairs */
    get componentEntries() {
        return Object.entries(this._componentsData);
    }

    /** Optional parity helper (not strictly required for the tests) */
    get componentTypeIds() {
        return Object.keys(this._componentsData);
    }

    // ------------------------------------------------------------------------

    setComponentData(componentId, data) {
        this._componentsData[componentId] = data;
        this._presentComponents.add(componentId);
    }

    removeComponent(componentId) {
        delete this._componentsData[componentId];
        this._presentComponents.delete(componentId);
    }
}

/**
 * @returns {jest.Mocked<import('../../../src/entities/services/IEntityManager.js').IEntityManager>}
 */
const mockEntityManager = () => ({
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../../src/turns/interfaces/IActionDiscoverySystem.js').IActionDiscoverySystem>}
 */
const mockActionDiscoverySystem = () => ({
    getValidActions: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../../src/turns/interfaces/ITurnContext.js').ITurnContext>}
 */
const mockTurnContext = () => {
    const loggerInstance = mockLogger();
    const entityManagerInstance = mockEntityManager();
    const actionDiscoverySystemInst = mockActionDiscoverySystem();

    return {
        getLogger: jest.fn(() => loggerInstance),
        getActor: jest.fn(),
        getEntityManager: jest.fn(() => entityManagerInstance),
        getActionDiscoverySystem: jest.fn(() => actionDiscoverySystemInst),
        game: {},
        // Expose for convenience in tests
        mockLoggerInstance: loggerInstance,
        mockEntityManagerInstance: entityManagerInstance,
        mockActionDiscoverySystemInstance: actionDiscoverySystemInst,
    };
};

// -----------------------------------------------------------------------------
// Actual test cases
// -----------------------------------------------------------------------------

describe('AIGameStateProvider', () => {
    let provider;
    let logger;
    let turnContext;
    let entityManager;
    let actionDiscoverySystem;
    let mockActor;

    // Import-aliased constants
    const DEFAULT_CHARACTER_NAME = "Unnamed Character";
    const DEFAULT_DESCRIPTION = "No description available";
    const DEFAULT_LOCATION_NAME = DEFAULT_LOCATION_NAME_CONST;
    const DEFAULT_ACTION_NAME = "Unnamed Action";
    const DEFAULT_ACTION_DESC = "No specific description";
    const DEFAULT_EXIT_DIRECTION = DEFAULT_EXIT_DIRECTION_CONST;

    // -------------------------------------------------------------------------
    // Global before/after
    // -------------------------------------------------------------------------
    beforeEach(() => {
        turnContext = mockTurnContext();
        logger = turnContext.mockLoggerInstance;
        entityManager = turnContext.mockEntityManagerInstance;
        actionDiscoverySystem = turnContext.mockActionDiscoverySystemInstance;

        mockActor = new MockEntity('actor1');
        mockActor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

        turnContext.getActor.mockReturnValue(mockActor);
        turnContext.game = {worldId: 'test-world', someOtherData: 'data'};

        provider = new AIGameStateProvider();

        // basic location stub
        const minimalLocationEntity = new MockEntity('loc1', {
            [NAME_COMPONENT_ID]: {text: 'A Room'},
            [DESCRIPTION_COMPONENT_ID]: {text: 'Just a room.'},
        });

        entityManager.getEntityInstance.mockImplementation(async id => {
            if (id === 'loc1') return minimalLocationEntity;
            return null;
        });
        entityManager.getEntitiesInLocation.mockResolvedValue(new Set());
        actionDiscoverySystem.getValidActions.mockResolvedValue([]);

        jest.spyOn(Date, 'now').mockReturnValue(1678886400000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // Constructor sanity
    // -------------------------------------------------------------------------
    describe('constructor', () => {
        test('should create an instance', () => {
            expect(new AIGameStateProvider()).toBeInstanceOf(AIGameStateProvider);
        });
    });

    describe('buildGameState', () => {
        describe('Input Validation', () => {
            test('should throw error and log if actor is null', async () => {
                const expectedErrorMsg = "AIGameStateProvider: Actor is invalid or missing ID. Cannot build game state.";
                await expect(provider.buildGameState(null, turnContext, logger))
                    .rejects
                    .toThrow(expectedErrorMsg);
                expect(logger.error).toHaveBeenCalledWith(expectedErrorMsg, {actor: null});
            });

            test('should throw error and log if actor has no ID', async () => {
                const actorWithoutId = new MockEntity(null);
                actorWithoutId.id = null; // Explicitly set id to null
                const expectedErrorMsg = "AIGameStateProvider: Actor is invalid or missing ID. Cannot build game state.";
                await expect(provider.buildGameState(actorWithoutId, turnContext, logger))
                    .rejects
                    .toThrow(expectedErrorMsg);
                expect(logger.error).toHaveBeenCalledWith(expectedErrorMsg, {actor: actorWithoutId});
            });

            test('should throw error and log if turnContext is null', async () => {
                const actor = new MockEntity('actor1');
                const expectedErrorMsg = `AIGameStateProvider: TurnContext is invalid for actor ${actor.id}. Cannot build game state.`;
                await expect(provider.buildGameState(actor, null, logger))
                    .rejects
                    .toThrow(expectedErrorMsg);
                expect(logger.error).toHaveBeenCalledWith(expectedErrorMsg, {turnContext: null});
            });
        });

        // ---------------------------------------------------------------------
        // _getComponentText related tests
        // ---------------------------------------------------------------------
        describe('_getComponentText (implicitly and explicitly)', () => {
            test('should populate AIActorStateDTO with name and description if components exist', async () => {
                const actor = new MockEntity('actorTest');
                actor.setComponentData(NAME_COMPONENT_ID, {text: 'Test Actor Name'});
                actor.setComponentData(DESCRIPTION_COMPONENT_ID, {text: 'A brave test actor.'});
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const {actorState} = await provider.buildGameState(actor, turnContext, logger);

                expect(actorState).toEqual(
                    expect.objectContaining({
                        id: 'actorTest',
                        [NAME_COMPONENT_ID]: {text: 'Test Actor Name'},
                        [DESCRIPTION_COMPONENT_ID]: {text: 'A brave test actor.'},
                    })
                );
            });

            test('should use default name and description if components are missing data', async () => {
                const actor = new MockEntity('actorNoName');
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const {actorState} = await provider.buildGameState(actor, turnContext, logger);

                expect(actorState).toEqual(
                    expect.objectContaining({
                        id: 'actorNoName',
                        [NAME_COMPONENT_ID]: {text: DEFAULT_CHARACTER_NAME},
                        [DESCRIPTION_COMPONENT_ID]: {text: DEFAULT_DESCRIPTION},
                    })
                );
            });

            test('should use default name/description if component data exists but propertyPath is missing', async () => {
                const actor = new MockEntity('actorBadData');
                actor.setComponentData(NAME_COMPONENT_ID, {wrongProperty: 'Some Name'});
                actor.setComponentData(DESCRIPTION_COMPONENT_ID, {otherProp: 'Some Desc'});
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const {actorState} = await provider.buildGameState(actor, turnContext, logger);

                expect(actorState).toEqual(
                    expect.objectContaining({
                        id: 'actorBadData',
                        [NAME_COMPONENT_ID]: {text: DEFAULT_CHARACTER_NAME},
                        [DESCRIPTION_COMPONENT_ID]: {text: DEFAULT_DESCRIPTION},
                    })
                );
            });

            test('should use default name/description if component data property is an empty string', async () => {
                const actor = new MockEntity('actorEmptyData');
                actor.setComponentData(NAME_COMPONENT_ID, {text: '  '});
                actor.setComponentData(DESCRIPTION_COMPONENT_ID, {text: ''});
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const {actorState} = await provider.buildGameState(actor, turnContext, logger);

                expect(actorState).toEqual(
                    expect.objectContaining({
                        id: 'actorEmptyData',
                        [NAME_COMPONENT_ID]: {text: DEFAULT_CHARACTER_NAME},
                        [DESCRIPTION_COMPONENT_ID]: {text: DEFAULT_DESCRIPTION},
                    })
                );
            });

            test('should correctly trim name and description if they have leading/trailing spaces', async () => {
                const actor = new MockEntity('actorSpacedData');
                actor.setComponentData(NAME_COMPONENT_ID, {text: '  Spaced Name  '});
                actor.setComponentData(DESCRIPTION_COMPONENT_ID, {text: '  Spaced Description  '});
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const {actorState} = await provider.buildGameState(actor, turnContext, logger);

                expect(actorState).toEqual(
                    expect.objectContaining({
                        id: 'actorSpacedData',
                        [NAME_COMPONENT_ID]: {text: 'Spaced Name'},
                        [DESCRIPTION_COMPONENT_ID]: {text: 'Spaced Description'},
                    })
                );
            });

            // the two direct _getComponentText unit tests stay unchanged
            test('_getComponentText: should return default if entity is null', () => {
                expect(
                    provider._getComponentText(null, NAME_COMPONENT_ID, 'Default')
                ).toBe('Default');
            });

            test('_getComponentText: should return default if getComponentData is not a function', () => {
                expect(
                    provider._getComponentText({id: 'bad'}, NAME_COMPONENT_ID, 'Default')
                ).toBe('Default');
            });
        });

        describe('_buildLocationSummary (via buildGameState)', () => {
            let locationEntity;
            let otherChar1;

            beforeEach(() => {
                mockActor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                locationEntity = new MockEntity('loc1');
                locationEntity.setComponentData(NAME_COMPONENT_ID, {text: 'The Grand Hall'});
                locationEntity.setComponentData(DESCRIPTION_COMPONENT_ID, {text: 'A vast and echoing chamber.'});
                locationEntity.setComponentData(EXITS_COMPONENT_ID, [
                    {direction: 'north', target: 'loc2'},
                    {direction: 'east', target: 'loc3'},
                ]);

                otherChar1 = new MockEntity('char1');
                otherChar1.setComponentData(NAME_COMPONENT_ID, {text: 'Guard'});
                otherChar1.setComponentData(DESCRIPTION_COMPONENT_ID, {text: 'A sturdy guard.'});

                entityManager.getEntityInstance.mockImplementation(async (id) => {
                    if (id === 'loc1') return locationEntity;
                    if (id === 'char1') return otherChar1;
                    if (id === 'loc2') return new MockEntity('loc2', {[NAME_COMPONENT_ID]: {text: 'North Room'}});
                    if (id === 'loc3') return new MockEntity('loc3', {[NAME_COMPONENT_ID]: {text: 'East Room'}});
                    return null;
                });
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set(['actor1', 'char1']));
            });

            test('Full Data: should populate AILocationSummaryDTO with all details', async () => {
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);

                expect(logger.debug).toHaveBeenCalledWith(`AIGameStateProvider: Building location summary for actor ${mockActor.id}`);
                expect(entityManager.getEntityInstance).toHaveBeenCalledWith('loc1');
                expect(entityManager.getEntitiesInLocation).toHaveBeenCalledWith('loc1');
                expect(entityManager.getEntityInstance).toHaveBeenCalledWith('char1');

                expect(gameState.currentLocation).toEqual({
                    name: 'The Grand Hall',
                    description: 'A vast and echoing chamber.',
                    exits: [
                        {direction: 'north', targetLocationId: 'loc2', targetLocationName: 'North Room'},
                        {direction: 'east', targetLocationId: 'loc3', targetLocationName: 'East Room'},
                    ],
                    characters: [
                        {id: 'char1', name: 'Guard', description: 'A sturdy guard.'},
                    ],
                });
                expect(logger.debug).toHaveBeenCalledWith(`AIGameStateProvider: Final generated location summary for actor ${mockActor.id} in location loc1. Exits: 2, Characters: 1`);
            });

            test('No Position/Location ID: actor missing POSITION_COMPONENT_ID data', async () => {
                mockActor.removeComponent(POSITION_COMPONENT_ID);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toBeNull();
                expect(logger.info).toHaveBeenCalledWith(`AIGameStateProvider: Actor ${mockActor.id} has no position component or locationId. Cannot generate location summary.`);
            });

            test('EntityManager Unavailable: turnContext.getEntityManager returns null', async () => {
                turnContext.getEntityManager.mockReturnValue(null);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith(`AIGameStateProvider: EntityManager not available for actor ${mockActor.id}. Cannot fetch location details.`);
            });

            test('EntityManager Unavailable: turnContext.getEntityManager is not a function', async () => {
                turnContext.getEntityManager = undefined; // or some non-function value
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith(`AIGameStateProvider: turnContext.getEntityManager is not a function for actor ${mockActor.id}. EntityManager not available.`);
            });

            test('EntityManager Unavailable: turnContext.getEntityManager throws', async () => {
                const error = new Error("EM Access Denied");
                turnContext.getEntityManager.mockImplementation(() => {
                    throw error;
                });
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith(`AIGameStateProvider: Error accessing EntityManager for actor ${mockActor.id}: ${error.message}`);
            });


            test('Location Entity Not Found: entityManager.getEntityInstance(locationId) returns null', async () => {
                entityManager.getEntityInstance.mockImplementation(async (id) => {
                    if (id === 'loc1') return null;
                    if (id === 'char1') return otherChar1; // Keep this for other potential calls, though not primary for this test path
                    return null;
                });
                // Actor is alone if location cannot be found (or if it's empty, but here loc is null)
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set(['actor1']));


                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith(`AIGameStateProvider: Location entity for ID 'loc1' not found for actor ${mockActor.id}.`);
            });

            test('Location Missing Components: Name and Description use defaults', async () => {
                locationEntity.removeComponent(NAME_COMPONENT_ID);
                locationEntity.removeComponent(DESCRIPTION_COMPONENT_ID);
                locationEntity.removeComponent(EXITS_COMPONENT_ID); // No exits means empty array for exits DTO
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set(['actor1'])); // Actor is alone

                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toEqual(expect.objectContaining({
                    name: DEFAULT_LOCATION_NAME,
                    description: DEFAULT_DESCRIPTION,
                    exits: [], // Expect empty exits if component is removed
                    characters: [], // Expect empty characters
                }));
            });

            describe('Exits Handling', () => {
                test('No EXITS_COMPONENT_ID data', async () => {
                    locationEntity.removeComponent(EXITS_COMPONENT_ID);
                    const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                    // Ensure currentLocation is not null before accessing exits
                    expect(gameState.currentLocation).not.toBeNull();
                    expect(gameState.currentLocation.exits).toEqual([]);
                });

                test('Malformed exit entries are filtered out (or handled with defaults)', async () => {
                    locationEntity.setComponentData(EXITS_COMPONENT_ID, [
                        {direction: 'north', target: 'locN'}, // Will get DEFAULT_LOCATION_NAME
                        {target: 'locE_no_dir'},             // Will get DEFAULT_LOCATION_NAME and DEFAULT_EXIT_DIRECTION
                        {direction: 'south'},                   // Filtered out (no target)
                        {direction: 'west', target: 'locW'}  // Will get DEFAULT_LOCATION_NAME
                    ]);

                    // *** CORRECTED MOCK IMPLEMENTATION ***
                    // Capture the mock implementation set by the parent describe's beforeEach
                    const baseGetEntityInstanceImpl = entityManager.getEntityInstance.getMockImplementation();

                    entityManager.getEntityInstance.mockImplementation(async (id) => {
                        // For these specific exit target IDs, simulate them not being found
                        if (id === 'locN' || id === 'locE_no_dir' || id === 'locW') {
                            return null;
                        }
                        // For all other IDs (e.g., 'loc1' for the current location itself, or 'char1'),
                        // delegate to the base implementation from the parent beforeEach.
                        if (baseGetEntityInstanceImpl) {
                            return await baseGetEntityInstanceImpl(id);
                        }
                        // Fallback if, for some reason, baseGetEntityInstanceImpl is undefined
                        return null;
                    });

                    const gameState = await provider.buildGameState(mockActor, turnContext, logger);

                    // Ensure currentLocation is not null before accessing exits
                    expect(gameState.currentLocation).not.toBeNull();
                    expect(gameState.currentLocation.exits).toEqual([
                        {direction: 'north', targetLocationId: 'locN', targetLocationName: DEFAULT_LOCATION_NAME},
                        {
                            direction: DEFAULT_EXIT_DIRECTION,
                            targetLocationId: 'locE_no_dir',
                            targetLocationName: DEFAULT_LOCATION_NAME
                        },
                        {direction: 'west', targetLocationId: 'locW', targetLocationName: DEFAULT_LOCATION_NAME},
                    ]);
                });
            });

            describe('Characters Handling', () => {
                test('No other characters in location', async () => {
                    entityManager.getEntitiesInLocation.mockResolvedValue(new Set(['actor1'])); // Only the actor itself
                    const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                    expect(gameState.currentLocation).not.toBeNull();
                    expect(gameState.currentLocation.characters).toEqual([]);
                });

                test('entityManager.getEntityInstance for other char returns null', async () => {
                    entityManager.getEntitiesInLocation.mockResolvedValue(new Set(['actor1', 'charNonExistent']));

                    // Adjust mock to handle the non-existent character
                    const baseGetEntityInstanceImpl = entityManager.getEntityInstance.getMockImplementation();
                    entityManager.getEntityInstance.mockImplementation(async (id) => {
                        if (id === 'charNonExistent') return null;
                        if (baseGetEntityInstanceImpl) {
                            return await baseGetEntityInstanceImpl(id);
                        }
                        return null;
                    });

                    const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                    expect(gameState.currentLocation).not.toBeNull();
                    expect(gameState.currentLocation.characters).toEqual([]);
                    expect(logger.warn).toHaveBeenCalledWith("AIGameStateProvider: Could not retrieve entity instance for ID 'charNonExistent' in location 'loc1'. This entity will NOT be listed.");
                });
            });

            test('Error during entityManager.getEntityInstance(locationId) call', async () => {
                const error = new Error("DB Read Error for location");
                entityManager.getEntityInstance.mockImplementation(async (id) => {
                    if (id === 'loc1') throw error; // Simulate error for the main location fetch
                    // For other IDs, you might want to return null or a default entity if necessary for the test's consistency
                    return null;
                });
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toBeNull();
                expect(logger.error).toHaveBeenCalledWith(
                    `AIGameStateProvider: Error generating location summary for actor ${mockActor.id} at 'loc1': ${error.message}`,
                    expect.objectContaining({error})
                );
            });
        });

        describe('_getAvailableActions (via buildGameState)', () => {
            beforeEach(() => {
                // Ensure a minimal location is set up for actions context, if POSITION_COMPONENT_ID is present on mockActor
                const loc = new MockEntity('loc1'); // Assuming mockActor.POSITION_COMPONENT_ID.locationId is 'loc1'
                loc.setComponentData(NAME_COMPONENT_ID, {text: "A Room"});

                const baseGetEntityInstanceImpl = entityManager.getEntityInstance.getMockImplementation();
                entityManager.getEntityInstance.mockImplementation(async (id) => {
                    if (id === 'loc1') return loc;
                    if (baseGetEntityInstanceImpl) return await baseGetEntityInstanceImpl(id);
                    return null;
                });
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set()); // Default to no other entities in location
            });

            test('should return empty actions if ActionDiscoverySystem (ADS) is not available on turnContext', async () => {
                turnContext.getActionDiscoverySystem.mockReturnValue(null);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.availableActions).toEqual([]);
            });

            test('should populate actions with defaults for missing optional fields', async () => {
                const raw = [
                    {id: 'action1', command: 'cmd1', name: 'Action One', description: 'Desc One'},
                    {id: 'action2', command: 'cmd2'}, // missing name & desc
                ];
                actionDiscoverySystem.getValidActions.mockResolvedValue(raw);

                const {availableActions} = await provider.buildGameState(mockActor, turnContext, logger);

                expect(availableActions).toEqual([
                    {id: 'action1', command: 'cmd1', name: 'Action One', description: 'Desc One'},
                    {id: 'action2', command: 'cmd2', name: DEFAULT_ACTION_NAME, description: DEFAULT_ACTION_DESC},
                ]);
            });

            test('should return empty actions and log error if ADS.getValidActions throws', async () => {
                const error = new Error("ADS Failure");
                actionDiscoverySystem.getValidActions.mockRejectedValue(error);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.availableActions).toEqual([]);
                expect(logger.error).toHaveBeenCalledWith(
                    `AIGameStateProvider: Error while discovering actions for actor ${mockActor.id}: ${error.message}`,
                    expect.objectContaining({error})
                );
            });

            test('should call ADS.getValidActions with correctly structured actionCtx', async () => {
                // mockActor has POSITION_COMPONENT_ID { locationId: 'loc1' } from outer beforeEach
                // The beforeEach for _getAvailableActions sets up 'loc1' entity.
                const mainEntityManager = turnContext.getEntityManager(); // This is mockEntityManagerInstance
                actionDiscoverySystem.getValidActions.mockResolvedValue([]); // Irrelevant what it returns for this call check

                await provider.buildGameState(mockActor, turnContext, logger);

                expect(actionDiscoverySystem.getValidActions).toHaveBeenCalledTimes(1);
                const expectedActionCtx = {
                    currentLocation: {id: 'loc1'}, // From mockActor's position
                    entityManager: mainEntityManager,
                    worldContext: turnContext.game,
                    logger: logger,
                };
                expect(actionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockActor, expect.objectContaining(expectedActionCtx));
            });
        });

        describe('_getPerceptionLog (via buildGameState)', () => {
            beforeEach(() => {
                // Ensure a minimal location is set up, consistent with other describe blocks
                const loc = new MockEntity('loc1');
                loc.setComponentData(NAME_COMPONENT_ID, {text: "A Room"});
                const baseGetEntityInstanceImpl = entityManager.getEntityInstance.getMockImplementation();
                entityManager.getEntityInstance.mockImplementation(async (id) => (id === 'loc1' ? loc : (baseGetEntityInstanceImpl ? await baseGetEntityInstanceImpl(id) : null)));
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set());
                actionDiscoverySystem.getValidActions.mockResolvedValue([]);
            });

            test('should return empty perceptionLog if actor has no PERCEPTION_LOG_COMPONENT_ID', async () => {
                const originalHasComponent = mockActor.hasComponent;
                mockActor.hasComponent = jest.fn(id => id !== PERCEPTION_LOG_COMPONENT_ID && originalHasComponent.call(mockActor, id));

                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.perceptionLog).toEqual([]);
                expect(logger.info).toHaveBeenCalledWith(`AIGameStateProvider: Actor ${mockActor.id} does not have a '${PERCEPTION_LOG_COMPONENT_ID}' component. No perception log included.`);
                mockActor.hasComponent = originalHasComponent; // Restore
            });

            test('should return empty perceptionLog if logEntries are missing from component data', async () => {
                const perceptionData = {}; // logEntries is missing
                mockActor.setComponentData(PERCEPTION_LOG_COMPONENT_ID, perceptionData);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.perceptionLog).toEqual([]);
                expect(logger.info).toHaveBeenCalledWith(
                    `AIGameStateProvider: Actor ${mockActor.id} has '${PERCEPTION_LOG_COMPONENT_ID}' but 'logEntries' are missing or malformed. Data:`,
                    {perceptionData}
                );
            });

            test('should populate perceptionLog with defaults for missing fields in entries', async () => {
                const frozenTime = Date.now(); // Date.now() is mocked in global beforeEach
                const perceptionData = {
                    logEntries: [
                        {descriptionText: 'Heard a noise.', timestamp: 12345, perceptionType: 'sound'},
                        {descriptionText: 'Saw something.'}, // Missing timestamp and perceptionType
                    ]
                };
                mockActor.setComponentData(PERCEPTION_LOG_COMPONENT_ID, perceptionData);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.perceptionLog).toEqual([
                    {descriptionText: 'Heard a noise.', timestamp: 12345, perceptionType: 'sound'},
                    {descriptionText: 'Saw something.', timestamp: frozenTime, perceptionType: 'unknown'},
                ]);
            });

            test('should return empty perceptionLog and log error if actor.getComponentData throws for perception log', async () => {
                const error = new Error("Perception data read error");
                mockActor.setComponentData(PERCEPTION_LOG_COMPONENT_ID, {}); // Component must exist for hasComponent check

                const originalGetComponentData = mockActor.getComponentData;
                mockActor.getComponentData = jest.fn((componentId) => {
                    if (componentId === PERCEPTION_LOG_COMPONENT_ID) throw error;
                    return originalGetComponentData.call(mockActor, componentId);
                });

                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.perceptionLog).toEqual([]);
                expect(logger.error).toHaveBeenCalledWith(
                    `AIGameStateProvider: Error retrieving perception log for actor ${mockActor.id}: ${error.message}`,
                    {error}
                );
                mockActor.getComponentData = originalGetComponentData; // Restore
            });
        });

        describe('Overall buildGameState Orchestration', () => {
            let mockActorStateDTO, mockLocationSummaryDTO, mockAvailableActionsDTO, mockPerceptionLogDTO,
                expectedActorPromptData;

            beforeEach(() => {
                // Reset general mocks for entityManager to ensure they don't interfere unless intended
                const minimalLocationEntityForOrchestration = new MockEntity('loc1', {
                    [NAME_COMPONENT_ID]: {text: 'Orchestration Room'},
                    [DESCRIPTION_COMPONENT_ID]: {text: 'For orchestration tests.'}
                });
                entityManager.getEntityInstance.mockImplementation(async (id) => {
                    if (id === 'loc1') return minimalLocationEntityForOrchestration;
                    return null;
                });
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set()); // Default to empty for simplicity
                actionDiscoverySystem.getValidActions.mockResolvedValue([]); // Default to empty


                mockActorStateDTO = {
                    id: mockActor.id,
                    [NAME_COMPONENT_ID]: {text: 'Mock Actor'},
                    [DESCRIPTION_COMPONENT_ID]: {text: 'A mock actor from state'}
                };
                // ActorDataExtractor behavior:
                expectedActorPromptData = {
                    name: 'Mock Actor',
                    description: 'A mock actor from state.', // Adds punctuation
                    personality: undefined,
                    profile: undefined,
                    likes: undefined,
                    dislikes: undefined,
                    secrets: undefined,
                    speechPatterns: undefined,
                };

                mockLocationSummaryDTO = {
                    name: 'Mock Location',
                    description: 'A mock place.',
                    exits: [{direction: 'mock', targetLocationId: 'mockT', targetLocationName: 'Mock Target'}],
                    characters: []
                };
                mockAvailableActionsDTO = [{
                    id: 'action:mock',
                    command: 'mock',
                    name: 'Mock Action',
                    description: 'Does a mock.'
                }];
                mockPerceptionLogDTO = [{
                    descriptionText: 'Mock perception',
                    timestamp: Date.now(), // Mocked Date.now()
                    perceptionType: 'mock'
                }];


                jest.spyOn(provider, '_buildActorState').mockReturnValue(mockActorStateDTO);
                jest.spyOn(provider, '_buildLocationSummary').mockResolvedValue(mockLocationSummaryDTO);
                jest.spyOn(provider, '_getAvailableActions').mockResolvedValue(mockAvailableActionsDTO);
                jest.spyOn(provider, '_getPerceptionLog').mockResolvedValue(mockPerceptionLogDTO);
            });

            test('should correctly orchestrate calls and build a full AIGameStateDTO', async () => {
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(provider._buildActorState).toHaveBeenCalledWith(mockActor, logger);
                expect(provider._buildLocationSummary).toHaveBeenCalledWith(mockActor, turnContext, logger);
                expect(provider._getAvailableActions).toHaveBeenCalledWith(mockActor, turnContext, mockLocationSummaryDTO, logger);
                expect(provider._getPerceptionLog).toHaveBeenCalledWith(mockActor, logger);
                expect(gameState).toEqual({
                    actorState: mockActorStateDTO,
                    actorPromptData: expectedActorPromptData,
                    currentLocation: mockLocationSummaryDTO,
                    availableActions: mockAvailableActionsDTO,
                    perceptionLog: mockPerceptionLogDTO,
                });
            });

            test('should populate other DTO parts if _buildLocationSummary returns null', async () => {
                provider._buildLocationSummary.mockResolvedValue(null); // Simulate location summary failure
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);

                expect(provider._getAvailableActions).toHaveBeenCalledWith(mockActor, turnContext, null, logger); // Ensure it's called with null location
                expect(gameState).toEqual({
                    actorState: mockActorStateDTO,
                    actorPromptData: expectedActorPromptData,
                    currentLocation: null, // Expect null here
                    availableActions: mockAvailableActionsDTO, // Still populated
                    perceptionLog: mockPerceptionLogDTO,       // Still populated
                });
            });

            test('should populate other DTO parts if _getAvailableActions returns an empty array', async () => {
                provider._getAvailableActions.mockResolvedValue([]); // Simulate no actions found
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState).toEqual({
                    actorState: mockActorStateDTO,
                    actorPromptData: expectedActorPromptData,
                    currentLocation: mockLocationSummaryDTO,
                    availableActions: [], // Expect empty array
                    perceptionLog: mockPerceptionLogDTO,
                });
            });

            test('should populate other DTO parts if _getPerceptionLog returns an empty array', async () => {
                provider._getPerceptionLog.mockResolvedValue([]); // Simulate no perception log entries
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState).toEqual({
                    actorState: mockActorStateDTO,
                    actorPromptData: expectedActorPromptData,
                    currentLocation: mockLocationSummaryDTO,
                    availableActions: mockAvailableActionsDTO,
                    perceptionLog: [], // Expect empty array
                });
            });

            test('should still call other helpers even if _buildActorState had an issue (though current _buildActorState doesnt throw)', async () => {
                // Simulate a scenario where _buildActorState might return a minimal or default state
                const partialActorState = {
                    id: mockActor.id,
                    [NAME_COMPONENT_ID]: {text: DEFAULT_CHARACTER_NAME}, // Using defaults
                    [DESCRIPTION_COMPONENT_ID]: {text: DEFAULT_DESCRIPTION}
                };
                provider._buildActorState.mockReturnValue(partialActorState);

                const expectedPartialActorPromptData = {
                    name: DEFAULT_CHARACTER_NAME,
                    description: DEFAULT_DESCRIPTION + ".", // ActorDataExtractor adds punctuation
                    personality: undefined,
                    profile: undefined,
                    likes: undefined,
                    dislikes: undefined,
                    secrets: undefined,
                    speechPatterns: undefined,
                };

                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState).toEqual({
                    actorState: partialActorState, // Use the modified actor state
                    actorPromptData: expectedPartialActorPromptData, // And corresponding prompt data
                    currentLocation: mockLocationSummaryDTO,
                    availableActions: mockAvailableActionsDTO,
                    perceptionLog: mockPerceptionLogDTO,
                });
                // Ensure other methods were still called
                expect(provider._buildLocationSummary).toHaveBeenCalled();
                expect(provider._getAvailableActions).toHaveBeenCalled();
                expect(provider._getPerceptionLog).toHaveBeenCalled();
            });
        });
    });
});

// --- FILE END ---
// tests/turns/services/AIGameStateProvider.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect, afterEach} from '@jest/globals';
import {AIGameStateProvider} from '../../../src/turns/services/AIGameStateProvider.js';
import {
    NAME_COMPONENT_ID,
    DESCRIPTION_COMPONENT_ID,
    POSITION_COMPONENT_ID,
    EXITS_COMPONENT_ID,
    PERCEPTION_LOG_COMPONENT_ID
} from '../../../src/constants/componentIds.js';

// --- Mock Implementations ---

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
    constructor(id = `mock-entity-${Math.random().toString(36).substring(2, 9)}`, componentsData = {}, presentComponents = []) {
        this.id = id;
        this._componentsData = componentsData;
        this._presentComponents = new Set(presentComponents);
        Object.keys(componentsData).forEach(key => this._presentComponents.add(key));

        this.getComponentData = jest.fn((componentId) => {
            if (componentId in this._componentsData) {
                return this._componentsData[componentId];
            }
            return undefined;
        });
        this.hasComponent = jest.fn((componentId) => {
            return this._presentComponents.has(componentId);
        });
    }

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
    getEntitiesInLocation: jest.fn(), // This will return a Set
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
    const actionDiscoverySystemInstance = mockActionDiscoverySystem();

    return {
        getLogger: jest.fn(() => loggerInstance),
        getActor: jest.fn(),
        getEntityManager: jest.fn(() => entityManagerInstance),
        getActionDiscoverySystem: jest.fn(() => actionDiscoverySystemInstance),
        game: {},
        mockLoggerInstance: loggerInstance,
        mockEntityManagerInstance: entityManagerInstance,
        mockActionDiscoverySystemInstance: actionDiscoverySystemInstance,
    };
};


describe('AIGameStateProvider', () => {
    /** @type {AIGameStateProvider} */
    let provider;
    /** @type {ReturnType<typeof mockLogger>} */
    let logger;
    /** @type {ReturnType<typeof mockTurnContext>} */
    let turnContext;
    /** @type {ReturnType<typeof mockEntityManager>} */
    let entityManager;
    /** @type {ReturnType<typeof mockActionDiscoverySystem>} */
    let actionDiscoverySystem;
    /** @type {MockEntity} */
    let mockActor;


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

        const minimalLocationEntity = new MockEntity('loc1', {
            [NAME_COMPONENT_ID]: {text: 'A Room'},
            [DESCRIPTION_COMPONENT_ID]: {text: 'Just a room.'},
        });
        entityManager.getEntityInstance.mockImplementation(async (id) => {
            if (id === 'loc1') return minimalLocationEntity;
            return null;
        });
        // Default to returning an empty Set
        entityManager.getEntitiesInLocation.mockResolvedValue(new Set());
        actionDiscoverySystem.getValidActions.mockResolvedValue([]);

        jest.spyOn(Date, 'now').mockReturnValue(1678886400000);

        // Mock console methods only if truly necessary and if they are directly called by the tested code
        // jest.spyOn(console, 'error').mockImplementation(() => {});
        // jest.spyOn(console, 'warn').mockImplementation(() => {});
        // jest.spyOn(console, 'info').mockImplementation(() => {});
        // jest.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

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
                actorWithoutId.id = null;
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

        describe('_getComponentText (implicitly and explicitly)', () => {
            test('should populate AIActorStateDTO with name and description if components exist', async () => {
                const actor = new MockEntity('actorTest');
                actor.setComponentData(NAME_COMPONENT_ID, {text: 'Test Actor Name'});
                actor.setComponentData(DESCRIPTION_COMPONENT_ID, {text: 'A brave test actor.'});
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const gameState = await provider.buildGameState(actor, turnContext, logger);
                expect(gameState.actorState).toEqual({
                    id: 'actorTest',
                    name: 'Test Actor Name',
                    description: 'A brave test actor.',
                });
            });

            test('should use default name and description if components are missing data', async () => {
                const actor = new MockEntity('actorNoName');
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const gameState = await provider.buildGameState(actor, turnContext, logger);
                expect(gameState.actorState).toEqual({
                    id: 'actorNoName',
                    name: 'Unknown Name',
                    description: 'No description available.',
                });
            });

            test('should use default name/description if component data exists but propertyPath is missing', async () => {
                const actor = new MockEntity('actorBadData');
                actor.setComponentData(NAME_COMPONENT_ID, {wrongProperty: 'Some Name'});
                actor.setComponentData(DESCRIPTION_COMPONENT_ID, {otherProp: 'Some Desc'});
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const gameState = await provider.buildGameState(actor, turnContext, logger);
                expect(gameState.actorState).toEqual({
                    id: 'actorBadData',
                    name: 'Unknown Name',
                    description: 'No description available.',
                });
            });

            test('should use default name/description if component data property is an empty string', async () => {
                const actor = new MockEntity('actorEmptyData');
                actor.setComponentData(NAME_COMPONENT_ID, {text: '  '});
                actor.setComponentData(DESCRIPTION_COMPONENT_ID, {text: ''});
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const gameState = await provider.buildGameState(actor, turnContext, logger);
                expect(gameState.actorState).toEqual({
                    id: 'actorEmptyData',
                    name: 'Unknown Name',
                    description: 'No description available.',
                });
            });

            test('should correctly trim name and description if they have leading/trailing spaces', async () => {
                const actor = new MockEntity('actorSpacedData');
                actor.setComponentData(NAME_COMPONENT_ID, {text: '  Spaced Name  '});
                actor.setComponentData(DESCRIPTION_COMPONENT_ID, {text: '  Spaced Description  '});
                actor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'loc1'});

                const gameState = await provider.buildGameState(actor, turnContext, logger);
                expect(gameState.actorState).toEqual({
                    id: 'actorSpacedData',
                    name: 'Spaced Name',
                    description: 'Spaced Description',
                });
            });

            test('_getComponentText: should return default if entity is null', () => {
                const result = provider._getComponentText(null, NAME_COMPONENT_ID, 'Default Value');
                expect(result).toBe('Default Value');
            });

            test('_getComponentText: should return default if getComponentData is not a function', () => {
                const faultyEntity = {id: 'faulty'};
                const result = provider._getComponentText(faultyEntity, NAME_COMPONENT_ID, 'Default Value');
                expect(result).toBe('Default Value');
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
                    return null;
                });
                // **FIX 1: Ensure mockResolvedValue returns a Set**
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
                        {direction: 'north', targetLocationId: 'loc2'},
                        {direction: 'east', targetLocationId: 'loc3'},
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
                turnContext.getEntityManager = undefined;
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
                    if (id === 'loc1') return null; // Location not found
                    if (id === 'char1') return otherChar1; // Character still found for other tests if needed
                    return null;
                });
                // Ensure getEntitiesInLocation still returns something for the loop to run,
                // even if the location entity itself isn't found later by getEntityInstance.
                // This setup might be slightly artificial but tests the specific path.
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set(['actor1']));


                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toBeNull();
                expect(logger.warn).toHaveBeenCalledWith(`AIGameStateProvider: Location entity for ID 'loc1' not found for actor ${mockActor.id}.`);
            });

            test('Location Missing Components: Name and Description use defaults', async () => {
                locationEntity.removeComponent(NAME_COMPONENT_ID);
                locationEntity.removeComponent(DESCRIPTION_COMPONENT_ID);
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set(['actor1'])); // No other chars for simplicity

                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toEqual(expect.objectContaining({
                    name: 'Unknown Location',
                    description: 'No description available.',
                }));
            });

            describe('Exits Handling', () => {
                test('No EXITS_COMPONENT_ID data', async () => {
                    locationEntity.removeComponent(EXITS_COMPONENT_ID);
                    const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                    expect(gameState.currentLocation.exits).toEqual([]);
                });

                test('Malformed exit entries are filtered out', async () => {
                    locationEntity.setComponentData(EXITS_COMPONENT_ID, [
                        {direction: 'north', target: 'locN'},
                        {target: 'locE_no_dir'}, // Malformed: no direction
                        {direction: 'south'},      // Malformed: no target
                        {direction: 'west', target: 'locW'}
                    ]);
                    const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                    expect(gameState.currentLocation.exits).toEqual([
                        {direction: 'north', targetLocationId: 'locN'},
                        {direction: 'west', targetLocationId: 'locW'},
                    ]);
                });
            });

            describe('Characters Handling', () => {
                test('No other characters in location', async () => {
                    entityManager.getEntitiesInLocation.mockResolvedValue(new Set(['actor1'])); // Only self
                    const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                    expect(gameState.currentLocation.characters).toEqual([]);
                });

                test('entityManager.getEntityInstance for other char returns null', async () => {
                    entityManager.getEntitiesInLocation.mockResolvedValue(new Set(['actor1', 'charNonExistent']));
                    entityManager.getEntityInstance.mockImplementation(async (id) => {
                        if (id === 'loc1') return locationEntity;
                        if (id === 'charNonExistent') return null; // This char cannot be retrieved
                        return null;
                    });
                    const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                    expect(gameState.currentLocation.characters).toEqual([]);
                    // **FIX 2: Expect logger.warn instead of logger.debug**
                    expect(logger.warn).toHaveBeenCalledWith("AIGameStateProvider: Could not retrieve entity instance for ID 'charNonExistent' in location 'loc1'. This entity will NOT be listed.");
                });
            });

            test('Error during entityManager.getEntityInstance(locationId) call', async () => {
                const error = new Error("DB Read Error for location");
                entityManager.getEntityInstance.mockImplementation(async (id) => {
                    if (id === 'loc1') throw error;
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
                const loc = new MockEntity('loc1');
                loc.setComponentData(NAME_COMPONENT_ID, {text: "A Room"});
                entityManager.getEntityInstance.mockImplementation(async (id) => (id === 'loc1' ? loc : null));
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set());
            });

            test('should return empty actions if ActionDiscoverySystem (ADS) is not available on turnContext', async () => {
                turnContext.getActionDiscoverySystem.mockReturnValue(null);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.availableActions).toEqual([]);
            });

            test('should populate actions with defaults for missing optional fields', async () => {
                const rawActions = [
                    {id: 'action1', command: 'cmd1', name: 'Action One', description: 'Desc One'},
                    {id: 'action2', command: 'cmd2'}, // Missing name and description
                ];
                actionDiscoverySystem.getValidActions.mockResolvedValue(rawActions);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.availableActions).toEqual([
                    {id: 'action1', command: 'cmd1', name: 'Action One', description: 'Desc One'},
                    {id: 'action2', command: 'cmd2', name: 'Unnamed Action', description: 'No description available.'},
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
                mockActor.setComponentData(POSITION_COMPONENT_ID, {locationId: 'actorCurrentLoc'});
                const currentLocEntity = new MockEntity('actorCurrentLoc', {[NAME_COMPONENT_ID]: {text: 'Current Place'}});
                entityManager.getEntityInstance.mockImplementation(async (id) => (id === 'actorCurrentLoc' ? currentLocEntity : null));
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set()); // Ensure it's a set
                actionDiscoverySystem.getValidActions.mockResolvedValue([]);

                await provider.buildGameState(mockActor, turnContext, logger);
                expect(actionDiscoverySystem.getValidActions).toHaveBeenCalledTimes(1);
                const expectedActionCtx = {
                    currentLocation: {id: 'actorCurrentLoc'},
                    entityManager: entityManager,
                    worldContext: turnContext.game,
                    logger: logger,
                };
                expect(actionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockActor, expect.objectContaining(expectedActionCtx));
            });
        });

        describe('_getPerceptionLog (via buildGameState)', () => {
            beforeEach(() => {
                const loc = new MockEntity('loc1');
                loc.setComponentData(NAME_COMPONENT_ID, {text: "A Room"});
                entityManager.getEntityInstance.mockImplementation(async (id) => (id === 'loc1' ? loc : null));
                entityManager.getEntitiesInLocation.mockResolvedValue(new Set());
                actionDiscoverySystem.getValidActions.mockResolvedValue([]);
            });

            test('should return empty perceptionLog if actor has no PERCEPTION_LOG_COMPONENT_ID', async () => {
                mockActor.hasComponent.mockImplementation(id => id !== PERCEPTION_LOG_COMPONENT_ID && mockActor._presentComponents.has(id));
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.perceptionLog).toEqual([]);
                expect(logger.info).toHaveBeenCalledWith(`AIGameStateProvider: Actor ${mockActor.id} does not have a '${PERCEPTION_LOG_COMPONENT_ID}' component. No perception log included.`);
            });

            test('should return empty perceptionLog if logEntries are missing from component data', async () => {
                const perceptionData = {};
                mockActor.setComponentData(PERCEPTION_LOG_COMPONENT_ID, perceptionData);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.perceptionLog).toEqual([]);
            });

            test('should populate perceptionLog with defaults for missing fields in entries', async () => {
                const frozenTime = Date.now(); // Will be 1678886400000 due to mock
                const perceptionData = {
                    logEntries: [
                        {descriptionText: 'Heard a noise.', timestamp: 12345, perceptionType: 'sound'},
                        {descriptionText: 'Saw something.'}, // Missing timestamp and type
                    ]
                };
                mockActor.setComponentData(PERCEPTION_LOG_COMPONENT_ID, perceptionData);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.perceptionLog).toEqual([
                    {description: 'Heard a noise.', timestamp: 12345, type: 'sound'},
                    {description: 'Saw something.', timestamp: frozenTime, type: 'unknown'},
                ]);
            });

            test('should return empty perceptionLog and log error if actor.getComponentData throws for perception log', async () => {
                const error = new Error("Perception data read error");
                mockActor.setComponentData(PERCEPTION_LOG_COMPONENT_ID, {});
                mockActor.getComponentData.mockImplementation((componentId) => {
                    if (componentId === POSITION_COMPONENT_ID) return {locationId: 'loc1'};
                    if (componentId === PERCEPTION_LOG_COMPONENT_ID) throw error;
                    return undefined;
                });

                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.perceptionLog).toEqual([]);
                expect(logger.error).toHaveBeenCalledWith(
                    `AIGameStateProvider: Error retrieving perception log for actor ${mockActor.id}: ${error.message}`,
                    {error}
                );
            });
        });

        describe('Overall buildGameState Orchestration', () => {
            let mockActorStateDTO, mockLocationSummaryDTO, mockAvailableActionsDTO, mockPerceptionLogDTO;

            beforeEach(() => {
                mockActorStateDTO = {id: mockActor.id, name: 'Mock Actor', description: 'A mock actor.'};
                mockLocationSummaryDTO = {
                    name: 'Mock Location',
                    description: 'A mock place.',
                    exits: [],
                    characters: []
                };
                mockAvailableActionsDTO = [{
                    id: 'action:mock',
                    command: 'mock',
                    name: 'Mock Action',
                    description: 'Does a mock.'
                }];
                mockPerceptionLogDTO = [{description: 'Mock perception', timestamp: Date.now(), type: 'mock'}];

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
                    currentLocation: mockLocationSummaryDTO,
                    availableActions: mockAvailableActionsDTO,
                    perceptionLog: mockPerceptionLogDTO,
                });
            });

            test('should populate other DTO parts if _buildLocationSummary returns null', async () => {
                provider._buildLocationSummary.mockResolvedValue(null);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.currentLocation).toBeNull();
                expect(provider._getAvailableActions).toHaveBeenCalledWith(mockActor, turnContext, null, logger);
                expect(gameState.actorState).toEqual(mockActorStateDTO);
                expect(gameState.availableActions).toEqual(mockAvailableActionsDTO);
                expect(gameState.perceptionLog).toEqual(mockPerceptionLogDTO);
            });

            test('should populate other DTO parts if _getAvailableActions returns an empty array', async () => {
                provider._getAvailableActions.mockResolvedValue([]);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.availableActions).toEqual([]);
            });

            test('should populate other DTO parts if _getPerceptionLog returns an empty array', async () => {
                provider._getPerceptionLog.mockResolvedValue([]);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.perceptionLog).toEqual([]);
            });

            test('should still call other helpers even if _buildActorState had an issue (though current _buildActorState doesnt throw)', async () => {
                const partialActorState = {id: mockActor.id, name: "Default Name", description: "Default Desc"};
                provider._buildActorState.mockReturnValue(partialActorState);
                const gameState = await provider.buildGameState(mockActor, turnContext, logger);
                expect(gameState.actorState).toEqual(partialActorState);
                expect(gameState.currentLocation).toEqual(mockLocationSummaryDTO);
            });
        });
    });
});

// --- FILE END ---
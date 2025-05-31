// tests/initializers/worldInitializer.test.js
// --- FILE START ---

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import WorldInitializer from '../../src/initializers/worldInitializer.js';
import {POSITION_COMPONENT_ID, EXITS_COMPONENT_ID} from '../../src/constants/componentIds.js';
import _isEqual from 'lodash/isEqual.js'; // For comparing complex objects in logs if needed

describe('WorldInitializer', () => {
    let mockEntityManager;
    let mockWorldContext;
    let mockGameDataRepository;
    let mockValidatedEventDispatcher;
    let mockLogger;
    let mockSpatialIndexManager;
    let worldInitializer;

    // Updated createMockEntityInstance
    const createMockEntityInstance = (instanceId, definitionId, componentsData = {}) => {
        const componentsObj = {}; // Changed from Map to Object
        for (const [type, data] of Object.entries(componentsData)) {
            componentsObj[type] = JSON.parse(JSON.stringify(data)); // Deep clone for isolation
        }

        const mockInstance = {
            id: instanceId,
            definitionId: definitionId,
            components: componentsObj, // Now a plain object
            getComponentData: jest.fn((componentTypeId) => {
                const data = componentsObj[componentTypeId]; // Accessing object property
                // Return a clone if the component data is an object/array to mimic real behavior
                return data ? JSON.parse(JSON.stringify(data)) : undefined;
            }),
            // Helper for tests to directly modify component data if needed, simulating external changes
            // or for setting up pre-resolved states if WorldInitializer wasn't the one doing it.
            _setComponentDataDirectly: (type, data) => { // Test-only helper if needed
                componentsObj[type] = data;
            }
        };
        return mockInstance;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockEntityManager = {
            createEntityInstance: jest.fn(),
            getPrimaryInstanceByDefinitionId: jest.fn(),
            getEntityInstance: jest.fn(id => id.startsWith('uuid-')), // Mock for spatial index check
        };
        mockWorldContext = {};
        mockGameDataRepository = {
            getAllEntityDefinitions: jest.fn(),
            getComponentDefinition: jest.fn(),
        };
        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined),
        };
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        mockSpatialIndexManager = {
            addEntity: jest.fn(),
        };
    });

    describe('constructor', () => {
        it('should instantiate successfully with all valid dependencies', () => {
            worldInitializer = new WorldInitializer({
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockGameDataRepository,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                logger: mockLogger,
                spatialIndexManager: mockSpatialIndexManager,
            });
            expect(mockLogger.info).toHaveBeenCalledWith('WorldInitializer: Instance created.');
        });

        const constructorErrorTestCases = [
            ['EntityManager', 'entityManager', 'WorldInitializer requires an EntityManager.'],
            ['WorldContext', 'worldContext', 'WorldInitializer requires a WorldContext.'],
            ['GameDataRepository', 'gameDataRepository', 'WorldInitializer requires a GameDataRepository.'],
            ['ValidatedEventDispatcher', 'validatedEventDispatcher', 'WorldInitializer requires a ValidatedEventDispatcher.'],
            ['ILogger', 'logger', 'WorldInitializer requires an ILogger.'],
            ['ISpatialIndexManager', 'spatialIndexManager', 'WorldInitializer requires an ISpatialIndexManager.'],
        ];

        it.each(constructorErrorTestCases)('should throw if %s is missing', (depDisplayName, depsKey, expectedErrorMessage) => {
            const deps = {
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockGameDataRepository,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                logger: mockLogger,
                spatialIndexManager: mockSpatialIndexManager,
            };
            delete deps[depsKey];
            expect(() => new WorldInitializer(deps)).toThrow(expectedErrorMessage);
        });
    });

    describe('initializeWorldEntities', () => {
        beforeEach(() => {
            worldInitializer = new WorldInitializer({
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockGameDataRepository,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                logger: mockLogger,
                spatialIndexManager: mockSpatialIndexManager,
            });

            mockGameDataRepository.getComponentDefinition.mockImplementation(componentTypeId => {
                return {id: componentTypeId, resolveFields: []};
            });
        });

        it('should complete successfully with no entity definitions', async () => {
            mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([]);
            const result = await worldInitializer.initializeWorldEntities();
            expect(result).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith('WorldInitializer (Pass 1): No entity definitions found. World may be empty of defined entities.');
            expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled();
        });

        it('should instantiate entities in Pass 1', async () => {
            const entityDef1 = {id: 'def:room1', components: {}};
            mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([entityDef1]);
            const mockInstance1 = createMockEntityInstance('uuid-room1', 'def:room1');
            mockEntityManager.createEntityInstance.mockReturnValueOnce(mockInstance1);

            await worldInitializer.initializeWorldEntities();

            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith('def:room1');
            expect(mockLogger.info).toHaveBeenCalledWith(`WorldInitializer (Pass 1): Instantiated entity uuid-room1 (from definition: def:room1)`);
        });

        it('should handle failed entity instantiation in Pass 1', async () => {
            const entityDef1 = {id: 'def:broken', components: {}};
            mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([entityDef1]);
            mockEntityManager.createEntityInstance.mockReturnValueOnce(null);

            await worldInitializer.initializeWorldEntities();

            expect(mockLogger.warn).toHaveBeenCalledWith('WorldInitializer (Pass 1): Failed to instantiate entity from definition: def:broken.');
        });

        describe('Pass 2: Reference Resolution', () => {
            let locationDef, characterDef, locationInstance, characterInstance;
            let originalLocationPositionComponentData, originalCharacterPositionComponentData,
                originalLocationExitsComponentData;
            let targetRoomInstance, outerSpaceInstance;


            beforeEach(() => {
                mockGameDataRepository.getComponentDefinition.mockImplementation(componentTypeId => {
                    if (componentTypeId === POSITION_COMPONENT_ID) {
                        return {
                            id: POSITION_COMPONENT_ID,
                            resolveFields: [{
                                dataPath: "locationId",
                                resolutionStrategy: {type: "direct"}
                            }]
                        };
                    }
                    if (componentTypeId === EXITS_COMPONENT_ID) {
                        return {
                            id: EXITS_COMPONENT_ID,
                            resolveFields: [{
                                dataPathIsSelf: true, // The component data itself is an array of objects
                                resolutionStrategy: {type: "arrayOfObjects", idField: "target"}
                            }]
                        };
                    }
                    return {id: componentTypeId, resolveFields: []};
                });

                originalLocationPositionComponentData = {locationId: 'def:outer_space'};
                originalLocationExitsComponentData = [
                    {direction: 'north', target: 'def:target_room'},
                    {direction: 'south', target: 'uuid-already-instance'},
                    {direction: 'east', target: 'def:unresolved_room'},
                    {direction: 'west', target: ''},
                    {direction: 'up', target: null},
                    {direction: 'down', target: 'def:another_target'}
                ];

                locationDef = {
                    id: 'def:current_room',
                    components: {
                        [POSITION_COMPONENT_ID]: {...originalLocationPositionComponentData}, // Clone
                        [EXITS_COMPONENT_ID]: JSON.parse(JSON.stringify(originalLocationExitsComponentData)) // Deep Clone
                    }
                };
                locationInstance = createMockEntityInstance('uuid-current-room', 'def:current_room', locationDef.components);

                originalCharacterPositionComponentData = {locationId: 'def:current_room'};
                characterDef = {
                    id: 'def:player',
                    components: {[POSITION_COMPONENT_ID]: {...originalCharacterPositionComponentData}} // Clone
                };
                characterInstance = createMockEntityInstance('uuid-player', 'def:player', characterDef.components);

                targetRoomInstance = createMockEntityInstance('uuid-target-room', 'def:target_room');
                outerSpaceInstance = createMockEntityInstance('uuid-outer-space', 'def:outer_space');
                const anotherTargetInstance = createMockEntityInstance('uuid-another-target', 'def:another_target');


                mockEntityManager.getPrimaryInstanceByDefinitionId
                    .mockImplementation((defId) => {
                        if (defId === 'def:target_room') return targetRoomInstance;
                        if (defId === 'def:current_room') return locationInstance;
                        if (defId === 'def:outer_space') return outerSpaceInstance;
                        if (defId === 'def:another_target') return anotherTargetInstance;
                        return undefined;
                    });

                mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([locationDef, characterDef]);
                mockEntityManager.createEntityInstance
                    .mockReset()
                    .mockReturnValueOnce(locationInstance) // For def:current_room
                    .mockReturnValueOnce(characterInstance);  // For def:player
            });

            it('should resolve position.locationId and update component data', async () => {
                await worldInitializer.initializeWorldEntities();

                const charPosData = characterInstance.getComponentData(POSITION_COMPONENT_ID);
                expect(charPosData.locationId).toBe('uuid-current-room');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    `WorldInitializer (Pass 2): Resolved [${POSITION_COMPONENT_ID}]@'locationId' for entity uuid-player: 'def:current_room' -> 'uuid-current-room'.`
                );
                expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith('uuid-player', 'uuid-current-room');

                const locPosData = locationInstance.getComponentData(POSITION_COMPONENT_ID);
                expect(locPosData.locationId).toBe('uuid-outer-space');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    `WorldInitializer (Pass 2): Resolved [${POSITION_COMPONENT_ID}]@'locationId' for entity uuid-current-room: 'def:outer_space' -> 'uuid-outer-space'.`
                );
                expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith('uuid-current-room', 'uuid-outer-space');
            });

            it('should resolve exitData.target for core:exits and update component data', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance.getComponentData(EXITS_COMPONENT_ID);

                expect(processedExits[0].target).toBe('uuid-target-room');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    `WorldInitializer (Pass 2): Resolved [${EXITS_COMPONENT_ID}]@'(self)'[0].target for entity uuid-current-room: 'def:target_room' -> 'uuid-target-room'.`
                );
                expect(processedExits[5].target).toBe('uuid-another-target');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    `WorldInitializer (Pass 2): Resolved [${EXITS_COMPONENT_ID}]@'(self)'[5].target for entity uuid-current-room: 'def:another_target' -> 'uuid-another-target'.`
                );
            });

            it('should keep exitData.target as is if already an instance ID (no colon)', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance.getComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[1].target).toBe('uuid-already-instance');
                const relevantErrorOrWarnLogs = mockLogger.warn.mock.calls.filter(call => call[0].includes("'uuid-already-instance'"));
                expect(relevantErrorOrWarnLogs.length).toBe(0);
            });

            it('should keep exitData.target as is and warn if definitionId cannot be resolved', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance.getComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[2].target).toBe('def:unresolved_room');
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    `WorldInitializer (Pass 2): Could not resolve [${EXITS_COMPONENT_ID}]@'(self)'[2].target definitionId 'def:unresolved_room' for entity uuid-current-room.`
                );
            });

            it('should keep empty or null exitData.target as is (no resolution attempt)', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance.getComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[3].target).toBe('');
                expect(processedExits[4].target).toBeNull();
            });

            it('should not process non-array data for core:exits if resolveFields expects an array', async () => {
                const malformedExitsComponentData = {not: 'an array'};
                const malformedEntityDef = {
                    id: 'def:malformed',
                    components: {[EXITS_COMPONENT_ID]: malformedExitsComponentData}
                };
                const malformedInstance = createMockEntityInstance('uuid-malformed', 'def:malformed', malformedEntityDef.components);

                mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([malformedEntityDef]);
                mockEntityManager.createEntityInstance.mockReset().mockReturnValueOnce(malformedInstance);
                mockLogger.warn.mockClear();
                mockLogger.debug.mockClear();

                await worldInitializer.initializeWorldEntities();

                const exitsDataAfter = malformedInstance.getComponentData(EXITS_COMPONENT_ID);
                expect(_isEqual(exitsDataAfter, malformedExitsComponentData)).toBe(true);
                const resolutionWarnings = mockLogger.warn.mock.calls.filter(call => call[0].includes(`Could not resolve [${EXITS_COMPONENT_ID}]`));
                expect(resolutionWarnings.length).toBe(0);
            });


            it('should not attempt to resolve exits if EXITS_COMPONENT_ID is missing from entity', async () => {
                const noExitsDef = {
                    id: 'def:no_exits_room',
                    components: {[POSITION_COMPONENT_ID]: {locationId: 'def:somewhere'}}
                };
                const noExitsInstance = createMockEntityInstance('uuid-no_exits', 'def:no_exits_room', noExitsDef.components);
                const somewhereInstance = createMockEntityInstance('uuid-somewhere', 'def:somewhere');

                mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([noExitsDef]);
                mockEntityManager.createEntityInstance.mockReset().mockReturnValueOnce(noExitsInstance);
                mockEntityManager.getPrimaryInstanceByDefinitionId.mockReset().mockImplementation(defId => {
                    if (defId === 'def:somewhere') return somewhereInstance;
                    return undefined;
                });
                mockLogger.debug.mockClear();

                await worldInitializer.initializeWorldEntities();

                const debugCallsForExitsResolution = mockLogger.debug.mock.calls.filter(
                    call => call[0].includes(`[${EXITS_COMPONENT_ID}]`) && call[0].includes('uuid-no_exits')
                );
                expect(debugCallsForExitsResolution.length).toBe(0);
            });
        });

        it('should throw and log error if a critical failure occurs (e.g., in repository)', async () => {
            const criticalError = new Error('Repository exploded');
            mockGameDataRepository.getAllEntityDefinitions.mockImplementation(() => {
                throw criticalError;
            });

            await expect(worldInitializer.initializeWorldEntities()).rejects.toThrow(criticalError);
            expect(mockLogger.error).toHaveBeenCalledWith('WorldInitializer: CRITICAL ERROR during entity initialization or reference resolution:', criticalError);
        });
    });
});
// --- FILE END ---
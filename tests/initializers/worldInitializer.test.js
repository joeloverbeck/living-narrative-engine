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

    // --- CORRECTED createMockEntityInstance ---
    const createMockEntityInstance = (instanceId, definitionId, initialComponentsData = {}) => {
        const internalComponentsMap = new Map();

        for (const [type, data] of Object.entries(initialComponentsData)) {
            internalComponentsMap.set(type, JSON.parse(JSON.stringify(data)));
        }

        const mockInstanceBase = {
            id: instanceId,
            definitionId: definitionId,
            // getComponentData and addComponent are methods
            getComponentData: jest.fn((componentTypeId) => {
                const data = internalComponentsMap.get(componentTypeId);
                return data ? JSON.parse(JSON.stringify(data)) : undefined;
            }),
            addComponent: jest.fn((componentTypeId, componentData) => {
                internalComponentsMap.set(componentTypeId, JSON.parse(JSON.stringify(componentData)));
            }),
            // Test helper
            _getInternalComponentData: (componentTypeId) => {
                return internalComponentsMap.get(componentTypeId);
            }
        };

        // Define componentEntries as a getter on the mock instance
        Object.defineProperty(mockInstanceBase, 'componentEntries', {
            get: jest.fn(() => { // The getter itself can be a Jest mock
                const entriesArray = [];
                for (const [key, value] of internalComponentsMap.entries()) {
                    entriesArray.push([key, value]); // Push direct references for modification by _set
                }
                return entriesArray[Symbol.iterator](); // The getter returns an iterator
            }),
            configurable: true // Allows Jest to spy or override if needed later
        });

        return mockInstanceBase;
    };
    // --- END CORRECTED createMockEntityInstance ---


    beforeEach(() => {
        jest.clearAllMocks(); // Clear all mocks before each test

        mockEntityManager = {
            createEntityInstance: jest.fn(),
            getPrimaryInstanceByDefinitionId: jest.fn(),
            getEntityInstance: jest.fn(id => id.startsWith('uuid-')),
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

        // Instantiate WorldInitializer here after all mocks are set up
        worldInitializer = new WorldInitializer({
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            logger: mockLogger,
            spatialIndexManager: mockSpatialIndexManager,
        });

        // Default component definition mock used in most tests
        mockGameDataRepository.getComponentDefinition.mockImplementation(componentTypeId => {
            return {id: componentTypeId, resolveFields: []};
        });
    });

    describe('constructor', () => {
        it('should instantiate successfully with all valid dependencies', () => {
            // constructor is called in beforeEach, so this test mainly verifies the logger call
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
            delete deps[depsKey]; // Remove the dependency to test
            expect(() => new WorldInitializer(deps)).toThrow(expectedErrorMessage);
        });
    });

    describe('initializeWorldEntities', () => {
        // WorldInitializer is already instantiated in the outer beforeEach

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
            const mockInstance1 = createMockEntityInstance('uuid-room1', 'def:room1', {}); // Pass empty components
            mockEntityManager.createEntityInstance.mockReturnValueOnce(mockInstance1);

            await worldInitializer.initializeWorldEntities();

            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith('def:room1');
            expect(mockLogger.info).toHaveBeenCalledWith(`WorldInitializer (Pass 1): Instantiated entity uuid-room1 (from definition: def:room1)`);
            // The loop in Pass 2 should now run without error for an entity with no components
            // (componentEntries will be an empty iterator)
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
            let targetRoomInstance, outerSpaceInstance, anotherTargetInstance;

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
                                dataPathIsSelf: true,
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
                        [POSITION_COMPONENT_ID]: {...originalLocationPositionComponentData},
                        [EXITS_COMPONENT_ID]: JSON.parse(JSON.stringify(originalLocationExitsComponentData))
                    }
                };
                locationInstance = createMockEntityInstance('uuid-current-room', 'def:current_room', locationDef.components);

                originalCharacterPositionComponentData = {locationId: 'def:current_room'};
                characterDef = {
                    id: 'def:player',
                    components: {[POSITION_COMPONENT_ID]: {...originalCharacterPositionComponentData}}
                };
                characterInstance = createMockEntityInstance('uuid-player', 'def:player', characterDef.components);

                targetRoomInstance = createMockEntityInstance('uuid-target-room', 'def:target_room');
                outerSpaceInstance = createMockEntityInstance('uuid-outer-space', 'def:outer_space');
                anotherTargetInstance = createMockEntityInstance('uuid-another-target', 'def:another_target');

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
                    .mockImplementation(defId => {
                        if (defId === 'def:current_room') return locationInstance;
                        if (defId === 'def:player') return characterInstance;
                        return undefined;
                    });
            });

            it('should resolve position.locationId and update component data', async () => {
                await worldInitializer.initializeWorldEntities();

                const finalCharPosData = characterInstance._getInternalComponentData(POSITION_COMPONENT_ID);
                expect(finalCharPosData.locationId).toBe('uuid-current-room');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Resolved [${POSITION_COMPONENT_ID}]@'locationId' for entity uuid-player: 'def:current_room' -> 'uuid-current-room'`)
                );
                expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith('uuid-player', 'uuid-current-room');

                const finalLocPosData = locationInstance._getInternalComponentData(POSITION_COMPONENT_ID);
                expect(finalLocPosData.locationId).toBe('uuid-outer-space');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Resolved [${POSITION_COMPONENT_ID}]@'locationId' for entity uuid-current-room: 'def:outer_space' -> 'uuid-outer-space'`)
                );
                expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith('uuid-current-room', 'uuid-outer-space');
            });

            it('should resolve exitData.target for core:exits and update component data', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);

                expect(processedExits[0].target).toBe('uuid-target-room');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Resolved [${EXITS_COMPONENT_ID}]@'(self)'[0].target for entity uuid-current-room: 'def:target_room' -> 'uuid-target-room'`)
                );
                expect(processedExits[5].target).toBe('uuid-another-target');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Resolved [${EXITS_COMPONENT_ID}]@'(self)'[5].target for entity uuid-current-room: 'def:another_target' -> 'uuid-another-target'`)
                );
            });

            it('should keep exitData.target as is if already an instance ID (no colon)', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[1].target).toBe('uuid-already-instance');
                const relevantWarnLogs = mockLogger.warn.mock.calls.filter(call =>
                    call[0].includes("'uuid-already-instance'") && call[0].includes("Could not resolve")
                );
                expect(relevantWarnLogs.length).toBe(0);
            });

            it('should keep exitData.target as is and warn if definitionId cannot be resolved', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[2].target).toBe('def:unresolved_room');
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Could not resolve [${EXITS_COMPONENT_ID}]@'(self)'[2].target definitionId 'def:unresolved_room' for entity uuid-current-room.`)
                );
            });

            it('should keep empty or null exitData.target as is (no resolution attempt)', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[3].target).toBe('');
                expect(processedExits[4].target).toBeNull();
                const relevantErrorOrWarnLogs = mockLogger.warn.mock.calls.filter(call =>
                    (call[0].includes("target: ''") || call[0].includes("target: null")) && call[0].includes("Could not resolve")
                );
                expect(relevantErrorOrWarnLogs.length).toBe(0);
            });

            it('should not process non-array data for core:exits if resolveFields expects an array', async () => {
                const malformedExitsComponentData = {not_an_array: "actually_an_object"};
                const malformedEntityDef = {
                    id: 'def:malformed',
                    components: {[EXITS_COMPONENT_ID]: malformedExitsComponentData}
                };
                const malformedInstance = createMockEntityInstance('uuid-malformed', 'def:malformed', malformedEntityDef.components);

                mockGameDataRepository.getAllEntityDefinitions.mockReturnValueOnce([malformedEntityDef]);
                mockEntityManager.createEntityInstance.mockReset().mockReturnValueOnce(malformedInstance);
                mockLogger.warn.mockClear();
                mockLogger.debug.mockClear();

                await worldInitializer.initializeWorldEntities();

                const exitsDataAfter = malformedInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(_isEqual(exitsDataAfter, malformedExitsComponentData)).toBe(true);
                const resolutionWarnings = mockLogger.warn.mock.calls.filter(call =>
                    call[0].includes(`[${EXITS_COMPONENT_ID}]`) && call[0].includes("uuid-malformed") && call[0].includes("Could not resolve")
                );
                expect(resolutionWarnings.length).toBe(0);
            });

            it('should not attempt to resolve exits if EXITS_COMPONENT_ID is missing from entity', async () => {
                const noExitsDef = {
                    id: 'def:no_exits_room',
                    components: {[POSITION_COMPONENT_ID]: {locationId: 'def:somewhere'}}
                };
                const noExitsInstance = createMockEntityInstance('uuid-no_exits', 'def:no_exits_room', noExitsDef.components);
                const somewhereInstance = createMockEntityInstance('uuid-somewhere', 'def:somewhere');

                mockGameDataRepository.getAllEntityDefinitions.mockReturnValueOnce([noExitsDef]);
                mockEntityManager.createEntityInstance.mockReset().mockReturnValueOnce(noExitsInstance);
                mockEntityManager.getPrimaryInstanceByDefinitionId.mockImplementation(defId => {
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
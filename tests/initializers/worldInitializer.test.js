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
    let mockReferenceResolver; // <<< NEW MOCK
    let worldInitializer;

    const createMockEntityInstance = (instanceId, definitionId, initialComponentsData = {}) => {
        const internalComponentsMap = new Map();

        for (const [type, data] of Object.entries(initialComponentsData)) {
            internalComponentsMap.set(type, JSON.parse(JSON.stringify(data)));
        }

        const mockInstanceBase = {
            id: instanceId,
            definitionId: definitionId,
            getComponentData: jest.fn((componentTypeId) => {
                const data = internalComponentsMap.get(componentTypeId);
                return data ? JSON.parse(JSON.stringify(data)) : undefined;
            }),
            addComponent: jest.fn((componentTypeId, componentData) => {
                internalComponentsMap.set(componentTypeId, JSON.parse(JSON.stringify(componentData)));
            }),
            _getInternalComponentData: (componentTypeId) => {
                return internalComponentsMap.get(componentTypeId);
            }
        };

        Object.defineProperty(mockInstanceBase, 'componentEntries', {
            get: jest.fn(() => {
                const entriesArray = [];
                for (const [key, value] of internalComponentsMap.entries()) {
                    entriesArray.push([key, value]);
                }
                return entriesArray[Symbol.iterator]();
            }),
            configurable: true
        });

        return mockInstanceBase;
    };


    beforeEach(() => {
        jest.clearAllMocks();

        mockEntityManager = {
            createEntityInstance: jest.fn(),
            getPrimaryInstanceByDefinitionId: jest.fn(), // Still needed by ReferenceResolver mock
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
        mockReferenceResolver = { // <<< INITIALIZE NEW MOCK
            resolve: jest.fn(),
        };

        worldInitializer = new WorldInitializer({
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            logger: mockLogger,
            spatialIndexManager: mockSpatialIndexManager,
            referenceResolver: mockReferenceResolver, // <<< PASS NEW MOCK
        });

        mockGameDataRepository.getComponentDefinition.mockImplementation(componentTypeId => {
            return {id: componentTypeId, resolveFields: []}; // Default: no fields to resolve
        });
    });

    describe('constructor', () => {
        it('should instantiate successfully with all valid dependencies', () => {
            expect(mockLogger.info).toHaveBeenCalledWith('WorldInitializer: Instance created (with ReferenceResolver).');
        });

        const constructorErrorTestCases = [
            ['EntityManager', 'entityManager', 'WorldInitializer requires an EntityManager.'],
            ['WorldContext', 'worldContext', 'WorldInitializer requires a WorldContext.'],
            ['GameDataRepository', 'gameDataRepository', 'WorldInitializer requires a GameDataRepository.'],
            ['ValidatedEventDispatcher', 'validatedEventDispatcher', 'WorldInitializer requires a ValidatedEventDispatcher.'],
            ['ILogger', 'logger', 'WorldInitializer requires an ILogger.'],
            ['ISpatialIndexManager', 'spatialIndexManager', 'WorldInitializer requires an ISpatialIndexManager.'],
            ['ReferenceResolver', 'referenceResolver', 'WorldInitializer requires a ReferenceResolver.'], // <<< NEW TEST CASE
        ];

        it.each(constructorErrorTestCases)('should throw if %s is missing', (depDisplayName, depsKey, expectedErrorMessage) => {
            const deps = {
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockGameDataRepository,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                logger: mockLogger,
                spatialIndexManager: mockSpatialIndexManager,
                referenceResolver: mockReferenceResolver, // <<< INCLUDE IN BASE DEPS
            };
            delete deps[depsKey];
            expect(() => new WorldInitializer(deps)).toThrow(expectedErrorMessage);
        });
    });

    describe('initializeWorldEntities', () => {
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
            const mockInstance1 = createMockEntityInstance('uuid-room1', 'def:room1', {});
            mockEntityManager.createEntityInstance.mockReturnValueOnce(mockInstance1);
            // Mock ReferenceResolver.resolve to return no changes for an empty component
            mockReferenceResolver.resolve.mockReturnValue({
                resolvedValue: undefined,
                valueChanged: false,
                dataPath: null,
                dataPathIsSelf: false
            });

            await worldInitializer.initializeWorldEntities();

            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith('def:room1');
            expect(mockLogger.debug).toHaveBeenCalledWith(`WorldInitializer (Pass 1): Instantiated entity uuid-room1 (from definition: def:room1)`);
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
            // Instances needed for spatial index, not directly by ReferenceResolver mock in these tests
            let targetRoomInstance, outerSpaceInstance, anotherTargetInstance;


            beforeEach(() => {
                // --- Component Definitions ---
                mockGameDataRepository.getComponentDefinition.mockImplementation(componentTypeId => {
                    if (componentTypeId === POSITION_COMPONENT_ID) {
                        return {
                            id: POSITION_COMPONENT_ID,
                            resolveFields: [{
                                dataPath: "locationId", // Path within the component data
                                dataPathIsSelf: false,
                                resolutionStrategy: {type: "direct"} // Strategy info for ReferenceResolver
                            }]
                        };
                    }
                    if (componentTypeId === EXITS_COMPONENT_ID) {
                        return {
                            id: EXITS_COMPONENT_ID,
                            resolveFields: [{
                                dataPath: null, // For dataPathIsSelf, dataPath can be null or irrelevant
                                dataPathIsSelf: true, // Indicates the whole component data might be replaced
                                resolutionStrategy: {type: "arrayOfObjects", idField: "target"}
                            }]
                        };
                    }
                    return {id: componentTypeId, resolveFields: []}; // Default empty
                });

                // --- Original Data ---
                originalLocationPositionComponentData = {locationId: 'def:outer_space'};
                originalLocationExitsComponentData = [
                    {direction: 'north', target: 'def:target_room'}, // To be resolved
                    {direction: 'south', target: 'uuid-already-instance'}, // Already instance ID
                    {direction: 'east', target: 'def:unresolved_room'}, // Will fail to resolve
                    {direction: 'west', target: ''}, // Empty
                    {direction: 'up', target: null}, // Null
                    {direction: 'down', target: 'def:another_target'} // To be resolved
                ];

                // --- Entity Definitions & Instances ---
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

                // Instances for spatial index check
                targetRoomInstance = createMockEntityInstance('uuid-target-room', 'def:target_room');
                outerSpaceInstance = createMockEntityInstance('uuid-outer-space', 'def:outer_space');
                anotherTargetInstance = createMockEntityInstance('uuid-another-target', 'def:another_target');


                // --- Mock EntityManager.getPrimaryInstanceByDefinitionId (used by ReferenceResolver internally, so keep for conceptual integrity if ReferenceResolver itself was more complexly mocked) ---
                // However, for these tests, we will directly mock `mockReferenceResolver.resolve` outcomes.
                // This is kept for when ReferenceResolver itself might be tested or if a more integrated test was desired.
                mockEntityManager.getPrimaryInstanceByDefinitionId
                    .mockImplementation((defId) => {
                        if (defId === 'def:target_room') return targetRoomInstance;
                        if (defId === 'def:current_room') return locationInstance; // For character's location
                        if (defId === 'def:outer_space') return outerSpaceInstance; // For location's location
                        if (defId === 'def:another_target') return anotherTargetInstance;
                        return undefined;
                    });

                // --- Setup for WorldInitializer.initializeWorldEntities ---
                mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([locationDef, characterDef]);
                mockEntityManager.createEntityInstance
                    .mockReset() // Reset from any previous calls in other tests
                    .mockImplementation(defId => { // Simulate entity creation
                        if (defId === 'def:current_room') return locationInstance;
                        if (defId === 'def:player') return characterInstance;
                        return undefined;
                    });
            });

            it('should resolve position.locationId and update component data', async () => {
                // Mock ReferenceResolver behavior for position components
                mockReferenceResolver.resolve.mockImplementation((componentData, spec) => {
                    if (spec.dataPath === "locationId") {
                        if (componentData.locationId === 'def:current_room') {
                            return {
                                resolvedValue: 'uuid-current-room', // Resolved instance ID
                                valueChanged: true,
                                dataPath: "locationId",
                                dataPathIsSelf: false
                            };
                        }
                        if (componentData.locationId === 'def:outer_space') {
                            return {
                                resolvedValue: 'uuid-outer-space',
                                valueChanged: true,
                                dataPath: "locationId",
                                dataPathIsSelf: false
                            };
                        }
                    }
                    return {
                        resolvedValue: undefined,
                        valueChanged: false,
                        dataPath: spec.dataPath,
                        dataPathIsSelf: spec.dataPathIsSelf
                    };
                });

                await worldInitializer.initializeWorldEntities();

                // Verify character's position
                const finalCharPosData = characterInstance._getInternalComponentData(POSITION_COMPONENT_ID);
                expect(finalCharPosData.locationId).toBe('uuid-current-room');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    `WorldInitializer (Pass 2 RefResolution): Modified path 'locationId' in component [${POSITION_COMPONENT_ID}] for entity uuid-player.`
                );
                expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith('uuid-player', 'uuid-current-room');

                // Verify location's own position
                const finalLocPosData = locationInstance._getInternalComponentData(POSITION_COMPONENT_ID);
                expect(finalLocPosData.locationId).toBe('uuid-outer-space');
                expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith('uuid-current-room', 'uuid-outer-space');
            });

            it('should resolve exitData.target for core:exits and update component data', async () => {
                const resolvedExitsData = [ // This is what ReferenceResolver would return for the exits component
                    {direction: 'north', target: 'uuid-target-room'},
                    {direction: 'south', target: 'uuid-already-instance'},
                    {direction: 'east', target: 'def:unresolved_room'}, // Assuming ReferenceResolver keeps unresolved ones
                    {direction: 'west', target: ''},
                    {direction: 'up', target: null},
                    {direction: 'down', target: 'uuid-another-target'}
                ];

                mockReferenceResolver.resolve.mockImplementation((componentData, spec, entityId, componentTypeId) => {
                    if (componentTypeId === EXITS_COMPONENT_ID && spec.dataPathIsSelf) {
                        // Simulate that ReferenceResolver determined a change was made to the exits array
                        return {
                            resolvedValue: resolvedExitsData, // The entire new component data
                            valueChanged: true,
                            dataPath: null, // Original specDataPath from resolveFields
                            dataPathIsSelf: true // Original specDataPathIsSelf from resolveFields
                        };
                    }
                    // Fallback for other components like position
                    if (spec.dataPath === "locationId") {
                        if (componentData.locationId === 'def:current_room') return {
                            resolvedValue: 'uuid-current-room',
                            valueChanged: true,
                            dataPath: "locationId",
                            dataPathIsSelf: false
                        };
                        if (componentData.locationId === 'def:outer_space') return {
                            resolvedValue: 'uuid-outer-space',
                            valueChanged: true,
                            dataPath: "locationId",
                            dataPathIsSelf: false
                        };
                    }
                    return {
                        resolvedValue: undefined,
                        valueChanged: false,
                        dataPath: spec.dataPath,
                        dataPathIsSelf: spec.dataPathIsSelf
                    };
                });

                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);

                expect(processedExits).toEqual(resolvedExitsData);
                expect(locationInstance.addComponent).toHaveBeenCalledWith(EXITS_COMPONENT_ID, resolvedExitsData);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    `WorldInitializer (Pass 2 RefResolution): Updated component [${EXITS_COMPONENT_ID}] data directly for entity uuid-current-room via addComponent.`
                );
            });

            it('should keep exitData.target as is if already an instance ID (no colon) - handled by ReferenceResolver', async () => {
                mockReferenceResolver.resolve.mockImplementation((componentData, spec, entityId, componentTypeId) => {
                    if (componentTypeId === EXITS_COMPONENT_ID && spec.dataPathIsSelf) {
                        // ReferenceResolver would internally decide not to change 'uuid-already-instance'
                        // and would determine if the overall component data changed.
                        // For this specific test, assume only the resolvable ones change, so valueChanged: true.
                        return {
                            resolvedValue: [
                                {direction: 'north', target: 'uuid-target-room'}, // changed
                                {direction: 'south', target: 'uuid-already-instance'}, // unchanged
                                {direction: 'east', target: 'def:unresolved_room'}, // unchanged (failed resolve)
                                {direction: 'west', target: ''}, // unchanged
                                {direction: 'up', target: null}, // unchanged
                                {direction: 'down', target: 'uuid-another-target'} // changed
                            ],
                            valueChanged: true, // Because other parts of the component changed
                            dataPath: null,
                            dataPathIsSelf: true
                        };
                    }
                    // Fallback for other components like position
                    if (spec.dataPath === "locationId") {
                        if (componentData.locationId === 'def:current_room') return {
                            resolvedValue: 'uuid-current-room',
                            valueChanged: true,
                            dataPath: "locationId",
                            dataPathIsSelf: false
                        };
                        if (componentData.locationId === 'def:outer_space') return {
                            resolvedValue: 'uuid-outer-space',
                            valueChanged: true,
                            dataPath: "locationId",
                            dataPathIsSelf: false
                        };
                    }
                    return {
                        resolvedValue: undefined,
                        valueChanged: false,
                        dataPath: spec.dataPath,
                        dataPathIsSelf: spec.dataPathIsSelf
                    };
                });

                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[1].target).toBe('uuid-already-instance');
                // WorldInitializer's logger won't show specific "Could not resolve" for already instance IDs
                // as ReferenceResolver handles that distinction.
            });

            it('should keep exitData.target as is and warn (via ReferenceResolver) if definitionId cannot be resolved', async () => {
                mockReferenceResolver.resolve.mockImplementation((componentData, spec, entityId, componentTypeId) => {
                    if (componentTypeId === EXITS_COMPONENT_ID && spec.dataPathIsSelf) {
                        // ReferenceResolver handles the warning for 'def:unresolved_room'
                        // It returns the component data with the unresolved ID still present.
                        return {
                            resolvedValue: [
                                {direction: 'north', target: 'uuid-target-room'},
                                {direction: 'south', target: 'uuid-already-instance'},
                                {direction: 'east', target: 'def:unresolved_room'}, // Kept as is by RR
                                {direction: 'west', target: ''},
                                {direction: 'up', target: null},
                                {direction: 'down', target: 'uuid-another-target'}
                            ],
                            valueChanged: true, // because other parts changed
                            dataPath: null,
                            dataPathIsSelf: true
                        };
                    }
                    // Fallback for other components like position
                    if (spec.dataPath === "locationId") {
                        if (componentData.locationId === 'def:current_room') return {
                            resolvedValue: 'uuid-current-room',
                            valueChanged: true,
                            dataPath: "locationId",
                            dataPathIsSelf: false
                        };
                        if (componentData.locationId === 'def:outer_space') return {
                            resolvedValue: 'uuid-outer-space',
                            valueChanged: true,
                            dataPath: "locationId",
                            dataPathIsSelf: false
                        };
                    }
                    return {
                        resolvedValue: undefined,
                        valueChanged: false,
                        dataPath: spec.dataPath,
                        dataPathIsSelf: spec.dataPathIsSelf
                    };
                });

                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[2].target).toBe('def:unresolved_room');
                // The specific warning "Could not resolve..." would be logged by ReferenceResolver, not WorldInitializer directly.
                // WorldInitializer logs the update if valueChanged is true.
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    `WorldInitializer (Pass 2 RefResolution): Updated component [${EXITS_COMPONENT_ID}] data directly for entity uuid-current-room via addComponent.`
                );
            });


            it('should keep empty or null exitData.target as is (no resolution attempt by ReferenceResolver)', async () => {
                mockReferenceResolver.resolve.mockImplementation((componentData, spec, entityId, componentTypeId) => {
                    if (componentTypeId === EXITS_COMPONENT_ID && spec.dataPathIsSelf) {
                        // ReferenceResolver would not attempt to resolve empty/null strings and return them as is.
                        return {
                            resolvedValue: [
                                {direction: 'north', target: 'uuid-target-room'},
                                {direction: 'south', target: 'uuid-already-instance'},
                                {direction: 'east', target: 'def:unresolved_room'},
                                {direction: 'west', target: ''},      // Kept
                                {direction: 'up', target: null},        // Kept
                                {direction: 'down', target: 'uuid-another-target'}
                            ],
                            valueChanged: true, // Other parts changed
                            dataPath: null,
                            dataPathIsSelf: true
                        };
                    }
                    if (spec.dataPath === "locationId") {
                        if (componentData.locationId === 'def:current_room') return {
                            resolvedValue: 'uuid-current-room',
                            valueChanged: true,
                            dataPath: "locationId",
                            dataPathIsSelf: false
                        };
                        if (componentData.locationId === 'def:outer_space') return {
                            resolvedValue: 'uuid-outer-space',
                            valueChanged: true,
                            dataPath: "locationId",
                            dataPathIsSelf: false
                        };
                    }
                    return {
                        resolvedValue: undefined,
                        valueChanged: false,
                        dataPath: spec.dataPath,
                        dataPathIsSelf: spec.dataPathIsSelf
                    };
                });

                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[3].target).toBe('');
                expect(processedExits[4].target).toBeNull();
            });


            it('should not process non-array data for core:exits if resolveFields expects an array (ReferenceResolver handles)', async () => {
                const malformedExitsComponentData = {not_an_array: "actually_an_object"};
                const malformedEntityDef = {
                    id: 'def:malformed',
                    components: {[EXITS_COMPONENT_ID]: malformedExitsComponentData}
                };
                const malformedInstance = createMockEntityInstance('uuid-malformed', 'def:malformed', malformedEntityDef.components);

                mockGameDataRepository.getAllEntityDefinitions.mockReturnValueOnce([malformedEntityDef]);
                mockEntityManager.createEntityInstance.mockReset().mockReturnValueOnce(malformedInstance);

                // ReferenceResolver should see the malformed data and likely return valueChanged: false
                mockReferenceResolver.resolve.mockImplementation((componentData, spec, entityId, componentTypeId) => {
                    if (componentTypeId === EXITS_COMPONENT_ID && entityId === 'uuid-malformed') {
                        // ReferenceResolver would log a warning about malformed data type
                        return {
                            resolvedValue: componentData, // or undefined
                            valueChanged: false, // Crucially, no change is made
                            dataPath: null,
                            dataPathIsSelf: true
                        };
                    }
                    return {
                        resolvedValue: undefined,
                        valueChanged: false,
                        dataPath: spec.dataPath,
                        dataPathIsSelf: spec.dataPathIsSelf
                    };
                });


                await worldInitializer.initializeWorldEntities();

                const exitsDataAfter = malformedInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(_isEqual(exitsDataAfter, malformedExitsComponentData)).toBe(true); // Data remains unchanged
                // WorldInitializer wouldn't log an update because valueChanged is false.
                // The warning about data type would come from ReferenceResolver.
                expect(malformedInstance.addComponent).not.toHaveBeenCalled(); // No update call
            });


            it('should not attempt to resolve exits if EXITS_COMPONENT_ID is missing from entity', async () => {
                const noExitsDef = {
                    id: 'def:no_exits_room',
                    components: {[POSITION_COMPONENT_ID]: {locationId: 'def:somewhere'}}
                };
                const noExitsInstance = createMockEntityInstance('uuid-no_exits', 'def:no_exits_room', noExitsDef.components);

                mockGameDataRepository.getAllEntityDefinitions.mockReturnValueOnce([noExitsDef]);
                mockEntityManager.createEntityInstance.mockReset().mockReturnValueOnce(noExitsInstance);

                // Mock for the position component resolution
                mockReferenceResolver.resolve.mockImplementation((componentData, spec) => {
                    if (spec.dataPath === 'locationId' && componentData.locationId === 'def:somewhere') {
                        return {
                            resolvedValue: 'uuid-somewhere',
                            valueChanged: true,
                            dataPath: 'locationId',
                            dataPathIsSelf: false
                        };
                    }
                    return {
                        resolvedValue: undefined,
                        valueChanged: false,
                        dataPath: spec.dataPath,
                        dataPathIsSelf: spec.dataPathIsSelf
                    };
                });

                await worldInitializer.initializeWorldEntities();

                // Check that resolve was not called for EXITS_COMPONENT_ID on this entity
                const resolveCalls = mockReferenceResolver.resolve.mock.calls;
                const exitResolveCall = resolveCalls.find(call => {
                    const [, , entityId, componentTypeId] = call;
                    return entityId === 'uuid-no_exits' && componentTypeId === EXITS_COMPONENT_ID;
                });
                expect(exitResolveCall).toBeUndefined();
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
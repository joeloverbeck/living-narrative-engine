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

        // Initialize the internal map with deep clones of initial data
        for (const [type, data] of Object.entries(initialComponentsData)) {
            internalComponentsMap.set(type, JSON.parse(JSON.stringify(data)));
        }

        const mockInstance = {
            id: instanceId,
            definitionId: definitionId,
            // No direct 'components' object property

            getComponentData: jest.fn((componentTypeId) => {
                const data = internalComponentsMap.get(componentTypeId);
                // Return a deep clone to mimic real behavior where component data is encapsulated
                return data ? JSON.parse(JSON.stringify(data)) : undefined;
            }),

            addComponent: jest.fn((componentTypeId, componentData) => {
                // Store a deep clone of the data
                internalComponentsMap.set(componentTypeId, JSON.parse(JSON.stringify(componentData)));
            }),

            componentEntries: jest.fn(() => {
                const entriesArray = [];
                // IMPORTANT: This iterator must yield references to the *actual objects*
                // stored in internalComponentsMap if WorldInitializer's _set logic
                // (when dataPathIsSelf is false) is expected to modify them in place
                // and have those modifications be "visible" if the same componentDataInstance
                // is accessed again or if addComponent isn't called to replace it.
                for (const [key, value] of internalComponentsMap.entries()) {
                    entriesArray.push([key, value]); // Push the direct reference from the map
                }
                return entriesArray[Symbol.iterator](); // Return an iterator
            }),

            // Test helper to inspect internal state if necessary (optional)
            _getInternalComponentData: (componentTypeId) => {
                return internalComponentsMap.get(componentTypeId);
            }
        };
        return mockInstance;
    };
    // --- END CORRECTED createMockEntityInstance ---


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

            // Default component definition mock
            mockGameDataRepository.getComponentDefinition.mockImplementation(componentTypeId => {
                return {id: componentTypeId, resolveFields: []}; // Default to no resolveFields
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
            // Use the corrected mock entity creator
            const mockInstance1 = createMockEntityInstance('uuid-room1', 'def:room1');
            mockEntityManager.createEntityInstance.mockReturnValueOnce(mockInstance1);

            await worldInitializer.initializeWorldEntities();

            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith('def:room1');
            expect(mockLogger.info).toHaveBeenCalledWith(`WorldInitializer (Pass 1): Instantiated entity uuid-room1 (from definition: def:room1)`);
        });

        it('should handle failed entity instantiation in Pass 1', async () => {
            const entityDef1 = {id: 'def:broken', components: {}};
            mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([entityDef1]);
            mockEntityManager.createEntityInstance.mockReturnValueOnce(null); // Simulate failure

            await worldInitializer.initializeWorldEntities();

            expect(mockLogger.warn).toHaveBeenCalledWith('WorldInitializer (Pass 1): Failed to instantiate entity from definition: def:broken.');
        });

        describe('Pass 2: Reference Resolution', () => {
            let locationDef, characterDef, locationInstance, characterInstance;
            let originalLocationPositionComponentData, originalCharacterPositionComponentData,
                originalLocationExitsComponentData;
            let targetRoomInstance, outerSpaceInstance, anotherTargetInstance;


            beforeEach(() => {
                // Setup specific component definitions for resolution tests
                mockGameDataRepository.getComponentDefinition.mockImplementation(componentTypeId => {
                    if (componentTypeId === POSITION_COMPONENT_ID) {
                        return {
                            id: POSITION_COMPONENT_ID,
                            resolveFields: [{
                                dataPath: "locationId", // Path within the component data object
                                resolutionStrategy: {type: "direct"}
                            }]
                        };
                    }
                    if (componentTypeId === EXITS_COMPONENT_ID) {
                        return {
                            id: EXITS_COMPONENT_ID,
                            resolveFields: [{
                                dataPathIsSelf: true, // The component data itself (an array) needs processing
                                resolutionStrategy: {type: "arrayOfObjects", idField: "target"} // target field in each object of the array
                            }]
                        };
                    }
                    return {id: componentTypeId, resolveFields: []}; // Default
                });

                // Define original component data (these will be cloned by createMockEntityInstance)
                originalLocationPositionComponentData = {locationId: 'def:outer_space'};
                originalLocationExitsComponentData = [
                    {direction: 'north', target: 'def:target_room'},       // To be resolved
                    {direction: 'south', target: 'uuid-already-instance'}, // Already an instance ID
                    {direction: 'east', target: 'def:unresolved_room'},   // Should remain unresolved
                    {direction: 'west', target: ''},                       // Empty target
                    {direction: 'up', target: null},                       // Null target
                    {direction: 'down', target: 'def:another_target'}      // To be resolved
                ];

                locationDef = {
                    id: 'def:current_room',
                    components: {
                        [POSITION_COMPONENT_ID]: originalLocationPositionComponentData,
                        [EXITS_COMPONENT_ID]: originalLocationExitsComponentData
                    }
                };
                // Use the corrected mock entity creator
                locationInstance = createMockEntityInstance('uuid-current-room', 'def:current_room', locationDef.components);

                originalCharacterPositionComponentData = {locationId: 'def:current_room'};
                characterDef = {
                    id: 'def:player',
                    components: {[POSITION_COMPONENT_ID]: originalCharacterPositionComponentData}
                };
                // Use the corrected mock entity creator
                characterInstance = createMockEntityInstance('uuid-player', 'def:player', characterDef.components);

                // Mock other entities that can be targets of resolution
                targetRoomInstance = createMockEntityInstance('uuid-target-room', 'def:target_room');
                outerSpaceInstance = createMockEntityInstance('uuid-outer-space', 'def:outer_space');
                anotherTargetInstance = createMockEntityInstance('uuid-another-target', 'def:another_target');


                // Mock EntityManager.getPrimaryInstanceByDefinitionId behavior
                mockEntityManager.getPrimaryInstanceByDefinitionId
                    .mockImplementation((defId) => {
                        if (defId === 'def:target_room') return targetRoomInstance;
                        if (defId === 'def:current_room') return locationInstance; // Should return the mock instance
                        if (defId === 'def:outer_space') return outerSpaceInstance;
                        if (defId === 'def:another_target') return anotherTargetInstance;
                        return undefined; // For unresolved_room and any others
                    });

                // Setup WorldInitializer to process these specific definitions
                mockGameDataRepository.getAllEntityDefinitions.mockReturnValue([locationDef, characterDef]);

                // Reset and setup createEntityInstance to return our prepared mock instances
                mockEntityManager.createEntityInstance
                    .mockReset() // Clear any previous mockReturnValueOnce calls
                    .mockImplementation(defId => { // Return specific instances based on defId
                        if (defId === 'def:current_room') return locationInstance;
                        if (defId === 'def:player') return characterInstance;
                        return undefined; // Should not happen if getAllEntityDefinitions is correct
                    });
            });

            it('should resolve position.locationId and update component data', async () => {
                await worldInitializer.initializeWorldEntities();

                // Verify character's position
                // Use the test helper to get the *actual* data post-resolution from the map
                const finalCharPosData = characterInstance._getInternalComponentData(POSITION_COMPONENT_ID);
                expect(finalCharPosData.locationId).toBe('uuid-current-room');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Resolved [${POSITION_COMPONENT_ID}]@'locationId' for entity uuid-player: 'def:current_room' -> 'uuid-current-room'`)
                );
                expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith('uuid-player', 'uuid-current-room');

                // Verify location's own position
                const finalLocPosData = locationInstance._getInternalComponentData(POSITION_COMPONENT_ID);
                expect(finalLocPosData.locationId).toBe('uuid-outer-space');
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Resolved [${POSITION_COMPONENT_ID}]@'locationId' for entity uuid-current-room: 'def:outer_space' -> 'uuid-outer-space'`)
                );
                expect(mockSpatialIndexManager.addEntity).toHaveBeenCalledWith('uuid-current-room', 'uuid-outer-space');
            });

            it('should resolve exitData.target for core:exits and update component data', async () => {
                await worldInitializer.initializeWorldEntities();
                // Use the test helper to get the *actual* data post-resolution
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
                // Ensure no "Could not resolve" warning was logged for this specific, already valid ID.
                const relevantWarnLogs = mockLogger.warn.mock.calls.filter(call =>
                    call[0].includes("'uuid-already-instance'") && call[0].includes("Could not resolve")
                );
                expect(relevantWarnLogs.length).toBe(0);
            });

            it('should keep exitData.target as is and warn if definitionId cannot be resolved', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[2].target).toBe('def:unresolved_room'); // Stays as definition ID
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Could not resolve [${EXITS_COMPONENT_ID}]@'(self)'[2].target definitionId 'def:unresolved_room' for entity uuid-current-room.`)
                );
            });


            it('should keep empty or null exitData.target as is (no resolution attempt)', async () => {
                await worldInitializer.initializeWorldEntities();
                const processedExits = locationInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(processedExits[3].target).toBe('');
                expect(processedExits[4].target).toBeNull();
                // Check that no warnings/errors were logged for these specific empty/null targets
                const relevantErrorOrWarnLogs = mockLogger.warn.mock.calls.filter(call =>
                    (call[0].includes("target: ''") || call[0].includes("target: null")) && call[0].includes("Could not resolve")
                );
                expect(relevantErrorOrWarnLogs.length).toBe(0);
            });


            it('should not process non-array data for core:exits if resolveFields expects an array', async () => {
                const malformedExitsComponentData = {not_an_array: "actually_an_object"}; // Malformed data
                const malformedEntityDef = {
                    id: 'def:malformed',
                    components: {[EXITS_COMPONENT_ID]: malformedExitsComponentData}
                };
                const malformedInstance = createMockEntityInstance('uuid-malformed', 'def:malformed', malformedEntityDef.components);

                mockGameDataRepository.getAllEntityDefinitions.mockReturnValueOnce([malformedEntityDef]); // Test with only this one
                mockEntityManager.createEntityInstance.mockReset().mockReturnValueOnce(malformedInstance);

                // Clear previous logs that might interfere
                mockLogger.warn.mockClear();
                mockLogger.debug.mockClear();

                await worldInitializer.initializeWorldEntities();

                const exitsDataAfter = malformedInstance._getInternalComponentData(EXITS_COMPONENT_ID);
                expect(_isEqual(exitsDataAfter, malformedExitsComponentData)).toBe(true); // Data should remain unchanged

                // Check that no resolution warnings specific to this malformed component were logged during array processing.
                // The component's data is not an array, so the "arrayOfObjects" strategy should not find an array to iterate.
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

                mockLogger.debug.mockClear(); // Clear debug logs before the call

                await worldInitializer.initializeWorldEntities();

                // Ensure no debug logs related to resolving EXITS_COMPONENT_ID for 'uuid-no_exits' were made
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
// src/tests/core/initializers/worldInitializer.test.js

// --- Imports ---
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import WorldInitializer from '../../../core/initializers/worldInitializer.js'; // Adjust path as needed

// --- Type Imports for Mocks ---
/** @typedef {import('../../../core/entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../../core/interfaces/IWorldContext.js').default} IWorldContext */
/** @typedef {import('../../../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../data/schemas/entity.schema.json').EntityDefinition} EntityDefinition */
/** @typedef {import('../../../entities/entity.js').default} Entity */ // For mock instance

// --- Test Suite ---
describe('WorldInitializer (Universal Instantiation Refactor)', () => {
    // --- Mocks ---
    /** @type {jest.Mocked<EntityManager>} */
    let mockEntityManager;
    /** @type {jest.Mocked<IWorldContext>} */
    let mockWorldContext;
    /** @type {jest.Mocked<GameDataRepository>} */
    let mockRepository;
    /** @type {jest.Mocked<ValidatedEventDispatcher>} */
    let mockValidatedEventDispatcher;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {WorldInitializer} */
    let worldInitializer;

    // --- Mock Data ---
    /** @type {EntityDefinition[]} */
    const mockEntityDefinitions = [
        {id: 'item_apple', name: 'Apple', components: [{type: 'ItemComponent'}]},
        {id: 'loc_start', name: 'Starting Room', components: [{type: 'PositionComponent'}]},
        {id: 'npc_guard', name: 'Guard', components: [{type: 'ActorComponent'}]},
        {id: 'former_blocker_door', name: 'Old Door', components: [{type: 'OpenableComponent'}]},
        {id: 'item_sword', name: 'Sword', components: [{type: 'ItemComponent'}, {type: 'EquippableComponent'}]},
    ];

    /** @type {EntityDefinition} */
    const invalidDefinitionNoId = {name: 'Invalid Entity', components: []};
    /** @type {EntityDefinition} */
    const invalidDefinitionNull = null;

    /** @type {Entity} */
    const mockEntityInstance = (id) => ({id: id, /* other mock properties */});

    beforeEach(() => {
        jest.clearAllMocks();

        mockEntityManager = {
            createEntityInstance: jest.fn().mockImplementation((id) => mockEntityInstance(id)),
            buildInitialSpatialIndex: jest.fn(),
            activeEntities: new Map(),
        };

        mockWorldContext = {};

        mockRepository = {
            getAllEntityDefinitions: jest.fn().mockReturnValue([...mockEntityDefinitions]),
        };

        mockValidatedEventDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined), // Ensure it returns a resolved promise
        };

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        worldInitializer = new WorldInitializer({
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockRepository,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            logger: mockLogger,
        });
    });

    // --- Constructor Tests (Remain Synchronous) ---
    describe('Constructor', () => {
        it('should throw error if entityManager is missing', () => {
            expect(() => new WorldInitializer({
                worldContext: mockWorldContext,
                gameDataRepository: mockRepository,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                logger: mockLogger
            })).toThrow('WorldInitializer requires an EntityManager.');
        });

        it('should throw error if worldContext is missing', () => {
            expect(() => new WorldInitializer({
                entityManager: mockEntityManager,
                gameDataRepository: mockRepository,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                logger: mockLogger
            })).toThrow('WorldInitializer requires a WorldContext.');
        });

        it('should throw error if gameDataRepository is missing', () => {
            expect(() => new WorldInitializer({
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                validatedEventDispatcher: mockValidatedEventDispatcher,
                logger: mockLogger
            })).toThrow('WorldInitializer requires a GameDataRepository.');
        });

        it('should throw error if validatedEventDispatcher is missing', () => {
            expect(() => new WorldInitializer({
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockRepository,
                logger: mockLogger
            })).toThrow('WorldInitializer requires a ValidatedEventDispatcher.');
        });

        it('should throw error if logger is missing', () => {
            expect(() => new WorldInitializer({
                entityManager: mockEntityManager,
                worldContext: mockWorldContext,
                gameDataRepository: mockRepository,
                validatedEventDispatcher: mockValidatedEventDispatcher
            })).toThrow('WorldInitializer requires an ILogger.');
        });

        it('should instantiate successfully with valid dependencies', () => {
            expect(worldInitializer).toBeInstanceOf(WorldInitializer);
            expect(mockLogger.info).toHaveBeenCalledWith('WorldInitializer: Instance created.');
        });
    });

    // --- initializeWorldEntities Method Tests (Now Mostly Async) ---
    describe('initializeWorldEntities', () => {
        it('should instantiate all valid entities universally', async () => { // <-- Add async
            const result = await worldInitializer.initializeWorldEntities(); // <-- Add await

            expect(result).toBe(true);
            expect(mockRepository.getAllEntityDefinitions).toHaveBeenCalledTimes(1);

            // Verify createEntityInstance called for each valid definition
            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(mockEntityDefinitions.length);
            for (const def of mockEntityDefinitions) {
                expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(def.id);
            }

            // Verify logging
            expect(mockLogger.info).toHaveBeenCalledWith('WorldInitializer: Instantiating initial world entities...');
            // Check one specific instantiation log
            expect(mockLogger.info).toHaveBeenCalledWith(`Instantiated entity: ${mockEntityDefinitions[0].id} from definition: ${mockEntityDefinitions[0].id}`);
            expect(mockLogger.info).toHaveBeenCalledWith(`Instantiated ${mockEntityDefinitions.length} total entities.`);
            expect(mockLogger.info).toHaveBeenCalledWith('Building initial spatial index...');
            expect(mockLogger.info).toHaveBeenCalledWith('Initial spatial index build completed.');


            // Verify spatial index build called *after* loop
            expect(mockEntityManager.buildInitialSpatialIndex).toHaveBeenCalledTimes(1);
            // Ensure buildInitialSpatialIndex is called after createEntityInstance calls
            const createCallsOrder = mockEntityManager.createEntityInstance.mock.invocationCallOrder;
            const buildCallOrder = mockEntityManager.buildInitialSpatialIndex.mock.invocationCallOrder;
            // Note: Order check might be fragile if implementation details change, but useful here
            if (createCallsOrder.length > 0 && buildCallOrder.length > 0) {
                expect(buildCallOrder[0]).toBeGreaterThan(createCallsOrder[createCallsOrder.length - 1]);
            }


            // Verify event dispatching (including the final completed event)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:started',
                {},
                {allowSchemaNotFound: true}
            );
            // Check fine-grained events
            for (const def of mockEntityDefinitions) {
                expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                    'worldinit:entity_instantiated',
                    {entityId: def.id, definitionId: def.id, reason: 'Initial World Load'},
                    {allowSchemaNotFound: true}
                );
            }
            // Check completed event payload and logging
            const expectedCompletedPayload = {totalInstantiatedCount: mockEntityDefinitions.length};
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:completed',
                expectedCompletedPayload,
                {allowSchemaNotFound: true}
            );
            // This assertion should now pass because we awaited the function
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:world_initializer:completed' event.", expectedCompletedPayload);
        });

        it('should skip invalid entity definitions and log warnings', async () => { // <-- Add async
            const validCount = 3;
            const mixedDefinitions = [
                mockEntityDefinitions[0], // Valid
                invalidDefinitionNoId,    // Invalid (no id)
                mockEntityDefinitions[1], // Valid
                invalidDefinitionNull,    // Invalid (null)
                mockEntityDefinitions[2], // Valid
            ];
            mockRepository.getAllEntityDefinitions.mockReturnValue(mixedDefinitions);

            const result = await worldInitializer.initializeWorldEntities(); // <-- Add await

            expect(result).toBe(true);
            // Should only attempt to create instances for valid definitions
            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(validCount);
            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(mockEntityDefinitions[0].id);
            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(mockEntityDefinitions[1].id);
            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(mockEntityDefinitions[2].id);
            expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalledWith(undefined);

            // Verify warnings logged for invalid definitions
            expect(mockLogger.warn).toHaveBeenCalledWith('WorldInitializer: Skipping invalid entity definition:', invalidDefinitionNoId);
            expect(mockLogger.warn).toHaveBeenCalledWith('WorldInitializer: Skipping invalid entity definition:', invalidDefinitionNull);
            expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Includes the skipping logs

            // Verify spatial index and completion event
            expect(mockEntityManager.buildInitialSpatialIndex).toHaveBeenCalledTimes(1);
            const expectedCompletedPayload = {totalInstantiatedCount: validCount};
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:completed',
                expectedCompletedPayload,
                {allowSchemaNotFound: true}
            );
            // Check debug log as well
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:world_initializer:completed' event.", expectedCompletedPayload);
        });

        it('should skip instantiation if entity already exists and log warning', async () => { // <-- Add async
            const existingEntityId = mockEntityDefinitions[1].id;
            mockEntityManager.activeEntities.set(existingEntityId, mockEntityInstance(existingEntityId));

            const result = await worldInitializer.initializeWorldEntities(); // <-- Add await

            expect(result).toBe(true);
            // Should attempt definitions, but skip the existing one during instantiation
            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(mockEntityDefinitions.length - 1);
            expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalledWith(existingEntityId);
            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledWith(mockEntityDefinitions[0].id);

            // Verify warning logged
            expect(mockLogger.warn).toHaveBeenCalledWith(`Entity definition ${existingEntityId} requested but entity already exists. Skipping.`);
            expect(mockLogger.warn).toHaveBeenCalledTimes(1); // Only the skipping log

            // Verify spatial index and completion event
            expect(mockEntityManager.buildInitialSpatialIndex).toHaveBeenCalledTimes(1);
            const expectedCompletedPayload = {totalInstantiatedCount: mockEntityDefinitions.length - 1};
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:completed',
                expectedCompletedPayload,
                {allowSchemaNotFound: true}
            );
            // Check debug log
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:world_initializer:completed' event.", expectedCompletedPayload);
        });

        it('should handle empty entity definitions gracefully', async () => { // <-- Add async
            mockRepository.getAllEntityDefinitions.mockReturnValue([]);

            const result = await worldInitializer.initializeWorldEntities(); // <-- Add await

            expect(result).toBe(true);
            expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith('WorldInitializer: No entity definitions found. World may be empty.');
            expect(mockEntityManager.buildInitialSpatialIndex).toHaveBeenCalledTimes(1); // Still builds index

            const expectedCompletedPayload = {totalInstantiatedCount: 0};
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:completed',
                expectedCompletedPayload,
                {allowSchemaNotFound: true}
            );
            // Check debug log
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:world_initializer:completed' event.", expectedCompletedPayload);
        });

        it('should throw, log error, and dispatch failed event if repository throws', async () => { // <-- Add async
            const repoError = new Error('Database connection failed');
            mockRepository.getAllEntityDefinitions.mockImplementation(() => {
                throw repoError;
            });

            // Use try/catch or rejects.toThrow for async functions
            await expect(worldInitializer.initializeWorldEntities()).rejects.toThrow(repoError); // <-- await + rejects

            // Verify error log
            expect(mockLogger.error).toHaveBeenCalledWith('WorldInitializer: CRITICAL ERROR during entity instantiation or index build:', repoError);
            expect(mockEntityManager.createEntityInstance).not.toHaveBeenCalled();
            expect(mockEntityManager.buildInitialSpatialIndex).not.toHaveBeenCalled();

            // Verify event dispatches (start and fail)
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:started', {}, {allowSchemaNotFound: true}
            );
            const expectedFailedPayload = {error: repoError.message, stack: repoError.stack};
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:failed',
                expectedFailedPayload,
                {allowSchemaNotFound: true}
            );
            // Verify completion event NOT called
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'initialization:world_initializer:completed', expect.anything(), expect.anything()
            );
            // Check debug log for failure event
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:world_initializer:failed' event.", expectedFailedPayload);
        });

        it('should log warning, dispatch event, and continue if a single entity instantiation fails (returns null)', async () => { // <-- Add async
            const failedEntityId = mockEntityDefinitions[2].id; // e.g., npc_guard
            mockEntityManager.createEntityInstance.mockImplementation((id) => {
                if (id === failedEntityId) {
                    return null; // Simulate failure
                }
                return mockEntityInstance(id); // Success for others
            });

            const result = await worldInitializer.initializeWorldEntities(); // <-- Add await

            expect(result).toBe(true); // Overall process succeeds
            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(mockEntityDefinitions.length); // Attempted all

            // Verify warning and event for the failed one
            expect(mockLogger.warn).toHaveBeenCalledWith(`Failed to instantiate entity from definition: ${failedEntityId}.`);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'worldinit:entity_instantiation_failed',
                {definitionId: failedEntityId, reason: 'Initial World Load'},
                {allowSchemaNotFound: true}
            );

            // Verify success logs/events for others (e.g., the first one)
            expect(mockLogger.info).toHaveBeenCalledWith(`Instantiated entity: ${mockEntityDefinitions[0].id} from definition: ${mockEntityDefinitions[0].id}`);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'worldinit:entity_instantiated',
                {
                    entityId: mockEntityDefinitions[0].id,
                    definitionId: mockEntityDefinitions[0].id,
                    reason: 'Initial World Load'
                },
                {allowSchemaNotFound: true}
            );

            // Verify spatial index and completion event (count reflects failure)
            expect(mockEntityManager.buildInitialSpatialIndex).toHaveBeenCalledTimes(1);
            const expectedCompletedPayload = {totalInstantiatedCount: mockEntityDefinitions.length - 1};
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:completed',
                expectedCompletedPayload,
                {allowSchemaNotFound: true}
            );
            // Check debug log for completion
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:world_initializer:completed' event.", expectedCompletedPayload);
        });

        it('should throw, log error, and dispatch failed event if buildInitialSpatialIndex throws', async () => { // <-- Add async
            const indexError = new Error('Spatial index build failed');
            mockEntityManager.buildInitialSpatialIndex.mockImplementation(() => {
                throw indexError;
            });

            // Use try/catch or rejects.toThrow for async functions
            await expect(worldInitializer.initializeWorldEntities()).rejects.toThrow(indexError); // <-- await + rejects

            // Instantiation loop should have completed
            expect(mockEntityManager.createEntityInstance).toHaveBeenCalledTimes(mockEntityDefinitions.length);
            expect(mockLogger.info).toHaveBeenCalledWith(`Instantiated ${mockEntityDefinitions.length} total entities.`);

            // Error logging and event dispatch
            expect(mockLogger.error).toHaveBeenCalledWith('WorldInitializer: CRITICAL ERROR during entity instantiation or index build:', indexError);
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:started', {}, {allowSchemaNotFound: true}
            );
            const expectedFailedPayload = {error: indexError.message, stack: indexError.stack};
            expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'initialization:world_initializer:failed',
                expectedFailedPayload,
                {allowSchemaNotFound: true}
            );
            // Check debug log for failure event
            expect(mockLogger.debug).toHaveBeenCalledWith("Dispatched 'initialization:world_initializer:failed' event.", expectedFailedPayload);

            // Verify completion event NOT called
            expect(mockValidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
                'initialization:world_initializer:completed', expect.anything(), expect.anything()
            );
        });
    });
});
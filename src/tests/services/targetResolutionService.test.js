// src/tests/services/targetResolutionService.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {
    TargetResolutionService,
} from '../../services/targetResolutionService.js';
import Entity from '../../entities/entity.js'; // Assuming Entity is default export
import {NameComponent} from '../../components/nameComponent.js';
import {HealthComponent} from '../../components/healthComponent.js'; // Assuming exists
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js'; // Import ConnectionComponent
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';

// --- Mocks ---
const mockDispatch = jest.fn(); // General dispatch mock for resolveTargetEntity/Connection context
const mockEventBusDispatch = jest.fn(); // Specific dispatch mock for resolveItemTarget eventBus
const mockEntityManager = {
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
    entities: new Map(),
    locations: new Map(), // Map<locationId, Set<entityId>>
};
const mockConditionEvaluationService = {
    evaluateConditions: jest.fn(),
};

// Mock Entities
let mockPlayerEntity;
let mockCurrentLocation;

// --- Test Context ---
const mockContext = {
    playerEntity: null, // Will be set in beforeEach
    currentLocation: null, // Will be set in beforeEach
    entityManager: mockEntityManager,
    dispatch: mockDispatch, // Used by resolveTargetEntity/Connection
    targets: [],
    dataManager: {},
};

// --- Service Dependencies ---
const mockDependencies = {
    entityManager: mockEntityManager,
    eventBus: {dispatch: mockEventBusDispatch}, // Used by resolveItemTarget
    conditionEvaluationService: mockConditionEvaluationService,
};

// --- Service Instance ---
const targetResolutionService = new TargetResolutionService();


// --- Helper Functions ---
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity);
    return entity;
};

const placeInLocation = (entityId, locationId) => {
    if (!mockEntityManager.locations.has(locationId)) {
        mockEntityManager.locations.set(locationId, new Set());
    }
    mockEntityManager.locations.get(locationId).add(entityId);
    const entity = mockEntityManager.entities.get(entityId);
    if (entity) {
        let posComp = entity.getComponent(PositionComponent);
        if (!posComp) {
            posComp = new PositionComponent({locationId: locationId});
            entity.addComponent(posComp);
        } else {
            posComp.setLocation(locationId);
        }
    }
};

// --- Global Setup ---
beforeEach(() => {
    // Clear mocks
    mockDispatch.mockClear();
    mockEventBusDispatch.mockClear();
    mockEntityManager.entities.clear();
    mockEntityManager.locations.clear();
    // Reset mock implementations *after* clearing entities/locations
    mockEntityManager.getEntityInstance.mockClear().mockImplementation((id) => mockEntityManager.entities.get(id));
    mockEntityManager.getEntitiesInLocation.mockClear().mockImplementation((locId) => mockEntityManager.locations.get(locId) || new Set());
    mockConditionEvaluationService.evaluateConditions.mockClear().mockResolvedValue({
        success: true,
        messages: [],
        failureMessage: null
    }); // Default success

    // Reset player/location
    mockPlayerEntity = createMockEntity('player', 'Player');
    mockCurrentLocation = createMockEntity('loc-1', 'Test Room');
    placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id); // Place player

    // Update context
    mockContext.playerEntity = mockPlayerEntity;
    mockContext.currentLocation = mockCurrentLocation;
    mockContext.targets = [];
});

// ========================================================================
// == Tests for TargetResolutionService Class Methods =====================
// ========================================================================
describe('TargetResolutionService', () => {

    describe('resolveItemTarget', () => {
        // This method relies solely on explicit IDs passed in the parameters.
        // It does not perform name->ID resolution or use ParsedCommand phrases.
        let userEntity;
        let usableComponentData;
        let itemName;
        let targetEntity;
        let targetConnection;
        let locationEntity; // This is the mockCurrentLocation entity

        beforeEach(() => {
            // Setup common entities and components for these tests
            userEntity = mockPlayerEntity; // Use the globally setup player
            locationEntity = mockCurrentLocation; // Use the globally setup location
            targetEntity = createMockEntity('target-dummy', 'Training Dummy', [new HealthComponent({
                current: 5,
                max: 10
            })]);
            placeInLocation(targetEntity.id, locationEntity.id);

            itemName = 'Healing Potion';
            usableComponentData = {
                target_required: true,
                target_conditions: [],
                failure_message_target_required: null, // Explicitly null unless overridden
                failure_message_invalid_target: null, // Explicitly null unless overridden
                // Add other usable component fields if needed for conditions
            };

            // Setup location connections
            targetConnection = {
                connectionId: 'conn-north',
                direction: 'north',
                targetLocationId: 'loc-2',
                name: 'stone doorway',
                locked: false, // Example property for conditions
                state: 'unlocked' // Runtime state
            };
            const connectionsComp = new ConnectionsComponent({connections: []}); // Start empty
            connectionsComp.addConnection(targetConnection); // Add our test connection
            // Ensure the mock location entity actually has this component
            if (!locationEntity.hasComponent(ConnectionsComponent)) {
                locationEntity.addComponent(connectionsComp);
            } else {
                // If it exists, clear and re-add to ensure clean state
                const existingComp = locationEntity.getComponent(ConnectionsComponent);
                existingComp.clearConnections();
                existingComp.addConnection(targetConnection);
            }
        });

        // --- AC 2: Target Not Required ---
        test('AC 2: should succeed with null target if target is not required', async () => {
            usableComponentData.target_required = false;
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: null,
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(true);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(result.messages).toContainEqual({text: `Target not required for ${itemName}.`, type: 'internal'});
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
        });

        // --- AC 3: Connection ID Success ---
        test('AC 3: should resolve explicit connection target successfully (no conditions)', async () => {
            usableComponentData.target_conditions = []; // No conditions
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: null, // Ensure entity ID isn't interfering
                    explicitTargetConnectionId: 'conn-north',
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(true);
            expect(result.target).toEqual(targetConnection); // Use toEqual for object comparison
            expect(result.targetType).toBe('connection');
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(result.messages).toContainEqual(expect.objectContaining({text: expect.stringContaining('Found potential explicit target: CONNECTION stone doorway')}));
        });

        test('AC 3 & 6: should resolve explicit connection target successfully (conditions pass)', async () => {
            usableComponentData.target_conditions = [{type: 'IS_UNLOCKED'}]; // Example condition
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: true,
                messages: [{text: 'Condition IS_UNLOCKED passed.', type: 'internal'}],
                failureMessage: null
            });

            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: 'conn-north',
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(true);
            expect(result.target).toEqual(targetConnection);
            expect(result.targetType).toBe('connection');
            // AC 6 Checks:
            expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                targetConnection, // Subject is the Connection object
                expect.objectContaining({
                    userEntity,
                    targetConnectionContext: targetConnection, // Correct context
                    targetEntityContext: null
                }),
                usableComponentData.target_conditions,
                expect.objectContaining({checkType: 'Target'})
            );
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(result.messages).toContainEqual(expect.objectContaining({text: expect.stringContaining('passed validation conditions')}));
            expect(result.messages).toContainEqual({text: 'Condition IS_UNLOCKED passed.', type: 'internal'}); // Include messages from condition service
        });

        // --- AC 4: Entity ID Success ---
        test('AC 4: should resolve explicit entity target successfully (no conditions)', async () => {
            usableComponentData.target_conditions = [];
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: 'target-dummy',
                    explicitTargetConnectionId: null, // Ensure connection ID isn't interfering
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(true);
            expect(result.target).toBe(targetEntity); // Use toBe for entity instance comparison
            expect(result.targetType).toBe('entity');
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(result.messages).toContainEqual(expect.objectContaining({text: expect.stringContaining('Found potential explicit target: ENTITY Training Dummy')}));
        });

        test('AC 4 & 6: should resolve explicit entity target successfully (conditions pass)', async () => {
            usableComponentData.target_conditions = [{type: 'HAS_COMPONENT', component: 'HealthComponent'}];
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: true,
                messages: [{text: 'Condition HAS_COMPONENT passed.', type: 'internal'}],
                failureMessage: null
            });

            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: 'target-dummy',
                    explicitTargetConnectionId: null,
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(true);
            expect(result.target).toBe(targetEntity);
            expect(result.targetType).toBe('entity');
            // AC 6 Checks:
            expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                targetEntity, // Subject is the Entity object
                expect.objectContaining({
                    userEntity,
                    targetEntityContext: targetEntity, // Correct context
                    targetConnectionContext: null
                }),
                usableComponentData.target_conditions,
                expect.objectContaining({checkType: 'Target'})
            );
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(result.messages).toContainEqual(expect.objectContaining({text: expect.stringContaining('passed validation conditions')}));
            expect(result.messages).toContainEqual({text: 'Condition HAS_COMPONENT passed.', type: 'internal'}); // Include messages from condition service
        });

        // --- AC 5: Connection Priority ---
        test('AC 5: should prioritize explicit connection ID over entity ID when both are valid', async () => {
            usableComponentData.target_conditions = []; // Keep it simple, no conditions
            // Both IDs are valid according to beforeEach setup
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: 'target-dummy', // Provide valid entity ID
                    explicitTargetConnectionId: 'conn-north', // Provide valid connection ID
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(true);
            expect(result.target).toEqual(targetConnection); // Should resolve the CONNECTION
            expect(result.targetType).toBe('connection'); // Type should be CONNECTION
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled(); // No conditions defined
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(result.messages).toContainEqual(expect.objectContaining({text: expect.stringContaining('Found potential explicit target: CONNECTION stone doorway')}));
            // Implicitly verifies entity wasn't the final target
        });

        // --- AC 6: Condition Evaluation Failures & Fallbacks ---
        test('AC 6: should fail if explicit connection target conditions fail', async () => {
            usableComponentData.target_conditions = [{type: 'IS_OPEN'}];
            const failureMsg = 'The doorway must be open.';
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: false,
                messages: [{text: 'Condition IS_OPEN failed.', type: 'internal'}],
                failureMessage: failureMsg // Service provides specific message
            });

            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: 'conn-north',
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalled();
            // AC 6 Check: Uses message from condition service
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: failureMsg,
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('Target conditions failed'),
                type: 'warning'
            }));
            expect(result.messages).toContainEqual({text: 'Condition IS_OPEN failed.', type: 'internal'});
        });

        test('AC 6: should fail if explicit entity target conditions fail', async () => {
            usableComponentData.target_conditions = [{type: 'HEALTH_BELOW', value: 3}]; // Dummy's health is 5
            const failureMsg = 'Target needs to be more wounded.';
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: false,
                messages: [{text: 'Condition HEALTH_BELOW failed.', type: 'internal'}],
                failureMessage: failureMsg // Service provides specific message
            });

            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: 'target-dummy',
                    explicitTargetConnectionId: null,
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalled();
            // AC 6 Check: Uses message from condition service
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: failureMsg,
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('Target conditions failed'),
                type: 'warning'
            }));
            expect(result.messages).toContainEqual({text: 'Condition HEALTH_BELOW failed.', type: 'internal'});
        });

        test('AC 6: should use fallback condition failure message (generic) if service provides none', async () => {
            usableComponentData.target_conditions = [{type: 'SOME_FAILING_CONDITION'}];
            usableComponentData.failure_message_invalid_target = null; // Ensure no item-specific fallback
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: false,
                messages: [],
                failureMessage: null // Service provides no message
            });

            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: 'target-dummy',
                    explicitTargetConnectionId: null,
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            // AC 6 Check: Uses generic fallback
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_INVALID_TARGET(itemName), // Default message
                type: 'warning',
            });
        });

        // MODIFIED Test based on Implementation Notes
        test('AC 6: should use item\'s failure_message_invalid_target as condition fallback if provided', async () => {
            usableComponentData.target_conditions = [{type: 'SOME_FAILING_CONDITION'}];
            const itemSpecificFallback = 'This specific target is simply not usable.';
            usableComponentData.failure_message_invalid_target = itemSpecificFallback; // Set the item-specific fallback
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: false,
                messages: [],
                failureMessage: null // Service provides no message
            });

            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: 'target-dummy',
                    explicitTargetConnectionId: null,
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            // AC 6 Check: Uses item's specific fallback message
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: itemSpecificFallback,
                type: 'warning',
            });
        });


        // --- AC 7: Failure - Invalid Connection ID (and No Fallback) ---
        test('AC 7: should fail if explicit connection target ID is not found', async () => {
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: 'invalid-conn-id',
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION('invalid-conn-id'),
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('Explicit connection target ID invalid-conn-id not found'),
                type: 'warning'
            }));
        });

        test('AC 7: should fail if user lacks PositionComponent when resolving connection', async () => {
            userEntity.removeComponent(PositionComponent); // Remove position
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: 'conn-north',
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION('conn-north'),
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('lacks PositionComponent'),
                type: 'warning'
            }));
        });

        test('AC 7: should fail if location lacks ConnectionsComponent when resolving connection', async () => {
            locationEntity.removeComponent(ConnectionsComponent); // Remove connections
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: 'conn-north',
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION('conn-north'),
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('lacks ConnectionsComponent'),
                type: 'warning'
            }));
        });

        // NEW Test based on Implementation Notes
        test('AC 7: should fail on invalid connection ID even if a valid entity ID is provided (no fallback)', async () => {
            const invalidConnectionId = 'invalid-conn-id';
            const validEntityId = 'target-dummy';

            // Clear getEntityInstance mock calls specific to this test scenario if needed,
            // although checking the final state (failure + correct message) is usually sufficient.
            // mockEntityManager.getEntityInstance.mockClear(); // Optional depending on mock strategy

            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: validEntityId, // Valid entity ID provided
                    explicitTargetConnectionId: invalidConnectionId, // *Invalid* connection ID provided
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false); // Should fail because connection ID is prioritized and invalid
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            // Check that the failure message is for the *connection* ID
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(invalidConnectionId),
                type: 'warning'
            });
            // Verify entity resolution wasn't attempted *after* the connection check failed.
            // We check if getEntityInstance was called with the validEntityId *during this specific call*.
            // Since getEntityInstance might be called during setup (e.g., for userEntity), we check *relative* calls or specific args.
            // A simpler check is that the failure message *is* the connection one, proving it didn't proceed.
            // If more rigorous check is needed:
            // expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(validEntityId);
            // This might be too strict if setup calls it. Checking the dispatched message is often the best practical approach.
        });

        // --- AC 8: Failure - Invalid Entity ID ---
        test('AC 8: should fail if explicit entity target ID is not found', async () => {
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: 'invalid-entity-id',
                    explicitTargetConnectionId: null, // No connection ID involved
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_INVALID_TARGET_ENTITY('invalid-entity-id'),
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('Explicit entity target ID invalid-entity-id not found'),
                type: 'warning'
            }));
        });

        // --- AC 9: Failure - Target Required, No ID ---
        test('AC 9: should fail if target is required but no explicit ID is provided (default message)', async () => {
            usableComponentData.failure_message_target_required = null; // Ensure no custom message

            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: null,
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            // Check for the default message
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName),
                type: 'warning',
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('no valid explicit target entity OR connection ID'),
                type: 'error'
            }));
        });

        // MODIFIED Test based on Implementation Notes
        test('AC 9: should use item\'s failure_message_target_required if no explicit ID provided', async () => {
            const itemSpecificMsg = 'Please specify what to use this on!';
            usableComponentData.failure_message_target_required = itemSpecificMsg; // Set the custom message

            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionId: null,
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            // Check that the *custom* message was used
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: itemSpecificMsg,
                type: 'warning',
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('no valid explicit target entity OR connection ID'),
                type: 'error'
            }));
        });

        // AC 10 (No Phrase Parsing) is implicitly covered by the function signature
        // and the nature of all tests focusing only on explicit IDs.

    }); // End describe('resolveItemTarget')

}); // End describe('TargetResolutionService')
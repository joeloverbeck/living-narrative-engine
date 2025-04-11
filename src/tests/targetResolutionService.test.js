// src/tests/targetResolutionService.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {
    TargetResolutionService,
} from '../services/targetResolutionService.js';
import Entity from '../entities/entity.js'; // Assuming Entity is default export
import {NameComponent} from '../components/nameComponent.js';
import {HealthComponent} from '../components/healthComponent.js'; // Assuming exists
import {PositionComponent} from '../components/positionComponent.js';
import {ConnectionsComponent} from '../components/connectionsComponent.js'; // Import ConnectionComponent
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';

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
        let userEntity;
        let usableComponentData;
        let itemName;
        let targetEntity;
        let targetConnection;
        let locationEntity;

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
                failure_message_default: null,
                // Add other usable component fields if needed for conditions
            };

            // Setup location connections
            targetConnection = {
                connectionId: 'conn-north',
                direction: 'north',
                targetLocationId: 'loc-2',
                name: 'stone doorway',
                locked: false,
            };
            const connectionsComp = new ConnectionsComponent();
            connectionsComp.addConnection(targetConnection);
            locationEntity.addComponent(connectionsComp);
        });

        test('should succeed with null target if target is not required', async () => {
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

        // --- Explicit Connection Tests ---
        test('should resolve explicit connection target successfully (no conditions)', async () => {
            usableComponentData.target_conditions = []; // No conditions
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
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(result.messages).toContainEqual(expect.objectContaining({text: expect.stringContaining('Found potential explicit target: CONNECTION stone doorway')}));
        });

        test('should resolve explicit connection target successfully (conditions pass)', async () => {
            usableComponentData.target_conditions = [{type: 'IS_UNLOCKED'}]; // Example condition
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: true,
                messages: [],
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
            expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                targetConnection,
                expect.objectContaining({
                    userEntity,
                    targetConnectionContext: targetConnection,
                    targetEntityContext: null
                }),
                usableComponentData.target_conditions,
                expect.objectContaining({checkType: 'Target'})
            );
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(result.messages).toContainEqual(expect.objectContaining({text: expect.stringContaining('passed validation conditions')}));
        });

        test('should fail if explicit connection target conditions fail', async () => {
            usableComponentData.target_conditions = [{type: 'IS_OPEN'}];
            const failureMsg = 'The doorway must be open.';
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: false,
                messages: [],
                failureMessage: failureMsg
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
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: failureMsg,
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('Target conditions failed'),
                type: 'warning'
            }));
        });

        test('should fail if explicit connection target ID is not found', async () => {
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
                text: 'The connection (invalid-conn-id) you targeted is not valid here.',
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('Explicit connection target ID invalid-conn-id not found'),
                type: 'warning'
            }));
        });

        test('should fail if user lacks PositionComponent when resolving connection', async () => {
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
                text: "The connection (conn-north) you targeted is not valid here.",
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('lacks PositionComponent'),
                type: 'warning'
            }));
        });

        test('should fail if location lacks ConnectionsComponent when resolving connection', async () => {
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
                text: 'The connection (conn-north) you targeted is not valid here.',
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('lacks ConnectionsComponent'),
                type: 'warning'
            }));
        });

        // --- Explicit Entity Tests ---
        test('should resolve explicit entity target successfully (no conditions)', async () => {
            usableComponentData.target_conditions = [];
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
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(result.messages).toContainEqual(expect.objectContaining({text: expect.stringContaining('Found potential explicit target: ENTITY Training Dummy')}));
        });

        test('should resolve explicit entity target successfully (conditions pass)', async () => {
            usableComponentData.target_conditions = [{type: 'HAS_COMPONENT', component: 'HealthComponent'}];
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: true,
                messages: [],
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
            expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                targetEntity,
                expect.objectContaining({userEntity, targetEntityContext: targetEntity, targetConnectionContext: null}),
                usableComponentData.target_conditions,
                expect.objectContaining({checkType: 'Target'})
            );
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(result.messages).toContainEqual(expect.objectContaining({text: expect.stringContaining('passed validation conditions')}));
        });

        test('should fail if explicit entity target conditions fail', async () => {
            usableComponentData.target_conditions = [{type: 'HEALTH_BELOW', value: 3}]; // Dummy's health is 5
            const failureMsg = 'Target needs to be more wounded.';
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: false,
                messages: [],
                failureMessage: failureMsg
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
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: failureMsg,
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('Target conditions failed'),
                type: 'warning'
            }));
        });

        test('should fail if explicit entity target ID is not found', async () => {
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity,
                    usableComponentData,
                    explicitTargetEntityId: 'invalid-entity-id',
                    explicitTargetConnectionId: null,
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: 'The target (invalid-entity-id) you specified is no longer valid.',
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('Explicit entity target ID invalid-entity-id not found'),
                type: 'warning'
            }));
        });

        // --- No/Invalid ID Tests ---
        test('should fail if target is required but no explicit ID is provided', async () => {
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
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName),
                type: 'warning',
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining('no valid explicit target entity OR connection ID'),
                type: 'error'
            }));
        });

        test('should use default failure message if no explicit ID provided', async () => {
            usableComponentData.failure_message_default = 'You must choose something specific!';
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
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: 'What do you want to use the Healing Potion on?',
                type: 'warning',
            });
        });

        // --- Fallback Messages ---
        test('should use fallback condition failure message if service provides none', async () => {
            usableComponentData.target_conditions = [{type: 'SOME_FAILING_CONDITION'}];
            // Mock condition service returning success:false but no specific failureMessage
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: false,
                messages: [],
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

            expect(result.success).toBe(false);
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                // Uses fallback based on itemName
                text: TARGET_MESSAGES.USE_INVALID_TARGET(itemName),
                type: 'warning',
            });
        });

        test('should use default failure message as condition fallback if provided', async () => {
            usableComponentData.target_conditions = [{type: 'SOME_FAILING_CONDITION'}];
            usableComponentData.failure_message_default = 'That target just won\'t work.';
            // Mock condition service returning success:false but no specific failureMessage
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                success: false,
                messages: [],
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

            expect(result.success).toBe(false);
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: "You can't use the Healing Potion on that.", // Uses the specific default message
                type: 'warning',
            });
        });

    }); // End describe('resolveItemTarget')

}); // End describe('TargetResolutionService')




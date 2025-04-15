// src/tests/services/itemTargetResolver.test.js

import {beforeEach, afterEach, describe, expect, jest, test} from '@jest/globals';

// --- System Under Test ---
import {ItemTargetResolverService} from '../../services/itemTargetResolver.js'; // Import the new service

// --- Dependencies & Mocks ---
import Entity from '../../entities/entity.js'; // Assuming Entity is default export
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {TARGET_MESSAGES} from '../../utils/messages.js';

// --- Type Imports (Ensure paths are correct if needed, primarily for JSDoc/clarity) ---
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */


// --- Mocks ---
const mockEventBusDispatch = jest.fn();
const mockEntityManager = {
    entities: new Map(),
    getEntityInstance: jest.fn((entityId) => {
        // console.log(`--- DEBUG MOCK (ItemTargetResolver): getEntityInstance called with ID: ${entityId}`); // Optional debug
        return mockEntityManager.entities.get(entityId);
    }),
    // Mock other EntityManager methods if ItemTargetResolverService starts using them
};
const mockConditionEvaluationService = {
    evaluateConditions: jest.fn(),
};
const mockEventBus = { // Need the whole object to pass to constructor
    dispatch: mockEventBusDispatch,
    // Mock other EventBus methods if needed
};

// --- Mock Entities (Declare variables) ---
let mockUserEntity;
let mockLocationEntity;
let mockTargetEntity; // For entity target tests
let mockConnectionEntity; // For connection target tests

// --- Helper Functions (Copied from targetResolutionService.test.js) ---
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity);
    return entity;
};

const setupLocationConnections = (locationEntity, connectionsArray = []) => { // Renamed input param for clarity
    let connectionsComp = locationEntity.getComponent(ConnectionsComponent);

    // Convert the input array into the object format expected by the constructor
    const connectionsObjectMap = connectionsArray.reduce((acc, conn) => {
        if (conn && conn.direction && conn.connectionEntityId) {
            // Use the original direction as the key and the ID as the value
            acc[conn.direction] = conn.connectionEntityId;
        }
        return acc;
    }, {});


    if (!connectionsComp) {
        // Pass the correctly formatted object map to the constructor
        connectionsComp = new ConnectionsComponent({connections: connectionsObjectMap}); // Pass the object map
        locationEntity.addComponent(connectionsComp);
    } else {
        // If the component already exists, you might want to clear and re-add
        // using the addConnection method (assuming it works correctly with the object map structure internally)
        // OR simply replace the component instance if easier for testing:
        connectionsComp = new ConnectionsComponent({connections: connectionsObjectMap}); // Recreate with new data
        locationEntity.addComponent(connectionsComp); // This will overwrite the old one in the mock Entity


        /*
        // --- Alternative if you want to use addConnection ---
        connectionsComp.clearConnections(); // Assuming a method to clear exists
        connectionsArray.forEach(conn => {
            // Ensure the method exists and adapt if needed based on ConnectionsComponent implementation
            if (typeof connectionsComp.addConnection === 'function') {
                // Pass direction and ID to addConnection
                connectionsComp.addConnection(conn.direction, conn.connectionEntityId);
                // Pass other properties if addConnection accepts them
                // connectionsComp.addConnection(conn.direction, conn.connectionEntityId, conn.type, conn.initial_state, conn.name, conn.description_override);
            } else {
                 console.warn("ConnectionsComponent mock or real implementation missing addConnection method");
            }
        });
        */
    }
    mockEntityManager.entities.set(locationEntity.id, locationEntity); // Ensure map is updated
};


const placeInLocation = (entity, locationId) => {
    let posComp = entity.getComponent(PositionComponent);
    if (!posComp) {
        posComp = new PositionComponent({locationId: locationId});
        entity.addComponent(posComp);
    } else {
        // Assuming setLocation exists, otherwise update property directly
        if (typeof posComp.setLocation === 'function') {
            posComp.setLocation(locationId);
        } else {
            posComp.locationId = locationId; // Direct update if no setter
        }
    }
    mockEntityManager.entities.set(entity.id, entity); // Ensure map is updated
};
// --- End Helper Functions ---

// ========================================================================
// == Tests for ItemTargetResolverService =================================
// ========================================================================
describe('ItemTargetResolverService', () => {

    let serviceInstance; // To hold the instance of the service under test

    // --- Global Setup for ItemTargetResolverService tests ---
    beforeEach(() => {
        // Clear mocks before each test
        jest.clearAllMocks();
        mockEntityManager.entities.clear();
        // Reset default mock behaviors
        mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
            success: true, // Default to success for conditions unless overridden in a test
            messages: [],
            failureMessage: null
        });

        // *** Instantiate the service under test with mocks ***
        serviceInstance = new ItemTargetResolverService({
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            conditionEvaluationService: mockConditionEvaluationService,
        });

        // Basic setup: User and their location (added to map via createMockEntity)
        mockUserEntity = createMockEntity('user-player', 'Player');
        mockLocationEntity = createMockEntity('loc-current', 'Current Room');

        // Reset other potential test entities to null (they will be created within tests)
        mockTargetEntity = null;
        mockConnectionEntity = null;
    });

    // --- Test Suite for the resolveItemTarget method ---
    describe('resolveItemTarget', () => {

        // Shared variables for resolveItemTarget tests
        let usableComponentData;
        let itemName;

        beforeEach(() => { // Inner beforeEach for method-specific setup
            itemName = 'Magic Key';
            usableComponentData = {
                target_required: true,
                target_conditions: [], // Default to no conditions unless set by test
                failure_message_target_required: null,
                failure_message_invalid_target: null,
                // Define other UsableComponentData properties as needed per test
            };
        });

        // --- Scenario 1: Prioritization Test (CONN-5.2.6.1 Focus) ---
        test('CONN-5.2.6.1: should prioritize explicit connection entity ID over entity ID when both are valid', async () => {
            // Arrange
            mockTargetEntity = createMockEntity('target-chest-1', 'Wooden Chest');
            mockConnectionEntity = createMockEntity('conn-test-door', 'Test Door prioritize');
            placeInLocation(mockUserEntity, mockLocationEntity.id);
            const connectionMapping = {direction: 'north', connectionEntityId: mockConnectionEntity.id};
            setupLocationConnections(mockLocationEntity, [connectionMapping]);
            usableComponentData.target_required = true;

            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId: mockTargetEntity.id, // Provide both
                explicitTargetConnectionEntityId: mockConnectionEntity.id, // << Priority target
                itemName
            };

            // Act: Call the function ON THE INSTANCE
            const result = await serviceInstance.resolveItemTarget(params);

            // Assert
            expect(result.success).toBe(true);
            expect(result.target).toBe(mockConnectionEntity); // Should resolve to the connection entity
            expect(result.targetType).toBe('connection');
            // Check mocks: connection and location fetched for validation
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id);
            // *Entity* target should NOT have been fetched due to prioritization
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockTargetEntity.id);
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled(); // No conditions in this setup
            expect(mockEventBusDispatch).not.toHaveBeenCalled(); // No errors/messages expected
        });

        // --- Scenario 2: Connection Fetch Failure (CONN-5.2.6.2 Focus) ---
        test('CONN-5.2.6.2: should fail correctly when explicit connection entity cannot be fetched', async () => {
            // Arrange
            placeInLocation(mockUserEntity, mockLocationEntity.id); // User placed, but irrelevant as fetch fails first
            const failedId = 'conn-nonexistent-id-123';
            usableComponentData.target_required = true;
            const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(failedId);

            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId: null,
                explicitTargetConnectionEntityId: failedId, // << Non-existent ID
                itemName
            };

            // Act: Call the function ON THE INSTANCE
            const result = await serviceInstance.resolveItemTarget(params);

            // Assert
            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(failedId); // Verify fetch attempt
            expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: expectedFailureMessage,
                type: 'warning'
            });
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
        });

        // --- Scenario 3: User Validation Failures (CONN-5.2.6.3 Focus) ---
        describe('CONN-5.2.6.3: User-Side Validation Failures', () => {
            test('(a): should fail if user entity lacks PositionComponent', async () => {
                // Arrange
                // User created in outer beforeEach *without* PositionComponent by default
                // mockUserEntity = createMockEntity('user-player', 'Player'); // No PositionComponent added yet
                expect(mockUserEntity.hasComponent(PositionComponent)).toBe(false); // Verify precondition

                mockConnectionEntity = createMockEntity('conn-test-door-user-fail-a', 'Test Door User Fail A');
                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id;
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                const params = {
                    userEntity: mockUserEntity, // << User lacks PositionComponent
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: explicitConnectionId,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                // Should fetch connection, but fail before fetching location
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId);
                expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockLocationEntity.id); // Location not fetched
            });

            test('(b): should fail if user PositionComponent has null locationId', async () => {
                // Arrange
                // Add PositionComponent but with null location
                mockUserEntity.addComponent(new PositionComponent({locationId: null}));
                mockEntityManager.entities.set(mockUserEntity.id, mockUserEntity); // Ensure map is updated
                expect(mockUserEntity.getComponent(PositionComponent)?.locationId).toBeNull(); // Verify precondition

                mockConnectionEntity = createMockEntity('conn-test-door-user-fail-b', 'Test Door User Fail B');
                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id;
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                const params = {
                    userEntity: mockUserEntity, // << User has PositionComponent with null locationId
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: explicitConnectionId,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                // Should fetch connection, but fail before fetching location
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId);
                expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockLocationEntity.id);
            });
        }); // End describe CONN-5.2.6.3

        // --- Scenario 4: Location Validation Failures (CONN-5.2.6.4 Focus) ---
        describe('CONN-5.2.6.4: Location-Side Validation Failures', () => {
            test('(a): should fail if user location entity cannot be fetched', async () => {
                // Arrange
                mockConnectionEntity = createMockEntity('conn-test-door-loc-fail-a', 'Test Door Loc Fail A');
                const nonExistentLocationId = 'loc-non-existent';
                placeInLocation(mockUserEntity, nonExistentLocationId); // Place user in a location that won't be found
                expect(mockEntityManager.entities.get(nonExistentLocationId)).toBeUndefined(); // Verify location isn't in map

                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id;
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                const params = {
                    userEntity: mockUserEntity, // << User's locationId points to non-existent entity
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: explicitConnectionId,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                // Verify mock calls
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId); // Fetched connection
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(nonExistentLocationId); // Attempted location fetch (failed)
            });

            test('(b): should fail if user location entity lacks ConnectionsComponent', async () => {
                // Arrange
                mockConnectionEntity = createMockEntity('conn-test-door-loc-fail-b', 'Test Door Loc Fail B');
                placeInLocation(mockUserEntity, mockLocationEntity.id); // Place user in valid location...
                // ...but ensure location LACKS ConnectionsComponent (it does by default from outer beforeEach)
                expect(mockLocationEntity.hasComponent(ConnectionsComponent)).toBe(false); // Verify precondition
                expect(mockEntityManager.entities.get(mockLocationEntity.id)).toBe(mockLocationEntity); // Location itself is fetchable

                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id;
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: explicitConnectionId,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId); // Fetched connection
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Fetched location
            });

            test('(c): should fail if target connection is not listed as an exit in location ConnectionsComponent', async () => {
                // Arrange
                mockConnectionEntity = createMockEntity('conn-target-door-loc-fail-c', 'Target Door Loc Fail C'); // The one we are TARGETING
                const otherConnection = createMockEntity('conn-other-exit', 'Other Exit'); // A *different* connection

                placeInLocation(mockUserEntity, mockLocationEntity.id); // User in valid location
                // Setup location with ConnectionsComponent, but ONLY listing the OTHER connection
                setupLocationConnections(mockLocationEntity, [
                    {direction: 'south', connectionEntityId: otherConnection.id} // << Target connection NOT here
                ]);
                expect(mockLocationEntity.hasComponent(ConnectionsComponent)).toBe(true); // Component exists
                expect(mockEntityManager.entities.get(mockLocationEntity.id)).toBe(mockLocationEntity); // Location fetchable

                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id; // << Target the connection NOT listed as an exit
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: explicitConnectionId,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                // Verify mock calls
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId); // Fetched connection
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Fetched location
            });
        }); // End describe CONN-5.2.6.4

        // --- Scenario 5: Success No Conditions (CONN-5.2.6.5) ---
        test('CONN-5.2.6.5: should succeed when connection target is valid and has no conditions', async () => {
            // Arrange
            mockConnectionEntity = createMockEntity('conn-test-door-success-no-cond', 'Success Door No Cond');
            placeInLocation(mockUserEntity, mockLocationEntity.id);
            const connectionMapping = {direction: 'north', connectionEntityId: mockConnectionEntity.id};
            setupLocationConnections(mockLocationEntity, [connectionMapping]); // Setup connection as valid exit

            usableComponentData.target_required = true;
            usableComponentData.target_conditions = []; // Explicitly empty

            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId: null,
                explicitTargetConnectionEntityId: mockConnectionEntity.id,
                itemName
            };

            // Act: Call the function ON THE INSTANCE
            const result = await serviceInstance.resolveItemTarget(params);

            // Assert
            expect(result.success).toBe(true);
            expect(result.target).toBe(mockConnectionEntity);
            expect(result.targetType).toBe('connection');
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled(); // No conditions to evaluate
            expect(mockEventBusDispatch).not.toHaveBeenCalled(); // No errors
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Location fetch for validation
        });

        // --- Scenario 6: Connection Target Condition Evaluation (CONN-5.3.2 Focus) ---
        describe('CONN-5.3.2: Connection Target Condition Evaluation', () => {
            const connectionDirection = 'east'; // Consistent direction for tests

            beforeEach(() => {
                // Setup common entities and connection for this block
                mockConnectionEntity = createMockEntity('conn-test-door-cond', 'Success Door Cond');
                placeInLocation(mockUserEntity, mockLocationEntity.id);
                const connectionMapping = {direction: connectionDirection, connectionEntityId: mockConnectionEntity.id};
                setupLocationConnections(mockLocationEntity, [connectionMapping]);
                usableComponentData.target_required = true;
                usableComponentData.target_conditions = [{type: 'TEST_CONDITION', value: true}]; // Example condition array
            });

            test('AC1: should succeed and call evaluateConditions correctly when conditions pass', async () => {
                // Arrange
                // mockConditionEvaluationService defaults to success from outer beforeEach

                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: mockConnectionEntity.id,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1);
                // AC1: Verify evaluateConditions call parameters
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                    mockConnectionEntity, // Subject: Connection entity
                    expect.objectContaining({ // Context: Check key parts
                        userEntity: mockUserEntity,
                        targetEntityContext: null, // << MUST be null for connection target
                        targetConnectionContext: expect.objectContaining({ // << MUST be populated
                            connectionEntity: mockConnectionEntity,
                            direction: connectionDirection // << Direction included
                        })
                    }),
                    usableComponentData.target_conditions, // Conditions array
                    expect.any(Object) // Options object
                );
                // AC1: Verify successful result
                expect(result.success).toBe(true);
                expect(result.target).toBe(mockConnectionEntity);
                expect(result.targetType).toBe('connection');
                expect(mockEventBusDispatch).not.toHaveBeenCalled(); // No failure messages
                // Verify validation calls happened before conditions
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id);
            });

            test('AC2: should fail and use specific message when conditions fail', async () => {
                // Arrange
                const conditionFailureMsg = 'Specific Condition Fail Message';
                mockConditionEvaluationService.evaluateConditions.mockResolvedValue({ // Override default
                    success: false,
                    messages: [{text: 'Condition failed!', type: 'internal'}],
                    failureMessage: conditionFailureMsg // << Specific message from evaluation
                });

                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: mockConnectionEntity.id,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1);
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                    mockConnectionEntity, // Subject: Connection entity
                    expect.objectContaining({targetConnectionContext: expect.anything()}), // Basic context check
                    usableComponentData.target_conditions,
                    expect.any(Object)
                );
                // AC2: Verify failure result
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                // AC2: Verify event bus dispatch with the *specific* failure message
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: conditionFailureMsg, // << Should match mocked result
                    type: 'warning'
                });
            });

            test('AC2: should fail and use item fallback message when conditions fail without specific message', async () => {
                // Arrange
                const itemFallbackMsg = 'Item Fallback: Cannot use key here.';
                usableComponentData.failure_message_invalid_target = itemFallbackMsg; // << Set item fallback
                mockConditionEvaluationService.evaluateConditions.mockResolvedValue({ // Override default
                    success: false,
                    messages: [],
                    failureMessage: null // << NO specific message from evaluation
                });

                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData, // Includes fallback
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: mockConnectionEntity.id,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1);
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                // AC2: Verify event bus dispatch with the *item's fallback* message
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: itemFallbackMsg, // << Should match item fallback
                    type: 'warning'
                });
            });

            test('AC2: should fail and use global fallback message when conditions fail without specific or item message', async () => {
                // Arrange
                usableComponentData.failure_message_invalid_target = null; // << Ensure NO item fallback
                mockConditionEvaluationService.evaluateConditions.mockResolvedValue({ // Override default
                    success: false,
                    messages: [],
                    failureMessage: null // << NO specific message
                });
                const globalFallbackMsg = TARGET_MESSAGES.USE_INVALID_TARGET(itemName); // Calculate expected global message

                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData, // No item fallback
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: mockConnectionEntity.id,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1);
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                // AC2: Verify event bus dispatch with the *global fallback* message
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: globalFallbackMsg, // << Should match global fallback
                    type: 'warning'
                });
            });
        }); // End describe CONN-5.3.2 (Connection Conditions)

        // --- Scenario 7: Entity Target Resolution and Conditions ---
        describe('Entity Target Resolution and Conditions', () => {
            beforeEach(() => {
                // Setup common entity target for this block
                mockTargetEntity = createMockEntity('target-chest-entity', 'Target Chest');
                placeInLocation(mockUserEntity, mockLocationEntity.id); // User position usually irrelevant for entity target validation itself
                usableComponentData.target_required = true;
                // Use different conditions maybe?
                usableComponentData.target_conditions = [{type: 'ENTITY_CONDITION', value: true}];
            });

            test('should succeed resolving a valid entity target when no connection ID is provided', async () => {
                // Arrange
                // Conditions mock defaults to success
                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: mockTargetEntity.id, // << Target the entity
                    explicitTargetConnectionEntityId: null, // << NO connection ID
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(result.success).toBe(true);
                expect(result.target).toBe(mockTargetEntity); // Should resolve to the entity
                expect(result.targetType).toBe('entity');
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockTargetEntity.id); // Entity was fetched
                expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockLocationEntity.id); // Location NOT fetched (not needed for entity target validation)
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1); // Conditions were checked
                // Verify context for entity condition check
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                    mockTargetEntity, // Subject: Entity target
                    expect.objectContaining({ // Context: Check key parts
                        userEntity: mockUserEntity,
                        targetEntityContext: mockTargetEntity, // << MUST be populated
                        targetConnectionContext: null // << MUST be null
                    }),
                    usableComponentData.target_conditions,
                    expect.any(Object)
                );
                expect(mockEventBusDispatch).not.toHaveBeenCalled();
            });

            test('should fail if entity target ID is provided but entity cannot be fetched', async () => {
                // Arrange
                const failedEntityId = 'entity-non-existent';
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_ENTITY(failedEntityId);
                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: failedEntityId, // << Non-existent entity ID
                    explicitTargetConnectionEntityId: null,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(failedEntityId); // Attempted fetch
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            });

            test('should fail if entity target conditions fail', async () => {
                // Arrange
                const conditionFailureMsg = 'Entity Condition Failed Message';
                mockConditionEvaluationService.evaluateConditions.mockResolvedValue({ // Override default
                    success: false,
                    messages: [],
                    failureMessage: conditionFailureMsg // << Specific message
                });
                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData, // has target_conditions from beforeEach
                    explicitTargetEntityId: mockTargetEntity.id, // << Valid entity target
                    explicitTargetConnectionEntityId: null,
                    itemName
                };

                // Act: Call the function ON THE INSTANCE
                const result = await serviceInstance.resolveItemTarget(params);

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockTargetEntity.id); // Entity was fetched
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1); // Conditions were checked
                // Verify context for entity condition check
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                    mockTargetEntity,
                    expect.objectContaining({targetEntityContext: mockTargetEntity, targetConnectionContext: null}),
                    usableComponentData.target_conditions,
                    expect.any(Object)
                );
                // Verify correct message dispatched
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: conditionFailureMsg,
                    type: 'warning'
                });
            });
            // Add tests for entity condition failure fallbacks (item > global) if desired, mirroring connection tests
        }); // End describe (Entity Target)


        // --- Scenario 8: Target Not Required ---
        test('should succeed with null target if target is not required', async () => {
            // Arrange
            usableComponentData.target_required = false; // << Key change
            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId: 'should-be-ignored', // Provide IDs to ensure they are ignored
                explicitTargetConnectionEntityId: 'should-also-be-ignored',
                itemName
            };

            // Act: Call the function ON THE INSTANCE
            const result = await serviceInstance.resolveItemTarget(params);

            // Assert
            expect(result.success).toBe(true);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // No fetches needed
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled(); // No conditions checked
            expect(mockEventBusDispatch).not.toHaveBeenCalled(); // No messages expected
        });

        // --- Scenario 9: Target Required but No IDs Provided ---
        test('should fail if target required and no IDs are provided', async () => {
            // Arrange
            usableComponentData.target_required = true;
            const expectedFailureMessage = usableComponentData.failure_message_target_required || TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName);
            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId: null, // << No ID
                explicitTargetConnectionEntityId: null, // << No ID
                itemName
            };

            // Act: Call the function ON THE INSTANCE
            const result = await serviceInstance.resolveItemTarget(params);

            // Assert
            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // No fetches attempted
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled(); // No conditions checked
            expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: expectedFailureMessage,
                type: 'warning'
            });
        });

        // --- Scenario 10: Target Required, Connection ID invalid, falls back to valid Entity ID ---
        test('should succeed with entity target if connection ID is invalid but entity ID is valid', async () => {
            // Arrange
            const invalidConnectionId = 'conn-invalid-fallback';
            mockTargetEntity = createMockEntity('target-chest-fallback', 'Fallback Chest'); // Valid entity
            placeInLocation(mockUserEntity, mockLocationEntity.id); // User location setup needed for connection *attempt*
            // NO setupLocationConnections needed as the connection fetch itself will fail

            usableComponentData.target_required = true;
            usableComponentData.target_conditions = []; // No conditions for simplicity

            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId: mockTargetEntity.id, // << Valid fallback
                explicitTargetConnectionEntityId: invalidConnectionId, // << Invalid priority target
                itemName
            };

            // Act: Call the function ON THE INSTANCE
            const result = await serviceInstance.resolveItemTarget(params);

            // Assert
            expect(result.success).toBe(true); // Should succeed with the entity
            expect(result.target).toBe(mockTargetEntity);
            expect(result.targetType).toBe('entity');
            // Verify mock calls
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(invalidConnectionId); // Attempted connection fetch (failed)
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockTargetEntity.id); // Successful entity fetch
            // Should NOT have dispatched the "invalid connection" message, as it fell back successfully
            // Should NOT have dispatched the "invalid entity" message either.
            expect(mockEventBusDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(invalidConnectionId)}));
            expect(mockEventBusDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({text: TARGET_MESSAGES.USE_INVALID_TARGET_ENTITY(mockTargetEntity.id)}));
            // Should not have dispatched the "target required" message
            expect(mockEventBusDispatch).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({text: TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName)}));
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled(); // No conditions in this test setup
        });


    }); // End describe('resolveItemTarget')

}); // End describe('ItemTargetResolverService')
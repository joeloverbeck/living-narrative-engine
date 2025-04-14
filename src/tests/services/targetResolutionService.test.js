// src/tests/services/targetResolutionService.test.js

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
    TargetResolutionService,
    // Import other exported functions if needed for other tests later
} from '../../services/targetResolutionService.js';
import Entity from '../../entities/entity.js'; // Assuming Entity is default export
import { NameComponent } from '../../components/nameComponent.js';
import { PositionComponent } from '../../components/positionComponent.js';
import { ConnectionsComponent } from '../../components/connectionsComponent.js'; // Import ConnectionsComponent
// Import other components as needed for different test scenarios
// import { HealthComponent } from '../../components/healthComponent.js';

// Import helpers/types used in the service
import { TARGET_MESSAGES, getDisplayName } from '../../utils/messages.js';
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */
/** @typedef {import('../../components/connectionsComponent.js').ConnectionMapping} ConnectionMapping */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */

// --- Mocks ---
const mockEventBusDispatch = jest.fn();
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    // getEntitiesInLocation: jest.fn(), // Not strictly needed for resolveItemTarget tests yet
    entities: new Map(), // Store mock entities for getEntityInstance
    // locations: new Map(), // Not strictly needed for resolveItemTarget tests yet
};
const mockConditionEvaluationService = {
    evaluateConditions: jest.fn(),
};

// Mock relevant components or their methods if needed
// jest.mock('../../components/positionComponent.js'); // Example if deep mocking needed
// jest.mock('../../components/connectionsComponent.js');

// --- Mock Entities ---
// These will be setup specifically within tests or beforeEach blocks as needed
let mockUserEntity;
let mockLocationEntity;
let mockTargetEntity; // An entity target example
let mockConnectionEntity; // A connection entity example

// --- Service Dependencies ---
// Structure mirroring what resolveItemTarget expects
const mockDependencies = {
    entityManager: mockEntityManager,
    eventBus: { dispatch: mockEventBusDispatch },
    conditionEvaluationService: mockConditionEvaluationService,
};

// --- Service Instance ---
const targetResolutionService = new TargetResolutionService();

// --- Helper Functions ---
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({ value: name }));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity); // Register with mock manager
    // Mock getEntityInstance for this specific entity
    mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
        // console.log(`DEBUG: mockEntityManager.getEntityInstance called with: ${entityId}`); // Debug logging
        return mockEntityManager.entities.get(entityId);
    });
    return entity;
};

// Helper to set up the location and its connections component for validation steps
const setupLocationConnections = (locationEntity, connections = []) => {
    let connectionsComp = locationEntity.getComponent(ConnectionsComponent);
    if (!connectionsComp) {
        // Use the actual component constructor with mocked data
        connectionsComp = new ConnectionsComponent({ connections: {} }); // Start empty map
        locationEntity.addComponent(connectionsComp);
    } else {
        connectionsComp.clearConnections(); // Clear existing if any
    }

    const connectionMapData = {};
    connections.forEach(conn => {
        // addConnection expects direction and entityId
        connectionsComp.addConnection(conn.direction, conn.connectionEntityId);
        connectionMapData[conn.direction] = conn.connectionEntityId; // For logging/verification
    });
    // console.log(`DEBUG: Setup connections for ${locationEntity.id}:`, connectionMapData); // Debug logging
};

// Helper to place an entity in a location (adds PositionComponent)
const placeInLocation = (entity, locationId) => {
    let posComp = entity.getComponent(PositionComponent);
    if (!posComp) {
        posComp = new PositionComponent({ locationId: locationId });
        entity.addComponent(posComp);
    } else {
        posComp.setLocation(locationId);
    }
    // console.log(`DEBUG: Placed ${entity.id} in location ${locationId}`); // Debug logging
};
// --- End Helper Functions ---


// --- Global Setup ---
beforeEach(() => {
    // Clear mocks
    mockEventBusDispatch.mockClear();
    mockEntityManager.entities.clear();
    // Clear specific mock function calls and reset implementations
    mockEntityManager.getEntityInstance.mockClear().mockImplementation((id) => mockEntityManager.entities.get(id));
    mockConditionEvaluationService.evaluateConditions.mockClear().mockResolvedValue({
        success: true, // Default to success for conditions unless overridden
        messages: [],
        failureMessage: null
    });

    // Basic setup: User and their location (needed for connection validation)
    // Note: User position is explicitly handled in user validation tests
    mockUserEntity = createMockEntity('user-player', 'Player');
    mockLocationEntity = createMockEntity('loc-current', 'Current Room');
    // DO NOT place user by default, specific tests will handle position setup/lack thereof

    // Reset other potential test entities to avoid conflicts
    mockTargetEntity = null;
    mockConnectionEntity = null;
});

// ========================================================================
// == Tests for TargetResolutionService: resolveItemTarget ==============
// ========================================================================
describe('TargetResolutionService', () => { // Parent describe

    describe('resolveItemTarget', () => { // Inner describe

        // Shared variables for resolveItemTarget tests
        let usableComponentData;
        let itemName;

        beforeEach(() => { // Inner beforeEach for method-specific setup
            itemName = 'Magic Key';
            usableComponentData = {
                target_required: true, // Default: target is required
                target_conditions: [], // Default: no conditions
                failure_message_target_required: null,
                failure_message_invalid_target: null,
                // ... other UsableComponentData fields if needed
            };

            // Common setup for connection target tests: create a connection entity
            mockConnectionEntity = createMockEntity('conn-test-door', 'Test Door');
        });

        // --- Scenario 1: Prioritization Test (CONN-5.2.6.1 Focus) ---
        test('CONN-5.2.6.1: should prioritize explicit connection entity ID over entity ID when both are valid', async () => {
            // Arrange
            // Place user in location for this test
            placeInLocation(mockUserEntity, mockLocationEntity.id);

            // 1. Create a valid target entity
            mockTargetEntity = createMockEntity('target-chest-1', 'Wooden Chest');

            // 2. Create a valid connection entity (done in inner beforeEach)

            // 3. Setup the user's location with the connection entity as a valid exit
            const connectionMapping = {
                direction: 'north', // The key used in ConnectionsComponent map
                connectionEntityId: mockConnectionEntity.id // The ID of the connection entity
            };
            setupLocationConnections(mockLocationEntity, [connectionMapping]);

            // 4. Ensure user is in the location
            expect(mockUserEntity.getComponent(PositionComponent).locationId).toBe(mockLocationEntity.id);

            // 5. Set usable data: target required, no conditions
            usableComponentData.target_required = true;
            usableComponentData.target_conditions = []; // Explicitly empty for this test

            // 6. Define the explicit IDs to pass to the function
            const explicitTargetEntityId = mockTargetEntity.id; // Valid entity ID
            const explicitTargetConnectionEntityId = mockConnectionEntity.id; // Valid connection *entity* ID

            // Act: Call the function with both IDs provided
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId,
                    explicitTargetConnectionEntityId, // Pass the connection *entity* ID
                    itemName
                },
                mockDependencies
            );

            // Assert

            // Verify success
            expect(result.success).toBe(true);

            // Verify the returned target is the connection *ENTITY* instance
            expect(result.target).toBe(mockConnectionEntity); // Use toBe for instance check

            // Verify the returned targetType is 'connection'
            expect(result.targetType).toBe('connection');

            // Verify related mock calls (implicitly part of test passing)
            // - Connection entity should have been fetched
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
            // - User's location should have been fetched (for validation)
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id);
            // - The *other* entity target should NOT have been fetched because connection was prioritized
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockTargetEntity.id);
            // - Condition evaluation should NOT have been called (target_conditions was empty)
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            // - No failure messages should have been dispatched
            expect(mockEventBusDispatch).not.toHaveBeenCalled();

            // Check internal messages for confirmation (optional but helpful)
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({ text: `Successfully fetched Connection Entity: ${getDisplayName(mockConnectionEntity)} (${mockConnectionEntity.id})` }),
                expect.objectContaining({ text: `Validation successful. Connection ${mockConnectionEntity.id} is a valid exit.` }),
                expect.objectContaining({ text: `Potential target confirmed as CONNECTION ${getDisplayName(mockConnectionEntity)} (${mockConnectionEntity.id}). Proceeding to condition checks.` }),
                expect.objectContaining({ text: `No target_conditions defined for ${itemName}. Target considered valid.` }),
                expect.objectContaining({ text: `Target resolution successful. Validated Target: connection '${getDisplayName(mockConnectionEntity)}'.` }),
            ]));
        });

        // --- Scenario 2: Connection Fetch Failure (CONN-5.2.6.2 Focus) ---
        test('CONN-5.2.6.2: should fail correctly when explicit connection entity cannot be fetched', async () => {
            // Arrange
            // Place user in location for this test (although it fails before location check)
            placeInLocation(mockUserEntity, mockLocationEntity.id);

            const failedId = 'conn-nonexistent-id-123'; // Use a unique ID unlikely to exist
            usableComponentData.target_required = true; // Target must be required for this failure path
            usableComponentData.target_conditions = []; // Conditions don't matter for this test

            // AC2: Within the test, entityManager.getEntityInstance is mocked to return null
            // when called with the explicitTargetConnectionEntityId.
            mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
                if (entityId === failedId) {
                    return null; // Simulate fetch failure for the specific ID
                }
                // Fallback for other IDs (e.g., user's location if needed, though not reached)
                return mockEntityManager.entities.get(entityId);
            });

            // Expected failure message based on TARGET_MESSAGES
            const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(failedId);

            // Act: Call the function with the connection ID that will fail to fetch
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null, // Ensure entity ID is not provided
                    explicitTargetConnectionEntityId: failedId, // Provide the ID intended to fail
                    itemName
                },
                mockDependencies
            );

            // Assert
            // AC3: Assertions verify the function returns { success: false }.
            expect(result.success).toBe(false);

            // AC4: Assertions verify the returned target is null.
            expect(result.target).toBeNull();

            // AC5: Assertions verify the returned targetType is 'none'.
            expect(result.targetType).toBe('none');

            // Verify the fetch was attempted with the failed ID
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(failedId);

            // AC6: Assertions verify eventBus.dispatch was called exactly once with 'ui:message_display'
            // and payload { text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(failedId), type: 'warning' }.
            expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBusDispatch).toHaveBeenCalledWith(
                'ui:message_display',
                {
                    text: expectedFailureMessage,
                    type: 'warning'
                }
            );

            // AC7: Test passes successfully (implicit if all above asserts pass).
        });


        // --- Scenario 3: User Validation Failures (CONN-5.2.6.3 Focus) ---
        describe('CONN-5.2.6.3: User-Side Validation Failures', () => {
            test('(a): should fail if user entity lacks PositionComponent', async () => {
                // Arrange
                expect(mockUserEntity.getComponent(PositionComponent)).toBeNull(); // Verify precondition
                mockEntityManager.entities.set(mockConnectionEntity.id, mockConnectionEntity); // Connection is fetchable
                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id;
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                // Act
                const result = await targetResolutionService.resolveItemTarget(
                    {
                        userEntity: mockUserEntity,
                        usableComponentData,
                        explicitTargetEntityId: null,
                        explicitTargetConnectionEntityId: explicitConnectionId,
                        itemName
                    },
                    mockDependencies
                );

                // Assert (AC2 & AC4 combined)
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith(
                    'ui:message_display',
                    { text: expectedFailureMessage, type: 'warning' }
                );
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId);
                expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockLocationEntity.id);
                expect(result.messages).toEqual(expect.arrayContaining([
                    expect.objectContaining({ text: "CONN-5.2.4 Failure: User missing PositionComponent.", type: 'error' }),
                ]));
            });

            test('(b): should fail if user PositionComponent has null locationId', async () => {
                // Arrange
                mockUserEntity.addComponent(new PositionComponent({ locationId: null }));
                expect(mockUserEntity.getComponent(PositionComponent)?.locationId).toBeNull(); // Verify precondition
                mockEntityManager.entities.set(mockConnectionEntity.id, mockConnectionEntity); // Connection is fetchable
                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id;
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                // Act
                const result = await targetResolutionService.resolveItemTarget(
                    {
                        userEntity: mockUserEntity,
                        usableComponentData,
                        explicitTargetEntityId: null,
                        explicitTargetConnectionEntityId: explicitConnectionId,
                        itemName
                    },
                    mockDependencies
                );

                // Assert (AC4 & AC4 combined)
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith(
                    'ui:message_display',
                    { text: expectedFailureMessage, type: 'warning' }
                );
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId);
                expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockLocationEntity.id);
                expect(result.messages).toEqual(expect.arrayContaining([
                    expect.objectContaining({ text: "CONN-5.2.4 Failure: User PositionComponent missing locationId.", type: 'error' }),
                ]));
            });
        }); // End describe CONN-5.2.6.3

        // --- START: Scenario 4: Location Validation Failures (CONN-5.2.6.4 Focus) ---
        describe('CONN-5.2.6.4: Location-Side Validation Failures', () => {

            // AC1: A test case exists for location fetch failure.
            test('(a): should fail if user location entity cannot be fetched', async () => {
                // Arrange
                // Mocks configured for successful connection fetch, user pos valid.
                mockEntityManager.entities.set(mockConnectionEntity.id, mockConnectionEntity); // Connection is fetchable
                placeInLocation(mockUserEntity, mockLocationEntity.id); // User position is valid
                expect(mockUserEntity.getComponent(PositionComponent)?.locationId).toBe(mockLocationEntity.id);

                // entityManager.getEntityInstance returns null for userLocationId.
                mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
                    if (entityId === mockConnectionEntity.id) {
                        return mockConnectionEntity; // Success for connection
                    }
                    if (entityId === mockLocationEntity.id) {
                        return null; // Simulate location fetch failure
                    }
                    return mockEntityManager.entities.get(entityId); // Fallback for other potential calls
                });

                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id;
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                // Act
                const result = await targetResolutionService.resolveItemTarget(
                    {
                        userEntity: mockUserEntity,
                        usableComponentData,
                        explicitTargetEntityId: null,
                        explicitTargetConnectionEntityId: explicitConnectionId,
                        itemName
                    },
                    mockDependencies
                );

                // Assert
                // AC1 & AC4: Assertions verify failure (success: false, target: null, targetType: 'none') and dispatch.
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith(
                    'ui:message_display',
                    { text: expectedFailureMessage, type: 'warning' }
                );

                // Verify mock calls
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId); // Attempted connection fetch
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Attempted location fetch

                // Verify internal log message (optional but good)
                expect(result.messages).toEqual(expect.arrayContaining([
                    expect.objectContaining({ text: `CONN-5.2.4 Failure: Could not fetch user location entity: ${mockLocationEntity.id}`, type: 'error' }),
                ]));

                // AC1: Test passes. (Implicit)
            });

            // AC2: A test case exists for missing ConnectionsComponent.
            test('(b): should fail if user location entity lacks ConnectionsComponent', async () => {
                // Arrange
                // Mocks configured for successful connection fetch, user pos/location valid.
                mockEntityManager.entities.set(mockConnectionEntity.id, mockConnectionEntity); // Connection is fetchable
                placeInLocation(mockUserEntity, mockLocationEntity.id); // User position is valid
                // User location entity is created *without* ConnectionsComponent (in global beforeEach)
                expect(mockLocationEntity.getComponent(ConnectionsComponent)).toBeNull(); // Verify precondition
                // mockEntityManager returns both connection and location entities successfully
                mockEntityManager.entities.set(mockLocationEntity.id, mockLocationEntity); // Ensure location is in the map

                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id;
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                // Act
                const result = await targetResolutionService.resolveItemTarget(
                    {
                        userEntity: mockUserEntity,
                        usableComponentData,
                        explicitTargetEntityId: null,
                        explicitTargetConnectionEntityId: explicitConnectionId,
                        itemName
                    },
                    mockDependencies
                );

                // Assert
                // AC2 & AC4: Assertions verify failure (success: false, target: null, targetType: 'none') and dispatch.
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith(
                    'ui:message_display',
                    { text: expectedFailureMessage, type: 'warning' }
                );

                // Verify mock calls
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId); // Attempted connection fetch
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Attempted location fetch

                // Verify internal log message (optional but good)
                expect(result.messages).toEqual(expect.arrayContaining([
                    expect.objectContaining({ text: `CONN-5.2.4 Failure: User location ${mockLocationEntity.id} missing ConnectionsComponent.`, type: 'error' }),
                ]));

                // AC2: Test passes. (Implicit)
            });

            // AC3: A test case exists for 'connection not an exit'.
            test('(c): should fail if target connection is not listed as an exit in location ConnectionsComponent', async () => {
                // Arrange
                // Mocks configured for successful connection fetch, user pos/location/connections component valid.
                mockEntityManager.entities.set(mockConnectionEntity.id, mockConnectionEntity); // Connection is fetchable
                placeInLocation(mockUserEntity, mockLocationEntity.id); // User position is valid
                // Setup location with ConnectionsComponent, but *without* the target connection
                const otherConnection = createMockEntity('conn-other-exit', 'Other Exit');
                setupLocationConnections(mockLocationEntity, [
                    { direction: 'south', connectionEntityId: otherConnection.id } // Only list a different connection
                ]);
                expect(mockLocationEntity.getComponent(ConnectionsComponent)).toBeDefined(); // Verify component exists
                mockEntityManager.entities.set(mockLocationEntity.id, mockLocationEntity); // Ensure location is fetchable

                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id; // Target connection ID *not* in the component
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                // Act
                const result = await targetResolutionService.resolveItemTarget(
                    {
                        userEntity: mockUserEntity,
                        usableComponentData,
                        explicitTargetEntityId: null,
                        explicitTargetConnectionEntityId: explicitConnectionId,
                        itemName
                    },
                    mockDependencies
                );

                // Assert
                // AC3 & AC4: Assertions verify failure (success: false, target: null, targetType: 'none') and dispatch.
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith(
                    'ui:message_display',
                    { text: expectedFailureMessage, type: 'warning' }
                );

                // Verify mock calls
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId); // Attempted connection fetch
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Attempted location fetch

                // Verify internal log message (optional but good)
                expect(result.messages).toEqual(expect.arrayContaining([
                    expect.objectContaining({ text: `CONN-5.2.4 Failure: Connection Entity ${explicitConnectionId} is NOT a valid exit from ${mockLocationEntity.id}.`, type: 'error' }),
                ]));

                // AC3: Test passes. (Implicit)
            });

        }); // End describe CONN-5.2.6.4
        // --- END: Scenario 4 ---

        // ****** NEW TEST CASE FOR CONN-5.2.6.5 ******
        test('CONN-5.2.6.5: should succeed when connection target is valid and has no conditions', async () => {
            // Arrange
            // AC2: Configure mocks for successful fetch and validation
            // - Connection Fetch: mockConnectionEntity exists (from beforeEach) and is in entities map
            // - Validation:
            //   - User Position: Place user in the location
            placeInLocation(mockUserEntity, mockLocationEntity.id);
            //   - Location Fetch: mockLocationEntity exists (from beforeEach) and is in entities map
            //   - Connections Component: Setup location with the connection as a valid exit
            const connectionMapping = { direction: 'north', connectionEntityId: mockConnectionEntity.id };
            setupLocationConnections(mockLocationEntity, [connectionMapping]);

            // AC2: Set usableComponentData.target_conditions to empty array
            usableComponentData.target_required = true; // Ensure target is required for the scenario
            usableComponentData.target_conditions = []; // Explicitly empty array

            // Act: Call the function with the valid connection ID and no entity ID
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: mockConnectionEntity.id,
                    itemName
                },
                mockDependencies
            );

            // Assert
            // AC3: Verify success: true
            expect(result.success).toBe(true);

            // AC4: Verify returned target is the connection entity instance
            expect(result.target).toBe(mockConnectionEntity);

            // AC5: Verify returned targetType is 'connection'
            expect(result.targetType).toBe('connection');

            // AC6: Verify conditionEvaluationService.evaluateConditions was NOT called
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();

            // AC7: Verify no failure messages dispatched
            expect(mockEventBusDispatch).not.toHaveBeenCalled();

            // Additional checks for completeness (verify fetch calls)
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Location fetch for validation

            // AC8: Test passes (implicit if all assertions pass)
            // Optional: Check internal log messages for expected success path
            expect(result.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({ text: `Successfully fetched Connection Entity: ${getDisplayName(mockConnectionEntity)} (${mockConnectionEntity.id})` }),
                expect.objectContaining({ text: `Validation successful. Connection ${mockConnectionEntity.id} is a valid exit.` }),
                expect.objectContaining({ text: `Potential target confirmed as CONNECTION ${getDisplayName(mockConnectionEntity)} (${mockConnectionEntity.id}). Proceeding to condition checks.` }),
                expect.objectContaining({ text: `No target_conditions defined for ${itemName}. Target considered valid.` }),
                expect.objectContaining({ text: `Target resolution successful. Validated Target: connection '${getDisplayName(mockConnectionEntity)}'.` }),
            ]));
        });
        // ****** END NEW TEST CASE FOR CONN-5.2.6.5 ******

        // ****** START: NEW TESTS FOR CONN-5.2.6.6 ******
        describe('CONN-5.2.6.6: Success Path with Conditions (Pass/Fail)', () => {

            const connectionDirection = 'east'; // Define consistently for context check

            beforeEach(() => {
                // Common setup for both pass/fail condition tests:
                // Mocks configured for successful fetch/validation.
                placeInLocation(mockUserEntity, mockLocationEntity.id); // User pos valid
                const connectionMapping = { direction: connectionDirection, connectionEntityId: mockConnectionEntity.id };
                setupLocationConnections(mockLocationEntity, [connectionMapping]); // Connection is valid exit
                // Ensure location entity is fetchable (setupLocationConnections handles this now)
                // mockEntityManager.entities.set(mockLocationEntity.id, mockLocationEntity);

                // usableComponentData.target_conditions is non-empty.
                usableComponentData.target_required = true;
                usableComponentData.target_conditions = [{ type: 'TEST_CONDITION', value: true }]; // Example condition
            });

            // AC1: A test case exists for the scenario where target conditions pass.
            test('(a): should succeed when connection target conditions pass', async () => {
                // Arrange (Specific mock for this test)
                // AC1: evaluateConditions mock returns { success: true, ... }.
                mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                    success: true,
                    messages: [{ text: 'Condition passed!', type: 'internal' }],
                    failureMessage: null
                });

                // Act
                const result = await targetResolutionService.resolveItemTarget(
                    {
                        userEntity: mockUserEntity,
                        usableComponentData,
                        explicitTargetEntityId: null,
                        explicitTargetConnectionEntityId: mockConnectionEntity.id,
                        itemName
                    },
                    mockDependencies
                );

                // Assert
                // AC2: Assertions for AC1 verify evaluateConditions was called once with the correct args
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1);
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                    mockConnectionEntity, // Subject: The connection entity itself
                    expect.objectContaining({ // Context: Check relevant parts
                        userEntity: mockUserEntity,
                        targetEntityContext: null, // Not an entity target
                        targetConnectionContext: expect.objectContaining({ // Target is connection
                            connectionEntity: mockConnectionEntity,
                            direction: connectionDirection // Direction from setup
                        })
                    }),
                    usableComponentData.target_conditions, // Conditions array from input
                    expect.any(Object) // Options object (can be more specific if needed)
                );

                // AC3: Assertions for AC1 verify the overall result is { success: true, target: connectionEntity, targetType: 'connection' }.
                expect(result.success).toBe(true);
                expect(result.target).toBe(mockConnectionEntity);
                expect(result.targetType).toBe('connection');

                // Verify no failure message dispatched
                expect(mockEventBusDispatch).not.toHaveBeenCalled();

                // Verify fetch/validation calls happened
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id);

                // AC3: Test passes. (Implicit if all asserts pass)
                // Optional: Check internal messages
                expect(result.messages).toEqual(expect.arrayContaining([
                    expect.objectContaining({ text: `Target '${getDisplayName(mockConnectionEntity)}' passed validation conditions.` }),
                    expect.objectContaining({ text: `Target resolution successful. Validated Target: connection '${getDisplayName(mockConnectionEntity)}'.` }),
                    expect.objectContaining({ text: 'Condition passed!', type: 'internal' }) // Message from mock
                ]));
            });

            // AC4: A test case exists for the scenario where target conditions fail.
            test('(b): should fail when connection target conditions fail', async () => {
                // Arrange (Specific mock for this test)
                // AC4: evaluateConditions mock returns { success: false, failureMessage: 'Test Fail Reason', ... }.
                const conditionFailureMsg = 'Test Fail Reason';
                mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                    success: false,
                    messages: [{ text: 'Condition failed!', type: 'internal' }],
                    failureMessage: conditionFailureMsg
                });

                // Act
                const result = await targetResolutionService.resolveItemTarget(
                    {
                        userEntity: mockUserEntity,
                        usableComponentData,
                        explicitTargetEntityId: null,
                        explicitTargetConnectionEntityId: mockConnectionEntity.id,
                        itemName
                    },
                    mockDependencies
                );

                // Assert
                // AC5: Assertions for AC4 verify evaluateConditions was called once with the correct arguments (as in AC2).
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1);
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                    mockConnectionEntity, // Subject
                    expect.objectContaining({ // Context
                        userEntity: mockUserEntity,
                        targetEntityContext: null,
                        targetConnectionContext: expect.objectContaining({
                            connectionEntity: mockConnectionEntity,
                            direction: connectionDirection
                        })
                    }),
                    usableComponentData.target_conditions, // Conditions
                    expect.any(Object) // Options
                );

                // AC6: Assertions for AC4 verify the overall result is { success: false, target: null, targetType: 'none' }.
                expect(result.success).toBe(false);
                expect(result.target).toBeNull();
                expect(result.targetType).toBe('none');

                // AC7: Assertions for AC4 verify eventBus.dispatch was called with the failure message ('Test Fail Reason').
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith(
                    'ui:message_display',
                    { text: conditionFailureMsg, type: 'warning' }
                );

                // Verify fetch/validation calls happened before condition check
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id);

                // AC7: Test passes. (Implicit if all asserts pass)
                // Optional: Check internal messages
                expect(result.messages).toEqual(expect.arrayContaining([
                    expect.objectContaining({ text: `Target conditions failed for target '${getDisplayName(mockConnectionEntity)}'.`, type: 'warning' }),
                    expect.objectContaining({ text: 'Condition failed!', type: 'internal' }) // Message from mock
                ]));
            });

        }); // End describe CONN-5.2.6.6
        // ****** END: NEW TESTS FOR CONN-5.2.6.6 ******

        // Example: Test for target not required
        test('should succeed with null target if target is not required', async () => {
            // No need for user position or connection setup here
            usableComponentData.target_required = false;
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: null,
                    itemName
                },
                mockDependencies
            );

            expect(result.success).toBe(true);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
        });

        // Example: Test for connection entity resolution (when entity ID is null and connection validation passes)
        test('should resolve valid explicit connection entity target successfully when user and location are valid', async () => {
            // Arrange
            // Place user in location
            placeInLocation(mockUserEntity, mockLocationEntity.id);
            // Setup the connection as a valid exit
            const connectionMapping = { direction: 'east', connectionEntityId: mockConnectionEntity.id };
            setupLocationConnections(mockLocationEntity, [connectionMapping]);
            usableComponentData.target_required = true;
            usableComponentData.target_conditions = [];

            // Act
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null, // No entity ID
                    explicitTargetConnectionEntityId: mockConnectionEntity.id,
                    itemName
                },
                mockDependencies
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.target).toBe(mockConnectionEntity);
            expect(result.targetType).toBe('connection');
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Location fetch for validation
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
        });

        // Example: Test for entity resolution (when connection ID is null)
        test('should resolve valid explicit entity target successfully', async () => {
            // Arrange
            // No user position needed for pure entity target resolution
            mockTargetEntity = createMockEntity('target-lever-1', 'Rusty Lever');
            usableComponentData.target_required = true;
            usableComponentData.target_conditions = [];

            // Act
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: mockTargetEntity.id,
                    explicitTargetConnectionEntityId: null, // No connection ID
                    itemName
                },
                mockDependencies
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.target).toBe(mockTargetEntity);
            expect(result.targetType).toBe('entity');
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockTargetEntity.id);
            // Connection entity should *not* have been fetched
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(expect.stringContaining('conn-'));
            // Location should *not* have been fetched (not needed for entity target)
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockLocationEntity.id);
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
        });

        // Example: Test for condition failure on connection target
        test('should fail if connection target conditions fail', async () => {
            // Arrange
            // Place user in location
            placeInLocation(mockUserEntity, mockLocationEntity.id);
            // mockConnectionEntity is already created
            const connectionMapping = { direction: 'west', connectionEntityId: mockConnectionEntity.id };
            setupLocationConnections(mockLocationEntity, [connectionMapping]);

            usableComponentData.target_required = true;
            usableComponentData.target_conditions = [{ type: 'SOME_FAILING_CONDITION' }]; // Add a condition
            const failureMsg = 'The door is magically sealed.';
            mockConditionEvaluationService.evaluateConditions.mockResolvedValue({ // Mock condition failure
                success: false,
                messages: [{ text: 'Condition failed: Sealed', type: 'internal' }],
                failureMessage: failureMsg
            });

            // Act
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: mockConnectionEntity.id,
                    itemName
                },
                mockDependencies
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Location fetch for validation
            expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                mockConnectionEntity, // Subject is the connection entity
                expect.objectContaining({ targetConnectionContext: { connectionEntity: mockConnectionEntity, direction: 'west' } }),
                usableComponentData.target_conditions,
                expect.anything() // Options object
            );
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', { text: failureMsg, type: 'warning' });
        });

        // Example: Test for connection validation failure (not a valid exit from *location*)
        // NOTE: This is essentially the same scenario as CONN-5.2.6.4 (c), tested above specifically.
        // Keeping it here for reference/completeness.
        test('CONN-5.2.4 failure: should fail if connection entity is not a valid exit from user location', async () => {
            // Arrange
            // Place user in location
            placeInLocation(mockUserEntity, mockLocationEntity.id);
            // mockConnectionEntity is created, but NOT added to the location's ConnectionsComponent
            setupLocationConnections(mockLocationEntity, []); // No connections configured for the location

            usableComponentData.target_required = true;
            usableComponentData.target_conditions = [];

            // Act
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: mockConnectionEntity.id, // Try to target the unlinked connection
                    itemName
                },
                mockDependencies
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id); // Fetch was attempted
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Location was fetched
            // Condition evaluation should *not* have been called because validation failed first
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            // Check for the specific failure message for invalid connection target
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(mockConnectionEntity.id),
                type: 'warning'
            });
            expect(result.messages).toContainEqual(expect.objectContaining({
                text: expect.stringContaining(`CONN-5.2.4 Failure: Connection Entity ${mockConnectionEntity.id} is NOT a valid exit`),
                type: 'error'
            }));
        });


        // Example: Test for target required but no ID provided
        test('should fail if target required and no IDs are provided', async () => {
            // Arrange
            // No user position needed
            usableComponentData.target_required = true;
            usableComponentData.target_conditions = [];

            // Act
            const result = await targetResolutionService.resolveItemTarget(
                {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null, // No ID
                    explicitTargetConnectionEntityId: null, // No ID
                    itemName
                },
                mockDependencies
            );

            // Assert
            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled(); // No fetch attempts needed
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName),
                type: 'warning'
            });
        });


    }); // End describe('resolveItemTarget')

}); // End describe('TargetResolutionService')
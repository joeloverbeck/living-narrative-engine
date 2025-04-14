// src/tests/services/targetResolutionService.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {
    TargetResolutionService,
    // Import other exported functions if needed for other tests later
} from '../../services/targetResolutionService.js';
import Entity from '../../entities/entity.js'; // Assuming Entity is default export
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js'; // Import ConnectionsComponent
// Import other components as needed for different test scenarios
// import { HealthComponent } from '../../components/healthComponent.js';

// Import helpers/types used in the service
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
/** @typedef {import('../../core/eventBus.js').default} EventBus */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */
/** @typedef {import('../../components/connectionsComponent.js').ConnectionMapping} ConnectionMapping */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */

// --- Mocks ---
const mockEventBusDispatch = jest.fn();

// --- Refined Mock EntityManager Setup ---
const mockEntityManager = {
    entities: new Map(), // Store mock entities here
    // Define the mock function ONCE, referencing the entities map
    getEntityInstance: jest.fn((entityId) => {
        // **** ADDED DEBUG LOGGING ****
        console.log(`--- DEBUG MOCK: getEntityInstance called with ID: ${entityId}`);
        const entity = mockEntityManager.entities.get(entityId);
        console.log(`--- DEBUG MOCK: getEntityInstance returning: ${entity ? entity.id : 'NULL/UNDEFINED'}`);
        // **** END ADDED DEBUG LOGGING ****
        return entity;
    }),
    // getEntitiesInLocation: jest.fn(), // Mock other methods if needed
};
// --- End Refined Mock EntityManager Setup ---

const mockConditionEvaluationService = {
    evaluateConditions: jest.fn(),
};

// Mock relevant components or their methods if needed (keep if necessary)
// jest.mock('../../components/positionComponent.js');
// jest.mock('../../components/connectionsComponent.js');

// --- Mock Entities (Declare variables) ---
let mockUserEntity;
let mockLocationEntity;
let mockTargetEntity; // An entity target example
let mockConnectionEntity; // A connection entity example

// --- Service Dependencies ---
const mockDependencies = {
    entityManager: mockEntityManager,
    eventBus: {dispatch: mockEventBusDispatch},
    conditionEvaluationService: mockConditionEvaluationService,
};

// --- Service Instance ---
const targetResolutionService = new TargetResolutionService();

// --- Helper Functions ---

// --- Modified createMockEntity ---
const createMockEntity = (id, name, components = []) => {
    // console.log(`Creating mock entity: ${id}`); // Optional: Keep if useful
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity); // Register with mock manager's map
    // **** REMOVED the mockImplementation redefinition from here ****
    return entity;
};
// --- End Modified createMockEntity ---

// Helper to set up the location and its connections component for validation steps
const setupLocationConnections = (locationEntity, connections = []) => {
    let connectionsComp = locationEntity.getComponent(ConnectionsComponent);
    if (!connectionsComp) {
        connectionsComp = new ConnectionsComponent({connections: {}});
        locationEntity.addComponent(connectionsComp);
    } else {
        connectionsComp.clearConnections();
    }
    connections.forEach(conn => {
        connectionsComp.addConnection(conn.direction, conn.connectionEntityId);
    });
    // Ensure the potentially modified location entity is updated in the mock map
    // This is important if the component was added/modified after initial creation
    mockEntityManager.entities.set(locationEntity.id, locationEntity);
};

// Helper to place an entity in a location (adds PositionComponent)
const placeInLocation = (entity, locationId) => {
    let posComp = entity.getComponent(PositionComponent);
    if (!posComp) {
        posComp = new PositionComponent({locationId: locationId});
        entity.addComponent(posComp);
    } else {
        posComp.setLocation(locationId);
    }
    // Ensure the potentially modified entity is updated in the mock map
    mockEntityManager.entities.set(entity.id, entity);
};
// --- End Helper Functions ---


// --- Global Setup ---
beforeEach(() => {
    // Clear mocks
    mockEventBusDispatch.mockClear();
    mockEntityManager.entities.clear(); // Clear the map
    // Clear specific mock function calls BUT DO NOT reset the implementation
    mockEntityManager.getEntityInstance.mockClear();
    // mockEntityManager.getEntitiesInLocation?.mockClear(); // Clear others if they exist
    mockConditionEvaluationService.evaluateConditions.mockClear().mockResolvedValue({
        success: true, // Default to success
        messages: [],
        failureMessage: null
    });

    // Basic setup: User and their location (added to map via createMockEntity)
    mockUserEntity = createMockEntity('user-player', 'Player');
    mockLocationEntity = createMockEntity('loc-current', 'Current Room');

    // Reset other potential test entities to null (they will be created within tests)
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
                target_required: true,
                target_conditions: [],
                failure_message_target_required: null,
                failure_message_invalid_target: null,
                // ... other UsableComponentData fields if needed
            };

            // DO NOT create connection entity here - do it inside tests that need it
        });

        // --- Scenario 1: Prioritization Test (CONN-5.2.6.1 Focus) ---
        test('CONN-5.2.6.1: should prioritize explicit connection entity ID over entity ID when both are valid', async () => {
            // Arrange
            // Create entities specific to this test
            mockTargetEntity = createMockEntity('target-chest-1', 'Wooden Chest');
            mockConnectionEntity = createMockEntity('conn-test-door', 'Test Door prioritize'); // Create connection

            placeInLocation(mockUserEntity, mockLocationEntity.id); // Place user

            const connectionMapping = {direction: 'north', connectionEntityId: mockConnectionEntity.id};
            setupLocationConnections(mockLocationEntity, [connectionMapping]); // Setup connection

            usableComponentData.target_required = true;
            usableComponentData.target_conditions = [];

            const explicitTargetEntityId = mockTargetEntity.id;
            const explicitTargetConnectionEntityId = mockConnectionEntity.id;

            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId,
                explicitTargetConnectionEntityId,
                itemName
            };
            const deps = mockDependencies;

            console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify({
                explicitTargetEntityId,
                explicitTargetConnectionEntityId,
                target_required: usableComponentData.target_required
            }, null, 2));

            // Act: Call the function
            const result = await targetResolutionService.resolveItemTarget(params, deps);
            console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));


            // Assert
            expect(result.success).toBe(true);
            expect(result.target).toBe(mockConnectionEntity);
            expect(result.targetType).toBe('connection');
            // Check calls - connection AND location should be fetched for validation
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // For validation
            // The other entity target should NOT have been fetched
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockTargetEntity.id);
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
        });

        // --- Scenario 2: Connection Fetch Failure (CONN-5.2.6.2 Focus) ---
        test('CONN-5.2.6.2: should fail correctly when explicit connection entity cannot be fetched', async () => {
            // Arrange
            // DO NOT create the connection entity - let the fetch fail
            placeInLocation(mockUserEntity, mockLocationEntity.id); // Place user (though not strictly needed as fetch fails first)

            const failedId = 'conn-nonexistent-id-123';
            usableComponentData.target_required = true;
            usableComponentData.target_conditions = [];

            // Mock getEntityInstance *specifically* for this test if needed,
            // but the refined mock should return undefined for failedId anyway.
            // Let's rely on the main mock returning undefined from the empty map spot.

            const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(failedId);

            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId: null,
                explicitTargetConnectionEntityId: failedId,
                itemName
            };
            const deps = mockDependencies;

            console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify({
                explicitTargetEntityId: params.explicitTargetEntityId,
                explicitTargetConnectionEntityId: params.explicitTargetConnectionEntityId,
                target_required: usableComponentData.target_required
            }, null, 2));


            // Act
            const result = await targetResolutionService.resolveItemTarget(params, deps);
            console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));

            // Assert
            expect(result.success).toBe(false);
            expect(result.target).toBeNull(); // Expect null on failure
            expect(result.targetType).toBe('none');
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(failedId); // Verify fetch attempt
            expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: expectedFailureMessage,
                type: 'warning'
            });
        });


        // --- Scenario 3: User Validation Failures (CONN-5.2.6.3 Focus) ---
        describe('CONN-5.2.6.3: User-Side Validation Failures', () => {
            // Test (a): Lacks PositionComponent
            test('(a): should fail if user entity lacks PositionComponent', async () => {
                // Arrange
                // User is created in global beforeEach WITHOUT PositionComponent
                expect(mockUserEntity.getComponent(PositionComponent)).toBeUndefined(); // Verify precondition

                // Create the connection entity for this test
                mockConnectionEntity = createMockEntity('conn-test-door-user-fail-a', 'Test Door User Fail A');

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
                const deps = mockDependencies;

                const inputLog = {
                    explicitTargetConnectionEntityId: params.explicitTargetConnectionEntityId,
                    target_required: usableComponentData.target_required,
                    userHasPosComp: !!params.userEntity.getComponent(PositionComponent)
                };
                console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify(inputLog, null, 2));

                // Act
                const result = await targetResolutionService.resolveItemTarget(params, deps);
                console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull(); // <--- Keep the assertion
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                // Should attempt to fetch connection, but fail before fetching location
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId);
                expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockLocationEntity.id);
                // Check internal message if your service code adds it
                // expect(result.messages).toEqual(expect.arrayContaining([
                //    expect.objectContaining({ text: "CONN-5.2.4 Failure: User missing PositionComponent.", type: 'error' }),
                // ]));
            });

            // Test (b): PositionComponent has null locationId
            test('(b): should fail if user PositionComponent has null locationId', async () => {
                // Arrange
                // Add PositionComponent with null location AFTER user creation
                mockUserEntity.addComponent(new PositionComponent({locationId: null}));
                // Ensure update is reflected in mock map (if necessary, though getComponent reads live object)
                mockEntityManager.entities.set(mockUserEntity.id, mockUserEntity);
                expect(mockUserEntity.getComponent(PositionComponent)?.locationId).toBeNull(); // Verify precondition

                // Create the connection entity for this test
                mockConnectionEntity = createMockEntity('conn-test-door-user-fail-b', 'Test Door User Fail B');

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
                const deps = mockDependencies;

                const inputLog = {
                    explicitTargetConnectionEntityId: params.explicitTargetConnectionEntityId,
                    target_required: usableComponentData.target_required,
                    userHasPosComp: !!params.userEntity.getComponent(PositionComponent),
                    userLocationId: params.userEntity.getComponent(PositionComponent)?.locationId
                };
                console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify(inputLog, null, 2));


                // Act
                const result = await targetResolutionService.resolveItemTarget(params, deps);
                console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull(); // <--- Keep the assertion
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                // Should attempt to fetch connection, but fail before fetching location
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId);
                expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith(mockLocationEntity.id); // Should not attempt location fetch
                // Check internal message if your service code adds it
                // expect(result.messages).toEqual(expect.arrayContaining([
                //     expect.objectContaining({ text: "CONN-5.2.4 Failure: User PositionComponent missing locationId.", type: 'error' }),
                // ]));
            });
        }); // End describe CONN-5.2.6.3

        // --- START: Scenario 4: Location Validation Failures (CONN-5.2.6.4 Focus) ---
        describe('CONN-5.2.6.4: Location-Side Validation Failures', () => {

            // Test (a): Location entity cannot be fetched
            test('(a): should fail if user location entity cannot be fetched', async () => {
                // Arrange
                // Create the connection entity
                mockConnectionEntity = createMockEntity('conn-test-door-loc-fail-a', 'Test Door Loc Fail A');

                // Place user in a location ID that DOES NOT exist in the entity map
                const nonExistentLocationId = 'loc-non-existent';
                placeInLocation(mockUserEntity, nonExistentLocationId);
                expect(mockUserEntity.getComponent(PositionComponent)?.locationId).toBe(nonExistentLocationId);
                expect(mockEntityManager.entities.get(nonExistentLocationId)).toBeUndefined(); // Verify location isn't in map

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
                const deps = mockDependencies;

                const inputLog = {
                    explicitTargetConnectionEntityId: params.explicitTargetConnectionEntityId,
                    target_required: usableComponentData.target_required,
                    userLocationId: params.userEntity.getComponent(PositionComponent)?.locationId,
                    isLocationFetchable: !!mockEntityManager.entities.get(params.userEntity.getComponent(PositionComponent)?.locationId)
                };
                console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify(inputLog, null, 2));


                // Act
                const result = await targetResolutionService.resolveItemTarget(params, deps);
                console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull(); // <--- Keep the assertion
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                // Verify mock calls
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId); // Attempted connection fetch
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(nonExistentLocationId); // Attempted location fetch (should return undefined)
                // Check internal message if added
                // expect(result.messages).toEqual(expect.arrayContaining([
                //    expect.objectContaining({ text: `CONN-5.2.4 Failure: Could not fetch user location entity: ${nonExistentLocationId}`, type: 'error' }),
                // ]));
            });

            // Test (b): Location entity lacks ConnectionsComponent
            test('(b): should fail if user location entity lacks ConnectionsComponent', async () => {
                // Arrange
                console.log("***** STARTING TEST B SETUP *****");
                mockConnectionEntity = createMockEntity('conn-test-door-loc-fail-b', 'Test Door Loc Fail B');

                placeInLocation(mockUserEntity, mockLocationEntity.id);

                expect(mockLocationEntity.getComponent(ConnectionsComponent)).toBeUndefined();

                expect(mockEntityManager.entities.get(mockLocationEntity.id)).toBe(mockLocationEntity);
                // Run the test (with previous lines uncommented). Does "SETUP COMPLETE" print?


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
                const deps = mockDependencies;

                // Act
                const result = await targetResolutionService.resolveItemTarget(params, deps);

                console.log("***** TEST B ACT COMPLETE - BEFORE ASSERT *****"); // VERY Simple Log 3
                console.log("***** TEST B RESULT:", result); // Log raw result

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull(); // <--- Keep the assertion
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId);
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id);
            });

            // Test (c): Connection not listed as exit
            test('(c): should fail if target connection is not listed as an exit in location ConnectionsComponent', async () => {
                // Arrange
                // Create the connection entity we are TARGETING
                mockConnectionEntity = createMockEntity('conn-target-door-loc-fail-c', 'Target Door Loc Fail C');
                // Create a DIFFERENT connection entity to put in the location's exits
                const otherConnection = createMockEntity('conn-other-exit', 'Other Exit');

                placeInLocation(mockUserEntity, mockLocationEntity.id); // User position is valid

                // Setup location with ConnectionsComponent, but ONLY listing the OTHER connection
                setupLocationConnections(mockLocationEntity, [
                    {direction: 'south', connectionEntityId: otherConnection.id}
                ]);
                expect(mockLocationEntity.getComponent(ConnectionsComponent)).toBeDefined(); // Verify component exists
                expect(mockLocationEntity.getComponent(ConnectionsComponent)?.getConnectionByDirection('south')).toBe(otherConnection.id); // Verify setup
                expect(mockEntityManager.entities.get(mockLocationEntity.id)).toBe(mockLocationEntity); // Verify location is fetchable

                usableComponentData.target_required = true;
                const explicitConnectionId = mockConnectionEntity.id; // Target the connection NOT listed as an exit
                const expectedFailureMessage = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitConnectionId);

                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: explicitConnectionId,
                    itemName
                };
                const deps = mockDependencies;

                const locationInMap = mockEntityManager.entities.get(params.userEntity.getComponent(PositionComponent)?.locationId);
                const connComp = locationInMap?.getComponent(ConnectionsComponent);
                const allExits = connComp?.getAllConnections() || [];
                const isTargetAnExit = allExits.some(exit => exit.connectionEntityId === explicitConnectionId);
                const inputLog = {
                    explicitTargetConnectionEntityId: params.explicitTargetConnectionEntityId,
                    target_required: usableComponentData.target_required,
                    userLocationId: params.userEntity.getComponent(PositionComponent)?.locationId,
                    locationHasConnComp: !!connComp,
                    isTargetAnExit: isTargetAnExit,
                    allExits: allExits.map(e => e.connectionEntityId) // Log IDs for clarity
                };
                console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify(inputLog, null, 2));


                // Act
                const result = await targetResolutionService.resolveItemTarget(params, deps);
                console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));

                // Assert
                expect(result.success).toBe(false);
                expect(result.target).toBeNull(); // <--- Keep the assertion
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: expectedFailureMessage,
                    type: 'warning'
                });
                // Verify mock calls
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(explicitConnectionId); // Attempted connection fetch
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Attempted location fetch
                // Check internal message if added
                // expect(result.messages).toEqual(expect.arrayContaining([
                //    expect.objectContaining({ text: `CONN-5.2.4 Failure: Connection Entity ${explicitConnectionId} is NOT a valid exit from ${mockLocationEntity.id}.`, type: 'error' }),
                // ]));
            });

        }); // End describe CONN-5.2.6.4
        // --- END: Scenario 4 ---

        // --- Scenario 5: Success No Conditions (CONN-5.2.6.5) ---
        test('CONN-5.2.6.5: should succeed when connection target is valid and has no conditions', async () => {
            // Arrange
            mockConnectionEntity = createMockEntity('conn-test-door-success-no-cond', 'Success Door No Cond'); // Create connection
            placeInLocation(mockUserEntity, mockLocationEntity.id); // Place user
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
            const deps = mockDependencies;

            console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify({
                explicitTargetConnectionEntityId: params.explicitTargetConnectionEntityId,
                target_required: usableComponentData.target_required
            }, null, 2));

            // Act
            const result = await targetResolutionService.resolveItemTarget(params, deps);
            console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));

            // Assert
            expect(result.success).toBe(true);
            expect(result.target).toBe(mockConnectionEntity);
            expect(result.targetType).toBe('connection');
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id); // Location fetch for validation
        });

        // --- Scenario 6: Success With Conditions (CONN-5.2.6.6) ---
        describe('CONN-5.2.6.6: Success Path with Conditions (Pass/Fail)', () => {
            const connectionDirection = 'east'; // Define consistently

            beforeEach(() => {
                // Create connection entity *once* for this inner describe block
                // It will be cleared and re-added to the map in the global beforeEach,
                // but the instance needs to exist for setupLocationConnections.
                mockConnectionEntity = createMockEntity('conn-test-door-cond', 'Success Door Cond');

                placeInLocation(mockUserEntity, mockLocationEntity.id); // User pos valid
                const connectionMapping = {direction: connectionDirection, connectionEntityId: mockConnectionEntity.id};
                setupLocationConnections(mockLocationEntity, [connectionMapping]); // Connection is valid exit

                usableComponentData.target_required = true;
                usableComponentData.target_conditions = [{type: 'TEST_CONDITION', value: true}]; // Example condition
            });

            test('(a): should succeed when connection target conditions pass', async () => {
                // Arrange
                mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                    success: true,
                    messages: [{text: 'Condition passed!', type: 'internal'}],
                    failureMessage: null
                });

                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: mockConnectionEntity.id,
                    itemName
                };
                const deps = mockDependencies;

                console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify({
                    explicitTargetConnectionEntityId: params.explicitTargetConnectionEntityId,
                    target_required: usableComponentData.target_required,
                    conditions: usableComponentData.target_conditions
                }, null, 2));


                // Act
                const result = await targetResolutionService.resolveItemTarget(params, deps);
                console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));

                // Assert
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1);
                // Check context carefully
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                    mockConnectionEntity, // Subject: The connection entity
                    expect.objectContaining({ // Context
                        userEntity: mockUserEntity,
                        targetEntityContext: null,
                        targetConnectionContext: expect.objectContaining({
                            connectionEntity: mockConnectionEntity,
                            direction: connectionDirection
                        })
                    }),
                    usableComponentData.target_conditions, // Conditions array
                    expect.any(Object) // Options object
                );
                expect(result.success).toBe(true);
                expect(result.target).toBe(mockConnectionEntity);
                expect(result.targetType).toBe('connection');
                expect(mockEventBusDispatch).not.toHaveBeenCalled();
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id);
            });

            test('(b): should fail when connection target conditions fail', async () => {
                // Arrange
                const conditionFailureMsg = 'Test Fail Reason';
                mockConditionEvaluationService.evaluateConditions.mockResolvedValue({
                    success: false,
                    messages: [{text: 'Condition failed!', type: 'internal'}],
                    failureMessage: conditionFailureMsg
                });

                const params = {
                    userEntity: mockUserEntity,
                    usableComponentData,
                    explicitTargetEntityId: null,
                    explicitTargetConnectionEntityId: mockConnectionEntity.id,
                    itemName
                };
                const deps = mockDependencies;

                console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify({
                    explicitTargetConnectionEntityId: params.explicitTargetConnectionEntityId,
                    target_required: usableComponentData.target_required,
                    conditions: usableComponentData.target_conditions
                }, null, 2));

                // Act
                const result = await targetResolutionService.resolveItemTarget(params, deps);
                console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));

                // Assert
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledTimes(1);
                // Check context carefully (same as success case)
                expect(mockConditionEvaluationService.evaluateConditions).toHaveBeenCalledWith(
                    mockConnectionEntity, expect.objectContaining({targetConnectionContext: expect.objectContaining({direction: connectionDirection})}), usableComponentData.target_conditions, expect.any(Object)
                );
                expect(result.success).toBe(false);
                expect(result.target).toBeNull(); // Expect null on failure
                expect(result.targetType).toBe('none');
                expect(mockEventBusDispatch).toHaveBeenCalledTimes(1);
                expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                    text: conditionFailureMsg,
                    type: 'warning'
                });
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockConnectionEntity.id);
                expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockLocationEntity.id);
            });
        }); // End describe CONN-5.2.6.6

        // --- Other Example Tests (Keep or remove as needed, ensure entity creation is handled) ---

        test('should succeed with null target if target is not required', async () => {
            // Arrange
            usableComponentData.target_required = false;
            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId: null,
                explicitTargetConnectionEntityId: null,
                itemName
            };
            console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify({target_required: usableComponentData.target_required}, null, 2));
            // Act
            const result = await targetResolutionService.resolveItemTarget(params, mockDependencies);
            console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));
            // Assert
            expect(result.success).toBe(true);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEventBusDispatch).not.toHaveBeenCalled();
        });

        test('should fail if target required and no IDs are provided', async () => {
            // Arrange
            usableComponentData.target_required = true;
            const params = {
                userEntity: mockUserEntity,
                usableComponentData,
                explicitTargetEntityId: null,
                explicitTargetConnectionEntityId: null,
                itemName
            };
            console.log(`\nDEBUG [${expect.getState().currentTestName}] INPUT:`, JSON.stringify({
                target_required: usableComponentData.target_required,
                explicitTargetEntityId: null,
                explicitTargetConnectionEntityId: null
            }, null, 2));
            // Act
            const result = await targetResolutionService.resolveItemTarget(params, mockDependencies);
            console.log(`DEBUG [${expect.getState().currentTestName}] RESULT:`, JSON.stringify(result, null, 2));
            // Assert
            expect(result.success).toBe(false);
            expect(result.target).toBeNull();
            expect(result.targetType).toBe('none');
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
            expect(mockConditionEvaluationService.evaluateConditions).not.toHaveBeenCalled();
            expect(mockEventBusDispatch).toHaveBeenCalledWith('ui:message_display', {
                text: TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName),
                type: 'warning'
            });
        });

        // Add back other tests if needed, ensuring any required entities
        // like mockTargetEntity or mockConnectionEntity are created within
        // the test's Arrange block using createMockEntity().

    }); // End describe('resolveItemTarget')

}); // End describe('TargetResolutionService')
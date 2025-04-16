// src/test/systems/moveCoordinatorSystem.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Class under test
import MoveCoordinatorSystem from '../../systems/moveCoordinatorSystem.js';
import {EVENT_MOVE_ATTEMPTED, EVENT_MOVE_FAILED} from "../../types/eventTypes.js"; // Adjust path if needed

// Mocked Dependencies (using manual mocks pattern from examples)
// No need to import the actual classes unless needed for instanceof checks or static properties

// --- Mock Dependencies ---

const mockEventBus = {
    _subscriptions: new Map(),
    subscribe: jest.fn((eventName, handler) => {
        if (!mockEventBus._subscriptions.has(eventName)) {
            mockEventBus._subscriptions.set(eventName, new Set());
        }
        mockEventBus._subscriptions.get(eventName).add(handler);
    }),
    unsubscribe: jest.fn((eventName, handler) => {
        const handlers = mockEventBus._subscriptions.get(eventName);
        if (handlers) {
            handlers.delete(handler);
        }
    }),
    // Make dispatch async to match the real implementation
    dispatch: jest.fn(async (eventName, payload) => {
        // console.log(`[Test Mock EventBus Dispatch] ${eventName}`, payload); // Uncomment for debugging
        // Return a resolved promise to simulate async completion
        return Promise.resolve();
    }),
    // Helper to simulate an event triggering the subscribed handler
    // Note: We will call the handler directly in most tests for isolation,
    // but this can be useful for testing the subscription itself.
    simulateEvent: async (eventName, payload) => {
        const handlers = mockEventBus._subscriptions.get(eventName);
        if (handlers) {
            // Use Promise.all if multiple handlers could exist and might be async
            await Promise.all(Array.from(handlers).map(handler => handler(payload)));
        }
    },
    clearAllMocks: () => {
        mockEventBus.subscribe.mockClear();
        mockEventBus.unsubscribe.mockClear();
        mockEventBus.dispatch.mockClear();
        mockEventBus._subscriptions.clear();
    }
};

const mockEntityManager = {
    getEntityInstance: jest.fn(),
    // Add other methods if MoveCoordinatorSystem starts using them
};

const mockBlockerSystem = {
    checkMovementBlock: jest.fn(),
    // Add other methods if needed
};

const mockMovementSystem = {
    executeMove: jest.fn(),
    // Add other methods if needed
};

// --- Test Suite ---

describe('MoveCoordinatorSystem', () => {
    let system;
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;
    let consoleDebugSpy; // If debug logs are added later

    // AC 1: Test File Setup (beforeEach)
    beforeEach(() => {
        // Clear all mocks and spies
        jest.clearAllMocks();
        mockEventBus.clearAllMocks();
        mockEntityManager.getEntityInstance.mockReset(); // Use reset for mocks created with jest.fn()
        mockBlockerSystem.checkMovementBlock.mockReset();
        mockMovementSystem.executeMove.mockReset();

        // Set default mock return values
        mockEntityManager.getEntityInstance.mockReturnValue(undefined); // Default: not found
        mockBlockerSystem.checkMovementBlock.mockReturnValue({ blocked: false }); // Default: not blocked
        mockMovementSystem.executeMove.mockReturnValue(true); // Default: success

        // Create a new system instance for each test
        // Create a new system instance for each test
        system = new MoveCoordinatorSystem({
            eventBus: mockEventBus,
            entityManager: mockEntityManager,
            blockerSystem: mockBlockerSystem,
            movementSystem: mockMovementSystem,
        });

        // Spy on console methods
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

        // <<< ADD THIS LINE >>>
        system.initialize(); // Ensure the handler is subscribed for tests
    });

    // AC 1: Test File Setup (afterEach)
    afterEach(() => {
        // Restore console spies
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleDebugSpy.mockRestore();
        system = null; // Help garbage collection
    });

    // --- Constructor Tests (Implicit) ---
    // Basic constructor tests could be added if needed, but focus is on methods
    it('should instantiate correctly with dependencies', () => {
        expect(system).toBeInstanceOf(MoveCoordinatorSystem);
        // Constructor logs are suppressed by spy, but we know it didn't throw
    });

    // AC 2: `initialize()` Test Case
    describe('initialize', () => {
        it(`should subscribe #handleMoveAttempted to ${EVENT_MOVE_ATTEMPTED} on the eventBus`, () => {
            // The subscribe call happened in beforeEach, so we can assert it here.
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1); // Should now pass
            expect(mockEventBus.subscribe).toHaveBeenCalledWith(
                EVENT_MOVE_ATTEMPTED,
                expect.any(Function)
            );

            // Verify the log message from initialize
            expect(consoleLogSpy).toHaveBeenCalledWith(`MoveCoordinatorSystem: Initialized. Listening for '${EVENT_MOVE_ATTEMPTED}'.`);
        });
    });

    describe('#handleMoveAttempted', () => {
        const basePayload = {
            entityId: 'actor1',
            direction: 'north',
            targetLocationId: 'loc-target',
            previousLocationId: 'loc-prev',
            blockerEntityId: undefined, // Explicitly undefined by default
        };
        const mockTargetLocationEntity = { id: basePayload.targetLocationId, name: 'Target Room' };

        // AC 3: Successful Move Scenario
        it('should coordinate a successful move when checks pass', async () => {
            const payload = { ...basePayload };

            // Arrange: Configure mocks for success path
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetLocationEntity);
            mockBlockerSystem.checkMovementBlock.mockReturnValue({ blocked: false, reasonCode: null, details: null });
            mockMovementSystem.executeMove.mockReturnValue(true);

            // Act: Call the handler VIA the event bus simulation
            await mockEventBus.simulateEvent(EVENT_MOVE_ATTEMPTED, payload);

            // Assert: Verify mock calls and arguments
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(payload.targetLocationId);

            expect(mockBlockerSystem.checkMovementBlock).toHaveBeenCalledTimes(1);
            expect(mockBlockerSystem.checkMovementBlock).toHaveBeenCalledWith({
                entityId: payload.entityId,
                previousLocationId: payload.previousLocationId,
                direction: payload.direction,
                blockerEntityId: payload.blockerEntityId, // Should be undefined here
            });

            expect(mockMovementSystem.executeMove).toHaveBeenCalledTimes(1);
            expect(mockMovementSystem.executeMove).toHaveBeenCalledWith({
                entityId: payload.entityId,
                targetLocationId: payload.targetLocationId,
                previousLocationId: payload.previousLocationId,
                direction: payload.direction,
            });

            // Assert: Verify failure event was NOT dispatched
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(EVENT_MOVE_FAILED, expect.anything());
        });

        // AC 4: Failure: Target Location Not Found (TRG-8.2)
        it(`should dispatch ${EVENT_MOVE_FAILED} with TARGET_LOCATION_NOT_FOUND if target location is missing`, async () => {
            const payload = { ...basePayload };

            // Arrange: Mock entity manager to return null
            mockEntityManager.getEntityInstance.mockReturnValue(null);

            // Act: Call the handler VIA the event bus simulation
            await mockEventBus.simulateEvent(EVENT_MOVE_ATTEMPTED, payload);

            // Assert: Verify only getEntityInstance was called
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(payload.targetLocationId);
            expect(mockBlockerSystem.checkMovementBlock).not.toHaveBeenCalled();
            expect(mockMovementSystem.executeMove).not.toHaveBeenCalled();

            // Assert: Verify failure event dispatch
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_MOVE_FAILED, {
                actorId: payload.entityId,
                direction: payload.direction,
                previousLocationId: payload.previousLocationId,
                attemptedTargetLocationId: payload.targetLocationId,
                reasonCode: 'TARGET_LOCATION_NOT_FOUND',
                details: expect.any(String), // Check that details is a non-empty string
                blockerDisplayName: null,
                blockerEntityId: null,
            });
            expect(mockEventBus.dispatch.mock.calls[0][1].details.length).toBeGreaterThan(0); // Ensure details isn't empty
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Target location ${payload.targetLocationId} not found`));
        });

        // AC 5: Failure: Blocker Check Returns Blocked (TRG-8.3)
        it(`should dispatch ${EVENT_MOVE_FAILED} with blocker details if checkMovementBlock returns blocked`, async () => {
            const payload = { ...basePayload, blockerEntityId: 'door1' }; // Include a potential blocker ID
            const blockerResult = {
                blocked: true,
                reasonCode: 'DIRECTION_LOCKED',
                details: 'The ancient door is sealed.',
                blockerEntityId: 'door1',
                blockerDisplayName: 'Ancient Door',
            };

            // Arrange: Mock dependencies for this path
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetLocationEntity);
            mockBlockerSystem.checkMovementBlock.mockReturnValue(blockerResult);

            // Act: Call the handler VIA the event bus simulation
            await mockEventBus.simulateEvent(EVENT_MOVE_ATTEMPTED, payload);

            // Assert: Verify calls up to blocker check
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockBlockerSystem.checkMovementBlock).toHaveBeenCalledTimes(1);
            expect(mockBlockerSystem.checkMovementBlock).toHaveBeenCalledWith({
                entityId: payload.entityId,
                previousLocationId: payload.previousLocationId,
                direction: payload.direction,
                blockerEntityId: payload.blockerEntityId, // Ensure blockerEntityId from payload is passed
            });
            expect(mockMovementSystem.executeMove).not.toHaveBeenCalled();

            // Assert: Verify failure event dispatch using blocker details
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_MOVE_FAILED, {
                actorId: payload.entityId,
                direction: payload.direction,
                previousLocationId: payload.previousLocationId,
                attemptedTargetLocationId: payload.targetLocationId,
                reasonCode: blockerResult.reasonCode, // From blocker result
                details: blockerResult.details,       // From blocker result
                blockerDisplayName: blockerResult.blockerDisplayName, // From blocker result
                blockerEntityId: blockerResult.blockerEntityId,       // From blocker result
            });
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Movement blocked for actor ${payload.entityId}. Blocker: ${blockerResult.blockerDisplayName}`));
        });

        // AC 6: Failure: Movement Execution Returns `false` (TRG-8.5)
        it(`should dispatch ${EVENT_MOVE_FAILED} with MOVEMENT_EXECUTION_FAILED if executeMove returns false`, async () => {
            const payload = { ...basePayload };

            // Arrange: Mock dependencies for this path
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetLocationEntity);
            mockBlockerSystem.checkMovementBlock.mockReturnValue({ blocked: false });
            mockMovementSystem.executeMove.mockReturnValue(false); // Simulate executeMove failure

            // Act: Call the handler VIA the event bus simulation
            await mockEventBus.simulateEvent(EVENT_MOVE_ATTEMPTED, payload);

            // Assert: Verify all steps were attempted
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockBlockerSystem.checkMovementBlock).toHaveBeenCalledTimes(1);
            expect(mockMovementSystem.executeMove).toHaveBeenCalledTimes(1);

            // Assert: Verify failure event dispatch
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_MOVE_FAILED, {
                actorId: payload.entityId,
                direction: payload.direction,
                previousLocationId: payload.previousLocationId,
                attemptedTargetLocationId: payload.targetLocationId,
                reasonCode: 'MOVEMENT_EXECUTION_FAILED',
                details: expect.any(String),
                blockerDisplayName: null,
                blockerEntityId: null,
            });
            expect(mockEventBus.dispatch.mock.calls[0][1].details).toContain("MovementSystem.executeMove returned false");
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Movement execution failed (executeMove returned false) for actor ${payload.entityId}`));
        });

        // AC 7: Failure: Movement Execution Throws Error (Inner Catch)
        it(`should dispatch ${EVENT_MOVE_FAILED} with MOVE_EXECUTION_ERROR if executeMove throws an error`, async () => {
            const payload = { ...basePayload };
            const movementError = new Error('Internal movement system crash');

            // Arrange: Mock dependencies, make executeMove throw
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetLocationEntity);
            mockBlockerSystem.checkMovementBlock.mockReturnValue({ blocked: false });
            mockMovementSystem.executeMove.mockImplementation(() => {
                throw movementError;
            });

            // Act: Call the handler VIA the event bus simulation
            await mockEventBus.simulateEvent(EVENT_MOVE_ATTEMPTED, payload);

            // Assert: Verify all steps were attempted
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockBlockerSystem.checkMovementBlock).toHaveBeenCalledTimes(1);
            expect(mockMovementSystem.executeMove).toHaveBeenCalledTimes(1);

            // Assert: Verify failure event dispatch
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_MOVE_FAILED, {
                actorId: payload.entityId,
                direction: payload.direction,
                previousLocationId: payload.previousLocationId,
                attemptedTargetLocationId: payload.targetLocationId,
                reasonCode: 'MOVE_EXECUTION_ERROR',
                details: expect.stringContaining(movementError.message), // Check error message is included
                blockerDisplayName: null,
                blockerEntityId: null,
            });

            // Assert: Verify console error logging from inner catch
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`[Step 3 Failed - Inner Catch] Unexpected error during MovementSystem.executeMove`),
                movementError
            );
        });

        // AC 8: Failure: Unexpected Internal Coordinator Error (Top-Level Catch - TRG-8.6)
        it(`should dispatch ${EVENT_MOVE_FAILED} with COORDINATOR_INTERNAL_ERROR if a dependency throws unexpectedly (top-level catch)`, async () => {
            const payload = { ...basePayload };
            const unexpectedError = new Error('Unexpected BlockerSystem failure');

            // Arrange: Mock dependencies, make blocker check throw
            mockEntityManager.getEntityInstance.mockReturnValue(mockTargetLocationEntity); // Step 1 succeeds
            mockBlockerSystem.checkMovementBlock.mockImplementation(() => { // Step 2 fails unexpectedly
                throw unexpectedError;
            });

            // Act: Call the handler VIA the event bus simulation
            await mockEventBus.simulateEvent(EVENT_MOVE_ATTEMPTED, payload);

            // Assert: Verify steps up to the failing one
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockBlockerSystem.checkMovementBlock).toHaveBeenCalledTimes(1);
            expect(mockMovementSystem.executeMove).not.toHaveBeenCalled(); // Should not be reached

            // Assert: Verify failure event dispatch
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_MOVE_FAILED, {
                actorId: payload.entityId,
                direction: payload.direction,
                previousLocationId: payload.previousLocationId,
                attemptedTargetLocationId: payload.targetLocationId,
                reasonCode: 'COORDINATOR_INTERNAL_ERROR',
                details: expect.stringContaining(unexpectedError.message), // Check error message is included
                blockerDisplayName: null,
                blockerEntityId: null,
            });

            // Assert: Verify console error logging from top-level catch
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`[Top-Level Error Caught] Unexpected error during move attempt handling for actor ${payload.entityId}`),
                expect.objectContaining({ // Check that the logged object includes the error
                    error: unexpectedError,
                    payloadString: expect.any(String) // Check that payload stringification was attempted
                })
            );
        });

        // Test case for top-level catch when payload might be invalid
        it('should handle top-level errors gracefully even with invalid payload', async () => {
            const invalidPayload = null; // Or some malformed object
            const unexpectedError = new Error('Cannot destructure property'); // Simulate the expected internal error type

            // Arrange: Mock a dependency to throw early (though destructuring error happens first here)
            // Keeping this mock doesn't hurt, but isn't strictly needed for the null payload case
            mockEntityManager.getEntityInstance.mockImplementation(() => {
                throw new Error('Unexpected EntityManager failure'); // This won't be reached with null payload
            });

            // Act: Call the handler with invalid payload VIA event simulation
            await mockEventBus.simulateEvent(EVENT_MOVE_ATTEMPTED, invalidPayload);

            // Assert: Verify mock calls (Adjusted for immediate destructuring error)
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(0); // <<< CORRECTED: Not called due to early TypeError
            expect(mockBlockerSystem.checkMovementBlock).not.toHaveBeenCalled();
            expect(mockMovementSystem.executeMove).not.toHaveBeenCalled();

            // Assert: Verify failure event dispatch with fallback IDs
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1); // <<< Should now be reached and pass
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(EVENT_MOVE_FAILED, {
                actorId: 'Unknown Actor',
                direction: 'Unknown Direction',
                previousLocationId: 'Unknown Previous',
                attemptedTargetLocationId: 'Unknown Target',
                reasonCode: 'COORDINATOR_INTERNAL_ERROR',
                details: expect.stringContaining('Cannot destructure property'), // Check error message related to destructuring null
                blockerDisplayName: null,
                blockerEntityId: null,
            });

            // Assert: Verify console error logging from top-level catch
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`[Top-Level Error Caught] Unexpected error during move attempt handling for actor Unknown Actor`),
                expect.objectContaining({
                    error: expect.any(TypeError), // The actual error will be a TypeError
                    payloadString: 'null' // Stringified null payload
                })
            );
        });

    }); // end describe('#handleMoveAttempted')

}); // end describe('MoveCoordinatorSystem')
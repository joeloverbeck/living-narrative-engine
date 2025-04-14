// src/test/systems/movementSystem.test.js

// Import the class we are testing
import MovementSystem from '../../systems/movementSystem.js';

// Import dependencies that need mocking or referencing
import { PositionComponent } from '../../components/positionComponent.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
// We don't need the actual EventBus/EntityManager/Entity classes for mocks,
// but importing PositionComponent helps ensure we reference the correct class type.
// import EventBus from '../../core/eventBus.js'; // Not strictly needed for mocks
// import EntityManager from '../../entities/entityManager.js'; // Not strictly needed for mocks
// import Entity from '../../entities/entity.js'; // Not strictly needed for mocks

// --- Test Suite Setup ---

describe('MovementSystem', () => {
    // Declare variables for mocks, spies, and the system instance
    let mockEventBus;
    let mockEntityManager;
    let mockEntity; // Will be re-created in tests needing it
    let mockPositionComp; // Will be re-created in tests needing it
    let movementSystem;
    let consoleErrorSpy;
    let consoleWarnSpy;

    // AC: Mock Setup (beforeEach/afterEach)
    beforeEach(() => {
        // Create mock EventBus
        mockEventBus = {
            dispatch: jest.fn(),
            // Add subscribe mock for the initialize test, even though it shouldn't be called
            subscribe: jest.fn()
        };

        // Create mock EntityManager
        mockEntityManager = {
            getEntityInstance: jest.fn(),
            notifyPositionChange: jest.fn()
        };

        // Create a generic mock Entity (specific mocks created in tests as needed)
        // We give it a basic getComponent mock structure
        mockEntity = {
            id: 'test-entity', // Example ID, can be overridden
            getComponent: jest.fn(),
            // Add other methods if MovementSystem started using them
        };

        // Instantiate the MovementSystem with mocks
        movementSystem = new MovementSystem({
            eventBus: mockEventBus,
            entityManager: mockEntityManager
        });

        // Spy on console methods to monitor output without cluttering results
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore all mocks and spies
        jest.restoreAllMocks();
    });

    // --- Test Cases ---

    // AC: Test: initialize Method
    describe('initialize', () => {
        it('should initialize without subscribing to events', () => {
            // Spy is already set up in beforeEach for the mock
            // Call the initialize method
            movementSystem.initialize();

            // Assert: mockEventBus.subscribe was not called
            // We mocked subscribe on the mock object, so we check that mock's call count
            expect(mockEventBus.subscribe).not.toHaveBeenCalled();

            // Also ensure dispatch wasn't called during initialization
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });
    });

    describe('executeMove', () => {
        // Define a standard payload structure used across tests
        const basePayload = {
            entityId: 'player',
            targetLocationId: 'room-b',
            previousLocationId: 'room-a',
            direction: 'north'
        };

        // AC: Test: executeMove - Successful Execution
        it('should successfully execute a move when conditions are met', () => {
            const validPayload = { ...basePayload };
            mockEntity.id = validPayload.entityId; // Align mock entity ID
            mockPositionComp = { locationId: validPayload.previousLocationId }; // Start at the correct location

            // Configure mocks for the success path
            mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
            mockEntity.getComponent.mockReturnValue(mockPositionComp);

            // Call the method under test
            const result = movementSystem.executeMove(validPayload);

            // Assert: result is true
            expect(result).toBe(true);

            // Assert: mockEntityManager.getEntityInstance was called correctly
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(validPayload.entityId);

            // Assert: mockEntity.getComponent was called correctly
            expect(mockEntity.getComponent).toHaveBeenCalledTimes(1);
            expect(mockEntity.getComponent).toHaveBeenCalledWith(PositionComponent);

            // Assert: mockPositionComp.locationId was updated
            expect(mockPositionComp.locationId).toBe(validPayload.targetLocationId);

            // Assert: mockEntityManager.notifyPositionChange was called correctly
            expect(mockEntityManager.notifyPositionChange).toHaveBeenCalledTimes(1);
            expect(mockEntityManager.notifyPositionChange).toHaveBeenCalledWith(
                validPayload.entityId,
                validPayload.previousLocationId,
                validPayload.targetLocationId
            );

            // Assert: mockEventBus.dispatch was called correctly
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:entity_moved', {
                entityId: validPayload.entityId,
                newLocationId: validPayload.targetLocationId,
                oldLocationId: validPayload.previousLocationId,
                direction: validPayload.direction
            });

            // Assert: console methods were not called unnecessarily
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        // AC: Test: executeMove - Failure (Entity Not Found)
        it('should return false and log error if entity is not found', () => {
            const payload = { ...basePayload };

            // Configure mockEntityManager to simulate entity not found
            mockEntityManager.getEntityInstance.mockReturnValue(null); // Or undefined

            // Call the method under test
            const result = movementSystem.executeMove(payload);

            // Assert: result is false
            expect(result).toBe(false);

            // Assert: console.error was called
            expect(consoleErrorSpy).toHaveBeenCalled();
            // Optional: More specific check on the error message if needed
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to find entity with ID [${payload.entityId}]`)
            );


            // Assert: Dependencies were not called further down the chain
            expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            // getComponent shouldn't be called if entity is null
            expect(mockEntity.getComponent).not.toHaveBeenCalled();
        });

        // AC: Test: executeMove - Failure (PositionComponent Not Found)
        it('should return false and log error if PositionComponent is missing', () => {
            const payload = { ...basePayload };
            mockEntity.id = payload.entityId;

            // Configure mocks: return entity, but component lookup fails
            mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
            mockEntity.getComponent.mockReturnValue(null); // Simulate component not found

            // Call the method under test
            const result = movementSystem.executeMove(payload);

            // Assert: result is false
            expect(result).toBe(false);

            // Assert: console.error was called
            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Entity [${payload.entityId}] lacks a PositionComponent`)
            );

            // Assert: Dependencies were not called further down the chain
            expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
            // Check getComponent *was* called
            expect(mockEntity.getComponent).toHaveBeenCalledTimes(1);
            expect(mockEntity.getComponent).toHaveBeenCalledWith(PositionComponent);
        });

        // AC: Test: executeMove - Failure (Previous Location Mismatch)
        it('should return false and log warning if previousLocationId mismatches component state', () => {
            const payload = { ...basePayload, previousLocationId: 'room-a' };
            const incorrectStartingLocation = 'unexpected-room';
            mockEntity.id = payload.entityId;
            mockPositionComp = { locationId: incorrectStartingLocation }; // Entity is somewhere else

            // Configure mocks: return entity and component, but location is wrong
            mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
            mockEntity.getComponent.mockReturnValue(mockPositionComp);

            // Call the method under test
            const result = movementSystem.executeMove(payload);

            // Assert: result is false
            expect(result).toBe(false);

            // Assert: console.warn was called
            expect(consoleWarnSpy).toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining(`State mismatch for entity [${payload.entityId}]`)
            );

            // Assert: Position component was not modified
            expect(mockPositionComp.locationId).toBe(incorrectStartingLocation);

            // Assert: Dependencies were not called further down the chain
            expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        // AC: Test: executeMove - Failure (Unexpected Error)
        it('should return false and log error if an unexpected error occurs', () => {
            const payload = { ...basePayload };
            mockEntity.id = payload.entityId;
            mockPositionComp = { locationId: payload.previousLocationId }; // Correct starting location
            const testError = new Error('Test Internal Error');

            // Configure mocks to allow execution to reach the point of error
            mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
            mockEntity.getComponent.mockReturnValue(mockPositionComp);

            // Configure a dependency to throw an error
            mockEntityManager.notifyPositionChange.mockImplementation(() => {
                throw testError;
            });

            // Call the method under test
            const result = movementSystem.executeMove(payload);

            // Assert: result is false
            expect(result).toBe(false);

            // Assert: console.error was called
            expect(consoleErrorSpy).toHaveBeenCalled();
            // Assert: Check that the logged object contains the thrown error
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'MovementSystem: Unexpected error during executeMove:',
                expect.objectContaining({
                    payload: payload, // Check if the original payload was logged
                    error: testError // Check if the specific error object was logged
                })
            );

            // Assert: Event dispatch did not happen (error occurred before it)
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();

            // Assert: Position component might have been changed *before* the error
            // Depending on where the error is thrown. In this setup, it's after the change.
            expect(mockPositionComp.locationId).toBe(payload.targetLocationId);
            // Check notifyPositionChange was called (as it's the one throwing)
            expect(mockEntityManager.notifyPositionChange).toHaveBeenCalledTimes(1);

        });

        // Test edge case: Error during entity retrieval (less likely with simple mock, but good practice)
        it('should return false and log error if getEntityInstance throws', () => {
            const payload = { ...basePayload };
            const retrievalError = new Error("DB Error");

            // Configure getEntityInstance to throw
            mockEntityManager.getEntityInstance.mockImplementation(() => {
                throw retrievalError;
            });

            // Call the method under test
            const result = movementSystem.executeMove(payload);

            // Assert: result is false
            expect(result).toBe(false);

            // Assert: console.error was called with the specific error
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'MovementSystem: Unexpected error during executeMove:',
                expect.objectContaining({
                    payload: payload,
                    error: retrievalError
                })
            );

            // Assert: Dependencies were not called
            expect(mockEntity.getComponent).not.toHaveBeenCalled();
            expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        // Test edge case: Error during component retrieval
        it('should return false and log error if getComponent throws', () => {
            const payload = { ...basePayload };
            mockEntity.id = payload.entityId;
            const componentError = new Error("Component System Error");

            // Configure mocks: entity exists, but getComponent throws
            mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
            mockEntity.getComponent.mockImplementation(() => {
                throw componentError;
            });

            // Call the method under test
            const result = movementSystem.executeMove(payload);

            // Assert: result is false
            expect(result).toBe(false);

            // Assert: console.error was called with the specific error
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'MovementSystem: Unexpected error during executeMove:',
                expect.objectContaining({
                    payload: payload,
                    error: componentError
                })
            );

            // Assert: Dependencies were not called further down
            expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });

        // Test edge case: Error during event dispatch
        it('should return true but log error if event dispatch throws (move succeeded internally)',  async () => {
            // Note: The current implementation returns true *before* dispatch.
            // If dispatch were awaited and wrapped in the main try/catch, this test would change.
            // Based on the *current* code, the move completes state-wise, then dispatch happens.
            // Let's test the provided code's behavior. If dispatch is async and awaited within
            // the try block, this test would expect `false` and a log.
            // --- Update: The provided EventBus.dispatch IS async. ---
            // --- However, MovementSystem.executeMove DOES NOT await it. ---
            // --- Therefore, an error *in* dispatch won't be caught by executeMove's try/catch ---
            // --- and executeMove will return true. The error will log from EventBus. ---
            // --- This test reflects THAT behavior. If executeMove is changed to await dispatch, ---
            // --- this test expectation needs to change to return false. ---

            const validPayload = { ...basePayload };
            mockEntity.id = validPayload.entityId;
            mockPositionComp = { locationId: validPayload.previousLocationId };
            const dispatchError = new Error('EventBus Listener Failed');

            // Configure mocks for success up to dispatch
            mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
            mockEntity.getComponent.mockReturnValue(mockPositionComp);
            // Configure dispatch to throw (or reject, since it's async)
            mockEventBus.dispatch.mockRejectedValue(dispatchError); // Use mockRejectedValue for async throws

            // Call the method
            const result = movementSystem.executeMove(validPayload);

            // Assertions for the *synchronous* part
            expect(result).toBe(true);
            expect(mockPositionComp.locationId).toBe(validPayload.targetLocationId);
            expect(mockEntityManager.notifyPositionChange).toHaveBeenCalledTimes(1);
            expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);

            // *** Add temporary catch to diagnose worker crash ***
            // This tries to catch the rejection floating from the un-awaited dispatch
            try {
                // This accesses the promise returned by the mock call
                await mockEventBus.dispatch.mock.results[0].value;
            } catch (e) {
                // Expect the specific error to be caught here
                expect(e).toBe(dispatchError);
                // console.log("Caught expected rejection in test handler."); // Optional log
            }

            // Assert: No error logged by *MovementSystem's* catch block
            // The error would be logged by the EventBus itself (or potentially unhandled rejection)
            expect(consoleErrorSpy).not.toHaveBeenCalledWith(
                'MovementSystem: Unexpected error during executeMove:',
                expect.anything() // Check it wasn't MovementSystem's catch
            );

            // We can't easily assert the EventBus log here without more complex spying/mocking
            // of the EventBus internals or assuming its logging format.
            // The main point is executeMove itself didn't catch it and returned true.

        });


    }); // end describe('executeMove')

}); // end describe('MovementSystem')
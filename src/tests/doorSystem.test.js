// src/tests/systems/doorSystem.test.js

import {jest, describe, it, expect, beforeEach, afterEach, test} from '@jest/globals';

// Class under test
import DoorSystem from '../systems/doorSystem.js';

// Dependencies to mock
import EventBus from '../../eventBus.js'; // Adjust path if needed
import EntityManager from '../entities/entityManager.js'; // Adjust path
import {ConnectionsComponent} from '../components/connectionsComponent.js'; // Adjust path
import Entity from '../entities/entity.js'; // Adjust path
import {getDisplayName} from '../utils/messages.js'; // Adjust path

// --- Mock Dependencies ---

// Mock EventBus
// We need a slightly more functional mock to simulate subscription and dispatch
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
    dispatch: jest.fn((eventName, payload) => {
        // This mock dispatch doesn't automatically call handlers,
        // we'll call the handler directly in tests for simplicity.
        // If needed, we could iterate over _subscriptions here.
    }),
    // Helper to simulate an event triggering the subscribed handler
    simulateEvent: (eventName, payload) => {
        const handlers = mockEventBus._subscriptions.get(eventName);
        if (handlers) {
            handlers.forEach(handler => handler(payload));
        }
    },
    clearAllSubscriptions: () => {
        mockEventBus._subscriptions.clear();
        mockEventBus.subscribe.mockClear();
        mockEventBus.unsubscribe.mockClear();
        mockEventBus.dispatch.mockClear();
    }
};

// Mock EntityManager
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    // Add other methods if needed by DoorSystem or future tests, but not required now
};

// Mock ConnectionsComponent methods
const mockConnectionsComponent = {
    getConnectionState: jest.fn(),
    setConnectionState: jest.fn(),
    // Add other methods if needed
};

// Mock Entity (specifically the location entity)
const mockLocationEntity = {
    id: 'location_test_room',
    getComponent: jest.fn((componentClass) => {
        if (componentClass === ConnectionsComponent) {
            return mockConnectionsComponent;
        }
        return undefined; // Return undefined for other components
    }),
    // Mock other Entity methods if needed
};

// Mock Utility
// We don't need the real implementation, just need it not to crash
jest.mock('../utils/messages.js', () => ({
    getDisplayName: jest.fn((entity) => entity?.id || 'Unknown Entity'),
}));


// --- Test Suite ---

describe('DoorSystem', () => {
    let doorSystem;
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;
    let consoleDebugSpy;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        mockEventBus.clearAllSubscriptions();

        // Reset mock return values/implementations for entity/component mocks
        mockEntityManager.getEntityInstance.mockReturnValue(undefined); // Default: entity not found
        mockLocationEntity.getComponent.mockClear(); // Clear calls on the specific mock method
        mockConnectionsComponent.getConnectionState.mockReturnValue(undefined); // Default: connection not found
        mockConnectionsComponent.setConnectionState.mockReturnValue(false); // Default: update fails or isn't needed

        // Create a new DoorSystem instance for each test
        // We wrap constructor calls in tests checking for errors
        // doorSystem = new DoorSystem({ eventBus: mockEventBus, entityManager: mockEntityManager });

        // Spy on console methods
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {
        }); // Spy on debug too
    });

    afterEach(() => {
        // Restore console spies
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleDebugSpy.mockRestore();

        // Ensure system is shutdown if initialize was called
        if (doorSystem && typeof doorSystem.shutdown === 'function') {
            // Check if subscribe was called before trying to unsubscribe
            if (mockEventBus.subscribe.mock.calls.length > 0) {
                doorSystem.shutdown();
            }
        }
        doorSystem = null; // Help garbage collection
    });

    // --- Constructor Tests ---
    it('should throw an error if EventBus is not provided', () => {
        expect(() => new DoorSystem({entityManager: mockEntityManager})).toThrow(
            'DoorSystem requires an EventBus instance.'
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith("DoorSystem: EventBus dependency is missing.");
    });

    it('should throw an error if EntityManager is not provided', () => {
        expect(() => new DoorSystem({eventBus: mockEventBus})).toThrow(
            'DoorSystem requires an EntityManager instance.'
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith("DoorSystem: EntityManager dependency is missing.");
    });

    it('should create an instance successfully with valid dependencies', () => {
        expect(() => new DoorSystem({eventBus: mockEventBus, entityManager: mockEntityManager})).not.toThrow();
        expect(consoleLogSpy).toHaveBeenCalledWith("DoorSystem: Instance created.");
    });

    // --- Initialization and Shutdown Tests ---
    it('initialize() should subscribe to event:connection_unlock_attempt', () => {
        doorSystem = new DoorSystem({eventBus: mockEventBus, entityManager: mockEntityManager});
        doorSystem.initialize();

        expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
        expect(mockEventBus.subscribe).toHaveBeenCalledWith(
            'event:connection_unlock_attempt',
            expect.any(Function) // The handler bound to the instance
        );
        // Check the bound function is indeed _handleConnectionUnlockAttempt
        const handler = mockEventBus.subscribe.mock.calls[0][1];
        expect(handler.name).toContain('_handleConnectionUnlockAttempt'); // Bound functions often have 'bound ' prefix

        expect(consoleLogSpy).toHaveBeenCalledWith("DoorSystem: Initialized and subscribed to 'event:connection_unlock_attempt'.");
    });

    it('shutdown() should unsubscribe from event:connection_unlock_attempt', () => {
        doorSystem = new DoorSystem({eventBus: mockEventBus, entityManager: mockEntityManager});
        doorSystem.initialize(); // Subscribe first

        // Retrieve the handler function that was subscribed
        const handler = mockEventBus.subscribe.mock.calls[0][1];
        mockEventBus.subscribe.mockClear(); // Clear subscribe calls before shutdown

        doorSystem.shutdown();

        expect(mockEventBus.unsubscribe).toHaveBeenCalledTimes(1);
        expect(consoleLogSpy).toHaveBeenCalledWith("DoorSystem: Unsubscribed from 'event:connection_unlock_attempt'.");
    });


    // --- Event Handling (_handleConnectionUnlockAttempt) Tests ---

    describe('_handleConnectionUnlockAttempt', () => {
        const VALID_PAYLOAD = {
            connectionId: 'door_north',
            locationId: 'location_test_room',
            userId: 'player1',
            keyId: 'key_rusty', // Optional but good to include
            // sourceItemId: 'key_rusty_instance' // Optional
        };

        beforeEach(() => {
            // Ensure system is created and initialized for event handling tests
            doorSystem = new DoorSystem({eventBus: mockEventBus, entityManager: mockEntityManager});
            doorSystem.initialize();
            // Clear mocks specific to initialize call
            consoleLogSpy.mockClear();
            mockEventBus.subscribe.mockClear();
        });

        it('should successfully unlock a locked connection', () => {
            // Arrange: Mock the state for this scenario
            mockEntityManager.getEntityInstance.mockReturnValue(mockLocationEntity);
            mockLocationEntity.getComponent.mockReturnValue(mockConnectionsComponent); // Ensure it returns the component
            mockConnectionsComponent.getConnectionState.mockReturnValue('locked');
            mockConnectionsComponent.setConnectionState.mockReturnValue(true); // Simulate successful update

            // Act: Simulate the event
            doorSystem._handleConnectionUnlockAttempt(VALID_PAYLOAD);
            // Or use the simulator: mockEventBus.simulateEvent('event:connection_unlock_attempt', VALID_PAYLOAD);


            // Assert
            expect(consoleDebugSpy).toHaveBeenCalledWith("DoorSystem: Received event:connection_unlock_attempt", VALID_PAYLOAD);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(VALID_PAYLOAD.locationId);
            expect(mockLocationEntity.getComponent).toHaveBeenCalledTimes(1);
            expect(mockLocationEntity.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
            expect(mockConnectionsComponent.getConnectionState).toHaveBeenCalledTimes(1);
            expect(mockConnectionsComponent.getConnectionState).toHaveBeenCalledWith(VALID_PAYLOAD.connectionId);
            expect(mockConnectionsComponent.setConnectionState).toHaveBeenCalledTimes(1);
            expect(mockConnectionsComponent.setConnectionState).toHaveBeenCalledWith(VALID_PAYLOAD.connectionId, 'unlocked');

            // Check for success log message
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Connection '${VALID_PAYLOAD.connectionId}' in location '${VALID_PAYLOAD.locationId}' (location_test_room) unlocked by user '${VALID_PAYLOAD.userId}'.`));
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should do nothing and log if the connection is already unlocked', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockReturnValue(mockLocationEntity);
            mockLocationEntity.getComponent.mockReturnValue(mockConnectionsComponent);
            mockConnectionsComponent.getConnectionState.mockReturnValue('unlocked'); // Already unlocked

            // Act
            doorSystem._handleConnectionUnlockAttempt(VALID_PAYLOAD);

            // Assert
            expect(mockConnectionsComponent.setConnectionState).not.toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Connection '${VALID_PAYLOAD.connectionId}' in location '${VALID_PAYLOAD.locationId}' is not in a 'locked' state (current: 'unlocked'). No action taken.`));
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should do nothing and log if the connection is in a state other than locked', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockReturnValue(mockLocationEntity);
            mockLocationEntity.getComponent.mockReturnValue(mockConnectionsComponent);
            mockConnectionsComponent.getConnectionState.mockReturnValue('open'); // Some other state

            // Act
            doorSystem._handleConnectionUnlockAttempt(VALID_PAYLOAD);

            // Assert
            expect(mockConnectionsComponent.setConnectionState).not.toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Connection '${VALID_PAYLOAD.connectionId}' in location '${VALID_PAYLOAD.locationId}' is not in a 'locked' state (current: 'open'). No action taken.`));
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should do nothing and log if the connection ID is not found on the component', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockReturnValue(mockLocationEntity);
            mockLocationEntity.getComponent.mockReturnValue(mockConnectionsComponent);
            mockConnectionsComponent.getConnectionState.mockReturnValue(undefined); // Connection not found

            // Act
            doorSystem._handleConnectionUnlockAttempt(VALID_PAYLOAD);

            // Assert
            expect(mockConnectionsComponent.setConnectionState).not.toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Connection '${VALID_PAYLOAD.connectionId}' not found in location '${VALID_PAYLOAD.locationId}'. No action taken.`));
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should do nothing and warn if the location entity is not found', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockReturnValue(undefined); // Location not found

            // Act
            doorSystem._handleConnectionUnlockAttempt(VALID_PAYLOAD);

            // Assert
            expect(mockLocationEntity.getComponent).not.toHaveBeenCalled();
            expect(mockConnectionsComponent.getConnectionState).not.toHaveBeenCalled();
            expect(mockConnectionsComponent.setConnectionState).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Could not find location entity instance with ID: ${VALID_PAYLOAD.locationId}.`));
            expect(consoleLogSpy).not.toHaveBeenCalled(); // No success/info logs
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should do nothing and warn if the location entity lacks a ConnectionsComponent', () => {
            // Arrange
            mockEntityManager.getEntityInstance.mockReturnValue(mockLocationEntity);
            mockLocationEntity.getComponent.mockReturnValue(undefined); // No component found

            // Act
            doorSystem._handleConnectionUnlockAttempt(VALID_PAYLOAD);

            // Assert
            expect(mockLocationEntity.getComponent).toHaveBeenCalledTimes(1); // It was called
            expect(mockLocationEntity.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
            expect(mockConnectionsComponent.getConnectionState).not.toHaveBeenCalled();
            expect(mockConnectionsComponent.setConnectionState).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Location entity ${VALID_PAYLOAD.locationId} (${mockLocationEntity.id}) does not have a ConnectionsComponent.`));
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        // Test invalid payloads
        test.each([
            {...VALID_PAYLOAD, connectionId: null},
            {...VALID_PAYLOAD, locationId: undefined},
            {...VALID_PAYLOAD, userId: ''},
            {}, // Empty payload
        ])('should do nothing and warn for invalid payload: %p', (invalidPayload) => {
            // Act
            doorSystem._handleConnectionUnlockAttempt(invalidPayload);

            // Assert
            expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
            expect(mockConnectionsComponent.getConnectionState).not.toHaveBeenCalled();
            expect(mockConnectionsComponent.setConnectionState).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'DoorSystem: Invalid payload received for event:connection_unlock_attempt. Missing required fields (connectionId, locationId, userId). Payload:',
                invalidPayload
            );
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should log an error if setConnectionState returns false unexpectedly', () => {
            // Arrange: Mock the state for this scenario
            mockEntityManager.getEntityInstance.mockReturnValue(mockLocationEntity);
            mockLocationEntity.getComponent.mockReturnValue(mockConnectionsComponent);
            mockConnectionsComponent.getConnectionState.mockReturnValue('locked'); // It IS locked
            mockConnectionsComponent.setConnectionState.mockReturnValue(false); // But update fails

            // Act
            doorSystem._handleConnectionUnlockAttempt(VALID_PAYLOAD);

            // Assert
            expect(mockConnectionsComponent.setConnectionState).toHaveBeenCalledTimes(1);
            expect(mockConnectionsComponent.setConnectionState).toHaveBeenCalledWith(VALID_PAYLOAD.connectionId, 'unlocked');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to update state for connection '${VALID_PAYLOAD.connectionId}' in location '${VALID_PAYLOAD.locationId}'`));
            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('unlocked by user')); // No success log
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
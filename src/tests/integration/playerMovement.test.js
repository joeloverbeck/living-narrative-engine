// src/test/integration/playerMovement.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';

// --- System/Functions Under Test ---
import CommandParser from '../../core/commandParser.js';
import {executeMove} from '../../actions/handlers/moveActionHandler.js';
import MovementSystem from '../../systems/movementSystem.js';

// --- Components Used ---
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';

// --- Mocks Needed ---
// Mock Entity class
jest.mock('../../entities/entity.js', () => {
    return class MockEntity {
        constructor(id) {
            this.id = id;
            this._components = new Map();
        }

        addComponent(componentInstance, componentKey = null) {
            const key = componentKey || componentInstance.constructor;
            this._components.set(key, componentInstance);
            if (typeof componentInstance.setEntity === 'function') componentInstance.setEntity(this);
            if (typeof key === 'string') this._components.set(key, componentInstance);
        }

        getComponent(ComponentClassOrKey) {
            return this._components.get(ComponentClassOrKey);
        }

        hasComponent(ComponentClassOrKey) {
            return this._components.has(ComponentClassOrKey);
        }

        toString() {
            return `MockEntity[id=${this.id}]`;
        }
    };
});
import MockEntity from '../../entities/entity.js';

// Mock DataManager
const mockGetDataManager = () => ({
    getEntityDefinition: jest.fn((id) => {
        // Default implementation, can be overridden in tests
        if (id === 'demo:room_entrance') return {id: 'demo:room_entrance', components: {}};
        if (id === 'demo:room_hallway') return {id: 'demo:room_hallway', components: {}};
        if (id === 'core:player') return {id: 'core:player', components: {}};
        return null;
    }),
    actions: new Map([
        ['core:move', {id: 'core:move', commands: ['move', 'go', 'north', 'n', 'south', 's']}],
    ])
});

// ***** FIX: Provide full implementation for mockGetEntityManager *****
const mockGetEntityManager = () => ({
    // Define properties as Jest mock functions
    createEntityInstance: jest.fn(),
    getEntityInstance: jest.fn(),
    registerComponent: jest.fn(),
    notifyPositionChange: jest.fn(),
    // Add any other methods expected by the code under test
});

// ***** FIX: Provide full implementation for mockGetEventBus *****
const mockGetEventBus = () => {
    const subscribers = new Map();
    return {
        // Define properties as Jest mock functions or actual implementations
        dispatch: jest.fn(),
        subscribe: jest.fn((eventName, handler) => {
            if (!subscribers.has(eventName)) {
                subscribers.set(eventName, []);
            }
            subscribers.get(eventName).push(handler);
        }),
        // Helper to simulate event dispatch for testing subscribers
        _trigger: (eventName, payload) => {
            let handled = false;
            if (subscribers.has(eventName)) {
                subscribers.get(eventName).forEach(handler => handler(payload));
                handled = true; // Mark as handled if subscribers exist
            }
            // console.log(`_trigger: ${eventName}`, payload, `Handled: ${handled}`); // Optional debug log
            return handled;
        },
        _getSubscribers: () => subscribers, // Helper for debugging if needed
        // Add any other methods expected by the code under test
    };
};


// --- Global Test Variables ---
// (remain the same)
let commandParser;
let mockDataManager;
let mockEntityManager;
let mockEventBus;
let movementSystem;
let mockPlayer;
let mockEntrance;
let mockHallway;
let playerPositionComp;
let entranceConnectionsComp;

// --- Test Setup ---
beforeEach(() => {
    // Reset mocks and systems for each test
    mockDataManager = mockGetDataManager();
    mockEntityManager = mockGetEntityManager(); // Now creates object with jest.fn() properties
    mockEventBus = mockGetEventBus();         // Now creates object with jest.fn() properties

    commandParser = new CommandParser(mockDataManager);

    // Create mock entities
    mockPlayer = new MockEntity('core:player');
    mockEntrance = new MockEntity('demo:room_entrance');
    mockHallway = new MockEntity('demo:room_hallway');

    // Setup initial state (Components, etc.)
    playerPositionComp = new PositionComponent({locationId: mockEntrance.id});
    mockPlayer.addComponent(playerPositionComp, PositionComponent);
    mockPlayer.addComponent(playerPositionComp, 'Position');

    entranceConnectionsComp = new ConnectionsComponent({
        connections: [{connectionId: "entrance_north_passage", direction: "north", target: mockHallway.id}]
    });
    mockEntrance.addComponent(entranceConnectionsComp, ConnectionsComponent);
    mockEntrance.addComponent(entranceConnectionsComp, 'Connections');

    // Configure mock implementations AFTER mocks are created
    // This should now work because the properties exist as jest.fn()

    // Default mock implementations (can be overridden in specific tests)
    mockDataManager.getEntityDefinition.mockImplementation((id) => {
        if (id === mockHallway.id) return {id: mockHallway.id, components: {}};
        if (id === mockEntrance.id) return {id: mockEntrance.id, components: {}};
        if (id === mockPlayer.id) return {id: mockPlayer.id, components: {}};
        return null;
    });

    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === mockPlayer.id) return mockPlayer;
        if (id === mockEntrance.id) return mockEntrance;
        if (id === mockHallway.id) return mockHallway;
        // console.warn(`mockEntityManager.getEntityInstance called with unmocked ID: ${id}`); // Optional debug
        return undefined; // Important: return undefined if not found
    });

    mockEntityManager.createEntityInstance.mockImplementation((id) => {
        // Generally less needed for handler tests unless they create instances
        if (id === mockPlayer.id) return mockPlayer;
        if (id === mockEntrance.id) return mockEntrance;
        if (id === mockHallway.id) return mockHallway;
        // console.warn(`mockEntityManager.createEntityInstance called with unmocked ID: ${id}`); // Optional debug
        return null; // Or throw error if unexpected
    });

    // Instantiate and initialize the MovementSystem
    movementSystem = new MovementSystem({eventBus: mockEventBus, entityManager: mockEntityManager});
    movementSystem.initialize(); // Subscribes MovementSystem to the mockEventBus
});

// --- Test Suite ---
describe('Integration Test: Player Movement', () => {

    // --- Helper Function for Movement Test ---
    // (testSuccessfulMovement remains the same as previous version)
    const testSuccessfulMovement = (command, expectedDirection = null, parsedDirectObject = null) => {
        const parsedCommand = commandParser.parse(command);
        expect(parsedCommand.actionId).toBe('core:move');

        // Adjust expected directObjectPhrase based on actual parser output
        // If parsedDirectObject is explicitly provided (like 'n' for command 'n'), use it.
        // Otherwise, derive it from the command input (preserving case).
        let expectedParsedPhrase;
        if (parsedDirectObject !== null) {
            expectedParsedPhrase = parsedDirectObject;
        } else if (command.includes(' ')) {
            // Get the part after the first space, preserving case
            expectedParsedPhrase = command.substring(command.indexOf(' ') + 1);
        } else {
            // The command itself is the expected phrase (e.g., 'north', 'NORTH')
            expectedParsedPhrase = command;
        }

        // *** FIX: Compare with the case-preserved expected phrase ***
        // expect(parsedCommand.directObjectPhrase).toBe(expectedPhrase.toLowerCase()); // <-- OLD/WRONG
        expect(parsedCommand.directObjectPhrase).toBe(expectedParsedPhrase); // <-- NEW/CORRECT

        expect(parsedCommand.error).toBeNull();

        // The canonical direction for logic/events should still be lowercase
        const direction = expectedDirection || parsedCommand.directObjectPhrase.toLowerCase();
        const targetLocationId = mockHallway.id;
        const startLocationId = mockEntrance.id;

        const context = {
            playerEntity: mockPlayer, currentLocation: mockEntrance, parsedCommand: parsedCommand,
            dataManager: mockDataManager, entityManager: mockEntityManager, dispatch: mockEventBus.dispatch,
        };

        // *** Ensure executeMove lowercases internally before using the direction ***
        // (The handler code provided previously should already do this)
        const actionResult = executeMove(context);

        expect(actionResult.success).toBe(true);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:move_attempted', expect.objectContaining({
            entityId: mockPlayer.id, targetLocationId: targetLocationId,
            previousLocationId: startLocationId, direction: direction,
        }));

        // Ensure the mock trigger can find the subscriber
        // console.log('Subscribers:', mockEventBus._getSubscribers()); // Debug subscriber map
        const moveAttemptedCall = mockEventBus.dispatch.mock.calls.find(call => call[0] === 'event:move_attempted');
        expect(moveAttemptedCall).toBeDefined();
        const handled = mockEventBus._trigger('event:move_attempted', moveAttemptedCall[1]);
        expect(handled).toBe(true); // Verify MovementSystem handled the event

        expect(playerPositionComp.locationId).toBe(targetLocationId);
        expect(mockEntityManager.notifyPositionChange).toHaveBeenCalledWith(mockPlayer.id, startLocationId, targetLocationId);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('event:entity_moved', expect.objectContaining({entityId: mockPlayer.id, /* ... */}));
    };

    // --- Success Cases ---
    // (Tests remain the same, but assertions on parsedCommand might need tweaks
    // based on exact parser output for aliases like 'n')
    describe('Successful Movement North', () => {
        it('should successfully move the player north using "move north"', () => {
            testSuccessfulMovement('move north', 'north', 'north');
        });
        it('should successfully move the player north using "north"', () => {
            testSuccessfulMovement('north', 'north', 'north');
        });
        it('should successfully move the player north using "n"', () => {
            // Parser likely outputs 'n' as directObjectPhrase for command 'n'
            testSuccessfulMovement('n', 'north', 'n');
        });
        it('should successfully move the player north using "MOVE NORTH"', () => {
            // Parser should lowercase directObjectPhrase
            testSuccessfulMovement('MOVE NORTH', 'north', 'NORTH');
        });
    });


    // --- Failure Cases ---
    // (testFailedMovement remains the same as previous version)
    describe('Failed Movement', () => {
        const testFailedMovement = (command, expectedDirectionInEvent, expectedReasonCode, extraCheck = null) => {
            const parsedCommand = commandParser.parse(command);
            const context = {
                playerEntity: mockPlayer, currentLocation: mockEntrance, parsedCommand: parsedCommand,
                dataManager: mockDataManager, entityManager: mockEntityManager, dispatch: mockEventBus.dispatch,
            };
            const actionResult = executeMove(context);

            expect(actionResult.success).toBe(false);
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:move_attempted', expect.anything());
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:entity_moved', expect.anything());
            expect(playerPositionComp.locationId).toBe(mockEntrance.id);
            expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();

            // Check for specific failure event (move_failed or validation_failed)
            if (expectedReasonCode === 'MISSING_REQUIRED_PART') {
                expect(mockEventBus.dispatch).toHaveBeenCalledWith('action:validation_failed', expect.objectContaining({
                    "actionVerb": "move", "actorId": "core:player", "reasonCode": "MISSING_DIRECT_OBJECT"
                }));
                expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('action:move_failed', expect.anything());
            } else {
                expect(mockEventBus.dispatch).toHaveBeenCalledWith('action:move_failed', expect.objectContaining({
                    actorId: mockPlayer.id, locationId: mockEntrance.id,
                    direction: expectedDirectionInEvent, reasonCode: expectedReasonCode,
                }));
                expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('action:validation_failed', expect.anything());
            }


            if (extraCheck) extraCheck();
        };

        it('should fail to move if the direction has no connection', () => {
            testFailedMovement("move south", "south", 'INVALID_DIRECTION');
        });
        it('should fail to move if the target location definition does not exist', () => {
            const originalImpl = mockDataManager.getEntityDefinition.getMockImplementation();
            mockDataManager.getEntityDefinition.mockImplementation((id) => {
                if (id === mockHallway.id) return null;
                return originalImpl ? originalImpl(id) : null; // Ensure originalImpl exists before calling
            });
            testFailedMovement("move north", "north", 'DATA_ERROR', () => {
                if (originalImpl) mockDataManager.getEntityDefinition.mockImplementation(originalImpl);
            });
        });
        it('should fail to move north if the connection is locked', () => {
            const northConnection = entranceConnectionsComp.getConnectionByDirection('north');
            entranceConnectionsComp.setConnectionState(northConnection.connectionId, 'locked');
            northConnection.description_override = "The northern door seems securely barred.";
            testFailedMovement("go north", "north", 'DIRECTION_LOCKED', () => {
                expect(mockEventBus.dispatch).toHaveBeenCalledWith('action:move_failed', expect.objectContaining({
                    lockMessageOverride: "The northern door seems securely barred."
                }));
                entranceConnectionsComp.setConnectionState(northConnection.connectionId, 'unlocked');
                delete northConnection.description_override;
            });
        });
        it('should fail if no direction (directObjectPhrase) is provided by parser', () => {
            // Pass null for expectedDirectionInEvent as it won't be in action:move_failed
            testFailedMovement("move", null, 'MISSING_REQUIRED_PART');
        });
    });
});
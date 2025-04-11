// src/test/integration/playerMovement.test.js

import {describe, it, expect, jest, beforeEach} from '@jest/globals';

// --- System/Functions Under Test ---
import CommandParser from '../../../commandParser.js';
// NOTE: The actual error "connectionsComp.getConnection is not a function"
// originates within this handler. It needs to be modified
// to use connectionsComp.getConnectionByDirection() or connectionsComp.getConnectionById().
import {executeMove} from '../../actions/handlers/moveActionHandler.js'; // The action handler
import MovementSystem from '../../systems/movementSystem.js'; // The system reacting to the event

// --- Components Used ---
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';

// --- Mocks Needed ---
// Mock Entity class (since entity.js is not provided)
jest.mock('../../entities/entity.js', () => {
    // console.log("Mocking Entity class..."); // Debug log
    return class MockEntity {
        constructor(id) {
            this.id = id;
            this._components = new Map();
            // console.log(`MockEntity created: ${id}`); // Debug log
        }

        addComponent(componentInstance, componentKey = null) {
            const key = componentKey || componentInstance.constructor;
            // console.log(`MockEntity [${this.id}]: Adding component`, key, componentInstance); // Debug log
            this._components.set(key, componentInstance);
            if (typeof componentInstance.setEntity === 'function') {
                componentInstance.setEntity(this);
            }
            if (typeof key === 'string') {
                this._components.set(key, componentInstance); // Add with string key too
            }
        }

        getComponent(ComponentClassOrKey) {
            // console.log(`MockEntity [${this.id}]: Getting component`, ComponentClassOrKey); // Debug log
            const component = this._components.get(ComponentClassOrKey);
            // console.log(`MockEntity [${this.id}]: Found component?`, !!component); // Debug log
            return component;
        }

        hasComponent(ComponentClassOrKey) {
            return this._components.has(ComponentClassOrKey);
        }

        toString() {
            return `MockEntity[id=${this.id}]`;
        }
    };
});
// Import the mocked Entity AFTER the jest.mock call
import MockEntity from '../../entities/entity.js'; // This will now be the MockEntity class

// Mock DataManager
const mockGetDataManager = () => ({
    getEntityDefinition: jest.fn((id) => {
        // Return simplified definitions needed for the test
        if (id === 'demo:room_entrance') return {id: 'demo:room_entrance', components: { /* data for Connections */}};
        if (id === 'demo:room_hallway') return {id: 'demo:room_hallway', components: { /* data for Connections */}};
        if (id === 'core:player') return {id: 'core:player', components: { /* data for Position */}};
        return null; // Not found
    }),
});

// Mock EntityManager
const mockGetEntityManager = () => ({
    createEntityInstance: jest.fn((id) => {
        if (id === 'core:player') return mockPlayer;
        if (id === 'demo:room_entrance') return mockEntrance;
        if (id === 'demo:room_hallway') return mockHallway;
        return null;
    }),
    getEntityInstance: jest.fn((id) => {
        if (id === 'core:player') return mockPlayer;
        if (id === 'demo:room_entrance') return mockEntrance;
        if (id === 'demo:room_hallway') return mockHallway;
        return undefined;
    }),
    registerComponent: jest.fn(),
    notifyPositionChange: jest.fn(),
});

// Mock EventBus
const mockGetEventBus = () => {
    const subscribers = new Map();
    return {
        dispatch: jest.fn(),
        subscribe: jest.fn((eventName, handler) => {
            if (!subscribers.has(eventName)) {
                subscribers.set(eventName, []);
            }
            subscribers.get(eventName).push(handler);
        }),
        _trigger: (eventName, payload) => {
            if (subscribers.has(eventName)) {
                subscribers.get(eventName).forEach(handler => handler(payload));
                return true;
            }
            return false;
        },
        _getSubscribers: () => subscribers,
    };
};

// --- Global Test Variables ---
let commandParser;
let mockDataManager;
let mockEntityManager;
let mockEventBus;
let movementSystem;

let mockPlayer;
let mockEntrance;
let mockHallway;
let playerPositionComp;
let entranceConnectionsComp; // Make component accessible for manipulation

// --- Test Setup ---
beforeEach(() => {
    // Reset mocks and systems for each test
    mockDataManager = mockGetDataManager();
    mockEntityManager = mockGetEntityManager();
    mockEventBus = mockGetEventBus();

    commandParser = new CommandParser();

    // Create mock entities *before* MovementSystem needs them
    mockPlayer = new MockEntity('core:player');
    mockEntrance = new MockEntity('demo:room_entrance');
    mockHallway = new MockEntity('demo:room_hallway');

    // Setup initial state: Player in Entrance, Entrance connects North to Hallway
    playerPositionComp = new PositionComponent({locationId: mockEntrance.id});
    mockPlayer.addComponent(playerPositionComp, PositionComponent);
    mockPlayer.addComponent(playerPositionComp, 'Position');


    // --- FIX: Added connectionId to prevent constructor error and allow targeting ---
    entranceConnectionsComp = new ConnectionsComponent({
        connections: [
            {
                connectionId: "entrance_north_passage", // Added ID
                direction: "north",
                target: mockHallway.id
                // Default state 'unlocked' will be added by constructor
            },
            // Add other connections if needed for different tests (e.g., a south one for failure case)
        ]
    });
    mockEntrance.addComponent(entranceConnectionsComp, ConnectionsComponent);
    mockEntrance.addComponent(entranceConnectionsComp, 'Connections');

    // Configure mock DataManager returns for the target location check
    mockDataManager.getEntityDefinition.mockImplementation((id) => {
        if (id === mockHallway.id) return {id: mockHallway.id, components: {}}; // Hallway exists
        if (id === mockEntrance.id) return {id: mockEntrance.id, components: {}};
        if (id === mockPlayer.id) return {id: mockPlayer.id, components: {}};
        return null;
    });

    // Configure mock EntityManager returns
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === mockPlayer.id) return mockPlayer;
        if (id === mockEntrance.id) return mockEntrance;
        if (id === mockHallway.id) return mockHallway;
        return undefined;
    });
    mockEntityManager.createEntityInstance.mockImplementation((id) => {
        if (id === mockPlayer.id) return mockPlayer;
        if (id === mockEntrance.id) return mockEntrance;
        if (id === mockHallway.id) return mockHallway;
        return null;
    });


    // Instantiate and initialize the MovementSystem AFTER mocks are ready
    movementSystem = new MovementSystem({
        eventBus: mockEventBus,
        entityManager: mockEntityManager,
    });
    movementSystem.initialize(); // This subscribes to the mockEventBus
});

// --- Test Suite ---
describe('Integration Test: Player Movement', () => {

    // --- Helper Function for Movement Test ---
    const testSuccessfulMovement = (command, expectedDirection = null) => {
        // 1. Parse Command
        const parsed = commandParser.parse(command);
        expect(parsed.actionId).toBe('core:action_move');
        expect(parsed.targets.length).toBeGreaterThanOrEqual(1);
        // Use provided expected direction or derive from first target
        const direction = expectedDirection || parsed.targets[0].toLowerCase();
        const targetLocationId = mockHallway.id; // Assuming North always goes to Hallway in this basic setup
        const startLocationId = mockEntrance.id;

        // 2. Prepare Action Context
        /** @type {import('../../actions/actionTypes.js').ActionContext} */
        const context = {
            playerEntity: mockPlayer,
            currentLocation: mockEntrance,
            targets: parsed.targets,
            dataManager: mockDataManager,
            entityManager: mockEntityManager,
            dispatch: mockEventBus.dispatch,
        };

        // 3. Execute Move Action Handler
        // IMPORTANT: If executeMove fails here with the TypeError,
        // ensure moveActionHandler.js uses getConnectionByDirection or ById.
        const actionResult = executeMove(context);

        // 4. Assert Action Handler Outcome
        expect(actionResult.success).toBe(true);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:move_attempted',
            expect.objectContaining({
                entityId: mockPlayer.id,
                targetLocationId: targetLocationId,
                previousLocationId: startLocationId,
                direction: direction,
            })
        );

        // 5. Simulate Event Bus Triggering the Movement System
        const moveAttemptedCall = mockEventBus.dispatch.mock.calls.find(
            call => call[0] === 'event:move_attempted'
        );
        expect(moveAttemptedCall).toBeDefined();
        const handled = mockEventBus._trigger('event:move_attempted', moveAttemptedCall[1]);
        expect(handled).toBe(true);

        // 6. Assert Final State and System Interactions
        expect(playerPositionComp.locationId).toBe(targetLocationId);
        expect(mockEntityManager.notifyPositionChange).toHaveBeenCalledWith(
            mockPlayer.id,
            startLocationId,
            targetLocationId
        );
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:entity_moved',
            expect.objectContaining({
                entityId: mockPlayer.id,
                newLocationId: targetLocationId,
                oldLocationId: startLocationId,
                direction: direction,
            })
        );
    };

    // --- Success Cases ---
    describe('Successful Movement North', () => {
        it('should successfully move the player north using "move north"', () => {
            testSuccessfulMovement('move north', 'north');
        });

        it('should successfully move the player north using "north"', () => {
            testSuccessfulMovement('north', 'north');
        });

        it('should successfully move the player north using "n"', () => {
            testSuccessfulMovement('n', 'north'); // Assuming 'n' is aliased
        });
    });


    // --- Failure Cases ---
    describe('Failed Movement', () => {
        it('should fail to move if the direction has no connection', () => {
            // 1. Parse Command
            const command = "move south"; // No south connection from entrance in default setup
            const parsed = commandParser.parse(command);
            expect(parsed.actionId).toBe('core:action_move');
            expect(parsed.targets).toEqual(['south']);

            // 2. Prepare Context
            const context = {
                playerEntity: mockPlayer,
                currentLocation: mockEntrance,
                targets: parsed.targets,
                dataManager: mockDataManager,
                entityManager: mockEntityManager,
                dispatch: mockEventBus.dispatch,
            };

            // 3. Execute Handler
            const actionResult = executeMove(context);

            // 4. Assert Handler Failure Outcome
            expect(actionResult.success).toBe(false);
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:move_attempted', expect.anything());
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:entity_moved', expect.anything());
            expect(playerPositionComp.locationId).toBe(mockEntrance.id); // Position unchanged
            expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
            // Optional: Check for specific failure event if moveActionHandler dispatches one
            // expect(mockEventBus.dispatch).toHaveBeenCalledWith('action:move_failed', expect.objectContaining({ reasonCode: 'NO_CONNECTION' }));
        });

        it('should fail to move if the target location definition does not exist', () => {
            // --- Setup Modification: Make Hallway definition invalid ---
            mockDataManager.getEntityDefinition.mockImplementation((id) => {
                if (id === mockEntrance.id) return {id: mockEntrance.id, components: {}};
                if (id === mockPlayer.id) return {id: mockPlayer.id, components: {}};
                if (id === mockHallway.id) return null; // Target definition missing
                return null;
            });

            // 1. Parse
            const command = "move north";
            const parsed = commandParser.parse(command);

            // 2. Context
            const context = {
                playerEntity: mockPlayer,
                currentLocation: mockEntrance,
                targets: parsed.targets,
                dataManager: mockDataManager,
                entityManager: mockEntityManager,
                dispatch: mockEventBus.dispatch,
            };

            // 3. Execute
            const actionResult = executeMove(context);

            // 4. Assert Failure
            expect(actionResult.success).toBe(false);
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:move_attempted', expect.anything());
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:entity_moved', expect.anything());
            expect(playerPositionComp.locationId).toBe(mockEntrance.id);
            expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
            // Optional: Check for specific failure event
            // expect(mockEventBus.dispatch).toHaveBeenCalledWith('action:move_failed', expect.objectContaining({ reasonCode: 'TARGET_NONEXISTENT' }));
        });

        it('should fail to move north if the connection is locked', () => {
            // --- Setup Modification: Lock the North connection ---
            // Use the accessible component instance from beforeEach
            const northConnection = entranceConnectionsComp.getConnectionByDirection('north'); // Find by direction is fine for test setup
            expect(northConnection).toBeDefined();

            // Directly modify the runtime state and add override for the test
            entranceConnectionsComp.setConnectionState(northConnection.connectionId, 'locked'); // Use the method to set state
            northConnection.description_override = "The northern door seems securely barred."; // Direct modification okay for override

            // Verify state change
            expect(entranceConnectionsComp.getConnectionState(northConnection.connectionId)).toBe('locked');

            // 1. Parse
            const command = "go north"; // Use alias
            const parsed = commandParser.parse(command);

            // 2. Context
            const context = {
                playerEntity: mockPlayer,
                currentLocation: mockEntrance,
                targets: parsed.targets,
                dataManager: mockDataManager,
                entityManager: mockEntityManager,
                dispatch: mockEventBus.dispatch,
            };

            // 3. Execute
            const actionResult = executeMove(context);

            // 4. Assert Failure
            expect(actionResult.success).toBe(false);
            expect(mockEventBus.dispatch).toHaveBeenCalledWith(
                'action:move_failed', // Assuming handler dispatches this event on failure
                expect.objectContaining({
                    actorId: mockPlayer.id,
                    locationId: mockEntrance.id,
                    direction: 'north',
                    reasonCode: 'DIRECTION_LOCKED', // Assuming this code is used
                    lockMessageOverride: "The northern door seems securely barred."
                })
            );
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:move_attempted', expect.anything());
            expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:entity_moved', expect.anything());
            expect(playerPositionComp.locationId).toBe(mockEntrance.id);
            expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
        });
    });
});
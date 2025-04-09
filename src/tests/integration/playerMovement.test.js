// src/test/integration/playerMovement.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// --- System/Functions Under Test ---
import CommandParser from '../../../commandParser.js';
import { executeMove } from '../../actions/handlers/moveActionHandler.js'; // The action handler
import MovementSystem from '../../systems/movementSystem.js'; // The system reacting to the event

// --- Components Used ---
import { PositionComponent } from '../../components/positionComponent.js';
import { ConnectionsComponent } from '../../components/connectionsComponent.js';
// Assuming a base Component class exists and doesn't need complex mocking
// If not, add: jest.mock('../../components/component.js');

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
            // Allow adding by instance directly (assumes component constructor sets its key if needed)
            // Or use an explicit key if provided (like from EntityManager)
            const key = componentKey || componentInstance.constructor; // Use constructor as key if no explicit key
            // console.log(`MockEntity [${this.id}]: Adding component`, key, componentInstance); // Debug log
            this._components.set(key, componentInstance);
            // Simulate linking entity back to component if needed (some components might do this)
            if (typeof componentInstance.setEntity === 'function') {
                componentInstance.setEntity(this);
            }
            // Special handling to mimic EntityManager's potential use of string keys from JSON
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

        // Optional: Helper for debugging tests
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
        if (id === 'demo:room_entrance') return { id: 'demo:room_entrance', components: { /* data for Connections */ } };
        if (id === 'demo:room_hallway') return { id: 'demo:room_hallway', components: { /* data for Connections */ } };
        if (id === 'core:player') return { id: 'core:player', components: { /* data for Position */ } };
        return null; // Not found
    }),
    // Add other methods if needed by handlers, returning mock values
});

// Mock EntityManager
const mockGetEntityManager = () => ({
    createEntityInstance: jest.fn((id) => {
        // Return pre-made mock entities for this test
        if (id === 'core:player') return mockPlayer;
        if (id === 'demo:room_entrance') return mockEntrance;
        if (id === 'demo:room_hallway') return mockHallway;
        return null;
    }),
    getEntityInstance: jest.fn((id) => {
        // Return pre-made mock entities
        if (id === 'core:player') return mockPlayer;
        if (id === 'demo:room_entrance') return mockEntrance;
        if (id === 'demo:room_hallway') return mockHallway;
        return undefined;
    }),
    registerComponent: jest.fn(), // Mocked, implementation not crucial for this test
    notifyPositionChange: jest.fn(), // We'll check if this is called
    // Add other methods if needed
});

// Mock EventBus
const mockGetEventBus = () => {
    const subscribers = new Map();
    return {
        dispatch: jest.fn(), // We'll check calls to this
        subscribe: jest.fn((eventName, handler) => {
            if (!subscribers.has(eventName)) {
                subscribers.set(eventName, []);
            }
            subscribers.get(eventName).push(handler);
            // console.log(`MockEventBus: Subscribed to ${eventName}`); // Debug log
        }),
        // Helper for tests to simulate event firing
        _trigger: (eventName, payload) => {
            // console.log(`MockEventBus: Triggering ${eventName} with payload:`, payload); // Debug log
            if (subscribers.has(eventName)) {
                subscribers.get(eventName).forEach(handler => handler(payload));
                return true; // Indicate event was handled
            }
            // console.log(`MockEventBus: No subscribers for ${eventName}`); // Debug log
            return false; // Indicate event had no subscribers
        },
        _getSubscribers: () => subscribers, // Helper for debugging tests
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
let playerPositionComp; // To easily access the player's position

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
    playerPositionComp = new PositionComponent({ locationId: mockEntrance.id });
    mockPlayer.addComponent(playerPositionComp, PositionComponent); // Add using class as key
    mockPlayer.addComponent(playerPositionComp, 'Position'); // Also add using string key if needed


    const entranceConnectionsComp = new ConnectionsComponent({
        connections: [
            { direction: "north", target: mockHallway.id },
            // Add other connections if needed for different tests
        ]
    });
    mockEntrance.addComponent(entranceConnectionsComp, ConnectionsComponent);
    mockEntrance.addComponent(entranceConnectionsComp, 'Connections'); // Also add using string key

    // Configure mock DataManager returns for the target location check
    mockDataManager.getEntityDefinition.mockImplementation((id) => {
        if (id === mockHallway.id) return { id: mockHallway.id, components: {} }; // Hallway exists
        if (id === mockEntrance.id) return { id: mockEntrance.id, components: {} };
        if (id === mockPlayer.id) return { id: mockPlayer.id, components: {} };
        return null;
    });

    // Configure mock EntityManager returns
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === mockPlayer.id) return mockPlayer;
        if (id === mockEntrance.id) return mockEntrance;
        if (id === mockHallway.id) return mockHallway; // Maybe needed if system looks up target loc
        return undefined;
    });
    mockEntityManager.createEntityInstance.mockImplementation((id) => { // Shouldn't be called in this flow, but mock defensively
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

    // Verify subscription happened (optional debug check)
    // console.log("Subscribers after movementSystem init:", mockEventBus._getSubscribers());
});

// --- Test Suite ---
describe('Integration Test: Player Movement (North)', () => {

    const testMovement = (command) => {
        // 1. Parse Command
        const parsed = commandParser.parse(command);
        expect(parsed.actionId).toBe('core:action_move');
        expect(parsed.targets.length).toBeGreaterThanOrEqual(1);
        const direction = parsed.targets[0].toLowerCase(); // 'north'

        // 2. Prepare Action Context
        /** @type {import('../../actions/actionTypes.js').ActionContext} */
        const context = {
            playerEntity: mockPlayer,
            currentLocation: mockEntrance, // Player starts in the entrance
            targets: parsed.targets, // e.g., ['north']
            dataManager: mockDataManager,
            entityManager: mockEntityManager,
            dispatch: mockEventBus.dispatch, // Pass the mock dispatch function
        };

        // 3. Execute Move Action Handler
        const actionResult = executeMove(context);

        // 4. Assert Action Handler Outcome
        expect(actionResult.success).toBe(true);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({ text: `You move ${direction}.`, type: 'info' })
        );
        // Check that the 'event:move_attempted' event was dispatched
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:move_attempted',
            expect.objectContaining({
                entityId: mockPlayer.id,
                targetLocationId: mockHallway.id,
                previousLocationId: mockEntrance.id,
                direction: direction,
            })
        );

        // 5. Simulate Event Bus Triggering the Movement System
        // Find the call to dispatch 'event:move_attempted'
        const moveAttemptedCall = mockEventBus.dispatch.mock.calls.find(
            call => call[0] === 'event:move_attempted'
        );
        expect(moveAttemptedCall).toBeDefined(); // Ensure the event was actually dispatched

        // Trigger the subscribed handler(s) - assumes MovementSystem subscribed correctly
        const handled = mockEventBus._trigger('event:move_attempted', moveAttemptedCall[1]); // Pass the payload
        expect(handled).toBe(true); // Ensure the MovementSystem's handler was called

        // 6. Assert Final State and System Interactions
        // Check player's PositionComponent was updated
        expect(playerPositionComp.locationId).toBe(mockHallway.id); // Player should now be in the hallway

        // Check EntityManager was notified
        expect(mockEntityManager.notifyPositionChange).toHaveBeenCalledWith(
            mockPlayer.id,
            mockEntrance.id, // Old location
            mockHallway.id   // New location
        );

        // Check 'entity_moved' event was dispatched by MovementSystem
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:entity_moved',
            expect.objectContaining({
                entityId: mockPlayer.id,
                newLocationId: mockHallway.id,
                oldLocationId: mockEntrance.id,
                direction: direction,
            })
        );
    };

    it('should successfully move the player north using "move north"', () => {
        testMovement('move north');
    });

    it('should successfully move the player north using "north"', () => {
        testMovement('north');
    });

    it('should successfully move the player north using "n"', () => {
        testMovement('n'); // Assuming 'n' is aliased to 'north' in CommandParser
    });

    // --- Add Failure Case Tests (Optional but Recommended) ---

    it('should fail to move if the direction has no connection', () => {
        // 1. Parse Command
        const parsed = commandParser.parse("move south"); // No south connection from entrance
        expect(parsed.actionId).toBe('core:action_move');
        expect(parsed.targets).toEqual(['south']);

        // 2. Prepare Context
        const context = { /* ...as above, currentLocation=mockEntrance... */
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
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({ text: "You can't go that way.", type: 'info' })
        );
        // Ensure move_attempted was *not* dispatched
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:move_attempted', expect.anything());
        // Ensure player position did *not* change
        expect(playerPositionComp.locationId).toBe(mockEntrance.id);
        // Ensure EM notification did *not* happen
        expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
    });

    it('should fail to move if the target location definition does not exist', () => {
        // --- Setup Modification: Make Hallway definition invalid ---
        mockDataManager.getEntityDefinition.mockImplementation((id) => {
            if (id === mockEntrance.id) return { id: mockEntrance.id, components: {} };
            if (id === mockPlayer.id) return { id: mockPlayer.id, components: {} };
            // Specifically return null for the hallway ID
            if (id === mockHallway.id) return null;
            return null;
        });

        // 1. Parse Command
        const parsed = commandParser.parse("move north");

        // 2. Prepare Context
        const context = { /* ...as above, currentLocation=mockEntrance... */
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
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({ text: "Something is wrong with the passage leading north.", type: 'error' }) // Match error message
        );
        // Ensure move_attempted was *not* dispatched
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith('event:move_attempted', expect.anything());
        // Ensure player position did *not* change
        expect(playerPositionComp.locationId).toBe(mockEntrance.id);
        // Ensure EM notification did *not* happen
        expect(mockEntityManager.notifyPositionChange).not.toHaveBeenCalled();
    });


});
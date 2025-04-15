// src/tests/integration/connectionLockUnlock.isolated.noKeyRequired.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';

// --- System Under Test (Indirectly via LockSystem) ---
// Note: We don't need EffectExecutionService or its handler for this specific test's logic
// because the test manually dispatches the 'event:lock_entity_attempt'.
import LockSystem from '../../../lockSystem.js'; // Real system to listen for events

// --- Mock Core Dependencies ---
const createMockEventBus = () => {
    const subscriptions = new Map();
    const dispatchedEventsLog = []; // Optional: Keep a log for easier debugging

    // Helper function to execute handlers, handling async
    const executeHandlers = async (eventName, eventData) => {
        if (subscriptions.has(eventName)) {
            const handlers = Array.from(subscriptions.get(eventName));
            await Promise.all(handlers.map(async (handler) => {
                try {
                    await handler(eventData);
                } catch (error) {
                    console.error(`[Test EventBus] Error in subscribed handler for ${eventName}:`, error);
                    // throw error; // Uncomment to make tests fail on handler errors
                }
            }));
        }
    };

    return {
        subscribe: jest.fn((eventName, handler) => {
            if (!subscriptions.has(eventName)) {
                subscriptions.set(eventName, new Set());
            }
            subscriptions.get(eventName).add(handler);
        }),
        unsubscribe: jest.fn((eventName, handler) => {
            if (subscriptions.has(eventName)) {
                subscriptions.get(eventName).delete(handler);
            }
        }),
        dispatch: jest.fn(async (eventName, data) => {
            dispatchedEventsLog.push({eventName, data});
            await executeHandlers(eventName, data);
        }),
        triggerSubscribedHandlers: async (eventName, eventData) => {
            await executeHandlers(eventName, eventData);
        },
        clearSubscriptions: () => subscriptions.clear(),
        getSubscriptions: () => subscriptions,
        getDispatchedEventsLog: () => dispatchedEventsLog,
    };
};

// Mock Entity Class
class MockEntity {
    constructor(id, name = 'Unknown Entity', components = {}) {
        this.id = id;
        this._components = new Map();
        if (!components.Name && !components.NameComponent) {
            components.Name = new NameComponent({value: name});
        }
        for (const key in components) {
            const componentInstance = components[key];
            const primaryKey = componentInstance.constructor?.name || key;
            this.addComponent(componentInstance, primaryKey);
        }
    }

    addComponent(componentInstance, componentKey = null) {
        const classKey = componentInstance.constructor;
        this._components.set(classKey, componentInstance);
        if (classKey && classKey.name) {
            this._components.set(classKey.name, componentInstance);
        }
        if (typeof componentKey === 'string' && componentKey !== classKey?.name) {
            this._components.set(componentKey, componentInstance);
        }
    }

    getComponent(ComponentClassOrKey) {
        if (typeof ComponentClassOrKey === 'function') {
            return this._components.get(ComponentClassOrKey);
        } else if (typeof ComponentClassOrKey === 'string') {
            return this._components.get(ComponentClassOrKey);
        }
        return undefined;
    }

    hasComponent(ComponentClassOrKey) {
        if (typeof ComponentClassOrKey === 'function') {
            return this._components.has(ComponentClassOrKey);
        } else if (typeof ComponentClassOrKey === 'string') {
            return this._components.has(ComponentClassOrKey);
        }
        return false;
    }

    toString() {
        const nameComp = this.getComponent('Name') || this.getComponent(NameComponent);
        const name = nameComp?.value || 'Unknown Name';
        return `MockEntity[id=${this.id}, name="${name}"]`;
    }
}

// --- Real Components (Needed by Systems/Entities) ---
// Minimal needed components for this specific test
import {NameComponent} from '../../components/nameComponent.js';
import LockableComponent from '../../components/lockableComponent.js'; // Real component

// --- Mock ObjectiveEventListenerService ---
const mockObjectiveEventListenerService = {
    handleEvent: jest.fn(), // Mock the function that would handle events like entity_locked
};

// --- Global Test Variables ---
let lockSystem; // Real instance
let mockEventBus;
let mockEntityManager;

// Mock Entities
let mockPlayer;
let mockBlockerEntity; // The actual door/lock entity

// Mock Entity IDs
const PLAYER_ID = 'player:1';
// const KEY_A_ID = 'test:keyA'; // Not strictly needed for *this* test, but keep for consistency if desired
const LOCKING_ITEM_ID = 'test:locking_item'; // Definition ID for locking item
const CONNECTION_ID = 'connection:door'; // Referenced in payload, keep definition
const BLOCKER_ID = 'blocker:door_lock';

// --- Test Setup ---
beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks between tests (especially important here)

    // --- 1. Mock Core Services ---
    mockEventBus = createMockEventBus();
    mockEntityManager = {
        getEntityInstance: jest.fn(),
        // Minimal registry needed for LockSystem
        componentRegistry: new Map([
            ['Name', NameComponent],
            ['Lockable', LockableComponent], // Needed by LockSystem
        ]),
    };

    // --- 2. Instantiate Real System with Mocks ---
    // Only LockSystem is directly tested via event dispatch here
    lockSystem = new LockSystem({eventBus: mockEventBus, entityManager: mockEntityManager});
    lockSystem.initialize(); // Subscribe LockSystem to events

    // --- 3. Setup Mock Entities SPECIFICALLY for this test ---
    mockPlayer = new MockEntity(PLAYER_ID, 'Player'); // PositionComponent not needed for this specific test flow

    // Blocker Entity - Initial state: UNLOCKED, NO KEY REQUIRED
    mockBlockerEntity = new MockEntity(BLOCKER_ID, 'Simple Latch', {
        Lockable: new LockableComponent({isLocked: false, keyId: null}) // <<< Key change: Start in the state needed by the test
    });

    // --- 4. Configure Mock EntityManager ---
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
        switch (id) {
            case PLAYER_ID:
                return mockPlayer;
            case BLOCKER_ID:
                return mockBlockerEntity;
            // We don't need the Connection entity for this test as we dispatch directly to the Blocker
            default:
                return undefined;
        }
    });

    // --- 5. Mock Objective Listener (Subscribe to Event Bus) ---
    // Simulate downstream system listening for lock success
    mockEventBus.subscribe('event:entity_locked', mockObjectiveEventListenerService.handleEvent);

    // --- 6. Spy on LockableComponent Methods ---
    // Spy on the *instance* of the component attached to the mock entity
    jest.spyOn(mockBlockerEntity.getComponent(LockableComponent), 'lock');
    // No need to spy on unlock for this specific test
});

// Teardown
afterEach(() => {
    lockSystem.shutdown(); // Unsubscribe LockSystem listeners
    jest.restoreAllMocks(); // Restore original implementations spied on
});

// --- Test Suite ---
describe('Isolated Integration Test: Lock Unlocked Connection (No Key Required)', () => {

    // We don't need createEffectContext as we are manually dispatching the event LockSystem listens for.

    // ========================================================================
    // == The Isolated Test Case ==============================================
    // ========================================================================
    it('Test Case: Lock Unlocked Connection (No Key Required) -> Success', async () => {
        // Setup: Blocker starts unlocked, requires no key (handled in beforeEach). Player attempts lock without key.

        // Get the component instance to check state and spy calls
        const lockableComponent = mockBlockerEntity.getComponent(LockableComponent);

        // *** Verify the STARTING state *** (Ensures beforeEach is correct)
        expect(lockableComponent.isLocked).toBe(false);
        expect(lockableComponent.keyId).toBe(null);

        // --- Define the event payload LockSystem will receive ---
        // This simulates what handleTriggerEventEffect *would* have dispatched if it were involved.
        const lockAttemptPayload = {
            userId: PLAYER_ID,
            targetEntityId: BLOCKER_ID,
            keyItemId: null, // No key being used
            _sourceConnectionId: CONNECTION_ID, // Keep for potential context, though not strictly needed by LockSystem itself
            _sourceItemId: LOCKING_ITEM_ID,
            _sourceItemDefinitionId: null
        };

        // --- ACTION: Dispatch the event directly to the Event Bus ---
        await mockEventBus.dispatch('event:lock_entity_attempt', lockAttemptPayload);

        // --- Verify Action and FINAL State ---

        // Verify: LockSystem receives event:lock_entity_attempt. (Implicitly tested by subsequent checks)
        // Verify: LockSystem calls blocker.LockableComponent.lock(null).
        expect(lockableComponent.lock).toHaveBeenCalledTimes(1);
        expect(lockableComponent.lock).toHaveBeenCalledWith(null); // Key irrelevant/null

        // Verify: LockableComponent returns { success: true }. (Check FINAL state)
        expect(lockableComponent.isLocked).toBe(true); // It should be locked AFTER the action

        // Verify: LockSystem dispatches event:entity_locked.
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'event:entity_locked',
            expect.objectContaining({
                userId: PLAYER_ID,
                targetEntityId: BLOCKER_ID,
                keyItemId: null
            })
        );

        // Verify: LockSystem dispatches success UI message.
        const blockerName = mockBlockerEntity.getComponent(NameComponent).value;
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
            'ui:message_display',
            expect.objectContaining({
                text: `You lock the ${blockerName}.`,
                type: 'success'
            })
        );

        // Verify: Downstream listener (mock ObjectiveEventListenerService) called ONCE for event:entity_locked.
        expect(mockObjectiveEventListenerService.handleEvent).toHaveBeenCalledTimes(1);
        expect(mockObjectiveEventListenerService.handleEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                targetEntityId: BLOCKER_ID // Ensure the event it received was for the correct entity
            })
        );
    }); // End of the isolated test case

});
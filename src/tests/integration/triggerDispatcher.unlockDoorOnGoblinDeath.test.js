// __tests__/integration/triggerDispatcher.unlockDoorOnGoblinDeath.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Purpose: prove that a trigger can *force‑unlock* a keyed door when the
//          goblin dies, even though the door requires a specific key.
//
//  * The door starts locked and has a keyId that does NOT exist in the world
//    (to guarantee there is *no* matching key instance during the test).
//  * The trigger fires on EVENT_ENTITY_DIED where deceasedEntityId is the
//    goblin, and emits **event:unlock_entity_force**.
//  * The LockSystem handler for event:unlock_entity_force bypasses
//    key checks and unlocks the door immediately.
//  * The test asserts both that EVENT_ENTITY_UNLOCKED is produced (with force:true),
//    and that the LockableComponent state flips to `isLocked: false`.
// ─────────────────────────────────────────────────────────────────────────────

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import TriggerDispatcher from '../../systems/triggerDispatcher.js';
import LockSystem from '../../systems/lockSystem.js'; // <<< Assuming LockSystem.js path is correct

import LockableComponent from '../../components/lockableComponent.js';
import {NameComponent} from '../../components/nameComponent.js';

import {
    EVENT_ENTITY_DIED,
    EVENT_ENTITY_UNLOCKED,
    // EVENT_UNLOCK_ENTITY_FORCE // <<< No longer needed for direct subscription in test
} from '../../types/eventTypes.js';

import {waitForEvent} from '../testUtils.js';

/* -------------------------------------------------------------------------
 * 1️⃣  Minimal test data ----------------------------------------------------*/

const TRIGGER_DEF = {
    id: 'demo:trigger_unlock_treasure_door_on_goblin_death',
    listen_to: {
        event_type: EVENT_ENTITY_DIED,
        filters: {deceasedEntityId: 'demo:enemy_goblin'}
    },
    effects: [
        {
            type: 'trigger_event',
            parameters: {
                eventName: 'event:unlock_entity_force', // <<< The trigger dispatches this
                payload: {
                    targetEntityId: 'demo:door_treasure_room'
                }
            }
        }
    ],
    one_shot: true
};

const makeMockDataManager = () => {
    const entities = new Map([
        [
            'demo:door_treasure_room',
            {
                id: 'demo:door_treasure_room',
                components: {
                    Name: {value: 'Sturdy Wooden Door'},
                    Lockable: {
                        isLocked: true,
                        keyId: 'demo:legendary_key'   // ← key that will never exist
                    }
                }
            }
        ]
    ]);

    return {
        getAllTriggers: () => [TRIGGER_DEF],
        getEntityDefinition: (id) => entities.get(id),
        entities // Keep if EntityManager needs it directly
    };
};

/* -------------------------------------------------------------------------
 * 2️⃣  Test suite -----------------------------------------------------------*/

describe('Force‑unlock keyed door on goblin death (via LockSystem)', () => {
    let bus, em, data, dispatcher, lockSystem, spy;

    beforeEach(() => {
        data = makeMockDataManager();
        bus = new EventBus();
        em = new EntityManager(data);

        // Register only what we need for the door instance
        em.registerComponent('Name', NameComponent);
        em.registerComponent('Lockable', LockableComponent);

        // Wire systems
        dispatcher = new TriggerDispatcher({eventBus: bus, dataManager: data, entityManager: em});
        lockSystem = new LockSystem({eventBus: bus, entityManager: em}); // <<< Real LockSystem

        // --- REMOVED ---
        // The manual subscription block for 'event:unlock_entity_force' is gone.
        // We now rely on lockSystem.initialize() to correctly subscribe
        // its internal _handleForceUnlock method.
        // --- /REMOVED ---

        // Initialize systems AFTER they are created
        dispatcher.initialize();
        lockSystem.initialize(); // <<< This registers the REAL force-unlock handler

        // Seed the locked door into the world
        em.createEntityInstance('demo:door_treasure_room');

        // Spy on the event bus to verify dispatched events
        spy = jest.spyOn(bus, 'dispatch');
    });

    afterEach(() => {
        spy.mockRestore();
        // Ensure systems are shut down cleanly
        dispatcher.shutdown();
        lockSystem.shutdown();
        em.clearAll();
    });

    it('unlocks the treasure room door via EVENT_UNLOCK_ENTITY_FORCE handled by LockSystem', async () => {
        // 1. Preconditions
        const door = em.getEntityInstance('demo:door_treasure_room');
        expect(door).toBeDefined(); // Good practice to ensure entity exists
        expect(door.getComponent(LockableComponent).isLocked).toBe(true);

        // 2. Act – kill the goblin, which triggers the event dispatch via TriggerDispatcher
        await bus.dispatch(EVENT_ENTITY_DIED, {
            deceasedEntityId: 'demo:enemy_goblin',
            killerEntityId: null
        });

        // 3. Assert – EVENT_ENTITY_UNLOCKED is fired by LockSystem._handleForceUnlock
        //    Note: The trigger dispatches 'event:unlock_entity_force',
        //          LockSystem handles it and dispatches EVENT_ENTITY_UNLOCKED.
        await waitForEvent(
            spy,
            EVENT_ENTITY_UNLOCKED, // <<< We expect this event from LockSystem
            expect.objectContaining({
                targetEntityId: 'demo:door_treasure_room',
                force: true // <<< Check the force flag is correctly passed through
            }),
            500 // Timeout
        );

        // 4. Assert – component state flipped by LockSystem._handleForceUnlock
        //    Need to re-fetch the component instance in case it was modified.
        const finalLockState = em.getEntityInstance('demo:door_treasure_room').getComponent(LockableComponent);
        expect(finalLockState.isLocked).toBe(false);

        // 5. Safety – check trigger is one‑shot (no change needed here)
        spy.mockClear();
        await bus.dispatch(EVENT_ENTITY_DIED, {deceasedEntityId: 'demo:enemy_goblin'});
        // We should not see *another* EVENT_ENTITY_UNLOCKED because the trigger is one-shot
        // and should have been deactivated after the first firing.
        expect(spy).not.toHaveBeenCalledWith(
            EVENT_ENTITY_UNLOCKED,
            expect.objectContaining({targetEntityId: 'demo:door_treasure_room'})
        );
        // Optionally, also check that 'event:unlock_entity_force' wasn't dispatched again
        expect(spy).not.toHaveBeenCalledWith(
            'event:unlock_entity_force', // The event dispatched *by* the trigger
            expect.anything()
        );
    });
});
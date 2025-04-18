// src/tests/integration/triggerDispatcher.deadGoblinTriggersDoorUnlock.test.js

// Integration test: when demo:enemy_goblin dies, the treasure‑room door is unlocked
// ────────────────────────────────────────────────────────────────────────────────

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// Core engine modules
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';

// Systems under test
import TriggerDispatcher from '../../systems/triggerDispatcher.js';
import LockSystem from '../../systems/lockSystem.js';

// Components used in the door entity
import LockableComponent from '../../components/lockableComponent.js';
import {NameComponent} from '../../components/nameComponent.js';

// Event constants
import {
    EVENT_ENTITY_DIED,
    EVENT_ENTITY_UNLOCKED
} from '../../types/eventTypes.js';

// Utility helper shared by the other integration‑test suite
import {waitForEvent} from '../testUtils.js';

/**
 * Minimal trigger definition exactly as it exists in `data/triggers/…`.
 * One‑shot behaviour is preserved so we also implicitly verify it only fires once.
 */
const TRIGGER_DEF = {
    id: 'demo:trigger_unlock_treasure_door_on_goblin_death',
    listen_to: {
        event_type: 'event:entity_died',
        filters: {
            deceasedEntityId: 'demo:enemy_goblin'
        }
    },
    effects: [
        {
            type: 'trigger_event',
            parameters: {
                eventName: 'event:unlock_entity_attempt',
                payload: {
                    userId: null,
                    targetEntityId: 'demo:door_treasure_room',
                    keyItemId: null
                }
            }
        }
    ],
    one_shot: true
};

/**
 * A *very* lean mock of GameDataRepository just sufficient for TriggerDispatcher and
 * EntityManager to operate.  We stub only the methods actually invoked.
 */
const createMockGameDataRepository = () => {
    // 👉  Door definition includes the _locked_ state we expect to change
    const entities = new Map([
        [
            'demo:door_treasure_room',
            {
                id: 'demo:door_treasure_room',
                components: {
                    Name: {value: 'Sturdy Wooden Door'},
                    Lockable: {isLocked: true, keyId: null}
                }
            }
        ],
        // The goblin does not need any components for this test – it never gets
        // instantiated – but we include a shell definition in case something looks
        // it up.
        [
            'demo:enemy_goblin',
            {
                id: 'demo:enemy_goblin',
                components: {Name: {value: 'Goblin'}}
            }
        ]
    ]);

    return {
        // TriggerDispatcher API
        getAllTriggers: () => [TRIGGER_DEF],

        // EntityManager API
        getEntityDefinition: (id) => entities.get(id),

        // Expose raw maps for completeness – not actually used by the code‑under‑test
        triggers: new Map([[TRIGGER_DEF.id, TRIGGER_DEF]]),
        entities
    };
};

// ────────────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────────────

describe('Trigger → LockSystem integration – unlock treasure door on goblin death', () => {
    let eventBus;
    let entityManager;
    let mockGameDataRepository;
    let triggerDispatcher;
    let lockSystem;
    let dispatchSpy;

    beforeEach(() => {
        // Core plumbing
        mockGameDataRepository = createMockGameDataRepository();
        eventBus = new EventBus();
        entityManager = new EntityManager(mockGameDataRepository);

        // Register only the components we actually instantiate
        entityManager.registerComponent('Name', NameComponent);
        entityManager.registerComponent('Lockable', LockableComponent);

        // Systems under test
        triggerDispatcher = new TriggerDispatcher({
            eventBus,
            gameDataRepository: mockGameDataRepository,
            entityManager
        });

        lockSystem = new LockSystem({eventBus, entityManager});

        triggerDispatcher.initialize();
        lockSystem.initialize();

        // Seed the world with the locked door entity
        const doorEntity = entityManager.createEntityInstance('demo:door_treasure_room');
        expect(doorEntity.getComponent(LockableComponent).isLocked).toBe(true);

        // Spy after systems are wired so we can observe _all_ dispatches
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
    });

    afterEach(() => {
        dispatchSpy.mockRestore();
        triggerDispatcher.shutdown();
        lockSystem.shutdown();
        entityManager.clearAll();
    });

    it('unlocks the treasure‑room door exactly once when the goblin dies', async () => {
        // Act: simulate the goblin's death
        await eventBus.dispatch(EVENT_ENTITY_DIED, {
            deceasedEntityId: 'demo:enemy_goblin',
            killerEntityId: null
        });

        // Assert part 1 – EVENT_ENTITY_UNLOCKED is eventually fired with correct target
        /** @type {import('../../types/eventTypes.js').EntityUnlockedEventPayload} */
        const unlockedPayload = await waitForEvent(
            dispatchSpy,
            EVENT_ENTITY_UNLOCKED,
            expect.objectContaining({targetEntityId: 'demo:door_treasure_room'}),
            500
        );

        expect(unlockedPayload).toBeDefined();

        // Assert part 2 – the LockableComponent state actually flipped to unlocked
        const doorPost = entityManager.getEntityInstance('demo:door_treasure_room');
        expect(doorPost.getComponent(LockableComponent).isLocked).toBe(false);

        // Assert part 3 – one‑shot safety: a second death event should NOT unlock again
        dispatchSpy.mockClear();
        await eventBus.dispatch(EVENT_ENTITY_DIED, {
            deceasedEntityId: 'demo:enemy_goblin',
            killerEntityId: null
        });

        // No further unlock events expected
        expect(dispatchSpy).not.toHaveBeenCalledWith(
            EVENT_ENTITY_UNLOCKED,
            expect.anything()
        );
    });
});

// __tests__/integration/use‑rusty‑on‑north.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Integration test: “use rusty on north” should unlock the blocking door
// Ticket: USE‑INT‑DIR‑01
// ─────────────────────────────────────────────────────────────────────────────

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import {executeUse} from '../../actions/handlers/useActionHandler.js';
import ItemUsageSystem from '../../systems/itemUsageSystem.js';
import {ItemTargetResolverService} from '../../services/itemTargetResolver.js';
import LockSystem from '../../systems/lockSystem.js';
import {NotificationUISystem} from '../../systems/notificationUISystem.js';

import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import DefinitionRefComponent from '../../components/definitionRefComponent.js';
import LockableComponent from '../../components/lockableComponent.js';
import OpenableComponent from '../../components/openableComponent.js';
import {UsableComponent} from '../../components/usableComponent.js';

import {
    EVENT_ITEM_USE_ATTEMPTED,
    EVENT_UNLOCK_ENTITY_ATTEMPT,
    EVENT_ENTITY_UNLOCKED,
    EVENT_DISPLAY_MESSAGE
} from '../../types/eventTypes.js';

import {getDisplayName} from '../../utils/messages.js';
import {waitForEvent} from '../testUtils.js';

/* ────────────────── Minimal DataManager stub ─────────────────────────── */

const mockDataManager = {
    actions: new Map([['core:use', {id: 'core:use', commands: ['use', 'u']}]]),

    /** Return a very small “definition” object for the requested id. */
    getEntityDefinition: (id) => {
        switch (id) {
            case 'demo:item_key_rusty':
                return {
                    id,
                    components: {
                        Name: {value: 'Rusty Key'},
                        Item: {},
                        Usable: {
                            target_required: true,
                            consume_on_use: false,

                            /*  ←─────── FIX: proper target_conditions ───────→ */
                            target_conditions: [
                                {
                                    condition_type: 'target_has_property',
                                    property_path: 'id',
                                    expected_value: 'demo:door_exit_north'
                                },
                                {
                                    condition_type: 'target_has_property',
                                    property_path: 'Lockable.isLocked',
                                    expected_value: true
                                }
                            ],
                            /*  ←──────────────────────────────────────────────→ */

                            effects: [{
                                type: 'trigger_event',
                                parameters: {
                                    eventName: EVENT_UNLOCK_ENTITY_ATTEMPT,
                                    payload: {}
                                }
                            }]
                        }
                    }
                };

            case 'demo:door_exit_north':
                return {
                    id,
                    components: {
                        Name: {value: 'Heavy Door'},
                        Lockable: {isLocked: true, keyId: 'demo:item_key_rusty'},
                        Openable: {isOpen: false}
                    }
                };

            case 'demo:room_exit':
                return {id, components: {Name: {value: 'Exit'}, Connections: {}}};

            case 'player_def':
                return {id, components: {Name: {value: 'Player'}, Inventory: {items: []}}};

            default:
                return {id, components: {}};
        }
    },

    getPlayerId: () => 'player'
};

/* ────────────────── ConditionEvaluation stub with logic ──────────────── */

/* It understands just enough for this test:                               *
 *   • player_in_location                                                  *
 *   • target_has_property   (id / Lockable.isLocked)                      */

function makeMockConditionEvaluator(entityManager) {
    return {
        /**
         * @param {import('../../entities/entity.js').default} userEntity
         * @param {{targetEntityContext?: any}} ctx
         * @param {Array<object>} conds
         * @param {object} [opt]
         */
        evaluateConditions(userEntity, ctx, conds = [], opt = {}) {
            const messages = [];
            const target = ctx?.targetEntityContext ?? null;
            let success = true;
            for (const c of conds) {
                switch (c.condition_type) {
                    case 'player_in_location': {
                        const locId = userEntity.getComponent(PositionComponent)?.locationId;
                        if (locId !== c.location_id) success = false;
                        break;
                    }

                    case 'target_has_property': {
                        if (!target) {
                            success = false;
                            break;
                        }
                        if (c.property_path === 'id') {
                            if (target.id !== c.expected_value) success = false;
                        } else if (c.property_path === 'Lockable.isLocked') {
                            const isLocked = target.getComponent(LockableComponent)?.isLocked;
                            if (isLocked !== c.expected_value) success = false;
                        }
                        break;
                    }

                    default:
                        // Unknown condition type – treat as passed so the stub
                        // doesn’t block future tests that don’t need the check.
                        break;
                }
                if (!success) break;
            }
            return {success, messages};
        }
    };
}

/* ────────────────── Convenience helper to create entities ─────────────── */

import {setupEntity as make} from '../testUtils.js';

/* ======================================================================== */
describe('USE‑INT‑DIR‑01 ➜ “use rusty on north” unlocks the blocking door', () => {

    let em, bus, parser, exec;
    let itemUsageSystem, lockSystem, uiSystem;
    let spy;

    // World state refs for assertions
    let player, roomExit, connNorth, doorNorth, keyInst;

    beforeEach(() => {
        /* --- core plumbing --- */
        em = new EntityManager(mockDataManager);
        bus = new EventBus();
        parser = new CommandParser(mockDataManager);
        exec = new ActionExecutor();

        /* --- component registration (only those used directly) --- */
        em.registerComponent('NameComponent', NameComponent);
        em.registerComponent('DescriptionComponent', DescriptionComponent);
        em.registerComponent('PositionComponent', PositionComponent);
        em.registerComponent('ConnectionsComponent', ConnectionsComponent);
        em.registerComponent('PassageDetailsComponent', PassageDetailsComponent);
        em.registerComponent('InventoryComponent', InventoryComponent);
        em.registerComponent('ItemComponent', ItemComponent);
        em.registerComponent('LockableComponent', LockableComponent);
        em.registerComponent('OpenableComponent', OpenableComponent);
        em.registerComponent('Usable', UsableComponent);
        em.registerComponent('DefinitionRefComponent', DefinitionRefComponent);

        /* --- realistic ConditionEvaluationService stub --- */
        const mockCE = makeMockConditionEvaluator(em);

        const targetResolver = new ItemTargetResolverService({
            entityManager: em,
            eventBus: bus,
            conditionEvaluationService: mockCE
        });

        itemUsageSystem = new ItemUsageSystem({
            eventBus: bus,
            entityManager: em,
            dataManager: mockDataManager,
            conditionEvaluationService: mockCE,
            itemTargetResolverService: targetResolver
        });

        lockSystem = new LockSystem({eventBus: bus, entityManager: em});
        uiSystem = new NotificationUISystem({eventBus: bus, dataManager: mockDataManager});
        lockSystem.initialize();
        uiSystem.initialize();

        exec.registerHandler('core:use', executeUse);

        /* ----- world layout ----- */
        roomExit = make(em, 'demo:room_exit', 'Exit', [
            new DescriptionComponent({text: 'Exit room.'}),
            new ConnectionsComponent({connections: {north: 'demo:conn_exit_outside'}})
        ]);

        connNorth = make(em, 'demo:conn_exit_outside', 'North Passage', [
            new PassageDetailsComponent({
                locationAId: roomExit.id,
                locationBId: 'demo:room_outside',
                directionAtoB: 'north',
                directionBtoA: 'south',
                blockerEntityId: 'demo:door_exit_north',
                type: 'doorway'
            })
        ]);

        doorNorth = make(em, 'demo:door_exit_north', 'Heavy Door', [
            new LockableComponent({isLocked: true, keyId: 'demo:item_key_rusty'}),
            new OpenableComponent({isOpen: false})
        ], roomExit.id);

        keyInst = make(em, 'key_rusty_inst', 'Rusty Key', [
            new ItemComponent({}),
            new DefinitionRefComponent('demo:item_key_rusty')
        ]);

        player = make(em, 'player', 'Player', [
            new InventoryComponent({items: [keyInst.id]}),
            new PositionComponent({locationId: roomExit.id})
        ], roomExit.id);

        // sanity
        expect(doorNorth.getComponent(LockableComponent).isLocked).toBe(true);

        spy = jest.spyOn(bus, 'dispatch');
    });

    afterEach(() => {
        spy.mockRestore();
        lockSystem.shutdown();
        uiSystem.shutdown();
        em.clearAll();
    });

    const run = async cmd => {
        const parsed = parser.parse(cmd);
        return exec.executeAction(parsed.actionId, {
            playerEntity: player,
            currentLocation: roomExit,
            parsedCommand: parsed,
            dataManager: mockDataManager,
            entityManager: em,
            eventBus: bus
        });
    };

    it('unlocks the north door when the command is executed', async () => {
        spy.mockClear();

        expect(bus.listenerCount(EVENT_ITEM_USE_ATTEMPTED)).toBeGreaterThan(0);
        
        const res = await run('use rusty on north');
        expect(res.success).toBe(true);

        /* 1️⃣ item‑use attempt (targets the connection) */
        await waitForEvent(
            spy,
            EVENT_ITEM_USE_ATTEMPTED,
            expect.objectContaining({
                userEntityId: player.id,
                itemInstanceId: keyInst.id,
                explicitTargetConnectionEntityId: connNorth.id
            }),
            500
        );

        /* 2️⃣ unlock attempt (targets the door) */
        await waitForEvent(
            spy,
            EVENT_UNLOCK_ENTITY_ATTEMPT,
            expect.objectContaining({
                validatedTargetId: doorNorth.id,
                itemInstanceId: keyInst.id
            }),
            500
        );

        /* 3️⃣ door actually unlocked + success UI */
        await waitForEvent(
            spy,
            EVENT_ENTITY_UNLOCKED,
            expect.objectContaining({targetEntityId: doorNorth.id}),
            500
        );

        await waitForEvent(
            spy,
            EVENT_DISPLAY_MESSAGE,
            {text: `You unlock the ${getDisplayName(doorNorth)}.`, type: 'success'},
            500
        );

        expect(doorNorth.getComponent(LockableComponent).isLocked).toBe(false);
    });
});
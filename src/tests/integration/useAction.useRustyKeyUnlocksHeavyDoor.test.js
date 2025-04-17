// __tests__/integration/useAction.useRustyKeyUnlocksHeavyDoor.test.js
// -----------------------------------------------------------------------------
// PROOF‑OF‑BEHAVIOUR  ➜  When the player is in demo:room_exit and enters the
// command "use rusty on heavy" (or "use rusty on north"), the Heavy Door
// (demo:door_exit_north) becomes unlocked.
// -----------------------------------------------------------------------------
// ‣ The key instance is demo:item_key_rusty held in the player's inventory.
// ‣ The Heavy Door sits in demo:room_exit and blocks the north connection.
// ‣ The test asserts the full event chain and final LockableComponent state.
// -----------------------------------------------------------------------------
// 2025‑04‑17  •  Jon’s requested integration test
// -----------------------------------------------------------------------------

import {jest, describe, it, beforeEach, afterEach, expect} from "@jest/globals";

// ────────────────── Core engine plumbing ─────────────────────────────────────
import CommandParser from "../../core/commandParser.js";
import ActionExecutor from "../../actions/actionExecutor.js";
import EventBus from "../../core/eventBus.js";
import EntityManager from "../../entities/entityManager.js";

// Systems
import ItemUsageSystem from "../../systems/itemUsageSystem.js";
import LockSystem from "../../systems/lockSystem.js";
import {NotificationUISystem} from "../../systems/notificationUISystem.js";
import {ItemTargetResolverService} from "../../services/itemTargetResolver.js";

// Action handler under test
import {executeUse} from "../../actions/handlers/useActionHandler.js";

// Components
import {NameComponent} from "../../components/nameComponent.js";
import {DescriptionComponent} from "../../components/descriptionComponent.js";
import {PositionComponent} from "../../components/positionComponent.js";
import {ConnectionsComponent} from "../../components/connectionsComponent.js";
import {PassageDetailsComponent} from "../../components/passageDetailsComponent.js";
import {InventoryComponent} from "../../components/inventoryComponent.js";
import {ItemComponent} from "../../components/itemComponent.js";
import DefinitionRefComponent from "../../components/definitionRefComponent.js";
import LockableComponent from "../../components/lockableComponent.js";
import OpenableComponent from "../../components/openableComponent.js";

// Event constants
import {
    EVENT_ITEM_USE_ATTEMPTED, EVENT_UNLOCK_ENTITY_ATTEMPT, EVENT_ENTITY_UNLOCKED, EVENT_DISPLAY_MESSAGE,
} from "../../types/eventTypes.js";

// Convenience helpers shared by other integration suites
import {waitForEvent, setupEntity as make} from "../testUtils.js";
import {TARGET_MESSAGES, getDisplayName} from "../../utils/messages.js";

// Helper to fabricate a minimal yet realistic ConditionEvaluationService
function makeAlwaysPassConditionEvaluator() {
    return {
        evaluateConditions: () => ({success: true, messages: []}),
    };
}

// Minimal DataManager stub with the exact real entity definitions relevant to the test.
function makeMockDataManager() {
    const defs = new Map([["demo:item_key_rusty", {
        id: "demo:item_key_rusty", components: {
            Name: {value: "Rusty Key"}, Description: {text: "An old, rusty iron key."}, Item: {}, Usable: {
                target_required: true, effects: [{
                    type: "trigger_event", parameters: {
                        eventName: EVENT_UNLOCK_ENTITY_ATTEMPT, payload: {},
                    },
                },],
            },
        },
    },], ["demo:door_exit_north", {
        id: "demo:door_exit_north", components: {
            Name: {value: "Heavy Door"},
            Description: {text: "A heavy door you can't budge."},
            Lockable: {isLocked: true, keyId: "demo:item_key_rusty"},
            Openable: {isOpen: false},
        },
    },], ["demo:conn_exit_outside", {
        id: "demo:conn_exit_outside", components: {
            PassageDetails: {
                locationAId: "demo:room_exit",
                locationBId: "demo:room_outside",
                directionAtoB: "north",
                directionBtoA: "south",
                blockerEntityId: "demo:door_exit_north",
                type: "doorway",
            },
        },
    },], ["demo:room_exit", {
        id: "demo:room_exit", components: {
            Name: {value: "Exit"}, Description: {
                text: "You have reached the dungeon’s exit. Sunlight pours in from a rocky opening.",
            }, Connections: {
                connections: {
                    south: "demo:conn_treasure_exit", north: "demo:conn_exit_outside",
                },
            },
        },
    },], ["player_def", {id: "player_def", components: {Name: {value: "Player"}}}],]);

    return {
        actions: new Map([["core:use", {id: "core:use", commands: ["use", "u"]}]]),
        getEntityDefinition: (id) => defs.get(id) || {id, components: {}},
        getPlayerId: () => "player",
    };
}

// ============================================================================
// Test suite
// ============================================================================

describe("Integration ➜ Use Rusty Key to unlock Heavy Door", () => {
    let em, bus, parser, exec;
    let itemUsageSystem, lockSystem, uiSystem;
    let condEval, targetResolver;
    let player, roomExit, door, connNorth, keyInst;
    let spy;

    beforeEach(() => {
        // Core plumbing
        const data = makeMockDataManager();
        bus = new EventBus();
        em = new EntityManager(data);
        parser = new CommandParser(data);
        exec = new ActionExecutor();

        // Register the components we will instantiate
        em.registerComponent("Name", NameComponent);
        em.registerComponent("Description", DescriptionComponent);
        em.registerComponent("Position", PositionComponent);
        em.registerComponent("Connections", ConnectionsComponent);
        em.registerComponent("PassageDetails", PassageDetailsComponent);
        em.registerComponent("Inventory", InventoryComponent);
        em.registerComponent("Item", ItemComponent);
        em.registerComponent("DefinitionRefComponent", DefinitionRefComponent);
        em.registerComponent("Lockable", LockableComponent);
        em.registerComponent("Openable", OpenableComponent);

        // Systems
        condEval = makeAlwaysPassConditionEvaluator();
        targetResolver = new ItemTargetResolverService({
            entityManager: em, eventBus: bus, conditionEvaluationService: condEval,
        });

        itemUsageSystem = new ItemUsageSystem({
            eventBus: bus,
            entityManager: em,
            dataManager: data,
            conditionEvaluationService: condEval,
            itemTargetResolverService: targetResolver,
        });
        itemUsageSystem.initialize();

        lockSystem = new LockSystem({eventBus: bus, entityManager: em});
        uiSystem = new NotificationUISystem({eventBus: bus, dataManager: data});

        lockSystem.initialize();
        uiSystem.initialize();

        // Action handler registration
        exec.registerHandler("core:use", executeUse);

        // Build world entities -----------------------------------------------
        roomExit = make(em, "demo:room_exit", "Exit");
        connNorth = make(em, "demo:conn_exit_outside", "North Way", [new PassageDetailsComponent({
            locationAId: roomExit.id,
            locationBId: "demo:room_outside",
            directionAtoB: "north",
            directionBtoA: "south",
            blockerEntityId: "demo:door_exit_north",
            type: "doorway",
        }),]);

        door = make(em, "demo:door_exit_north", "Heavy Door", [new LockableComponent({
            isLocked: true,
            keyId: "demo:item_key_rusty"
        }), new OpenableComponent({isOpen: false}),], roomExit.id);

        keyInst = make(em, "key_inst_rusty", "Rusty Key", [new ItemComponent({}), new DefinitionRefComponent("demo:item_key_rusty"),]);

        player = make(em, "player", "Player", [new InventoryComponent({items: [keyInst.id]}), new PositionComponent({locationId: roomExit.id}),], roomExit.id);

        // Verify lock pre‑condition
        expect(door.getComponent(LockableComponent).isLocked).toBe(true);

        spy = jest.spyOn(bus, "dispatch");
    });

    afterEach(() => {
        spy.mockRestore();
        lockSystem.shutdown();
        uiSystem.shutdown();
        em.clearAll();
    });

    /** Convenience executor */
    const run = async (cmd) => {
        const parsed = parser.parse(cmd);
        return exec.executeAction(parsed.actionId, {
            playerEntity: player, currentLocation: roomExit, parsedCommand: parsed, dataManager: makeMockDataManager(), // fresh stub not needed beyond structure
            entityManager: em, eventBus: bus,
        });
    };

    // ---------------------------------------------------------------------
    // Two variants: target by name ("heavy") and by direction keyword ("north").
    // ---------------------------------------------------------------------
    const variants = [{cmd: "use rusty on heavy", desc: "explicit door name"}, {
        cmd: "use rusty on north",
        desc: "direction keyword"
    },];

    variants.forEach(({cmd, desc}) => {
        it(`unlocks the Heavy Door when player types “${cmd}”  – ${desc}`, async () => {
            spy.mockClear();

            // --- Execute command ------------------------------------------------
            const res = await run(cmd);
            expect(res.success).toBe(true);

            // Make sure we did **not** exit early due to target‑not‑found
            expect(spy).not.toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, expect.objectContaining({text: expect.stringContaining("Could not find")}));

            // --- Event chain verification --------------------------------------
            await waitForEvent(spy, EVENT_ITEM_USE_ATTEMPTED, expect.objectContaining({itemInstanceId: keyInst.id}), 250);

            await waitForEvent(spy, EVENT_UNLOCK_ENTITY_ATTEMPT, expect.objectContaining({validatedTargetId: door.id}), 250);

            await waitForEvent(spy, EVENT_ENTITY_UNLOCKED, expect.objectContaining({targetEntityId: door.id}), 250);

            await waitForEvent(spy, EVENT_DISPLAY_MESSAGE, {
                text: `You unlock the ${getDisplayName(door)}.`,
                type: "success"
            }, 250);

            // --- Final state ----------------------------------------------------
            expect(door.getComponent(LockableComponent).isLocked).toBe(false);
        });
    });
});

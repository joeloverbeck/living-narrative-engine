// __tests__/integration/lookAction.blockerTarget.test.js
// -----------------------------------------------------------------------------
// PURPOSE ➜ Verify that a door with a PositionComponent with a null locationId, referenced solely
// by a connection's PassageDetailsComponent.blockerEntityId, can be targeted
// with the LOOK command.
//
// REGRESSION‑GUARD  ➜  At the time of writing the command "look sturdy" sends
// the NOT_FOUND_EXAMINABLE message.  This test encodes the **correct** future
// behaviour so that once the bug is fixed the suite will pass and will keep us
// from breaking it again.
// -----------------------------------------------------------------------------
// Scenario
//   • The player is standing in demo:room_hallway (Narrow Hallway).
//   • The location has a connection east → demo:room_treasure (Passage entity
//     demo:conn_hallway_treasure).
//   • This connection’s PassageDetailsComponent names demo:door_treasure_room as
//     its blockerEntityId.  The door itself has a PositionComponent with a null locationId.
//   • The player enters the command "look sturdy" – the parser’s direct object
//     phrase is "sturdy".
// Expected results
//   1. Target resolution succeeds with the door entity.
//   2. PerceptionSystem dispatches EVENT_DISPLAY_MESSAGE with the door’s
//      DescriptionComponent.text.
// -----------------------------------------------------------------------------

import {jest, describe, it, beforeEach, afterEach, expect} from "@jest/globals";

// ─── Core engine plumbing ────────────────────────────────────────────────────
import CommandParser from "../../core/commandParser.js";
import ActionExecutor from "../../actions/actionExecutor.js";
import EventBus from "../../core/eventBus.js";
import EntityManager from "../../entities/entityManager.js";

// Systems
import PerceptionSystem from "../../systems/perceptionSystem.js";

// Action handler
import {executeLook} from "../../actions/handlers/lookActionHandler.js";

// Components
import {NameComponent} from "../../components/nameComponent.js";
import {DescriptionComponent} from "../../components/descriptionComponent.js";
import {PositionComponent} from "../../components/positionComponent.js";
import {ConnectionsComponent} from "../../components/connectionsComponent.js";
import {PassageDetailsComponent} from "../../components/passageDetailsComponent.js";
import LockableComponent from "../../components/lockableComponent.js";
import OpenableComponent from "../../components/openableComponent.js";

// Events & helpers
import {EVENT_DISPLAY_MESSAGE} from "../../types/eventTypes.js";
import {waitForEvent, setupEntity as make} from "../testUtils.js";

// The hard‑coded description we expect for the sturdy door
const DOOR_DESCRIPTION = "A sturdy wooden example door. It looks locked.";

// ─── Minimal GameDataRepository stub covering just what we use in this test ─────────
function makeMockGameDataRepository() {
    const defs = new Map([
        ["demo:door_treasure_room", {
            id: "demo:door_treasure_room",
            components: {
                Name: {value: "Sturdy Wooden Door"},
                Description: {text: DOOR_DESCRIPTION},
                Openable: {isOpen: false},
                Lockable: {isLocked: true, keyId: "demo:nonexistent_key"}
            }
        }],
        ["demo:conn_hallway_treasure", {
            id: "demo:conn_hallway_treasure",
            components: {
                PassageDetails: {
                    locationAId: "demo:room_hallway",
                    locationBId: "demo:room_treasure",
                    directionAtoB: "east",
                    directionBtoA: "west",
                    blockerEntityId: "demo:door_treasure_room",
                    type: "doorway"
                }
            }
        }],
        ["demo:room_hallway", {
            id: "demo:room_hallway",
            components: {
                Name: {value: "Narrow Hallway"},
                Description: {text: "You are in a narrow hallway carved from rough stone."},
                Connections: {
                    connections: {
                        east: "demo:conn_hallway_treasure"
                    }
                }
            }
        }],
        ["demo:room_treasure", {
            id: "demo:room_treasure",
            components: {Name: {value: "Treasure Room"}}
        }],
        ["player_def", {id: "player_def", components: {Name: {value: "Player"}}}]
    ]);

    return {
        actions: new Map([["core:look", {id: "core:look", commands: ["look", "l"]}]]),
        getAllActionDefinitions: function () {
            // 'this' refers to mockGameDataRepository itself here
            return Array.from(this.actions.values());
        },
        getEntityDefinition: (id) => defs.get(id) || {id, components: {}},
        getPlayerId: () => "player"
    };
}

// ============================================================================
// Test suite
// ============================================================================

describe("LOOK integration – door blocker target", () => {
    let em, bus, parser, exec, perceptionSystem, spy;
    let player, hallway, door, conn;

    beforeEach(() => {
        const data = makeMockGameDataRepository();
        bus = new EventBus();
        em = new EntityManager(data);
        parser = new CommandParser(data);
        exec = new ActionExecutor();

        // Register the handful of components we need
        em.registerComponent("Name", NameComponent);
        em.registerComponent("Description", DescriptionComponent);
        em.registerComponent("Position", PositionComponent);
        em.registerComponent("Connections", ConnectionsComponent);
        em.registerComponent("PassageDetails", PassageDetailsComponent);
        em.registerComponent("Lockable", LockableComponent);
        em.registerComponent("Openable", OpenableComponent);

        // Systems
        perceptionSystem = new PerceptionSystem({eventBus: bus, entityManager: em});
        perceptionSystem.initialize();

        // Action handler registration
        exec.registerHandler("core:look", executeLook);

        // World setup ─ create entities from definitions ------------------------
        hallway = make(em, "demo:room_hallway", "Narrow Hallway");
        conn = make(em, "demo:conn_hallway_treasure", "East Connection", [new PassageDetailsComponent({
            locationAId: "demo:room_hallway",
            locationBId: "demo:room_treasure",
            directionAtoB: "east",
            directionBtoA: "west",
            blockerEntityId: "demo:door_treasure_room",
            type: "doorway"
        })]);

        door = make(em, "demo:door_treasure_room", "Sturdy Wooden Door", [
            new DescriptionComponent({text: DOOR_DESCRIPTION}),
            new OpenableComponent({isOpen: false}),
            new LockableComponent({isLocked: true, keyId: "demo:nonexistent_key"})
        ]);

        // Player – positioned in hallway ---------------------------------------
        player = make(em, "player", "Player", [new PositionComponent({locationId: hallway.id})], hallway.id);

        // Verify pre‑condition – door lacks PositionComponent -------------------
        expect(door.getComponent(PositionComponent)).toBeUndefined();

        spy = jest.spyOn(bus, "dispatch");
    });

    afterEach(() => {
        spy.mockRestore();
        perceptionSystem.shutdown();
        em.clearAll();
    });

    /** Helper to run the LOOK command */
    const look = async (cmdStr) => {
        const parsed = parser.parse(cmdStr);
        return exec.executeAction(parsed.actionId, {
            playerEntity: player,
            currentLocation: hallway,
            parsedCommand: parsed,
            gameDataRepository: makeMockGameDataRepository(),
            entityManager: em,
            eventBus: bus
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    it("dispatches the door description when player types 'look sturdy'", async () => {
        spy.mockClear();

        const result = await look("look sturdy");

        // Action handler should report success once bug is fixed
        expect(result.success).toBe(true);

        // Wait for the UI message from PerceptionSystem
        await waitForEvent(
            spy,
            EVENT_DISPLAY_MESSAGE,
            {text: DOOR_DESCRIPTION, type: "info"},
            500
        );

        // Sanity: ensure NOT_FOUND_EXAMINABLE *was not* sent
        const wrongCalls = spy.mock.calls.filter(
            ([evt, payload]) => evt === EVENT_DISPLAY_MESSAGE && /don't see anything called/i.test(payload.text)
        );
        expect(wrongCalls).toHaveLength(0);
    });
});

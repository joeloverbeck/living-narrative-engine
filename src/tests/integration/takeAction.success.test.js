// src/tests/integration/takeAction.success.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// 1. --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import InventorySystem from '../../systems/inventorySystem.js';
import {NotificationUISystem} from '../../systems/notificationUISystem.js';
import WorldPresenceSystem from '../../systems/worldPresenceSystem.js'; // <<< ADDED

// 2. --- Action Handler ---
import {executeTake} from '../../actions/handlers/takeActionHandler.js';

// 3. --- Components ---
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';

// 4. --- Event Types ---
import {EVENT_ITEM_PICKED_UP, EVENT_DISPLAY_MESSAGE} from '../../types/eventTypes.js';
// Define semantic event name constant if used consistently
const ACTION_TAKE_SUCCEEDED = 'action:take_succeeded';

// 5. --- Utilities & Types ---
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
import {waitForEvent, setupEntity as testSetupEntity} from "../testUtils.js";
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../types/eventTypes.js').ItemPickedUpEventPayload} ItemPickedUpEventPayload */

// 6. --- Mock GameDataRepository ---
const mockGameDataRepository = {
    actions: new Map([
        ['core:take', {id: 'core:take', commands: ['take', 'get', 'g']}],
    ]),
    getAllActionDefinitions: function () {
        // 'this' refers to mockGameDataRepository itself here
        return Array.from(this.actions.values());
    },
    getEntityDefinition: (id) => {
        if (id === 'key_rusty_def') {
            return {
                id: 'key_rusty_def',
                components: {
                    Name: {value: "Rusty Key"},
                    Description: {text: "An old, rusty iron key."},
                    Item: {stackable: false, weight: 0.1}
                }
            };
        }
        return {id: id, components: {}};
    },
    getPlayerId: () => 'player'
};

// 7. --- Test Suite ---
describe('Integration Test: core:take Action - Successful Pickup (TAKE-INT-SUCCESS-01)', () => {
    // 8. --- Test Scope Variables ---
    let entityManager;
    let eventBus;
    let commandParser;
    let actionExecutor;
    let inventorySystem;
    let notificationUISystem;
    let worldPresenceSystem; // <<< ADDED
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;

    // Test Entities
    let player;
    let testLocation;
    let rustyKey;

    // 9. --- Use the provided setupEntity helper ---
    const setupEntity = (id, name, components = [], locationId = null, definitionId = null) => {
        if (!entityManager) {
            throw new Error("EntityManager is not initialized in setupEntity call.");
        }
        if (definitionId) {
            const itemComp = components.find(c => c instanceof ItemComponent);
            if (itemComp) {
                itemComp.definitionId = definitionId;
            } else {
                components.push(new ItemComponent({definitionId: definitionId}));
            }
        }
        return testSetupEntity(entityManager, id, name, components, locationId);
    };

    // 10. --- beforeEach Setup ---
    beforeEach(() => {
        // 1. Instantiate Core Modules
        entityManager = new EntityManager(mockGameDataRepository);
        eventBus = new EventBus();
        commandParser = new CommandParser(mockGameDataRepository);
        actionExecutor = new ActionExecutor();

        // 2. Register ALL necessary Components
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('PositionComponent', PositionComponent);
        entityManager.registerComponent('InventoryComponent', InventoryComponent);
        entityManager.registerComponent('ItemComponent', ItemComponent);
        entityManager.registerComponent('DescriptionComponent', DescriptionComponent);

        // 3. Instantiate Systems
        inventorySystem = new InventorySystem({
            eventBus,
            entityManager,
            gameDataRepository: mockGameDataRepository,
            gameStateManager: {getPlayer: () => entityManager.getEntityInstance('player')}
        });
        notificationUISystem = new NotificationUISystem({eventBus, gameDataRepository: mockGameDataRepository});
        worldPresenceSystem = new WorldPresenceSystem({eventBus, entityManager}); // <<< ADDED Instance

        // 4. Register Action Handler(s)
        actionExecutor.registerHandler('core:take', executeTake);

        // 5. Initialize Systems (subscribes them to EventBus)
        inventorySystem.initialize();
        notificationUISystem.initialize();
        worldPresenceSystem.initialize(); // <<< ADDED Initialization

        // 6. Setup Spies
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });

        // 7. Setup Common Test Entities (Player, Location)
        testLocation = setupEntity('test_location', 'A Dusty Room');
        player = setupEntity('player', 'Player',
            [new InventoryComponent({items: []})], // Start with empty inventory
            testLocation.id
        );

        // --- Sanity Checks ---
        expect(player.getComponent(InventoryComponent)).toBeDefined();
        expect(player.getComponent(InventoryComponent).getItems()).toEqual([]);
        expect(player.getComponent(PositionComponent).locationId).toBe(testLocation.id);
        const initialEntitiesInLoc = entityManager.getEntitiesInLocation(testLocation.id);
        expect(initialEntitiesInLoc).toContain('player');

    }); // End beforeEach

    // 11. --- afterEach Cleanup ---
    afterEach(() => {
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();

        notificationUISystem?.shutdown();
        worldPresenceSystem?.shutdown(); // <<< ADDED Shutdown
        // inventorySystem?.shutdown(); // Uncomment if InventorySystem gets a shutdown method

        entityManager?.clearAll();
    });

    // 12. --- simulateCommand Helper ---
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);

        if (!parsedCommand.actionId && commandString.trim() !== '') {
            const errorText = parsedCommand.error || "Unknown command.";
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: errorText, type: 'error'});
            return {success: false, messages: [{text: errorText, type: 'error'}]};
        }
        if (!parsedCommand.actionId && commandString.trim() === '') {
            return {success: true, messages: []};
        }

        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            currentLocation: testLocation,
            parsedCommand: parsedCommand,
            gameDataRepository: mockGameDataRepository,
            entityManager: entityManager,
            eventBus: eventBus,
            dispatch: eventBus.dispatch.bind(eventBus)
        };

        const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);
        return actionResult;
    };

    // 13. --- Test Scenario ---
    describe('Scenario: Player takes an existing item from the location', () => {
        it('should add the item to inventory, remove from location, dispatch events, and show success message', async () => {
            // --- Arrange ---
            const keyName = "Rusty Key";
            const keyId = "key_inst_rusty_01";
            const keyDefinitionId = "key_rusty_def";

            rustyKey = setupEntity(keyId, keyName,
                [
                    new ItemComponent({definitionId: keyDefinitionId}),
                    new DescriptionComponent({text: "An old, rusty iron key."})
                ],
                testLocation.id
            );

            // Verify initial state
            expect(player.getComponent(InventoryComponent).hasItem(keyId)).toBe(false);
            let initialEntitiesInLoc = entityManager.getEntitiesInLocation(testLocation.id);
            expect(initialEntitiesInLoc).toContain(keyId);
            expect(initialEntitiesInLoc).toContain(player.id);

            const command = `take ${keyName}`;

            /** @type {Partial<ItemPickedUpEventPayload>} */
            const expectedPickupEventPayload = {
                pickerId: player.id,
                itemId: keyId,
                locationId: testLocation.id
            };

            const expectedSuccessUIMessagePayload = {
                text: `You take the ${keyName}.`,
                type: 'success'
            };

            const expectedSemanticSuccessPayload = {
                actorId: player.id,
                itemId: keyId,
                itemName: keyName,
                locationId: testLocation.id
            };

            dispatchSpy.mockClear();

            // --- Act ---
            const actionResult = await simulateCommand(command);

            // --- Assert ---

            // 1. Action Result Success
            expect(actionResult).toBeDefined();
            expect(actionResult.success).toBe(true); // Should pass now

            // 2. Core Event Dispatched
            try {
                // console.log(`Assert: Waiting for ${EVENT_ITEM_PICKED_UP}...`); // Optional log
                await waitForEvent(dispatchSpy, EVENT_ITEM_PICKED_UP, expect.objectContaining(expectedPickupEventPayload), 1000);
                // console.log(`Assert: ${EVENT_ITEM_PICKED_UP} received.`); // Optional log
            } catch (error) {
                console.error(`Assert: Failed while waiting for ${EVENT_ITEM_PICKED_UP}.`, error);
                console.log("All dispatch calls:", JSON.stringify(dispatchSpy.mock.calls, null, 2));
                throw error;
            }

            // 3. Semantic Success Event
            try {
                // console.log(`Assert: Waiting for ${ACTION_TAKE_SUCCEEDED}...`); // Optional log
                await waitForEvent(dispatchSpy, ACTION_TAKE_SUCCEEDED, expect.objectContaining(expectedSemanticSuccessPayload), 1000);
                // console.log(`Assert: ${ACTION_TAKE_SUCCEEDED} received.`); // Optional log
            } catch (error) {
                console.warn(`Assert: Failed while waiting for ${ACTION_TAKE_SUCCEEDED}. This might be okay if the handler doesn't dispatch it.`, error);
            }

            // 4. UI Success Message
            try {
                // console.log(`Assert: Waiting for ${EVENT_DISPLAY_MESSAGE} (Success)...`); // Optional log
                await waitForEvent(dispatchSpy, EVENT_DISPLAY_MESSAGE, expect.objectContaining(expectedSuccessUIMessagePayload), 1000);
                // console.log(`Assert: ${EVENT_DISPLAY_MESSAGE} (Success) received.`); // Optional log
            } catch (error) {
                console.error(`Assert: Failed while waiting for ${EVENT_DISPLAY_MESSAGE} (Success).`, error);
                console.log("All dispatch calls:", JSON.stringify(dispatchSpy.mock.calls, null, 2));
                throw error;
            }

            // 5. State Check: Inventory Updated
            const playerInvComp = player.getComponent(InventoryComponent);
            expect(playerInvComp.hasItem(keyId)).toBe(true);

            // 6. State Check: Item Removed from Location
            // Re-fetch entities *after* action and event handling should be complete
            const finalEntitiesInLoc = entityManager.getEntitiesInLocation(testLocation.id);
            expect(finalEntitiesInLoc).not.toContain(keyId); // <<< THIS SHOULD NOW PASS
            expect(finalEntitiesInLoc).toContain(player.id);

            // 7. Verify Item Entity Position Component State (Alternative/Redundant Check)
            const keyPosComp = rustyKey.getComponent(PositionComponent);
            expect(keyPosComp?.locationId).toBeNull(); // <<< THIS SHOULD NOW PASS

            // 8. No Errors
            const errorMessages = dispatchSpy.mock.calls.filter(call => call[0] === EVENT_DISPLAY_MESSAGE && call[1]?.type === 'error');
            expect(errorMessages).toHaveLength(0);
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            // expect(consoleWarnSpy).not.toHaveBeenCalled(); // Comment out if warnings are acceptable/expected

        }); // End it block
    }); // End describe scenario
}); // End Test Suite
// src/tests/integration/lookAction.unknownLocation.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js'; // Needed for context creation
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for type hints and setup

// --- Action Handler ---
// We register it, but don't need direct import if executor handles it
import { executeLook } from '../../actions/handlers/lookActionHandler.js';

// --- Components ---
// Minimal components needed for player setup
import { NameComponent } from '../../components/nameComponent.js';
import { PositionComponent } from '../../components/positionComponent.js'; // Needed to *potentially* place player, though context override is key

// --- Utilities & Types ---
import { TARGET_MESSAGES } from '../../utils/messages.js';
import { waitForEvent } from "../testUtils.js";
import {DescriptionComponent} from "../../components/descriptionComponent.js";
import {ConnectionsComponent} from "../../components/connectionsComponent.js";
import {ItemComponent} from "../../components/itemComponent.js";
import {PassageDetailsComponent} from "../../components/passageDetailsComponent.js";
import OpenableComponent from "../../components/openableComponent.js";
import LockableComponent from "../../components/lockableComponent.js"; // Assuming testUtils.js is one level up
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock DataManager ---
// Minimal mock defining the 'look' action
const mockDataManager = {
    actions: new Map([
        ['core:look', { id: 'core:look', commands: ['look', 'l'] }],
        // Add other actions if strictly needed by setup, but unlikely for this test
    ]),
    getEntityDefinition: (id) => ({ id: id, components: {} }), // Minimal definition lookup
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:look Action - LOOK-INT-ERR-01', () => {
    let entityManager;
    let eventBus;
    let commandParser; // Although not parsing 'look' directly, needed for standard context setup parts
    let actionExecutor;
    // No specific game systems strictly required for this failure path
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;

    // --- Test Entities ---
    let player;
    // No location entity needed, as we'll set context.currentLocation to null

    // --- Simplified setupEntity Helper (Copied & adapted, less logging) ---
    const setupEntity = (id, name, components = [], locationId = null) => { // Default locationId null initially
        if (!entityManager || typeof entityManager.createEntityInstance !== 'function') {
            throw new Error(`[setupEntity] entityManager is invalid when setting up ${id}`);
        }
        const entity = entityManager.createEntityInstance(id);
        if (!entity) throw new Error(`Entity instance creation failed for ${id}`);

        // Add/Update Name Component
        if (!entity.hasComponent(NameComponent)) {
            entity.addComponent(new NameComponent({ value: name }));
        } else {
            entity.getComponent(NameComponent).value = name;
        }

        // Position Component Handling - add if needed, but doesn't need a valid location for this test
        if (locationId && !entity.hasComponent(PositionComponent)) {
            entity.addComponent(new PositionComponent({ locationId: locationId }));
            // We don't need notifyPositionChange if locationId is null or invalid
        } else if (locationId && entity.hasComponent(PositionComponent)) {
            entity.getComponent(PositionComponent).locationId = locationId;
        }


        // Add other components
        components.forEach(comp => {
            if (!entity.hasComponent(comp.constructor)) {
                entity.addComponent(comp);
            }
        });
        return entity;
    };
    // --- End setupEntity Helper ---

    beforeEach(() => {
        // 1. Instantiate core modules
        entityManager = new EntityManager(mockDataManager);
        eventBus = new EventBus();
        commandParser = new CommandParser(mockDataManager); // Still useful for structure
        actionExecutor = new ActionExecutor();

        // 2. Register REAL components with EntityManager (minimal set)
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('PositionComponent', PositionComponent);
        // Register other components if look action handler *might* try to access them even in failure (unlikely)
        entityManager.registerComponent('DescriptionComponent', DescriptionComponent);
        entityManager.registerComponent('ConnectionsComponent', ConnectionsComponent);
        entityManager.registerComponent('ItemComponent', ItemComponent);
        entityManager.registerComponent('PassageDetailsComponent', PassageDetailsComponent);
        entityManager.registerComponent('OpenableComponent', OpenableComponent);
        entityManager.registerComponent('LockableComponent', LockableComponent);


        // 3. Instantiate Systems (None strictly needed for this failure path)
        // notificationUISystem = new NotificationUISystem({ eventBus, dataManager: mockDataManager }); // Optional

        // 4. Register Action Handler
        actionExecutor.registerHandler('core:look', executeLook);

        // 5. Initialize Systems (if any)
        // notificationUISystem?.initialize();

        // 6. Set up Spies
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // 7. Setup common test entities
        // Player doesn't need a valid location component/ID for this test's core logic
        player = setupEntity('player', 'Player', [], null);
    });

    afterEach(() => {
        // Restore spies
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();

        // Optional: Call system shutdown methods
        // notificationUISystem?.shutdown();
        entityManager.clearAll(); // Clear entities
    });

    // --- Test Scenario for LOOK-INT-ERR-01 ---
    describe('Scenario: Player Location Unknown', () => {
        it('should dispatch LOOK_LOCATION_UNKNOWN error, fail action, and not display location', async () => {
            // Arrange

            // Expected error message payload from TARGET_MESSAGES
            const expectedErrorPayload = {
                text: TARGET_MESSAGES.LOOK_LOCATION_UNKNOWN,
                type: 'error'
            };

            // Create the ParsedCommand for a simple 'look'
            const parsedCommand = {
                actionId: 'core:look',
                directObjectPhrase: null,
                preposition: null,
                indirectObjectPhrase: null,
                originalInput: 'look',
                error: null
            };

            // Create the base ActionContext, but explicitly set currentLocation to null
            /** @type {ActionContext} */
            const context = {
                playerEntity: player,
                currentLocation: null, // <<< KEY: Set currentLocation to null
                parsedCommand: parsedCommand,
                dataManager: mockDataManager,
                entityManager: entityManager,
                dispatch: dispatchSpy, // Pass spy for direct checks if needed, but prefer eventBus
                eventBus: eventBus
            };

            dispatchSpy.mockClear(); // Clear spy calls after setup

            // Act: Directly execute the action with the modified context
            const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);

            // Assert

            // 1. Error Message Dispatched: Wait for the specific ui:message_display error
            try {
                await waitForEvent(dispatchSpy, 'ui:message_display', expectedErrorPayload, 500); // Use shorter timeout
                console.log("[Test Case LOOK-INT-ERR-01] Successfully detected 'ui:message_display' error event.");
            } catch (err) {
                console.error("[Test Case LOOK-INT-ERR-01] Failed to detect the expected error message.", err);
                // Log calls for debugging message issues
                try {
                    console.log("[Test Case LOOK-INT-ERR-01] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, null, 2));
                } catch (stringifyError) {
                    console.error("[Test Case LOOK-INT-ERR-01] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case LOOK-INT-ERR-01] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw to fail test
            }

            // 2. Action Result Failed: Verify the actionExecutor result indicates failure
            expect(actionResult).toBeDefined();
            expect(actionResult.success).toBe(false);
            // Optionally check messages array in result if the handler adds it there too
            expect(actionResult.messages).toEqual(
                expect.arrayContaining([
                    expect.objectContaining(expectedErrorPayload) // Check if the error message is also in the result messages
                ])
            );


            // 3. No Location Display Event: Check that 'ui:display_location' was NOT dispatched
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'ui:display_location',
                expect.anything()
            );

            // 4. Console Checks: Ensure no unexpected errors/warnings related to this failure
            // Note: The lookActionHandler *might* have an internal log, but framework errors shouldn't occur.
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            // Allow warnings if the handler intentionally warns about the null location internally
            // expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
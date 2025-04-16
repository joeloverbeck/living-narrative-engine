// src/tests/integration/lookAction.targetUnique.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for type hints and setup
import { NotificationUISystem } from '../../systems/notificationUISystem.js'; // To check it's *not* called

// --- Action Handler ---
import { executeLook } from '../../actions/handlers/lookActionHandler.js';

// --- Components ---
import { NameComponent } from '../../components/nameComponent.js';
import { DescriptionComponent } from '../../components/descriptionComponent.js';
import { ConnectionsComponent } from '../../components/connectionsComponent.js'; // Needed for location setup
import { PositionComponent } from '../../components/positionComponent.js';
import { ItemComponent } from '../../components/itemComponent.js';
import { InventoryComponent } from '../../components/inventoryComponent.js'; // <<< ADDED IMPORT

// --- Utilities & Types ---
import { TARGET_MESSAGES } from '../../utils/messages.js'; // Potentially needed if handler uses them
import { waitForEvent } from "../testUtils.js";
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock DataManager ---
const mockDataManager = {
    actions: new Map([
        ['core:look', { id: 'core:look', commands: ['look', 'l'] }],
        // No other actions strictly needed for this test
    ]),
    getEntityDefinition: (id) => ({ id: id, components: {} }), // Minimal definition lookup
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:look Action - LOOK-INT-TGT-01', () => {
    let entityManager;
    let eventBus;
    let commandParser;
    let actionExecutor;
    let notificationUISystem; // Instance needed to confirm no calls
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;

    // --- Test Entities ---
    let player;
    let testLocation;
    let targetEntity; // The unique entity to look at

    // --- Simplified setupEntity Helper (Adapted from previous tests) ---
    // (setupEntity helper remains the same)
    const setupEntity = (id, name, components = [], locationId = null) => {
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

        // Position Component Handling
        let oldLocationId = null;
        const existingPosComp = entity.getComponent(PositionComponent);
        if (existingPosComp) oldLocationId = existingPosComp.locationId;

        if (locationId) { // Only add/update position if locationId is provided
            if (!existingPosComp) {
                entity.addComponent(new PositionComponent({ locationId: locationId }));
            } else if (existingPosComp.locationId !== locationId) {
                existingPosComp.locationId = locationId;
            }
            // Notify only if location changes or was newly added
            if (oldLocationId !== locationId) {
                if (!entityManager || typeof entityManager.notifyPositionChange !== 'function') {
                    throw new Error(`[setupEntity] entityManager invalid before notifyPositionChange for ${id}`);
                }
                entityManager.notifyPositionChange(id, oldLocationId, locationId);
            }
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
        commandParser = new CommandParser(mockDataManager);
        actionExecutor = new ActionExecutor();

        // 2. Register REAL components with EntityManager
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('DescriptionComponent', DescriptionComponent);
        entityManager.registerComponent('ConnectionsComponent', ConnectionsComponent); // For location
        entityManager.registerComponent('PositionComponent', PositionComponent);
        entityManager.registerComponent('ItemComponent', ItemComponent);
        entityManager.registerComponent('InventoryComponent', InventoryComponent); // <<< REGISTER InventoryComponent

        // 3. Instantiate Systems
        // We need NotificationUISystem to ensure its events AREN'T called
        notificationUISystem = new NotificationUISystem({ eventBus, dataManager: mockDataManager });

        // 4. Register Action Handler
        actionExecutor.registerHandler('core:look', executeLook);

        // 5. Initialize Systems
        notificationUISystem.initialize(); // Initialize it even if we don't expect calls

        // 6. Set up Spies
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // 7. Setup test entities according to AC
        // Location setup
        testLocation = setupEntity('test_location', 'A Test Chamber', [
            new DescriptionComponent({ text: 'An empty room used for testing.' }),
            new ConnectionsComponent({ connections: {} })
        ]);
        // Player in the location - NOW WITH InventoryComponent
        player = setupEntity('player', 'Player',
            [new InventoryComponent({ items: [] })], // <<< ADDED InventoryComponent
            testLocation.id
        );
        // The unique target entity with a description
        const targetName = 'statue';
        const targetDescription = 'A marble statue.';
        targetEntity = setupEntity('unique_statue', targetName, [
            new DescriptionComponent({ text: targetDescription })
        ], testLocation.id);

        // Ensure targetEntity is correctly placed (optional debug check)
        const entitiesInLoc = entityManager.getEntitiesInLocation(testLocation.id);
        expect(entitiesInLoc).toContain(player.id);
        expect(entitiesInLoc).toContain(targetEntity.id);

    });

    afterEach(() => {
        // Restore spies
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();

        // Optional: Call system shutdown methods
        notificationUISystem.shutdown();
        entityManager.clearAll(); // Clear entities to ensure test isolation
    });

    // --- Helper Function to Simulate Command Execution (Copied from existing tests) ---
    // (simulateCommand helper remains the same)
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);

        if (!parsedCommand.actionId && commandString.trim() !== '') {
            const errorText = parsedCommand.error || "Unknown command.";
            await eventBus.dispatch('ui:message_display', { text: errorText, type: 'error'});
            // Return a failure result matching ActionResult structure
            return { success: false, messages: [{ text: errorText, type: 'error' }] };
        }
        if(!parsedCommand.actionId && commandString.trim() === '') {
            // Empty command is technically successful (does nothing)
            return { success: true, messages: [] };
        }

        // Proceed only if actionId is valid
        if (!parsedCommand.actionId) {
            // Should not happen if parse logic is correct, but acts as a safeguard
            console.error(`[simulateCommand] Error: Parsed command lacks actionId for input: "${commandString}"`);
            return { success: false, messages: [{ text: "Internal parser error: No action ID found.", type: 'error' }] };
        }


        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            // Ensure currentLocation is the entity object, not just the ID
            currentLocation: entityManager.getEntityInstance(player.getComponent(PositionComponent).locationId),
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager,
            dispatch: dispatchSpy, // Keep for potential direct calls (legacy)
            eventBus: eventBus     // Preferred way
        };

        // Execute the action and return its result
        const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);
        return actionResult;
    };


    // --- Test Scenario for LOOK-INT-TGT-01 ---
    describe('Scenario: Look at a unique nearby target with description', () => {
        it('should dispatch ui:message_display with target description, succeed, and not display location', async () => {
            // Arrange
            const command = `look ${targetEntity.getComponent(NameComponent).value}`; // "look statue"
            const expectedDescription = targetEntity.getComponent(DescriptionComponent).text; // "A marble statue."
            const expectedPayload = {
                text: expectedDescription,
                type: 'info' // As specified in AC
            };

            dispatchSpy.mockClear(); // Clear spy calls after setup

            // Act: Simulate the 'look statue' command
            const actionResult = await simulateCommand(command);

            // Assert

            // 1. Action Result Success: Verify the actionExecutor result indicates success
            expect(actionResult).toBeDefined();
            expect(actionResult.success).toBe(true);

            // 2. Description Message Dispatched: Wait for the specific ui:message_display event
            try {
                await waitForEvent(dispatchSpy, 'ui:message_display', expectedPayload, 1000);
                console.log("[Test Case LOOK-INT-TGT-01] Successfully detected 'ui:message_display' event with target description.");
            } catch (err) {
                console.error("[Test Case LOOK-INT-TGT-01] Failed to detect the expected description message.", err);
                // Log calls for debugging message issues
                try {
                    const seen = new Set(); // Handle potential circular references
                    console.log("[Test Case LOOK-INT-TGT-01] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) { return '[Circular]'; }
                            seen.add(value);
                        }
                        return value;
                    }, 2));
                } catch (stringifyError) {
                    console.error("[Test Case LOOK-INT-TGT-01] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case LOOK-INT-TGT-01] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw to fail test
            }

            // 3. No Location Display Event: Check that 'ui:display_location' was NOT dispatched
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'ui:display_location',
                expect.anything() // Match any payload for this event type
            );

            // 4. No Error Messages: Ensure no error messages were displayed via ui:message_display
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'ui:message_display',
                expect.objectContaining({ type: 'error' })
            );

            // 5. Console Checks: Ensure no unexpected console errors or warnings
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled(); // <<< This assertion should now pass
        });
    });
});
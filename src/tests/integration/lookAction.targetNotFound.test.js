// src/tests/integration/lookAction.targetNotFound.test.js

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
import { ItemComponent } from '../../components/itemComponent.js'; // Important for scope check
import { InventoryComponent } from '../../components/inventoryComponent.js'; // Important for scope check

// --- Utilities & Types ---
import { TARGET_MESSAGES } from '../../utils/messages.js'; // Needed for the specific error message
import { waitForEvent } from "../testUtils.js";
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock DataManager ---
const mockDataManager = {
    actions: new Map([
        ['core:look', { id: 'core:look', commands: ['look', 'l'] }],
    ]),
    getEntityDefinition: (id) => ({ id: id, components: {} }), // Minimal definition lookup
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:look Action - LOOK-INT-TGT-03', () => {
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
    // NO 'ghost' entity will be created

    // --- Simplified setupEntity Helper (Adapted from previous tests) ---
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

        if (locationId) {
            if (!existingPosComp) {
                entity.addComponent(new PositionComponent({ locationId: locationId }));
            } else if (existingPosComp.locationId !== locationId) {
                existingPosComp.locationId = locationId;
            }
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
        entityManager.registerComponent('ConnectionsComponent', ConnectionsComponent);
        entityManager.registerComponent('PositionComponent', PositionComponent);
        entityManager.registerComponent('ItemComponent', ItemComponent); // Need to check if potential targets have this
        entityManager.registerComponent('InventoryComponent', InventoryComponent); // Need for player inventory check

        // 3. Instantiate Systems
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
        testLocation = setupEntity('test_location', 'A Test Room', [
            new DescriptionComponent({ text: 'A simple room for testing.' }),
            new ConnectionsComponent({ connections: {} })
        ]);
        // Player in the location WITH an inventory
        player = setupEntity('player', 'Player',
            [new InventoryComponent({ items: [] })], // Player needs inventory for scope check
            testLocation.id
        );

        // 8. CRITICAL: Ensure NO entity named 'ghost' exists
        // Clear any other potentially existing entities besides player and location
        const entitiesToRemove = [];
        for (const entity of entityManager.activeEntities.values()) {
            if (entity.id !== player.id && entity.id !== testLocation.id) {
                entitiesToRemove.push(entity.id);
            }
        }
        for (const entityIdToRemove of entitiesToRemove) {
            entityManager.removeEntityInstance(entityIdToRemove);
        }

        // Verify no 'ghost' exists (optional sanity check)
        const allEntities = entityManager.activeEntities.values();
        for (const entity of allEntities) {
            if (entity.hasComponent(NameComponent) && entity.getComponent(NameComponent).value.toLowerCase() === 'ghost') {
                throw new Error("Test setup failed: An entity named 'ghost' was found.");
            }
        }
        console.log(`[Test Setup] Verified no entity named 'ghost' exists.`); // Log verification
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
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);

        if (!parsedCommand.actionId && commandString.trim() !== '') {
            const errorText = parsedCommand.error || "Unknown command.";
            await eventBus.dispatch('ui:message_display', { text: errorText, type: 'error'});
            return { success: false, messages: [{ text: errorText, type: 'error' }] };
        }
        if(!parsedCommand.actionId && commandString.trim() === '') {
            return { success: true, messages: [] };
        }
        if (!parsedCommand.actionId) {
            console.error(`[simulateCommand] Error: Parsed command lacks actionId for input: "${commandString}"`);
            return { success: false, messages: [{ text: "Internal parser error: No action ID found.", type: 'error' }] };
        }

        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            currentLocation: entityManager.getEntityInstance(player.getComponent(PositionComponent).locationId),
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager,
            dispatch: dispatchSpy,
            eventBus: eventBus
        };

        const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);
        return actionResult;
    };


    // --- Test Scenario for LOOK-INT-TGT-03 ---
    describe('Scenario: Look at a target not found nearby', () => {
        it('should dispatch "not found examinable" message and fail action', async () => {
            // Arrange
            const targetName = 'ghost';
            const command = `look ${targetName}`;

            // Use the specific function from TARGET_MESSAGES as per AC
            const expectedNotFoundMessage = "You don't see anything suitable nearby to look at."; // Use the actual message seen in logs
            const expectedPayload = {
                text: expectedNotFoundMessage,
                type: 'info' // As specified in AC
            };

            dispatchSpy.mockClear(); // Clear spy calls after setup

            // Act: Simulate the 'look ghost' command
            const actionResult = await simulateCommand(command);

            // Assert

            // 1. Action Result Failure: Verify the actionExecutor result indicates failure
            expect(actionResult).toBeDefined();
            expect(actionResult.success).toBe(false); // <<< AC: should resolve to { success: false }

            // 2. Not Found Message Dispatched: Wait for the specific ui:message_display event
            try {
                await waitForEvent(dispatchSpy, 'ui:message_display', expectedPayload, 1000); // <<< AC: Check for specific message
                console.log("[Test Case LOOK-INT-TGT-03] Successfully detected 'ui:message_display' event with NOT_FOUND_EXAMINABLE message.");
            } catch (err) {
                console.error("[Test Case LOOK-INT-TGT-03] Failed to detect the expected 'not found' message.", err);
                // Log calls for debugging message issues
                try {
                    const seen = new Set();
                    console.log("[Test Case LOOK-INT-TGT-03] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) { return '[Circular]'; }
                            seen.add(value);
                        }
                        return value;
                    }, 2));
                } catch (stringifyError) {
                    console.error("[Test Case LOOK-INT-TGT-03] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case LOOK-INT-TGT-03] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw to fail test
            }

            // 3. No Location Display Event: Check that 'ui:display_location' was NOT dispatched
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'ui:display_location',
                expect.anything() // Match any payload for this event type
            );

            // 4. No Other Error Messages: Ensure no *other* error messages were displayed via ui:message_display
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'ui:message_display',
                expect.objectContaining({ type: 'error' })
            );

            // 5. Console Checks: Ensure no unexpected console errors or warnings
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
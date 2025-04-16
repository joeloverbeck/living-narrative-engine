// src/tests/integration/lookAction.basicLocation.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for type hints and setup
import { NotificationUISystem } from '../../systems/notificationUISystem.js'; // Potentially handles ui:display_location

// --- Action Handler ---
import { executeLook } from '../../actions/handlers/lookActionHandler.js';

// --- Components ---
import { NameComponent } from '../../components/nameComponent.js';
import { DescriptionComponent } from '../../components/descriptionComponent.js';
import { ConnectionsComponent } from '../../components/connectionsComponent.js';
import { PositionComponent } from '../../components/positionComponent.js';
// Import components needed for exclusion checks (even if not present)
import { ItemComponent } from '../../components/itemComponent.js';

// --- Utilities & Types ---
import { TARGET_MESSAGES } from '../../utils/messages.js';
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
describe('Integration Test: core:look Action - LOOK-INT-LOC-01', () => {
    let entityManager;
    let eventBus;
    let commandParser;
    let actionExecutor;
    let notificationUISystem;
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;

    // --- Test Entities ---
    let player;
    let testLocation;

    // --- Simplified setupEntity Helper (Adapted) ---
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
            // Notify only if location changes
            if (oldLocationId !== locationId) {
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
        entityManager.registerComponent('ItemComponent', ItemComponent); // Register even if not used, for checks

        // 3. Instantiate Systems
        notificationUISystem = new NotificationUISystem({ eventBus, dataManager: mockDataManager });

        // 4. Register Action Handler
        actionExecutor.registerHandler('core:look', executeLook);

        // 5. Initialize Systems
        notificationUISystem.initialize();

        // 6. Set up Spies
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // --- CORRECTED SECTION ---
        // 7. Setup test entities (ensure location is set up first if needed)
        testLocation = setupEntity('test_location', 'A Quiet Room', [
            new DescriptionComponent({ text: 'A simple, unremarkable test room.' }),
            new ConnectionsComponent({ connections: {} }) // Empty connections
        ]);
        player = setupEntity('player', 'Player', [], 'test_location'); // Place player in the location

        // 8. Clear any other potentially existing entities to ensure a clean state for the test
        // Iterate over the values (Entity instances) in the activeEntities Map
        const entitiesToRemove = [];
        for (const entity of entityManager.activeEntities.values()) {
            if (entity.id !== 'player' && entity.id !== 'test_location') {
                // Collect IDs to remove to avoid modifying the map while iterating
                entitiesToRemove.push(entity.id);
            }
        }
        // Remove the collected entities using the correct method name
        for (const entityIdToRemove of entitiesToRemove) {
            entityManager.removeEntityInstance(entityIdToRemove);
        }
        // --- END CORRECTED SECTION ---
    });

    afterEach(() => {
        // Restore spies
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();

        // Optional: Call system shutdown methods
        notificationUISystem.shutdown();
        entityManager.clearAll(); // Clear entities
    });
    // --- Helper Function to Simulate Command Execution (Returns ActionResult) ---
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);

        if (!parsedCommand.actionId && commandString.trim() !== '') {
            const errorText = parsedCommand.error || "Unknown command.";
            await eventBus.dispatch('ui:message_display', { text: errorText, type: 'error'});
            return { success: false, messages: [{ text: errorText, type: 'error' }] }; // Return failure result
        }
        if(!parsedCommand.actionId && commandString.trim() === '') {
            return { success: true, messages: [] }; // Empty command is technically successful (does nothing)
        }

        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            currentLocation: testLocation,
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager,
            dispatch: dispatchSpy, // Keep for potential direct calls within handlers (legacy)
            eventBus: eventBus     // Preferred way for handlers/systems to communicate
        };

        // Execute the action and return its result
        const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);
        return actionResult;
    };


    // --- Test Scenario for LOOK-INT-LOC-01 ---
    describe('Scenario: Look at a basic location', () => {
        it('should dispatch ui:display_location with name and description only', async () => { // Modified description slightly
            // Arrange
            const expectedName = testLocation.getComponent(NameComponent).value;
            const expectedDescription = testLocation.getComponent(DescriptionComponent).text;

            // Define the EXACT payload observed in the logs
            const expectedExactPayload = {
                name: expectedName,
                description: expectedDescription
                // No exits, items, or npcs properties expected in this exact structure
            };

            dispatchSpy.mockClear(); // Clear spy calls after setup

            // Act: Simulate the 'look' command and get the result
            const actionResult = await simulateCommand('look');

            // Assert

            // 1. Check Action Result Success
            expect(actionResult).toBeDefined();
            expect(actionResult.success).toBe(true);

            // 2. Location Display Event: Wait for the ui:display_location event
            //    using the EXACT expected payload object. waitForEvent implicitly uses deep equality.
            try {
                await waitForEvent(
                    dispatchSpy,
                    'ui:display_location',
                    expectedExactPayload, // <<< Use the exact payload object for comparison
                    1000 // Timeout
                );
                console.log("[Test Case LOOK-INT-LOC-01] Successfully detected 'ui:display_location' event with exact basic payload.");
            } catch (err) {
                console.error("[Test Case LOOK-INT-LOC-01] Failed to detect the expected 'ui:display_location' event with exact payload.", err);
                // Log calls for debugging message issues
                try {
                    // Use JSON.stringify with a replacer to handle potential circular references if payloads get complex
                    console.log("[Test Case LOOK-INT-LOC-01] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, (key, value) => {
                        // Basic circular reference handler (can be expanded if needed)
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) { return '[Circular]'; }
                            seen.add(value);
                        }
                        return value;
                    }, 2));
                    const seen = new Set(); // Reset seen for each stringify call if necessary, or declare outside
                } catch (stringifyError) {
                    console.error("[Test Case LOOK-INT-LOC-01] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case LOOK-INT-LOC-01] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw to fail test
            }

            // 3. No Error Messages: Ensure no error messages were displayed
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'ui:message_display',
                expect.objectContaining({ type: 'error' })
            );

            // 4. Console Checks: Ensure no unexpected errors/warnings
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
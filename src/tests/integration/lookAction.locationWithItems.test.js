// src/tests/integration/lookAction.locationWithItems.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for type hints and setup
import { NotificationUISystem } from '../../systems/notificationUISystem.js'; // Handles ui:display_location

// --- Action Handler ---
import { executeLook } from '../../actions/handlers/lookActionHandler.js';

// --- Components ---
import { NameComponent } from '../../components/nameComponent.js';
import { DescriptionComponent } from '../../components/descriptionComponent.js';
import { ConnectionsComponent } from '../../components/connectionsComponent.js';
import { PositionComponent } from '../../components/positionComponent.js';
import { ItemComponent } from '../../components/itemComponent.js'; // <<< REQUIRED for this test
// Example of a component for a non-item entity (optional, for exclusion test)
// import { NpcComponent } from '../../components/npcComponent.js'; // Assuming this exists

// --- Utilities & Types ---
import { TARGET_MESSAGES, getDisplayName } from '../../utils/messages.js'; // getDisplayName might be useful
import { waitForEvent } from "../testUtils.js";
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock DataManager ---
const mockDataManager = {
    actions: new Map([
        ['core:look', { id: 'core:look', commands: ['look', 'l'] }],
        // Add other actions if needed by setup/systems
    ]),
    getEntityDefinition: (id) => ({ id: id, components: {} }), // Minimal definition lookup
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:look Action - LOOK-INT-LOC-02', () => {
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
    let item1;
    let item2;
    let nonItemEntity; // To test exclusion

    // --- Simplified setupEntity Helper (Adapted from lookAction.basicLocation.test.js) ---
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
                // Safety check before notify
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
        entityManager.registerComponent('ItemComponent', ItemComponent); // <<< Register ItemComponent
        // Register NpcComponent if using it
        // entityManager.registerComponent('NpcComponent', NpcComponent);

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

        // 7. Setup test entities according to AC
        testLocation = setupEntity('test_location', 'A Cluttered Test Room', [
            new DescriptionComponent({ text: 'A test room filled with various objects.' }),
            new ConnectionsComponent({ connections: {} }) // Empty connections
        ]);
        // Player is placed in the location
        player = setupEntity('player', 'Player', [], 'test_location');
        // Item 1 (has ItemComponent)
        item1 = setupEntity('item_key', 'Shiny Key', [new ItemComponent()], 'test_location');
        // Item 2 (has ItemComponent)
        item2 = setupEntity('item_dagger', 'Rusty Dagger', [new ItemComponent()], 'test_location');
        // Non-Item Entity (lacks ItemComponent)
        nonItemEntity = setupEntity('prop_statue', 'Stone Statue', [], 'test_location');
        // Example using NpcComponent (if testing specific non-item types)
        // nonItemEntity = setupEntity('npc_goblin', 'Grumpy Goblin', [new NpcComponent()], 'test_location');

        // Verify setup if needed (optional)
        const entitiesInLoc = entityManager.getEntitiesInLocation('test_location');
        expect(entitiesInLoc).toContain('player');
        expect(entitiesInLoc).toContain('item_key');
        expect(entitiesInLoc).toContain('item_dagger');
        expect(entitiesInLoc).toContain('prop_statue');
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

    // --- Helper Function to Simulate Command Execution (Copied from lookAction.basicLocation.test.js) ---
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

        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            currentLocation: testLocation,
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager,
            dispatch: dispatchSpy,
            eventBus: eventBus
        };

        const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);
        return actionResult;
    };

    // --- Test Scenario for LOOK-INT-LOC-02 ---
    describe('Scenario: Look at location with items', () => {
        it('should dispatch ui:display_location with name, description, and correctly listed items', async () => {
            // Arrange
            const expectedName = testLocation.getComponent(NameComponent).value;
            const expectedDescription = testLocation.getComponent(DescriptionComponent).text;
            // Use getDisplayName for consistency if the handler uses it
            const expectedItemNames = [
                getDisplayName(item1), // "Shiny Key"
                getDisplayName(item2)  // "Rusty Dagger"
            ].sort(); // Sort for predictable comparison

            // The expected payload structure. We focus on name, description, and items.
            // Using expect.objectContaining allows the actual payload to have *more*
            // properties (like exits, npcs) without failing the test, as long as
            // the ones we care about are present and correct.
            const expectedPayloadShape = {
                name: expectedName,
                description: expectedDescription,
                items: expect.arrayContaining(expectedItemNames) // Check items are present
                // We don't assert exits or npcs unless required by AC
            };

            dispatchSpy.mockClear(); // Clear spy calls after setup

            // Act: Simulate the 'look' command
            const actionResult = await simulateCommand('look');

            // Assert

            // 1. Check Action Result Success
            expect(actionResult).toBeDefined();
            expect(actionResult.success).toBe(true);

            // 2. Location Display Event: Wait for the ui:display_location event matching the shape
            let capturedPayload;
            try {
                capturedPayload = await waitForEvent(
                    dispatchSpy,
                    'ui:display_location',
                    expect.objectContaining(expectedPayloadShape), // Use objectContaining here
                    1000 // Timeout
                );
                console.log("[Test Case LOOK-INT-LOC-02] Successfully detected 'ui:display_location' event matching shape.");
            } catch (err) {
                console.error("[Test Case LOOK-INT-LOC-02] Failed to detect the expected 'ui:display_location' event shape.", err);
                // Log calls for debugging message issues
                try {
                    const seen = new Set(); // Handle potential circular references
                    console.log("[Test Case LOOK-INT-LOC-02] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) { return '[Circular]'; }
                            seen.add(value);
                        }
                        return value;
                    }, 2));
                } catch (stringifyError) {
                    console.error("[Test Case LOOK-INT-LOC-02] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case LOOK-INT-LOC-02] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw to fail test
            }

            // 3. Assert Items Array Content Specifically:
            //    Verify the exact items are present and non-items/player are excluded.
            expect(capturedPayload).toBeDefined(); // Ensure payload was captured
            expect(capturedPayload.items).toBeDefined(); // Ensure items array exists
            expect(capturedPayload.items.sort()).toEqual(expectedItemNames); // Check exact content (order-independent)
            expect(capturedPayload.items.length).toBe(expectedItemNames.length); // Ensure no extra items

            // Explicitly check that non-item and player names are NOT in the list
            const nonItemName = getDisplayName(nonItemEntity);
            const playerName = getDisplayName(player);
            expect(capturedPayload.items).not.toContain(nonItemName);
            expect(capturedPayload.items).not.toContain(playerName);


            // 4. No Error Messages: Ensure no error messages were displayed
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'ui:message_display',
                expect.objectContaining({ type: 'error' })
            );

            // 5. Console Checks: Ensure no unexpected errors/warnings
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
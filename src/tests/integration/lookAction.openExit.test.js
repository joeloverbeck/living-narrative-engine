// src/tests/integration/lookAction.openExit.test.js

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
import { PassageDetailsComponent } from '../../components/passageDetailsComponent.js'; // <<< REQUIRED for this test
// Import components needed for exclusion checks (even if not present)
import { ItemComponent } from '../../components/itemComponent.js';

// --- Utilities & Types ---
// Assume formatExitString is implicitly used by the look handler or NotificationUISystem
// We don't import it directly, but predict its output.
import { waitForEvent } from "../testUtils.js";
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../components/passageDetailsComponent').PassageDetailsData} PassageDetailsData */

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
describe('Integration Test: core:look Action - LOOK-INT-EXIT-01 (Open Passage)', () => {
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
    let locationA;
    let locationB;
    let connectionEntity;

    // --- Simplified setupEntity Helper (Adapted from existing tests) ---
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
        entityManager.registerComponent('PassageDetailsComponent', PassageDetailsComponent); // <<< Register PassageDetailsComponent
        entityManager.registerComponent('ItemComponent', ItemComponent); // Register for potential exclusion checks

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

        // 7. Setup test entities according to AC for LOOK-INT-EXIT-01
        const connectionDirection = 'north'; // Direction from A to B
        const returnDirection = 'south';   // Direction from B back to A
        const connectionType = 'path';
        const connectionEntityId = 'conn_a_to_b';

        // Location A
        locationA = setupEntity('location_a', 'Location A', [
            new DescriptionComponent({ text: 'You are in Location A.' }),
            // ConnectionsComponent links the 'north' direction to the connection entity
            new ConnectionsComponent({ connections: { [connectionDirection]: connectionEntityId } })
        ]);

        // Location B (Destination)
        locationB = setupEntity('location_b', 'Location B', [
            new DescriptionComponent({ text: 'You have reached Location B.' }),
            // Add connection back for completeness, though not strictly tested here
            new ConnectionsComponent({ connections: { [returnDirection]: connectionEntityId } })
        ]);

        // Connection Entity (The Passage)
        connectionEntity = setupEntity(connectionEntityId, 'North Passage', [
            new PassageDetailsComponent({
                locationAId: locationA.id,
                locationBId: locationB.id,
                directionAtoB: connectionDirection, // <<< ADDED ('north')
                directionBtoA: returnDirection,     // <<< ADDED ('south')
                type: connectionType,
                isHidden: false,
                blockerEntityId: null
            })
            // No PositionComponent needed for the connection entity itself
        ]);

        // Player starts in Location A
        player = setupEntity('player', 'Player', [], locationA.id);

        // Verify setup (optional, good for debugging)
        expect(player.getComponent(PositionComponent).locationId).toBe(locationA.id);
        const passageDetails = connectionEntity.getComponent(PassageDetailsComponent);
        expect(passageDetails).toBeDefined();
        expect(passageDetails.isHidden()).toBe(false);
        expect(passageDetails.blockerEntityId).toBeNull();
        expect(passageDetails.type).toBe(connectionType);
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

        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            // Ensure currentLocation is the entity object, not just the ID
            currentLocation: entityManager.getEntityInstance(player.getComponent(PositionComponent).locationId),
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager,
            dispatch: dispatchSpy,
            eventBus: eventBus
        };

        // Execute the action and return its result
        const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);
        return actionResult;
    };


    // --- Test Scenario for LOOK-INT-EXIT-01 ---
    describe('Scenario: Look at location with an open, visible exit', () => {
        it('should dispatch ui:display_location with name, description, and correctly formatted open exit string', async () => {
            // Arrange
            const expectedLocationName = locationA.getComponent(NameComponent).value;
            const expectedLocationDescription = locationA.getComponent(DescriptionComponent).text;
            const direction = 'north';
            const passageType = 'path';

            // Predict the output of formatExitString(direction, passageDetails, null, 'open')
            // Format: "Direction: A [type]" (Capitalized direction)
            const expectedExitString = `north: A ${passageType}`; // e.g., "North: A path"

            // We expect the payload to contain name, description, and an 'exits' array
            // containing our predicted string. Use objectContaining and arrayContaining.
            const expectedPayloadShape = {
                name: expectedLocationName,
                description: expectedLocationDescription,
                exits: expect.arrayContaining([expectedExitString])
                // We don't strictly assert the absence of items/npcs unless required,
                // but we will check the length of 'exits' later.
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
                console.log("[Test Case LOOK-INT-EXIT-01] Successfully detected 'ui:display_location' event matching shape with exit.");
            } catch (err) {
                console.error("[Test Case LOOK-INT-EXIT-01] Failed to detect the expected 'ui:display_location' event shape.", err);
                // Log calls for debugging message issues
                try {
                    const seen = new Set(); // Handle potential circular references
                    console.log("[Test Case LOOK-INT-EXIT-01] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) { return '[Circular]'; }
                            seen.add(value);
                        }
                        return value;
                    }, 2));
                } catch (stringifyError) {
                    console.error("[Test Case LOOK-INT-EXIT-01] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case LOOK-INT-EXIT-01] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw to fail test
            }

            // 3. Assert Exits Array Content Specifically:
            expect(capturedPayload).toBeDefined(); // Ensure payload was captured
            expect(capturedPayload.exits).toBeDefined(); // Ensure exits array exists
            expect(capturedPayload.exits).toEqual([expectedExitString]); // Check exact content and length
            expect(capturedPayload.exits.length).toBe(1); // Ensure only the expected exit is listed

            // 4. Assert other parts of the payload (optional but good)
            expect(capturedPayload.name).toBe(expectedLocationName);
            expect(capturedPayload.description).toBe(expectedLocationDescription);
            // Ensure items/npcs arrays are empty or undefined/null if expected
            expect(capturedPayload.items || []).toEqual([]); // Should be no items in locationA setup
            expect(capturedPayload.npcs || []).toEqual([]);   // Should be no NPCs in locationA setup

            // 5. No Error Messages: Ensure no error messages were displayed
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'ui:message_display',
                expect.objectContaining({ type: 'error' })
            );

            // 6. Console Checks: Ensure no unexpected errors/warnings
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
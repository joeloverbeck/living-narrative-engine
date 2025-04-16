// src/tests/integration/lookAction.missingEntities.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for type hints and setup
import {NotificationUISystem} from '../../systems/notificationUISystem.js'; // Handles ui:display_location

// --- Action Handler ---
import {executeLook} from '../../actions/handlers/lookActionHandler.js';

// --- Components ---
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js'; // <<< REQUIRED for exit details
// Import components needed for exclusion checks
import {ItemComponent} from '../../components/itemComponent.js';

// --- Utilities & Types ---
// Assume formatExitString is implicitly used by the look handler or NotificationUISystem
import {waitForEvent} from "../testUtils.js";
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */
/** @typedef {import('../../components/passageDetailsComponent').PassageDetailsData} PassageDetailsData */

// --- Mock DataManager ---
const mockDataManager = {
    actions: new Map([
        ['core:look', {id: 'core:look', commands: ['look', 'l']}],
    ]),
    getEntityDefinition: (id) => ({id: id, components: {}}), // Minimal definition lookup
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:look Action - LOOK-INT-EXIT-07 (Missing Entities)', () => {
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
    let locationB; // Needed for the valid connection case
    let validConnectionEntity; // Needed for the missing blocker case

    // --- Simplified setupEntity Helper (Adapted from existing tests) ---
    const setupEntity = (id, name, components = [], locationId = null) => {
        if (!entityManager || typeof entityManager.createEntityInstance !== 'function') {
            throw new Error(`[setupEntity] entityManager is invalid when setting up ${id}`);
        }
        // Use forceNew=true if IDs might clash between tests or setups within a test
        const entity = entityManager.createEntityInstance(id); // Use forceNew for clean setup in tests
        if (!entity) throw new Error(`Entity instance creation failed for ${id}`);

        // Add/Update Name Component
        if (!entity.hasComponent(NameComponent)) {
            entity.addComponent(new NameComponent({value: name}));
        } else {
            entity.getComponent(NameComponent).value = name;
        }

        // Position Component Handling
        let oldLocationId = null;
        const existingPosComp = entity.getComponent(PositionComponent);
        if (existingPosComp) oldLocationId = existingPosComp.locationId;

        if (locationId) {
            if (!existingPosComp) {
                entity.addComponent(new PositionComponent({locationId: locationId}));
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
            // Check if component of this type already exists before adding
            if (!entity.hasComponent(comp.constructor)) {
                entity.addComponent(comp);
            } else {
                // Optionally update existing component data if needed, or just skip
                console.warn(`[setupEntity] Component ${comp.constructor.name} already exists on ${id}. Skipping add.`);
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
        notificationUISystem = new NotificationUISystem({eventBus, dataManager: mockDataManager});

        // 4. Register Action Handler
        actionExecutor.registerHandler('core:look', executeLook);

        // 5. Initialize Systems
        notificationUISystem.initialize();

        // 6. Set up Spies
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });

        // 7. Setup base entities (player, locationA) common to both tests
        locationA = setupEntity('location_a', 'Location A', [
            new DescriptionComponent({text: 'You are in Location A.'}),
            // ConnectionsComponent will be modified per test case
            new ConnectionsComponent({connections: {}})
        ]);
        player = setupEntity('player', 'Player', [], locationA.id); // Place player in locationA

        // Setup other entities potentially needed (will be refined in test cases)
        locationB = setupEntity('location_b', 'Location B', [
            new DescriptionComponent({text: 'You have reached Location B.'})
        ]);
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
            await eventBus.dispatch('ui:message_display', {text: errorText, type: 'error'});
            return {success: false, messages: [{text: errorText, type: 'error'}]};
        }
        if (!parsedCommand.actionId && commandString.trim() === '') {
            return {success: true, messages: []};
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


    // --- Test Scenario 1: Missing Connection Entity ---
    describe('Scenario: Missing Connection Entity', () => {
        it('should succeed, omit missing connection, and log warning when connection entity is missing', async () => {
            // Arrange
            const direction = 'east';
            const nonExistentConnectionId = 'conn_a_to_nowhere';

            // Update locationA's connections to point to the non-existent ID
            locationA.getComponent(ConnectionsComponent).addConnection(direction, nonExistentConnectionId);

            const expectedLocationName = locationA.getComponent(NameComponent).value;
            const expectedLocationDescription = locationA.getComponent(DescriptionComponent).text;

            // The payload should NOT contain any 'exits' array or it should be empty
            const expectedPayloadShape = {
                name: expectedLocationName,
                description: expectedLocationDescription,
                // Explicitly check that exits is NOT present or is empty
            };

            // Expected warning message
            const expectedWarningMsg = `Could not find connection entity with ID: ${nonExistentConnectionId}`;

            dispatchSpy.mockClear();
            consoleWarnSpy.mockClear();

            // Act: Simulate the 'look' command
            const actionResult = await simulateCommand('look');

            // Assert

            // 1. Action Result Success
            expect(actionResult).toBeDefined();
            expect(actionResult.success).toBe(true);

            // 2. Console Warning Logged
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(expectedWarningMsg));

            // 3. Location Display Event: Wait for the event matching the shape
            let capturedPayload;
            try {
                capturedPayload = await waitForEvent(
                    dispatchSpy,
                    'ui:display_location',
                    expect.objectContaining(expectedPayloadShape),
                    1000
                );
                console.log("[Test Case LOOK-INT-EXIT-07 / Missing Connection] Successfully detected 'ui:display_location' event.");
            } catch (err) {
                console.error("[Test Case LOOK-INT-EXIT-07 / Missing Connection] Failed to detect the expected 'ui:display_location' event shape.", err);
                try {
                    const seen = new Set();
                    console.log("[Test Case LOOK-INT-EXIT-07 / Missing Connection] Dispatch Spy Calls:", JSON.stringify(dispatchSpy.mock.calls, (k, v) => seen.has(v) ? '[Circular]' : (typeof v === 'object' && v !== null ? seen.add(v) : v) || v, 2));
                } catch (stringifyError) {
                    console.error("Error stringifying calls:", stringifyError);
                    console.log("Raw calls:", dispatchSpy.mock.calls);
                }
                throw err;
            }

            // 4. Assert Exits Array Content Specifically: Ensure it's missing or empty
            expect(capturedPayload).toBeDefined();
            expect(capturedPayload.exits === undefined || (Array.isArray(capturedPayload.exits) && capturedPayload.exits.length === 0)).toBe(true);


            // 5. No Error Messages or Console Errors
            expect(dispatchSpy).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'error'}));
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });

});
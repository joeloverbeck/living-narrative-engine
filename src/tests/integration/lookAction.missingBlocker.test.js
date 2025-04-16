// src/tests/integration/lookAction.missingBlocker.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for type hints and setup
import {NotificationUISystem} from '../../systems/notificationUISystem.js'; // Handles ui:display_location

// --- Action Handler ---
// Assuming executeLook includes the fix for the missing blocker warning
import {executeLook} from '../../actions/handlers/lookActionHandler.js';

// --- Components ---
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js'; // Keep for potential general use in _getVisibleEntityNames

// --- Utilities & Types ---
import {waitForEvent} from "../testUtils.js"; // Assuming testUtils.js is in ../ relative to this file
// Add any other necessary type imports if used by helpers
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock DataManager ---
// Minimal mock needed for this test
const mockDataManager = {
    actions: new Map([
        ['core:look', {id: 'core:look', commands: ['look', 'l']}],
    ]),
    getEntityDefinition: (id) => ({id: id, components: {}}), // Minimal definition lookup
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:look Action - Missing Blocker Scenario', () => {
    // --- Declare variables needed across tests/setup ---
    let entityManager;
    let eventBus;
    let commandParser;
    let actionExecutor;
    let notificationUISystem;
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;

    // Test-specific entities
    let player;
    let locationA;
    let locationB;
    let validConnectionEntity; // Specific to the missing blocker test

    // --- Simplified setupEntity Helper ---
    // (Copied from the original file)
    const setupEntity = (id, name, components = [], locationId = null) => {
        if (!entityManager || typeof entityManager.createEntityInstance !== 'function') {
            throw new Error(`[setupEntity] entityManager is invalid when setting up ${id}`);
        }
        const entity = entityManager.createEntityInstance(id);
        if (!entity) throw new Error(`Entity instance creation failed for ${id}`);

        if (!entity.hasComponent(NameComponent)) {
            entity.addComponent(new NameComponent({value: name}));
        } else {
            entity.getComponent(NameComponent).value = name;
        }

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

        components.forEach(comp => {
            if (!entity.hasComponent(comp.constructor)) {
                entity.addComponent(comp);
            } else {
                // Avoid warnings in clean test run unless debugging component add logic
                // console.warn(`[setupEntity] Component ${comp.constructor.name} already exists on ${id}. Skipping add.`);
            }
        });
        return entity;
    };
    // --- End setupEntity Helper ---

    // --- beforeEach ---
    // Sets up the common environment for the test
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
        entityManager.registerComponent('PassageDetailsComponent', PassageDetailsComponent);
        entityManager.registerComponent('ItemComponent', ItemComponent); // Keep registered

        // 3. Instantiate Systems
        notificationUISystem = new NotificationUISystem({eventBus, dataManager: mockDataManager});

        // 4. Register Action Handler
        actionExecutor.registerHandler('core:look', executeLook);

        // 5. Initialize Systems
        notificationUISystem.initialize();

        // 6. Set up Spies (mock console *before* potentially noisy setup)
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        }); // Mock warn
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');


        // 7. Setup base entities needed for the test scenario
        locationA = setupEntity('location_a', 'Location A', [
            new DescriptionComponent({text: 'You are in Location A.'}),
            new ConnectionsComponent({connections: {}}) // Start with empty connections
        ]);
        player = setupEntity('player', 'Player', [], locationA.id); // Place player in locationA
        locationB = setupEntity('location_b', 'Location B', [ // Needed for the connection target
            new DescriptionComponent({text: 'You have reached Location B.'})
        ]);
    });
    // --- End beforeEach ---

    // --- afterEach ---
    // Cleans up after the test
    afterEach(() => {
        // Restore spies
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore(); // Restore console.warn

        // Shutdown systems and clear entities
        notificationUISystem.shutdown();
        entityManager.clearAll();
    });
    // --- End afterEach ---

    // --- Helper Function: simulateCommand ---
    // (Copied from the original file)
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);

        if (!parsedCommand.actionId && commandString.trim() !== '') {
            const errorText = parsedCommand.error || "Unknown command.";
            // Use eventBus directly if dispatch spy isn't meant for this
            await eventBus.dispatch('ui:message_display', {text: errorText, type: 'error'});
            return {success: false, messages: [{text: errorText, type: 'error'}]};
        }
        if (!parsedCommand.actionId && commandString.trim() === '') {
            // Handle empty input if necessary, or let look handle it
            return {success: true, messages: []};
        }

        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            // Ensure player position is correctly fetched for currentLocation
            currentLocation: entityManager.getEntityInstance(player.getComponent(PositionComponent)?.locationId),
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager,
            dispatch: dispatchSpy, // Pass spy if needed by action directly (uncommon)
            eventBus: eventBus    // Pass the actual eventBus instance
        };

        // Basic check for currentLocation existence before execution
        if (!context.currentLocation) {
            console.error("simulateCommand Error: Player has no valid location.");
            // Handle appropriately, maybe return error or throw
            return {
                success: false,
                messages: [{text: "Cannot execute command: Player location unknown.", type: 'error'}]
            };
        }


        const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);
        return actionResult;
    };
    // --- End simulateCommand ---


    // --- Test Case: Missing Blocker Entity ---
    it('should succeed, format exit as open, and log warning when blocker entity is missing', async () => {
        // --- Arrange ---
        const direction = 'west';
        const validConnectionId = 'conn_a_to_b_valid';
        const nonExistentBlockerId = 'blocker_phantom'; // This entity ID will not be created
        const passageType = 'doorway';

        // 1. Setup the Connection Entity (with PassageDetails pointing to the non-existent blocker)
        validConnectionEntity = setupEntity(validConnectionId, 'West Passage', [
            new PassageDetailsComponent({
                locationAId: locationA.id,
                locationBId: locationB.id,
                directionAtoB: direction,
                directionBtoA: 'east',
                type: passageType,
                isHidden: false,
                blockerEntityId: nonExistentBlockerId // <<< Point to non-existent blocker
            })
        ]);
        expect(validConnectionEntity).toBeDefined();

        // 2. Add the Connection to Location A & **VERIFY SETUP**
        const connectionsCompInstance = locationA.getComponent(ConnectionsComponent);
        if (!connectionsCompInstance) {
            throw new Error("[TEST SETUP ERROR] Could not get ConnectionsComponent from locationA!");
        }
        // Optional: Log instance for deep debugging if needed
        // console.log('[TEST SETUP DEBUG] Got ConnectionsComponent instance:', connectionsCompInstance);

        console.log(`[TEST SETUP DEBUG] Calling addConnection('${direction}', '${validConnectionId}')`);
        connectionsCompInstance.addConnection(direction, validConnectionId);

        // *** Verify state immediately after adding ***
        const connectionsAfterAdd = connectionsCompInstance.getAllConnections();
        console.log('[TEST SETUP DEBUG] Result of getAllConnections() immediately after addConnection:', JSON.stringify(connectionsAfterAdd));
        // Use Jest assertions for verification
        expect(connectionsAfterAdd).toHaveLength(1); // Check length first
        expect(connectionsAfterAdd[0]).toEqual({ // Check content
            direction: direction.toLowerCase().trim(), // Match how it's stored
            connectionEntityId: validConnectionId
        });
        // ********************************************

        // 3. Define Expected Results
        const expectedLocationName = locationA.getComponent(NameComponent).value;
        const expectedLocationDescription = locationA.getComponent(DescriptionComponent).text;
        const expectedExitString = `west: An open doorway`; // Expect the 'open' state description for a doorway

        const expectedPayload = {
            name: expectedLocationName,
            description: expectedLocationDescription,
            exits: [expectedExitString],
            items: undefined,
            npcs: undefined
        };

        const expectedWarningMsg = `Blocker entity with ID '${nonExistentBlockerId}' not found for connection ${validConnectionId}. Treating passage as unblocked.`;

        // 4. Reset Spies before Act
        consoleWarnSpy.mockClear(); // Clear specific spy for this test's assertion

        // --- Act ---
        console.log('[TEST ACT DEBUG] Calling simulateCommand("look")');
        const actionResult = await simulateCommand('look');

        // --- Assert ---

        // 1. Action Result Success
        expect(actionResult).toBeDefined();
        expect(actionResult.success).toBe(true);

        // 2. Console Warning Logged
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(expectedWarningMsg));

        // 3. Location Display Event Captured
        let capturedPayload;
        try {
            capturedPayload = await waitForEvent(
                dispatchSpy,
                'ui:display_location',
                expect.any(Object), // Check payload structure afterwards
                1500 // Timeout
            );
            console.log("[Test Case] Successfully detected 'ui:display_location' event.");
        } catch (err) {
            console.error("[Test Case] Failed to detect the 'ui:display_location' event.", err);
            try { // Log spy calls on failure
                const seen = new Set();
                console.log("[Test Case] Dispatch Spy Calls on failure:", JSON.stringify(dispatchSpy.mock.calls, (k, v) => seen.has(v) ? '[Circular]' : (typeof v === 'object' && v !== null ? seen.add(v) : v) || v, 2));
            } catch (stringifyError) {
                console.error("Error stringifying spy calls:", stringifyError);
                console.log("Raw spy calls:", dispatchSpy.mock.calls);
            }
            throw err;
        }

        // 4. Assert Captured Payload Content
        expect(capturedPayload).toBeDefined();
        expect(capturedPayload).toEqual(expectedPayload); // Strict check of the payload

        // 5. No Console Errors or Error Messages Dispatched
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({type: 'error'}));
    });
    // --- End Test Case ---

}); // End describe block
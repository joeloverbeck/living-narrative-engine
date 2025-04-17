// src/tests/integration/openAction.successfulOpen.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for instanceof check
import OpenableSystem from '../../systems/openableSystem.js';
import {NotificationUISystem} from '../../systems/notificationUISystem.js';

// --- Action Handler ---
import {executeOpen} from '../../actions/handlers/openActionHandler.js';

// --- Components ---
import OpenableComponent from '../../components/openableComponent.js';
import LockableComponent from '../../components/lockableComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';

// --- Utilities & Types ---
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
import {waitForEvent} from "../testUtils.js";
import {EVENT_DISPLAY_MESSAGE, EVENT_ENTITY_OPENED} from "../../types/eventTypes.js"; // Assuming testUtils.js is one level up
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock DataManager ---
const mockDataManager = {
    actions: new Map([
        ['core:open', {id: 'core:open', commands: ['open', 'o']}],
    ]),
    getEntityDefinition: (id) => ({id: id, components: {}}), // Minimal definition lookup
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:open Action', () => {
    let entityManager; // <<< Declared in describe scope
    let eventBus;
    let commandParser;
    let actionExecutor;
    let openableSystem;
    let notificationUISystem;
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;
    // let consoleLogSpy; // <<< REMOVED/Commented out

    // --- Test Entities ---
    let player;
    let testLocation;
    let closedChest; // Moved declaration here

    // --- Refined setupEntity Helper ---
    const setupEntity = (id, name, components = [], locationId = 'test_location') => {
        // <<< Log entry to setupEntity >>>
        console.log(`[setupEntity ENTER] id: ${id}, name: ${name}, locationId: ${locationId}`);
        // Safety check on entityManager right at the start of the helper
        if (!entityManager || typeof entityManager.createEntityInstance !== 'function') {
            console.error(`[setupEntity FATAL] entityManager is invalid at start! Type: ${typeof entityManager?.createEntityInstance}`);
            throw new Error(`[setupEntity] entityManager is invalid when setting up ${id}`);
        }

        const entity = entityManager.createEntityInstance(id);

        if (!entity) {
            console.error(`[setupEntity ERROR] Failed to create or retrieve entity instance for ${id}`);
            throw new Error(`Entity instance creation failed for ${id}`);
        }
        console.log(`[setupEntity] Instance obtained/created for ${id}`);

        // Add/Update Name Component
        if (!entity.hasComponent(NameComponent)) {
            entity.addComponent(new NameComponent({value: name}));
        } else {
            entity.getComponent(NameComponent).value = name; // Update if exists
        }

        // --- Refined Position Component Handling & Index Notification ---
        let oldLocationId = null;
        const existingPosComp = entity.getComponent(PositionComponent);

        if (existingPosComp) {
            oldLocationId = existingPosComp.locationId;
            // console.log(`[setupEntity] Entity ${id} already has PositionComponent. Old Location: ${oldLocationId}`); // Optional Log
        }

        // Add or Update Position Component
        if (!existingPosComp) {
            // console.log(`[setupEntity] Adding new PositionComponent to ${id} with location ${locationId}`); // Optional Log
            entity.addComponent(new PositionComponent({locationId: locationId}));
        } else if (existingPosComp.locationId !== locationId) {
            // console.log(`[setupEntity] Updating existing PositionComponent on ${id} from ${oldLocationId} to ${locationId}`); // Optional Log
            existingPosComp.locationId = locationId;
        } else {
            // console.log(`[setupEntity] PositionComponent on ${id} already has correct location ${locationId}.`); // Optional Log
        }

        // Notify AFTER the component state is correct
        if (oldLocationId !== locationId) {
            console.log(`[setupEntity] Notifying position change for ${id}: ${oldLocationId} -> ${locationId}`); // Log the notification
            // Safety check before calling notify
            if (!entityManager || typeof entityManager.notifyPositionChange !== 'function') {
                console.error(`[setupEntity FATAL] entityManager invalid before notifyPositionChange for ${id}! Type: ${typeof entityManager?.notifyPositionChange}`);
                throw new Error(`[setupEntity] entityManager invalid before notifyPositionChange for ${id}`);
            }
            entityManager.notifyPositionChange(id, oldLocationId, locationId);
        }
        // --- End Refined Handling ---

        // Add other components passed in the array
        components.forEach(comp => {
            // Check using the actual class constructor
            if (!entity.hasComponent(comp.constructor)) {
                entity.addComponent(comp);
            } else {
                // console.warn(`[setupEntity] Component ${comp.constructor.name} already exists on ${id}. Skipping add.`);
            }
        });

        console.log(`[setupEntity EXIT] Finished setup for ${id}`);
        return entity;
    };
    // --- End setupEntity Helper ---


    beforeEach(() => {
        // 1. Instantiate core modules
        entityManager = new EntityManager(mockDataManager); // <<< Assigned here
        eventBus = new EventBus();
        commandParser = new CommandParser(mockDataManager);
        actionExecutor = new ActionExecutor();

        // <<< Check after instantiation >>>
        console.log(`[BeforeEach START] typeof entityManager.createEntityInstance: ${typeof entityManager?.createEntityInstance}`);
        console.log(`[BeforeEach START] entityManager is instance of EntityManager?`, entityManager instanceof EntityManager);

        // 2. Register REAL components with EntityManager
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('OpenableComponent', OpenableComponent);
        entityManager.registerComponent('LockableComponent', LockableComponent);
        entityManager.registerComponent('PositionComponent', PositionComponent);

        // 3. Instantiate Systems
        openableSystem = new OpenableSystem({eventBus, entityManager});
        notificationUISystem = new NotificationUISystem({eventBus, dataManager: mockDataManager});

        // 4. Register Action Handler
        actionExecutor.registerHandler('core:open', executeOpen);

        // 5. Initialize Systems
        openableSystem.initialize();
        notificationUISystem.initialize();

        // 6. Set up Spies
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        // consoleLogSpy mock REMOVED

        // 7. Setup common test entities using the modified helper
        console.log('[BeforeEach] Setting up player...');
        player = setupEntity('player', 'Player');
        // <<< Check after first setupEntity call >>>
        console.log(`[BeforeEach after player] typeof entityManager.createEntityInstance: ${typeof entityManager?.createEntityInstance}`);
        console.log(`[BeforeEach after player] entityManager is instance of EntityManager?`, entityManager instanceof EntityManager);


        console.log('[BeforeEach] Setting up testLocation...');
        testLocation = setupEntity('test_location', 'Test Room');
        // <<< Check after second setupEntity call >>>
        console.log(`[BeforeEach END] typeof entityManager.createEntityInstance: ${typeof entityManager?.createEntityInstance}`);
        console.log(`[BeforeEach END] entityManager is instance of EntityManager?`, entityManager instanceof EntityManager);
    });

    afterEach(() => {
        // Restore spies
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        // consoleLogSpy?.mockRestore(); // REMOVED

        // Optional: Call system shutdown methods
        openableSystem.shutdown();
        notificationUISystem.shutdown();
        entityManager.clearAll(); // Good practice to clear entities
    });

    // --- Helper Function to Simulate Command Execution ---
    const simulateCommand = async (commandString) => {
        console.log(`[simulateCommand] Parsing: "${commandString}"`); // Log command start
        const parsedCommand = commandParser.parse(commandString);
        console.log(`[simulateCommand] Parsed:`, parsedCommand); // Log parsed result

        if (!parsedCommand.actionId && commandString.trim() !== '') {
            if (parsedCommand.error) {
                await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: parsedCommand.error, type: 'error'});
            } else {
                await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: "Unknown command.", type: 'error'});
            }
            return;
        }
        if (!parsedCommand.actionId && commandString.trim() === '') {
            return;
        }

        // <<< Check entityManager right before creating context >>>
        console.log(`[simulateCommand pre-context] typeof entityManager.createEntityInstance: ${typeof entityManager?.createEntityInstance}`);
        console.log(`[simulateCommand pre-context] entityManager is instance of EntityManager?`, entityManager instanceof EntityManager);

        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            currentLocation: testLocation,
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager, // Pass the instance
            dispatch: dispatchSpy, // Keep passing the spy for handlers that might *still* use it (though they shouldn't)
            eventBus: eventBus     // Pass the real eventBus
        };

        // <<< Check context properties >>>
        console.log(`[simulateCommand Context Check] playerEntity ID: ${context.playerEntity?.id}, currentLocation ID: ${context.currentLocation?.id}`);
        console.log(`[simulateCommand Context Check] typeof context.entityManager.createEntityInstance: ${typeof context.entityManager?.createEntityInstance}`);
        console.log(`[simulateCommand Context Check] context.entityManager === global entityManager?`, context.entityManager === entityManager); // Verify it's the same instance


        console.log(`[simulateCommand] Executing action: ${parsedCommand.actionId}`);
        // Execute the action
        await actionExecutor.executeAction(parsedCommand.actionId, context);
        console.log(`[simulateCommand] Finished executing action: ${parsedCommand.actionId}`);
    };

    // --- Test Scenarios ---
    describe('Scenario: Successful Open', () => {
        it('should open a closed, unlocked chest, update state, and dispatch correct events/messages', async () => {
            console.log('[Test Case START] Beginning test execution...'); // Log test start

            // Arrange
            // <<< Check entityManager right before the failing call >>>
            console.log(`[Test Case START] typeof entityManager.createEntityInstance: ${typeof entityManager?.createEntityInstance}`);
            console.log(`[Test Case START] entityManager is instance of EntityManager?`, entityManager instanceof EntityManager); // Add instanceof check

            console.log('[Test Case] Setting up closedChest...');
            closedChest = setupEntity('chest_closed', 'chest', [new OpenableComponent({isOpen: false})]); // <<< FAILING LINE SHOULD BE HERE
            console.log('[Test Case] Finished setting up closedChest.');

            // <<< Check entityManager after the call (if it doesn't error) >>>
            console.log(`[Test Case after chest] typeof entityManager.createEntityInstance: ${typeof entityManager?.createEntityInstance}`);
            console.log(`[Test Case after chest] entityManager is instance of EntityManager?`, entityManager instanceof EntityManager); // Add instanceof check


            dispatchSpy.mockClear();

            // Expected success message payload
            const expectedSuccessMessagePayload = {
                text: TARGET_MESSAGES.OPEN_SUCCESS('chest'), // Assuming OPEN_SUCCESS exists and takes name
                type: 'success'
            };
            console.log('[Test Case] Expected success payload:', expectedSuccessMessagePayload);

            // Act
            console.log('[Test Case] Calling simulateCommand("open chest")...');
            await simulateCommand('open chest');
            console.log('[Test Case] Returned from simulateCommand.');


            // --- NEW: Wait for the success UI message ---
            console.log('[Test Case] Waiting for event "ui:message_display"...');
            try {
                // Use await for the asynchronous waitForEvent function
                await waitForEvent(dispatchSpy, EVENT_DISPLAY_MESSAGE, expectedSuccessMessagePayload);
                console.log("[Test Case] Successfully detected EVENT_DISPLAY_MESSAGE success event.");
            } catch (err) {
                console.error("[Test Case] Failed to detect the expected success message.", err);
                // Log the calls that *did* happen for debugging
                // Ensure JSON.stringify handles potential circular refs gracefully if payloads are complex
                try {
                    console.log("[Test Case] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, null, 2));
                } catch (stringifyError) {
                    console.error("[Test Case] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw the timeout error to fail the test
            }
            // --- END NEW ---

            // Assert
            console.log('[Test Case] Starting assertions...');
            // 1. State Change
            const chestComp = closedChest.getComponent(OpenableComponent);
            expect(chestComp).toBeDefined();
            expect(chestComp.isOpen).toBe(true); // Check state *after* waiting

            // 2. Event Sequence (Check these *after* waiting)
            expect(dispatchSpy).toHaveBeenCalledWith('event:open_attempted',
                expect.objectContaining({actorId: 'player', targetEntityId: 'chest_closed'})
            );
            expect(dispatchSpy).toHaveBeenCalledWith(EVENT_ENTITY_OPENED,
                expect.objectContaining({actorId: 'player', targetEntityId: 'chest_closed', targetDisplayName: 'chest'})
            );

            // 3. UI Message (We already waited for this specific call, but assert again)
            expect(dispatchSpy).toHaveBeenCalledWith(EVENT_DISPLAY_MESSAGE, expectedSuccessMessagePayload);

            // 4. No failure events/messages
            expect(dispatchSpy).not.toHaveBeenCalledWith(expect.stringMatching(/event:open_failed/), expect.anything());
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            console.log('[Test Case] Assertions complete.');
        });
    });
});
// src/tests/integration/openAction.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js';
import OpenableSystem from '../../systems/openableSystem.js';
import { NotificationUISystem } from '../../systems/notificationUISystem.js'; // Ensure correct import path

// --- Action Handler ---
import { executeOpen } from '../../actions/handlers/openActionHandler.js'; // The specific handler

// --- Components ---
import OpenableComponent from '../../components/openableComponent.js';
import LockableComponent from '../../components/lockableComponent.js';
import { NameComponent } from '../../components/nameComponent.js';
import { PositionComponent } from '../../components/positionComponent.js'; // Needed for scope checks

// --- Utilities & Types ---
import { TARGET_MESSAGES, getDisplayName } from '../../utils/messages.js';
import {EVENT_ENTITY_OPENED, EVENT_OPEN_ATTEMPTED, EVENT_OPEN_FAILED} from "../../types/eventTypes";
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock DataManager ---
// A minimal mock to satisfy CommandParser dependencies
const mockDataManager = {
    actions: new Map([
        ['core:open', { id: 'core:open', commands: ['open', 'o'] }],
        // Add other actions if their commands could interfere or are needed by helper functions
    ]),
    getEntityDefinition: (id) => ({ id: id, components: {} }), // Minimal definition lookup
    // Add other methods if NotificationUISystem uses them (e.g., getPlayerId)
    getPlayerId: () => 'player' // Assuming NotificationUISystem might use this
};

// --- Test Suite ---
describe('Integration Test: core:open Action', () => {
    let entityManager;
    let eventBus;
    let commandParser;
    let actionExecutor;
    let openableSystem;
    let notificationUISystem;
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;
    let consoleLogSpy;

    // --- Test Entities ---
    let player;
    let testLocation; // Simple entity to act as location
    let plainBox;

    // Helper to create and register entities
    const setupEntity = (id, name, components = [], locationId = 'test_location') => {
        // CHANGE THIS LINE: Remove 'true' or explicitly set to 'false'
        // const entity = entityManager.createEntityInstance(id, true);
        const entity = entityManager.createEntityInstance(id); // Use default forceNew = false

        // Ensure the entity was actually created before adding components
        if (!entity) {
            console.error(`Failed to create or retrieve entity instance for ${id} in setupEntity`);
            // You might want to throw an error here to fail the test early if creation fails
            throw new Error(`Entity instance creation failed for ${id}`);
        }

        entity.addComponent(new NameComponent({ value: name }));
        // Ensure PositionComponent is added for scope resolution
        // Check if it already has one from definition before adding potentially duplicate
        if (!entity.hasComponent(PositionComponent)) {
            entity.addComponent(new PositionComponent({ locationId: locationId }));
        } else {
            // Optionally update existing position if needed, though createEntityInstance
            // should handle components from definition now.
            entity.getComponent(PositionComponent).locationId = locationId;
        }

        components.forEach(comp => {
            // Prevent adding duplicate components if the definition already included them
            // This assumes components have a unique identifier like constructor.name
            // or a static 'getKey()' method. Adjust as needed.
            const compKey = comp.constructor?.name || typeof comp; // Basic key example
            if (!entity.getComponent(compKey)) { // Or use hasComponent with the correct key/class
                entity.addComponent(comp);
            } else {
                console.warn(`setupEntity: Component ${compKey} already exists on ${id}. Skipping add.`);
                // Optionally, update the existing component's data instead of skipping
            }
        });

        // Add to spatial index if needed (createEntityInstance should handle initial add)
        // But ensure position updates are notified if changed here.
        // Note: createEntityInstance already handles adding to spatial index if PositionComponent exists
        // If you *change* the locationId *after* creation, you might need notifyPositionChange.
        // Since we set it during addComponent or ensure it exists, the initial index add should be fine.

        return entity;
    };


    beforeEach(() => {
        // 1. Instantiate core modules
        entityManager = new EntityManager(mockDataManager); // Use real EM
        eventBus = new EventBus(); // Use real EventBus
        commandParser = new CommandParser(mockDataManager); // Use real Parser
        actionExecutor = new ActionExecutor(); // Use real Executor

        // 2. Register REAL components with EntityManager
        // Important: Use the actual keys expected in definitions/logic if different
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('OpenableComponent', OpenableComponent);
        entityManager.registerComponent('LockableComponent', LockableComponent);
        entityManager.registerComponent('PositionComponent', PositionComponent);
        // Register other components if needed by test entities

        // 3. Instantiate Systems
        openableSystem = new OpenableSystem({ eventBus, entityManager });
        notificationUISystem = new NotificationUISystem({ eventBus, dataManager: mockDataManager }); // Provide mock DM

        // 4. Register Action Handler
        actionExecutor.registerHandler('core:open', executeOpen);

        // 5. Initialize Systems (subscribes them to EventBus)
        openableSystem.initialize();
        notificationUISystem.initialize();

        // 6. Set up Spies AFTER instances are created
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        // 7. Setup common test entities
        // Note: locationId must match for 'nearby' scope checks to work implicitly via EntityManager state
        player = setupEntity('player', 'Player');
        testLocation = setupEntity('test_location', 'Test Room');
        // Ensure player is also "in" the test location
        player.getComponent(PositionComponent).locationId = 'test_location';
        entityManager.notifyPositionChange('player', null, 'test_location'); // Update spatial index if needed
    });

    afterEach(() => {
        // Restore spies
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
        // Optional: Call system shutdown methods if they exist and need cleanup
        openableSystem.shutdown();
        notificationUISystem.shutdown();
    });

    // --- Helper Function to Simulate Command Execution ---
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);

        // Basic check if parsing failed fundamentally (e.g., empty input)
        if (!parsedCommand.actionId && commandString.trim() !== '') {
            // If parser itself identifies an error (like unknown command)
            if(parsedCommand.error) {
                await eventBus.dispatch('ui:message_display', { text: parsedCommand.error, type: 'error'});
            } else {
                // Handle cases where parser returns no actionId but no specific error
                // This shouldn't happen for known commands but handles edge cases
                await eventBus.dispatch('ui:message_display', { text: "Unknown command.", type: 'error'});
            }
            return; // Stop processing if parsing fails significantly
        }
        // Handle case of empty input string which correctly results in no actionId/error
        if(!parsedCommand.actionId && commandString.trim() === '') {
            return; // Do nothing for empty input
        }


        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            // Critical: currentLocation must be the entity representing the location
            currentLocation: testLocation,
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager,
            // Pass the spied dispatch function
            dispatch: dispatchSpy, // <-- Use the spy directly here!
            eventBus: eventBus
        };

        // Execute the action - Use await because handler and event dispatch are async
        await actionExecutor.executeAction(parsedCommand.actionId, context);
    };

    // --- Test Scenarios (Matching ACs) ---



    describe('Scenario: Target Not Openable (Component Missing)', () => {
        it('should fail to resolve target, display failure message, and dispatch no open events', async () => {
            // Arrange
            plainBox = setupEntity('box_plain', 'box'); // No OpenableComponent
            dispatchSpy.mockClear();

            // Act
            await simulateCommand('open box');

            // Assert
            // 1. State Change (No entity to change) - N/A

            // 2. Event Sequence (No open attempt/success/failure)
            expect(dispatchSpy).not.toHaveBeenCalledWith(expect.stringMatching(new RegExp(EVENT_OPEN_ATTEMPTED)), expect.anything());
            expect(dispatchSpy).not.toHaveBeenCalledWith(expect.stringMatching(new RegExp(EVENT_ENTITY_OPENED)), expect.anything());
            expect(dispatchSpy).not.toHaveBeenCalledWith(expect.stringMatching(new RegExp(EVENT_OPEN_FAILED)), expect.anything());


            // 3. UI Message (From handleActionWithTargetResolution failure)
            // The message depends on whether other openable things are nearby. Assuming ONLY the box is targetable by name nearby,
            // but fails the component filter, it should trigger FILTER_EMPTY. If other non-matching things were there, it might be NOT_FOUND.
            // Let's assume FILTER_EMPTY is the expected outcome here based on the setup.
            expect(dispatchSpy).toHaveBeenCalledWith('ui:message_display', {
                // Note: Scope might differ slightly if 'nearby_including_blockers' isn't exactly mapped; adjust if needed.
                text: TARGET_MESSAGES.FILTER_EMPTY_OPENABLE('open', 'nearby_including_blockers'), // Check scope name carefully
                type: 'info' // Or 'warning' depending on how handleAction... maps FILTER_EMPTY
            });
            // Alternative check if NOT_FOUND is expected instead:
            // expect(dispatchSpy).toHaveBeenCalledWith('ui:message_display', {
            //     text: TARGET_MESSAGES.NOT_FOUND_OPENABLE('box'),
            //     type: 'info' // Or 'warning'
            // });

            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });
});
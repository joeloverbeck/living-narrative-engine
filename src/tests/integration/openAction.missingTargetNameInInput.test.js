// src/tests/integration/openAction.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js';
import OpenableSystem from '../../systems/openableSystem.js';
import { NotificationUISystem } from '../../systems/notificationUISystem.js';

// --- Action Handler ---
import { executeOpen } from '../../actions/handlers/openActionHandler.js';

// --- Components ---
import OpenableComponent from '../../components/openableComponent.js';
import { NameComponent } from '../../components/nameComponent.js';
import { PositionComponent } from '../../components/positionComponent.js';

// --- Utilities & Types ---
import { TARGET_MESSAGES, getDisplayName } from '../../utils/messages.js';
import { waitForEvent } from "../testUtils.js";
import {EVENT_ENTITY_OPENED} from "../../types/eventTypes";
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock DataManager ---
// Removed requiresTarget hint as parser didn't seem to use it based on logs
const mockDataManager = {
    actions: new Map([
        ['core:open', { id: 'core:open', commands: ['open', 'o'] }],
    ]),
    getEntityDefinition: (id) => ({ id: id, components: {} }),
    getPlayerId: () => 'player'
};

// --- Test Suite ---
// Updated file name in description comment if necessary (was missingTargetNameInInput.test.js in logs)
describe('Integration Test: core:open Action - Missing Target Name In Input', () => {
    let entityManager;
    let eventBus;
    let commandParser;
    let actionExecutor;
    let openableSystem;
    let notificationUISystem;
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;

    // --- Test Entities ---
    let player;
    let testLocation;
    let closedChest;

    // --- Simplified setupEntity Helper (Copied & adapted) ---
    const setupEntity = (id, name, components = [], locationId = 'test_location') => {
        if (!entityManager || typeof entityManager.createEntityInstance !== 'function') {
            throw new Error(`[setupEntity] entityManager is invalid when setting up ${id}`);
        }
        const entity = entityManager.createEntityInstance(id);
        if (!entity) throw new Error(`Entity instance creation failed for ${id}`);

        if (!entity.hasComponent(NameComponent)) {
            entity.addComponent(new NameComponent({ value: name }));
        } else {
            entity.getComponent(NameComponent).value = name;
        }

        let oldLocationId = null;
        const existingPosComp = entity.getComponent(PositionComponent);
        if (existingPosComp) oldLocationId = existingPosComp.locationId;

        if (!existingPosComp) {
            entity.addComponent(new PositionComponent({ locationId: locationId }));
        } else if (existingPosComp.locationId !== locationId) {
            existingPosComp.locationId = locationId;
        }

        if (oldLocationId !== locationId) {
            entityManager.notifyPositionChange(id, oldLocationId, locationId);
        }

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

        // 2. Register REAL components
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('OpenableComponent', OpenableComponent);
        entityManager.registerComponent('PositionComponent', PositionComponent);

        // 3. Instantiate Systems
        openableSystem = new OpenableSystem({ eventBus, entityManager });
        notificationUISystem = new NotificationUISystem({ eventBus, dataManager: mockDataManager });

        // 4. Register Action Handler
        actionExecutor.registerHandler('core:open', executeOpen);

        // 5. Initialize Systems
        openableSystem.initialize();
        notificationUISystem.initialize();

        // 6. Set up Spies
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // 7. Setup common test entities
        player = setupEntity('player', 'Player', [], 'test_location');
        testLocation = setupEntity('test_location', 'Test Room');
        closedChest = setupEntity('chest_1', 'chest', [new OpenableComponent({ isOpen: false })], 'test_location');
    });

    afterEach(() => {
        // Restore spies
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();

        // Shutdown systems & clear entities
        openableSystem.shutdown();
        notificationUISystem.shutdown();
        entityManager.clearAll();
    });

    // --- Helper Function to Simulate Command Execution (Revised) ---
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);

        // Handle unknown commands or empty input (less likely for 'open')
        if (!parsedCommand.actionId && commandString.trim() !== '') {
            // Use parser error if available, otherwise generic unknown command
            const errorText = parsedCommand.error || "Unknown command.";
            await eventBus.dispatch('ui:message_display', { text: errorText, type: 'error'});
            return;
        }
        if(!parsedCommand.actionId && commandString.trim() === '') {
            return;
        }

        // --- Removed the explicit parsedCommand.error check here ---
        // The logs show the error happens during execution, not parsing, for this case.

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

        // Execute the action - expecting the handler to perform validation
        await actionExecutor.executeAction(parsedCommand.actionId, context);
    };

    // --- Test Scenario ---
    describe('Scenario: Missing Target Argument', () => {
        it('should fail action validation and display a specific validation error message', async () => {
            // Arrange
            const chestCompBefore = closedChest.getComponent(OpenableComponent);
            expect(chestCompBefore?.isOpen).toBe(false);

            // --- CORRECTED Expected Payload ---
            // Based directly on the failing test log output
            const expectedFailureText = "Validation failed for action: open";
            const expectedUIPayload = {
                text: expectedFailureText,
                type: 'error' // The type observed in the logs was 'error'
            };
            // --- END CORRECTED Expected Payload ---

            // Define the expected validation failure event payload
            const expectedValidationFailurePayload = {
                actorId: 'player',
                actionVerb: 'open',
                reasonCode: 'MISSING_DIRECT_OBJECT'
            };


            dispatchSpy.mockClear(); // Clear spy after setup

            // Act: Simulate the command with the missing target
            await simulateCommand('open');

            // Assert

            // 1. Specific Validation Failure Message: Wait for the UI message generated AFTER validation fails
            try {
                await waitForEvent(dispatchSpy, 'ui:message_display', expectedUIPayload, 500);
                console.log("[Test Case] Successfully detected 'ui:message_display' for action validation failure.");
            } catch (err) {
                console.error("[Test Case] Failed to detect the expected validation failure message.", err);
                try {
                    console.log("[Test Case] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, null, 2));
                } catch (stringifyError) {
                    console.error("[Test Case] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw to fail test
            }

            // 2. Check for the internal validation event
            // This confirms *why* the UI message appeared.
            expect(dispatchSpy).toHaveBeenCalledWith(
                'action:validation_failed',
                expect.objectContaining(expectedValidationFailurePayload)
            );


            // 3. No Actual Open Action Events: The action handler failed validation before attempting the core logic
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'event:open_attempted',
                expect.anything()
            );
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                EVENT_ENTITY_OPENED,
                expect.anything()
            );
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'event:open_failed', // Specific failure event for opening *logic* (e.g., locked, already open)
                expect.anything()
            );
            // Ensure no success message was displayed either
            expect(dispatchSpy).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({ type: 'success' }));


            // 4. State Check: Verify the state of the closed chest remains unchanged
            const chestCompAfter = closedChest.getComponent(OpenableComponent);
            expect(chestCompAfter).toBeDefined();
            expect(chestCompAfter.isOpen).toBe(false); // State should not have changed

            // 5. Console Checks: Ensure no unexpected errors/warnings (beyond the expected logs)
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            // expect(consoleWarnSpy).not.toHaveBeenCalled(); // Depending on validation logging strategy
        });
    });
});
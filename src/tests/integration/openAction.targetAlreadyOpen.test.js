// src/tests/integration/openAction.test.js

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for getDisplayName used in messages
import OpenableSystem from '../../systems/openableSystem.js';
import { NotificationUISystem } from '../../systems/notificationUISystem.js';

// --- Action Handler ---
import { executeOpen } from '../../actions/handlers/openActionHandler.js';

// --- Components ---
import OpenableComponent from '../../components/openableComponent.js';
import { NameComponent } from '../../components/nameComponent.js';
import { PositionComponent } from '../../components/positionComponent.js';
// LockableComponent not needed but OpenableComponent registration is vital

// --- Utilities & Types ---
// Assuming TARGET_MESSAGES has a key like ALREADY_OPEN
import { TARGET_MESSAGES, getDisplayName } from '../../utils/messages.js';
import { waitForEvent } from "../testUtils.js";
import {EVENT_ENTITY_OPENED} from "../../types/eventTypes"; // Assuming testUtils.js is one level up
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Mock DataManager ---
// Same mock as the other open tests
const mockDataManager = {
    actions: new Map([
        ['core:open', { id: 'core:open', commands: ['open', 'o'] }],
    ]),
    getEntityDefinition: (id) => ({ id: id, components: {} }), // Minimal definition lookup
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:open Action - Target Already Open', () => {
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
    // Declare entity specific to this test scenario
    let alreadyOpenChest;

    // --- Simplified setupEntity Helper (Copied & adapted from previous tests) ---
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

        // 2. Register REAL components with EntityManager
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('OpenableComponent', OpenableComponent); // Must be registered
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
    });

    afterEach(() => {
        // Restore spies
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();

        // Optional: Call system shutdown methods
        openableSystem.shutdown();
        notificationUISystem.shutdown();
        entityManager.clearAll();
    });

    // --- Helper Function to Simulate Command Execution (Copied from previous tests) ---
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);

        if (!parsedCommand.actionId && commandString.trim() !== '') {
            if(parsedCommand.error) {
                await eventBus.dispatch('ui:message_display', { text: parsedCommand.error, type: 'error'});
            } else {
                await eventBus.dispatch('ui:message_display', { text: "Unknown command.", type: 'error'});
            }
            return;
        }
        if(!parsedCommand.actionId && commandString.trim() === '') {
            return;
        }

        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            currentLocation: testLocation,
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager,
            dispatch: dispatchSpy, // For legacy checks / direct calls if any
            eventBus: eventBus     // Preferred method
        };

        await actionExecutor.executeAction(parsedCommand.actionId, context);
    };

    // --- Test Scenario ---
    describe('Scenario: Target Already Open', () => {
        it('should fail to open an already open target, display appropriate message, and dispatch failure event', async () => {
            // Arrange: Create a chest that is already open
            alreadyOpenChest = setupEntity('chest_already_open', 'chest',
                [new OpenableComponent({ isOpen: true })], // <<< Key difference: isOpen starts as true
                'test_location'
            );

            // Ensure the entity is correctly placed
            const entitiesInLocation = entityManager.getEntitiesInLocation('test_location');
            expect(entitiesInLocation).toContain('player');
            expect(entitiesInLocation).toContain('chest_already_open');

            // Expected failure message payload (assuming TARGET_MESSAGES.ALREADY_OPEN exists)
            // Adjust key ('ALREADY_OPEN') and type ('info' or 'warning') based on actual implementation
            const expectedFailureText = TARGET_MESSAGES.ALREADY_OPEN
                ? TARGET_MESSAGES.ALREADY_OPEN(getDisplayName(alreadyOpenChest)) // Use helper for display name
                : `The ${getDisplayName(alreadyOpenChest)} is already open.`; // Fallback message
            const expectedUIPayload = {
                text: expectedFailureText,
                type: 'info' // Or 'warning', depending on how severe this failure is considered
            };

            // Expected failure event payload (assuming 'ALREADY_OPEN' reason code)
            // Adjust reasonCode based on actual implementation in openActionHandler
            const expectedFailureEventPayload = {
                actorId: player.id,
                targetEntityId: alreadyOpenChest.id,
                reasonCode: 'ALREADY_OPEN' // <<< Assumed reason code
            };

            dispatchSpy.mockClear(); // Clear spy after setup

            // Act: Simulate the command trying to open the already open chest
            await simulateCommand('open chest');

            // Assert

            // 1. Failure Message: Wait for the specific UI message indicating it's already open
            try {
                await waitForEvent(dispatchSpy, 'ui:message_display', expectedUIPayload, 500);
                console.log("[Test Case] Successfully detected 'ui:message_display' for already open target.");
            } catch (err) {
                console.error("[Test Case] Failed to detect the expected 'already open' message.", err);
                try {
                    console.log("[Test Case] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, null, 2));
                } catch (stringifyError) {
                    console.error("[Test Case] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw to fail test
            }

            // 2. Failure Event: Check that the specific open failure event was dispatched
            expect(dispatchSpy).toHaveBeenCalledWith(
                'event:open_failed',
                expect.objectContaining(expectedFailureEventPayload)
            );

            // 3. Attempt Event: Check that an attempt was still made (usually happens before the state check)
            expect(dispatchSpy).toHaveBeenCalledWith(
                'event:open_attempted',
                expect.objectContaining({ actorId: player.id, targetEntityId: alreadyOpenChest.id })
            );

            // 4. No Success Events/Messages: Ensure no success-related events or messages were dispatched
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                EVENT_ENTITY_OPENED,
                expect.anything()
            );
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'ui:message_display',
                expect.objectContaining({ type: 'success' })
            );

            // 5. State Check: Verify the state of the chest remains unchanged (still open)
            const chestComp = alreadyOpenChest.getComponent(OpenableComponent);
            expect(chestComp).toBeDefined();
            expect(chestComp.isOpen).toBe(true); // Should still be true

            // 6. Console Checks: Ensure no unexpected errors/warnings
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            // Warnings might be acceptable depending on logging strategy for failures
            // expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
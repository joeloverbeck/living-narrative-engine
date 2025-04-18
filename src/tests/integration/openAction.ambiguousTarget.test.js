// src/tests/integration/openAction.ambiguousTarget.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for instanceof check and getDisplayName
import OpenableSystem from '../../systems/openableSystem.js';
import {NotificationUISystem} from '../../systems/notificationUISystem.js';

// --- Action Handler ---
import {executeOpen} from '../../actions/handlers/openActionHandler.js';

// --- Components ---
import OpenableComponent from '../../components/openableComponent.js';
// LockableComponent not strictly needed for this test, but keep for consistency? No, remove if unused.
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';

// --- Utilities & Types ---
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
import {waitForEvent} from "../testUtils.js";
import {EVENT_DISPLAY_MESSAGE, EVENT_ENTITY_OPENED} from "../../types/eventTypes.js"; // Assuming testUtils.js is one level up
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// Same mock as the successful open test
const mockGameDataRepository = {
    actions: new Map([
        ['core:open', {id: 'core:open', commands: ['open', 'o']}],
    ]),
    getAllActionDefinitions: function () {
        // 'this' refers to mockGameDataRepository itself here
        return Array.from(this.actions.values());
    },
    getEntityDefinition: (id) => ({id: id, components: {}}), // Minimal definition lookup
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:open Action - Ambiguous Target', () => {
    let entityManager;
    let eventBus;
    let commandParser;
    let actionExecutor;
    let openableSystem;
    let notificationUISystem;
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;
    // No consoleLogSpy needed

    // --- Test Entities ---
    let player;
    let testLocation;
    // Declare entities specific to this test scenario
    let box1;
    let box2;

    // --- Simplified setupEntity Helper (Copied & adapted, less logging) ---
    const setupEntity = (id, name, components = [], locationId = 'test_location') => {
        if (!entityManager || typeof entityManager.createEntityInstance !== 'function') {
            throw new Error(`[setupEntity] entityManager is invalid when setting up ${id}`);
        }
        const entity = entityManager.createEntityInstance(id);
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

        if (!existingPosComp) {
            entity.addComponent(new PositionComponent({locationId: locationId}));
        } else if (existingPosComp.locationId !== locationId) {
            existingPosComp.locationId = locationId;
        }

        if (oldLocationId !== locationId) {
            entityManager.notifyPositionChange(id, oldLocationId, locationId);
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
        entityManager = new EntityManager(mockGameDataRepository);
        eventBus = new EventBus();
        commandParser = new CommandParser(mockGameDataRepository);
        actionExecutor = new ActionExecutor();

        // 2. Register REAL components with EntityManager
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('OpenableComponent', OpenableComponent);
        // No LockableComponent needed for this test
        entityManager.registerComponent('PositionComponent', PositionComponent);

        // 3. Instantiate Systems
        // OpenableSystem is needed because executeOpen checks for OpenableComponent
        openableSystem = new OpenableSystem({eventBus, entityManager});
        notificationUISystem = new NotificationUISystem({eventBus, gameDataRepository: mockGameDataRepository});

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

        // 7. Setup common test entities
        player = setupEntity('player', 'Player', [], 'test_location'); // Ensure player is at the location
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
        entityManager.clearAll(); // Clear entities
    });

    // --- Helper Function to Simulate Command Execution ---
    // Same helper as the successful open test
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);

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

        /** @type {ActionContext} */
        const context = {
            playerEntity: player,
            currentLocation: testLocation,
            parsedCommand: parsedCommand,
            gameDataRepository: mockGameDataRepository,
            entityManager: entityManager,
            dispatch: dispatchSpy, // Still pass spy for legacy? Better to rely on eventBus
            eventBus: eventBus
        };

        await actionExecutor.executeAction(parsedCommand.actionId, context);
    };

    // --- Test Scenario ---
    describe('Scenario: Ambiguous Target', () => {
        it('should fail to resolve target, display ambiguity prompt, and dispatch no open events', async () => {
            // Arrange: Create two entities with the same name 'box' that are openable and in the player's location
            box1 = setupEntity('box_1', 'box', [new OpenableComponent({isOpen: false})], 'test_location');
            box2 = setupEntity('box_2', 'box', [new OpenableComponent({isOpen: false})], 'test_location');

            // Ensure the entities are correctly placed (check spatial index if debugging needed)
            const entitiesInLocation = entityManager.getEntitiesInLocation('test_location');
            expect(entitiesInLocation).toContain('player');
            expect(entitiesInLocation).toContain('box_1');
            expect(entitiesInLocation).toContain('box_2');


            // Expected ambiguity message payload
            // Note: handleActionWithTargetResolution finds candidates; order might vary slightly.
            // It's safer to check the essential parts or ensure deterministic order if possible.
            // Assuming order box1, box2 based on creation order.
            const expectedCandidates = [box1, box2];
            const expectedAmbiguityText = TARGET_MESSAGES.AMBIGUOUS_PROMPT('open', 'box', expectedCandidates);
            const expectedUIPayload = {
                text: expectedAmbiguityText,
                // Default ambiguity message type from handleActionWithTargetResolution likely 'notice' or 'warning'
                // Let's assume 'notice' based on TARGET_MESSAGES structure (prompts often are)
                // Check actionExecutionUtils.js if unsure about default ambiguity message type
                type: 'warning'
            };

            dispatchSpy.mockClear(); // Clear spy after setup

            // Act: Simulate the command that causes ambiguity
            await simulateCommand('open box');

            // Assert

            // 1. Ambiguity Prompt: Wait for the specific UI message
            try {
                await waitForEvent(dispatchSpy, EVENT_DISPLAY_MESSAGE, expectedUIPayload, 500); // Use shorter timeout
                console.log("[Test Case] Successfully detected EVENT_DISPLAY_MESSAGE ambiguity event.");
            } catch (err) {
                console.error("[Test Case] Failed to detect the expected ambiguity message.", err);
                // Log calls for debugging ambiguity message issues
                try {
                    console.log("[Test Case] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, null, 2));
                } catch (stringifyError) {
                    console.error("[Test Case] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err; // Re-throw to fail test
            }

            // 2. No Open Events: Check that the core open events were NOT dispatched
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'event:open_attempted',
                expect.anything()
            );
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                EVENT_ENTITY_OPENED,
                expect.anything()
            );
            // Also check that no failure *related to opening itself* was dispatched
            expect(dispatchSpy).not.toHaveBeenCalledWith(
                'event:open_failed',
                expect.anything()
            );

            // 3. State Check: Verify the state of BOTH boxes remains unchanged (closed)
            const box1Comp = box1.getComponent(OpenableComponent);
            const box2Comp = box2.getComponent(OpenableComponent);
            expect(box1Comp).toBeDefined();
            expect(box1Comp.isOpen).toBe(false);
            expect(box2Comp).toBeDefined();
            expect(box2Comp.isOpen).toBe(false);

            // 4. Console Checks: Ensure no unexpected errors/warnings
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            // Depending on implementation, ambiguity might log a warning, adjust if needed.
            // expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
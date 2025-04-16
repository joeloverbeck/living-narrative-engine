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
const mockDataManager = {
    actions: new Map([
        ['core:open', { id: 'core:open', commands: ['open', 'o'] }],
    ]),
    getEntityDefinition: (id) => ({ id: id, components: {} }),
    getPlayerId: () => 'player'
};

// --- Test Suite ---
describe('Integration Test: core:open Action - Target Not Found', () => {
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
    let existingChest;

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
        entityManager = new EntityManager(mockDataManager);
        eventBus = new EventBus();
        commandParser = new CommandParser(mockDataManager);
        actionExecutor = new ActionExecutor();
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('OpenableComponent', OpenableComponent);
        entityManager.registerComponent('PositionComponent', PositionComponent);
        openableSystem = new OpenableSystem({ eventBus, entityManager });
        notificationUISystem = new NotificationUISystem({ eventBus, dataManager: mockDataManager });
        actionExecutor.registerHandler('core:open', executeOpen);
        openableSystem.initialize();
        notificationUISystem.initialize();
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        player = setupEntity('player', 'Player', [], 'test_location');
        testLocation = setupEntity('test_location', 'Test Room');
        existingChest = setupEntity('chest_existing', 'chest', [new OpenableComponent({ isOpen: false })], 'test_location');
    });

    afterEach(() => {
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        openableSystem.shutdown();
        notificationUISystem.shutdown();
        entityManager.clearAll();
    });

    // --- Helper Function to Simulate Command Execution (Copied) ---
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);
        if (!parsedCommand.actionId && commandString.trim() !== '') {
            const errorText = parsedCommand.error || "Unknown command.";
            await eventBus.dispatch('ui:message_display', { text: errorText, type: 'error'});
            return;
        }
        if(!parsedCommand.actionId && commandString.trim() === '') return;

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
        await actionExecutor.executeAction(parsedCommand.actionId, context);
    };

    // --- Test Scenario ---
    describe('Scenario: Target Not Found', () => {
        it('should fail target resolution and display a "not found" message when target does not exist in location', async () => {
            // Arrange
            const targetName = 'non_existent_box';
            const command = `open ${targetName}`;

            const entitiesInLocation = entityManager.getEntitiesInLocation('test_location');
            // Use .has() if it's a Set, or convert to Array for .toContain() if needed
            // Assuming it's iterable (like a Set or Array) for these checks:
            expect(entitiesInLocation).toContain('player');
            expect(entitiesInLocation).toContain('chest_existing');

            // --- CORRECTED Check ---
            // Convert entitiesInLocation to an array before using .some()
            const entitiesArray = Array.from(entitiesInLocation); // Or [...entitiesInLocation]
            expect(entitiesArray.some(id => entityManager.getEntityInstance(id)?.getComponent(NameComponent)?.value === targetName)).toBe(false);
            // --- END CORRECTION ---


            const expectedFailureText = `You don't see anything called '${targetName}' that you can open nearby.`;
            const expectedUIPayload = {
                text: expectedFailureText,
                type: 'info'
            };

            dispatchSpy.mockClear();

            // Act
            await simulateCommand(command);

            // Assert

            // 1. Failure Message: Wait for the specific UI message
            try {
                await waitForEvent(dispatchSpy, 'ui:message_display', expectedUIPayload, 500);
                console.log("[Test Case] Successfully detected 'ui:message_display' for target not found.");
            } catch (err) {
                console.error("[Test Case] Failed to detect the expected 'target not found' message.", err);
                try {
                    console.log("[Test Case] Dispatch Spy Calls received:", JSON.stringify(dispatchSpy.mock.calls, null, 2));
                } catch (stringifyError) {
                    console.error("[Test Case] Error stringifying dispatchSpy calls:", stringifyError);
                    console.log("[Test Case] Raw Dispatch Spy Calls:", dispatchSpy.mock.calls);
                }
                throw err;
            }

            // 2. No Action-Specific Events
            expect(dispatchSpy).not.toHaveBeenCalledWith('event:open_attempted', expect.anything());
            expect(dispatchSpy).not.toHaveBeenCalledWith(EVENT_ENTITY_OPENED, expect.anything());
            expect(dispatchSpy).not.toHaveBeenCalledWith('event:open_failed', expect.anything());
            expect(dispatchSpy).not.toHaveBeenCalledWith('ui:message_display', expect.objectContaining({ type: 'success' }));
            expect(dispatchSpy).toHaveBeenCalledWith('ui:message_display', expectedUIPayload);

            // 3. State Check
            const existingChestComp = existingChest.getComponent(OpenableComponent);
            expect(existingChestComp?.isOpen).toBe(false);

            // 4. Console Checks
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            // expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});
// src/tests/integration/useAction.unlockDoor.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// --- Core Modules & Systems ---
import CommandParser from '../../core/commandParser.js';
import ActionExecutor from '../../actions/actionExecutor.js';
import EventBus from '../../core/eventBus.js';
import EntityManager from '../../entities/entityManager.js';
import Entity from '../../entities/entity.js'; // Needed for type hints and setup
import ItemUsageSystem from '../../systems/itemUsageSystem.js';
import LockSystem from '../../systems/lockSystem.js';
import {NotificationUISystem} from '../../systems/notificationUISystem.js';
// Import actual services if needed for complex mocks, otherwise just mock interface
import ConditionEvaluationService from '../../services/conditionEvaluationService.js';
import ItemTargetResolverService from '../../services/itemTargetResolver.js';

// --- Action Handler & Utils ---
import {executeUse} from '../../actions/handlers/useActionHandler.js';

// --- Components ---
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import LockableComponent from '../../components/lockableComponent.js'; // Default import
import OpenableComponent from '../../components/openableComponent.js'; // Default import
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js';
import {UsableComponent} from '../../components/usableComponent.js'; // Corrected import assuming path/export

// --- Event Types ---
import {
    EVENT_ITEM_USE_ATTEMPTED,
    EVENT_UNLOCK_ENTITY_ATTEMPT,
    EVENT_ENTITY_UNLOCKED,
    UI_MESSAGE_DISPLAY
} from '../../types/eventTypes.js';

// --- Utilities & Types ---
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
import {waitForEvent, setupEntity as testSetupEntity} from "../testUtils.js"; // Use provided helper
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../actions/actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../actions/actionTypes.js').ParsedCommand} ParsedCommand */

// --- Test Suite ---
describe('Integration Test: core:use Action - Unlock Door Scenario (USE-INT-UNLOCK-01)', () => {
    // --- Test Scope Variables ---
    let entityManager;
    let eventBus;
    let commandParser;
    let actionExecutor;
    let itemUsageSystem;
    let lockSystem;
    let notificationUISystem;
    // <<< Declare Mock Service Variables >>>
    let mockConditionEvaluationService;
    let mockItemTargetResolverService;
    let dispatchSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;

    // --- Test Entities ---
    let player;
    let testLocation;
    let keyInstance;
    let doorEntity;

    // --- Mock DataManager ---
    // (Mock remains the same as previous correct version)
    const mockDataManager = {
        actions: new Map([
            ['core:use', {id: 'core:use', commands: ['use', 'u']}],
        ]),
        getEntityDefinition: (id) => {
            if (id === 'key_master_def') {
                return {
                    id: 'key_master_def',
                    components: {
                        Name: {value: "Master Key"}, Description: {text: "A key that seems important."}, Item: {},
                        Usable: {
                            target_required: true,
                            target_scope: ['nearby_connections', 'nearby_entities'],
                            target_failure_message_default: "You can't use the key on that.",
                            consume_on_use: false,
                            usability_conditions: [],
                            effects: [{type: 'trigger_event', parameters: {eventName: EVENT_UNLOCK_ENTITY_ATTEMPT}}]
                        }
                    }
                };
            }
            if (id === 'door_study_def') {
                return {
                    id: 'door_study_def',
                    components: {Name: {value: "Study Door"}, Description: {text: "A sturdy oak door."}}
                };
            }
            if (id === 'location_lobby_def') {
                return {
                    id: 'location_lobby_def',
                    components: {Name: {value: "Lobby"}, Description: {text: "A dusty lobby."}, Connections: {}}
                }
            }
            if (id === 'player_def') {
                return {id: 'player_def', components: {Name: {value: "Player"}, Inventory: {items: []}}}
            }
            return {id: id, components: {}};
        },
        getPlayerId: () => 'player'
    };

    // --- Use the provided setupEntity helper ---
    const setupEntity = (id, name, components = [], locationId = null, definitionId = null) => {
        return testSetupEntity(entityManager, id, name, components, locationId);
    };


    beforeEach(() => {
        // 1. Instantiate Core Modules
        entityManager = new EntityManager(mockDataManager);
        eventBus = new EventBus();
        commandParser = new CommandParser(mockDataManager);
        actionExecutor = new ActionExecutor();

        // <<< --- Instantiate Mock Services --- >>>
        mockConditionEvaluationService = {
            evaluateConditions: jest.fn((objectToCheck, baseContext, conditions, options) => {
                // For this test (key with no usability conditions), always return success immediately.
                console.log(`Mock ConditionEvaluationService.evaluateConditions called for ${options?.checkType || 'Generic'}`);
                return {success: true, messages: [{text: "Mock conditions passed.", type: 'internal'}]};
            })
        };

        mockItemTargetResolverService = {
            // Needs to return the doorEntity when called by ItemUsageSystem
            resolveItemTarget: jest.fn(async ({
                                                  userEntity,
                                                  usableComponentData,
                                                  explicitTargetEntityId,
                                                  explicitTargetConnectionEntityId,
                                                  itemName
                                              }) => {
                console.log(`Mock ItemTargetResolverService.resolveItemTarget called for item "${itemName}"`);
                // In this test, the target ("door") should be found via entity resolution.
                // We return the doorEntity instance (which will be created later in beforeEach).
                // Check if the target is likely the door based on test setup.
                if (doorEntity && (explicitTargetEntityId === doorEntity.id || explicitTargetConnectionEntityId === null)) {
                    console.log("Mock ItemTargetResolverService: Returning doorEntity as resolved target.");
                    return {
                        success: true,
                        target: doorEntity,
                        targetType: 'entity',
                        messages: [{text: "Mock target resolved to door.", type: 'internal'}]
                    };
                } else {
                    console.warn("Mock ItemTargetResolverService: Could not resolve mock target to doorEntity. Check test setup or mock logic.");
                    // Simulate target not found if it wasn't the door
                    return {
                        success: false,
                        target: null,
                        targetType: 'none',
                        messages: [{text: "Mock target resolution failed (not door).", type: 'internal'}]
                    };
                }
            })
        };
        // <<< --- End Mock Service Instantiation --- >>>

        // 2. Register ALL necessary Components with EntityManager
        entityManager.registerComponent('NameComponent', NameComponent);
        entityManager.registerComponent('PositionComponent', PositionComponent);
        entityManager.registerComponent('DescriptionComponent', DescriptionComponent);
        entityManager.registerComponent('InventoryComponent', InventoryComponent);
        entityManager.registerComponent('ItemComponent', ItemComponent);
        entityManager.registerComponent('LockableComponent', LockableComponent);
        entityManager.registerComponent('OpenableComponent', OpenableComponent);
        entityManager.registerComponent('ConnectionsComponent', ConnectionsComponent);
        entityManager.registerComponent('PassageDetailsComponent', PassageDetailsComponent);
        entityManager.registerComponent('Usable', UsableComponent);

        // 3. Instantiate Systems - PASSING MOCKS
        itemUsageSystem = new ItemUsageSystem({
            eventBus,
            entityManager,
            dataManager: mockDataManager,
            conditionEvaluationService: mockConditionEvaluationService, // <<< Pass Mock
            itemTargetResolverService: mockItemTargetResolverService  // <<< Pass Mock
        });
        lockSystem = new LockSystem({eventBus, entityManager});
        notificationUISystem = new NotificationUISystem({eventBus, dataManager: mockDataManager});

        // 4. Register Action Handler(s)
        actionExecutor.registerHandler('core:use', executeUse);

        // 5. Initialize Systems
        lockSystem.initialize();
        notificationUISystem.initialize();

        // 6. Setup Spies
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });

        // 7. Setup Test Entities
        // (Entities are created AFTER mocks are defined, so mocks can reference them)
        testLocation = setupEntity('location_lobby', 'Lobby', [
            new DescriptionComponent({text: "A dusty lobby."}),
            new ConnectionsComponent({connections: {}})
        ], null);

        keyInstance = setupEntity('key_inst_01', 'Master Key',
            [new ItemComponent({definitionId: 'key_master_def'})],
            null,
            'key_master_def'
        );

        player = setupEntity('player', 'Player',
            [new InventoryComponent({items: [keyInstance.id]})],
            testLocation.id
        );

        doorEntity = setupEntity('door_study', 'Study Door', // doorEntity instance now available
            [
                new LockableComponent({isLocked: true, keyId: 'key_master_def'}),
                new OpenableComponent({isOpen: false}),
                new DescriptionComponent({text: "A sturdy oak door."})
            ],
            testLocation.id
        );

        // --- Final Sanity Checks ---
        expect(player.getComponent(InventoryComponent).hasItem(keyInstance.id)).toBe(true);
        const initialLockable = doorEntity.getComponent(LockableComponent);
        expect(initialLockable).toBeDefined();
        expect(initialLockable.isLocked).toBe(true);
        expect(initialLockable.keyId).toBe('key_master_def');
        const entitiesInLobby = entityManager.getEntitiesInLocation(testLocation.id);
        expect(entitiesInLobby).toContain(player.id);
        expect(entitiesInLobby).toContain(doorEntity.id);
        expect(entitiesInLobby).not.toContain(keyInstance.id);

    }); // End beforeEach

    afterEach(() => {
        // (afterEach remains the same)
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        itemUsageSystem?.shutdown();
        lockSystem?.shutdown();
        notificationUISystem?.shutdown();
        entityManager?.clearAll();
    });

    // --- Helper Function to Simulate Command Execution ---
    // (simulateCommand remains the same)
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);
        if (!parsedCommand.actionId && commandString.trim() !== '') {
            const errorText = parsedCommand.error || "Unknown command.";
            await eventBus.dispatch(UI_MESSAGE_DISPLAY, {text: errorText, type: 'error'});
            return {success: false, messages: [{text: errorText, type: 'error'}]};
        }
        if (!parsedCommand.actionId && commandString.trim() === '') {
            return {success: true, messages: []};
        }
        const context = {
            playerEntity: player, currentLocation: testLocation, parsedCommand: parsedCommand,
            dataManager: mockDataManager, entityManager: entityManager, eventBus: eventBus,
        };
        const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);
        return actionResult;
    };


    // --- Test Scenario ---
    describe('Scenario: Player unlocks a door with the correct key', () => {
        // (it block remains the same as the previous correct version)
        it('should successfully unlock the door and dispatch correct events/messages', async () => {
            // --- Arrange ---
            const command = `use key on door`;
            const doorName = getDisplayName(doorEntity);
            const keyDefId = keyInstance.getComponent(ItemComponent).definitionId;

            const expectedItemUseAttemptPayload = {
                userEntityId: player.id, itemInstanceId: keyInstance.id, itemDefinitionId: keyDefId,
                explicitTargetEntityId: doorEntity.id, explicitTargetConnectionEntityId: null
            };
            const expectedUnlockAttemptPayload = {
                userId: player.id, targetEntityId: doorEntity.id, itemInstanceId: keyInstance.id
            };
            const expectedEntityUnlockedPayload = {
                userId: player.id, targetEntityId: doorEntity.id, keyItemId: keyInstance.id
            };
            const expectedSuccessUIMessagePayload = {
                text: `You unlock the ${doorName}.`, type: 'success'
            };

            dispatchSpy.mockClear();

            // --- Act ---
            const actionResult = await simulateCommand(command);

            // --- Assert ---
            expect(actionResult).toBeDefined();
            expect(actionResult.success).toBe(true);

            try {
                console.log("Assert: Waiting for EVENT_ITEM_USE_ATTEMPTED...");
                await waitForEvent(dispatchSpy, EVENT_ITEM_USE_ATTEMPTED, expect.objectContaining(expectedItemUseAttemptPayload), 1000);
                console.log("Assert: EVENT_ITEM_USE_ATTEMPTED received.");

                console.log("Assert: Waiting for EVENT_UNLOCK_ENTITY_ATTEMPT...");
                await waitForEvent(dispatchSpy, EVENT_UNLOCK_ENTITY_ATTEMPT, expect.objectContaining(expectedUnlockAttemptPayload), 1000);
                console.log("Assert: EVENT_UNLOCK_ENTITY_ATTEMPT received.");

                console.log("Assert: Waiting for EVENT_ENTITY_UNLOCKED...");
                await waitForEvent(dispatchSpy, EVENT_ENTITY_UNLOCKED, expect.objectContaining(expectedEntityUnlockedPayload), 1000);
                console.log("Assert: EVENT_ENTITY_UNLOCKED received.");

                console.log("Assert: Waiting for UI_MESSAGE_DISPLAY (Success)...");
                await waitForEvent(dispatchSpy, UI_MESSAGE_DISPLAY, expect.objectContaining(expectedSuccessUIMessagePayload), 1000);
                console.log("Assert: UI_MESSAGE_DISPLAY (Success) received.");

            } catch (error) {
                console.error("Assert: Failed while waiting for event sequence.", error);
                console.log("All dispatch calls:", JSON.stringify(dispatchSpy.mock.calls, null, 2));
                throw error;
            }

            const finalLockableComponent = doorEntity.getComponent(LockableComponent);
            expect(finalLockableComponent).toBeDefined();
            expect(finalLockableComponent.isLocked).toBe(false);

            const errorMessages = dispatchSpy.mock.calls.filter(call => call[0] === UI_MESSAGE_DISPLAY && call[1]?.type === 'error');
            expect(errorMessages).toHaveLength(0);
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            // expect(consoleWarnSpy).not.toHaveBeenCalled(); // Comment out if setup warnings are expected/acceptable

        }); // End it block
    }); // End describe block
}); // End Test Suite
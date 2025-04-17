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
import DefinitionRefComponent from '../../components/definitionRefComponent.js'; // <<< ADDED IMPORT

// --- Event Types ---
import {
    EVENT_ITEM_USE_ATTEMPTED,
    EVENT_UNLOCK_ENTITY_ATTEMPT,
    EVENT_ENTITY_UNLOCKED,
    EVENT_DISPLAY_MESSAGE
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
    // (Note: Included the version with the warning/auto-add for completeness, adjust if needed)
    const setupEntity = (id, name, components = [], locationId = null, definitionId = null) => {
        // If definitionId is passed AND DefinitionRefComponent is not already in components, add it.
        if (definitionId && !components.some(c => c instanceof DefinitionRefComponent)) {
            console.warn(`setupEntity (test): Auto-adding DefinitionRefComponent for ${id} with defId ${definitionId} based on 5th arg. Consider adding explicitly to components array.`);
            components.push(new DefinitionRefComponent(definitionId));
        }
        return testSetupEntity(entityManager, id, name, components, locationId);
    };


    beforeEach(() => {
        // 1. Instantiate Core Modules
        entityManager = new EntityManager(mockDataManager);
        eventBus = new EventBus();
        commandParser = new CommandParser(mockDataManager);
        actionExecutor = new ActionExecutor();

        // 2. Instantiate Mock Services
        mockConditionEvaluationService = {
            evaluateConditions: jest.fn((objectToCheck, baseContext, conditions, options) => {
                console.log(`Mock ConditionEvaluationService.evaluateConditions called for ${options?.checkType || 'Generic'}`);
                return {success: true, messages: [{text: "Mock conditions passed.", type: 'internal'}]};
            })
        };

        mockItemTargetResolverService = {
            resolveItemTarget: jest.fn(async ({
                                                  userEntity,
                                                  usableComponentData,
                                                  explicitTargetEntityId,
                                                  explicitTargetConnectionEntityId,
                                                  itemName
                                              }) => {
                console.log(`Mock ItemTargetResolverService.resolveItemTarget called for item "${itemName}"`);
                // Resolve to doorEntity if it exists and IDs match loosely
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
                    return {
                        success: false,
                        target: null,
                        targetType: 'none',
                        messages: [{text: "Mock target resolution failed (not door).", type: 'internal'}]
                    };
                }
            })
        };

        // 3. Register ALL necessary Components with EntityManager
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
        entityManager.registerComponent('DefinitionRefComponent', DefinitionRefComponent); // <<< REGISTER COMPONENT

        // 4. Instantiate Systems - PASSING MOCKS
        itemUsageSystem = new ItemUsageSystem({
            eventBus,
            entityManager,
            dataManager: mockDataManager,
            conditionEvaluationService: mockConditionEvaluationService,
            itemTargetResolverService: mockItemTargetResolverService
        });
        lockSystem = new LockSystem({eventBus, entityManager});
        notificationUISystem = new NotificationUISystem({eventBus, dataManager: mockDataManager});

        // 5. Register Action Handler(s)
        actionExecutor.registerHandler('core:use', executeUse);

        // 6. Initialize Systems
        // ItemUsageSystem needs initializing if it listens to events on init
        lockSystem.initialize();
        notificationUISystem.initialize();

        // 7. Setup Spies
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });

        // 8. Setup Test Entities
        testLocation = setupEntity('location_lobby', 'Lobby', [
            new DescriptionComponent({text: "A dusty lobby."}),
            new ConnectionsComponent({connections: {}})
        ], null, 'location_lobby_def'); // Added def ID for consistency

        // <<< MODIFIED: Add DefinitionRefComponent to key setup >>>
        keyInstance = setupEntity('key_inst_01', 'Master Key',
            [
                new ItemComponent({}), // Keep ItemComponent if needed for item-ness
                new DefinitionRefComponent('key_master_def') // Explicitly add DefinitionRefComponent
            ],
            null
            // Definition ID is now handled by the component itself
        );

        player = setupEntity('player', 'Player',
            [new InventoryComponent({items: [keyInstance.id]})],
            testLocation.id,
            'player_def' // Added def ID for consistency
        );

        // <<< MODIFIED: Add DefinitionRefComponent to door setup >>>
        doorEntity = setupEntity('door_study', 'Study Door',
            [
                new LockableComponent({isLocked: true, keyId: 'key_master_def'}),
                new OpenableComponent({isOpen: false}),
                new DescriptionComponent({text: "A sturdy oak door."}),
                new DefinitionRefComponent('door_study_def') // Add DefinitionRefComponent
            ],
            testLocation.id
        );

        // --- Final Sanity Checks ---
        expect(player.getComponent(InventoryComponent).hasItem(keyInstance.id)).toBe(true);
        // <<< ADDED Sanity Check for DefinitionRefComponent >>>
        expect(keyInstance.getComponent(DefinitionRefComponent)?.id).toBe('key_master_def');
        const initialLockable = doorEntity.getComponent(LockableComponent);
        expect(initialLockable).toBeDefined();
        expect(initialLockable.isLocked).toBe(true);
        expect(initialLockable.keyId).toBe('key_master_def');
        const entitiesInLobby = entityManager.getEntitiesInLocation(testLocation.id);
        expect(entitiesInLobby).toContain(player.id);
        expect(entitiesInLobby).toContain(doorEntity.id);
        expect(entitiesInLobby).not.toContain(keyInstance.id); // Key is in inventory, not location

    }); // End beforeEach

    afterEach(() => {
        dispatchSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        lockSystem?.shutdown();
        notificationUISystem?.shutdown();
        entityManager?.clearAll();
    });

    // --- Helper Function to Simulate Command Execution ---
    const simulateCommand = async (commandString) => {
        const parsedCommand = commandParser.parse(commandString);
        // Handle parsing errors or empty commands
        if (!parsedCommand.actionId) {
            const errorText = parsedCommand.error || (commandString.trim() === '' ? '' : "Unknown command.");
            if (errorText) {
                await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: errorText, type: 'error'});
                return {success: false, messages: [{text: errorText, type: 'error'}]};
            } else {
                return {success: true, messages: []}; // Allow empty command to succeed silently
            }
        }

        const context = {
            playerEntity: player,
            currentLocation: testLocation, // Ensure currentLocation is passed if needed by resolvers
            parsedCommand: parsedCommand,
            dataManager: mockDataManager,
            entityManager: entityManager,
            eventBus: eventBus,
        };
        // Ensure systems that consume events are ready before executing
        // (Initialization moved to beforeEach)
        const actionResult = await actionExecutor.executeAction(parsedCommand.actionId, context);
        return actionResult;
    };


    // --- Test Scenario ---
    describe('Scenario: Player unlocks a door with the correct key', () => {
        it('should successfully unlock the door and dispatch correct events/messages', async () => {
            // --- Arrange ---
            const command = `use key on door`;
            const doorName = getDisplayName(doorEntity);
            // <<< MODIFIED: Get keyDefId from DefinitionRefComponent >>>
            const keyDefId = keyInstance.getComponent(DefinitionRefComponent).id;
            expect(keyDefId).toBe('key_master_def'); // Quick check

            // Expected payload for the initial "use" intent
            const expectedItemUseAttemptPayload = {
                userEntityId: player.id,
                itemInstanceId: keyInstance.id,
                itemDefinitionId: keyDefId, // Should be 'key_master_def'
                explicitTargetEntityId: doorEntity.id,
                explicitTargetConnectionEntityId: null
            };

            // Expected payload for the event triggered by the item's effect
            // This comes from ItemUsageSystem -> trigger_event effect
            const expectedUnlockAttemptPayload = {
                // Base context from DynamicTriggerEventPayload
                userId: player.id,
                itemInstanceId: keyInstance.id,
                itemDefinitionId: keyDefId, // 'key_master_def'
                sourceItemName: getDisplayName(keyInstance), // Usually resolved name
                validatedTargetId: doorEntity.id, // Target resolved by ItemUsageSystem
                validatedTargetType: 'entity', // Resolved type
                // Custom payload from effect parameters (none specified in mock def)
                // customPayload: {} // Or undefined if no payload parameters
            };

            // Expected payload for the final unlock success event
            const expectedEntityUnlockedPayload = {
                userId: player.id,
                targetEntityId: doorEntity.id,
                keyItemId: keyInstance.id // LockSystem includes the specific item instance ID
            };

            // Expected UI feedback
            const expectedSuccessUIMessagePayload = {
                text: `You unlock the ${doorName}.`, // Message from LockSystem/NotificationUISystem
                type: 'success'
            };

            dispatchSpy.mockClear();

            // --- Act ---
            const actionResult = await simulateCommand(command);

            // --- Assert ---
            // Check overall action success
            expect(actionResult).toBeDefined();
            expect(actionResult.success).toBe(true); // The 'use' action itself succeeded in dispatching

            // Check for specific event sequence and payloads
            try {
                console.log("Assert: Waiting for EVENT_ITEM_USE_ATTEMPTED...");
                await waitForEvent(dispatchSpy, EVENT_ITEM_USE_ATTEMPTED, expect.objectContaining(expectedItemUseAttemptPayload), 1000);
                console.log("Assert: EVENT_ITEM_USE_ATTEMPTED received.");

                console.log("Assert: Waiting for EVENT_UNLOCK_ENTITY_ATTEMPT...");
                // Note: Using objectContaining is flexible if sourceItemName or customPayload varies slightly
                await waitForEvent(dispatchSpy, EVENT_UNLOCK_ENTITY_ATTEMPT, expect.objectContaining(expectedUnlockAttemptPayload), 1000);
                console.log("Assert: EVENT_UNLOCK_ENTITY_ATTEMPT received.");

                console.log("Assert: Waiting for EVENT_ENTITY_UNLOCKED...");
                await waitForEvent(dispatchSpy, EVENT_ENTITY_UNLOCKED, expect.objectContaining(expectedEntityUnlockedPayload), 1000);
                console.log("Assert: EVENT_ENTITY_UNLOCKED received.");

                console.log("Assert: Waiting for EVENT_DISPLAY_MESSAGE (Success)...");
                // This message confirms the lockSystem processed the unlock successfully
                await waitForEvent(dispatchSpy, EVENT_DISPLAY_MESSAGE, expect.objectContaining(expectedSuccessUIMessagePayload), 1000);
                console.log("Assert: EVENT_DISPLAY_MESSAGE (Success) received.");

            } catch (error) {
                console.error("Assert: Failed while waiting for event sequence.", error);
                // Log dispatched events for easier debugging if a waitForEvent times out
                const relevantCalls = dispatchSpy.mock.calls.filter(call =>
                    [EVENT_ITEM_USE_ATTEMPTED, EVENT_UNLOCK_ENTITY_ATTEMPT, EVENT_ENTITY_UNLOCKED, EVENT_DISPLAY_MESSAGE].includes(call[0])
                );
                console.log("Relevant Dispatch Calls:", JSON.stringify(relevantCalls, null, 2));
                throw error; // Re-throw to fail the test
            }

            // Check final state of the door
            const finalLockableComponent = doorEntity.getComponent(LockableComponent);
            expect(finalLockableComponent).toBeDefined();
            expect(finalLockableComponent.isLocked).toBe(false);

            // Check for unexpected errors
            const errorMessages = dispatchSpy.mock.calls.filter(call => call[0] === EVENT_DISPLAY_MESSAGE && call[1]?.type === 'error');
            expect(errorMessages).toHaveLength(0); // No user-facing errors should have been dispatched
            expect(consoleErrorSpy).not.toHaveBeenCalled(); // No internal console errors logged

            // Allow warnings during setup (e.g., from setupEntity helper)
            // expect(consoleWarnSpy).not.toHaveBeenCalled();

        }); // End it block
    }); // End describe block
}); // End Test Suite
// src/tests/integration/actionDiscoverySystem.takeItem.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies (Real Implementations) ---
import EntityManager from '../../entities/entityManager.js';
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import {ActionValidationService} from '../../services/actionValidationService.js';
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js';
import Entity from '../../entities/entity.js';

// --- Functions used by SUT (Real Implementations) ---
import {formatActionCommand} from '../../services/actionFormatter.js'; // Import the real function
import {getEntityIdsForScopes} from '../../services/entityScopeService.js'; // Import the real function

// --- Necessary Component Classes (Real Implementations) ---
// Import all components mentioned in the provided definitions
import Component from '../../components/component.js'; // Base class if needed
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {UsableComponent} from '../../components/usableComponent.js';
import {HealthComponent} from '../../components/healthComponent.js';
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {StatsComponent} from '../../components/statsComponent.js';
import {AttackComponent} from '../../components/attackComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {QuestLogComponent} from '../../components/questLogComponent.js';
import DefinitionRefComponent from '../../components/definitionRefComponent.js'; // Needed by EntityManager

// --- Mocked Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Enable debug logging for potential troubleshooting
};

// --- Test Data Definitions ---
const takeActionDef = {
    "$schema": "../schemas/action-definition.schema.json",
    "id": "core:take",
    "commandVerb": "take",
    "name": "Take",
    "target_domain": "environment", // CRITICAL: Looks for targets in the environment
    "actor_required_components": [],
    "actor_forbidden_components": [],
    "target_required_components": [
        "Item" // CRITICAL: Target must be an Item
    ],
    "target_forbidden_components": [],
    "prerequisites": [], // Assuming no special prerequisites to take something basic
    "template": "take {target}", // CRITICAL: How the command string is built
    "dispatch_event": { /* Not relevant for discovery */}
};

const playerDef = {
    "id": "core:player",
    "components": {
        "Name": {"value": "Player"},
        "Position": {
            "locationId": "demo:room_entrance" // CRITICAL: Player starts in the target room
        },
        "Health": {"current": 10, "max": 10},
        "Inventory": {"items": []},
        "Stats": {"attributes": {"core:attr_strength": 8}}, // Simplified
        "Attack": {"damage": 3},
        "Equipment": {"slots": {}}, // Simplified
        "QuestLog": {}
    }
};

const rustyKeyDef = {
    "id": "demo:item_key_rusty",
    "components": {
        "Name": { "value": "Rusty Key" }, // CRITICAL: Used in the formatted command
        "Description": { "text": "An old, rusty iron key." },
        "Position": {
            "locationId": "demo:room_entrance" // CRITICAL: Key is in the same room as the player
        },
        "Item": { // CRITICAL: Required by the 'take' action
            "tags": ["key", "metal"],
            "stackable": false,
            "value": 5,
            "weight": 0.1
        },
        // --- START CORRECTED SECTION ---
        "Usable": { // Provide the full, valid definition
            "target_required": true,
            "usability_conditions": [],
            "target_conditions": [
                {
                    "condition_type": "target_has_property",
                    "property_path": "id",
                    "expected_value": "demo:door_exit_north",
                    "failure_message": "This key doesn't seem to fit this lock."
                },
                {
                    "condition_type": "target_has_property",
                    "property_path": "Lockable.isLocked",
                    "expected_value": true,
                    "failure_message": "The door is already unlocked."
                }
            ],
            "effects": [ // Required array
                {
                    "type": "trigger_event",
                    "parameters": {
                        "eventName": "event:unlock_entity_attempt",
                        "payload": {}
                    }
                }
            ],
            "consume_on_use": false, // Required boolean
            "failure_message_default": "You can't use the key like that."
        }
        // --- END CORRECTED SECTION ---
    }
};

// Minimal definition for the room itself
const roomDef = {
    "id": "demo:room_entrance",
    "components": {
        "Name": {"value": "Room Entrance"},
        "Description": {"text": "A dusty entrance chamber."}
        // No Connections needed for this specific test
    }
};


// --- Test Suite ---
describe('ActionDiscoverySystem Integration Test - Take Item', () => {

    let registry;
    let gameDataRepository;
    let entityManager;
    let actionValidationService;
    let actionDiscoverySystem; // The System Under Test

    let playerEntity;
    let keyEntity;
    let roomEntity;
    let actionContext;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger);
        entityManager = new EntityManager(gameDataRepository); // Pass repo
        actionValidationService = new ActionValidationService({
            entityManager,
            gameDataRepository,
            logger: mockLogger
        });

        // Instantiate the System Under Test
        // Injecting the REAL formatActionCommand function directly
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatActionCommand // Inject the real function
            // getEntityIdsForScopes is imported and used directly within the system
        });

        // 2. Register Components with EntityManager
        // Register all components used by the entities and the 'take' action
        entityManager.registerComponent('Name', NameComponent);
        entityManager.registerComponent('Description', DescriptionComponent);
        entityManager.registerComponent('Position', PositionComponent);
        entityManager.registerComponent('Item', ItemComponent);
        entityManager.registerComponent('Usable', UsableComponent);
        entityManager.registerComponent('Health', HealthComponent);
        entityManager.registerComponent('Inventory', InventoryComponent);
        entityManager.registerComponent('Stats', StatsComponent);
        entityManager.registerComponent('Attack', AttackComponent);
        entityManager.registerComponent('Equipment', EquipmentComponent);
        entityManager.registerComponent('QuestLog', QuestLogComponent);
        entityManager.registerComponent('DefinitionRef', DefinitionRefComponent); // Auto-added by EntityManager

        // 3. Load Test Definitions into Registry
        registry.store('actions', takeActionDef.id, takeActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('entities', rustyKeyDef.id, rustyKeyDef);
        registry.store('locations', roomDef.id, roomDef);

        // 4. Create Entity Instances
        playerEntity = entityManager.createEntityInstance(playerDef.id);
        keyEntity = entityManager.createEntityInstance(rustyKeyDef.id);
        roomEntity = entityManager.createEntityInstance(roomDef.id); // Instantiate the location too

        // Verify crucial setup steps
        if (!playerEntity || !keyEntity || !roomEntity) {
            throw new Error("Failed to instantiate core entities for the test.");
        }
        const playerPos = playerEntity.getComponent(PositionComponent);
        const keyPos = keyEntity.getComponent(PositionComponent);
        const keyItem = keyEntity.getComponent(ItemComponent);
        const keyName = keyEntity.getComponent(NameComponent);

        if (!playerPos || !keyPos || !keyItem || !keyName) {
            throw new Error("Core components missing from instantiated entities.");
        }
        expect(playerPos.locationId).toBe('demo:room_entrance');
        expect(keyPos.locationId).toBe('demo:room_entrance'); // Key MUST be in the same location
        expect(keyName.value).toBe('Rusty Key'); // Ensure the name is correct for formatting

        // 5. Build Action Context
        actionContext = {
            playerEntity: playerEntity,
            currentLocation: roomEntity, // Use the instantiated room entity
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            // other context properties if needed (e.g., eventBus, dispatch)
            eventBus: null, // Placeholder
            dispatch: jest.fn(), // Placeholder
            parsedCommand: null // Not used directly by discovery
        };
    });

    it('should discover "take Rusty Key" as a valid action when player is in the room with the key', async () => {
        // --- Arrange --- (Mostly done in beforeEach)

        // --- Act ---
        // Call the method under test
        const validActions = await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // 1. Basic check
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);

        // 2. Core Assertion: Check if the expected command string is present
        // The formatter uses the NameComponent value.
        expect(validActions).toContain('take Rusty Key');

        // 3. (Optional) More specific checks:
        // Check logs to ensure the expected flow happened (e.g., validation passed for the key)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing action definition: ${takeActionDef.id}`));
        // Check that the scope service found the key
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found 1 potential targets in domain 'environment'`)); // Or more if other items were present
        // Check that validation passed for the key specifically
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found valid action (target ${keyEntity.id}): take Rusty Key`));
        expect(mockLogger.error).not.toHaveBeenCalled(); // Ensure no errors occurred
    });

});
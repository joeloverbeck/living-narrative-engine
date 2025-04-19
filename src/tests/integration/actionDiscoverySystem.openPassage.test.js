// src/tests/integration/actionDiscoverySystem.openPassage.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies (Real Implementations) ---
import EntityManager from '../../entities/entityManager.js';
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import {ActionValidationService, ActionTargetContext} from '../../services/actionValidationService.js';
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js'; // Using the provided real implementation
import Entity from '../../entities/entity.js';

// --- Functions used by SUT ---
import * as actionFormatter from '../../services/actionFormatter.js'; // Import module to spy

// --- Necessary Component Classes (Real Implementations) ---
import Component from '../../components/component.js'; // Base class if needed
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {MetaDescriptionComponent} from '../../components/metaDescriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {HealthComponent} from '../../components/healthComponent.js';
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {StatsComponent} from '../../components/statsComponent.js';
import {AttackComponent} from '../../components/attackComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {QuestLogComponent} from '../../components/questLogComponent.js';
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js';
import DefinitionRefComponent from '../../components/definitionRefComponent.js'; // Needed by EntityManager

// --- Mocked Dependencies ---
// Using a simple object mock for the logger interface
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Test Data Definitions ---
const connectionDef = {
    id: "demo:conn_entrance_hallway",
    components: {
        "PassageDetails": {
            "locationAId": "demo:room_entrance",
            "locationBId": "demo:room_hallway", // Target room doesn't need to exist for this test
            "directionAtoB": "north",
            "directionBtoA": "south",
            "blockerEntityId": null, // No blocker
            "type": "passage"
        }
    }
};

const roomDef = {
    "id": "demo:room_entrance",
    "components": {
        "Name": {"value": "Entrance"},
        "Description": {"text": "Stone archway..."},
        "MetaDescription": {"keywords": ["entrance"]},
        "Connections": { // Connects north via the connection entity
            "connections": {
                "north": "demo:conn_entrance_hallway"
            }
        }
        // Position component is implicit for locations/handled by spatial index
    }
};

const playerDef = {
    "id": "core:player",
    "components": {
        "Name": {"value": "Player"},
        "Position": {
            "locationId": "demo:room_entrance" // CRITICAL: Player starts here
        },
        // Add other components from the example for completeness, even if not directly used
        "Health": {"current": 10, "max": 10},
        "Inventory": {"items": []},
        "Stats": {
            "attributes": {
                "core:attr_strength": 8, "core:attr_agility": 10,
                "core:attr_intelligence": 10, "core:attr_constitution": 9
            }
        },
        "Attack": {"damage": 3},
        "Equipment": {"slots": { /* ... empty slots ... */}},
        "QuestLog": {}
    }
};

const goActionDef = {
    "id": "core:go",
    "commandVerb": "go",
    "name": "Go",
    "target_domain": "direction", // CRITICAL: Targets directions
    "actor_required_components": [],
    "actor_forbidden_components": [],
    "target_required_components": [],
    "target_forbidden_components": [],
    "prerequisites": [], // Assume no prerequisites for basic movement
    "template": "go {direction}", // CRITICAL: Template used by formatter
    // dispatch_event is not relevant for action *discovery*
};

// --- Test Suite ---
describe('ActionDiscoverySystem Integration Test - Go North', () => {

    let registry;
    let gameDataRepository;
    let entityManager;
    let actionValidationService;
    let actionDiscoverySystem; // The System Under Test

    let playerEntity;
    let roomEntity;
    let connectionEntity;
    let actionContext;

    let formatSpy;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry(); // Use the real implementation
        // Logger is already mocked above

        gameDataRepository = new GameDataRepository(registry, mockLogger);
        entityManager = new EntityManager(gameDataRepository); // Pass repo
        actionValidationService = new ActionValidationService({
            entityManager,
            gameDataRepository,
            logger: mockLogger
        });

        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');

        // Instantiate the System Under Test
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatSpy
            // getEntityIdsForScopes and formatActionCommand are imported directly
        });

        // 2. Register Components with EntityManager
        entityManager.registerComponent('Name', NameComponent);
        entityManager.registerComponent('Description', DescriptionComponent);
        entityManager.registerComponent('MetaDescription', MetaDescriptionComponent);
        entityManager.registerComponent('Connections', ConnectionsComponent);
        entityManager.registerComponent('Position', PositionComponent);
        entityManager.registerComponent('Health', HealthComponent);
        entityManager.registerComponent('Inventory', InventoryComponent);
        entityManager.registerComponent('Stats', StatsComponent);
        entityManager.registerComponent('Attack', AttackComponent);
        entityManager.registerComponent('Equipment', EquipmentComponent);
        entityManager.registerComponent('QuestLog', QuestLogComponent);
        entityManager.registerComponent('PassageDetails', PassageDetailsComponent);
        entityManager.registerComponent('DefinitionRef', DefinitionRefComponent); // Auto-added

        // 3. Load Test Definitions into Registry using the correct 'store' method
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('locations', roomDef.id, roomDef);
        registry.store('connections', connectionDef.id, connectionDef);

        // 4. Create Entity Instances
        playerEntity = entityManager.createEntityInstance('core:player');
        roomEntity = entityManager.createEntityInstance('demo:room_entrance');
        connectionEntity = entityManager.createEntityInstance('demo:conn_entrance_hallway');

        // Verify crucial setup steps
        if (!playerEntity || !roomEntity || !connectionEntity) {
            throw new Error("Failed to instantiate core entities for the test.");
        }
        const playerPos = playerEntity.getComponent(PositionComponent);
        const roomConn = roomEntity.getComponent(ConnectionsComponent);
        const connDetails = connectionEntity.getComponent(PassageDetailsComponent);

        if (!playerPos || !roomConn || !connDetails) {
            throw new Error("Core components missing from instantiated entities.");
        }
        expect(playerPos.locationId).toBe('demo:room_entrance');
        expect(roomConn.getConnectionByDirection('north')).toBe('demo:conn_entrance_hallway');
        expect(connDetails.blockerEntityId).toBeNull(); // Passage is open


        // 5. Build Action Context
        actionContext = {
            playerEntity: playerEntity,
            currentLocation: roomEntity,
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            // other context properties if needed by validators/formatters (e.g., eventBus, dispatch)
            eventBus: null, // Placeholder if needed
            dispatch: jest.fn(), // Placeholder if needed
            parsedCommand: null // Not used directly by discovery, but part of full context
        };
    });

    it('should discover "go north" as a valid action when player is in entrance and passage is open', async () => {
        // --- Act ---
        // Call the method under test
        const validActions = await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // 1. Basic check
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);

        // 2. Core Assertion: Check if the expected command string is present
        expect(validActions).toContain('go north');

        // 3. (Optional) More specific checks:
        // If 'go north' is the *only* action expected in this minimal setup
        // expect(validActions).toHaveLength(1);

        // 4. (Optional) Check logs to ensure expected flow happened
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Starting action discovery for actor: ${playerEntity.id}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing action definition: ${goActionDef.id}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Validation PASSED for action '${goActionDef.id}' for actor ${playerEntity.id} with target type direction`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Found valid action (direction: north): go north`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should correctly identify the direction and call validation service', async () => {
        // Spy on the validation service's isValid method
        const isValidSpy = jest.spyOn(actionValidationService, 'isValid');

        // --- Act ---
        await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // Verify isValid was called for the 'go' action with the 'north' direction context
        expect(isValidSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // The action definition
            playerEntity, // The actor
            expect.objectContaining({ // The ActionTargetContext for the direction
                type: 'direction',
                direction: 'north',
                entityId: null // Should be null for direction context
            })
        );

        isValidSpy.mockRestore(); // Clean up the spy
    });
});
// src/tests/integration/actionDiscoverySystem.formatterCall.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';

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
// (Import all necessary components as before)
import Component from '../../components/component.js';
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
import DefinitionRefComponent from '../../components/definitionRefComponent.js';

// --- Mocked Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Test Data Definitions (Copied from original) ---
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
describe('ActionDiscoverySystem Integration Test - Formatter Call', () => {

    let registry;
    let gameDataRepository;
    let entityManager;
    let actionValidationService;
    let actionDiscoverySystem;
    let playerEntity;
    let roomEntity;
    let connectionEntity;
    let actionContext;

    // Spies needed for this specific test
    let formatSpy;
    let isValidMock;
    let realIsValid; // To store the original isValid method

    beforeEach(() => {
        // Reset mocks (important even in isolated file)
        jest.clearAllMocks();

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger);
        entityManager = new EntityManager(gameDataRepository);
        actionValidationService = new ActionValidationService({
            entityManager,
            gameDataRepository,
            logger: mockLogger
        });

        // 2. Register Components
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
        entityManager.registerComponent('DefinitionRef', DefinitionRefComponent);

        // 3. Load Test Definitions
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('locations', roomDef.id, roomDef);
        registry.store('connections', connectionDef.id, connectionDef);

        // 4. Create Entity Instances
        playerEntity = entityManager.createEntityInstance('core:player');
        roomEntity = entityManager.createEntityInstance('demo:room_entrance');
        connectionEntity = entityManager.createEntityInstance('demo:conn_entrance_hallway');

        // 5. Build Action Context
        actionContext = {
            playerEntity: playerEntity,
            currentLocation: roomEntity,
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            eventBus: null,
            dispatch: jest.fn(),
            parsedCommand: null
        };

        // --- Setup Spies and Mocks specifically for the formatter test ---
        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');

        realIsValid = actionValidationService.isValid; // Store real method before mocking
        isValidMock = jest.spyOn(actionValidationService, 'isValid').mockImplementation((actionDef, actor, targetContext) => {
            if (actionDef.id === 'core:go' && targetContext.type === 'direction' && targetContext.direction === 'north') {
                // Force validation TRUE for the specific case needed to reach the formatter
                return true;
            }
            // Call the real implementation for all other cases (like initial actor check)
            return realIsValid.call(actionValidationService, actionDef, actor, targetContext);
        });

        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatSpy // <-- Inject the spy HERE
        });

        // --- End Spies/Mocks Setup ---
    });

    // Restore mocks after each test in this suite
    afterEach(() => {
        if (formatSpy) formatSpy.mockRestore();
        if (isValidMock) isValidMock.mockRestore();
        // No need to restore realIsValid, it was just a temporary variable
    });

    // --- The Isolated Test Case ---
    it('should correctly call the formatter for the valid direction action', async () => {
        // --- Act ---
        await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // Check if *any* call matches the core arguments
        const formatterCallForGoNorth = formatSpy.mock.calls.some(callArgs => {
            console.log('Spy received call with args:', JSON.stringify(callArgs)); // Add this log
            return callArgs[0]?.id === 'core:go' &&
                callArgs[1]?.type === 'direction' &&
                callArgs[1]?.direction === 'north';
        });
        // This assertion is the one currently failing
        expect(formatterCallForGoNorth).toBe(true);

        // Check the arguments of the relevant call precisely
        expect(formatSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // Action definition
            expect.objectContaining({type: 'direction', direction: 'north'}), // Target context
            entityManager // Entity manager
        );

        // Note: No need to restore mocks here, afterEach handles it.
    });

});
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
    let actionDiscoverySystem;
    let playerEntity;
    let roomEntity;
    let connectionEntity;
    let actionContext;
    let formatSpy;

    // --- Mocks for Dependencies ---
    const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    };

    // Mock for ISchemaValidator
    const mockValidator = {
        // Provide a basic implementation that passes validation by default
        // Adjust if your tests need specific validation outcomes
        validate: jest.fn((componentTypeId, componentData) => {
            // console.log(`Mock validate called for: ${componentTypeId}`); // Optional: for debugging
            return {isValid: true, errors: []};
        }),
        // Add other methods if EntityManager uses them, though constructor only checks 'validate'
    };

    // Mock for ISpatialIndexManager
    const mockSpatialIndexManager = {
        addEntity: jest.fn(),
        removeEntity: jest.fn(),
        updateEntityLocation: jest.fn(),
        getEntitiesInLocation: jest.fn((locationId) => new Set()), // Return empty set by default
        buildIndex: jest.fn(),
        clearIndex: jest.fn(),
        // Add other methods if EntityManager uses them
    };
    // --- End Mocks ---


    beforeEach(() => {
        jest.clearAllMocks();

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger);
        entityManager = new EntityManager(
            registry,
            mockValidator,
            mockLogger,
            mockSpatialIndexManager
        );
        actionValidationService = new ActionValidationService({
            entityManager,
            gameDataRepository,
            logger: mockLogger
        });
        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatSpy
        });

        // -----------------------------------------------------------
        // 2. REMOVED: Register Components section is deleted
        //    entityManager no longer has registerComponent
        // -----------------------------------------------------------

        // 3. Load Test Definitions (Remains the same)
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('locations', roomDef.id, roomDef);
        registry.store('connections', connectionDef.id, connectionDef);

        // 4. Create Entity Instances (Remains the same)
        playerEntity = entityManager.createEntityInstance('core:player');
        roomEntity = entityManager.createEntityInstance('demo:room_entrance');
        connectionEntity = entityManager.createEntityInstance('demo:conn_entrance_hallway');

        // Verification (Check if instances were created)
        if (!playerEntity || !roomEntity || !connectionEntity) {
            throw new Error("Failed to instantiate core entities for the test.");
        }

        // -----------------------------------------------------------
        // UPDATED Verification: Use getComponentData with string IDs
        // -----------------------------------------------------------
        const playerPosData = playerEntity.getComponentData('Position'); // Use string ID 'Position'
        const roomConnData = roomEntity.getComponentData('Connections'); // Use string ID 'Connections'
        const connDetailsData = connectionEntity.getComponentData('PassageDetails'); // Use string ID 'PassageDetails'

        if (!playerPosData || !roomConnData || !connDetailsData) {
            // Add check for component data existence if needed for robustness
            console.error("Player Pos Data:", playerPosData);
            console.error("Room Conn Data:", roomConnData);
            console.error("Conn Details Data:", connDetailsData);
            throw new Error("Core component data missing from instantiated entities.");
        }
        expect(playerPosData.locationId).toBe('demo:room_entrance');
        // Note: Accessing connections requires knowing the structure of Connections component data
        expect(roomConnData.connections?.north).toBe('demo:conn_entrance_hallway'); // Adjust access based on actual data structure
        expect(connDetailsData.blockerEntityId).toBeNull(); // Access data directly


        // 5. Build Action Context (Remains the same, ensure properties are correct)
        actionContext = {
            playerEntity: playerEntity,
            // Pass the entity instance for currentLocation
            currentLocation: roomEntity,
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            eventBus: null, // Placeholder
            dispatch: jest.fn(), // Placeholder
            parsedCommand: null // Placeholder
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
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Validation FINAL RESULT: PASSED for action '${goActionDef.id}' (actor ${playerEntity.id}, contextType 'direction', targetId/Dir 'north')`)
        );
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
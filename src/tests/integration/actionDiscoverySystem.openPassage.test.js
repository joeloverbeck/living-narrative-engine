// src/tests/integration/actionDiscoverySystem.openPassage.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies (Real Implementations) ---
import EntityManager from '../../entities/entityManager.js';
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js'; // Using the provided real implementation
// Import checkers needed by ActionValidationService or other parts
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';
// ComponentRequirementChecker might be needed indirectly or by other tests, keep its setup for now
import {ComponentRequirementChecker} from '../../validation/componentRequirementChecker.js';


// --- Functions used by SUT ---
import * as actionFormatter from '../../services/actionFormatter.js'; // Import module to spy

// --- Mocked Dependencies ---
// Using a simple object mock for the logger interface
const mockLogger = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
};

// Mock for ISchemaValidator
const mockValidator = {
    validate: jest.fn((componentTypeId, componentData) => {
        return {isValid: true, errors: []};
    }),
};

// Mock for getEntityIdsForScopesFn (dependency of ActionDiscoverySystem)
const mockGetEntityIdsForScopesFn = jest.fn();

// Mock for ISpatialIndexManager (dependency of EntityManager)
const mockSpatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn((locationId) => new Set()),
    buildIndex: jest.fn(),
    clearIndex: jest.fn(),
};

// Mock for JsonLogicEvaluationService (dependency of ActionValidationService)
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn().mockReturnValue(true), // Default: Assume rules pass
};

// --- ADD MOCK for createActionValidationContextFunction ---
// (dependency of ActionValidationService)
const mockCreateActionValidationContextFn = jest.fn().mockImplementation(
    (actor, targetCtx, entityManager, logger) => {
        // Return a basic context object structure sufficient for mock evaluation
        // Adjust if your actual JsonLogic rules require more complex context
        return {
            actor: {id: actor.id},
            target: targetCtx.type === 'entity' ? {id: targetCtx.entityId} :
                targetCtx.type === 'direction' ? {direction: targetCtx.direction} :
                    {},
            // Add other context properties if needed by prerequisite rules
        };
    }
);
// ---------------------------------------------------------

// --- Test Data Definitions ---
const connectionDef = {
    id: "demo:conn_entrance_hallway", components: {
        "PassageDetails": {
            "locationAId": "demo:room_entrance",
            "locationBId": "demo:room_hallway",
            "directionAtoB": "north",
            "directionBtoA": "south",
            "blockerEntityId": null,
            "type": "passage"
        }
    }
};

const roomDef = {
    "id": "demo:room_entrance", "components": {
        "Name": {"value": "Entrance"},
        "Description": {"text": "Stone archway..."},
        "MetaDescription": {"keywords": ["entrance"]},
        "Connections": {
            "connections": {
                "north": "demo:conn_entrance_hallway"
            }
        }
    }
};

const playerDef = {
    "id": "core:player", "components": {
        "Name": {"value": "Player"}, "Position": {
            "locationId": "demo:room_entrance"
        }, "Health": {"current": 10, "max": 10}, "Inventory": {"items": []}, "Stats": {
            "attributes": {
                "core:attr_strength": 8,
                "core:attr_agility": 10,
                "core:attr_intelligence": 10,
                "core:attr_constitution": 9
            }
        }, "Attack": {"damage": 3}, "Equipment": {"slots": { /* ... empty slots ... */}}, "QuestLog": {}
    }
};

const goActionDef = {
    "id": "core:go",
    "commandVerb": "go",
    "name": "Go",
    "target_domain": "direction",
    "actor_required_components": [],
    "actor_forbidden_components": [],
    "target_required_components": [],
    "target_forbidden_components": [],
    "prerequisites": [], // Assume no prerequisites for this test case simplicity
    "template": "go {direction}",
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

    // --- Declare variables for checkers ---
    let componentRequirementChecker; // Keep if needed elsewhere, not directly by AVS constructor
    let domainContextCompatibilityChecker;
    // ------------------------------------


    beforeEach(() => {
        jest.clearAllMocks();

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger);
        entityManager = new EntityManager(registry, mockValidator, mockLogger, mockSpatialIndexManager);

        // --- Instantiate Checkers needed by ActionValidationService ---
        // ComponentRequirementChecker might be needed by other systems or indirectly, so instantiate it
        componentRequirementChecker = new ComponentRequirementChecker({logger: mockLogger});
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});
        // ------------------------------------------------------------

        // --- CORRECTED ActionValidationService Instantiation ---
        // Ensure ALL dependencies required by its constructor are provided.
        actionValidationService = new ActionValidationService({
            entityManager,                          // Pass the EntityManager instance
            logger: mockLogger,                     // Pass the logger instance
            domainContextCompatibilityChecker,      // Pass the DomainContextCompatibilityChecker instance
            jsonLogicEvaluationService: mockJsonLogicEvaluationService, // <<< CORRECTLY PASSING DEPENDENCY
            createActionValidationContextFunction: mockCreateActionValidationContextFn // <<< CORRECTLY PASSING DEPENDENCY
        });
        // ------------------------------------------------------

        mockGetEntityIdsForScopesFn.mockClear();
        mockGetEntityIdsForScopesFn.mockReturnValue(new Set()); // Default: return empty set

        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');

        // Instantiate the System Under Test (ActionDiscoverySystem)
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService, // Pass the correctly instantiated service
            logger: mockLogger,
            formatActionCommandFn: formatSpy, // Pass the spy/mock formatter function
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn // Pass the mock scope function
        });

        // 2. Load Test Definitions into the registry
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('locations', roomDef.id, roomDef); // Assuming locations are stored under 'locations' type
        registry.store('connections', connectionDef.id, connectionDef); // Assuming connections are stored under 'connections' type

        // 3. Create Entity Instances from definitions
        playerEntity = entityManager.createEntityInstance('core:player');
        roomEntity = entityManager.createEntityInstance('demo:room_entrance');
        connectionEntity = entityManager.createEntityInstance('demo:conn_entrance_hallway');

        // Verification: Ensure entities and key components were loaded correctly
        if (!playerEntity || !roomEntity || !connectionEntity) {
            throw new Error("Failed to instantiate core entities for the test.");
        }

        const playerPosData = playerEntity.getComponentData('Position');
        const roomConnData = roomEntity.getComponentData('Connections');
        const connDetailsData = connectionEntity.getComponentData('PassageDetails');

        if (!playerPosData || !roomConnData || !connDetailsData) {
            console.error("Player Pos Data:", playerPosData);
            console.error("Room Conn Data:", roomConnData);
            console.error("Conn Details Data:", connDetailsData);
            throw new Error("Core component data missing from instantiated entities.");
        }
        // Assert initial state is as expected for the test scenario
        expect(playerPosData.locationId).toBe('demo:room_entrance');
        expect(roomConnData.connections?.north).toBe('demo:conn_entrance_hallway');
        expect(connDetailsData.blockerEntityId).toBeNull(); // Passage is open

        // 4. Build Action Context required by ActionDiscoverySystem.getValidActions
        actionContext = {
            playerEntity: playerEntity,
            currentLocation: roomEntity,
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            eventBus: null, // Mock or null if not used by the discovery process itself
            dispatch: jest.fn(), // Mock or null if not used
            parsedCommand: null // Not relevant for action discovery
        };
    });


    it('should discover "go north" as a valid action when player is in entrance and passage is open', async () => {
        // Arrange (Done in beforeEach)
        // Configure mocks if specific behavior is needed beyond defaults
        // e.g., mockJsonLogicEvaluationService.evaluate.mockReturnValueOnce(true); // Already default

        // --- Act ---
        const validActions = await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);

        // Check that the expected formatted command string is present
        expect(validActions).toContain('go north');

        // Optional: Check if it's the *only* action (adjust if other actions are expected)
        // expect(validActions).toHaveLength(1);

        // Ensure no errors were logged
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should correctly identify the direction and call validation service with the right context', async () => {
        // Arrange (Done in beforeEach)
        // Spy on the validation service's isValid method AFTER it has been instantiated
        const isValidSpy = jest.spyOn(actionValidationService, 'isValid');

        // --- Act ---
        await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // Verify that actionValidationService.isValid was called for the 'go' action
        // with the player as the actor, and a target context representing the 'north' direction.
        expect(isValidSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // The action definition for 'go'
            playerEntity, // The actor entity
            expect.objectContaining({ // The ActionTargetContext for the direction 'north'
                type: 'direction',
                direction: 'north',
                entityId: null // Explicitly check that entityId is null for direction context
            })
        );

        // Optional: Check how many times it was called if specific number is expected
        // expect(isValidSpy).toHaveBeenCalledTimes(1); // Assuming 'go' is the only action processed with a direction target

        isValidSpy.mockRestore(); // Clean up the spy
    });
});
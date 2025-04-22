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
import Entity from '../../entities/entity.js';
import {ComponentRequirementChecker} from '../../validation/componentRequirementChecker.js';
// --- ADDED IMPORTS FOR MISSING CHECKERS ---
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';
import {PrerequisiteChecker} from '../../validation/prerequisiteChecker.js';
// ------------------------------------------

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

// --- ADD MOCK for getEntityIdsForScopesFn ---
const mockGetEntityIdsForScopesFn = jest.fn();

// Mock for ISpatialIndexManager
const mockSpatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn((locationId) => new Set()),
    buildIndex: jest.fn(),
    clearIndex: jest.fn(),
};

// Mock for JsonLogicEvaluationService (needed by PrerequisiteChecker)
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn().mockReturnValue(true), // Default: Assume rules pass
};


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
    "prerequisites": [],
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
    let componentRequirementChecker;
    let domainContextCompatibilityChecker;
    let prerequisiteChecker;
    // ------------------------------------


    beforeEach(() => {
        jest.clearAllMocks();

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger); // Still needed for ActionDiscoverySystem
        entityManager = new EntityManager(registry, mockValidator, mockLogger, mockSpatialIndexManager);

        // --- Instantiate ALL required Checkers ---
        componentRequirementChecker = new ComponentRequirementChecker({logger: mockLogger});
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});
        prerequisiteChecker = new PrerequisiteChecker({
            jsonLogicEvaluationService: mockJsonLogicEvaluationService, entityManager: entityManager, logger: mockLogger
        });
        // -----------------------------------------

        // --- CORRECTED ActionValidationService Instantiation ---
        actionValidationService = new ActionValidationService({
            entityManager, // Pass the EntityManager instance
            logger: mockLogger, // Pass the logger instance
            componentRequirementChecker, // Pass the ComponentRequirementChecker instance
            domainContextCompatibilityChecker, // Pass the DomainContextCompatibilityChecker instance
            prerequisiteChecker // Pass the PrerequisiteChecker instance
        });
        // ------------------------------------------------------

        mockGetEntityIdsForScopesFn.mockClear();
        mockGetEntityIdsForScopesFn.mockReturnValue(new Set()); // Default: return empty set

        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');

        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatSpy,
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn // <<< ADDED DEPENDENCY
        });

        // 2. Load Test Definitions
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('locations', roomDef.id, roomDef);
        registry.store('connections', connectionDef.id, connectionDef);

        // 3. Create Entity Instances
        playerEntity = entityManager.createEntityInstance('core:player');
        roomEntity = entityManager.createEntityInstance('demo:room_entrance');
        connectionEntity = entityManager.createEntityInstance('demo:conn_entrance_hallway');

        // Verification
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
        expect(playerPosData.locationId).toBe('demo:room_entrance');
        expect(roomConnData.connections?.north).toBe('demo:conn_entrance_hallway');
        expect(connDetailsData.blockerEntityId).toBeNull();

        // 4. Build Action Context
        actionContext = {
            playerEntity: playerEntity,
            currentLocation: roomEntity,
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            eventBus: null,
            dispatch: jest.fn(),
            parsedCommand: null
        };
    });


    it('should discover "go north" as a valid action when player is in entrance and passage is open', async () => {
        // --- Act ---
        const validActions = await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);
        expect(validActions).toContain('go north');
        // expect(validActions).toHaveLength(1); // Uncomment if only 'go north' is expected

        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Starting action discovery for actor: ${playerEntity.id}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Processing action definition: ${goActionDef.id}`));
        // Check for the validation success log from ActionValidationService
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: PASSED for action '${goActionDef.id}'.`) // Check the final success log
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
        expect(isValidSpy).toHaveBeenCalledWith(expect.objectContaining({id: 'core:go'}), // The action definition
            playerEntity, // The actor
            expect.objectContaining({ // The ActionTargetContext for the direction
                type: 'direction', direction: 'north', entityId: null
            }));

        isValidSpy.mockRestore(); // Clean up the spy
    });
});
// src/tests/integration/actionDiscoverySystem.openPassage.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies (Real Implementations) ---
import EntityManager from '../../entities/entityManager.js';
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js';
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js'; // Real Checker
import {PrerequisiteEvaluationService} from '../../services/prerequisiteEvaluationService.js'; // Real PES
import {ActionValidationContextBuilder} from '../../services/actionValidationContextBuilder.js'; // <<< CORRECT: Import Real Builder

// --- Functions used by SUT ---
import * as actionFormatter from '../../services/actionFormatter.js'; // Import module to spy

// --- Mocked Dependencies ---
const mockLogger = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
};

const mockValidator = {
    validate: jest.fn((componentTypeId, componentData) => {
        return {isValid: true, errors: []};
    }),
};

const mockGetEntityIdsForScopesFn = jest.fn();

const mockSpatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn((locationId) => new Set()),
    buildIndex: jest.fn(),
    clearIndex: jest.fn(),
};

// Mock for JsonLogicEvaluationService (dependency of PrerequisiteEvaluationService)
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn().mockReturnValue(true), // Default: Assume rules pass
};

// --- REMOVED mockCreateActionValidationContextFn - Obsolete Dependency ---


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
        }, "Attack": {"damage": 3}, "Equipment": {"slots": {}}, "QuestLog": {}
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
    let actionValidationContextBuilder; // <<< CORRECT: Added declaration
    let prerequisiteEvaluationService;
    let actionValidationService; // Real AVS instance
    let actionDiscoverySystem;
    let playerEntity;
    let roomEntity;
    let connectionEntity;
    let actionContext;
    let formatSpy;

    let domainContextCompatibilityChecker; // Real Checker instance

    beforeEach(() => {
        jest.clearAllMocks();

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger);
        entityManager = new EntityManager(registry, mockValidator, mockLogger, mockSpatialIndexManager);

        // Instantiate REAL Checkers/Builders needed by dependencies
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});
        // <<< CORRECT: Instantiate the real ActionValidationContextBuilder >>>
        actionValidationContextBuilder = new ActionValidationContextBuilder({
            entityManager: entityManager,
            logger: mockLogger
        });

        // --- Instantiate PrerequisiteEvaluationService ---
        // <<< CORRECT: Inject the real actionValidationContextBuilder >>>
        prerequisiteEvaluationService = new PrerequisiteEvaluationService({
            logger: mockLogger,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            actionValidationContextBuilder: actionValidationContextBuilder // Inject the instance
        });

        // --- CORRECTED ActionValidationService Instantiation ---
        // <<< CORRECT: Remove obsolete createActionValidationContextFunction dependency >>>
        actionValidationService = new ActionValidationService({
            entityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker,
            prerequisiteEvaluationService: prerequisiteEvaluationService // Pass the correctly instantiated PES
        });

        mockGetEntityIdsForScopesFn.mockClear();
        mockGetEntityIdsForScopesFn.mockReturnValue(new Set()); // Default: return empty set

        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');

        // Instantiate the System Under Test (ActionDiscoverySystem)
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService, // Pass the correctly instantiated real service
            logger: mockLogger,
            formatActionCommandFn: formatSpy,
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn
        });

        // 2. Load Test Definitions into the registry
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('locations', roomDef.id, roomDef);
        registry.store('connections', connectionDef.id, connectionDef);

        // 3. Create Entity Instances from definitions
        playerEntity = entityManager.createEntityInstance('core:player');
        roomEntity = entityManager.createEntityInstance('demo:room_entrance');
        connectionEntity = entityManager.createEntityInstance('demo:conn_entrance_hallway');

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

        // 4. Build Action Context required by ActionDiscoverySystem.getValidActions
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
        // Arrange (Done in beforeEach)

        // --- Act ---
        const validActions = await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);
        expect(validActions).toContain('go north');
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should correctly identify the direction and call validation service with the right context', async () => {
        // Arrange
        const isValidSpy = jest.spyOn(actionValidationService, 'isValid');

        // --- Act ---
        await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // First call is the initial actor check (target = none)
        expect(isValidSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // Action Def
            playerEntity, // Actor
            expect.objectContaining({type: 'none'}) // Initial Target Context
        );

        // Second call is the specific direction check
        expect(isValidSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}),
            playerEntity,
            expect.objectContaining({ // The ActionTargetContext for the direction 'north'
                type: 'direction',
                direction: 'north',
                entityId: null
            })
        );

        // Verify call count if necessary (depends on how many actions are processed)
        // expect(isValidSpy).toHaveBeenCalledTimes(2);

        isValidSpy.mockRestore(); // Clean up the spy
    });
});

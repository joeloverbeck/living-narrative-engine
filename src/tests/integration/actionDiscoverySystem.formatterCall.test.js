// src/tests/integration/actionDiscoverySystem.formatterCall.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies (Real Implementations) ---
import EntityManager from '../../entities/entityManager.js';
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js'; // Using the provided real implementation
import Entity from '../../entities/entity.js';

// --- Functions used by SUT ---
import * as actionFormatter from '../../services/actionFormatter.js';
import {ComponentRequirementChecker} from "../../validation/componentRequirementChecker.js"; // Import module to spy

// --- Mocked Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// ADD MOCKS FOR THE OTHER EntityManager DEPENDENCIES
const mockValidator = {
    validate: jest.fn((schemaId, data) => ({isValid: true, errors: []})), // Simple mock validator
};

const mockSpatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()),
    buildIndex: jest.fn(),
    clearIndex: jest.fn(),
};

const mockJsonLogicEvaluationService = {
    // Mock the methods ActionValidationService uses.
    // Assuming it needs an 'evaluate' method:
    evaluate: jest.fn().mockReturnValue(true), // Default: Assume rules pass unless specified otherwise
    // Add mocks for other methods if needed
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
    let componentRequirementChecker;

    // Spies needed for this specific test
    let formatSpy;
    let isValidMock;
    let realIsValid; // To store the original isValid method

    beforeEach(() => {
        // Reset mocks
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

        componentRequirementChecker = new ComponentRequirementChecker({ logger: mockLogger });

        actionValidationService = new ActionValidationService({
            entityManager,
            gameDataRepository,
            logger: mockLogger,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            componentRequirementChecker
        });

        // 2. Load Test Definitions into the REGISTRY
        // Store ACTIONS separately (EntityManager doesn't load these)
        registry.store('actions', goActionDef.id, goActionDef);

        // Store ALL definitions needed for ENTITY INSTANTIATION under 'entities'
        registry.store('entities', playerDef.id, playerDef);
        registry.store('entities', roomDef.id, roomDef);         // <-- Store room as 'entities'
        registry.store('entities', connectionDef.id, connectionDef); // <-- Store connection as 'entities'

        // 4. Create Entity Instances using EntityManager
        playerEntity = entityManager.createEntityInstance('core:player');
        roomEntity = entityManager.createEntityInstance('demo:room_entrance');
        connectionEntity = entityManager.createEntityInstance('demo:conn_entrance_hallway');

        // Check if entities were created successfully
        if (!playerEntity || !roomEntity || !connectionEntity) {
            // Add more detail to the error to see WHICH one failed
            console.error('DEBUG: playerEntity:', playerEntity);
            console.error('DEBUG: roomEntity:', roomEntity);
            console.error('DEBUG: connectionEntity:', connectionEntity);
            throw new Error('Failed to create one or more entity instances in test setup. Check definitions and EntityManager logic. See console logs.');
        }


        // 5. Build Action Context
        actionContext = {
            playerEntity: playerEntity,
            currentLocation: roomEntity, // This is still conceptually the room entity
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            eventBus: null,
            dispatch: jest.fn(),
            parsedCommand: null
        };

        // --- Setup Spies and Mocks ---
        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');
        realIsValid = actionValidationService.isValid;
        isValidMock = jest.spyOn(actionValidationService, 'isValid').mockImplementation((actionDef, actor, targetContext) => {
            if (actionDef.id === 'core:go' && targetContext.type === 'direction' && targetContext.direction === 'north') {
                return true;
            }
            return realIsValid.call(actionValidationService, actionDef, actor, targetContext);
        });

        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatSpy
        });
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
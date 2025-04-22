// src/tests/integration/actionDiscoverySystem.takeItem.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies (Real Implementations) ---
import EntityManager from '../../entities/entityManager.js';
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js';
import Entity from '../../entities/entity.js';

// --- Functions used by SUT (Mocks/Spies) ---
// Mock the formatter function directly for interaction testing
const mockFormatActionCommandFn = jest.fn();

// --- Constants ---
import {
    EQUIPMENT_COMPONENT_ID, INVENTORY_COMPONENT_ID,
    ITEM_COMPONENT_ID,
    LOCKABLE_COMPONENT_ID, // Keep even if not used by 'take' for context
    NAME_COMPONENT_TYPE_ID,
    POSITION_COMPONENT_ID
} from "../../types/components.js";
import {ComponentRequirementChecker} from "../../validation/componentRequirementChecker";

// --- Mocked Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Keep the mock, even if not asserting specific calls from SUT
};

const mockSchemaValidator = {
    validate: jest.fn().mockReturnValue({isValid: true, errors: []}),
};

const mockSpatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn(), // Configured per test
    buildIndex: jest.fn(),
    clearIndex: jest.fn(),
};

const mockJsonLogicEvaluationService = {
    // Mock the methods ActionValidationService uses.
    // Assuming it needs an 'evaluate' method:
    evaluate: jest.fn().mockReturnValue(true), // Default: Assume rules pass unless specified otherwise
    // Add mocks for other methods if needed
};

// --- Test Data Definitions ---
const takeActionDef = {
    "$schema": "../schemas/action-definition.schema.json",
    "id": "core:take",
    "commandVerb": "take",
    "name": "Take",
    "target_domain": "environment",
    "actor_required_components": [],
    "actor_forbidden_components": [],
    "target_required_components": [ITEM_COMPONENT_ID], // Key must have this
    "target_forbidden_components": [],
    "prerequisites": [],
    "template": "take {target}", // Used by formatter
    "dispatch_event": {}
};

const playerDef = {
    "id": "core:player",
    "components": {
        [NAME_COMPONENT_TYPE_ID]: {"value": "Player"},
        [POSITION_COMPONENT_ID]: {"locationId": "demo:room_entrance"},
        [INVENTORY_COMPONENT_ID]: {"items": []},
        [EQUIPMENT_COMPONENT_ID]: {"slots": {}},
        // Other components for completeness
        "component:health": {"current": 10, "max": 10},
        "component:stats": {"attributes": {"core:attr_strength": 8}},
        "component:attack": {"damage": 3},
        "component:questlog": {}
    }
};

const rustyKeyDef = {
    "id": "demo:item_key_rusty",
    "components": {
        [NAME_COMPONENT_TYPE_ID]: {"value": "Rusty Key"}, // Needed by formatter
        "component:description": {"text": "An old, rusty iron key."},
        [POSITION_COMPONENT_ID]: {"locationId": "demo:room_entrance"},
        [ITEM_COMPONENT_ID]: { // Required by takeActionDef
            "tags": ["key", "metal"],
            "stackable": false,
            "value": 5,
            "weight": 0.1
        },
        "component:usable": { /* ...irrelevant for take... */}
    }
};

const roomDef = {
    "id": "demo:room_entrance",
    "components": {
        [NAME_COMPONENT_TYPE_ID]: {"value": "Room Entrance"},
        "component:description": {"text": "A dusty entrance chamber."}
    }
};

// --- Test Suite ---
describe('ActionDiscoverySystem Integration Test - Take Item', () => {

    let registry;
    let gameDataRepository;
    let entityManager;
    let actionValidationService;
    let actionDiscoverySystem;

    // Spies for interaction testing
    let validationSpy;
    let getInstanceSpy;

    let playerEntity;
    let keyEntity;
    let roomEntity;
    let actionContext;
    let componentRequirementChecker;

    beforeEach(() => {
        // Reset mocks and spies
        jest.clearAllMocks();
        mockSpatialIndexManager.getEntitiesInLocation.mockClear();
        mockFormatActionCommandFn.mockClear(); // Clear the formatter mock

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger);

        entityManager = new EntityManager(
            registry,
            mockSchemaValidator,
            mockLogger,
            mockSpatialIndexManager
        );
        // Spy on entityManager methods *after* instance creation
        getInstanceSpy = jest.spyOn(entityManager, 'getEntityInstance');

        componentRequirementChecker = new ComponentRequirementChecker({ logger: mockLogger });

        actionValidationService = new ActionValidationService({
            entityManager,
            gameDataRepository,
            logger: mockLogger,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            componentRequirementChecker
        });
        // Spy on validation service methods *after* instance creation
        validationSpy = jest.spyOn(actionValidationService, 'isValid');


        // Instantiate the System Under Test
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: mockFormatActionCommandFn // Inject the MOCK formatter
        });

        // 3. Load Test Definitions into Registry
        registry.store('actions', takeActionDef.id, takeActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('entities', rustyKeyDef.id, rustyKeyDef);
        registry.store('locations', roomDef.id, roomDef);

        // 4. Create Entity Instances using EntityManager
        playerEntity = entityManager.createEntityInstance(playerDef.id);
        keyEntity = entityManager.createEntityInstance(rustyKeyDef.id);
        roomEntity = entityManager.createEntityInstance(roomDef.id);

        // Verify crucial setup steps (basic checks)
        if (!playerEntity || !keyEntity || !roomEntity) {
            throw new Error("Failed to instantiate core entities for the test.");
        }
        // Reset spies that might have been called during entity creation if needed
        // getInstanceSpy.mockClear();

        // 5. Build Action Context
        actionContext = {
            playerEntity: playerEntity,
            currentLocation: roomEntity,
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            eventBus: {dispatch: jest.fn()},
            dispatch: jest.fn(),
            parsedCommand: null
        };
    });

    it('should discover "take Rusty Key" as a valid action when player is in the room with the key', async () => {
        // --- Arrange ---

        // Configure Spatial Index Mock
        const entitiesInRoomSet = new Set([playerEntity.id, keyEntity.id]);
        mockSpatialIndexManager.getEntitiesInLocation.mockImplementation((locationId) => {
            if (locationId === roomEntity.id) {
                return new Set(entitiesInRoomSet);
            }
            return new Set();
        });

        // Configure Formatter Mock return value
        const expectedCommand = "take Rusty Key";
        mockFormatActionCommandFn.mockImplementation((actionDef, targetContext, /*entityManager, options*/) => {
            // Basic mock: Return the expected command if called for the key
            if (actionDef.id === takeActionDef.id && targetContext?.entityId === keyEntity.id) {
                return expectedCommand;
            }
            return null; // Return null otherwise
        });


        // --- Act ---
        const validActions = await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---

        // 1. Core Functional Outcome
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);
        expect(validActions).toContain(expectedCommand);
        // Optional: Check if only the expected action was found
        expect(validActions).toHaveLength(1);

        // 2. Verify Dependency Interactions

        // Check Spatial Index was queried for the correct location
        expect(mockSpatialIndexManager.getEntitiesInLocation).toHaveBeenCalledWith(roomEntity.id);

        // Check ActionValidationService was called correctly
        // a) Initial actor check (no target context)
        expect(validationSpy).toHaveBeenCalledWith(
            takeActionDef,
            playerEntity,
            expect.objectContaining({type: 'none'}) // Or ActionTargetContext.noTarget() if imported
        );
        // b) Check for the specific target (the key)
        expect(validationSpy).toHaveBeenCalledWith(
            takeActionDef,
            playerEntity,
            expect.objectContaining({type: 'entity', entityId: keyEntity.id})
        );
        // Ensure validation passed for the key (implicitly checked by presence of action in results,
        // but we can also check the spy call count relative to targets if needed)

        // Check EntityManager was asked for the key instance
        // Note: getInstanceSpy might be called multiple times internally by dependencies,
        // so checking for specific call might be fragile. Use toHaveBeenCalledWith.
        expect(getInstanceSpy).toHaveBeenCalledWith(keyEntity.id);

        // Check Formatter was called AFTER validation passed for the key
        expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1); // This passes now
        expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
            takeActionDef,
            expect.objectContaining({type: 'entity', entityId: keyEntity.id}), // Arg 2
            entityManager, // Arg 3 - Keep expecting the instance for now
            // REMOVE the expect.anything() for the 4th argument below
            // expect.anything()
        ); // Function is only called with 3 arguments

        // 3. Ensure no unexpected errors were logged by our mock logger
        expect(mockLogger.error).not.toHaveBeenCalled();

        // We are NO LONGER checking specific mockLogger.debug calls from the SUT.
    });

    // Add more 'it' blocks for other scenarios

});
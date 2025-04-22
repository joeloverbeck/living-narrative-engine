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
import {ComponentRequirementChecker} from "../../validation/componentRequirementChecker.js";
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';
import {PrerequisiteChecker} from '../../validation/prerequisiteChecker.js';

// --- Functions used by SUT (Mocks/Spies) ---
// Mock the formatter function directly for interaction testing
const mockFormatActionCommandFn = jest.fn();
// --- ADD MOCK FOR getEntityIdsForScopesFn ---
const mockGetEntityIdsForScopesFn = jest.fn();
// -----------------------------------------

// --- Constants ---
import {
    EQUIPMENT_COMPONENT_ID, INVENTORY_COMPONENT_ID,
    ITEM_COMPONENT_ID,
    LOCKABLE_COMPONENT_ID,
    NAME_COMPONENT_TYPE_ID,
    POSITION_COMPONENT_ID
} from "../../types/components.js";


// --- Mocked Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockSchemaValidator = {
    validate: jest.fn().mockReturnValue({isValid: true, errors: []}),
};

// Keep spatial index mock - it might be used indirectly or by other parts
const mockSpatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn(),
    buildIndex: jest.fn(),
    clearIndex: jest.fn(),
};

// Mock for PrerequisiteChecker dependency
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn().mockReturnValue(true), // Default: Assume rules pass
};

// --- Test Data Definitions ---
const takeActionDef = {
    "$schema": "../schemas/action-definition.schema.json",
    "id": "core:take",
    "commandVerb": "take",
    "name": "Take",
    "target_domain": "environment", // This requires getEntityIdsForScopesFn
    "actor_required_components": [],
    "actor_forbidden_components": [],
    "target_required_components": [ITEM_COMPONENT_ID], // Key must have this
    "target_forbidden_components": [],
    "prerequisites": [], // Empty prerequisites
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
        // No explicit connections needed if mocking getEntityIdsForScopesFn directly
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
    let getEntityIdsSpy; // Spy for the new mock

    // --- Declare variables for checkers ---
    let componentRequirementChecker;
    let domainContextCompatibilityChecker;
    let prerequisiteChecker;

    let playerEntity;
    let keyEntity;
    let roomEntity;
    let actionContext;


    beforeEach(() => {
        // Reset mocks and spies
        jest.clearAllMocks();
        mockSpatialIndexManager.getEntitiesInLocation.mockClear();
        mockFormatActionCommandFn.mockClear();
        mockGetEntityIdsForScopesFn.mockClear(); // <<< CLEAR THE NEW MOCK

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger);

        entityManager = new EntityManager(
            registry,
            mockSchemaValidator,
            mockLogger,
            mockSpatialIndexManager // Pass the mock here
        );
        // Spy on entityManager methods *after* instance creation
        getInstanceSpy = jest.spyOn(entityManager, 'getEntityInstance');

        // --- Instantiate ALL required Checkers ---
        componentRequirementChecker = new ComponentRequirementChecker({logger: mockLogger});
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});
        prerequisiteChecker = new PrerequisiteChecker({
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            entityManager: entityManager,
            logger: mockLogger
        });

        // --- CORRECTED ActionValidationService Instantiation ---
        actionValidationService = new ActionValidationService({
            entityManager,
            logger: mockLogger,
            componentRequirementChecker,
            domainContextCompatibilityChecker,
            prerequisiteChecker
        });
        // Spy on validation service methods *after* instance creation
        validationSpy = jest.spyOn(actionValidationService, 'isValid');


        // Instantiate the System Under Test
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: mockFormatActionCommandFn, // Inject the formatter mock
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn // <<< INJECT THE SCOPE MOCK
        });

        // Assign the mock to the spy variable for easier assertion access
        getEntityIdsSpy = mockGetEntityIdsForScopesFn;

        // 3. Load Test Definitions into Registry
        registry.store('actions', takeActionDef.id, takeActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('entities', rustyKeyDef.id, rustyKeyDef);
        registry.store('entities', roomDef.id, roomDef);


        // 4. Create Entity Instances using EntityManager
        playerEntity = entityManager.createEntityInstance(playerDef.id);
        keyEntity = entityManager.createEntityInstance(rustyKeyDef.id);
        roomEntity = entityManager.createEntityInstance(roomDef.id);


        if (!playerEntity || !keyEntity || !roomEntity) {
            throw new Error("Failed to instantiate core entities for the test.");
        }

        // 5. Build Action Context (including the current location needed by getEntityIdsForScopesFn mock)
        actionContext = {
            playerEntity: playerEntity,
            currentLocation: roomEntity, // Pass the actual room entity instance
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            eventBus: {dispatch: jest.fn()}, // Add a mock eventBus if needed
            dispatch: jest.fn(),
            parsedCommand: null
        };
    });

    it('should discover "take Rusty Key" as a valid action when player is in the room with the key', async () => {
        // --- Arrange ---

        // Configure Spatial Index Mock (Optional but good practice if getEntityIdsForScopes *might* use it)
        const entitiesInRoomSet = new Set([playerEntity.id, keyEntity.id]);
        mockSpatialIndexManager.getEntitiesInLocation.mockImplementation((locationId) => {
            if (locationId === roomEntity.id) {
                return new Set(entitiesInRoomSet); // Return a new set instance each time
            }
            return new Set();
        });

        // --- CONFIGURE THE MOCK for getEntityIdsForScopesFn ---
        // This mock now controls exactly which entities are considered for the 'environment' domain
        mockGetEntityIdsForScopesFn.mockImplementation((scopes, context) => {
            // Check if the scope and context match what's expected for finding the key
            if (scopes && scopes.includes('environment') && context?.currentLocation?.id === roomEntity.id) {
                // Return a Set containing ONLY the key's ID.
                // Crucially, filter out the actor's ID if the scope implies "others in environment".
                return new Set([keyEntity.id]);
            }
            return new Set(); // Return empty set for other scopes/contexts
        });
        // -------------------------------------------------------


        // Configure Formatter Mock return value
        const expectedCommand = "take Rusty Key";
        mockFormatActionCommandFn.mockImplementation((actionDef, targetContext, /*entityManager, options*/) => {
            // Check that it's called for the correct action and target
            if (actionDef.id === takeActionDef.id && targetContext instanceof ActionTargetContext && targetContext.type === 'entity' && targetContext.entityId === keyEntity.id) {
                return expectedCommand;
            }
            // Return null or a default string for unexpected calls to help debugging
            return `Formatted: ${actionDef.id} on ${targetContext?.entityId ?? targetContext?.direction ?? 'none'}`;
        });


        // --- Act ---
        const validActions = await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---

        // 1. Core Functional Outcome
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);
        // Use expect.arrayContaining if other valid actions might exist and you don't want the test to be too brittle.
        // expect(validActions).toEqual([expectedCommand]); // Use this if ONLY "take Rusty Key" is expected
        expect(validActions).toContain(expectedCommand); // Check if the specific command is present


        // 2. Verify Dependency Interactions

        // *** Check that getEntityIdsForScopesFn was called correctly ***
        expect(getEntityIdsSpy).toHaveBeenCalledWith(
            ['environment'], // The scope requested by the system for the 'take' action definition
            actionContext    // The context passed by the system
        );
        // You might want to check if it was called multiple times if multiple action defs use 'environment'
        // expect(getEntityIdsSpy).toHaveBeenCalledTimes(1);


        // Check ActionValidationService calls
        //  a) Initial actor check (should pass)
        expect(validationSpy).toHaveBeenCalledWith(
            takeActionDef,
            playerEntity,
            expect.objectContaining({type: 'none'}) // Or ActionTargetContext.noTarget() instance check
        );
        //  b) Check for the specific target (the key) - This is the crucial one that should now happen
        expect(validationSpy).toHaveBeenCalledWith(
            takeActionDef,
            playerEntity,
            // Check that it's called with an ActionTargetContext instance for the entity
            expect.objectContaining({type: 'entity', entityId: keyEntity.id})
        );

        // Check EntityManager was asked for the key instance (by ActionDiscoverySystem loop)
        expect(getInstanceSpy).toHaveBeenCalledWith(keyEntity.id);

        // Check Formatter was called AFTER validation passed for the key
        // Use expect.toHaveBeenCalledTimes if you expect ONLY the take action
        // expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
        // Use expect.toHaveBeenCalledWith for more specific check
        expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
            takeActionDef,
            expect.objectContaining({type: 'entity', entityId: keyEntity.id}), // Ensure it's the context for the key
            entityManager // Expecting the 3rd argument to be entityManager
            // No 4th options argument passed in the SUT code for this path
        );

        // 3. Ensure no unexpected errors logged
        expect(mockLogger.error).not.toHaveBeenCalled();
        // Optional: Check for specific debug/warn logs if needed
        expect(mockLogger.debug).toHaveBeenCalledWith(`    * Found valid action (target ${keyEntity.id}): ${expectedCommand}`);


        // Check overall length if only one action is expected
        if (validActions.length > 1) {
            console.warn(`Test Warning: Expected only 1 valid action, but found ${validActions.length}: ${validActions.join(', ')}`);
        }
        expect(validActions).toHaveLength(1); // Be more strict if needed

    });

    // Add more 'it' blocks for scenarios like:
    // - Key is not returned by mockGetEntityIdsForScopesFn
    // - Player fails initial validation check
    // - Target fails component checks (tested via validationSpy returning false)
    // - Formatter returns null

});
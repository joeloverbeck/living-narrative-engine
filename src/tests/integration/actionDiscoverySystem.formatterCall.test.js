// src/tests/integration/actionDiscoverySystem.formatterCall.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';

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

// --- Functions used by SUT ---
import * as actionFormatter from '../../services/actionFormatter.js'; // Import module to spy

// --- Mocked Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(), // Keep debug for potential logging inside mocks/SUT
};

// Mocks for EntityManager dependencies
const mockValidator = {
    validate: jest.fn((schemaId, data) => ({isValid: true, errors: []})),
};
const mockSpatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn((locationId) => {
        // Simulate player being in the entrance room for scope checks if needed
        if (locationId === 'demo:room_entrance') {
            // Return player ID and potentially other IDs if tests required them
            return new Set(['core:player']);
        }
        return new Set();
    }),
    buildIndex: jest.fn(),
    clearIndex: jest.fn(),
};

const mockGetEntityIdsForScopesFn = jest.fn();

// Mock for PrerequisiteChecker dependency
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn().mockReturnValue(true), // Assume prerequisites pass by default
};

// --- Test Data Definitions ---
const connectionDef = {
    id: "demo:conn_entrance_hallway",
    components: {
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
    "id": "demo:room_entrance",
    "components": {
        "Name": {"value": "Entrance"},
        "Description": {"text": "Stone archway..."},
        "MetaDescription": {"keywords": ["entrance"]},
        "Connections": { // Ensure this component data exists for the 'direction' logic
            "connections": {
                "north": { // Ensure 'north' exists as a key
                    "connectionEntityId": "demo:conn_entrance_hallway",
                    // Add other connection info if needed by your Connections component structure
                }
            }
        }
    }
};

const playerDef = {
    "id": "core:player",
    "components": {
        "Name": {"value": "Player"},
        "Position": {
            "locationId": "demo:room_entrance"
        },
        // Add other components as needed by validation/action logic
        "Inventory": {"items": []},
    }
};

const goActionDef = {
    "id": "core:go",
    "commandVerb": "go",
    "name": "Go",
    "target_domain": "direction", // <<< Key for this test
    "actor_required_components": [],
    "actor_forbidden_components": [],
    "target_required_components": [],
    "target_forbidden_components": [],
    "prerequisites": [], // Assume no prerequisites for simplicity here
    "template": "go {direction}", // Template used by formatter
};


// --- Test Suite ---
describe('ActionDiscoverySystem Integration Test - Formatter Call Scenarios', () => {

    let registry;
    let gameDataRepository;
    let entityManager;
    let realActionValidationService; // Keep instance of real service for fallback/reference
    let actionDiscoverySystem;
    let playerEntity;
    let roomEntity;
    // let connectionEntity; // Not directly used in these tests, but definition needed for room

    // Spies/Mocks needed across tests
    let formatSpy;
    let isValidMock;

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test

        // 1. Instantiate Core Services & Dependencies
        registry = new InMemoryDataRegistry(); // Fresh registry for each test
        gameDataRepository = new GameDataRepository(registry, mockLogger);
        entityManager = new EntityManager(
            registry,
            mockValidator,
            mockLogger,
            mockSpatialIndexManager
        );

        // Instantiate real Checkers needed by ActionValidationService
        const componentRequirementChecker = new ComponentRequirementChecker({logger: mockLogger});
        const domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});
        const prerequisiteChecker = new PrerequisiteChecker({
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            entityManager: entityManager,
            logger: mockLogger
        });

        // Instantiate the REAL ActionValidationService - we will SPY on its 'isValid' method
        realActionValidationService = new ActionValidationService({
            entityManager,
            logger: mockLogger,
            componentRequirementChecker,
            domainContextCompatibilityChecker,
            prerequisiteChecker
        });

        // 2. Load Definitions into Registry
        // Only load what's needed for the specific tests
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('entities', roomDef.id, roomDef);
        registry.store('entities', connectionDef.id, connectionDef); // Needed for room's connection component

        // 3. Create Entity Instances
        playerEntity = entityManager.createEntityInstance(playerDef.id);
        roomEntity = entityManager.createEntityInstance(roomDef.id);
        // connectionEntity = entityManager.createEntityInstance(connectionDef.id);

        if (!playerEntity || !roomEntity) {
            throw new Error('Failed to create player or room entity instance.');
        }

        // 4. Spy on Formatter (before creating ActionDiscoverySystem)
        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');

        // NOTE: isValidMock setup is deferred to individual tests
        // based on the specific validation behavior needed for that test.

        mockGetEntityIdsForScopesFn.mockClear();
        mockGetEntityIdsForScopesFn.mockReturnValue(new Set()); // Default: return empty set

        // 5. Instantiate System Under Test
        // We pass the REAL validation service instance here. The spy will be attached
        // to this instance's 'isValid' method within each test.
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService: realActionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatSpy,
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn // <<< ADDED DEPENDENCY
        });
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore all mocks after each test
    });

    // --- Test Case 1: Verify Skipping Based on Logs ---
    it('should call validation twice but not formatter when action domain requires a specific target', async () => {
        // --- Arrange ---
        const actionContext = {playerEntity, currentLocation: roomEntity, entityManager, gameDataRepository};

        const realIsValidImplementation = realActionValidationService.isValid.bind(realActionValidationService);
        isValidMock = jest.spyOn(realActionValidationService, 'isValid')
            .mockImplementation((actionDef, actor, targetContext) => {
                // For the initial check ('none' context), let the real logic run (it passes)
                if (targetContext.type === 'none' && actionDef.id === 'core:go') {
                    // console.log('>>> TEST 1: Mock allowing real call for initial check');
                    return realIsValidImplementation(actionDef, actor, targetContext);
                }
                // For the specific direction check ('north'), force it to FAIL for this test's purpose
                if (targetContext.type === 'direction' && targetContext.direction === 'north' && actionDef.id === 'core:go') {
                    // console.log('>>> TEST 1: Mock forcing direction check to FALSE');
                    return false; // Force failure to prevent formatter call
                }
                // Fallback for any other unexpected calls (though none are expected here)
                // console.log('>>> TEST 1: Mock allowing real call for unexpected case');
                return realIsValidImplementation(actionDef, actor, targetContext);
            });

        // --- Act ---
        await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // 1. Verify isValid was called twice
        expect(isValidMock).toHaveBeenCalledTimes(2);

        // Check arguments for the first call (noTarget)
        expect(isValidMock).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}),
            playerEntity,
            ActionTargetContext.noTarget()
        );

        // Check arguments for the second call (direction)
        expect(isValidMock).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}),
            playerEntity,
            ActionTargetContext.forDirection('north')
        );

        // 2. Verify formatter was NOT called because we forced the second validation to fail.
        expect(formatSpy).not.toHaveBeenCalled(); // This should now pass
    });

    // --- Test Case 2: Force Validation Success to Test Formatter Call ---
    it('should call the formatter with correct arguments when validation is mocked to pass for a direction', async () => {
        // --- Arrange ---
        const actionContext = {playerEntity, currentLocation: roomEntity, entityManager, gameDataRepository};
        const expectedDirectionContext = ActionTargetContext.forDirection('north');

        // Spy and MOCK the implementation to FORCE the desired validation results
        isValidMock = jest.spyOn(realActionValidationService, 'isValid')
            .mockImplementation((actionDef, actor, targetContext) => {
                // Force initial check to PASS to prevent 'continue'
                if (targetContext.type === 'none' && actionDef.id === 'core:go') {
                    // console.log(">>> TEST 2: Mocking initial check to TRUE");
                    return true;
                }
                // Force direction check for 'north' to PASS
                if (targetContext.type === 'direction' && targetContext.direction === 'north' && actionDef.id === 'core:go') {
                    // console.log(">>> TEST 2: Mocking 'north' direction check to TRUE");
                    return true;
                }
                // All other checks fail for simplicity in this specific test
                // console.log(`>>> TEST 2: Mocking other check (${actionDef.id}/${targetContext.type}) to FALSE`);
                return false;
            });

        // --- Act ---
        await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // 1. Verify isValid was called for initial check AND the direction check
        expect(isValidMock).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}),
            playerEntity,
            ActionTargetContext.noTarget()
        );
        expect(isValidMock).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}),
            playerEntity,
            expectedDirectionContext // Check for the specific 'north' direction context
        );
        // Potentially more calls depending on other actions/directions, but at least these two.

        // 2. Verify the formatter WAS called because the direction validation was mocked to true
        expect(formatSpy).toHaveBeenCalledTimes(1); // Should be called exactly once for 'north'
        expect(formatSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // The action definition
            expectedDirectionContext,                    // The exact context that passed validation
            entityManager                                // The entity manager
        );
    });
});
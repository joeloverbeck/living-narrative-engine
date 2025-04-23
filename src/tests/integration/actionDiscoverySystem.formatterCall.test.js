// src/tests/integration/actionDiscoverySystem.formatterCall.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies (Real Implementations) ---
import EntityManager from '../../entities/entityManager.js';
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import {ActionValidationService} from '../../services/actionValidationService.js'; // Import the real service
import {ActionTargetContext} from "../../models/actionTargetContext.js";
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js';
import Entity from '../../entities/entity.js';
// Import checkers needed by ActionValidationService's dependencies OR directly
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js'; // Needed by AVS constructor

// --- Functions used by SUT ---
import * as actionFormatter from '../../services/actionFormatter.js'; // Import module to spy

// --- Mocked Dependencies ---
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
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
        if (locationId === 'demo:room_entrance') {
            return new Set(['core:player']);
        }
        return new Set();
    }),
    buildIndex: jest.fn(),
    clearIndex: jest.fn(),
};

const mockGetEntityIdsForScopesFn = jest.fn();

// Mock for PrerequisiteChecker dependency (and now directly for ActionValidationService)
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn().mockReturnValue(true), // Assume prerequisites pass by default unless overridden
};

// --- ADD MOCK FOR THE MISSING FUNCTION DEPENDENCY for ActionValidationService ---
const mockCreateActionValidationContext = jest.fn((actor, targetCtx, entityManager, logger) => {
    // Return a basic context structure sufficient for the tests.
    // Adjust if your prerequisite logic needs more detail.
    const context = {
        actor: {id: actor.id, components: actor.getAllComponents()}, // Example structure
        target: null,
        // Add more details based on what your actual function does and prerequisites test.
    };
    if (targetCtx.type === 'entity' && targetCtx.entityId) {
        const targetEntity = entityManager.getEntityInstance(targetCtx.entityId);
        context.target = {id: targetCtx.entityId, components: targetEntity?.getAllComponents() || {}};
    } else if (targetCtx.type === 'direction' && targetCtx.direction) {
        context.target = {type: 'direction', value: targetCtx.direction};
    }
    // console.log('>>> mockCreateActionValidationContext called, returning:', JSON.stringify(context));
    return context;
});
// --- END ADD ---

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
        "Connections": {
            "connections": {
                "north": {
                    "connectionEntityId": "demo:conn_entrance_hallway",
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
        "Inventory": {"items": []},
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
    // Keep prerequisites potentially empty, as ActionValidationService needs the property
    "prerequisites": [],
    "template": "go {direction}",
};


// --- Test Suite ---
describe('ActionDiscoverySystem Integration Test - Formatter Call Scenarios', () => {

    let registry;
    let gameDataRepository;
    let entityManager;
    let realActionValidationService; // Instance of the real service
    let actionDiscoverySystem;
    let playerEntity;
    let roomEntity;

    // Spies/Mocks needed across tests
    let formatSpy;
    let isValidMock; // To spy on realActionValidationService.isValid

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test

        // 1. Instantiate Core Services & Dependencies
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger);
        entityManager = new EntityManager(
            registry,
            mockValidator,
            mockLogger,
            mockSpatialIndexManager
        );

        // Instantiate REAL Checkers needed by ActionValidationService *or its dependencies*
        // Note: These are not directly passed to AVS constructor anymore based on its definition
        // const componentRequirementChecker = new ComponentRequirementChecker({logger: mockLogger});
        const domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger}); // This one IS needed
        // const prerequisiteChecker = new PrerequisiteChecker({ // This is NOT directly needed by AVS constructor
        //     jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        //     entityManager: entityManager,
        //     logger: mockLogger
        // });

        // Instantiate the REAL ActionValidationService - PASS THE CORRECT DEPENDENCIES
        // based on the ActionValidationService constructor definition provided
        realActionValidationService = new ActionValidationService({
            entityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker, // Pass the instance created above
            jsonLogicEvaluationService: mockJsonLogicEvaluationService, // Pass the mock defined earlier
            createActionValidationContextFunction: mockCreateActionValidationContext // Pass the new mock function
        });

        // 2. Load Definitions into Registry
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('entities', roomDef.id, roomDef);
        registry.store('entities', connectionDef.id, connectionDef);

        // 3. Create Entity Instances
        playerEntity = entityManager.createEntityInstance(playerDef.id);
        roomEntity = entityManager.createEntityInstance(roomDef.id);
        if (!playerEntity || !roomEntity) {
            throw new Error('Failed to create player or room entity instance.');
        }

        // 4. Spy on Formatter (before creating ActionDiscoverySystem)
        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');

        // 5. Mock getEntityIdsForScopesFn (used by ActionDiscoverySystem)
        mockGetEntityIdsForScopesFn.mockClear();
        mockGetEntityIdsForScopesFn.mockReturnValue(new Set()); // Default: return empty set

        // 6. Instantiate System Under Test (ActionDiscoverySystem)
        // Pass the correctly instantiated realActionValidationService
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService: realActionValidationService, // Use the instance created above
            logger: mockLogger,
            formatActionCommandFn: formatSpy, // Pass the spy directly as the function dependency
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn
        });

        // NOTE: isValidMock setup is deferred to individual tests
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore all mocks after each test
    });

    // --- Test Case 1: Verify Skipping Based on Validation Failure ---
    it('should call validation twice but not formatter when action domain requires a specific target and validation fails for target', async () => {
        // --- Arrange ---
        const actionContext = {playerEntity, currentLocation: roomEntity, entityManager, gameDataRepository};

        // Use the real implementation for binding 'this' correctly
        const realIsValidImplementation = realActionValidationService.isValid.bind(realActionValidationService);

        // Spy on the isValid method AFTER the instance is created and available
        isValidMock = jest.spyOn(realActionValidationService, 'isValid')
            .mockImplementation((actionDef, actor, targetContext) => {
                // Log calls to the mock for debugging test flow
                // console.log(`>>> MOCK isValid called [Test 1]: action='${actionDef.id}', ctxType='${targetContext.type}', target='${targetContext.entityId ?? targetContext.direction ?? 'none'}'`);

                // For the initial check ('none' context), let the real logic run.
                // Assumes the actionDef has no actor requirements/prereqs that would fail here.
                if (targetContext.type === 'none' && actionDef.id === 'core:go') {
                    // console.log('>>> TEST 1: Mock allowing real call for initial check');
                    return realIsValidImplementation(actionDef, actor, targetContext);
                }
                // For the specific direction check ('north'), force it to FAIL for this test's purpose.
                if (targetContext.type === 'direction' && targetContext.direction === 'north' && actionDef.id === 'core:go') {
                    // console.log('>>> TEST 1: Mock forcing direction check to FALSE');
                    return false; // Force failure to prevent formatter call
                }
                // Fallback for any other unexpected calls (e.g., other directions if they existed)
                // console.log('>>> TEST 1: Mock allowing real call for unexpected case');
                return realIsValidImplementation(actionDef, actor, targetContext); // Or return false if preferred
            });

        // --- Act ---
        await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // 1. Verify isValid was called twice (once for 'none', once for 'north')
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
        expect(formatSpy).not.toHaveBeenCalled();

        // Optional: Check if context creator was called (likely once by the first real isValid call)
        // Depends on ActionValidationService internal logic regarding empty prerequisites array.
        // If actionDef.prerequisites is [], it might optimize out the call.
        // expect(mockCreateActionValidationContext).toHaveBeenCalledTimes(1);
    });

    // --- Test Case 2: Force Validation Success to Test Formatter Call ---
    it('should call the formatter with correct arguments when validation is mocked to pass for a direction', async () => {
        // --- Arrange ---
        const actionContext = {playerEntity, currentLocation: roomEntity, entityManager, gameDataRepository};
        const expectedDirectionContext = ActionTargetContext.forDirection('north');

        // Spy and MOCK the implementation to FORCE the desired validation results
        isValidMock = jest.spyOn(realActionValidationService, 'isValid')
            .mockImplementation((actionDef, actor, targetContext) => {
                // Log calls to the mock for debugging test flow
                // console.log(`>>> MOCK isValid called [Test 2]: action='${actionDef.id}', ctxType='${targetContext.type}', target='${targetContext.entityId ?? targetContext.direction ?? 'none'}'`);

                // Force initial check to PASS to prevent 'continue' in ActionDiscoverySystem
                if (targetContext.type === 'none' && actionDef.id === 'core:go') {
                    // console.log(">>> TEST 2: Mocking initial check to TRUE");
                    return true;
                }
                // Force direction check for 'north' to PASS to trigger formatter call
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
        // Should have been called exactly twice in this scenario (none, north)
        expect(isValidMock).toHaveBeenCalledTimes(2);

        // 2. Verify the formatter WAS called because the direction validation was mocked to true
        expect(formatSpy).toHaveBeenCalledTimes(1); // Called exactly once for 'north'
        expect(formatSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // The action definition
            expectedDirectionContext,                    // The exact context that passed validation
            entityManager,                               // The entity manager
            // If formatActionCommand takes an options object, match it if necessary
            // expect.any(Object) or { debug: false } etc.
        );
    });
});
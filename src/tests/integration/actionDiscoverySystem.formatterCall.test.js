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
import {PrerequisiteEvaluationService} from '../../services/prerequisiteEvaluationService.js'; // Real PES
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js'; // Real Checker
import {ActionValidationContextBuilder} from '../../services/actionValidationContextBuilder.js'; // <<< CORRECT: Import Real Builder

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

// Mock for JsonLogicEvaluationService (dependency of PrerequisiteEvaluationService)
const mockJsonLogicEvaluationService = {
    evaluate: jest.fn().mockReturnValue(true), // Assume prerequisites pass by default unless overridden
};

// --- REMOVED mockCreateActionValidationContext - Obsolete Dependency ---

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
                "north": "demo:conn_entrance_hallway"
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
    "prerequisites": [],
    "template": "go {direction}",
};


// --- Test Suite ---
describe('ActionDiscoverySystem Integration Test - Formatter Call Scenarios', () => {

    let registry;
    let gameDataRepository;
    let entityManager;
    let actionValidationContextBuilder; // <<< CORRECT: Added declaration
    let prerequisiteEvaluationService;
    let realActionValidationService; // Instance of the real service
    let actionDiscoverySystem;
    let playerEntity;
    let roomEntity;
    let connectionEntity;

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

        // Instantiate REAL Checkers/Builders needed by dependencies
        const domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});
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

        // Instantiate the REAL ActionValidationService
        // <<< CORRECT: Remove obsolete createActionValidationContextFunction dependency >>>
        realActionValidationService = new ActionValidationService({
            entityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker,
            prerequisiteEvaluationService: prerequisiteEvaluationService // Pass the correctly instantiated PES
        });

        // 2. Load Definitions into Registry
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('locations', roomDef.id, roomDef);
        registry.store('connections', connectionDef.id, connectionDef);

        // 3. Create Entity Instances
        playerEntity = entityManager.createEntityInstance(playerDef.id);
        roomEntity = entityManager.createEntityInstance(roomDef.id);
        connectionEntity = entityManager.createEntityInstance(connectionDef.id);

        if (!playerEntity || !roomEntity || !connectionEntity) {
            console.error("Player:", playerEntity, "Room:", roomEntity, "Connection:", connectionEntity);
            throw new Error('Failed to create player, room or connection entity instance.');
        }

        // 4. Spy on Formatter (before creating ActionDiscoverySystem)
        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');

        // 5. Mock getEntityIdsForScopesFn (used by ActionDiscoverySystem)
        mockGetEntityIdsForScopesFn.mockClear();
        mockGetEntityIdsForScopesFn.mockReturnValue(new Set()); // Default: return empty set

        // 6. Instantiate System Under Test (ActionDiscoverySystem)
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService: realActionValidationService, // Use the real AVS instance
            logger: mockLogger,
            formatActionCommandFn: formatSpy,
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
                // For the initial check ('none' context), let the real logic run.
                if (targetContext.type === 'none' && actionDef.id === 'core:go') {
                    return realIsValidImplementation(actionDef, actor, targetContext);
                }
                // For the specific direction check ('north'), force it to FAIL for this test's purpose.
                if (targetContext.type === 'direction' && targetContext.direction === 'north' && actionDef.id === 'core:go') {
                    return false; // Force failure to prevent formatter call
                }
                // Fallback for any other unexpected calls
                return realIsValidImplementation(actionDef, actor, targetContext);
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

    });

    // --- Test Case 2: Force Validation Success to Test Formatter Call ---
    it('should call the formatter with correct arguments when validation is mocked to pass for a direction', async () => {
        // --- Arrange ---
        const actionContext = {playerEntity, currentLocation: roomEntity, entityManager, gameDataRepository};
        const expectedDirectionContext = ActionTargetContext.forDirection('north');

        // Spy and MOCK the implementation to FORCE the desired validation results
        isValidMock = jest.spyOn(realActionValidationService, 'isValid')
            .mockImplementation((actionDef, actor, targetContext) => {
                // Force initial check to PASS to prevent 'continue' in ActionDiscoverySystem
                if (targetContext.type === 'none' && actionDef.id === 'core:go') {
                    return true;
                }
                // Force direction check for 'north' to PASS to trigger formatter call
                if (targetContext.type === 'direction' && targetContext.direction === 'north' && actionDef.id === 'core:go') {
                    return true;
                }
                // All other checks fail for simplicity in this specific test
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
        expect(isValidMock).toHaveBeenCalledTimes(2);

        // 2. Verify the formatter WAS called because the direction validation was mocked to true
        expect(formatSpy).toHaveBeenCalledTimes(1); // Called exactly once for 'north'
        expect(formatSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // The action definition
            expectedDirectionContext,                    // The exact context that passed validation
            entityManager                               // The entity manager
            // Add options object check if needed based on formatter signature
        );
    });
});

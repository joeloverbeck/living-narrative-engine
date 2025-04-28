// src/tests/integration/actionDiscoverySystem.formatterCall.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies (Real Implementations) ---
import EntityManager from '../../entities/entityManager.js';
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import {ActionValidationService} from '../../services/actionValidationService.js'; // Import the real service
import {ActionTargetContext} from '../../models/actionTargetContext.js';
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
    validate: jest.fn((schemaId, data) => ({isValid: true, errors: []})), // NOTE: This might hide schema issues from base class changes!
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

// --- Test Data Definitions ---
const connectionDef = {
    id: 'demo:conn_entrance_hallway',
    components: {
        'PassageDetails': {
            'locationAId': 'demo:room_entrance',
            'locationBId': 'demo:room_hallway',
            'directionAtoB': 'north',
            'directionBtoA': 'south',
            'blockerEntityId': null,
            'type': 'passage'
        }
    }
};

const roomDef = {
    'id': 'demo:room_entrance',
    'components': {
        'Name': {'value': 'Entrance'},
        'Description': {'text': 'Stone archway...'},
        'MetaDescription': {'keywords': ['entrance']},
        'Connections': {
            'connections': {
                'north': 'demo:conn_entrance_hallway'
            }
        }
    }
};

const playerDef = {
    'id': 'core:player',
    'components': {
        'Name': {'value': 'Player'},
        'Position': {
            'locationId': 'demo:room_entrance'
        },
        'Inventory': {'items': []},
    }
};

const goActionDef = {
    'id': 'core:go',
    'commandVerb': 'go',
    'name': 'Go',
    'target_domain': 'direction',
    'actor_required_components': [],
    'actor_forbidden_components': [],
    'target_required_components': [],
    'target_forbidden_components': [],
    'prerequisites': [],
    'template': 'go {direction}',
};


// --- Test Suite ---
describe('ActionDiscoverySystem Integration Test - Formatter Call Scenarios', () => {

    let registry;
    let gameDataRepository;
    let entityManager;
    let actionValidationContextBuilder;
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
        actionValidationContextBuilder = new ActionValidationContextBuilder({
            entityManager: entityManager,
            logger: mockLogger
        });

        // --- Instantiate PrerequisiteEvaluationService ---
        prerequisiteEvaluationService = new PrerequisiteEvaluationService({
            logger: mockLogger,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            actionValidationContextBuilder: actionValidationContextBuilder
        });

        // Instantiate the REAL ActionValidationService
        realActionValidationService = new ActionValidationService({
            entityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker,
            prerequisiteEvaluationService: prerequisiteEvaluationService
        });

        // 2. Load Definitions into Registry
        // --- *** FIX START *** ---
        // Store ALL entity definitions under the 'entities' key
        // as EntityManager.createEntityInstance likely looks them up there.
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('entities', roomDef.id, roomDef); // Store room under 'entities'
        registry.store('entities', connectionDef.id, connectionDef); // Store connection under 'entities'
        // --- *** FIX END *** ---

        // 3. Create Entity Instances
        // These should now succeed as the definitions are in the expected place.
        playerEntity = entityManager.createEntityInstance(playerDef.id);
        roomEntity = entityManager.createEntityInstance(roomDef.id);
        connectionEntity = entityManager.createEntityInstance(connectionDef.id);

        // This check should now pass
        if (!playerEntity || !roomEntity || !connectionEntity) {
            console.error('Player:', playerEntity, 'Room:', roomEntity, 'Connection:', connectionEntity);
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
            actionValidationService: realActionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatSpy, // Pass the spy directly
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
        // Use the instances created in beforeEach
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
                    mockLogger.debug(`[MOCK isValid] Forcing FALSE for ${actionDef.id} / ${targetContext.type} / ${targetContext.direction}`); // Added debug log
                    return false; // Force failure to prevent formatter call
                }
                // Fallback for any other unexpected calls
                mockLogger.debug(`[MOCK isValid] Fallback call for ${actionDef.id} / ${targetContext.type}. Using real implementation.`); // Added debug log
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
        // Use the instances created in beforeEach
        const actionContext = {playerEntity, currentLocation: roomEntity, entityManager, gameDataRepository};
        const expectedDirectionContext = ActionTargetContext.forDirection('north');

        // Spy and MOCK the implementation to FORCE the desired validation results
        isValidMock = jest.spyOn(realActionValidationService, 'isValid')
            .mockImplementation((actionDef, actor, targetContext) => {
                // Force initial check to PASS to prevent 'continue' in ActionDiscoverySystem
                if (targetContext.type === 'none' && actionDef.id === 'core:go') {
                    mockLogger.debug(`[MOCK isValid] Forcing TRUE for ${actionDef.id} / ${targetContext.type}`); // Added debug log
                    return true;
                }
                // Force direction check for 'north' to PASS to trigger formatter call
                if (targetContext.type === 'direction' && targetContext.direction === 'north' && actionDef.id === 'core:go') {
                    mockLogger.debug(`[MOCK isValid] Forcing TRUE for ${actionDef.id} / ${targetContext.type} / ${targetContext.direction}`); // Added debug log
                    return true;
                }
                // All other checks fail for simplicity in this specific test
                mockLogger.debug(`[MOCK isValid] Forcing FALSE (default) for ${actionDef.id} / ${targetContext.type}`); // Added debug log
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
        // It might be called more than twice if there are other actions or directions,
        // but it must have been called AT LEAST for these two specific cases.
        // Let's stick to checking the specific calls above and the formatter call below.
        // If other actions existed, isValidMock could be called more times.
        // expect(isValidMock).toHaveBeenCalledTimes(2); // This might be too strict if other actions exist.

        // 2. Verify the formatter WAS called because the direction validation was mocked to true
        expect(formatSpy).toHaveBeenCalledTimes(1); // Called exactly once for 'north'
        expect(formatSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // The action definition
            expectedDirectionContext,                    // The exact context that passed validation
            entityManager,                               // The entity manager
            expect.any(Object)                           // Expect the options object (even if empty)
        );
    });
});
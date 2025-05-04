// src/tests/integration/actionDiscoverySystem.openPassage.test.js
// --- FILE START (Entire file content as requested) ---

import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies (Real Implementations) ---
import EntityManager from '../../entities/entityManager.js';
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import {ActionValidationService} from '../../services/actionValidationService.js';
import {ActionTargetContext} from '../../models/actionTargetContext.js';
import InMemoryDataRegistry from '../../core/services/inMemoryDataRegistry.js';
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js'; // Real Checker
import {PrerequisiteEvaluationService} from '../../services/prerequisiteEvaluationService.js'; // Real PES
import {ActionValidationContextBuilder} from '../../services/actionValidationContextBuilder.js'; // Real Builder

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

// --- Test Data Definitions ---
// NOTE: These are definition OBJECTS, not instances yet.
const connectionDef = {
    id: 'demo:conn_entrance_hallway',
    // --- Added basic Name/Desc for potential display/validation ---
    name: "Passage North",
    description: "A passage leading north.",
    // --- Keep components specific to the connection ---
    components: {
        'PassageDetails': {
            'locationAId': 'demo:room_entrance',
            'locationBId': 'demo:room_hallway',
            'directionAtoB': 'north',
            'directionBtoA': 'south',
            'blockerEntityId': null,
            'type': 'passage'
        }
        // Connections might also have state like 'Openable' or 'Lockable'
        // 'Openable': { 'isOpen': true }
    }
};

const roomDef = {
    'id': 'demo:room_entrance',
    // --- Added Type explicitly if needed by EM/validation ---
    'type': 'location',
    'components': {
        'Name': {'value': 'Entrance'},
        'Description': {'text': 'Stone archway...'},
        'MetaDescription': {'keywords': ['entrance']},
        'Connections': {
            'connections': {
                'north': 'demo:conn_entrance_hallway' // ID of the connection definition/entity
            }
        }
        // Locations might have other components like 'ItemsPresent', 'NPCsPresent' etc.
    }
};

const playerDef = {
    'id': 'core:player',
    'type': 'character', // Added type for clarity
    'components': {
        'Name': {'value': 'Player'},
        // --- Standardized component names (assuming case sensitivity matters) ---
        'Position': { // Changed from 'Position' to 'Position' if needed
            'locationId': 'demo:room_entrance'
        },
        'Health': {'current': 10, 'max': 10},
        'Inventory': {'items': []},
        'Stats': {
            'attributes': {
                'core:attr_strength': 8,
                'core:attr_agility': 10,
                'core:attr_intelligence': 10,
                'core:attr_constitution': 9
            }
        },
        'Attack': {'damage': 3},
        'Equipment': {'slots': {}},
        'QuestLog': {},
        // --- ADDED Core Player Component needed by registry.getStartingPlayerId ---
        'core:player': {}
    }
};

const goActionDef = {
    'id': 'core:go',
    'commandVerb': 'go',
    'name': 'Go',
    'target_domain': 'direction',
    'actor_required_components': [],
    'actor_forbidden_components': [],
    'target_required_components': [], // Directions don't have components
    'target_forbidden_components': [],
    'prerequisites': [], // Assume no prereqs for simple go
    'template': 'go {direction}', // Make sure template matches expected output
};

// --- Test Suite ---
describe('ActionDiscoverySystem Integration Test - Go North', () => {

    let registry;
    let gameDataRepository;
    let entityManager;
    let actionValidationContextBuilder;
    let prerequisiteEvaluationService;
    let actionValidationService; // Real AVS instance
    let actionDiscoverySystem;
    let playerEntity;
    let roomEntity;
    let connectionEntity;
    let actionContext;
    let formatSpy;

    let domainContextCompatibilityChecker; // Real Checker instance

    beforeEach(async () => { // Mark beforeEach as async if needed, though not strictly required by current code
        jest.clearAllMocks();

        // 1. Instantiate Core Services & Mocks
        registry = new InMemoryDataRegistry();
        gameDataRepository = new GameDataRepository(registry, mockLogger);
        entityManager = new EntityManager(registry, mockValidator, mockLogger, mockSpatialIndexManager);

        // Instantiate REAL Checkers/Builders needed by dependencies
        domainContextCompatibilityChecker = new DomainContextCompatibilityChecker({logger: mockLogger});
        actionValidationContextBuilder = new ActionValidationContextBuilder({
            entityManager: entityManager,
            logger: mockLogger
        });

        prerequisiteEvaluationService = new PrerequisiteEvaluationService({
            logger: mockLogger,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            actionValidationContextBuilder: actionValidationContextBuilder
        });

        actionValidationService = new ActionValidationService({
            entityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker,
            prerequisiteEvaluationService: prerequisiteEvaluationService
        });

        mockGetEntityIdsForScopesFn.mockClear();
        mockGetEntityIdsForScopesFn.mockReturnValue(new Set()); // Default: return empty set

        formatSpy = jest.spyOn(actionFormatter, 'formatActionCommand');
        // --- MOCK IMPLEMENTATION FOR formatSpy to return the formatted string ---
        // This ensures the spy behaves like the real function for this test case
        formatSpy.mockImplementation((actionDef, targetContext, entityManager, options) => {
            if (actionDef.id === 'core:go' && targetContext.type === 'direction') {
                // Basic template replacement for the test
                return actionDef.template.replace('{direction}', targetContext.direction);
            }
            // Fallback or handle other cases if necessary
            return null;
        });
        // --- END MOCK IMPLEMENTATION ---


        // Instantiate the System Under Test (ActionDiscoverySystem)
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatSpy, // Use the spy (with mock implementation)
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn // Ensure this is injected
        });

        // 2. Load Test Definitions into the registry
        registry.store('actions', goActionDef.id, goActionDef);
        registry.store('entities', playerDef.id, playerDef);
        registry.store('entities', roomDef.id, roomDef);
        registry.store('entities', connectionDef.id, connectionDef);

        // 3. Create Entity Instances from definitions
        playerEntity = entityManager.createEntityInstance('core:player');
        roomEntity = entityManager.createEntityInstance('demo:room_entrance');
        connectionEntity = entityManager.createEntityInstance('demo:conn_entrance_hallway');

        if (!playerEntity || !roomEntity || !connectionEntity) {
            console.error("Entity Instantiation Failure:", {
                player: !!playerEntity,
                room: !!roomEntity,
                connection: !!connectionEntity
            });
            console.error("Definitions as seen by registry.get('entities', id):", {
                playerDefFound: registry.get('entities', 'core:player'),
                roomDefFound: registry.get('entities', 'demo:room_entrance'),
                connectionDefFound: registry.get('entities', 'demo:conn_entrance_hallway')
            });
            throw new Error('Failed to instantiate core entities for the test.');
        }

        mockSpatialIndexManager.addEntity(playerEntity, playerEntity.getComponentData('Position')?.locationId);

        const playerPosData = playerEntity.getComponentData('Position');
        const roomConnData = roomEntity.getComponentData('Connections');
        const connDetailsData = connectionEntity.getComponentData('PassageDetails');

        if (!playerPosData || !roomConnData || !connDetailsData) {
            console.error('Player Pos Data:', playerPosData);
            console.error('Room Conn Data:', roomConnData);
            console.error('Conn Details Data:', connDetailsData);
            throw new Error('Core component data missing from instantiated entities.');
        }
        expect(playerPosData.locationId).toBe('demo:room_entrance');
        expect(roomConnData.connections?.north).toBe('demo:conn_entrance_hallway');
        expect(connDetailsData.blockerEntityId).toBeNull();


        // 4. Build Action Context required by ActionDiscoverySystem.getValidActions
        // --- CORRECTED ActionContext ---
        // Match the structure expected by ActionDiscoverySystem.getValidActions
        actionContext = {
            actor: playerEntity, // The performing entity instance
            currentLocation: roomEntity, // The location entity instance
            // Pass other dependencies if needed by validation/formatting downstream
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            logger: mockLogger,
            worldContext: null, // Mock or provide real if needed by dependencies
            // Removed properties not directly part of the ActionContext type used by getValidActions
            // eventBus: null,
            // dispatch: jest.fn(),
            // parsedCommand: null,
        };
        // --- END CORRECTION ---
    });


    it('should discover "go north" as a valid action when player is in entrance and passage is open', async () => {
        // Arrange
        // Mock isValid to pass the checks relevant to discovering 'go north'
        const isValidSpy = jest.spyOn(actionValidationService, 'isValid').mockImplementation(
            (actionDef, actor, targetContext) => {
                // Pass initial actor check
                if (targetContext.type === 'none' && actionDef.id === 'core:go') return true;
                // Pass specific direction check for 'north'
                if (actionDef.id === 'core:go' && targetContext.type === 'direction' && targetContext.direction === 'north') {
                    return true;
                }
                // Fail other checks for this specific test scenario
                return false;
            }
        );

        // --- Act ---
        // --- Use the CORRECTED action context variable name ---
        const validActions = await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);

        // --- *** FIX APPLIED HERE *** ---
        // Check if the array contains an OBJECT matching the expected structure
        expect(validActions).toContainEqual({
            id: 'core:go',
            command: 'go north'
        });
        // --- *** END FIX *** ---

        // Optionally check length if only one action is expected
        expect(validActions).toHaveLength(1);

        expect(mockLogger.error).not.toHaveBeenCalled();

        isValidSpy.mockRestore(); // Clean up spy
    });

    it('should correctly identify the direction and call validation service with the right context', async () => {
        // Arrange
        const isValidSpy = jest.spyOn(actionValidationService, 'isValid').mockReturnValue(true); // Mock to always return true

        // --- Act ---
        // --- Use the CORRECTED action context variable name ---
        await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // Expect initial actor check (target = none)
        expect(isValidSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}),
            playerEntity,
            expect.objectContaining({type: 'none'})
        );

        // Expect check for the specific direction 'north'
        expect(isValidSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}),
            playerEntity,
            expect.objectContaining({
                type: 'direction',
                direction: 'north',
                entityId: null
            })
        );

        // Verify it wasn't called for other directions
        expect(isValidSpy).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({type: 'direction', direction: 'south'}) // Assuming room only connects north
        );

        // Expect total calls: initial check (1) + direction check (1) = 2
        expect(isValidSpy).toHaveBeenCalledTimes(2);

        isValidSpy.mockRestore(); // Clean up the spy
    });
});
// --- FILE END ---
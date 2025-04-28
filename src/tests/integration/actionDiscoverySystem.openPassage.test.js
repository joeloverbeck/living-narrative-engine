// src/tests/integration/actionDiscoverySystem.openPassage.test.js

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

        // Instantiate the System Under Test (ActionDiscoverySystem)
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository,
            entityManager,
            actionValidationService,
            logger: mockLogger,
            formatActionCommandFn: formatSpy,
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn // Ensure this is injected
        });

        // 2. Load Test Definitions into the registry
        // *** CORRECTED STORAGE TYPE FOR INSTANTIATION ***
        // Store ALL definitions needed for createEntityInstance under 'entities'.
        // EntityManager likely only looks in 'entities' when creating instances.
        // Other services might use specific getters like getAllLocationDefinitions later.
        registry.store('actions', goActionDef.id, goActionDef); // Actions have their own type
        registry.store('entities', playerDef.id, playerDef);
        registry.store('entities', roomDef.id, roomDef);           // Store location under 'entities'
        registry.store('entities', connectionDef.id, connectionDef); // Store connection under 'entities'

        // 3. Create Entity Instances from definitions
        playerEntity = entityManager.createEntityInstance('core:player');
        roomEntity = entityManager.createEntityInstance('demo:room_entrance');
        connectionEntity = entityManager.createEntityInstance('demo:conn_entrance_hallway');

        // --- Error Check: Ensure instances were created ---
        if (!playerEntity || !roomEntity || !connectionEntity) {
            // Log which ones failed if possible
            console.error("Entity Instantiation Failure:", {
                player: !!playerEntity,
                room: !!roomEntity,
                connection: !!connectionEntity
            });
            // Attempt to log definitions retrieved by EntityManager's likely lookup method
            console.error("Definitions as seen by registry.get('entities', id):", {
                playerDefFound: registry.get('entities', 'core:player'),
                roomDefFound: registry.get('entities', 'demo:room_entrance'),
                connectionDefFound: registry.get('entities', 'demo:conn_entrance_hallway')
            });
            throw new Error('Failed to instantiate core entities for the test.'); // <<< THIS IS LINE 184 (approx)
        }

        // 3b. Add entities to spatial index (might be important for some scope lookups)
        // We mock getEntitiesInLocation, but adding might be good practice
        mockSpatialIndexManager.addEntity(playerEntity, playerEntity.getComponentData('Position')?.locationId);
        // Rooms and connections might not be added explicitly depending on index design

        // 3c. Initial setup checks for component data AFTER ensuring instances exist
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
        actionContext = {
            playerEntity: playerEntity,
            currentLocation: roomEntity,
            entityManager: entityManager,
            gameDataRepository: gameDataRepository,
            eventBus: null, // Mock if needed
            dispatch: jest.fn(), // Mock if needed
            parsedCommand: null, // Usually null for discovery
            // Add other context properties if ActionDiscoverySystem or its dependencies need them
            logger: mockLogger, // Pass logger if needed down the line
        };
    });


    it('should discover "go north" as a valid action when player is in entrance and passage is open', async () => {
        // Arrange (Done in beforeEach)
        // Ensure the mock validation service passes the relevant check
        const isValidSpy = jest.spyOn(actionValidationService, 'isValid').mockImplementation(
            (actionDef, actor, targetContext) => {
                // Basic actor check passes
                if (targetContext.type === 'none') return true;
                // Specific direction check - pass only for 'north' with 'core:go'
                if (actionDef.id === 'core:go' && targetContext.type === 'direction' && targetContext.direction === 'north') {
                    return true;
                }
                // Fail other checks for this test
                return false;
            }
        );

        // --- Act ---
        const validActions = await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);
        // Check formatting: ensure the template was processed correctly
        expect(validActions).toContain('go north'); // Check for the final formatted string
        expect(mockLogger.error).not.toHaveBeenCalled();

        isValidSpy.mockRestore(); // Clean up spy
    });

    it('should correctly identify the direction and call validation service with the right context', async () => {
        // Arrange
        const isValidSpy = jest.spyOn(actionValidationService, 'isValid').mockReturnValue(true); // Mock to always return true for simplicity here

        // --- Act ---
        await actionDiscoverySystem.getValidActions(playerEntity, actionContext);

        // --- Assert ---
        // Expect initial actor check (target = none)
        expect(isValidSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // Action Def
            playerEntity, // Actor
            expect.objectContaining({type: 'none'}) // Initial Target Context (using ActionTargetContext.noTarget())
        );

        // Expect check for the specific direction 'north'
        expect(isValidSpy).toHaveBeenCalledWith(
            expect.objectContaining({id: 'core:go'}), // Action Def
            playerEntity, // Actor
            expect.objectContaining({ // The ActionTargetContext for the direction 'north'
                type: 'direction',
                direction: 'north',
                entityId: null // Explicitly null for direction context
            })
        );

        // Optional: Verify it wasn't called for other directions if room only has 'north'
        expect(isValidSpy).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({type: 'direction', direction: 'south'})
        );
        expect(isValidSpy).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({type: 'direction', direction: 'east'})
        );
        expect(isValidSpy).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({type: 'direction', direction: 'west'})
        );


        // Verify total call count - depends exactly how many actions/targets are processed
        // For only 'go' action and only 'north' direction in the room:
        // 1 call for actor check (target=none) + 1 call for direction (target=direction/north) = 2 calls
        // If there were other actions or directions, this count would increase.
        expect(isValidSpy).toHaveBeenCalledTimes(2); // Adjust if other actions/directions are processed

        isValidSpy.mockRestore(); // Clean up the spy
    });
});
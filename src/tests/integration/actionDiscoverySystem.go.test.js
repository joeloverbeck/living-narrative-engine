// src/tests/integration/actionDiscoverySystem.go.test.js
// --- FILE START ---

// --- Tell Jest to use Node environment ---
/**
 * @jest-environment node
 */

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies to Mock ---
import {GameDataRepository} from '../../core/services/gameDataRepository.js';
import EntityManager from '../../entities/entityManager.js';
import {ActionValidationService} from '../../services/actionValidationService.js';
import ConsoleLogger from '../../core/services/consoleLogger.js';
import {formatActionCommand as formatActionCommandFn} from '../../services/actionFormatter.js';
import {getEntityIdsForScopes as getEntityIdsForScopesFn} from '../../services/entityScopeService.js';

// --- Helper Mocks/Types ---
import {ActionTargetContext} from '../../models/actionTargetContext.js';
import Entity from '../../entities/entity.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";
// --- BEGIN FIX: Import EXITS_COMPONENT_ID ---
import {EXITS_COMPONENT_ID, POSITION_COMPONENT_ID} from '../../constants/componentIds.js';
// --- END FIX ---

/** @typedef {import('../../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../core/services/consoleLogger.js').default} ILogger */
/** @typedef {import('../../systems/actionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */

// --- Mocking Dependencies ---
jest.mock('../../core/services/gameDataRepository.js');
jest.mock('../../entities/entityManager.js');
jest.mock('../../services/actionValidationService.js');
jest.mock('../../core/services/consoleLogger.js');
jest.mock('../../services/actionFormatter.js');
jest.mock('../../services/entityScopeService.js');

// --- Test Suite ---
// --- BEGIN FIX: Update describe block title ---
describe('ActionDiscoverySystem - Go Action (Fixed State)', () => {
// --- END FIX ---
    /** @type {ActionDiscoverySystem} */
    let actionDiscoverySystem;
    /** @type {jest.Mocked<GameDataRepository>} */
    let mockGameDataRepo;
    /** @type {jest.Mocked<EntityManager>} */
    let mockEntityManager;
    /** @type {jest.Mocked<ActionValidationService>} */
    let mockValidationService;
    /** @type {jest.Mocked<ILogger>} */
    let mockLogger;
    /** @type {jest.MockedFunction<formatActionCommandFn>} */
    let mockFormatActionCommandFn;
    /** @type {jest.MockedFunction<getEntityIdsForScopesFn>} */
    let mockGetEntityIdsForScopesFn;

    /** @type {ActionDefinition} */
    const coreGoActionDefinition = {
        id: "core:go",
        commandVerb: "go",
        name: "Go",
        target_domain: "direction",
        prerequisites: [
            {
                logic: {
                    "==": [{"var": "target.blocker"}, null]
                },
                failure_message: "The way is blocked."
            }
        ],
        template: "go {direction}"
    };

    /** @type {ActionDefinition} */
    const coreWaitActionDefinition = {
        id: "core:wait",
        commandVerb: "wait",
        name: "Wait",
        target_domain: "none",
        prerequisites: [],
        template: "wait"
    };

    const heroEntityDefinition = {
        id: "isekai:hero",
        components: {
            "core:actor": {},
            "core:player": {},
            "core:name": {text: "Hero"},
            [POSITION_COMPONENT_ID]: {locationId: "isekai:adventurers_guild", x: 0, y: 0} // Use constant
        }
    };

    const adventurersGuildEntityDefinition = {
        id: "isekai:adventurers_guild",
        components: {
            "core:name": {text: "Adventurers' Guild"},
            "core:description": {text: "The local adventurers' guild."},
            [EXITS_COMPONENT_ID]: [ // Use constant and provide the actual exits data
                {direction: "out to town", target: "isekai:town", blocker: null}
            ]
        }
    };

    /** @type {Entity} */
    let mockHeroEntity;
    /** @type {Entity} */
    let mockAdventurersGuildLocation;
    /** @type {ActionContext} */
    let mockActionContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGameDataRepo = new GameDataRepository();
        mockEntityManager = new EntityManager();
        mockValidationService = new ActionValidationService();
        mockLogger = new ConsoleLogger();
        mockLogger.debug = jest.fn();
        mockLogger.info = jest.fn();
        mockLogger.warn = jest.fn();
        mockLogger.error = jest.fn();

        mockFormatActionCommandFn = /** @type {jest.MockedFunction<formatActionCommandFn>} */ (formatActionCommandFn);
        mockGetEntityIdsForScopesFn = /** @type {jest.MockedFunction<getEntityIdsForScopesFn>} */ (getEntityIdsForScopesFn);

        mockHeroEntity = new Entity(heroEntityDefinition.id, mockEntityManager);
        mockAdventurersGuildLocation = new Entity(adventurersGuildEntityDefinition.id, mockEntityManager);

        mockGameDataRepo.getAllActionDefinitions.mockReturnValue([coreWaitActionDefinition, coreGoActionDefinition]);

        mockEntityManager.getEntityInstance.mockImplementation(id => {
            if (id === heroEntityDefinition.id) return mockHeroEntity;
            if (id === adventurersGuildEntityDefinition.id) return mockAdventurersGuildLocation;
            return null;
        });

        // --- BEGIN FIX: Configure mockEntityManager to return core:exits data ---
        mockEntityManager.getComponentData.mockImplementation((entityId, componentTypeId) => {
            if (entityId === heroEntityDefinition.id) {
                if (componentTypeId === POSITION_COMPONENT_ID) {
                    return heroEntityDefinition.components[POSITION_COMPONENT_ID];
                }
            }
            if (entityId === adventurersGuildEntityDefinition.id) {
                if (componentTypeId === EXITS_COMPONENT_ID) {
                    // ActionDiscoverySystem (fixed) will request this
                    return adventurersGuildEntityDefinition.components[EXITS_COMPONENT_ID];
                }
                if (componentTypeId === 'core:name') { // Example other component
                    return adventurersGuildEntityDefinition.components['core:name'];
                }
            }
            return null;
        });
        // --- END FIX ---

        // --- BEGIN FIX: Configure mockValidationService for successful validation of 'go out to town' ---
        mockValidationService.isValid.mockImplementation((actionDef, actor, targetContext) => {
            if (actor.id !== heroEntityDefinition.id) return false;

            if (actionDef.id === 'core:wait') {
                return targetContext.type === 'none'; // Called twice
            }

            if (actionDef.id === 'core:go') {
                if (targetContext.type === 'none') { // Initial check
                    return true;
                }
                // Direction-specific check for "out to town"
                // This should now be called and should pass due to fixed ActionValidationContextBuilder
                if (targetContext.type === 'direction' && targetContext.direction === 'out to town') {
                    return true;
                }
            }
            return false;
        });
        // --- END FIX ---

        // --- BEGIN FIX: Configure mockFormatActionCommandFn for successful formatting ---
        mockFormatActionCommandFn.mockImplementation((actionDef, targetContext, _entityManager, _options) => {
            if (actionDef.id === 'core:wait' && targetContext.type === 'none') {
                return 'wait';
            }
            if (actionDef.id === 'core:go' && targetContext.type === 'direction' && targetContext.direction === 'out to town') {
                return 'go out to town'; // This should now be called
            }
            return null;
        });
        // --- END FIX ---

        mockGetEntityIdsForScopesFn.mockReturnValue(new Set());

        mockActionContext = {
            actor: mockHeroEntity,
            currentLocation: mockAdventurersGuildLocation,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepo,
            logger: mockLogger,
            worldContext: /** @type {any} */ ({}),
        };

        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository: mockGameDataRepo,
            entityManager: mockEntityManager,
            actionValidationService: mockValidationService,
            logger: mockLogger,
            formatActionCommandFn: mockFormatActionCommandFn,
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn
        });
    });

    // --- BEGIN FIX: Update test case title and assertions ---
    it('should discover "go out to town" action when player is in adventurers guild and exit is available', async () => {
        // --- END FIX ---
        // Act
        /** @type {DiscoveredActionInfo[]} */
        const validActions = await actionDiscoverySystem.getValidActions(mockHeroEntity, mockActionContext);

        // Assert
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);

        const waitAction = {id: 'core:wait', command: 'wait'};
        const goAction = {id: 'core:go', command: 'go out to town'};

        expect(validActions).toContainEqual(waitAction);
        // --- BEGIN FIX: Expect "go out to town" to BE present ---
        expect(validActions).toContainEqual(goAction);
        // --- END FIX ---

        // --- BEGIN FIX: Update logger assertions for corrected behavior ---
        // The system now looks for EXITS_COMPONENT_ID and finds data
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Checking exits data (component ${EXITS_COMPONENT_ID}) for location: ${adventurersGuildEntityDefinition.id}`,
            adventurersGuildEntityDefinition.components[EXITS_COMPONENT_ID] // Expect the actual exits data
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Found ${adventurersGuildEntityDefinition.components[EXITS_COMPONENT_ID].length} potential exits from ${EXITS_COMPONENT_ID}. Checking validation...`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `    -> Processing exit direction: out to town`
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `    * Found valid action (direction: out to town): go out to town (ID: core:go)`
        );
        // --- END FIX ---

        // Verify interactions
        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(adventurersGuildEntityDefinition.id, EXITS_COMPONENT_ID);

        // --- BEGIN FIX: Update expected call counts for isValid ---
        // ActionValidationService.isValid:
        // - core:wait: initial (true), domain (true) -> 2 calls
        // - core:go: initial (true), domain for "out to town" (true) -> 2 calls
        // Total = 4 calls
        expect(mockValidationService.isValid).toHaveBeenCalledTimes(4);
        // --- END FIX ---
        expect(mockValidationService.isValid).toHaveBeenCalledWith(coreWaitActionDefinition, mockHeroEntity, ActionTargetContext.noTarget());
        expect(mockValidationService.isValid).toHaveBeenCalledWith(coreGoActionDefinition, mockHeroEntity, ActionTargetContext.noTarget());
        expect(mockValidationService.isValid).toHaveBeenCalledWith(coreGoActionDefinition, mockHeroEntity, ActionTargetContext.forDirection('out to town'));


        // --- BEGIN FIX: Update expected call counts for formatActionCommandFn ---
        // formatActionCommandFn:
        // Called once for "core:wait"
        // Called once for "core:go" with "out to town"
        // Total = 2 calls
        expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(2);
        // --- END FIX ---
        expect(mockFormatActionCommandFn).toHaveBeenCalledWith(coreWaitActionDefinition, ActionTargetContext.noTarget(), mockEntityManager, expect.any(Object));
        // --- BEGIN FIX: Expect formatActionCommandFn to be called for "go out to town" ---
        expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
            coreGoActionDefinition,
            ActionTargetContext.forDirection('out to town'),
            mockEntityManager, // Changed from expect.anything() to be more specific
            expect.any(Object)
        );
        // --- END FIX ---

        expect(mockGetEntityIdsForScopesFn).not.toHaveBeenCalled();

        // --- BEGIN FIX: Adjust expected number of found actions ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Finished action discovery for actor ${heroEntityDefinition.id}. Found 2 valid commands/actions.`));
        // --- END FIX ---
    });
});
// --- FILE END ---
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
import {EXITS_COMPONENT_ID, POSITION_COMPONENT_ID} from '../../constants/componentIds.js';

/** @typedef {import('../../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../core/services/consoleLogger.js').default} ILogger */
// DiscoveredActionInfo is defined in ActionDiscoverySystem.js itself now
// /** @typedef {import('../../systems/actionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */


// --- Mocking Dependencies ---
jest.mock('../../core/services/gameDataRepository.js');
jest.mock('../../entities/entityManager.js');
jest.mock('../../services/actionValidationService.js');
jest.mock('../../core/services/consoleLogger.js');
jest.mock('../../services/actionFormatter.js');
jest.mock('../../services/entityScopeService.js');

describe('ActionDiscoverySystem - Go Action (Fixed State)', () => {
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
    /** @type {jest.MockedFunction<typeof formatActionCommandFn>} */
    let mockFormatActionCommandFn;
    /** @type {jest.MockedFunction<typeof getEntityIdsForScopesFn>} */
    let mockGetEntityIdsForScopesFn;

    /** @type {ActionDefinition} */
    const coreGoActionDefinition = {
        id: "core:go",
        commandVerb: "go",
        name: "Go", // Name is present
        // description is missing, so ActionDiscoverySystem will default to ""
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
        name: "Wait", // Name is present
        // description is missing, so ActionDiscoverySystem will default to ""
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
            [POSITION_COMPONENT_ID]: {locationId: "isekai:adventurers_guild", x: 0, y: 0}
        }
    };

    const adventurersGuildEntityDefinition = {
        id: "isekai:adventurers_guild",
        components: {
            "core:name": {text: "Adventurers' Guild"},
            "core:description": {text: "The local adventurers' guild."},
            [EXITS_COMPONENT_ID]: [
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

        mockFormatActionCommandFn = formatActionCommandFn; // Already a mock due to jest.mock at top
        mockGetEntityIdsForScopesFn = getEntityIdsForScopesFn; // Already a mock

        mockHeroEntity = new Entity(heroEntityDefinition.id, mockEntityManager);
        mockAdventurersGuildLocation = new Entity(adventurersGuildEntityDefinition.id, mockEntityManager);

        mockGameDataRepo.getAllActionDefinitions.mockReturnValue([coreWaitActionDefinition, coreGoActionDefinition]);

        mockEntityManager.getEntityInstance.mockImplementation(id => {
            if (id === heroEntityDefinition.id) return mockHeroEntity;
            if (id === adventurersGuildEntityDefinition.id) return mockAdventurersGuildLocation;
            return null;
        });

        mockEntityManager.getComponentData.mockImplementation((entityId, componentTypeId) => {
            if (entityId === heroEntityDefinition.id) {
                if (componentTypeId === POSITION_COMPONENT_ID) {
                    return heroEntityDefinition.components[POSITION_COMPONENT_ID];
                }
            }
            if (entityId === adventurersGuildEntityDefinition.id) {
                if (componentTypeId === EXITS_COMPONENT_ID) {
                    return adventurersGuildEntityDefinition.components[EXITS_COMPONENT_ID];
                }
                if (componentTypeId === 'core:name') {
                    return adventurersGuildEntityDefinition.components['core:name'];
                }
            }
            return null;
        });

        mockValidationService.isValid.mockImplementation((actionDef, actor, targetContext) => {
            if (actor.id !== heroEntityDefinition.id) return false;
            if (actionDef.id === 'core:wait') {
                return targetContext.type === 'none';
            }
            if (actionDef.id === 'core:go') {
                if (targetContext.type === 'none') return true; // Initial actor check
                if (targetContext.type === 'direction' && targetContext.direction === 'out to town') return true;
            }
            return false;
        });

        mockFormatActionCommandFn.mockImplementation((actionDef, targetContext, _entityManager, _options) => {
            if (actionDef.id === 'core:wait' && targetContext.type === 'none') {
                return 'wait';
            }
            if (actionDef.id === 'core:go' && targetContext.type === 'direction' && targetContext.direction === 'out to town') {
                return 'go out to town';
            }
            return null;
        });

        mockGetEntityIdsForScopesFn.mockReturnValue(new Set());

        mockActionContext = {
            actor: mockHeroEntity,
            currentLocation: mockAdventurersGuildLocation,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepo,
            logger: mockLogger,
            worldContext: /** @type {any} */ ({}), // Mock as needed if worldContext methods are called
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

    it('should discover "go out to town" action when player is in adventurers guild and exit is available', async () => {
        /** @type {import('../../systems/actionDiscoverySystem.js').DiscoveredActionInfo[]} */
        const validActions = await actionDiscoverySystem.getValidActions(mockHeroEntity, mockActionContext);

        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);

        // MODIFIED: Update expected actions to include name and description
        const waitAction = {
            id: 'core:wait',
            name: 'Wait', // From coreWaitActionDefinition.name
            command: 'wait',
            description: '' // Default from ActionDiscoverySystem as not in definition
        };
        const goAction = {
            id: 'core:go',
            name: 'Go', // From coreGoActionDefinition.name
            command: 'go out to town',
            description: '' // Default from ActionDiscoverySystem as not in definition
        };

        expect(validActions).toContainEqual(waitAction);
        expect(validActions).toContainEqual(goAction);

        expect(mockLogger.debug).toHaveBeenCalledWith(
            `Checking exits data (component ${EXITS_COMPONENT_ID}) for location: ${adventurersGuildEntityDefinition.id}`,
            adventurersGuildEntityDefinition.components[EXITS_COMPONENT_ID]
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            expect.stringContaining(`Found ${adventurersGuildEntityDefinition.components[EXITS_COMPONENT_ID].length} potential exits from ${EXITS_COMPONENT_ID}. Checking validation...`)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `    -> Processing exit direction: out to town`
        );
        // Updated log message to reflect name field being used
        expect(mockLogger.debug).toHaveBeenCalledWith(
            `    * Found valid action (direction: out to town): '${coreGoActionDefinition.name}' (ID: core:go)`
        );

        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(adventurersGuildEntityDefinition.id, EXITS_COMPONENT_ID);

        expect(mockValidationService.isValid).toHaveBeenCalledTimes(4);
        expect(mockValidationService.isValid).toHaveBeenCalledWith(coreWaitActionDefinition, mockHeroEntity, ActionTargetContext.noTarget());
        expect(mockValidationService.isValid).toHaveBeenCalledWith(coreGoActionDefinition, mockHeroEntity, ActionTargetContext.noTarget());
        expect(mockValidationService.isValid).toHaveBeenCalledWith(coreGoActionDefinition, mockHeroEntity, ActionTargetContext.forDirection('out to town'));

        expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(2);
        expect(mockFormatActionCommandFn).toHaveBeenCalledWith(coreWaitActionDefinition, ActionTargetContext.noTarget(), mockEntityManager, expect.any(Object));
        expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
            coreGoActionDefinition,
            ActionTargetContext.forDirection('out to town'),
            mockEntityManager,
            expect.any(Object)
        );

        expect(mockGetEntityIdsForScopesFn).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Finished action discovery for actor ${heroEntityDefinition.id}. Found 2 valid commands/actions.`));
    });
});
// --- FILE END ---
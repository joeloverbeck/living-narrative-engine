// src/tests/systems/actionDiscoverySystem.wait.test.js
// --- FILE START (Entire file content as requested) ---

// --- Tell Jest to use Node environment ---
/**
 * @jest-environment node
 */

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../src/systems/actionDiscoverySystem.js';

// --- Core Dependencies to Mock ---
import {GameDataRepository} from '../../src/services/gameDataRepository.js';
import EntityManager from '../../src/entities/entityManager.js';
import {ActionValidationService} from '../../src/services/actionValidationService.js';
import ConsoleLogger from '../../src/services/consoleLogger.js';
import {formatActionCommand as formatActionCommandFn} from '../../src/services/actionFormatter.js';
import {getEntityIdsForScopes as getEntityIdsForScopesFn} from '../../src/services/entityScopeService.js';

// --- Helper Mocks/Types ---
import {ActionTargetContext} from '../../src/models/actionTargetContext.js';
import Entity from '../../src/entities/entity.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";
/** @typedef {import('../../src/types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../src/actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../src/services/consoleLogger.js').default} ILogger */
// DiscoveredActionInfo is defined in actionDiscoverySystem.js, no separate import needed if types are inferred
// /** @typedef {import('../../systems/actionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */


// --- Mocking Dependencies ---
jest.mock('../../src/services/gameDataRepository.js');
jest.mock('../../src/entities/entityManager.js');
jest.mock('../../src/services/actionValidationService.js');
jest.mock('../../src/services/consoleLogger.js');
jest.mock('../../src/services/actionFormatter.js');
jest.mock('../../src/services/entityScopeService.js');

// --- Test Suite ---
describe('ActionDiscoverySystem', () => {
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
    const coreWaitActionDefinition = {
        $schema: "http://example.com/schemas/action-definition.schema.json",
        id: "core:wait",
        commandVerb: "wait",
        name: "Wait",
        // description is intentionally omitted to test default handling (should become "")
        target_domain: "none",
        prerequisites: [],
        template: "wait"
    };

    /** @type {Entity} */
    let mockActorEntity;
    /** @type {ActionContext} */
    let mockActionContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGameDataRepo = new GameDataRepository();
        mockEntityManager = new EntityManager();
        mockValidationService = new ActionValidationService();
        mockLogger = new ConsoleLogger();
        mockLogger.debug = jest.fn(); // Manually mock methods if constructor doesn't
        mockLogger.info = jest.fn();
        mockLogger.warn = jest.fn();
        mockLogger.error = jest.fn();


        mockFormatActionCommandFn = formatActionCommandFn;
        mockGetEntityIdsForScopesFn = getEntityIdsForScopesFn;

        mockGameDataRepo.getAllActionDefinitions.mockReturnValue([coreWaitActionDefinition]);
        mockValidationService.isValid.mockImplementation((actionDef, actor, targetContext) => {
            return actionDef.id === 'core:wait' && actor === mockActorEntity && targetContext.type === 'none';
        });
        mockFormatActionCommandFn.mockImplementation((actionDef, targetContext, entityManager, options) => {
            if (actionDef.id === 'core:wait' && targetContext.type === 'none') {
                return actionDef.template;
            }
            // console.warn(`Mock formatActionCommand called with unexpected args:`, actionDef?.id, targetContext);
            return null;
        });
        mockGetEntityIdsForScopesFn.mockReturnValue(new Set());
        mockEntityManager.getEntityInstance.mockImplementation(id => {
            if (id === 'actor1') return mockActorEntity;
            return null;
        });
        mockEntityManager.getComponentData.mockReturnValue(null);

        mockActorEntity = new Entity('actor1', mockEntityManager);
        // mockActorEntity.components = {}; // Entity constructor initializes this

        const mockLocationEntity = new Entity('location1', mockEntityManager);

        mockActionContext = {
            actor: mockActorEntity,
            currentLocation: mockLocationEntity,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepo,
            logger: mockLogger,
            worldContext: /** @type {any} */ ({
                getLocationOfEntity: jest.fn().mockResolvedValue(mockLocationEntity)
            }),
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


    it('should return structured action info [{id, name, command, description}] when core:wait is available and valid', async () => {
        // Act
        /** @type {import('../../src/systems/actionDiscoverySystem.js').DiscoveredActionInfo[]} */
        const validActions = await actionDiscoverySystem.getValidActions(mockActorEntity, mockActionContext);

        // Assert
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);
        expect(validActions).toHaveLength(1);

        const expectedWaitAction = {
            id: 'core:wait',
            name: 'Wait', // From coreWaitActionDefinition.name
            command: 'wait',
            description: '' // Defaulted by ActionDiscoverySystem
        };
        expect(validActions).toEqual([expectedWaitAction]);

        // Verify interactions
        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        expect(mockValidationService.isValid).toHaveBeenCalledTimes(2);
        expect(mockValidationService.isValid).toHaveBeenNthCalledWith(
            1,
            coreWaitActionDefinition,
            mockActorEntity,
            expect.objectContaining({type: 'none'})
        );
        expect(mockValidationService.isValid).toHaveBeenNthCalledWith(
            2,
            coreWaitActionDefinition,
            mockActorEntity,
            expect.objectContaining({type: 'none'})
        );
        expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
        expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
            coreWaitActionDefinition,
            expect.objectContaining({type: 'none'}),
            mockEntityManager,
            expect.any(Object)
        );
        expect(mockGetEntityIdsForScopesFn).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Starting action discovery for actor: ${mockActorEntity.id}`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringMatching(/Found valid action \(no target\/self\): 'Wait' \(ID: core:wait\)/));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Finished action discovery for actor ${mockActorEntity.id}. Found 1 valid commands/actions.`));
    });

    it('should return an empty array if core:wait action is deemed invalid by ActionValidationService', async () => {
        mockValidationService.isValid.mockReturnValue(false);
        const validActions = await actionDiscoverySystem.getValidActions(mockActorEntity, mockActionContext);
        expect(validActions).toEqual([]);
        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        expect(mockValidationService.isValid).toHaveBeenCalledTimes(1); // Only initial check fails
        expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
        expect(mockGetEntityIdsForScopesFn).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Action ${coreWaitActionDefinition.id} skipped: Invalid for actor based on initial check.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Finished action discovery for actor ${mockActorEntity.id}. Found 0 valid commands/actions.`));
    });

    it('should return an empty array if core:wait action definition is not provided by GameDataRepository', async () => {
        mockGameDataRepo.getAllActionDefinitions.mockReturnValue([]);
        const validActions = await actionDiscoverySystem.getValidActions(mockActorEntity, mockActionContext);
        expect(validActions).toEqual([]);
        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        expect(mockValidationService.isValid).not.toHaveBeenCalled();
        expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
        expect(mockGetEntityIdsForScopesFn).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Finished action discovery for actor ${mockActorEntity.id}. Found 0 valid commands/actions.`));
    });

    it('should return structured info for core:wait even if other invalid actions are present', async () => {
        const invalidActionDef = {
            id: "other:action", commandVerb: "other", name: "Other",
            target_domain: "none", prerequisites: [], template: "other"
            // description is missing, will default to "" if processed
        };
        mockGameDataRepo.getAllActionDefinitions.mockReturnValue([coreWaitActionDefinition, invalidActionDef]);

        mockValidationService.isValid.mockImplementation((actionDef, actor, targetContext) => {
            if (actionDef.id === 'core:wait') return true;
            if (actionDef.id === 'other:action') return false; // This action is invalid
            return false;
        });

        const validActions = await actionDiscoverySystem.getValidActions(mockActorEntity, mockActionContext);

        const expectedWaitAction = {
            id: 'core:wait',
            name: 'Wait',
            command: 'wait',
            description: ''
        };
        expect(validActions).toEqual([expectedWaitAction]);

        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        // isValid called:
        // - core:wait: initial (true), domain (true) -> 2 calls
        // - other:action: initial (false) -> 1 call
        expect(mockValidationService.isValid).toHaveBeenCalledTimes(3);
        expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
        expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
            coreWaitActionDefinition,
            expect.anything(), expect.anything(), expect.anything()
        );
    });
});
// --- FILE END ---
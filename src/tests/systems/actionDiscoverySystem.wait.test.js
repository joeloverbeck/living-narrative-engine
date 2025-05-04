// src/tests/systems/actionDiscoverySystem.wait.test.js
// --- FILE START (Entire file content as requested) ---

// --- Tell Jest to use Node environment ---
/**
 * @jest-environment node
 */

// --- System Under Test ---
import {ActionDiscoverySystem} from '../../systems/actionDiscoverySystem.js';

// --- Core Dependencies to Mock ---
import {GameDataRepository} from '../../core/services/gameDataRepository.js'; // Adjust path if needed
import EntityManager from '../../entities/entityManager.js';        // Adjust path if needed
import {ActionValidationService} from '../../services/actionValidationService.js'; // Adjust path if needed
import ConsoleLogger from '../../core/services/consoleLogger.js'; // Assuming ConsoleLogger is the implementation
import {formatActionCommand as formatActionCommandFn} from '../../services/actionFormatter.js'; // Adjust path if needed
import {getEntityIdsForScopes as getEntityIdsForScopesFn} from '../../services/entityScopeService.js'; // Adjust path if needed

// --- Helper Mocks/Types ---
import {ActionTargetContext} from '../../models/actionTargetContext.js'; // Adjust path if needed
import Entity from '../../entities/entity.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals"; // Adjust path if needed
// Define a minimal ActionDefinition structure for the test
/** @typedef {import('../../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../core/services/consoleLogger.js').default} ILogger */
/** @typedef {import('../../systems/actionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */ // <-- ADDED TYPE


// --- Mocking Dependencies ---
jest.mock('../../core/services/gameDataRepository.js');
jest.mock('../../entities/entityManager.js');
jest.mock('../../services/actionValidationService.js');
jest.mock('../../core/services/consoleLogger.js'); // Mock the logger to suppress output during tests
jest.mock('../../services/actionFormatter.js');
jest.mock('../../services/entityScopeService.js');

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
    /** @type {jest.MockedFunction<formatActionCommandFn>} */ // <-- Use MockedFunction
    let mockFormatActionCommandFn;
    /** @type {jest.MockedFunction<getEntityIdsForScopesFn>} */ // <-- Use MockedFunction
    let mockGetEntityIdsForScopesFn;

    /** @type {ActionDefinition} */
    const coreWaitActionDefinition = {
        $schema: "http://example.com/schemas/action-definition.schema.json",
        id: "core:wait",
        commandVerb: "wait",
        name: "Wait",
        target_domain: "none",
        prerequisites: [],
        template: "wait"
    };

    /** @type {Entity} */
    let mockActorEntity;
    /** @type {ActionContext} */
    let mockActionContext;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Create new mock instances for each test
        mockGameDataRepo = new GameDataRepository();
        mockEntityManager = new EntityManager();
        mockValidationService = new ActionValidationService();
        mockLogger = new ConsoleLogger(); // Use the mocked constructor

        // Assign the mocked functions directly (cast to MockedFunction)
        mockFormatActionCommandFn = /** @type {jest.MockedFunction<formatActionCommandFn>} */ (formatActionCommandFn);
        mockGetEntityIdsForScopesFn = /** @type {jest.MockedFunction<getEntityIdsForScopesFn>} */ (getEntityIdsForScopesFn);


        // --- Default Mock Implementations ---

        // GameDataRepository: By default, return the 'wait' action
        mockGameDataRepo.getAllActionDefinitions.mockReturnValue([coreWaitActionDefinition]);

        // ActionValidationService: By default, assume 'wait' is valid
        mockValidationService.isValid.mockImplementation((actionDef, actor, targetContext) => {
            return actionDef.id === 'core:wait' && actor === mockActorEntity && targetContext.type === 'none';
        });

        // formatActionCommandFn: Format 'wait' correctly, return null otherwise
        mockFormatActionCommandFn.mockImplementation((actionDef, targetContext, entityManager, options) => {
            if (actionDef.id === 'core:wait' && targetContext.type === 'none') {
                return actionDef.template; // "wait"
            }
            console.warn(`Mock formatActionCommand called with unexpected args:`, actionDef?.id, targetContext);
            return null;
        });

        // getEntityIdsForScopesFn: Return empty set as 'wait' doesn't use entity scopes
        mockGetEntityIdsForScopesFn.mockReturnValue(new Set());

        // EntityManager: Basic mocks
        mockEntityManager.getEntityInstance.mockImplementation(id => {
            if (id === 'actor1') return mockActorEntity;
            return null;
        });
        mockEntityManager.getComponentData.mockReturnValue(null);


        // --- Setup Dummy Entities/Context ---
        mockActorEntity = new Entity('actor1', mockEntityManager);
        mockActorEntity.components = {};

        mockActionContext = {
            actor: mockActorEntity,
            currentLocation: new Entity('location1', mockEntityManager),
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepo,
            logger: mockLogger,
            worldContext: /** @type {any} */ ({ // Mock necessary world context methods if needed
                getLocationOfEntity: jest.fn().mockResolvedValue(new Entity('location1', mockEntityManager))
            }),
        };

        // --- Instantiate the System Under Test ---
        actionDiscoverySystem = new ActionDiscoverySystem({
            gameDataRepository: mockGameDataRepo,
            entityManager: mockEntityManager,
            actionValidationService: mockValidationService,
            logger: mockLogger,
            formatActionCommandFn: mockFormatActionCommandFn,
            getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn
        });
    });

    // --- Test Cases ---

    it('should return structured action info [{id, command}] when core:wait is available and valid', async () => {
        // Arrange: Mocks are set up in beforeEach

        // Act
        /** @type {DiscoveredActionInfo[]} */ // <-- Add type hint
        const validActions = await actionDiscoverySystem.getValidActions(mockActorEntity, mockActionContext);

        // Assert
        expect(validActions).toBeDefined();
        expect(Array.isArray(validActions)).toBe(true);
        expect(validActions).toHaveLength(1);

        // --- UPDATED ASSERTIONS for structure ---
        expect(validActions[0]).toBeInstanceOf(Object);
        expect(validActions[0]).toHaveProperty('id', 'core:wait');
        expect(validActions[0]).toHaveProperty('command', 'wait');
        // Concise equivalent:
        expect(validActions).toEqual([{id: 'core:wait', command: 'wait'}]);
        // --- END UPDATED ASSERTIONS ---

        // Verify interactions
        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        expect(mockValidationService.isValid).toHaveBeenCalledTimes(2); // Initial + Domain 'none'
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
            expect.any(Object) // Options argument
        );
        expect(mockGetEntityIdsForScopesFn).not.toHaveBeenCalled();

        // Check logger calls (Focus on key logs)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Starting action discovery for actor: ${mockActorEntity.id}`));
        // Example check for the success log (adjust if log message changed slightly)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringMatching(/Found valid action \(no target\/self\): wait \(ID: core:wait\)/));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Finished action discovery for actor ${mockActorEntity.id}. Found 1 valid commands/actions.`));
    });

    it('should return an empty array if core:wait action is deemed invalid by ActionValidationService', async () => {
        // Arrange: Override validation mock to return false
        mockValidationService.isValid.mockReturnValue(false); // Fail all validation attempts


        // Act
        const validActions = await actionDiscoverySystem.getValidActions(mockActorEntity, mockActionContext);

        // Assert
        expect(validActions).toEqual([]); // Should still be empty

        // Verify interactions
        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        // Validation should have been called only ONCE (the initial check that failed)
        expect(mockValidationService.isValid).toHaveBeenCalledTimes(1);
        expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
        expect(mockGetEntityIdsForScopesFn).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Action ${coreWaitActionDefinition.id} skipped: Invalid for actor based on initial check.`));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Finished action discovery for actor ${mockActorEntity.id}. Found 0 valid commands/actions.`));
    });

    it('should return an empty array if core:wait action definition is not provided by GameDataRepository', async () => {
        // Arrange: Mock GameDataRepository to return an empty array
        mockGameDataRepo.getAllActionDefinitions.mockReturnValue([]);

        // Act
        const validActions = await actionDiscoverySystem.getValidActions(mockActorEntity, mockActionContext);

        // Assert
        expect(validActions).toEqual([]); // Should be empty

        // Verify interactions (no processing should happen)
        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        expect(mockValidationService.isValid).not.toHaveBeenCalled();
        expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
        expect(mockGetEntityIdsForScopesFn).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Finished action discovery for actor ${mockActorEntity.id}. Found 0 valid commands/actions.`));
    });

    it('should return structured info for core:wait even if other invalid actions are present', async () => {
        // Arrange: Add an invalid action definition
        const invalidActionDef = {
            id: "other:action", commandVerb: "other", name: "Other",
            target_domain: "none", prerequisites: [], template: "other"
        };
        mockGameDataRepo.getAllActionDefinitions.mockReturnValue([coreWaitActionDefinition, invalidActionDef]);

        // Validation mock: 'core:wait' is valid, 'other:action' is invalid
        mockValidationService.isValid.mockImplementation((actionDef, actor, targetContext) => {
            if (actionDef.id === 'core:wait') return true; // Always valid for wait in this test
            if (actionDef.id === 'other:action') return false; // Always invalid for other
            return false;
        });

        // Act
        const validActions = await actionDiscoverySystem.getValidActions(mockActorEntity, mockActionContext);

        // Assert
        expect(validActions).toEqual([{id: 'core:wait', command: 'wait'}]); // Only wait info should be returned

        // Verify interactions
        expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
        // isValid called:
        // - core:wait: initial (true), domain (true) -> 2 calls
        // - other:action: initial (false) -> 1 call
        // Total = 3 calls
        expect(mockValidationService.isValid).toHaveBeenCalledTimes(3);

        // formatActionCommand should only be called once for 'core:wait'
        expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
        expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
            coreWaitActionDefinition, // Only called with wait definition
            expect.anything(), expect.anything(), expect.anything()
        );
    });

});
// --- FILE END ---
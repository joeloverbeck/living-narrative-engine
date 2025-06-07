// tests/actions/actionDiscoverySystem.wait.test.js
// --- FILE START (Entire file content as requested) ---

// --- Tell Jest to use Node environment ---
/**
 * @jest-environment node
 */

// --- System Under Test ---
import { ActionDiscoveryService } from '../../src/actions/actionDiscoveryService.js';

// --- Core Dependencies to Mock ---
import { GameDataRepository } from '../../src/data/gameDataRepository.js';
import EntityManager from '../../src/entities/entityManager.js';
import { ActionValidationService } from '../../src/actions/validation/actionValidationService.js';
import ConsoleLogger from '../../src/logging/consoleLogger.js';
import { formatActionCommand as formatActionCommandFn } from '../../src/actions/actionFormatter.js';
import { getEntityIdsForScopes as getEntityIdsForScopesFn } from '../../src/entities/entityScopeService.js';

// --- Helper Mocks/Types ---
import { ActionTargetContext } from '../../src/models/actionTargetContext.js';
import Entity from '../../src/entities/entity.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
/** @typedef {import('../../src/types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../src/systems/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../src/logging/consoleLogger.js').default} ILogger */

// --- Mocking Dependencies ---
jest.mock('../../src/data/gameDataRepository.js');
jest.mock('../../src/entities/entityManager.js');
jest.mock('../../src/actions/validation/actionValidationService.js');
jest.mock('../../src/logging/consoleLogger.js');
jest.mock('../../src/actions/actionFormatter.js');
jest.mock('../../src/entities/entityScopeService.js');

// --- Test Suite ---
describe('ActionDiscoveryService - Wait Action Tests', () => {
  // Renamed describe for clarity
  /** @type {ActionDiscoveryService} */
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

  const ACTOR_INSTANCE_ID = 'actor1-instance-wait';
  const LOCATION_INSTANCE_ID = 'location1-instance-wait';
  const DUMMY_DEFINITION_ID = 'def:dummy-wait-test';

  /** @type {ActionDefinition} */
  const coreWaitActionDefinition = {
    $schema: 'http://example.com/schemas/action-definition.schema.json',
    id: 'core:wait',
    commandVerb: 'wait',
    name: 'Wait',
    target_domain: 'none',
    prerequisites: [],
    template: 'wait',
  };

  /** @type {Entity} */
  let mockActorEntity;
  /** @type {Entity} */
  let mockLocationEntity; // Renamed for clarity
  /** @type {ActionContext} */
  let mockActionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGameDataRepo = new GameDataRepository();
    mockEntityManager = new EntityManager();
    mockValidationService = new ActionValidationService();
    mockLogger = new ConsoleLogger(); // Will use the mocked constructor
    // Ensure methods are jest.fn() if not handled by global mock
    mockLogger.debug = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();

    mockFormatActionCommandFn = formatActionCommandFn;
    mockGetEntityIdsForScopesFn = getEntityIdsForScopesFn;

    // Correctly instantiate Entity objects
    mockActorEntity = new Entity(ACTOR_INSTANCE_ID, DUMMY_DEFINITION_ID);
    // Add any necessary components to mockActorEntity if the system reads them
    // For 'wait' action, typically no specific components are needed on the actor itself for discovery.

    mockLocationEntity = new Entity(LOCATION_INSTANCE_ID, DUMMY_DEFINITION_ID);
    // Add components to mockLocationEntity if needed by ActionContext or system

    // Setup default mock behaviors
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([
      coreWaitActionDefinition,
    ]);
    mockValidationService.isValid.mockImplementation(
      (actionDef, actor, targetContext) => {
        // Default valid for core:wait by the correct actor and target type
        return (
          actionDef.id === 'core:wait' &&
          actor.id === ACTOR_INSTANCE_ID &&
          targetContext.type === 'none'
        );
      }
    );
    mockFormatActionCommandFn.mockImplementation((actionDef, targetContext) => {
      if (actionDef.id === 'core:wait' && targetContext.type === 'none') {
        return actionDef.template; // "wait"
      }
      return null;
    });
    mockGetEntityIdsForScopesFn.mockReturnValue(new Set()); // No entities in scope by default
    mockEntityManager.getEntityInstance.mockImplementation((instanceId) => {
      if (instanceId === ACTOR_INSTANCE_ID) return mockActorEntity;
      if (instanceId === LOCATION_INSTANCE_ID) return mockLocationEntity;
      return null;
    });
    mockEntityManager.getComponentData.mockReturnValue(null); // No components by default on these bare entities

    mockActionContext = {
      actingEntity: mockActorEntity, // Corrected property name
      currentLocation: mockLocationEntity,
      entityManager: mockEntityManager,
      gameDataRepository: mockGameDataRepo,
      logger: mockLogger,
      worldContext: /** @type {any} */ ({
        getLocationOfEntity: jest.fn().mockResolvedValue(mockLocationEntity), // Assuming async, though might not be used by 'wait'
      }),
    };

    actionDiscoverySystem = new ActionDiscoveryService({
      gameDataRepository: mockGameDataRepo,
      entityManager: mockEntityManager,
      actionValidationService: mockValidationService,
      logger: mockLogger,
      formatActionCommandFn: mockFormatActionCommandFn,
      getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn,
    });
  });

  it('should return structured action info [{id, name, command, description}] when core:wait is available and valid', async () => {
    const validActions = await actionDiscoverySystem.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(validActions).toEqual([
      {
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: '',
      },
    ]);

    expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
    // --- FIX ---: With initial check removed, isValid is only called ONCE for a 'none' domain action.
    expect(mockValidationService.isValid).toHaveBeenCalledTimes(1);
    expect(mockValidationService.isValid).toHaveBeenCalledWith(
      coreWaitActionDefinition,
      mockActorEntity,
      ActionTargetContext.noTarget()
    );
    // --- END FIX ---
    expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
    expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
      coreWaitActionDefinition,
      ActionTargetContext.noTarget(),
      mockEntityManager,
      expect.any(Object)
    );
    // Log messages should refer to the actor's INSTANCE_ID
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Starting action discovery for actor: ${ACTOR_INSTANCE_ID}`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(
        /Found valid action \(no target\/self\): 'Wait' \(ID: core:wait\)/
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${ACTOR_INSTANCE_ID}. Found 1 valid commands/actions.`
      )
    );
  });

  it('should return an empty array if core:wait action is deemed invalid by ActionValidationService', async () => {
    mockValidationService.isValid.mockReturnValue(false); // Make validation fail
    const validActions = await actionDiscoverySystem.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(validActions).toEqual([]);
    expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
    // --- FIX ---: The log message for a skipped action is now different as it fails during the domain-specific check.
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Action ${coreWaitActionDefinition.id} failed the final context-specific validation for 'none' domain.`
      )
    );
    // --- END FIX ---
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${ACTOR_INSTANCE_ID}. Found 0 valid commands/actions.`
      )
    );
  });

  it('should return an empty array if core:wait action definition is not provided by GameDataRepository', async () => {
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([]); // No actions available
    const validActions = await actionDiscoverySystem.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(validActions).toEqual([]);
    expect(mockValidationService.isValid).not.toHaveBeenCalled();
    expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
    // Log message refers to actor's INSTANCE_ID
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${ACTOR_INSTANCE_ID}. Found 0 valid commands/actions.`
      )
    );
  });

  it('should return structured info for core:wait even if other invalid actions are present', async () => {
    const invalidActionDef = {
      id: 'other:action',
      commandVerb: 'other',
      name: 'Other',
      target_domain: 'none',
      prerequisites: [],
      template: 'other',
    };
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([
      coreWaitActionDefinition,
      invalidActionDef,
    ]);

    // Ensure only core:wait passes validation
    mockValidationService.isValid.mockImplementation((actionDef, actor) => {
      // Corrected to use actor.id
      return actionDef.id === 'core:wait' && actor.id === ACTOR_INSTANCE_ID;
    });

    const validActions = await actionDiscoverySystem.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(validActions).toEqual([
      {
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: '',
      },
    ]);
    // --- FIX ---: isValid is called once for each action, so 2 times total.
    expect(mockValidationService.isValid).toHaveBeenCalledTimes(2);
    // --- END FIX ---
    expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1); // Only for core:wait
  });
});
// --- FILE END ---

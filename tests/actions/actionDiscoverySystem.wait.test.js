/**
 * @jest-environment node
 */

import coreWaitActionDefinition from '../../data/mods/core/actions/wait.action.json';

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
  /** @type {ActionDiscoveryService} */
  let actionDiscoveryService;
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

  /** @type {Entity} */
  let mockActorEntity;
  /** @type {Entity} */
  let mockLocationEntity;
  /** @type {ActionContext} */
  let mockActionContext;
  let mockSafeEventDispatcher;

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

    mockFormatActionCommandFn = formatActionCommandFn;
    mockGetEntityIdsForScopesFn = getEntityIdsForScopesFn;
    mockSafeEventDispatcher = { dispatch: jest.fn() };

    mockActorEntity = new Entity(ACTOR_INSTANCE_ID, DUMMY_DEFINITION_ID);
    mockLocationEntity = new Entity(LOCATION_INSTANCE_ID, DUMMY_DEFINITION_ID);

    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([
      coreWaitActionDefinition,
    ]);
    mockValidationService.isValid.mockImplementation(
      (actionDef, actor, targetContext) =>
        actionDef.id === 'core:wait' &&
        actor.id === ACTOR_INSTANCE_ID &&
        targetContext.type === 'none'
    );
    mockFormatActionCommandFn.mockImplementation((actionDef, targetContext) => {
      if (actionDef.id === 'core:wait' && targetContext.type === 'none') {
        return actionDef.template;
      }
      return null;
    });
    mockGetEntityIdsForScopesFn.mockReturnValue(new Set());
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      if (id === ACTOR_INSTANCE_ID) return mockActorEntity;
      if (id === LOCATION_INSTANCE_ID) return mockLocationEntity;
      return null;
    });
    mockEntityManager.getComponentData.mockReturnValue(null);

    mockActionContext = {
      actingEntity: mockActorEntity,
      currentLocation: mockLocationEntity,
      entityManager: mockEntityManager,
      gameDataRepository: mockGameDataRepo,
      logger: mockLogger,
      worldContext: {
        getLocationOfEntity: jest.fn().mockResolvedValue(mockLocationEntity),
      },
    };

    actionDiscoveryService = new ActionDiscoveryService({
      gameDataRepository: mockGameDataRepo,
      entityManager: mockEntityManager,
      actionValidationService: mockValidationService,
      logger: mockLogger,
      formatActionCommandFn: mockFormatActionCommandFn,
      getEntityIdsForScopesFn: mockGetEntityIdsForScopesFn,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  it('should return structured action info [{id, name, command, description, params}] when core:wait is available and valid', async () => {
    const validActions = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(validActions).toEqual([
      {
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: 'Passes your turn without performing any action.',
        params: {},
      },
    ]);

    expect(mockGameDataRepo.getAllActionDefinitions).toHaveBeenCalledTimes(1);
    expect(mockValidationService.isValid).toHaveBeenCalledTimes(1);
    expect(mockValidationService.isValid).toHaveBeenCalledWith(
      coreWaitActionDefinition,
      mockActorEntity,
      ActionTargetContext.noTarget()
    );
    expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
    expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
      coreWaitActionDefinition,
      ActionTargetContext.noTarget(),
      mockEntityManager,
      expect.any(Object)
    );

    // Log messages: only start and finish
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Starting action discovery for actor: ${ACTOR_INSTANCE_ID}`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${ACTOR_INSTANCE_ID}. Found 1 actions.`
      )
    );
  });

  it('should return an empty array if core:wait action is deemed invalid by ActionValidationService', async () => {
    mockValidationService.isValid.mockReturnValue(false);

    const validActions = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(validActions).toEqual([]);
    expect(mockFormatActionCommandFn).not.toHaveBeenCalled();

    // Only start and finish logs
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Starting action discovery for actor: ${ACTOR_INSTANCE_ID}`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${ACTOR_INSTANCE_ID}. Found 0 actions.`
      )
    );
  });

  it('should return an empty array if core:wait action definition is not provided by GameDataRepository', async () => {
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([]);

    const validActions = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(validActions).toEqual([]);
    expect(mockValidationService.isValid).not.toHaveBeenCalled();
    expect(mockFormatActionCommandFn).not.toHaveBeenCalled();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${ACTOR_INSTANCE_ID}. Found 0 actions.`
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

    mockValidationService.isValid.mockImplementation(
      (actionDef, actor) =>
        actionDef.id === 'core:wait' && actor.id === ACTOR_INSTANCE_ID
    );

    const validActions = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(validActions).toEqual([
      {
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: 'Passes your turn without performing any action.',
        params: {},
      },
    ]);
    expect(mockValidationService.isValid).toHaveBeenCalledTimes(2);
    expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
  });
});

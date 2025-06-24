/**
 * @jest-environment node
 */

import coreWaitActionDefinition from '../../../data/mods/core/actions/wait.action.json';

// --- System Under Test ---
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

// --- Core Dependencies to Mock ---
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import EntityManager from '../../../src/entities/entityManager.js';
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { formatActionCommand as formatActionCommandFn } from '../../../src/actions/actionFormatter.js';
import { createMockScopeEngine } from '../../common/mockFactories/coreServices.js';

// --- Helper Mocks/Types ---
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import Entity from '../../../src/entities/entity.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
/** @typedef {import('../../../src/logging/consoleLogger.js').default} ILogger */

// --- Mocking Dependencies ---
jest.mock('../../../src/data/gameDataRepository.js');
jest.mock('../../../src/entities/entityManager.js');
jest.mock('../../../src/actions/validation/actionValidationService.js');
jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/actions/actionFormatter.js');

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
  /** @type {jest.Mocked<import('../../../src/scopeDsl/scopeRegistry.js').default>} */
  let mockScopeRegistry;
  /** @type {jest.Mocked<import('../../../src/interfaces/IScopeEngine.js').IScopeEngine>} */
  let mockScopeEngine;
  let mockActionIndex;

  const ACTOR_INSTANCE_ID = 'actor1-instance-wait';
  const LOCATION_INSTANCE_ID = 'location1-instance-wait';
  const DUMMY_DEFINITION_ID = 'def:dummy-wait-test';

  // Helper function to create entity instances for testing
  const createTestEntity = (
    instanceId,
    definitionId,
    defComponents = {},
    instanceOverrides = {}
  ) => {
    const definition = new EntityDefinition(definitionId, {
      description: `Test Definition ${definitionId}`,
      components: defComponents,
    });
    const instanceData = new EntityInstanceData(
      instanceId,
      definition,
      instanceOverrides
    );
    return new Entity(instanceData);
  };

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
    mockSafeEventDispatcher = { dispatch: jest.fn() };
    mockScopeRegistry = {
      getScope: jest.fn(),
      // Add other methods if needed by ActionDiscoveryService or its collaborators if not fully mocked
      initialize: jest.fn(),
      hasScope: jest.fn(),
      getAllScopeNames: jest.fn(),
      getAllScopes: jest.fn(),
      getStats: jest.fn(),
      clear: jest.fn(),
    };

    mockScopeEngine = createMockScopeEngine();

    mockActorEntity = createTestEntity(ACTOR_INSTANCE_ID, DUMMY_DEFINITION_ID);
    mockLocationEntity = createTestEntity(
      LOCATION_INSTANCE_ID,
      DUMMY_DEFINITION_ID
    );

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
        return { ok: true, value: actionDef.template };
      }
      return { ok: false, error: 'invalid' };
    });
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

    // Set up a dynamic mock for actionIndex that reflects what the GameDataRepository would return
    mockActionIndex = {
      getCandidateActions: jest.fn().mockImplementation(() => {
        // Return the same actions that the GameDataRepository would return
        return mockGameDataRepo.getAllActionDefinitions();
      })
    };

    actionDiscoveryService = new ActionDiscoveryService({
      gameDataRepository: mockGameDataRepo,
      entityManager: mockEntityManager,
      actionValidationService: mockValidationService,
      logger: mockLogger,
      formatActionCommandFn: mockFormatActionCommandFn,
      safeEventDispatcher: mockSafeEventDispatcher,
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      actionIndex: mockActionIndex,
    });
  });

  it('should return structured action info [{id, name, command, description, params}] when core:wait is available and valid', async () => {
    const result = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(result.actions).toEqual([
      {
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: 'Wait for a moment, doing nothing.',
        params: {},
      },
    ]);

    // ActionDiscoveryService now uses ActionIndex.getCandidateActions instead of GameDataRepository.getAllActionDefinitions
    expect(mockActionIndex.getCandidateActions).toHaveBeenCalledTimes(1);
    expect(mockActionIndex.getCandidateActions).toHaveBeenCalledWith(mockActorEntity);
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
      expect.any(Object),
      expect.any(Function)
    );

    // Log messages now include candidate count information
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Starting action discovery for actor: ${ACTOR_INSTANCE_ID}`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${ACTOR_INSTANCE_ID}. Found 1 actions from 1 candidates.`
      )
    );
  });

  it('should return an empty array if core:wait action is deemed invalid by ActionValidationService', async () => {
    mockValidationService.isValid.mockReturnValue(false);

    const result = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(result.actions).toEqual([]);
    expect(mockFormatActionCommandFn).not.toHaveBeenCalled();

    // Only start and finish logs - updated to include candidate count
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Starting action discovery for actor: ${ACTOR_INSTANCE_ID}`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${ACTOR_INSTANCE_ID}. Found 0 actions from 1 candidates.`
      )
    );
  });

  it('should return an empty array if core:wait action definition is not provided by GameDataRepository', async () => {
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([]);

    const result = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(result.actions).toEqual([]);
    expect(mockValidationService.isValid).not.toHaveBeenCalled();
    expect(mockFormatActionCommandFn).not.toHaveBeenCalled();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `Finished action discovery for actor ${ACTOR_INSTANCE_ID}. Found 0 actions from 0 candidates.`
      )
    );
  });

  it('should return structured info for core:wait even if other invalid actions are present', async () => {
    const invalidActionDef = {
      id: 'other:action',
      commandVerb: 'other',
      name: 'Other',
      scope: 'none',
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

    const result = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      mockActionContext
    );

    expect(result.actions).toEqual([
      {
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: 'Wait for a moment, doing nothing.',
        params: {},
      },
    ]);
    expect(mockValidationService.isValid).toHaveBeenCalledTimes(2);
    expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
  });
});

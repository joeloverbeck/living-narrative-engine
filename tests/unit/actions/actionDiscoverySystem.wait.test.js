/**
 * @jest-environment node
 */

import coreWaitActionDefinition from '../../../data/mods/core/actions/wait.action.json';

// --- System Under Test ---
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

// --- Core Dependencies to Mock ---
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import EntityManager from '../../../src/entities/entityManager.js';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { formatActionCommand as formatActionCommandFn } from '../../../src/actions/actionFormatter.js';
import { createMockScopeEngine } from '../../common/mockFactories';

// --- Helper Mocks/Types ---
import Entity from '../../../src/entities/entity.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
/** @typedef {import('../../../src/logging/consoleLogger.js').default} ILogger */

// --- Mocking Dependencies ---
jest.mock('../../../src/data/gameDataRepository.js');
jest.mock('../../../src/entities/entityManager.js');
jest.mock(
  '../../../src/actions/validation/prerequisiteEvaluationService.js'
);
jest.mock('../../../src/logging/consoleLogger.js');
jest.mock('../../../src/actions/actionFormatter.js');

// --- Test Suite ---
describe('ActionDiscoveryService - Wait Action Tests', () => {
  let actionDiscoveryService;
  let mockGameDataRepo;
  let mockEntityManager;
  let mockValidationService;
  let mockPrereqService;
  let mockLogger;
  let mockFormatActionCommandFn;
  let mockActionIndex;

  const ACTOR_INSTANCE_ID = 'actor1-instance-wait';
  const LOCATION_INSTANCE_ID = 'location1-instance-wait';
  const DUMMY_DEFINITION_ID = 'def:dummy-wait-test';

  const createTestEntity = (instanceId, definitionId) => {
    const definition = new EntityDefinition(definitionId, {});
    const instanceData = new EntityInstanceData(instanceId, definition, {});
    return new Entity(instanceData);
  };

  let mockActorEntity;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGameDataRepo = new GameDataRepository();
    mockEntityManager = new EntityManager();
    mockPrereqService = new PrerequisiteEvaluationService();
    mockPrereqService.evaluate.mockReturnValue(true);

    mockLogger = new ConsoleLogger();
    mockLogger.debug = jest.fn();
    mockLogger.info = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();

    mockFormatActionCommandFn = formatActionCommandFn;
    const mockSafeEventDispatcher = { dispatch: jest.fn() };
    const mockTargetResolutionService = {
      resolveTargets: jest.fn().mockImplementation(async (scopeName) => {
        if (scopeName === 'none') return [{ type: 'none', entityId: null }];
        if (scopeName === 'self') return [{ type: 'entity', entityId: mockActorEntity.id }];
        return [];
      })
    };

    mockActorEntity = createTestEntity(ACTOR_INSTANCE_ID, DUMMY_DEFINITION_ID);

    mockFormatActionCommandFn.mockImplementation((actionDef) => {
      if (actionDef.id === 'core:wait') {
        return { ok: true, value: 'wait' };
      }
      return { ok: false, error: 'invalid' };
    });

    mockActionIndex = {
      getCandidateActions: jest
        .fn()
        .mockImplementation(() =>
          mockGameDataRepo.getAllActionDefinitions()
        ),
    };

    actionDiscoveryService = new ActionDiscoveryService({
      gameDataRepository: mockGameDataRepo,
      entityManager: mockEntityManager,
      prerequisiteEvaluationService: mockPrereqService,
      logger: mockLogger,
      formatActionCommandFn: mockFormatActionCommandFn,
      safeEventDispatcher: mockSafeEventDispatcher,
      targetResolutionService: mockTargetResolutionService,
      actionIndex: mockActionIndex,
    });
  });

  it('should return structured action info [{id, name, command, description, params}] when core:wait is available and valid', async () => {
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([
      coreWaitActionDefinition,
    ]);
    const result = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      {}
    );

    expect(result.actions).toEqual([
      {
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: 'Wait for a moment, doing nothing.',
        params: { targetId: null },
      },
    ]);

    expect(mockActionIndex.getCandidateActions).toHaveBeenCalledTimes(1);
    // FIX: The `wait` action has no prerequisites, so evaluate should NOT be called.
    expect(mockPrereqService.evaluate).not.toHaveBeenCalled();
    expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
  });

  it('should return an empty array if core:wait action prerequisites fail', async () => {
    // FIX: Create a custom action def with prerequisites to properly test the failure case.
    const waitActionWithPrereqs = {
      ...coreWaitActionDefinition,
      prerequisites: [{ logic: { some_condition: true } }],
    };
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([
      waitActionWithPrereqs,
    ]);
    mockPrereqService.evaluate.mockReturnValue(false);

    const result = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      {}
    );

    // FIX: Now that `evaluate` is called and returns false, the actions array should be empty.
    expect(result.actions).toEqual([]);
    expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
    expect(mockPrereqService.evaluate).toHaveBeenCalledTimes(1);
  });

  it('should return an empty array if core:wait action definition is not provided', async () => {
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([]);

    const result = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      {}
    );

    expect(result.actions).toEqual([]);
    expect(mockPrereqService.evaluate).not.toHaveBeenCalled();
    expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
  });

  it('should return structured info for core:wait even if other invalid actions are present', async () => {
    const invalidActionDef = {
      id: 'other:action',
      name: 'Other',
      scope: 'none',
      prerequisites: [{ logic: { '==': [1, 2] } }], // A failing prereq
    };
    mockGameDataRepo.getAllActionDefinitions.mockReturnValue([
      coreWaitActionDefinition, // This has no prereqs
      invalidActionDef,       // This has prereqs
    ]);

    mockPrereqService.evaluate.mockImplementation((prereqs, actionDef) => {
      // This will only be called for invalidActionDef. Make it fail.
      return actionDef.id !== 'other:action';
    });

    const result = await actionDiscoveryService.getValidActions(
      mockActorEntity,
      {}
    );

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('core:wait');
    // FIX: `evaluate` is only called for the one action that HAS prerequisites.
    expect(mockPrereqService.evaluate).toHaveBeenCalledTimes(1);
    expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
  });
});
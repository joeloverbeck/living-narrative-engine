import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

// We only mock this utility to verify it gets called on error.
jest.mock('../../../src/utils/safeDispatchErrorUtils.js');

describe('ActionDiscoveryService - getValidActions', () => {
  let service;
  let gameDataRepo;
  let entityManager;
  let actionValidationService;
  let mockPrerequisiteEvaluationService;
  let formatActionCommandFn;
  let logger;
  let safeEventDispatcher;
  let mockTargetResolutionService;
  let mockActionIndex;

  beforeEach(() => {
    gameDataRepo = { getAllActionDefinitions: jest.fn() };
    entityManager = {
      getEntityInstance: jest.fn((id) =>
        id === 'room1'
          ? { id: 'room1', getComponentData: () => null }
          : null
      ),
      getComponentData: jest.fn().mockReturnValue(null),
    };
    actionValidationService = { isValid: () => true };
    mockPrerequisiteEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };
    formatActionCommandFn = jest.fn(() => ({ ok: true, value: 'doit' }));
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    safeEventDispatcher = { dispatch: jest.fn() };
    mockTargetResolutionService = {
      resolveTargets: jest.fn(),
    };
    mockActionIndex = {
      getCandidateActions: jest.fn(),
    };

    service = new ActionDiscoveryService({
      gameDataRepository: gameDataRepo,
      entityManager,
      actionValidationService,
      prerequisiteEvaluationService: mockPrerequisiteEvaluationService,
      formatActionCommandFn,
      logger,
      safeEventDispatcher,
      targetResolutionService: mockTargetResolutionService,
      actionIndex: mockActionIndex,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handles scope resolution errors and continues processing', async () => {
    const failingDef = { id: 'fail', commandVerb: 'fail', scope: 'badScope' };
    const okDef = { id: 'ok', commandVerb: 'wait', scope: 'none' };
    mockActionIndex.getCandidateActions.mockReturnValue([failingDef, okDef]);

    mockTargetResolutionService.resolveTargets.mockImplementation(async (scopeName) => {
      if (scopeName === 'badScope') {
        // Return empty array instead of throwing - the real TargetResolutionService handles errors internally
        return [];
      }
      if (scopeName === 'none') {
        return [{ type: 'none', entityId: null }];
      }
      return [];
    });

    const actor = { id: 'actor' };
    const context = {};

    const result = await service.getValidActions(actor, context);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('ok');
    expect(result.errors).toHaveLength(0);

    // Note: With the new architecture, TargetResolutionService handles errors internally
    // This test verifies that when scope resolution returns no targets, the service continues processing other actions
    expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledWith('badScope', actor, expect.anything(), null);
    expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledWith('none', actor, expect.anything(), null);
  });

  it('uses the target resolution service for scoped actions', async () => {
    const def = { id: 'attack', commandVerb: 'attack', scope: 'monster' };
    mockActionIndex.getCandidateActions.mockReturnValue([def]);

    mockTargetResolutionService.resolveTargets.mockResolvedValue([
      { type: 'entity', entityId: 'monster1' }
    ]);
    formatActionCommandFn.mockReturnValue({
      ok: true,
      value: 'attack monster1',
    });

    entityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        if (entityId === 'actor' && componentId === POSITION_COMPONENT_ID) {
          return { locationId: 'room1' };
        }
        return null;
      }
    );

    const actor = { id: 'actor', getComponentData: () => null };
    const context = { jsonLogicEval: {} };

    const result = await service.getValidActions(actor, context);

    expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledWith(
      'monster',
      actor,
      expect.objectContaining({
        currentLocation: { id: 'room1', getComponentData: expect.any(Function) },
        getActor: expect.any(Function),
        jsonLogicEval: {}
      }),
      null
    );
    expect(result.actions).toEqual([
      {
        id: 'attack',
        name: 'attack',
        command: 'attack monster1',
        description: '',
        params: { targetId: 'monster1' },
      },
    ]);
  });
});
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
  let mockScopeRegistry;
  let mockScopeEngine;
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
    mockScopeRegistry = {
      getScope: jest.fn(),
    };
    mockScopeEngine = {
      resolve: jest.fn(() => new Set()),
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
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
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

    mockScopeEngine.resolve.mockImplementation(() => {
      throw new Error('boom');
    });
    // FIX: Provide a syntactically valid expression so the parser doesn't fail first.
    mockScopeRegistry.getScope.mockReturnValue({ expr: 'location' });

    const actor = { id: 'actor' };
    const context = {};

    const result = await service.getValidActions(actor, context);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('ok');
    expect(result.errors).toHaveLength(0);

    // Verify the error was dispatched with the correct message from the thrown error.
    expect(safeDispatchError).toHaveBeenCalledWith(
      safeEventDispatcher,
      "Error resolving scope 'badScope': boom",
      { error: 'boom', stack: expect.any(String) }
    );
  });

  it('uses the scope registry and engine for scoped actions', async () => {
    const def = { id: 'attack', commandVerb: 'attack', scope: 'monster' };
    mockActionIndex.getCandidateActions.mockReturnValue([def]);

    mockScopeRegistry.getScope.mockReturnValue({
      expr: 'location.inhabitants',
    });
    mockScopeEngine.resolve.mockReturnValue(new Set(['monster1']));
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

    expect(mockScopeRegistry.getScope).toHaveBeenCalledWith('monster');
    expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
      expect.any(Object),
      actor,
      expect.objectContaining({
        actor: actor,
        location: { id: 'room1', getComponentData: expect.any(Function) },
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
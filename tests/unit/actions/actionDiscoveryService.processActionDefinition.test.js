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

describe('ActionDiscoveryService - processActionDefinition', () => {
  let service;
  let gameDataRepo;
  let entityManager;
  let actionValidationService;
  let formatActionCommandFn;
  let logger;
  let safeEventDispatcher;
  let mockScopeRegistry;
  let mockScopeEngine;

  beforeEach(() => {
    gameDataRepo = { getAllActionDefinitions: jest.fn() };
    entityManager = {
      // FIX: The mock location must be a more realistic entity object with methods.
      getEntityInstance: jest.fn((id) =>
        id === 'room1'
          ? { id: 'room1', getComponentData: () => null } // Give it a getComponentData method
          : null
      ),
      getComponentData: jest.fn().mockReturnValue(null),
    };
    actionValidationService = { isValid: () => true };
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

    service = new ActionDiscoveryService({
      gameDataRepository: gameDataRepo,
      entityManager,
      actionValidationService,
      formatActionCommandFn,
      logger,
      safeEventDispatcher,
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handles handler errors and continues processing', async () => {
    const failingDef = { id: 'fail', commandVerb: 'fail', scope: 'none' };
    const okDef = { id: 'ok', commandVerb: 'wait', scope: 'none' };
    gameDataRepo.getAllActionDefinitions.mockReturnValue([failingDef, okDef]);

    actionValidationService.isValid = jest.fn((actionDef) => {
      if (actionDef.id === 'fail') throw new Error('boom');
      return true;
    });

    const actor = { id: 'actor' };
    const context = {};

    const result = await service.getValidActions(actor, context);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('ok');
    expect(result.errors).toHaveLength(1);
    expect(safeDispatchError).toHaveBeenCalledTimes(1);
  });

  it('uses the scope registry and engine for scoped actions', async () => {
    const def = { id: 'attack', commandVerb: 'attack', scope: 'monster' };
    gameDataRepo.getAllActionDefinitions.mockReturnValue([def]);

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

    // Assert that the new dependencies were called correctly
    expect(mockScopeRegistry.getScope).toHaveBeenCalledWith('monster');
    // The call should now succeed.
    expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
      expect.any(Object), // AST
      actor,
      expect.objectContaining({
        actor: actor,
        location: { id: 'room1', getComponentData: expect.any(Function) }, // The location is now a valid object.
      })
    );

    // Assert the final result is as expected
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

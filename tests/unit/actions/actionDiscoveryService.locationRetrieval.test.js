/**
 * @file Test suite to cover the location retrieval of ActionDiscoveryService.
 * @see tests/actions/actionDiscoveryService.locationRetrieval.test.js
 */

import { jest, test, expect, beforeEach } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

describe('ActionDiscoveryService – scoped discovery', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  /** Simple "go" + "wait" defs – enough for the test */
  const gameDataRepository = {
    getAllActionDefinitions: () => [
      {
        id: 'core:go',
        name: 'Go',
        commandVerb: 'go',
        scope: 'directions', // This scope name will be used to look up the definition
        description: 'Move to another location',
      },
      {
        id: 'core:wait',
        name: 'Wait',
        commandVerb: 'wait',
        scope: 'none',
      },
    ],
  };

  /** Stub EntityManager that can find the actor's position */
  const entityManager = {
    getComponentData: (entityId, compId) =>
      compId === 'core:position' ? { locationId: 'loc-1' } : null,
    // The service now prepares a 'currentLocation' itself, so this mock can be simpler.
    getEntityInstance: (id) => (id === 'loc-1' ? { id: 'loc-1' } : null),
  };

  const actionValidationService = { isValid: () => true };

  const formatActionCommandFn = (def, ctx) => {
    if (ctx.entityId) {
      return { ok: true, value: `${def.commandVerb} ${ctx.entityId}` };
    }
    return { ok: true, value: def.commandVerb };
  };

  const safeEventDispatcher = { dispatch: jest.fn() };

  // --- REFACTORED MOCKS to match the new service dependencies ---
  // 1. Mock the scope registry to return a valid scope definition
  const scopeRegistry = {
    getScope: jest.fn((scopeName) => {
      if (scopeName === 'directions') {
        return { expr: 'location.core:exits[].target' }; // A valid expression is needed for the parser
      }
      return null;
    }),
  };

  // 2. Mock the scope engine to return the desired set of IDs
  const mockScopeEngine = {
    resolve: jest.fn(() => new Set(['loc-2', 'loc-3'])),
  };

  // --- INSTANTIATE THE SERVICE with the new, correct dependencies ---
  const service = new ActionDiscoveryService({
    gameDataRepository,
    entityManager,
    actionValidationService,
    logger,
    formatActionCommandFn,
    safeEventDispatcher,
    scopeRegistry,
    scopeEngine: mockScopeEngine,
    actionIndex: {
      getCandidateActions: jest.fn().mockImplementation(() => {
        return gameDataRepository.getAllActionDefinitions();
      })
    },
  });

  /** Bare-bones actor / context objects */
  const actorEntity = { id: 'actor-1', getComponentData: () => null };
  const context = {
    // The context passed in can be simpler now as the service prepares its own discovery context
    jsonLogicEval: {}, // Provide a mock for jsonLogicEval if the scope requires it for filtering
  };

  test('discovers scoped actions based on scope resolution', async () => {
    const result = await service.getValidActions(actorEntity, context);

    // The 'core:go' action should be discovered for each target ID from the scope.
    const goActions = result.actions.filter((a) => a.id === 'core:go');
    expect(goActions).toHaveLength(2);

    const target2Action = goActions.find((a) => a.params.targetId === 'loc-2');
    expect(target2Action).toBeDefined();
    expect(target2Action.command).toBe('go loc-2');

    const target3Action = goActions.find((a) => a.params.targetId === 'loc-3');
    expect(target3Action).toBeDefined();
    expect(target3Action.command).toBe('go loc-3');

    // Also check that the 'wait' action is still there.
    const waitAction = result.actions.find((a) => a.id === 'core:wait');
    expect(waitAction).toBeDefined();
    expect(waitAction.command).toBe('wait');

    expect(logger.error).not.toHaveBeenCalled();
  });
});

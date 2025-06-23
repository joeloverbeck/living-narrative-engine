/**
 * @file Test suite to cover the location retrieval of ActionDiscoveryService.
 * @see tests/actions/actionDiscoveryService.locationRetrieval.test.js
 */

import { jest } from '@jest/globals';
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
        scope: 'directions',
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

  /** Minimal mock location entity exposing exits */
  const locationEntity = {
    id: 'loc-1',
    getComponentData: (compId) =>
      compId === 'core:exits'
        ? [
            { direction: 'north', target: 'loc-2' },
            { direction: 'south', target: 'loc-3' },
          ]
        : null,
  };

  /** Stub EntityManager: position → loc-1, plus entity lookup */
  const entityManager = {
    getComponentData: (entityId, compId) =>
      compId === 'core:position' ? { locationId: 'loc-1' } : null,
    getEntityInstance: (id) => (id === 'loc-1' ? locationEntity : null),
  };

  const actionValidationService = { isValid: () => true };

  const formatActionCommandFn = (def, ctx) => {
    if (ctx.entityId) {
      return `${def.commandVerb} ${ctx.entityId}`;
    }
    return def.commandVerb;
  };

  const getEntityIdsForScopesFn = (scopes, context, logger) => {
    // This mock simulates the scope resolver finding targets.
    if (scopes.includes('directions')) {
      // In a real scenario, this would use the context to find the current
      // location's exits. For this test, we simulate finding two targets.
      return new Set(['loc-2', 'loc-3']);
    }
    return new Set();
  };

  const safeEventDispatcher = { dispatch: jest.fn() };

  const service = new ActionDiscoveryService({
    gameDataRepository,
    entityManager,
    actionValidationService,
    logger,
    formatActionCommandFn,
    getEntityIdsForScopesFn,
    safeEventDispatcher,
  });

  /** Bare-bones actor / context objects */
  const actorEntity = { id: 'actor-1', getComponentData: () => null };
  const context = {
    getActor: () => actorEntity,
    getLogger: () => logger,
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

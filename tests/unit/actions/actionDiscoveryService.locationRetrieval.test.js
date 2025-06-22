/**
 * @file Test suite to cover the location retrieval of ActionDiscoveryService.
 * @see tests/actions/actionDiscoveryService.locationRetrieval.test.js
 */

import { jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

describe('ActionDiscoveryService – directional discovery', () => {
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

  const formatActionCommandFn = (def, ctx) =>
    def.id === 'core:go' ? `go ${ctx.direction}` : def.commandVerb;

  const getEntityIdsForScopesFn = () => [];

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
    currentLocation: undefined, // ← deliberately missing
    getActor: () => actorEntity,
    getLogger: () => logger,
  };

  test('does not throw when currentLocation is undefined and discovers directional actions', async () => {
    const result = await service.getValidActions(actorEntity, context);

    const goNorth = result.actions.find((a) => a.id === 'core:go');
    expect(goNorth).toBeDefined();
    expect(goNorth.command).toBe('go north');

    expect(logger.error).not.toHaveBeenCalled();
  });
});

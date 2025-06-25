/**
 * @file Test suite to cover the location retrieval of ActionDiscoveryService.
 * @see tests/actions/actionDiscoveryService.locationRetrieval.test.js
 */

import { jest, test, expect } from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';

describe('ActionDiscoveryService – scoped discovery', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  // FIX: Add prerequisites to the action definitions to ensure the evaluate method is called.
  const gameDataRepository = {
    getAllActionDefinitions: () => [
      {
        id: 'core:go',
        name: 'Go',
        commandVerb: 'go',
        scope: 'directions',
        description: 'Move to another location',
        prerequisites: [{ logic: { "==": [1, 1] } }], // <-- The fix
      },
      {
        id: 'core:wait',
        name: 'Wait',
        commandVerb: 'wait',
        scope: 'none',
        prerequisites: [{ logic: { "==": [1, 1] } }], // <-- The fix
      },
    ],
  };

  const entityManager = {
    getComponentData: (entityId, compId) =>
      compId === 'core:position' ? { locationId: 'loc-1' } : null,
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

  const scopeRegistry = {
    getScope: jest.fn((scopeName) => {
      if (scopeName === 'directions') {
        return { expr: 'location.exits[].target' };
      }
      return null;
    }),
  };

  const mockScopeEngine = {
    resolve: jest.fn(() => new Set(['loc-2', 'loc-3'])),
  };

  const mockPrerequisiteEvaluationService = {
    evaluate: jest.fn().mockReturnValue(true),
  };

  const service = new ActionDiscoveryService({
    gameDataRepository,
    entityManager,
    actionValidationService,
    prerequisiteEvaluationService: mockPrerequisiteEvaluationService,
    logger,
    formatActionCommandFn,
    safeEventDispatcher,
    scopeRegistry,
    scopeEngine: mockScopeEngine,
    actionIndex: {
      getCandidateActions: jest
        .fn()
        .mockImplementation(() =>
          gameDataRepository.getAllActionDefinitions()
        ),
    },
  });

  const actorEntity = { id: 'actor-1', getComponentData: () => null };
  const context = {
    jsonLogicEval: {},
  };

  test('discovers scoped actions based on scope resolution', async () => {
    const result = await service.getValidActions(actorEntity, context);

    const goActions = result.actions.filter((a) => a.id === 'core:go');
    expect(goActions).toHaveLength(2);

    const target2Action = goActions.find((a) => a.params.targetId === 'loc-2');
    expect(target2Action).toBeDefined();
    expect(target2Action.command).toBe('go loc-2');

    const target3Action = goActions.find((a) => a.params.targetId === 'loc-3');
    expect(target3Action).toBeDefined();
    expect(target3Action.command).toBe('go loc-3');

    const waitAction = result.actions.find((a) => a.id === 'core:wait');
    expect(waitAction).toBeDefined();
    expect(waitAction.command).toBe('wait');

    expect(logger.error).not.toHaveBeenCalled();
    // Verify that the prerequisite service was called for both actions, now that they have prereqs.
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledTimes(2);
  });
});
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { ActionDiscoveryService } from '../../src/actions/actionDiscoveryService.js';

/** Simple attack definition for testing */
const attackDef = {
  id: 'core:attack',
  name: 'Attack',
  commandVerb: 'attack',
  description: 'Attack target',
  target_domain: 'entity',
};

describe('ActionDiscoveryService collectValidTargets helper', () => {
  let service;

  beforeEach(() => {
    const gameDataRepo = { getAllActionDefinitions: () => [attackDef] };
    const entityManager = {
      getEntityInstance: (id) => ({ id }),
      getComponentData: () => null,
    };
    const actionValidationService = {
      isValid: jest.fn((def, actor, ctx) => ctx.entityId === 'rat123'),
    };
    const formatActionCommandFn = jest.fn(
      (def, ctx) => `attack ${ctx.entityId}`
    );
    const getEntityIdsForScopesFn = () => new Set(['rat123', 'bat456']);
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    const safeEventDispatcher = { dispatch: jest.fn() };

    service = new ActionDiscoveryService({
      gameDataRepository: gameDataRepo,
      entityManager,
      actionValidationService,
      formatActionCommandFn,
      getEntityIdsForScopesFn,
      logger,
      safeEventDispatcher,
    });
  });

  it('returns actions only for valid targets', async () => {
    const actor = { id: 'player1' };
    const context = { currentLocation: null };
    const actions = await service.getValidActions(actor, context);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      id: 'core:attack',
      command: 'attack rat123',
      params: { targetId: 'rat123' },
    });
  });
});

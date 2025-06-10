import { jest, describe, beforeEach, expect } from '@jest/globals';

import { ActionDiscoveryService } from '../../src/actions/actionDiscoveryService.js';

describe('ActionDiscoveryService params exposure', () => {
  const dummyActionDef = {
    id: 'core:attack',
    name: 'Attack',
    commandVerb: 'attack',
    description: 'Attack target',
    target_domain: 'entity',
  };

  let service;

  beforeEach(() => {
    const gameDataRepo = { getAllActionDefinitions: () => [dummyActionDef] };
    const entityManager = {
      getEntityInstance: (id) => ({ id }),
      getComponentData: () => null,
    };
    const actionValidationService = {
      isValid: () => true,
    };
    const formatActionCommandFn = () => 'attack rat123';
    const getEntityIdsForScopesFn = () => new Set(['rat123']);
    const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

    service = new ActionDiscoveryService({
      gameDataRepository: gameDataRepo,
      entityManager,
      actionValidationService,
      formatActionCommandFn,
      getEntityIdsForScopesFn,
      logger,
    });
  });

  it('should include params.targetId for entity‐domain actions', async () => {
    const actor = { id: 'player1' };
    const context = { currentLocation: null };
    const actions = await service.getValidActions(actor, context);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      id: 'core:attack',
      params: { targetId: 'rat123' },
    });
  });
});

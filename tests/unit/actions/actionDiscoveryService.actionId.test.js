import { jest, describe, beforeEach, expect, it } from '@jest/globals';

import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('ActionDiscoveryService params exposure', () => {
  const dummyActionDef = {
    id: 'core:attack',
    name: 'Attack',
    commandVerb: 'attack',
    description: 'Attack target',
    scope: 'enemies', // The action now needs a scope name
  };

  let service;
  let mockScopeRegistry;
  let mockScopeEngine;

  beforeEach(() => {
    const gameDataRepo = { getAllActionDefinitions: () => [dummyActionDef] };
    const entityManager = {
      getEntityInstance: (id) => {
        if (id === 'some-room') {
          return { id: 'some-room', getComponentData: () => null };
        }
        if (id === 'rat123') {
          return { id: 'rat123', getComponentData: () => null };
        }
        return null;
      },
      getComponentData: (entityId, componentId) => {
        // This mock needs to be specific to the actor to be realistic
        if (entityId === 'player1' && componentId === POSITION_COMPONENT_ID) {
          return { locationId: 'some-room' };
        }
        return null;
      },
    };
    const actionValidationService = {
      isValid: () => true,
    };
    const formatActionCommandFn = () => ({ ok: true, value: 'attack rat123' });
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    const safeEventDispatcher = { dispatch: jest.fn() };

    mockScopeRegistry = {
      getScope: jest.fn((scopeName) => {
        if (scopeName === 'enemies') {
          // FIX: The expression must be syntactically valid for the REAL parser.
          // The pipe character '|' is not supported. A simple property chain is sufficient
          // because the scopeEngine is mocked and won't execute this anyway.
          return { expr: 'location.inhabitants' };
        }
        return null;
      }),
    };
    mockScopeEngine = {
      resolve: jest.fn(() => new Set(['rat123'])),
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

  it('should include params.targetId for entity-scoped actions', async () => {
    const actor = {
      id: 'player1',
      getComponentData: () => null,
      // Add other methods to satisfy a potential `isValidEntity` check, making the mock more robust
      addComponent: jest.fn(),
      removeComponent: jest.fn(),
    };
    const context = {
      // The context must provide a jsonLogicEval object for the scope engine's runtime context
      jsonLogicEval: {},
    };
    const result = await service.getValidActions(actor, context);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      id: 'core:attack',
      params: { targetId: 'rat123' },
    });
  });
});

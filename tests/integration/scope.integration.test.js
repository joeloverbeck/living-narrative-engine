/**
 * @file Test suite to ensure the context get the necessary data so down the line the scope can be processed.
 * @description Integration test for the DSL-only scope system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { getEntityIdsForScopes } from '../../src/entities/entityScopeService.js';
import { TurnContext } from '../../src/turns/context/turnContext.js';

// Mock the Scope DSL dependencies
jest.mock('../../src/scopeDsl/scopeRegistry.js', () => ({
  ScopeRegistry: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../src/scopeDsl/parser.js', () => ({
  parseInlineExpr: jest.fn()
}));

jest.mock('../../src/scopeDsl/engine.js', () => ({
  ScopeEngine: jest.fn()
}));

// Import the mocked modules
import { ScopeRegistry } from '../../src/scopeDsl/scopeRegistry.js';
import { parseInlineExpr } from '../../src/scopeDsl/parser.js';
import { ScopeEngine } from '../../src/scopeDsl/engine.js';

/* ---------------------------------------------------------------- *\
   Cheap stub implementations – just enough for the scope helpers.
\* ---------------------------------------------------------------- */
const makeStubEntity = (id, comps = {}) => ({
  id,
  hasComponent: (cmpId) => !!comps[cmpId],
  getComponentData: (cmpId) => comps[cmpId],
});

const stubManager = (world = {}) => ({
  getEntitiesInLocation: (locId) => world[locId] ?? [],
  getEntityInstance: (id) => world.__instances[id] ?? null,
  getComponentData: (id, cmpId) =>
    world.__instances[id]?.getComponentData(cmpId) ?? null,
});

/* ---------------------------------------------------------------- */

describe('entityScopeService integration', () => {
  let mockScopeRegistryInstance;
  let mockScopeEngine;

  beforeEach(() => {
    jest.resetAllMocks();
    
    mockScopeRegistryInstance = {
      getScope: jest.fn()
    };
    ScopeRegistry.getInstance.mockReturnValue(mockScopeRegistryInstance);

    mockScopeEngine = {
      resolve: jest.fn()
    };
    ScopeEngine.mockImplementation(() => mockScopeEngine);
  });

  test('environment scope is resolved using DSL engine when TurnContext exposes entityManager', () => {
    // Arrange world
    const ratId = 'npc-rat';
    const roomId = 'room-1';
    const playerId = 'pc-123';

    const world = {
      [roomId]: [playerId, ratId],
      __instances: {
        [playerId]: makeStubEntity(playerId, {
          'core:position': { locationId: roomId },
        }),
        [ratId]: makeStubEntity(ratId, {}),
        [roomId]: makeStubEntity(roomId, {}),
      },
    };

    const em = stubManager(world);

    // Mock the scope definition and resolution
    const mockAst = { type: 'environment' };
    const environmentScope = { expr: 'entities(core:position)[{"and": [{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}, {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]}]' };
    
    mockScopeRegistryInstance.getScope.mockReturnValue(environmentScope);
    parseInlineExpr.mockReturnValue(mockAst);
    mockScopeEngine.resolve.mockReturnValue(new Set([ratId]));

    // Build a minimal TurnContext
    const ctx = new TurnContext({
      actor: world.__instances[playerId],
      logger: console,
      strategy: { decideAction: async () => null }, // not used
      handlerInstance: { requestIdleStateTransition: () => Promise.resolve() },
      onEndTurnCallback: () => {},
      services: { entityManager: em },
    });

    // Act
    const environmentSet = getEntityIdsForScopes('environment', ctx, console);

    // Assert
    expect(environmentSet.has(ratId)).toBe(true);
    expect(environmentSet.has(playerId)).toBe(false); // self filtered
    expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith('environment');
    expect(parseInlineExpr).toHaveBeenCalledWith(environmentScope.expr);
    expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
      mockAst,
      playerId,
      {
        entityManager: em,
        spatialIndexManager: undefined,
        jsonLogicEval: undefined,
        logger: console
      }
    );
  });
});

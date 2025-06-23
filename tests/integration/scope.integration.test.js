/**
 * @file Test suite to ensure the context get the necessary data so down the line the scope can be processed.
 * @description Integration test for the DSL-only scope system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { getEntityIdsForScopes } from '../../src/entities/entityScopeService.js';
import { TurnContext } from '../../src/turns/context/turnContext.js';
import { NullConsole } from '../common/stubs/nullConsole.js';

// Mock the Scope DSL dependencies
jest.mock('../../src/scopeDsl/scopeRegistry.js', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  },
  ScopeRegistry: {
    getInstance: jest.fn(),
  },
}));

jest.mock('../../src/scopeDsl/parser.js', () => ({
  parseDslExpression: jest.fn(),
}));

jest.mock('../../src/scopeDsl/engine.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Import the mocked modules
import { parseDslExpression } from '../../src/scopeDsl/parser.js';
import ScopeEngine from '../../src/scopeDsl/engine.js';
import { POSITION_COMPONENT_ID } from '../../src/constants/componentIds.js';

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
  let logger;

  beforeEach(() => {
    jest.resetAllMocks();
    logger = new NullConsole();

    mockScopeRegistryInstance = {
      getScope: jest.fn(),
    };
    // Set both default and named exports for getInstance
    const scopeRegistryModule = require('../../src/scopeDsl/scopeRegistry.js');
    scopeRegistryModule.default.getInstance.mockReturnValue(
      mockScopeRegistryInstance
    );
    scopeRegistryModule.ScopeRegistry.getInstance.mockReturnValue(
      mockScopeRegistryInstance
    );

    mockScopeEngine = {
      resolve: jest.fn(),
    };
    ScopeEngine.mockImplementation(() => mockScopeEngine);
    // Also set the default export for the constructor
    const engineModule = require('../../src/scopeDsl/engine.js');
    engineModule.default.mockImplementation(() => mockScopeEngine);
  });

  test('environment scope is resolved using DSL engine when TurnContext exposes entityManager', () => {
    // Arrange world
    const ratId = 'npc-rat';
    const roomId = 'room-1';
    const playerId = 'pc-123';

    const playerEntity = makeStubEntity(playerId, {
      [POSITION_COMPONENT_ID]: { locationId: roomId },
    });
    const ratEntity = makeStubEntity(ratId, {
      [POSITION_COMPONENT_ID]: { locationId: roomId },
    });
    const roomEntity = makeStubEntity(roomId, {});

    const world = {
      [roomId]: [playerEntity, ratEntity],
      __instances: {
        [playerId]: playerEntity,
        [ratId]: ratEntity,
        [roomId]: roomEntity,
      },
    };

    const em = stubManager(world);

    // Mock the scope definition and resolution
    const mockAst = { type: 'environment' };
    const environmentScope = {
      expr: 'entities(core:position)[{"and": [{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}, {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]}]',
    };

    mockScopeRegistryInstance.getScope.mockReturnValue(environmentScope);
    parseDslExpression.mockReturnValue(mockAst);
    mockScopeEngine.resolve.mockReturnValue(new Set([ratId]));

    // Build a minimal TurnContext
    const ctx = new TurnContext({
      actor: playerEntity,
      logger: logger,
      strategy: { decideAction: async () => null }, // not used
      handlerInstance: { requestIdleStateTransition: () => Promise.resolve() },
      onEndTurnCallback: () => {},
      services: { entityManager: em },
    });

    // Act
    const environmentSet = getEntityIdsForScopes('environment', ctx, logger);

    // Assert
    expect(environmentSet.has(ratId)).toBe(true);
    expect(environmentSet.has(playerId)).toBe(false); // self filtered
    expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
      'environment'
    );
    expect(parseDslExpression).toHaveBeenCalledWith(environmentScope.expr);
    expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
      mockAst,
      playerEntity, // Correct: The full entity object
      {
        entityManager: em,
        spatialIndexManager: undefined,
        jsonLogicEval: undefined, // Correct, not provided by this context
        logger: logger,
        actor: playerEntity, // Correct: The service now adds the actor to the runtime context
        location: roomEntity, // Correct: The service adds location from the TurnContext
      }
    );
  });
});

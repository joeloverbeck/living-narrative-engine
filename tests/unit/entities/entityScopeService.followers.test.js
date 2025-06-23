/**
 * @file This test suite tests the scope 'followers' of entityScopeService.
 * @description Tests for the followers scope using the DSL engine
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { getEntityIdsForScopes } from '../../../src/entities/entityScopeService.js';

// Mock the Scope DSL dependencies
jest.mock('../../../src/scopeDsl/scopeRegistry.js', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  },
  ScopeRegistry: {
    getInstance: jest.fn(),
  },
}));

jest.mock('../../../src/scopeDsl/parser.js', () => ({
  parseDslExpression: jest.fn(),
}));

jest.mock('../../../src/scopeDsl/engine.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Import the mocked modules
import { ScopeRegistry } from '../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

describe('entityScopeService - "followers" scope', () => {
  let mockLogger;
  let mockEntityManager;
  let mockScopeRegistryInstance;
  let mockScopeEngine;

  beforeEach(() => {
    jest.resetAllMocks();

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getEntitiesInLocation: jest.fn(),
    };

    mockScopeRegistryInstance = {
      getScope: jest.fn(),
    };
    const scopeRegistryModule = require('../../../src/scopeDsl/scopeRegistry.js');
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
    const engineModule = require('../../../src/scopeDsl/engine.js');
    engineModule.default.mockImplementation(() => mockScopeEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should resolve followers scope using DSL engine', () => {
    const mockAst = { type: 'followers' };
    const mockScopeDefinition = { expr: 'actor.core:leading.followers[]' };
    const followerIds = ['npc:1', 'npc:2'];
    const expectedIds = new Set(followerIds);
    const actingEntity = { id: 'player:1' };

    mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);
    parseDslExpression.mockReturnValue(mockAst);
    mockScopeEngine.resolve.mockReturnValue(expectedIds);

    const context = {
      actingEntity: actingEntity,
      entityManager: mockEntityManager,
      spatialIndexManager: {},
      jsonLogicEval: {},
      location: undefined,
    };

    const result = getEntityIdsForScopes('followers', context, mockLogger);

    expect(result).toEqual(expectedIds);
    expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
      'followers'
    );
    expect(parseDslExpression).toHaveBeenCalledWith(
      'actor.core:leading.followers[]'
    );
    expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
      mockAst,
      actingEntity, // Expect the full entity object
      {
        entityManager: mockEntityManager,
        spatialIndexManager: {},
        jsonLogicEval: {},
        logger: mockLogger,
        actor: actingEntity, // Expect actor in runtime context
        location: undefined, // Expect location in runtime context
      }
    );
  });

  test('should return empty set when followers scope not found in registry', () => {
    mockScopeRegistryInstance.getScope.mockReturnValue(null);

    const context = {
      actingEntity: { id: 'player:1' },
      entityManager: mockEntityManager,
    };

    const result = getEntityIdsForScopes('followers', context, mockLogger);

    expect(result).toEqual(new Set());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Scope 'followers' not found or has no expression in registry"
    );
  });

  test('should return empty set when actingEntity is missing', () => {
    const mockScopeDefinition = { expr: 'actor.core:leading.followers[]' };
    mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);

    const context = {
      actingEntity: null, // Test for a missing entity object
      entityManager: mockEntityManager,
    };

    const result = getEntityIdsForScopes('followers', context, mockLogger);

    expect(result).toEqual(new Set());
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Cannot resolve scope: actingEntity is missing'
    );
  });

  test('should handle DSL parsing errors gracefully', () => {
    const mockScopeDefinition = { expr: 'invalid followers expression' };
    const parseError = new Error('Parse error');

    mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);
    parseDslExpression.mockImplementation(() => {
      throw parseError;
    });

    const context = {
      actingEntity: { id: 'player:1' },
      entityManager: mockEntityManager,
    };

    const result = getEntityIdsForScopes('followers', context, mockLogger);

    expect(result).toEqual(new Set());
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error resolving scope 'followers' with DSL:",
      parseError
    );
  });

  test('should handle scope engine resolution errors gracefully', () => {
    const mockAst = { type: 'followers' };
    const mockScopeDefinition = { expr: 'actor.core:leading.followers[]' };
    const resolveError = new Error('Resolution error');

    mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);
    parseDslExpression.mockReturnValue(mockAst);
    mockScopeEngine.resolve.mockImplementation(() => {
      throw resolveError;
    });

    const context = {
      actingEntity: { id: 'player:1' },
      entityManager: mockEntityManager,
      spatialIndexManager: {},
      jsonLogicEval: {},
    };

    const result = getEntityIdsForScopes('followers', context, mockLogger);

    expect(result).toEqual(new Set());
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error resolving scope 'followers' with DSL:",
      resolveError
    );
  });

  test('should aggregate follower IDs when requested with other scopes', () => {
    const mockAst = { type: 'test' };
    const followersScope = { expr: 'actor.core:leading.followers[]' };
    const inventoryScope = { expr: 'actor.inventory[]' };

    mockScopeRegistryInstance.getScope
      .mockReturnValueOnce(followersScope)
      .mockReturnValueOnce(inventoryScope);

    parseDslExpression.mockReturnValue(mockAst);
    mockScopeEngine.resolve
      .mockReturnValueOnce(new Set(['npc:1', 'npc:2']))
      .mockReturnValueOnce(new Set(['item:sword']));

    const context = {
      actingEntity: { id: 'player:1' },
      entityManager: mockEntityManager,
      spatialIndexManager: {},
      jsonLogicEval: {},
    };

    const result = getEntityIdsForScopes(
      ['followers', 'inventory'],
      context,
      mockLogger
    );

    expect(result).toEqual(new Set(['npc:1', 'npc:2', 'item:sword']));
    expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
      'followers'
    );
    expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
      'inventory'
    );
  });
});

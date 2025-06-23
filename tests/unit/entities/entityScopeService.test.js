/**
 * @file This module covers the functionality of entityScopeService.js
 * @description Tests for the DSL-only scope resolution service
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
  ScopeRegistry: jest.fn().mockImplementation(() => ({
    getScope: jest.fn(),
    // Add other methods if ScopeRegistry instances are expected to have them
  })),
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

describe('entityScopeService', () => {
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
    // Set both default and named exports for getInstance
    // const scopeRegistryModule = require('../../../src/scopeDsl/scopeRegistry.js');
    // scopeRegistryModule.default.getInstance.mockReturnValue(
    //   mockScopeRegistryInstance
    // );
    // scopeRegistryModule.ScopeRegistry.getInstance.mockReturnValue(
    //   mockScopeRegistryInstance
    // );

    mockScopeEngine = {
      resolve: jest.fn(),
    };
    ScopeEngine.mockImplementation(() => mockScopeEngine);
    // Also set the default export for the constructor
    // const engineModule = require('../../../src/scopeDsl/engine.js');
    // engineModule.default.mockImplementation(() => mockScopeEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEntityIdsForScopes', () => {
    test('should return empty set if context is null', () => {
      const result = getEntityIdsForScopes('followers', null, mockScopeRegistryInstance, mockLogger);
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith(
        'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
        { context: null }
      );
    });

    test('should return empty set if entityManager is missing', () => {
      const context = { actingEntity: { id: 'player' } };
      const result = getEntityIdsForScopes('followers', context, mockScopeRegistryInstance, mockLogger);
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith(
        'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
        { context }
      );
    });

    test('should handle "none" scope by returning empty set', () => {
      const context = { entityManager: mockEntityManager };
      const result = getEntityIdsForScopes('none', context, mockScopeRegistryInstance, mockLogger);
      expect(result).toEqual(new Set());
      expect(mockScopeRegistryInstance.getScope).not.toHaveBeenCalled();
    });

    test('should handle "direction" scope by returning empty set', () => {
      const context = { actor: { id: 'actor1' }, entityManager: {} };
      mockScopeRegistryInstance.getScope.mockReturnValue({ expr: 'direction' });
      const result = getEntityIdsForScopes('direction', context, mockScopeRegistryInstance, mockLogger);
      expect(result).toEqual(new Set());
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
        'direction'
      );
    });

    test('should handle multiple scopes including special ones', () => {
      const followersScope = { expr: 'actor.core:leading.followers[]' };
      mockScopeRegistryInstance.getScope
        .mockReturnValueOnce(undefined) // for 'direction'
        .mockReturnValueOnce(followersScope);
      mockScopeEngine.resolve.mockReturnValue(new Set(['follower1']));

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
      };

      const result = getEntityIdsForScopes(
        ['none', 'direction', 'followers'],
        context,
        mockScopeRegistryInstance,
        mockLogger,
        mockScopeEngine
      );

      // 'none' is skipped, 'direction' fails and logs a warning, 'followers' resolves
      expect(result).toEqual(new Set(['follower1']));
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
        'direction'
      );
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
        'followers'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Scope 'direction' not found or has no expression in registry"
      );
    });

    test('should resolve scope using DSL engine when scope exists in registry', () => {
      const mockAst = { type: 'test' };
      const mockScopeDefinition = { expr: 'actor.core:leading.followers[]' };
      const expectedIds = new Set(['follower1', 'follower2']);
      const actingEntity = { id: 'player' };

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

      const result = getEntityIdsForScopes('followers', context, mockScopeRegistryInstance, mockLogger, mockScopeEngine);

      expect(result).toEqual(expectedIds);
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
        'followers'
      );
      expect(parseDslExpression).toHaveBeenCalledWith(
        'actor.core:leading.followers[]'
      );
      expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
        mockAst,
        actingEntity, // Now expects the full entity object
        {
          entityManager: mockEntityManager,
          spatialIndexManager: {},
          jsonLogicEval: {},
          logger: mockLogger,
          actor: actingEntity, // The runtime context should also contain the actor
          location: undefined, // And the location
        }
      );
    });

    test('should return empty set when scope not found in registry', () => {
      mockScopeRegistryInstance.getScope.mockReturnValue(null);

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes('unknown_scope', context, mockScopeRegistryInstance, mockLogger, mockScopeEngine);
      expect(result).toEqual(new Set());
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Scope 'unknown_scope' not found or has no expression in registry"
      );
    });

    test('should return empty set when actingEntity is missing', () => {
      const mockScopeDefinition = { expr: 'actor.core:leading.followers[]' };
      mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);
      // Context without actingEntity
      const context = {
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes('followers', context, mockScopeRegistryInstance, mockLogger, mockScopeEngine);
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot resolve scope: actingEntity is missing'
      );
    });

    test('should handle DSL parsing errors gracefully', () => {
      const mockScopeDefinition = { expr: 'invalid dsl' };
      const parseError = new Error('Parse error');
      mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);
      parseDslExpression.mockImplementation(() => {
        throw parseError;
      });
      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
      };
      const result = getEntityIdsForScopes('followers', context, mockScopeRegistryInstance, mockLogger, mockScopeEngine);
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error resolving scope 'followers' with DSL:",
        parseError
      );
    });

    test('should handle scope engine resolution errors gracefully', () => {
      const mockAst = { type: 'test' };
      const mockScopeDefinition = { expr: 'valid dsl' };
      const resolveError = new Error('Resolution error');
      mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);
      parseDslExpression.mockReturnValue(mockAst);
      mockScopeEngine.resolve.mockImplementation(() => {
        throw resolveError;
      });
      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
        spatialIndexManager: {},
        jsonLogicEval: {},
      };
      const result = getEntityIdsForScopes('followers', context, mockScopeRegistryInstance, mockLogger, mockScopeEngine);
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error resolving scope 'followers' with DSL:",
        resolveError
      );
    });

    test('should aggregate results from multiple scopes', () => {
      const mockAst = { type: 'test' };
      const followersScope = { expr: 'actor.core:leading.followers[]' };
      const environmentScope = {
        expr: 'entities(core:position)[{"and": [{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}, {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]}]',
      };

      mockScopeRegistryInstance.getScope
        .mockReturnValueOnce(followersScope)
        .mockReturnValueOnce(environmentScope);

      parseDslExpression.mockReturnValue(mockAst);
      mockScopeEngine.resolve
        .mockReturnValueOnce(new Set(['follower1', 'follower2']))
        .mockReturnValueOnce(new Set(['npc1', 'npc2']));

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
        spatialIndexManager: {},
        jsonLogicEval: {},
      };

      const result = getEntityIdsForScopes(
        ['followers', 'environment'],
        context,
        mockScopeRegistryInstance,
        mockLogger,
        mockScopeEngine
      );

      expect(result).toEqual(
        new Set(['follower1', 'follower2', 'npc1', 'npc2'])
      );
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
        'followers'
      );
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith(
        'environment'
      );
    });

    test('should handle mixed valid and invalid scopes', () => {
      const mockAst = { type: 'test' };
      const followersScope = { expr: 'actor.core:leading.followers[]' };

      mockScopeRegistryInstance.getScope
        .mockReturnValueOnce(followersScope)
        .mockReturnValueOnce(null);

      parseDslExpression.mockReturnValue(mockAst);
      mockScopeEngine.resolve.mockReturnValue(new Set(['follower1']));

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
        spatialIndexManager: {},
        jsonLogicEval: {},
      };

      const result = getEntityIdsForScopes(
        ['followers', 'invalid_scope'],
        context,
        mockScopeRegistryInstance,
        mockLogger,
        mockScopeEngine
      );

      expect(result).toEqual(new Set(['follower1']));
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Scope 'invalid_scope' not found or has no expression in registry"
      );
    });
  });
});

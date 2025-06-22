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
  default: {
    getInstance: jest.fn()
  },
  ScopeRegistry: {
    getInstance: jest.fn()
  }
}));

jest.mock('../../../src/scopeDsl/parser.js', () => ({
  parseInlineExpr: jest.fn()
}));

jest.mock('../../../src/scopeDsl/engine.js', () => ({
  __esModule: true,
  default: jest.fn()
}));

// Import the mocked modules
import { ScopeRegistry } from '../../../src/scopeDsl/scopeRegistry.js';
import { parseInlineExpr } from '../../../src/scopeDsl/parser.js';
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
      getScope: jest.fn()
    };
    // Set both default and named exports for getInstance
    const scopeRegistryModule = require('../../../src/scopeDsl/scopeRegistry.js');
    scopeRegistryModule.default.getInstance.mockReturnValue(mockScopeRegistryInstance);
    scopeRegistryModule.ScopeRegistry.getInstance.mockReturnValue(mockScopeRegistryInstance);

    mockScopeEngine = {
      resolve: jest.fn()
    };
    ScopeEngine.mockImplementation(() => mockScopeEngine);
    // Also set the default export for the constructor
    const engineModule = require('../../../src/scopeDsl/engine.js');
    engineModule.default.mockImplementation(() => mockScopeEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEntityIdsForScopes', () => {
    test('should return empty set if context is null', () => {
      const result = getEntityIdsForScopes('followers', null, mockLogger);
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith(
        'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
        { context: null }
      );
    });

    test('should return empty set if entityManager is missing', () => {
      const context = { actingEntity: { id: 'player' } };
      const result = getEntityIdsForScopes('followers', context, mockLogger);
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith(
        'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
        { context }
      );
    });

    test('should handle "none" scope by returning empty set', () => {
      const context = { entityManager: mockEntityManager };
      const result = getEntityIdsForScopes('none', context, mockLogger);
      expect(result).toEqual(new Set());
      expect(mockScopeRegistryInstance.getScope).not.toHaveBeenCalled();
    });

    test('should handle "direction" scope by returning empty set', () => {
      const context = { entityManager: mockEntityManager };
      const result = getEntityIdsForScopes('direction', context, mockLogger);
      expect(result).toEqual(new Set());
      expect(mockScopeRegistryInstance.getScope).not.toHaveBeenCalled();
    });

    test('should handle multiple scopes including special ones', () => {
      const context = { entityManager: mockEntityManager };
      const result = getEntityIdsForScopes(['none', 'direction', 'followers'], context, mockLogger);
      expect(result).toEqual(new Set());
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith('followers');
    });

    test('should resolve scope using DSL engine when scope exists in registry', () => {
      const mockAst = { type: 'test' };
      const mockScopeDefinition = { expr: 'actor.core:leading.followers[]' };
      const expectedIds = new Set(['follower1', 'follower2']);
      
      mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);
      parseInlineExpr.mockReturnValue(mockAst);
      mockScopeEngine.resolve.mockReturnValue(expectedIds);

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
        spatialIndexManager: {},
        jsonLogicEval: {}
      };

      const result = getEntityIdsForScopes('followers', context, mockLogger);
      
      expect(result).toEqual(expectedIds);
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith('followers');
      expect(parseInlineExpr).toHaveBeenCalledWith('actor.core:leading.followers[]');
      expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
        mockAst,
        'player',
        {
          entityManager: mockEntityManager,
          spatialIndexManager: {},
          jsonLogicEval: {},
          logger: mockLogger
        }
      );
    });

    test('should return empty set when scope not found in registry', () => {
      mockScopeRegistryInstance.getScope.mockReturnValue(null);

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager
      };

      const result = getEntityIdsForScopes('unknown_scope', context, mockLogger);
      
      expect(result).toEqual(new Set());
      expect(mockLogger.warn).toHaveBeenCalledWith("Scope 'unknown_scope' not found in registry");
    });

    test('should return empty set when actingEntity ID is missing', () => {
      const mockScopeDefinition = { expr: 'actor.core:leading.followers[]' };
      mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);

      const context = {
        actingEntity: null,
        entityManager: mockEntityManager
      };

      const result = getEntityIdsForScopes('followers', context, mockLogger);
      
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith('Cannot resolve scope: actingEntity ID is missing');
    });

    test('should handle DSL parsing errors gracefully', () => {
      const mockScopeDefinition = { expr: 'invalid expression' };
      const parseError = new Error('Parse error');
      
      mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);
      parseInlineExpr.mockImplementation(() => {
        throw parseError;
      });

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager
      };

      const result = getEntityIdsForScopes('followers', context, mockLogger);
      
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error resolving scope 'followers' with DSL:",
        parseError
      );
    });

    test('should handle scope engine resolution errors gracefully', () => {
      const mockAst = { type: 'test' };
      const mockScopeDefinition = { expr: 'actor.core:leading.followers[]' };
      const resolveError = new Error('Resolution error');
      
      mockScopeRegistryInstance.getScope.mockReturnValue(mockScopeDefinition);
      parseInlineExpr.mockReturnValue(mockAst);
      mockScopeEngine.resolve.mockImplementation(() => {
        throw resolveError;
      });

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
        spatialIndexManager: {},
        jsonLogicEval: {}
      };

      const result = getEntityIdsForScopes('followers', context, mockLogger);
      
      expect(result).toEqual(new Set());
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error resolving scope 'followers' with DSL:",
        resolveError
      );
    });

    test('should aggregate results from multiple scopes', () => {
      const mockAst = { type: 'test' };
      const followersScope = { expr: 'actor.core:leading.followers[]' };
      const environmentScope = { expr: 'entities(core:position)[{"and": [{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "location.id"}]}, {"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]}]' };
      
      mockScopeRegistryInstance.getScope
        .mockReturnValueOnce(followersScope)
        .mockReturnValueOnce(environmentScope);
      
      parseInlineExpr.mockReturnValue(mockAst);
      mockScopeEngine.resolve
        .mockReturnValueOnce(new Set(['follower1', 'follower2']))
        .mockReturnValueOnce(new Set(['npc1', 'npc2']));

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
        spatialIndexManager: {},
        jsonLogicEval: {}
      };

      const result = getEntityIdsForScopes(['followers', 'environment'], context, mockLogger);
      
      expect(result).toEqual(new Set(['follower1', 'follower2', 'npc1', 'npc2']));
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith('followers');
      expect(mockScopeRegistryInstance.getScope).toHaveBeenCalledWith('environment');
    });

    test('should handle mixed valid and invalid scopes', () => {
      const mockAst = { type: 'test' };
      const followersScope = { expr: 'actor.core:leading.followers[]' };
      
      mockScopeRegistryInstance.getScope
        .mockReturnValueOnce(followersScope)
        .mockReturnValueOnce(null);
      
      parseInlineExpr.mockReturnValue(mockAst);
      mockScopeEngine.resolve.mockReturnValue(new Set(['follower1']));

      const context = {
        actingEntity: { id: 'player' },
        entityManager: mockEntityManager,
        spatialIndexManager: {},
        jsonLogicEval: {}
      };

      const result = getEntityIdsForScopes(['followers', 'invalid_scope'], context, mockLogger);
      
      expect(result).toEqual(new Set(['follower1']));
      expect(mockLogger.warn).toHaveBeenCalledWith("Scope 'invalid_scope' not found in registry");
    });
  });
});

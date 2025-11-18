/**
 * @file Lightweight test bed for UnifiedScopeResolver integration tests
 * Eliminates heavy container configuration while preserving integration test nature
 */

import { jest } from '@jest/globals';
import { UnifiedScopeResolver } from '../../../src/actions/scopes/unifiedScopeResolver.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { createMockCacheStrategy } from '../doubles/mockCacheStrategy.js';

/**
 * Creates a lightweight test bed for UnifiedScopeResolver testing
 * Provides all necessary dependencies without full container overhead
 */
export class UnifiedScopeResolverTestBed {
  constructor() {
    this.mocks = this.#createCoreMocks();
    this.resolver = null;
    this.targetResolutionService = null;
  }

  /**
   * Creates core mock dependencies for UnifiedScopeResolver
   *
   * @returns {object} Object containing all mocked dependencies
   */
  #createCoreMocks() {
    const mocks = {};

    // Mock ScopeRegistry
    mocks.scopeRegistry = {
      getScope: jest.fn((scopeName) => {
        // Handle special scopes by returning null (handled by UnifiedScopeResolver)
        if (scopeName === 'none' || scopeName === 'self') {
          return null;
        }
        // Return mock scope definition for testing
        if (
          scopeName.includes('non-existent') ||
          scopeName.includes('missing')
        ) {
          return null;
        }
        return {
          expr: `test.scope.${scopeName.replace(':', '.')}`,
          ast: { type: 'field', name: 'test' },
        };
      }),
    };

    // Mock ScopeEngine
    mocks.scopeEngine = {
      resolve: jest.fn(() => new Set(['test-entity-1', 'test-entity-2'])),
    };

    // Mock EntityManager
    mocks.entityManager = {
      getComponentData: jest.fn((entityId, componentTypeId) => ({
        id: componentTypeId,
        data: { test: 'data' },
      })),
      getEntityInstance: jest.fn((entityId) => ({ id: entityId })),
    };

    // Mock JsonLogicEvaluationService
    mocks.jsonLogicEvaluationService = {
      evaluate: jest.fn(() => true),
    };

    // Mock DslParser
    mocks.dslParser = {
      parse: jest.fn((expr) => ({ type: 'field', name: 'parsed', expr })),
    };

    // Mock Logger
    mocks.logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock ActionErrorContextBuilder
    mocks.actionErrorContextBuilder = {
      buildErrorContext: jest.fn(({ error, ...rest }) => ({
        error,
        ...rest,
        timestamp: new Date().toISOString(),
      })),
    };

    // Mock TargetResolutionService for delegation tests
    mocks.targetResolutionService = {
      resolveTargets: jest.fn((scopeName, actor, discoveryContext) => {
        // This will be bound after initialization
        return ActionResult.failure([
          new Error('TargetResolutionService not properly initialized'),
        ]);
      }),
    };

    return mocks;
  }

  /**
   * Initializes the test bed with optional custom mocks
   *
   * @param {object} customMocks - Optional custom mock overrides
   * @returns {UnifiedScopeResolverTestBed} This instance for chaining
   */
  initialize(customMocks = {}) {
    const finalMocks = { ...this.mocks, ...customMocks };

    this.resolver = new UnifiedScopeResolver(finalMocks);
    this.targetResolutionService = this.mocks.targetResolutionService;

    return this;
  }

  /**
   * Creates a UnifiedScopeResolver with cache strategy
   *
   * @param {object} cacheStrategy - Optional custom cache strategy
   * @returns {UnifiedScopeResolver} Resolver instance with cache
   */
  createResolverWithCache(cacheStrategy = null) {
    const mockCache = cacheStrategy || createMockCacheStrategy();

    return new UnifiedScopeResolver({
      ...this.mocks,
      cacheStrategy: mockCache,
    });
  }

  /**
   * Creates a trace context mock for tracing tests
   *
   * @param {object} overrides - Optional trace method overrides
   * @returns {object} Mock trace context
   */
  createTraceContext(overrides = {}) {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      withSpan: jest.fn((name, fn, attrs) => fn()),
      ...overrides,
    };
  }

  /**
   * Creates a basic actor entity for testing
   *
   * @param {object} overrides - Optional actor property overrides
   * @returns {object} Mock actor entity
   */
  createActor(overrides = {}) {
    return {
      id: 'test-actor',
      definitionId: 'core:actor',
      componentTypeIds: [],
      ...overrides,
    };
  }

  /**
   * Creates a basic resolution context for testing
   *
   * @param {object} overrides - Optional context property overrides
   * @returns {object} Mock resolution context
   */
  createContext(overrides = {}) {
    return {
      actor: this.createActor(),
      actorLocation: 'test-location',
      actionContext: { currentLocation: 'test-location' },
      ...overrides,
    };
  }

  /**
   * Resets all mock functions to clean state
   */
  resetMocks() {
    Object.values(this.mocks).forEach((mock) => {
      if (typeof mock === 'object' && mock !== null) {
        Object.values(mock).forEach((method) => {
          if (jest.isMockFunction(method)) {
            method.mockReset();
          }
        });
      }
    });
  }

  /**
   * Cleans up resources and resets state
   */
  cleanup() {
    this.resetMocks();
    this.resolver = null;
    this.targetResolutionService = null;
  }

  // Getter methods for easy access to mocks
  get scopeRegistry() {
    return this.mocks.scopeRegistry;
  }
  get scopeEngine() {
    return this.mocks.scopeEngine;
  }
  get entityManager() {
    return this.mocks.entityManager;
  }
  get logger() {
    return this.mocks.logger;
  }
  get dslParser() {
    return this.mocks.dslParser;
  }
  get actionErrorContextBuilder() {
    return this.mocks.actionErrorContextBuilder;
  }
}

/**
 * Factory function to create a new test bed instance
 *
 * @returns {UnifiedScopeResolverTestBed} New test bed instance
 */
export function createUnifiedScopeResolverTestBed() {
  return new UnifiedScopeResolverTestBed();
}

/**
 * @file Integration tests for filterResolver error handling
 * @description Tests the new error handling system in real-world scenarios
 */

import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';
import { ErrorCategories } from '../../../src/scopeDsl/constants/errorCategories.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

describe('FilterResolver Error Handling Integration', () => {
  let errorHandler;
  let scopeEngine;
  let mockEntityManager;
  let mockJsonLogicEval;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    errorHandler = new ScopeDslErrorHandler({ logger: mockLogger });
    scopeEngine = new ScopeEngine({ errorHandler });

    // Create mock entity manager
    mockEntityManager = new SimpleEntityManager([
      {
        id: 'test-actor',
        components: {
          'core:actor': { type: 'player' },
          'core:inventory': { items: ['sword', 'shield'] },
        },
      },
    ]);

    // Create mock JSON Logic evaluator
    mockJsonLogicEval = new JsonLogicEvaluationService({ logger: mockLogger });
  });

  afterEach(() => {
    errorHandler.clearErrorBuffer();
    jest.clearAllMocks();
  });

  describe('FilterResolver Error Handling - Missing Context', () => {
    it('should handle missing actor with proper error code', () => {
      const scopeWithFilter =
        'actor.items[{"==": [{"var": "type"}, "weapon"]}]';
      const ast = parseDslExpression(scopeWithFilter);
      const runtimeCtx = {
        entityManager: mockEntityManager,
        jsonLogicEval: mockJsonLogicEval,
        logger: mockLogger,
      };

      // With new parameter validation, this throws immediately (fail-fast)
      // The error is thrown before it can be buffered by the error handler
      expect(() => {
        scopeEngine.resolve(ast, null, runtimeCtx);
      }).toThrow(/actorEntity must be an object/);

      // Parameter validation errors are not buffered - they throw immediately
      const errors = errorHandler.getErrorBuffer();
      expect(errors.length).toBe(0);
    });

    it('should handle missing runtime context', () => {
      const scopeWithFilter =
        'actor.items[{"==": [{"var": "type"}, "weapon"]}]';
      const ast = parseDslExpression(scopeWithFilter);
      const actorEntity = { id: 'test-actor' };

      expect(() => {
        scopeEngine.resolve(ast, actorEntity, null);
      }).toThrow(Error);

      // This throws a critical context error before reaching the error handler
      // So we don't expect entries in the error buffer for this case
    });
  });

  describe('FilterResolver Error Handling - Invalid Filters', () => {
    it('should handle valid JSON Logic filter that evaluates to false', () => {
      const validFilter =
        'actor.items[{"==": [{"var": "type"}, "nonexistent"]}]';
      const ast = parseDslExpression(validFilter);
      const actorEntity = { id: 'test-actor' };
      const runtimeCtx = {
        entityManager: mockEntityManager,
        jsonLogicEval: mockJsonLogicEval,
        logger: mockLogger,
      };

      // This should not throw, but may return empty results
      expect(() => {
        scopeEngine.resolve(ast, actorEntity, runtimeCtx);
      }).not.toThrow();
    });

    it('should handle syntax errors in filter expressions at parse time', () => {
      // This will fail at parse time, not during resolution
      expect(() => {
        parseDslExpression('actor.items[malformed]');
      }).toThrow(); // This throws a ScopeSyntaxError during parsing
    });
  });

  describe('Error Buffer Management', () => {
    it('should accumulate multiple errors in buffer', () => {
      // Use the error handler directly to test buffer management
      try {
        errorHandler.handleError(
          new Error('Test error 1'),
          { depth: 0 },
          'testResolver',
          'SCOPE_1001'
        );
      } catch (e) {
        // Expected error
      }

      try {
        errorHandler.handleError(
          new Error('Test error 2'),
          { depth: 1 },
          'testResolver2',
          'SCOPE_2003'
        );
      } catch (e) {
        // Expected error
      }

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBe(2);

      // Verify each error has expected structure
      for (const error of buffer) {
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('category');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('timestamp');
      }
    });

    it('should clear error buffer when requested', () => {
      // Generate an error first
      try {
        errorHandler.handleError(
          new Error('Test error'),
          { depth: 0 },
          'testResolver'
        );
      } catch (e) {
        // Expected error
      }

      expect(errorHandler.getErrorBuffer()).toHaveLength(1);

      errorHandler.clearErrorBuffer();
      expect(errorHandler.getErrorBuffer()).toHaveLength(0);
    });

    it('should maintain buffer size limit', () => {
      const maxBufferSize = 100;

      // Generate more than max buffer size errors directly using the error handler
      for (let i = 0; i < maxBufferSize + 10; i++) {
        try {
          errorHandler.handleError(
            new Error(`Test error ${i}`),
            { depth: 0 },
            'testResolver'
          );
        } catch (e) {
          // Expected error
        }
      }

      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBeLessThanOrEqual(maxBufferSize);
    });
  });

  describe('Environment-Specific Error Handling', () => {
    it('should log detailed errors in development', () => {
      const devLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };

      const devErrorHandler = new ScopeDslErrorHandler({
        logger: devLogger,
        config: { isDevelopment: true },
      });

      // Test detailed logging by directly using the error handler
      try {
        devErrorHandler.handleError(
          new Error('Test development error'),
          { depth: 0, context: 'test' },
          'testResolver'
        );
      } catch (e) {
        // Expected error
      }

      expect(devLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[ScopeDSL:'),
        expect.objectContaining({
          code: expect.any(String),
          category: expect.any(String),
          context: expect.any(Object),
          timestamp: expect.any(String),
          stack: expect.any(String),
        })
      );
    });

    it('should log minimal errors in production', () => {
      const prodLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };

      const prodErrorHandler = new ScopeDslErrorHandler({
        logger: prodLogger,
        config: { isDevelopment: false },
      });

      // Test minimal logging by directly using the error handler
      try {
        prodErrorHandler.handleError(
          new Error('Test production error'),
          { depth: 0, context: 'test' },
          'testResolver'
        );
      } catch (e) {
        // Expected error
      }

      expect(prodLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[ScopeDSL:.*\] SCOPE_\d+: /)
      );
    });
  });

  // Helper functions for test data creation
  const createTestContext = () => ({
    actorEntity: { id: 'test-actor' },
    runtimeCtx: {
      entityManager: mockEntityManager,
      jsonLogicEval: mockJsonLogicEval,
      logger: mockLogger,
      location: { id: 'location1' },
    },
  });

  const createInvalidContext = () => ({
    // Missing required actorEntity and runtimeCtx
  });

  const createTestActor = (id, components = {}) => ({
    id,
    components: {
      'core:actor': { type: 'player' },
      'core:position': { locationId: 'test-location' },
      ...components,
    },
  });

  const createTestScope = (expression) => {
    return parseDslExpression(expression);
  };

  // Additional integration tests using helper functions
  describe('Helper Function Integration', () => {
    it('should work with createTestContext helper', () => {
      const testContext = createTestContext();
      expect(testContext.actorEntity).toBeDefined();
      expect(testContext.runtimeCtx).toBeDefined();
      expect(testContext.runtimeCtx.entityManager).toBe(mockEntityManager);
    });

    it('should work with createTestActor helper', () => {
      const actor = createTestActor('test-id', {
        'custom:component': { data: 'test' },
      });
      expect(actor.id).toBe('test-id');
      expect(actor.components['core:actor']).toBeDefined();
      expect(actor.components['custom:component']).toEqual({ data: 'test' });
    });

    it('should work with createTestScope helper', () => {
      const scope = createTestScope('actor.items');
      expect(scope).toBeDefined();
      expect(scope.type).toBeDefined();
    });
  });
});

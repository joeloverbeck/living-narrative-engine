/**
 * @file Error Message Validation Tests
 * @description Tests that validate documented error messages match actual implementation
 * This ensures documentation accuracy for error handling behavior
 */

import { describe, it, expect } from '@jest/globals';
import {
  parseDslExpression,
  ScopeSyntaxError,
} from '../../../src/scopeDsl/parser/parser.js';
import ScopeDepthError from '../../../src/errors/scopeDepthError.js';
import ScopeCycleError from '../../../src/errors/scopeCycleError.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

describe('Error Message Validation', () => {
  describe('ScopeSyntaxError Messages', () => {
    it('should provide detailed error for location with parameters', () => {
      let thrownError;
      try {
        parseDslExpression('location(player)');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeSyntaxError);
      expect(thrownError.message).toContain(
        'Unexpected tokens after expression'
      );
      expect(thrownError.line).toBe(1);
      expect(thrownError.column).toBeGreaterThan(0);
      expect(thrownError.snippet).toContain('location(player)');
    });

    it('should provide line and column information', () => {
      const multilineExpression = `actor
.followers
.`;

      let thrownError;
      try {
        parseDslExpression(multilineExpression);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeSyntaxError);
      expect(thrownError.line).toBe(3);
      expect(thrownError.column).toBe(2);
      expect(thrownError.message).toContain('line 3, column 2');
    });

    it('should include code snippet with error pointer', () => {
      let thrownError;
      try {
        parseDslExpression('actor.followers.');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeSyntaxError);
      expect(thrownError.snippet).toContain('actor.followers.');
      expect(thrownError.snippet).toContain('^'); // Error pointer
    });

    it('should handle malformed entities source', () => {
      let thrownError;
      try {
        parseDslExpression('entities(core:');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeSyntaxError);
      expect(thrownError.message).toContain('Expected component name');
    });

    it('should handle invalid JSON Logic', () => {
      let thrownError;
      try {
        parseDslExpression('actor.followers[foo := bar]');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeSyntaxError);
      expect(thrownError.message).toContain('Unexpected character');
    });

    it('should handle empty input appropriately', () => {
      let thrownError;
      try {
        parseDslExpression('');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeSyntaxError);
      expect(thrownError.message).toContain('Expected source node');
    });
  });

  describe('ScopeDepthError Messages', () => {
    let engine;

    beforeEach(() => {
      engine = new ScopeEngine();
    });

    it('should throw ScopeDepthError with specific depth limit message', () => {
      // Create AST manually that exceeds depth limit (7 steps)
      const source = { type: 'Source', kind: 'actor' };
      const step1 = {
        type: 'Step',
        field: 'a',
        isArray: false,
        parent: source,
      };
      const step2 = { type: 'Step', field: 'b', isArray: false, parent: step1 };
      const step3 = { type: 'Step', field: 'c', isArray: false, parent: step2 };
      const step4 = { type: 'Step', field: 'd', isArray: false, parent: step3 };
      const step5 = { type: 'Step', field: 'e', isArray: false, parent: step4 };
      const step6 = { type: 'Step', field: 'f', isArray: false, parent: step5 };
      const step7 = { type: 'Step', field: 'g', isArray: false, parent: step6 };

      const actorEntity = { id: 'test-actor' };
      const mockRuntimeCtx = {
        entityManager: {
          getComponentData: jest.fn(() => ({})),
          getEntityInstance: jest.fn(() => actorEntity),
        },
        logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      };

      let thrownError;
      try {
        engine.resolve(step7, actorEntity, mockRuntimeCtx);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeDepthError);
      expect(thrownError.message).toContain(
        'Expression depth limit exceeded (max 6)'
      );
    });
  });

  describe('ScopeCycleError Messages', () => {
    let engine;

    beforeEach(() => {
      engine = new ScopeEngine();
    });

    it('should throw ScopeCycleError for direct self-loop', () => {
      const ast = { type: 'Step', field: 'self', parent: null };
      ast.parent = ast; // Create direct cycle

      const actorEntity = { id: 'test-actor' };
      const mockRuntimeCtx = {
        entityManager: {
          getComponentData: jest.fn(() => ({})),
          getEntityInstance: jest.fn(() => actorEntity),
        },
        logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      };

      let thrownError;
      try {
        engine.resolve(ast, actorEntity, mockRuntimeCtx);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeCycleError);
      expect(thrownError.message).toContain('Cycle');
    });

    it('should throw ScopeCycleError for indirect cycle', () => {
      const nodeA = { type: 'Step', field: 'A', parent: null };
      const nodeB = { type: 'Step', field: 'B', parent: nodeA };
      const nodeC = { type: 'Step', field: 'C', parent: nodeB };
      nodeA.parent = nodeC; // Create cycle

      const actorEntity = { id: 'test-actor' };
      const mockRuntimeCtx = {
        entityManager: {
          getComponentData: jest.fn(() => ({})),
          getEntityInstance: jest.fn(() => actorEntity),
        },
        logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      };

      let thrownError;
      try {
        engine.resolve(nodeC, actorEntity, mockRuntimeCtx);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(ScopeCycleError);
      expect(thrownError.message).toContain('Cycle');
    });
  });

  describe('Graceful Error Handling', () => {
    let engine;

    beforeEach(() => {
      engine = new ScopeEngine();
    });

    it('should handle missing components gracefully', () => {
      const ast = parseDslExpression('actor.core:inventory.items[]');
      const actorEntity = { id: 'test-actor' };
      const mockRuntimeCtx = {
        entityManager: {
          getComponentData: jest.fn(() => undefined), // Missing component
          getEntityInstance: jest.fn(() => actorEntity),
        },
        logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      };

      // Should not throw, should return empty set
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
      expect(result).toEqual(new Set());
    });

    it('should handle non-string items in array iteration', () => {
      const ast = parseDslExpression('entities(core:item)[]');
      const actorEntity = { id: 'test-actor' };
      const mockRuntimeCtx = {
        entityManager: {
          getEntitiesWithComponent: jest.fn(() => [
            { id: 'item1' },
            { id: 123 }, // Non-string ID
            { id: { id: 'item2' } }, // Object ID
            { id: 'item3' },
          ]),
          getEntityInstance: jest.fn(() => actorEntity),
        },
        logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      };

      // Should filter out non-string IDs gracefully
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
      expect(result).toEqual(new Set(['item1', 'item3']));
    });

    it('should handle filter evaluation errors gracefully', () => {
      const ast = parseDslExpression(
        'entities(core:item)[][{"invalid": "logic"}]'
      );
      const actorEntity = { id: 'test-actor' };
      const mockRuntimeCtx = {
        entityManager: {
          getEntitiesWithComponent: jest.fn(() => [
            { id: 'item1' },
            { id: 'item2' },
          ]),
          getEntityInstance: jest.fn(() => ({ id: 'item1' })),
        },
        jsonLogicEval: {
          evaluate: jest.fn(() => {
            throw new Error('Invalid logic');
          }),
        },
        logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      };

      // Should handle JSON Logic errors gracefully
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
      expect(result).toEqual(new Set()); // No items pass due to evaluation errors
    });
  });

  describe('Documentation Coverage Validation', () => {
    it('should validate all documented error examples work as described', () => {
      // Test examples from documentation section 12 (Error Handling)

      // 1. Invalid Syntax with detailed line/column info
      expect(() => parseDslExpression('invalid')).toThrow(ScopeSyntaxError);

      // 2. Missing components gracefully handled (tested above)

      // 3. Depth limit exceeded (tested above)

      // 4. Cycle detection (tested above)

      // All documented error behaviors are now validated by tests
    });
  });
});

/**
 * @file Performance benchmarks for error message validation
 * @description Tests focused on measuring and validating scope DSL error handling performance
 * including operation completion times for simple scopes
 */

import { describe, it, expect } from '@jest/globals';
import { performance } from 'node:perf_hooks';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

describe('Error Message Validation Performance', () => {
  describe('Documentation Performance Validation', () => {
    it('should validate performance error behavior matches documentation', () => {
      // Test that large operations complete within documented timeframes
      const start = performance.now();

      // Simple scope should complete quickly (< 1ms target from docs)
      const ast = parseDslExpression('actor');
      const actorEntity = { id: 'test-actor' };
      const mockRuntimeCtx = {
        entityManager: {
          getComponentData: jest.fn(() => ({})),
          getEntityInstance: jest.fn(() => actorEntity),
        },
        jsonLogicEval: {
          evaluate: jest.fn(() => true),
        },
        logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      };

      const engine = new ScopeEngine();
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      const duration = performance.now() - start;

      // Should complete very quickly for simple scopes
      expect(duration).toBeLessThan(10); // Give some leeway for test environment
      expect(result).toEqual(new Set(['test-actor']));
    });
  });
});

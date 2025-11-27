/**
 * @file Performance benchmarks for ScopeRegistry operations
 * @description Tests focused on measuring and validating scope registry performance
 * including initialization with large datasets and retrieval operations
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { parseScopeFile } from '../../../src/scopeDsl/parser/parser.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';

describe('ScopeRegistry Performance', () => {
  let scopeRegistry;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    scopeRegistry = new ScopeRegistry({ logger: mockLogger });
  });

  describe('Large Dataset Performance', () => {
    it('should handle large scope definitions efficiently', () => {
      const startTime = Date.now();

      // Create many scope definitions
      const scopeDefinitions = {};
      for (let i = 0; i < 100; i++) {
        scopeDefinitions[`test:scope${i}`] = {
          id: `test:scope${i}`,
          expr: `actor.followers[]`,
          ast: parseScopeFile('actor.followers[]', `scope${i}`).expr,
          description: `Test scope ${i}`,
        };
      }

      scopeRegistry.initialize(scopeDefinitions);

      const initTime = Date.now() - startTime;

      // Should initialize quickly even with many scopes
      expect(initTime).toBeLessThan(100); // 100ms threshold

      // Should retrieve scopes quickly
      const retrieveStart = Date.now();
      for (let i = 0; i < 100; i++) {
        const scope = scopeRegistry.getScope(`test:scope${i}`);
        expect(scope).toBeDefined();
      }
      const retrieveTime = Date.now() - retrieveStart;

      // Threshold accounts for Jest + jsdom environment overhead (10-50ms)
      // plus system variability. Actual retrieval work is sub-millisecond.
      expect(retrieveTime).toBeLessThan(100); // 100ms threshold for 100 retrievals
    });
  });
});

/**
 * @file Performance tests for ModLoadOrderResolver
 * @description Tests performance characteristics of mod load order resolution algorithms
 * Extracted from unit tests to ensure performance regression testing without impacting unit test execution time
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ModLoadOrderResolver from '../../../src/modding/modLoadOrderResolver.js';
import { CORE_MOD_ID } from '../../../src/constants/core.js';

/**
 * Determines timing multiplier based on test environment
 * CI/automated environments can use minimal delays for faster execution
 *
 * @returns {number} Timing multiplier (0.1 for CI, 1.0 for local)
 */
const getTestTimingMultiplier = () => {
  // Check for CI environment variables
  const isCI = !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL
  );

  // Use minimal delays in CI for faster test execution
  return isCI ? 0.1 : 1.0;
};

/**
 * Convenience factory for a minimal manifest object.
 *
 * @param {string} id
 * @param {Array<object>} [dependencies]
 * @returns {import('../../../src/modding/modDependencyValidator.js').ModManifest}
 */
const makeManifest = (id, dependencies = []) => ({
  id,
  version: '1.0.0',
  dependencies,
});

/**
 * Creates a mock logger instance matching the ILogger interface.
 *
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger}
 */
const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('ModLoadOrderResolver – Performance Tests', () => {
  let mockLogger;
  let resolver;
  const timingMultiplier = getTestTimingMultiplier();

  beforeEach(() => {
    mockLogger = createMockLogger();
    resolver = new ModLoadOrderResolver(mockLogger);
    jest.clearAllMocks();
  });

  describe('Linear Chain Performance', () => {
    it('resolves large linear dependency chain efficiently (≈O(N+E))', () => {
      const N = 5000; // large but safe for CI
      const requested = Array.from({ length: N }, (_, i) => `Mod${i}`);
      const manifests = new Map();

      // Create linear chain: Mod0 <- Mod1 <- Mod2 <- ... <- Mod4999
      requested.forEach((id, idx) => {
        const deps = idx === 0 ? [] : [{ id: `Mod${idx - 1}`, required: true }];
        manifests.set(id.toLowerCase(), makeManifest(id, deps));
      });

      const start = performance.now();
      const order = resolver.resolve(requested, manifests);
      const durationMs = performance.now() - start;

      expect(order.length).toBe(N + 1); // +1 for core mod
      expect(order[0]).toBe(CORE_MOD_ID);
      expect(order.slice(1)).toEqual(requested);

      // Adjust expected time based on CI environment
      const expectedMaxTimeMs = 500 * timingMultiplier;
      expect(durationMs).toBeLessThan(expectedMaxTimeMs);
    });

    it('handles memory efficiently for large linear chains', () => {
      const N = 1000;
      const requested = Array.from({ length: N }, (_, i) => `LargeMod${i}`);
      const manifests = new Map();

      requested.forEach((id, idx) => {
        const deps =
          idx === 0 ? [] : [{ id: `LargeMod${idx - 1}`, required: true }];
        manifests.set(id.toLowerCase(), makeManifest(id, deps));
      });

      const initialMemory = process.memoryUsage().heapUsed;

      const order = resolver.resolve(requested, manifests);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / (1024 * 1024);

      expect(order.length).toBe(N + 1);
      // Should not use excessive memory (reasonable threshold for resolution)
      expect(memoryIncreaseMB).toBeLessThan(50);
    });
  });

  describe('Complex Dependency Graph Performance', () => {
    it('resolves wide dependency graph efficiently', () => {
      // Create a graph where one mod depends on many others
      const dependencyCount = 500;
      const dependencies = Array.from(
        { length: dependencyCount },
        (_, i) => `Dep${i}`
      );
      const requested = ['MainMod', ...dependencies];
      const manifests = new Map();

      // Each dependency is independent
      dependencies.forEach((id) => {
        manifests.set(id.toLowerCase(), makeManifest(id));
      });

      // MainMod depends on all dependencies
      const mainDeps = dependencies.map((id) => ({ id, required: true }));
      manifests.set('mainmod', makeManifest('MainMod', mainDeps));

      const start = performance.now();
      const order = resolver.resolve(requested, manifests);
      const durationMs = performance.now() - start;

      expect(order.length).toBe(requested.length + 1); // +1 for core
      expect(order[0]).toBe(CORE_MOD_ID);
      expect(order[order.length - 1]).toBe('MainMod'); // MainMod should be last

      const expectedMaxTimeMs = 200 * timingMultiplier;
      expect(durationMs).toBeLessThan(expectedMaxTimeMs);
    });

    it('handles deep dependency tree efficiently', () => {
      // Create a deep tree: Root -> Level1A -> Level2A -> ... -> LeafA
      //                          -> Level1B -> Level2B -> ... -> LeafB
      const depth = 50;
      const branches = 4;
      const requested = [];
      const manifests = new Map();

      for (let branch = 0; branch < branches; branch++) {
        const branchNodes = [];
        for (let level = 0; level < depth; level++) {
          const nodeId = `Branch${branch}Level${level}`;
          branchNodes.push(nodeId);
          requested.push(nodeId);

          const deps =
            level === 0 ? [] : [{ id: branchNodes[level - 1], required: true }];
          manifests.set(nodeId.toLowerCase(), makeManifest(nodeId, deps));
        }
      }

      const start = performance.now();
      const order = resolver.resolve(requested, manifests);
      const durationMs = performance.now() - start;

      expect(order.length).toBe(requested.length + 1); // +1 for core
      expect(order[0]).toBe(CORE_MOD_ID);

      const expectedMaxTimeMs = 300 * timingMultiplier;
      expect(durationMs).toBeLessThan(expectedMaxTimeMs);
    });
  });

  describe('Batch Resolution Performance', () => {
    it('handles multiple independent resolution calls efficiently', () => {
      const iterations = 100;
      const batchSize = 50;

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const requested = Array.from(
          { length: batchSize },
          (_, j) => `Batch${i}Mod${j}`
        );
        const manifests = new Map();

        requested.forEach((id) => {
          manifests.set(id.toLowerCase(), makeManifest(id));
        });

        const order = resolver.resolve(requested, manifests);
        expect(order.length).toBe(batchSize + 1);
      }

      const durationMs = performance.now() - start;
      const avgTimePerResolution = durationMs / iterations;

      const expectedMaxAvgMs = 5 * timingMultiplier;
      expect(avgTimePerResolution).toBeLessThan(expectedMaxAvgMs);
    });
  });

  describe('Stress Testing', () => {
    it('maintains performance with very large mod sets', () => {
      const N = 2000;
      const requested = Array.from({ length: N }, (_, i) => `StressMod${i}`);
      const manifests = new Map();

      // Create a more complex dependency pattern
      // Each mod depends on up to 3 previous mods
      requested.forEach((id, idx) => {
        const deps = [];
        for (let depIdx = Math.max(0, idx - 3); depIdx < idx; depIdx++) {
          if (Math.random() < 0.7) {
            // 70% chance of dependency
            deps.push({ id: `StressMod${depIdx}`, required: true });
          }
        }
        manifests.set(id.toLowerCase(), makeManifest(id, deps));
      });

      const start = performance.now();
      const order = resolver.resolve(requested, manifests);
      const durationMs = performance.now() - start;

      expect(order.length).toBeGreaterThanOrEqual(N + 1);
      expect(order[0]).toBe(CORE_MOD_ID);

      // Should complete in reasonable time even with complex dependencies
      const expectedMaxTimeMs = 1000 * timingMultiplier;
      expect(durationMs).toBeLessThan(expectedMaxTimeMs);
    });
  });
});

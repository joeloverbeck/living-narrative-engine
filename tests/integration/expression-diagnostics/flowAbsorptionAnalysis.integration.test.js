/**
 * @file Integration test for path-sensitive analysis fixing flow_absorption false positive
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 * @see tickets/EXPDIAPATSENANA-007-integration-test-flow-absorption.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CommonBootstrapper } from '../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load a test fixture expression from the pathSensitive fixtures directory
 * @param {string} filename - Name of the fixture file
 * @returns {object} Parsed expression object
 */
function loadFixture(filename) {
  const fixturePath = join(
    __dirname,
    '../../fixtures/expressionDiagnostics/pathSensitive',
    filename
  );
  return JSON.parse(readFileSync(fixturePath, 'utf-8'));
}

/**
 * Realistic emotion prototype data from core:emotion_prototypes lookup.
 * This recreates the original bug scenario where entrancement has
 * agency_control <= 0.10 gate that creates knife-edge constraints.
 */
const EMOTION_PROTOTYPES = {
  entries: {
    flow: {
      weights: {
        engagement: 1.0,
        arousal: 0.5,
        valence: 0.5,
        agency_control: 0.4,
      },
      gates: ['engagement >= 0.40', 'agency_control >= 0.10'],
    },
    interest: {
      weights: {
        engagement: 1.0,
        arousal: 0.4,
        valence: 0.2,
      },
      gates: ['engagement >= 0.20'],
    },
    fascination: {
      weights: {
        engagement: 1.0,
        arousal: 0.8,
        valence: 0.3,
      },
      gates: ['engagement >= 0.35', 'arousal >= 0.25'],
    },
    entrancement: {
      weights: {
        engagement: 1.0,
        arousal: 0.45,
        agency_control: -0.55,
        threat: -0.45,
        valence: 0.25,
        future_expectancy: 0.1,
      },
      gates: [
        'engagement >= 0.45',
        'arousal >= 0.10',
        'arousal <= 0.60',
        'threat <= 0.35',
        'agency_control <= 0.10', // This creates knife-edge with flow's agency_control >= 0.10
        'valence >= -0.10',
      ],
    },
    joy: {
      weights: { valence: 1.0, arousal: 0.3 },
      gates: ['valence >= 0.40'],
    },
    contentment: {
      weights: { valence: 0.8, arousal: -0.2 },
      gates: ['valence >= 0.30'],
    },
    serenity: {
      weights: { valence: 0.6, arousal: -0.4 },
      gates: ['valence >= 0.20'],
    },
    excitement: {
      weights: { arousal: 1.0, valence: 0.5 },
      gates: ['arousal >= 0.50'],
    },
    enthusiasm: {
      weights: { arousal: 0.8, engagement: 0.6 },
      gates: ['arousal >= 0.40', 'engagement >= 0.30'],
    },
    curiosity: {
      weights: { engagement: 1.0, arousal: 0.6 },
      gates: ['engagement >= 0.20', 'threat <= 0.40'],
    },
  },
};

describe('flow_absorption.expression.json path-sensitive analysis', () => {
  let dom;
  let sharedBootstrapper;
  let sharedContainer;
  let pathSensitiveAnalyzer;

  beforeAll(async () => {
    // Setup minimal DOM environment
    dom = new JSDOM(
      `<!DOCTYPE html><html><body></body></html>`,
      { url: 'http://localhost', pretendToBeVisual: true }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    // Bootstrap with minimal configuration
    sharedBootstrapper = new CommonBootstrapper();
    const result = await sharedBootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      skipModLoading: true,
      postInitHook: async (services, container) => {
        registerExpressionServices(container);
        registerExpressionDiagnosticsServices(container);

        // Override dataRegistry to return our test emotion prototypes
        const originalDataRegistry = container.resolve(tokens.IDataRegistry);
        const wrappedDataRegistry = {
          // Preserve all original methods required by services
          get: (key) => originalDataRegistry.get?.(key),
          set: (key, value) => originalDataRegistry.set?.(key, value),
          has: (key) => originalDataRegistry.has?.(key),
          delete: (key) => originalDataRegistry.delete?.(key),
          clear: () => originalDataRegistry.clear?.(),
          // Override getLookupData to return test prototypes
          getLookupData: (key) => {
            if (key === 'core:emotion_prototypes') {
              return EMOTION_PROTOTYPES;
            }
            return originalDataRegistry.getLookupData?.(key);
          },
        };
        container.register(tokens.IDataRegistry, () => wrappedDataRegistry, {
          lifecycle: 'singleton',
        });
      },
    });

    if (!result?.container || !result?.services) {
      throw new Error(
        'Bootstrap failed: container or services not initialized'
      );
    }

    sharedContainer = result.container;
    pathSensitiveAnalyzer = sharedContainer.resolve(
      diagnosticsTokens.IPathSensitiveAnalyzer
    );
  });

  afterAll(() => {
    if (sharedContainer?.cleanup) {
      sharedContainer.cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  describe('Originating issue validation', () => {
    /**
     * This test validates the fix for the false-positive unreachable threshold warning.
     *
     * The expression requires:
     *   - flow >= 0.70 (always)
     *   - (interest >= 0.45 OR fascination >= 0.45 OR entrancement >= 0.40)
     *   - flow >= 0.85 (in second prerequisite OR block)
     *
     * Old behavior: Merged all OR branch gates, incorrectly reporting flow max restricted
     * New behavior: Analyzes each branch independently, correctly identifying:
     *   - interest branch: flow >= 0.85 IS reachable (no agency_control constraint)
     *   - fascination branch: flow >= 0.85 IS reachable (no agency_control constraint)
     *   - entrancement branch: has knife-edge on agency_control (agency_control <= 0.10)
     */
    it('should correctly identify that flow >= 0.85 IS reachable via interest/fascination branches', () => {
      const expression = loadFixture('flowAbsorptionOriginal.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // The expression should have at least one fully reachable branch
      expect(result.hasFullyReachableBranch).toBe(true);
      expect(result.fullyReachableBranchIds.length).toBeGreaterThanOrEqual(1);

      // Summary should indicate expression CAN trigger
      expect(result.overallStatus).toBe('fully_reachable');
    });

    it('should identify entrancement branch as having knife-edge constraint on agency_control', () => {
      const expression = loadFixture('flowAbsorptionOriginal.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Find branch(es) that include entrancement
      const entrancementBranches = result.branches.filter((b) =>
        b.requiredPrototypes.includes('entrancement')
      );

      // There should be at least one entrancement branch
      expect(entrancementBranches.length).toBeGreaterThanOrEqual(1);

      // At least one should have knife-edge on agency_control
      const hasAgencyControlKnifeEdge = entrancementBranches.some((branch) =>
        branch.knifeEdges.some((ke) => ke.axis === 'agency_control')
      );

      expect(hasAgencyControlKnifeEdge).toBe(true);
    });

    it('should show interest/fascination branches have NO agency_control knife-edge', () => {
      const expression = loadFixture('flowAbsorptionOriginal.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Find branches with interest or fascination (but not entrancement)
      const nonEntrancementBranches = result.branches.filter(
        (b) =>
          (b.requiredPrototypes.includes('interest') ||
            b.requiredPrototypes.includes('fascination')) &&
          !b.requiredPrototypes.includes('entrancement')
      );

      // At least one should exist
      expect(nonEntrancementBranches.length).toBeGreaterThanOrEqual(1);

      // None should have agency_control knife-edge
      for (const branch of nonEntrancementBranches) {
        const hasAgencyControlKnifeEdge = branch.knifeEdges.some(
          (ke) => ke.axis === 'agency_control'
        );
        expect(hasAgencyControlKnifeEdge).toBe(false);
      }
    });
  });

  describe('Branch enumeration validation', () => {
    it('should enumerate at least 3 branches for the OR expression', () => {
      const expression = loadFixture('flowAbsorptionOriginal.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Should have at least 3 branches (interest/fascination/entrancement paths)
      expect(result.branchCount).toBeGreaterThanOrEqual(3);
    });

    it('should have meaningful branch descriptions', () => {
      const expression = loadFixture('flowAbsorptionOriginal.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      for (const branch of result.branches) {
        expect(branch.description).toBeDefined();
        expect(branch.description.length).toBeGreaterThan(0);
      }
    });

    it('should have unique branch IDs', () => {
      const expression = loadFixture('flowAbsorptionOriginal.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      const branchIds = result.branches.map((b) => b.branchId);
      const uniqueIds = new Set(branchIds);
      expect(uniqueIds.size).toBe(branchIds.length);
    });
  });
});

describe('Path-sensitive analysis with test fixtures', () => {
  let dom;
  let sharedBootstrapper;
  let sharedContainer;
  let pathSensitiveAnalyzer;

  beforeAll(async () => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body></body></html>`,
      { url: 'http://localhost', pretendToBeVisual: true }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    sharedBootstrapper = new CommonBootstrapper();
    const result = await sharedBootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      skipModLoading: true,
      postInitHook: async (services, container) => {
        registerExpressionServices(container);
        registerExpressionDiagnosticsServices(container);

        // Override dataRegistry to return our test emotion prototypes
        const originalDataRegistry = container.resolve(tokens.IDataRegistry);
        const wrappedDataRegistry = {
          // Preserve all original methods required by services
          get: (key) => originalDataRegistry.get?.(key),
          set: (key, value) => originalDataRegistry.set?.(key, value),
          has: (key) => originalDataRegistry.has?.(key),
          delete: (key) => originalDataRegistry.delete?.(key),
          clear: () => originalDataRegistry.clear?.(),
          // Override getLookupData to return test prototypes
          getLookupData: (key) => {
            if (key === 'core:emotion_prototypes') {
              return EMOTION_PROTOTYPES;
            }
            return originalDataRegistry.getLookupData?.(key);
          },
        };
        container.register(tokens.IDataRegistry, () => wrappedDataRegistry, {
          lifecycle: 'singleton',
        });
      },
    });

    if (!result?.container || !result?.services) {
      throw new Error(
        'Bootstrap failed: container or services not initialized'
      );
    }

    sharedContainer = result.container;
    pathSensitiveAnalyzer = sharedContainer.resolve(
      diagnosticsTokens.IPathSensitiveAnalyzer
    );
  });

  afterAll(() => {
    if (sharedContainer?.cleanup) {
      sharedContainer.cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  describe('orBranchAllReachable fixture', () => {
    it('should identify all branches as fully reachable', () => {
      const expression = loadFixture('orBranchAllReachable.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      expect(result.hasFullyReachableBranch).toBe(true);
      // All branches should be feasible (no conflicts)
      expect(result.infeasibleBranchCount).toBe(0);
    });

    it('should have no knife-edges for simple low-threshold branches', () => {
      const expression = loadFixture('orBranchAllReachable.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      expect(result.totalKnifeEdgeCount).toBe(0);
    });

    it('should enumerate 3 branches for 3-way OR', () => {
      const expression = loadFixture('orBranchAllReachable.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      expect(result.branchCount).toBe(3);
    });
  });

  describe('orBranchMixedReachable fixture', () => {
    it('should identify at least one reachable branch', () => {
      const expression = loadFixture('orBranchMixedReachable.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Should have at least one reachable branch (interest path)
      expect(result.hasFullyReachableBranch).toBe(true);
    });

    it('should detect entrancement branch has agency_control knife-edge', () => {
      const expression = loadFixture('orBranchMixedReachable.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Find entrancement branch
      const entrancementBranch = result.branches.find((b) =>
        b.requiredPrototypes.includes('entrancement')
      );

      expect(entrancementBranch).toBeDefined();

      // Should have agency_control knife-edge from entrancement gates
      const hasAgencyControlKnifeEdge = entrancementBranch.knifeEdges.some(
        (ke) => ke.axis === 'agency_control'
      );
      expect(hasAgencyControlKnifeEdge).toBe(true);
    });

    it('should show interest branch has no knife-edges', () => {
      const expression = loadFixture('orBranchMixedReachable.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Find interest branch (without entrancement)
      const interestBranch = result.branches.find(
        (b) =>
          b.requiredPrototypes.includes('interest') &&
          !b.requiredPrototypes.includes('entrancement')
      );

      expect(interestBranch).toBeDefined();
      expect(interestBranch.knifeEdges.length).toBe(0);
    });
  });

  describe('nestedOrBranches fixture', () => {
    it('should handle nested OR blocks correctly', () => {
      const expression = loadFixture('nestedOrBranches.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Should enumerate all paths through nested ORs
      // Top OR has 2 children: (AND with nested OR) and serenity
      // Nested OR has 2 children: excitement and enthusiasm
      // Total: 2 (excitement/enthusiasm) + 1 (serenity) = 3 branches
      expect(result.branchCount).toBeGreaterThan(1);
    });

    it('should have unique branch IDs', () => {
      const expression = loadFixture('nestedOrBranches.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      const branchIds = result.branches.map((b) => b.branchId);
      const uniqueIds = new Set(branchIds);
      expect(uniqueIds.size).toBe(branchIds.length);
    });

    it('should collect correct prototypes per branch', () => {
      const expression = loadFixture('nestedOrBranches.expression.json');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Find branch with joy+excitement (nested path)
      const joyExcitementBranch = result.branches.find(
        (b) =>
          b.requiredPrototypes.includes('joy') &&
          b.requiredPrototypes.includes('excitement')
      );

      // Find branch with serenity only (direct path)
      const serenityBranch = result.branches.find(
        (b) =>
          b.requiredPrototypes.includes('serenity') &&
          !b.requiredPrototypes.includes('joy')
      );

      // At least one of these paths should exist
      const hasExpectedBranches = joyExcitementBranch || serenityBranch;
      expect(hasExpectedBranches).toBeTruthy();
    });
  });
});

describe('PathSensitiveAnalyzer service resolution', () => {
  let dom;
  let sharedContainer;

  beforeAll(async () => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body></body></html>`,
      { url: 'http://localhost', pretendToBeVisual: true }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    const bootstrapper = new CommonBootstrapper();
    const result = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      skipModLoading: true,
      postInitHook: async (services, container) => {
        registerExpressionServices(container);
        registerExpressionDiagnosticsServices(container);

        // Wrap dataRegistry to provide test emotion prototypes
        const originalDataRegistry = container.resolve(tokens.IDataRegistry);
        const wrappedDataRegistry = {
          get: (key) => originalDataRegistry.get?.(key),
          set: (key, value) => originalDataRegistry.set?.(key, value),
          has: (key) => originalDataRegistry.has?.(key),
          delete: (key) => originalDataRegistry.delete?.(key),
          clear: () => originalDataRegistry.clear?.(),
          getLookupData: (key) => {
            if (key === 'core:emotion_prototypes') {
              return EMOTION_PROTOTYPES;
            }
            return originalDataRegistry.getLookupData?.(key);
          },
        };
        container.register(tokens.IDataRegistry, () => wrappedDataRegistry);
      },
    });

    sharedContainer = result.container;
  });

  afterAll(() => {
    if (sharedContainer?.cleanup) {
      sharedContainer.cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  it('should successfully resolve IPathSensitiveAnalyzer', () => {
    const analyzer = sharedContainer.resolve(
      diagnosticsTokens.IPathSensitiveAnalyzer
    );

    expect(analyzer).toBeDefined();
    expect(analyzer).not.toBeNull();
    expect(typeof analyzer.analyze).toBe('function');
  });
});

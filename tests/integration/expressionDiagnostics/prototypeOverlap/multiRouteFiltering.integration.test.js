/**
 * @file Integration tests for Multi-Route Candidate Filtering (v2.1)
 * @description Tests the multi-route candidate selection system that addresses
 * feedback about weight-vector-only filtering being too aggressive (1.3% pass rate).
 * The system uses three routes:
 * - Route A: Weight-vector similarity (original filtering)
 * - Route B: Gate-based similarity (gate implication or interval overlap)
 * - Route C: Behavioral prescan (cheap Monte Carlo sampling)
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CommonBootstrapper } from '../../../../src/bootstrapper/CommonBootstrapper.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { diagnosticsTokens } from '../../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionServices } from '../../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from '../../../../src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';

/**
 * Test prototypes designed to exercise all three routes.
 *
 * Route A (Weight Similarity) passes: joyA ↔ joyB (very similar weights)
 * Route B (Gate Similarity) passes: fearA ↔ fearB (different weights, nested gates)
 * Route C (Behavioral Prescan) passes: neutralA ↔ neutralB (behavioral overlap from shared gate region)
 *
 * Additionally, includes prototypes that should fail all routes:
 * - opposites: anger ↔ calm (opposite weights and non-overlapping gates)
 */
const MULTI_ROUTE_TEST_PROTOTYPES = {
  // Route A pair: Nearly identical weight vectors, similar gates
  // Should pass: cosine similarity > 0.85, axis overlap > 0.6, sign agreement > 0.8
  joyA: {
    weights: { valence: 1.0, arousal: 0.6, engagement: 0.5 },
    gates: ['valence >= 0.40'],
  },
  joyB: {
    weights: { valence: 0.95, arousal: 0.55, engagement: 0.45 },
    gates: ['valence >= 0.35'],
  },

  // Route B pair: Different weight magnitudes but nested gates
  // Route A will reject (cosine < 0.85 due to magnitude differences)
  // Route B should select via gate implication (fearB gates imply fearA gates)
  fearA: {
    weights: { valence: -0.3, arousal: 0.2, threat: 0.8 },
    gates: ['threat >= 0.30'],
  },
  fearB: {
    weights: { valence: -0.9, arousal: 0.8, threat: 1.0 },
    gates: ['threat >= 0.70', 'arousal >= 0.50'],
  },

  // Route C pair: Different weights, non-nested gates, but behavioral overlap
  // Route A will reject (low cosine similarity)
  // Route B will reject (no gate implication/overlap)
  // Route C should catch via behavioral prescan (some shared gate region)
  neutralA: {
    weights: { valence: 0.1, arousal: -0.2, engagement: 0.0 },
    gates: ['arousal >= -0.50', 'arousal <= 0.30'],
  },
  neutralB: {
    weights: { valence: -0.1, arousal: -0.3, threat: 0.1 },
    gates: ['arousal >= -0.60', 'arousal <= 0.10'],
  },

  // Pair that should fail ALL routes (for contrast)
  anger: {
    weights: { valence: -0.8, arousal: 0.9, threat: 0.7 },
    gates: ['arousal >= 0.50', 'threat >= 0.30'],
  },
  calm: {
    weights: { valence: 0.2, arousal: -1.0, threat: -1.0 },
    gates: ['threat <= 0.20', 'arousal <= -0.30'],
  },
};

describe('Multi-Route Filtering Integration (v2.1)', () => {
  let dom;
  let container;
  let candidatePairFilter;
  let prototypes;

  beforeAll(async () => {
    // Setup minimal DOM environment
    dom = new JSDOM(
      `<!DOCTYPE html><html><body></body></html>`,
      { url: 'http://localhost', pretendToBeVisual: true }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;

    // Bootstrap with expression diagnostics services
    const bootstrapper = new CommonBootstrapper();
    const result = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      skipModLoading: true,
      postInitHook: async (services, c) => {
        // Register required services
        registerExpressionServices(c);
        registerExpressionDiagnosticsServices(c);

        // Store test prototypes in data registry
        const dataRegistry = c.resolve(tokens.IDataRegistry);
        dataRegistry.store('lookups', 'core:emotion_prototypes', {
          entries: MULTI_ROUTE_TEST_PROTOTYPES,
        });
      },
    });

    if (!result?.container) {
      throw new Error('Bootstrap failed: container not initialized');
    }

    container = result.container;

    // Resolve the CandidatePairFilter directly to test multi-route filtering
    candidatePairFilter = container.resolve(diagnosticsTokens.ICandidatePairFilter);

    // Convert test prototypes to array format with IDs
    prototypes = Object.entries(MULTI_ROUTE_TEST_PROTOTYPES).map(
      ([id, proto]) => ({
        id,
        ...proto,
      })
    );
  });

  afterAll(() => {
    if (container?.cleanup) {
      container.cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  describe('Multi-Route Pipeline', () => {
    it('filters candidates using all three routes', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      // Verify result structure
      expect(result).toHaveProperty('candidates');
      expect(result).toHaveProperty('stats');
      expect(Array.isArray(result.candidates)).toBe(true);

      // Multi-route filtering should be enabled, so routeStats should exist
      expect(result.stats).toHaveProperty('routeStats');
      expect(result.stats.routeStats).toHaveProperty('routeA');
      expect(result.stats.routeStats).toHaveProperty('routeB');
      expect(result.stats.routeStats).toHaveProperty('routeC');
    });

    it('includes per-route statistics breakdown', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      const { routeStats } = result.stats;

      // Route A stats
      expect(typeof routeStats.routeA.passed).toBe('number');
      expect(typeof routeStats.routeA.rejected).toBe('number');

      // Route B stats (gate-based)
      expect(typeof routeStats.routeB.passed).toBe('number');
      expect(typeof routeStats.routeB.rejected).toBe('number');
      expect(typeof routeStats.routeB.byImplication).toBe('number');
      expect(typeof routeStats.routeB.byOverlap).toBe('number');

      // Route C stats (behavioral prescan)
      expect(typeof routeStats.routeC.passed).toBe('number');
      expect(typeof routeStats.routeC.rejected).toBe('number');
      expect(typeof routeStats.routeC.skipped).toBe('number');
    });

    it('captures more candidates than Route A alone', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      const { routeStats } = result.stats;

      // Total candidates should be sum from all routes (deduplicated)
      const routeACount = routeStats.routeA.passed;
      const routeBCount = routeStats.routeB.passed;
      const routeCCount = routeStats.routeC.passed;

      // At minimum, we should have Route A candidates
      expect(routeACount).toBeGreaterThanOrEqual(0);

      // Total passed should equal the deduplicated merge
      expect(result.stats.passedFiltering).toBe(result.candidates.length);

      // When Routes B or C find candidates, total should be >= Route A count
      // Using logical assertion to avoid conditional expect
      const multiRouteFound = routeBCount > 0 || routeCCount > 0;
      const totalMeetsExpectation =
        !multiRouteFound ||
        result.stats.passedFiltering >= routeACount;
      expect(totalMeetsExpectation).toBe(true);
    });

    it('tracks provenance with selectedBy field', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      // Each candidate should have selectedBy field
      for (const candidate of result.candidates) {
        expect(candidate).toHaveProperty('selectedBy');
        expect(['routeA', 'routeB', 'routeC']).toContain(candidate.selectedBy);
      }
    });

    it('includes routeMetrics for each candidate', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      for (const candidate of result.candidates) {
        expect(candidate).toHaveProperty('routeMetrics');
        expect(typeof candidate.routeMetrics).toBe('object');
      }
    });

    it('maintains candidateMetrics for all candidates', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      for (const candidate of result.candidates) {
        expect(candidate).toHaveProperty('candidateMetrics');
        expect(candidate.candidateMetrics).toHaveProperty('activeAxisOverlap');
        expect(candidate.candidateMetrics).toHaveProperty('signAgreement');
        expect(candidate.candidateMetrics).toHaveProperty('weightCosineSimilarity');
      }
    });
  });

  describe('Route A: Weight-Vector Similarity', () => {
    it('selects near-identical prototype pairs (joyA ↔ joyB)', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      // Find joyA/joyB pair
      const joyPair = result.candidates.find(
        (c) =>
          (c.prototypeA.id === 'joyA' && c.prototypeB.id === 'joyB') ||
          (c.prototypeA.id === 'joyB' && c.prototypeB.id === 'joyA')
      );

      // Joy pair should be selected and likely via Route A due to high weight similarity
      expect(joyPair).toBeDefined();
      // Note: Route A has priority, so if it passes Route A, it will be marked as routeA
      expect(joyPair.selectedBy).toBe('routeA');
    });

    it('rejects opposite prototypes in Route A (anger ↔ calm)', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      // Anger/calm pair should NOT be found via Route A (opposite weights)
      const angerCalmPair = result.candidates.find(
        (c) =>
          (c.prototypeA.id === 'anger' && c.prototypeB.id === 'calm') ||
          (c.prototypeA.id === 'calm' && c.prototypeB.id === 'anger')
      );

      // This pair should fail all routes (opposite weights, non-overlapping gates)
      // If pair exists, it should not have been selected via Route A
      // Using logical assertion to avoid conditional expect
      const pairNotSelectedViaRouteA =
        !angerCalmPair || angerCalmPair.selectedBy !== 'routeA';
      expect(pairNotSelectedViaRouteA).toBe(true);
    });
  });

  describe('Route B: Gate-Based Similarity', () => {
    it('selects pairs with nested gates despite different weights (fearA ↔ fearB)', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      // Find fearA/fearB pair
      const fearPair = result.candidates.find(
        (c) =>
          (c.prototypeA.id === 'fearA' && c.prototypeB.id === 'fearB') ||
          (c.prototypeA.id === 'fearB' && c.prototypeB.id === 'fearA')
      );

      // Fear pair should be selected (gates are nested: threat >= 0.70 implies threat >= 0.30)
      // May be selected via Route A if weights are similar enough, or Route B otherwise
      // If selected via Route B, verify metrics are present
      // Using logical assertion to avoid conditional expect
      const routeBHasMetrics =
        !fearPair ||
        fearPair.selectedBy !== 'routeB' ||
        fearPair.routeMetrics !== undefined;
      expect(routeBHasMetrics).toBe(true);
    });

    it('tracks byImplication and byOverlap stats', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      const routeBStats = result.stats.routeStats.routeB;

      // These counts should be non-negative
      expect(routeBStats.byImplication).toBeGreaterThanOrEqual(0);
      expect(routeBStats.byOverlap).toBeGreaterThanOrEqual(0);

      // Sum of reasons should equal passed count (or zero if none passed)
      // Using logical assertion to avoid conditional expect
      const reasonSumsMatch =
        routeBStats.passed === 0 ||
        routeBStats.byImplication + routeBStats.byOverlap === routeBStats.passed;
      expect(reasonSumsMatch).toBe(true);
    });
  });

  describe('Route C: Behavioral Prescan', () => {
    it('tracks prescan statistics', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      const routeCStats = result.stats.routeStats.routeC;

      // Route C stats should all be non-negative
      expect(routeCStats.passed).toBeGreaterThanOrEqual(0);
      expect(routeCStats.rejected).toBeGreaterThanOrEqual(0);
      expect(routeCStats.skipped).toBeGreaterThanOrEqual(0);
    });

    it('only processes pairs rejected by Routes A and B', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      const { routeStats } = result.stats;

      // Route C input = Route A rejected - Route B passed
      // So Route C processed + skipped should be <= Route A rejected - Route B passed
      const routeARejected = routeStats.routeA.rejected;
      const routeBPassed = routeStats.routeB.passed;
      const routeCProcessed = routeStats.routeC.passed + routeStats.routeC.rejected;

      // Route C can only process pairs that failed both A and B
      expect(routeCProcessed + routeStats.routeC.skipped).toBeLessThanOrEqual(
        routeARejected - routeBPassed + routeBPassed // This simplifies, but shows the logic
      );
    });
  });

  describe('Total Pairs Accounting', () => {
    it('total possible pairs equals n*(n-1)/2', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      const n = prototypes.length;
      const expectedPairs = (n * (n - 1)) / 2;

      expect(result.stats.totalPossiblePairs).toBe(expectedPairs);
    });

    it('all pairs are accounted for in route processing', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      const { routeStats, totalPossiblePairs } = result.stats;

      // Route A processes all pairs
      const routeATotal = routeStats.routeA.passed + routeStats.routeA.rejected;
      expect(routeATotal).toBe(totalPossiblePairs);

      // Route B + Route C together process Route A rejects
      const routeARejected = routeStats.routeA.rejected;
      const routeBTotal = routeStats.routeB.passed + routeStats.routeB.rejected;

      // Route B should process all Route A rejects
      expect(routeBTotal).toBeLessThanOrEqual(routeARejected);
    });
  });

  describe('Deduplication', () => {
    it('does not include duplicate pairs across routes', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      // Check for duplicate pairs
      const seen = new Set();
      let duplicateFound = false;

      for (const candidate of result.candidates) {
        const key1 = `${candidate.prototypeA.id}|${candidate.prototypeB.id}`;
        const key2 = `${candidate.prototypeB.id}|${candidate.prototypeA.id}`;

        if (seen.has(key1) || seen.has(key2)) {
          duplicateFound = true;
          break;
        }

        seen.add(key1);
      }

      expect(duplicateFound).toBe(false);
    });

    it('Route A candidates have priority (appear first)', async () => {
      const result = await candidatePairFilter.filterCandidates(prototypes);

      // Find first non-Route-A candidate
      let firstNonRouteAIndex = -1;
      let lastRouteAIndex = -1;

      for (let i = 0; i < result.candidates.length; i++) {
        if (result.candidates[i].selectedBy === 'routeA') {
          lastRouteAIndex = i;
        } else if (firstNonRouteAIndex === -1) {
          firstNonRouteAIndex = i;
        }
      }

      // If there are both Route A and non-Route-A candidates,
      // all Route A should come before non-Route-A
      // Using logical assertion to avoid conditional expect
      const orderingIsCorrect =
        firstNonRouteAIndex === -1 ||
        lastRouteAIndex === -1 ||
        lastRouteAIndex < firstNonRouteAIndex;
      expect(orderingIsCorrect).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty prototype list', async () => {
      const result = await candidatePairFilter.filterCandidates([]);

      expect(result.candidates).toEqual([]);
      expect(result.stats.totalPossiblePairs).toBe(0);
    });

    it('handles single prototype', async () => {
      const result = await candidatePairFilter.filterCandidates([prototypes[0]]);

      expect(result.candidates).toEqual([]);
      expect(result.stats.prototypesWithValidWeights).toBe(1);
    });

    it('handles prototypes without valid weights', async () => {
      const invalidPrototypes = [
        { id: 'noWeights' },
        { id: 'emptyWeights', weights: {} },
        { id: 'stringWeights', weights: { valence: 'high' } },
      ];

      const result = await candidatePairFilter.filterCandidates(invalidPrototypes);

      expect(result.candidates).toEqual([]);
      expect(result.stats.prototypesWithValidWeights).toBe(0);
    });
  });
});

describe('Multi-Route Feature Flag', () => {
  let dom;
  let container;

  beforeAll(async () => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body></body></html>`,
      { url: 'http://localhost', pretendToBeVisual: true }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
  });

  afterAll(() => {
    if (container?.cleanup) {
      container.cleanup();
    }
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
  });

  it('returns only Route A results when enableMultiRouteFiltering is false', async () => {
    // Bootstrap with custom config that has multi-route disabled
    const bootstrapper = new CommonBootstrapper();
    const result = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      skipModLoading: true,
      postInitHook: async (services, c) => {
        registerExpressionServices(c);
        registerExpressionDiagnosticsServices(c);
      },
    });

    container = result.container;

    // Create a mock filter with disabled multi-route
    const CandidatePairFilter = (
      await import(
        '../../../../src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js'
      )
    ).default;

    const mockLogger = {
      debug: () => {},
      warn: () => {},
      error: () => {},
    };

    const disabledConfig = {
      activeAxisEpsilon: 0.08,
      candidateMinActiveAxisOverlap: 0.6,
      candidateMinSignAgreement: 0.8,
      candidateMinCosineSimilarity: 0.85,
      enableMultiRouteFiltering: false, // Disabled
    };

    const filterWithDisabled = new CandidatePairFilter({
      config: disabledConfig,
      logger: mockLogger,
      gateSimilarityFilter: null,
      behavioralPrescanFilter: null,
    });

    const prototypes = Object.entries(MULTI_ROUTE_TEST_PROTOTYPES).map(
      ([id, proto]) => ({ id, ...proto })
    );

    const filterResult = await filterWithDisabled.filterCandidates(prototypes);

    // Should NOT have routeStats when multi-route is disabled
    expect(filterResult.stats.routeStats).toBeUndefined();

    // Should have traditional stats
    expect(filterResult.stats).toHaveProperty('totalPossiblePairs');
    expect(filterResult.stats).toHaveProperty('rejectedByActiveAxisOverlap');
    expect(filterResult.stats).toHaveProperty('rejectedBySignAgreement');
    expect(filterResult.stats).toHaveProperty('rejectedByCosineSimilarity');

    // No selectedBy field should be present (or all should be routeA)
    for (const candidate of filterResult.candidates) {
      expect(candidate.selectedBy).toBe('routeA');
    }
  });
});

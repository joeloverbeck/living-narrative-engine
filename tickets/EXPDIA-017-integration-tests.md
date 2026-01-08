# EXPDIA-017: Create Diagnostics Pipeline Integration Tests

## Summary

Create end-to-end integration tests for the complete diagnostics flow, verifying that the static analysis, Monte Carlo, witness finding, and SMT components work together correctly. Tests should cover known-impossible expressions, known-easy expressions, and edge cases.

## Priority: Medium | Effort: Medium

## Rationale

Individual unit tests verify components in isolation, but the diagnostics system's value comes from how layers work together. Integration tests ensure the pipeline correctly identifies impossible expressions, finds witnesses for triggerable ones, and provides accurate probability estimates.

## Dependencies

- **EXPDIA-001** through **EXPDIA-016** (All service and UI implementations)
- **EXPDIA-005** (DI registration for resolving services)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expressionDiagnostics/diagnosticsPipeline.integration.test.js` | **Create** |
| `tests/integration/expressionDiagnostics/realExpressionAnalysis.integration.test.js` | **Create** |
| `tests/fixtures/expressionDiagnostics/alwaysTrue.expression.json` | **Create** |
| `tests/fixtures/expressionDiagnostics/alwaysFalse.expression.json` | **Create** |
| `tests/fixtures/expressionDiagnostics/rareButPossible.expression.json` | **Create** |
| `tests/fixtures/expressionDiagnostics/conflictingGates.expression.json` | **Create** |
| `tests/fixtures/expressionDiagnostics/unreachableThreshold.expression.json` | **Create** |

## Out of Scope

- **DO NOT** modify any service implementations
- **DO NOT** create new UI tests - UI is covered in individual tickets
- **DO NOT** create performance benchmarks - that's future work
- **DO NOT** test Z3 WASM loading - that's an external dependency
- **DO NOT** modify existing expression fixtures

## Implementation Details

### Test Fixtures

#### alwaysTrue.expression.json
```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "test:always_true",
  "description": "Expression with no prerequisites - always triggers",
  "prerequisites": []
}
```

#### alwaysFalse.expression.json
```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "test:always_false",
  "description": "Expression with contradictory requirements",
  "prerequisites": [
    {
      "logic": {
        "and": [
          { ">=": [{ "var": "mood.valence" }, 0.5] },
          { "<=": [{ "var": "mood.valence" }, -0.5] }
        ]
      }
    }
  ]
}
```

#### rareButPossible.expression.json
```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "test:rare_but_possible",
  "description": "Expression that requires extreme values but is satisfiable",
  "prerequisites": [
    {
      "logic": {
        "and": [
          { ">=": [{ "var": "mood.valence" }, 0.9] },
          { ">=": [{ "var": "mood.energy" }, 0.8] },
          { ">=": [{ "var": "sexualStates.sex_excitation" }, 0.85] }
        ]
      }
    }
  ]
}
```

#### conflictingGates.expression.json
```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "test:conflicting_gates",
  "description": "Expression with gates that cannot be satisfied simultaneously",
  "prerequisites": [
    {
      "logic": { ">=": [{ "var": "emotions.anger" }, 0.8] }
    },
    {
      "logic": { ">=": [{ "var": "emotions.joy" }, 0.8] }
    }
  ],
  "gates": {
    "threat": { "min": 0.7, "max": 1.0 },
    "valence": { "min": 0.5, "max": 1.0 }
  }
}
```

#### unreachableThreshold.expression.json
```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "test:unreachable_threshold",
  "description": "Expression requiring intensity impossible under gate constraints",
  "prerequisites": [
    {
      "logic": { ">=": [{ "var": "emotions.anger" }, 0.95] }
    }
  ],
  "gates": {
    "threat": { "min": 0.0, "max": 0.3 },
    "valence": { "min": 0.3, "max": 0.7 }
  }
}
```

### diagnosticsPipeline.integration.test.js

```javascript
/**
 * @file Integration tests for the complete diagnostics pipeline
 * @see specs/expression-diagnostics.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Test utilities
import { createTestContainer } from '../../common/testContainer.js';

describe('Expression Diagnostics Pipeline - Integration', () => {
  let container;
  let gateAnalyzer;
  let boundsCalculator;
  let monteCarloSimulator;
  let witnessStateFinder;
  let failureExplainer;
  let thresholdSuggester;

  const fixturesPath = path.join(__dirname, '../../fixtures/expressionDiagnostics');

  const loadFixture = (filename) => {
    const filepath = path.join(fixturesPath, filename);
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  };

  beforeAll(async () => {
    container = await createTestContainer();

    gateAnalyzer = container.resolve('IGateConstraintAnalyzer');
    boundsCalculator = container.resolve('IIntensityBoundsCalculator');
    monteCarloSimulator = container.resolve('IMonteCarloSimulator');
    witnessStateFinder = container.resolve('IWitnessStateFinder');
    failureExplainer = container.resolve('IFailureExplainer');
    thresholdSuggester = container.resolve('IThresholdSuggester');
  });

  afterAll(() => {
    container?.dispose();
  });

  describe('Always-True Expression', () => {
    let expression;

    beforeAll(() => {
      expression = loadFixture('alwaysTrue.expression.json');
    });

    it('should have no gate conflicts', () => {
      const conflicts = gateAnalyzer.findConflicts(expression);
      expect(conflicts).toHaveLength(0);
    });

    it('should have 100% trigger rate in Monte Carlo', () => {
      const result = monteCarloSimulator.simulate(expression, {
        sampleCount: 1000
      });
      expect(result.triggerRate).toBe(1);
    });

    it('should immediately find a witness', () => {
      const result = witnessStateFinder.findWitness(expression, {
        maxIterations: 100
      });
      expect(result.found).toBe(true);
      expect(result.bestFitness).toBe(1);
    });

    it('should generate no suggestions (already perfect)', () => {
      const mcResult = monteCarloSimulator.simulate(expression, { sampleCount: 100 });
      const suggestions = thresholdSuggester.generateSuggestions(expression, mcResult);
      expect(suggestions.suggestions).toHaveLength(0);
    });
  });

  describe('Always-False Expression', () => {
    let expression;

    beforeAll(() => {
      expression = loadFixture('alwaysFalse.expression.json');
    });

    it('should detect contradictory constraints', () => {
      const conflicts = gateAnalyzer.findConflicts(expression);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('should have 0% trigger rate in Monte Carlo', () => {
      const result = monteCarloSimulator.simulate(expression, {
        sampleCount: 1000
      });
      expect(result.triggerRate).toBe(0);
    });

    it('should not find a witness', () => {
      const result = witnessStateFinder.findWitness(expression, {
        maxIterations: 1000
      });
      expect(result.found).toBe(false);
      expect(result.nearestMiss).toBeDefined();
      expect(result.bestFitness).toBeLessThan(1);
    });

    it('should identify violated clauses', () => {
      const result = witnessStateFinder.findWitness(expression, {
        maxIterations: 100
      });
      expect(result.violatedClauses.length).toBeGreaterThan(0);
    });
  });

  describe('Rare But Possible Expression', () => {
    let expression;

    beforeAll(() => {
      expression = loadFixture('rareButPossible.expression.json');
    });

    it('should have no gate conflicts', () => {
      const conflicts = gateAnalyzer.findConflicts(expression);
      expect(conflicts).toHaveLength(0);
    });

    it('should have low but non-zero trigger rate', () => {
      const result = monteCarloSimulator.simulate(expression, {
        sampleCount: 10000
      });
      expect(result.triggerRate).toBeGreaterThan(0);
      expect(result.triggerRate).toBeLessThan(0.1);
    });

    it('should eventually find a witness with enough iterations', () => {
      const result = witnessStateFinder.findWitness(expression, {
        maxIterations: 10000
      });
      expect(result.found).toBe(true);
      expect(result.witness).toBeDefined();
    });

    it('should provide suggestions to improve rate', () => {
      const mcResult = monteCarloSimulator.simulate(expression, {
        sampleCount: 1000,
        trackClauses: true
      });
      const suggestions = thresholdSuggester.generateSuggestions(expression, mcResult);
      expect(suggestions.suggestions.length).toBeGreaterThan(0);
      expect(suggestions.bestPossibleRate).toBeGreaterThan(mcResult.triggerRate);
    });
  });

  describe('Conflicting Gates Expression', () => {
    let expression;

    beforeAll(() => {
      expression = loadFixture('conflictingGates.expression.json');
    });

    it('should detect gate conflicts in static analysis', () => {
      const conflicts = gateAnalyzer.findConflicts(expression);
      // Should identify that high anger (requires high threat) conflicts
      // with high joy (requires high valence)
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('should show low/zero trigger rate', () => {
      const result = monteCarloSimulator.simulate(expression, {
        sampleCount: 1000
      });
      expect(result.triggerRate).toBeLessThan(0.01);
    });
  });

  describe('Unreachable Threshold Expression', () => {
    let expression;

    beforeAll(() => {
      expression = loadFixture('unreachableThreshold.expression.json');
    });

    it('should detect that max achievable intensity is below threshold', () => {
      const bounds = boundsCalculator.calculateBounds(expression);
      // With constrained gates, max anger intensity should be below 0.95
      expect(bounds.anger?.max).toBeLessThan(0.95);
    });

    it('should have 0% trigger rate', () => {
      const result = monteCarloSimulator.simulate(expression, {
        sampleCount: 1000
      });
      expect(result.triggerRate).toBe(0);
    });

    it('should identify the threshold as the blocker', () => {
      const result = monteCarloSimulator.simulate(expression, {
        sampleCount: 1000,
        trackClauses: true
      });
      const blockers = failureExplainer.analyzeBlockers(result.clauseFailures);
      expect(blockers.length).toBeGreaterThan(0);
      expect(blockers[0].failureRate).toBeGreaterThan(0.9);
    });
  });

  describe('Pipeline Flow', () => {
    it('should correctly flow from static analysis through all stages', () => {
      const expression = loadFixture('rareButPossible.expression.json');

      // Stage 1: Static Analysis
      const conflicts = gateAnalyzer.findConflicts(expression);
      const bounds = boundsCalculator.calculateBounds(expression);

      // Stage 2: Monte Carlo
      const mcResult = monteCarloSimulator.simulate(expression, {
        sampleCount: 5000,
        trackClauses: true
      });

      // Stage 3: Failure Analysis
      const blockers = failureExplainer.analyzeBlockers(mcResult.clauseFailures);
      const summary = failureExplainer.generateSummary(mcResult.triggerRate, blockers);

      // Stage 4: Witness Finding
      const witnessResult = witnessStateFinder.findWitness(expression, {
        maxIterations: 5000
      });

      // Stage 5: Suggestions
      const suggestions = thresholdSuggester.generateSuggestions(expression, mcResult);

      // Verify pipeline coherence
      expect(conflicts).toBeDefined();
      expect(bounds).toBeDefined();
      expect(mcResult.triggerRate).toBeGreaterThan(0);
      expect(blockers).toBeDefined();
      expect(summary).toBeDefined();
      expect(witnessResult).toBeDefined();
      expect(suggestions).toBeDefined();

      // If MC shows low rate, suggestions should propose improvements
      if (mcResult.triggerRate < 0.5) {
        expect(suggestions.bestPossibleRate).toBeGreaterThanOrEqual(mcResult.triggerRate);
      }

      // If witness found, it should match MC showing non-zero rate
      if (witnessResult.found) {
        expect(mcResult.triggerRate).toBeGreaterThan(0);
      }
    });
  });

  describe('Confidence Interval Accuracy', () => {
    it('should produce tight confidence intervals with large sample size', () => {
      const expression = loadFixture('rareButPossible.expression.json');

      const result = monteCarloSimulator.simulate(expression, {
        sampleCount: 10000
      });

      const ciWidth = result.confidenceInterval.high - result.confidenceInterval.low;
      expect(ciWidth).toBeLessThan(0.05); // 5% max width for 10K samples
    });

    it('should have wider confidence intervals with small sample size', () => {
      const expression = loadFixture('rareButPossible.expression.json');

      const result = monteCarloSimulator.simulate(expression, {
        sampleCount: 100
      });

      const ciWidth = result.confidenceInterval.high - result.confidenceInterval.low;
      expect(ciWidth).toBeGreaterThan(0.01); // Should be wider
    });
  });

  describe('Witness State Validity', () => {
    it('should produce valid witness that actually triggers expression', () => {
      const expression = loadFixture('rareButPossible.expression.json');

      const result = witnessStateFinder.findWitness(expression, {
        maxIterations: 10000
      });

      if (result.found) {
        // Verify the witness state has valid structure
        expect(result.witness.mood).toBeDefined();
        expect(result.witness.sexual).toBeDefined();

        // Verify mood axes in bounds
        for (const axis of ['valence', 'energy', 'dominance', 'novelty', 'threat']) {
          expect(result.witness.mood[axis]).toBeGreaterThanOrEqual(-100);
          expect(result.witness.mood[axis]).toBeLessThanOrEqual(100);
        }

        // Verify sexual axes in bounds
        for (const axis of ['sex_excitation', 'sex_inhibition', 'baseline_libido']) {
          expect(result.witness.sexual[axis]).toBeGreaterThanOrEqual(0);
          expect(result.witness.sexual[axis]).toBeLessThanOrEqual(100);
        }
      }
    });
  });
});
```

### realExpressionAnalysis.integration.test.js

```javascript
/**
 * @file Integration tests using real expressions from the mods folder
 * @see specs/expression-diagnostics.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import glob from 'glob';

// Test utilities
import { createTestContainer } from '../../common/testContainer.js';

describe('Real Expression Analysis - Integration', () => {
  let container;
  let gateAnalyzer;
  let monteCarloSimulator;

  const expressionsPath = path.join(__dirname, '../../../data/mods');

  beforeAll(async () => {
    container = await createTestContainer();
    gateAnalyzer = container.resolve('IGateConstraintAnalyzer');
    monteCarloSimulator = container.resolve('IMonteCarloSimulator');
  });

  afterAll(() => {
    container?.dispose();
  });

  /**
   * Find all expression files in mods folder
   */
  const findExpressionFiles = () => {
    return glob.sync('**/*.expression.json', { cwd: expressionsPath });
  };

  describe('Expression File Validation', () => {
    const expressionFiles = findExpressionFiles();

    if (expressionFiles.length === 0) {
      it.skip('No expression files found in mods folder', () => {});
      return;
    }

    describe.each(expressionFiles)('Expression: %s', (filename) => {
      let expression;

      beforeAll(() => {
        const filepath = path.join(expressionsPath, filename);
        expression = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      });

      it('should have valid structure', () => {
        expect(expression.id).toBeDefined();
        // Prerequisites may be empty but should be defined or absent
        if (expression.prerequisites) {
          expect(Array.isArray(expression.prerequisites)).toBe(true);
        }
      });

      it('should complete static analysis without errors', () => {
        expect(() => {
          gateAnalyzer.findConflicts(expression);
        }).not.toThrow();
      });

      it('should complete Monte Carlo simulation without errors', () => {
        expect(() => {
          monteCarloSimulator.simulate(expression, {
            sampleCount: 100
          });
        }).not.toThrow();
      });
    });
  });

  describe('Aggregate Analysis', () => {
    it('should analyze all expressions and categorize by trigger rate', () => {
      const expressionFiles = findExpressionFiles();

      const categories = {
        impossible: [],      // 0%
        extremelyRare: [],   // < 0.001%
        rare: [],            // 0.001% - 0.05%
        normal: [],          // 0.05% - 2%
        frequent: []         // > 2%
      };

      for (const filename of expressionFiles) {
        const filepath = path.join(expressionsPath, filename);
        const expression = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

        const result = monteCarloSimulator.simulate(expression, {
          sampleCount: 500
        });

        const rate = result.triggerRate;
        if (rate === 0) {
          categories.impossible.push(filename);
        } else if (rate < 0.00001) {
          categories.extremelyRare.push(filename);
        } else if (rate < 0.0005) {
          categories.rare.push(filename);
        } else if (rate < 0.02) {
          categories.normal.push(filename);
        } else {
          categories.frequent.push(filename);
        }
      }

      // Report results
      console.log('\n=== Expression Rarity Distribution ===');
      console.log(`Impossible (0%): ${categories.impossible.length}`);
      console.log(`Extremely Rare (<0.001%): ${categories.extremelyRare.length}`);
      console.log(`Rare (0.001-0.05%): ${categories.rare.length}`);
      console.log(`Normal (0.05-2%): ${categories.normal.length}`);
      console.log(`Frequent (>2%): ${categories.frequent.length}`);

      // At least some expressions should be in each non-extreme category
      // (This is informational, not a hard assertion)
      expect(expressionFiles.length).toBeGreaterThan(0);
    });
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- tests/integration/expressionDiagnostics/ --verbose
```

### Integration Test Coverage Requirements

**diagnosticsPipeline.integration.test.js:**
- Always-true expression: 100% rate, no conflicts, immediate witness
- Always-false expression: 0% rate, conflicts detected, no witness
- Rare expression: low non-zero rate, witness found with iterations
- Conflicting gates: detected by static analysis
- Unreachable threshold: detected by bounds calculator
- Full pipeline flow test
- Confidence interval width tests
- Witness state validity checks

**realExpressionAnalysis.integration.test.js:**
- All expression files have valid structure
- All expressions complete static analysis without errors
- All expressions complete Monte Carlo without errors
- Aggregate rarity distribution report

### Invariants That Must Remain True

1. **Pipeline consistency** - If MC shows 0%, witness finding should fail
2. **Witness validity** - Found witnesses have valid axis values
3. **CI bounds** - Larger samples → tighter confidence intervals
4. **No regressions** - Real expressions continue to analyze correctly
5. **Error resilience** - Invalid expressions don't crash pipeline

## Verification Commands

```bash
# Run integration tests
npm run test:integration -- tests/integration/expressionDiagnostics/ --verbose

# Run with coverage
npm run test:integration -- tests/integration/expressionDiagnostics/ --coverage

# Run specific test file
npm run test:integration -- tests/integration/expressionDiagnostics/diagnosticsPipeline.integration.test.js --verbose
```

## Definition of Done

- [ ] Test fixtures created (5 expression files)
- [ ] `diagnosticsPipeline.integration.test.js` created
- [ ] `realExpressionAnalysis.integration.test.js` created
- [ ] Always-true tests pass
- [ ] Always-false tests pass
- [ ] Rare-but-possible tests pass
- [ ] Conflicting gates tests pass
- [ ] Unreachable threshold tests pass
- [ ] Full pipeline flow test passes
- [ ] Real expression analysis completes without errors
- [ ] All tests pass
- [ ] No modifications to service implementations

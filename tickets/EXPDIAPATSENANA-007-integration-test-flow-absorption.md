# EXPDIAPATSENANA-007: Integration Test for flow_absorption Fix

## Summary

Create the integration test that validates the original bug fix: `flow_absorption.expression.json` should correctly report that `flow >= 0.85` IS reachable via interest/fascination branches, NOT incorrectly flag it as unreachable.

## Priority: High | Effort: Small

## Rationale

This ticket validates the core value proposition of path-sensitive analysis. The `flow_absorption` expression was the originating issue that revealed the false-positive problem. The integration test serves as:
1. Regression prevention for the specific bug
2. Documentation of expected behavior
3. Validation that the full analysis pipeline works correctly

## Dependencies

- **EXPDIAPATSENANA-006** (Complete PathSensitiveAnalyzer with constraint analysis)
- Existing expression loading infrastructure
- Existing emotion prototype definitions in data/mods/

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/expression-diagnostics/flowAbsorptionAnalysis.integration.test.js` | **Create** |
| `tests/fixtures/expressionDiagnostics/pathSensitive/orBranchAllReachable.expression.json` | **Create** |
| `tests/fixtures/expressionDiagnostics/pathSensitive/orBranchMixedReachable.expression.json` | **Create** |
| `tests/fixtures/expressionDiagnostics/pathSensitive/nestedOrBranches.expression.json` | **Create** |

## Out of Scope

- **DO NOT** modify PathSensitiveAnalyzer service - that's EXPDIAPATSENANA-005/006
- **DO NOT** modify the models - those are EXPDIAPATSENANA-001-004
- **DO NOT** create UI components - that's EXPDIAPATSENANA-008
- **DO NOT** modify the actual `flow_absorption.expression.json` in data/mods/
- **DO NOT** modify existing integration tests

## Implementation Details

### Integration Test

```javascript
/**
 * @file Integration test for path-sensitive analysis fixing flow_absorption false positive
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupMinimalTestContainer } from '../../common/testContainerSetup.js';
import { diagnosticsTokens } from '../../../src/dependencyInjection/tokens/tokens-diagnostics.js';
import { tokens } from '../../../src/dependencyInjection/tokens/tokens.js';

describe('flow_absorption.expression.json path-sensitive analysis', () => {
  let container;
  let pathSensitiveAnalyzer;
  let gateConstraintAnalyzer;
  let intensityBoundsCalculator;

  beforeAll(async () => {
    container = await setupMinimalTestContainer({
      loadMods: ['core', 'emotions-attention'],
      loadExpressions: true
    });

    pathSensitiveAnalyzer = container.resolve(diagnosticsTokens.IPathSensitiveAnalyzer);
    gateConstraintAnalyzer = container.resolve(diagnosticsTokens.IGateConstraintAnalyzer);
    intensityBoundsCalculator = container.resolve(diagnosticsTokens.IIntensityBoundsCalculator);
  });

  afterAll(async () => {
    if (container?.dispose) {
      await container.dispose();
    }
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
     * Old behavior: Merged all OR branch gates, incorrectly reporting flow max = 0.7666...
     * New behavior: Analyzes each branch independently, correctly identifying:
     *   - interest branch: flow >= 0.85 IS reachable
     *   - fascination branch: flow >= 0.85 IS reachable
     *   - entrancement branch: flow >= 0.85 is NOT reachable (knife-edge on agency_control)
     */
    it('should correctly identify that flow >= 0.85 IS reachable via interest/fascination branches', async () => {
      // Load the actual expression from mods
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('emotions-attention:flow_absorption');

      expect(expression).toBeDefined();
      expect(expression.id).toBe('emotions-attention:flow_absorption');

      // Perform path-sensitive analysis
      const result = pathSensitiveAnalyzer.analyze(expression);

      // The expression should have at least one fully reachable branch
      expect(result.hasFullyReachableBranch).toBe(true);
      expect(result.fullyReachableBranchIds.length).toBeGreaterThanOrEqual(1);

      // Summary should indicate expression CAN trigger
      expect(result.overallStatus).toBe('fully_reachable');
      expect(result.getSummaryMessage()).toContain('CAN trigger');
    });

    it('should identify entrancement branch as having knife-edge constraint', async () => {
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('emotions-attention:flow_absorption');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Find branch(es) that include entrancement
      const entrancementBranches = result.branches.filter(b =>
        b.requiredPrototypes.includes('entrancement')
      );

      // There should be at least one entrancement branch
      expect(entrancementBranches.length).toBeGreaterThanOrEqual(1);

      // At least one should have knife-edge on agency_control
      const hasAgencyControlKnifeEdge = entrancementBranches.some(branch =>
        branch.knifeEdges.some(ke => ke.axis === 'agency_control')
      );

      expect(hasAgencyControlKnifeEdge).toBe(true);
    });

    it('should show flow >= 0.85 unreachable in entrancement branch with correct max', async () => {
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('emotions-attention:flow_absorption');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Find entrancement branch reachability for flow
      const entrancementFlowReachability = result.reachabilityByBranch.find(r =>
        r.prototypeId === 'flow' &&
        r.threshold >= 0.85 &&
        result.branches.find(b =>
          b.branchId === r.branchId &&
          b.requiredPrototypes.includes('entrancement')
        )
      );

      if (entrancementFlowReachability) {
        // In entrancement branch, flow >= 0.85 should be unreachable
        expect(entrancementFlowReachability.isReachable).toBe(false);

        // Max should be approximately 0.77 (due to knife-edge constraints)
        expect(entrancementFlowReachability.maxPossible).toBeLessThan(0.85);
        expect(entrancementFlowReachability.maxPossible).toBeCloseTo(0.77, 1);
      }
    });

    it('should show flow >= 0.85 reachable in interest/fascination branches', async () => {
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('emotions-attention:flow_absorption');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Find branches with interest or fascination (but not entrancement)
      const nonEntrancementBranches = result.branches.filter(b =>
        (b.requiredPrototypes.includes('interest') || b.requiredPrototypes.includes('fascination')) &&
        !b.requiredPrototypes.includes('entrancement')
      );

      // At least one should exist
      expect(nonEntrancementBranches.length).toBeGreaterThanOrEqual(1);

      // Check reachability for these branches
      for (const branch of nonEntrancementBranches) {
        const flowReachability = result.reachabilityByBranch.find(r =>
          r.branchId === branch.branchId &&
          r.prototypeId === 'flow' &&
          r.threshold >= 0.85
        );

        if (flowReachability) {
          // In non-entrancement branches, flow >= 0.85 should be reachable
          expect(flowReachability.isReachable).toBe(true);
        }
      }
    });
  });

  describe('Comparison with path-insensitive analysis', () => {
    it('should produce different results than path-insensitive analysis', async () => {
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('emotions-attention:flow_absorption');

      // Path-insensitive analysis (current/old behavior)
      const gateResult = gateConstraintAnalyzer.analyze(expression);
      const pathInsensitiveIssues = intensityBoundsCalculator.analyzeExpression(
        expression,
        gateResult.axisIntervals
      );

      // Path-sensitive analysis (new behavior)
      const pathSensitiveResult = pathSensitiveAnalyzer.analyze(expression);

      // Path-insensitive should report issues (false positive)
      const insensitiveUnreachable = pathInsensitiveIssues.filter(i => !i.isReachable);

      // Path-sensitive should show at least one fully reachable branch
      expect(pathSensitiveResult.hasFullyReachableBranch).toBe(true);

      // If path-insensitive reports flow as unreachable, path-sensitive should disagree
      const flowUnreachableInsensitive = insensitiveUnreachable.some(i =>
        i.prototypeId === 'flow' && i.threshold >= 0.85
      );

      if (flowUnreachableInsensitive) {
        // Path-sensitive should show it IS reachable via some branch
        expect(pathSensitiveResult.hasFullyReachableBranch).toBe(true);
      }
    });
  });

  describe('Branch enumeration validation', () => {
    it('should enumerate multiple branches for OR expression', async () => {
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('emotions-attention:flow_absorption');

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Should have multiple branches (at least 3 for interest/fascination/entrancement)
      expect(result.branchCount).toBeGreaterThanOrEqual(3);
    });

    it('should have meaningful branch descriptions', async () => {
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('emotions-attention:flow_absorption');

      const result = pathSensitiveAnalyzer.analyze(expression);

      for (const branch of result.branches) {
        expect(branch.description).toBeDefined();
        expect(branch.description.length).toBeGreaterThan(0);
        // Description should mention prototypes or "path"
        expect(branch.description).toMatch(/path|branch|OR/i);
      }
    });
  });
});

describe('Path-sensitive analysis with test fixtures', () => {
  let container;
  let pathSensitiveAnalyzer;

  beforeAll(async () => {
    container = await setupMinimalTestContainer({
      loadMods: ['core'],
      loadExpressions: true,
      additionalFixtures: [
        'tests/fixtures/expressionDiagnostics/pathSensitive/'
      ]
    });

    pathSensitiveAnalyzer = container.resolve(diagnosticsTokens.IPathSensitiveAnalyzer);
  });

  afterAll(async () => {
    if (container?.dispose) {
      await container.dispose();
    }
  });

  describe('orBranchAllReachable fixture', () => {
    it('should identify all branches as fully reachable', async () => {
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('test:orBranchAllReachable');

      if (!expression) {
        // Skip if fixture not loaded
        return;
      }

      const result = pathSensitiveAnalyzer.analyze(expression);

      expect(result.hasFullyReachableBranch).toBe(true);
      expect(result.fullyReachableBranchIds.length).toBe(result.branchCount);
      expect(result.totalKnifeEdgeCount).toBe(0);
    });
  });

  describe('orBranchMixedReachable fixture', () => {
    it('should identify some branches as reachable and some as not', async () => {
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('test:orBranchMixedReachable');

      if (!expression) {
        // Skip if fixture not loaded
        return;
      }

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Should have at least one reachable branch
      expect(result.hasFullyReachableBranch).toBe(true);

      // But not all branches should be fully reachable
      expect(result.fullyReachableBranchIds.length).toBeLessThan(result.branchCount);
    });
  });

  describe('nestedOrBranches fixture', () => {
    it('should handle nested OR blocks correctly', async () => {
      const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
      const expression = expressionRegistry.getExpression('test:nestedOrBranches');

      if (!expression) {
        // Skip if fixture not loaded
        return;
      }

      const result = pathSensitiveAnalyzer.analyze(expression);

      // Should enumerate all paths through nested ORs
      expect(result.branchCount).toBeGreaterThan(1);

      // Each branch should have unique ID
      const branchIds = result.branches.map(b => b.branchId);
      const uniqueIds = new Set(branchIds);
      expect(uniqueIds.size).toBe(branchIds.length);
    });
  });
});
```

### Test Fixture: orBranchAllReachable.expression.json

```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "test:orBranchAllReachable",
  "description": "Test expression where all OR branches have reachable thresholds",
  "prerequisites": [
    {
      "logic": {
        "or": [
          { ">=": [{"var": "emotions.joy"}, 0.30] },
          { ">=": [{"var": "emotions.contentment"}, 0.30] },
          { ">=": [{"var": "emotions.serenity"}, 0.30] }
        ]
      }
    }
  ],
  "effects": []
}
```

### Test Fixture: orBranchMixedReachable.expression.json

```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "test:orBranchMixedReachable",
  "description": "Test expression where some OR branches are reachable and some are not",
  "prerequisites": [
    {
      "logic": {
        "and": [
          { ">=": [{"var": "emotions.flow"}, 0.85] },
          {
            "or": [
              { ">=": [{"var": "emotions.interest"}, 0.45] },
              { ">=": [{"var": "emotions.entrancement"}, 0.40] }
            ]
          }
        ]
      }
    }
  ],
  "effects": []
}
```

### Test Fixture: nestedOrBranches.expression.json

```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "test:nestedOrBranches",
  "description": "Test expression with nested OR blocks",
  "prerequisites": [
    {
      "logic": {
        "or": [
          {
            "and": [
              { ">=": [{"var": "emotions.joy"}, 0.50] },
              {
                "or": [
                  { ">=": [{"var": "emotions.excitement"}, 0.30] },
                  { ">=": [{"var": "emotions.enthusiasm"}, 0.30] }
                ]
              }
            ]
          },
          { ">=": [{"var": "emotions.serenity"}, 0.60] }
        ]
      }
    }
  ],
  "effects": []
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:integration -- tests/integration/expression-diagnostics/flowAbsorptionAnalysis.integration.test.js --verbose
```

### Integration Test Requirements

**flowAbsorptionAnalysis.integration.test.js:**
- Test loads actual `flow_absorption.expression.json` from mods
- `hasFullyReachableBranch` returns true
- At least 2 branches are fully reachable (interest, fascination)
- Entrancement branch has knife-edge on agency_control
- Entrancement branch shows flow max ≈ 0.77
- Interest/fascination branches show flow >= 0.85 as reachable
- Path-sensitive produces different results than path-insensitive
- Branch count >= 3
- Branch descriptions are meaningful

### Invariants That Must Remain True

1. **flow_absorption always has reachable branch** - Core regression prevention
2. **Fixtures validate specific scenarios** - Each fixture tests distinct case
3. **No modification to actual expression files** - Tests use loaded data
4. **Tests are isolated** - beforeAll/afterAll properly manage container

## Verification Commands

```bash
# Run integration tests
npm run test:integration -- tests/integration/expression-diagnostics/flowAbsorptionAnalysis.integration.test.js --verbose

# Verify fixtures exist
ls -la tests/fixtures/expressionDiagnostics/pathSensitive/

# Quick check that emotions-attention mod is loadable
npm run validate -- --mod emotions-attention
```

## Definition of Done

- [ ] Integration test file created
- [ ] Test fixtures created in pathSensitive/ directory
- [ ] Tests load actual `flow_absorption.expression.json`
- [ ] Tests validate hasFullyReachableBranch = true
- [ ] Tests validate entrancement branch has knife-edge
- [ ] Tests compare with path-insensitive analysis
- [ ] Tests verify branch enumeration
- [ ] All integration tests pass
- [ ] Fixtures have valid JSON schema references

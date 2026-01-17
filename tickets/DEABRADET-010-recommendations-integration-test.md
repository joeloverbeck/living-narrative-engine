# DEABRADET-010: RecommendationEngine Integration and Integration Test

## Description

Add `dead_branch` recommendation type to RecommendationEngine and create the integration test with snapshot verification covering all spec test requirements.

## Files to Modify

- `src/expressionDiagnostics/services/RecommendationEngine.js`:
  - Add logic to emit `dead_branch` recommendations
  - Include severity escalation when OR collapses to single path
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`:
  - Pass deadBranchFindings to recommendation generation

## Files to Create

- `tests/integration/expression-diagnostics/deadBranchReport.integration.test.js`
- `tests/fixtures/expressionDiagnostics/deadBranchFixtures/standardDeadBranchResult.json`
- `tests/fixtures/expressionDiagnostics/deadBranchFixtures/collapsedOrBlockResult.json`

## Out of Scope

- Performance optimization
- Additional edge case handling beyond spec requirements
- Changes to other recommendation types

## Implementation Details

### RecommendationEngine Changes

Add method to generate dead branch recommendations:

```javascript
/**
 * Build recommendations for dead branch findings.
 * @param {import('../models/DeadBranchFindings.js').DeadBranchFindings} findings
 * @returns {object[]} Recommendation objects
 */
#buildDeadBranchRecommendations(findings) {
  if (!findings?.orBlocks?.length) {
    return [];
  }

  const recommendations = [];

  for (const orBlock of findings.orBlocks) {
    const deadAlternatives = orBlock.alternatives.filter(a => a.status === 'DEAD_BRANCH');

    for (const alt of deadAlternatives) {
      // Severity is HIGH if this dead branch causes OR to collapse to single path
      const severity = orBlock.effectiveAlternativeCount === 1 ? 'high' : 'low';

      recommendations.push({
        id: `dead_branch:${alt.id}`,
        type: 'dead_branch',
        severity,
        confidence: this.#deriveConfidence(orBlock.support),
        title: `Dead branch: ${alt.clauseRefs.join(' AND ')}`,
        why: `Alternative is structurally impossible in ${orBlock.population} population`,
        evidence: alt.deadEvidence.map(e => ({
          label: e.type,
          value: e.gap,
          population: orBlock.population,
          details: `${e.clauseRef}: observed=${e.observedBound}, threshold=${e.threshold}`,
        })),
        actions: [
          'Remove dead alternative (simplify logic)',
          'Change regime constraints to enable alternative',
          'Swap to a prototype with feasible range for regime',
          'Lower threshold to match observed maximum',
        ],
        limitingConstraints: alt.limitingConstraints,
        predictedEffect: severity === 'high'
          ? 'OR block has collapsed to single path - removing dead branch simplifies logic'
          : 'Removing dead alternative reduces complexity without changing behavior',
        relatedClauseIds: alt.clauseRefs,
      });
    }
  }

  return recommendations;
}
```

### MonteCarloReportGenerator Changes

Pass findings to recommendation generation:

```javascript
// In generate() method
const recommendations = this.#recommendationEngine.generate({
  // ... existing params
  deadBranchFindings,  // Add this
});
```

### Integration Test Structure

```javascript
/**
 * @file deadBranchReport.integration.test.js
 * @description Integration tests for dead branch detection and reporting
 * @see specs/dead-branch-detection.md - Test requirements 3.1-3.7
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

describe('Dead Branch Report Integration', () => {
  // Spec test 3.6: Report Rendering Includes Label + Explanation
  describe('Report rendering', () => {
    it('generates report with DEAD_BRANCH marking and explanation', () => {
      // Load fixture with dead branch scenario
      // Generate report
      // Verify snapshot matches expected output
    });

    it('includes numeric evidence in explanation', () => {
      // Verify observedBound, threshold, gap in output
    });

    it('includes constraint pointers for emotion-driven dead branches', () => {
      // Verify limiting constraints appear
    });
  });

  // Spec test 3.7: Order Invariance Test
  describe('Order invariance', () => {
    it('produces identical output for reordered OR alternatives', () => {
      // Create fixture with alternatives in order [A, B, C]
      // Create fixture with alternatives in order [C, A, B]
      // Verify identical DEAD_BRANCH outputs (ids, evidence, constraints)
    });
  });

  // Additional integration scenarios
  describe('Collapsed OR block warning', () => {
    it('shows warning when OR collapses to single path', () => {
      // Load fixture where effectiveAlternativeCount === 1
      // Verify warning message appears
    });

    it('generates high severity recommendation for collapsed OR', () => {
      // Verify recommendation severity is 'high'
    });
  });

  describe('Mixed status OR blocks', () => {
    it('handles OR block with ACTIVE, RARE, DEAD_BRANCH, UNOBSERVED alternatives', () => {
      // Verify all statuses render correctly
      // Verify only DEAD_BRANCH gets evidence block
    });
  });
});
```

### Test Fixtures

**standardDeadBranchResult.json**:
```json
{
  "_comment": "Fixture for dead branch detection integration tests",
  "hierarchicalTree": {
    "root": {
      "type": "AND",
      "children": [
        {
          "type": "OR",
          "id": "or_block_1",
          "support": 452,
          "alternatives": [
            {
              "kind": "leaf",
              "clauseRefs": ["emotions.moral_outrage >= 0.6"],
              "passCount": 6,
              "passRate": 0.0133,
              "support": 452,
              "operator": ">=",
              "threshold": 0.6,
              "maxObserved": 0.60,
              "isEmotionClause": true,
              "emotionId": "moral_outrage"
            },
            {
              "kind": "and_group",
              "clauseRefs": ["emotions.rage >= 0.45", "moodAxes.affiliation >= 10"],
              "passCount": 0,
              "passRate": 0,
              "support": 452,
              "operator": ">=",
              "threshold": 0.45,
              "maxObserved": 0.26,
              "isEmotionClause": true,
              "emotionId": "rage",
              "gatePassRate": 0.8
            }
          ]
        }
      ]
    }
  },
  "prototypeMath": {
    "rage": {
      "bindingAxes": [
        { "axis": "arousal", "weight": 0.95, "bindingType": "positive_weight_low_max" }
      ],
      "maxFinalInRegime": 0.26
    }
  },
  "regimeConstraints": {
    "arousal": { "operator": "<=", "bound": 45 }
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Spec test 3.6 (Integration) - Report rendering**:
   - Report contains OR Block section with DEAD_BRANCH marking
   - Explanation includes numeric evidence (observedBound, threshold, gap)
   - Explanation includes constraint pointers

2. **Spec test 3.7 - Order invariance**:
   - Same OR alternatives in different order produce identical output
   - Alternative IDs are identical regardless of input order
   - Evidence arrays are identical

3. **Recommendation generation**:
   - `dead_branch` recommendation emitted for each dead alternative
   - Severity is `high` when OR collapses to single path
   - Severity is `low` otherwise
   - Suggested actions match spec

4. **Snapshot tests**:
   - Full report snapshot matches expected output
   - Timestamps normalized for deterministic comparison

### Invariants That Must Remain True

1. **All spec acceptance criteria (1-8) are satisfied**
2. Existing integration test snapshots remain unchanged
3. New snapshots are deterministic (no random/time-dependent values)
4. Order invariance verified with explicit test
5. `npm run test:integration` passes
6. `npm run typecheck` passes
7. `npx eslint tests/integration/expression-diagnostics/deadBranchReport.integration.test.js` passes

## Dependencies

- DEABRADET-001 through DEABRADET-009 (all previous tickets)

## Estimated Diff Size

~50 lines RecommendationEngine + ~20 lines MonteCarloReportGenerator + ~300 lines integration test + ~100 lines fixtures = ~470 lines total

# DEABRADET-007: DeadBranchDetector Service

## Description

Create the main orchestrator service that coordinates detection across OR blocks using AlternativeIdGenerator, StructuralImpossibilityAnalyzer, and LimitingConstraintExtractor.

## Files to Create

- `src/expressionDiagnostics/services/DeadBranchDetector.js`
- `tests/unit/expressionDiagnostics/services/DeadBranchDetector.test.js`

## Files to Modify

- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add `IDeadBranchDetector` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Add registration with dependencies

## Out of Scope

- Section generator (DEABRADET-008)
- MonteCarloReportGenerator integration (DEABRADET-009)
- Recommendation generation (DEABRADET-010)

## Implementation Details

### DeadBranchDetector.js

```javascript
/**
 * @file DeadBranchDetector - Main orchestrator for dead branch detection
 * @see specs/dead-branch-detection.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { createAlternative, deriveAlternativeStatus } from '../models/Alternative.js';
import { createOrBlock, computeEffectiveAlternativeCount } from '../models/OrBlock.js';
import { createDeadBranchFindings } from '../models/DeadBranchFindings.js';

class DeadBranchDetector {
  #logger;
  #structuralImpossibilityAnalyzer;
  #limitingConstraintExtractor;
  #alternativeIdGenerator;

  constructor({
    logger,
    structuralImpossibilityAnalyzer,
    limitingConstraintExtractor,
    alternativeIdGenerator,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(structuralImpossibilityAnalyzer, 'IStructuralImpossibilityAnalyzer', logger, {
      requiredMethods: ['analyze'],
    });
    validateDependency(limitingConstraintExtractor, 'ILimitingConstraintExtractor', logger, {
      requiredMethods: ['extractForEmotion', 'extractForNonEmotion'],
    });
    validateDependency(alternativeIdGenerator, 'IAlternativeIdGenerator', logger, {
      requiredMethods: ['generate'],
    });

    this.#logger = logger;
    this.#structuralImpossibilityAnalyzer = structuralImpossibilityAnalyzer;
    this.#limitingConstraintExtractor = limitingConstraintExtractor;
    this.#alternativeIdGenerator = alternativeIdGenerator;
  }

  /**
   * Detect dead branches across all OR blocks.
   * @param {object} params
   * @param {object[]} params.orBlockNodes - OR block nodes from tree
   * @param {object} params.prototypeMathByEmotion - Prototype math keyed by emotion
   * @param {object} params.regimeConstraints - Active regime constraints
   * @param {string} params.population - Population type
   * @returns {import('../models/DeadBranchFindings.js').DeadBranchFindings}
   */
  detect({ orBlockNodes, prototypeMathByEmotion, regimeConstraints, population }) {
    const orBlocks = [];

    for (const node of orBlockNodes) {
      const alternatives = this.#analyzeAlternatives(
        node,
        prototypeMathByEmotion,
        regimeConstraints,
        population
      );

      if (alternatives.some(alt => alt.status === 'DEAD_BRANCH')) {
        orBlocks.push(createOrBlock({
          id: node.id,
          population,
          support: node.support,
          alternatives,
        }));
      }
    }

    return createDeadBranchFindings({ orBlocks });
  }

  #analyzeAlternatives(node, prototypeMathByEmotion, regimeConstraints, population) {
    return node.alternatives.map(alt => {
      const id = this.#alternativeIdGenerator.generate(alt.clauseRefs);
      const deadEvidence = [];
      const limitingConstraints = [];

      // Only analyze if passCount === 0
      if (alt.passCount === 0) {
        for (const clauseRef of alt.clauseRefs) {
          const evidence = this.#structuralImpossibilityAnalyzer.analyze({
            clauseRef,
            operator: alt.operator,
            threshold: alt.threshold,
            maxObserved: alt.maxObserved,
            minObserved: alt.minObserved,
            gatePassRate: alt.gatePassRate,
            isEmotionClause: alt.isEmotionClause,
          });

          if (evidence) {
            deadEvidence.push(evidence);

            // Extract limiting constraints
            const constraints = alt.isEmotionClause
              ? this.#limitingConstraintExtractor.extractForEmotion({
                  emotionId: alt.emotionId,
                  prototypeMath: prototypeMathByEmotion[alt.emotionId],
                  regimeConstraints,
                  deadEvidence: evidence,
                })
              : this.#limitingConstraintExtractor.extractForNonEmotion({
                  deadEvidence: evidence,
                });

            limitingConstraints.push(...constraints);
          }
        }
      }

      const hasStructuralImpossibility = deadEvidence.length > 0;
      const status = deriveAlternativeStatus({
        passCount: alt.passCount,
        passRate: alt.passRate,
        hasStructuralImpossibility,
      });

      return createAlternative({
        id,
        kind: alt.kind,
        clauseRefs: alt.clauseRefs,
        passCount: alt.passCount,
        passRate: alt.passRate,
        support: alt.support,
        status,
        deadEvidence,
        limitingConstraints,
      });
    });
  }
}

export default DeadBranchDetector;
```

### DI Registration

```javascript
registrar.singletonFactory(
  diagnosticsTokens.IDeadBranchDetector,
  (c) => new DeadBranchDetector({
    logger: c.resolve(tokens.ILogger),
    structuralImpossibilityAnalyzer: c.resolve(diagnosticsTokens.IStructuralImpossibilityAnalyzer),
    limitingConstraintExtractor: c.resolve(diagnosticsTokens.ILimitingConstraintExtractor),
    alternativeIdGenerator: c.resolve(diagnosticsTokens.IAlternativeIdGenerator),
  })
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **Constructor validation**:
   - Throws if any dependency is missing
   - Throws if any dependency is invalid

2. **Spec test 3.1 - Rage path is DEAD_BRANCH**:
   ```javascript
   // Given: OR block with alternative = AND(emotions.rage >= 0.45, moodAxes.affiliation >= 10)
   // passCount=0, maxFinal=0.26, threshold=0.45
   // Expect: status=DEAD_BRANCH, deadEvidence contains CEILING, limitingConstraints has arousal constraint
   ```

3. **Spec test 3.2 - moral_outrage NOT dead**:
   ```javascript
   // Given: alternative with passCount=6, passRate=0.0133
   // Expect: status='RARE' (NOT DEAD_BRANCH)
   ```

4. **Spec test 3.3 - passCount=0 but possible → UNOBSERVED**:
   ```javascript
   // Given: passCount=0, maxObserved=0.90, threshold=0.85
   // Expect: status='UNOBSERVED', deadEvidence empty
   ```

5. **Spec test 3.4 - CLAMP_IMPOSSIBLE**:
   ```javascript
   // Given: emotion clause with gatePassRate=0, threshold > 0
   // Expect: status=DEAD_BRANCH, deadEvidence contains CLAMP_IMPOSSIBLE
   ```

6. **Spec test 3.5 - FLOOR detection**:
   ```javascript
   // Given: moodAxes.threat <= 10 with minObserved=30
   // Expect: status=DEAD_BRANCH, deadEvidence contains FLOOR
   ```

7. **Integration tests**:
   - Empty orBlockNodes returns empty findings
   - OR block with no dead branches not included in findings
   - Multiple OR blocks with dead branches all included
   - Mixed statuses in single OR block handled correctly

### Invariants That Must Remain True

1. **Spec invariant 2**: DEAD_BRANCH evaluated per population (population passed through)
2. **Spec invariant 3**: No dead without structural proof (UNOBSERVED if no evidence)
3. **Spec invariant 4**: No dead if passed once (passCount > 0 never yields DEAD_BRANCH)
4. **Spec invariant 6**: Every DEAD_BRANCH has evidence + constraints
5. Service orchestrates correctly without duplicating logic from sub-services
6. Existing tests continue to pass
7. `npm run typecheck` passes
8. `npx eslint src/expressionDiagnostics/services/DeadBranchDetector.js` passes

## Dependencies

- DEABRADET-001 (DeadEvidence, LimitingConstraint models)
- DEABRADET-002 (Alternative model)
- DEABRADET-003 (OrBlock, DeadBranchFindings models)
- DEABRADET-004 (AlternativeIdGenerator service)
- DEABRADET-005 (StructuralImpossibilityAnalyzer service)
- DEABRADET-006 (LimitingConstraintExtractor service)

## Estimated Diff Size

~200 lines of source code + ~350 lines of tests + ~15 lines DI = ~565 lines total

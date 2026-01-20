# PROOVEANA-003: OverlapClassifier Service

## Description

Implement the classification logic that determines whether a prototype pair should be classified as MERGE, SUBSUMED, or NOT_REDUNDANT based on their behavioral metrics. This is a pure decision service with no side effects.

## Files to Create

- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.test.js`

## Files to Modify

None

## Out of Scope

- Candidate filtering - PROOVEANA-001
- Behavioral evaluation - PROOVEANA-002
- Recommendation building - PROOVEANA-004
- DI registration - PROOVEANA-006
- Integration tests - PROOVEANA-010

## Implementation Details

### Classification Rules (from spec)

**MERGE** - Both prototypes are functionally equivalent and should be combined:
- `gateOverlap.onEitherRate >= config.minOnEitherRateForMerge` (not dead prototypes)
- `gateOverlap.onBothRate / gateOverlap.onEitherRate >= config.minGateOverlapRatio`
- `intensity.pearsonCorrelation >= config.minCorrelationForMerge`
- `intensity.meanAbsDiff <= config.maxMeanAbsDiffForMerge`
- `intensity.dominanceP < config.minDominanceForSubsumption` AND `intensity.dominanceQ < config.minDominanceForSubsumption`

**SUBSUMED** - One prototype is a subset of the other:
- Either `gateOverlap.pOnlyRate <= config.maxExclusiveRateForSubsumption` OR `gateOverlap.qOnlyRate <= config.maxExclusiveRateForSubsumption`
- `intensity.pearsonCorrelation >= config.minCorrelationForSubsumption`
- Either `intensity.dominanceP >= config.minDominanceForSubsumption` OR `intensity.dominanceQ >= config.minDominanceForSubsumption`

**NOT_REDUNDANT** - Prototypes are sufficiently different to keep both.

### OverlapClassifier.js

```javascript
/**
 * @file OverlapClassifier - Classification logic for prototype overlap analysis
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {'merge'|'subsumed'|'not_redundant'} ClassificationType
 */

/**
 * @typedef {object} Classification
 * @property {ClassificationType} type
 * @property {'a'|'b'} [subsumedPrototype] - Only present for 'subsumed' type
 */

class OverlapClassifier {
  #config;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.config - PROTOTYPE_OVERLAP_CONFIG
   * @param {object} deps.logger - ILogger
   */
  constructor({ config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Classify a prototype pair based on behavioral metrics.
   *
   * @param {object} candidateMetrics - From Stage A
   * @param {object} behaviorMetrics - From Stage B
   * @returns {Classification}
   */
  classify(candidateMetrics, behaviorMetrics) {
    // 1. Check MERGE criteria first
    // 2. Check SUBSUMED criteria
    // 3. Default to NOT_REDUNDANT
  }

  /**
   * Check if pair meets MERGE criteria.
   * @param {object} behaviorMetrics
   * @returns {boolean}
   */
  #checkMergeCriteria(behaviorMetrics) {}

  /**
   * Check if pair meets SUBSUMED criteria.
   * @param {object} behaviorMetrics
   * @returns {{isSubsumed: boolean, subsumedPrototype?: 'a'|'b'}}
   */
  #checkSubsumedCriteria(behaviorMetrics) {}
}

export default OverlapClassifier;
```

## Acceptance Criteria

### Tests That Must Pass

```javascript
// Merge classification
it('classifies as merge when all merge criteria met')
it('does NOT classify as merge when onEitherRate too low (dead prototypes)')
it('does NOT classify as merge when gateOverlapRatio too low')
it('does NOT classify as merge when correlation too low')
it('does NOT classify as merge when meanAbsDiff too high')
it('does NOT classify as merge when one dominance is overwhelming')

// Subsumption classification
it('classifies as subsumed when A is subset of B')
it('classifies as subsumed when B is subset of A')
it('sets subsumedPrototype to "a" when A is subsumed')
it('sets subsumedPrototype to "b" when B is subsumed')

// Not redundant
it('classifies as not_redundant when criteria not met')
it('classifies similar weights but different gates as not_redundant')

// Edge cases
it('does not merge dead prototypes (low onEitherRate)')
```

### Invariants

- Classification is deterministic given same inputs
- No merge when `onEitherRate < minOnEitherRateForMerge` (protects dead prototypes)
- `subsumedPrototype` only present when `type === 'subsumed'`
- `npm run test:unit -- --grep "overlapClassifier"` passes with >90% coverage
- `npx eslint <created-files>` passes

## Verification Commands

```bash
npm run test:unit -- --testPathPattern="overlapClassifier"
npx eslint src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js
```

## Dependencies

- PROOVEANA-000 (config)

## Estimated Diff Size

- Source: ~150 lines
- Tests: ~300 lines
- **Total: ~450 lines**

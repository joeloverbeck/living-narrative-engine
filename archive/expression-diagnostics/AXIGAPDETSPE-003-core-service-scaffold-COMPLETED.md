# AXIGAPDETSPE-003: Create AxisGapAnalyzer Service Scaffold

## Description

Create the core `AxisGapAnalyzer` service class with constructor, dependency validation, and private field initialization. This scaffold will be extended by subsequent tickets with the actual detection methods.

## Assumptions Reassessed

- The `AxisGapAnalyzer` lives in `src/expressionDiagnostics/services/`, so its `validateDependency` import path should be `../../utils/dependencyUtils.js` (not `../../../utils/dependencyUtils.js`).

## Files to Create

- `src/expressionDiagnostics/services/AxisGapAnalyzer.js`
- `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js` (scaffold only)

## Files to Modify

- `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js`
  - Add import for AxisGapAnalyzer
  - Add singleton factory registration

- `tests/unit/dependencyInjection/registrations/prototypeOverlapRegistrations.test.js`
  - Add test for IAxisGapAnalyzer registration

## Out of Scope

- PCA analysis implementation (AXIGAPDETSPE-004)
- Hub detection implementation (AXIGAPDETSPE-005)
- Coverage gap detection implementation (AXIGAPDETSPE-006)
- Multi-axis conflict detection implementation (AXIGAPDETSPE-007)
- Report synthesis implementation (AXIGAPDETSPE-008)
- Pipeline integration (AXIGAPDETSPE-009)
- UI integration (AXIGAPDETSPE-010)
- Config properties (handled by AXIGAPDETSPE-001)
- DI token (handled by AXIGAPDETSPE-002)

## Implementation Details

### AxisGapAnalyzer.js Structure

```javascript
/**
 * @file Detects axis space inadequacy through multiple analysis methods.
 * @see specs/axis-gap-detection-spec.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {Object} AxisGapReport
 * @property {Object} summary
 * @property {Object} pcaAnalysis
 * @property {Array} hubPrototypes
 * @property {Array} coverageGaps
 * @property {Array} multiAxisConflicts
 * @property {Array} recommendations
 */

class AxisGapAnalyzer {
  #prototypeProfileCalculator;
  #config;
  #logger;

  /**
   * @param {Object} deps
   * @param {Object} deps.prototypeProfileCalculator - For clustering access
   * @param {Object} deps.config - PROTOTYPE_OVERLAP_CONFIG with axis gap thresholds
   * @param {Object} deps.logger - ILogger instance
   */
  constructor({ prototypeProfileCalculator, config, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(
      prototypeProfileCalculator,
      'IPrototypeProfileCalculator',
      logger,
      { requiredMethods: ['calculateAll'] }
    );

    if (!config || typeof config !== 'object') {
      throw new Error('AxisGapAnalyzer requires config object');
    }

    this.#prototypeProfileCalculator = prototypeProfileCalculator;
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Analyze all prototypes for axis gap indicators.
   *
   * @param {Array<Object>} prototypes - All prototypes with weights
   * @param {Map<string, Object>} outputVectors - Pre-computed vectors from V3 setup
   * @param {Map<string, Object>} profiles - Pre-computed profiles from V3 setup
   * @param {Array<Object>} pairResults - Classification results from Stage C
   * @param {Function} [onProgress] - Progress callback
   * @returns {AxisGapReport} Analysis report
   */
  analyze(prototypes, outputVectors, profiles, pairResults, onProgress) {
    // Stub - to be implemented in AXIGAPDETSPE-008
    throw new Error('Not implemented - see AXIGAPDETSPE-008');
  }

  // Private method stubs for subsequent tickets
  #runPCAAnalysis(prototypes) {
    // Stub - to be implemented in AXIGAPDETSPE-004
    throw new Error('Not implemented - see AXIGAPDETSPE-004');
  }

  #identifyHubPrototypes(pairResults) {
    // Stub - to be implemented in AXIGAPDETSPE-005
    throw new Error('Not implemented - see AXIGAPDETSPE-005');
  }

  #detectCoverageGaps(profiles) {
    // Stub - to be implemented in AXIGAPDETSPE-006
    throw new Error('Not implemented - see AXIGAPDETSPE-006');
  }

  #detectMultiAxisConflicts(prototypes) {
    // Stub - to be implemented in AXIGAPDETSPE-007
    throw new Error('Not implemented - see AXIGAPDETSPE-007');
  }

  #synthesizeReport(pcaResult, hubs, gaps, conflicts) {
    // Stub - to be implemented in AXIGAPDETSPE-008
    throw new Error('Not implemented - see AXIGAPDETSPE-008');
  }
}

export default AxisGapAnalyzer;
```

### DI Registration Pattern

```javascript
// Axis Gap Detection Service
registrar.singletonFactory(
  diagnosticsTokens.IAxisGapAnalyzer,
  (c) =>
    new AxisGapAnalyzer({
      prototypeProfileCalculator: c.resolve(
        diagnosticsTokens.IPrototypeProfileCalculator
      ),
      config: PROTOTYPE_OVERLAP_CONFIG,
      logger: c.resolve(tokens.ILogger),
    })
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **axisGapAnalyzer.test.js** - constructor tests:
   - Constructor accepts valid dependencies
   - Constructor throws when `logger` is missing
   - Constructor throws when `logger` lacks required methods
   - Constructor throws when `prototypeProfileCalculator` is missing
   - Constructor throws when `prototypeProfileCalculator` lacks `calculateAll`
   - Constructor throws when `config` is missing
   - Constructor throws when `config` is not an object

2. **prototypeOverlapRegistrations.test.js** - new test:
   - `IAxisGapAnalyzer` can be resolved from container
   - Resolved instance is a singleton (same instance on multiple resolves)

### Invariants That Must Remain True

1. All existing services remain resolvable from container
2. Existing registration tests continue to pass
3. `npm run typecheck` passes
4. `npx eslint src/expressionDiagnostics/services/AxisGapAnalyzer.js src/dependencyInjection/registrations/prototypeOverlapRegistrations.js` passes
5. Constructor validation follows `validateDependency` pattern
6. Private fields use `#` prefix

## Dependencies

- AXIGAPDETSPE-001 (config properties must exist)
- AXIGAPDETSPE-002 (DI token must exist)

## Estimated Diff Size

~120 lines service + ~80 lines test + ~20 lines registration = ~220 lines total

## Status

- [x] Completed

## Outcome

Implemented the `AxisGapAnalyzer` scaffold (constructor + stub methods), registered it in DI, and added constructor and DI registration tests. No pipeline integration or detection logic was added, consistent with the scaffold-only scope.

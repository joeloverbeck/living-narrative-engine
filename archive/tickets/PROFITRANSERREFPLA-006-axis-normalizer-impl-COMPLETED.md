# PROFITRANSERREFPLA-006: Extract ContextAxisNormalizer

**Status**: Completed
**Priority**: HIGH
**Estimated Effort**: M (1-2 days)
**Dependencies**: PROFITRANSERREFPLA-005
**Blocks**: PROFITRANSERREFPLA-007, PROFITRANSERREFPLA-009, PROFITRANSERREFPLA-015

## Problem Statement

`PrototypeFitRankingService` contains axis normalization and context filtering logic that is used by multiple other internal methods. This logic should be extracted into a dedicated `ContextAxisNormalizer` service to enable reuse and independent testing.

## Objective

Extract context axis normalization methods from `PrototypeFitRankingService` into a new `ContextAxisNormalizer` that:
1. Normalizes various context shapes to standard structure
2. Filters contexts by gate constraints
3. Extracts constraints from prerequisites
4. Provides consistent axis values across the system

## Assumptions Check (Updated)

- `reports/prototype-regime-gate-alignment.md` does not exist; related reference lives at `brainstorming/prototype-regime-gate-alignment.md`.
- Ticket PROFITRANSERREFPLA-005 is not present in `tickets/`. The current unit tests live at `tests/unit/expressionDiagnostics/services/contextAxisNormalizer.test.js` and are not skipped.
- No integration test exists for context axis normalization (despite the overview plan listing one).
- `PrototypeFitRankingService` already normalizes via `axisNormalizationUtils` and uses `PrototypeConstraintAnalyzer.extractAxisConstraints` when available; constraints are represented as `Map<string, {min, max}>`.

## Scope

### In Scope
- Create `ContextAxisNormalizer.js`
- Add DI token `IContextAxisNormalizer`
- Register service in DI container
- Update `PrototypeFitRankingService` to use new service (delegate existing normalization/filtering)
- Ensure existing unit tests for context axis normalization pass

### Out of Scope
- Other service extractions
- Consolidating normalization across other files (future work)
- Modifying public API of `PrototypeFitRankingService`
- Adding new normalization capabilities

## Acceptance Criteria

- [x] New file created: `src/expressionDiagnostics/services/ContextAxisNormalizer.js`
- [x] DI token added: `IContextAxisNormalizer` in `tokens-diagnostics.js`
- [x] Service registered in `expressionDiagnosticsRegistrations.js`
- [x] `PrototypeFitRankingService` constructor accepts `IContextAxisNormalizer`
- [x] All normalization/filtering delegated to new service
- [x] Existing unit tests for context axis normalization pass
- [x] All existing tests pass unchanged (targeted unit suite)
- [ ] `npm run test:ci` passes
- [ ] `npm run typecheck` passes
- [ ] `npx eslint src/expressionDiagnostics/services/ContextAxisNormalizer.js` passes

## Tasks

### 1. Create ContextAxisNormalizer

```javascript
// src/expressionDiagnostics/services/ContextAxisNormalizer.js

/**
 * @file Normalizes context objects and filters by axis constraints
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
  resolveAxisValue,
} from '../utils/axisNormalizationUtils.js';

/**
 * @typedef {Object} NormalizedContext
 * @property {Object} moodAxes
 * @property {Object} [sexualAxes]
 * @property {Object} [affectTraits]
 */

/**
 * @typedef {Object} AxisConstraints
 * @property {Object.<string, {min?: number, max?: number}>} [constraints]
 */

class ContextAxisNormalizer {
  #logger;
  #prototypeConstraintAnalyzer;

  /**
   * @param {object} deps
   * @param {object} deps.logger - ILogger instance
   */
  constructor({ logger, prototypeConstraintAnalyzer = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    if (this.#prototypeConstraintAnalyzer) {
      validateDependency(
        this.#prototypeConstraintAnalyzer,
        'IPrototypeConstraintAnalyzer',
        logger,
        {
          requiredMethods: ['extractAxisConstraints'],
        }
      );
    }
  }

  /**
   * Normalize context to standard axis structure
   * @param {object} ctx - Raw context object
   * @returns {NormalizedContext}
   */
  /**
   * Filter contexts to those matching mood regime constraints
   * @param {object[]} contexts
   * @param {AxisConstraints} constraints
   * @returns {object[]}
   */
  filterToMoodRegime(contexts, constraints) {
    // Extract from PrototypeFitRankingService.js
  }

  /**
   * Normalize constraints from prerequisites or direct object
   * @param {object[]|object} constraintsOrPrerequisites
   * @returns {AxisConstraints}
   */
  normalizeConstraints(constraintsOrPrerequisites) {
    // Extract from PrototypeFitRankingService.js
  }

  /**
   * Get all normalized axis values from context
   * @param {object} ctx
   * @returns {object}
   */
  getNormalizedAxes(ctx) {
    // Extract from PrototypeFitRankingService.js
  }
}

export default ContextAxisNormalizer;
```

### 2. Add DI Token

```javascript
// In src/dependencyInjection/tokens/tokens-diagnostics.js
// Add to diagnosticsTokens object:

IContextAxisNormalizer: 'IContextAxisNormalizer',
```

### 3. Register Service

```javascript
// In src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

import ContextAxisNormalizer from '../../expressionDiagnostics/services/ContextAxisNormalizer.js';

// Add registration:
registrar.singletonFactory(
  diagnosticsTokens.IContextAxisNormalizer,
  (c) =>
    new ContextAxisNormalizer({
      logger: c.resolve(tokens.ILogger),
    })
);
```

### 4. Update PrototypeFitRankingService

```javascript
// Update constructor to accept new dependency
constructor({
  dataRegistry,
  logger,
  prototypeConstraintAnalyzer,
  prototypeRegistryService,
  prototypeTypeDetector,
  contextAxisNormalizer  // NEW
}) {
  // ... existing validation ...
  this.#contextAxisNormalizer = contextAxisNormalizer;
}

// Replace direct calls:
// Before: this.#normalizeAxisConstraints(constraints)
// After:  this.#contextAxisNormalizer.normalizeConstraints(constraints)

// Before: this.#filterToMoodRegime(contexts, constraints)
// After:  this.#contextAxisNormalizer.filterToMoodRegime(contexts, constraints)

// Before: this.#getNormalizedAxes(ctx)
// After:  this.#contextAxisNormalizer.getNormalizedAxes(ctx)
```

### 5. Update DI Registration for PrototypeFitRankingService

```javascript
// Add contextAxisNormalizer dependency
contextAxisNormalizer: c.resolve(diagnosticsTokens.IContextAxisNormalizer),
```

### 6. Enable Tests

- Existing unit tests already cover normalization paths; keep them green
- Add new unit tests only if extraction introduces gaps

## Methods to Extract

| Method | Destination |
|--------|-------------|
| `#normalizeAxisConstraints` | `normalizeConstraints` |
| `#filterToMoodRegime` | `filterToMoodRegime` |
| `#getNormalizedAxes` | `getNormalizedAxes` |

## Implementation Notes

### Context Shapes to Handle

```javascript
// Input shapes (all should produce same normalized output)
{ mood: { valence: 50 } }
{ moodAxes: { valence: 50 } }
{ sexual: { sex_excitation: 80, sex_inhibition: 20, baseline_libido: 10 } }
{ affectTraits: { harm_aversion: 60 } }
```

### Normalization Rules

1. Use `normalizeMoodAxes` for `ctx.moodAxes` or `ctx.mood`
2. Use `normalizeSexualAxes` for `ctx.sexualAxes` or `ctx.sexual`, plus `ctx.sexualArousal` override
3. Use `normalizeAffectTraits` for `ctx.affectTraits` (fallback to `DEFAULT_AFFECT_TRAITS`)
4. Always resolve axis values via `resolveAxisValue`
5. Never mutate input context

### Constraint Extraction from Prerequisites

Delegate to `PrototypeConstraintAnalyzer.extractAxisConstraints` when available; otherwise return an empty `Map`.

## Verification

```bash
# Run unit tests for context axis normalization
npm run test:unit -- --testPathPatterns="contextAxisNormalizer" --coverage=false

# Lint new file
npx eslint src/expressionDiagnostics/services/ContextAxisNormalizer.js
```

## Success Metrics

- New service file < 200 lines
- Unit tests pass
- All existing `PrototypeFitRankingService` tests pass
- No changes to public API
- Clean ESLint output

## Notes

- Immutability is critical - never mutate input
- This service is foundational - used by multiple other extractions
- Keep normalization logic identical to current implementation
- Consider future consolidation with `ContextBuilder` normalization

## Related Files

**Source:**
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js`

**To Create:**
- `src/expressionDiagnostics/services/ContextAxisNormalizer.js`

**To Modify:**
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

**Tests:**
- `tests/unit/expressionDiagnostics/services/contextAxisNormalizer.test.js`

**Related (for reference):**
- `src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js`

## Outcome

- Created `ContextAxisNormalizer` by extracting `normalizeConstraints`, `filterToMoodRegime`, and `getNormalizedAxes` logic.
- Updated DI tokens/registrations and wired `PrototypeFitRankingService` to delegate normalization/filtering.
- Kept existing unit tests; verified targeted unit suite only (no integration test exists for this feature).

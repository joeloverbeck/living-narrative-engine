# PROFITBLOSCODIS-012: MonteCarloReportGenerator Integration

## Summary

Integrate all new services (NonAxisClauseExtractor, NonAxisFeasibilityAnalyzer, FitFeasibilityConflictDetector) and section generators (ConflictWarningSectionGenerator, NonAxisFeasibilitySectionGenerator) into the MonteCarloReportGenerator.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js`

## Out of Scope

- ❌ DI token/registration (PROFITBLOSCODIS-013)
- ❌ Changes to simulation logic
- ❌ Changes to existing section generators (besides calling them)
- ❌ Implementation of the new services (already done in 003-005, 008-009)

## Implementation Details

### Constructor Changes

Add 5 new optional dependencies:

```javascript
constructor({
  // ... existing dependencies ...
  nonAxisClauseExtractor = null,
  nonAxisFeasibilityAnalyzer = null,
  fitFeasibilityConflictDetector = null,
  nonAxisFeasibilitySectionGenerator = null,
  conflictWarningSectionGenerator = null,
}) {
  // ... existing initialization ...

  // New services with lazy initialization fallback
  this.#nonAxisClauseExtractor = nonAxisClauseExtractor;
  this.#nonAxisFeasibilityAnalyzer = nonAxisFeasibilityAnalyzer;
  this.#fitFeasibilityConflictDetector = fitFeasibilityConflictDetector;
  this.#nonAxisFeasibilitySectionGenerator = nonAxisFeasibilitySectionGenerator;
  this.#conflictWarningSectionGenerator = conflictWarningSectionGenerator;
}
```

### Lazy Initialization Pattern

For backward compatibility, create services on-demand if not injected:

```javascript
#getOrCreateNonAxisClauseExtractor() {
  if (!this.#nonAxisClauseExtractor) {
    this.#nonAxisClauseExtractor = new NonAxisClauseExtractor({
      logger: this.#logger,
    });
  }
  return this.#nonAxisClauseExtractor;
}

// Similar for other new services...
```

### New Helper Method

Add method to filter in-regime contexts:

```javascript
#filterInRegimeContexts(storedContexts, moodConstraints) {
  if (!storedContexts || !moodConstraints || moodConstraints.length === 0) {
    return storedContexts ?? [];
  }
  return filterContextsByConstraints(storedContexts, moodConstraints);
}
```

### Integration in generate() Method

After existing analysis, add:

```javascript
// NEW: Analyze non-axis clause feasibility
const inRegimeContexts = this.#filterInRegimeContexts(
  simulationResult.storedContexts ?? [],
  moodConstraints
);

const nonAxisFeasibility = this.#getOrCreateNonAxisFeasibilityAnalyzer().analyze(
  prerequisites ?? [],
  inRegimeContexts,
  expressionName
);

// NEW: Detect conflicts
const conflicts = this.#getOrCreateFitFeasibilityConflictDetector().detect(
  prototypeFitResult,
  nonAxisFeasibility,
  gateAlignmentResult
);

// ... later in section assembly ...

// NEW: Generate conflict warnings section (after prototype section)
const conflictSection = this.#getOrCreateConflictWarningSectionGenerator()
  .generate(conflicts);

// NEW: Generate non-axis feasibility section
const nonAxisSection = this.#getOrCreateNonAxisFeasibilitySectionGenerator()
  .generate(nonAxisFeasibility, populationSummary?.inRegimeSampleCount ?? 0);
```

### Section Order

Insert new sections in this order:
1. ... existing sections ...
2. Prototype fit section
3. **Conflict warnings section** (NEW - immediately after prototype fit)
4. **Non-axis feasibility section** (NEW)
5. ... remaining existing sections ...

### Import Additions

```javascript
import NonAxisClauseExtractor from './NonAxisClauseExtractor.js';
import NonAxisFeasibilityAnalyzer from './NonAxisFeasibilityAnalyzer.js';
import FitFeasibilityConflictDetector from './FitFeasibilityConflictDetector.js';
import NonAxisFeasibilitySectionGenerator from './sectionGenerators/NonAxisFeasibilitySectionGenerator.js';
import ConflictWarningSectionGenerator from './sectionGenerators/ConflictWarningSectionGenerator.js';
import { filterContextsByConstraints } from '../utils/moodRegimeUtils.js';
```

## Acceptance Criteria

### Tests That Must Pass

1. **Backward compatibility tests**:
   - Existing callers without new deps still work
   - Report generation succeeds with null new dependencies
   - Lazy initialization creates services when needed

2. **New dependency injection tests**:
   - Can inject all 5 new services
   - Injected services are used instead of lazy-created ones

3. **Feasibility analysis integration tests**:
   - NonAxisFeasibilityAnalyzer called during generation
   - Receives correct prerequisites and in-regime contexts
   - Results passed to section generator

4. **Conflict detection integration tests**:
   - FitFeasibilityConflictDetector called after fit analysis
   - Receives prototype fit result and feasibility results
   - Results passed to section generator

5. **Section order tests**:
   - Conflict warnings appear after prototype fit section
   - Non-axis feasibility appears after conflict warnings
   - Existing section order preserved for other sections

6. **Helper method tests**:
   - `#filterInRegimeContexts` correctly filters contexts
   - Handles empty/null inputs gracefully

7. **Report content tests**:
   - Generated report contains non-axis feasibility section when applicable
   - Generated report contains conflict section when conflicts exist
   - Sections omitted when no relevant data

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/services/MonteCarloReportGenerator.js
npm run test:unit -- --testPathPattern="monteCarloReportGenerator"
```

## Invariants That Must Remain True

1. Backward compatibility: existing callers without new deps still work
2. Conflict section appears immediately after prototype fit section
3. Non-axis feasibility section appears after conflict section
4. Existing section generation logic unchanged
5. Simulation logic unchanged
6. All existing tests pass without modification

## Dependencies

- PROFITBLOSCODIS-003 (NonAxisClauseExtractor)
- PROFITBLOSCODIS-004 (NonAxisFeasibilityAnalyzer)
- PROFITBLOSCODIS-005 (FitFeasibilityConflictDetector)
- PROFITBLOSCODIS-008 (ConflictWarningSectionGenerator)
- PROFITBLOSCODIS-009 (NonAxisFeasibilitySectionGenerator)

## Blocked By

- PROFITBLOSCODIS-003, 004, 005, 008, 009

## Blocks

- PROFITBLOSCODIS-013 (DI registration)
- PROFITBLOSCODIS-014 (Integration tests)

# PROREGGATALI-001: Core PrototypeGateAlignmentAnalyzer Service

## Summary

Create the `PrototypeGateAlignmentAnalyzer` service that detects structural contradictions between expression mood regimes (AND-only constraints) and emotion prototype gates.

## Background

When an expression prerequisite references an emotion threshold (e.g., `emotions.quiet_absorption >= 0.55`), the emotion's intensity depends on its prototype passing all gates. If the expression also constrains mood axes via AND-only regime, those constraints may make certain prototype gates impossible to satisfy — resulting in the emotion being clamped to 0.

**Example Contradiction**:
- Regime: `mood.agency_control >= 0.15` → interval `[0.15, 1]`
- Gate: `agency_control <= 0.10` → interval `[-1, 0.10]`
- **Result**: Empty intersection → emotion intensity always 0

This is a **hard impossibility** distinct from soft axis-sign conflicts.

## File List (Expected to Touch)

### New Files
- `src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js`

### Existing Files (Read-Only Reference)
- `src/expressionDiagnostics/utils/moodRegimeUtils.js` — use `extractMoodConstraints()`
- `src/expressionDiagnostics/models/AxisInterval.js` — use `forMoodAxis()`, `applyConstraint()`, `intersect()`, `isEmpty()`
- `src/expressionDiagnostics/models/GateConstraint.js` — use `parse()`, `applyTo()`
- `src/utils/dependencyUtils.js` — use `validateDependency()`

## Out of Scope (MUST NOT Change)

- DI registration (handled in PROREGGATALI-002)
- Report generator integration (handled in PROREGGATALI-003)
- Any existing services, models, or utilities
- Any mod data under `data/mods/`
- Any UI rendering code
- Tests (handled in PROREGGATALI-004)

## Implementation Details

### Algorithm

1. **Extract regime bounds** from AND-only prerequisites using `extractMoodConstraints({ andOnly: true, includeMoodAlias: true })`
2. **Build per-axis intervals** as `Map<axisName, AxisInterval>`
3. **For each emotion condition** (from `emotionConditions` parameter):
   - Load prototype from `dataRegistry.getLookupData('core:emotion_prototypes')`
   - For each gate string in the prototype:
     - Parse gate using `GateConstraint.parse(gate)`
     - Get regime interval for gate's axis (or default if unconstrained)
     - Apply gate constraint to get gate interval
     - Compute intersection
     - If intersection is `null` or empty → **contradiction**
4. **Calculate distance** to feasibility for contradictions
5. **Assign severity**: `critical` if emotion is threshold-required (`threshold > 0`), `info` otherwise

### Public API

```javascript
/**
 * @param {Object} params
 * @param {Array} params.prerequisites - Expression prerequisite block
 * @param {Array<{prototypeId: string, threshold: number, type: string}>} params.emotionConditions
 * @returns {PrototypeGateAlignmentResult}
 */
analyze({ prerequisites, emotionConditions })
```

### Output Structure

```typescript
interface PrototypeGateAlignmentResult {
  contradictions: GateContradiction[];
  tightPassages: TightPassage[];  // Future: warn-level near-contradictions
  hasIssues: boolean;
}

interface GateContradiction {
  emotion: string;
  gate: string;
  axis: string;
  regime: { min: number; max: number };
  gateInterval: { min: number; max: number };
  distance: number;
  severity: 'critical' | 'info';
}
```

### Class Structure

```javascript
class PrototypeGateAlignmentAnalyzer {
  #dataRegistry;
  #logger;

  constructor({ dataRegistry, logger }) { ... }

  analyze({ prerequisites, emotionConditions }) { ... }

  #extractRegimeBounds(prerequisites) { ... }
  #analyzePrototypeGates(emotion, threshold, regimeBounds) { ... }
  #getDefaultInterval(axis) { ... }
  #calculateDistance(regimeInterval, gateInterval) { ... }
}
```

### Distance Calculation

```javascript
function calculateDistance(regimeInterval, gateInterval) {
  if (regimeInterval.min > gateInterval.max) {
    return regimeInterval.min - gateInterval.max;
  }
  if (gateInterval.min > regimeInterval.max) {
    return gateInterval.min - regimeInterval.max;
  }
  return 0;
}
```

## Acceptance Criteria

### Tests That Must Pass

1. Manual verification: File creates successfully and exports class
2. ESLint: `npx eslint src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js`
3. TypeCheck: `npm run typecheck` completes without errors for new file

### Invariants That Must Remain True

1. Returns empty `contradictions` array when `prerequisites` is empty or `[]`
2. Returns empty `contradictions` array when `emotionConditions` is empty or `[]`
3. Returns empty `contradictions` when regime and gate intervals overlap
4. Detects contradiction when `regime.min > gate.max` or `gate.min > regime.max`
5. Distance is always non-negative
6. Severity is `critical` when emotion has positive threshold, `info` otherwise
7. Uses same axis normalization as emotion derivation ([-1,1] for mood, [0,1] for sexual/affect)
8. Does not modify input parameters
9. Tolerates missing/null prototype gracefully (logs warning, skips)

## Dependencies

- `extractMoodConstraints` from `moodRegimeUtils.js`
- `AxisInterval` class with `forMoodAxis()`, `forSexualAxis()`, `applyConstraint()`, `intersect()`, `isEmpty()`
- `GateConstraint` class with `parse()`, `applyTo()`, `getAxisType()`
- `validateDependency` from `dependencyUtils.js`

## Estimated Size

~150-200 lines of code (small, focused service).

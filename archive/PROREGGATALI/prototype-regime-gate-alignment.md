# Prototype-Regime Gate Alignment Diagnostic

## Goal

Add a diagnostic to the Monte Carlo simulator report (`expression-diagnostics.html`) that detects structurally unreachable emotions caused by conflicts between an expression's AND-only mood regime and emotion prototype gates.

## Problem Statement

When an expression prerequisite references an emotion threshold (e.g., `emotions.quiet_absorption >= 0.55`), the emotion's intensity depends on its prototype passing all gates. If the expression also constrains mood axes (AND-only regime), those constraints may make certain prototype gates impossible to satisfy.

**Example Contradiction**:
- Expression regime: `mood.agency_control >= 0.15`
- Emotion `quiet_absorption` prerequisite: `emotions.quiet_absorption >= 0.55`
- Prototype gate for `quiet_absorption`: `agency_control <= 0.10`
- **Result**: Gate requires `agency_control <= 0.10` but regime requires `>= 0.15`. Intersection is empty → emotion intensity is always 0.

This is distinct from "axis sign conflict" (soft feasibility loss). Gate contradiction is a **hard impossibility** where the emotion is clamped to 0.

## Current Architecture (Reference)

### Key Files
- `src/expressionDiagnostics/services/MonteCarloSimulator.js` - Core simulation
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` - Report generation
- `src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js` - Emotion threshold analysis
- `src/expressionDiagnostics/utils/moodRegimeUtils.js` - Regime bound extraction
- `src/expressionDiagnostics/models/AxisInterval.js` - Interval arithmetic
- `src/expressionDiagnostics/models/GateConstraint.js` - Gate parsing
- `data/mods/core/lookups/emotion_prototypes.lookup.json` - Prototype definitions

### Existing Utilities to Reuse

**`moodRegimeUtils.extractMoodConstraints(prerequisites, options)`**:
- Extracts mood constraints from AND-only prerequisite blocks
- Returns: `Array<{varPath, operator, threshold}>`
- Use with `{ andOnly: true, includeMoodAlias: true }`

**`AxisInterval`**:
- `intersect(other)` → Returns intersection or `null` if empty
- `applyConstraint(operator, value)` → Tightens bounds
- Factory methods: `forMoodAxis()` ([-1,1]), `forSexualAxis()` ([0,1])
- `isEmpty()` → `true` if min > max

**`GateConstraint`**:
- `parse(gateString)` → Parses `"axis operator value"`
- `applyTo(interval)` → Applies constraint to interval
- `getAxisType()` → Returns `'mood'|'affect_trait'|'sexual'|'intensity'`
- `getValidRange()` → Returns `{min, max}` for axis type

## Proposed Solution

### New Service: `PrototypeGateAlignmentAnalyzer`

**Location**: `src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js`

**Responsibility**: Detect gate alignment contradictions between expression regime and prototype gates.

### Algorithm

#### Step 1: Build Regime Intervals per Axis
From the AND-only mood constraints, build per-axis intervals:

```javascript
regimeBounds = Map<axisName, AxisInterval>
// Example:
// threat → [-1, 0.20]        // from "threat <= 0.20"
// agency_control → [0.15, 1] // from "agency_control >= 0.15"
// arousal → [-0.30, 0.35]    // from "arousal >= -0.30 AND arousal <= 0.35"
```

If an axis isn't constrained by the regime, leave it unbounded (use default axis interval).

#### Step 2: Parse Each Prototype Gate into Interval Constraint
For each gate string `"axis op value"`, produce a gate interval:

| Gate Format | Interval |
|-------------|----------|
| `axis <= v` | `(-∞, v]` (or `[min, v]` using axis default min) |
| `axis < v`  | `(-∞, v)` |
| `axis >= v` | `[v, +∞)` (or `[v, max]` using axis default max) |
| `axis > v`  | `(v, +∞)` |

Use `AxisInterval` factory methods and `applyConstraint()`.

#### Step 3: Intersect Regime Interval with Gate Interval
For each emotion prototype gate:
1. Get regime interval for the gate's axis (or default if unconstrained)
2. Apply gate constraint to get gate interval
3. Compute intersection

```javascript
const regimeInterval = regimeBounds.get(axis) || AxisInterval.forMoodAxis();
const gateInterval = GateConstraint.parse(gate).applyTo(AxisInterval.forMoodAxis());
const intersection = regimeInterval.intersect(gateInterval);

if (intersection === null) {
  // CONTRADICTION: gate can never pass in-regime
}
```

#### Step 4: Compute Distance to Feasibility
When contradictory, compute the smallest adjustment required to make it feasible:

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

**Example**:
- Regime: `agency_control >= 0.15` → interval `[0.15, 1]`
- Gate: `agency_control <= 0.10` → interval `[-1, 0.10]`
- Distance: `0.15 - 0.10 = 0.05`

### Severity Scoring

Two levels only:

| Severity | Condition |
|----------|-----------|
| `critical` | Contradiction on emotion that expression threshold-requires (`emotions.X >= t` where `t > 0`) |
| `info` | Contradiction on emotion not threshold-required (rare) |

**Optional `warn` level**: Intersection exists but is razor-thin (`overlapWidth / regimeWidth < 0.10` if `regimeWidth` is finite).

### Output Data Structure

```javascript
/**
 * @typedef {Object} PrototypeGateAlignmentResult
 * @property {GateContradiction[]} contradictions - Detected contradictions
 * @property {TightPassage[]} tightPassages - Near-contradictions (optional warn level)
 * @property {boolean} hasIssues - Whether any critical issues exist
 */

/**
 * @typedef {Object} GateContradiction
 * @property {string} emotion - Emotion prototype ID
 * @property {string} gate - Original gate string (e.g., "agency_control <= 0.10")
 * @property {string} axis - Affected axis name
 * @property {{min: number, max: number}} regime - Regime interval bounds
 * @property {{min: number, max: number}} gateInterval - Gate interval bounds
 * @property {number} distance - Gap size for feasibility
 * @property {'critical'|'info'} severity
 */
```

**Example Output**:
```json
{
  "prototypeGateAlignment": {
    "contradictions": [
      {
        "emotion": "quiet_absorption",
        "gate": "agency_control <= 0.10",
        "axis": "agency_control",
        "regime": { "min": 0.15, "max": 1 },
        "gateInterval": { "min": -1, "max": 0.10 },
        "distance": 0.05,
        "severity": "critical"
      }
    ],
    "tightPassages": []
  }
}
```

## Implementation Plan

### Phase 1: Create Analyzer Service

**File**: `src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js`

```javascript
import { validateDependency } from '../../utils/dependencyUtils.js';
import { extractMoodConstraints } from '../utils/moodRegimeUtils.js';
import AxisInterval from '../models/AxisInterval.js';
import GateConstraint from '../models/GateConstraint.js';

class PrototypeGateAlignmentAnalyzer {
  #dataRegistry;
  #logger;

  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getLookupData'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Analyze alignment between expression regime and prototype gates
   * @param {object} params
   * @param {Array} params.prerequisites - Expression prerequisites
   * @param {Array<{prototypeId: string, threshold: number, type: string}>} params.emotionConditions
   * @returns {PrototypeGateAlignmentResult}
   */
  analyze({ prerequisites, emotionConditions }) {
    // Implementation per algorithm above
  }

  #extractRegimeBounds(prerequisites) { /* ... */ }
  #analyzePrototypeGates(emotion, regimeBounds) { /* ... */ }
  #getDefaultInterval(axis) { /* ... */ }
  #calculateDistance(regimeInterval, gateInterval) { /* ... */ }
}

export default PrototypeGateAlignmentAnalyzer;
```

### Phase 2: DI Registration

**File**: `src/dependencyInjection/tokens/tokens-diagnostics.js`
```javascript
IPrototypeGateAlignmentAnalyzer: 'IPrototypeGateAlignmentAnalyzer',
```

**File**: `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
```javascript
import PrototypeGateAlignmentAnalyzer from '../../expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js';

registrar.singletonFactory(
  diagnosticsTokens.IPrototypeGateAlignmentAnalyzer,
  (c) =>
    new PrototypeGateAlignmentAnalyzer({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
    })
);
```

### Phase 3: Report Generator Integration

**File**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

1. Add dependency: `#prototypeGateAlignmentAnalyzer`
2. Update constructor to receive and validate the new dependency
3. In `generate()` method, after extracting emotion conditions:

```javascript
// Extract emotion conditions from blockers (reuse existing logic)
const emotionConditions = this.#extractEmotionConditions(blockers);

// Run alignment analysis
const alignmentResult = this.#prototypeGateAlignmentAnalyzer.analyze({
  prerequisites,
  emotionConditions,
});

// Add section to report
sections.push(this.#generatePrototypeGateAlignmentSection(alignmentResult));
```

4. Add new section generator method:

```javascript
#generatePrototypeGateAlignmentSection(result) {
  if (!result || result.contradictions.length === 0) {
    return '';
  }

  const lines = [
    '## Prototype Gate Alignment',
    '',
    '| Emotion | Prototype Gate | Regime (axis) | Status | Distance |',
    '|---------|----------------|---------------|--------|----------|',
  ];

  for (const c of result.contradictions) {
    const regimeStr = `${c.axis} ∈ [${c.regime.min.toFixed(2)}, ${c.regime.max.toFixed(2)}]`;
    lines.push(
      `| ${c.emotion} | \`${c.gate}\` | ${regimeStr} | **CONTRADICTION** | ${c.distance.toFixed(3)} |`
    );
  }

  lines.push('');

  // Add recommendations per contradiction
  for (const c of result.contradictions) {
    if (c.severity === 'critical') {
      lines.push(
        `> **Unreachable emotion under regime**: \`emotions.${c.emotion}\` is always 0 in-regime ` +
        `because prototype gate \`${c.gate}\` contradicts regime \`${c.axis} >= ${c.regime.min.toFixed(2)}\`.`
      );
      lines.push(
        `> **Fix**: Relax regime on \`${c.axis}\`, loosen the prototype gate, ` +
        `or replace/create a prototype (e.g., focused_${c.emotion.split('_').pop()}).`
      );
      lines.push('');
    }
  }

  return lines.join('\n');
}
```

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js` | **CREATE** | New analyzer service (~150-200 lines) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | MODIFY | Add `IPrototypeGateAlignmentAnalyzer` token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | MODIFY | Register analyzer factory |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | MODIFY | Add dependency, call analyzer, generate section |
| `tests/unit/expressionDiagnostics/services/prototypeGateAlignmentAnalyzer.test.js` | **CREATE** | Unit tests |
| `tests/integration/expressionDiagnostics/prototypeGateAlignmentReport.integration.test.js` | **CREATE** | Integration tests |

## Invariants

1. **Contradiction emission requirements**:
   - Regime is AND-only extractable
   - Axis is present in the gate
   - Regime bounds for that axis are known (finite on the relevant side)

2. **Normalization consistency**: Use the same axis normalization the emotion derivation uses. Gate values in prototypes use normalized ranges ([-1,1] for mood, [0,1] for sexual/affect).

3. **Critical contradiction surfacing**: If `contradictions` contains any entry with `severity=critical`, the report MUST surface: "Emotion unreachable under regime (clamped to 0)" for that emotion.

## Testing Strategy

### Unit Tests

**File**: `tests/unit/expressionDiagnostics/services/prototypeGateAlignmentAnalyzer.test.js`

| Test Case | Input | Expected |
|-----------|-------|----------|
| Detect contradiction | Regime: `agency_control >= 0.15`, Gate: `agency_control <= 0.10` | 1 contradiction, distance 0.05, severity critical |
| No contradiction when overlapping | Regime: `threat <= 0.20`, Gate: `threat <= 0.35` | No contradiction |
| Strict inequality edge | Regime: `arousal >= 0.10`, Gate: `arousal < 0.10` | Contradiction (empty intersection) |
| Unbounded regime axis | Regime: no constraint on valence, Gate: `valence >= 0.15` | No contradiction (insufficient regime info) |
| Multiple gates per prototype | Gates: `[threat <= 0.20, valence >= 0.30]` | Check each gate independently |
| Empty prerequisites | `[]` | Empty result |
| No emotion conditions | Valid prerequisites but no emotion thresholds | Empty result |

### Integration Tests

**File**: `tests/integration/expressionDiagnostics/prototypeGateAlignmentReport.integration.test.js`

1. Full pipeline with known conflicting expression
2. Verify report section appears when contradictions exist
3. Verify section omitted when no contradictions
4. Verify severity assignment (critical vs info)

## UI Presentation

The section appears in the Monte Carlo report near "Top Blockers" / "Recommendations":

```
## Prototype Gate Alignment

| Emotion | Prototype Gate | Regime (axis) | Status | Distance |
|---------|----------------|---------------|--------|----------|
| quiet_absorption | `agency_control <= 0.10` | agency_control ∈ [0.15, 1.00] | **CONTRADICTION** | 0.050 |
| quiet_absorption | `threat <= 0.35` | threat ∈ [-1.00, 0.20] | OK | — |

> **Unreachable emotion under regime**: `emotions.quiet_absorption` is always 0 in-regime because prototype gate `agency_control <= 0.10` contradicts regime `agency_control >= 0.15`.
> **Fix**: Relax regime on `agency_control`, loosen the prototype gate, or replace/create a prototype (e.g., focused_absorption).
```

No graphs required. Simple table + one-liner recommendation per contradiction.

## Success Criteria

1. **Functional**: Correctly detects gate/regime contradictions for all axis types
2. **Accurate**: Uses same normalization as emotion derivation (no false positives)
3. **Minimal footprint**: Single new service, reuses existing utilities
4. **Clear diagnostics**: Distance value and fix suggestions are actionable
5. **Test coverage**: 80%+ branch coverage on new analyzer

## Open Questions

None - the brainstorming document provides clear specifications.

## Deferred Features

- **Tight passage detection**: `warn` severity for near-contradictions (razor-thin intersection)
- **Auto-fix suggestions**: Generate prototype variant with relaxed gate
- **UI highlighting**: Color-code contradictions in expression list panel

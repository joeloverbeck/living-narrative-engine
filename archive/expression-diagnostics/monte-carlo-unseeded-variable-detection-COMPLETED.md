# Spec: Monte Carlo Simulator Unseeded Variable Detection

## Context

The Monte Carlo Simulator (`src/expressionDiagnostics/services/MonteCarloSimulator.js`) evaluates expression prerequisites using JSON Logic against a sampled context. The context is built by `#buildContext()` and provides specific variables for evaluation.

**Recent Issue (RESOLVED):** The simulator was missing `sexualArousal` in its context, causing expressions using `{ "var": "sexualArousal" }` to show 100% failure rates. This was fixed by adding the derived value calculation.

**Remaining Gap:** The same category of issue could occur for any future variable that expressions might reference but the simulator doesn't seed. There is no proactive detection mechanism.

## Problem

When an expression prerequisite references a variable path that isn't seeded in the simulation context (e.g., `{ "var": "hasMaleGenitals" }`), JSON Logic returns `undefined`, causing all comparisons to fail silently. This produces misleading 100% failure rates with no warning or explanation.

**Current behavior:** Silent failure → misleading results → manual debugging required
**Desired behavior:** Early detection → clear warnings → actionable feedback

## Truth Sources

### Seeded Context Keys (from `#buildContext()`)

**Static top-level keys:**
- `mood` - Raw mood axes object (alias: `moodAxes`)
- `sexualArousal` - Scalar derived value `[0, 1]`
- `previousMoodAxes` - Zeroed mood axes

**Dynamic keys from prototype registries:**
- `emotions` - Keys from `core:emotion_prototypes` lookup
- `sexualStates` - Keys from `core:sexual_prototypes` lookup
- `previousEmotions` - Same keys as emotions (zeroed)
- `previousSexualStates` - Same keys as sexualStates (zeroed)

**Nested mood axes (hardcoded):**
- `valence`, `arousal`, `agency_control`, `threat`, `engagement`, `future_expectancy`, `self_evaluation`

### Variable Extraction Pattern

From `src/validation/expressionPrerequisiteValidator.js`:
- `#collectVarPaths(node, paths=[])` - Recursively extracts all `{ "var": "..." }` paths
- `#extractVarPath(node)` - Handles both `{ "var": "path" }` and `{ "var": ["path", default] }` formats

## Desired Behavior

### Normal Cases

1. **Valid paths pass silently:** `emotions.joy`, `moodAxes.valence`, `sexualArousal` → no warnings
2. **Simulation proceeds:** Valid expressions run without interruption
3. **Results include validation info:** New `unseededVarWarnings` array in result object

### Edge Cases

1. **Unknown root:** `{ "var": "hasMaleGenitals" }` → warning with reason `unknown_root`
2. **Unknown nested key:** `{ "var": "emotions.nonexistent" }` → warning with reason `unknown_nested_key`
3. **Invalid nesting on scalar:** `{ "var": "sexualArousal.something" }` → warning with reason `invalid_nesting`
4. **Multiple issues:** All warnings collected and returned (not just first)
5. **Empty prototypes registry:** Dynamic keys return empty set → nested paths warn as unknown

### Failure Modes

1. **Fail-fast mode:** `config.failOnUnseededVars = true` → throws error before simulation
2. **Warn mode (default):** `config.failOnUnseededVars = false` → logs warning, proceeds, includes warnings in result
3. **Skip validation:** `config.validateVarPaths = false` → no validation performed

### Invariants

- Validation runs BEFORE any sampling begins
- All var paths from ALL prerequisites are checked (not short-circuit)
- Dynamic keys are resolved fresh from registry each call (not cached stale)
- Warnings array is always present in result (empty if no issues)

### API Contracts

**New config options for `simulate()`:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `validateVarPaths` | `boolean` | `true` | Enable pre-simulation var path validation |
| `failOnUnseededVars` | `boolean` | `false` | Throw error if unseeded vars found |

**New result field:**

```typescript
unseededVarWarnings: Array<{
  path: string;           // e.g., "hasMaleGenitals"
  reason: 'unknown_root' | 'unknown_nested_key' | 'invalid_nesting';
  suggestion: string;     // Human-readable explanation
}>
```

### What Can Change

- New prototype keys added to registries → automatically recognized
- New top-level context keys → requires code update to `#buildKnownContextKeys()`
- Warning message text → can be refined without breaking API
- Validation strictness → configurable via options

## Implementation Plan

### Files to Create

1. **`src/utils/jsonLogicVarExtractor.js`** (NEW)
   - Extract `collectVarPaths()` and `extractVarPath()` as shared utilities
   - Reusable by both MonteCarloSimulator and ExpressionPrerequisiteValidator

2. **`tests/unit/utils/jsonLogicVarExtractor.test.js`** (NEW)
   - Unit tests for var extraction utilities

### Files to Modify

1. **`src/expressionDiagnostics/services/MonteCarloSimulator.js`**
   - Add import for `collectVarPaths` from new utility
   - Add `#buildKnownContextKeys()` method
   - Add `#validateExpressionVarPaths(expression)` method
   - Add `#validateVarPath(path, knownKeys)` method
   - Modify `simulate()` to call validation and include new config/result fields

2. **`tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js`**
   - Add test suite for unseeded variable detection

### Method Signatures

```javascript
// New utility (jsonLogicVarExtractor.js)
export function collectVarPaths(node, paths = []) → string[]
export function extractVarPath(node) → string | null

// New MonteCarloSimulator methods
#buildKnownContextKeys() → { topLevel: Set, nestedKeys: Record<string, Set> }
#validateExpressionVarPaths(expression) → { warnings: Warning[] }
#validateVarPath(path, knownKeys) → { isValid: boolean, reason?: string, suggestion?: string }
```

## Testing Plan

### Unit Tests for `jsonLogicVarExtractor.js`

```javascript
describe('collectVarPaths', () => {
  it('extracts simple var path from comparison');
  it('extracts var path with default value array format');
  it('extracts multiple var paths from AND logic');
  it('extracts var paths from nested OR within AND');
  it('extracts var paths from arithmetic expressions');
  it('returns empty array for null/undefined/empty logic');
  it('handles deeply nested structures');
});
```

### Unit Tests for MonteCarloSimulator Validation

```javascript
describe('unseeded variable detection', () => {
  // Warning generation
  it('warns on unknown root var path (e.g., hasMaleGenitals)');
  it('warns on unknown nested emotion key');
  it('warns on unknown nested sexualState key');
  it('warns on invalid nesting of scalar (sexualArousal.x)');
  it('collects multiple warnings from single expression');
  it('collects warnings across multiple prerequisites');

  // Valid paths (no warnings)
  it('accepts valid emotion paths from prototypes');
  it('accepts valid sexualState paths from prototypes');
  it('accepts valid moodAxes paths');
  it('accepts sexualArousal as scalar');
  it('accepts previousEmotions/previousSexualStates/previousMoodAxes');

  // Config behavior
  it('throws when failOnUnseededVars is true and warnings exist');
  it('proceeds with warnings when failOnUnseededVars is false');
  it('skips validation when validateVarPaths is false');
  it('returns empty warnings array when all paths valid');

  // Result structure
  it('includes unseededVarWarnings in simulation result');
  it('warning objects have path, reason, and suggestion fields');
});
```

### Integration Test

```javascript
describe('unseeded variable detection integration', () => {
  it('detects unseeded vars in real expression files', async () => {
    // Load an expression that uses a hypothetical future key
    const expression = {
      id: 'test:future_feature',
      prerequisites: [{
        logic: { "and": [
          { ">=": [{ "var": "emotions.joy" }, 0.5] },
          { "==": [{ "var": "hasMaleGenitals" }, true] }
        ]}
      }]
    };

    const result = await simulator.simulate(expression);

    expect(result.unseededVarWarnings).toHaveLength(1);
    expect(result.unseededVarWarnings[0].path).toBe('hasMaleGenitals');
  });
});
```

### Manual Verification

1. Open `expression-diagnostics.html` in browser
2. Create test expression with unknown var path
3. Run Monte Carlo simulation
4. Verify warning appears in console/UI
5. Verify result includes `unseededVarWarnings`

## Verification Commands

```bash
# Run new utility tests
npm run test:unit -- --testPathPattern=jsonLogicVarExtractor

# Run simulator tests
npm run test:unit -- --testPathPattern=monteCarloSimulator

# Run full unit test suite
npm run test:unit

# Lint modified files
npx eslint src/utils/jsonLogicVarExtractor.js src/expressionDiagnostics/services/MonteCarloSimulator.js
```

## Summary

| File | Change |
|------|--------|
| `src/utils/jsonLogicVarExtractor.js` (NEW) | Shared var path extraction utilities |
| `tests/unit/utils/jsonLogicVarExtractor.test.js` (NEW) | Tests for extraction utilities |
| `MonteCarloSimulator.js` | Add validation methods, modify `simulate()` |
| `monteCarloSimulator.test.js` | Add unseeded variable detection tests |

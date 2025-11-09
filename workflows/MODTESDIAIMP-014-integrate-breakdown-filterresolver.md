# MODTESDIAIMP-014: Integrate Filter Breakdown into FilterResolver

**Phase**: 4 - Filter Clause Breakdown
**Priority**: 🟡 High
**Estimated Effort**: 2-3 hours (reduced from 3 hours based on analysis)
**Dependencies**: MODTESDIAIMP-013 (✅ FilterClauseAnalyzer exists), MODTESDIAIMP-009 (✅ ScopeEvaluationTracer exists), MODTESDIAIMP-011 (✅ tracer integration exists)

**Status**: 🔍 Workflow validated and corrected against production code (2025-11-09)

---

## Analysis Summary (2025-11-09)

This workflow has been validated against the actual codebase. Key findings:

### ✅ Already Implemented (No Work Needed)
1. **ScopeEvaluationTracer.logFilterEvaluation()** - Already accepts `breakdown = null` parameter (line 89)
2. **Tracer context passing** - Tracer is already passed via `runtimeCtx.tracer` to scope engine (line 339 of engine.js)
3. **FilterResolver tracer extraction** - Already extracts tracer from context (line 86 of filterResolver.js)
4. **FilterClauseAnalyzer** - Class exists with correct API at `src/scopeDsl/analysis/filterClauseAnalyzer.js`
5. **ModTestFixture.scopeTracer** - Property exists and is initialized (line 749)
6. **Basic getFilterBreakdown()** - Method exists (line 1223) but needs enhancement

### ⚠️ Work Required (Actual Implementation)
1. **FilterResolver**: Add FilterClauseAnalyzer import and pass breakdown to tracer (lines 240-251)
2. **ScopeEvaluationTracer**: Add breakdown formatting in `#formatFilterEvaluations()` (lines 319-329)
3. **ModTestFixture**: Enhance `getFilterBreakdown()` to add `hasBreakdown` and `clauses` fields (lines 1223-1232)

### Effort Adjustment
- **Original estimate**: 3 hours
- **Revised estimate**: 2-3 hours (30-40% of infrastructure already exists)

---

## Overview

Integrate FilterClauseAnalyzer into FilterResolver and ScopeEvaluationTracer to provide detailed clause-by-clause breakdown of filter evaluations, enabling precise identification of which filter conditions pass or fail during entity filtering.

## Objectives

- Add breakdown analysis to FilterResolver
- Pass breakdown to tracer
- Update tracer to store breakdown data
- Enhance formatted output with breakdown
- Maintain backward compatibility

## Implementation Details

### Files to Modify

1. **FilterResolver** - `src/scopeDsl/nodes/filterResolver.js`
2. **ScopeEvaluationTracer** - `tests/common/mods/scopeEvaluationTracer.js`

### 1. FilterResolver Integration

**File**: `src/scopeDsl/nodes/filterResolver.js`

**Current State**: The tracer is ALREADY being extracted from context (line 86) and `logFilterEvaluation()` is ALREADY being called (lines 243-250), but WITHOUT the breakdown parameter.

#### Import FilterClauseAnalyzer

**Status**: ✅ READY - The import path is correct and the class exists.

```javascript
import { FilterClauseAnalyzer } from '../analysis/filterClauseAnalyzer.js';
```

#### Modify resolve() Method

**Location**: Lines 240-251 (around the existing `tracer.logFilterEvaluation()` call)

**Key Changes**:
1. Add FilterClauseAnalyzer import at top of file
2. Analyze breakdown BEFORE calling `tracer.logFilterEvaluation()`
3. Pass breakdown as 5th parameter to `tracer.logFilterEvaluation()`

**Actual Implementation Context** (lines 240-251):
```javascript
// CURRENT CODE (needs modification):
const evalResult = logicEval.evaluate(node.logic, evalCtx);

// ADD: Log to tracer (in addition to existing trace logging)
if (tracer?.isEnabled()) {
  const entityId = typeof item === 'string' ? item : item?.id;
  tracer.logFilterEvaluation(
    entityId,
    node.logic,
    evalResult,
    evalCtx
    // MISSING: breakdown parameter should be added here
  );
}
```

**Required Changes**:
```javascript
const evalResult = logicEval.evaluate(node.logic, evalCtx);

// MODIFY: Analyze filter breakdown if tracer enabled
if (tracer?.isEnabled()) {
  const entityId = typeof item === 'string' ? item : item?.id;

  // ADD: Analyze breakdown before logging
  const analysis = FilterClauseAnalyzer.analyzeFilter(
    node.logic,
    evalCtx,
    logicEval
  );

  // MODIFY: Pass breakdown as 5th parameter
  tracer.logFilterEvaluation(
    entityId,
    node.logic,
    evalResult,
    evalCtx,
    analysis.breakdown  // ADD this parameter
  );
}
```

### 2. ScopeEvaluationTracer Enhancement

**File**: `tests/common/mods/scopeEvaluationTracer.js`

**Current State**: The signature ALREADY includes `breakdown = null` parameter (line 89). The method ALREADY stores breakdown in steps (line 101).

#### Update logFilterEvaluation Signature

**Status**: ✅ ALREADY CORRECT - No changes needed to method signature or basic storage.

**Current Implementation** (lines 89-103):
```javascript
logFilterEvaluation(entityId, logic, result, evalContext, breakdown = null) {
  if (!this.#enabled) {
    return;
  }

  this.#steps.push({
    timestamp: Date.now(),
    type: 'FILTER_EVALUATION',
    entityId,
    logic,
    result,
    context: evalContext,
    breakdown,  // ✅ ALREADY storing breakdown
  });
}
```

**Note**: The actual code stores raw values (not serialized). Serialization happens in the `#serializeValue()` method used by tracer internally for Set/Array types, but breakdown is stored as-is.

#### Add Breakdown Serialization

**Status**: ⚠️ OPTIONAL - Current code stores breakdown as-is. Serialization may be needed if breakdown contains circular references or needs normalization.

**Recommendation**: Start without serialization since FilterClauseAnalyzer already produces JSON-safe output. Add serialization only if needed during testing.

**If serialization is needed** (add after line 278):
```javascript
/**
 * Serialize filter breakdown for storage
 * @private
 */
#serializeBreakdown(breakdown) {
  if (!breakdown) return null;

  const serialized = {
    type: breakdown.type,
    description: breakdown.description,
  };

  if (breakdown.type === 'operator') {
    serialized.operator = breakdown.operator;
    serialized.result = breakdown.result;
    serialized.children = breakdown.children?.map(child =>
      this.#serializeBreakdown(child)
    );
  } else if (breakdown.type === 'variable') {
    serialized.varName = breakdown.varName;
    serialized.value = breakdown.value; // Already primitive from FilterClauseAnalyzer
  } else if (breakdown.type === 'value') {
    serialized.value = breakdown.value; // Already primitive
  }

  return serialized;
}
```

#### Enhance Formatted Output

**Status**: ⚠️ NEEDS MODIFICATION - Current `format()` method (lines 148-224) already has sophisticated filter evaluation formatting but does NOT include breakdown tree.

**Current Implementation** (lines 162-217):
The tracer already:
- Groups filter evaluations properly (lines 184-188)
- Formats pass/fail with symbols (line 320)
- Has a sophisticated `#formatFilterEvaluations()` helper (lines 312-339)

**What needs to be added**:
- Integration of breakdown tree into `#formatFilterEvaluations()` method
- New `#formatBreakdown()` helper method

**Location to modify**: Lines 319-329 in `#formatFilterEvaluations()` method

**Required Changes**:
```javascript
// IN #formatFilterEvaluations() method (around line 319):
for (const evaluation of evaluations) {
  const symbol = evaluation.result ? '✓' : '✗';
  const status = evaluation.result ? 'PASS' : 'FAIL';

  lines.push(`   Entity: ${evaluation.entityId}`);
  lines.push(`   Result: ${status} ${symbol}`);

  // ADD: Format breakdown if available
  if (evaluation.breakdown) {
    lines.push('   Breakdown:');
    lines.push(...this.#formatBreakdown(evaluation.breakdown, 5));
  }

  lines.push('');
}
```

#### Add Breakdown Formatting

**Status**: ✅ NEW METHOD NEEDED - Add after line 368 (after `#formatBreakdown()` definition that already exists)

**Note**: There is ALREADY a `#formatBreakdown()` method (lines 350-368) but it's generic. We need to enhance it or add a specialized version for filter breakdowns.

**Current `#formatBreakdown()`** (lines 350-368):
- Takes a breakdown object and recursively formats it
- Uses indentation
- Handles boolean values with ✓/✗ symbols

**Recommendation**: The current implementation may already work! Test it first before adding a new method.

**If enhancement needed**:
```javascript
/**
 * Format filter breakdown tree for display
 * @private
 * @param {object} breakdown - FilterClauseAnalyzer breakdown tree
 * @param {number} indent - Indentation level (number of spaces)
 * @returns {Array<string>} Formatted lines
 */
#formatFilterBreakdown(breakdown, indent = 0) {
  const lines = [];
  const prefix = ' '.repeat(indent);

  if (!breakdown) return lines;

  if (breakdown.type === 'operator') {
    const symbol = breakdown.result ? '✓' : '✗';
    lines.push(`${prefix}${symbol} ${breakdown.operator}: ${breakdown.description}`);

    if (breakdown.children) {
      for (const child of breakdown.children) {
        lines.push(...this.#formatFilterBreakdown(child, indent + 2));
      }
    }
  } else if (breakdown.type === 'variable') {
    lines.push(`${prefix}  ${breakdown.description}`);
  } else if (breakdown.type === 'value') {
    lines.push(`${prefix}  value: ${breakdown.value}`);
  }

  return lines;
}
```

### 3. ModTestFixture Enhancement

**File**: `tests/common/mods/ModTestFixture.js`

**Current State**: The `getFilterBreakdown()` method EXISTS (line 1223) but is SIMPLE - it just returns raw filter evaluations without enhanced structure.

#### Update getFilterBreakdown Method

**Status**: ⚠️ NEEDS ENHANCEMENT - Current method (lines 1223-1232) returns raw data. Need to add enhanced structure.

**Current Implementation** (lines 1223-1232):
```javascript
getFilterBreakdown(entityId = null) {
  const trace = this.scopeTracer.getTrace();
  const filterEvals = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

  if (entityId) {
    return filterEvals.find(e => e.entityId === entityId);
  }

  return filterEvals;
}
```

**Required Enhancement** (replace lines 1223-1232):
```javascript
/**
 * Get filter breakdown for last evaluation
 * @param {string} entityId - Optional entity ID to filter by
 * @returns {object|Array} Filter breakdown with clause analysis
 */
getFilterBreakdown(entityId = null) {
  const trace = this.scopeTracer.getTrace();
  const filterEvals = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

  if (entityId) {
    const found = filterEvals.find(e => e.entityId === entityId);
    return found ? {
      ...found,
      hasBreakdown: !!found.breakdown,
      clauses: found.breakdown ? this.#extractClauses(found.breakdown) : [],
    } : null;
  }

  return filterEvals.map(e => ({
    entityId: e.entityId,
    result: e.result,
    hasBreakdown: !!e.breakdown,
    clauses: e.breakdown ? this.#extractClauses(e.breakdown) : [],
  }));
}

/**
 * Extract clauses from breakdown tree
 * @private
 */
#extractClauses(breakdown, clauses = []) {
  if (breakdown.type === 'operator') {
    clauses.push({
      operator: breakdown.operator,
      result: breakdown.result,
      description: breakdown.description,
    });

    if (breakdown.children) {
      for (const child of breakdown.children) {
        this.#extractClauses(child, clauses);
      }
    }
  }

  return clauses;
}
```

## Acceptance Criteria

### FilterResolver (`src/scopeDsl/nodes/filterResolver.js`)
- ✅ **VERIFY**: FilterClauseAnalyzer imported at top of file
- ✅ **MODIFY**: Breakdown analysis performed when tracer enabled (lines 240-251)
- ✅ **MODIFY**: Breakdown passed as 5th parameter to `tracer.logFilterEvaluation()`
- ✅ **VERIFY**: No performance impact when tracer disabled (analysis only happens inside `if (tracer?.isEnabled())` block)

### ScopeEvaluationTracer (`tests/common/mods/scopeEvaluationTracer.js`)
- ✅ **ALREADY DONE**: `logFilterEvaluation()` accepts breakdown parameter (line 89)
- ✅ **ALREADY DONE**: Breakdown stored in steps (line 101)
- ⚠️ **MODIFY**: `format()` output includes breakdown tree (lines 319-329 in `#formatFilterEvaluations()`)
- ⚠️ **ADD**: Breakdown formatted with ✓/✗ symbols (use existing or add new `#formatFilterBreakdown()` method)
- ⚠️ **ADD**: Indentation shows tree structure (recursive formatting)

### ModTestFixture (`tests/common/mods/ModTestFixture.js`)
- ✅ **ALREADY EXISTS**: `getFilterBreakdown()` method (line 1223)
- ⚠️ **ENHANCE**: Add `hasBreakdown` flag to return value
- ⚠️ **ENHANCE**: Add `clauses` array extracted from tree
- ⚠️ **ADD**: New `#extractClauses()` private method
- ✅ **VERIFY**: Entity filtering works correctly after changes

### Backward Compatibility
- ✅ **VERIFY**: Works when breakdown is null (tracer stores null safely)
- ✅ **VERIFY**: Existing tests continue to pass (breakdown is optional parameter)
- ✅ **VERIFY**: Formatted output readable without breakdown (only shows when present)

### Validation Checklist
1. Run existing tracer tests: `NODE_ENV=test npx jest tests/unit/common/mods/scopeEvaluationTracer --no-coverage`
2. Run existing ModTestFixture tests: `NODE_ENV=test npx jest tests/unit/common/mods/ModTestFixture.tracer --no-coverage`
3. Run scope tracing integration tests: `NODE_ENV=test npx jest tests/integration/scopeDsl/scopeTracingIntegration --no-coverage`
4. Verify no regressions in filter resolver tests: `NODE_ENV=test npx jest tests/unit/scopeDsl/nodes/filterResolver --no-coverage`

## Testing Requirements

### Unit Tests

**File**: `tests/unit/scopeDsl/nodes/filterResolver.breakdown.test.js` (new)

```javascript
describe('FilterResolver - Breakdown Integration', () => {
  describe('Breakdown analysis', () => {
    it('should analyze breakdown when tracer enabled')
    it('should not analyze when tracer disabled')
    it('should pass breakdown to tracer')
  });

  describe('Performance', () => {
    it('should have minimal overhead when disabled')
    it('should only analyze when tracer enabled')
  });
});
```

**File**: `tests/unit/common/mods/scopeEvaluationTracer.breakdown.test.js` (new)

```javascript
describe('ScopeEvaluationTracer - Breakdown', () => {
  describe('Breakdown serialization', () => {
    it('should serialize operator nodes')
    it('should serialize variable nodes')
    it('should serialize value nodes')
    it('should serialize nested trees')
  });

  describe('Breakdown formatting', () => {
    it('should format with ✓/✗ symbols')
    it('should indent nested clauses')
    it('should show variable values')
    it('should format complex trees')
  });
});
```

### Integration Tests

**File**: `tests/integration/scopeDsl/filterBreakdownIntegration.test.js` (new)

```javascript
describe('Filter Breakdown Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Complete breakdown capture', () => {
    it('should capture breakdown for simple filter', async () => {
      testFixture.enableScopeTracing();

      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      testFixture.testEnv.getAvailableActions(scenario.actor.id);

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      expect(breakdown).toBeTruthy();
      expect(breakdown.hasBreakdown).toBe(true);
      expect(breakdown.clauses.length).toBeGreaterThan(0);
    });

    it('should capture breakdown for nested filter')
    it('should capture breakdown for multiple entities')
  });

  describe('Formatted output quality', () => {
    it('should show breakdown in trace')
    it('should use ✓/✗ symbols')
    it('should indent clauses')
  });
});
```

## Migration Impact

### Breaking Changes
- **None** - Breakdown is optional parameter

### Backward Compatibility
- Existing code works without breakdown
- Tests without tracer continue to work
- Formatted output readable with or without breakdown

## Performance Testing

Verify:
- No overhead when tracer disabled
- Acceptable overhead when enabled (~10-20%)
- No memory leaks with repeated analysis

## Usage Example

```javascript
it('debug filter failure with breakdown', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
  const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);

  if (actions.length === 0) {
    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

    console.log('Filter breakdown:');
    console.log(`Result: ${breakdown.result ? 'PASS' : 'FAIL'}`);
    console.log('Clauses:');
    breakdown.clauses.forEach(clause => {
      const symbol = clause.result ? '✓' : '✗';
      console.log(`  ${symbol} ${clause.operator}: ${clause.description}`);
    });
  }

  expect(actions).not.toHaveLength(0);
});
```

**Expected Output**:
```
Filter breakdown:
Result: FAIL
Clauses:
  ✗ and: All conditions must be true
    ✓ ==: var("type") equals "actor"
    ✗ component_present: Component "positioning:sitting" is present
```

## Implementation Recommendations

### Development Sequence
1. **Start with FilterResolver** (30 min)
   - Add import for FilterClauseAnalyzer
   - Modify lines 240-251 to analyze and pass breakdown
   - Test with existing unit tests

2. **Enhance ScopeEvaluationTracer** (45 min)
   - Test if existing `#formatBreakdown()` (lines 350-368) works with FilterClauseAnalyzer output
   - If not, add specialized `#formatFilterBreakdown()` method
   - Modify `#formatFilterEvaluations()` to include breakdown (lines 319-329)
   - Test with manual trace output

3. **Update ModTestFixture** (30 min)
   - Replace `getFilterBreakdown()` method (lines 1223-1232)
   - Add `#extractClauses()` private helper
   - Test with integration tests

4. **Validation** (30-45 min)
   - Run all validation checklist items
   - Verify backward compatibility
   - Test with actual mod tests

### Key Technical Notes

1. **Performance**: Breakdown analysis only occurs when tracer is enabled, ensuring zero overhead in production
2. **Serialization**: May not be needed - test without it first since FilterClauseAnalyzer produces JSON-safe output
3. **Formatting**: Existing `#formatBreakdown()` in tracer may already work - test before adding new method
4. **Context Flow**: Tracer flows through: `ModTestFixture.scopeTracer` → `runtimeCtx.tracer` → `ctx.tracer` → `FilterResolver`

### Potential Issues to Watch

1. **Circular References**: FilterClauseAnalyzer should produce clean objects, but verify during testing
2. **Large Breakdowns**: Deep filter trees may produce verbose output - consider truncation in formatting
3. **Null Handling**: Ensure all code paths handle `breakdown = null` gracefully
4. **Type Safety**: Verify breakdown structure matches expectations in `#extractClauses()`

## References

- **Spec Section**: 4.2 Integration with FilterResolver (lines 1487-1545)
- **Spec Section**: 4.3 Integration with Tracer (lines 1547-1607)
- **Related Tickets**:
  - MODTESDIAIMP-013 (✅ FilterClauseAnalyzer class - COMPLETED)
  - MODTESDIAIMP-015 (Filter breakdown tests - PENDING)
  - MODTESDIAIMP-009 (✅ ScopeEvaluationTracer - COMPLETED)
  - MODTESDIAIMP-011 (✅ Tracer integration - COMPLETED)

## Key Corrections Made (2025-11-09)

### Infrastructure Already Present
- ScopeEvaluationTracer accepts and stores breakdown parameter ✅
- Tracer is passed through runtimeCtx to resolvers ✅
- FilterResolver already extracts and uses tracer ✅
- FilterClauseAnalyzer class fully implemented ✅
- ModTestFixture has scopeTracer and getFilterBreakdown() ✅

### Work Actually Required
1. Import FilterClauseAnalyzer in FilterResolver
2. Call FilterClauseAnalyzer.analyzeFilter() before logging
3. Pass breakdown as 5th parameter to tracer.logFilterEvaluation()
4. Add breakdown formatting to ScopeEvaluationTracer
5. Enhance ModTestFixture.getFilterBreakdown() with hasBreakdown and clauses

### Estimate Adjustment
- **Before analysis**: 3 hours (assumed infrastructure needed building)
- **After analysis**: 2-3 hours (30-40% of infrastructure already complete)

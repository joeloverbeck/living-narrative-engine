# MODTESDIAIMP-014: Integrate Filter Breakdown into FilterResolver

**Phase**: 4 - Filter Clause Breakdown
**Priority**: 🟡 High
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-013, MODTESDIAIMP-009, MODTESDIAIMP-011

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

#### Import FilterClauseAnalyzer

```javascript
import { FilterClauseAnalyzer } from '../analysis/filterClauseAnalyzer.js';
```

#### Modify resolve() Method

```javascript
resolve(node, ctx) {
  const { actorEntity, dispatcher, trace, tracer } = ctx;

  // ...existing validation and setup...

  const result = new Set();

  for (const item of currentSet) {
    const entityId = typeof item === 'string' ? item : item?.id;

    // Build evaluation context
    const evalCtx = this.#buildEvalContext(node, ctx, entityId);

    // Evaluate filter
    const passedFilter = logicEval.evaluate(node.logic, evalCtx);

    // ADD: Analyze filter breakdown if tracer enabled
    let breakdown = null;
    if (tracer?.isEnabled()) {
      const analysis = FilterClauseAnalyzer.analyzeFilter(
        node.logic,
        evalCtx,
        logicEval
      );
      breakdown = analysis.breakdown;

      // Log with breakdown
      tracer.logFilterEvaluation(
        entityId,
        node.logic,
        passedFilter,
        evalCtx,
        breakdown
      );
    }

    if (passedFilter) {
      result.add(item);
    }

    // ...existing trace logging...
  }

  return result;
}
```

### 2. ScopeEvaluationTracer Enhancement

**File**: `tests/common/mods/scopeEvaluationTracer.js`

#### Update logFilterEvaluation Signature

```javascript
/**
 * Log filter evaluation for an entity
 * @param {string} entityId - Entity being evaluated
 * @param {object} logic - JSON Logic expression
 * @param {boolean} result - Pass/fail result
 * @param {object} evalContext - Evaluation context
 * @param {object|null} breakdown - Clause breakdown analysis
 */
logFilterEvaluation(entityId, logic, result, evalContext, breakdown = null) {
  if (!this.#enabled) return;

  this.#steps.push({
    timestamp: Date.now(),
    type: 'FILTER_EVALUATION',
    entityId,
    logic: this.#serializeValue(logic),
    result,
    context: this.#serializeObject(evalContext),
    breakdown: breakdown ? this.#serializeBreakdown(breakdown) : null,
  });
}
```

#### Add Breakdown Serialization

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
    serialized.value = this.#serializeValue(breakdown.value);
  } else if (breakdown.type === 'value') {
    serialized.value = this.#serializeValue(breakdown.value);
  }

  return serialized;
}
```

#### Enhance Formatted Output

```javascript
format() {
  if (this.#steps.length === 0) {
    return 'No trace data available';
  }

  let output = 'SCOPE EVALUATION TRACE:\n';
  output += '='.repeat(80) + '\n\n';

  let stepNumber = 1;

  for (const step of this.#steps) {
    if (step.type === 'RESOLVER_STEP') {
      output += `${stepNumber}. [${step.resolver}] ${step.operation}\n`;
      output += `   Input: ${this.#formatValue(step.input)}\n`;
      output += `   Output: ${this.#formatValue(step.output)}\n\n`;
      stepNumber++;
    } else if (step.type === 'FILTER_EVALUATION') {
      // Group filter evaluations by parent resolver step
      // Don't increment stepNumber for individual evaluations
      output += `   Entity: ${step.entityId}\n`;
      output += `   Result: ${step.result ? 'PASS ✓' : 'FAIL ✗'}\n`;

      // ADD: Format breakdown if available
      if (step.breakdown) {
        output += this.#formatBreakdown(step.breakdown, '   ');
      }

      output += '\n';
    }
  }

  // Summary section
  const summary = this.#calculateSummary();
  output += '='.repeat(80) + '\n';
  output += `Summary: ${summary.totalSteps} steps, ${summary.duration}ms, `;
  output += `Final size: ${summary.finalOutput?.size ?? 0}\n`;

  return output;
}
```

#### Add Breakdown Formatting

```javascript
/**
 * Format filter breakdown tree
 * @private
 */
#formatBreakdown(breakdown, indent = '') {
  let output = '';

  if (!breakdown) return output;

  if (breakdown.type === 'operator') {
    const symbol = breakdown.result ? '✓' : '✗';
    output += `${indent}${symbol} ${breakdown.operator}\n`;

    if (breakdown.children) {
      for (const child of breakdown.children) {
        output += this.#formatBreakdown(child, indent + '  ');
      }
    }
  } else if (breakdown.type === 'variable') {
    output += `${indent}  var("${breakdown.varName}") = ${this.#formatValue(breakdown.value)}\n`;
  }

  return output;
}
```

### 3. ModTestFixture Enhancement

**File**: `tests/common/mods/ModTestFixture.js`

#### Update getFilterBreakdown Method

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

### FilterResolver
- ✅ FilterClauseAnalyzer imported
- ✅ Breakdown analysis performed when tracer enabled
- ✅ Breakdown passed to tracer.logFilterEvaluation()
- ✅ No performance impact when tracer disabled

### ScopeEvaluationTracer
- ✅ logFilterEvaluation() accepts breakdown parameter
- ✅ Breakdown serialized and stored in steps
- ✅ format() output includes breakdown tree
- ✅ Breakdown formatted with ✓/✗ symbols
- ✅ Indentation shows tree structure

### ModTestFixture
- ✅ getFilterBreakdown() returns clause analysis
- ✅ hasBreakdown flag indicates availability
- ✅ clauses array extracted from tree
- ✅ Entity filtering works correctly

### Backward Compatibility
- ✅ Works when breakdown is null
- ✅ Existing tests continue to pass
- ✅ Formatted output readable without breakdown

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

## References

- **Spec Section**: 4.2 Integration with FilterResolver (lines 1487-1545)
- **Spec Section**: 4.3 Integration with Tracer (lines 1547-1607)
- **Related Tickets**:
  - MODTESDIAIMP-013 (FilterClauseAnalyzer class)
  - MODTESDIAIMP-015 (Filter breakdown tests)
  - MODTESDIAIMP-009 (ScopeEvaluationTracer)
  - MODTESDIAIMP-011 (Tracer integration)

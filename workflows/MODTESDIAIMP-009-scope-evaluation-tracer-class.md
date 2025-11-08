# MODTESDIAIMP-009: Create ScopeEvaluationTracer Class

**Phase**: 3 - Scope Evaluation Tracer
**Priority**: 🟡 High
**Estimated Effort**: 5 hours
**Dependencies**: None (independent)

---

## Overview

Create a comprehensive scope evaluation tracer that captures step-by-step resolver execution, filter evaluations per entity, and provides formatted trace output for debugging scope resolution issues.

## Objectives

- Capture resolver execution flow with input/output
- Log filter evaluations per entity with results
- Support enable/disable toggle with minimal overhead when disabled
- Provide formatted human-readable trace output
- Include summary statistics
- Support raw data access for programmatic analysis

## Implementation Details

### File Location
- **Path**: `tests/common/mods/scopeEvaluationTracer.js`
- **New File**: Yes

### Class Structure

```javascript
export class ScopeEvaluationTracer {
  constructor()
  enable()
  disable()
  isEnabled()
  logStep(resolverName, operation, input, output, details = {})
  logFilterEvaluation(entityId, logic, result, evalContext, breakdown = null)
  logError(phase, error, context = {})
  getTrace()
  format()
  clear()
}
```

### Core Methods

#### 1. State Management
- `enable()` - Enable tracing, reset start time
- `disable()` - Disable tracing
- `isEnabled()` - Check if tracing is active
- `clear()` - Reset trace data

#### 2. Data Collection
- `logStep()` - Log resolver execution step
- `logFilterEvaluation()` - Log filter evaluation for entity
- `logError()` - Log error during evaluation

#### 3. Data Access
- `getTrace()` - Get raw trace data with summary
- `format()` - Get human-readable formatted output

### Step Data Structure

```javascript
{
  timestamp: number,
  type: 'RESOLVER_STEP' | 'FILTER_EVALUATION' | 'ERROR',

  // For RESOLVER_STEP
  resolver: string,
  operation: string,
  input: SerializedValue,
  output: SerializedValue,
  details: object,

  // For FILTER_EVALUATION
  entityId: string,
  logic: object,
  result: boolean,
  context: object,
  breakdown: object | null,

  // For ERROR
  phase: string,
  error: { message, name, stack },
  context: object
}
```

### Value Serialization

Support serialization of:
- `Set` → `{ type: 'Set', size, values: [...] }`
- `Array` → `{ type: 'Array', size, values: [...] }`
- `Object` → `{ type: 'Object', keys: [...] }`
- Primitives → `{ type, value }`

Limit arrays/sets to first 10 items for performance.

### Trace Summary

```javascript
{
  totalSteps: number,
  resolverSteps: number,
  filterEvaluations: number,
  errors: number,
  duration: number,
  resolversUsed: string[],
  finalOutput: SerializedValue
}
```

## Formatted Output Template

```
SCOPE EVALUATION TRACE:
================================================================================

1. [SourceResolver] resolve(kind='actor')
   Input: Context object
   Output: Set (1 item) ['actor-id-123']

2. [StepResolver] resolve(field='components.positioning:closeness.partners')
   Input: Set (1 item) ['actor-id-123']
   Output: Set (2 items) ['target-id-456', 'target-id-789']

3. [FilterResolver] Evaluating 2 entities

   Entity: target-id-456
   Result: FAIL ✗
   Breakdown:
     ✓ and
       ✗ condition_ref: "positioning:facing-away"

   Entity: target-id-789
   Result: PASS ✓

   Output: Set (1 item) ['target-id-789']

================================================================================
Summary: 3 steps, 42ms, Final size: 1
```

## Acceptance Criteria

### Core Functionality
- ✅ Tracer can be enabled/disabled
- ✅ Steps captured with timestamp
- ✅ Resolver steps include input/output
- ✅ Filter evaluations include entity ID and result
- ✅ Errors captured with phase and context

### Value Serialization
- ✅ Sets serialized with size and values
- ✅ Arrays serialized with size and values
- ✅ Objects serialized with keys only
- ✅ Large collections limited to first 10 items

### Trace Summary
- ✅ Total steps counted
- ✅ Resolver types tracked
- ✅ Duration calculated
- ✅ Final output preserved

### Formatting
- ✅ Human-readable output with sections
- ✅ Numbered steps
- ✅ Input/output clearly labeled
- ✅ Pass/fail indicators (✓/✗)
- ✅ Summary section at end

### Performance
- ✅ Minimal overhead when disabled (< 5%)
- ✅ Acceptable overhead when enabled (< 30%)

## Testing Requirements

**Test File**: `tests/unit/common/mods/scopeEvaluationTracer.test.js`

### Test Cases

```javascript
describe('ScopeEvaluationTracer', () => {
  describe('State management', () => {
    it('should start disabled')
    it('should enable tracing')
    it('should disable tracing')
    it('should track enabled state')
  });

  describe('Step logging', () => {
    it('should log resolver step when enabled')
    it('should not log when disabled')
    it('should serialize Set input/output')
    it('should serialize Array input/output')
    it('should serialize Object input/output')
    it('should limit large collections to 10 items')
  });

  describe('Filter evaluation logging', () => {
    it('should log filter evaluation')
    it('should include entity ID')
    it('should include result (pass/fail)')
    it('should include breakdown if provided')
  });

  describe('Error logging', () => {
    it('should log errors with phase')
    it('should capture error message and stack')
    it('should include error context')
  });

  describe('Trace data', () => {
    it('should return raw trace data')
    it('should calculate summary statistics')
    it('should track resolvers used')
    it('should preserve final output')
    it('should calculate duration')
  });

  describe('Formatting', () => {
    it('should format empty trace')
    it('should format resolver steps')
    it('should format filter evaluations')
    it('should format errors')
    it('should format complete trace')
    it('should include summary section')
    it('should use ✓/✗ symbols')
  });

  describe('Clear', () => {
    it('should clear steps array')
    it('should reset start time')
    it('should preserve enabled state')
  });
});
```

## Integration Points

Will be integrated into:
- `ModTestFixture` API (MODTESDIAIMP-010)
- `ScopeEngine.dispatch()` (MODTESDIAIMP-011)
- `FilterResolver.resolve()` (MODTESDIAIMP-011)
- Other resolvers as needed (MODTESDIAIMP-011)

## Example Usage

```javascript
const tracer = new ScopeEvaluationTracer();

// Enable tracing
tracer.enable();

// Log a resolver step
tracer.logStep(
  'SourceResolver',
  "resolve(kind='actor')",
  { type: 'Context' },
  { type: 'Set', size: 1, values: ['actor-123'] }
);

// Log a filter evaluation
tracer.logFilterEvaluation(
  'entity-456',
  { '==': [1, 1] },
  true,  // passed
  { var1: 'value1' }
);

// Get formatted output
console.log(tracer.format());

// Get raw data
const trace = tracer.getTrace();
console.log(trace.summary);
```

## References

- **Spec Section**: 3.3 Scope Evaluation Tracer (lines 739-1027)
- **Example Section**: 5. Usage Examples, Example 2 (lines 1887-2001)
- **Related Tickets**:
  - MODTESDIAIMP-010 (ModTestFixture integration)
  - MODTESDIAIMP-011 (ScopeEngine/resolver integration)

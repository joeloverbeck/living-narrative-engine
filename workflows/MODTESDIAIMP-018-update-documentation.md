# MODTESDIAIMP-018: Update Documentation with Diagnostics Features

**Phase**: 6 - Documentation
**Priority**: 🟡 High
**Estimated Effort**: 3 hours
**Dependencies**: All previous tickets (MODTESDIAIMP-001 through MODTESDIAIMP-017)

---

## Overview

Update project documentation to reflect new mod testing diagnostics capabilities, including parameter validation, enhanced error context, scope tracing, filter breakdown, and performance metrics.

## Objectives

- Update mod-testing-guide.md with new features
- Add troubleshooting section with diagnostics examples
- Document all new ModTestFixture APIs
- Provide usage examples for each feature
- Create quick reference guide

## Implementation Details

### Files to Update

1. **Main Testing Guide** - `docs/testing/mod-testing-guide.md` (update existing)
2. **Troubleshooting Guide** - `docs/testing/troubleshooting-scope-issues.md` (new - focuses on ModTestFixture diagnostics; complements existing `docs/scopeDsl/troubleshooting.md` which covers DSL syntax)
3. **API Reference** - `docs/testing/mod-test-fixture-api.md` (new - comprehensive API reference for diagnostics features)

### 1. Update mod-testing-guide.md

**File**: `docs/testing/mod-testing-guide.md`

#### Add New Section: Diagnostics Features

```markdown
## 🔍 Diagnostics Features

The ModTestFixture provides comprehensive diagnostics to help debug scope resolution issues.

### Parameter Validation

**What it does**: Validates parameters passed to scope resolution functions

**Catches**:
- Context object passed instead of entity
- Missing or invalid runtimeCtx
- Malformed AST structures

**Example error**:
```javascript
ParameterValidationError: Expected actorEntity (object with .id), got object
  Source: ScopeEngine.resolve
  💡 Hint: Extract actorEntity from context before passing
  Example: const actorEntity = context.actorEntity || context.actor;
```

### Enhanced Error Context

**What it does**: Wraps scope resolution errors with rich context

**Provides**:
- Scope name and phase where error occurred
- Parameter values for debugging
- Helpful hints and suggestions
- Code examples for correct usage

**Example error**:
```javascript
ScopeResolutionError: Invalid parameter passed to scope resolver
  Scope: positioning:close_actors
  Phase: parameter extraction
  Parameters:
    contextType: object
    hasActorEntity: false
  💡 Hint: Extract actorEntity from context before passing
```

### Scope Evaluation Tracing

**What it does**: Captures step-by-step execution of scope resolution

**Enables**:
- Seeing which resolvers execute and in what order
- Inspecting input/output of each step
- Viewing filter evaluations per entity
- Identifying where empty sets occur

**Usage**:
```javascript
it('debug with scope tracing', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  const actions = testFixture.discoverActions(scenario.actor.id);

  if (actions.length === 0) {
    console.log(testFixture.getScopeTrace());
  }
});
```

**Output**:
```
SCOPE EVALUATION TRACE:
================================================================================

1. [SourceResolver] resolve(kind='actor')
   Input: Context object
   Output: Set (1 item) ['actor-alice-123']

2. [StepResolver] resolve(field='components.positioning:closeness.partners')
   Input: Set (1 item) ['actor-alice-123']
   Output: Set (1 item) ['actor-bob-456']

3. [FilterResolver] Evaluating 1 entities

   Entity: actor-bob-456
   Result: PASS ✓

================================================================================
Summary: 3 steps, 12ms, Final size: 1
```

### Filter Clause Breakdown

**What it does**: Shows which filter clauses pass/fail for each entity

**Enables**:
- Identifying exactly which filter condition failed
- Seeing variable values in filter context
- Understanding complex nested filter logic

**Usage**:
```javascript
it('debug filter failure', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  testFixture.discoverActions(scenario.actor.id);

  const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

  if (breakdown && !breakdown.result) {
    console.log('Filter failed:');
    breakdown.clauses.forEach(clause => {
      const symbol = clause.result ? '✓' : '✗';
      console.log(`  ${symbol} ${clause.operator}: ${clause.description}`);
    });
  }
});
```

**Output**:
```
Filter failed:
  ✗ and: All conditions must be true
    ✓ ==: var("type") equals "actor"
    ✗ component_present: Component "positioning:sitting" is present
```

### Performance Metrics

**What it does**: Measures timing of scope resolution operations

**Provides**:
- Per-resolver timing breakdown
- Filter evaluation statistics
- Slowest operation identification
- Tracing overhead calculation

**Usage**:
```javascript
it('analyze performance', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  testFixture.discoverActions(scenario.actor.id);

  const metrics = testFixture.getScopePerformanceMetrics();

  console.log(`Total: ${metrics.totalDuration.toFixed(2)}ms`);
  metrics.resolverStats.forEach(stat => {
    console.log(`  ${stat.resolver}: ${stat.totalTime.toFixed(2)}ms (${stat.percentage.toFixed(1)}%)`);
  });
});
```
```

#### Add Section: API Reference

```markdown
## 📚 ModTestFixture API Reference

### Scope Tracing Control

#### `enableScopeTracing()`
Enable scope evaluation tracing.

#### `disableScopeTracing()`
Disable scope evaluation tracing.

#### `clearScopeTrace()`
Clear accumulated trace data.

#### `enableScopeTracingIf(condition)`
Conditionally enable tracing.

```javascript
const shouldTrace = actions.length === 0;
testFixture.enableScopeTracingIf(shouldTrace);
```

### Trace Data Access

#### `getScopeTrace()`
Get formatted, human-readable trace output.

**Returns**: `string` - Formatted trace

```javascript
const trace = testFixture.getScopeTrace();
console.log(trace);
```

#### `getScopeTraceData()`
Get raw trace data structure.

**Returns**: `object` - Raw trace with steps and summary

```javascript
const data = testFixture.getScopeTraceData();
console.log(data.summary.totalSteps);
console.log(data.summary.resolversUsed);
```

#### `getFilterBreakdown(entityId?)`
Get filter clause breakdown.

**Parameters**:
- `entityId` (optional): Filter to specific entity

**Returns**: `object|Array` - Filter breakdown with clauses

```javascript
// All filter evaluations
const allBreakdowns = testFixture.getFilterBreakdown();

// Specific entity
const breakdown = testFixture.getFilterBreakdown(entityId);
```

### Performance Metrics

#### `getScopePerformanceMetrics()`
Get detailed performance timing metrics.

**Returns**: `object` - Performance metrics

```javascript
const metrics = testFixture.getScopePerformanceMetrics();
console.log(metrics.resolverStats);
console.log(metrics.filterEvaluation);
console.log(metrics.slowestOperations);
```

#### `getScopeTraceWithPerformance()`
Get formatted trace with performance focus.

**Returns**: `string` - Performance-focused trace

```javascript
const perfTrace = testFixture.getScopeTraceWithPerformance();
console.log(perfTrace);
```
```

### 2. Create Troubleshooting Guide

**File**: `docs/testing/troubleshooting-scope-issues.md` (new)

```markdown
# Troubleshooting Scope Resolution Issues

This guide helps debug common scope resolution problems using ModTestFixture diagnostics features.

> **See Also**: For ScopeDSL syntax errors and general troubleshooting, see [docs/scopeDsl/troubleshooting.md](../scopeDsl/troubleshooting.md). This guide focuses specifically on using ModTestFixture's tracing and diagnostics features.

## Common Issues

### 1. Action Not Discovered

**Symptom**: Expected action doesn't appear in available actions

**Diagnostic Approach**:
```javascript
it('debug missing action', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  const actions = testFixture.discoverActions(scenario.actor.id);

  expect(actions.some(a => a.id === 'positioning:sit_down')).toBe(true);
});
```

**Trace Analysis**:
1. Check if scope resolves to empty set
2. Examine filter evaluations per entity
3. Identify which filter clause failed

**Example Output**:
```
3. [FilterResolver] Evaluating 2 entities

   Entity: actor-bob-456
   Result: FAIL ✗
   Breakdown:
     ✗ and
       ✓ ==: var("type") equals "actor"
       ✗ component_present: Component "positioning:sitting" is present
```

**Solution**: Target is missing required component

### 2. Empty Set Mystery

**Symptom**: Scope resolves to empty set unexpectedly

**Diagnostic Approach**:
```javascript
it('debug empty set', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  testFixture.discoverActions(scenario.actor.id);

  const trace = testFixture.getScopeTrace();
  console.log(trace);
});
```

**What to Check**:
1. **Step output sizes**: Which step produces empty set?
2. **Filter results**: Did all entities fail the filter?
3. **Component presence**: Are required components present?

### 3. Parameter Validation Error

**Symptom**: `ParameterValidationError` thrown

**Example Error**:
```
ParameterValidationError: Expected actorEntity (object with .id), got object
  Source: resolveCustomScope
  💡 Hint: Extract actorEntity from context before passing
```

**Solution**:
```javascript
// ❌ Wrong
const result = scopeEngine.resolve(ast, context, runtimeCtx);

// ✅ Correct
const actorEntity = context.actorEntity || context.actor;
const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);
```

### 4. Slow Scope Resolution

**Symptom**: Scope resolution takes too long

**Diagnostic Approach**:
```javascript
it('analyze performance bottleneck', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  testFixture.discoverActions(scenario.actor.id);

  const metrics = testFixture.getScopePerformanceMetrics();

  console.log('Resolver Timing:');
  metrics.resolverStats.forEach(stat => {
    console.log(`  ${stat.resolver}: ${stat.totalTime.toFixed(2)}ms (${stat.percentage.toFixed(1)}%)`);
  });

  console.log('\nSlowest Operations:');
  metrics.slowestOperations.steps.slice(0, 3).forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.resolver}: ${step.duration.toFixed(2)}ms`);
  });
});
```

**What to Look For**:
- Which resolver takes most time?
- Are filter evaluations slow?
- Is overhead percentage high?

## Best Practices

### When to Enable Tracing

✅ **Enable for**:
- Debugging failing tests
- Understanding complex scope behavior
- Performance analysis
- Investigating empty set issues

❌ **Don't enable for**:
- All tests by default (performance overhead)
- Production code
- Passing tests (unnecessary noise)

### Conditional Tracing Pattern

```javascript
it('test with conditional tracing', async () => {
  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  const actions = testFixture.discoverActions(scenario.actor.id);

  // Only trace if test would fail
  if (actions.length === 0) {
    testFixture.enableScopeTracing();
    testFixture.discoverActions(scenario.actor.id);
    console.log(testFixture.getScopeTrace());
  }

  expect(actions).not.toHaveLength(0);
});
```

### Performance Analysis Workflow

1. Enable tracing with performance focus
2. Run action discovery
3. Get performance metrics
4. Identify bottlenecks
5. Optimize slowest operations

```javascript
testFixture.enableScopeTracing();
// ... run operations ...
const perfTrace = testFixture.getScopeTraceWithPerformance();
console.log(perfTrace);
```
```

### 3. Create API Reference

**File**: `docs/testing/mod-test-fixture-api.md` (new)

```markdown
# ModTestFixture API Reference

Complete reference for the ModTestFixture diagnostics API.

## Scope Tracing

### Control Methods

#### `enableScopeTracing(): void`
Enable scope evaluation tracing.

**Example**:
```javascript
testFixture.enableScopeTracing();
```

#### `disableScopeTracing(): void`
Disable scope evaluation tracing.

#### `clearScopeTrace(): void`
Clear accumulated trace data.

#### `enableScopeTracingIf(condition: boolean): void`
Conditionally enable tracing.

**Parameters**:
- `condition`: Whether to enable tracing

### Data Access Methods

#### `getScopeTrace(): string`
Get formatted, human-readable trace output.

**Returns**: Formatted trace string

#### `getScopeTraceData(): object`
Get raw trace data structure.

**Returns**:
```typescript
{
  steps: Array<{
    timestamp: number,
    type: 'RESOLVER_STEP' | 'FILTER_EVALUATION',
    // ... step-specific fields
  }>,
  summary: {
    totalSteps: number,
    resolversUsed: string[],
    duration: number,
    finalOutput: { size: number, values: any[] }
  }
}
```

#### `getFilterBreakdown(entityId?: string): object | Array`
Get filter clause breakdown.

**Parameters**:
- `entityId` (optional): Filter to specific entity

**Returns** (with entityId):
```typescript
{
  entityId: string,
  result: boolean,
  hasBreakdown: boolean,
  clauses: Array<{
    operator: string,
    result: boolean,
    description: string
  }>
}
```

**Returns** (without entityId):
```typescript
Array<{
  entityId: string,
  result: boolean,
  hasBreakdown: boolean,
  clauses: Array
}>
```

### Performance Methods

#### `getScopePerformanceMetrics(): object | null`
Get detailed performance timing metrics.

**Returns**:
```typescript
{
  totalDuration: number,
  resolverStats: Array<{
    resolver: string,
    totalTime: number,
    percentage: number,
    stepCount: number,
    averageTime: number
  }>,
  filterEvaluation: {
    count: number,
    totalTime: number,
    averageTime: number,
    percentage: number
  },
  slowestOperations: {
    steps: Array<{ resolver: string, duration: number }>,
    filters: Array<{ entityId: string, duration: number }>
  },
  overhead: {
    tracingTime: number,
    percentage: number
  }
}
```

#### `getScopeTraceWithPerformance(): string`
Get formatted trace with performance focus.

**Returns**: Performance-focused trace string

## Usage Examples

### Basic Tracing
```javascript
testFixture.enableScopeTracing();
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
testFixture.discoverActions(scenario.actor.id);
console.log(testFixture.getScopeTrace());
```

### Filter Breakdown Analysis
```javascript
testFixture.enableScopeTracing();
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
testFixture.discoverActions(scenario.actor.id);

const breakdown = testFixture.getFilterBreakdown(scenario.target.id);
if (!breakdown.result) {
  console.log('Failing clauses:');
  breakdown.clauses.filter(c => !c.result).forEach(clause => {
    console.log(`  ✗ ${clause.description}`);
  });
}
```

### Performance Analysis
```javascript
testFixture.enableScopeTracing();
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
testFixture.discoverActions(scenario.actor.id);

const metrics = testFixture.getScopePerformanceMetrics();
console.log(`Total: ${metrics.totalDuration.toFixed(2)}ms`);
metrics.resolverStats.forEach(stat => {
  console.log(`  ${stat.resolver}: ${stat.totalTime.toFixed(2)}ms`);
});
```
```

## Acceptance Criteria

### Documentation Quality
- ✅ Clear explanations of each feature
- ✅ Complete API reference with types
- ✅ Practical usage examples
- ✅ Troubleshooting scenarios covered

### Content Completeness
- ✅ All new features documented
- ✅ All API methods included
- ✅ Common issues addressed
- ✅ Best practices provided

### Usability
- ✅ Easy to navigate
- ✅ Examples can be copy-pasted
- ✅ Links to related docs
- ✅ Clear section organization

### Technical Accuracy
- ✅ Code examples tested
- ✅ Type signatures accurate
- ✅ Output examples realistic
- ✅ No outdated information

## Testing Requirements

Verify all code examples in documentation by manually testing key examples in a test file to ensure they execute correctly with the actual ModTestFixture API.

## Success Metrics

- ✅ Documentation reviewed by team
- ✅ Code examples verified working
- ✅ No broken links
- ✅ Markdown properly formatted

## References

- **Spec Section**: 8. Documentation (lines 2606-2640)
- **Existing Docs**:
  - `docs/testing/mod-testing-guide.md` - Main mod testing guide
  - `docs/scopeDsl/troubleshooting.md` - ScopeDSL syntax troubleshooting (different focus)
- **Related Tickets**: All previous MODTESDIAIMP tickets
- **Key Implementation Files**:
  - `tests/common/mods/ModTestFixture.js` - Main fixture with diagnostic methods
  - `tests/common/mods/scopeEvaluationTracer.js` - Scope tracing implementation
  - `src/scopeDsl/errors/parameterValidationError.js` - Parameter validation error class
  - `src/scopeDsl/errors/scopeResolutionError.js` - Scope resolution error class

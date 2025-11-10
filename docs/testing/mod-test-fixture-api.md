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

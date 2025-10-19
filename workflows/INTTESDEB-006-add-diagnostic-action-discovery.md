# INTTESDEB-006: Add Diagnostics-Enabled Action Discovery to Test Bed

## Metadata
- **Status**: Ready for Implementation
- **Priority**: Medium (Phase 2)
- **Effort**: 0.5 days
- **Dependencies**:
  - INTTESDEB-003 (requires test bed integration helpers)
  - INTTESDEB-004 (requires TraceContext scope evaluation)
- **File Modified**: `/tests/common/actions/actionDiscoveryServiceTestBed.js`

## Problem Statement

While INTTESDEB-003 added the `discoverActionsWithDiagnostics()` method to the test bed, this ticket focuses on:
1. **Refinement** of the diagnostic discovery implementation
2. **Integration** with scope tracing from INTTESDEB-004/005
3. **Enhanced formatting** of diagnostic output
4. **Documentation** of diagnostic capabilities

This ticket represents the final integration step for diagnostic action discovery, bringing together:
- Enhanced validation (INTTESDEB-001)
- Custom matchers (INTTESDEB-002)
- Test bed helpers (INTTESDEB-003)
- Scope evaluation capture (INTTESDEB-004)
- Scope tracing helpers (INTTESDEB-005)

### Current State (from INTTESDEB-003)

The basic `discoverActionsWithDiagnostics()` method was added in INTTESDEB-003 (lines 229-264):

```javascript
discoverActionsWithDiagnostics(actor, { includeDiagnostics = false } = {}) {
  const actorId = typeof actor === 'string' ? actor : actor.id;
  const actorEntity = this.mocks.entityManager.getEntity(actorId);

  if (!actorEntity) {
    throw new Error(`Cannot discover actions: Actor '${actorId}' not found`);
  }

  // Create trace context if diagnostics requested
  const traceContext = includeDiagnostics ? new TraceContext() : null;

  // Call service
  const service = this.service || this.createStandardDiscoveryService();
  const result = service.discoverActionsForActor(actorEntity, {
    trace: traceContext,
  });

  if (includeDiagnostics) {
    return {
      actions: result.actions || result,
      diagnostics: {
        logs: traceContext.logs,
        operatorEvaluations: traceContext.getOperatorEvaluations(),
        scopeEvaluations: traceContext.getScopeEvaluations?.() || [], // Use if implemented
      },
    };
  }

  return { actions: result.actions || result };
}
```

### Enhancement Needed

Now that scope evaluation methods are available (INTTESDEB-004), this ticket enhances the diagnostic discovery:
1. **Remove conditional check** for `getScopeEvaluations()` (method now exists)
2. **Add formatting helpers** for diagnostic output
3. **Integrate scope tracing** utilities (INTTESDEB-005)
4. **Document diagnostic structure** for test authors

## Acceptance Criteria

✅ **Enhanced Diagnostic Discovery**
- Remove `?.()` conditional from `getScopeEvaluations()` call
- Always return scope evaluations when diagnostics enabled
- Ensure trace context properly passed to service

✅ **Diagnostic Formatting Helpers**
- Add `formatDiagnosticSummary()` helper method
- Format logs, operator evaluations, scope evaluations
- Provide readable output for test debugging

✅ **Scope Tracing Integration**
- Optionally use traced scope resolver from INTTESDEB-005
- Capture detailed scope resolution information
- Include scope tracing in diagnostic output

✅ **Documentation**
- Clear JSDoc comments explaining diagnostic structure
- Examples of accessing diagnostic data
- Guidance on when to use diagnostics

## Implementation Details

### File Location
`/tests/common/actions/actionDiscoveryServiceTestBed.js`

### Method to Enhance

Update existing `discoverActionsWithDiagnostics()` method:

```javascript
/**
 * Discover actions with detailed diagnostics
 *
 * @param {object|string} actor - Actor entity or ID
 * @param {object} options - Discovery options
 * @param {boolean} [options.includeDiagnostics=false] - Include trace diagnostics
 * @param {boolean} [options.traceScopeResolution=false] - Use traced scope resolver
 * @returns {object} Result with actions and optional diagnostics
 *
 * @example
 * // Basic discovery
 * const result = testBed.discoverActionsWithDiagnostics(actor);
 * expect(result.actions).toHaveLength(3);
 *
 * @example
 * // With diagnostics
 * const result = testBed.discoverActionsWithDiagnostics(actor, {
 *   includeDiagnostics: true,
 * });
 * console.log(result.diagnostics.scopeEvaluations);
 *
 * @example
 * // With scope tracing
 * const result = testBed.discoverActionsWithDiagnostics(actor, {
 *   includeDiagnostics: true,
 *   traceScopeResolution: true,
 * });
 * console.log(testBed.formatDiagnosticSummary(result.diagnostics));
 */
discoverActionsWithDiagnostics(
  actor,
  { includeDiagnostics = false, traceScopeResolution = false } = {}
) {
  const actorId = typeof actor === 'string' ? actor : actor.id;
  const actorEntity = this.mocks.entityManager.getEntity(actorId);

  if (!actorEntity) {
    throw new Error(`Cannot discover actions: Actor '${actorId}' not found`);
  }

  // Create trace context if diagnostics requested
  const traceContext = includeDiagnostics ? new TraceContext() : null;

  // Optionally use traced scope resolver
  if (traceScopeResolution && traceContext) {
    const { createTracedScopeResolver } = require('../scopeDsl/scopeTracingHelpers.js');
    this.mocks.scopeResolver = createTracedScopeResolver(
      this.mocks.scopeResolver,
      traceContext
    );
  }

  // Call service
  const service = this.service || this.createStandardDiscoveryService();
  const result = service.discoverActionsForActor(actorEntity, {
    trace: traceContext,
  });

  if (includeDiagnostics) {
    return {
      actions: result.actions || result,
      diagnostics: {
        logs: traceContext.logs,
        operatorEvaluations: traceContext.getOperatorEvaluations(),
        scopeEvaluations: traceContext.getScopeEvaluations(), // Now always available
      },
    };
  }

  return { actions: result.actions || result };
}
```

### New Helper Method

Add diagnostic formatting helper:

```javascript
/**
 * Format diagnostic output into readable summary
 *
 * @param {object} diagnostics - Diagnostics from discoverActionsWithDiagnostics
 * @returns {string} Formatted diagnostic summary
 *
 * @example
 * const result = testBed.discoverActionsWithDiagnostics(actor, {
 *   includeDiagnostics: true,
 * });
 * console.log(testBed.formatDiagnosticSummary(result.diagnostics));
 */
formatDiagnosticSummary(diagnostics) {
  const lines = ['', '=== Action Discovery Diagnostics ===', ''];

  // Trace logs summary
  lines.push(`Trace Logs: ${diagnostics.logs.length} entries`);
  const errorLogs = diagnostics.logs.filter(log => log.type === 'error');
  if (errorLogs.length > 0) {
    lines.push(`  Errors: ${errorLogs.length}`);
    errorLogs.forEach(log => {
      lines.push(`    - ${log.message}`);
    });
  }
  lines.push('');

  // Operator evaluations summary
  const opEvals = diagnostics.operatorEvaluations || [];
  lines.push(`Operator Evaluations: ${opEvals.length}`);
  if (opEvals.length > 0) {
    opEvals.forEach(op => {
      lines.push(`  - ${op.operator}: ${op.success ? '✅' : '❌'}`);
    });
  }
  lines.push('');

  // Scope evaluations summary
  const scopeEvals = diagnostics.scopeEvaluations || [];
  lines.push(`Scope Evaluations: ${scopeEvals.length}`);
  if (scopeEvals.length > 0) {
    scopeEvals.forEach(scope => {
      const resolved = scope.resolvedEntities?.length || 0;
      const candidates = scope.candidateEntities?.length || 0;
      const filtered = candidates - resolved;

      lines.push(`  - ${scope.scopeId}:`);
      lines.push(`      Candidates: ${candidates}`);
      lines.push(`      Resolved: ${resolved}`);
      if (filtered > 0) {
        lines.push(`      Filtered: ${filtered}`);
      }
    });
  }
  lines.push('');

  return lines.join('\n');
}
```

## Testing Requirements

### Unit Tests
**File**: `/tests/unit/common/actions/actionDiscoveryServiceTestBed.test.js`

1. **Enhanced discoverActionsWithDiagnostics Tests**
   - Should include scope evaluations in diagnostics
   - Should use traced scope resolver when requested
   - Should format diagnostics correctly

2. **formatDiagnosticSummary Tests**
   - Should format empty diagnostics
   - Should format logs summary
   - Should format operator evaluations
   - Should format scope evaluations
   - Should include error messages

### Integration Tests
**File**: `/tests/integration/common/actions/actionDiscoveryServiceTestBed.integration.test.js`

Test with real action discovery:
- Diagnostics include all evaluation types
- Formatted summary is readable
- Scope tracing works correctly
- Error diagnostics are helpful

## Implementation Steps

1. **Update discoverActionsWithDiagnostics**
   - Remove `?.()` conditional from getScopeEvaluations
   - Add traceScopeResolution parameter
   - Integrate traced scope resolver when requested
   - Update JSDoc comments

2. **Add formatDiagnosticSummary**
   - Implement formatting for logs
   - Implement formatting for operator evaluations
   - Implement formatting for scope evaluations
   - Add helpful summary statistics

3. **Update Required Imports**
   - Import scope tracing helpers (conditional require)
   - Ensure TraceContext is available

4. **Test Implementation**
   - Test enhanced diagnostic discovery
   - Test formatting helper
   - Verify integration with scope tracing

5. **Code Quality**
   - Run `npx eslint tests/common/actions/actionDiscoveryServiceTestBed.js`
   - Ensure JSDoc is complete
   - Verify test coverage ≥80%

## Usage Examples

### Example 1: Basic Diagnostics
```javascript
it('should provide basic diagnostics', () => {
  const testBed = createActionDiscoveryBed();
  const { actor } = testBed.createActorTargetScenario();

  const result = testBed.discoverActionsWithDiagnostics(actor, {
    includeDiagnostics: true,
  });

  expect(result.actions).toHaveLength(3);
  expect(result.diagnostics.scopeEvaluations).toHaveLength(1);

  // Format for debugging
  const summary = testBed.formatDiagnosticSummary(result.diagnostics);
  console.log(summary);
});
```

### Example 2: Scope Tracing
```javascript
it('should trace scope resolution', () => {
  const testBed = createActionDiscoveryBed();
  const { actor } = testBed.createActorTargetScenario();

  const result = testBed.discoverActionsWithDiagnostics(actor, {
    includeDiagnostics: true,
    traceScopeResolution: true, // Enable detailed scope tracing
  });

  // Scope evaluations include detailed filter information
  const scopeEval = result.diagnostics.scopeEvaluations[0];
  expect(scopeEval.candidateEntities).toContain('target1');
  expect(scopeEval.resolvedEntities).toContain('target1');
});
```

### Example 3: Formatted Output
```
=== Action Discovery Diagnostics ===

Trace Logs: 15 entries
  Errors: 0

Operator Evaluations: 3
  - ==: ✅
  - var: ✅
  - !=: ✅

Scope Evaluations: 2
  - affection:close_actors_facing_each_other:
      Candidates: 3
      Resolved: 1
      Filtered: 2
  - positioning:actors_i_can_kneel_before:
      Candidates: 2
      Resolved: 0
      Filtered: 2
```

## Benefits

### Immediate Benefits
- **Complete Diagnostics**: All evaluation types captured
- **Readable Output**: Formatted summaries for debugging
- **Scope Visibility**: Detailed scope resolution information
- **Easy Debugging**: One method provides all diagnostic data

### Integration Value
- **Combines all features**: Brings together validation, matchers, tracing
- **Test bed enhancement**: Central diagnostic capability
- **Developer productivity**: Faster debugging with clear information

## Success Metrics

- **Diagnostic Coverage**: All evaluation types included
- **Output Clarity**: Formatted summaries are immediately useful
- **Test Adoption**: Developers use diagnostics for debugging
- **Debug Speed**: Integration test failures diagnosed 3x faster

## Related Tickets

- **Requires**: INTTESDEB-003 (Test bed integration helpers)
- **Requires**: INTTESDEB-004 (TraceContext scope evaluation)
- **Uses**: INTTESDEB-005 (Scope tracing helpers - optional)
- **Works With**: INTTESDEB-002 (Custom matchers for assertions)
- **Documented In**: INTTESDEB-007, INTTESDEB-008 (Usage guides)

## References

- Spec: `/specs/integration-test-debugging-improvements-revised.spec.md` (lines 946-1005)
- Test Bed: `/tests/common/actions/actionDiscoveryServiceTestBed.js`
- Original Method: INTTESDEB-003 implementation (lines 229-264)

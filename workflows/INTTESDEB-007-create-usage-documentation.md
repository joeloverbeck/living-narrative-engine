# INTTESDEB-007: Create Usage Documentation for Testing Utilities

## Metadata
- **Status**: Ready for Implementation
- **Priority**: Low (Phase 3)
- **Effort**: 0.5 days
- **Dependencies**: All Phase 1 and Phase 2 tickets (INTTESDEB-001 through INTTESDEB-006)
- **File Created**: `/docs/testing/action-discovery-testing-toolkit.md`

## Problem Statement

After implementing all the testing improvements (INTTESDEB-001 through INTTESDEB-006), developers need comprehensive documentation to:
1. **Understand** what utilities are available
2. **Learn** how to use each utility effectively
3. **Reference** API signatures and options
4. **Troubleshoot** common testing scenarios

Without documentation, adoption will be slow and developers may not fully utilize the new capabilities.

## Acceptance Criteria

✅ **Comprehensive API Reference**
- Document the actionable test bed surface (`createActionDiscoveryBed()`, `createActorWithValidation()`, `createActorTargetScenario()`, `establishClosenessWithValidation()`, `discoverActionsWithDiagnostics()`, `formatDiagnosticSummary()`, lifecycle helpers, etc.)
- Document the existing custom Jest matchers (`toHaveAction`, `toDiscoverActionCount`)
- Document scope tracing helpers (`createTracedScopeResolver`, `formatScopeEvaluationSummary`, `traceScopeEvaluation`)
- Include parameter descriptions and return types

✅ **Usage Examples**
- Basic usage patterns for each utility
- Common testing scenarios
- Integration examples combining multiple utilities
- Real-world test case examples

✅ **Troubleshooting Guide**
- Common error scenarios and solutions
- Diagnostic interpretation guide
- When to use which utility
- Performance considerations

✅ **Quick Start Guide**
- Minimum setup for new tests
- Recommended patterns
- Best practices
- Migration tips from old patterns

## Implementation Details

### File Location
`/docs/testing/action-discovery-testing-toolkit.md` (new file)

### Document Structure

```markdown
# Action Discovery Testing Toolkit

Comprehensive guide to the action discovery integration testing utilities.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Enhanced Test Bed Methods](#enhanced-test-bed-methods)
4. [Custom Jest Matchers](#custom-jest-matchers)
5. [Scope Tracing Utilities](#scope-tracing-utilities)
6. [Diagnostic Discovery](#diagnostic-discovery)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)
9. [API Reference](#api-reference)

## Overview

### What This Guide Covers

This guide documents the integration test debugging improvements implemented to reduce debugging time from 2-4 hours to 15-30 minutes through:

- **Enhanced validation** (INTTESDEB-001): Catch entity structure bugs during setup
- **Custom matchers** (INTTESDEB-002): Detailed error messages for assertions
- **Test bed helpers** (INTTESDEB-003): One-line scenario setup
- **Scope tracing** (INTTESDEB-004, 005): Visibility into scope resolution
- **Diagnostic discovery** (INTTESDEB-006): Complete debugging information

### Benefits

- ✅ Entity structure bugs caught immediately
- ✅ Clear, actionable error messages
- ✅ 50-70% less setup code per test
- ✅ Complete visibility into action discovery pipeline
- ✅ Reduced debugging time

## Quick Start

### Minimum Setup

```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js'; // Auto-extends Jest

describe('My Action Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('should discover action for target', async () => {
    // One-line scenario setup
    const { actor, target } = testBed.createActorTargetScenario();

    // Discovery with diagnostics
    const result = await testBed.discoverActionsWithDiagnostics(actor);

    // Custom matcher with detailed errors
    expect(result).toHaveAction('my:action');
  });
});
```

### Recommended Pattern

For complex tests with debugging needs:

```javascript
it('should handle complex scenario', async () => {
  // Setup with validation
  const { actor, target } = testBed.createActorTargetScenario({
    actorComponents: { /* ... */ },
    targetComponents: { /* ... */ },
  });

  // Discover with diagnostics
  const result = await testBed.discoverActionsWithDiagnostics(actor, {
    includeDiagnostics: true,
    traceScopeResolution: true,
  });

  // Use custom matchers
  expect(result).toHaveAction('my:action');

  // Debug if needed
  if (result.actions.length === 0) {
    console.log(testBed.formatDiagnosticSummary(result.diagnostics));
  }
});
```

## Enhanced Test Bed Methods

### createActorWithValidation

Create actor entity with automatic structure validation.

**Signature:**
```javascript
createActorWithValidation(actorId, options)
```

**Parameters:**
- `actorId` (string): Entity ID for the actor
- `options.components` (object): Component data to add
- `options.location` (string): Location ID (default: 'test-location')

**Returns:** Validated actor entity

**Example:**
```javascript
const actor = testBed.createActorWithValidation('actor1', {
  components: {
    'core:name': { name: 'Alice' },
    'positioning:standing': {},
  },
  location: 'tavern',
});
```

Also include coverage for:
- `createDiscoveryServiceWithTracing(options)` – how to override defaults for advanced scenarios.
- `createStandardDiscoveryService()` – when to drop down to the raw service.
- `createMockActor(actorId)` and `createMockContext()` – lightweight helpers for unit-style tests.
- `establishClosenessWithValidation(actor, target)` – ensuring proximity relationships are correctly wired.
- `createActorTargetScenario(config)` – the higher-level helper described above.
- `cleanup()` – resetting mocks/log capture between tests.

## Custom Jest Matchers

Document only the matchers that actually exist in `/tests/common/actionMatchers.js`. The current surface area provides two helpers that operate on either an array of actions or the `{ actions }` object returned from `discoverActionsWithDiagnostics()`.

### toHaveAction

Assert that a specific action was discovered.

**Signature:**
```javascript
expect(result).toHaveAction(actionId)
```

**Parameters:**
- `actionId` (string): Expected action ID (e.g., `'affection:place_hands_on_shoulders'`)

**Success:** Action with the provided ID exists in the discovery results.

**Failure Messaging:** Summarizes available actions, highlights likely pipeline stages that filtered the action, and suggests next debugging steps.

**Example:**
```javascript
const result = await testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
});

expect(result).toHaveAction('affection:place_hands_on_shoulders');
```

### toDiscoverActionCount

Assert that the number of discovered actions matches expectations.

**Signature:**
```javascript
expect(result).toDiscoverActionCount(expectedCount)
```

**Parameters:**
- `expectedCount` (number): The expected number of discovered actions.

**Success:** Actual discovery count equals `expectedCount`.

**Failure Messaging:** Explains whether the pipeline returned more or fewer actions than expected, lists the discovered action IDs, and suggests targeted debugging steps (checking prerequisites, closeness, or scope configuration).

**Example:**
```javascript
const result = await testBed.discoverActionsWithDiagnostics(actor);
expect(result).toDiscoverActionCount(3);
```

> ℹ️ There is currently **no** `toHaveActionForTarget` implementation. If per-target assertions are needed, note the gap in the troubleshooting section and provide manual example code for inspecting `result.actions`.

## Scope Tracing Utilities

Describe the helpers implemented in `/tests/common/scopeDsl/scopeTracingHelpers.js` and how they augment `TraceContext` diagnostics:

- `createTracedScopeResolver(scopeResolver, traceContext)` – wraps an existing resolver instance, capturing each `resolve()` call and forwarding success/error information to the provided trace context.
- `formatScopeEvaluationSummary(traceContext)` – produces a readable multi-line summary from the evaluations captured inside a `TraceContext`.
- `traceScopeEvaluation({ scopeId, actor, scopeResolver, context })` – one-shot helper that creates a traced resolver, executes the evaluation, and returns `{ success, resolvedEntities, trace, summary }`.

Highlight that these utilities depend on the production `TraceContext` class from `src/actions/tracing/traceContext.js`, so examples should import that type indirectly via the helpers rather than re-implementing tracing logic.

## Diagnostic Discovery

Cover the enhanced discovery surface exposed by `ActionDiscoveryServiceTestBed`:

- `discoverActionsWithDiagnostics(actor, { includeDiagnostics, traceScopeResolution })` – explain the options, the shape of the returned `{ actions, diagnostics? }` object, and how trace integration swaps in `createTracedScopeResolver()` when both diagnostics and tracing are requested.
- `formatDiagnosticSummary(diagnostics)` – detail how it aggregates logs, operator evaluations, and scope evaluations, including expectations about the structure of `diagnostics` (e.g., `logs`, `operatorEvaluations`, `scopeEvaluations`).
- Accessor helpers such as `getDebugLogs()`, `getInfoLogs()`, `getWarningLogs()`, `getErrorLogs()`, and `getCreatedTraceType()` that tests can use for fine-grained assertions when diagnosing failures.

Provide runnable snippets that demonstrate capturing the diagnostics payload, piping it through `formatDiagnosticSummary()`, and writing targeted assertions when actions are filtered.

## Common Patterns

### Pattern 1: Basic Action Discovery Test

Walk through a minimal integration test that:
- Creates a bed via `createActionDiscoveryBed()` in `beforeEach`
- Calls `createActorTargetScenario()` for setup
- Invokes `discoverActionsWithDiagnostics()`
- Uses `toHaveAction()` to assert discovery success

### Pattern 2: Testing Action Restrictions

Show how to override components when calling `createActorWithValidation()` or the scenario helper to trigger failure cases, then assert with `toDiscoverActionCount()` and inspect diagnostics to confirm the filtering stage.

### Pattern 3: Debugging Scope Issues

Demonstrate enabling `{ includeDiagnostics: true, traceScopeResolution: true }`, wrapping the resolver via tracing helpers, and printing `formatScopeEvaluationSummary()` so readers can interpret scope results.

### Pattern 4: Testing Multiple Scenarios

Provide guidance on reusing the bed across tests, leveraging `cleanup()` in `afterEach`, and parameterizing calls to `createActorTargetScenario()` to cover variations without duplicating boilerplate.

## Troubleshooting

### Entity Double-Nesting Errors

**Symptom:**
```
❌ ENTITY DOUBLE-NESTING DETECTED!
entity.id should be STRING but is object
```

**Cause:** Passing entity object instead of string ID

**Solution:**
```javascript
// ❌ Wrong
builder.closeToEntity(targetEntity)

// ✅ Correct
builder.closeToEntity(targetEntity.id)
```

### Action Not Discovered

**Symptom:** Custom matcher shows action not discovered

**Debugging Steps:**
1. Use `discoverActionsWithDiagnostics({ includeDiagnostics: true })`
2. Check diagnostic logs for pipeline stage that filtered action
3. Verify actor has required components
4. Check scope resolution results

**Example:**
```javascript
const result = testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
});

console.log(testBed.formatDiagnosticSummary(result.diagnostics));
```

### Action Discovered for Unexpected Target

**Symptom:** Discovery succeeds, but the action is associated with the wrong entity.

**Debugging Steps:**
1. Manually inspect `result.actions` because there is no `toHaveActionForTarget` matcher yet.
2. Use `Array.prototype.find()` to locate the action and assert against `action.targets` (if present).
3. Enable `traceScopeResolution` to confirm which scope produced the target set.

**Example:**
```javascript
const result = await testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
  traceScopeResolution: true,
});

const action = result.actions.find((a) => a.id === 'affection:place_hands_on_shoulders');
expect(action?.targets).toContain('target1');
```

Also cover other recurring issues such as scope resolution failures (with sample resolver error output) and prerequisite evaluation exceptions so readers can map diagnostics back to pipeline stages.

## API Reference

### ActionDiscoveryServiceTestBed

Complete reference of test bed methods.

[Full API documentation...]

### Custom Matchers

Complete reference of Jest matchers.

[Full matcher documentation...]

### Scope Tracing Helpers

Complete reference of scope utilities.

[Full helper documentation...]
```

## Testing Requirements

This ticket focuses on documentation, but documentation quality should be verified:

### Documentation Review Checklist
- [ ] All methods documented with signatures
- [ ] All parameters explained with types
- [ ] Return values documented
- [ ] Examples provided for each method
- [ ] Common patterns documented
- [ ] Troubleshooting covers real scenarios
- [ ] Links to implementation tickets
- [ ] Code examples are correct and tested

### Example Validation
- Run all code examples to verify they work
- Ensure examples use latest API
- Verify troubleshooting steps are accurate

## Implementation Steps

1. **Create Document Structure**
   - Create `/docs/testing/action-discovery-testing-toolkit.md`
   - Add table of contents
   - Create section structure

2. **Write Overview and Quick Start**
   - Explain what utilities do
   - Provide minimum viable example
   - Show recommended patterns

3. **Document Each Utility Category**
   - Test bed methods (from INTTESDEB-003)
   - Custom matchers (from INTTESDEB-002)
   - Scope tracing (from INTTESDEB-005)
   - Diagnostics (from INTTESDEB-006)
   - Cross-reference existing content in `docs/testing/mod-testing-guide.md` to avoid repeating builder-pattern guidance; link out where overlap exists.

4. **Add Common Patterns**
   - Basic discovery test
   - Action restrictions test
   - Scope debugging
   - Multiple scenarios

5. **Write Troubleshooting Section**
   - Entity double-nesting
   - Action not discovered
   - Scope resolution issues
   - Component validation errors

6. **Create API Reference**
   - Complete method signatures
   - Parameter descriptions
   - Return types
   - Usage notes

7. **Review and Polish**
   - Verify all examples work
   - Check for clarity
   - Add cross-references
   - Proofread
   - Update `docs/testing/mod-testing-guide.md` (or other relevant testing docs) to point to the new debugging guide instead of duplicating material.

## Success Metrics

- **Completeness**: All utilities documented
- **Clarity**: Examples are clear and runnable
- **Usefulness**: Troubleshooting covers real scenarios
- **Adoption**: Developers reference documentation when writing tests

## Related Tickets

- **Documents**: INTTESDEB-001 through INTTESDEB-006 (all implementation)
- **Complements**: INTTESDEB-008 (Migration guide for existing tests)
- **References**: INTTESDEB-009 (Project docs link to this guide)

## References

- Spec: `/specs/integration-test-debugging-improvements-revised.spec.md` (lines 1016-1041)
- All implementation tickets: INTTESDEB-001 through INTTESDEB-006

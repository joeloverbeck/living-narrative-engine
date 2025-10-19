# INTTESDEB-007: Create Usage Documentation for Testing Utilities

## Metadata
- **Status**: Ready for Implementation
- **Priority**: Low (Phase 3)
- **Effort**: 0.5 days
- **Dependencies**: All Phase 1 and Phase 2 tickets (INTTESDEB-001 through INTTESDEB-006)
- **File Created**: `/docs/testing/action-integration-debugging.md`

## Problem Statement

After implementing all the testing improvements (INTTESDEB-001 through INTTESDEB-006), developers need comprehensive documentation to:
1. **Understand** what utilities are available
2. **Learn** how to use each utility effectively
3. **Reference** API signatures and options
4. **Troubleshoot** common testing scenarios

Without documentation, adoption will be slow and developers may not fully utilize the new capabilities.

## Acceptance Criteria

✅ **Comprehensive API Reference**
- Document all enhanced test bed methods
- Document all custom Jest matchers
- Document scope tracing helpers
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
`/docs/testing/action-integration-debugging.md` (new file)

### Document Structure

```markdown
# Action Integration Testing Debugging Guide

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

  it('should discover action for target', () => {
    // One-line scenario setup
    const { actor, target } = testBed.createActorTargetScenario();

    // Discovery with diagnostics
    const result = testBed.discoverActionsWithDiagnostics(actor);

    // Custom matcher with detailed errors
    expect(result).toHaveActionForTarget('my:action', 'target1');
  });
});
```

### Recommended Pattern

For complex tests with debugging needs:

```javascript
it('should handle complex scenario', () => {
  // Setup with validation
  const { actor, target } = testBed.createActorTargetScenario({
    actorComponents: { /* ... */ },
    targetComponents: { /* ... */ },
  });

  // Discover with diagnostics
  const result = testBed.discoverActionsWithDiagnostics(actor, {
    includeDiagnostics: true,
    traceScopeResolution: true,
  });

  // Use custom matchers
  expect(result).toHaveActionForTarget('my:action', 'target1');

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

[Continue with all other methods...]

## Custom Jest Matchers

### toHaveActionForTarget

Assert that a specific action was discovered for a specific target.

**Signature:**
```javascript
expect(result).toHaveActionForTarget(actionId, targetId)
```

**Parameters:**
- `actionId` (string): Expected action ID
- `targetId` (string): Expected target ID

**Success:** Action with exact target was discovered

**Failure Messages:**
- Action not discovered: Shows possible reasons and debugging steps
- Action found with wrong target: Shows actual targets and scope debugging

**Example:**
```javascript
const result = testBed.discoverActionsWithDiagnostics(actor);
expect(result).toHaveActionForTarget('affection:place_hands_on_shoulders', 'target1');
```

[Continue with all matchers...]

## Scope Tracing Utilities

[Document scope tracing helpers...]

## Diagnostic Discovery

[Document diagnostic capabilities...]

## Common Patterns

### Pattern 1: Basic Action Discovery Test

[Example...]

### Pattern 2: Testing Action Restrictions

[Example...]

### Pattern 3: Debugging Scope Issues

[Example...]

### Pattern 4: Testing Multiple Scenarios

[Example...]

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

[Continue with other scenarios...]

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
   - Create `/docs/testing/action-integration-debugging.md`
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

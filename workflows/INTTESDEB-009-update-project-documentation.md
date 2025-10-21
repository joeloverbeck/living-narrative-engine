# INTTESDEB-009: Update Project Documentation with Testing Improvements

## Metadata
- **Status**: Ready for Implementation
- **Priority**: Low (Phase 3)
- **Effort**: 0.5 days
- **Dependencies**:
  - INTTESDEB-007 (Usage documentation must exist)
  - INTTESDEB-008 (Migration guide must exist)
- **Files Modified**:
  - `/README.md`
  - `/tests/README.md` (if exists, otherwise create)
  - `/CLAUDE.md`

## Problem Statement

After implementing all testing improvements and creating documentation, project-level docs need updates to:
1. **Link to new testing docs** from main README
2. **Update testing section** with new capabilities
3. **Document for AI assistant** in CLAUDE.md
4. **Create/update tests README** with utility references

Without these updates, developers may not discover the new testing utilities.

## Acceptance Criteria

✅ **README.md Updates**
- Add "Testing Improvements" section
- Link to usage documentation
- Link to migration guide
- Briefly describe benefits

✅ **tests/README.md Creation/Update**
- Overview of testing utilities
- Quick reference for test bed methods
- Quick reference for custom matchers
- Quick reference for scope tracing
- Links to detailed documentation

✅ **CLAUDE.md Updates**
- Document testing utilities for AI assistant
- Include usage patterns
- Reference implementation tickets
- Guide AI to use new patterns for tests

✅ **Documentation Cross-Links**
- Ensure all docs link to each other appropriately
- Create consistent navigation
- Update any outdated testing guidance

## Implementation Details

### File 1: `/README.md`

Add new section after existing testing section:

```markdown
## Testing Improvements (2025-01)

The project includes comprehensive integration test debugging utilities that reduce average debugging time from 2-4 hours to 15-30 minutes:

### Key Features

- **Enhanced Validation**: Entity structure bugs caught during test setup
- **Custom Jest Matchers**: Detailed, actionable error messages for assertions
- **Test Bed Helpers**: One-line scenario setup with automatic validation
- **Scope Tracing**: Complete visibility into scope resolution process
- **Diagnostic Discovery**: Full debugging information for action pipeline

### Documentation

- **[Usage Guide](/docs/testing/action-discovery-testing-toolkit.md)**: Complete reference for all testing utilities
- **[Migration Guide](/docs/testing/action-integration-test-migration.md)**: Step-by-step guide for updating existing tests
- **[Tests README](/tests/README.md)**: Quick reference for test utilities

### Quick Example

```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

describe('My Action Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('should discover action', () => {
    const { actor, target } = testBed.createActorTargetScenario();
    const result = testBed.discoverActionsWithDiagnostics(actor);

    expect(result).toHaveActionForTarget('my:action', 'target1');
  });
});
```

### Benefits

- ✅ 50-70% less test setup code
- ✅ Entity structure bugs caught immediately
- ✅ Clear error messages with debugging steps
- ✅ Complete diagnostic capabilities
```

### File 2: `/tests/README.md`

Create comprehensive testing documentation:

```markdown
# Living Narrative Engine Testing Guide

Comprehensive guide to testing in the Living Narrative Engine project.

## Table of Contents

1. [Overview](#overview)
2. [Test Organization](#test-organization)
3. [Testing Utilities](#testing-utilities)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [Resources](#resources)

## Overview

The project uses Jest for all testing with the following structure:
- **Unit Tests**: `/tests/unit/` (mirror source structure)
- **Integration Tests**: `/tests/integration/`
- **E2E Tests**: `/tests/e2e/`
- **Performance Tests**: `/tests/performance/`
- **Memory Tests**: `/tests/memory/`

**Test Coverage Requirements**: 80% branches, 90% functions/lines

## Test Organization

```
tests/
├── common/                    # Shared test utilities
│   ├── actions/              # Action discovery test bed
│   │   └── actionDiscoveryServiceTestBed.js
│   ├── mods/                 # Mod entity builder
│   │   └── ModEntityBuilder.js
│   ├── scopeDsl/             # Scope tracing helpers
│   │   └── scopeTracingHelpers.js
│   ├── actionMatchers.js     # Custom Jest matchers
│   └── testBed.js            # Base test bed
├── unit/                     # Unit tests (mirror src/)
├── integration/              # Integration tests
└── e2e/                      # End-to-end tests
```

## Testing Utilities

### Action Discovery Test Bed

**Location**: `/tests/common/actions/actionDiscoveryServiceTestBed.js`

Comprehensive test bed for action discovery integration tests with:
- One-line scenario setup
- Automatic entity validation
- Diagnostic discovery capabilities
- Scope tracing integration

**Quick Reference**:
```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';

const testBed = createActionDiscoveryBed();

// Create scenario
const { actor, target } = testBed.createActorTargetScenario({
  actorComponents: { /* ... */ },
  targetComponents: { /* ... */ },
  closeProximity: true,
});

// Create individual actor
const actor = testBed.createActorWithValidation('actor1', {
  components: { /* ... */ },
  location: 'tavern',
});

// Establish relationship
testBed.establishClosenessWithValidation(actor, target);

// Discover with diagnostics
const result = testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
  traceScopeResolution: true,
});

// Format diagnostics
const summary = testBed.formatDiagnosticSummary(result.diagnostics);
```

### Custom Jest Matchers

**Location**: `/tests/common/actionMatchers.js`

Domain-specific matchers for action discovery with detailed error messages.

**Quick Reference**:
```javascript
import '../../common/actionMatchers.js'; // Auto-extends Jest

// Assert specific action with specific target
expect(result).toHaveActionForTarget('my:action', 'target1');

// Assert action count
expect(result).toDiscoverActionCount(3);

// Assert action discovered (any target)
expect(result).toHaveAction('my:action');
```

### Scope Tracing Helpers

**Location**: `/tests/common/scopeDsl/scopeTracingHelpers.js`

Utilities for tracing and debugging scope resolution.

**Quick Reference**:
```javascript
import {
  createTracedScopeResolver,
  formatScopeEvaluationSummary,
  traceScopeEvaluation,
} from '../../common/scopeDsl/scopeTracingHelpers.js';

// Wrap scope resolver with tracing
const tracedResolver = createTracedScopeResolver(scopeResolver, traceContext);

// One-line scope evaluation
const result = traceScopeEvaluation({
  scopeId: 'my:scope',
  actor,
  scopeResolver,
});

// Format evaluation summary
const summary = formatScopeEvaluationSummary(traceContext);
```

### Mod Entity Builder

**Location**: `/tests/common/mods/ModEntityBuilder.js`

Fluent API for building test entities with automatic validation.

**Quick Reference**:
```javascript
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

const entity = new ModEntityBuilder('entity-id')
  .asActor()
  .withName('Entity Name')
  .atLocation('location-id')
  .closeToEntity('target-id')
  .kneelingBefore('target-id')
  .facing('toward', 'target-id')
  .validate()  // Catches structure bugs
  .build();
```

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Single test file
npm run test:unit -- path/to/test.js

# With coverage
npm run test:unit -- --coverage

# Watch mode
npm run test:unit -- --watch
```

## Writing Tests

### Recommended Pattern for Integration Tests

```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

describe('My Feature', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('should handle scenario', () => {
    // Setup
    const { actor, target } = testBed.createActorTargetScenario({
      actorComponents: { /* ... */ },
      targetComponents: { /* ... */ },
    });

    // Execute
    const result = testBed.discoverActionsWithDiagnostics(actor);

    // Assert
    expect(result).toHaveActionForTarget('my:action', 'target1');
  });
});
```

### Best Practices

1. **Always use validation**: Call `.validate()` on ModEntityBuilder
2. **Use custom matchers**: Better error messages than generic assertions
3. **Enable diagnostics for complex tests**: Helps with debugging
4. **Keep tests focused**: One assertion per test when possible
5. **Use test bed helpers**: Reduces code duplication

## Resources

### Detailed Documentation

- **[Action Discovery Testing Toolkit](/docs/testing/action-discovery-testing-toolkit.md)**
  - Complete API reference
  - Usage examples
  - Troubleshooting guide
  - Common patterns

- **[Migration Guide](/docs/testing/action-integration-test-migration.md)**
  - Step-by-step migration from old patterns
  - Before/after examples
  - Common pitfalls

### Implementation References

Testing utilities were implemented in January 2025 through tickets INTTESDEB-001 through INTTESDEB-010:
- INTTESDEB-001: Enhanced ModEntityBuilder validation
- INTTESDEB-002: Custom Jest matchers
- INTTESDEB-003: Test bed integration helpers
- INTTESDEB-004: TraceContext scope evaluation
- INTTESDEB-005: Scope tracing helpers
- INTTESDEB-006: Diagnostic action discovery
- INTTESDEB-007: Usage documentation
- INTTESDEB-008: Migration guide
- INTTESDEB-009: Project documentation updates
- INTTESDEB-010: Optional test migration

### Getting Help

- Check [troubleshooting guide](/docs/testing/action-discovery-testing-toolkit.md#troubleshooting)
- Review [migration guide](/docs/testing/action-integration-test-migration.md) for examples
- Inspect diagnostic output when tests fail
- Use scope tracing for scope resolution issues
```

### File 3: `/CLAUDE.md`

Add testing utilities section:

```markdown
## 🧪 Testing Improvements (January 2025)

### Integration Test Debugging Utilities

The project includes comprehensive utilities for action discovery integration testing that significantly improve debugging experience.

**Key Utilities:**

1. **ActionDiscoveryServiceTestBed** (`/tests/common/actions/actionDiscoveryServiceTestBed.js`)
   - One-line scenario setup with `createActorTargetScenario()`
   - Automatic entity validation with `createActorWithValidation()`
   - Diagnostic discovery with `discoverActionsWithDiagnostics()`
   - Relationship helpers with `establishClosenessWithValidation()`

2. **Custom Jest Matchers** (`/tests/common/actionMatchers.js`)
   - `toHaveActionForTarget(actionId, targetId)` - Detailed error messages
   - `toDiscoverActionCount(count)` - Action count assertions
   - `toHaveAction(actionId)` - Action discovery assertions

3. **Scope Tracing Helpers** (`/tests/common/scopeDsl/scopeTracingHelpers.js`)
   - `createTracedScopeResolver()` - Wrap resolver with tracing
   - `formatScopeEvaluationSummary()` - Format evaluation results
   - `traceScopeEvaluation()` - One-line scope tracing

4. **Enhanced ModEntityBuilder** (`/tests/common/mods/ModEntityBuilder.js`)
   - Automatic validation with `.validate()`
   - Catches entity double-nesting bugs
   - Provides detailed error messages with fix suggestions

### When Writing Tests

**For action discovery integration tests, use this pattern:**

```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

describe('Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('should discover action', () => {
    const { actor, target } = testBed.createActorTargetScenario({
      actorComponents: { /* ... */ },
      targetComponents: { /* ... */ },
    });

    const result = testBed.discoverActionsWithDiagnostics(actor);

    expect(result).toHaveActionForTarget('my:action', 'target1');
  });
});
```

**Benefits:**
- ✅ 50-70% less code than manual setup
- ✅ Entity validation catches bugs immediately
- ✅ Detailed error messages with debugging steps
- ✅ Complete diagnostic capabilities

### Documentation

- **[Usage Guide](/docs/testing/action-discovery-testing-toolkit.md)**: Complete API reference
- **[Migration Guide](/docs/testing/action-integration-test-migration.md)**: Converting existing tests
- **[Tests README](/tests/README.md)**: Quick reference

### For AI Code Generation

When generating action discovery integration tests:
1. Use `createActionDiscoveryBed()` from test bed
2. Use `createActorTargetScenario()` for setup
3. Use custom matchers (`toHaveActionForTarget`, etc.)
4. Call `.validate()` on any manually created entities
5. Enable diagnostics for complex scenarios
6. Reference existing tests for patterns

**Implementation Tickets**: INTTESDEB-001 through INTTESDEB-010
```

## Testing Requirements

### Documentation Verification
- All links work correctly
- Code examples are accurate
- Cross-references are consistent
- No broken markdown

### Manual Review
- README changes are appropriate
- tests/README.md is comprehensive
- CLAUDE.md accurately guides AI
- Documentation is discoverable

## Implementation Steps

1. **Update README.md**
   - Add Testing Improvements section
   - Include quick example
   - Link to detailed docs

2. **Create/Update tests/README.md**
   - Create file if doesn't exist
   - Document all utilities
   - Provide quick references
   - Link to detailed guides

3. **Update CLAUDE.md**
   - Add testing utilities section
   - Include AI guidance
   - Reference implementation tickets

4. **Verify Cross-Links**
   - Ensure all docs link correctly
   - Check navigation flow
   - Verify no broken links

5. **Review Documentation**
   - Verify clarity
   - Check consistency
   - Test code examples
   - Proofread

## Success Metrics

- **Discoverability**: Developers can find documentation from main README
- **Completeness**: All utilities documented at project level
- **AI Guidance**: Claude Code uses new patterns when generating tests
- **Navigation**: Clear path from overview to detailed docs

## Related Tickets

- **Requires**: INTTESDEB-007 (Usage documentation)
- **Requires**: INTTESDEB-008 (Migration guide)
- **Documents**: All implementation tickets (INTTESDEB-001 through INTTESDEB-006)
- **Referenced By**: INTTESDEB-010 (Developers find docs when migrating)

## References

- Spec: `/specs/integration-test-debugging-improvements-revised.spec.md` (lines 1016-1041)
- Project README: `/README.md`
- Project context: `/CLAUDE.md`
- Implementation tickets: INTTESDEB-001 through INTTESDEB-008

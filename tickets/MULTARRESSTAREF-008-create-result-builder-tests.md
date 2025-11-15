# MULTARRESSTAREF-008: Create Result Builder Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1 day
**Phase:** 2 - Result Assembly Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create comprehensive unit tests for `TargetResolutionResultBuilder` (see `src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js`) to ensure all constructor validation, metadata attachment, and PipelineResult assembly behaviors are locked down before further refactors.

## Background

`TargetResolutionResultBuilder` now owns the entire result-assembly surface for the multi-target resolution stage, including dependency validation, metadata hydration (via `attachMetadata` → `#hydrateEntities`), and fallback handling for legacy target definitions. Tests must reflect the current implementation so regressions are caught before integrating the builder elsewhere.

## Technical Requirements

### File to Create
- **Path:** `tests/unit/actions/pipeline/services/implementations/TargetResolutionResultBuilder.test.js`
- **Existing code reference:** `src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js`

### Test Coverage Requirements

**Target Coverage:** 90%+ (branches, functions, lines)

### Test Suites

#### 1. Constructor and Initialization
```javascript
describe('TargetResolutionResultBuilder - Constructor', () => {
  it('should validate entityManager dependency', () => {});
  it('should validate logger dependency', () => {});
  it('should throw if entityManager is missing getEntityInstance', () => {});
  it('should initialize with valid dependencies', () => {});
});
```

#### 2. Legacy Result Building
```javascript
describe('buildLegacyResult', () => {
  it('should build result with resolved targets', () => {});
  it('should include legacy conversion metadata or fallback definitions when missing', () => {});
  it('should attach action definition fields via attachMetadata', () => {});
  it('should include targetContexts for backward compatibility', () => {});
  it('should call attachMetadata with isMultiTarget=false', () => {});
  it('should handle empty resolved targets', () => {});
  it('should return a PipelineResult.success payload containing actionsWithTargets', () => {});
});
```

#### 3. Multi-Target Result Building
```javascript
describe('buildMultiTargetResult', () => {
  it('should build result with resolved targets', () => {});
  it('should include detailed resolution results (default empty object)', () => {});
  it('should attach target definitions', () => {});
  it('should attach metadata with isMultiTarget=true', () => {});
  it('should mutate action definitions with resolved targets and target definitions', () => {});
  it('should handle multiple target types and preserve contexts', () => {});
});
```

#### 4. Final Result Assembly
```javascript
describe('buildFinalResult', () => {
  it('should aggregate all actionsWithTargets', () => {});
  it('should include targetContexts when provided', () => {});
  it('should include last resolved targets and definitions only when both supplied', () => {});
  it('should pass errors through PipelineResult.success', () => {});
  it('should handle empty action arrays gracefully', () => {});
});
```

#### 5. Metadata Attachment and Hydration
```javascript
describe('attachMetadata', () => {
  it('should mark legacy format correctly', () => {});
  it('should mark multi-target format correctly', () => {});
  it('should hydrate resolved target entities using entityManager.getEntityInstance', () => {});
  it('should gracefully warn when provided an invalid action payload', () => {});
  it('should handle zero targets by leaving resolvedTargets empty', () => {});
});
```

#### 6. Backward Compatibility & Result Shape
```javascript
describe('Result shape expectations', () => {
  it('should expose actionsWithTargets entries with targetContexts', () => {});
  it('should surface resolvedTargets and targetDefinitions on the top-level data payload when available', () => {});
  it('should remain idempotent for identical inputs', () => {});
});
```

> Note: Downstream expectations referenced in the overview are satisfied by asserting the presence of `actionsWithTargets`, `targetContexts`, `resolvedTargets`, and `targetDefinitions` fields that the existing stages consume. Additional downstream stage unit tests already verify their own schemas, so we do **not** re-implement their assertions here.

### Mock Helper Utilities

```javascript
function createMockContext(overrides = {}) {
  return {
    actor: { id: 'actor-1', name: 'Test Actor' },
    trace: {},
    data: { stage: 'multi-target-resolution' },
    ...overrides,
  };
}

function createMockActionDef(overrides = {}) {
  return {
    id: 'test:action',
    name: 'Test Action',
    targets: {
      primary: { scope: 'test_scope' },
    },
    ...overrides,
  };
}

function createMockResolvedTargets() {
  return {
    primary: [
      { id: 'target-1' },
      { id: 'target-2', entity: { id: 'target-2', name: 'Target 2' } },
    ],
    secondary: [],
  };
}

function createMockTargetContexts() {
  return [
    { targetKey: 'primary', candidates: ['target-1', 'target-2'] },
  ];
}

function createMockEntityManager() {
  return {
    getEntityInstance: jest.fn((id) => ({ id, name: `Entity ${id}` })),
  };
}

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}
```

### Critical Test Cases

**Test result structure matches:**
```javascript
it('should produce result matching downstream stage expectations', () => {
  const result = builder.buildFinalResult(/*...*/);

  expect(result.success).toBe(true);
  expect(result.data).toHaveProperty('actionsWithTargets');
  expect(Array.isArray(result.data.actionsWithTargets)).toBe(true);
  expect(result.data.actionsWithTargets[0]).toHaveProperty('resolvedTargets');
});
```

**Test backward compatibility fields:**
```javascript
it('should include backward compatibility fields when last resolved payload provided', () => {
  const result = builder.buildFinalResult(/*...*/);

  expect(result.data).toHaveProperty('targetContexts');
  expect(result.data).toHaveProperty('resolvedTargets');
  expect(result.data).toHaveProperty('targetDefinitions');
});
```

## Acceptance Criteria

- [ ] Test file created at specified path
- [ ] All 6 targeted test suites implemented
- [ ] Coverage meets 90%+ target (branches, functions, lines)
- [ ] All edge cases covered (empty inputs, missing fields, etc.)
- [ ] Mock utilities created for all dependencies (context, action def, resolved targets, target contexts, entity manager, logger)
- [ ] Backward compatibility tests verify downstream stage expectations by asserting result payload fields
- [ ] Result format consistency tests ensure idempotent behavior for identical inputs
- [ ] Tests follow project testing patterns (AAA pattern, descriptive names)
- [ ] All tests pass with `npm run test:unit`

## Dependencies

- **MULTARRESSTAREF-007** - Implementation must exist before testing

## Validation Commands

```bash
npm run test:unit -- tests/unit/actions/pipeline/services/implementations/TargetResolutionResultBuilder.test.js
```

## Notes

- **Critical:** Result format must exactly match existing implementation
- Test with data from real action resolution scenarios
- Verify downstream stages work with new results (integration tests)
- Backward compatibility is the highest priority
- Consider snapshot testing for complex result structures
- Test both legacy and multi-target paths thoroughly

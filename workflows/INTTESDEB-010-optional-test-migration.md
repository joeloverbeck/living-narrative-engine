# INTTESDEB-010: Optional Migration of Existing Integration Tests

## Metadata
- **Status**: Ready for Implementation
- **Priority**: Low (Phase 4 - Optional)
- **Effort**: Variable (depends on test count)
- **Dependencies**:
  - INTTESDEB-007 (Usage documentation must exist)
  - INTTESDEB-008 (Migration guide must exist)
  - INTTESDEB-009 (Project documentation must be updated)
- **Files Modified**: Various integration test files (as needed)

## Problem Statement

After implementing all testing improvements and documentation (INTTESDEB-001 through INTTESDEB-009), existing integration tests can optionally be migrated to use the new patterns. However:
1. **Migration is optional** - old patterns still work and are supported
2. **Migration should be incremental** - done gradually, not all at once
3. **Migration should be opportunistic** - prioritize tests that would benefit most
4. **No breaking changes** - old and new patterns coexist peacefully

This ticket serves as a meta-ticket for **optional** test migration work, to be done when:
- Tests are already being modified for other reasons
- Tests are frequently failing and need improved debugging
- Developer wants to reduce test setup code
- Team wants to standardize on new patterns

## Acceptance Criteria

✅ **Opportunistic Migration Strategy**
- Migrate tests when already touching them for other reasons
- Prioritize tests with extensive manual setup (>20 lines)
- Focus on tests that frequently fail with cryptic errors
- Skip simple, stable tests (not worth the effort)

✅ **Backward Compatibility Maintained**
- Old test patterns continue to work
- No requirement to migrate all tests
- New tests can use new patterns immediately
- Mixed patterns in same file are acceptable

✅ **Migration Documentation Referenced**
- Developers use INTTESDEB-008 migration guide
- Migration decisions follow priority matrix
- Each migration follows step-by-step guide
- Migration examples are referenced

✅ **Quality Gates**
- All migrated tests pass
- Test coverage maintained or improved
- Migrated tests are clearer and more maintainable
- No functionality regressions

## Implementation Details

### Migration Priority Matrix

From INTTESDEB-008 migration guide:

**High Priority** (Migrate First):
- Tests that frequently fail with cryptic errors
- Tests with extensive manual setup (>20 lines)
- Tests for complex action discovery scenarios
- Tests currently broken or flaky

**Medium Priority** (Migrate When Touched):
- Tests that work but are verbose
- Tests with generic assertions
- Tests modified during feature development

**Low Priority** (Optional):
- Simple, stable tests
- Tests with minimal setup
- Tests that rarely fail

### Migration Approach

**Gradual Migration Philosophy**:
1. **Don't migrate all at once** - it's a marathon, not a sprint
2. **Start with failing tests** - get immediate benefit from better debugging
3. **Use new patterns for new tests** - prevent future tech debt
4. **Old tests can stay** - backward compatible, no pressure to migrate
5. **Mixed patterns OK** - old and new can coexist in same file

**When to Migrate**:
- ✅ You're already modifying a test
- ✅ A test is frequently failing and hard to debug
- ✅ You're writing a new test (use new patterns from the start)
- ✅ A test has >20 lines of manual entity setup
- ❌ Test is simple, stable, and works fine
- ❌ You have other higher-priority work

### Example Migration Candidates

Based on the spec, these types of tests would benefit from migration:

1. **Action Discovery Tests with Manual Setup**:
   ```
   File: tests/integration/mods/affection/place_hands_on_shoulders_action_discovery.test.js
   Reason: Extensive manual entity creation (42 lines → 15 lines with new patterns)
   Priority: High
   ```

2. **Tests with Generic Assertions**:
   ```
   File: tests/integration/mods/positioning/kneel_before_action_discovery.test.js
   Reason: Uses generic assertions without detailed error messages
   Priority: Medium
   ```

3. **Complex Multi-Actor Scenarios**:
   ```
   File: tests/integration/mods/intimacy/*_action_discovery.test.js
   Reason: Complex actor/target setup, would benefit from createActorTargetScenario()
   Priority: High
   ```

### Migration Process (Per Test)

Following INTTESDEB-008 migration guide:

1. **Update Imports**:
   ```javascript
   // Add new imports
   import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
   import '../../common/actionMatchers.js';
   ```

2. **Replace beforeEach Setup**:
   ```javascript
   // Before
   let entityManager;
   let service;

   beforeEach(() => {
     entityManager = new SimpleEntityManager();
     service = createActionDiscoveryService(entityManager);
   });

   // After
   let testBed;

   beforeEach(() => {
     testBed = createActionDiscoveryBed();
   });
   ```

3. **Replace Entity Creation**:
   ```javascript
   // Before: 15+ lines of manual setup
   const actor = entityManager.createEntity('actor1');
   entityManager.addComponent('actor1', 'core:name', { name: 'Alice' });
   // ... many more lines ...

   // After: One-line scenario setup
   const { actor, target } = testBed.createActorTargetScenario({
     actorComponents: { /* ... */ },
     targetComponents: { /* ... */ },
   });
   ```

4. **Replace Assertions**:
   ```javascript
   // Before
   expect(actions.some(a => a.id === 'test:action')).toBe(true);

   // After
   expect(result).toHaveActionForTarget('test:action', 'target1');
   ```

5. **Run Tests**:
   ```bash
   npm run test:integration -- path/to/migrated/test.js
   ```

6. **Verify Quality**:
   - All tests pass
   - Coverage maintained or improved
   - Test is clearer and more maintainable

## Testing Requirements

### For Each Migrated Test
- All test cases pass (existing functionality preserved)
- Test coverage maintained or improved
- ESLint passes: `npx eslint path/to/test.js`
- Test clarity improved (subjective but important)

### Validation Checklist
- [ ] Imports updated correctly
- [ ] Test bed setup replaces old setup
- [ ] Entity creation uses helpers
- [ ] Assertions use custom matchers
- [ ] All tests pass
- [ ] No functionality regressions
- [ ] Code is clearer and more maintainable

## Implementation Steps

This is a **meta-ticket** representing optional migration work. For each test file to migrate:

1. **Identify Migration Candidate**
   - Use priority matrix from INTTESDEB-008
   - Select test that would benefit from new patterns
   - Confirm test is worth migrating (not too simple)

2. **Reference Migration Guide**
   - Read `/docs/testing/action-integration-test-migration.md`
   - Follow step-by-step migration process
   - Use before/after examples as reference

3. **Perform Migration**
   - Update imports
   - Replace entity creation with test bed helpers
   - Replace assertions with custom matchers
   - Add diagnostics if needed for complex tests

4. **Validate Migration**
   - Run migrated tests: `npm run test:integration -- path/to/test.js`
   - Verify all tests pass
   - Run ESLint: `npx eslint path/to/test.js`
   - Confirm code is clearer

5. **Commit Changes**
   - Create commit with clear message
   - Reference this ticket in commit message
   - Document any migration challenges encountered

## Example Migrations

### High-Priority Migration Example

**File**: `tests/integration/mods/affection/place_hands_on_shoulders_action_discovery.test.js`

**Before** (42 lines):
```javascript
describe('Place Hands on Shoulders Action', () => {
  let entityManager;
  let service;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();
    // ... setup service ...
  });

  it('should discover action when actors are close and facing', () => {
    // Create actor (15 lines)
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent('actor1', 'core:name', { name: 'Alice' });
    // ... many more lines ...

    // Create target (15 lines)
    const target = entityManager.createEntity('target1');
    // ... many more lines ...

    // Establish closeness (5 lines)
    const actorCloseness = { partners: ['target1'] };
    // ... more setup ...

    // Test (generic assertion)
    const actions = service.discoverActionsForActor(actor);
    expect(actions.some(a => a.id === 'affection:place_hands_on_shoulders')).toBe(true);
  });
});
```

**After** (15 lines):
```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

describe('Place Hands on Shoulders Action', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('should discover action when actors are close and facing', () => {
    const { actor, target } = testBed.createActorTargetScenario({
      actorComponents: {
        'positioning:facing': { direction: 'toward', entityId: 'target1' },
      },
      targetComponents: {
        'positioning:facing': { direction: 'toward', entityId: 'actor1' },
      },
    });

    const result = testBed.discoverActionsWithDiagnostics(actor);

    expect(result).toHaveActionForTarget('affection:place_hands_on_shoulders', 'target1');
  });
});
```

**Improvements**:
- 64% code reduction (42 → 15 lines)
- Automatic entity validation
- Better error messages from custom matcher
- Clearer test intent

### Medium-Priority Migration Example

**File**: Tests modified during feature development

**Strategy**: When adding new test cases to existing files, use new patterns for new tests while leaving old tests unchanged. Mixed patterns are acceptable.

```javascript
describe('Action Discovery', () => {
  // Old test (not migrated)
  it('old test case', () => {
    const entityManager = new SimpleEntityManager();
    // ... old pattern ...
  });

  // New test (using new patterns)
  it('new test case', () => {
    const testBed = createActionDiscoveryBed();
    const { actor, target } = testBed.createActorTargetScenario();
    // ... new pattern ...
  });
});
```

## Success Metrics

### Migration Impact
- **Code Reduction**: Target 50-70% reduction in test setup code
- **Debugging Time**: Reduce debugging time for migrated tests
- **Test Clarity**: Improved readability and maintainability
- **Developer Satisfaction**: Positive feedback on new patterns

### Adoption Metrics
- **New Tests**: All new tests use new patterns (100% target)
- **Migrated Tests**: Track number of tests migrated (no specific target)
- **Mixed Usage**: Document successful coexistence of old/new patterns

### Quality Metrics
- **Test Pass Rate**: Maintain or improve (target: 100%)
- **Test Coverage**: Maintain or improve (≥80% branches)
- **ESLint Compliance**: All migrated tests pass linting

## Related Tickets

- **Documents Migration For**: All implementation tickets (INTTESDEB-001 through INTTESDEB-006)
- **Uses Documentation**: INTTESDEB-007 (Usage guide), INTTESDEB-008 (Migration guide)
- **Follows Standards**: INTTESDEB-009 (Project documentation)
- **Optional**: This ticket is entirely optional and opportunistic

## References

- Spec: `/specs/integration-test-debugging-improvements-revised.spec.md` (lines 1045-1053)
- Migration Guide: `/docs/testing/action-integration-test-migration.md` (INTTESDEB-008)
- Usage Guide: `/docs/testing/action-integration-debugging.md` (INTTESDEB-007)
- Project Documentation: README.md, tests/README.md, CLAUDE.md (INTTESDEB-009)

## Important Notes

**This ticket is OPTIONAL and LOW PRIORITY**:
- Migration is not required for project functionality
- Old patterns are fully supported and will continue to work
- Migration should be opportunistic and incremental
- Focus on high-value migrations (frequently failing tests, verbose setup)
- Skip low-value migrations (simple, stable tests)

**Backward Compatibility Commitment**:
- No breaking changes to existing test infrastructure
- Old and new patterns coexist peacefully
- Mixed patterns in same file are acceptable
- No pressure to migrate all tests

**When to Work on This Ticket**:
- You're already modifying a test for other reasons
- A test is frequently failing and needs better debugging
- You're writing new tests (use new patterns from the start)
- You have time and want to improve test quality

**When NOT to Work on This Ticket**:
- You have higher-priority development work
- Tests are simple, stable, and work fine
- Migration effort outweighs benefit

# DISBODPARSPA-031: Unit Tests for EntityGraphBuilder `definitionId` Storage

## Status: ✅ COMPLETED

## Summary

Add unit tests to verify that `EntityGraphBuilder` correctly stores the `definitionId` field in the `anatomy:part` component when building entity anatomy graphs.

---

## Reassessment Notes

**Original assumptions vs actual state:**

1. **Implementation**: The `definitionId` storage in `EntityGraphBuilder` was already implemented in DISBODPARSPA-020. Both `createRootEntity()` (lines 174-194) and `createAndAttachPart()` (lines 274-300) correctly store `definitionId`.

2. **Existing Tests**: Comprehensive tests already existed in `tests/unit/anatomy/entityGraphBuilder.test.js`:
   - `'stores definitionId in anatomy:part for root entity'`
   - `'stores actualRootDefinitionId in anatomy:part when torso override used'`
   - `'propagates definitionId and orientation from socket to child anatomy:part'`
   - `'stores definitionId in anatomy:part even without orientation'`
   - `'does not update anatomy:part when component is missing'` (for createAndAttachPart)

3. **Coverage Gap Found**: The test for `createRootEntity` when `anatomy:part` is missing did not exist (branch at line 179). This was added.

4. **Ticket's Proposed API Mismatch**: The original ticket suggested tests using methods like `graphBuilder.buildGraph()`, `result.getBodyPartByType()`, `result.getBodyPartByTypeAndOrientation()` which don't exist in `EntityGraphBuilder`. The actual class is a lower-level builder with methods like `createRootEntity()` and `createAndAttachPart()`.

---

## Files Touched

| File                                            | Change Type | Description                                               |
| ----------------------------------------------- | ----------- | --------------------------------------------------------- |
| `tests/unit/anatomy/entityGraphBuilder.test.js` | Modify      | Added test for root entity without anatomy:part component |

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `src/anatomy/entityGraphBuilder.js` - Implementation is DISBODPARSPA-020
- Creating new test files
- Tests for `DismemberedBodyPartSpawner` (DISBODPARSPA-030)
- Integration tests (DISBODPARSPA-032)

---

## Test Added

### New Test Case

```javascript
it('does not update anatomy:part when root entity has no anatomy:part component', async () => {
  // This covers the branch at line 179 in createRootEntity
  mocks.entityManager.createEntityInstance.mockResolvedValue({
    id: 'root-without-part',
  });
  mocks.entityManager.getComponentData.mockReturnValue(null);

  const id = await builder.createRootEntity('anatomy:generic_root', {});

  // Should NOT call addComponent for anatomy:part when the component doesn't exist
  expect(mocks.entityManager.addComponent).not.toHaveBeenCalledWith(
    'root-without-part',
    'anatomy:part',
    expect.any(Object)
  );
  expect(id).toBe('root-without-part');
});
```

---

## Pre-existing Tests That Cover definitionId

The following tests already existed and verify the ticket's requirements:

1. **Basic definitionId Storage** (line 384):
   - `'stores definitionId in anatomy:part for root entity'`
   - Verifies definitionId is stored, original subType preserved

2. **Override Scenario** (line 412):
   - `'stores actualRootDefinitionId in anatomy:part when torso override used'`
   - Verifies the ACTUAL used definition ID is stored when torso is overridden

3. **Child Parts with Orientation** (line 475):
   - `'propagates definitionId and orientation from socket to child anatomy:part'`
   - Verifies both definitionId and orientation are stored for child parts

4. **Child Parts without Orientation** (line 509):
   - `'stores definitionId in anatomy:part even without orientation'`
   - Verifies definitionId storage works independently of orientation

5. **Missing Component (Child)** (line 539):
   - `'does not update anatomy:part when component is missing'`
   - Verifies graceful handling when anatomy:part doesn't exist on child

---

## Acceptance Criteria

### Tests That Must Pass

1. ✅ All new tests pass with `npm run test:unit`
2. ✅ All existing `EntityGraphBuilder` tests continue to pass (27 tests)
3. ✅ No regressions in test coverage (maintained 100% lines, improved branch coverage)

### Validation Commands

```bash
# Run EntityGraphBuilder tests
npm run test:unit -- --testPathPattern="entityGraphBuilder"

# Verify no test regressions
npm run test:unit
```

### Invariants That Must Remain True

1. **No Regressions**: All existing tests must continue to pass ✅
2. **Test Isolation**: New tests don't affect existing test behavior ✅
3. **Comprehensive Coverage**: All definitionId-related code paths tested ✅
4. **Data Integrity**: Tests verify original component data is preserved ✅

---

## Dependencies

- DISBODPARSPA-020 (Implementation must exist to be tested) ✅ COMPLETE

## Blocks

- None - testing ticket doesn't block other work

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**

- Create 5 new test cases for `definitionId` storage
- Tests using non-existent API methods (`buildGraph()`, `getBodyPartByType()`, etc.)

**Actually Changed:**

- Added **1 new test** to cover a previously uncovered branch (line 179)
- The other 5 proposed tests were already implemented and passing

**Key Differences:**

1. The ticket's proposed API (`graphBuilder.buildGraph()`, `result.getBodyPartByType()`) doesn't exist - `EntityGraphBuilder` is a lower-level builder class
2. Most tests already existed covering `definitionId` storage in both `createRootEntity()` and `createAndAttachPart()`
3. Only one edge case (root entity without `anatomy:part` component) was missing

**Metrics:**

- Tests: 27 → 28 (1 new test added)
- Branch coverage: 96.15% → 98.07% (improved by ~2%)
- Lines/statements/functions coverage: 100% (maintained)

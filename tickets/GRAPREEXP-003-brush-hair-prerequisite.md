# GRAPREEXP-003: Add Free Grabbing Appendage Prerequisite to Brush Hair Back Coyly Action

## Summary

Insert a new prerequisite at the **beginning** (index 0) of the existing `prerequisites` array for the `seduction:brush_hair_back_coyly` action. This action already has two prerequisites; the grabbing appendage prerequisite must be added FIRST.

**Key difference from other tickets**: This action already has a `prerequisites` array. The new prerequisite must be **inserted at index 0**, not appended.

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/seduction/actions/brush_hair_back_coyly.action.json` | Insert new prerequisite at index 0 of existing `prerequisites` array |

## Files to Create

| File | Purpose |
|------|---------|
| `tests/integration/mods/seduction/brush_hair_back_coyly_prerequisites.test.js` | Integration tests for prerequisite evaluation |

## Implementation Details

### brush_hair_back_coyly.action.json

**Current State (lines 12-25)**:
```json
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "hair"]
      },
      "failure_message": "You need hair to perform this action."
    },
    {
      "logic": {
        "hasOtherActorsAtLocation": ["actor"]
      },
      "failure_message": "There is nobody here to draw attention from."
    }
  ],
```

**New State**:
```json
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to brush your hair."
    },
    {
      "logic": {
        "hasPartOfType": ["actor", "hair"]
      },
      "failure_message": "You need hair to perform this action."
    },
    {
      "logic": {
        "hasOtherActorsAtLocation": ["actor"]
      },
      "failure_message": "There is nobody here to draw attention from."
    }
  ],
```

### Why Index 0?

1. **Physical capability checks should precede contextual checks** - "Can't use hands" is a clearer failure reason than "nobody around"
2. **Logical order**: Can you do it → Should you do it
3. **Consistency** with how physical prerequisites are ordered in other actions

### Test File Structure

This test file requires **additional tests** beyond the standard template to verify multiple prerequisites work correctly together:

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for seduction:brush_hair_back_coyly action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage,
 *              hair, and other actors at location (multiple prerequisites)
 *
 * @see data/mods/seduction/actions/brush_hair_back_coyly.action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREEXP-003-brush-hair-prerequisite.md
 */
```

## Out of Scope

- **DO NOT** modify the operator (`src/logic/operators/hasFreeGrabbingAppendagesOperator.js`)
- **DO NOT** modify the condition definition (`actor-has-free-grabbing-appendage.condition.json`)
- **DO NOT** modify any other action files
- **DO NOT** remove or reorder the existing prerequisites (hasPartOfType, hasOtherActorsAtLocation)
- **DO NOT** change any other properties in `brush_hair_back_coyly.action.json` (visual, targets, etc.)

## Acceptance Criteria

### Tests That Must Pass

```bash
# New test file
NODE_ENV=test npx jest tests/integration/mods/seduction/brush_hair_back_coyly_prerequisites.test.js --no-coverage --verbose

# Schema validation
npm run validate

# Lint
npx eslint data/mods/seduction/actions/brush_hair_back_coyly.action.json tests/integration/mods/seduction/brush_hair_back_coyly_prerequisites.test.js
```

### Required Test Suites

#### 1. Action Definition Structure
- `should have prerequisites array defined`
- `should have exactly three prerequisites`
- `should have grabbing prerequisite at index 0`
- `should reference anatomy:actor-has-free-grabbing-appendage condition`
- `should have failure_message for user feedback`
- `should preserve other action properties` (id, template, targets, forbidden_components, visual)

#### 2. Multiple Prerequisites Validation
- `grabbing prerequisite should be first in array (index 0)`
- `should preserve existing hasPartOfType prerequisite at index 1`
- `should preserve existing hasOtherActorsAtLocation prerequisite at index 2`

#### 3. Prerequisite Evaluation - Pass Cases
- `should pass when actor has exactly one free grabbing appendage`
- `should pass when actor has multiple free grabbing appendages`
- `should pass for actor with two hands both free`

#### 4. Prerequisite Evaluation - Fail Cases
- `should fail when actor has zero free grabbing appendages`
- `should fail when all appendages are locked (holding items)`

#### 5. Edge Cases
- `should handle missing actor gracefully`
- `should handle actor with no grabbing appendages`

#### 6. Condition Definition Validation
- `should use hasFreeGrabbingAppendages operator with parameter 1`
- `condition ID should match what the action references`

### Invariants That Must Remain True

- [ ] Action ID remains `seduction:brush_hair_back_coyly`
- [ ] Template remains `brush your hair back coyly`
- [ ] Targets remain `"none"`
- [ ] `forbidden_components` remain unchanged
- [ ] `visual` properties remain unchanged
- [ ] **Existing hasPartOfType prerequisite preserved at index 1**
- [ ] **Existing hasOtherActorsAtLocation prerequisite preserved at index 2**
- [ ] Existing tests in the project continue to pass
- [ ] JSON schema validation passes

## Dependencies

- **Depends on**: Nothing (uses existing infrastructure)
- **Blocked by**: Nothing
- **Blocks**: Nothing (can be done in parallel with other GRAPREEXP tickets)

## Reference Files

| File | Purpose |
|------|---------|
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` | Test pattern template |
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Condition to reference |
| `specs/grabbing-prerequisites-expansion.md` | Full specification |

## Additional Test Assertions for This Ticket

```javascript
describe('multiple prerequisites', () => {
  test('should have three prerequisites total', () => {
    expect(brushHairAction.prerequisites.length).toBe(3);
  });

  test('grabbing prerequisite should be first in array', () => {
    expect(brushHairAction.prerequisites[0].logic.condition_ref).toBe(
      'anatomy:actor-has-free-grabbing-appendage'
    );
  });

  test('should preserve existing hasPartOfType prerequisite', () => {
    expect(brushHairAction.prerequisites[1].logic.hasPartOfType).toEqual(['actor', 'hair']);
  });

  test('should preserve existing hasOtherActorsAtLocation prerequisite', () => {
    expect(brushHairAction.prerequisites[2].logic.hasOtherActorsAtLocation).toBeDefined();
  });
});
```

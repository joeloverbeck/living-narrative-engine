# GRAPREEXP-005: Add Free Grabbing Appendage Prerequisite to Give Item Action

## Summary

Add a prerequisite to the `items:give_item` action requiring the actor to have at least one free grabbing appendage (hand/tentacle/claw). Uses the existing `anatomy:actor-has-free-grabbing-appendage` condition.

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/items/actions/give_item.action.json` | Add `prerequisites` array after `forbidden_components` |

## Files to Create

| File | Purpose |
|------|---------|
| `tests/integration/mods/items/give_item_prerequisites.test.js` | Integration tests for prerequisite evaluation |

## Implementation Details

### give_item.action.json

**Current State (lines 10-13)**:
```json
  "forbidden_components": {
    "actor": ["positioning:bending_over"]
  },
  "targets": {
```

**New State**:
```json
  "forbidden_components": {
    "actor": ["positioning:bending_over"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to give an item."
    }
  ],
  "targets": {
```

### Test File Structure

Follow the pattern from `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`:

```javascript
/**
 * @jest-environment node
 *
 * @file Integration tests for items:give_item action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage
 *
 * @see data/mods/items/actions/give_item.action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREEXP-005-give-item-prerequisite.md
 */
```

## Out of Scope

- **DO NOT** modify the operator (`src/logic/operators/hasFreeGrabbingAppendagesOperator.js`)
- **DO NOT** modify the condition definition (`actor-has-free-grabbing-appendage.condition.json`)
- **DO NOT** modify any other action files
- **DO NOT** modify the test pattern reference file (`wield_threateningly_prerequisites.test.js`)
- **DO NOT** change any other properties in `give_item.action.json` (visual, targets, required_components, forbidden_components, etc.)

## Acceptance Criteria

### Tests That Must Pass

```bash
# New test file
NODE_ENV=test npx jest tests/integration/mods/items/give_item_prerequisites.test.js --no-coverage --verbose

# Schema validation
npm run validate

# Lint
npx eslint data/mods/items/actions/give_item.action.json tests/integration/mods/items/give_item_prerequisites.test.js
```

### Required Test Suites

#### 1. Action Definition Structure
- `should have prerequisites array defined`
- `should reference anatomy:actor-has-free-grabbing-appendage condition`
- `should have failure_message for user feedback`
- `should preserve other action properties` (id, generateCombinations, targets, required_components, forbidden_components, visual)

#### 2. Prerequisite Evaluation - Pass Cases
- `should pass when actor has exactly one free grabbing appendage`
- `should pass when actor has multiple free grabbing appendages`
- `should pass for actor with two hands both free`

#### 3. Prerequisite Evaluation - Fail Cases
- `should fail when actor has zero free grabbing appendages`
- `should fail when all appendages are locked (holding items)`

#### 4. Edge Cases
- `should handle missing actor gracefully`
- `should handle actor with no grabbing appendages`

#### 5. Condition Definition Validation
- `should use hasFreeGrabbingAppendages operator with parameter 1`
- `condition ID should match what the action references`

### Invariants That Must Remain True

- [ ] Action ID remains `items:give_item`
- [ ] `generateCombinations` remains `true`
- [ ] Template remains `give {item} to {recipient}`
- [ ] Primary target scope remains `core:actors_in_location`
- [ ] Secondary target scope remains `items:actor_inventory_items`
- [ ] `required_components` remain unchanged (`actor: ["items:inventory"]`)
- [ ] `forbidden_components` remain unchanged (`actor: ["positioning:bending_over"]`)
- [ ] `visual` properties remain unchanged
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
test('should preserve other action properties', () => {
  expect(giveItemAction.id).toBe('items:give_item');
  expect(giveItemAction.generateCombinations).toBe(true);
  expect(giveItemAction.targets.primary.scope).toBe('core:actors_in_location');
  expect(giveItemAction.targets.secondary.scope).toBe('items:actor_inventory_items');
  expect(giveItemAction.required_components.actor).toContain('items:inventory');
  expect(giveItemAction.forbidden_components.actor).toContain('positioning:bending_over');
});
```

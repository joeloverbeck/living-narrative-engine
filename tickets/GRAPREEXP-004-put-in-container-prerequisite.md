# GRAPREEXP-004: Add Free Grabbing Appendage Prerequisite to Put In Container Action

## Summary

Add a prerequisite to the `items:put_in_container` action requiring the actor to have at least one free grabbing appendage (hand/tentacle/claw). Uses the existing `anatomy:actor-has-free-grabbing-appendage` condition.

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/items/actions/put_in_container.action.json` | Add `prerequisites` array after `required_components` |

## Files to Create

| File | Purpose |
|------|---------|
| `tests/integration/mods/items/put_in_container_prerequisites.test.js` | Integration tests for prerequisite evaluation |

## Implementation Details

### put_in_container.action.json

**Current State (lines 7-10)**:
```json
  "required_components": {
    "actor": ["items:inventory"]
  },
  "targets": {
```

**New State**:
```json
  "required_components": {
    "actor": ["items:inventory"]
  },
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need a free hand to put an item in a container."
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
 * @file Integration tests for items:put_in_container action prerequisites
 * @description Tests that the action correctly requires one free grabbing appendage
 *
 * @see data/mods/items/actions/put_in_container.action.json
 * @see data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
 * @see tickets/GRAPREEXP-004-put-in-container-prerequisite.md
 */
```

## Out of Scope

- **DO NOT** modify the operator (`src/logic/operators/hasFreeGrabbingAppendagesOperator.js`)
- **DO NOT** modify the condition definition (`actor-has-free-grabbing-appendage.condition.json`)
- **DO NOT** modify any other action files
- **DO NOT** modify the test pattern reference file (`wield_threateningly_prerequisites.test.js`)
- **DO NOT** change any other properties in `put_in_container.action.json` (visual, targets, required_components, etc.)

## Acceptance Criteria

### Tests That Must Pass

```bash
# New test file
NODE_ENV=test npx jest tests/integration/mods/items/put_in_container_prerequisites.test.js --no-coverage --verbose

# Schema validation
npm run validate

# Lint
npx eslint data/mods/items/actions/put_in_container.action.json tests/integration/mods/items/put_in_container_prerequisites.test.js
```

### Required Test Suites

#### 1. Action Definition Structure
- `should have prerequisites array defined`
- `should reference anatomy:actor-has-free-grabbing-appendage condition`
- `should have failure_message for user feedback`
- `should preserve other action properties` (id, generateCombinations, targets, required_components, visual)

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

- [ ] Action ID remains `items:put_in_container`
- [ ] `generateCombinations` remains `true`
- [ ] Template remains `put {secondary.name} in {primary.name}`
- [ ] Primary target scope remains `items:open_containers_at_location`
- [ ] Secondary target scope remains `items:actor_inventory_items`
- [ ] `required_components` remain unchanged (`actor: ["items:inventory"]`)
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
  expect(putInContainerAction.id).toBe('items:put_in_container');
  expect(putInContainerAction.generateCombinations).toBe(true);
  expect(putInContainerAction.targets.primary.scope).toBe('items:open_containers_at_location');
  expect(putInContainerAction.targets.secondary.scope).toBe('items:actor_inventory_items');
  expect(putInContainerAction.required_components.actor).toContain('items:inventory');
});
```

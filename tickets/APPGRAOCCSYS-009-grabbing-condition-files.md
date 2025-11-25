# APPGRAOCCSYS-009: Create Condition Files for Grabbing Checks

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Create reusable condition files that check whether an actor has free grabbing appendages. These conditions can be referenced in action prerequisites to validate that actors have enough free hands before presenting weapon-related actions.

## Dependencies

- APPGRAOCCSYS-001 (anatomy:can_grab component schema)
- APPGRAOCCSYS-006 (hasFreeGrabbingAppendages operator)

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Checks if actor has at least 1 free grabbing appendage |
| `data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json` | Checks if actor has at least 2 free grabbing appendages |
| `tests/unit/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.test.js` | Unit tests for conditions |

## Files to Modify

None - these are new condition files. The anatomy mod's manifest should auto-discover them.

## Out of Scope

- DO NOT create the operator (handled in APPGRAOCCSYS-006)
- DO NOT modify operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT modify entity files (handled in APPGRAOCCSYS-007/008)
- DO NOT modify action files (handled in APPGRAOCCSYS-010)
- DO NOT modify rule files

## Implementation Details

### Condition: actor-has-free-grabbing-appendage.condition.json

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "anatomy:actor-has-free-grabbing-appendage",
  "description": "Checks if the actor has at least one free (unlocked) grabbing appendage available",
  "logic": {
    "hasFreeGrabbingAppendages": ["actor", 1]
  }
}
```

### Condition: actor-has-two-free-grabbing-appendages.condition.json

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "anatomy:actor-has-two-free-grabbing-appendages",
  "description": "Checks if the actor has at least two free (unlocked) grabbing appendages available",
  "logic": {
    "hasFreeGrabbingAppendages": ["actor", 2]
  }
}
```

### Folder Structure

```
data/mods/anatomy/
├── conditions/                    # New folder for conditions
│   ├── actor-has-free-grabbing-appendage.condition.json
│   └── actor-has-two-free-grabbing-appendages.condition.json
├── components/
│   └── can_grab.component.json   # From APPGRAOCCSYS-001
├── entities/
│   └── definitions/
└── mod-manifest.json
```

## Usage Examples

### In Action Prerequisites

```json
{
  "id": "weapons:wield_threateningly",
  "prerequisites": {
    "conditions": [
      "anatomy:actor-has-free-grabbing-appendage"
    ]
  }
}
```

### For Two-Handed Weapons

```json
{
  "id": "weapons:wield_greatsword",
  "prerequisites": {
    "conditions": [
      "anatomy:actor-has-two-free-grabbing-appendages"
    ]
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   - [ ] Condition files pass JSON schema validation
   - [ ] `npm run validate:mod:anatomy` passes

2. **Unit Tests**: `tests/unit/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.test.js`
   - [ ] Condition loads without errors
   - [ ] Condition evaluates to true when actor has free appendages
   - [ ] Condition evaluates to false when actor has no free appendages
   - [ ] Condition evaluates to false when actor has no grabbing appendages at all
   - [ ] Two-appendage condition requires exactly 2+ free appendages

3. **Integration Tests**:
   - [ ] `npm run test:ci` passes
   - [ ] Conditions can be referenced by action prerequisites

4. **Existing Tests**: `npm run test:unit` should pass

### Invariants That Must Remain True

1. Follows condition schema pattern from existing conditions
2. Uses the `hasFreeGrabbingAppendages` operator (not direct component checks)
3. Condition IDs follow `modId:condition-name` format
4. Conditions are reusable across multiple actions
5. No modification to existing conditions required

## Test File Template

```javascript
// tests/unit/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.test.js
import { describe, it, expect, beforeAll } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('anatomy:actor-has-free-grabbing-appendage condition', () => {
  let testBed;
  let conditionEvaluator;

  beforeAll(async () => {
    testBed = await createTestBed();
    conditionEvaluator = testBed.getConditionEvaluator();
    await testBed.loadMods(['core', 'anatomy']);
  });

  describe('condition loading', () => {
    it('should load condition without errors', async () => {
      const condition = await testBed.getCondition('anatomy:actor-has-free-grabbing-appendage');
      expect(condition).toBeDefined();
      expect(condition.id).toBe('anatomy:actor-has-free-grabbing-appendage');
    });
  });

  describe('evaluation', () => {
    it('should return true when actor has at least one free grabbing appendage', async () => {
      // Setup actor with free hand
      const actor = testBed.createActor({
        body: { parts: { left_hand: 'part_1', right_hand: 'part_2' } }
      });
      testBed.addComponentToEntity('part_1', 'anatomy:can_grab', {
        locked: false,
        heldItemId: null,
        gripStrength: 1.0
      });
      testBed.addComponentToEntity('part_2', 'anatomy:can_grab', {
        locked: true,
        heldItemId: 'sword_1',
        gripStrength: 1.0
      });

      const result = await conditionEvaluator.evaluate(
        'anatomy:actor-has-free-grabbing-appendage',
        { actor: actor.id }
      );

      expect(result).toBe(true);
    });

    it('should return false when actor has no free grabbing appendages', async () => {
      // Setup actor with both hands occupied
      const actor = testBed.createActor({
        body: { parts: { left_hand: 'part_1', right_hand: 'part_2' } }
      });
      testBed.addComponentToEntity('part_1', 'anatomy:can_grab', {
        locked: true,
        heldItemId: 'sword_1',
        gripStrength: 1.0
      });
      testBed.addComponentToEntity('part_2', 'anatomy:can_grab', {
        locked: true,
        heldItemId: 'shield_1',
        gripStrength: 1.0
      });

      const result = await conditionEvaluator.evaluate(
        'anatomy:actor-has-free-grabbing-appendage',
        { actor: actor.id }
      );

      expect(result).toBe(false);
    });
  });
});
```

## Verification Commands

```bash
# Validate anatomy mod
npm run validate:mod:anatomy

# Run condition tests
npm run test:unit -- tests/unit/mods/anatomy/conditions/

# Run CI tests
npm run test:ci

# Run anatomy-related tests
npm run test:unit -- --testPathPattern="anatomy"
```

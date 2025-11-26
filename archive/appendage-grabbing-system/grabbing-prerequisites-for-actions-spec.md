# Grabbing Prerequisites for Actions

## Overview

This specification documents the addition of anatomy-based grabbing prerequisites to 9 action files across 4 mods. The grabbing limitation system ensures that actions requiring hands (or other grabbing appendages) are only available when the actor has sufficient free appendages.

**Example Use Case**: An actor wielding a longsword (which locks both hands) should not be able to brush back their hair, remove clothing, or pick up items until they unwield the weapon.

## Existing Infrastructure

The grabbing limitation system is already implemented and operational. No new operators or conditions need to be created.

### Operators

| Operator | Location | Purpose |
|----------|----------|---------|
| `hasFreeGrabbingAppendages` | `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` | Checks if entity has N free (unlocked) grabbing appendages |
| `canActorGrabItem` | `src/logic/operators/canActorGrabItemOperator.js` | Checks if actor can grab specific item based on its hand requirements |

### Condition Files

Both required conditions already exist in `data/mods/anatomy/conditions/`:

**1 Appendage Condition** (`actor-has-free-grabbing-appendage.condition.json`):
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

**2 Appendages Condition** (`actor-has-two-free-grabbing-appendages.condition.json`):
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

### Reference Implementation

See `data/mods/weapons/actions/wield_threateningly.action.json` for the established pattern:

```json
{
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need at least one free hand or appendage to wield a weapon."
    }
  ]
}
```

## Actions to Modify

### Summary Table

| Action | Mod | Appendages | Condition Ref | File Path |
|--------|-----|------------|---------------|-----------|
| `remove_clothing` | clothing | 2 | `anatomy:actor-has-two-free-grabbing-appendages` | `data/mods/clothing/actions/remove_clothing.action.json` |
| `remove_others_clothing` | clothing | 2 | `anatomy:actor-has-two-free-grabbing-appendages` | `data/mods/clothing/actions/remove_others_clothing.action.json` |
| `bury_face_in_hands` | distress | 2 | `anatomy:actor-has-two-free-grabbing-appendages` | `data/mods/distress/actions/bury_face_in_hands.action.json` |
| `clutch_onto_upper_clothing` | distress | 1 | `anatomy:actor-has-free-grabbing-appendage` | `data/mods/distress/actions/clutch_onto_upper_clothing.action.json` |
| `show_off_biceps` | exercise | 2 | `anatomy:actor-has-two-free-grabbing-appendages` | `data/mods/exercise/actions/show_off_biceps.action.json` |
| `drink_entirely` | items | 1 | `anatomy:actor-has-free-grabbing-appendage` | `data/mods/items/actions/drink_entirely.action.json` |
| `drink_from` | items | 1 | `anatomy:actor-has-free-grabbing-appendage` | `data/mods/items/actions/drink_from.action.json` |
| `pick_up_item` | items | 1 | `anatomy:actor-has-free-grabbing-appendage` | `data/mods/items/actions/pick_up_item.action.json` |
| `take_from_container` | items | 1 | `anatomy:actor-has-free-grabbing-appendage` | `data/mods/items/actions/take_from_container.action.json` |

### Detailed Changes

#### Clothing Mod (2 files)

**remove_clothing.action.json**
- **Rationale**: Removing clothing requires both hands to manipulate garment
- **Add prerequisites**:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
    },
    "failure_message": "You need both hands free to remove your clothing."
  }
]
```

**remove_others_clothing.action.json**
- **Rationale**: Removing another person's clothing requires both hands
- **Add prerequisites**:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
    },
    "failure_message": "You need both hands free to remove someone else's clothing."
  }
]
```

#### Distress Mod (2 files)

**bury_face_in_hands.action.json**
- **Rationale**: Action explicitly requires both hands to cover face
- **Add prerequisites**:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
    },
    "failure_message": "You need both hands free to bury your face in them."
  }
]
```

**clutch_onto_upper_clothing.action.json**
- **Rationale**: Clutching can be done with a single hand
- **Add prerequisites**:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need at least one free hand to clutch onto clothing."
  }
]
```

#### Exercise Mod (1 file)

**show_off_biceps.action.json**
- **Rationale**: Showing off biceps requires both arms to be free for the pose
- **Note**: This action already has prerequisites (muscular/hulking build check). The grabbing prerequisite must be **appended** to the existing array.
- **Append to existing prerequisites array**:
```json
{
  "logic": {
    "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
  },
  "failure_message": "You need both arms free to show off your biceps."
}
```

#### Items Mod (4 files)

**drink_entirely.action.json**
- **Rationale**: Drinking requires a hand to hold the container
- **Add prerequisites key** (currently missing):
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need a free hand to drink."
  }
]
```

**drink_from.action.json**
- **Rationale**: Drinking requires a hand to hold the container
- **Add prerequisites key** (currently missing):
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need a free hand to drink."
  }
]
```

**pick_up_item.action.json**
- **Rationale**: Picking up items requires at least one free hand
- **Populate empty prerequisites array**:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need a free hand to pick up items."
  }
]
```

**take_from_container.action.json**
- **Rationale**: Taking items from containers requires a free hand
- **Add prerequisites key** (currently missing):
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need a free hand to take items from the container."
  }
]
```

## Testing Requirements

### Test File Organization

Each action requires a dedicated integration test file following the pattern from `wield_threateningly_prerequisites.test.js`:

| Test File Path | Action |
|----------------|--------|
| `tests/integration/mods/clothing/remove_clothing_prerequisites.test.js` | remove_clothing |
| `tests/integration/mods/clothing/remove_others_clothing_prerequisites.test.js` | remove_others_clothing |
| `tests/integration/mods/distress/bury_face_in_hands_prerequisites.test.js` | bury_face_in_hands |
| `tests/integration/mods/distress/clutch_onto_upper_clothing_prerequisites.test.js` | clutch_onto_upper_clothing |
| `tests/integration/mods/exercise/show_off_biceps_prerequisites.test.js` | show_off_biceps |
| `tests/integration/mods/items/drink_entirely_prerequisites.test.js` | drink_entirely |
| `tests/integration/mods/items/drink_from_prerequisites.test.js` | drink_from |
| `tests/integration/mods/items/pick_up_item_prerequisites.test.js` | pick_up_item |
| `tests/integration/mods/items/take_from_container_prerequisites.test.js` | take_from_container |

### Required Test Scenarios

Each test file must cover:

#### 1. Action Definition Structure
```javascript
describe('action definition structure', () => {
  test('should have prerequisites array defined');
  test('should reference correct grabbing condition');
  test('should have failure_message for user feedback');
  test('should preserve other action properties');
});
```

#### 2. Success Scenarios (Free Appendages Available)
```javascript
describe('prerequisite evaluation - free grabbing appendages available', () => {
  test('should pass when actor has exactly N free appendages');
  test('should pass when actor has more than N free appendages');
});
```

#### 3. Failure Scenarios (Insufficient Appendages)
```javascript
describe('prerequisite evaluation - insufficient free appendages', () => {
  test('should fail when actor has zero free grabbing appendages');
  test('should fail when all appendages are locked (holding items)');
  // For 2-appendage actions only:
  test('should fail when actor has only one free appendage');
});
```

#### 4. Edge Cases
```javascript
describe('edge cases', () => {
  test('should handle missing actor gracefully');
  test('should handle actor with no grabbing appendages');
});
```

### Special Case: show_off_biceps

The `show_off_biceps` test must verify combined prerequisites:
```javascript
describe('combined prerequisites', () => {
  test('should pass when actor has muscular build AND 2 free appendages');
  test('should fail when actor has muscular build BUT 0 free appendages');
  test('should fail when actor has free appendages BUT NOT muscular build');
  test('should fail when both conditions fail');
});
```

### Mock Setup Pattern

Follow the pattern from `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`:

```javascript
// Mock grabbingUtils to control free appendage count
jest.mock('../../../../src/utils/grabbingUtils.js', () => ({
  countFreeGrabbingAppendages: jest.fn(),
}));

// In beforeEach:
const grabbingUtils = await import('../../../../src/utils/grabbingUtils.js');
mockCountFreeGrabbingAppendages = grabbingUtils.countFreeGrabbingAppendages;

// In tests - control free appendage count:
mockCountFreeGrabbingAppendages.mockReturnValue(0); // No free hands
mockCountFreeGrabbingAppendages.mockReturnValue(1); // One free hand
mockCountFreeGrabbingAppendages.mockReturnValue(2); // Both hands free
```

## Validation Commands

After implementation, run these commands to verify changes:

```bash
# Validate schema compliance for modified action files
npm run validate

# Run integration tests for all prerequisite tests
npm run test:integration -- --testPathPattern="prerequisites"

# Run tests for specific mods
npm run test:integration -- --testPathPattern="mods/(clothing|distress|exercise|items)"

# Full test suite
npm run test:ci
```

## Files Summary

### Files to Modify (9 action files)

| File | Change Type |
|------|-------------|
| `data/mods/clothing/actions/remove_clothing.action.json` | Replace empty prerequisites |
| `data/mods/clothing/actions/remove_others_clothing.action.json` | Replace empty prerequisites |
| `data/mods/distress/actions/bury_face_in_hands.action.json` | Replace empty prerequisites |
| `data/mods/distress/actions/clutch_onto_upper_clothing.action.json` | Replace empty prerequisites |
| `data/mods/exercise/actions/show_off_biceps.action.json` | Append to existing prerequisites |
| `data/mods/items/actions/drink_entirely.action.json` | Add prerequisites key |
| `data/mods/items/actions/drink_from.action.json` | Add prerequisites key |
| `data/mods/items/actions/pick_up_item.action.json` | Populate empty prerequisites |
| `data/mods/items/actions/take_from_container.action.json` | Add prerequisites key |

### Files to Create (9 test files)

| Test File |
|-----------|
| `tests/integration/mods/clothing/remove_clothing_prerequisites.test.js` |
| `tests/integration/mods/clothing/remove_others_clothing_prerequisites.test.js` |
| `tests/integration/mods/distress/bury_face_in_hands_prerequisites.test.js` |
| `tests/integration/mods/distress/clutch_onto_upper_clothing_prerequisites.test.js` |
| `tests/integration/mods/exercise/show_off_biceps_prerequisites.test.js` |
| `tests/integration/mods/items/drink_entirely_prerequisites.test.js` |
| `tests/integration/mods/items/drink_from_prerequisites.test.js` |
| `tests/integration/mods/items/pick_up_item_prerequisites.test.js` |
| `tests/integration/mods/items/take_from_container_prerequisites.test.js` |

### Existing Files (No Changes Required)

| File | Purpose |
|------|---------|
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Condition for 1 appendage |
| `data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json` | Condition for 2 appendages |

### Reference Files

| File | Purpose |
|------|---------|
| `data/mods/weapons/actions/wield_threateningly.action.json` | Implementation pattern |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` | Test pattern |
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` | Operator implementation |
| `src/utils/grabbingUtils.js` | Utility functions to mock |

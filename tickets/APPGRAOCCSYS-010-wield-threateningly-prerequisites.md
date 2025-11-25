# APPGRAOCCSYS-010: Add Grabbing Prerequisites to wield_threateningly Action

**Originating Document**: `brainstorming/appendage-grabbing-occupation-system.md`

## Summary

Add prerequisites to the `wield_threateningly` action to ensure the actor has at least one free grabbing appendage before the action is presented as available. This completes the integration of the grabbing occupation system with the weapons mod.

## Dependencies

- APPGRAOCCSYS-009 (condition files must exist)

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/weapons/actions/wield_threateningly.action.json` | Add `prerequisites` array with grabbing condition reference |

## Out of Scope

- DO NOT modify the component schemas (handled in APPGRAOCCSYS-001/002)
- DO NOT modify utility functions (handled in APPGRAOCCSYS-003)
- DO NOT modify operation handlers (handled in APPGRAOCCSYS-004/005)
- DO NOT modify the operator (handled in APPGRAOCCSYS-006)
- DO NOT modify body part entities (handled in APPGRAOCCSYS-007)
- DO NOT modify weapon entities (handled in APPGRAOCCSYS-008)
- DO NOT modify condition files (handled in APPGRAOCCSYS-009)
- DO NOT add prerequisites to other weapon actions (separate tickets if needed)
- DO NOT modify the action's target resolution or template

## Implementation Details

### wield_threateningly.action.json (Before)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:wield_threateningly",
  "name": "Wield Threateningly",
  "description": "Brandish a weapon in a threatening manner to intimidate others",
  "targets": {
    "primary": {
      "scope": "weapons:weapons_in_inventory",
      "description": "A weapon in the actor's inventory"
    }
  },
  "template": "wield {target} threateningly"
}
```

### wield_threateningly.action.json (After)

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:wield_threateningly",
  "name": "Wield Threateningly",
  "description": "Brandish a weapon in a threatening manner to intimidate others",
  "prerequisites": [
    "anatomy:actor-has-free-grabbing-appendage"
  ],
  "targets": {
    "primary": {
      "scope": "weapons:weapons_in_inventory",
      "description": "A weapon in the actor's inventory"
    }
  },
  "template": "wield {target} threateningly"
}
```

### Prerequisites Logic

The prerequisite `anatomy:actor-has-free-grabbing-appendage` will:
1. Check if the actor has at least one grabbing appendage (hand, tentacle, etc.)
2. Verify at least one such appendage is not locked (i.e., not already holding an item)
3. If both conditions are met, the action is available
4. If not, the action is filtered out during action discovery

### Future Enhancement: Item-Specific Prerequisites

For weapons that require two hands (like the longsword), future actions could use:
```json
{
  "prerequisites": [
    "anatomy:actor-has-two-free-grabbing-appendages"
  ]
}
```

This ticket only covers the basic one-handed prerequisite for `wield_threateningly`.

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**:
   - [ ] Modified action file passes JSON schema validation
   - [ ] `npm run validate:mod:weapons` passes

2. **Integration Tests**: `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`
   - [ ] Action is available when actor has free grabbing appendage
   - [ ] Action is NOT available when actor has no free grabbing appendages
   - [ ] Action is NOT available when actor has no grabbing appendages at all
   - [ ] Action still correctly targets weapons in inventory
   - [ ] Prerequisites are evaluated during action discovery

3. **Existing Tests**:
   - [ ] `npm run test:ci` passes
   - [ ] `npm run test:unit` passes
   - [ ] Existing weapons tests continue to pass

### Invariants That Must Remain True

1. Action ID remains `weapons:wield_threateningly`
2. Action template remains unchanged
3. Target resolution (weapons in inventory) remains unchanged
4. Action description remains unchanged
5. JSON schema reference is preserved
6. Prerequisite references valid condition IDs

## Test File Template

```javascript
// tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js
import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('weapons:wield_threateningly prerequisites', () => {
  let fixture;

  beforeAll(async () => {
    fixture = await ModTestFixture.forAction('weapons', 'weapons:wield_threateningly');
    await fixture.loadMods(['core', 'anatomy', 'weapons']);
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('action discovery', () => {
    it('should be available when actor has free grabbing appendage', async () => {
      // Create actor with free hand
      const actor = fixture.createActor({
        body: { parts: { left_hand: 'part_1', right_hand: 'part_2' } }
      });
      fixture.addComponentToEntity('part_1', 'anatomy:can_grab', {
        locked: false,
        heldItemId: null,
        gripStrength: 1.0
      });

      // Add weapon to inventory
      fixture.addItemToInventory(actor.id, 'fantasy:vespera_rapier');

      const availableActions = await fixture.discoverActions(actor.id);

      expect(availableActions).toContainActionId('weapons:wield_threateningly');
    });

    it('should NOT be available when actor has no free grabbing appendages', async () => {
      // Create actor with both hands occupied
      const actor = fixture.createActor({
        body: { parts: { left_hand: 'part_1', right_hand: 'part_2' } }
      });
      fixture.addComponentToEntity('part_1', 'anatomy:can_grab', {
        locked: true,
        heldItemId: 'sword_1',
        gripStrength: 1.0
      });
      fixture.addComponentToEntity('part_2', 'anatomy:can_grab', {
        locked: true,
        heldItemId: 'shield_1',
        gripStrength: 1.0
      });

      // Add weapon to inventory
      fixture.addItemToInventory(actor.id, 'fantasy:vespera_rapier');

      const availableActions = await fixture.discoverActions(actor.id);

      expect(availableActions).not.toContainActionId('weapons:wield_threateningly');
    });

    it('should NOT be available when actor has no grabbing appendages', async () => {
      // Create actor with no hands/tentacles
      const actor = fixture.createActor({
        body: { parts: { torso: 'part_1' } }  // No grabbing appendages
      });

      // Add weapon to inventory (via some other means)
      fixture.addItemToInventory(actor.id, 'fantasy:vespera_rapier');

      const availableActions = await fixture.discoverActions(actor.id);

      expect(availableActions).not.toContainActionId('weapons:wield_threateningly');
    });
  });
});
```

## Verification Commands

```bash
# Validate weapons mod
npm run validate:mod:weapons

# Run prerequisite tests
npm run test:integration -- tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js

# Run CI tests
npm run test:ci

# Run all weapons tests
npm run test:unit -- --testPathPattern="weapons"
npm run test:integration -- --testPathPattern="weapons"
```

## Future Considerations

- Other weapon actions (draw_weapon, sheathe_weapon, attack, etc.) may need similar prerequisites
- Two-handed weapons should use the `actor-has-two-free-grabbing-appendages` condition
- Consider item-specific prerequisites based on `anatomy:requires_grabbing.handsRequired`
- Dynamic prerequisite generation based on target weapon's requirements could be a future enhancement

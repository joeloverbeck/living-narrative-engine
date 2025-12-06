# Clothing Removal Blocking System

## Overview

The clothing removal blocking system enables realistic clothing physics by allowing items to declare which other items or layers they block from removal. This prevents unrealistic scenarios like removing pants while wearing a belt.

## Key Concepts

### Blocking Component

Items can include a `clothing:blocks_removal` component that declares what they block:

- **Slot-Based Blocking**: Block items in specific slots/layers (e.g., belt blocks pants in legs slot)
- **Item-Specific Blocking**: Block specific item IDs (e.g., cursed ring blocks magic glove)
- **Block Types**: Different blocking behaviors (must_remove_first, must_loosen_first, full_block)

### How It Works

1. **Scope Filtering**: Blocked items don't appear in `topmost_clothing` scope
2. **Action Validation**: `can-remove-item` condition prevents blocked removal
3. **Dual Protection**: Two layers ensure realistic removal order

## Component Schema

```json
{
  "clothing:blocks_removal": {
    "blockedSlots": [
      {
        "slot": "legs", // Equipment slot to block
        "layers": ["base", "outer"], // Layers to block in that slot
        "blockType": "must_remove_first", // Type of blocking
        "reason": "Belt secures pants" // Optional explanation
      }
    ],
    "blocksRemovalOf": [
      // Optional: explicit item IDs
      "some_mod:specific_item_id"
    ]
  }
}
```

## Common Use Cases

### 1. Belt Blocking Pants

**Scenario**: Belt must be removed before pants can be removed.

**Implementation**:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "clothing:leather_belt",
  "description": "Leather belt with brass buckle",
  "components": {
    "core:name": {
      "text": "belt"
    },
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "torso_lower"
      },
      "allowedLayers": ["accessories"]
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        {
          "slot": "legs",
          "layers": ["base", "outer"],
          "blockType": "must_remove_first",
          "reason": "Belt secures pants at waist"
        }
      ]
    }
  }
}
```

### 2. Armor Blocking Underlying Clothing

**Scenario**: Plate armor completely blocks access to shirt and undershirt.

**Implementation**:

```json
{
  "id": "armor:plate_cuirass",
  "components": {
    "clothing:wearable": {
      "layer": "outer",
      "equipmentSlots": {
        "primary": "torso_upper"
      }
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        {
          "slot": "torso_upper",
          "layers": ["base", "underwear"],
          "blockType": "full_block",
          "reason": "Plate armor completely covers torso"
        }
      ]
    }
  }
}
```

### 3. Multiple Items Blocking Same Target

**Scenario**: Belt AND suspenders both block pants (both must be removed).

**Implementation**:

**Belt**:

```json
{
  "clothing:blocks_removal": {
    "blockedSlots": [
      {
        "slot": "legs",
        "layers": ["base"],
        "blockType": "must_remove_first"
      }
    ]
  }
}
```

**Suspenders**:

```json
{
  "clothing:blocks_removal": {
    "blockedSlots": [
      {
        "slot": "legs",
        "layers": ["base"],
        "blockType": "must_remove_first"
      }
    ]
  }
}
```

Both items block pants independently. Player must remove both before pants become removable.

### 4. Explicit Item ID Blocking

**Scenario**: Cursed ring prevents removal of specific artifact glove.

**Implementation**:

```json
{
  "id": "magic:cursed_ring",
  "components": {
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": {
        "primary": "hands"
      }
    },
    "clothing:blocks_removal": {
      "blocksRemovalOf": ["magic:artifact_glove"]
    }
  }
}
```

## Block Types

### must_remove_first (Standard)

This item must be removed before blocked items become accessible.

**Use Cases**:

- Belts blocking pants
- Boots blocking socks
- Outer jackets blocking inner layers

**Behavior**: Blocked items completely hidden from removal actions.

### must_loosen_first (Future)

This item must be loosened but not fully removed.

**Use Cases**:

- Belt can be loosened to allow pants removal
- Tie can be loosened to unbutton shirt

**Behavior**: Item state changes to "loosened", unblocking targets.

**Note**: Not yet implemented. Use `must_remove_first` for now.

### full_block (Complete Inaccessibility)

Complete blocking - items are fully inaccessible.

**Use Cases**:

- Heavy armor over clothing
- Sealed suits
- Restraints

**Behavior**: Same as `must_remove_first` currently, but semantically different.

## Field Reference

### blockedSlots

Array of slot/layer combinations to block.

**Fields**:

- `slot` (required): Equipment slot name (e.g., "legs", "torso_upper")
- `layers` (required): Array of layer names (e.g., ["base", "outer"])
- `blockType` (required): Type of blocking (see Block Types)
- `reason` (optional): Human-readable explanation

**Valid Slots**:

- `torso_upper`
- `torso_lower`
- `legs`
- `feet`
- `head_gear`
- `hands`
- `left_arm_clothing`
- `right_arm_clothing`

**Valid Layers**:

- `underwear` (innermost)
- `base`
- `outer`
- `accessories` (outermost)

### blocksRemovalOf

Array of specific item IDs to block.

**Format**: `"mod_id:item_id"`

**Example**: `["clothing:blue_jeans", "armor:leather_pants"]`

**Use When**: Blocking specific unique items (quest items, artifacts, etc.)

## Testing Your Blocking Configuration

### 1. Validate Schema

```bash
npm run validate
```

Ensures component follows correct schema.

### 2. Test In-Game

1. Create actor
2. Equip blocking item (e.g., belt)
3. Equip blocked item (e.g., pants)
4. Try to remove blocked item → should not appear in actions
5. Remove blocking item
6. Try to remove previously blocked item → should now appear

### 3. Check Logs

Enable debug logging:

```javascript
// In console
window.game.setLogLevel('debug');
```

Look for messages like:

- "Filtering blocked item from topmost_clothing"
- "Item removal blocked by slot rules"

## Common Issues

### Issue: Item Blocking Itself

**Symptom**: Item with blocking component doesn't appear in topmost_clothing.

**Cause**: Blocking rule matches the item itself.

**Solution**: Ensure blocking rules target different slots or layers than the item occupies.

**Example**:

```json
// WRONG: Belt blocks itself
{
  "clothing:wearable": {
    "layer": "accessories",
    "equipmentSlots": { "primary": "torso_lower" }
  },
  "clothing:blocks_removal": {
    "blockedSlots": [
      {
        "slot": "torso_lower",      // Same slot!
        "layers": ["accessories"]   // Same layer!
      }
    ]
  }
}

// RIGHT: Belt blocks pants
{
  "clothing:wearable": {
    "layer": "accessories",
    "equipmentSlots": { "primary": "torso_lower" }
  },
  "clothing:blocks_removal": {
    "blockedSlots": [
      {
        "slot": "legs",            // Different slot
        "layers": ["base"]         // Different layer
      }
    ]
  }
}
```

### Issue: Circular Blocking

**Symptom**: None of the items can be removed.

**Cause**: Item A blocks B, Item B blocks A (circular dependency).

**Solution**: Validate mod with circular dependency detection:

```bash
npm run validate:strict
```

**Prevention**: Design blocking hierarchies (accessories → outer → base → underwear).

### Issue: Blocking Not Working

**Symptom**: Blocked items still appear in topmost_clothing.

**Debugging**:

1. **Check component exists**:
   - Verify `clothing:blocks_removal` in entity definition

2. **Check schema validation**:
   - Run `npm run validate`
   - Look for validation errors

3. **Check slot/layer names**:
   - Ensure exact match (case-sensitive)
   - Use valid slot and layer names

4. **Check operator registration**:
   - Ensure `isRemovalBlocked` operator registered
   - Check DI container logs

5. **Enable debug logging**:
   - Look for filtering messages
   - Verify blocking logic executing

## Best Practices

### 1. Use Slot-Based Blocking When Possible

✅ **Good**: Block all pants with belt

```json
{
  "blockedSlots": [
    {
      "slot": "legs",
      "layers": ["base", "outer"]
    }
  ]
}
```

❌ **Bad**: Block each pants entity individually

```json
{
  "blocksRemovalOf": [
    "clothing:jeans",
    "clothing:slacks",
    "clothing:shorts"
    // ... hundreds of items
  ]
}
```

### 2. Provide Reason Field

✅ **Good**:

```json
{
  "blockType": "must_remove_first",
  "reason": "Belt secures pants at waist"
}
```

❌ **Bad**:

```json
{
  "blockType": "must_remove_first"
  // No reason - harder to debug
}
```

### 3. Match Real-World Physics

Design blocking based on how clothing actually works:

- Accessories block outer layers (belts, buttons)
- Outer layers block base layers (jackets block shirts)
- Base layers block underwear (shirts block undershirts)

### 4. Test Thoroughly

- Test all blocked combinations
- Test removal order
- Test with multiple blocking items
- Test edge cases (empty equipment, self-blocking)

## Performance Considerations

The blocking system is optimized for performance:

- Checks only equipped items (not all game items)
- Early exits when no blocking component found
- O(n × m) complexity where n = equipped items, m = blocking rules

**Impact**: < 5ms per scope resolution with typical outfit (10-15 items).

**No optimization needed** for typical use cases.

## Future Enhancements

### Loosening Actions

Currently planned:

- `loosen_belt` action
- `must_loosen_first` block type implementation
- State-based blocking (buttoned/unbuttoned)

### Dynamic Blocking

State-dependent blocking rules:

- Buttoned jacket blocks shirt, unbuttoned doesn't
- Zipped dress blocks underwear, unzipped allows access

### Assistance Requirements

Some items require help to remove:

- Back-zippered dress
- Corset lacing
- Complex armor

## References

- Component Schema: `data/mods/clothing/components/blocks_removal.component.json`
- Operator Implementation: `src/logic/operators/isRemovalBlockedOperator.js`
- Service Integration: `src/clothing/services/clothingAccessibilityService.js` (handles blocking logic)
- Scope Integration: `src/scopeDsl/nodes/slotAccessResolver.js` (may need blocking integration)
- Example Entities: `data/mods/clothing/entities/definitions/*_belt.entity.json`
- Test Suite: `tests/integration/clothing/blockingEdgeCases.integration.test.js`

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review test examples in `tests/integration/clothing/`
3. Review specification: `specs/clothing-removal-blocking-system.spec.md`
4. Open issue on GitHub with mod configuration

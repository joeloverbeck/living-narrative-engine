# CLOREMBLO-008: Write Documentation

**Category**: Clothing System Enhancement
**Priority**: High
**Estimated Effort**: 3-4 hours
**Phase**: 6 - Testing & Documentation

---

## Overview

Create comprehensive documentation for the clothing removal blocking system, including user-facing modding guides, developer documentation, troubleshooting guides, and updates to existing documentation.

---

## Background

Documentation requirements:
1. **User-Facing**: How to use blocking in mods
2. **Developer**: System architecture and integration points
3. **Troubleshooting**: Common issues and solutions
4. **Examples**: Real-world use cases with code
5. **Updates**: Integrate with existing docs

All documentation must be:
- Clear and concise
- Include code examples
- Cover common use cases
- Explain edge cases
- Provide troubleshooting steps

---

## Documentation Tasks

### Task 1: Create Modding Guide

**File**: `docs/modding/clothing-blocking-system.md` (new)

**Content**:

```markdown
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
        "slot": "legs",                    // Equipment slot to block
        "layers": ["base", "outer"],       // Layers to block in that slot
        "blockType": "must_remove_first",  // Type of blocking
        "reason": "Belt secures pants"     // Optional explanation
      }
    ],
    "blocksRemovalOf": [                   // Optional: explicit item IDs
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
      "blocksRemovalOf": [
        "magic:artifact_glove"
      ]
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
    "clothing:shorts",
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
- Scope Integration: `src/scopeDsl/nodes/slotAccessResolver.js`
- Example Entities: `data/mods/clothing/entities/`

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test examples in `tests/integration/clothing/`
3. Open issue on GitHub with mod configuration
```

### Task 2: Update Existing Clothing Documentation

**File**: `docs/modding/clothing-system.md`

**Add Section**: "Removal Blocking"

Insert after the existing coverage mapping section:

```markdown
## Removal Blocking

The clothing system includes a blocking mechanism to enforce realistic removal order. Items can declare which other items or layers they block from removal while equipped.

### Overview

**Purpose**: Prevent unrealistic clothing removal scenarios (e.g., removing pants while belt is fastened).

**How It Works**:
1. Items with `clothing:blocks_removal` component declare blocking rules
2. Scope resolution filters out blocked items from `topmost_clothing`
3. Condition validation prevents blocked removal at action execution

### Component

Add `clothing:blocks_removal` to items that block other items:

```json
{
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
```

### Examples

**Belt Blocking Pants**:
```json
{
  "id": "clothing:belt",
  "components": {
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": { "primary": "torso_lower" }
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        { "slot": "legs", "layers": ["base"], "blockType": "must_remove_first" }
      ]
    }
  }
}
```

For detailed documentation, see [Clothing Blocking System](clothing-blocking-system.md).
```

### Task 3: Update Developer Documentation

**File**: `CLAUDE.md`

**Update Section**: "Development Guidelines" → Add subsection

Insert in appropriate location:

```markdown
### Clothing Removal Blocking System

The blocking system enforces realistic clothing physics by preventing removal of items that are secured by other items.

**Key Components**:
- `clothing:blocks_removal` component (data/mods/clothing/components/)
- `IsRemovalBlockedOperator` (src/logic/operators/)
- Scope filtering in `SlotAccessResolver` (src/scopeDsl/nodes/)
- `can-remove-item` condition (data/mods/clothing/conditions/)

**Integration Points**:
1. Component defines blocking rules
2. Operator evaluates blocking in JSON Logic
3. Resolver filters blocked items from `topmost_clothing`
4. Condition validates removal at action execution

**Usage Example**:
```json
{
  "clothing:blocks_removal": {
    "blockedSlots": [
      { "slot": "legs", "layers": ["base"], "blockType": "must_remove_first" }
    ]
  }
}
```

**Testing**: See `tests/integration/clothing/` for examples.

**Documentation**: See `docs/modding/clothing-blocking-system.md`.
```

### Task 4: Create Troubleshooting Guide

**File**: `docs/troubleshooting/clothing-blocking.md` (new)

**Content**:

```markdown
# Clothing Blocking System Troubleshooting

## Common Issues and Solutions

### Items Not Blocking as Expected

**Symptoms**:
- Blocked items still appear in topmost_clothing
- Actions show for items that should be blocked

**Diagnostic Steps**:

1. **Verify component exists**:
```bash
# Check entity definition
cat data/mods/YOUR_MOD/entities/YOUR_ITEM.entity.json
```

Look for `clothing:blocks_removal` component.

2. **Validate schema**:
```bash
npm run validate
```

Check for validation errors related to your mod.

3. **Check operator registration**:

Enable debug logging and look for:
```
[DEBUG] IsRemovalBlocked operator registered
[DEBUG] Filtering blocked item from topmost_clothing
```

4. **Verify slot/layer names**:

Ensure exact matches (case-sensitive):
- Slots: `torso_upper`, `torso_lower`, `legs`, etc.
- Layers: `underwear`, `base`, `outer`, `accessories`

**Common Causes**:

| Issue | Solution |
|-------|----------|
| Typo in slot name | Check spelling: `torso_upper` not `torso-upper` |
| Wrong layer name | Use valid layers: `base` not `normal` |
| Missing required fields | Ensure `slot`, `layers`, `blockType` present |
| Component not loaded | Check mod manifest includes component |

### Items Blocking Themselves

**Symptoms**:
- Item with blocking component doesn't appear in topmost_clothing
- Item can't be removed even when nothing else equipped

**Cause**: Blocking rule matches the item's own slot/layer.

**Solution**: Ensure blocking targets different slot or layer.

**Example**:

```json
// WRONG
{
  "clothing:wearable": {
    "layer": "accessories",
    "equipmentSlots": { "primary": "torso_lower" }
  },
  "clothing:blocks_removal": {
    "blockedSlots": [
      { "slot": "torso_lower", "layers": ["accessories"] }  // Blocks self!
    ]
  }
}

// RIGHT
{
  "clothing:wearable": {
    "layer": "accessories",
    "equipmentSlots": { "primary": "torso_lower" }
  },
  "clothing:blocks_removal": {
    "blockedSlots": [
      { "slot": "legs", "layers": ["base"] }  // Blocks different slot
    ]
  }
}
```

### Circular Blocking Dependencies

**Symptoms**:
- Multiple items can't be removed
- Validation errors about circular dependencies

**Cause**: Item A blocks B, Item B blocks A (or longer chains).

**Detection**:
```bash
npm run validate:strict
```

**Solution**: Redesign blocking hierarchy. Follow layer order:
- accessories → outer → base → underwear

**Prevention**: Never have items in higher layers block lower layers in same slot.

### Performance Issues

**Symptoms**:
- Slow scope resolution
- Lag when discovering actions

**Diagnostic**:

Check scope resolution time:
```javascript
console.time('topmost_clothing');
const topmost = scopeResolver.resolveTopmostClothing(actorId);
console.timeEnd('topmost_clothing');
```

**Expected**: < 5ms with typical outfit (10-15 items)

**If Slow**:

1. Check number of equipped items (target: < 20)
2. Check number of blocking rules per item (target: < 5)
3. Enable performance logging:
```javascript
window.game.setLogLevel('debug');
```

**Optimization**:
- Reduce blocking rules where possible
- Use slot-based blocking instead of many explicit IDs
- Combine multiple blocking rules into one

### Validation Errors

**Error**: `"Unknown operation type: SOME_OPERATION"`

**Cause**: Operation not in pre-validation whitelist.

**Solution**: Not related to blocking system. Check operation handler registration.

---

**Error**: `"No schema found for clothing:blocks_removal"`

**Cause**: Component schema not loaded.

**Solution**:
1. Verify component file exists: `data/mods/clothing/components/blocks_removal.component.json`
2. Check mod manifest includes component reference
3. Run `npm run validate`

---

**Error**: `"Property 'blockedSlots' is required"`

**Cause**: Component missing required field.

**Solution**: Must have either `blockedSlots` OR `blocksRemovalOf`:

```json
{
  "clothing:blocks_removal": {
    "blockedSlots": [
      { "slot": "legs", "layers": ["base"], "blockType": "must_remove_first" }
    ]
  }
}
```

---

**Error**: `"Invalid block type: 'some_value'"`

**Cause**: Block type not in enum.

**Solution**: Use valid block type:
- `must_remove_first`
- `must_loosen_first`
- `full_block`

## Debug Workflow

### 1. Enable Debug Logging

```javascript
// In browser console
window.game.setLogLevel('debug');
```

### 2. Check Component Loading

Look for:
```
[DEBUG] Loaded component: clothing:blocks_removal
```

### 3. Check Operator Registration

Look for:
```
[DEBUG] Registered operator: isRemovalBlocked
```

### 4. Check Scope Resolution

Look for:
```
[DEBUG] Filtering blocked item from topmost_clothing
[DEBUG] Item removal blocked by slot rules
```

### 5. Test Manually

```javascript
// Get actor
const actor = game.entityManager.getEntities(['core:actor'])[0];

// Equip items
game.entityManager.addComponent(actor.id, 'clothing:equipment', { ... });

// Resolve scope
const topmost = game.scopeResolver.resolveTopmostClothing(actor.id);

console.log('Topmost clothing:', topmost);
```

## Getting Help

If issues persist:

1. **Check test examples**: `tests/integration/clothing/`
2. **Review specification**: `specs/clothing-removal-blocking-system.spec.md`
3. **Open GitHub issue** with:
   - Entity definition
   - Expected behavior
   - Actual behavior
   - Debug logs
```

### Task 5: Create Changelog Entry

**File**: `CHANGELOG.md` (if exists)

Add entry:

```markdown
## [Unreleased]

### Added
- Clothing removal blocking system
  - New `clothing:blocks_removal` component for declaring blocking rules
  - `isRemovalBlocked` JSON Logic operator for blocking evaluation
  - Scope filtering in `topmost_clothing` to hide blocked items
  - `can-remove-item` condition for action validation
  - Belt entities updated to block pants removal
  - Comprehensive test suite for blocking scenarios
  - Documentation for modders and developers

### Changed
- `remove_clothing` action now includes `can-remove-item` prerequisite
- `remove_others_clothing` action now includes `can-remove-item` prerequisite
- Belt entities now include blocking component
```

---

## Validation

### Documentation Review

All documentation should be:
- [ ] Clear and concise
- [ ] Include code examples
- [ ] Cover common use cases
- [ ] Explain edge cases
- [ ] Provide troubleshooting steps
- [ ] Free of typos and grammatical errors
- [ ] Properly formatted (Markdown)
- [ ] Include links to related docs

### Link Validation

Check all internal links:
```bash
# Check for broken links
find docs -name "*.md" -exec grep -H '\[.*\](.*)' {} \;
```

### Code Example Validation

Verify all code examples:
- [ ] Valid JSON syntax
- [ ] Correct schema references
- [ ] Match actual implementation
- [ ] Test examples work

---

## Acceptance Criteria

- [ ] Modding guide created (`docs/modding/clothing-blocking-system.md`)
- [ ] Existing clothing docs updated with blocking section
- [ ] Developer documentation updated in `CLAUDE.md`
- [ ] Troubleshooting guide created
- [ ] Changelog entry added
- [ ] All documentation reviewed for clarity
- [ ] All code examples validated
- [ ] All internal links working
- [ ] No typos or grammatical errors

---

## Notes

### Documentation Structure

```
docs/
├── modding/
│   ├── clothing-system.md (updated)
│   └── clothing-blocking-system.md (new)
├── troubleshooting/
│   └── clothing-blocking.md (new)
└── architecture/
    └── (future: detailed system docs)

CLAUDE.md (updated)
CHANGELOG.md (updated)
```

### Examples to Include

Use examples from:
- Specification (specs/clothing-removal-blocking-system.spec.md)
- Test files (tests/integration/clothing/)
- Belt entity updates

### Target Audience

- **Modding Guide**: Content creators, mod developers
- **Developer Docs**: Engine contributors, system integrators
- **Troubleshooting**: All users experiencing issues

---

## Common Pitfalls

**Pitfall**: Documentation too technical for modders
**Solution**: Provide simple examples before complex scenarios

**Pitfall**: Code examples out of sync with implementation
**Solution**: Copy directly from working entity definitions

**Pitfall**: Missing edge cases in troubleshooting
**Solution**: Include common errors from test development

**Pitfall**: Broken links between docs
**Solution**: Use relative paths, validate links

---

## Related Tickets

- **CLOREMBLO-001**: Create blocks_removal component (document this)
- **CLOREMBLO-002**: Implement IsRemovalBlockedOperator (document this)
- **CLOREMBLO-003**: Register operator in DI (document this)
- **CLOREMBLO-004**: Integrate into scope resolver (document this)
- **CLOREMBLO-005**: Create condition and update actions (document this)
- **CLOREMBLO-006**: Update belt entities (use as examples)
- **CLOREMBLO-007**: Create comprehensive test suite (reference tests)

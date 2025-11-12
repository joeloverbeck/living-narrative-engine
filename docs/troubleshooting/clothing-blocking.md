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

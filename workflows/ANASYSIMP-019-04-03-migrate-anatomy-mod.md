# ANASYSIMP-019-04-03: Migrate Anatomy Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Anatomy Mod from Priority 1)
**Timeline:** 15 minutes (increased due to schema alignment needs)
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-02

## Overview

Migrate the 2 component schemas in the anatomy mod that have enum properties to use the new `validationRules` feature. This is part of Priority 1 (Core & Anatomy Mods) from the parent workflow.

**NOTE:** The anatomy mod body component schemas have been synchronized with the Body Descriptor Registry (as of 2025-11-12). All enum values now match the registry, including the enhanced horror/fantasy/medical vocabulary.

## Components to Migrate

1. **body** - Main body component with body descriptors (5 enum properties)
2. **sockets** - Socket definitions with orientation enums (1 enum property)

**Total:** 2 components with enums in `data/mods/anatomy/components/`

**Note:** The anatomy mod has 5 total component files, but only these 2 have enum properties:
- blueprintSlot.component.json - No enums
- body.component.json - ✓ Has 5 enum properties (4 active + 1 deprecated)
- joint.component.json - No enums
- part.component.json - No enums
- sockets.component.json - ✓ Has 1 enum property

## Schema Synchronization Status

✅ **The body.component.json enum values are now synchronized with the Body Descriptor Registry:**

| Descriptor | Component Schema | Registry | Status |
|------------|------------------|----------|--------|
| build | 20 values | 20 values | ✅ Synchronized (includes horror/fantasy values) |
| composition | 16 values | 16 values | ✅ Synchronized (includes horror/fantasy values) |
| height | 11 values | 11 values | ✅ Synchronized (includes scale extremes) |
| hairDensity | 7 values | 7 values | ✅ Synchronized |
| density | 6 values | N/A | ⚠️ DEPRECATED field (use hairDensity instead) |

**Synchronization completed:** 2025-11-12

All enhanced vocabulary for horror, fantasy, and medical scenarios is now available in the component schema.

## Reference Documentation

Before starting, review:
- **Body Descriptors Guide**: `docs/anatomy/body-descriptors-complete.md`
  - Registry architecture (lines 16-107)
  - Current descriptors and valid values (lines 33-42)
  - Enhanced vocabulary for horror/fantasy/medical scenarios (lines 46-52)
- **Anatomy System Guide**: `docs/anatomy/anatomy-system-guide.md`
  - Descriptor Registry Quick Reference (lines 163-172)
- **Parent Workflow**: `workflows/ANASYSIMP-019-04-migrate-components-validation-rules.md`

## Standard ValidationRules Template

Use this template for all components:

```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid {propertyName}: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "{PropertyLabel} is required",
      "invalidType": "Invalid type for {propertyName}: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

## Implementation Steps

### Step 1: Verify Anatomy Mod Components with Enums

Verify the 2 anatomy mod components with enum properties:

```bash
# List all anatomy mod components
ls -la data/mods/anatomy/components/

# Find components with enum properties (should return 2 files)
grep -l '"enum"' data/mods/anatomy/components/*.component.json

# Expected output:
# data/mods/anatomy/components/body.component.json
# data/mods/anatomy/components/sockets.component.json

# Review the enum properties in each component
echo "=== body.component.json ==="
jq '.dataSchema.properties.body.properties.descriptors.properties | to_entries[] | select(.value.enum) | "\(.key): \(.value.enum | length) values"' data/mods/anatomy/components/body.component.json

echo ""
echo "=== sockets.component.json ==="
jq '.dataSchema.properties.sockets.items.properties.orientation.anyOf[0].enum | length' data/mods/anatomy/components/sockets.component.json
echo "orientation: 16 predefined values + pattern for custom values"
```

**Expected Results:**
- body.component.json: 5 enum properties
  - build: 20 values (synchronized with registry)
  - composition: 16 values (synchronized with registry)
  - height: 11 values (synchronized with registry)
  - hairDensity: 7 values (synchronized with registry)
  - density: 6 values (deprecated)
- sockets.component.json: 1 enum property (orientation with 16 predefined values)

### Step 2: Migrate Each Component

For each component file:

#### Component: body

**File:** `data/mods/anatomy/components/body.component.json`

**Properties with Enums (5 total):**
1. `body.descriptors.build` - 20 enum values (synchronized with registry, includes horror/fantasy vocabulary)
2. `body.descriptors.composition` - 16 enum values (synchronized with registry, includes horror/fantasy vocabulary)
3. `body.descriptors.height` - 11 enum values (synchronized with registry, includes scale extremes)
4. `body.descriptors.hairDensity` - 7 enum values (synchronized with registry)
5. `body.descriptors.density` - 6 enum values (DEPRECATED - use hairDensity instead)

**✅ Schema Synchronized:**
The enum values in this component have been synchronized with the Body Descriptor Registry. All enhanced vocabulary (horror, fantasy, medical scenarios) is now available.

**Migration Process:**
1. Read the component schema:
   ```bash
   cat data/mods/anatomy/components/body.component.json | jq '.'
   ```

2. Add validationRules block after dataSchema (not inside it)

3. Use generic error messages since this component has 5 different enum properties

**ValidationRules for body component:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid body descriptor value: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Body descriptor is required",
      "invalidType": "Invalid type for body descriptor: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

**Note:** Generic messages are used because the component has 5 different enum properties (build, composition, height, hairDensity, and deprecated density). The validation framework will apply these messages to all enum violations.

#### Component: sockets

**File:** `data/mods/anatomy/components/sockets.component.json`

**Property with Enum:**
- `sockets[].orientation` - Spatial orientation of socket attachment points
  - 16 predefined enum values: left, right, mid, upper, lower, front, back, left_front, right_front, left_rear, right_rear, anterior, anterior_right, posterior_right, posterior, posterior_left, anterior_left
  - PLUS a pattern match `^[a-z0-9]+(?:_[a-z0-9]+)*$` for custom orientations
  - Uses `anyOf` schema combining the enum and the pattern

**Note on allowedTypes:**
The sockets component also has an `allowedTypes` array property, but this is NOT an enum - it's an array of strings representing part type names (e.g., "head", "arm", "leg"). Only the `orientation` property has an enum.

**Migration Process:**
1. Read the component schema:
   ```bash
   cat data/mods/anatomy/components/sockets.component.json | jq '.'
   ```

2. Add validationRules block after dataSchema

3. Customize error messages for orientation property

**ValidationRules for sockets component:**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid socket orientation: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Socket orientation is required",
      "invalidType": "Invalid type for socket orientation: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

**Note:** The orientation property uses `anyOf` with both an enum and a pattern. The validationRules will apply to the enum portion, while custom orientations matching the pattern will still be allowed.

**No Additional Components**

The anatomy mod has 5 total component files, but only 2 have enum properties (body and sockets). The other 3 component files do not have enum properties:
- blueprintSlot.component.json - No enums
- joint.component.json - No enums
- part.component.json - No enums

**Verification:**
```bash
# Verify no other anatomy components have enums
for file in data/mods/anatomy/components/*.component.json; do
  if grep -q '"enum"' "$file"; then
    echo "$(basename $file): HAS ENUM"
  else
    echo "$(basename $file): no enum"
  fi
done

# Expected output:
# blueprintSlot.component.json: no enum
# body.component.json: HAS ENUM
# joint.component.json: no enum
# part.component.json: no enum
# sockets.component.json: HAS ENUM
```

### Step 3: Validate After Each Component

Run validation after migrating each component:

```bash
# Validate schema structure
npm run validate

# Check for errors
echo $?  # Should be 0

# Specific anatomy validation (validates body descriptor registry consistency)
npm run validate:body-descriptors
```

**Note:** The `validate:body-descriptors` command checks that the Body Descriptor Registry, schema, and formatting configuration are aligned. Since body.component.json has been synchronized with the registry, this validation will confirm consistency across all anatomy system components.

### Step 4: Commit Batch

After both anatomy mod components are migrated:

```bash
# Stage changes (only the 2 files with enums)
git add data/mods/anatomy/components/body.component.json
git add data/mods/anatomy/components/sockets.component.json

# Commit with descriptive message
git commit -m "feat(validation): add validationRules to anatomy mod components

- Add validationRules to body component (5 enum properties)
- Add validationRules to sockets component (orientation enum)
- Enable enhanced error messages with similarity suggestions
- Body component enums synchronized with Body Descriptor Registry
- Includes full horror/fantasy/medical vocabulary support
- Part of ANASYSIMP-019-04 migration (Priority 1: Anatomy Mod)"

# Verify commit
git log -1 --stat
```

**Note:** This commit adds validationRules to already-synchronized component schemas. The body.component.json enum values were synchronized with the Body Descriptor Registry prior to this migration.

## Validation Checklist

After migration, verify:

- [ ] Both anatomy mod components with enums have validationRules
  - [ ] body.component.json has validationRules
  - [ ] sockets.component.json has validationRules
- [ ] Error messages use appropriate terminology
  - [ ] Body component uses generic "body descriptor" wording (5 enum properties)
  - [ ] Sockets component uses "socket orientation" wording
- [ ] Template variables use double braces: `{{value}}`, `{{validValues}}`, `{{expected}}`, `{{actual}}`
- [ ] All required properties present: generateValidator, errorMessages, suggestions
- [ ] `npm run validate` passes (exit code 0)
- [ ] `npm run validate:body-descriptors` passes
- [ ] No JSON syntax errors
- [ ] Changes committed to git
- [ ] Verified enum synchronization is complete

## Acceptance Criteria

- [ ] Exactly 2 components migrated with validationRules (body and sockets)
- [ ] Both components pass schema validation
- [ ] Error messages customized appropriately:
  - [ ] Body component uses generic messages (has 5 different enum properties)
  - [ ] Sockets component uses orientation-specific messages
- [ ] Similarity suggestions enabled (maxDistance: 3, maxSuggestions: 3)
- [ ] Anatomy system validation passes (`npm run validate:body-descriptors`)
- [ ] Batch committed to git with clear message
- [ ] No breaking changes introduced
- [ ] Enum values verified as synchronized with Body Descriptor Registry
- [ ] Full horror/fantasy/medical vocabulary now available in validation

## Common Pitfalls

### Pitfall 1: Wrong Template Variable Syntax
**Problem:** Using `{value}` instead of `{{value}}`
**Solution:** Always use double braces: `{{value}}`, `{{validValues}}`, `{{expected}}`, `{{actual}}`

### Pitfall 2: Generic Error Messages
**Problem:** Using "Invalid value" for anatomy-specific properties
**Solution:** Use domain-specific terminology: "Invalid socket type", "Invalid body property"

### Pitfall 3: Not Running Body Descriptor Validation
**Problem:** Missing anatomy-specific validation checks
**Solution:** Run `npm run validate:body-descriptors` in addition to `npm run validate`

### Pitfall 4: Multiple Enum Properties
**Problem:** Component has multiple enum properties (like body with 5 enums), unclear which to reference in messages
**Solution:** Use generic messages like "Invalid body descriptor value: {{value}}" that apply to all enum properties

### Pitfall 5: Deprecated Density Field
**Problem:** The deprecated `density` field is still present in the schema
**Solution:** Keep it for backward compatibility but ensure new code uses `hairDensity` instead. The deprecated field has a clear description marking it as deprecated.

## Special Considerations

### Body Component

**Synchronized State (as of 2025-11-12):**
- Component has 5 enum properties in `body.descriptors`:
  1. build (20 values) - ✅ synchronized with registry, includes horror/fantasy values
  2. composition (16 values) - ✅ synchronized with registry, includes horror/fantasy values
  3. height (11 values) - ✅ synchronized with registry, includes scale extremes
  4. hairDensity (7 values) - ✅ synchronized with registry
  5. density (6 values) - ⚠️ DEPRECATED field (kept for backward compatibility)
- Free-form properties (skinColor, smell) have no enums (as designed)

**Enhanced Vocabulary Now Available:**
- **Build**: Includes frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky
- **Composition**: Includes atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting
- **Height**: Includes microscopic, minuscule, colossal, titanic

**Impact:**
- All registry values are now accepted by the component schema
- Full horror/fantasy/medical vocabulary support in validation
- Enhanced validationRules will provide clear error messages for the complete value range

### Sockets Component

**Current State:**
- Single enum property: `orientation` with 16 predefined spatial values
- Also accepts custom orientations via pattern match: `^[a-z0-9]+(?:_[a-z0-9]+)*$`
- Uses `anyOf` schema combining enum and pattern

**Important:** The sockets component does NOT have a "socket types" enum. The `allowedTypes` property is an array of strings (part type names like "head", "arm"), not an enum. Only the `orientation` property has an enum.

## Integration with Anatomy System

After migration, enhanced validation will improve:
- **Body Descriptor Validation**: Better error messages when validating body descriptors in anatomy recipes
  - Example: "Invalid body descriptor value: 'athlethic'. Valid options: skinny, slim, lissom, toned, athletic, ..." with suggestion "Did you mean: athletic?"
  - Now includes full horror/fantasy/medical vocabulary (rotting, cadaverous, titanic, etc.)
- **Socket Orientation Validation**: Clearer errors for socket orientation mismatches
  - Example: "Invalid socket orientation: 'lft'. Valid options: left, right, mid, ..." with suggestion "Did you mean: left?"
- **Runtime Validation**: More helpful anatomy generation error messages during entity creation
- **Developer Experience**: Similarity suggestions reduce time debugging typos in mod development

**Enhanced Vocabulary Support:**
Since body.component.json enum values are synchronized with the registry, the enhanced validation now covers the complete range of horror/fantasy/medical vocabulary including extreme values like "microscopic", "titanic", "rotting", and "cadaverous".

## Time Estimate

- Component verification: 2 minutes
- Migration (2 components × 3 minutes each): 6 minutes
  - body component: 3 minutes (5 enum properties, needs generic messages)
  - sockets component: 3 minutes (1 enum property, straightforward)
- Validation: 2 minutes (schema validation + body descriptor validation)
- Commit: 1 minute
- **Total:** ~11 minutes

**Note:** Reduced from initial 15-minute estimate because:
- Enum synchronization completed prior to this migration
- No need to document discrepancies or create follow-up tickets
- Simpler workflow with synchronized schemas

## Synchronization History

### Completed: Synchronize body.component.json with Body Descriptor Registry

**Completed:** 2025-11-12
**Time Spent:** 15 minutes

**Changes Applied:**
1. ✅ Updated build enum: Added 9 horror/fantasy values (frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky)
2. ✅ Updated composition enum: Added 9 horror/fantasy values (atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting)
3. ✅ Updated height enum: Added 4 scale extreme values (microscopic, minuscule, colossal, titanic)
4. ✅ Validated with `npm run validate:body-descriptors` - all checks passed

**Result:**
- build: 20 values (synchronized with registry)
- composition: 16 values (synchronized with registry)
- height: 11 values (synchronized with registry)
- hairDensity: 7 values (already synchronized)
- density: 6 values (kept as deprecated for backward compatibility)

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-04**: Migrate clothing mod components

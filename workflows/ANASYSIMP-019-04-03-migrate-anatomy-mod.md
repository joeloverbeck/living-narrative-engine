# ANASYSIMP-019-04-03: Migrate Anatomy Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Anatomy Mod from Priority 1)
**Timeline:** 15 minutes (increased due to schema alignment needs)
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-02

## Overview

Migrate the 2 component schemas in the anatomy mod that have enum properties to use the new `validationRules` feature. This is part of Priority 1 (Core & Anatomy Mods) from the parent workflow.

**IMPORTANT:** The anatomy mod body component schemas are **outdated** and contain fewer enum values than the Body Descriptor Registry. This migration will add validationRules but will NOT update the enum values - that should be handled in a separate schema synchronization task.

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

## Critical Schema Discrepancy Alert

⚠️ **The body.component.json enum values are outdated compared to the Body Descriptor Registry:**

| Descriptor | Component Schema | Registry | Missing Values |
|------------|------------------|----------|----------------|
| build | 11 values | 20 values | 9 horror/fantasy values (frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky) |
| composition | 7 values | 16 values | 9 horror/fantasy values (atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting) |
| height | 7 values | 11 values | 4 scale values (microscopic, minuscule, colossal, titanic) |
| hairDensity | 7 values | 7 values | ✓ Matches |
| density | 6 values | N/A | DEPRECATED field (use hairDensity instead) |

**Recommendation:** File a separate ticket to synchronize body.component.json enum values with the registry after this validationRules migration is complete.

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
- body.component.json: 5 enum properties (build, composition, height, hairDensity, density)
- sockets.component.json: 1 enum property (orientation with 16 predefined values)

### Step 2: Migrate Each Component

For each component file:

#### Component: body

**File:** `data/mods/anatomy/components/body.component.json`

**Properties with Enums (5 total):**
1. `body.descriptors.build` - 11 enum values (skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky)
2. `body.descriptors.composition` - 7 enum values (underweight, lean, average, soft, chubby, overweight, obese)
3. `body.descriptors.height` - 7 enum values (gigantic, very-tall, tall, average, short, petite, tiny)
4. `body.descriptors.hairDensity` - 7 enum values (hairless, sparse, light, moderate, hairy, very-hairy, furred)
5. `body.descriptors.density` - 6 enum values (DEPRECATED - use hairDensity instead)

**⚠️ Schema Sync Issue:**
The enum values in this component are outdated compared to the Body Descriptor Registry. This migration will add validationRules to the existing enums but will NOT update the enum values themselves. A follow-up ticket should be created to synchronize the enum values with the registry.

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

**Note:** The `validate:body-descriptors` command checks that the Body Descriptor Registry, schema, and formatting configuration are aligned. Since the body.component.json has outdated enum values, this validation will NOT catch that discrepancy - it only validates the registry itself and recipe usage.

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
- Note: body component enum values still outdated vs registry (follow-up needed)
- Part of ANASYSIMP-019-04 migration (Priority 1: Anatomy Mod)"

# Verify commit
git log -1 --stat
```

**Important:** This commit adds validationRules but does NOT update the outdated enum values in body.component.json. A follow-up ticket should be created to synchronize the enum values with the Body Descriptor Registry.

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
- [ ] Follow-up ticket created for body component enum synchronization

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
- [ ] Documentation updated noting the enum value discrepancy
- [ ] Follow-up ticket created for synchronizing body.component.json enums with registry

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

### Pitfall 5: Outdated Enum Values
**Problem:** body.component.json enum values don't match the Body Descriptor Registry
**Solution:** This migration adds validationRules but does NOT fix the enum mismatch. Create a follow-up ticket for schema synchronization

## Special Considerations

### Body Component

**Critical Issue:** The body component has outdated enum values compared to the Body Descriptor Registry.

**Current State:**
- Component has 5 enum properties in `body.descriptors`:
  1. build (11 values vs 20 in registry) - missing 9 horror/fantasy values
  2. composition (7 values vs 16 in registry) - missing 9 horror/fantasy values
  3. height (7 values vs 11 in registry) - missing 4 scale values
  4. hairDensity (7 values) - matches registry ✓
  5. density (6 values) - DEPRECATED field, should not be used
- Free-form properties (skinColor, smell) have no enums

**Impact of Outdated Enums:**
- Valid values in the registry (e.g., "titanic" height, "rotting" composition) will be rejected by the component schema
- This creates a mismatch between what the registry says is valid and what the schema accepts
- The enhanced validation from validationRules will help with error messages but won't fix the underlying enum mismatch

**Recommended Follow-up:**
Create a ticket to synchronize body.component.json enum values with the Body Descriptor Registry, including:
- Add missing 9 build values (frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky)
- Add missing 9 composition values (atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting)
- Add missing 4 height values (microscopic, minuscule, colossal, titanic)
- Consider removing deprecated density field

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
- **Socket Orientation Validation**: Clearer errors for socket orientation mismatches
  - Example: "Invalid socket orientation: 'lft'. Valid options: left, right, mid, ..." with suggestion "Did you mean: left?"
- **Runtime Validation**: More helpful anatomy generation error messages during entity creation
- **Developer Experience**: Similarity suggestions reduce time debugging typos in mod development

**Note:** Once the body.component.json enum values are synchronized with the registry in a follow-up ticket, the enhanced validation will cover the full range of horror/fantasy/medical vocabulary.

## Time Estimate

- Component verification: 2 minutes
- Migration (2 components × 3 minutes each): 6 minutes
  - body component: 3 minutes (5 enum properties, needs generic messages)
  - sockets component: 3 minutes (1 enum property, straightforward)
- Validation: 2 minutes (schema validation + body descriptor validation)
- Documentation: 2 minutes (note enum discrepancy in commit message)
- Commit: 1 minute
- Follow-up ticket creation: 2 minutes (for enum synchronization)
- **Total:** ~15 minutes

**Note:** Increased from original 8-minute estimate due to:
- Discovery of enum value discrepancies requiring documentation
- Need to create follow-up ticket for schema synchronization
- More complex body component (5 enum properties vs expected simple case)

## Follow-up Work Required

### Ticket: Synchronize body.component.json with Body Descriptor Registry

**Priority:** Medium
**Estimated Time:** 20 minutes

**Description:**
The body.component.json enum values are outdated compared to the Body Descriptor Registry. Synchronize the enum values to include all horror/fantasy/medical vocabulary enhancements.

**Changes Needed:**
1. Update build enum: Add 9 missing values (frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky)
2. Update composition enum: Add 9 missing values (atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting)
3. Update height enum: Add 4 missing values (microscopic, minuscule, colossal, titanic)
4. Consider removing deprecated density field (replaced by hairDensity)

**Reference:**
- Body Descriptor Registry: `src/anatomy/registries/bodyDescriptorRegistry.js`
- Current values listed in lines 47, 69, 80, 91

**Dependencies:**
- Must be done AFTER ANASYSIMP-019-04-03 (this workflow)
- Should validate with `npm run validate:body-descriptors`

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-04**: Migrate clothing mod components
- **Follow-up Ticket**: Synchronize body.component.json enums with registry

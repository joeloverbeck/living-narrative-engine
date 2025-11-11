# ANASYSIMP-019-04-03: Migrate Anatomy Mod Components

**Parent:** ANASYSIMP-019-04 (Migrate Components to Use ValidationRules)
**Phase:** 2 (Batch Migration - Priority 2)
**Timeline:** 8 minutes
**Status:** Not Started
**Dependencies:** ANASYSIMP-019-04-02

## Overview

Migrate 2-3 component schemas in the anatomy mod to use the new `validationRules` feature. This is the second priority batch due to its close relationship with the body descriptor system and well-defined anatomy structure.

## Components to Migrate

1. **body** - Main body component with descriptors
2. **sockets** - Socket definitions for anatomy attachment points
3. **Additional components** - Any other anatomy components with enum properties

**Location:** `data/mods/anatomy/components/*.component.json`

## Reference Documentation

Before starting, review:
- **Body Descriptors Guide**: `docs/anatomy/body-descriptors-complete.md`
  - Registry architecture (lines 36-106)
  - Current descriptors and valid values
  - Integration points (lines 207-223)
- **Anatomy System Guide**: `docs/anatomy/anatomy-system-guide.md`
- **Validation Workflow**: `docs/anatomy/validation-workflow.md`
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

### Step 1: Identify Anatomy Mod Components with Enums

List all anatomy mod components with enum properties:

```bash
# List all anatomy mod components
ls -la data/mods/anatomy/components/

# Find components with enum properties
grep -l '"enum"' data/mods/anatomy/components/*.component.json

# Review each component
for file in $(grep -l '"enum"' data/mods/anatomy/components/*.component.json); do
  echo "=== $file ==="
  jq '.dataSchema.properties | keys' "$file"
  echo ""
done
```

### Step 2: Migrate Each Component

For each component file:

#### Component: body

**File:** `data/mods/anatomy/components/body.component.json`

**Expected Properties with Enums:**
- Likely to have descriptors-related enums or size/scale enums
- Review actual component schema to identify specific enum properties

**Migration Process:**
1. Read the component schema:
   ```bash
   cat data/mods/anatomy/components/body.component.json | jq '.'
   ```

2. Identify all enum properties in dataSchema

3. Add validationRules block after dataSchema

4. Customize error messages with appropriate property names

**Example ValidationRules (customize based on actual properties):**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid body property: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Body property is required",
      "invalidType": "Invalid type for body property: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

**Note:** If body component has multiple enum properties, use generic messages or focus on the most important property.

#### Component: sockets

**File:** `data/mods/anatomy/components/sockets.component.json`

**Expected Properties with Enums:**
- Socket types (e.g., "head", "torso", "limb", "appendage")
- Socket states or capacities
- Review actual component schema to identify specific enum properties

**Migration Process:**
1. Read the component schema:
   ```bash
   cat data/mods/anatomy/components/sockets.component.json | jq '.'
   ```

2. Identify all enum properties in dataSchema

3. Add validationRules block after dataSchema

4. Customize error messages with socket-specific terminology

**Example ValidationRules (customize based on actual properties):**
```json
{
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid socket type: {{value}}. Valid options: {{validValues}}",
      "missingRequired": "Socket type is required",
      "invalidType": "Invalid type for socket: expected {{expected}}, got {{actual}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

#### Additional Components (if any)

**Discovery Process:**
```bash
# Check for additional anatomy components with enums
for file in $(grep -l '"enum"' data/mods/anatomy/components/*.component.json); do
  basename "$file"
done
```

For each additional component:
1. Read component schema
2. Identify enum properties
3. Follow standard migration pattern
4. Customize error messages appropriately

### Step 3: Validate After Each Component

Run validation after migrating each component:

```bash
# Validate schema structure
npm run validate

# Check for errors
echo $?  # Should be 0

# Specific anatomy validation
npm run validate:body-descriptors
```

### Step 4: Commit Batch

After all anatomy mod components are migrated:

```bash
# Stage changes
git add data/mods/anatomy/components/*.component.json

# Commit with descriptive message
git commit -m "feat(validation): add validationRules to anatomy mod components

- Add validationRules to body, sockets, and related components
- Enable enhanced error messages with similarity suggestions
- Align with anatomy system validation workflow
- Part of ANASYSIMP-019-04 migration"

# Verify commit
git log -1 --stat
```

## Validation Checklist

After migration, verify:

- [ ] All anatomy mod components with enums have validationRules
- [ ] Error messages use correct property names
- [ ] Template variables use double braces: `{{value}}`, `{{validValues}}`
- [ ] All required properties present: generateValidator, errorMessages, suggestions
- [ ] `npm run validate` passes (exit code 0)
- [ ] `npm run validate:body-descriptors` passes
- [ ] No JSON syntax errors
- [ ] Changes committed to git

## Acceptance Criteria

- [ ] 2-3 components migrated with validationRules
- [ ] All components pass schema validation
- [ ] Error messages customized with anatomy-specific property names
- [ ] Similarity suggestions enabled (maxDistance: 3, maxSuggestions: 3)
- [ ] Anatomy system validation passes
- [ ] Batch committed to git with clear message
- [ ] No breaking changes introduced

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
**Problem:** Component has multiple enum properties, unclear which to reference in messages
**Solution:** Use generic messages like "Invalid value: {{value}}" or focus on most important property

## Special Considerations

### Body Component

The body component is central to the anatomy system and may have:
- Descriptors-related properties (height, build, composition, etc.)
- Size/scale properties
- State properties (alive, injured, etc.)

**Important:** Ensure validationRules align with body descriptor registry if applicable.

### Sockets Component

Sockets are attachment points for anatomy parts:
- Socket types must align with blueprint definitions
- Socket capacities and states have specific valid values
- Validation is critical for anatomy generation workflow

**Important:** Error messages should help developers debug anatomy graph issues.

## Integration with Anatomy System

After migration, enhanced validation will improve:
- **Recipe Validation**: Better error messages during anatomy recipe loading
- **Blueprint Validation**: Clearer socket/slot compatibility errors
- **Runtime Validation**: More helpful anatomy generation error messages
- **Developer Experience**: Similarity suggestions for common typos

## Time Estimate

- Component discovery: 2 minutes
- Migration (2-3 components × 2 minutes each): 4-6 minutes
- Validation: 1 minute
- Commit: 1 minute
- **Total:** ~8 minutes

## Next Steps

After completion, proceed to:
- **ANASYSIMP-019-04-04**: Migrate clothing mod components (Priority 3)

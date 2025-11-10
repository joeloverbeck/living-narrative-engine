# Anatomy System Error Catalog

This comprehensive catalog documents all common anatomy system errors with searchable signatures, diagnostic steps, and fix examples. This complements [`troubleshooting.md`](./troubleshooting.md) which provides problem-oriented troubleshooting.

**Use This Catalog For:**
- Looking up specific error messages
- Understanding error causes and properties
- Finding concrete fix examples

**Use Troubleshooting Guide For:**
- Problem-oriented scenarios ("Body parts not generated")
- Diagnostic workflows
- Architectural guidance

## Quick Reference Table

| Error Message | Error Class | Source | Section |
|---------------|-------------|--------|---------|
| **Load-Time Errors** ||||
| "Recipe validation failed" | RecipeValidationError | RecipePreflightValidator | [Validation Report Errors](#1-validation-report-errors) |
| "Component does not exist in the component registry" | ComponentNotFoundError | ComponentExistenceValidationRule | [Component Existence Errors](#2-component-existence-errors) |
| "Property has invalid value" | InvalidPropertyError | PropertySchemaValidationRule | [Property Schema Errors](#3-property-schema-errors) |
| "Pattern matched zero slots" | Pattern Matching Warning | patternMatchingValidator | [Pattern Matching Errors](#6-pattern-matching-errors) |
| "Blueprint-recipe mismatch" | Blueprint Validation Error | BlueprintRecipeValidationRule | [Blueprint/Recipe Compatibility Errors](#7-blueprintrecipe-compatibility-errors) |
| "Invalid 'requires' group" | Constraint Validation Error | Recipe constraint evaluator | [Constraint Validation Errors](#8-constraint-validation-errors) |
| **Runtime Errors** ||||
| "No entity definitions found matching anatomy requirements" | Entity Selection Error | PartSelectionService | [Entity/Part Selection Errors](#4-entitypart-selection-errors) |
| "Socket not found on parent entity" | SocketNotFoundError | Blueprint slot processing | [Socket/Slot Errors](#5-socketslot-errors) |
| "Cycle detected in anatomy graph" | Cycle Detection Error | CycleDetectionRule | [Runtime Anatomy Validation](#9-runtime-anatomy-validation-errors) |
| "Part type not allowed in socket" | Part Type Compatibility Error | PartTypeCompatibilityRule | [Runtime Anatomy Validation](#9-runtime-anatomy-validation-errors) |
| "Orphaned part has parent not in graph" | Orphan Detection Error | OrphanDetectionRule | [Runtime Anatomy Validation](#9-runtime-anatomy-validation-errors) |
| "Multiple root entities found" | Orphan Detection Warning | OrphanDetectionRule | [Runtime Anatomy Validation](#9-runtime-anatomy-validation-errors) |
| "Entity has incomplete joint data" | Joint Consistency Error | JointConsistencyRule | [Runtime Anatomy Validation](#9-runtime-anatomy-validation-errors) |
| "Socket not found on entity" | Socket Limit Error | SocketLimitRule | [Runtime Anatomy Validation](#9-runtime-anatomy-validation-errors) |
| "Invalid body descriptor enum value" | BodyDescriptorValidationError | Body descriptor validation | [Body Descriptor Validation](#10-body-descriptor-validation-errors) |

---

## 1. Validation Report Errors

### Error: "Recipe validation failed"

**Error Class:** RecipeValidationError
**Source:** `src/anatomy/validation/RecipePreflightValidator.js`

**Error Signature:**
```
Error: Recipe validation failed: anatomy:dragon_red
Recipe cannot be loaded due to 3 validation error(s)
```

**Error Properties:**
- `report`: Full ValidationReport object with errors, warnings, and suggestions
- `report.summary`: Summary with recipeId, errorCount, warningCount
- `report.errors`: Array of specific error objects
- `report.warnings`: Array of warning objects
- `report.suggestions`: Array of suggestion objects

**Symptom:** Recipe fails to load during mod initialization, anatomy generation blocked

**When It Occurs:**
- Load-time (during mod loading)
- Before runtime anatomy generation
- After all component and entity schemas validated

**Common Causes:**
1. **Multiple validation failures** - Combination of component, property, or pattern errors
2. **Component references invalid** - Components don't exist in registry
3. **Property values violate schemas** - Enum values, types don't match component schemas
4. **Pattern requirements too strict** - No entities can match the requirements

**Diagnostic Steps:**
1. Check full validation report in console output
2. Count errors: Prioritize fixing errors before warnings
3. Review each error in the report.errors array
4. Check related files listed in report
5. Verify RecipePreflightValidator configuration

**ValidationReport Structure:**
```javascript
{
  recipeId: "anatomy:dragon_red",
  recipePath: "data/mods/anatomy/recipes/dragon_red.recipe.json",
  timestamp: "2024-01-15T10:30:00.000Z",
  errors: [
    {
      severity: "error",
      ruleId: "component-existence",
      location: { type: "slot", name: "head" },
      message: "Component 'anatomy:horned' does not exist",
      // ... additional properties
    }
  ],
  warnings: [],
  suggestions: [],
  passed: ["socket-slot-compatibility", "pattern-matching"]
}
```

**Example Fix:**

Before (WRONG - Multiple errors):
```json
{
  "recipeId": "anatomy:dragon_red",
  "patterns": [
    {
      "partType": "dragon_wing",
      "components": ["anatomy:part", "descriptors:length_category"],
      "properties": {
        "descriptors:length_category": {
          "length": "vast"  // ❌ Invalid enum value
        }
      }
    }
  ]
}
```

After (CORRECT - Errors fixed):
```json
{
  "recipeId": "anatomy:dragon_red",
  "patterns": [
    {
      "partType": "dragon_wing",
      "components": ["anatomy:part", "descriptors:length_category"],
      "properties": {
        "descriptors:length_category": {
          "length": "immense"  // ✅ Valid enum value
        }
      }
    }
  ]
}
```

**Related Errors:**
- ComponentNotFoundError (specific component errors)
- InvalidPropertyError (specific property errors)
- Pattern matching failures (no entities found)

**Implementation References:**
- `src/anatomy/validation/RecipePreflightValidator.js` - Orchestrates all validation
- `src/anatomy/validation/ValidationReport.js` - Report structure
- `src/anatomy/errors/RecipeValidationError.js` - Error class

**Cross-Reference:** [`troubleshooting.md` - Blueprint-recipe mismatch](#../troubleshooting.md#2-blueprint-recipe-mismatch)

---

## 2. Component Existence Errors

### Error: "Component does not exist in the component registry"

**Error Class:** ComponentNotFoundError
**Source:** `src/anatomy/validation/rules/componentExistenceValidationRule.js`

**Error Signature:**
```
Error: Recipe 'anatomy:dragon_red', slot 'head'
Component 'anatomy:horned' does not exist in the component registry
slot cannot be processed, anatomy generation will fail
```

**Error Properties:**
- `recipeId`: Recipe where error occurred (e.g., `"anatomy:dragon_red"`)
- `location`: Location within recipe (e.g., `{type: 'slot', name: 'head'}`)
- `componentId`: Component that doesn't exist (e.g., `"anatomy:horned"`)
- `recipePath`: File path to recipe (if available)

**Symptom:** Recipe validation fails at load time, specific component reference is invalid

**When It Occurs:**
- Load-time (during mod loading and recipe validation)
- After schema validation, during component reference checking
- From Red Dragon Error Round 5

**Common Causes:**
1. **Component never created** - Component schema file doesn't exist
2. **Typo in component ID** - Misspelled component reference
3. **Mod not loaded** - Component's mod not in game.json dependencies
4. **Wrong namespace** - Using wrong mod ID prefix (e.g., `core:horned` vs `anatomy:horned`)

**Diagnostic Steps:**
1. Search for component file: `find data/mods -name "*horned.component.json"`
2. Check component registry: Verify component loaded successfully
3. Review recipe pattern/slot requirements
4. Verify mod loading order in game.json
5. Check component ID format: `modId:componentName`

**Example Fix:**

Before (WRONG - Component doesn't exist):
```json
// Recipe file: data/mods/anatomy/recipes/dragon_red.recipe.json
{
  "patterns": [
    {
      "components": ["anatomy:part", "anatomy:horned"]  // ❌ Component doesn't exist
    }
  ]
}
```

After (CORRECT - Create component):
```json
// NEW FILE: data/mods/anatomy/components/horned.component.json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:horned",
  "description": "Indicates entity has horns",
  "dataSchema": {
    "type": "object",
    "properties": {
      "hornCount": { "type": "number", "minimum": 1 },
      "hornType": {
        "type": "string",
        "enum": ["curved", "straight", "spiral"]
      }
    },
    "required": ["hornCount", "hornType"]
  }
}

// Recipe now works with component created
```

**Related Errors:**
- RecipeValidationError (parent error containing this)
- InvalidPropertyError (if component exists but properties wrong)

**Implementation References:**
- `src/anatomy/validation/rules/componentExistenceValidationRule.js:77-120` - Validation logic
- `src/anatomy/errors/ComponentNotFoundError.js` - Error class definition
- `docs/anatomy/anatomy-system-guide.md` - Component system architecture

**Cross-Reference:** [`troubleshooting.md` - Part selection failure](#../troubleshooting.md#4-part-selection-failure)

---

## 3. Property Schema Errors

### Error: "Property has invalid value"

**Error Class:** InvalidPropertyError
**Source:** `src/anatomy/validation/rules/propertySchemaValidationRule.js`

**Error Signature:**
```
Error: Recipe 'anatomy:dragon_red', slot 'wing_left', Component 'descriptors:length_category'
Property 'length' has invalid value 'vast'
Runtime validation will fail when entity is instantiated
```

**Error Properties:**
- `recipeId`: Recipe where error occurred
- `location`: Location within recipe (slot or pattern)
- `componentId`: Component containing invalid property
- `property`: Property name with invalid value
- `currentValue`: The invalid value
- `validValues`: Array of valid enum values (if applicable)
- `suggestion`: Suggested valid value
- `schemaPath`: Path to component schema

**Symptom:** Recipe validation fails, property value doesn't match component schema constraints

**When It Occurs:**
- Load-time (during property schema validation)
- After component existence check passes
- From Red Dragon Error Round 3

**Common Causes:**
1. **Invalid enum value** - Value not in schema's enum array (most common)
2. **Wrong data type** - String instead of number, etc.
3. **Out of range** - Number outside min/max bounds
4. **Missing required property** - Property not provided but schema requires it
5. **Additional properties** - Extra properties when `additionalProperties: false`

**Diagnostic Steps:**
1. Find component schema: `data/mods/*/components/${componentId.split(':')[1]}.component.json`
2. Check `dataSchema.properties[propertyName].enum` for valid values
3. Verify property type matches schema type
4. Check required properties in schema
5. Review component schema documentation

**Example Fix:**

Before (WRONG - Invalid enum value):
```json
// Recipe pattern
{
  "partType": "dragon_wing",
  "components": ["anatomy:part", "descriptors:length_category"],
  "properties": {
    "descriptors:length_category": {
      "length": "vast"  // ❌ Not in schema enum
    }
  }
}

// Component schema: data/mods/anatomy/components/length_category.component.json
{
  "dataSchema": {
    "properties": {
      "length": {
        "type": "string",
        "enum": ["tiny", "small", "medium", "large", "huge", "immense"]
      }
    }
  }
}
```

After (CORRECT - Valid enum value):
```json
// Recipe pattern
{
  "partType": "dragon_wing",
  "components": ["anatomy:part", "descriptors:length_category"],
  "properties": {
    "descriptors:length_category": {
      "length": "immense"  // ✅ Valid enum value
    }
  }
}
```

**Related Errors:**
- RecipeValidationError (parent error)
- ComponentNotFoundError (if component doesn't exist first)
- "Runtime component validation failed" (if this check is bypassed)

**Implementation References:**
- `src/anatomy/validation/rules/propertySchemaValidationRule.js` - Validation logic
- `src/anatomy/errors/InvalidPropertyError.js` - Error class definition
- Component schema files in `data/mods/*/components/`

**Cross-Reference:** [`troubleshooting.md` - Part selection failure](#../troubleshooting.md#4-part-selection-failure)

---

## 4. Entity/Part Selection Errors

### Error: "No entity definitions found matching anatomy requirements"

**Error Class:** Entity Selection Error (runtime exception, not AnatomyError subclass)
**Source:** `src/anatomy/partSelectionService.js:271-305`

**Error Signature:**
```
Error: No entity definitions found matching anatomy requirements.
Need part type: 'dragon_wing'. Allowed types: [wing]
Required components: [anatomy:part, descriptors:length_category]
```

**Error Properties:**
- `partType`: Required part type from recipe pattern
- `allowedTypes`: Socket's allowed types array
- `requirements`: Full requirements object (components, properties, partType)
- Location: Part selection during recipe processing (runtime)

**Symptom:** Pattern matching succeeds but entity selection fails, anatomy generation halts

**When It Occurs:**
- **Runtime** (during anatomy generation)
- After pattern matching succeeds
- Before entity instantiation
- **Most common error from Red Dragon case study** (Error Round 2)

**Common Causes:**
1. **partType/subType mismatch** - Entity's `subType` doesn't match recipe's `partType` (**CRITICAL** - see [`troubleshooting.md:264-487`](./troubleshooting.md#problem-parttypesubtype-mismatches))
2. **Missing required components** - Entity lacks components from pattern.tags or pattern.components
3. **Property value mismatches** - Entity component properties don't match pattern.properties
4. **Entity not loaded** - Mod dependency issue, entity file not loaded
5. **allowedTypes too restrictive** - Socket doesn't include the partType

**Diagnostic Steps:**
1. **Check partType/subType match (FIRST)**: Verify entity's `anatomy:part.subType` matches recipe's `partType` EXACTLY
2. Verify entity has all required components (pattern.components or pattern.tags)
3. Check component property values match (pattern.properties)
4. Verify `allowedTypes` array includes the `partType`
5. Confirm mod is loaded in game.json
6. Enable debug logging in PartSelectionService

**Example Fix:**

**Case 1: partType/subType Mismatch (Most Common)**

Before (WRONG):
```json
// Recipe pattern
{
  "partType": "dragon_wing",  // Specific type
  "components": ["anatomy:part", "descriptors:length_category"]
}

// Entity definition: data/mods/anatomy/entities/definitions/dragon_wing.entity.json
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:part": {
      "subType": "wing"  // ❌ MISMATCH! Generic type
    }
  }
}
```

After (CORRECT):
```json
// Entity definition - subType matches partType
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:part": {
      "subType": "dragon_wing"  // ✅ MATCHES recipe partType
    },
    "descriptors:length_category": { "length": "immense" }
  }
}

// Structure template - update allowedTypes too
{
  "socketPattern": {
    "allowedTypes": ["dragon_wing"]  // Updated from ["wing"]
  }
}
```

**Case 2: Missing Required Components**

Before (WRONG):
```json
// Recipe pattern
{
  "partType": "dragon_wing",
  "components": ["anatomy:part", "descriptors:length_category"]
}

// Entity definition
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:part": {
      "subType": "dragon_wing"
    }
    // ❌ Missing descriptors:length_category
  }
}
```

After (CORRECT):
```json
// Entity definition - includes all required components
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:part": {
      "subType": "dragon_wing"
    },
    "descriptors:length_category": {  // ✅ Added
      "length": "immense"
    }
  }
}
```

**Case 3: Property Value Mismatch**

Before (WRONG):
```json
// Recipe pattern
{
  "partType": "dragon_wing",
  "properties": {
    "descriptors:length_category": {
      "length": "vast"  // Recipe expects this value
    }
  }
}

// Entity definition
{
  "components": {
    "descriptors:length_category": {
      "length": "immense"  // ❌ Different value
    }
  }
}
```

After (CORRECT):
```json
// Align values - either change recipe or entity
// Option 1: Change recipe to match entity
{
  "properties": {
    "descriptors:length_category": {
      "length": "immense"  // ✅ Matches entity
    }
  }
}

// Option 2: Change entity to match recipe
{
  "components": {
    "descriptors:length_category": {
      "length": "vast"  // ✅ Matches recipe (if "vast" is valid)
    }
  }
}
```

**Validation Logic (PartSelectionService.js:271-305):**
```javascript
// Step 1: Check allowed types (with wildcard support)
if (!allowedTypes.includes('*') && !allowedTypes.includes(anatomyPart.subType)) {
  return false; // Entity rejected
}

// Step 2: Check part type requirement (CRITICAL CHECK)
if (requirements.partType && anatomyPart.subType !== requirements.partType) {
  return false; // Entity rejected - subType must EQUAL partType
}

// Step 3: Check required components
if (!hasAllRequiredComponents(entity, requirements.components)) {
  return false; // Entity rejected
}

// Step 4: Check property values
if (!propertiesMatch(entity, requirements.properties)) {
  return false; // Entity rejected
}

// All checks passed
return true;
```

**Related Errors:**
- "Runtime component validation failed" (if component validation comes after)
- "Pattern matched zero slots" (pattern matching validator warning)
- ComponentNotFoundError (at load time for missing components)

**Implementation References:**
- `src/anatomy/partSelectionService.js:271-305` - Validation logic
- [`troubleshooting.md:264-487`](./troubleshooting.md#problem-parttypesubtype-mismatches) - Detailed partType/subType guide
- `reports/anatomy-system-v2-improvements.md:190-196` - Red Dragon Error Round 2

**Cross-Reference:** [`troubleshooting.md` - partType/subType Mismatches](#../troubleshooting.md#problem-parttypesubtype-mismatches) (comprehensive guide)

---

## 5. Socket/Slot Errors

### Error: "Socket not found on parent entity"

**Error Class:** SocketNotFoundError
**Source:** Blueprint slot processing (slot-to-socket mapping)

**Error Signature:**
```
Error: Blueprint 'anatomy:dragon_common', Slot 'fire_gland'
Socket 'fire_gland' not found on root entity 'anatomy:dragon_torso'
Slot processing will fail during anatomy generation
```

**Error Properties:**
- `blueprintId`: Blueprint where error occurred
- `slotName`: Slot referencing the missing socket
- `socketId`: Socket ID that wasn't found
- `rootEntityId`: Root entity that should have the socket
- `availableSockets`: Array of available socket IDs on root entity
- `entityPath`: File path to root entity definition (if available)

**Symptom:** Blueprint slot references socket that doesn't exist on root entity, generation fails

**When It Occurs:**
- **Runtime** (during anatomy generation)
- During blueprint slot processing
- When mapping slots to sockets
- From Red Dragon Error Round 6

**Common Causes:**
1. **Blueprint additionalSlots misconfiguration** - Slots require sockets not on parent entity
2. **Socket removed from entity** - Entity updated but blueprint not updated
3. **Wrong entity used** - Blueprint expects different root entity structure
4. **Socket ID mismatch** - Typo or naming inconsistency

**Diagnostic Steps:**
1. Check root entity's `anatomy:sockets.sockets` array
2. List available socket IDs on root entity
3. Verify blueprint slot's `socket` field matches an available socket
4. Check if blueprint uses `additionalSlots` (V2 blueprints)
5. Review structure template socket patterns

**Example Fix:**

Before (WRONG - Socket doesn't exist):
```json
// Blueprint: data/mods/anatomy/blueprints/dragon_common.blueprint.json
{
  "blueprintId": "anatomy:dragon_common",
  "rootEntity": "anatomy:dragon_torso",
  "slots": {
    "fire_gland": {
      "socket": "fire_gland",  // ❌ Socket doesn't exist on root entity
      "partType": "fire_gland"
    }
  }
}

// Root entity: data/mods/anatomy/entities/definitions/dragon_torso.entity.json
{
  "id": "anatomy:dragon_torso",
  "components": {
    "anatomy:sockets": {
      "sockets": [
        { "id": "head", "allowedTypes": ["head"] },
        { "id": "tail", "allowedTypes": ["tail"] }
        // ❌ No "fire_gland" socket
      ]
    }
  }
}
```

After (CORRECT - Option 1: Add socket):
```json
// Root entity - add the missing socket
{
  "id": "anatomy:dragon_torso",
  "components": {
    "anatomy:sockets": {
      "sockets": [
        { "id": "head", "allowedTypes": ["head"] },
        { "id": "tail", "allowedTypes": ["tail"] },
        {  // ✅ Added socket
          "id": "fire_gland",
          "allowedTypes": ["gland", "fire_gland"],
          "orientation": "mid",
          "nameTpl": "{{type}}"
        }
      ]
    }
  }
}
```

After (CORRECT - Option 2: Remove blueprint slot):
```json
// Blueprint - remove the slot if socket shouldn't exist
{
  "blueprintId": "anatomy:dragon_common",
  "rootEntity": "anatomy:dragon_torso",
  "slots": {
    // ✅ Removed fire_gland slot
    "head": {
      "socket": "head",
      "partType": "dragon_head"
    }
  }
}
```

After (CORRECT - Option 3: Use existing socket):
```json
// Blueprint - map to existing socket
{
  "blueprintId": "anatomy:dragon_common",
  "slots": {
    "special_organ": {
      "socket": "mid_torso",  // ✅ Use existing socket
      "partType": "fire_gland"
    }
  }
}
```

**Related Errors:**
- "Blueprint-recipe mismatch" (broader compatibility issue)
- Pattern matching failures (if sockets define slot keys)

**Implementation References:**
- `src/anatomy/errors/SocketNotFoundError.js` - Error class definition
- Blueprint slot processing during anatomy generation
- `docs/anatomy/blueprints-and-templates.md` - Blueprint V2 architecture

**Cross-Reference:** [`troubleshooting.md` - Blueprint-recipe mismatch](#../troubleshooting.md#2-blueprint-recipe-mismatch)

---

## 6. Pattern Matching Errors

### Warning: "Pattern matched zero slots"

**Error Class:** Pattern Matching Warning (not a thrown error, debug/warning message)
**Source:** `src/anatomy/validation/patternMatchingValidator.js`

**Error Signature:**
```
Warning: Pattern matched zero slots in recipe 'anatomy:spider_garden'
Pattern requirements: { matchesGroup: "limbSet:leg", partType: "spider_leg" }
Blueprint slots checked: 8
No slots matched this pattern - check recipe pattern against blueprint structure
```

**Error Properties:**
- Recipe ID where pattern failed
- Pattern requirements (matchesGroup, matchesPattern, matchesAll)
- Number of blueprint slots checked
- Specific pattern details

**Symptom:** Recipe pattern doesn't match any blueprint slots, parts won't be generated for that pattern

**When It Occurs:**
- Load-time (during pattern matching validation)
- After blueprint and recipe loaded successfully
- During RecipePreflightValidator execution

**Common Causes:**
1. **Structure template changes** - Template slot keys changed, patterns not updated
2. **Orientation scheme mismatch** - Template uses different orientation than expected
3. **matchesGroup reference wrong** - limbSet ID changed or doesn't exist
4. **Pattern too specific** - Pattern requirements match no slots
5. **Template variable naming** - Variable names in template changed

**Diagnostic Steps:**
1. Check structure template's slot key format
2. Verify limbSet IDs in template topology
3. Compare pattern requirements to actual slot keys
4. Enable debug logging for pattern matching
5. Inspect blueprint.slots manually
6. Review orientationScheme in structure template

**Example Fix:**

**Case 1: matchesGroup Mismatch**

Before (WRONG):
```json
// Recipe pattern
{
  "matchesGroup": "limbSet:leg",  // References "leg" limbSet
  "partType": "spider_leg"
}

// Structure template
{
  "topology": {
    "limbSets": [
      {
        "id": "walking_legs",  // ❌ ID doesn't match pattern
        "count": { "min": 8, "max": 8 }
      }
    ]
  }
}
```

After (CORRECT - Option 1: Update recipe):
```json
// Recipe pattern
{
  "matchesGroup": "limbSet:walking_legs",  // ✅ Matches template ID
  "partType": "spider_leg"
}
```

After (CORRECT - Option 2: Update template):
```json
// Structure template
{
  "topology": {
    "limbSets": [
      {
        "id": "leg",  // ✅ Changed to match recipe
        "count": { "min": 8, "max": 8 }
      }
    ]
  }
}
```

**Case 2: Orientation Scheme Mismatch**

Before (WRONG):
```json
// Recipe pattern
{
  "matchesPattern": "leg_*",  // Expects "leg_1", "leg_2", etc.
  "partType": "spider_leg"
}

// Structure template
{
  "topology": {
    "limbSets": [{
      "id": "leg",
      "orientationScheme": "bilateral"  // ❌ Creates "leg_left", "leg_right"
    }]
  }
}
```

After (CORRECT - Use matchesGroup instead):
```json
// Recipe pattern - resilient to template changes
{
  "matchesGroup": "limbSet:leg",  // ✅ Works with any orientation scheme
  "partType": "spider_leg"
}
```

**Best Practices (Pattern Matching):**

1. **Prefer matchesGroup** over matchesPattern
   - More resilient to template changes
   - Survives orientation scheme updates
   - Recommended for limbSets and appendages

2. **Use matchesPattern for specific slots**
   - When you need exact slot keys
   - For slots not in limbSets

3. **Use matchesAll for broad application**
   - When pattern applies to all slots
   - Less common, use carefully

4. **Avoid hardcoded slot keys**
   - Templates can change slot key format
   - Use group references when possible

**Related Errors:**
- "No entity definitions found" (if patterns do match but entities are wrong)
- RecipeValidationError (parent validation error)

**Implementation References:**
- `src/anatomy/validation/patternMatchingValidator.js` - Validation logic
- [`recipe-pattern-matching.md`](./recipe-pattern-matching.md) - Complete pattern matching guide
- [`troubleshooting.md:21-52`](./troubleshooting.md#1-recipe-pattern-matching-failed) - Pattern matching debugging

**Cross-Reference:** [`troubleshooting.md` - Recipe pattern matching failed](#../troubleshooting.md#1-recipe-pattern-matching-failed)

---

## 7. Blueprint/Recipe Compatibility Errors

### Error: "Blueprint-recipe mismatch"

**Error Class:** Blueprint Validation Error
**Source:** `src/anatomy/validation/rules/blueprintRecipeValidationRule.js`

**Error Signature:**
```
Error: Recipe references non-existent blueprint 'anatomy:spider_common'
Blueprint not found in registry
Recipe cannot be processed, anatomy generation will fail
```

**Error Properties:**
- `recipeId`: Recipe with the mismatch
- `blueprintId`: Blueprint ID that doesn't exist or has issues
- Location: Recipe validation, blueprint resolution

**Symptom:** Recipe references blueprint that doesn't exist, has wrong structure, or is incompatible

**When It Occurs:**
- Load-time (during recipe validation)
- After blueprint loading attempt
- During RecipePreflightValidator checks

**Common Causes:**
1. **Blueprint doesn't exist** - Blueprint file not created or not loaded
2. **Blueprint ID mismatch** - Recipe references wrong ID
3. **Blueprint missing required fields** - Blueprint schema validation fails
4. **Mod loading order** - Blueprint's mod not loaded before recipe's mod
5. **Structure template error** - Template referenced by blueprint is invalid

**Diagnostic Steps:**
1. Search for blueprint file: `find data/mods -name "*blueprint.json"`
2. Check blueprint registry: Verify blueprint loaded
3. Validate blueprint against schema: `data/schemas/anatomy.blueprint.schema.json`
4. Check recipe's `blueprintId` field
5. Verify mod dependencies in mod-manifest.json
6. Review blueprint's required fields

**Example Fix:**

**Case 1: Blueprint Doesn't Exist**

Before (WRONG):
```json
// Recipe: data/mods/anatomy/recipes/spider_garden.recipe.json
{
  "recipeId": "anatomy:spider_garden",
  "blueprintId": "anatomy:spider_common"  // ❌ Blueprint doesn't exist
}

// No blueprint file found
```

After (CORRECT - Create blueprint):
```json
// NEW FILE: data/mods/anatomy/blueprints/spider_common.blueprint.json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "blueprintId": "anatomy:spider_common",
  "version": 2,
  "rootEntity": "anatomy:spider_body",
  "structureTemplate": "anatomy:structure_spider",
  "slots": {}
}

// Recipe now works
```

**Case 2: Blueprint ID Mismatch**

Before (WRONG):
```json
// Recipe
{
  "blueprintId": "anatomy:spider_v2"  // ❌ Wrong ID
}

// Blueprint file exists
{
  "blueprintId": "anatomy:spider_common"  // Actual ID
}
```

After (CORRECT):
```json
// Recipe - use correct ID
{
  "blueprintId": "anatomy:spider_common"  // ✅ Matches blueprint
}
```

**Case 3: Blueprint Missing Required Fields**

Before (WRONG):
```json
// Blueprint
{
  "blueprintId": "anatomy:spider_common",
  "version": 2
  // ❌ Missing rootEntity
  // ❌ Missing structureTemplate
}
```

After (CORRECT):
```json
// Blueprint - all required fields present
{
  "blueprintId": "anatomy:spider_common",
  "version": 2,
  "rootEntity": "anatomy:spider_body",  // ✅ Added
  "structureTemplate": "anatomy:structure_spider",  // ✅ Added
  "slots": {}
}
```

**Blueprint V2 Required Fields:**
- `blueprintId`: Unique identifier
- `version`: Must be `2` for V2 blueprints
- `rootEntity`: Entity ID for body center
- `structureTemplate`: Structure template ID for topology
- `slots`: Slot definitions (can be empty `{}` if using only template)

**Related Errors:**
- "Structure template error" (if template is invalid)
- "Socket not found" (if blueprint slots reference wrong sockets)
- RecipeValidationError (parent validation error)

**Implementation References:**
- `src/anatomy/validation/rules/blueprintRecipeValidationRule.js` - Validation logic
- [`blueprints-and-templates.md`](./blueprints-and-templates.md) - Blueprint V2 architecture
- `data/schemas/anatomy.blueprint.schema.json` - Blueprint schema

**Cross-Reference:** [`troubleshooting.md` - Blueprint-recipe mismatch](#../troubleshooting.md#2-blueprint-recipe-mismatch)

---

## 8. Constraint Validation Errors

### Error: "Invalid 'requires' group"

**Error Class:** Constraint Validation Error (schema validation error)
**Source:** Recipe constraint evaluator, schema validation

**Error Signature:**
```
Error: Invalid 'requires' group at index 0
'partTypes' must contain at least 2 items
Co-presence constraints require multiple parts
```

**Error Properties:**
- `constraintIndex`: Index in constraints array where error occurred
- `constraintType`: Type of constraint (e.g., 'requires', 'excludes')
- `validationMessage`: Specific constraint violation message

**Symptom:** Recipe constraint definition violates schema or business rules

**When It Occurs:**
- Load-time (during recipe schema validation)
- Before recipe processing
- From Red Dragon Error Round 1

**Common Causes:**
1. **Single part in requires** - Co-presence constraint needs at least 2 parts
2. **Invalid constraint format** - Doesn't match schema structure
3. **Wrong constraint type** - Using 'requires' when should be 'excludes' or vice versa
4. **Missing required fields** - Constraint object missing properties

**Diagnostic Steps:**
1. Review recipe's `constraints` array
2. Check constraint type: 'requires' vs 'excludes'
3. Count items in `partTypes` array
4. Validate constraint against schema
5. Review constraint business rules

**Example Fix:**

Before (WRONG - Single part in requires):
```json
// Recipe constraints
{
  "constraints": [
    {
      "type": "requires",
      "description": "Wings and horns appear together",
      "partTypes": ["dragon_horn"]  // ❌ Only 1 part - co-presence needs 2+
    }
  ]
}
```

After (CORRECT - Multiple parts):
```json
// Recipe constraints
{
  "constraints": [
    {
      "type": "requires",
      "description": "Wings and horns appear together",
      "partTypes": ["dragon_wing", "dragon_horn"]  // ✅ 2 parts - valid co-presence
    }
  ]
}
```

**Constraint Types:**

**1. Requires (Co-presence)**
```json
{
  "type": "requires",
  "description": "Parts that must appear together",
  "partTypes": ["part_a", "part_b"]  // Minimum 2 parts
}
```
- All listed parts must be present or all absent
- Enforces co-presence relationship

**2. Excludes (Mutual exclusion)**
```json
{
  "type": "excludes",
  "description": "Parts that cannot coexist",
  "partTypes": ["part_a", "part_b"]  // Can't both be present
}
```
- Only one (or none) of the listed parts can be present
- Enforces mutual exclusion

**Common Constraint Patterns:**

```json
{
  "constraints": [
    // ✅ VALID: Co-presence of wings and tail
    {
      "type": "requires",
      "partTypes": ["dragon_wing", "dragon_tail"]
    },

    // ✅ VALID: Exclude front legs if wings present
    {
      "type": "excludes",
      "partTypes": ["front_leg", "wing"]
    },

    // ❌ INVALID: Requires needs 2+ parts
    {
      "type": "requires",
      "partTypes": ["single_part"]
    },

    // ❌ INVALID: Missing partTypes
    {
      "type": "requires",
      "description": "Incomplete constraint"
    }
  ]
}
```

**Declarative Constraint Validation (Enhanced):**

As of ANASYSIMP-018, constraints support optional validation metadata for custom error messages and explanations. This makes constraints self-documenting and provides better error reporting.

**Validation Metadata Properties:**

For `requires` constraints:
- `minItems` (integer, minimum 2): Minimum number of items required for co-presence
- `errorMessage` (string): Custom error message when constraint violated
- `explanation` (string): Explanation logged for debugging/documentation

For `excludes` constraints:
- `mutuallyExclusive` (boolean): Indicates items are mutually exclusive
- `errorMessage` (string): Custom error message when constraint violated
- `explanation` (string): Explanation logged for debugging/documentation

**Enhanced Constraint Examples:**

```json
{
  "constraints": {
    "requires": [
      {
        "partTypes": ["dragon_wing", "dragon_tail"],
        "validation": {
          "minItems": 2,
          "errorMessage": "Dragons require both wings and tail for flight stability",
          "explanation": "Flight mechanics require wing-tail coordination for balance"
        }
      }
    ],
    "excludes": [
      {
        "components": ["anatomy:gills", "anatomy:lungs"],
        "validation": {
          "mutuallyExclusive": true,
          "errorMessage": "Cannot have both gills and lungs",
          "explanation": "Choose either aquatic (gills) or terrestrial (lungs)"
        }
      }
    ]
  }
}
```

**Benefits:**
- **Self-documenting**: Constraints explain themselves inline
- **Better errors**: Custom messages provide clearer guidance
- **Debugging aid**: Explanations logged when constraints fail
- **Backward compatible**: Validation metadata is optional; existing recipes continue to work with default error messages

**Usage Notes:**
- Validation metadata is entirely optional
- Default error messages used when validation metadata absent
- Explanations logged at debug level when provided
- All validation properties are optional within the validation object

**Related Errors:**
- RecipeValidationError (parent error containing constraint errors)
- Schema validation errors (if constraint structure is completely wrong)

**Implementation References:**
- Recipe constraint evaluator during generation
- `data/schemas/anatomy.recipe.schema.json` - Recipe schema with constraint definitions
- Constraint validation during RecipePreflightValidator

**Cross-Reference:** [`anatomy-system-guide.md`](./anatomy-system-guide.md) - Constraint system documentation

---

## 9. Runtime Anatomy Validation Errors

These errors occur during anatomy generation after a recipe has been loaded successfully. They validate the structural integrity of the generated anatomy graph. Unlike load-time validation errors (which prevent recipes from loading), runtime validation errors occur when anatomy is actually instantiated and assembled.

### Error: "Cycle detected in anatomy graph"

**Error Class:** Cycle Detection Error (runtime validation issue)
**Source:** `src/anatomy/validation/rules/cycleDetectionRule.js`

**Error Signature:**
```
Error: Cycle detected in anatomy graph
Entity 'anatomy:dragon_tail_segment_3' creates a cycle when referenced from 'anatomy:dragon_tail_segment_1'
```

**Error Properties:**
- `involvedEntities`: Array of entity IDs involved in the cycle
- `message`: Description of which entities form the cycle
- Location: Anatomy graph validation (post-generation)

**Symptom:** Anatomy graph contains a circular reference where a part is its own ancestor

**When It Occurs:**
- **Runtime** (during anatomy validation after generation)
- After all parts have been instantiated
- During graph structure validation
- Indicates serious structural problem

**Common Causes:**
1. **Joint parent chain loops back** - Entity A has parent B, which has parent C, which has parent A
2. **Self-referencing joint** - Entity has itself as parent
3. **Recipe pattern error** - Pattern creates circular dependencies
4. **Blueprint structure issue** - Blueprint defines impossible parent-child relationships

**Diagnostic Steps:**
1. Trace the joint parent chain for involved entities
2. Check anatomy:joint components for parentId values
3. Verify blueprint slot-to-socket mappings
4. Look for self-references in joint data
5. Review recipe constraints that might force circular structures

**Example Fix:**

Before (WRONG - Circular reference):
```json
// Entity A
{
  "id": "anatomy:part_a",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:part_b",  // A → B
      "socketId": "socket_1"
    }
  }
}

// Entity B
{
  "id": "anatomy:part_b",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:part_c",  // B → C
      "socketId": "socket_2"
    }
  }
}

// Entity C
{
  "id": "anatomy:part_c",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:part_a",  // C → A (CYCLE!)
      "socketId": "socket_3"
    }
  }
}
```

After (CORRECT - No cycle):
```json
// Entity C becomes the root
{
  "id": "anatomy:part_c",
  "components": {
    "anatomy:part": { "subType": "torso" }
    // ✅ No joint - this is the root
  }
}

// Entity B attaches to C
{
  "id": "anatomy:part_b",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:part_c",  // B → C
      "socketId": "socket_2"
    }
  }
}

// Entity A attaches to B
{
  "id": "anatomy:part_a",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:part_b",  // A → B → C (linear, no cycle)
      "socketId": "socket_1"
    }
  }
}
```

**Related Errors:**
- "Orphaned part" (if fixing cycle creates disconnected parts)
- "Joint consistency" errors (if joint data is malformed)

**Implementation References:**
- `src/anatomy/validation/rules/cycleDetectionRule.js:37-69` - Cycle detection algorithm
- Uses depth-first search with recursion stack tracking
- Checks all potential roots and unvisited entities

---

### Error: "Part type not allowed in socket"

**Error Class:** Part Type Compatibility Error (runtime validation issue)
**Source:** `src/anatomy/validation/rules/partTypeCompatibilityRule.js`

**Error Signature:**
```
Error: Part type 'dragon_leg' not allowed in socket 'wing_socket' on entity 'anatomy:dragon_torso'
Allowed types: [wing, dragon_wing]
```

**Error Properties:**
- `entityId`: Part entity that doesn't match
- `partType`: The part's subType that was rejected
- `socketId`: Socket that rejected the part
- `parentId`: Parent entity containing the socket
- `allowedTypes`: Array of allowed types for the socket

**Symptom:** Generated anatomy has parts attached to sockets that don't allow their type

**When It Occurs:**
- **Runtime** (during anatomy validation after generation)
- After part selection and attachment
- During post-generation validation
- Indicates mismatch between generation and socket constraints

**Common Causes:**
1. **Socket allowedTypes too restrictive** - Socket doesn't include the part type
2. **Part subType mismatch** - Part's anatomy:part.subType doesn't match pattern partType
3. **Generation logic bypass** - Part attached without proper validation
4. **Template update** - Socket allowedTypes changed but recipes not updated

**Diagnostic Steps:**
1. Check socket's allowedTypes array on parent entity
2. Verify part's anatomy:part.subType value
3. Review how part was selected and attached
4. Check if socket allows wildcard '*'
5. Compare pattern partType with entity subType

**Example Fix:**

Before (WRONG - Part type not in allowedTypes):
```json
// Parent entity with socket
{
  "id": "anatomy:dragon_torso",
  "components": {
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "wing_socket",
          "allowedTypes": ["wing"],  // ❌ Doesn't include "dragon_wing"
          "orientation": "lateral"
        }
      ]
    }
  }
}

// Part entity
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:part": {
      "subType": "dragon_wing"  // ❌ Not in socket's allowedTypes
    },
    "anatomy:joint": {
      "parentId": "anatomy:dragon_torso",
      "socketId": "wing_socket"
    }
  }
}
```

After (CORRECT - Option 1: Update socket):
```json
// Parent entity - expand allowedTypes
{
  "id": "anatomy:dragon_torso",
  "components": {
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "wing_socket",
          "allowedTypes": ["wing", "dragon_wing"],  // ✅ Includes both
          "orientation": "lateral"
        }
      ]
    }
  }
}
```

After (CORRECT - Option 2: Use wildcard):
```json
// Parent entity - allow any type
{
  "id": "anatomy:dragon_torso",
  "components": {
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "wing_socket",
          "allowedTypes": ["*"],  // ✅ Accepts any part type
          "orientation": "lateral"
        }
      ]
    }
  }
}
```

**Related Errors:**
- "No entity definitions found" (during part selection)
- SocketNotFoundError (if socket doesn't exist)

**Implementation References:**
- `src/anatomy/validation/rules/partTypeCompatibilityRule.js:55-72` - Type compatibility check
- Handles wildcard '*' in allowedTypes
- Validates each entity with anatomy:joint component

---

### Error: "Orphaned part has parent not in graph"

**Error Class:** Orphan Detection Error (runtime validation issue)
**Source:** `src/anatomy/validation/rules/orphanDetectionRule.js`

**Error Signature:**
```
Error: Orphaned part 'anatomy:dragon_wing_left' has parent 'anatomy:dragon_torso' not in graph
```

**Warning Signature:**
```
Warning: Multiple root entities found: anatomy:dragon_body, anatomy:dragon_head
```

**Error Properties:**
- `entityId`: The orphaned part
- `parentId`: Referenced parent not in graph
- `socketId`: Socket on the missing parent
- For warning: `rootEntities` array and `count`

**Symptom:** Part references a parent entity that doesn't exist in the anatomy graph, or multiple root entities detected

**When It Occurs:**
- **Runtime** (during anatomy validation after generation)
- After graph assembly
- Before description generation
- Indicates incomplete or fragmented anatomy

**Common Causes:**
1. **Parent not generated** - Recipe pattern didn't match parent entity
2. **Generation partial failure** - Some parts succeeded, parent failed
3. **Entity ID mismatch** - parentId references wrong entity
4. **Multiple blueprints** - Each created their own root (warning case)
5. **Incomplete pattern coverage** - Recipe doesn't cover all needed parts

**Diagnostic Steps:**
1. List all entity IDs in the generated anatomy
2. Check if parentId exists in the entity list
3. Verify recipe patterns cover all necessary parts
4. Check generation logs for partial failures
5. Review blueprint rootEntity configuration
6. For multiple roots: Check if multiple recipes were applied

**Example Fix:**

**Case 1: Orphaned Part (Error)**

Before (WRONG - Parent missing):
```json
// Generated entities (only 2, parent missing)
[
  {
    "id": "anatomy:dragon_wing_left",
    "components": {
      "anatomy:joint": {
        "parentId": "anatomy:dragon_torso",  // ❌ Not in graph
        "socketId": "wing_left"
      }
    }
  },
  {
    "id": "anatomy:dragon_wing_right",
    "components": {
      "anatomy:joint": {
        "parentId": "anatomy:dragon_torso",  // ❌ Not in graph
        "socketId": "wing_right"
      }
    }
  }
]
```

After (CORRECT - Parent included):
```json
// Generated entities (all 3 present)
[
  {
    "id": "anatomy:dragon_torso",  // ✅ Parent exists
    "components": {
      "anatomy:part": { "subType": "dragon_torso" },
      "anatomy:sockets": {
        "sockets": [
          { "id": "wing_left", "allowedTypes": ["wing"] },
          { "id": "wing_right", "allowedTypes": ["wing"] }
        ]
      }
    }
  },
  {
    "id": "anatomy:dragon_wing_left",
    "components": {
      "anatomy:joint": {
        "parentId": "anatomy:dragon_torso",  // ✅ Parent in graph
        "socketId": "wing_left"
      }
    }
  },
  {
    "id": "anatomy:dragon_wing_right",
    "components": {
      "anatomy:joint": {
        "parentId": "anatomy:dragon_torso",  // ✅ Parent in graph
        "socketId": "wing_right"
      }
    }
  }
]
```

**Case 2: Multiple Roots (Warning)**

Before (Potential Issue - 2 roots):
```json
// Two separate root entities (no joints)
[
  {
    "id": "anatomy:dragon_body",  // Root 1
    "components": {
      "anatomy:part": { "subType": "dragon_body" }
    }
  },
  {
    "id": "anatomy:dragon_head",  // Root 2
    "components": {
      "anatomy:part": { "subType": "dragon_head" }
    }
  }
]
```

After (Typical Case - 1 root):
```json
// Single root with attached parts
[
  {
    "id": "anatomy:dragon_body",  // ✅ Single root
    "components": {
      "anatomy:part": { "subType": "dragon_body" },
      "anatomy:sockets": {
        "sockets": [
          { "id": "head", "allowedTypes": ["head"] }
        ]
      }
    }
  },
  {
    "id": "anatomy:dragon_head",  // ✅ Attached to root
    "components": {
      "anatomy:part": { "subType": "dragon_head" },
      "anatomy:joint": {
        "parentId": "anatomy:dragon_body",
        "socketId": "head"
      }
    }
  }
]
```

**Note:** Multiple roots are allowed (just a warning) and may be intentional for certain use cases.

**Related Errors:**
- "Cycle detected" (if trying to connect orphans creates cycles)
- "Joint consistency" errors (if joint data is incorrect)

**Implementation References:**
- `src/anatomy/validation/rules/orphanDetectionRule.js:40-51` - Orphan detection
- `src/anatomy/validation/rules/orphanDetectionRule.js:60-70` - Multiple root warning
- Stores `rootEntities` in context metadata for other rules

---

### Error: "Entity has incomplete joint data"

**Error Class:** Joint Consistency Error (runtime validation issue)
**Source:** `src/anatomy/validation/rules/jointConsistencyRule.js`

**Error Signature:**
```
Error: Entity 'anatomy:dragon_leg_front_left' has incomplete joint data
Missing fields: parentId, socketId
```

**Alternate Signature:**
```
Error: Entity 'anatomy:dragon_wing' has joint referencing non-existent parent 'anatomy:dragon_body_v2'
```

**Error Properties:**
- `entityId`: Entity with incomplete or invalid joint
- `joint`: The joint data object
- `missingFields`: Array of missing required fields
- For parent errors: `parentId`, `socketId`
- For socket errors: `availableSockets` array

**Symptom:** Entity has anatomy:joint component with missing or invalid data

**When It Occurs:**
- **Runtime** (during anatomy validation after generation)
- After entity instantiation
- Before graph traversal
- Indicates malformed joint data

**Common Causes:**
1. **Incomplete joint object** - Missing parentId or socketId
2. **Parent doesn't exist** - References entity not in graph
3. **Socket doesn't exist** - References socket not on parent
4. **Serialization error** - Data corruption during save/load
5. **Manual editing error** - Hand-edited JSON with mistakes

**Diagnostic Steps:**
1. Check joint component has both parentId and socketId
2. Verify parentId exists in entity list
3. Check parent entity has anatomy:sockets component
4. Verify socketId exists in parent's sockets array
5. Review generation logs for joint creation

**Example Fix:**

**Case 1: Missing Joint Fields**

Before (WRONG):
```json
{
  "id": "anatomy:dragon_leg",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:dragon_torso"
      // ❌ Missing socketId
    }
  }
}
```

After (CORRECT):
```json
{
  "id": "anatomy:dragon_leg",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:dragon_torso",
      "socketId": "leg_socket"  // ✅ Added socketId
    }
  }
}
```

**Case 2: Invalid Parent Reference**

Before (WRONG):
```json
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:dragon_torso_OLD",  // ❌ Doesn't exist
      "socketId": "wing_socket"
    }
  }
}
```

After (CORRECT):
```json
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:dragon_torso",  // ✅ Correct entity ID
      "socketId": "wing_socket"
    }
  }
}
```

**Case 3: Invalid Socket Reference**

Before (WRONG):
```json
// Parent entity
{
  "id": "anatomy:dragon_torso",
  "components": {
    "anatomy:sockets": {
      "sockets": [
        { "id": "wing_left", "allowedTypes": ["wing"] },
        { "id": "wing_right", "allowedTypes": ["wing"] }
        // ❌ No "wing_socket"
      ]
    }
  }
}

// Child entity
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:dragon_torso",
      "socketId": "wing_socket"  // ❌ Socket doesn't exist
    }
  }
}
```

After (CORRECT):
```json
// Child entity - use existing socket
{
  "id": "anatomy:dragon_wing",
  "components": {
    "anatomy:joint": {
      "parentId": "anatomy:dragon_torso",
      "socketId": "wing_left"  // ✅ Socket exists
    }
  }
}
```

**Related Errors:**
- "Orphaned part" (if parent truly doesn't exist)
- SocketNotFoundError (during blueprint processing)
- "Socket not found on entity" (socket validation)

**Implementation References:**
- `src/anatomy/validation/rules/jointConsistencyRule.js:38-50` - Missing fields check
- `src/anatomy/validation/rules/jointConsistencyRule.js:53-64` - Parent existence check
- `src/anatomy/validation/rules/jointConsistencyRule.js:67-88` - Socket existence check

---

### Error: "Socket not found on entity"

**Error Class:** Socket Limit Error (runtime validation issue)
**Source:** `src/anatomy/validation/rules/socketLimitRule.js`

**Error Signature:**
```
Error: Socket 'wing_socket_left' not found on entity 'anatomy:dragon_torso'
```

**Error Properties:**
- `parentId`: Entity that should have the socket
- `socketId`: Socket that wasn't found

**Symptom:** Socket referenced in occupancy tracking doesn't exist on parent entity

**When It Occurs:**
- **Runtime** (during socket occupancy validation)
- After parts have been attached
- During validation of occupied sockets
- Indicates socket definition missing

**Common Causes:**
1. **Socket removed from entity** - Entity updated but parts not updated
2. **Socket ID mismatch** - Typo in socket reference
3. **Dynamic socket generation** - Socket should be created but wasn't
4. **Template update** - Structure template changed socket IDs

**Diagnostic Steps:**
1. Check parent entity's anatomy:sockets component
2. List all socket IDs on parent
3. Verify socket ID in joint matches exactly
4. Check for case sensitivity issues
5. Review recent template or entity changes

**Example Fix:**

Before (WRONG - Socket missing):
```json
// Parent entity
{
  "id": "anatomy:dragon_torso",
  "components": {
    "anatomy:sockets": {
      "sockets": [
        { "id": "head", "allowedTypes": ["head"] },
        { "id": "tail", "allowedTypes": ["tail"] }
        // ❌ Missing wing_socket_left
      ]
    }
  }
}

// socketOccupancy tracking: Set(['anatomy:dragon_torso:wing_socket_left'])
```

After (CORRECT - Add socket):
```json
// Parent entity
{
  "id": "anatomy:dragon_torso",
  "components": {
    "anatomy:sockets": {
      "sockets": [
        { "id": "head", "allowedTypes": ["head"] },
        { "id": "tail", "allowedTypes": ["tail"] },
        {  // ✅ Added socket
          "id": "wing_socket_left",
          "allowedTypes": ["wing"],
          "orientation": "lateral_left"
        }
      ]
    }
  }
}
```

**Related Errors:**
- SocketNotFoundError (during blueprint slot processing)
- "Joint consistency" errors (if joint references wrong socket)

**Implementation References:**
- `src/anatomy/validation/rules/socketLimitRule.js:36-53` - Socket existence validation
- Validates against socketOccupancy Set from context
- Each occupied socket must exist on parent entity

---

## 10. Body Descriptor Validation Errors

These errors occur when body descriptor values are invalid according to the Body Descriptor Registry. While BodyDescriptorValidationError exists in `src/anatomy/errors/bodyDescriptorValidationError.js`, it's not currently exported in the main errors index.

### Error: "Invalid body descriptor enum value"

**Error Class:** BodyDescriptorValidationError (validation error, not exported)
**Source:** `src/anatomy/errors/bodyDescriptorValidationError.js`

**Error Signature:**
```
Error: Invalid skinColor descriptor: 'bright-red' in recipe 'anatomy:dragon_red'
Must be one of: pale, fair, tan, brown, dark-brown, black, grey, blue, green, red, orange, yellow, purple, white
```

**Error Properties:**
- `descriptorProperty`: The descriptor property name (e.g., 'skinColor')
- `invalidValue`: The invalid value provided
- Context: Where the error occurred (recipe, entity, etc.)

**Symptom:** Body descriptor value doesn't match valid enum values in registry

**When It Occurs:**
- During body descriptor validation
- When processing anatomy recipes or entities
- At load time or generation time depending on validation configuration

**Common Causes:**
1. **Invalid enum value** - Value not in Body Descriptor Registry validValues
2. **Typo in descriptor value** - Misspelled valid value
3. **Registry out of sync** - Value valid in old registry version
4. **Case sensitivity** - Wrong capitalization (values are case-sensitive)

**Diagnostic Steps:**
1. Check Body Descriptor Registry for valid values
2. Review `src/anatomy/registries/bodyDescriptorRegistry.js`
3. Verify descriptor property exists in registry
4. Check enum values for the specific descriptor
5. Run `npm run validate:body-descriptors` to check registry consistency

**Example Fix:**

Before (WRONG - Invalid enum):
```json
{
  "recipeId": "anatomy:dragon_red",
  "bodyDescriptors": {
    "skinColor": "bright-red",  // ❌ Not in registry enum
    "height": "massive",
    "build": "athletic"
  }
}
```

After (CORRECT - Valid enum):
```json
{
  "recipeId": "anatomy:dragon_red",
  "bodyDescriptors": {
    "skinColor": "red",  // ✅ Valid enum value
    "height": "tall",    // ✅ Valid (if 'massive' invalid)
    "build": "athletic"
  }
}
```

**Valid Body Descriptors (Registry Reference):**

Current descriptors in registry (6 total):
- `height` - Display order: 10
- `skinColor` - Display order: 20
- `build` - Display order: 30
- `composition` - Display order: 40
- `hairDensity` - Display order: 50
- `smell` - Display order: 60

**Related Errors:**
- InvalidPropertyError (for component property validation)
- RecipeValidationError (if validation integrated into recipe preflight)

**Implementation References:**
- `src/anatomy/errors/bodyDescriptorValidationError.js` - Error class
- `src/anatomy/registries/bodyDescriptorRegistry.js` - Registry with valid values
- `src/anatomy/validators/bodyDescriptorValidator.js` - Validation logic
- CLI: `npm run validate:body-descriptors` - Validate registry consistency

**Documentation:**
- [`docs/anatomy/body-descriptors-complete.md`](./body-descriptors-complete.md) - Complete descriptor guide
- Registry exports: `getDescriptorMetadata()`, `validateDescriptorValue()`, `getAllDescriptorNames()`

**Note:** This error class exists but is not currently exported in `src/anatomy/errors/index.js`. If you encounter this error, it indicates the descriptor validation system is active even though the error class isn't in the public API.

---

## Red Dragon Case Study: Error Progression

This section documents the 6 error rounds from the Red Dragon case study (from `reports/anatomy-system-v2-improvements.md:181-234`), showing how errors compound and how to fix them systematically.

### Round 1: Constraint Validation
**Error:** "Invalid 'requires' group at index 0. 'partTypes' must contain at least 2 items."
**Category:** [Constraint Validation Errors](#8-constraint-validation-errors)
**Fix:** Added second part to requires array
**Lesson:** Always review constraint definitions during recipe creation

### Round 2: Missing Entity Definition
**Error:** "No entity definitions found matching anatomy requirements. Need part type: 'dragon_wing'."
**Category:** [Entity/Part Selection Errors](#4-entitypart-selection-errors)
**Root Cause:** Entity missing `descriptors:length_category` component
**Fix:** Added missing component to entity
**Lesson:** Pre-flight validation should check entity-recipe component compatibility

### Round 3: Component Validation Failure
**Error:** "Runtime component validation failed for 'anatomy:dragon_wing'. Invalid components: [descriptors:length_category]"
**Category:** [Property Schema Errors](#3-property-schema-errors)
**Root Cause:** Used invalid enum value "vast" (not in schema)
**Fix:** Changed to valid value "immense"
**Lesson:** Property schema validation should happen at load time, not runtime

### Round 4: Property Mismatch
**Error:** Property matching validation failed (properties don't match recipe slot requirements)
**Category:** [Entity/Part Selection Errors](#4-entitypart-selection-errors) (property validation)
**Root Cause:** Recipe expected "vast", entity had "immense"
**Fix:** Aligned recipe and entity values
**Lesson:** Recipe and entity property values must match exactly

### Round 5: Missing Component
**Error:** "No entity definitions found. Required components: [anatomy:part, anatomy:horned]"
**Category:** [Component Existence Errors](#2-component-existence-errors)
**Root Cause:** `anatomy:horned` component didn't exist in system
**Fix:** Created component schema and added to entity
**Lesson:** Component existence should be validated at recipe load time

### Round 6: Missing Sockets
**Error:** "Socket 'fire_gland' not found on parent entity 'anatomy:dragon_torso'"
**Category:** [Socket/Slot Errors](#5-socketslot-errors)
**Root Cause:** Blueprint additionalSlots required sockets not on parent
**Fix:** Removed additionalSlots from blueprint
**Lesson:** Socket/slot compatibility needs validation

### Final Issue: Silent Description Exclusion
**Issue:** Only wings appeared in description, not head/legs/tail
**Root Cause:** Parts without descriptor components silently filtered
**Category:** Description system behavior (not an error)
**Lesson:** All parts intended for description need descriptor components

**Key Takeaway:** Most errors could be caught at load time with comprehensive pre-flight validation. The Red Dragon case study led to the creation of RecipePreflightValidator and enhanced error classes.

---

## Error Timing: Load-Time vs Runtime

Understanding when errors occur helps with debugging strategy.

### Load-Time Errors
**Occur during mod loading, before game starts**

- ✅ Easier to debug (immediate feedback)
- ✅ Prevent invalid content from loading
- ✅ Can provide detailed context and fixes
- ⚠️ Blocks mod loading entirely

**Error Types:**
- RecipeValidationError
- ComponentNotFoundError (from validation)
- InvalidPropertyError (from validation)
- Pattern matching warnings
- Blueprint-recipe compatibility errors
- Constraint validation errors

**Validation Source:** RecipePreflightValidator (`src/anatomy/validation/RecipePreflightValidator.js`)

### Runtime Errors
**Occur during anatomy generation, during gameplay**

- ⚠️ Harder to debug (occurs in context of generation)
- ⚠️ May lose partial work/progress
- ⚠️ Less detailed context available
- ✅ Can sometimes recover gracefully

**Error Types:**
- Entity selection errors (PartSelectionService)
- Socket not found errors
- Entity instantiation failures
- Component runtime validation failures

**Goal:** Shift as many errors as possible to load-time through comprehensive validation.

---

## Diagnostic Workflows

### General Error Diagnosis Process

1. **Read the full error message**
   - Note error class and source file
   - Extract key properties (IDs, locations, values)
   - Check error signature against this catalog

2. **Determine error timing**
   - Load-time: Check validation reports, mod loading logs
   - Runtime: Check anatomy generation logs, enable debug logging

3. **Locate the problematic files**
   - Use error properties to find recipe, entity, blueprint files
   - Check file paths in error message

4. **Validate against schemas**
   - Use schema validator to check JSON structure
   - Verify required fields present

5. **Check cross-references**
   - Verify component IDs exist in registry
   - Check entity IDs are loaded
   - Validate socket IDs on entities

6. **Fix and test**
   - Apply fix from catalog example
   - Run validation again
   - Test full anatomy generation

### Quick Diagnosis by Symptom

**"No parts generated"**
→ Check: Pattern matching ([Section 6](#6-pattern-matching-errors)), Entity selection ([Section 4](#4-entitypart-selection-errors))

**"Mod won't load"**
→ Check: Validation reports ([Section 1](#1-validation-report-errors)), Component existence ([Section 2](#2-component-existence-errors))

**"Wrong parts generated"**
→ Check: partType/subType matching ([Section 4](#4-entitypart-selection-errors)), Property values ([Section 3](#3-property-schema-errors))

**"Parts in wrong positions"**
→ Check: Socket/slot compatibility ([Section 5](#5-socketslot-errors)), Blueprint structure ([Section 7](#7-blueprintrecipe-compatibility-errors))

---

## Related Documentation

- [`troubleshooting.md`](./troubleshooting.md) - Problem-oriented troubleshooting guide
- [`anatomy-system-guide.md`](./anatomy-system-guide.md) - System architecture and concepts
- [`blueprints-and-templates.md`](./blueprints-and-templates.md) - Blueprint V2 and structure templates
- [`recipe-pattern-matching.md`](./recipe-pattern-matching.md) - Pattern matching deep dive
- [`recipe-creation-checklist.md`](./recipe-creation-checklist.md) - Step-by-step recipe creation
- [`non-human-quickstart.md`](./non-human-quickstart.md) - End-to-end tutorial

## Implementation References

**Error Classes:** `src/anatomy/errors/`
- `AnatomyError.js` - Base error class
- `ComponentNotFoundError.js` - Missing component errors
- `InvalidPropertyError.js` - Property validation errors
- `SocketNotFoundError.js` - Socket reference errors
- `RecipeValidationError.js` - Validation report errors
- `errorTemplates.js` - Error template registry

**Validation Infrastructure:** `src/anatomy/validation/`
- `RecipePreflightValidator.js` - Orchestrates all validation
- `ValidationReport.js` - Structured validation results
- `rules/componentExistenceValidationRule.js` - Component existence checks
- `rules/propertySchemaValidationRule.js` - Property schema validation
- `rules/blueprintRecipeValidationRule.js` - Blueprint compatibility
- `patternMatchingValidator.js` - Pattern matching validation
- `socketSlotCompatibilityValidator.js` - Socket/slot compatibility

**Core Services:**
- `src/anatomy/partSelectionService.js` - Entity selection and validation
- `src/anatomy/workflows/anatomyGenerationWorkflow.js` - Generation orchestration

---

## Getting Help

If errors persist after consulting this catalog:

1. **Enable debug logging** - Check logger configuration for anatomy services
2. **Review validation reports** - Full details in RecipePreflightValidator output
3. **Check recent commits** - Template or schema changes may require updates
4. **Consult troubleshooting guide** - Problem-oriented approach in [`troubleshooting.md`](./troubleshooting.md)
5. **Review case studies** - Red Dragon case study shows error resolution progression
6. **Check integration tests** - Tests in `tests/integration/anatomy/` show working examples

**Remember:** Most errors have corresponding error classes with structured information, fix suggestions, and references. Use error properties to guide investigation.

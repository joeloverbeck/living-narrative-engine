# Anatomy System Validation Workflow

This document provides a comprehensive guide to the anatomy system's validation pipeline, from initial schema validation through runtime integrity checks. Understanding this workflow is essential for creating reliable anatomy content and troubleshooting validation errors.

**Related Documentation:**
- [Common Errors Catalog](./common-errors.md) - Detailed error reference
- [Troubleshooting Guide](./troubleshooting.md) - Problem-oriented scenarios
- [Body Descriptors Guide](./body-descriptors-complete.md) - Descriptor validation details
- [Anatomy System Guide](./anatomy-system-guide.md) - Architecture overview

## Table of Contents

1. [Overview](#overview)
2. [Validation Pipeline](#validation-pipeline)
3. [Stage 1: Load-Time Schema Validation](#stage-1-load-time-schema-validation)
4. [Stage 2: Pre-flight Recipe Validation](#stage-2-pre-flight-recipe-validation)
5. [Stage 3: Generation-Time Runtime Validation](#stage-3-generation-time-runtime-validation)
6. [Stage 4: Body Descriptor Validation](#stage-4-body-descriptor-validation)
7. [Best Practices](#best-practices)
8. [Validation Checklist](#validation-checklist)
9. [Troubleshooting Workflow](#troubleshooting-workflow)
10. [Tool Reference](#tool-reference)

## Overview

The anatomy system employs a multi-stage validation pipeline to ensure content integrity and catch errors early in the development workflow. The validation stages are:

```
┌────────────────────────────────────────────────────────────────┐
│                    VALIDATION PIPELINE                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Stage 1: Load-Time Schema Validation                          │
│  ├─ JSON schema validation for all content files               │
│  └─ Automatic during mod loading                               │
│                        ↓                                        │
│  Stage 2: Pre-flight Recipe Validation                         │
│  ├─ 9 comprehensive validation checks                          │
│  ├─ Component existence, property schemas                      │
│  ├─ Socket/slot compatibility, pattern matching                │
│  └─ Part availability, entity definition validation            │
│                        ↓                                        │
│  Stage 3: Generation-Time Runtime Validation                   │
│  ├─ Blueprint-recipe slot compatibility                        │
│  ├─ Entity graph integrity validation                          │
│  └─ 6 runtime validation rules                                 │
│                        ↓                                        │
│  Stage 4: Body Descriptor Validation                           │
│  ├─ Descriptor value validation                                │
│  ├─ Formatting config consistency                              │
│  └─ System-wide consistency checks                             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Validation Philosophy

- **Fail Fast**: Catch errors as early as possible
- **Clear Messages**: Provide actionable error information
- **Progressive Validation**: Each stage builds on previous validations
- **Developer-Friendly**: Tools for every stage of development

## Validation Pipeline

### Stage Flow

```
Mod Loading
    │
    ├─→ [Stage 1: Schema Validation]
    │       ↓ (all schemas valid)
    │
    ├─→ [Stage 2: Pre-flight Validation]
    │       ↓ (recipes validated)
    │
    └─→ Runtime
            │
            ├─→ [Stage 3: Generation Validation]
            │       ↓ (during anatomy generation)
            │
            └─→ [Stage 4: Descriptor Validation]
                    ↓ (descriptor consistency)
```

### Validation Timing

| Stage | When | Blocking | Errors Fail Load |
|-------|------|----------|------------------|
| Stage 1: Schema | Mod loading | Yes | Yes |
| Stage 2: Pre-flight | After schema validation | Yes | Yes |
| Stage 3: Runtime | Anatomy generation | Yes | No (runtime error) |
| Stage 4: Descriptors | Multiple stages | Configurable | Configurable |

## Stage 1: Load-Time Schema Validation

**Implementation:** `AjvSchemaValidator` ([`src/validation/ajvSchemaValidator.js`](../../src/validation/ajvSchemaValidator.js))

**Purpose:** Validates all anatomy content files against their JSON schemas before any processing.

### What It Validates

- **Blueprints**: `anatomy.blueprint.schema.json`
- **Recipes**: `anatomy.recipe.schema.json`
- **Structure Templates**: `anatomy.structure-template.schema.json`
- **Components**: All anatomy component schemas
- **Entity Definitions**: Entity definition schemas

### When It Runs

- **Automatic** during mod loading
- Before any content is processed
- Part of the ContentPhase in mod loading pipeline

### How It Works

```javascript
// Automatic validation during mod loading
// src/validation/ajvSchemaValidator.js

class AjvSchemaValidator {
  validate(data, schemaId) {
    // 1. Retrieve compiled schema
    const validate = this.#ajv.getSchema(schemaId);

    // 2. Validate data
    const valid = validate(data);

    // 3. Return detailed result
    return {
      valid,
      errors: valid ? [] : formatAjvErrors(validate.errors)
    };
  }
}
```

### Common Schema Errors

**Missing Required Fields:**
```
Error: data must have required property 'blueprintId'
Location: anatomy:red_dragon recipe
Fix: Add "blueprintId": "anatomy:dragon_common" to recipe
```

**Invalid Property Type:**
```
Error: data.bodyDescriptors.height must be string
Location: Recipe body descriptors
Fix: Change height value to string type
```

**Additional Properties:**
```
Error: data must NOT have additional properties
Location: Recipe definition
Fix: Remove unrecognized properties
```

### Troubleshooting

If schema validation fails:

1. **Check error message** for exact property path
2. **Review schema** at `data/schemas/anatomy.*.schema.json`
3. **Verify JSON syntax** - use a JSON validator
4. **Check required fields** in schema definition
5. **Consult** [Common Errors: Schema Validation](./common-errors.md#schema-validation-errors)

### Tools

Schema validation is **automatic** - no manual tools needed. Errors appear in console during mod loading.

## Stage 2: Pre-flight Recipe Validation

**Implementation:** `RecipePreflightValidator` ([`src/anatomy/validation/RecipePreflightValidator.js`](../../src/anatomy/validation/RecipePreflightValidator.js))

**Purpose:** Comprehensive validation of recipes after schema validation but before runtime generation.

### What It Validates

The RecipePreflightValidator performs 9 comprehensive validation checks:

#### 1. Component Existence Validation
**Rule:** `ComponentExistenceValidationRule`
**Validates:** All component references exist in the component registry
**Severity:** Error (P0)

```javascript
// Example error
{
  severity: "error",
  ruleId: "component-existence",
  location: { type: "slot", name: "head" },
  message: "Component 'anatomy:horned' does not exist in registry"
}
```

#### 2. Property Schema Validation
**Rule:** `PropertySchemaValidationRule`
**Validates:** Component property values match component schemas
**Severity:** Error (P0)

```javascript
// Example error
{
  severity: "error",
  ruleId: "property-schema",
  location: { type: "slot", name: "torso", component: "anatomy:body" },
  message: "Property 'size' has invalid value 'gigantic' (valid: small, medium, large)"
}
```

#### 3. Blueprint Validation
**Validates:** Recipe references valid blueprint
**Severity:** Error (P0)

```javascript
// Example error
{
  severity: "error",
  ruleId: "blueprint-existence",
  message: "Recipe references non-existent blueprint 'anatomy:dragon_common'"
}
```

#### 4. Socket/Slot Compatibility Validation
**Validator:** `socketSlotCompatibilityValidator`
**Validates:** Recipe slots match blueprint socket definitions
**Severity:** Error (P0)

```javascript
// Example error
{
  severity: "error",
  ruleId: "socket-slot-compatibility",
  location: { slot: "left_wing", socket: "torso:wing_left" },
  message: "Socket 'torso:wing_left' not found in blueprint"
}
```

#### 5. Pattern Matching Validation
**Validator:** `patternMatchingValidator`
**Validates:** Pattern definitions will match blueprint slots
**Severity:** Warning (P1)

```javascript
// Example warning
{
  severity: "warning",
  ruleId: "pattern-matching",
  location: { pattern: "leg_*" },
  message: "Pattern 'leg_*' matched zero slots in blueprint"
}
```

#### 6. Descriptor Coverage Check
**Validates:** Body descriptors are complete
**Severity:** Suggestion (P1)

```javascript
// Example suggestion
{
  severity: "suggestion",
  ruleId: "descriptor-coverage",
  message: "Recipe missing optional body descriptor 'smell'"
}
```

#### 7. Part Availability Check
**Validates:** Entity definitions exist for all slot partTypes
**Severity:** Error (P0)

```javascript
// Example error
{
  severity: "error",
  ruleId: "part-availability",
  location: { slot: "head", partType: "dragon_head" },
  message: "No entity definitions found for partType 'dragon_head'"
}
```

#### 8. Generated Slot Part Availability Check
**Validates:** Entity definitions exist for pattern-matched slots
**Severity:** Error (P0)

```javascript
// Example error
{
  severity: "error",
  ruleId: "generated-slot-part-availability",
  location: { pattern: "leg_*", matchedSlots: ["leg_1", "leg_2"] },
  message: "No entity definitions found for generated slot 'leg_1' partType 'spider_leg'"
}
```

#### 9. Entity Definition Load Failures
**Validates:** All entity definitions loaded successfully
**Severity:** Error (P0)

```javascript
// Example error
{
  severity: "error",
  ruleId: "entity-load-failure",
  location: { entityId: "anatomy:dragon_head" },
  message: "Entity definition failed to load due to schema error"
}
```

### When It Runs

- After Stage 1 (schema validation) passes
- Before runtime anatomy generation
- Can be invoked manually via CLI tool

### ValidationReport Structure

The validator produces a comprehensive ValidationReport:

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
      details: { ... }
    }
  ],

  warnings: [
    {
      severity: "warning",
      ruleId: "pattern-matching",
      location: { pattern: "wing_*" },
      message: "Pattern matched zero slots"
    }
  ],

  suggestions: [
    {
      severity: "suggestion",
      ruleId: "descriptor-coverage",
      message: "Consider adding 'smell' descriptor"
    }
  ],

  passed: [
    "socket-slot-compatibility",
    "blueprint-existence"
  ]
}
```

### Troubleshooting

1. **Check full validation report** - errors contain location context
2. **Fix errors before warnings** - critical issues first
3. **Review referenced files** - blueprints, entity definitions
4. **Use CLI tool** for isolated recipe validation
5. **Consult** [Common Errors: Validation Report Errors](./common-errors.md#1-validation-report-errors)

### Tools

#### CLI Tool: validate-recipe.js

**Location:** [`scripts/validate-recipe.js`](../../scripts/validate-recipe.js)

**Usage:**
```bash
# Validate single recipe
node scripts/validate-recipe.js data/mods/anatomy/recipes/red_dragon.recipe.json

# Validate with verbose output
node scripts/validate-recipe.js --verbose red_dragon.recipe.json

# Validate with JSON output
node scripts/validate-recipe.js --json red_dragon.recipe.json

# Validate multiple recipes
node scripts/validate-recipe.js data/mods/anatomy/recipes/*.recipe.json
```

**Example Output:**
```
📋 Validating Recipe: anatomy:dragon_red
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ Validation Failed (3 errors, 1 warning)

ERRORS:
  • [component-existence] Slot 'head': Component 'anatomy:horned' does not exist
  • [part-availability] Slot 'tail': No entity definitions for partType 'dragon_tail'
  • [socket-slot-compatibility] Slot 'left_wing': Socket not found in blueprint

WARNINGS:
  • [pattern-matching] Pattern 'scale_*': Matched zero slots

PASSED CHECKS:
  • property-schema
  • blueprint-existence
  • descriptor-coverage
```

#### Programmatic API

```javascript
import RecipePreflightValidator from './src/anatomy/validation/RecipePreflightValidator.js';

// Create validator
const validator = new RecipePreflightValidator({
  dataRegistry,
  anatomyBlueprintRepository,
  schemaValidator,
  slotGenerator,
  logger
});

// Validate recipe
const report = await validator.validate(recipe, {
  recipePath: 'data/mods/anatomy/recipes/red_dragon.recipe.json',
  failFast: false,  // Continue on first error
  skipPatternValidation: false,
  skipDescriptorChecks: false,
  skipPartAvailabilityChecks: false,
  skipGeneratedSlotChecks: false,
  skipLoadFailureChecks: false
});

// Check results
if (report.hasErrors()) {
  console.error(`Validation failed with ${report.errors.length} errors`);
  for (const error of report.errors) {
    console.error(`  ${error.ruleId}: ${error.message}`);
  }
}
```

## Stage 3: Generation-Time Runtime Validation

**Implementation:** Multiple validators in anatomy generation workflow

**Purpose:** Validates anatomy graphs during runtime generation to ensure structural integrity.

### What It Validates

Stage 3 validation occurs during `AnatomyGenerationWorkflow.generate()` and includes:

#### Blueprint Validator

**Location:** [`src/anatomy/bodyBlueprintFactory/blueprintValidator.js`](../../src/anatomy/bodyBlueprintFactory/blueprintValidator.js)

**Functions:**
- `validateRecipeSlots(recipe, blueprint, eventDispatcher)` - Validates recipe slots exist in blueprint
- `checkBlueprintRecipeCompatibility(blueprint, recipe, deps)` - Checks recipe/blueprint compatibility

**Validations:**
```javascript
// 1. Recipe slots exist in blueprint
validateRecipeSlots(recipe, blueprint, eventDispatcher);

// 2. Recipe covers required blueprint slots
// 3. Pattern requirements can be satisfied
checkBlueprintRecipeCompatibility(blueprint, recipe, {
  recipePatternResolver,
  logger
});
```

#### Graph Integrity Validator

**Location:** [`src/anatomy/graphIntegrityValidator.js`](../../src/anatomy/graphIntegrityValidator.js)

**Class:** `GraphIntegrityValidator`

**Validation Rules:**

1. **SocketLimitRule**
   - Validates: Socket occupancy limits respected
   - Error: "Socket not found on entity" or "Socket already occupied"

2. **RecipeConstraintRule**
   - Validates: Recipe constraints (requires, forbids) satisfied
   - Error: "Recipe constraint 'requires' not satisfied"

3. **CycleDetectionRule**
   - Validates: No cycles in anatomy graph
   - Error: "Cycle detected in anatomy graph"

4. **JointConsistencyRule**
   - Validates: Joint data complete and consistent
   - Error: "Entity has incomplete joint data"

5. **OrphanDetectionRule**
   - Validates: All parts connected to root, single root exists
   - Error: "Orphaned part has parent not in graph"
   - Warning: "Multiple root entities found"

6. **PartTypeCompatibilityRule**
   - Validates: Parts match socket type requirements
   - Error: "Part type not allowed in socket"

### When It Runs

- During `AnatomyGenerationWorkflow.generate()` execution
- After parts are assembled into entity graph
- Before ANATOMY_GENERATED event dispatch

### How It Works

```javascript
// src/anatomy/graphIntegrityValidator.js

class GraphIntegrityValidator {
  async validateGraph(entityIds, recipe, socketOccupancy) {
    // Create validation context
    const context = new ValidationContext({
      entityIds,
      recipe,
      socketOccupancy,
      entityManager: this.#entityManager
    });

    // Run all validation rules
    const result = await this.#ruleChain.execute(context);

    return {
      valid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings
    };
  }
}
```

### Validation Context

```javascript
class ValidationContext {
  constructor({ entityIds, recipe, socketOccupancy, entityManager }) {
    this.entityIds = entityIds;
    this.recipe = recipe;
    this.socketOccupancy = socketOccupancy;
    this.entityManager = entityManager;
    this.errors = [];
    this.warnings = [];
  }
}
```

### Common Runtime Errors

**Cycle Detection:**
```
Error: Cycle detected in anatomy graph
Cycle path: entity_1 → entity_2 → entity_3 → entity_1
```

**Orphaned Parts:**
```
Error: Orphaned part 'leg_4' has parent 'torso_2' not in graph
Graph root: torso_1
```

**Socket Limit Exceeded:**
```
Error: Socket 'torso:arm_right' not found on entity 'torso_1'
Available sockets: arm_left, neck, waist
```

**Part Type Incompatibility:**
```
Error: Part type 'dragon_wing' not allowed in socket 'torso:arm_left'
Socket accepts: humanoid_arm, robotic_arm
```

### Troubleshooting

1. **Enable debug logging** for anatomy services
2. **Check entity graph structure** - use anatomy visualizer
3. **Verify socket definitions** in blueprints
4. **Review recipe constraints** for conflicts
5. **Consult** [Common Errors: Runtime Anatomy Validation](./common-errors.md#9-runtime-anatomy-validation-errors)

### Tools

Runtime validation is **automatic** during generation. To debug:

```javascript
// Enable debug logging in logger configuration
{
  "anatomy": "debug",
  "graphIntegrityValidator": "debug"
}

// Inspect validation results
workflow.on('ANATOMY_VALIDATION_FAILED', (event) => {
  console.error('Validation errors:', event.errors);
  console.warn('Validation warnings:', event.warnings);
});
```

## Stage 4: Body Descriptor Validation

**Implementation:** `BodyDescriptorValidator` ([`src/anatomy/validators/bodyDescriptorValidator.js`](../../src/anatomy/validators/bodyDescriptorValidator.js))

**Purpose:** Validates body descriptors against the centralized registry for consistency across schema, code, and configuration.

### What It Validates

#### Recipe Descriptor Validation
- Descriptor names are registered in `BODY_DESCRIPTOR_REGISTRY`
- Descriptor values match valid value enums
- Free-form descriptors (e.g., skinColor, smell) accept any string

#### Formatting Config Validation
- `descriptionOrder` includes all registered descriptors
- Display keys match registry definitions

#### System Consistency Validation
- Schema, code, and config are synchronized
- All descriptors properly configured
- No configuration drift

### When It Runs

Stage 4 validation runs at multiple points:

1. **Load-Time** - During recipe validation (Stage 2)
2. **Runtime** - During anatomy generation (Stage 3)
3. **CLI** - Manual validation via CLI tool

### Body Descriptor Registry

**Location:** [`src/anatomy/registries/bodyDescriptorRegistry.js`](../../src/anatomy/registries/bodyDescriptorRegistry.js)

**Current Descriptors (6 total):**

| Descriptor | Display Order | Type | Valid Values |
|-----------|--------------|------|--------------|
| height | 10 | Enumerated | microscopic, minuscule, tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic |
| skinColor | 20 | Free-form | Any string |
| build | 30 | Enumerated | skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky, frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky |
| composition | 40 | Enumerated | underweight, lean, average, soft, chubby, overweight, obese, atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting |
| hairDensity | 50 | Enumerated | hairless, sparse, light, moderate, hairy, very-hairy |
| smell | 60 | Free-form | Any string |

### Validation Examples

**Valid Descriptor:**
```json
{
  "bodyDescriptors": {
    "height": "tall",
    "skinColor": "pale green",
    "build": "muscular",
    "composition": "lean",
    "hairDensity": "moderate",
    "smell": "sulfuric"
  }
}
```

**Invalid Enum Value:**
```json
{
  "bodyDescriptors": {
    "height": "super-tall"  // ❌ Error: Invalid value
  }
}
```
**Error Message:** `Invalid value 'super-tall' for body descriptor 'height'. Valid values: microscopic, minuscule, tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic`

**Unknown Descriptor:**
```json
{
  "bodyDescriptors": {
    "weight": "heavy"  // ⚠️ Warning: Unknown descriptor
  }
}
```
**Warning Message:** `Unknown body descriptor 'weight' (not in registry)`

### Troubleshooting

1. **Check valid values** in `BODY_DESCRIPTOR_REGISTRY`
2. **Verify descriptor names** match registry keys (camelCase)
3. **Review formatting config** at `data/mods/anatomy/anatomy-formatting/default.json`
4. **Run CLI validator** for system-wide consistency check
5. **Consult** [Body Descriptors Guide](./body-descriptors-complete.md) for complete reference

### Tools

#### CLI Tool: validate-body-descriptors.js

**Location:** [`scripts/validate-body-descriptors.js`](../../scripts/validate-body-descriptors.js)

**Usage:**
```bash
# Run complete system consistency validation
npm run validate:body-descriptors
```

**Example Output:**
```
🔍 Body Descriptor System Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Registry loaded: 6 descriptors registered
✓ Formatting config validated
✓ Sample recipes validated

REGISTERED DESCRIPTORS:
  1. height (order: 10)
  2. skinColor (order: 20)
  3. build (order: 30)
  4. composition (order: 40)
  5. hairDensity (order: 50)
  6. smell (order: 60)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Validation Complete: No errors found
```

**With Errors:**
```
🔍 Body Descriptor System Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ERRORS:
  ✗ Formatting config missing descriptionOrder

WARNINGS:
  ⚠ Body descriptor 'smell' missing from descriptionOrder
  ⚠ Recipe anatomy:human_male: Invalid value 'super-tall' for height

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✗ Validation Failed: 1 error(s), 2 warning(s)
```

#### Programmatic API

```javascript
import { BodyDescriptorValidator } from './src/anatomy/validators/bodyDescriptorValidator.js';

// Create validator
const validator = new BodyDescriptorValidator({ logger });

// Validate recipe descriptors
const recipeResult = validator.validateRecipeDescriptors(recipe.bodyDescriptors);
if (!recipeResult.valid) {
  console.error('Recipe errors:', recipeResult.errors);
  console.warn('Recipe warnings:', recipeResult.warnings);
}

// Validate formatting config
const configResult = validator.validateFormattingConfig(formattingConfig);
if (!configResult.valid) {
  console.error('Config errors:', configResult.errors);
}

// System-wide consistency check
const systemResult = await validator.validateSystemConsistency({ dataRegistry });
console.log('System validation:', systemResult);
```

## Best Practices

### Development Workflow

Follow this workflow for creating and modifying anatomy content:

```
1. Create/Modify Content
   ├─→ Edit JSON files (recipes, blueprints, etc.)
   └─→ Follow schema structure

2. Schema Validation (Stage 1)
   ├─→ Automatic during mod loading
   └─→ Fix any schema errors immediately

3. Pre-flight Validation (Stage 2)
   ├─→ Run: node scripts/validate-recipe.js <recipe>
   └─→ Fix errors before proceeding to testing

4. Runtime Testing (Stage 3)
   ├─→ Test in actual game environment
   └─→ Monitor for runtime validation errors

5. Descriptor Validation (Stage 4)
   ├─→ Run: npm run validate:body-descriptors
   └─→ Ensure system consistency
```

### Validation Strategy

**Always validate early and often:**

✅ **DO:**
- Run pre-flight validation during development
- Fix errors in order: Schema → Pre-flight → Runtime → Descriptors
- Use CLI tools for isolated validation
- Check validation reports completely before testing
- Test incrementally (explicit slots before patterns)

❌ **DON'T:**
- Skip pre-flight validation
- Ignore warnings (they often become errors)
- Test without running validators first
- Make multiple changes without validating
- Rely only on runtime validation

### Incremental Development

**Start simple, add complexity gradually:**

```json
// Step 1: Explicit slots only
{
  "slots": {
    "head": { "partType": "dragon_head" },
    "torso": { "partType": "dragon_body" }
  }
}

// Step 2: Add patterns after validation
{
  "patterns": [
    {
      "slotsMatchingRegex": "leg_.*",
      "descriptor": { "partType": "dragon_leg" }
    }
  ]
}

// Step 3: Add constraints after testing
{
  "constraints": {
    "requires": [
      { "group": "limbSet:wing", "minCount": 2 }
    ]
  }
}
```

### Error Prioritization

**Fix errors in this order:**

1. **Schema Errors (Stage 1)** - Blocking, fix immediately
2. **Component/Property Errors (Stage 2)** - Critical, prevents loading
3. **Blueprint/Socket Errors (Stage 2)** - Critical, prevents generation
4. **Part Availability Errors (Stage 2)** - Critical, prevents generation
5. **Pattern Warnings (Stage 2)** - Important, may cause runtime issues
6. **Runtime Errors (Stage 3)** - Critical, generation will fail
7. **Descriptor Warnings (Stage 4)** - Non-blocking, should fix

### Tool Usage

**CLI Tool Examples:**

```bash
# During development: validate recipe before loading
node scripts/validate-recipe.js data/mods/anatomy/recipes/my_creature.recipe.json

# Verbose mode for debugging
node scripts/validate-recipe.js --verbose my_creature.recipe.json

# JSON output for CI/CD integration
node scripts/validate-recipe.js --json my_creature.recipe.json > validation-report.json

# Validate all recipes in a mod
node scripts/validate-recipe.js data/mods/my_mod/recipes/*.recipe.json

# Body descriptor validation
npm run validate:body-descriptors
```

## Validation Checklist

Use this checklist to ensure comprehensive validation of anatomy content:

### Pre-Development Checklist

- [ ] **Schema Review**: Reviewed relevant schemas in `data/schemas/`
- [ ] **Blueprint Available**: Blueprint exists for recipe
- [ ] **Components Registered**: All required components exist in registry
- [ ] **Entity Definitions**: Entity definitions exist for all part types

### Stage 1: Schema Validation

- [ ] **Recipe Schema**: Recipe validates against `anatomy.recipe.schema.json`
- [ ] **Blueprint Schema**: Blueprint validates against `anatomy.blueprint.schema.json`
- [ ] **Component Schemas**: All components validate against their schemas
- [ ] **Required Fields**: All required fields present
- [ ] **Property Types**: All property types correct

### Stage 2: Pre-flight Validation

#### Component Existence (Critical)
- [ ] **Component References**: All components exist in registry
- [ ] **Slot Components**: All slot component references valid
- [ ] **Pattern Components**: All pattern component references valid

#### Property Schemas (Critical)
- [ ] **Property Values**: All property values valid per component schemas
- [ ] **Enum Values**: Enum properties use valid values
- [ ] **Type Matching**: Property types match schema definitions

#### Blueprint/Recipe Compatibility (Critical)
- [ ] **Blueprint Exists**: Recipe's blueprintId references valid blueprint
- [ ] **Required Slots**: Recipe covers all required blueprint slots
- [ ] **Slot Keys Valid**: Recipe slot keys exist in blueprint

#### Socket/Slot Compatibility (Critical)
- [ ] **Socket References**: All socket references valid in blueprint
- [ ] **Socket Availability**: Sockets available for slot definitions
- [ ] **Socket Types**: Part types compatible with socket types

#### Pattern Matching (Warning)
- [ ] **Pattern Matches**: Patterns match at least one slot
- [ ] **Regex Valid**: Pattern regex syntax correct
- [ ] **Group Matches**: matchesGroup references valid groups

#### Part Availability (Critical)
- [ ] **Explicit Slots**: Entity definitions exist for all explicit slots
- [ ] **Pattern Slots**: Entity definitions exist for pattern-matched slots
- [ ] **Part Types**: Part types defined in entity definitions

#### Body Descriptors (Suggestion)
- [ ] **Descriptor Coverage**: All appropriate descriptors included
- [ ] **Descriptor Values**: Descriptor values valid per registry
- [ ] **Custom Descriptors**: Free-form descriptors (skinColor, smell) provided

### Stage 3: Runtime Validation

#### Blueprint Validation
- [ ] **Slot Compatibility**: Recipe slots compatible with blueprint
- [ ] **Required Coverage**: All required slots covered
- [ ] **Pattern Satisfaction**: Patterns can be satisfied

#### Graph Integrity
- [ ] **No Cycles**: Entity graph has no cycles
- [ ] **Single Root**: Graph has exactly one root entity
- [ ] **No Orphans**: All parts connected to root
- [ ] **Socket Limits**: Socket occupancy within limits
- [ ] **Joint Consistency**: Joint data complete and consistent
- [ ] **Part Type Compatibility**: Parts match socket type requirements

### Stage 4: Descriptor Validation

- [ ] **Registry Consistency**: Descriptors match registry definitions
- [ ] **Formatting Config**: descriptionOrder includes all descriptors
- [ ] **System Consistency**: Schema, code, and config synchronized
- [ ] **Value Validation**: All descriptor values valid

### Post-Validation Checklist

- [ ] **No Errors**: All validation stages pass with no errors
- [ ] **Warnings Reviewed**: All warnings investigated and addressed
- [ ] **Tested**: Anatomy generates correctly in game
- [ ] **Documented**: Changes documented in commit message

## Troubleshooting Workflow

Follow this workflow when encountering validation errors:

### Step 1: Identify Validation Stage

```
Read Error Message
    │
    ├─→ "schema validation failed" → Stage 1: Schema Validation
    ├─→ "Recipe validation failed" → Stage 2: Pre-flight Validation
    ├─→ "Cycle detected" / "Orphaned part" → Stage 3: Runtime Validation
    └─→ "Invalid descriptor value" → Stage 4: Descriptor Validation
```

### Step 2: Gather Context

**For all stages:**
1. Read complete error message (don't skip details)
2. Note the `location` information (slot, component, property)
3. Check the `ruleId` or error type
4. Review context in ValidationReport or error details

**Enable debug logging:**
```javascript
// In logger configuration
{
  "anatomy": "debug",
  "validation": "debug",
  "recipePreflightValidator": "debug",
  "graphIntegrityValidator": "debug"
}
```

### Step 3: Use Validation Tools

**Stage 1 (Schema):**
```bash
# Schema errors appear automatically during mod loading
# Review console output for AJV validation errors
```

**Stage 2 (Pre-flight):**
```bash
# Run recipe validation CLI
node scripts/validate-recipe.js --verbose data/mods/anatomy/recipes/my_recipe.recipe.json

# Review complete ValidationReport
# Fix errors in order: component-existence → property-schema → blueprint → socket-slot
```

**Stage 3 (Runtime):**
```bash
# Enable debug logging and run game
# Check console for GraphIntegrityValidator errors
# Use anatomy visualizer to inspect entity graph
```

**Stage 4 (Descriptors):**
```bash
# Run body descriptor validation
npm run validate:body-descriptors

# Review descriptor registry
# Check formatting config
```

### Step 4: Check Referenced Files

**Common files to review:**

```
Recipe Errors:
├─→ Recipe file: data/mods/[mod]/recipes/[recipe].recipe.json
├─→ Blueprint: data/mods/anatomy/blueprints/[blueprint].blueprint.json
└─→ Components: data/mods/[mod]/components/*.component.json

Blueprint Errors:
├─→ Blueprint file: data/mods/anatomy/blueprints/[blueprint].blueprint.json
├─→ Structure template: data/mods/anatomy/structure-templates/[template].template.json
└─→ Slot definitions: Check slots and additionalSlots

Component Errors:
├─→ Component file: data/mods/[mod]/components/[component].component.json
├─→ Component schema: data/schemas/[component].schema.json
└─→ Component registry: Check if component is loaded

Entity Definition Errors:
├─→ Entity file: data/mods/[mod]/entities/[entity].entity.json
├─→ Part type: Check partType in entity definition
└─→ Entity schema: data/schemas/entity.schema.json
```

### Step 5: Consult Documentation

**Validation-specific guides:**
- This document for validation pipeline understanding
- [Common Errors Catalog](./common-errors.md) for specific error lookup
- [Troubleshooting Guide](./troubleshooting.md) for problem-oriented scenarios

**Content creation guides:**
- [Anatomy System Guide](./anatomy-system-guide.md) for architecture
- [Blueprints and Templates](./blueprints-and-templates.md) for blueprint creation
- [Recipe Pattern Matching](./recipe-pattern-matching.md) for pattern syntax
- [Body Descriptors Guide](./body-descriptors-complete.md) for descriptor details

### Step 6: Fix and Re-validate

**Incremental fixing workflow:**

```
1. Fix highest priority error
   ├─→ Make single, focused change
   └─→ Save file

2. Re-run validation
   ├─→ Use same validation command
   └─→ Check if error is resolved

3. Verify no new errors introduced
   ├─→ Check full validation report
   └─→ Compare error count

4. Repeat until all errors fixed
   └─→ Then address warnings
```

**Common fix patterns:**

```javascript
// Component Existence Error
// ❌ Error: Component 'anatomy:horned' does not exist
// ✅ Fix: Add component to registry or correct reference
{
  "slots": {
    "head": {
      "components": [
        { "componentId": "anatomy:head" }  // ← Use registered component
      ]
    }
  }
}

// Property Schema Error
// ❌ Error: Property 'size' has invalid value 'huge'
// ✅ Fix: Use valid enum value from component schema
{
  "components": [
    {
      "componentId": "anatomy:body",
      "size": "large"  // ← Valid value: small, medium, large
    }
  ]
}

// Socket/Slot Compatibility Error
// ❌ Error: Socket 'torso:wing_left' not found in blueprint
// ✅ Fix: Use correct socket name from blueprint
{
  "slots": {
    "left_wing": {
      "socket": "torso:appendage_left",  // ← Correct socket name
      "partType": "dragon_wing"
    }
  }
}

// Pattern Matching Warning
// ⚠️ Warning: Pattern 'leg_*' matched zero slots
// ✅ Fix: Update pattern to match blueprint slots or use matchesGroup
{
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",  // ← Use group instead of regex
      "descriptor": { "partType": "spider_leg" }
    }
  ]
}

// Part Availability Error
// ❌ Error: No entity definitions for partType 'dragon_head'
// ✅ Fix: Create entity definition or correct partType reference
{
  "slots": {
    "head": {
      "partType": "head",  // ← Generic partType with entities
      "requirements": { "tags": ["dragon"] }  // ← Use tags for specificity
    }
  }
}
```

### Step 7: Test Incrementally

**After fixing validation errors:**

1. **Run full validation suite**
   ```bash
   node scripts/validate-recipe.js data/mods/anatomy/recipes/my_recipe.recipe.json
   npm run validate:body-descriptors
   ```

2. **Test in game environment**
   - Load mod and observe mod loading output
   - Trigger anatomy generation
   - Check for runtime validation errors

3. **Verify anatomy generation**
   - Confirm all expected parts generated
   - Check entity graph structure
   - Validate component data integrity

4. **Review logs**
   - No validation errors in console
   - No warnings (or warnings understood and acceptable)
   - ANATOMY_GENERATED event dispatched successfully

## Tool Reference

### CLI Tools

#### validate-recipe.js

**Purpose:** Validate individual recipes without full app load

**Location:** `scripts/validate-recipe.js`

**Usage:**
```bash
# Basic validation
node scripts/validate-recipe.js <recipe-path>

# Verbose output with detailed logging
node scripts/validate-recipe.js --verbose <recipe-path>

# JSON output for CI/CD
node scripts/validate-recipe.js --json <recipe-path>

# Multiple recipes
node scripts/validate-recipe.js <recipe-pattern>
```

**Examples:**
```bash
# Single recipe by full path
node scripts/validate-recipe.js data/mods/anatomy/recipes/red_dragon.recipe.json

# Single recipe by name
node scripts/validate-recipe.js red_dragon.recipe.json

# All recipes in mod
node scripts/validate-recipe.js data/mods/my_mod/recipes/*.recipe.json

# With verbose logging
node scripts/validate-recipe.js --verbose red_dragon.recipe.json

# JSON output
node scripts/validate-recipe.js --json red_dragon.recipe.json > report.json
```

**Output:**
- **Console:** Formatted validation report with errors, warnings, suggestions
- **Exit Code:** 0 if passed, 1 if errors found
- **JSON Mode:** Machine-readable ValidationReport JSON

#### validate-body-descriptors

**Purpose:** Validate body descriptor system consistency

**Location:** `scripts/validate-body-descriptors.js`

**Usage:**
```bash
# Run system-wide descriptor validation
npm run validate:body-descriptors
```

**Validates:**
- Registry completeness (all descriptors registered)
- Formatting config consistency (descriptionOrder complete)
- Sample recipe descriptors (human_male, human_female)
- Schema/code/config synchronization

**Output:**
- List of registered descriptors with display order
- Formatting config validation results
- Sample recipe validation results
- Errors and warnings summary

### Programmatic APIs

#### RecipePreflightValidator

**Purpose:** Validate recipes programmatically

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`

**API:**
```javascript
import RecipePreflightValidator from './src/anatomy/validation/RecipePreflightValidator.js';

// Create validator
const validator = new RecipePreflightValidator({
  dataRegistry,          // IDataRegistry
  anatomyBlueprintRepository,  // IAnatomyBlueprintRepository
  schemaValidator,       // ISchemaValidator
  slotGenerator,         // ISlotGenerator
  logger,                // ILogger
  loadFailures: {}       // Optional: tracking load failures
});

// Validate recipe
const report = await validator.validate(recipe, {
  recipePath: string,                    // Optional: for error context
  failFast: boolean,                     // Stop on first error (default: false)
  skipPatternValidation: boolean,        // Skip pattern matching (default: false)
  skipDescriptorChecks: boolean,         // Skip descriptor coverage (default: false)
  skipPartAvailabilityChecks: boolean,   // Skip part availability (default: false)
  skipGeneratedSlotChecks: boolean,      // Skip generated slot checks (default: false)
  skipLoadFailureChecks: boolean         // Skip load failure checks (default: false)
});

// Check results
if (report.hasErrors()) {
  console.error('Validation failed');
  console.error('Errors:', report.errors);
  console.warn('Warnings:', report.warnings);
} else {
  console.log('Validation passed');
  console.info('Suggestions:', report.suggestions);
}

// Access report properties
report.recipeId       // Recipe identifier
report.recipePath     // Recipe file path
report.timestamp      // Validation timestamp
report.errors         // Array of error objects
report.warnings       // Array of warning objects
report.suggestions    // Array of suggestion objects
report.passed         // Array of passed rule IDs
```

#### BodyDescriptorValidator

**Purpose:** Validate body descriptors programmatically

**Location:** `src/anatomy/validators/bodyDescriptorValidator.js`

**API:**
```javascript
import { BodyDescriptorValidator } from './src/anatomy/validators/bodyDescriptorValidator.js';

// Create validator
const validator = new BodyDescriptorValidator({ logger });

// Validate recipe descriptors
const recipeResult = validator.validateRecipeDescriptors(bodyDescriptors);
// Returns: { valid: boolean, errors: string[], warnings: string[] }

// Validate formatting config
const configResult = validator.validateFormattingConfig(formattingConfig);
// Returns: { valid: boolean, errors: string[], warnings: string[] }

// System-wide consistency check
const systemResult = await validator.validateSystemConsistency({ dataRegistry });
// Returns: { errors: string[], warnings: string[], info: string[] }
```

#### GraphIntegrityValidator

**Purpose:** Validate runtime anatomy graphs

**Location:** `src/anatomy/graphIntegrityValidator.js`

**API:**
```javascript
import { GraphIntegrityValidator } from './src/anatomy/graphIntegrityValidator.js';

// Create validator
const validator = new GraphIntegrityValidator({
  entityManager,  // IEntityManager
  logger          // ILogger
});

// Validate generated graph
const result = await validator.validateGraph(
  entityIds,        // string[] - All entity IDs in graph
  recipe,           // object - Recipe used for generation
  socketOccupancy   // Set<string> - Occupied sockets tracking
);

// Check results
if (!result.valid) {
  console.error('Graph validation failed');
  console.error('Errors:', result.errors);
  console.warn('Warnings:', result.warnings);
}
```

### Validation Helper Functions

#### validateRecipeSlots

**Purpose:** Validate recipe slots against blueprint

**Location:** `src/anatomy/bodyBlueprintFactory/blueprintValidator.js`

**API:**
```javascript
import { validateRecipeSlots } from './src/anatomy/bodyBlueprintFactory/blueprintValidator.js';

// Validate slots
validateRecipeSlots(recipe, blueprint, eventDispatcher);
// Throws: ValidationError if invalid slots found
```

#### checkBlueprintRecipeCompatibility

**Purpose:** Check blueprint/recipe compatibility

**Location:** `src/anatomy/bodyBlueprintFactory/blueprintValidator.js`

**API:**
```javascript
import { checkBlueprintRecipeCompatibility } from './src/anatomy/bodyBlueprintFactory/blueprintValidator.js';

// Check compatibility
const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
  recipePatternResolver,  // IRecipePatternResolver
  logger                   // ILogger
});

// Review issues
for (const issue of issues) {
  console.log(`${issue.severity}: ${issue.message}`);
}
```

## Summary

The anatomy system's validation pipeline provides comprehensive error detection across four distinct stages:

1. **Stage 1: Schema Validation** - Automatic JSON schema validation during mod loading
2. **Stage 2: Pre-flight Validation** - 9 comprehensive validation checks before runtime
3. **Stage 3: Runtime Validation** - Blueprint compatibility and graph integrity during generation
4. **Stage 4: Descriptor Validation** - Body descriptor consistency across schema, code, and config

**Key Takeaways:**

- **Validate Early**: Use CLI tools during development, not just at runtime
- **Fix Incrementally**: Address errors in order of priority and stage
- **Use Tools**: Leverage validate-recipe.js and validate-body-descriptors
- **Read Reports**: Validation reports contain detailed context and location information
- **Consult Docs**: This guide integrates with Common Errors, Troubleshooting, and Body Descriptors guides

**Quick Reference Commands:**

```bash
# Recipe validation
node scripts/validate-recipe.js <recipe-path>

# Body descriptor validation
npm run validate:body-descriptors

# Verbose output
node scripts/validate-recipe.js --verbose <recipe-path>

# JSON output for CI/CD
node scripts/validate-recipe.js --json <recipe-path>
```

**Related Documentation:**

- [Common Errors Catalog](./common-errors.md) - Detailed error reference with fixes
- [Troubleshooting Guide](./troubleshooting.md) - Problem-oriented scenarios
- [Body Descriptors Guide](./body-descriptors-complete.md) - Complete descriptor documentation
- [Anatomy System Guide](./anatomy-system-guide.md) - Architecture and concepts
- [Recipe Pattern Matching](./recipe-pattern-matching.md) - Pattern syntax and matching

---

**Document Version:** 1.0.0
**Last Updated:** 2024-01-15
**Maintainer:** Living Narrative Engine Team

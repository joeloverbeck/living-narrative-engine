# Recipe Validation Architecture Analysis

**Date:** 2025-01-14
**Scope:** `npm run validate:recipe` implementation
**Focus:** Patchwork development patterns and architectural weaknesses

---

## Executive Summary

The recipe validation system exhibits **classic patchwork architecture** characteristics, where features were incrementally bolted onto a growing monolithic class rather than refactored into cohesive design. The core validator (`RecipePreflightValidator.js`) violates project guidelines with **1,207 lines** (guideline: max 500) and demonstrates multiple anti-patterns that compromise robustness, flexibility, and maintainability.

### Critical Findings

| Issue                                | Severity    | Impact                                   |
| ------------------------------------ | ----------- | ---------------------------------------- |
| God Class Anti-Pattern (1,207 lines) | 🔴 Critical | Violates project guidelines, untestable  |
| Boolean Flag Proliferation (7 flags) | 🔴 Critical | 128 test configurations, high complexity |
| Code Duplication (5 instances)       | 🟡 High     | Maintenance burden, bug propagation      |
| Hardcoded Dependencies               | 🟡 High     | Inflexible, brittle to changes           |
| Inconsistent Error Handling          | 🟡 High     | Unpredictable behavior                   |
| Zero Test Coverage                   | 🔴 Critical | No unit tests for core validator         |

---

## Validation System Architecture

### Entry Point Flow

```
CLI (validate-recipe.js)
    ↓
Recipe Loading (loadRecipeFile)
    ↓
Context Creation (createValidationContext)
    ├─ Manual Mod Loading
    ├─ Phase Orchestration (Schema → Manifest → Content)
    └─ DataRegistry Initialization
    ↓
Core Validation (RecipePreflightValidator)
    ├─ 11 Sequential Validation Checks
    ├─ Error/Warning/Suggestion Accumulation
    └─ Results Formatting
    ↓
Output (validateRecipeCore.js formatters)
```

### Component Architecture

```
scripts/validate-recipe.js (248 lines)
    ├─ CLI interface (Commander.js)
    ├─ Recipe file loading
    ├─ Validation context creation
    └─ Output formatting

src/anatomy/validation/
    ├─ RecipePreflightValidator.js (1,207 lines) ⚠️ MONOLITHIC
    ├─ ValidationReport.js (292 lines)
    ├─ loadTimeValidationContext.js (166 lines)
    │
    ├─ rules/
    │   ├─ componentExistenceValidationRule.js (377 lines)
    │   └─ propertySchemaValidationRule.js (409 lines)
    │
    └─ validators/
        ├─ socketSlotCompatibilityValidator.js (211 lines)
        └─ patternMatchingValidator.js (293 lines)
```

**Total Lines Analyzed:** ~3,534 across 10 files

---

## Patchwork Development Patterns

### 1. God Class Anti-Pattern

**Location:** `RecipePreflightValidator.js` (1,207 lines)

**Violation:** Project guideline states "Never create files > 500 lines"

**Structure:**

```javascript
class RecipePreflightValidator {
  // 11 validation checks crammed into single class
  async #runValidationChecks(recipe, results, options) {
    // 1. Component Existence (Critical - P0)
    await this.#checkComponentExistence(recipe, results);

    // 2. Property Schemas (Critical - P0)
    if (results.errors.length === 0 || !options.failFast) {
      await this.#checkPropertySchemas(recipe, results);
    }

    // 3. Body Descriptors (Critical - P0)
    if (results.errors.length === 0 || !options.failFast) {
      await this.#checkBodyDescriptors(recipe, results);
    }

    // 4. Blueprint Exists (Critical - P0)
    if (results.errors.length === 0 || !options.failFast) {
      await this.#checkBlueprintExists(recipe, results);
    }

    // 5. Socket/Slot Compatibility (High - P1)
    if (results.errors.length === 0 || !options.failFast) {
      await this.#checkSocketSlotCompatibility(recipe, results);
    }

    // 6. Pattern Matching (High - P1)
    if (!options.skipPatternValidation) {
      await this.#checkPatternMatching(recipe, results);
    }

    // 7. Descriptor Coverage (Medium - P2)
    if (!options.skipDescriptorChecks) {
      this.#checkDescriptorCoverage(recipe, results);
    }

    // 8. Part Availability (Medium - P2)
    if (!options.skipPartAvailabilityChecks) {
      await this.#checkPartAvailability(recipe, results);
    }

    // 9. Generated Slot Part Availability (Medium - P2)
    if (!options.skipGeneratedSlotChecks) {
      await this.#checkGeneratedSlotPartAvailability(recipe, results);
    }

    // 10. Entity Load Failures (Low - P3)
    if (!options.skipLoadFailureChecks) {
      this.#checkEntityLoadFailures(recipe, results);
    }

    // 11. Recipe Usage (Informational - P4)
    if (!options.skipRecipeUsageCheck) {
      this.#checkRecipeUsage(recipe, results);
    }
  }

  // 12 async methods implementing checks...
}
```

**Issues:**

- **Single Responsibility Violation:** Class handles orchestration + 11 validation types
- **High Coupling:** Cannot reuse individual validators outside this class
- **Poor Testability:** Cannot unit test individual checks in isolation
- **Maintenance Burden:** Adding new validation requires modifying 1,200+ line file

---

### 2. Boolean Flag Proliferation

**Location:** `RecipePreflightValidator.js` lines 100-148

**Flags Identified:**

```javascript
const options = {
  failFast: boolean, // (1) Stop on first error
  skipPatternValidation: boolean, // (2) Skip pattern matching check
  skipDescriptorChecks: boolean, // (3) Skip descriptor coverage check
  skipPartAvailabilityChecks: boolean, // (4) Skip part availability check
  skipGeneratedSlotChecks: boolean, // (5) Skip generated slot check
  skipLoadFailureChecks: boolean, // (6) Skip load failure check
  skipRecipeUsageCheck: boolean, // (7) Skip recipe usage check
};
```

**Complexity Explosion:**

- **7 boolean flags** = **2^7 = 128 possible configurations**
- Each new requirement added another flag instead of refactoring
- No validation pipeline abstraction to manage orchestration

**Code Smell Example:**

```javascript
// Lines 118-148: Flag-driven execution control
if (!options.skipPatternValidation) {
  await this.#checkPatternMatching(recipe, results);
}

if (!options.skipDescriptorChecks) {
  this.#checkDescriptorCoverage(recipe, results);
}

if (!options.skipPartAvailabilityChecks) {
  await this.#checkPartAvailability(recipe, results);
}

if (!options.skipGeneratedSlotChecks) {
  await this.#checkGeneratedSlotPartAvailability(recipe, results);
}

if (!options.skipLoadFailureChecks) {
  this.#checkEntityLoadFailures(recipe, results);
}

if (!options.skipRecipeUsageCheck) {
  this.#checkRecipeUsage(recipe, results);
}
```

**Anti-Pattern:** Instead of abstracting validation pipeline, each new check added:

1. New `skip*` flag
2. New `if (!options.skip*)` wrapper
3. Increased configuration complexity

---

### 3. Hardcoded Mod Dependencies

**Location:** `scripts/validate-recipe.js` lines 84-99

**Hardcoded Values:**

```javascript
// Hardcoded essential mods for recipe validation
const essentialMods = [
  'core', // ← Hardcoded
  'descriptors', // ← Hardcoded
  'anatomy', // ← Hardcoded
];

// Brittle path parsing using regex
const pathMatch = recipePath?.match(/data\/mods\/([^/]+)\//);
const recipeModName = pathMatch ? pathMatch[1] : null;

// No configuration file, no DI, no flexibility
const modsToLoad = [...essentialMods];
if (recipeModName && !modsToLoad.includes(recipeModName)) {
  modsToLoad.push(recipeModName);
}
```

**Issues:**

- **Cannot validate recipes from other mods** without code modification
- **Brittle filesystem dependency:** Assumes `data/mods/{modName}/` structure
- **No configuration:** Should read from config file or accept CLI argument
- **Violates DI principles:** Dependencies should be injected, not hardcoded

**Impact:**

- Adding new mod to validation requires code change
- Directory structure change breaks validation
- Testing with different mod combinations impossible

---

### 4. Inline Blueprint Processing

**Location:** `RecipePreflightValidator.js` lines 400-445

**Duplicated Logic:**

```javascript
async #ensureBlueprintProcessed(blueprint) {
  // V1 blueprints or already-processed blueprints pass through
  if (!blueprint.structureTemplate || blueprint._generatedSockets) {
    return blueprint;  // ← Magic field check
  }

  // V2 blueprint needs processing (duplicates production code)
  const template = this.#dataRegistry.get(
    'anatomyStructureTemplates',
    blueprint.structureTemplate
  );

  if (!template) {
    throw new Error(`Structure template not found: ${blueprint.structureTemplate}`);
  }

  // Generate slots from structure template
  const generatedSlots = this.#slotGenerator.generateBlueprintSlots(template);

  // Merge with additionalSlots
  const additionalSlots = blueprint.additionalSlots || {};
  const mergedSlots = {
    ...generatedSlots,
    ...additionalSlots,
  };

  // Return processed blueprint with magic marker
  return {
    ...blueprint,
    slots: mergedSlots,
    _generatedSockets: true, // ← Magic field added
  };
}
```

**Issues:**

- **Magic Field `_generatedSockets`:** Used as processing marker, not documented
- **Duplicated Processing Logic:** Production code has similar logic
- **Mixed V1/V2 Handling:** Inline version detection and transformation
- **Ad-hoc Mutation:** Blueprint objects mutated with undocumented fields

**Should Be:**

```javascript
// Production blueprint processor service
const processedBlueprint = blueprintProcessor.process(rawBlueprint);

// Validator uses processed blueprints
await this.#validateBlueprint(processedBlueprint);
```

---

### 5. Duplicated Entity Matching Logic

**Locations:**

- `RecipePreflightValidator.js` lines 661-692 (`#findMatchingEntities`)
- `RecipePreflightValidator.js` lines 873-916 (`#findMatchingEntitiesForSlot`)

**Implementation 1:**

```javascript
#findMatchingEntities(slotOrPattern, allEntityDefs) {
  const matches = [];
  const requiredPartType = slotOrPattern.partType;
  const requiredTags = slotOrPattern.tags || [];
  const requiredPropertyValues = slotOrPattern.properties || {};

  for (const entityDef of allEntityDefs) {
    const anatomyPart = entityDef.components?.['anatomy:part'];
    if (!anatomyPart) continue;

    // Check part type
    if (requiredPartType && anatomyPart.subType !== requiredPartType) {
      continue;
    }

    // Check all required tags
    const entityTags = anatomyPart.tags || [];
    const hasAllTags = requiredTags.every((tag) => entityTags.includes(tag));
    if (!hasAllTags) continue;

    // Check property values
    let propertiesMatch = true;
    for (const [propKey, expectedValue] of Object.entries(requiredPropertyValues)) {
      if (anatomyPart.properties?.[propKey] !== expectedValue) {
        propertiesMatch = false;
        break;
      }
    }

    if (propertiesMatch) {
      matches.push(entityDef.id);
    }
  }

  return matches;
}
```

**Implementation 2:**

```javascript
#findMatchingEntitiesForSlot(requirements, allEntityDefs) {
  const matches = [];
  const { partType, allowedTypes, tags, properties } = requirements;

  for (const entityDef of allEntityDefs) {
    const anatomyPart = entityDef.components?.['anatomy:part'];
    if (!anatomyPart) continue;

    // Check part type (same logic)
    if (partType && anatomyPart.subType !== partType) {
      continue;
    }

    // ← NEW: Check allowedTypes (bolt-on feature)
    if (allowedTypes && !allowedTypes.includes(anatomyPart.subType)) {
      continue;
    }

    // Check all required tags (same logic)
    const entityTags = anatomyPart.tags || [];
    const hasAllTags = tags.every((tag) => entityTags.includes(tag));
    if (!hasAllTags) continue;

    // Check property values (same logic)
    let propertiesMatch = true;
    for (const [propKey, expectedValue] of Object.entries(properties)) {
      if (anatomyPart.properties?.[propKey] !== expectedValue) {
        propertiesMatch = false;
        break;
      }
    }

    if (propertiesMatch) {
      matches.push(entityDef.id);
    }
  }

  return matches;
}
```

**Issues:**

- **95% identical logic** duplicated
- **Single-feature difference:** `allowedTypes` check added in second version
- **Bug propagation risk:** Fixes must be applied twice
- **Violates DRY principle**

**Should Be:**

```javascript
// Unified entity matcher service
const matcher = new EntityMatcher(dataRegistry);
const matches = matcher.findEntities({
  partType: 'head',
  allowedTypes: ['humanoid', 'alien'],
  tags: ['facial_features'],
  properties: { symmetry: 'bilateral' },
});
```

---

### 6. Levenshtein Distance Triplication

**Found in 3 separate files:**

1. **`socketSlotCompatibilityValidator.js` lines 16-42**
2. **`propertySchemaValidationRule.js` lines 382-408**
3. **`patternMatchingValidator.js`** (inferred from suggestion logic)

**Identical Implementation:**

```javascript
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
```

**Issues:**

- **Copy-paste development pattern**
- **No shared utility module** for string similarity
- **Triple maintenance burden** for algorithm changes

**Should Be:**

```javascript
// src/utils/stringUtils.js
export function levenshteinDistance(a, b) {
  /* ... */
}

// Import in all validators
import { levenshteinDistance } from '../../utils/stringUtils.js';
```

---

### 7. Inconsistent Error Handling

**Three Different Patterns Found:**

#### Pattern A: Error Accumulation (Component Existence)

```javascript
async #checkComponentExistence(recipe, results) {
  try {
    const componentRule = new ComponentExistenceValidationRule({...});
    const issues = await componentRule.validate(context);
    const errors = issues.filter((i) => i.severity === 'error');

    if (errors.length === 0) {
      results.passed.push({...});
    } else {
      results.errors.push(...errors);  // ← Adds to errors array
    }
  } catch (error) {
    this.#logger.error('component-existence check failed', error);
    results.errors.push({  // ← Exception → errors array
      type: 'VALIDATION_ERROR',
      check: 'component_existence',
      message: 'Failed to validate component existence',
      error: error.message,
    });
  }
}
```

#### Pattern B: Warning on Exception (Socket/Slot Compatibility)

```javascript
async #checkSocketSlotCompatibility(recipe, results) {
  try {
    const errors = await validateSocketSlotCompatibility(blueprint, this.#dataRegistry);

    if (errors.length === 0) {
      results.passed.push({...});
    } else {
      results.errors.push(...errors);  // ← Validation errors → errors
    }
  } catch (error) {
    this.#logger.error('socket-slot-compatibility check failed', error);
    results.warnings.push({  // ← Exception → warnings array (inconsistent!)
      type: 'VALIDATION_WARNING',
      check: 'socket_slot_compatibility',
      message: 'Failed to validate socket/slot compatibility',
      error: error.message,
    });
  }
}
```

#### Pattern C: Silent Failure (Descriptor Coverage)

```javascript
#checkDescriptorCoverage(recipe, results) {
  try {
    // ... validation logic ...

    if (suggestions.length > 0) {
      results.suggestions.push(...suggestions);
    }
  } catch (error) {
    this.#logger.error('descriptor-coverage check failed', error);
    // ← NO error/warning added to results! Silent failure!
  }
}
```

**Issues:**

- **No consistent error severity policy**
- **Unpredictable behavior:** Same exception type → different severity
- **Silent failures mask problems**

**Mapping:**

| Validation Check          | Success →   | Exception →  | Pattern |
| ------------------------- | ----------- | ------------ | ------- |
| Component Existence       | passed      | errors       | A       |
| Property Schemas          | passed      | errors       | A       |
| Body Descriptors          | passed      | errors       | A       |
| Blueprint Exists          | passed      | errors       | A       |
| Socket/Slot Compatibility | passed      | **warnings** | B       |
| Pattern Matching          | passed      | **warnings** | B       |
| Descriptor Coverage       | suggestions | **silent**   | C       |
| Part Availability         | passed      | errors       | A       |
| Generated Slots           | passed      | errors       | A       |
| Load Failures             | warnings    | **silent**   | C       |
| Recipe Usage              | passed      | **silent**   | C       |

---

### 8. Manual Phase Orchestration

**Location:** `scripts/validate-recipe.js` lines 106-135

**Bypassing Loader System:**

```javascript
// Create load context
let context = createLoadContext({
  worldName: 'recipe-validation',
  requestedMods: modsToLoad,
  registry: dataRegistry,
});

// Manually execute phases (bypassing normal loader orchestration)
const schemaPhase = container.resolve(tokens.SchemaPhase);
const manifestPhase = container.resolve(tokens.ManifestPhase);
const contentPhase = container.resolve(tokens.ContentPhase);

if (verbose) {
  console.log(chalk.blue('   Running SchemaPhase...'));
}
context = await schemaPhase.execute(context);

if (verbose) {
  console.log(chalk.blue('   Running ManifestPhase...'));
}
context = await manifestPhase.execute(context);

if (verbose) {
  console.log(chalk.blue('   Running ContentPhase...'));
}
context = await contentPhase.execute(context);

// NOTE: Deliberately skipping GameConfigPhase to avoid game.json override
```

**Issues:**

- **Duplicates phase ordering logic** from production loader
- **Tight coupling** to phase implementation details
- **Bypasses loader orchestration** for special-case behavior
- **No loader configuration API** for selective phase execution

**Impact:**

- Future phase changes require CLI tool updates
- Cannot reuse phase orchestration patterns
- Violates encapsulation of loader system

**Should Be:**

```javascript
// Loader configuration API
const loader = createLoader({
  worldName: 'recipe-validation',
  mods: modsToLoad,
  phases: {
    schema: true,
    manifest: true,
    content: true,
    gameConfig: false, // ← Configure, don't bypass
  },
});

const context = await loader.execute();
```

---

### 9. Body Descriptor Validation Inline

**Location:** `RecipePreflightValidator.js` lines 224-324

**100-line method with nested schema extraction:**

```javascript
async #checkBodyDescriptors(recipe, results) {
  try {
    // Get anatomy:body component to retrieve schema
    const bodyComponent = this.#dataRegistry.get('components', 'anatomy:body');
    if (!bodyComponent) {
      this.#logger.error('anatomy:body component not found in registry');
      return;
    }

    // Extract descriptors schema from component (hardcoded path traversal)
    const descriptorsSchema = bodyComponent.dataSchema?.properties?.body?.properties?.descriptors;
    if (!descriptorsSchema) {
      this.#logger.error('Could not extract descriptors schema from anatomy:body');
      return;
    }

    // Get body descriptors from recipe
    const bodyDescriptors = recipe.body?.descriptors || {};
    const errors = [];
    const descriptorProperties = descriptorsSchema.properties || {};

    // Manually validate each descriptor field
    for (const [descriptorKey, descriptorValue] of Object.entries(bodyDescriptors)) {
      const propertySchema = descriptorProperties[descriptorKey];

      if (!propertySchema) {
        errors.push({
          type: 'UNKNOWN_DESCRIPTOR',
          descriptor: descriptorKey,
          message: `Unknown descriptor: ${descriptorKey}`,
        });
        continue;
      }

      // Manual enum validation (instead of using AJV)
      if (propertySchema.enum) {
        if (!propertySchema.enum.includes(descriptorValue)) {
          errors.push({
            type: 'INVALID_ENUM_VALUE',
            descriptor: descriptorKey,
            value: descriptorValue,
            allowedValues: propertySchema.enum,
            message: `Invalid value for ${descriptorKey}`,
          });
        }
      }

      // Manual type validation (instead of using AJV)
      if (propertySchema.type && typeof descriptorValue !== propertySchema.type) {
        errors.push({
          type: 'TYPE_MISMATCH',
          descriptor: descriptorKey,
          expectedType: propertySchema.type,
          actualType: typeof descriptorValue,
          message: `Type mismatch for ${descriptorKey}`,
        });
      }
    }

    // Accumulate results
    if (errors.length === 0) {
      results.passed.push({
        check: 'body_descriptors',
        message: 'Body descriptors are valid',
      });
    } else {
      results.errors.push(...errors);
    }
  } catch (error) {
    this.#logger.error('body-descriptors check failed', error);
    results.errors.push({
      type: 'VALIDATION_ERROR',
      check: 'body_descriptors',
      message: 'Failed to validate body descriptors',
      error: error.message,
    });
  }
}
```

**Issues:**

- **Hardcoded schema path:** `dataSchema?.properties?.body?.properties?.descriptors`
- **Manual validation logic:** Reimplements AJV functionality
- **Duplicates schema validation** from `PropertySchemaValidationRule`
- **Tight coupling** to `anatomy:body` component structure

**Should Be:**

```javascript
async #checkBodyDescriptors(recipe, results) {
  const validator = this.#bodyDescriptorValidator;
  const validationResult = await validator.validate(recipe.body?.descriptors);

  if (validationResult.isValid) {
    results.passed.push({ check: 'body_descriptors' });
  } else {
    results.errors.push(...validationResult.errors);
  }
}
```

---

## Validation Layer Analysis

### Layer 1: Schema Validation (AJV Integration)

**Implementation:**

- `propertySchemaValidationRule.js` - Validates properties against JSON schemas
- Inline schema validation in `#checkBodyDescriptors`

**Strengths:**

- Uses industry-standard AJV library
- Provides Levenshtein-based enum suggestions

**Weaknesses:**

- **Dual validation paths:** Registered schema vs inline fallback
- **Inconsistent schema loading:** Some validators bypass registry
- **No centralized AJV configuration:** Each validator configures separately

**Architecture Issue:**

```javascript
// Pattern A: Using registered schema (proper)
const schema = this.#schemaRegistry.getSchema('anatomy:body');
const valid = this.#ajv.validate(schema, data);

// Pattern B: Inline schema extraction (improper)
const bodyComponent = this.#dataRegistry.get('components', 'anatomy:body');
const schema =
  bodyComponent.dataSchema?.properties?.body?.properties?.descriptors;
// Manual validation instead of AJV
```

---

### Layer 2: Recipe Business Logic Validation

**Checks Implemented:**

| #   | Check Name                | Implementation                     | Lines | Abstraction             |
| --- | ------------------------- | ---------------------------------- | ----- | ----------------------- |
| 1   | Component Existence       | `ComponentExistenceValidationRule` | 377   | ValidationRule class ✅ |
| 2   | Property Schemas          | `PropertySchemaValidationRule`     | 409   | ValidationRule class ✅ |
| 3   | Body Descriptors          | Inline method                      | 100   | None ❌                 |
| 4   | Blueprint Exists          | Inline method                      | 60    | None ❌                 |
| 5   | Socket/Slot Compatibility | External function                  | 211   | External validator      |
| 6   | Pattern Matching          | External function                  | 293   | External validator      |
| 7   | Descriptor Coverage       | Inline method                      | 80    | None ❌                 |
| 8   | Part Availability         | Inline method                      | 120   | None ❌                 |
| 9   | Generated Slot Parts      | Inline method                      | 163   | None ❌                 |
| 10  | Entity Load Failures      | Inline method                      | 40    | None ❌                 |
| 11  | Recipe Usage              | Inline method                      | 50    | None ❌                 |

**Pattern Inconsistency:**

- **Checks 1-2:** Proper abstraction using `ValidationRule` base class
- **Checks 3-11:** Inline methods in monolithic class
- **No consistent validation interface**

**Should Be:**

```javascript
// All validators implement common interface
interface IValidator {
  validate(recipe: Recipe, context: ValidationContext): ValidationResult;
}

// Orchestrator composes validators
class ValidationPipeline {
  constructor(validators: IValidator[]) { ... }

  async execute(recipe, options) {
    for (const validator of this.validators) {
      if (this.shouldRun(validator, options)) {
        await validator.validate(recipe, this.context);
      }
    }
  }
}
```

---

### Layer 3: Cross-Reference Validation

**External Validators:**

- `socketSlotCompatibilityValidator.js` (211 lines)
- `patternMatchingValidator.js` (293 lines)

**Implementation Pattern:**

```javascript
// Standalone function instead of service
export async function validateSocketSlotCompatibility(blueprint, dataRegistry) {
  const errors = [];

  // Direct dataRegistry access (tight coupling)
  const allEntityDefs = dataRegistry.getAll('entities');

  // Inline Levenshtein distance (duplicated)
  function levenshteinDistance(a, b) {
    /* ... */
  }

  // Validation logic...

  return errors;
}
```

**Issues:**

- **No dependency injection:** Direct `dataRegistry` parameter
- **Tight coupling:** Cannot mock for testing
- **Code duplication:** Levenshtein distance, entity matching
- **Not composable:** Cannot integrate into validation pipeline

**Should Be:**

```javascript
// Proper service with DI
class SocketSlotCompatibilityValidator {
  constructor({ dataRegistry, stringMatcher, logger }) {
    this.#dataRegistry = dataRegistry;
    this.#stringMatcher = stringMatcher; // Levenshtein service
    this.#logger = logger;
  }

  async validate(blueprint) {
    // Validation logic using injected dependencies
    return new ValidationResult(errors, warnings);
  }
}
```

---

## Configuration vs Hardcoded Rules

### Hardcoded Elements

| Element                   | Location                             | Impact                          |
| ------------------------- | ------------------------------------ | ------------------------------- |
| Mod dependencies          | `validate-recipe.js:86-88`           | Cannot validate other mods      |
| Path parsing regex        | `validate-recipe.js:91`              | Breaks on structure change      |
| Validation check order    | `RecipePreflightValidator.js:95-149` | Cannot reorder priorities       |
| Error severity mapping    | Throughout validator                 | Inconsistent severities         |
| Blueprint processing flag | `RecipePreflightValidator.js:400`    | Magic field `_generatedSockets` |
| Phase execution sequence  | `validate-recipe.js:106-135`         | Duplicates loader logic         |

### Configuration System

**Current State:** ❌ **None exists**

**Should Have:**

```javascript
// validation-config.json
{
  "mods": {
    "essential": ["core", "descriptors", "anatomy"],
    "optional": [],
    "autoDetect": true
  },
  "validators": [
    {
      "name": "component_existence",
      "priority": 0,
      "failFast": true,
      "enabled": true
    },
    {
      "name": "socket_slot_compatibility",
      "priority": 1,
      "failFast": false,
      "enabled": true
    }
  ],
  "errorHandling": {
    "defaultSeverity": "error",
    "severityOverrides": {
      "socket_slot_compatibility": "warning"
    }
  }
}
```

---

## Test Coverage Assessment

### Unit Tests

**Found:** ❌ **None for `RecipePreflightValidator`**

**Testing Challenges:**

- **1,207-line monolithic class:** Impossible to unit test in isolation
- **11 async methods:** Complex state management
- **7 boolean flags:** 128 test configurations
- **Tight coupling:** Direct dependencies on DataRegistry, SlotGenerator, BlueprintRepository

**Should Have:**

```javascript
// tests/unit/anatomy/validation/RecipePreflightValidator.test.js
describe('RecipePreflightValidator', () => {
  describe('checkComponentExistence', () => {
    it('should pass when all components exist', async () => { ... });
    it('should error when component missing', async () => { ... });
  });

  // 11 test suites, one per validation check
});
```

### Integration Tests

**Found:** ✅ Some integration tests in `tests/integration/anatomy/`

**Coverage:** Partial - tests file-level validation flows, not individual validators

---

## Error Handling Completeness

### Severity Classification

| Severity           | Current Usage                                                                         | Consistency     |
| ------------------ | ------------------------------------------------------------------------------------- | --------------- |
| **Error**          | Component existence, property schemas, body descriptors, blueprint, part availability | ✅ Consistent   |
| **Warning**        | Socket/slot compatibility (on exception), pattern matching                            | ⚠️ Inconsistent |
| **Silent Failure** | Descriptor coverage, load failures, recipe usage                                      | ❌ Problematic  |

### Missing Error Handling Features

- ❌ **No error recovery strategies**
- ❌ **No partial validation results** (all-or-nothing)
- ❌ **No validation state persistence**
- ❌ **No cancellation support**
- ❌ **No progress reporting** for long validations

---

## Key Architectural Weaknesses

### 1. Violation of Separation of Concerns

**Problem:**

- Validation orchestration mixed with check implementation
- Cannot reuse individual validators outside `RecipePreflightValidator`
- Adding new validator requires modifying core class

**Impact:**

- High coupling prevents composition
- Cannot test validators independently
- Cannot use validators in different contexts (e.g., CI, editor plugins)

---

### 2. No Extensibility Mechanism

**Problem:**

- No plugin system for custom validators
- No validation pipeline abstraction
- Adding validation requires core class modification

**Impact:**

- Closed to extension (violates Open/Closed Principle)
- Mod developers cannot add custom validation
- Third-party tools cannot integrate

**Should Have:**

```javascript
// Plugin architecture
class ValidationPluginRegistry {
  registerValidator(name, validator) { ... }
  getValidator(name) { ... }
}

// Custom mod validators
registry.registerValidator('my-mod:custom-check', new MyCustomValidator());
```

---

### 3. Tight Coupling to Infrastructure

**Direct Dependencies:**

- `DataRegistry` - data access
- `SlotGenerator` - blueprint processing
- `BlueprintRepository` - blueprint storage
- `AJVSchemaValidator` - schema validation

**Impact:**

- Cannot mock for testing
- Cannot swap implementations
- Cannot use validators without full infrastructure

**Should Use:**

```javascript
// Interface-based dependencies
constructor({ dataProvider, blueprintProcessor, schemaValidator, logger }) {
  // Inject abstractions, not concrete implementations
}
```

---

### 4. Zero Configuration System

**Problem:**

- All behavior hardcoded
- No environment-specific configuration
- No user preferences

**Impact:**

- Cannot customize for different contexts
- Cannot disable expensive checks in CI
- Cannot add mod-specific validators

---

### 5. Pervasive Code Duplication

**Instances:**

- Entity matching: 2 implementations
- Levenshtein distance: 3 implementations
- Blueprint processing: Duplicated from production
- Schema validation: Inline + rule-based

**Impact:**

- Bug fixes must be applied multiple times
- Maintenance burden increases
- Code quality degrades over time

---

### 6. Inconsistent Abstraction Patterns

**Mix of Patterns:**

- `ValidationRule` base class (2 validators)
- Inline methods (9 validators)
- External functions (2 validators)

**Impact:**

- No predictable pattern
- Difficult to understand system
- Hard to onboard new developers

---

### 7. Poor Testability

**Factors:**

- Monolithic 1,207-line class
- Boolean flag explosion (128 configs)
- Tight infrastructure coupling
- No dependency injection

**Impact:**

- Zero unit test coverage
- Cannot test edge cases
- Regression risk high

---

## Conclusion

The recipe validation system demonstrates **textbook patchwork development**:

1. **God Class**: 1,207-line monolith violating project guidelines
2. **Boolean Flags**: 7 flags creating 128 test configurations
3. **Code Duplication**: 5 instances of duplicated logic
4. **Hardcoded Dependencies**: No configuration system
5. **Inconsistent Patterns**: 3 different abstraction approaches
6. **Zero Unit Tests**: Monolithic design prevents testing

**Root Cause:** Features were incrementally bolted onto existing class rather than refactoring architecture to support extensibility.

**Recommended Action:** See companion document `recipe-validation-refactoring-recommendations.md` for detailed architectural improvements and migration strategy.

---

**Analysis Completed:** 2025-01-14
**Next Steps:** Review refactoring recommendations and prioritize implementation phases

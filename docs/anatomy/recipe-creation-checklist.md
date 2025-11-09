# Recipe Creation Checklist

This checklist provides a step-by-step guide for creating anatomy recipes, from planning to testing. Use this when adding new creatures or modifying existing ones.

**Quick Reference**:
- [Before You Start](#before-you-start) - Planning phase
- [Step-by-Step Process](#step-by-step-process) - Main workflow
- [Common Pitfalls](#common-pitfalls) - Avoid these mistakes
- [Related Documentation](#related-documentation) - Additional resources

---

## Before You Start

### Planning Phase

#### Blueprint Selection

- [ ] **Decide blueprint version** (V1 or V2)
  - **Use V1 when**: Humanoid creatures, asymmetric designs, manual control needed
  - **Use V2 when**: Non-human creatures with repeating limbs (spiders, dragons, centaurs)
  - **See**: [Blueprints and Templates](./blueprints-and-templates.md#when-to-use-v2)

- [ ] **For V2 blueprints**: Identify or create structure template
  - Check existing templates: `data/mods/anatomy/structure-templates/`
  - Examples: `structure_arachnid_8leg`, `structure_winged_quadruped`, `structure_centauroid`
  - If creating new: Plan limb sets and appendages
  - **See**: [Structure Templates](./blueprints-and-templates.md#part-2-structure-templates)

#### Part Inventory

- [ ] **List all part types needed**
  - Root body part (torso, cephalothorax, mantle, etc.)
  - Limbs (legs, arms, wings, tentacles, etc.)
  - Appendages (head, tail, abdomen, etc.)
  - Special parts (venom glands, spinnerets, etc.)

- [ ] **Check component availability**
  - Review `data/mods/anatomy/components/` for reusable components
  - Common components: `anatomy:part`, `anatomy:sockets`, `descriptors:texture`, `descriptors:body_hair`
  - Identify which components to reuse vs create new
  - **Tip**: Prefer reusing existing components when possible

#### Body Descriptors

- [ ] **Review Body Descriptor Registry**
  - Check available descriptors: `src/anatomy/registries/bodyDescriptorRegistry.js`
  - Current descriptors: `height`, `skinColor`, `build`, `composition`, `hairDensity`, `smell`
  - Valid values for enumerated descriptors are defined in the registry
  - **See**: [Body Descriptors Complete](./body-descriptors-complete.md)

---

## Step-by-Step Process

### Step 1: Review/Create Component Schemas

**When to do**: Only if required components don't exist

#### Check Existing Components

- [ ] **Search for existing components**
  ```bash
  ls data/mods/anatomy/components/
  ```
  - Common components: `part.component.json`, `sockets.component.json`
  - Descriptor components: `descriptors:texture`, `descriptors:body_hair`

#### Create New Components (if needed)

- [ ] **Create component schema file**
  - Location: `data/mods/anatomy/components/{name}.component.json`
  - Template:
    ```json
    {
      "$schema": "schema://living-narrative-engine/component.schema.json",
      "id": "modId:componentId",
      "description": "Component description",
      "dataSchema": {
        "type": "object",
        "properties": {
          "fieldName": { "type": "string" }
        },
        "required": ["fieldName"],
        "additionalProperties": false
      }
    }
    ```
  - **Example**: `data/mods/anatomy/components/part.component.json`

- [ ] **Validate component schema**
  ```bash
  npm run validate
  ```

---

### Step 2: Review/Create Entity Definitions

**When to do**: Only if required part entities don't exist

#### Check Existing Entities

- [ ] **Search for existing entity definitions**
  ```bash
  ls data/mods/anatomy/entities/definitions/
  ```
  - Examples: `spider_leg.entity.json`, `dragon_wing.entity.json`, `human_arm.entity.json`

#### Create New Entity Definitions (if needed)

- [ ] **Create entity definition file**
  - Location: `data/mods/anatomy/entities/definitions/{name}.entity.json`
  - Required components:
    - `anatomy:part` - Always required (with correct `subType`)
    - `core:name` - Always required
    - Descriptor components as needed (e.g., `descriptors:texture`, `descriptors:body_hair`)

- [ ] **Define anatomy:part component**
  ```json
  {
    "id": "anatomy:part_name",
    "components": {
      "anatomy:part": {
        "subType": "leg",  // Must match blueprint requirements
        "partType": "spider_leg"  // Specific part type
      },
      "core:name": {
        "name": "spider leg"
      }
    }
  }
  ```

- [ ] **Add descriptor components (optional)**
  ```json
  {
    "components": {
      "anatomy:part": { /* ... */ },
      "core:name": { /* ... */ },
      "descriptors:texture": {
        "texture": "chitinous"
      },
      "descriptors:body_hair": {
        "hairDensity": "hairy"
      }
    }
  }
  ```
  - **Example**: `data/mods/anatomy/entities/definitions/spider_leg.entity.json`

- [ ] **Validate entity definitions**
  ```bash
  npm run validate
  ```

---

### Step 3: Create or Update Blueprint

**Choose path**: V1 (explicit slots) or V2 (template-based)

#### For V1 Blueprints (schemaVersion: "1.0" or omitted)

- [ ] **Create blueprint file**
  - Location: `data/mods/anatomy/blueprints/{name}.blueprint.json`
  - Schema reference: `"$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json"`

- [ ] **Define required fields**
  - `id`: Namespaced blueprint ID (e.g., `"anatomy:my_creature"`)
  - `root`: Root entity reference (e.g., `"anatomy:spider_cephalothorax"`)

- [ ] **Define explicit slots**
  ```json
  {
    "id": "anatomy:my_creature",
    "root": "anatomy:torso",
    "slots": {
      "left_arm": {
        "socket": "left_shoulder",
        "requirements": {
          "partType": "arm",
          "components": ["anatomy:part"]
        }
      },
      "right_arm": {
        "socket": "right_shoulder",
        "requirements": {
          "partType": "arm",
          "components": ["anatomy:part"]
        }
      }
    }
  }
  ```
  - **Example**: `data/mods/anatomy/blueprints/human_male.blueprint.json`

- [ ] **Add clothingSlotMappings (optional)**
  ```json
  {
    "clothingSlotMappings": {
      "torso_upper": {
        "anatomySockets": ["chest", "upper_back"],
        "allowedLayers": ["underwear", "base", "outer", "armor"]
      }
    }
  }
  ```

#### For V2 Blueprints (schemaVersion: "2.0")

- [ ] **Create blueprint file**
  - Location: `data/mods/anatomy/blueprints/{name}.blueprint.json`
  - Must include: `schemaVersion: "2.0"`, `structureTemplate`

- [ ] **Define required fields**
  ```json
  {
    "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
    "id": "anatomy:giant_spider",
    "schemaVersion": "2.0",
    "root": "anatomy:spider_cephalothorax",
    "structureTemplate": "anatomy:structure_arachnid_8leg"
  }
  ```
  - **Example**: `data/mods/anatomy/blueprints/giant_spider.blueprint.json`

- [ ] **Verify socket/slot compatibility with structure template**
  - Check template socket patterns match expected slots
  - Review OrientationResolver schemes if needed
  - **See**: [OrientationResolver](./anatomy-system-guide.md#orientationresolver-critical-synchronization)

- [ ] **Add additionalSlots (optional)**
  - Use for slots beyond template generation
  ```json
  {
    "additionalSlots": {
      "venom_gland": {
        "socket": "venom_gland",
        "requirements": {
          "partType": "venom_gland",
          "components": ["anatomy:part", "anatomy:venom"]
        },
        "optional": true
      }
    }
  }
  ```

- [ ] **Add clothingSlotMappings (optional)**
  - Same format as V1

- [ ] **Validate blueprint**
  ```bash
  npm run validate
  ```

---

### Step 4: Create Recipe

**Required**: `recipeId`, `blueprintId`, `slots` (can be empty `{}`)
**Optional**: `bodyDescriptors`, `patterns`, `constraints`, `clothingEntities`

#### Define Recipe Basics

- [ ] **Create recipe file**
  - Location: `data/mods/anatomy/recipes/{name}.recipe.json`
  - Schema reference: `"$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json"`

- [ ] **Define required fields**
  ```json
  {
    "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
    "recipeId": "anatomy:my_creature_recipe",
    "blueprintId": "anatomy:my_creature",
    "slots": {}
  }
  ```
  - **Note**: `slots` object is required, even if empty

#### Add Body Descriptors (optional but validated)

- [ ] **Add bodyDescriptors**
  - Only use descriptors from Body Descriptor Registry
  - Validate enumerated values against registry
  ```json
  {
    "bodyDescriptors": {
      "build": "athletic",
      "hairDensity": "hairy",
      "composition": "lean",
      "skinColor": "gray-green"
    }
  }
  ```
  - **Valid enumerated values**:
    - `height`: gigantic, very-tall, tall, average, short, petite, tiny
    - `build`: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky
    - `composition`: underweight, lean, average, soft, chubby, overweight, obese
    - `hairDensity`: hairless, sparse, light, moderate, hairy, very-hairy
    - `skinColor`: free-form string
    - `smell`: free-form string

- [ ] **Validate body descriptors**
  ```bash
  npm run validate:body-descriptors
  ```

#### Configure Explicit Slots

- [ ] **Add explicit slot definitions**
  - Use for unique parts or overrides
  ```json
  {
    "slots": {
      "spinnerets": {
        "partType": "spinneret",
        "tags": ["anatomy:part"],
        "properties": {
          "descriptors:texture": {
            "texture": "chitinous"
          }
        }
      }
    }
  }
  ```
  - **Example**: `data/mods/anatomy/recipes/giant_forest_spider.recipe.json`

#### Add Pattern Matchers (optional, for multi-slot configuration)

- [ ] **Choose pattern matcher type**
  - **matchesGroup**: For template-generated limb sets/appendages
  - **matchesPattern**: For wildcard matching (e.g., `leg_*`)
  - **matchesAll**: For property-based filtering
  - **Important**: Each pattern must use exactly ONE matcher type

- [ ] **Add patterns array**
  ```json
  {
    "patterns": [
      {
        "matchesGroup": "limbSet:leg",
        "partType": "spider_leg",
        "tags": ["anatomy:part"],
        "properties": {
          "descriptors:texture": {
            "texture": "chitinous"
          },
          "descriptors:body_hair": {
            "hairDensity": "hairy"
          }
        }
      }
    ]
  }
  ```

- [ ] **Pattern examples by type**:
  - **matchesGroup**: `"limbSet:leg"`, `"appendage:tail"`
  - **matchesPattern**: `"leg_*"`, `"*_left"`
  - **matchesAll**: `{ "slotType": "leg", "orientation": "left" }`
  - **See**: [Recipe Pattern Matching](./recipe-pattern-matching.md)

#### Add Constraints (optional)

- [ ] **Add requires constraints**
  ```json
  {
    "constraints": {
      "requires": [
        {
          "partTypes": ["spider_abdomen", "spinneret"]
        }
      ]
    }
  }
  ```

- [ ] **Add excludes constraints**
  ```json
  {
    "constraints": {
      "excludes": [
        {
          "partTypes": ["wing"]
        }
      ]
    }
  }
  ```

#### Add Clothing Entities (optional)

- [ ] **Add clothingEntities**
  ```json
  {
    "clothingEntities": [
      "clothing:leather_vest",
      "clothing:boots"
    ]
  }
  ```

#### Validate Recipe

- [ ] **Validate recipe schema**
  ```bash
  npm run validate
  ```

- [ ] **Validate body descriptors**
  ```bash
  npm run validate:body-descriptors
  ```

---

### Step 5: Test

#### Anatomy Visualizer Testing

- [ ] **Load in anatomy visualizer**
  - Open: `/anatomy-visualizer.html` in browser
  - Select your recipe from dropdown

- [ ] **Verify graph generation**
  - Check no errors in browser console
  - Confirm anatomy graph displays correctly
  - Verify all expected parts appear

- [ ] **Check anatomy description**
  - Verify body descriptors display correctly
  - Check formatting matches expectations
  - Confirm all parts are listed

- [ ] **Validate part properties**
  - Check descriptor components applied correctly
  - Verify tags and properties on parts

#### Integration Testing

- [ ] **Create integration test (recommended)**
  - Location: `tests/integration/mods/anatomy/{name}.test.js`
  - Use ModTestFixture for consistent testing
  - **See**: [Mod Testing Guide](../testing/mod-testing-guide.md)

- [ ] **Run integration tests**
  ```bash
  npm run test:integration -- tests/integration/mods/anatomy/{name}.test.js
  ```

---

## Common Pitfalls

### Blueprint Issues

#### ❌ Missing descriptor components on entity definitions

**Problem**: Entity definitions don't include descriptor components (e.g., `descriptors:texture`, `descriptors:body_hair`)

**Symptom**: Recipe properties not applied to parts

**Solution**: Add descriptor components to entity definition:
```json
{
  "components": {
    "anatomy:part": { /* ... */ },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "descriptors:body_hair": {
      "hairDensity": "hairless"
    }
  }
}
```

**Prevention**: Always review component requirements when creating entity definitions

---

#### ❌ V2 blueprints: Missing sockets in structure template

**Problem**: Structure template doesn't generate expected sockets

**Symptom**: Recipe patterns don't match any slots

**Solution**:
1. Review structure template socket generation
2. Check OrientationResolver scheme matches expectations
3. Update template or recipe patterns to align

**Prevention**: Test structure template with simple blueprint first

---

#### ❌ Pattern mismatches between recipe and generated slots

**Problem**: Recipe patterns use wrong matcher type or values

**Symptom**: Zero-match warnings in logs, parts not instantiated

**Examples**:
```json
// ❌ Wrong matcher for template-generated slots
{
  "matchesPattern": "leg_*"  // Template uses different naming
}

// ✅ Correct matcher for template
{
  "matchesGroup": "limbSet:leg"  // Matches template limbSet
}
```

**Solution**: Use correct pattern matcher for blueprint type:
- V2 templates: Use `matchesGroup` for limb sets/appendages
- V1 blueprints: Use `matchesPattern` or explicit `matches` array

**Prevention**: Review blueprint/template socket generation before writing recipe

---

#### ❌ Mixing V1 and V2 blueprint features

**Problem**: Using V1 properties (`slots`, `parts`, `compose`) in V2 blueprint or vice versa

**Symptom**: Schema validation fails

**Examples**:
```json
// ❌ Invalid - Cannot use slots with V2
{
  "schemaVersion": "2.0",
  "structureTemplate": "anatomy:structure_spider",
  "slots": { /* ... */ }  // ERROR
}

// ✅ Correct - Use additionalSlots
{
  "schemaVersion": "2.0",
  "structureTemplate": "anatomy:structure_spider",
  "additionalSlots": { /* ... */ }
}
```

**Solution**:
- V1: Use `slots`, `parts`, `compose`
- V2: Use `structureTemplate`, `additionalSlots`

**Prevention**: Choose version at start, follow version-specific schema

---

### Recipe Issues

#### ❌ Using invalid body descriptor values (not in registry enum)

**Problem**: Recipe uses body descriptor value not in Body Descriptor Registry

**Symptom**: Validation fails with schema error

**Examples**:
```json
// ❌ Invalid value
{
  "bodyDescriptors": {
    "build": "super-muscular"  // Not in valid values
  }
}

// ✅ Correct value
{
  "bodyDescriptors": {
    "build": "muscular"  // Valid enum value
  }
}
```

**Solution**: Use only values from Body Descriptor Registry:
- Check `src/anatomy/registries/bodyDescriptorRegistry.js` for valid values
- Run `npm run validate:body-descriptors` to verify

**Prevention**: Always reference registry when adding body descriptors

---

#### ❌ Empty slots object omitted

**Problem**: Recipe doesn't include `slots` object

**Symptom**: Schema validation fails

**Examples**:
```json
// ❌ Missing slots object
{
  "recipeId": "anatomy:my_creature",
  "blueprintId": "anatomy:my_blueprint",
  "patterns": [ /* ... */ ]
}

// ✅ Correct - slots object present (even if empty)
{
  "recipeId": "anatomy:my_creature",
  "blueprintId": "anatomy:my_blueprint",
  "slots": {},
  "patterns": [ /* ... */ ]
}
```

**Solution**: Always include `slots` object, use `{}` if no explicit slots

**Prevention**: Use recipe schema validation during development

---

#### ❌ Multiple matchers in single pattern

**Problem**: Pattern uses more than one matcher type

**Symptom**: Schema validation fails

**Examples**:
```json
// ❌ Multiple matchers
{
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "matchesPattern": "leg_*"  // ERROR: Only one matcher allowed
    }
  ]
}

// ✅ Single matcher
{
  "patterns": [
    {
      "matchesGroup": "limbSet:leg"
    }
  ]
}
```

**Solution**: Use exactly one matcher per pattern: `matches`, `matchesGroup`, `matchesPattern`, or `matchesAll`

**Prevention**: Follow pattern matching schema strictly

---

#### ❌ Not validating with CLI tools before testing

**Problem**: Skipping validation steps, discovering errors late

**Symptom**: Anatomy visualizer fails to load, runtime errors

**Solution**: Always run validation before testing:
```bash
npm run validate                      # Validate all schemas
npm run validate:body-descriptors     # Validate body descriptors
```

**Prevention**: Make validation part of development workflow

---

## Related Documentation

### Core Anatomy Guides

- **[Anatomy System Guide](./anatomy-system-guide.md)** - Overall system architecture, design philosophy, and key components
- **[Blueprints and Templates](./blueprints-and-templates.md)** - Blueprint V1 vs V2, structure templates, socket generation
- **[Recipe Pattern Matching](./recipe-pattern-matching.md)** - Pattern matching syntax, examples, best practices
- **[Body Descriptors Complete](./body-descriptors-complete.md)** - Body Descriptor Registry, adding descriptors, validation

### Workflow Guides

- **[Non-Human Quickstart](./non-human-quickstart.md)** - End-to-end tutorial for creating non-human creatures
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

### Testing Resources

- **[Mod Testing Guide](../testing/mod-testing-guide.md)** - Testing patterns for mod content

### Schema References

- **Recipe Schema**: `data/schemas/anatomy.recipe.schema.json`
- **Blueprint Schema**: `data/schemas/anatomy.blueprint.schema.json`
- **Structure Template Schema**: `data/schemas/anatomy.structure-template.schema.json`
- **Component Schema**: `data/schemas/component.schema.json`
- **Entity Definition Schema**: `data/schemas/entity-definition.schema.json`

### Example Files

#### V2 Examples (Recommended for Non-Human Creatures)

- **Spider Recipe**: `data/mods/anatomy/recipes/giant_forest_spider.recipe.json`
- **Spider Blueprint**: `data/mods/anatomy/blueprints/giant_spider.blueprint.json`
- **Arachnid Template**: `data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json`

#### V1 Examples (Humanoid Creatures)

- **Human Male Recipe**: `data/mods/core/recipes/human_male.recipe.json`
- **Human Male Blueprint**: `data/mods/anatomy/blueprints/human_male.blueprint.json`

#### Entity Definitions

- **Spider Leg**: `data/mods/anatomy/entities/definitions/spider_leg.entity.json`
- **Spider Abdomen**: `data/mods/anatomy/entities/definitions/spider_abdomen.entity.json`

#### Components

- **Part Component**: `data/mods/anatomy/components/part.component.json`
- **Sockets Component**: `data/mods/anatomy/components/sockets.component.json`

### Code References

- **Body Descriptor Registry**: `src/anatomy/registries/bodyDescriptorRegistry.js`
- **OrientationResolver**: `src/anatomy/shared/orientationResolver.js`
- **Recipe Processor**: `src/anatomy/recipeProcessor.js`
- **Pattern Resolver**: `src/anatomy/recipePatternResolver/patternResolver.js`

---

## Quick Reference

### Recipe Required vs Optional Fields

**Required**:
- `recipeId` - Unique namespaced ID
- `blueprintId` - Reference to blueprint
- `slots` - Explicit slot definitions (can be empty `{}`)

**Optional**:
- `bodyDescriptors` - Body-level descriptors (validated against registry)
- `patterns` - Pattern matchers for multi-slot configuration
- `constraints` - Requires/excludes rules
- `clothingEntities` - Pre-equipped clothing

### Validation Commands

```bash
npm run validate                      # Validate all schemas and mod structure
npm run validate:body-descriptors     # Validate body descriptor system
npm run test:integration              # Run integration tests
npm run test:unit                     # Run unit tests
```

### Pattern Matcher Quick Reference

- **matchesGroup**: `"limbSet:leg"`, `"appendage:tail"` - Template limb sets/appendages
- **matchesPattern**: `"leg_*"`, `"*_left"` - Wildcard matching
- **matchesAll**: `{ "slotType": "leg" }` - Property-based filtering
- **matches**: `["leg_1", "leg_2"]` - Explicit slot list (V1)

### Body Descriptor Valid Values

- **height**: gigantic, very-tall, tall, average, short, petite, tiny
- **build**: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky
- **composition**: underweight, lean, average, soft, chubby, overweight, obese
- **hairDensity**: hairless, sparse, light, moderate, hairy, very-hairy
- **skinColor**: *free-form string*
- **smell**: *free-form string*

---

**Last Updated**: 2025-11-09
**Maintained By**: Living Narrative Engine Core Team

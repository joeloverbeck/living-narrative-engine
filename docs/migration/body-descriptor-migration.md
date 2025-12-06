# Body Descriptor Migration Guide

## Overview

This guide provides step-by-step instructions for migrating existing anatomy content from entity-level descriptors to the new recipe-level body descriptors system. The migration is **optional and non-breaking** - existing content will continue to work unchanged.

## Migration Benefits

### Why Migrate?

- **Simplified Recipe Design**: Define body characteristics once at the recipe level
- **Better Performance**: Fewer component lookups during description generation
- **Cleaner Architecture**: Centralized body characteristics in recipes
- **Easier Maintenance**: Modify body traits without touching entity definitions
- **Template Reusability**: Create reusable body descriptor patterns

### Compatibility Guarantee

- **No Breaking Changes**: Existing entity-level descriptors continue working
- **Gradual Migration**: Migrate content at your own pace
- **Mixed Mode**: Use both systems simultaneously during transition
- **Automatic Precedence**: Body descriptors take precedence when present

## Body Descriptor Registry

The new body descriptor system is built around a centralized registry that serves as the single source of truth for all descriptor metadata.

**Registry Location**: `src/anatomy/registries/bodyDescriptorRegistry.js`

**Benefits**:

- **Centralized Configuration**: All descriptor metadata in one place
- **Automatic Validation**: Built-in validation ensures consistency
- **Type Safety**: Controlled vocabularies with enumerated values
- **Easy Extension**: Add new descriptors by updating the registry

**Current Descriptors** (6 total):

- height, skinColor, build, composition, hairDensity, smell

**Registry Properties**: Each descriptor has 9 properties including schema name, display configuration, valid values, and extraction/formatting functions.

**Validation Tool**: `npm run validate:body-descriptors`

Before and after migration, use the validation tool to ensure system consistency:

```bash
npm run validate:body-descriptors
```

**Documentation**:

- [Body Descriptors Complete](../anatomy/body-descriptors-complete.md) - Complete guide including registry, adding descriptors, and validation

## Migration Strategies

### Strategy 1: Recipe-by-Recipe Migration (Recommended)

Migrate individual recipes gradually for maximum control and testing.

#### Step 1: Identify Migration Candidates

Look for recipes that generate entities with common descriptor patterns:

```bash
# Find recipes with common descriptor usage patterns
grep -r "descriptors:" data/mods/your-mod/entities/
grep -r "build.*athletic\|composition.*lean" data/mods/your-mod/entities/
```

Good migration candidates:

- Character archetypes (warriors, scholars, nobles)
- Racial templates (elven, dwarven, orcish)
- Environmental types (desert nomads, mountain folk)
- NPC templates with common characteristics

#### Step 2: Analyze Current Entity Descriptors

**Before Migration - Entity with Descriptor Components**:

```json
{
  "entityId": "mymod:warrior_npc",
  "components": [
    {
      "componentId": "descriptors:build",
      "build": "muscular"
    },
    {
      "componentId": "descriptors:body_composition",
      "composition": "lean"
    },
    {
      "componentId": "descriptors:body_hair",
      "density": "moderate"
    },
    {
      "componentId": "descriptors:skin_color",
      "skinColor": "tanned"
    }
  ]
}
```

#### Step 3: Create Recipe with Body Descriptors

**After Migration - Recipe with Body Descriptors**:

```json
{
  "recipeId": "mymod:warrior_body",
  "name": "Warrior Body Template",
  "blueprintId": "anatomy:humanoid",
  "bodyDescriptors": {
    "build": "muscular",
    "composition": "lean",
    "density": "moderate",
    "skinColor": "tanned"
  },
  "slots": {
    "torso": { "partType": "torso" },
    "arms": { "partType": "arm", "count": 2 },
    "legs": { "partType": "leg", "count": 2 }
  }
}
```

#### Step 4: Update Entity Definition

**Simplified Entity (Remove Descriptor Components)**:

```json
{
  "entityId": "mymod:warrior_npc",
  "components": [
    {
      "componentId": "anatomy:recipe",
      "recipeId": "mymod:warrior_body"
    }
    // Descriptor components removed - now handled by recipe
  ]
}
```

#### Step 5: Test Migration

1. **Generate Test Entity**:

```javascript
const entity = await entityManager.createEntityInstance('mymod:warrior_npc');
```

2. **Verify Body Component**:

```javascript
const bodyComponent = entity.getComponentData('anatomy:body');
console.log('Body descriptors:', bodyComponent?.body?.descriptors);

// Should show:
// {
//   "build": "muscular",
//   "composition": "lean",
//   "density": "moderate",
//   "skinColor": "tanned"
// }
```

3. **Test Description Generation**:

```javascript
const description = await bodyDescriptionComposer.composeDescription(entity);
console.log('Generated description:', description);

// Should include:
// "Skin color: tanned"
// "Build: muscular"
// "Body hair: moderate"
// "Body composition: lean"
```

### Strategy 2: Template-Based Migration

Create reusable body descriptor templates for common patterns.

#### Step 1: Identify Common Patterns

Analyze your content to identify recurring descriptor combinations:

```bash
# Find common descriptor patterns
grep -r -A5 -B5 "descriptors:" data/mods/your-mod/ | grep -E "(build|composition|density|skinColor)"
```

#### Step 2: Create Base Templates

**Base Archetype Templates**:

```json
// Warrior template
{
  "recipeId": "mymod:base_warrior",
  "bodyDescriptors": {
    "build": "muscular",
    "composition": "lean",
    "density": "moderate",
    "skinColor": "tanned"
  },
  "slots": { "torso": { "partType": "torso" } }
}

// Scholar template
{
  "recipeId": "mymod:base_scholar",
  "bodyDescriptors": {
    "build": "slim",
    "composition": "average",
    "density": "sparse",
    "skinColor": "pale"
  },
  "slots": { "torso": { "partType": "torso" } }
}

// Rogue template
{
  "recipeId": "mymod:base_rogue",
  "bodyDescriptors": {
    "build": "lean",
    "composition": "lean",
    "density": "light",
    "skinColor": "olive"
  },
  "slots": { "torso": { "partType": "torso" } }
}
```

#### Step 3: Create Specific Recipes with Inheritance

```json
// Specific warrior types inherit from base
{
  "recipeId": "mymod:elite_warrior",
  "extends": "mymod:base_warrior",
  "bodyDescriptors": {
    "build": "athletic"  // Override just the build
  }
}

{
  "recipeId": "mymod:veteran_warrior",
  "extends": "mymod:base_warrior",
  "bodyDescriptors": {
    "skinColor": "scarred"  // Override skin color
  }
}
```

### Strategy 3: Batch Migration Tools

For large-scale migrations, create automated tools.

#### Migration Script Template

```javascript
// migration-tool.js
import { RecipeMigrator } from './recipeMigrator.js';

class BodyDescriptorMigrator {
  constructor(dataRegistry) {
    this.dataRegistry = dataRegistry;
  }

  async migrateEntitiesWithDescriptors(modId) {
    const entities = this.dataRegistry.getEntitiesByMod(modId);
    const migrations = [];

    for (const entity of entities) {
      const descriptorComponents = this.extractDescriptorComponents(entity);

      if (descriptorComponents.length > 0) {
        const bodyDescriptors =
          this.convertToBodyDescriptors(descriptorComponents);
        const recipeId = `${modId}:${entity.entityId}_body`;

        migrations.push({
          entityId: entity.entityId,
          recipeId,
          bodyDescriptors,
          originalComponents: descriptorComponents,
        });
      }
    }

    return migrations;
  }

  extractDescriptorComponents(entity) {
    const descriptorTypes = [
      'descriptors:build',
      'descriptors:body_composition',
      'descriptors:body_hair',
      'descriptors:skin_color',
    ];

    return entity.components.filter((comp) =>
      descriptorTypes.includes(comp.componentId)
    );
  }

  convertToBodyDescriptors(components) {
    const bodyDescriptors = {};

    components.forEach((comp) => {
      switch (comp.componentId) {
        case 'descriptors:build':
          bodyDescriptors.build = comp.build;
          break;
        case 'descriptors:body_composition':
          bodyDescriptors.composition = comp.composition;
          break;
        case 'descriptors:body_hair':
          bodyDescriptors.density = comp.density;
          break;
        case 'descriptors:skin_color':
          bodyDescriptors.skinColor = comp.skinColor;
          break;
      }
    });

    return bodyDescriptors;
  }
}
```

## Step-by-Step Migration Process

### Phase 1: Preparation

1. **Backup Your Mod**:

```bash
cp -r data/mods/your-mod data/mods/your-mod.backup
```

2. **Update Engine**: Ensure you're using a version that supports body descriptors

3. **Review Documentation**:
   - Read `docs/modding/body-descriptors-guide.md`
   - Review `docs/development/body-descriptors-technical.md`

### Phase 2: Analysis

1. **Inventory Descriptor Usage**:

```bash
# Find all entity descriptor components
find data/mods/your-mod -name "*.json" -exec grep -l "descriptors:" {} \;

# Count descriptor types
grep -r "descriptors:build" data/mods/your-mod | wc -l
grep -r "descriptors:body_composition" data/mods/your-mod | wc -l
grep -r "descriptors:body_hair" data/mods/your-mod | wc -l
```

2. **Identify Patterns**:
   - Group entities by common descriptor combinations
   - Look for archetype patterns (warrior, scholar, etc.)
   - Note any unique or rare descriptor combinations

3. **Plan Migration Order**:
   - Start with simplest, most common patterns
   - Test with non-critical entities first
   - Save complex or unique cases for later

### Phase 3: Implementation

#### For Each Migration Target:

1. **Create Recipe with Body Descriptors**:

```json
{
  "recipeId": "mymod:migrated_template",
  "bodyDescriptors": {
    // Converted descriptor values
  },
  "slots": {
    // Anatomy slot configuration
  }
}
```

2. **Update Entity to Use Recipe**:

```json
{
  "entityId": "mymod:target_entity",
  "components": [
    {
      "componentId": "anatomy:recipe",
      "recipeId": "mymod:migrated_template"
    }
    // Remove old descriptor components
  ]
}
```

3. **Test Migration**:
   - Generate entity instances
   - Verify body component has descriptors
   - Check description generation
   - Compare with pre-migration behavior

### Phase 4: Validation

1. **Run Validation Tool**:

```bash
npm run validate:body-descriptors
```

Expected output after successful migration:

```
🔍 Body Descriptor System Validation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Checking Registry...
   Found 6 registered descriptors
   height, skinColor, build, composition, hairDensity, smell

📄 Validating Formatting Configuration...
   ✅ Formatting configuration is valid

🧬 Validating Anatomy Recipes...
   ✅ human_male.recipe.json
   ✅ human_female.recipe.json
   ✅ your_migrated_recipe.recipe.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Validation Passed

Body descriptor system is consistent.
```

2. **Automated Testing**:

```javascript
describe('Migration Validation', () => {
  it('should generate same descriptors after migration', async () => {
    const entity = await entityManager.createEntityInstance(
      'mymod:migrated_entity'
    );
    const bodyComponent = entity.getComponentData('anatomy:body');

    expect(bodyComponent.body.descriptors.build).toBe('expected_build');
    expect(bodyComponent.body.descriptors.composition).toBe(
      'expected_composition'
    );
    // ... verify all expected descriptors
  });
});
```

3. **Manual Verification**:
   - Generate multiple instances
   - Test edge cases and variants
   - Verify performance improvements
   - Check memory usage

## Migration Examples

### Example 1: Simple Character Archetype

**Before - Entity with Individual Components**:

```json
{
  "entityId": "fantasy:orc_warrior",
  "components": [
    {
      "componentId": "descriptors:build",
      "build": "muscular"
    },
    {
      "componentId": "descriptors:body_composition",
      "composition": "average"
    },
    {
      "componentId": "descriptors:skin_color",
      "skinColor": "green"
    }
  ]
}
```

**After - Recipe + Simplified Entity**:

```json
// New recipe file: recipes/orc_warrior_body.json
{
  "recipeId": "fantasy:orc_warrior_body",
  "name": "Orc Warrior Body",
  "blueprintId": "anatomy:humanoid",
  "bodyDescriptors": {
    "build": "muscular",
    "composition": "average",
    "skinColor": "green"
  },
  "slots": {
    "torso": { "partType": "torso" }
  }
}

// Updated entity file: entities/orc_warrior.json
{
  "entityId": "fantasy:orc_warrior",
  "components": [
    {
      "componentId": "anatomy:recipe",
      "recipeId": "fantasy:orc_warrior_body"
    }
  ]
}
```

### Example 2: Template Inheritance

**Base Elven Template**:

```json
{
  "recipeId": "fantasy:base_elf",
  "bodyDescriptors": {
    "build": "slim",
    "composition": "lean",
    "density": "sparse",
    "skinColor": "fair"
  }
}
```

**Specialized Elf Types**:

```json
// High Elf - inherits base, adds golden skin
{
  "recipeId": "fantasy:high_elf",
  "extends": "fantasy:base_elf",
  "bodyDescriptors": {
    "skinColor": "golden"
  }
}

// Wood Elf - inherits base, darker skin
{
  "recipeId": "fantasy:wood_elf",
  "extends": "fantasy:base_elf",
  "bodyDescriptors": {
    "skinColor": "tanned"
  }
}
```

### Example 3: Complex Migration with Variants

**Before - Multiple Entity Variants**:

```json
// Entity 1
{
  "entityId": "medieval:peasant_male",
  "components": [
    { "componentId": "descriptors:build", "build": "slim" },
    { "componentId": "descriptors:body_composition", "composition": "underweight" }
  ]
}

// Entity 2
{
  "entityId": "medieval:peasant_female",
  "components": [
    { "componentId": "descriptors:build", "build": "slim" },
    { "componentId": "descriptors:body_composition", "composition": "average" }
  ]
}
```

**After - Single Recipe with Variants**:

```json
{
  "recipeId": "medieval:peasant_body",
  "name": "Peasant Body Variants",
  "blueprintId": "anatomy:humanoid",
  "variants": [
    {
      "weight": 0.6,
      "bodyDescriptors": {
        "build": "slim",
        "composition": "underweight",
        "skinColor": "weathered"
      }
    },
    {
      "weight": 0.4,
      "bodyDescriptors": {
        "build": "slim",
        "composition": "average",
        "skinColor": "fair"
      }
    }
  ],
  "slots": {
    "torso": { "partType": "torso" }
  }
}
```

## Troubleshooting Migration Issues

### Common Migration Problems

#### Issue 1: Missing Descriptors After Migration

**Symptoms**: Generated entities lack expected body descriptors

**Diagnosis**:

```javascript
// Check if recipe is loaded
const recipe = dataRegistry.get('anatomyRecipes', 'mymod:recipe_id');
console.log('Recipe loaded:', !!recipe);

// Check recipe content
console.log('Body descriptors in recipe:', recipe?.bodyDescriptors);

// Check entity generation
const entity = await entityManager.createEntityInstance('mymod:entity_id');
const bodyComponent = entity.getComponentData('anatomy:body');
console.log('Generated body descriptors:', bodyComponent?.body?.descriptors);
```

**Solutions**:

- Verify recipe file is in correct location
- Check recipe ID matches entity reference
- Ensure recipe is included in mod manifest
- Validate recipe JSON syntax

#### Issue 2: Schema Validation Errors

**Symptoms**: Recipe loading fails with validation errors

**Common Causes**:

- Invalid descriptor enum values
- Extra properties in bodyDescriptors object
- Malformed JSON syntax

**Solutions**:

```json
// ❌ Invalid enum value
{
  "bodyDescriptors": {
    "build": "huge"  // Not in valid enum
  }
}

// ✅ Correct enum value
{
  "bodyDescriptors": {
    "build": "muscular"  // Valid enum value
  }
}

// ❌ Extra property
{
  "bodyDescriptors": {
    "build": "athletic",
    "invalidField": "value"  // Not allowed
  }
}

// ✅ Valid properties only
{
  "bodyDescriptors": {
    "build": "athletic",
    "skinColor": "olive"  // Valid properties only
  }
}
```

#### Issue 3: Incorrect Display Order

**Symptoms**: Body descriptors appear in wrong order in descriptions

**Solution**: Body descriptors always display in fixed order:

1. Skin color
2. Build
3. Body hair (density)
4. Body composition

This order cannot be changed and is consistent across all entities.

#### Issue 4: Performance Regression

**Symptoms**: Slower description generation after migration

**Diagnosis**:

```javascript
// Profile description generation
console.time('description-generation');
const description = await bodyDescriptionComposer.composeDescription(entity);
console.timeEnd('description-generation');
```

**Solutions**:

- Check for descriptor extraction errors in logs
- Verify entity has proper body component structure
- Test with simplified recipe to isolate issues
- Review performance benchmarks in test suite

### Validation Checklist

Before considering migration complete:

- [ ] Recipe loads without validation errors
- [ ] Entity generates with expected body descriptors
- [ ] Description generation includes all expected descriptors
- [ ] Display order matches specification (skin, build, hair, composition)
- [ ] Performance meets or exceeds pre-migration benchmarks
- [ ] Backward compatibility maintained (entity-level descriptors still work)
- [ ] Test coverage updated to include migrated content

### Rollback Process

If migration issues occur:

1. **Restore Backup**:

```bash
rm -rf data/mods/your-mod
cp -r data/mods/your-mod.backup data/mods/your-mod
```

2. **Selective Rollback**:

```bash
# Restore specific files
cp data/mods/your-mod.backup/entities/problem_entity.json data/mods/your-mod/entities/
```

3. **Mixed Mode**: Use both systems during troubleshooting
   - Keep entity-level descriptors for problematic cases
   - Use body descriptors for successfully migrated content
   - Body descriptors take precedence, so no conflicts occur

## Post-Migration Best Practices

### 1. Documentation Updates

- Update mod documentation to reflect new recipe structure
- Provide migration notes for other developers
- Document any custom descriptor patterns used

### 2. Testing Strategy

- Include body descriptor tests in your mod test suite
- Test variant recipes thoroughly
- Validate inheritance chains work correctly
- Performance test with large entity populations

### 3. Maintenance

- Regular validation of recipe files
- Monitor for schema updates in engine updates
- Keep backup of pre-migration content for reference
- Document lessons learned for future migrations

### 4. Community Sharing

- Share successful migration patterns with community
- Contribute reusable templates to mod repositories
- Document performance improvements achieved
- Help other modders with similar migrations

For additional support and examples, refer to the comprehensive test suite and core mod recipes included with the Living Narrative Engine.

# Body Descriptors Guide for Modders

## Overview

Body descriptors provide a convenient way to define overall body characteristics at the recipe level in the Living Narrative Engine. Instead of manually configuring individual descriptor components for each generated entity, you can specify common body traits directly in your anatomy recipes. This streamlines mod creation and ensures consistent character generation.

## What are Body Descriptors?

Body descriptors are recipe-level properties that automatically apply to generated body components. They cover five main categories:

- **build**: Overall body build (skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky)
- **height**: Overall height category (gigantic, very-tall, tall, average, short, petite, tiny)
- **density**: Body hair density (hairless, sparse, light, moderate, hairy, very-hairy)
- **composition**: Body composition (underweight, lean, average, soft, chubby, overweight, obese)
- **skinColor**: Skin color (free-form text)

When an entity is generated using a recipe with body descriptors, these characteristics are automatically applied to the resulting body component.

## Basic Usage

### Adding Body Descriptors to Recipes

Body descriptors are defined in the `bodyDescriptors` section of anatomy recipes:

```json
{
  "recipeId": "mymod:warrior_body",
  "name": "Warrior Body",
  "blueprintId": "anatomy:humanoid",
  "bodyDescriptors": {
    "build": "muscular",
    "density": "moderate",
    "composition": "lean",
    "skinColor": "tanned"
  },
  "slots": {
    "torso": {
      "partType": "torso"
    },
    "arms": {
      "partType": "arm",
      "count": 2
    }
  }
}
```

### Partial Body Descriptors

You don't need to specify all descriptor types. You can define only the ones relevant to your recipe:

```json
{
  "recipeId": "mymod:athletic_build",
  "name": "Athletic Build",
  "blueprintId": "anatomy:humanoid",
  "bodyDescriptors": {
    "build": "athletic",
    "composition": "lean"
  },
  "slots": {
    "torso": { "partType": "torso" }
  }
}
```

### Available Values

#### Build Types

- `skinny` - Very thin build
- `slim` - Lean and slender
- `lissom` - Gracefully flexible and slender
- `toned` - Well-defined but not bulky
- `athletic` - Sporty, fit physique
- `shapely` - Curved, attractive build
- `hourglass` - Pronounced waist-to-hip contrast
- `thick` - Solid, substantial build
- `muscular` - Heavily muscled
- `hulking` - Massive, imposing frame
- `stocky` - Short and sturdy

#### Height Types

- `gigantic` - Towering, colossal stature
- `very-tall` - Significantly taller than average
- `tall` - Noticeably tall build
- `average` - Typical height range
- `short` - Below average height
- `petite` - Very small yet proportionate
- `tiny` - Extremely small stature

#### Density Types (Body Hair)

- `hairless` - No visible body hair
- `sparse` - Very light body hair
- `light` - Light body hair coverage
- `moderate` - Average body hair
- `hairy` - Heavy body hair coverage
- `very-hairy` - Extremely hairy

#### Composition Types

- `underweight` - Below healthy weight
- `lean` - Low body fat
- `average` - Normal body composition
- `soft` - Slightly higher body fat
- `chubby` - Noticeably higher body fat
- `overweight` - Significantly overweight
- `obese` - Very high body weight

#### Skin Color

Skin color accepts any string value, allowing for creative descriptions:

- `"pale"`, `"fair"`, `"olive"`, `"tanned"`, `"dark"`, `"ebony"`
- Creative descriptions: `"sun-kissed"`, `"porcelain"`, `"bronze"`

## Advanced Usage

### Recipe Inheritance

Body descriptors work with recipe inheritance. Child recipes can override parent descriptors:

```json
// Parent recipe
{
  "recipeId": "mymod:base_humanoid",
  "bodyDescriptors": {
    "build": "toned",
    "composition": "average",
    "skinColor": "fair"
  }
}

// Child recipe - overrides build but keeps other descriptors
{
  "recipeId": "mymod:strong_humanoid",
  "extends": "mymod:base_humanoid",
  "bodyDescriptors": {
    "build": "muscular"
  }
}
```

### Conditional Descriptors with Variants

You can use recipe variants to create conditional body descriptors:

```json
{
  "recipeId": "mymod:variable_npc",
  "name": "Variable NPC",
  "blueprintId": "anatomy:humanoid",
  "variants": [
    {
      "weight": 0.4,
      "bodyDescriptors": {
        "build": "slim",
        "composition": "lean",
        "skinColor": "fair"
      }
    },
    {
      "weight": 0.6,
      "bodyDescriptors": {
        "build": "athletic",
        "composition": "average",
        "skinColor": "tanned"
      }
    }
  ],
  "slots": {
    "torso": { "partType": "torso" }
  }
}
```

## Description Generation

### Display Order

Body descriptors appear first in generated descriptions, in this specific order:

1. **Skin color** (if specified)
2. **Build**
3. **Body hair** (density)
4. **Body composition**

Example output:

```
Skin color: olive
Build: athletic
Body hair: moderate
Body composition: lean
```

### Integration with Part Descriptions

Body descriptors appear before individual body part descriptions:

```
Skin color: tanned
Build: muscular
Body hair: hairy
Body composition: lean

She has a well-defined torso.
Her arms are strong and powerful.
```

## Backward Compatibility

### Entity-Level Descriptors

Body descriptors work alongside existing entity-level descriptor components:

- **Body descriptors take precedence** when both are present
- **Entity-level descriptors are fallback** when body descriptors are missing
- **Mixed usage is supported** - you can have some descriptors at body level and others at entity level

Example of mixed usage:

```json
// Recipe with partial body descriptors
{
  "bodyDescriptors": {
    "build": "athletic"
    // No composition specified
  }
}

// Entity can still have entity-level composition component
// The build will come from body descriptors
// The composition will fall back to entity-level component
```

### Migration Strategy

When migrating from entity-level to body-level descriptors:

1. **Gradual Migration**: Start by adding body descriptors to new recipes
2. **Coexistence**: Both systems work together during transition
3. **Priority System**: Body descriptors automatically take precedence
4. **No Breaking Changes**: Existing content continues to work

## Best Practices

### When to Use Body Descriptors

✅ **Use body descriptors for:**

- Common character archetypes (warrior, scholar, etc.)
- Consistent racial/ethnic characteristics
- Standard NPC templates
- Recipe-level defaults

❌ **Don't use body descriptors for:**

- Highly unique individual characters
- Characters needing complex descriptor logic
- Descriptors that change during gameplay

### Naming Conventions

- Use descriptive recipe IDs: `mymod:elven_warrior`, `mymod:dwarven_miner`
- Group related recipes: `mymod:humanoid_base`, `mymod:humanoid_strong`
- Use clear variant names when applicable

### Performance Considerations

- Body descriptors are applied at generation time, not runtime
- No performance impact during gameplay
- Slightly faster than entity-level descriptors due to fewer component lookups

## Common Patterns

### Character Archetypes

```json
// Warrior archetype
{
  "recipeId": "mymod:warrior_template",
  "bodyDescriptors": {
    "build": "muscular",
    "composition": "lean",
    "density": "moderate",
    "skinColor": "tanned"
  }
}

// Scholar archetype
{
  "recipeId": "mymod:scholar_template",
  "bodyDescriptors": {
    "build": "slim",
    "composition": "average",
    "density": "sparse",
    "skinColor": "pale"
  }
}
```

### Racial Templates

```json
// Elven template
{
  "recipeId": "mymod:elven_base",
  "bodyDescriptors": {
    "build": "slim",
    "composition": "lean",
    "density": "sparse",
    "skinColor": "fair"
  }
}

// Dwarven template
{
  "recipeId": "mymod:dwarven_base",
  "bodyDescriptors": {
    "build": "stocky",
    "composition": "average",
    "density": "very-hairy",
    "skinColor": "ruddy"
  }
}
```

### Environmental Adaptation

```json
// Desert dweller
{
  "recipeId": "mymod:desert_nomad",
  "bodyDescriptors": {
    "build": "lean",
    "composition": "lean",
    "density": "sparse",
    "skinColor": "bronze"
  }
}

// Mountain dweller
{
  "recipeId": "mymod:mountain_folk",
  "bodyDescriptors": {
    "build": "stocky",
    "composition": "average",
    "density": "moderate",
    "skinColor": "weathered"
  }
}
```

## Schema Validation

Body descriptors are automatically validated against the anatomy recipe schema. Invalid values will cause recipe loading to fail with clear error messages.

### Validation Rules

- `build`, `density`, `composition` must use enum values only
- `skinColor` accepts any string value
- All body descriptor fields are optional
- Extra fields in `bodyDescriptors` are not allowed

### Error Examples

```json
// ❌ Invalid - 'huge' is not a valid build type
{
  "bodyDescriptors": {
    "build": "huge"  // Should be one of: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky
  }
}

// ❌ Invalid - extra field not allowed
{
  "bodyDescriptors": {
    "build": "athletic",
    "invalidField": "value"  // Not allowed
  }
}

// ✅ Valid - all fields optional and valid
{
  "bodyDescriptors": {
    "build": "athletic",
    "skinColor": "olive"
  }
}
```

## Troubleshooting

### Common Issues

**Issue**: Body descriptors not appearing in descriptions

- Check that the recipe is properly loaded
- Verify the entity was generated using the correct recipe
- Ensure the anatomy generation workflow is working

**Issue**: Wrong descriptor values appearing

- Verify spelling of descriptor values against enum lists
- Check for entity-level descriptors that might be overriding
- Confirm the recipe variant system is working as expected

**Issue**: Schema validation errors

- Check that all descriptor values are from allowed enums
- Remove any extra fields in the `bodyDescriptors` object
- Verify JSON syntax is correct

### Debugging Tips

1. **Check generated entities**: Inspect the generated body component's `descriptors` field
2. **Validate recipes**: Use the recipe validation system to check syntax
3. **Test incrementally**: Start with simple descriptors and add complexity gradually
4. **Review logs**: Check for any warning or error messages during recipe loading

## Integration with Other Systems

### Equipment and Clothing

Body descriptors work seamlessly with equipment and clothing systems:

- Body descriptors describe the underlying body
- Equipment descriptions appear after body descriptions
- Clothing can override or modify visible body characteristics

### Character Progression

Body descriptors are applied at generation time:

- They represent the character's base physical characteristics
- Game events can modify descriptor components during play
- Use entity-level descriptors for characteristics that change over time

### AI and Personality

Body descriptors can influence AI behavior and personality generation:

- Strong build types might suggest warrior tendencies
- Lean builds could indicate agile character types
- Use descriptors as input to personality generation systems

## Version Compatibility

Body descriptors were introduced in version X.X.X and are:

- **Forward compatible**: New descriptor types can be added without breaking existing recipes
- **Backward compatible**: Existing entity-level descriptor systems continue to work
- **Migration friendly**: No immediate changes required to existing content

For the most up-to-date information and examples, refer to the core mod recipes in `data/mods/core/recipes/`.

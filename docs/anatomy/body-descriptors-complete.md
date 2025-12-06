# Body Descriptor System Guide

## Overview

The body descriptor system centralizes high-level appearance metadata for generated bodies. Descriptor definitions live in a shared registry so schema validation, formatting, authoring tools, and description generation all stay synchronized.

## Key Artifacts

- **Registry source of truth**: `src/anatomy/registries/bodyDescriptorRegistry.js` exposes descriptor metadata, accessors, and validation helpers.
- **Runtime validation utilities**: `src/anatomy/utils/bodyDescriptorValidator.js` validates descriptor payloads inside workflows and throws structured errors for invalid data.
- **System consistency validator**: `src/anatomy/validators/bodyDescriptorValidator.js` compares the registry, formatting config, and representative recipes for CI-style checks.
- **CLI entry point**: `scripts/validate-body-descriptors.js` runs the system validator and prints actionable results (`npm run validate:body-descriptors`).
- **Schema contract**: `data/schemas/anatomy.recipe.schema.json` defines the allowed `bodyDescriptors` properties and enumerations for recipes.
- **Formatting configuration**: `data/mods/anatomy/anatomy-formatting/default.json` determines how descriptor display keys are ordered in generated text.
- **Automated tests**: `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js` asserts registry completeness, ordering, and formatter behavior.

## Descriptor Metadata Structure

Each registry entry contains the following fields, providing everything needed for validation and display:

```javascript
{
  schemaProperty: 'height',              // JSON schema property (camelCase)
  displayLabel: 'Height',                // Human-readable label
  displayKey: 'height',                  // Formatting key (snake_case when multi-word)
  dataPath: 'body.descriptors.height',   // Path inside anatomy:body
  validValues: [...],                    // Enum array or null for free-form
  displayOrder: 10,                      // Lower numbers render earlier
  extractor: (bodyComponent) => ...,     // Pulls the raw value
  formatter: (value) => `Height: ${value}`,
  required: false,
}
```

## Current Registry Entries

| Descriptor    | Display order | Type             | Valid values                                                                                                                                                                        |
| ------------- | ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `height`      | 10            | Enumerated       | microscopic, minuscule, tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic                                                                                  |
| `skinColor`   | 20            | Free-form string | Any string                                                                                                                                                                          |
| `build`       | 30            | Enumerated       | skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky, frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky |
| `composition` | 40            | Enumerated       | underweight, lean, average, soft, chubby, overweight, obese, atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting                         |
| `hairDensity` | 50            | Enumerated       | hairless, sparse, light, moderate, hairy, very-hairy, furred                                                                                                                        |
| `smell`       | 60            | Free-form string | Any string                                                                                                                                                                          |

**Next available `displayOrder`**: 70 (keep increments of 10 to simplify later insertions).

### Vocabulary Enhancements

The registry already includes expanded vocabularies that support horror, fantasy, and medical scenarios:

- **Composition**: adds severe conditions such as `desiccated`, `bloated`, and `rotting` alongside baseline physique terms.
- **Build**: covers extremes like `cadaverous`, `massive`, and `barrel-chested` for unusual silhouettes.
- **Height**: supports `microscopic` through `titanic` for supernatural scale.
- **Hair density**: includes `furred` for creature-like anatomies.
- **Part-level descriptors**: components such as `descriptors:deformity` and `descriptors:structural_integrity` include advanced values like `supernumerary`, `necrotic`, `crystalline`, and `ethereal` for detailed anatomical storytelling.

## Data Flow

1. **Recipes** declare optional `bodyDescriptors` that are validated against the registry and schema.
2. **Parts map stage** (`executePartsMapBuilding`) copies validated descriptor data into the `anatomy:body` component when constructing the generated entity.
3. **Description generation** reads descriptors in registry order and formats them for output via `BodyDescriptionComposer`.

## Extending the Registry

When introducing a new body descriptor, update each layer in this order:

1. **Registry** (`src/anatomy/registries/bodyDescriptorRegistry.js`)

   ```javascript
   BODY_DESCRIPTOR_REGISTRY.posture = {
     schemaProperty: 'posture',
     displayLabel: 'Posture',
     displayKey: 'posture',
     dataPath: 'body.descriptors.posture',
     validValues: ['slouched', 'relaxed', 'upright', 'rigid'],
     displayOrder: 70,
     extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.posture,
     formatter: (value) => `Posture: ${value}`,
     required: false,
   };
   ```

   Keep naming consistent: camelCase for `schemaProperty`, snake_case for multi-word `displayKey`, and reuse the registry formatter/extractor pattern.

2. **Schema** (`data/schemas/anatomy.recipe.schema.json`)
   Add the matching property (enum array or free-form string) under `bodyDescriptors`. Ensure the enum exactly matches `validValues`.

3. **Formatting config** (`data/mods/anatomy/anatomy-formatting/default.json`)
   Insert the descriptor’s `displayKey` alongside the existing body descriptor keys at the top of `descriptionOrder`. The file continues with many part-specific entries; keep the broader order intact.

4. **Tests** (`tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`)
   Extend the registry tests to assert the new metadata, valid values, extractor, and formatter behavior so future regressions are caught automatically.

5. **Validation**
   Run `npm run validate:body-descriptors` to verify the registry, schema, and formatting configuration stay aligned.

## Validation Tooling

- `src/anatomy/utils/BodyDescriptorValidator` throws descriptive errors for invalid payloads and ensures only known properties are present.
- `src/anatomy/validators/BodyDescriptorValidator` aggregates configuration checks, surfaces warnings for unknown descriptors, and reports summary info for CI pipelines.
- The CLI wraps these checks, loads representative recipes, and exits with failure when inconsistencies are detected.

### Sample CLI Output

```
$ npm run validate:body-descriptors

🔍 Body Descriptor System Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Checking Registry...
   Found 6 registered descriptors
   height, skinColor, build, composition, hairDensity, smell
📄 Validating Formatting Configuration...
   ✅ Formatting configuration is valid
🧬 Validating Anatomy Recipes...
   ✅ human_male.recipe.json
   ✅ human_female.recipe.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Validation Passed
Body descriptor system is consistent.
```

## Troubleshooting

- **Descriptor missing from descriptions**: Ensure the descriptor’s `displayKey` appears in `descriptionOrder`; missing keys trigger warnings such as `Body descriptor 'posture' defined in registry but missing from descriptionOrder. Descriptor will not appear in generated descriptions.`
- **Validation errors for enum values**: The runtime validator reports messages like `Invalid height descriptor: 'super-tall' …` when recipe values fall outside the registry enumerations.
- **Unknown properties**: Passing unregistered keys raises `Unknown body descriptor 'X' (not in registry)` warnings in the system validator and throws errors in runtime validation, preventing typos from silently passing through.

## Related Documentation

- [Anatomy System Guide](./anatomy-system-guide.md)
- [Body Descriptors Technical Notes](../development/body-descriptors-technical.md)
- [Body Descriptor Migration Guide](../migration/body-descriptor-migration.md)

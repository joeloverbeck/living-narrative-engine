# Anatomy Blueprints and Structure Templates

## Assets in this repository
- **Blueprint schema**: `data/schemas/anatomy.blueprint.schema.json` defines available properties, version gating, and validation rules for both V1 and V2 documents.【F:data/schemas/anatomy.blueprint.schema.json†L1-L93】【F:data/schemas/anatomy.blueprint.schema.json†L101-L148】
- **Structure template schema**: `data/schemas/anatomy.structure-template.schema.json` describes topology, limb sets, appendages, and socket patterns used by V2 templates.【F:data/schemas/anatomy.structure-template.schema.json†L1-L82】【F:data/schemas/anatomy.structure-template.schema.json†L83-L152】
- **Runtime processing**: `src/anatomy/bodyBlueprintFactory/blueprintLoader.js` expands V2 blueprints into slot lists and tracks template-generated sockets, while `src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js` merges those sockets with the root entity during graph creation.【F:src/anatomy/bodyBlueprintFactory/blueprintLoader.js†L32-L121】【F:src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js†L139-L224】
- **Socket and slot generation**: `src/anatomy/socketGenerator.js` and `src/anatomy/slotGenerator.js` apply the template topology, using the shared `OrientationResolver` in `src/anatomy/shared/orientationResolver.js` for consistent naming.【F:src/anatomy/socketGenerator.js†L1-L126】【F:src/anatomy/slotGenerator.js†L1-L178】【F:src/anatomy/socketGenerator.js†L133-L204】【F:src/anatomy/shared/orientationResolver.js†L1-L94】
- **Data examples**: V2 blueprints live in `data/mods/anatomy/blueprints/`, with matching structure templates in `data/mods/anatomy/structure-templates/` (for example, the giant spider and winged quadruped assets).【F:data/mods/anatomy/blueprints/giant_spider.blueprint.json†L1-L22】【F:data/mods/anatomy/structure-templates/structure_winged_quadruped.structure-template.json†L1-L43】

## Blueprint schema versions
| Schema version | How to declare | Core properties | Blocked properties | Typical usage |
| -------------- | -------------- | ----------------| ------------------ | ------------- |
| **V1 (1.0 or omitted)** | Omit `schemaVersion` or set to `"1.0"` | `slots`, `parts`, `compose`, `clothingSlotMappings` | `structureTemplate`, `additionalSlots` | Humanoid or hand-authored slot layouts that need manual control.【F:data/schemas/anatomy.blueprint.schema.json†L18-L60】【F:data/schemas/anatomy.blueprint.schema.json†L107-L144】 |
| **V2 ("2.0")** | Set `schemaVersion` to `"2.0"` and supply `structureTemplate` | `structureTemplate`, optional `additionalSlots`, optional `clothingSlotMappings` | `slots`, `parts`, `compose` | Template-driven non-human or repeatable body plans.【F:data/schemas/anatomy.blueprint.schema.json†L18-L93】【F:src/anatomy/bodyBlueprintFactory/blueprintLoader.js†L49-L121】 |

When a V2 blueprint is loaded, the loader generates slots from the referenced template, merges them with any `additionalSlots`, stores the resulting socket list on `_generatedSockets`, and returns the enriched blueprint. During anatomy creation, the factory merges `_generatedSockets` with the root entity's existing `anatomy:sockets` component, with template sockets overriding duplicates.【F:src/anatomy/bodyBlueprintFactory/blueprintLoader.js†L92-L159】【F:src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js†L139-L224】

## Key blueprint properties
- **`structureTemplate`**: Namespaced identifier pointing at a structure template asset. The template must already be registered by the data loader or validation will fail.【F:data/schemas/anatomy.blueprint.schema.json†L24-L60】【F:src/anatomy/bodyBlueprintFactory/blueprintLoader.js†L92-L121】
- **`additionalSlots`**: Optional object that adds or overrides slots after template generation. Supplying a `parent` field allows intentional remapping of template slots (for example, centaur arm attachments).【F:data/schemas/anatomy.blueprint.schema.json†L32-L60】【F:data/mods/anatomy/blueprints/centaur_warrior.blueprint.json†L1-L42】 
- **`clothingSlotMappings`**: Same structure for both versions; maps blueprint slots or raw sockets to clothing slots. Validation enforces at least one of `blueprintSlots` or `anatomySockets` plus the allowed layer list.【F:data/schemas/anatomy.blueprint.schema.json†L60-L101】

## Structure template format
Every template contains an `id` and `topology.rootType`. Limb sets and appendages are optional but provide most of the automation.【F:data/schemas/anatomy.structure-template.schema.json†L17-L82】 Template files are validated through `anatomyStructureTemplateLoader`, which runs the JSON schema and additional checks before registration.【F:src/loaders/anatomyStructureTemplateLoader.js†L16-L120】

### Limb sets
- Required fields: `type`, `count` (1–100), and `socketPattern`.
- Optional fields: `arrangement` (`bilateral`, `radial`, `quadrupedal`, `linear`, `custom`), `optional`, and `arrangementHint` for extra context.
- The generator iterates from 1..count and applies the socket pattern for each limb.【F:data/schemas/anatomy.structure-template.schema.json†L83-L129】【F:src/anatomy/socketGenerator.js†L52-L88】

### Appendages
- Required fields: `type`, `count` (1–10), `attachment` (`anterior`, `posterior`, `dorsal`, `ventral`, `lateral`, `custom`), and `socketPattern`.
- Optional `optional` flag mirrors limb sets.
- Socket generation uses the same template resolver as limb sets.【F:data/schemas/anatomy.structure-template.schema.json†L129-L152】【F:src/anatomy/socketGenerator.js†L90-L126】

### Socket patterns
- Fields: `idTemplate`, `allowedTypes`, optional `orientationScheme`, `nameTpl`, and `positions`.
- Valid `orientationScheme` values are `bilateral`, `radial`, `indexed`, and `custom`. Internally, the resolver also accepts `quadrupedal` to support future patterns, but current templates rely on the four schema-sanctioned values.【F:data/schemas/anatomy.structure-template.schema.json†L152-L202】【F:src/anatomy/shared/orientationResolver.js†L32-L94】
- `OrientationResolver` is the shared implementation used by both socket and slot generators, ensuring slot keys and socket IDs stay aligned.【F:src/anatomy/socketGenerator.js†L133-L204】【F:src/anatomy/shared/orientationResolver.js†L1-L94】

### Name templates
If `nameTpl` is omitted, generated parts default to `"{{type}} {{index}}"`. Providing `{{orientation}}` or other placeholders customizes the display name while leaving the socket ID untouched.【F:data/schemas/anatomy.structure-template.schema.json†L152-L202】【F:src/anatomy/socketGenerator.js†L163-L204】

## Example assets
- **Giant spider**: Blueprint `data/mods/anatomy/blueprints/giant_spider.blueprint.json` references `structure_arachnid_8leg` and adds venom gland plus spinneret slots. The template produces eight leg sockets, two pedipalp sockets, and a posterior torso connection.【F:data/mods/anatomy/blueprints/giant_spider.blueprint.json†L1-L22】【F:data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json†L1-L35】
- **Winged quadruped**: Blueprint `data/mods/anatomy/blueprints/red_dragon.blueprint.json` references `structure_winged_quadruped`, generating four leg sockets, bilateral wings, head, and tail without custom slots.【F:data/mods/anatomy/blueprints/red_dragon.blueprint.json†L1-L16】【F:data/mods/anatomy/structure-templates/structure_winged_quadruped.structure-template.json†L1-L43】
- **Centaur warrior**: Demonstrates overriding template results by adding arm slots with explicit parents in `additionalSlots` while still relying on the shared quadrupedal limb set.【F:data/mods/anatomy/blueprints/centaur_warrior.blueprint.json†L1-L42】【F:data/mods/anatomy/structure-templates/structure_centauroid.structure-template.json†L1-L34】

## Migrating a V1 blueprint to V2
1. Identify repeated slot patterns in the V1 asset and capture them as limb sets or appendages in a new structure template file under `data/mods/anatomy/structure-templates/` (use the schema defaults shown above).【F:data/schemas/anatomy.structure-template.schema.json†L83-L202】
2. Update the blueprint to set `schemaVersion` to `"2.0"`, reference the template via `structureTemplate`, and move bespoke sockets into `additionalSlots`. The loader will warn if `additionalSlots` duplicates a generated slot without redefining the parent, helping surface mistakes.【F:data/schemas/anatomy.blueprint.schema.json†L24-L60】【F:src/anatomy/bodyBlueprintFactory/blueprintLoader.js†L107-L159】
3. Keep any existing `clothingSlotMappings`; they are valid in both versions and continue to point at either generated slots or explicit sockets.【F:data/schemas/anatomy.blueprint.schema.json†L60-L101】
4. Test by instantiating the blueprint through the `BodyBlueprintFactory`; `_generatedSockets` will populate the entity with the template sockets so that recipe pattern validation can confirm the new names.【F:src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js†L139-L224】【F:src/anatomy/validation/patternMatchingValidator.js†L231-L277】

## Best practices
- Prefer reusable templates (`structure_winged_quadruped`, `structure_centauroid`, etc.) and share them across multiple blueprints to minimize maintenance.【F:data/mods/anatomy/structure-templates/structure_winged_quadruped.structure-template.json†L1-L43】【F:data/mods/anatomy/structure-templates/structure_centauroid.structure-template.json†L1-L34】
- Use `additionalSlots` only for genuinely unique attachments or to change parents; the loader already warns on accidental duplicates without overrides.【F:src/anatomy/bodyBlueprintFactory/blueprintLoader.js†L107-L159】
- Document each template with a descriptive `description` to aid mod authors and reviewers.【F:data/mods/anatomy/structure-templates/structure_octopoid.structure-template.json†L1-L20】

## Troubleshooting
- **"structureTemplate required when schemaVersion is 2.0"**: Ensure the blueprint includes a valid `structureTemplate` string; V2 mode disallows `slots`, `parts`, and `compose`.【F:data/schemas/anatomy.blueprint.schema.json†L24-L93】
- **Template not found**: The loader throws `ValidationError` if the structure template ID is missing from the registry—confirm the template file loaded successfully through `AnatomyStructureTemplateLoader`.【F:src/anatomy/bodyBlueprintFactory/blueprintLoader.js†L92-L121】【F:src/loaders/anatomyStructureTemplateLoader.js†L16-L120】
- **Unexpected socket names**: Revisit the template’s `orientationScheme` and `positions`. `OrientationResolver` falls back to numeric indices if the requested position is missing, which often signals a mismatch between count and positions array.【F:src/anatomy/shared/orientationResolver.js†L32-L94】【F:data/schemas/anatomy.structure-template.schema.json†L152-L202】
- **Recipe pattern mismatches**: Pattern validators rely on the structure template; run the recipe through pattern validation to see which slot groups are missing or empty.【F:src/anatomy/validation/patternMatchingValidator.js†L231-L277】

## Related documentation
- [Recipe pattern matching](./recipe-pattern-matching.md)
- [Non-human quickstart](./non-human-quickstart.md)
- [Anatomy system guide](./anatomy-system-guide.md)
- [Troubleshooting](./troubleshooting.md)

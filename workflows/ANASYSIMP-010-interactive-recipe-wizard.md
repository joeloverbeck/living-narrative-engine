# ANASYSIMP-010: Interactive Recipe Wizard

**Phase:** 3 (Architectural Enhancements)
**Priority:** P2
**Effort:** High (5-6 days)
**Impact:** Medium - Prevents common mistakes
**Status:** Not Started

## Context

Manual recipe creation is error-prone. An interactive wizard can guide creators through the process with real-time validation.

**Important**: Recipes define *what body parts to use* (content), not *what's allowed* (that's blueprints). The wizard creates anatomy recipes that reference existing blueprints.

## Solution Overview

Create interactive CLI wizard using `inquirer` that:
- Guides through recipe creation step-by-step
- Validates inputs in real-time against schemas and loaded mods
- Suggests values from registry (blueprints, body descriptors, part types)
- Auto-completes entity IDs and component tags
- Supports both V1 (explicit slots) and V2 (pattern-based) recipes
- Generates validated recipe file

## Implementation

```bash
npm run create:recipe

? Recipe ID: red_dragon
? Select blueprint: (Use arrow keys)
  ❯ anatomy:red_dragon (V2 - structure template)
    anatomy:human_male (V1 - explicit slots)
    anatomy:giant_spider (V2 - structure template)

? Blueprint: anatomy:red_dragon selected (V2)

Blueprint info:
  Schema version: 2.0
  Structure template: anatomy:structure_winged_quadruped
  Generated slots: leg_left_front, leg_right_front, leg_left_rear, leg_right_rear,
                   wing_left, wing_right, head, tail

? Configure body descriptors? (Y/n): y
  ? Build: (Use arrow keys)
    ❯ muscular
      athletic
      stocky
  ? Hair density: moderate
  ? Composition: lean
  ? Skin color: crimson scales

? Recipe configuration approach: (Use arrow keys)
  ❯ Pattern-based (recommended for V2 blueprints)
    Slot-by-slot (for unique slots)
    Hybrid (patterns + individual overrides)

? Configure pattern #1:
  ? Pattern type: (Use arrow keys)
    ❯ matchesGroup (select limb set or appendage type)
      matchesPattern (wildcard matching)
      matchesAll (property-based filtering)
      matches (explicit slot list - V1)

  ? matchesGroup value: limbSet:leg
  ? Part type: dragon_leg
  ? Tags to add (space to select, enter when done):
    ◉ anatomy:part
    ◉ anatomy:scaled
    ◯ anatomy:clawed
  ? Add properties? (y/N): y
    ? Component: anatomy:scaled
      ? Property 'color': red

? Add another pattern? (y/N): y

? Configure pattern #2:
  ? Pattern type: matchesGroup
  ? matchesGroup value: limbSet:wing
  ? Part type: dragon_wing
  ? Tags to add:
    ◉ anatomy:part
    ◉ anatomy:scaled
  ? Prefer specific entity: (optional)
    anatomy:dragon_wing_large

? Add individual slot overrides? (y/N): n

? Add constraints? (y/N): n

✓ Recipe validation passed!
✓ Saved to: data/mods/anatomy/recipes/red_dragon.recipe.json

Generated recipe:
{
  "recipeId": "anatomy:red_dragon",
  "blueprintId": "anatomy:red_dragon",
  "bodyDescriptors": {
    "build": "muscular",
    "hairDensity": "moderate",
    "composition": "lean",
    "skinColor": "crimson scales"
  },
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "dragon_leg",
      "tags": ["anatomy:part", "anatomy:scaled"],
      "properties": {
        "anatomy:scaled": {
          "color": "red"
        }
      }
    },
    {
      "matchesGroup": "limbSet:wing",
      "partType": "dragon_wing",
      "tags": ["anatomy:part", "anatomy:scaled"],
      "preferId": "anatomy:dragon_wing_large"
    }
  ]
}
```

## Key Features

1. **Blueprint Selection** - List from registry with V1/V2 indication
2. **Blueprint Introspection** - Shows generated slots for V2 blueprints
3. **Body Descriptor Configuration** - Enum selection with validation from registry
4. **Pattern-Based Configuration** - Supports all pattern types (matchesGroup, matchesPattern, matchesAll, matches)
5. **Slot Override Support** - Individual slot configuration when needed
6. **Tag Selection** - Multi-select from loaded component definitions
7. **Property Configuration** - Component-specific property input with validation
8. **Entity Preference** - Optional preferId for specific entity definitions
9. **Constraint Definition** - Optional requires/excludes constraints
10. **Real-time Validation** - Validate against schema and loaded mods
11. **File Generation** - Create validated recipe with proper formatting

## File Structure

```
scripts/
└── create-recipe-wizard.js       # Interactive wizard

package.json                       # Add npm script: "create:recipe"
```

## Technical Implementation Details

### Blueprint Introspection

For V2 blueprints, the wizard must:
1. Load the blueprint via `IAnatomyBlueprintRepository.getBlueprint()`
2. If `schemaVersion === "2.0"`, load the structure template
3. Use `ISlotGenerator.generateSlots()` to get the generated slot list
4. Display slot information to help with pattern creation

### Pattern Type Support

The wizard must support all four pattern matchers:

1. **matchesGroup**: `limbSet:{type}` or `appendage:{type}`
   - List available limb sets/appendages from structure template
   - Example: `limbSet:leg`, `appendage:tail`

2. **matchesPattern**: Wildcard matching on slot keys
   - Support `*` wildcards (prefix, suffix, contains)
   - Example: `leg_*`, `*_left`, `*tentacle*`

3. **matchesAll**: Property-based filtering
   - Filter by `slotType`, `orientation`, or `socketId`
   - Support wildcards in orientation/socketId
   - Example: `{ orientation: "left_*" }`

4. **matches**: Explicit slot list (V1 style)
   - Multi-select from blueprint slots
   - Example: `["leg_1", "leg_2", "leg_3"]`

### Body Descriptors

Use `BODY_DESCRIPTOR_REGISTRY` from `src/anatomy/registries/bodyDescriptorRegistry.js`:
- Present enums for: build, hairDensity, composition, height
- Allow free-form input for: skinColor, smell
- Validate enums against registry's `validValues`
- All descriptors are optional

### Tag Selection

Load component definitions from `IDataRegistry`:
- Search for components in loaded mods
- Present as multi-select list
- Common tags: `anatomy:part`, `anatomy:scaled`, `anatomy:clawed`, etc.

### Validation

Use existing `RecipePreflightValidator`:
- Load mods (core, descriptors, anatomy minimum)
- Validate against `anatomy.recipe.schema.json`
- Check blueprint exists
- Verify pattern matching produces valid results
- Validate body descriptors against registry

## Acceptance Criteria

- [ ] Wizard guides through all recipe creation steps
- [ ] Supports both V1 (explicit slots) and V2 (pattern-based) recipes
- [ ] Blueprint selection from registry with V1/V2 indication
- [ ] For V2 blueprints, shows generated slots from structure template
- [ ] Body descriptor configuration with enum validation
- [ ] Pattern type selection (matchesGroup, matchesPattern, matchesAll, matches)
- [ ] Tag selection from loaded component definitions
- [ ] Property configuration for component tags
- [ ] Optional preferId for entity selection
- [ ] Optional constraint definition (requires/excludes)
- [ ] Real-time validation using RecipePreflightValidator
- [ ] Generated recipe passes full validation
- [ ] Saved to `data/mods/anatomy/recipes/{recipeId}.recipe.json`
- [ ] User-friendly error messages with suggestions
- [ ] Help text explaining V1 vs V2 concepts
- [ ] Examples shown for each pattern type

## Dependencies

**Depends On:**
- ANASYSIMP-003 (Pre-flight Validator for real-time validation)
- `inquirer` npm package (interactive prompts)
- `commander` npm package (CLI argument parsing)
- `chalk` npm package (colored output)

**Production Code Dependencies:**
- `src/anatomy/repositories/anatomyBlueprintRepository.js` - Blueprint access
- `src/anatomy/registries/bodyDescriptorRegistry.js` - Body descriptor metadata
- `src/anatomy/validation/RecipePreflightValidator.js` - Validation
- `src/anatomy/slotGenerator.js` - V2 slot generation (via ISlotGenerator)
- `src/dependencyInjection/minimalContainerConfig.js` - DI container setup
- `scripts/validate-recipe.js` - Reference implementation for mod loading

**Documentation References:**
- `docs/anatomy/anatomy-system-guide.md` - System architecture
- `docs/anatomy/blueprints-and-templates.md` - Blueprint V1 vs V2, structure templates
- `docs/anatomy/recipe-pattern-matching.md` - Pattern matching guide
- `docs/anatomy/body-descriptors-complete.md` - Body descriptor registry

## Implementation Notes

### Mod Loading Strategy

Follow the approach from `scripts/validate-recipe.js`:
```javascript
// Load minimal mods for recipe creation
const essentialMods = ['core', 'descriptors', 'anatomy'];

// Use phases directly to avoid game.json override
const schemaPhase = container.resolve(tokens.SchemaPhase);
const manifestPhase = container.resolve(tokens.ManifestPhase);
const contentPhase = container.resolve(tokens.ContentPhase);

context = await schemaPhase.execute(context);
context = await manifestPhase.execute(context);
context = await contentPhase.execute(context);
```

### Pattern Introspection

For matchesGroup patterns, introspect the structure template:
```javascript
const blueprint = await blueprintRepo.getBlueprint(blueprintId);
if (blueprint.schemaVersion === "2.0") {
  const template = dataRegistry.get('anatomyStructureTemplates', blueprint.structureTemplate);

  // List available limb sets
  const limbSets = template.topology.limbSets.map(ls => `limbSet:${ls.type}`);

  // List available appendages
  const appendages = template.topology.appendages.map(a => `appendage:${a.type}`);
}
```

## References

- **Report Section:** Recommendation 2.5
- **Report Pages:** Lines 838-896
- **Related Workflow:** ANASYSIMP-003 (Recipe Pre-flight Validator)

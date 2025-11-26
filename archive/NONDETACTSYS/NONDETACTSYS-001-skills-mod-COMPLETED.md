# NONDETACTSYS-001: Create Skills Mod with Skill Components

**Status: COMPLETED**

## Summary

Create the `skills` mod with individual skill components for character combat proficiencies. These components follow the existing ECS pattern and will be used by the non-deterministic action system for probability calculations.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/skills/mod-manifest.json` | Mod manifest with core dependency |
| `data/mods/skills/components/melee_skill.component.json` | Melee combat proficiency |
| `data/mods/skills/components/defense_skill.component.json` | Defensive combat skill |
| `data/mods/skills/components/ranged_skill.component.json` | Ranged combat proficiency |
| `data/mods/skills/components/dodge_skill.component.json` | Evasion skill |
| `data/mods/skills/components/parry_skill.component.json` | Parry skill |

## Files to Modify

| File | Change |
|------|--------|
| `data/game.json` | Add `skills` to the mods array |

## Implementation Details

### mod-manifest.json

The manifest follows the pattern established by `data/mods/core/mod-manifest.json`, including the required `$schema` property. Dependencies must be objects with `id` and `version` properties (not simple strings):

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "skills",
  "version": "1.0.0",
  "name": "Skills System",
  "description": "Character skills for non-deterministic action resolution",
  "dependencies": [
    { "id": "core", "version": ">=1.0.0" }
  ],
  "content": {
    "components": [
      "melee_skill.component.json",
      "defense_skill.component.json",
      "ranged_skill.component.json",
      "dodge_skill.component.json",
      "parry_skill.component.json"
    ]
  }
}
```

### Component Schema Pattern

Each skill component follows this structure:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "skills:[skill_name]",
  "description": "[Skill description]",
  "dataSchema": {
    "type": "object",
    "properties": {
      "value": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 0
      }
    },
    "required": ["value"]
  }
}
```

### Skill Definitions

| Skill ID | Description | Default Value |
|----------|-------------|---------------|
| `skills:melee_skill` | Melee combat proficiency | 10 |
| `skills:defense_skill` | Defensive combat skill for avoiding attacks | 0 |
| `skills:ranged_skill` | Ranged combat proficiency | 0 |
| `skills:dodge_skill` | Ability to evade incoming attacks | 0 |
| `skills:parry_skill` | Ability to deflect attacks with weapons | 0 |

## Out of Scope

- **DO NOT** create any service files in `src/`
- **DO NOT** modify any existing mod files
- **DO NOT** create entity definitions with skill components (separate ticket)
- **DO NOT** create tests (component validation is handled by existing schema validation)
- **DO NOT** modify any schema files

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate mod structure
npm run validate

# Validate specific mod (correct syntax)
npm run validate:mod skills

# Full schema validation
npm run test:ci
```

### Invariants That Must Remain True

- [x] All component files pass JSON schema validation
- [x] Component IDs follow `skills:[name]` namespace convention
- [x] All components reference the correct schema (`schema://living-narrative-engine/component.schema.json`)
- [x] `data/game.json` contains `skills` in mods array
- [x] Mod loads successfully in game initialization
- [x] No modifications to existing core components

### Manual Verification

1. Run `npm run dev` and verify no errors during mod loading
2. Verify `skills` mod appears in loaded mods list
3. Verify all 5 skill components are registered

## Directory Structure

After completion:

```
data/mods/skills/
├── mod-manifest.json
└── components/
    ├── melee_skill.component.json
    ├── defense_skill.component.json
    ├── ranged_skill.component.json
    ├── dodge_skill.component.json
    └── parry_skill.component.json
```

## Dependencies

- **Depends on**: Nothing (foundation ticket)
- **Blocked by**: Nothing
- **Blocks**: NONDETACTSYS-003 (SkillResolverService needs skill components to resolve)

## Reference Files

| File | Purpose |
|------|---------|
| `data/mods/core/mod-manifest.json` | Manifest pattern reference |
| `data/mods/anatomy/components/can_grab.component.json` | Component pattern reference (original ticket incorrectly referenced non-existent `grabbable.component.json`) |
| `data/schemas/component.schema.json` | Component schema reference |

## Assumption Corrections

The following assumptions in the original ticket were incorrect and have been corrected:

1. **Reference file**: Original ticket referenced `data/mods/anatomy/components/grabbable.component.json` which does not exist. The correct reference file is `data/mods/anatomy/components/can_grab.component.json`.

2. **Validation command**: Original ticket used `npm run validate:mod:skills` (colon syntax) but the correct command is `npm run validate:mod skills` (space syntax as per `scripts/validateModReferences.js`).

3. **Manifest schema**: Original ticket omitted the required `$schema` property in the manifest example. All mod manifests must include `"$schema": "schema://living-narrative-engine/mod-manifest.schema.json"`.

4. **Content listing**: Original ticket omitted the `content` section with component listing. The manifest must list all components in `content.components` array for proper loading.

5. **Dependency format**: Original ticket used simple string format for dependencies (`"dependencies": ["core"]`) but the mod-manifest schema requires objects with `id` and `version` properties (`"dependencies": [{ "id": "core", "version": ">=1.0.0" }]`).

## Outcome

### What Was Actually Changed

**Files Created (6 total):**
- `data/mods/skills/mod-manifest.json` - Mod manifest with proper schema, dependencies, and content listing
- `data/mods/skills/components/melee_skill.component.json` - Melee combat proficiency (default: 10)
- `data/mods/skills/components/defense_skill.component.json` - Defensive combat skill (default: 0)
- `data/mods/skills/components/ranged_skill.component.json` - Ranged combat proficiency (default: 0)
- `data/mods/skills/components/dodge_skill.component.json` - Evasion skill (default: 0)
- `data/mods/skills/components/parry_skill.component.json` - Parry skill (default: 0)

**Files Modified (1 total):**
- `data/game.json` - Added `skills` to mods array

### Differences From Original Plan

1. **Manifest structure enhanced**: Added required `$schema` property and `content.components` array that were missing from original spec
2. **Dependency format corrected**: Changed from simple string `["core"]` to object format `[{ "id": "core", "version": ">=1.0.0" }]`
3. **Component schemas enhanced**: Added `additionalProperties: false` and `description` field to each `value` property for better validation and documentation

### Validation Results

- `npm run validate`: ✅ PASSED (0 violations across 43 mods)
- `npm run validate:mod skills`: ✅ PASSED
- `npm run test:unit`: ✅ 2244 test suites passed, 37158 tests passed
- `npm run test:integration`: ✅ 1835 test suites passed, 13922 tests passed

### New/Modified Tests

No new tests were created for this ticket as per the "Out of Scope" section - component validation is handled by existing schema validation infrastructure. The skills mod validation is covered by:
- Existing mod manifest schema validation
- Existing component schema validation
- `npm run validate` ecosystem validation

### Completion Date

2025-11-26

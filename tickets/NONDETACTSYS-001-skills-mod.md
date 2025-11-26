# NONDETACTSYS-001: Create Skills Mod with Skill Components

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

```json
{
  "id": "skills",
  "version": "1.0.0",
  "name": "Skills System",
  "description": "Character skills for non-deterministic action resolution",
  "dependencies": ["core"]
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

# Validate specific mod
npm run validate:mod:skills

# Full schema validation
npm run test:ci
```

### Invariants That Must Remain True

- [ ] All component files pass JSON schema validation
- [ ] Component IDs follow `skills:[name]` namespace convention
- [ ] All components reference the correct schema (`schema://living-narrative-engine/component.schema.json`)
- [ ] `data/game.json` contains `skills` in mods array
- [ ] Mod loads successfully in game initialization
- [ ] No modifications to existing core components

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
| `data/mods/anatomy/components/grabbable.component.json` | Simple component pattern |
| `data/schemas/component.schema.json` | Component schema reference |

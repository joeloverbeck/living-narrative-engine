# THRITEATTAR-001: Create Ranged Mod Structure and Manifest

## Summary

Create the base directory structure and mod manifest for the new `ranged` mod that will contain the throw item at target action.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/ranged/mod-manifest.json` | Mod manifest with dependencies |

## Directories to Create

```
data/mods/ranged/
├── actions/
├── conditions/
├── macros/
├── rules/
└── scopes/
```

## Implementation Details

### mod-manifest.json

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "ranged",
  "version": "1.0.0",
  "name": "Ranged Combat",
  "description": "Ranged combat actions including throwing items at targets",
  "dependencies": [
    { "id": "core", "version": "1.0.0" },
    { "id": "items", "version": "1.0.0" },
    { "id": "skills", "version": "1.0.0" },
    { "id": "damage-types", "version": "1.0.0" },
    { "id": "positioning", "version": "1.0.0" }
  ]
}
```

### Dependencies Rationale

- `core`: Base game systems (actors, positions, events)
- `items`: `items:portable` component, inventory system
- `skills`: `skills:ranged_skill`, `skills:defense_skill` components
- `damage-types`: Damage system for applying damage on hit
- `positioning`: `positioning:wielding` component for wielded items, forbidden components

## Out of Scope

- **DO NOT** modify any existing mods
- **DO NOT** create the action, rule, condition, macro, or scope files (separate tickets)
- **DO NOT** modify `data/game.json` (separate ticket THRITEATTAR-010)
- **DO NOT** create any source code files
- **DO NOT** create any test files

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` completes without errors
2. `npm run validate:strict` completes without errors (if available)
3. The mod manifest is valid JSON and passes schema validation

### Invariants That Must Remain True

1. All existing mods continue to load without errors
2. No existing mod dependencies are affected
3. The mod ID `ranged` is unique across all mods
4. All declared dependencies exist as valid mods

## Validation Commands

```bash
# Verify manifest is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/ranged/mod-manifest.json'))"

# Run project validation
npm run validate
```

## Dependencies

- None (this is the foundational ticket)

## Blocks

- THRITEATTAR-002 (scope definition)
- THRITEATTAR-003 (action definition)
- THRITEATTAR-004 (condition definition)
- THRITEATTAR-008 (rule definition)
- THRITEATTAR-009 (macro definitions)

# Outcome

- Created `data/mods/ranged/` directory and subdirectories.
- Created `data/mods/ranged/mod-manifest.json`.
- Corrected the dependency format in the manifest to use objects with `id` and `version` (e.g. `{ "id": "core", "version": "1.0.0" }`) instead of simple strings, as required by the schema validation.
- Verified that `npm run validate` passes.
- Did NOT modify `data/game.json` as validation was successful without it (validation discovers mods by filesystem).

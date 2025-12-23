# OXYDROSYS-018: Create hypoxia progression and damage rules

## Description

Create rules for hypoxia severity escalation and anoxic brain damage.

## Files to Create

- `data/mods/breathing/rules/handle_hypoxia_progression.rule.json`
- `data/mods/breathing/rules/handle_anoxic_damage.rule.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add rules

## Out of Scope

- HypoxiaTickSystem (handles the complex logic)
- These rules may be stubs if tick system handles progression

## Acceptance Criteria

1. **Progression rule**: May dispatch events for tick system to process
2. **Damage rule**: Applies anoxic damage to brain when unconscious
3. **Valid schemas**: Both rules pass validation

## Tests That Must Pass

- `npm run validate` - Schema validation

## Invariants

- Brain damage targets brain organ specifically
- Follows existing damage application patterns

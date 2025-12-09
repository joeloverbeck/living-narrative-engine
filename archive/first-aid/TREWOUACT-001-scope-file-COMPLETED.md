# TREWOUACT-001: Create Treatable Target Body Parts Scope

## Status: ✅ COMPLETED

## Summary
Create the `treatable_target_body_parts.scope` file that returns wounded body parts on a target actor, intentionally NOT filtering by accessibility (covered wounds are allowed with penalty).

## Files to Touch
- `data/mods/first-aid/scopes/treatable_target_body_parts.scope` (CREATE)

## Out of Scope
- DO NOT modify `wounded_target_body_parts.scope` (existing scope with accessibility filtering)
- DO NOT modify `wounded_actor_body_parts.scope`
- DO NOT modify any existing scope files
- DO NOT create any test files in this ticket
- DO NOT modify the mod-manifest.json (scopes are auto-discovered)

## Implementation Details

### File Content
Create `data/mods/first-aid/scopes/treatable_target_body_parts.scope`:

```
// Returns the target actor's body part entity IDs that are wounded (health below max).
//
// BEHAVIOR: Iterates target.body_parts via BodyGraphService#getAllParts and keeps
// parts with an anatomy:part_health component whose currentHealth is lower than
// maxHealth while excluding vital organs.
//
// IMPORTANT: Unlike wounded_target_body_parts.scope, this scope does NOT filter out
// covered wounds. This allows the action to target covered wounds (with a modifier
// penalty) so that LLM characters can be informed about wounds under clothing.
//
// Usage: Scope for treat_wounded_part action targeting another actor's wounds.
// Reference: specs/treat-wound-action.md
first-aid:treatable_target_body_parts := target.body_parts[][{"and":[
  {"isBodyPartWounded": ["target", {"var": "entity"}, true]},
  {"!": {"var": "entity.components.anatomy:vital_organ"}}
]}]
```

### Key Differences from `wounded_target_body_parts.scope`
1. No `isBodyPartAccessible` filter - allows covered wounds
2. Comment explains the intentional design difference

## Acceptance Criteria

### Specific Tests That Must Pass
- `npm run scope:lint` must pass with no errors on the new scope file ✅
- Scope syntax must be valid (no parsing errors during mod loading) ✅

### Invariants That Must Remain True
- Existing scope `first-aid:wounded_target_body_parts` continues to filter out covered wounds ✅
- No changes to `isBodyPartWounded` JSON Logic operator behavior ✅
- No changes to `anatomy:vital_organ` component schema or behavior ✅
- Scope DSL parser behavior remains unchanged ✅

## Verification Steps
1. Run `npm run scope:lint` to validate scope syntax ✅ (136 scope files valid)
2. Run `npm run validate:mod:first-aid` (if available) or `npm run validate` to ensure mod structure is valid ✅ (0 violations for first-aid)
3. Visually inspect that the scope file matches the existing scope file patterns in `data/mods/first-aid/scopes/` ✅

## Dependencies
- None (first ticket in sequence)

## Estimated Complexity
Low - single file creation following existing patterns

---

## Outcome

### What Was Actually Changed
1. Created `data/mods/first-aid/scopes/treatable_target_body_parts.scope` with exact content from ticket specification

### Verification Results
- `npm run scope:lint`: ✅ 136 scope files valid
- `npm run validate`: ✅ 0 violations for first-aid mod
- Existing scope `wounded_target_body_parts.scope` remains unchanged with `isBodyPartAccessible` filter

### Discrepancies from Original Plan
**None** - Implementation matched the ticket specification exactly.

### Assumptions Validated
1. ✅ The `isBodyPartWounded` operator exists and accepts the specified parameters
2. ✅ The `target.body_parts[]` syntax is valid for iterating body parts
3. ✅ Scope files are auto-discovered (no manifest modification needed)
4. ✅ The pattern matches existing first-aid scope files

### Completion Date
2025-12-09

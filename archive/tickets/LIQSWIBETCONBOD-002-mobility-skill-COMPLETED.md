# LIQSWIBETCONBOD-002: Mobility Skill Component

**Status**: Completed

## Goal
Introduce a new mobility skill component and register it in the skills mod manifest, following the existing skill component schema.

## File list (expected to touch)
- data/mods/skills/components/mobility_skill.component.json
- data/mods/skills/mod-manifest.json

## Out of scope
- Any liquids action/rule/scope work.
- Any changes to actor or NPC definitions.
- Schema or behavior changes outside the skills mod.

## Acceptance criteria
### Specific tests that must pass
- `npm run validate`
### Testing scope
- Validation is required for this data-only change; no bespoke test suites are expected unless validation exposes a missing invariant.

### Invariants that must remain true
- Skills components retain the same schema shape as existing skill components.
- No existing skills are renamed or removed.

## Outcome
- Added the mobility skill component and registered it in the skills mod manifest.
- Validation completed via `npm run validate`; no additional tests were needed for this data-only change.

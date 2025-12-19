# LIGMOD-002: Lighting actions and conditions

## Summary
Add the ignite/extinguish action definitions and their matching action conditions per the lighting mod spec, using the existing lighting scopes and components.

## Current Assumptions
- `data/mods/lighting/components/` and `data/mods/lighting/scopes/` already exist and match the spec.
- `data/mods/lighting/` does not yet include actions or conditions.
- There is no `data/mods/lighting/mod-manifest.json` yet; wiring and mod registration are out of scope for this ticket.

## File List
- `data/mods/lighting/actions/ignite_light_source.action.json`
- `data/mods/lighting/actions/extinguish_light_source.action.json`
- `data/mods/lighting/conditions/event-is-action-ignite-light-source.condition.json`
- `data/mods/lighting/conditions/event-is-action-extinguish-light-source.condition.json`

## Out of Scope
- Components, scopes, rules, mod manifest, or game.json wiring.
- Documentation updates.
- Any changes outside `data/mods/lighting/`.

## Acceptance Criteria
### Deliverables
- Action and condition files exist under `data/mods/lighting/` and match the lighting spec.

### Tests
- `npm run validate:fast`

### Invariants
- Action visuals use the Warm Lantern Glow palette exactly as specified.
- Actions require `items:inventory` on the actor and reference the correct lighting scopes.
- Action templates remain `ignite {lightSource}` and `extinguish {lightSource}`.
- Conditions match the exact action IDs from the spec.

## Status
Completed

## Outcome
Added the ignite/extinguish action and condition JSON files per the lighting spec; no manifest wiring, rules, or tests were added beyond validation, which aligns with the updated scope.

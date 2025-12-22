# LIQMOD-001: Liquids Mod Manifest and Components

**Status**: Completed
**Priority**: High

## Summary

Create the liquids mod scaffold and its core components: `liquids:liquid_body` and `liquids-states:in_liquid_body` with activity metadata.

## Assumptions

- The `liquids` mod does not yet exist in `data/mods/`.
- No liquids-specific integration tests exist yet; references to them are aspirational and should not be run for this ticket.
- Mod JSON should be validated via the existing mod validator.

## File List

- `data/mods/liquids/mod-manifest.json`
- `data/mods/liquids/components/liquid_body.component.json`
- `data/mods/liquids-states/components/in_liquid_body.component.json`

## Out of Scope

- No scopes, actions, conditions, or rules.
- No changes to dredgers content or location definitions.
- No new tests added in this ticket beyond running the mod validator.
- No color scheme doc updates.

## Acceptance Criteria

### Specific Tests That Must Pass

- `npm run validate:mod -- liquids`

### Invariants That Must Remain True

- Mod manifests continue to satisfy `mod-architecture/no-hardcoded-mod-references`.
- Component JSON uses existing schema patterns (no new schema definitions).
- No changes to existing mods outside `data/mods/liquids/`.

## Outcome

Created the `liquids` mod scaffold with only the manifest and two component schemas, aligned with the limited scope. No actions, scopes, rules, or tests were added beyond running the mod validator.

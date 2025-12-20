# DYNLIGSTA-002 Remove manual light source bookkeeping from rules

## Summary
Update ignite/extinguish lighting rules to only add/remove lighting:is_lit and stop mutating locations:light_sources.

## File list it expects to touch
- data/mods/lighting/rules/handle_ignite_light_source.rule.json
- data/mods/lighting/rules/handle_extinguish_light_source.rule.json

## Out of scope
- Runtime lighting computation in src/
- Mod component definitions or manifests
- Test updates outside lighting rule execution tests

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- tests/integration/mods/lighting/ignite_light_source_rule_execution.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/lighting/extinguish_light_source_rule_execution.test.js --runInBand`

### Invariants that must remain true
- Ignition still adds `lighting:is_lit` to the target entity.
- Extinguish still removes `lighting:is_lit` from the target entity.
- No rule adds, removes, or queries `locations:light_sources`.

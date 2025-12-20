# BREMODSAWTHRBARBLO-006: Add saw through barred blocker rule

Goal: implement rule handling for action outcomes, including progress, tool drop on fumble, and perceptible events.

# File list it expects to touch
- data/mods/breaching/rules/handle_saw_through_barred_blocker.rule.json

# Out of scope
- Changes to action definitions, scopes, conditions, or components.
- Documentation updates or manifest changes.
- Any new operations beyond existing engine support.

# Acceptance criteria
## Specific tests that must pass
- npm run test:integration -- tests/integration/mods/breaching/saw_through_barred_blocker_rule_execution.test.js
- npm run validate:fast

## Invariants that must remain true
- Progress increments use core:progress_tracker with upsert and incrementValue.
- FUMBLE outcome unwields and drops the tool at the actor's location.
- Perceptible events include sight and hearing with hearing_only alternate descriptions.

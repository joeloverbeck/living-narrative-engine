# BREMODSAWTHRBARBLO-003: Add sawing-related scopes - COMPLETED

Goal: add scopes for sawable barred blockers and abrasive sawing tools.

# File list it touched
- data/mods/blockers/scopes/sawable_barred_blockers.scope.json
- data/mods/breaching/scopes/abrasive_sawing_tools.scope.json
- src/scopeDsl/core/entityHelpers.js (Bug fix: flattened components to root level in evaluation context)
- tests/integration/mods/breaching/scopes.test.js (New tests)

# Updated Assumptions & Scope
- The `movement:exits` scope reference was updated to `locations:exits` due to a migration in the component structure.
- Discovered and fixed a bug in `src/scopeDsl/core/entityHelpers.js` where the evaluation context was not correctly flattening entity components to the root level, which is required for JSON Logic queries using shorthand like `{"var": "component_id"}`.

# Acceptance criteria
## Specific tests that passed
- npm run test:integration -- tests/integration/mods/breaching/scopes.test.js
- npm run validate:fast

## Invariants maintained
- The blockers scope only includes barred blockers with structural resistance and no progress or progress value 0.
- The tools scope only includes items with breaching:allows_abrasive_sawing.
- Fixed core engine bug to ensure scope expressions work as intended.

# Outcome
Successfully implemented the requested scopes. The implementation required a minor fix to the `ScopeEngine`'s evaluation context construction to correctly support the JSON Logic shorthand used in the scope expressions. The `sawable_barred_blockers` scope was updated to use `locations:exits` instead of `movement:exits` to align with recent architectural changes.
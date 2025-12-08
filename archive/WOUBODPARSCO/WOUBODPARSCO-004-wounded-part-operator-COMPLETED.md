# Summary
Introduce reusable JSON Logic operators for wound/status presence (e.g., `hasWoundedPart`, `hasPartWithStatusEffect`) to support first-aid action prerequisites beyond scope filters while reusing existing body graph traversal.

Status: Completed

# Reality check (current state)
- Scope DSL already filters wounded/bleeding parts (see `data/mods/first-aid/scopes/*`) and is covered by `tests/e2e/first-aid/woundedBodyParts.e2e.test.js`; the missing piece is a reusable boolean operator for conditions.
- Existing body-part operators (`hasPartWithComponentValue`, `hasPartSubTypeContaining`, etc.) only support equality checks and cannot express `currentHealth < maxHealth` or component presence-only checks.
- BodyGraphService exposes `getAllParts` (cached structurally) plus component lookups, but it lacks wound/status predicates and does not cache component-derived booleans (its query cache only invalidates on structural changes).

# Scope
- Add a `hasWoundedPart(entityPath, options?)` operator extending the body-part operator base that returns true when any part has `anatomy:part_health.currentHealth < maxHealth` or a non-`healthy` `state`. Options can remain optional; defaults cover the numeric/state checks.
- Add `hasPartWithStatusEffect(entityPath, componentId, propertyPath?, predicate?)` to check for component presence or field comparisons (e.g., `anatomy:bleeding` severity). Support equality by default and a small set of comparison predicates (>, >=, <, <=, ===, includes).
- Wire operators into `jsonLogicCustomOperators` registration and allow-list; reuse `BodyGraphService.getAllParts` for traversal but avoid caching component-derived booleans in `AnatomyQueryCache` to prevent stale results after damage/healing.
- Provide unit tests covering healthy vs wounded/bleeding bodies, multiple parts, predicate options, and logging/error guardrails.

# File list (expected to touch)
- src/logic/operators/ (new operator implementations)
- src/logic/jsonLogicCustomOperators.js
- src/logic/operationHandlers/* (if handler mapping needed)
- src/anatomy/bodyGraphService.js (helper methods for wound/status checks)
- tests/unit/logic/operators/hasWoundedPartOperator.test.js
- tests/unit/logic/operators/hasPartWithStatusEffectOperator.test.js (or combined)

# Out of scope
- Changing existing operator semantics or removing deprecated operators.
- Altering scope DSL syntax or evaluation order.
- Implementing UI-level affordances or first-aid actions consuming the new operators (handled elsewhere).

# Acceptance criteria
- New operators register correctly in JSON Logic and return expected booleans for healthy vs wounded/bleeding anatomies (including presence-only checks).
- Unit tests pass via `npm run test:unit -- --runInBand tests/unit/logic/operators/hasWoundedPartOperator.test.js` (and the status effect variant) alongside the existing operator suite.
- BodyGraphService traversal/cache usage remains consistent (structural caching only); no regressions in current operator tests.

# Invariants that must remain true
- Existing operator APIs and results stay unchanged for current consumers.
- Body graph traversal performance is not degraded noticeably (reuse cached all-parts list and avoid extra graph mutations).
- No changes to damage calculation or part health mutation logic.

# Outcome
- Added BodyGraphService predicates for wounded parts and status effects that reuse cached part lists without adding query-cache staleness for component data.
- Registered new JSON Logic operators (`hasWoundedPart`, `hasPartWithStatusEffect`) and allow-listed them for comparison/presence checks on body parts.
- Added unit coverage for the new operators and BodyGraphService predicates; verified with `npm run test:unit -- --runInBand tests/unit/logic/operators/hasWoundedPartOperator.test.js tests/unit/logic/operators/hasPartWithStatusEffectOperator.test.js tests/unit/anatomy/bodyGraphService.test.js tests/unit/logic/jsonLogicCustomOperators.test.js tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js tests/unit/logic/jsonLogicOperatorRegistration.test.js`.

# PLASTAAUT-001: Enforce planning snapshot lookups in has_component operator

## File list
- src/logic/operators/hasComponentOperator.js
- tests/unit/logic/operators/hasComponentOperator.test.js

## Out of scope
- Changes to PlanningStateView internals beyond what is needed to consume its public API responses.
- Altering the JSON Logic operator registry, rule schemas, or adding new operators.
- Modifying integration tests, docs, or telemetry subscribers (they are covered by other tickets).

## Acceptance criteria
### Required tests
- `npm run lint`
- `npm run test:unit -- --runInBand tests/unit/logic/operators/hasComponentOperator.test.js`

### Invariants to preserve
- `HasComponentOperator.evaluate(params, context)` signature and return type remain unchanged.
- When `context.state` is absent (execution/refinement mode), the operator still falls back to `entityManager.hasComponent` as it does today.
- When `context.state` is present, the operator never queries the live `entityManager` for fallback data; it only uses `PlanningStateView.hasComponent` and returns the boolean derived from the snapshot.
- Snapshot alias resolution (`core_needs` vs `core:needs`) continues to work.

## Implementation notes
- Ensure every planning lookup path validates entity/component ids and logs warnings when the context resolves to invalid identifiers, returning `false` without emitting telemetry (per the spec).
- Ensure planning-mode misses propagate `unknown`/`absent` statuses so downstream telemetry can emit `GOAP_EVENTS.STATE_MISS` once PlanningStateView is corrected.
- Extend operator unit tests to cover: (a) planning state miss returns `false` without touching `entityManager`, (b) successful lookups return values from the snapshot, and (c) invalid ids log warnings but do not throw.

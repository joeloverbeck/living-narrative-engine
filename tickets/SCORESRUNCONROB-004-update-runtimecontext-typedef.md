# SCORESRUNCONROB-004 – Update RuntimeContext Typedef

## Problem

The `RuntimeContext` typedef in `src/types/runtimeContext.js` is incomplete. It currently defines only 4 properties:

```javascript
/**
 * @typedef {object} RuntimeContext
 * @property {IEntityManager} entityManager
 * @property {ISpatialIndexManager} spatialIndexManager
 * @property {JsonLogicEval} jsonLogicEval
 * @property {ILogger} logger
 */
```

However, the actual runtime context used by `registerCustomScope()` and scope resolution includes additional properties:
- `location` — Entity at actor's current location (used by `location.*` scope patterns)
- `tracer` — ScopeEvaluationTracer for diagnostics
- `container` — Container entity context (used by container-related scopes)

This typedef gap causes confusion and prevents proper type checking.

## Proposed scope

Update the `RuntimeContext` typedef to include all properties actually used by the scope resolution system:
- Add `location` as optional property (entity or null)
- Add `tracer` as optional property
- Add `container` as optional property
- Document which properties are required vs optional
- Add JSDoc descriptions for each property

## File list

- `src/types/runtimeContext.js` (MODIFY — lines 1-17)

## Out of scope

- Any JavaScript implementation files — no runtime changes
- Any test files — no modifications
- `tests/common/mods/ModTestFixture.js` — no changes
- `src/scopeDsl/` directory — no runtime behavior changes
- Creating new type definition files

## Acceptance criteria

### Tests

```bash
npm run typecheck
```

Must pass with no new errors.

### Invariants

1. Existing code using `RuntimeContext` typedef continues to work unchanged
2. No runtime behavior changes (typedef-only modification)
3. JSDoc comments follow existing project patterns (see other files in `src/types/`)
4. Optional properties use JSDoc bracket syntax: `[property]`

### Target typedef

```javascript
/**
 * @typedef {object} RuntimeContext
 * @property {IEntityManager} entityManager - Required for entity lookups
 * @property {ISpatialIndexManager} spatialIndexManager - Required for spatial queries
 * @property {JsonLogicEval} jsonLogicEval - Required for filter evaluation
 * @property {ILogger} logger - Required for diagnostic logging
 * @property {object|null} [location] - Entity at actor's current location (optional)
 * @property {object} [tracer] - ScopeEvaluationTracer for diagnostics (optional)
 * @property {object|null} [container] - Container entity context (optional)
 */
```

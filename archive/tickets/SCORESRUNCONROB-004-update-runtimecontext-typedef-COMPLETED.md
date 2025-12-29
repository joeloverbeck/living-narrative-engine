# SCORESRUNCONROB-004 – Update RuntimeContext Typedef

**Status**: ✅ COMPLETED

## Problem

The `RuntimeContext` typedef in `src/types/runtimeContext.js` is incomplete and too strict for how runtime contexts are actually constructed. It currently defines only 4 properties:

```javascript
/**
 * @typedef {object} RuntimeContext
 * @property {IEntityManager} entityManager
 * @property {ISpatialIndexManager} spatialIndexManager
 * @property {JsonLogicEval} jsonLogicEval
 * @property {ILogger} logger
 */
```

However, the runtime contexts used by `registerCustomScope()`, `ScopeEngine`, and `UnifiedScopeResolver` include additional properties that are relied on by scope resolution:
- `location` — Current location entity or location id (used by `location.*` scope patterns)
- `tracer` — Scope evaluation tracer with `isEnabled()` / `logStep()` / `logFilterEvaluation()` hooks
- `container` — DI container for optional service resolution (clothing/body graph resolvers)
- `componentRegistry` — Registry used by `ScopeEngine` to resolve component definitions
- `target` / `targets` — Target context used by `target`/`targets` sources
- `scopeEntityLookupDebug` / `scopeEntityLookupStrategy` — Optional debug/lookup strategy hooks for entity resolution

Additionally, some runtime contexts omit `spatialIndexManager`, `jsonLogicEval`, or `logger` (they are validated as optional in `ParameterValidator`), so the typedef should mark them as optional and document when they are required.

This typedef gap causes confusion and prevents proper type checking.

## Proposed scope

Update the `RuntimeContext` typedef to include all properties used by the scope resolution system:
- Add optional properties: `location`, `tracer`, `container`, `componentRegistry`, `target`, `targets`, `scopeEntityLookupDebug`, `scopeEntityLookupStrategy`
- Mark `spatialIndexManager`, `jsonLogicEval`, and `logger` as optional, with notes on when they are required
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
 * @property {ISpatialIndexManager} [spatialIndexManager] - Spatial queries when available (required by some planners/resolvers)
 * @property {JsonLogicEval} [jsonLogicEval] - Required when filter evaluation is used
 * @property {ILogger} [logger] - Used for diagnostics when provided
 * @property {object|string|null} [location] - Current location entity or ID for location.* scopes
 * @property {object} [tracer] - Scope evaluation tracer for diagnostics
 * @property {object} [container] - DI container for service resolution
 * @property {object} [componentRegistry] - Component registry with getDefinition()
 * @property {object} [target] - Target entity/context for target sources
 * @property {object} [targets] - Multi-target context for targets.* scopes
 * @property {object} [scopeEntityLookupDebug] - Debug config for entity lookup strategy
 * @property {object} [scopeEntityLookupStrategy] - Custom entity lookup strategy
 */
```

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned**: Extend `RuntimeContext` typedef with optional scope-resolution properties and clarify required vs optional services.

**Actual**: Updated `RuntimeContext` typedef with optional `location`, `tracer`, `container`, `componentRegistry`, `target`, `targets`, `scopeEntityLookupDebug`, and `scopeEntityLookupStrategy`; marked `spatialIndexManager`, `jsonLogicEval`, and `logger` optional with updated descriptions.

# Scope Resolution Runtime Context Robustness Specification

**Status**: ✅ COMPLETED

**Reference**: Fix applied to `tests/common/mods/ModTestFixture.js` for `registerCustomScope()` method.

> This spec documents requirements for making the scope resolution system more robust to prevent the class of failures encountered with dimensional travel action discovery tests.

---

## Context

### Location in Codebase

The scope resolution system spans multiple layers:

| File | Responsibility |
|------|----------------|
| `tests/common/mods/ModTestFixture.js` | Test fixture that creates custom scope resolvers via `registerCustomScope()` |
| `src/scopeDsl/engine.js` | Core scope DSL engine that evaluates parsed scope expressions |
| `src/scopeDsl/nodes/sourceResolver.js` | Resolves source kinds (`actor`, `location`, `target`, etc.) |
| `src/scopeDsl/core/parameterValidator.js` | Validates actor entities before scope resolution |
| `src/types/runtimeContext.js` | TypeScript-style typedef for `RuntimeContext` (currently incomplete) |

### What the Module Does

The scope resolution system:
1. Parses scope DSL expressions (e.g., `location.locations:exits[{filter}].target`)
2. Resolves source kinds to entity sets (actor, location, target, container)
3. Traverses component fields via step resolution
4. Applies JSON Logic filters to narrow results
5. Returns a `Set<string>` of matching entity IDs

**Critical dependency**: The `runtimeCtx` object passed to `ScopeEngine.resolve()` must contain all properties required by the scope expression being evaluated.

---

## Problem

### What Failed

Two integration tests for dimensional travel action discovery failed:
- `tests/integration/mods/dimensional-travel/travel_through_dimensions_action_discovery.test.js`
- `tests/integration/mods/dimensional-travel/diagnostic_dimensional_travel.test.js`

### How It Failed

The `discoverActions()` method returned an empty array when it should have found `dimensional-travel:travel_through_dimensions`. Debug output revealed:

```
Direct resolver result: {
  success: false,
  error: 'ScopeResolutionError: Invalid parameter passed to scope resolver.
          actorEntity must have an \'id\' property'
}
```

### Why It Failed

**Root Cause 1: Validation Order Bug**

The `registerCustomScope()` method in `ModTestFixture.js` validated the raw `context` parameter before extracting `actorEntity`:

```javascript
// WRONG ORDER (before fix)
ParameterValidator.validateActorEntity(context, 'CustomScopeResolver...');
const actorEntity = context.actorEntity || context.actor || context;
```

The context can arrive in three formats:
1. Direct entity: `{ id: "actor-123", components: {...} }`
2. Enriched context: `{ actorEntity: {...}, otherData: ... }`
3. Actor pipeline context: `{ actor: {...}, targets: {...} }`

Validating before extraction failed when context was in wrapper format.

**Root Cause 2: Missing Location Property**

The `runtimeCtx` passed to `ScopeEngine` lacked the `location` property. Scopes using `location.*` DSL patterns (e.g., `location.locations:exits[...]`) silently returned empty sets because:

1. `ScopeEngine._createLocationProvider()` returns `{ getLocation: () => runtimeCtx?.location }`
2. `sourceResolver.js` line 118-128 handles `case 'location'`
3. If `locationProvider.getLocation()` returns `null/undefined`, resolver returns empty Set
4. Empty Set propagates through step/filter resolvers
5. Final result: no targets discovered

---

## Truth Sources

### Documentation
- `docs/testing/mod-testing-guide.md` - ModTestFixture usage patterns
- `CLAUDE.md` - Scope DSL syntax documentation (operators: `.`, `[]`, `[{...}]`, `+`, `|`)
- `docs/testing/scope-resolver-registry.md` - Available scope resolvers

### Domain Rules
- Scope DSL sources: `actor`, `location`, `target`, `container`, `self`, `none`
- Each source requires corresponding property in `runtimeCtx`
- Empty source resolution is valid (returns empty Set, not error)

### External Contracts
- `src/types/runtimeContext.js` defines the typedef (incomplete, missing `location`, `container`, `tracer`)
- `ParameterValidator.validateActorEntity()` expects object with string `id` property

---

## Desired Behavior

### Normal Cases

1. **Context Normalization**: Before any validation, extract the actor entity from potentially wrapped context:
   ```javascript
   const actorEntity = context.actorEntity || context.actor || context;
   ```

2. **Location Resolution**: For scopes using `location.*` patterns, resolve the actor's current location:
   ```javascript
   const positionData = entityManager.getComponentData(actorEntity.id, 'core:position');
   const locationEntity = positionData?.locationId
     ? entityManager.getEntityInstance(positionData.locationId)
     : null;
   ```

3. **RuntimeContext Construction**: Include all potentially required properties:
   ```javascript
   const runtimeCtx = {
     entityManager,
     jsonLogicEval,
     logger,
     location: locationEntity,  // For location.* scopes
     tracer: scopeTracer,       // For diagnostics
   };
   ```

4. **Validation After Extraction**: Validate the normalized entity, not the raw context:
   ```javascript
   ParameterValidator.validateActorEntity(actorEntity, 'CustomScopeResolver...');
   ```

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Actor has no `core:position` component | `location` is `null`, location-based scopes return empty Set |
| Actor's locationId references non-existent entity | `location` is `null`, scopes return empty Set |
| Context is already a direct entity object | Normalization returns it unchanged |
| Scope uses `self` or `none` source | No runtime properties required |
| Scope uses `target` source | Requires `runtimeCtx.target` (or enriched context with targets) |

### Failure Modes

| Condition | Error/Behavior |
|-----------|----------------|
| Extracted `actorEntity` has no `id` | Throw descriptive error: "actorEntity must have an 'id' property" |
| Extracted `actorEntity.id` is not a string | Throw descriptive error: "actorEntity.id must be a non-empty string" |
| `entityManager` is missing | Throw: "runtimeCtx.entityManager is required" |
| `jsonLogicEval` is missing (when filters used) | Throw from FilterResolver: "jsonLogicEval required for filter evaluation" |
| Location scope with missing location | Return empty Set (not an error) |

### Invariants

Properties that must always hold:

1. **Extraction Before Validation**: Context normalization MUST occur before `ParameterValidator.validateActorEntity()` is called
2. **Location Property Contract**: `runtimeCtx.location` MUST be either:
   - A valid entity object with `id` property, OR
   - `null` (never `undefined` for location-dependent scopes)
3. **Empty Set Semantics**: Missing source data results in empty Set propagation, not errors
4. **Graceful Degradation**: Location resolution failures don't throw; they set `location = null`
5. **Three Context Formats**: The system MUST accept all three context formats without modification to callers

### API Contracts (What Stays Stable)

1. **`ModTestFixture.registerCustomScope(modId, scopeName)`**: Signature unchanged
2. **`ScopeEngine.resolve(ast, actorEntity, runtimeCtx)`**: Signature unchanged
3. **Context format support**: All three formats remain valid inputs
4. **Empty Set return**: Scopes may return empty Sets for valid but unmatched queries
5. **`ParameterValidator` interface**: `validateActorEntity(entity, context)` unchanged

### What Is Allowed to Change

1. **RuntimeContext typedef**: Can be extended with `location`, `container`, `tracer` properties
2. **Validation ordering**: Internal implementation can change as long as contract holds
3. **Location resolution strategy**: Can use different component or pattern for obtaining location
4. **Error message text**: Wording can improve while maintaining descriptiveness
5. **Internal helper methods**: Can be refactored, extracted, or consolidated

---

## Testing Plan

### Existing Tests to Verify (Must Remain Green)

- `tests/integration/mods/dimensional-travel/travel_through_dimensions_action_discovery.test.js`
- `tests/integration/mods/dimensional-travel/diagnostic_dimensional_travel.test.js`
- `tests/unit/scopeDsl/core/parameterValidator.test.js`
- `tests/unit/scopeDsl/engine.test.js`
- `tests/unit/scopeDsl/nodes/sourceResolver.test.js`

### Tests to Add

#### 1. Context Format Normalization Tests
**File**: `tests/unit/common/mods/ModTestFixture.contextNormalization.test.js`

```javascript
describe('registerCustomScope context normalization', () => {
  it('should accept direct entity format { id, components }');
  it('should accept enriched context { actorEntity: {...} }');
  it('should accept actor pipeline context { actor: {...} }');
  it('should fail validation when no id extractable from any format');
  it('should preserve original entity reference after normalization');
});
```

#### 2. Location Resolution Tests
**File**: `tests/unit/common/mods/ModTestFixture.locationResolution.test.js`

```javascript
describe('registerCustomScope location resolution', () => {
  it('should resolve location from actor core:position component');
  it('should set location to null when actor has no position');
  it('should set location to null when locationId references missing entity');
  it('should pass location entity to runtimeCtx for scope evaluation');
});
```

#### 3. Location-Dependent Scope Integration Tests
**File**: `tests/integration/scopeDsl/locationDependentScopes.test.js`

```javascript
describe('scopes starting with location.*', () => {
  it('should return matching entities when location is provided');
  it('should return empty Set when location is null');
  it('should not throw when location property is missing');
  it('should correctly chain location.component[filter].field');
});
```

#### 4. Property Tests for Invariants
**File**: `tests/unit/scopeDsl/core/runtimeContextInvariants.property.test.js`

```javascript
describe('RuntimeContext invariants', () => {
  it('location must be entity with id or null, never undefined');
  it('entityManager must always be present for scope resolution');
  it('extraction must normalize all three context formats identically');
});
```

### Regression Test Checklist

| Test Category | What to Verify |
|---------------|----------------|
| Action Discovery | Actions with `location.*` scopes are discovered correctly |
| Scope Tracing | Trace output shows location resolution steps |
| Error Messages | Validation errors clearly indicate extraction vs validation failure |
| Empty Results | Empty sets from missing location don't cause downstream errors |
| Multi-mod Scopes | Custom scopes from different mods with location patterns work |

### Coverage Targets

- `tests/common/mods/ModTestFixture.js`: 90%+ for `registerCustomScope()` method
- `src/scopeDsl/nodes/sourceResolver.js`: 95%+ for `location` case handling
- `src/scopeDsl/core/parameterValidator.js`: 100% for `validateActorEntity()`

---

## Implementation Priority

### Phase 1: Immediate (Already Done in Fix)
- [x] Fix extraction order in `ModTestFixture.registerCustomScope()`
- [x] Add location resolution to build `runtimeCtx.location`
- [x] Verify existing dimensional travel tests pass

### Phase 2: Hardening (This Spec)
- [x] Add context format normalization unit tests
- [x] Add location resolution unit tests
- [x] Add location-dependent scope integration tests
- [x] Update `src/types/runtimeContext.js` typedef with missing properties

### Phase 3: Documentation
- [x] Update `docs/testing/mod-testing-guide.md` with location scope requirements
- [x] Add examples of location-dependent scopes to documentation
- [x] Document the three context format variants accepted by scope resolvers

---

## Appendix: Code References

### Fix Location
`tests/common/mods/ModTestFixture.js` lines ~2900-2980

### Key Methods

```javascript
// Context extraction (line ~2905)
const actorEntity = context.actorEntity || context.actor || context;

// Location resolution (lines ~2910-2920)
let locationEntity = null;
if (actorEntity?.id) {
  const positionData = testEnv.entityManager.getComponentData(
    actorEntity.id,
    'core:position'
  );
  if (positionData?.locationId) {
    locationEntity = testEnv.entityManager.getEntityInstance(
      positionData.locationId
    );
  }
}

// RuntimeContext with location (line ~2939)
const runtimeCtx = {
  get entityManager() { return testEnv.entityManager; },
  get jsonLogicEval() { return testEnv.jsonLogic; },
  get logger() { return testEnv.logger; },
  get tracer() { return scopeTracer; },
  location: locationEntity,  // Critical for location.* scopes
};
```

### SourceResolver Location Handling
`src/scopeDsl/nodes/sourceResolver.js` lines 118-129:

```javascript
case 'location': {
  const location = locationProvider.getLocation();
  if (location) {
    if (typeof location === 'string') {
      result = new Set([location]);
    } else if (location.id) {
      result = new Set([location.id]);
    }
  }
  break;
}
```

---

## Completion Summary

All phases of this specification have been implemented:

- **Phase 1**: Core fix applied to `ModTestFixture.registerCustomScope()`
- **Phase 2**: Tests added in `tests/unit/common/mods/` and `tests/integration/scopeDsl/`
- **Phase 3**: Documentation added to `docs/testing/mod-testing-guide.md`

Related tickets completed:
- SCORESRUNCONROB-001 through SCORESRUNCONROB-006 (all archived)

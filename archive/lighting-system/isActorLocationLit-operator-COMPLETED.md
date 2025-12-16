# Specification: isActorLocationLit Operator

## Overview

Add a new JSON Logic operator `isActorLocationLit` that checks if the actor's current location has sufficient lighting, and integrate it as a prerequisite for the `movement:go` action.

**Rationale**: An actor shouldn't be able to use the `go` action to navigate between locations when their current location is in total darkness.

## Requirements

1. Create `isActorLocationLit` operator that checks if the actor's location is lit
2. Reuse existing `LightingStateService.isLocationLit()` method
3. Add prerequisite to `go.action.json` using the new operator
4. Create comprehensive unit and integration tests

## Implementation Plan

### Step 1: Create the Operator Class

**File**: `src/logic/operators/isActorLocationLitOperator.js`

**Pattern**: Follow `HasOtherActorsAtLocationOperator` pattern (standalone class, no base class)

**Dependencies**:
- `entityManager` - to get actor's `core:position` component
- `lightingStateService` - to check `isLocationLit(locationId)`
- `logger` - for debug/error logging

**Logic**:
1. Resolve entity from path (e.g., "actor")
2. Get `core:position` component from entity
3. Extract `locationId` from position
4. Call `lightingStateService.isLocationLit(locationId)`
5. Return the boolean result

**Edge Cases** (User confirmed "fail open" behavior):
- No position component → return `true` (fail open, don't block movement)
- No locationId → return `true` (fail open)
- Invalid entity path → return `false`
- Error during evaluation → return `false` (graceful degradation)

### Step 2: Update JsonLogicCustomOperators

**File**: `src/logic/jsonLogicCustomOperators.js`

**Changes**:
1. Add import for `IsActorLocationLitOperator`
2. Add `lightingStateService` as constructor dependency
3. Add private field `#lightingStateService`
4. Update constructor validation
5. Create operator instance in `registerOperators()`
6. Register operator with wrapper function

### Step 3: Update DI Registration

**File**: `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`

**Change** (line ~408-413):
```javascript
registrar.singletonFactory(tokens.JsonLogicCustomOperators, (c) => {
  return new JsonLogicCustomOperators({
    logger: c.resolve(tokens.ILogger),
    bodyGraphService: c.resolve(tokens.BodyGraphService),
    entityManager: c.resolve(tokens.IEntityManager),
    lightingStateService: c.resolve(tokens.ILightingStateService), // ADD
  });
});
```

### Step 4: Update go.action.json

**File**: `data/mods/movement/actions/go.action.json`

**Add prerequisite** to the `prerequisites` array:
```json
{
  "logic": {
    "isActorLocationLit": ["actor"]
  },
  "failure_message": "It is too dark to see where you are going."
}
```

### Step 5: Create Unit Tests

**File**: `tests/unit/logic/operators/isActorLocationLitOperator.test.js`

**Test Scenarios**:

| Scenario | Expected |
|----------|----------|
| Location is lit | `true` |
| Location is dark | `false` |
| Actor has no position component | `true` (fail open) |
| Position has no locationId | `true` (fail open) |
| Invalid entity path | `false` |
| Null parameters | `false` |
| Empty array parameters | `false` |
| Error during evaluation | `false` (graceful) |

### Step 6: Create Integration Tests

**File**: `tests/integration/mods/movement/go_action_lighting.test.js`

**Test Scenarios**:

1. **go action is available when location is lit**
   - Actor in naturally lit location
   - Actor in naturally dark location with active light sources

2. **go action is NOT available when location is dark**
   - Actor in naturally dark location with no light sources

3. **Prerequisite failure message is correct**
   - Verify the failure message contains "dark"

## Files to Create

| File | Description |
|------|-------------|
| `src/logic/operators/isActorLocationLitOperator.js` | New operator class |
| `tests/unit/logic/operators/isActorLocationLitOperator.test.js` | Unit tests |
| `tests/integration/mods/movement/go_action_lighting.test.js` | Integration tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/logic/jsonLogicCustomOperators.js` | Add import, constructor dependency, registration |
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` | Add lightingStateService to DI |
| `data/mods/movement/actions/go.action.json` | Add lighting prerequisite |

## Validation Commands

```bash
# After implementation:
npx eslint src/logic/operators/isActorLocationLitOperator.js
npm run typecheck
npm run test:unit -- tests/unit/logic/operators/isActorLocationLitOperator.test.js
npm run test:integration -- tests/integration/mods/movement/go_action_lighting.test.js
```

## Key References

- **Existing operator to follow**: `src/logic/operators/hasOtherActorsAtLocationOperator.js`
- **Lighting service**: `src/locations/services/lightingStateService.js` (method: `isLocationLit`)
- **DI token for lighting**: `tokens.ILightingStateService`
- **go action**: `data/mods/movement/actions/go.action.json`
- **Lighting components**:
  - `locations:naturally_dark` - marker for naturally dark locations
  - `locations:light_sources` - array of active light source entity IDs

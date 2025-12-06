# APPLY_DAMAGE Handler Robustness Specification

## Context

### Where in the Codebase

| File                                                            | Purpose                                   |
| --------------------------------------------------------------- | ----------------------------------------- |
| `src/logic/operationHandlers/applyDamageHandler.js`             | Main operation handler for APPLY_DAMAGE   |
| `src/anatomy/services/damageAccumulator.js`                     | Session-based damage entry accumulation   |
| `src/anatomy/services/damageNarrativeComposer.js`               | Composes damage narratives for UI display |
| `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` | Unit tests (70 tests)                     |

### What the Module Does

The `ApplyDamageHandler` processes `APPLY_DAMAGE` operations from rules, which:

1. Applies damage to entity body parts (via `anatomy:part_health` component)
2. Triggers damage propagation to connected parts
3. Accumulates damage entries in a session for narrative composition
4. Dispatches `core:perceptible_event` with `perceptionType: 'damage_received'` for UI rendering
5. Integrates with `DeathCheckService` for mortality conditions

---

## Problem

### What Failed

Two sequential failures prevented damage messages from appearing in the UI:

**Failure 1: actorId was null**

```
APPLY_DAMAGE: Cannot dispatch perceptible event - no location found for target fantasy:copper_backed_rooster_instance or actor null
```

**Failure 2: Location component mismatch**

```
APPLY_DAMAGE: Cannot dispatch perceptible event - no location found for target fantasy:copper_backed_rooster_instance or actor fantasy:aldous_instance
```

### How It Failed

1. **actorId Extraction** (Lines 710, 732-733):
   - Handler accessed `executionContext?.actorId`
   - But `contextAssembler.js` structures context as `{ actor: { id, components } }`
   - The `actorId` was never a top-level property

2. **Component ID Mismatch** (Line 179):
   - `#getEntityLocation()` queried `'core:location'` component
   - All entities use `'core:position'` component for location data

### Why It Failed

1. **Inconsistent context structure understanding**: The execution context structure was assumed but not verified against `contextAssembler.js`
2. **Hardcoded component ID**: The component ID was written as a string literal instead of using the centralized constant from `src/constants/componentIds.js`
3. **No compile-time or test-time validation**: Mocks in tests used same incorrect assumptions

### Link to Tests

- `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`:
  - Line 2481-2549: Test "uses actor location as fallback when target has no location (actor in nested structure)"
  - Line 2372, 2511, 2513: Mock implementations using `'core:position'`

---

## Truth Sources

### Documentation

| Source                 | Location                                            | Content                                   |
| ---------------------- | --------------------------------------------------- | ----------------------------------------- |
| Component ID Constants | `src/constants/componentIds.js`                     | `POSITION_COMPONENT_ID = 'core:position'` |
| Context Assembly       | `src/logic/contextAssembler.js:249-301`             | Execution context structure definition    |
| Position Schema        | `data/mods/core/components/position.component.json` | `locationId` field structure              |

### Domain Rules

1. **Position Component**: All entities with spatial presence use `core:position` with `{ locationId: string }`
2. **Execution Context**: Actor information is nested at `executionContext.actor.id`, not `executionContext.actorId`
3. **Perceptible Events**: Require valid `locationId` for broadcast to nearby entities

### External Contracts

| Contract                 | Parties                           | Requirements                                                                  |
| ------------------------ | --------------------------------- | ----------------------------------------------------------------------------- |
| `core:perceptible_event` | Handler → EventBus → UI Renderers | Must include `locationId`, `perceptionType`, `descriptionText`                |
| EntityManager API        | Handler → EntityManager           | `getComponentData(entityId, componentId)` returns component data or undefined |

---

## Desired Behavior

### Normal Cases

| Scenario                       | Input                                      | Expected Output                                     |
| ------------------------------ | ------------------------------------------ | --------------------------------------------------- |
| Damage with target location    | Target has `core:position`                 | Event dispatched to target's location               |
| Damage without target location | Target lacks `core:position`, actor has it | Event dispatched to actor's location (with warning) |
| actorId in nested structure    | `executionContext.actor.id` set            | Actor ID correctly extracted                        |
| actorId at top level (legacy)  | `executionContext.actorId` set             | Actor ID correctly extracted                        |

### Edge Cases

| Edge Case                             | Handling                                                       |
| ------------------------------------- | -------------------------------------------------------------- |
| Neither target nor actor has location | Dispatch error via `safeDispatchError`, skip perceptible event |
| Target has location, actor doesn't    | Use target's location (normal path)                            |
| Both actor.id and actorId present     | Prefer `actor.id` (newer structure)                            |
| Empty locationId string               | Treat as missing (null check)                                  |
| executionContext is undefined         | Safe optional chaining, return null for actorId                |

### Failure Modes

| Failure                             | Error Raised                     | Return Value           |
| ----------------------------------- | -------------------------------- | ---------------------- |
| Missing location for event dispatch | `safeDispatchError` with context | Continue without event |
| Invalid entity reference            | Log warning                      | null entity ID         |
| Component data lookup fails         | Caught exception                 | null location          |
| Session creation fails              | Error dispatched                 | Early return           |

---

## Invariants

Properties that must **always** hold:

1. **Component ID Consistency**: `#getEntityLocation()` MUST use `'core:position'` (or imported `POSITION_COMPONENT_ID`)
2. **actorId Extraction Order**: Check `executionContext?.actor?.id` BEFORE `executionContext?.actorId`
3. **Null Safety**: All nested property access MUST use optional chaining (`?.`)
4. **Location Fallback Chain**: Target location → Actor location → Error (in that order)
5. **Error Dispatch**: All unrecoverable errors MUST use `safeDispatchError` utility

---

## API Contracts

### What Stays Stable

| API Element                                                   | Stability Guarantee |
| ------------------------------------------------------------- | ------------------- |
| `execute(params, executionContext)` signature                 | Stable              |
| `params.entity_ref`, `params.part_ref`, `params.damage_entry` | Stable              |
| `core:perceptible_event` payload structure                    | Stable              |
| `perceptionType: 'damage_received'`                           | Stable              |

### Internal Contracts

| Method                                             | Contract                                                    |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `#getEntityLocation(entityId)`                     | Returns `string \| null`, never throws                      |
| `#resolveLocationForEvent(targetId, actorId, log)` | Returns `string \| null`, logs warnings on fallback         |
| `#resolveEntityRef(ref, context, logger)`          | Returns `string \| null`, supports keywords/objects/strings |

---

## What is Allowed to Change

| Area                       | Allowed Changes                                     |
| -------------------------- | --------------------------------------------------- |
| Component ID source        | May change from local constant to imported constant |
| actorId extraction         | May add additional fallback paths                   |
| Error messages             | May be enhanced with more context                   |
| Internal method signatures | May change if tests are updated                     |
| Logging verbosity          | May increase for debugging                          |

### NOT Allowed to Change (Breaking)

- `execute()` public method signature
- Event payload structure for `core:perceptible_event`
- Component ID string value (`'core:position'`)

---

## Testing Plan

### Tests That Must Be Updated/Added

| Test                                 | File                                        | Status     |
| ------------------------------------ | ------------------------------------------- | ---------- |
| Actor fallback with nested structure | `applyDamageHandler.test.js:2481`           | ✅ Added   |
| Mock using `core:position`           | `applyDamageHandler.test.js:2372,2511,2513` | ✅ Updated |

### Regression Tests Required

| Test                           | Purpose                            |
| ------------------------------ | ---------------------------------- |
| `actorId from actor.id`        | Verify nested extraction works     |
| `actorId from legacy property` | Verify backward compatibility      |
| `location from core:position`  | Verify correct component access    |
| `location fallback chain`      | Verify target → actor → error flow |

### Property Tests to Add

```javascript
// Property: actorId extraction should handle all valid context structures
test.each([
  { actor: { id: 'actor-1' } }, // Modern structure
  { actorId: 'actor-2' }, // Legacy structure
  { actor: { id: 'actor-3' }, actorId: 'ignored' }, // Both (prefer actor.id)
  {}, // Neither (returns null)
])('extracts actorId from %j', (contextPart) => {
  const actorId = extractActorId(contextPart);
  // Assert expected behavior
});

// Property: location resolution never throws
test('location resolution is exception-safe', () => {
  // Even with invalid entityId, should return null not throw
});

// Property: component ID matches truth source
test('uses correct position component ID', () => {
  expect(POSITION_COMPONENT_ID).toBe('core:position');
});
```

### Integration Tests

| Test                     | Scenario                                    |
| ------------------------ | ------------------------------------------- |
| Full damage flow with UI | Damage → Event → DamageEventMessageRenderer |
| Location-less entities   | Both actor and target without position      |
| Cross-location damage    | Actor in different location than target     |

---

## Implementation Recommendations

### Immediate Improvements (Low Risk)

1. **Import constant** instead of hardcoding:

   ```javascript
   import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';
   ```

2. **Consolidate actorId extraction** to single helper:
   ```javascript
   #extractActorId(executionContext) {
     return executionContext?.actor?.id || executionContext?.actorId || null;
   }
   ```

### Future Improvements (Medium Risk)

1. **Extract location resolution utility** to `src/utils/locationUtils.js`:
   - Reusable across handlers
   - Consistent fallback behavior
   - Centralized error handling

2. **Add schema validation** for execution context structure:
   - Catch structural issues at development time
   - Document expected context shape

### Documentation Needed

1. Update `CLAUDE.md` with execution context structure
2. Add JSDoc to `contextAssembler.js` explaining structure
3. Document component ID constant usage in operation handler guide

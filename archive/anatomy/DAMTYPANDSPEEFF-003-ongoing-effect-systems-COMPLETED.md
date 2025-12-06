# DAMTYPANDSPEEFF-003: Build bleeding/burning/poison tick systems

**Status**: Completed
**Priority**: Medium
**Estimated Effort**: 2 days
**Dependencies**: DAMTYPANDSPEEFF-001, DAMTYPANDSPEEFF-002
**Blocks**: DAMTYPANDSPEEFF-004, DAMTYPANDSPEEFF-005

## Problem / Objective

Implement turn-based systems that process ongoing effects produced by damage types: bleeding, burning (with stacking), and poison (part or entity scope). Ensure component lifecycles, tick damage, and event emissions match the specification.

## Scope

- Create `src/anatomy/services/bleedingTickSystem.js`, `burningTickSystem.js`, and `poisonTickSystem.js` with turn-based tick processing and component removal.
- Respect stacking rules for burning (`canStack` vs refresh-only) and ensure tickDamage/stackedCount accumulate per spec.
- Handle component removal when durations expire or the part/entity is destroyed; emit started/stopped events.
- Ensure systems integrate via event subscription (subscribe to `core:turn_ended`) without altering unrelated systems.
- Register systems via dependency injection in `worldAndEntityRegistrations.js`.

**Note**: This project uses JavaScript (.js), not TypeScript (.ts). All file paths updated accordingly.

## File list

- `src/anatomy/services/bleedingTickSystem.js`
- `src/anatomy/services/burningTickSystem.js`
- `src/anatomy/services/poisonTickSystem.js`
- `src/dependencyInjection/tokens/tokens-core.js` (add tokens)
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` (register factories)
- `src/anatomy/services/damageTypeEffectsService.js` (add stopped event constants)
- `tests/unit/anatomy/services/bleedingTickSystem.test.js`
- `tests/unit/anatomy/services/burningTickSystem.test.js`
- `tests/unit/anatomy/services/poisonTickSystem.test.js`

## Out of scope

- Immediate application of effects (handled in DAMTYPANDSPEEFF-002).
- Action lockout or stun handling beyond emitting/clearing the stunned component.
- Performance benchmarking; only basic correctness-focused loops.
- UI or narrative hooks that consume the events.

## Acceptance criteria

### Tests that must pass

- `npm run test:unit -- tests/unit/anatomy/services/bleedingTickSystem.test.js`
- `npm run test:unit -- tests/unit/anatomy/services/burningTickSystem.test.js`
- `npm run test:unit -- tests/unit/anatomy/services/poisonTickSystem.test.js`
- Lint scoped to new/modified system and test files.

### Invariants that must remain true

- Tick systems stop emitting damage/events once a part is destroyed or duration reaches zero.
- Burning stacking follows spec: `canStack=false` only refreshes duration; `canStack=true` increments stackedCount and tickDamage deterministically.
- Poison targets part vs entity strictly by scope; durations refresh on reapplication.
- No duplicate events on the same tick for a single component expiration.

## Outcome

**Completed successfully** on 2025-12-02.

### Implementation Summary

Created three turn-based tick systems that process ongoing damage effects:

1. **BleedingTickSystem** (`src/anatomy/services/bleedingTickSystem.js`)
   - Subscribes to `TURN_ENDED_ID` events
   - Processes all entities with `anatomy:bleeding` component
   - Applies tick damage, decrements duration
   - Removes bleeding and emits `BLEEDING_STOPPED_EVENT` when duration expires or part is destroyed

2. **BurningTickSystem** (`src/anatomy/services/burningTickSystem.js`)
   - Same event subscription pattern
   - Processes `anatomy:burning` components with stacking support
   - Tracks `stackedCount` through lifecycle, includes in stopped event

3. **PoisonTickSystem** (`src/anatomy/services/poisonTickSystem.js`)
   - Handles dual scope (part vs entity) via health component detection
   - Uses `anatomy:part_health` for parts, `core:health` for entities
   - Emits scope-appropriate stopped events with `partId` or `entityId`

### DI Integration

- Added tokens: `BleedingTickSystem`, `BurningTickSystem`, `PoisonTickSystem` to `tokens-core.js`
- Registered singleton factories in `worldAndEntityRegistrations.js`
- Systems receive: `logger`, `entityManager`, `safeEventDispatcher`, `validatedEventDispatcher`

### Stopped Event Constants

Added to `damageTypeEffectsService.js`:

- `BLEEDING_STOPPED_EVENT = 'anatomy:bleeding_stopped'`
- `BURNING_STOPPED_EVENT = 'anatomy:burning_stopped'`
- `POISONED_STOPPED_EVENT = 'anatomy:poisoned_stopped'`

### Tests Created

| Test File                    | Tests | Coverage                                                     |
| ---------------------------- | ----- | ------------------------------------------------------------ |
| `bleedingTickSystem.test.js` | 16    | Constructor validation, tick processing, expiration, cleanup |
| `burningTickSystem.test.js`  | 18    | Same as bleeding + stacking behavior                         |
| `poisonTickSystem.test.js`   | 21    | Same + dual scope (part/entity) handling                     |

**Total**: 58 tests, all passing.

### Architectural Decisions

- Extended `BaseService` for consistent dependency validation via `_init()`
- Used private fields (`#logger`, `#entityManager`, etc.) for encapsulation
- Stored unsubscribe functions in array for clean `destroy()` implementation
- Health clamped to minimum 0 to prevent negative values

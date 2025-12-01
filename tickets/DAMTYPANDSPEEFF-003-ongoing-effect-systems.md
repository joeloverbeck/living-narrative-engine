# DAMTYPANDSPEEFF-003: Build bleeding/burning/poison tick systems

**Status**: Ready
**Priority**: Medium
**Estimated Effort**: 2 days
**Dependencies**: DAMTYPANDSPEEFF-001, DAMTYPANDSPEEFF-002
**Blocks**: DAMTYPANDSPEEFF-004, DAMTYPANDSPEEFF-005

## Problem / Objective

Implement turn-based systems that process ongoing effects produced by damage types: bleeding, burning (with stacking), and poison (part or entity scope). Ensure component lifecycles, tick damage, and event emissions match the specification.

## Scope

- Add/update `src/systems/anatomy/BleedingSystem.ts`, `BurningSystem.ts`, and `PoisonSystem.ts` with turn-based tick processing and component removal.
- Respect stacking rules for burning (`canStack` vs refresh-only) and ensure tickDamage/stackedCount accumulate per spec.
- Handle component removal when durations expire or the part/entity is destroyed; emit started/stopped events.
- Ensure systems integrate with the main loop/scheduler (e.g., registration in system index) without altering unrelated systems.

## File list

- `src/systems/anatomy/BleedingSystem.ts`
- `src/systems/anatomy/BurningSystem.ts`
- `src/systems/anatomy/PoisonSystem.ts`
- System registration/index file (e.g., `src/systems/index.ts` or equivalent)
- `tests/unit/anatomy/bleeding.system.test.ts`
- `tests/unit/anatomy/burning.system.test.ts`
- `tests/unit/anatomy/poison.system.test.ts`
- Shared test fixtures for anatomy parts/components reused across suites

## Out of scope

- Immediate application of effects (handled in DAMTYPANDSPEEFF-002).
- Action lockout or stun handling beyond emitting/clearing the stunned component.
- Performance benchmarking; only basic correctness-focused loops.
- UI or narrative hooks that consume the events.

## Acceptance criteria

### Tests that must pass

- `npm run test:unit -- tests/unit/anatomy/bleeding.system.test.ts`
- `npm run test:unit -- tests/unit/anatomy/burning.system.test.ts`
- `npm run test:unit -- tests/unit/anatomy/poison.system.test.ts`
- Lint scoped to new/modified system and test files.

### Invariants that must remain true

- Tick systems stop emitting damage/events once a part is destroyed or duration reaches zero.
- Burning stacking follows spec: `canStack=false` only refreshes duration; `canStack=true` increments stackedCount and tickDamage deterministically.
- Poison targets part vs entity strictly by scope; durations refresh on reapplication.
- No duplicate events on the same tick for a single component expiration.

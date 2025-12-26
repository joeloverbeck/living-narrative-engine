# OXYDROSYS-020: Register HypoxiaTickSystem in DI

## Description

Register the HypoxiaTickSystem in the dependency injection container.

## Assumptions & Scope Updates

- HypoxiaTickSystem already exists at `src/breathing/services/hypoxiaTickSystem.js` and only needs DI wiring.
- The system uses `logger`, `entityManager`, `safeEventDispatcher`, and `validatedEventDispatcher` dependencies (matching its constructor).
- Only DI token + registration + minimal DI coverage tests are required; no behavior changes or new events.

## Files to Create

- None

## Files to Modify

- `src/dependencyInjection/tokens/tokens-core.js` - Add `HypoxiaTickSystem` token
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Register system

## Out of Scope

- System implementation (already done)
- Initialization triggers

## Acceptance Criteria

1. **Token added**: `HypoxiaTickSystem: 'HypoxiaTickSystem'` (alphabetically sorted)
2. **Registration**: singletonFactory following BleedingTickSystem pattern
3. **Dependencies resolved**: logger, entityManager, safeEventDispatcher, validatedEventDispatcher

## Tests That Must Pass

- `npm run test:unit -- tests/unit/dependencyInjection/registrations/worldAndEntityRegistrations.test.js`
- `npm run test:unit -- tests/unit/breathing/services/hypoxiaTickSystem.test.js`

## Invariants

- System created as singleton
- System starts processing when events fire

## Status

Completed

## Outcome

- Added HypoxiaTickSystem DI token and singleton registration in world/entity DI.
- Added DI registration coverage in worldAndEntityRegistrations unit test.
- Ran unit tests for DI registration and hypoxia tick system (no behavior changes required).

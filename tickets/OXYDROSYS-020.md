# OXYDROSYS-020: Register HypoxiaTickSystem in DI

## Description

Register the HypoxiaTickSystem in the dependency injection container.

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

- `npm run test:ci` - Full test suite
- `npm run typecheck`

## Invariants

- System created as singleton
- System starts processing when events fire

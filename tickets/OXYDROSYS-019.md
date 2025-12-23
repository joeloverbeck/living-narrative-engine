# OXYDROSYS-019: Implement HypoxiaTickSystem service

## Description

Create the JavaScript tick system that processes hypoxia progression each turn.

## Files to Create

- `src/breathing/services/hypoxiaTickSystem.js`
- `src/breathing/index.js`
- `tests/unit/breathing/services/hypoxiaTickSystem.test.js`

## Files to Modify

- None (DI registration in separate ticket)

## Out of Scope

- DI registration
- Integration with existing systems

## Acceptance Criteria

1. **Follows BleedingTickSystem pattern exactly**
2. **Subscribes to**: `core:turn_ended`
3. **Processes entities with**: `breathing:hypoxic` component
4. **Severity escalation**: mild (0-2 turns) → moderate (3-4 turns) → severe (5-6 turns) → unconscious (7+ turns)
5. **Brain damage**: After 2+ turns unconscious, applies anoxic damage to brain
6. **Events dispatched**: Uses appropriate breathing events
7. **Tests**: Unit tests with >80% coverage

## Tests That Must Pass

- `npm run test:unit -- tests/unit/breathing/services/hypoxiaTickSystem.test.js`
- `npm run typecheck`

## Invariants

- Follows established tick system patterns
- Uses BaseService for dependency validation
- Properly cleans up subscriptions in destroy()

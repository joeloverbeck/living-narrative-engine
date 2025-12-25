# Operation Handler Namespace Coupling Specification

## Context

### Location in Codebase
- **Primary**: `src/logic/operationHandlers/` - Operation handler implementations
- **Constants**: `src/constants/componentIds.js` - Centralized component ID constants (partially used)
- **Mod Data**: `data/mods/*/` - JSON files defining components, events, actions
- **Tests**: `tests/unit/logic/operationHandlers/` - Unit tests for handlers

### What the Module Does
Operation handlers execute game operations (DRINK_FROM, DRINK_ENTIRELY, TRANSFER_ITEM, etc.) by:
1. Validating input parameters
2. Querying entity components via `entityManager.getComponentData(entityId, componentId)`
3. Modifying entity state via `entityManager.addComponent()`, `removeComponent()`, etc.
4. Dispatching events via `safeEventDispatcher.dispatch(eventId, payload)`

Handlers reference component and event IDs as string constants to interact with the ECS (Entity Component System).

## Problem

### What Failed
During ITEMSPLIT-007 (creating the `drinking` mod), namespace changes from `items:` to `drinking:` caused silent failures:
- `drinkFromHandler.js` used `items:drinkable` while mod data defined `drinking:drinkable`
- Operations returned `{ success: false, error: 'Container is not drinkable' }` because `getComponentData()` returned `null` for the mismatched ID

### How It Failed
1. **Silent null returns**: `entityManager.getComponentData('entity', 'wrong:component')` returns `null` instead of throwing
2. **Downstream logic interprets null as "missing component"**: Handler logic treats this as a valid business case (container doesn't have drinkable component)
3. **No validation exists**: No mechanism verifies that handler constants match actual mod definitions

### Why It Failed
1. **Hardcoded string constants**: Handlers declare constants inline without importing from a central source:
   ```javascript
   // src/logic/operationHandlers/drinkFromHandler.js:28-32
   const LIQUID_CONTAINER_COMPONENT_ID = 'containers-core:liquid_container';
   const DRINKABLE_COMPONENT_ID = 'drinking:drinkable';
   const EMPTY_COMPONENT_ID = 'drinking:empty';
   ```

2. **Test isolation creates illusion of correctness**: Unit tests duplicate these constants and mock the entity manager:
   ```javascript
   // tests/unit/logic/operationHandlers/drinkFromHandler.test.js:24-28
   const DRINKABLE_COMPONENT_ID = 'drinking:drinkable';  // Duplicated!

   em.hasComponent.mockReturnValueOnce(true);  // Accepts any string
   ```
   Tests pass because mocks accept any string, never validating against real mod data.

3. **No startup-time contract validation**: The system never verifies that referenced component/event IDs actually exist in loaded mods.

4. **Inconsistent patterns**: Some handlers use `src/constants/componentIds.js`, most don't. No equivalent `eventIds.js` exists.

### Links to Tests
- Unit tests (demonstrate the problem):
  - `tests/unit/logic/operationHandlers/drinkFromHandler.test.js`
  - `tests/unit/logic/operationHandlers/drinkEntirelyHandler.test.js`
- Integration tests (would catch mismatches):
  - `tests/integration/mods/drinking/drinkFromRuleExecution.test.js`
  - `tests/integration/mods/drinking/drinkEntirelyRuleExecution.test.js`

## Truth Sources

### Primary Truth Sources
1. **Mod JSON files** - Define what components/events exist:
   - `data/mods/drinking/components/drinkable.component.json` → defines `drinking:drinkable`
   - `data/mods/drinking/events/liquid_consumed.event.json` → defines `drinking:liquid_consumed`

2. **Schema definitions** - Validate mod JSON structure:
   - `data/schemas/component.schema.json`
   - `data/schemas/event.schema.json`

3. **Component registry at runtime** - What's actually loaded:
   - `componentRegistry` holds all loaded component definitions
   - `eventBus` knows registered event types

### Secondary Truth Sources
- `src/constants/componentIds.js` - Centralized constants (27 existing, should be expanded)
- ESLint rule `mod-architecture/no-hardcoded-mod-references` - Exists but not enforced on handlers

## Desired Behavior

### Normal Cases
1. **Handler uses component ID that exists** → Operation executes successfully
2. **Handler dispatches event that's registered** → Event propagates to listeners
3. **Mod namespace changes** → All consumers (handlers, tests) are updated via single source of truth

### Edge Cases
1. **Optional component lookup**: When a component genuinely may not exist on an entity, handler should explicitly handle the null case with business logic (not as an error):
   ```javascript
   const optionalData = this.#entityManager.getComponentData(entity, OPTIONAL_COMPONENT_ID);
   if (!optionalData) {
     // Explicit business logic for missing optional component
   }
   ```

2. **Cross-mod references**: Handlers in mod A referencing components from mod B should use the B mod's namespace explicitly and document the dependency.

3. **Development-time mod changes**: When developing mods, namespace changes should trigger validation warnings.

### Failure Modes
1. **Component ID not found at startup** → Throw `ComponentNotRegisteredError` with:
   - The component ID that's missing
   - The handler that references it
   - Available similar IDs (fuzzy match)

2. **Event ID not registered** → Throw `EventNotRegisteredError` with similar detail

3. **Namespace mismatch detected** → Log warning with:
   - Expected namespace pattern
   - Actual namespace used
   - Suggestion to update

### Invariants
Properties that must always hold:

1. **Single Source of Truth**: Every component/event ID used in handlers MUST be imported from a centralized constants file, never declared inline.

2. **Constants-Mod Parity**: Every constant in `componentIds.js` and `eventIds.js` MUST have a corresponding definition in mod JSON files.

3. **Startup Validation**: The system MUST validate at startup that all handler-referenced IDs exist in the loaded mod registry.

4. **Test Constant Import**: Unit tests MUST import constants from the same source as handlers, never duplicate them.

5. **Namespace Convention**: Component/event IDs MUST use the format `modId:identifier` where `modId` matches the owning mod's directory name.

### API Contracts

#### What Stays Stable
1. **EntityManager API**: `getComponentData(entityId, componentId)` signature unchanged
2. **EventDispatcher API**: `dispatch(eventId, payload)` signature unchanged
3. **Handler interface**: `execute(params, executionContext)` contract unchanged
4. **Mod JSON schema**: Component and event definition schemas unchanged

#### What Handlers Depend On
1. Component IDs existing in loaded mods
2. Event IDs being registered with the event bus
3. EntityManager returning `null` for missing components (current behavior)

#### What Mods Provide
1. Component definitions with unique `modId:identifier` IDs
2. Event definitions with unique `modId:identifier` IDs
3. Manifest declaring all content

### What is Allowed to Change

1. **Namespace prefixes**: Can change (e.g., `items:` → `drinking:`) IF all consumers are updated
2. **Handler implementation details**: Internal logic can change without affecting contracts
3. **New component/event IDs**: Can be added at any time
4. **Centralized constants location**: Could move from `componentIds.js` to domain-specific files

### What is NOT Allowed to Change Without Migration

1. **Removing component/event IDs**: Must ensure no handlers reference them
2. **Renaming IDs**: Requires coordinated update of all references
3. **Changing namespace convention**: Would require mass migration

## Testing Plan

### Tests to Update

1. **Unit tests must import constants** - Update all handler unit tests to import from centralized constants instead of declaring inline:
   ```javascript
   // Before (bad)
   const DRINKABLE_COMPONENT_ID = 'drinking:drinkable';

   // After (good)
   import { DRINKABLE_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
   ```

2. **Add validation to test setup** - Create test helper that validates mock component IDs against real registry.

### Tests to Add

#### Contract Validation Tests
Create `tests/integration/validation/handlerComponentContracts.test.js`:
```javascript
describe('Handler Component Contracts', () => {
  it('all component IDs in componentIds.js exist in loaded mods', async () => {
    // Load all mods
    // For each constant in componentIds.js, verify it exists in componentRegistry
  });

  it('all handlers import from centralized constants', async () => {
    // Static analysis: grep handlers for hardcoded component ID patterns
    // Fail if any handler declares `const *_COMPONENT_ID = '` inline
  });
});
```

#### Startup Validation Integration Test
Create `tests/integration/validation/startupComponentValidation.test.js`:
```javascript
describe('Startup Component Validation', () => {
  it('throws on unregistered component ID reference', async () => {
    // Register handler that uses non-existent component
    // Verify startup throws ComponentNotRegisteredError
  });
});
```

### Regression Tests

1. **Namespace migration test**: Simulate namespace change, verify all references are caught:
   ```javascript
   it('detects namespace mismatches during validation', () => {
     // Mock componentRegistry with 'drinking:drinkable'
     // Try to validate handler using 'items:drinkable'
     // Expect ValidationError
   });
   ```

2. **Cross-mod dependency test**: Verify handlers can use components from dependent mods:
   ```javascript
   it('allows cross-mod component references with explicit dependency', () => {
     // Handler in mod A references component from mod B
     // mod A declares dependency on mod B
     // Validation passes
   });
   ```

### Property Tests

Consider property-based testing for:
1. **ID format validation**: Any valid `modId:identifier` format should pass schema
2. **Namespace extraction**: Given any component ID, can always extract mod namespace
3. **Bidirectional lookup**: If handler H references component C, component C's registry entry should list H as a consumer

## Implementation Recommendations

### Short-term (Immediate Fix)

1. **Create `src/constants/eventIds.js`** - Centralize event IDs like component IDs
2. **Update drinking handlers** - Import from centralized constants
3. **Add ESLint enforcement** - Extend `no-hardcoded-mod-references` to handlers

### Medium-term (Architecture Improvement)

1. **Create validation service** - `HandlerContractValidator` that runs at startup
2. **Add dev-time warnings** - Log warnings when component IDs don't match expected namespace
3. **Document pattern** - Add to CLAUDE.md the required pattern for handler constants

### Long-term (Systemic Solution)

1. **Generate constants from mod data** - Build step that generates `componentIds.js` from mod JSON
2. **Type-safe component IDs** - TypeScript literal types for component IDs
3. **Runtime registry queries** - Handlers query registry for IDs instead of using constants

## References

- Handler implementation: `src/logic/operationHandlers/drinkFromHandler.js:28-32`
- Existing constants pattern: `src/constants/componentIds.js`
- Mod component definitions: `data/mods/drinking/components/*.component.json`
- Test duplication example: `tests/unit/logic/operationHandlers/drinkFromHandler.test.js:24-28`
- ESLint rule: `.eslintrc.js` → `mod-architecture/no-hardcoded-mod-references`

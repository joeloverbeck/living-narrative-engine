# Action Discovery Diagnostics and Fail-Fast Error Messaging

## Context

### Location in Codebase
- **Action Discovery Pipeline**: `src/actions/` - determines available actions for actors
- **Scope DSL Filter Resolution**: `src/scopeDsl/filterResolver.js` - filters entities via JSON Logic
- **Condition Reference Resolution**: `src/logic/jsonLogicEvaluationService.js`, `src/utils/conditionRefResolver.js`
- **Test Fixtures**: `tests/common/mods/ModTestFixture.js`, `tests/common/mods/ModEntityBuilder.js`

### What These Modules Do
1. **Action Discovery**: Evaluates which actions are available to an actor based on:
   - Actor's components (required/forbidden)
   - Target availability via scope resolution
   - Prerequisites via JSON Logic evaluation

2. **Filter Resolution**: Executes JSON Logic conditions against entities to filter scope results.
   Uses `condition_ref` to reference reusable condition definitions.

3. **Condition Resolution**: Resolves `condition_ref` by loading condition definitions from
   `GameDataRepository` and recursively evaluating nested references.

4. **Test Fixtures**: Create test entities with components for action/rule testing.

## Problem

### What Failed
Tests in `get_close_facing_away_filter.test.js` returned empty action arrays with **zero diagnostic output** explaining why the `get_close` action wasn't discovered.

### How It Failed
1. `ModTestFixture.createStandardActorTarget()` creates entities with `personal-space-states:closeness` component by default
2. The `get_close` action has `forbidden_components.actor` including `personal-space-states:closeness`
3. Action discovery correctly filtered out the action, but provided **no explanation**
4. Tests appeared to pass silently but with wrong behavior, then failed after scope changes

### Why It Failed
1. **No diagnostic output**: Action discovery returns empty array without explaining which filters/components caused rejection
2. **Silent validation**: Test fixtures don't warn when entities have components conflicting with action definitions
3. **Bare-bones errors**: condition_ref errors lack context (suggestions, mod source, evaluation chain)

### Links to Tests
- `tests/integration/mods/personal-space/get_close_facing_away_filter.test.js` - all 9 tests
- `tests/integration/scopes/placeYourselfBehindActionDiscovery.integration.test.js`
- `tests/integration/scopes/conditionReferencesInScopes.integration.test.js`

## Truth Sources

### Documentation
- `CLAUDE.md` - Project conventions and fail-fast methodology
- `docs/modding/actions.md` - Action definition structure
- `docs/testing/mod-testing-guide.md` - ModTestFixture patterns

### Domain Rules
1. **forbidden_components**: If actor has ANY listed component, action is unavailable
2. **required_components**: If actor lacks ANY listed component, action is unavailable
3. **condition_ref**: Must resolve to valid condition or fail-fast with clear error
4. **Scope resolution**: Must explain filter failures when debugging is enabled

### External Contracts
- JSON Logic evaluation semantics
- JSON Schema validation for action definitions
- Jest testing framework assertions

## Desired Behavior

### Normal Cases

#### Action Discovery with Diagnostics
```javascript
// When action is rejected due to forbidden_components:
const result = getAvailableActions(actorId, { diagnostics: true });
// result.diagnostics should include:
{
  actionId: 'personal-space:get_close',
  rejected: true,
  reason: 'FORBIDDEN_COMPONENT',
  component: 'personal-space-states:closeness',
  message: 'Actor has forbidden component personal-space-states:closeness'
}
```

#### condition_ref Error with Context
```javascript
// When condition_ref fails to resolve:
throw new ScopeResolutionError(
  `Condition 'core:missing-condition' not found in registry`,
  {
    conditionId: 'core:missing-condition',
    modSource: 'personal-space', // which mod referenced it
    parentContext: 'personal-space:actors_in_location_not_wielding_and_facing',
    suggestions: ['core:entity-at-location', 'core:entity-is-actor'], // similar names
    resolutionChain: ['scope:filter', 'condition_ref:core:missing-condition']
  }
);
```

#### Test Fixture Validation
```javascript
// When creating entity with forbidden component:
const fixture = await ModTestFixture.forAction('personal-space', 'personal-space:get_close');
fixture.createStandardActorTarget(['Actor', 'Target']);
// Should log warning:
// Warning: Actor has component 'personal-space-states:closeness' which is in
//    forbidden_components for action 'personal-space:get_close'
```

### Edge Cases

1. **Empty forbidden_components array**: No rejection, action available
2. **Missing condition definition with similar names**: Suggest closest matches
3. **Circular condition_ref**: Detect cycle and report full chain
4. **Partial scope resolution**: Some entities pass, some fail - report failures

### Failure Modes

| Scenario | Error Type | Required Context |
|----------|------------|------------------|
| Missing condition_ref | `ScopeResolutionError` | conditionId, modSource, suggestions |
| Circular condition_ref | `ScopeResolutionError` | full resolution chain |
| forbidden_component match | Diagnostic object | componentId, actionId |
| Filter evaluation error | `ScopeResolutionError` | entityId, filterLogic, clause details |

## Invariants

1. **Fail-fast is non-negotiable**: Missing conditions MUST throw, never return false
2. **Diagnostics are opt-in**: Normal execution doesn't pay diagnostic overhead
3. **Error context is always complete**: Every error includes enough to debug without searching
4. **Test fixtures validate by default**: Warn on conflicts, can be disabled for edge case testing

## API Contracts

### What Stays Stable
- `getAvailableActions(actorId)` return type (array of actions)
- `ScopeResolutionError` class interface
- `condition_ref` resolution semantics
- Action definition schema (forbidden_components, required_components)

### What Can Change
- `getAvailableActions(actorId, options)` - add options parameter
- `ScopeResolutionError` context properties - add new fields
- Filter resolver logging verbosity
- Test fixture validation behavior (warnings vs silent)

## What Is Allowed to Change

### Production Code Changes
1. **Add diagnostics mode to action discovery**
   - New optional parameter: `{ diagnostics: true }`
   - Returns diagnostic objects alongside actions
   - Zero overhead when disabled

2. **Enhance condition_ref error messages**
   - Add `suggestions` property with fuzzy-matched similar condition names
   - Add `modSource` property showing which mod file contained the reference
   - Add `parentContext` property showing scope/action that triggered resolution

3. **Add FilterClauseAnalyzer context to errors**
   - Include clause-level analysis in ScopeResolutionError
   - Show which specific filter clause failed and why

### Test Infrastructure Changes
1. **Add forbidden_components validation to ModTestFixture**
   - Warn when entity components conflict with action definition
   - Optional `{ validateConflicts: false }` to disable for edge case tests

2. **Add diagnostic mode to test helpers**
   - `fixture.enableDiagnostics()` for debugging test failures
   - Shows full action discovery trace in test output

## Testing Plan

### Tests to Update
1. `tests/unit/scopeDsl/nodes/filterResolver.conditionRefErrors.test.js`
   - Add test for enhanced error context properties

2. `tests/unit/logic/jsonLogicEvaluationService.test.js`
   - Add test for condition_ref suggestions
   - Add test for modSource in errors

3. `tests/common/mods/ModTestFixture.js` tests
   - Add validation warning tests
   - Add conflict detection tests

### Tests to Add

#### Unit Tests
- `tests/unit/actions/actionDiscoveryDiagnostics.test.js`
  - Test diagnostic output for forbidden_components rejection
  - Test diagnostic output for required_components missing
  - Test diagnostic mode performance (opt-in overhead)

- `tests/unit/utils/conditionSuggestionService.test.js`
  - Test fuzzy matching for similar condition names
  - Test empty registry handling
  - Test exact match (no suggestions needed)

#### Integration Tests
- `tests/integration/actions/actionDiscoveryDiagnosticsIntegration.test.js`
  - End-to-end diagnostic flow with real mod definitions
  - Verify diagnostic output matches actual rejection reasons

#### Regression Tests
- `tests/integration/mods/personal-space/get_close_diagnostics.test.js`
  - Reproduce original failure scenario
  - Verify diagnostics would have explained the issue

### Property Tests
- All condition_ref errors include non-empty `conditionId`
- All forbidden_component rejections include component name in diagnostic
- Diagnostic mode never changes action discovery results (only adds metadata)
- Error suggestions never include the missing condition itself

# GOAPIMPL-008: Parameter Resolution Service

**Priority**: CRITICAL
**Estimated Effort**: 3-4 hours
**Dependencies**: GOAPIMPL-007 (needs context assembly)

## Description

Create ParameterResolutionService that resolves parameter references (like `"task.params.item"`, `"refinement.localState.pickedItem"`) to actual entity IDs or values. Handles property path navigation and type validation.

This service is critical for connecting abstract task parameters to concrete entity references during refinement and action execution.

## Acceptance Criteria

- [ ] Resolves string parameter references to entity IDs (e.g., `"task.params.item"` → `"entity-123"`)
- [ ] Supports property path navigation (e.g., `"actor.components.core:health.value"` → `50`)
- [ ] Validates resolved parameters against action parameter schemas
- [ ] Handles missing/invalid references gracefully with clear errors
- [ ] Supports multiple context sources (task.params, refinement.localState, actor)
- [ ] Provides detailed error messages for resolution failures
- [ ] Handles null/undefined values appropriately
- [ ] 90%+ test coverage (unit + integration)

## Files to Create

### Main Implementation
- `src/goap/services/parameterResolutionService.js` - Main resolution service

### Error Handling
- `src/goap/errors/parameterResolutionError.js` - Custom error for resolution issues

### Tests
- `tests/unit/goap/services/parameterResolutionService.test.js` - Unit tests
- `tests/integration/goap/parameterResolution.integration.test.js` - Integration tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IParameterResolutionService` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test simple parameter resolution (`task.params.x` → entity ID)
- [ ] Test property path navigation (`actor.components.x.y` → value)
- [ ] Test resolution from multiple sources (task, refinement, actor)
- [ ] Test error handling for missing paths
- [ ] Test error handling for invalid types
- [ ] Test null/undefined value handling
- [ ] Test with mock context data
- [ ] Test parameter validation against schemas

### Integration Tests
- [ ] Test resolution with real entity components
- [ ] Test resolution with complex property paths
- [ ] Test resolution with refinement.localState accumulation
- [ ] Test resolution chain (reference → reference → value)
- [ ] Test error messages are clear and actionable

## Parameter Reference Patterns

### Direct References
```javascript
// Task parameter reference
"task.params.item"  // → "entity-123"
"task.params.location"  // → "entity-456"

// Refinement local state reference
"refinement.localState.pickedItem"  // → "entity-789"
"refinement.localState.targetLocation"  // → "entity-012"

// Actor reference
"actor"  // → "entity-actor-1"
```

### Property Path Navigation
```javascript
// Component property access
"actor.components.core:health.value"  // → 50
"task.params.item.components.core:located_at.location"  // → "entity-room-1"

// Nested property access
"refinement.localState.containerData.capacity"  // → 10
```

### Resolution Algorithm
1. Parse reference string into parts (e.g., `["task", "params", "item"]`)
2. Start with context object
3. Navigate through parts sequentially
4. Validate each step exists and is accessible
5. Return final value
6. If any step fails, throw ParameterResolutionError with detailed path

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 163-195 - Refinement pipeline using parameter binding

### Implementation Guides
- `docs/goap/refinement-parameter-binding.md` - **PRIMARY REFERENCE** - Complete parameter binding guide
- `docs/goap/refinement-action-references.md` - Target binding patterns for actions

### Schema References
- `data/schemas/refinement-method.schema.json` - See `targetBindings` field for binding patterns
- `data/schemas/task.schema.json` - Task parameter structure

### Examples
- `data/mods/core/tasks/refinement-methods/consume_nourishing_item_*.refinement.json` - Real parameter binding examples

## Implementation Notes

### Context Sources Priority
When resolving parameters, check sources in this order:
1. `refinement.localState` - Most recent, step-specific data
2. `task.params` - Task-level parameters
3. `actor` - Actor entity reference
4. `world` - World state queries (if needed)

### Type Validation
After resolution, validate the resolved value matches expected type:
- Entity reference: String matching entity ID pattern
- Numeric value: Number type
- Boolean value: Boolean type
- Object/array: Structured data

### Error Context
Include in ParameterResolutionError:
- Original reference string
- Partial path resolved (what worked)
- Failed step (where it broke)
- Available keys at failed step (what was expected)
- Context type (planning, refinement, condition)

### Performance
- Cache resolved parameters within single refinement execution
- Clear cache between refinements
- Consider memoization for expensive property path navigation

## Integration Points

### Required Services (inject)
- `IContextAssemblyService` (GOAPIMPL-007) - Provides contexts
- `ILogger` - Logging

### Used By (future tickets)
- GOAPIMPL-012 (Primitive Action Step Executor) - Target binding
- GOAPIMPL-013 (Conditional Step Executor) - Condition variables
- GOAPIMPL-014 (Refinement Engine) - Parameter overrides

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate real-world parameter resolution
- Error messages clearly identify resolution failures
- Property path navigation handles all edge cases
- Service successfully resolves parameters from example refinement methods
- Documentation explains resolution algorithm and error handling

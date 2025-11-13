# GOAPIMPL-011: Method Selection Algorithm

**Priority**: HIGH
**Estimated Effort**: 3-4 hours
**Dependencies**: GOAPIMPL-007 (Context Assembly), GOAPIMPL-009 (Error Hierarchy)

## Description

Create MethodSelectionService that evaluates refinement method applicability conditions and selects the first applicable method. Handles condition evaluation failures and provides clear selection diagnostics.

Method selection is the first step in refinement: given a task and current context, determine which refinement method (if any) can be used to decompose the task.

## Acceptance Criteria

- [ ] Evaluates applicability conditions in order (first-to-last)
- [ ] Returns first method with satisfied conditions
- [ ] Returns null if no methods applicable (not an error)
- [ ] Logs applicability evaluation results for debugging
- [ ] Handles condition evaluation errors gracefully
- [ ] Provides selection diagnostics (which methods checked, which failed, why)
- [ ] Supports methods with no applicability (always applicable)
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/refinement/methodSelectionService.js` - Selection service

### Tests
- `tests/unit/goap/refinement/methodSelectionService.test.js` - Unit tests
- `tests/integration/goap/methodSelection.integration.test.js` - Integration tests

## Files to Modify

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IMethodSelectionService` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test method selection with various conditions
- [ ] Test selection returns first applicable method
- [ ] Test fallback when no methods applicable (returns null)
- [ ] Test condition evaluation error handling
- [ ] Test selection with empty applicability (always applicable)
- [ ] Test diagnostic output for debugging
- [ ] Test with mock context data

### Integration Tests
- [ ] Test method selection with real tasks and methods
- [ ] Test selection with complex applicability conditions
- [ ] Test selection with JSON Logic operators
- [ ] Test selection with real entity components
- [ ] Test selection diagnostics are accurate

## Method Selection Algorithm

### Process Flow
```
1. Load refinement methods for task
2. For each method (in order):
   a. Check if applicability condition exists
   b. If no condition → method is applicable
   c. If condition exists → evaluate with context
   d. If condition true → return this method
   e. If condition false → continue to next method
3. If no methods applicable → return null
```

### Applicability Evaluation
```javascript
// Method with applicability
{
  "applicability": {
    "var": "actor.components.core:hungry"
  }
}
// Evaluate: context.actor.components["core:hungry"] === true

// Method without applicability (always applicable)
{
  // No applicability field → always applicable
}
```

### Selection Result
```javascript
{
  selectedMethod: { /* method object */ } | null,
  diagnostics: {
    methodsEvaluated: 3,
    evaluationResults: [
      { methodId: "method1", applicable: false, reason: "condition false" },
      { methodId: "method2", applicable: true, reason: "condition true" },
      // method2 selected, method3 not evaluated
    ]
  }
}
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 196-207 - Task library construction (uses applicability)

### Schema References
- `data/schemas/refinement-method.schema.json` - See `applicability` field (optional JSON Logic)

### Examples
- `data/mods/core/tasks/refinement-methods/*.refinement.json` - Real applicability examples

## Implementation Notes

### Applicability vs Preconditions
- **Applicability**: Structural check (e.g., "Does actor have hunger component?")
- **Preconditions**: World state check (e.g., "Is actor actually hungry?")
- Applicability filters methods before planning
- Preconditions filter during planning

### Evaluation Context
Applicability is evaluated with refinement context:
```javascript
{
  actor: { /* actor entity data */ },
  world: { /* world state */ },
  task: { /* task parameters */ },
  refinement: { localState: {} } // empty at method selection
}
```

### Error Handling Strategy
- Condition evaluation error → Log warning, treat as "not applicable"
- Missing method data → Throw MethodSelectionError
- Invalid condition syntax → Log error, treat as "not applicable"

### Logging and Diagnostics
Log for each method:
- Method ID
- Applicability condition (if any)
- Evaluation result (true/false/error)
- Selected: yes/no
- Reason for rejection (if applicable)

Example log:
```
[MethodSelection] Evaluating methods for task 'consume_nourishing_item'
  - Method 'eating_nearby_food': condition true → SELECTED
  - Method 'hunting_and_eating': (not evaluated, first method selected)
```

### Performance Optimization
- Short-circuit: Stop evaluating after first applicable method
- Cache method list per task ID
- Consider parallel evaluation if needed (future optimization)

## Integration Points

### Required Services (inject)
- `IContextAssemblyService` (GOAPIMPL-007) - Build evaluation context
- `IJsonLogicService` - Evaluate applicability conditions
- `ILogger` - Logging

### Used By (future)
- GOAPIMPL-014 (Refinement Engine) - Select method before execution

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate method selection with real data
- Selection diagnostics provide clear debugging information
- Service handles all edge cases gracefully
- Service integrates with DI container
- Documentation explains selection algorithm and diagnostics

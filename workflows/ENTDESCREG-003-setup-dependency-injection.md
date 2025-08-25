# ENTDESCREG-003: Setup Dependency Injection

**Priority**: High  
**Dependencies**: ENTDESCREG-002 (Operation Handler Implementation)  
**Estimated Effort**: 0.5 days

## Overview

Register the `RegenerateDescriptionHandler` in the project's dependency injection container, enabling the operation to be resolved and executed by the rule processing system.

## Background

The Living Narrative Engine uses a comprehensive dependency injection system to manage service dependencies. The new `RegenerateDescriptionHandler` must be properly registered with all its dependencies to be available for rule execution.

## Acceptance Criteria

- [ ] Add `RegenerateDescriptionHandler` token to tokens-core.js
- [ ] Register handler in operationHandlerRegistrations.js with proper dependencies
- [ ] Ensure all required dependencies are available and properly injected
- [ ] Handler can be resolved from container without errors
- [ ] Handler registration follows existing project patterns
- [ ] All dependencies validate correctly during construction

## Technical Requirements

### Files to Update

#### `src/dependencyInjection/tokens/tokens-core.js`

Add new token after existing operation handler tokens:

```javascript
RegenerateDescriptionHandler: 'RegenerateDescriptionHandler',
```

#### `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

**Add Import Statement**

```javascript
import RegenerateDescriptionHandler from '../../logic/operationHandlers/regenerateDescriptionHandler.js';
```

**Add Registration in Handlers Array**

```javascript
[
  tokens.RegenerateDescriptionHandler,
  RegenerateDescriptionHandler,
  (c, Handler) =>
    new Handler({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      bodyDescriptionComposer: c.resolve(tokens.BodyDescriptionComposer),
    }),
],
```

## Dependency Requirements

### Required Services

- **`IEntityManager`**: Entity data access and component updates
- **`ILogger`**: Operation logging and debugging
- **`ISafeEventDispatcher`**: Error handling and event dispatch
- **`BodyDescriptionComposer`**: Description generation service

### Validation Requirements

- All dependencies must implement required interfaces
- Constructor validation will verify required methods are available
- Registration must follow existing handler registration patterns

## Definition of Done

- [ ] Handler token added to tokens-core.js
- [ ] Handler import added to operationHandlerRegistrations.js
- [ ] Handler registration added with all required dependencies
- [ ] Dependencies resolve correctly from container
- [ ] Handler can be instantiated without errors
- [ ] Registration follows project dependency injection patterns
- [ ] No circular dependencies introduced

## Integration Verification

- [ ] Container can resolve `RegenerateDescriptionHandler` without errors
- [ ] All injected dependencies are valid and functional
- [ ] Handler constructor validation passes for all dependencies
- [ ] Handler is available for operation execution in rule processing

## Testing Requirements

- [ ] Verify handler can be resolved from DI container
- [ ] Test that all dependencies are properly injected
- [ ] Confirm constructor validation works correctly
- [ ] Ensure no regressions in existing handler registrations

## Related Specification Sections

- **Section 3.3**: Phase 3 - Dependency Injection Registration
- **Section 2.2**: Core Components - Dependencies specification
- **Section 5.1**: Functional Requirements - Service integration

## Development Notes

### Registration Pattern

The registration follows the project's standard pattern:

1. Token identifier
2. Handler class
3. Factory function that resolves dependencies from container

### Dependency Resolution Order

Ensure dependencies are registered before the handler:

- `IEntityManager` ✅ (already registered)
- `ILogger` ✅ (already registered)
- `ISafeEventDispatcher` ✅ (already registered)
- `BodyDescriptionComposer` ✅ (already registered)

## Next Steps

After completion, proceed to **ENTDESCREG-004** to integrate the operation into the clothing removal rule.

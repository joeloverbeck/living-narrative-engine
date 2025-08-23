# MOVLOCK-004: Register Operations in Interpreter

**Status**: NOT_STARTED  
**Priority**: HIGH  
**Dependencies**: MOVLOCK-003  
**Estimated Effort**: 0.5 hours

## Context

After registering the handlers with the dependency injection container, they must be bound to operation names in the interpreter's operation registry. This allows the rules engine to execute LOCK_MOVEMENT and UNLOCK_MOVEMENT operations.

## Implementation Steps

### 1. Update Interpreter Registrations

**File**: `src/dependencyInjection/registrations/interpreterRegistrations.js`

#### Step 1.1: Locate the Registry Section

Find the section where operations are registered with the registry. Look for code like:

```javascript
registry.register('OPERATION_NAME', bind(tokens.HandlerToken));
```

This is typically in a section that registers multiple operations, often with operations like:

- `MERGE_CLOSENESS_CIRCLE`
- `REMOVE_FROM_CLOSENESS_CIRCLE`
- `ADD_COMPONENT`
- `REMOVE_COMPONENT`

#### Step 1.2: Add Operation Bindings

Add these two lines in the appropriate location (maintain alphabetical order if present):

```javascript
registry.register('LOCK_MOVEMENT', bind(tokens.LockMovementHandler));
registry.register('UNLOCK_MOVEMENT', bind(tokens.UnlockMovementHandler));
```

**Important**: The operation names ('LOCK_MOVEMENT' and 'UNLOCK_MOVEMENT') must match exactly what will be used in the rule JSON files.

### 2. Verify Import Requirements

Ensure that `tokens` is imported at the top of the file:

```javascript
import tokens from '../tokens.js';
```

And that `bind` is available (it's usually a local helper function or imported).

### 3. Implementation Checklist

- [ ] Open `src/dependencyInjection/registrations/interpreterRegistrations.js`
- [ ] Locate the registry.register section
- [ ] Add LOCK_MOVEMENT registration
- [ ] Add UNLOCK_MOVEMENT registration
- [ ] Verify operation names match exactly (case-sensitive)
- [ ] Verify token names match those defined in tokens.js
- [ ] Check that bind() function is available
- [ ] Ensure proper line endings and formatting

## Validation Criteria

1. **Operations registered**: Both LOCK_MOVEMENT and UNLOCK_MOVEMENT bound
2. **Correct tokens**: Uses tokens.LockMovementHandler and tokens.UnlockMovementHandler
3. **Operation names**: Exact match with what rules will use
4. **Syntax valid**: No JavaScript errors
5. **Bind function**: Properly wraps the token references

## Testing Requirements

After implementation:

1. Run build: `npm run build`
2. Run linter: `npm run lint`
3. Start the application: `npm run dev`
4. Check console for any registration errors

## Operation Name Standards

- Use UPPER_SNAKE_CASE for operation names
- Be descriptive but concise
- Match the naming convention of similar operations
- These names will be referenced in rule JSON files

## Code Context

The registration typically looks like this in context:

```javascript
// Other operation registrations
registry.register('ADD_COMPONENT', bind(tokens.AddComponentHandler));
registry.register('REMOVE_COMPONENT', bind(tokens.RemoveComponentHandler));
registry.register('MODIFY_COMPONENT', bind(tokens.ModifyComponentHandler));

// Add our new operations here
registry.register('LOCK_MOVEMENT', bind(tokens.LockMovementHandler));
registry.register('UNLOCK_MOVEMENT', bind(tokens.UnlockMovementHandler));

// More operations...
```

## Common Issues to Avoid

1. **Case sensitivity**: Operation names are case-sensitive
2. **Token mismatch**: Ensure token names match exactly with tokens.js
3. **Missing bind**: The bind() wrapper is required
4. **Duplicate registration**: Don't register the same operation twice

## Notes

- The operation names registered here are what the rules engine will look for
- These names will be used in the rule JSON files (MOVLOCK-005 and MOVLOCK-006)
- The bind() function creates a factory that the container can resolve
- Order of registration doesn't matter functionally, but consider readability

## References

- Interpreter registrations: `src/dependencyInjection/registrations/interpreterRegistrations.js`
- Token definitions: `src/dependencyInjection/tokens.js`
- Rule files that will use these:
  - `data/mods/positioning/rules/kneel_before.rule.json`
  - `data/mods/positioning/rules/stand_up.rule.json`

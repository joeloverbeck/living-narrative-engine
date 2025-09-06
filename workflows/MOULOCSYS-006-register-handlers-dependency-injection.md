# MOULOCSYS-006: Register Handlers in Dependency Injection

**Phase**: System Integration  
**Priority**: Critical  
**Complexity**: Low  
**Dependencies**: MOULOCSYS-003 (lock handler), MOULOCSYS-004 (unlock handler)  
**Estimated Time**: 2-3 hours

## Summary

Register the `LockMouthEngagementHandler` and `UnlockMouthEngagementHandler` with the dependency injection system. This enables the operation interpreter to recognize and execute the `LOCK_MOUTH_ENGAGEMENT` and `UNLOCK_MOUTH_ENGAGEMENT` operations.

## Technical Requirements

### Files to Modify

1. `src/dependencyInjection/registrations/interpreterRegistrations.js`
2. `src/dependencyInjection/tokens.js`

### Registration Architecture

#### Token Definition
```javascript
// src/dependencyInjection/tokens.js

export const tokens = {
  // ... existing tokens ...
  
  // Mouth Engagement Handlers
  LockMouthEngagementHandler: 'LockMouthEngagementHandler',
  UnlockMouthEngagementHandler: 'UnlockMouthEngagementHandler',
  
  // ... rest of tokens ...
};
```

#### Handler Registration
```javascript
// src/dependencyInjection/registrations/interpreterRegistrations.js

import LockMouthEngagementHandler from '../../logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMouthEngagementHandler from '../../logic/operationHandlers/unlockMouthEngagementHandler.js';

/**
 * Register mouth engagement handlers
 * @param {Container} container - DI container
 * @param {object} tokens - Token definitions
 */
function registerMouthEngagementHandlers(container, tokens) {
  // Register Lock handler
  container.register(
    tokens.LockMouthEngagementHandler,
    LockMouthEngagementHandler,
    {
      lifetime: 'singleton',
      dependencies: [
        tokens.ILogger,
        tokens.IEntityManager,
        tokens.ISafeEventDispatcher,
      ],
    }
  );

  // Register Unlock handler
  container.register(
    tokens.UnlockMouthEngagementHandler,
    UnlockMouthEngagementHandler,
    {
      lifetime: 'singleton',
      dependencies: [
        tokens.ILogger,
        tokens.IEntityManager,
        tokens.ISafeEventDispatcher,
      ],
    }
  );
}

// In the main registration function
export function registerInterpreterDependencies(container, tokens) {
  // ... existing registrations ...
  
  // Register mouth engagement handlers
  registerMouthEngagementHandlers(container, tokens);
  
  // ... rest of registrations ...
}
```

#### Operation Registry Integration
```javascript
// In the operation registry setup section

function registerOperationHandlers(operationRegistry, container, tokens) {
  // ... existing handler registrations ...
  
  // Mouth engagement operations
  operationRegistry.register(
    'LOCK_MOUTH_ENGAGEMENT',
    bind(tokens.LockMouthEngagementHandler)
  );
  
  operationRegistry.register(
    'UNLOCK_MOUTH_ENGAGEMENT',
    bind(tokens.UnlockMouthEngagementHandler)
  );
  
  // ... rest of registrations ...
}
```

## Implementation Details

### Registration Pattern

#### Singleton Lifetime
```javascript
{
  lifetime: 'singleton',
  // Single instance shared across all requests
  // Appropriate for stateless handlers
}
```

#### Dependency Declaration
```javascript
dependencies: [
  tokens.ILogger,           // For logging
  tokens.IEntityManager,    // For entity operations
  tokens.ISafeEventDispatcher, // For error dispatching
]
```

#### Binding Function
```javascript
function bind(token) {
  return (container) => container.resolve(token);
}
```

### Integration Points

#### Container Registration Flow
1. Token defined in `tokens.js`
2. Handler class imported in registrations
3. Handler registered with container
4. Operation mapped to handler token
5. Interpreter resolves handler at runtime

#### Runtime Resolution
```javascript
// When operation executed:
const handler = operationRegistry.getHandler('LOCK_MOUTH_ENGAGEMENT');
const instance = handler(container); // Resolves from DI
await instance.execute(parameters, context);
```

## Acceptance Criteria

### Registration Requirements
- [ ] **Token Definition**: Tokens added to tokens.js
- [ ] **Handler Import**: Both handlers imported correctly
- [ ] **Container Registration**: Handlers registered with container
- [ ] **Dependency Declaration**: All dependencies specified
- [ ] **Operation Mapping**: Operations mapped to handler tokens
- [ ] **Singleton Lifetime**: Handlers use singleton lifetime

### Integration Verification
- [ ] **Resolution Test**: Handlers resolve from container
- [ ] **Dependency Injection**: Dependencies injected correctly
- [ ] **Operation Execution**: Operations execute via interpreter
- [ ] **No Circular Dependencies**: No dependency cycles
- [ ] **No Missing Dependencies**: All required services available

## Testing Strategy

### Unit Tests

File: `tests/unit/dependencyInjection/mouthEngagementRegistration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createContainer } from '../../../src/dependencyInjection/container.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerInterpreterDependencies } from '../../../src/dependencyInjection/registrations/interpreterRegistrations.js';

describe('Mouth Engagement Handler Registration', () => {
  let container;

  beforeEach(() => {
    container = createContainer();
    
    // Register mock dependencies
    container.register(tokens.ILogger, createMockLogger());
    container.register(tokens.IEntityManager, createMockEntityManager());
    container.register(tokens.ISafeEventDispatcher, createMockEventDispatcher());
    
    // Register interpreter dependencies
    registerInterpreterDependencies(container, tokens);
  });

  describe('Token Registration', () => {
    it('should have tokens for mouth engagement handlers', () => {
      expect(tokens.LockMouthEngagementHandler).toBeDefined();
      expect(tokens.UnlockMouthEngagementHandler).toBeDefined();
    });

    it('should have unique token values', () => {
      expect(tokens.LockMouthEngagementHandler)
        .not.toBe(tokens.UnlockMouthEngagementHandler);
    });
  });

  describe('Handler Resolution', () => {
    it('should resolve LockMouthEngagementHandler from container', () => {
      const handler = container.resolve(tokens.LockMouthEngagementHandler);
      
      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('LockMouthEngagementHandler');
      expect(handler.execute).toBeInstanceOf(Function);
    });

    it('should resolve UnlockMouthEngagementHandler from container', () => {
      const handler = container.resolve(tokens.UnlockMouthEngagementHandler);
      
      expect(handler).toBeDefined();
      expect(handler.constructor.name).toBe('UnlockMouthEngagementHandler');
      expect(handler.execute).toBeInstanceOf(Function);
    });

    it('should inject dependencies correctly', () => {
      const handler = container.resolve(tokens.LockMouthEngagementHandler);
      
      // Handler should have received dependencies
      // This would require exposing dependencies or testing behavior
      expect(handler).toBeDefined();
    });

    it('should use singleton lifetime', () => {
      const handler1 = container.resolve(tokens.LockMouthEngagementHandler);
      const handler2 = container.resolve(tokens.LockMouthEngagementHandler);
      
      expect(handler1).toBe(handler2); // Same instance
    });
  });

  describe('Operation Registry Integration', () => {
    it('should register LOCK_MOUTH_ENGAGEMENT operation', () => {
      const operationRegistry = container.resolve(tokens.IOperationRegistry);
      
      const handler = operationRegistry.getHandler('LOCK_MOUTH_ENGAGEMENT');
      expect(handler).toBeDefined();
    });

    it('should register UNLOCK_MOUTH_ENGAGEMENT operation', () => {
      const operationRegistry = container.resolve(tokens.IOperationRegistry);
      
      const handler = operationRegistry.getHandler('UNLOCK_MOUTH_ENGAGEMENT');
      expect(handler).toBeDefined();
    });

    it('should resolve correct handler for each operation', () => {
      const operationRegistry = container.resolve(tokens.IOperationRegistry);
      
      const lockHandler = operationRegistry.getHandler('LOCK_MOUTH_ENGAGEMENT');
      const lockInstance = lockHandler(container);
      expect(lockInstance.constructor.name).toBe('LockMouthEngagementHandler');
      
      const unlockHandler = operationRegistry.getHandler('UNLOCK_MOUTH_ENGAGEMENT');
      const unlockInstance = unlockHandler(container);
      expect(unlockInstance.constructor.name).toBe('UnlockMouthEngagementHandler');
    });
  });
});
```

### Integration Tests

File: `tests/integration/dependencyInjection/mouthEngagementDI.test.js`

```javascript
describe('Mouth Engagement DI - Integration', () => {
  let gameEngine;
  let operationInterpreter;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    operationInterpreter = gameEngine.operationInterpreter;
  });

  it('should execute LOCK_MOUTH_ENGAGEMENT through DI system', async () => {
    const actor = await createTestActor({ hasMouth: true });
    
    // Should not throw
    await operationInterpreter.execute({
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor.id }
    });
    
    // Verify mouth locked
    const mouthLocked = isMouthLocked(
      gameEngine.entityManager,
      actor.id
    );
    expect(mouthLocked).toBe(true);
  });

  it('should execute UNLOCK_MOUTH_ENGAGEMENT through DI system', async () => {
    const actor = await createTestActor({ hasMouth: true });
    
    // Lock first
    await operationInterpreter.execute({
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor.id }
    });
    
    // Then unlock
    await operationInterpreter.execute({
      type: 'UNLOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor.id }
    });
    
    // Verify mouth unlocked
    const mouthLocked = isMouthLocked(
      gameEngine.entityManager,
      actor.id
    );
    expect(mouthLocked).toBe(false);
  });
});
```

## Potential Issues and Solutions

### Issue: Handler Not Found
**Symptom**: "No handler registered for operation LOCK_MOUTH_ENGAGEMENT"  
**Solution**: Ensure operation name matches exactly in registry

### Issue: Dependency Resolution Failure
**Symptom**: "Cannot resolve dependency IEntityManager"  
**Solution**: Verify all dependencies registered before handlers

### Issue: Circular Dependencies
**Symptom**: "Circular dependency detected"  
**Solution**: Review dependency chain, ensure no cycles

### Issue: Wrong Handler Instance
**Symptom**: Operations execute wrong handler  
**Solution**: Check token uniqueness and mapping correctness

## Performance Considerations

### Registration Performance
- **One-time Cost**: Registration happens at startup
- **Singleton Reuse**: Handlers created once, reused
- **Lazy Resolution**: Handlers resolved only when needed

### Runtime Performance
- **Fast Lookup**: O(1) operation name to handler mapping
- **No Reflection**: Direct function calls after resolution
- **Minimal Overhead**: DI adds negligible runtime cost

## Definition of Done

- [ ] Tokens added to tokens.js
- [ ] Handlers imported in registrations
- [ ] Container registration implemented
- [ ] Operation registry mapping complete
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] No dependency resolution errors
- [ ] Operations executable through interpreter
- [ ] Documentation updated
- [ ] Code follows project standards
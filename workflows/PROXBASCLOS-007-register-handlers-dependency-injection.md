# PROXBASCLOS-007: Register New Handlers in Dependency Injection

**Phase**: Integration Layer  
**Priority**: High  
**Complexity**: Low  
**Dependencies**: PROXBASCLOS-003, PROXBASCLOS-004  
**Estimated Time**: 2-3 hours

## Summary

Register the new `EstablishSittingClosenessHandler` and `RemoveSittingClosenessHandler` operation handlers in the dependency injection system to make them available for rule execution. This involves updating token definitions and handler registrations following existing patterns.

## Technical Requirements

### Files to Modify

#### 1. `src/dependencyInjection/tokens.js`
Add new token definitions for the proximity closeness handlers:

```javascript
// Operation Handler Tokens (add to existing section)
IEstablishSittingClosenessHandler: 'IEstablishSittingClosenessHandler',
IRemoveSittingClosenessHandler: 'IRemoveSittingClosenessHandler',
```

#### 2. `src/dependencyInjection/registrations/operationHandlerRegistrations.js`  
Add handler registrations following the established pattern:

```javascript
import EstablishSittingClosenessHandler from '../../logic/operationHandlers/establishSittingClosenessHandler.js';
import RemoveSittingClosenessHandler from '../../logic/operationHandlers/removeSittingClosenessHandler.js';

// Add to handler registration function
container.register(
  tokens.IEstablishSittingClosenessHandler,
  EstablishSittingClosenessHandler,
  {
    dependencies: [
      tokens.ILogger,
      tokens.IEntityManager,
      tokens.IEventBus,
      tokens.IClosenessCircleService,
      tokens.IOperationContext,
    ],
  }
);

container.register(
  tokens.IRemoveSittingClosenessHandler,
  RemoveSittingClosenessHandler,
  {
    dependencies: [
      tokens.ILogger,
      tokens.IEntityManager, 
      tokens.IEventBus,
      tokens.IClosenessCircleService,
      tokens.IOperationContext,
    ],
  }
);
```

#### 3. Operation Handler Registry Integration
The handlers need to be registered with the operation execution system. This typically happens in the operation handler registry where operation types map to handler instances.

**Location**: `src/logic/operationHandlers/operationHandlerRegistry.js` (or similar)

```javascript
// Add to operation type mapping
const operationHandlers = {
  // Existing handlers...
  ESTABLISH_SITTING_CLOSENESS: container.resolve(tokens.IEstablishSittingClosenessHandler),
  REMOVE_SITTING_CLOSENESS: container.resolve(tokens.IRemoveSittingClosenessHandler),
};
```

## Integration Pattern Analysis

### Existing Handler Registration Pattern

#### Current Pattern Examination
```javascript
// From existing operationHandlerRegistrations.js
container.register(
  tokens.IMergeClosenessCircleHandler,
  MergeClosenessCircleHandler,
  {
    dependencies: [
      tokens.ILogger,
      tokens.IEntityManager,
      tokens.IEventBus,
      tokens.IClosenessCircleService,
      tokens.IOperationContext,
    ],
  }
);
```

#### Consistency Requirements
- **Dependency Pattern**: Use same dependencies as existing closeness handlers
- **Token Naming**: Follow `I{HandlerName}Handler` convention
- **Import Structure**: Use relative imports following existing patterns
- **Registration Order**: Add after existing closeness handlers for logical grouping

### Handler Constructor Requirements

#### Expected Dependencies
Based on existing closeness handlers and requirements:
```javascript
constructor({
  logger,
  entityManager,
  eventBus, 
  closenessCircleService,
  operationContext
}) {
  // Dependency validation using existing patterns
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['info', 'warn', 'error', 'debug']
  });
  validateDependency(entityManager, 'IEntityManager', logger, {
    requiredMethods: ['getComponent', 'upsertComponent', 'removeComponent']
  });
  // Additional validations...
}
```

## Acceptance Criteria

### Registration Requirements
- [ ] **Token Definition**: New handler tokens added to `tokens.js` following naming conventions
- [ ] **Handler Registration**: Both handlers registered in `operationHandlerRegistrations.js`
- [ ] **Dependency Injection**: Handlers receive all required dependencies correctly
- [ ] **Operation Mapping**: Handlers mapped to operation types in registry
- [ ] **Startup Success**: Application starts without dependency injection errors

### Integration Requirements
- [ ] **Service Dependencies**: Handlers can resolve `IClosenessCircleService` dependency
- [ ] **Operation Context**: Handlers can access and modify operation context variables
- [ ] **Entity Manager**: Handlers can query and modify component data
- [ ] **Event Bus**: Handlers can dispatch success/error events
- [ ] **Logger**: Handlers can log operations at appropriate levels

### Validation Requirements
- [ ] **Dependency Validation**: All dependencies validated using existing patterns
- [ ] **Constructor Logic**: Handlers initialize correctly with provided dependencies
- [ ] **Error Handling**: Missing or invalid dependencies cause clear error messages
- [ ] **Runtime Access**: Handlers accessible through operation execution system

## Implementation Details

### Token Definition Integration

#### Current Token Structure (Partial)
```javascript
export const tokens = {
  // ... existing tokens
  
  // Operation Handler Tokens
  IMergeClosenessCircleHandler: 'IMergeClosenessCircleHandler',
  IRemoveFromClosenessCircleHandler: 'IRemoveFromClosenessCircleHandler',
  
  // NEW: Add proximity closeness handlers
  IEstablishSittingClosenessHandler: 'IEstablishSittingClosenessHandler',
  IRemoveSittingClosenessHandler: 'IRemoveSittingClosenessHandler',
};
```

#### Alphabetical Ordering
Maintain alphabetical ordering within the operation handler token section for consistency.

### Registration Function Integration

#### Current Registration Pattern
```javascript
export function registerOperationHandlers(container) {
  // Existing handler registrations...
  
  // Closeness-related handlers (grouped together)
  container.register(tokens.IMergeClosenessCircleHandler, MergeClosenessCircleHandler, {
    dependencies: [/* standard dependencies */]
  });
  
  container.register(tokens.IRemoveFromClosenessCircleHandler, RemoveFromClosenessCircleHandler, {
    dependencies: [/* standard dependencies */]
  });
  
  // NEW: Add proximity closeness handlers in logical group
  container.register(tokens.IEstablishSittingClosenessHandler, EstablishSittingClosenessHandler, {
    dependencies: [
      tokens.ILogger,
      tokens.IEntityManager,
      tokens.IEventBus,
      tokens.IClosenessCircleService,
      tokens.IOperationContext,
    ],
  });
  
  container.register(tokens.IRemoveSittingClosenessHandler, RemoveSittingClosenessHandler, {
    dependencies: [
      tokens.ILogger,
      tokens.IEntityManager,
      tokens.IEventBus,
      tokens.IClosenessCircleService,
      tokens.IOperationContext,
    ],
  });
}
```

### Import Statement Organization

#### Import Grouping Strategy
```javascript
// Core dependencies (keep existing)
import { tokens } from '../tokens.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

// Existing operation handlers (keep existing imports)
import MergeClosenessCircleHandler from '../../logic/operationHandlers/mergeClosenessCircleHandler.js';
import RemoveFromClosenessCircleHandler from '../../logic/operationHandlers/removeFromClosenessCircleHandler.js';

// NEW: Proximity closeness handlers (add after existing closeness handlers)
import EstablishSittingClosenessHandler from '../../logic/operationHandlers/establishSittingClosenessHandler.js';
import RemoveSittingClosenessHandler from '../../logic/operationHandlers/removeSittingClosenessHandler.js';
```

## Testing Strategy

### Dependency Injection Tests
File: `tests/unit/dependencyInjection/operationHandlerRegistrations.test.js` (modify existing)

#### Registration Tests
```javascript
describe('Operation Handler Registrations - Proximity Closeness', () => {
  it('should register EstablishSittingClosenessHandler with correct dependencies', () => {
    const container = createTestContainer();
    registerOperationHandlers(container);
    
    const handler = container.resolve(tokens.IEstablishSittingClosenessHandler);
    expect(handler).toBeInstanceOf(EstablishSittingClosenessHandler);
    expect(handler).toHaveBeenConstructedWith({
      logger: expect.any(Object),
      entityManager: expect.any(Object),
      eventBus: expect.any(Object),
      closenessCircleService: expect.any(Object),
      operationContext: expect.any(Object),
    });
  });
  
  it('should register RemoveSittingClosenessHandler with correct dependencies', () => {
    const container = createTestContainer();
    registerOperationHandlers(container);
    
    const handler = container.resolve(tokens.IRemoveSittingClosenessHandler);
    expect(handler).toBeInstanceOf(RemoveSittingClosenessHandler);
  });
  
  it('should resolve handlers without circular dependencies', () => {
    const container = createTestContainer();
    registerOperationHandlers(container);
    
    expect(() => container.resolve(tokens.IEstablishSittingClosenessHandler)).not.toThrow();
    expect(() => container.resolve(tokens.IRemoveSittingClosenessHandler)).not.toThrow();
  });
});
```

### Operation Registry Integration Tests  
File: `tests/integration/operationHandlers/operationHandlerRegistry.integration.test.js` (modify existing)

#### Operation Type Mapping Tests
```javascript
describe('Operation Handler Registry - Proximity Closeness Integration', () => {
  it('should map ESTABLISH_SITTING_CLOSENESS to correct handler', () => {
    const registry = createOperationRegistry();
    const handler = registry.getHandler('ESTABLISH_SITTING_CLOSENESS');
    
    expect(handler).toBeInstanceOf(EstablishSittingClosenessHandler);
  });
  
  it('should map REMOVE_SITTING_CLOSENESS to correct handler', () => {
    const registry = createOperationRegistry();
    const handler = registry.getHandler('REMOVE_SITTING_CLOSENESS');
    
    expect(handler).toBeInstanceOf(RemoveSittingClosenessHandler);
  });
  
  it('should execute proximity operations through registry', async () => {
    const registry = createOperationRegistry();
    
    const result = await registry.executeOperation('ESTABLISH_SITTING_CLOSENESS', {
      furniture_id: 'test:couch',
      actor_id: 'test:alice', 
      spot_index: 1
    });
    
    expect(result).toBeDefined();
  });
});
```

### Application Startup Tests
File: `tests/integration/startup/dependencyInjectionStartup.test.js` (modify existing)

#### Startup Integration Tests
```javascript
describe('Startup - Proximity Closeness Handler Integration', () => {
  it('should start application without dependency injection errors', async () => {
    const app = await startApplication();
    expect(app).toBeRunning();
    expect(app.errors).toHaveLength(0);
  });
  
  it('should resolve proximity handlers during startup', async () => {
    const container = await getApplicationContainer();
    
    const establishHandler = container.resolve(tokens.IEstablishSittingClosenessHandler);
    const removeHandler = container.resolve(tokens.IRemoveSittingClosenessHandler);
    
    expect(establishHandler).toBeInstanceOf(EstablishSittingClosenessHandler);
    expect(removeHandler).toBeInstanceOf(RemoveSittingClosenessHandler);
  });
});
```

## Error Scenarios and Handling

### Missing Dependencies
```javascript
// Handler should validate dependencies in constructor
constructor({ logger, entityManager, eventBus, closenessCircleService, operationContext }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['info', 'warn', 'error', 'debug'],
  });
  // Additional validations...
  
  if (!closenessCircleService) {
    throw new Error('EstablishSittingClosenessHandler requires IClosenessCircleService dependency');
  }
}
```

### Registration Errors
- **Missing Token**: Clear error if token not defined in tokens.js
- **Circular Dependencies**: Detect and report circular dependency issues
- **Invalid Constructor**: Validate handler class has correct constructor signature

### Runtime Resolution Errors
- **Unregistered Handler**: Clear error if operation type not mapped to handler
- **Missing Context**: Validate operation context is available when needed

## Implementation Checklist

### Phase 1: Token and Registration Setup
- [ ] Add new handler tokens to `tokens.js` 
- [ ] Import new handler classes in `operationHandlerRegistrations.js`
- [ ] Add registration calls with correct dependency arrays
- [ ] Verify alphabetical ordering and grouping

### Phase 2: Operation Registry Integration
- [ ] Map operation types to handler instances in registry
- [ ] Verify handlers are accessible through operation execution system
- [ ] Test operation type resolution

### Phase 3: Testing and Validation
- [ ] Create dependency injection unit tests
- [ ] Create operation registry integration tests
- [ ] Test application startup with new handlers
- [ ] Verify error handling for missing dependencies

### Phase 4: Documentation and Review
- [ ] Document new handler registrations
- [ ] Update dependency injection documentation if needed
- [ ] Code review focusing on registration patterns

## Definition of Done
- [ ] Handler tokens added to tokens.js following naming conventions
- [ ] Handlers registered in operationHandlerRegistrations.js with correct dependencies  
- [ ] Handlers mapped to operation types in operation registry
- [ ] Application starts successfully without dependency injection errors
- [ ] Handlers can be resolved and constructed with valid dependencies
- [ ] Unit tests verify correct registration and dependency injection
- [ ] Integration tests verify handlers accessible through operation execution
- [ ] Error handling works correctly for missing dependencies
- [ ] Code follows existing patterns and conventions
- [ ] Documentation updated as needed
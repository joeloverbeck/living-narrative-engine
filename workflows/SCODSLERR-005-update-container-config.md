# SCODSLERR-005: Update Container Configuration

## Overview

Register the new error handling components in the dependency injection container and update resolver registrations to include the error handler dependency.

## Objectives

- Register IScopeDslErrorFactory in container
- Register IScopeDslErrorHandler in container
- Update resolver registrations to include error handler
- Ensure proper dependency resolution order
- Maintain backward compatibility during transition

## Implementation Details

### Location

`src/dependencyInjection/containerConfig.js` (or appropriate container config file)

### New Service Registrations

#### 1. Error Factory Registration

```javascript
container.register('IScopeDslErrorFactory', () => {
  const ScopeDslErrorFactory =
    require('./scopeDsl/core/errorFactory.js').default;
  return new ScopeDslErrorFactory();
});
```

#### 2. Error Handler Registration

```javascript
container.register('IScopeDslErrorHandler', (deps) => {
  const ScopeDslErrorHandler =
    require('./scopeDsl/core/scopeDslErrorHandler.js').default;
  return new ScopeDslErrorHandler({
    logger: deps.get('ILogger'),
    errorFactory: deps.get('IScopeDslErrorFactory'),
    config: {
      isDevelopment: process.env.NODE_ENV !== 'production',
      maxBufferSize: 100,
    },
  });
});
```

#### 3. Token Additions

Add to `src/dependencyInjection/tokens.js`:

```javascript
export const IScopeDslErrorFactory = 'IScopeDslErrorFactory';
export const IScopeDslErrorHandler = 'IScopeDslErrorHandler';
```

### Resolver Updates

Update existing resolver registrations to include error handler:

```javascript
container.register('filterResolver', (deps) => {
  return createFilterResolver({
    logicEval: deps.get('ILogicEvaluator'),
    entitiesGateway: deps.get('IEntityGateway'),
    locationProvider: deps.get('ILocationProvider'),
    errorHandler: deps.get('IScopeDslErrorHandler'), // New dependency
  });
});
```

### Configuration Strategy

1. Add error handler as optional dependency initially
2. Resolvers check for presence and use if available
3. Allows gradual migration without breaking existing code

## Acceptance Criteria

- [ ] Error factory registered in container
- [ ] Error handler registered in container
- [ ] Tokens added to tokens.js
- [ ] Container can resolve both new services
- [ ] Dependencies properly injected
- [ ] Configuration respects environment
- [ ] No circular dependency issues
- [ ] Existing functionality not broken

## Testing Requirements

- Integration test for container registration
- Test dependency resolution
- Test configuration values passed correctly
- Verify singleton behavior if applicable
- Test with both development and production configs

## Dependencies

- SCODSLERR-001: Error handler implementation
- SCODSLERR-002: Error factory implementation
- SCODSLERR-003: Error constants

## Estimated Effort

- Implementation: 2 hours
- Testing: 2 hours
- Total: 4 hours

## Risk Assessment

- **Medium Risk**: Changes to core dependency injection
- **Mitigation**: Make error handler optional initially, test thoroughly

## Related Spec Sections

- Section 4.2: Container Registration
- Section 4.1: Dependency Injection Setup

## Rollback Plan

If issues occur:

1. Remove new registrations from container
2. Remove error handler from resolver dependencies
3. Resolvers continue using existing error handling

## Migration Notes

- Start with error handler as optional dependency
- Update resolvers one by one in Phase 2
- Once all resolvers updated, make required
- Remove fallback logic after full migration

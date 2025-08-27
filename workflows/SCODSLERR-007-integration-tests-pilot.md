# SCODSLERR-007: Create Integration Tests for Pilot Resolver

## Overview
Create comprehensive integration tests for the migrated filterResolver to validate the new error handling system in real-world scenarios.

## Objectives
- Test filterResolver with new error handling
- Validate error buffer population
- Test error categorization in practice
- Ensure backward compatibility
- Validate dev vs prod behavior

## Implementation Details

### Location
`tests/integration/scopeDsl/filterResolverErrorHandling.integration.test.js`

### Test Scenarios

#### 1. Missing Context Tests
```javascript
describe('FilterResolver Error Handling - Missing Context', () => {
  it('should handle missing actor with proper error code', async () => {
    const scopeWithFilter = 'actor.items[{"==": [{"var": "type"}, "weapon"]}]';
    const context = { depth: 0 }; // No actor
    
    await expect(scopeEngine.resolve(scopeWithFilter, context))
      .rejects.toThrow(ScopeDslError);
    
    const errors = errorHandler.getErrorBuffer();
    expect(errors[0].code).toBe('SCOPE_1001');
    expect(errors[0].category).toBe('missing_context');
  });
});
```

#### 2. Invalid Filter Tests
```javascript
describe('FilterResolver Error Handling - Invalid Filters', () => {
  it('should handle malformed JSON Logic filter', async () => {
    const invalidFilter = 'actor.items[{"invalid": "filter"}]';
    
    await expect(scopeEngine.resolve(invalidFilter, validContext))
      .rejects.toThrow(ScopeDslError);
    
    const errors = errorHandler.getErrorBuffer();
    expect(errors[0].code).toBe('SCOPE_2003');
    expect(errors[0].category).toBe('invalid_data');
  });
});
```

#### 3. Error Buffer Management
```javascript
describe('Error Buffer Management', () => {
  it('should accumulate multiple errors in buffer', async () => {
    // Trigger multiple different errors
    const errors = [
      { scope: 'invalid.scope', expectedCode: 'SCOPE_3002' },
      { scope: 'actor[missing]', expectedCode: 'SCOPE_1001' },
      { scope: 'cycle.reference', expectedCode: 'SCOPE_4001' }
    ];
    
    for (const test of errors) {
      try {
        await scopeEngine.resolve(test.scope, context);
      } catch (e) {
        // Expected
      }
    }
    
    const buffer = errorHandler.getErrorBuffer();
    expect(buffer).toHaveLength(3);
    expect(buffer.map(e => e.code)).toEqual(
      errors.map(e => e.expectedCode)
    );
  });
});
```

#### 4. Environment-Specific Behavior
```javascript
describe('Environment-Specific Error Handling', () => {
  it('should log detailed errors in development', async () => {
    const devContainer = createTestContainer({ isDevelopment: true });
    // Test detailed logging
  });
  
  it('should log minimal errors in production', async () => {
    const prodContainer = createTestContainer({ isDevelopment: false });
    // Test minimal logging
  });
});
```

### Performance Testing
```javascript
describe('Error Handling Performance', () => {
  it('should handle errors efficiently', async () => {
    const iterations = 1000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      try {
        await scopeEngine.resolve('invalid', context);
      } catch (e) {
        // Expected
      }
    }
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // <0.1ms per error
  });
});
```

## Acceptance Criteria
- [ ] All integration tests pass
- [ ] Error codes correctly assigned
- [ ] Error buffer populated properly
- [ ] Categories match expectations
- [ ] Performance requirements met
- [ ] Dev/prod behavior verified
- [ ] No memory leaks detected
- [ ] Backward compatibility maintained

## Testing Requirements
- Use real container with all dependencies
- Test with actual scope resolution
- Include edge cases and error paths
- Performance benchmarks included
- Memory usage monitored
- Both sync and async error paths

## Dependencies
- SCODSLERR-006: FilterResolver migration completed
- SCODSLERR-005: Container configuration

## Estimated Effort
- Test implementation: 4 hours
- Performance tests: 1 hour
- Documentation: 1 hour
- Total: 6 hours

## Risk Assessment
- **Low Risk**: Testing implementation
- **Consideration**: May reveal issues requiring resolver changes

## Related Spec Sections
- Section 5.2: Integration Tests
- Section 7.1: Success Metrics
- Section 5.3: Performance Tests

## Test Data Setup
```javascript
const createTestContext = () => ({
  actorEntity: { id: 'test-actor' },
  depth: 0,
  dispatcher: mockDispatcher,
  scopeRegistry: mockRegistry,
  locationProvider: mockLocationProvider
});

const createInvalidContext = () => ({
  depth: 0
  // Missing required properties
});
```
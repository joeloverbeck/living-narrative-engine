# ScopeDSL Error Handling Standardization Specification

## 1. Overview

### 1.1 Purpose

This specification defines the standardization of error handling across all ScopeDSL resolvers to address inconsistent error patterns, code duplication, and performance issues identified in the architecture improvement analysis. The new system will provide centralized, environment-aware error handling with consistent formatting and reduced overhead.

### 1.2 Current State Problems

Based on the architecture analysis, the current error handling exhibits:

- **Mixed Debug/Production Patterns**: 30+ lines of debug logging mixed with production code in each resolver
- **Code Duplication**: Similar error handling logic repeated across 10+ resolver files (~200 lines total)
- **Performance Impact**: Debug checks and console.error calls in hot paths even when not needed
- **Inconsistent Messages**: Each resolver formats errors differently, making debugging harder
- **No Error Buffering**: Lost error context when multiple errors occur in succession
- **Direct Console Access**: Violates project principle of event-based error handling

### 1.3 Goals

- **Centralized Error Handling**: Single source of truth for error processing
- **Environment Awareness**: Different behavior for development vs production
- **Zero Production Overhead**: No debug code execution in production mode
- **Consistent Error Format**: Standardized error messages across all resolvers
- **Error Analysis Support**: Error buffering and categorization for debugging
- **Integration with Logging**: Use existing ILogger infrastructure, not console

### 1.4 Requirements

- Must maintain backward compatibility with existing error types
- Must integrate with existing ILogger infrastructure
- Must support dependency injection pattern
- Must provide actionable error messages for developers
- Must sanitize context to prevent circular reference issues
- Must handle high-frequency errors without memory leaks

### 1.5 Constraints

- Cannot modify existing ScopeDslError base class interface
- Must work with existing test infrastructure
- Must maintain 80%+ test coverage
- Must follow project validation patterns
- Must use dependency injection for all services

## 2. Architecture Design

### 2.1 System Components

```
┌─────────────────────────────────────────────────┐
│                  Resolvers                       │
│  (filterResolver, stepResolver, etc.)            │
└─────────────────┬───────────────────────────────┘
                  │ throws
                  ▼
┌─────────────────────────────────────────────────┐
│           ScopeDslErrorHandler                   │
│  - Environment detection                         │
│  - Context sanitization                          │
│  - Error categorization                          │
│  - Buffer management                             │
└─────────────────┬───────────────────────────────┘
                  │ uses
                  ▼
┌─────────────────────────────────────────────────┐
│     ErrorFactory (Enhanced)                      │
│  - Typed error creation                          │
│  - Message templates                             │
│  - Code generation                               │
└─────────────────┬───────────────────────────────┘
                  │ creates
                  ▼
┌─────────────────────────────────────────────────┐
│           ScopeDslError                          │
│  (Base error class - unchanged)                  │
└──────────────────────────────────────────────────┘
```

### 2.2 Error Categories

```javascript
const ErrorCategories = {
  MISSING_CONTEXT: 'missing_context',
  INVALID_DATA: 'invalid_data',
  RESOLUTION_FAILURE: 'resolution_failure',
  CYCLE_DETECTED: 'cycle_detected',
  DEPTH_EXCEEDED: 'depth_exceeded',
  PARSE_ERROR: 'parse_error',
  CONFIGURATION: 'configuration',
  UNKNOWN: 'unknown'
};
```

### 2.3 Error Codes

Standardized error codes for common scenarios:

```javascript
const ErrorCodes = {
  // Context errors (1xxx)
  MISSING_ACTOR: 'SCOPE_1001',
  INVALID_ACTOR_ID: 'SCOPE_1002',
  MISSING_DISPATCHER: 'SCOPE_1003',
  MISSING_REGISTRY: 'SCOPE_1004',
  
  // Node errors (2xxx)
  INVALID_NODE_TYPE: 'SCOPE_2001',
  MISSING_NODE_PARENT: 'SCOPE_2002',
  INVALID_NODE_STRUCTURE: 'SCOPE_2003',
  
  // Resolution errors (3xxx)
  RESOLUTION_FAILED: 'SCOPE_3001',
  SCOPE_NOT_FOUND: 'SCOPE_3002',
  FILTER_EVAL_FAILED: 'SCOPE_3003',
  
  // System errors (4xxx)
  CYCLE_DETECTED: 'SCOPE_4001',
  MAX_DEPTH_EXCEEDED: 'SCOPE_4002',
  MEMORY_LIMIT: 'SCOPE_4003'
};
```

## 3. Implementation Details

### 3.1 ScopeDslErrorHandler Class

Location: `src/scopeDsl/core/scopeDslErrorHandler.js`

```javascript
/**
 * Centralized error handler for ScopeDSL system
 * @implements {IScopeDslErrorHandler}
 */
class ScopeDslErrorHandler {
  #logger;
  #isDevelopment;
  #errorBuffer;
  #maxBufferSize;
  #errorFactory;
  
  constructor({ logger, errorFactory, config = {} }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['error', 'warn', 'debug']
    });
    validateDependency(errorFactory, 'IErrorFactory', console, {
      requiredMethods: ['create']
    });
    
    this.#logger = logger;
    this.raffeine,
    this.#isDevelopment = config.isDevelopment ?? 
      (process.env.NODE_ENV !== 'production');
    this.#errorBuffer = [];
    this.#maxBufferSize = config.maxBufferSize ?? 100;
    this.#errorFactory = errorFactory;
  }
  
  /**
   * Handle an error with environment-aware processing
   * @param {Error|string} error - The error or message
   * @param {object} context - Resolution context
   * @param {string} resolverName - Name of the resolver
   * @param {string} [errorCode] - Optional error code
   * @throws {ScopeDslError} Always throws a clean error
   */
  handleError(error, context, resolverName, errorCode = null) {
    // Create error info
    const errorInfo = this.#createErrorInfo(
      error, 
      context, 
      resolverName, 
      errorCode
    );
    
    // Buffer for analysis
    this.#bufferError(errorInfo);
    
    // Log based on environment
    if (this.#isDevelopment) {
      this.#logDetailedError(errorInfo);
    } else {
      this.#logProductionError(errorInfo);
    }
    
    // Always throw clean error
    throw this.#errorFactory.create(
      errorInfo.code,
      errorInfo.message,
      {
        resolver: resolverName,
        category: errorInfo.category
      }
    );
  }
  
  /**
   * Create standardized error info
   * @private
   */
  #createErrorInfo(error, context, resolverName, errorCode) {
    const message = typeof error === 'string' ? error : error.message;
    const code = errorCode || this.#detectErrorCode(message, context);
    
    return {
      timestamp: Date.now(),
      message: this.#formatMessage(message, resolverName),
      code,
      category: this.#categorizeError(code, message),
      resolver: resolverName,
      context: this.#sanitizeContext(context),
      stack: error instanceof Error ? error.stack : null
    };
  }
  
  /**
   * Sanitize context to prevent circular references
   * @private
   */
  #sanitizeContext(context) {
    if (!context) return null;
    
    return {
      hasActorEntity: !!context.actorEntity,
      actorId: context.actorEntity?.id,
      depth: context.depth,
      nodeType: context.node?.type,
      nodeValue: context.node?.value,
      hasDampatcher: !!context.dispatcher,
      hasRegistry: !!context.scopeRegistry,
      // Avoid logging full objects that may have circulars
      keys: Object.keys(context)
        .filter(k => !['dispatcher', 'cycleDetector', 'actorEntity'].includes(k))
    };
  }
  
  /**
   * Categorize error based on code and message
   * @private
   */
  #categorizeError(code, message) {
    if (code.startsWith('SCOPE_1')) return ErrorCategories.MISSING_CONTEXT;
    if (code.startsWith('SCOPE_2')) return ErrorCategories.INVALID_DATA;
    if (code.startsWith('SCOPE_3')) return ErrorCategories.RESOLUTION_FAILURE;
    if (code.startsWith('SCOPE_4')) return ErrorCategories.CONFIGURATION;
    
    // Pattern matching for uncoded errors
    if (message.includes('missing') || message.includes('undefined')) {
      return ErrorCategories.MISSING_CONTEXT;
    }
    if (message.includes('invalid') || message.includes('malformed')) {
      return ErrorCategories.INVALID_DATA;
    }
    if (message.includes('cycle')) {
      return ErrorCategories.CYCLE_DETECTED;
    }
    
    return ErrorCategories.UNKNOWN;
  }
  
  /**
   * Buffer error for later analysis
   * @private
   */
  #bufferError(errorInfo) {
    this.#errorBuffer.push(errorInfo);
    
    // Maintain buffer size limit
    if (this.#errorBuffer.length > this.#maxBufferSize) {
      this.#errorBuffer.shift();
    }
  }
  
  /**
   * Get error buffer for analysis
   * @returns {Array} Recent errors
   */
  getErrorBuffer() {
    return [...this.#errorBuffer];
  }
  
  /**
   * Clear error buffer
   */
  clearErrorBuffer() {
    this.#errorBuffer = [];
  }
}
```

### 3.2 Enhanced Error Factory

Location: `src/scopeDsl/core/errorFactory.js` (Enhanced version)

```javascript
import { ScopeDslError } from '../errors/scopeDslError.js';

/**
 * Enhanced factory for creating standardized ScopeDSL errors
 */
class ScopeDslErrorFactory {
  #templates;
  
  constructor() {
    this.#templates = this.#initializeTemplates();
  }
  
  /**
   * Create a typed error with code
   * @param {string} code - Error code from ErrorCodes
   * @param {string} message - Error message
   * @param {object} metadata - Additional error metadata
   * @returns {ScopeDslError} Typed error instance
   */
  create(code, message, metadata = {}) {
    const error = new ScopeDslError(message);
    error.code = code;
    error.metadata = metadata;
    return error;
  }
  
  /**
   * Create error from template
   * @param {string} templateKey - Template identifier
   * @param {object} params - Parameters for template
   * @returns {ScopeDslError} Error from template
   */
  fromTemplate(templateKey, params = {}) {
    const template = this.#templates[templateKey];
    if (!template) {
      return this.create('SCOPE_9999', `Unknown error template: ${templateKey}`);
    }
    
    const message = this.#interpolate(template.message, params);
    return this.create(template.code, message, params);
  }
  
  /**
   * Initialize error message templates
   * @private
   */
  #initializeTemplates() {
    return {
      missingActor: {
        code: 'SCOPE_1001',
        message: '{resolver}: actorEntity is missing from context'
      },
      invalidActorId: {
        code: 'SCOPE_1002',
        message: '{resolver}: actorEntity has invalid ID: {actorId}'
      },
      missingDispatcher: {
        code: 'SCOPE_1003',
        message: '{resolver}: dispatcher function is missing from context'
      },
      scopeNotFound: {
        code: 'SCOPE_3002',
        message: 'Referenced scope not found: {scopeId}'
      },
      cycleDetected: {
        code: 'SCOPE_4001',
        message: 'Circular reference detected: {path}'
      },
      depthExceeded: {
        code: 'SCOPE_4002',
        message: 'Maximum depth {maxDepth} exceeded at depth {currentDepth}'
      }
    };
  }
  
  /**
   * Interpolate template with parameters
   * @private
   */
  #interpolate(template, params) {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }
}

export default ScopeDslErrorFactory;
```

### 3.3 Resolver Integration Pattern

Example migration for `filterResolver.js`:

```javascript
// Before: Mixed debug/production error handling
if (!actorEntity) {
  if (trace) {
    const error = new Error('FilterResolver: actorEntity is undefined...');
    console.error('[CRITICAL] FilterResolver context missing actorEntity:', {
      // 30+ lines of debug object
    });
    throw error;
  }
  throw new Error('FilterResolver: actorEntity is undefined in context');
}

// After: Clean, centralized error handling
if (!actorEntity) {
  errorHandler.handleError(
    'actorEntity is missing from context',
    ctx,
    'FilterResolver',
    ErrorCodes.MISSING_ACTOR
  );
}
```

## 4. Migration Strategy

### 4.1 Dependency Injection Setup

Each resolver will receive the error handler via dependency injection:

```javascript
export default function createFilterResolver({
  logicEval,
  entitiesGateway,
  locationProvider,
  errorHandler  // New dependency
}) {
  // Validate error handler
  validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
    requiredMethods: ['handleError', 'getErrorBuffer']
  });
  
  return {
    resolve(node, ctx) {
      // Use error handler for all error scenarios
      if (!ctx.actorEntity) {
        errorHandler.handleError(
          'actorEntity is missing',
          ctx,
          'FilterResolver',
          ErrorCodes.MISSING_ACTOR
        );
      }
      // ... rest of resolver logic
    }
  };
}
```

### 4.2 Container Registration

Update the dependency injection container:

```javascript
// In container configuration
import ScopeDslErrorHandler from './scopeDsl/core/scopeDslErrorHandler.js';
import ScopeDslErrorFactory from './scopeDsl/core/errorFactory.js';

container.register('IScopeDslErrorFactory', () => new ScopeDslErrorFactory());

container.register('IScopeDslErrorHandler', (deps) => {
  return new ScopeDslErrorHandler({
    logger: deps.get('ILogger'),
    errorFactory: deps.get('IScopeDslErrorFactory'),
    config: {
      isDevelopment: process.env.NODE_ENV !== 'production',
      maxBufferSize: 100
    }
  });
});

// Update resolver registrations to include error handler
container.register('filterResolver', (deps) => {
  return createFilterResolver({
    logicEval: deps.get('ILogicEvaluator'),
    entitiesGateway: deps.get('IEntityGateway'),
    locationProvider: deps.get('ILocationProvider'),
    errorHandler: deps.get('IScopeDslErrorHandler')
  });
});
```

## 5. Testing Strategy

### 5.1 Unit Tests

Location: `tests/unit/scopeDsl/core/scopeDslErrorHandler.test.js`

```javascript
describe('ScopeDslErrorHandler', () => {
  let errorHandler;
  let mockLogger;
  let mockErrorFactory;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
    mockErrorFactory = {
      create: jest.fn((code, message) => new ScopeDslError(message))
    };
    
    errorHandler = new ScopeDslErrorHandler({
      logger: mockLogger,
      errorFactory: mockErrorFactory,
      config: { isDevelopment: true }
    });
  });
  
  describe('Error Handling', () => {
    it('should create standardized error info', () => {
      const context = {
        actorEntity: { id: 'test-actor' },
        depth: 3,
        node: { type: 'Filter' }
      };
      
      expect(() => {
        errorHandler.handleError(
          'Test error',
          context,
          'TestResolver',
          'SCOPE_1001'
        );
      }).toThrow(ScopeDslError);
      
      expect(mockErrorFactory.create).toHaveBeenCalledWith(
        'SCOPE_1001',
        expect.stringContaining('Test error'),
        expect.objectContaining({
          resolver: 'TestResolver',
          category: 'missing_context'
        })
      );
    });
    
    it('should sanitize context to prevent circular references', () => {
      const circularObj = {};
      circularObj.self = circularObj;
      
      const context = {
        actorEntity: { id: 'test' },
        circular: circularObj
      };
      
      expect(() => {
        errorHandler.handleError('Error', context, 'Test');
      }).not.toThrow(TypeError); // No circular reference error
    });
    
    it('should buffer errors up to maxBufferSize', () => {
      const handler = new ScopeDslErrorHandler({
        logger: mockLogger,
        errorFactory: mockErrorFactory,
        config: { maxBufferSize: 3 }
      });
      
      // Add 5 errors
      for (let i = 0; i < 5; i++) {
        try {
          handler.handleError(`Error ${i}`, {}, 'Test');
        } catch (e) {
          // Expected to throw
        }
      }
      
      const buffer = handler.getErrorBuffer();
      expect(buffer).toHaveLength(3);
      expect(buffer[0].message).toContain('Error 2');
    });
  });
  
  describe('Environment Behavior', () => {
    it('should log detailed errors in development', () => {
      const devHandler = new ScopeDslErrorHandler({
        logger: mockLogger,
        errorFactory: mockErrorFactory,
        config: { isDevelopment: true }
      });
      
      try {
        devHandler.handleError('Test', {}, 'Test');
      } catch (e) {}
      
      expect(mockLogger.debug).toHaveBeenCalled();
    });
    
    it('should log minimal errors in production', () => {
      const prodHandler = new ScopeDslErrorHandler({
        logger: mockLogger,
        errorFactory: mockErrorFactory,
        config: { isDevelopment: false }
      });
      
      try {
        prodHandler.handleError('Test', {}, 'Test');
      } catch (e) {}
      
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.not.stringContaining('Full context')
      );
    });
  });
});
```

### 5.2 Integration Tests

Location: `tests/integration/scopeDsl/errorHandlingIntegration.test.js`

```javascript
describe('ScopeDSL Error Handling Integration', () => {
  let container;
  let scopeEngine;
  let errorHandler;
  
  beforeEach(async () => {
    container = await createTestContainer();
    scopeEngine = container.get('IScopeEngine');
    errorHandler = container.get('IScopeDslErrorHandler');
  });
  
  it('should handle missing actor errors consistently', async () => {
    const scopeWithFilter = 'actor.items[{"==": [{"var": "type"}, "weapon"]}]';
    
    // Remove actor from context
    const context = { depth: 0 };
    
    await expect(scopeEngine.resolve(scopeWithFilter, context))
      .rejects.toThrow(ScopeDslError);
    
    const errors = errorHandler.getErrorBuffer();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('SCOPE_1001');
    expect(errors[0].category).toBe('missing_context');
  });
  
  it('should handle cycle detection errors', async () => {
    // Create circular scope reference
    const registry = container.get('IScopeRegistry');
    registry.register('scope1', 'scope2');
    registry.register('scope2', 'scope1');
    
    await expect(scopeEngine.resolve('scope1', defaultContext))
      .rejects.toThrow(ScopeDslError);
    
    const errors = errorHandler.getErrorBuffer();
    expect(errors[0].code).toBe('SCOPE_4001');
    expect(errors[0].category).toBe('cycle_detected');
  });
});
```

### 5.3 Performance Tests

Location: `tests/performance/scopeDsl/errorHandling.performance.test.js`

```javascript
describe('Error Handling Performance', () => {
  it('should have minimal overhead in production mode', () => {
    const prodHandler = new ScopeDslErrorHandler({
      logger: noOpLogger,
      errorFactory: new ScopeDslErrorFactory(),
      config: { isDevelopment: false }
    });
    
    const iterations = 10000;
    const context = { actorEntity: { id: 'test' }, depth: 1 };
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        prodHandler.handleError('Test error', context, 'PerfTest');
      } catch (e) {
        // Expected
      }
    }
    const duration = performance.now() - start;
    
    // Should handle 10k errors in under 100ms
    expect(duration).toBeLessThan(100);
    
    // Average time per error should be under 0.01ms
    expect(duration / iterations).toBeLessThan(0.01);
  });
});
```

## 6. Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. Create `ScopeDslErrorHandler` class
2. Enhance `errorFactory.js` with templates
3. Add error codes and categories
4. Write unit tests for error handler
5. Update container configuration

### Phase 2: Resolver Migration (Week 2)
1. Update `filterResolver.js` as pilot
2. Validate approach with integration tests
3. Migrate remaining resolvers:
   - `sourceResolver.js`
   - `stepResolver.js`
   - `scopeReferenceResolver.js`
   - `arrayIterationResolver.js`
   - `unionResolver.js`
   - `slotAccessResolver.js`
   - `clothingStepResolver.js`

### Phase 3: Cleanup (Week 3)
1. Remove all `console.error` calls
2. Remove debug-specific code blocks
3. Update documentation
4. Performance validation
5. Final integration testing

### Phase 4: Monitoring & Documentation (Week 4)
1. Add error analytics endpoints
2. Create error handling guide
3. Update developer documentation
4. Set up error monitoring dashboards
5. Train team on new patterns

## 7. Validation Criteria

### 7.1 Success Metrics

| Metric | Target | Validation Method |
|--------|--------|------------------|
| Code Reduction | >180 lines removed | Line count analysis |
| Error Consistency | 100% standardized | Code review |
| Performance Impact | <2ms overhead | Performance tests |
| Test Coverage | >85% branches | Jest coverage report |
| Memory Usage | No increase | Memory profiling |
| Developer Experience | Improved | Team feedback |

### 7.2 Testing Requirements

- All resolvers must have error handling tests
- Integration tests must cover all error categories
- Performance tests must validate production overhead
- Memory tests must confirm no leaks from buffering

### 7.3 Documentation Standards

Required documentation:
- API documentation for `ScopeDslErrorHandler`
- Migration guide for resolver authors
- Error code reference guide
- Troubleshooting guide with common errors

## 8. Risk Mitigation

### 8.1 Identified Risks

1. **Breaking Changes**: Existing code may depend on error message format
   - Mitigation: Maintain backward-compatible error messages
   - Rollback: Feature flag for gradual rollout

2. **Performance Regression**: New abstraction may add overhead
   - Mitigation: Performance tests in CI/CD
   - Rollback: Direct error throwing fallback

3. **Memory Leaks**: Error buffering could retain references
   - Mitigation: Bounded buffer with automatic cleanup
   - Monitoring: Memory profiling in tests

4. **Lost Debug Information**: Less verbose errors in production
   - Mitigation: Error buffer for post-mortem analysis
   - Alternative: Optional verbose mode flag

### 8.2 Rollback Plan

If issues arise, rollback strategy:
1. Revert container configuration changes
2. Restore original resolver error handling
3. Keep error handler as optional dependency
4. Gradual migration with feature flags

## 9. Future Enhancements

Potential future improvements:
- Error telemetry and remote reporting
- Machine learning for error pattern detection
- Automatic error recovery strategies
- Error correlation across resolution chains
- Visual error flow debugging tools

## 10. Conclusion

This specification provides a comprehensive plan for standardizing error handling in the ScopeDSL system. Implementation will result in:

- **~85% reduction** in error handling code duplication
- **Consistent error messages** across all resolvers
- **Better debugging** through error buffering and categorization
- **Improved performance** by removing debug overhead in production
- **Enhanced maintainability** through centralized error management

The phased implementation approach ensures minimal disruption while delivering immediate benefits through incremental improvements.
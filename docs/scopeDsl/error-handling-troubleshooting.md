# ScopeDSL Error Handling Troubleshooting Guide

**Version**: 1.0.0  
**Last Updated**: 2024-01-15

## Overview

This comprehensive troubleshooting guide helps developers diagnose and resolve common error handling issues in the ScopeDSL system. Each problem includes symptoms, root causes, solutions, and prevention strategies.

> **Quick Links:** [Error Codes Reference](./error-codes-reference.md) | [Developer Guide](./error-handling-guide.md) | [Quick Reference](./error-handling-quick-reference.md)

## Table of Contents

1. [Common Problems and Solutions](#common-problems-and-solutions)
2. [Debug Techniques](#debug-techniques)
3. [Performance Issues](#performance-issues)
4. [Integration Problems](#integration-problems)
5. [Environment-Specific Issues](#environment-specific-issues)
6. [FAQ](#faq)

## Common Problems and Solutions

### Problem: Circular Reference Errors

**Symptom**: `TypeError: Converting circular structure to JSON`

**Error Code**: Often occurs before error can be assigned a code

**Root Causes**:
- Context object contains self-references
- Entity objects with bidirectional relationships
- Cached objects with parent/child references

**Solution**:
```javascript
// The error handler automatically sanitizes circular references
// But you can pre-sanitize for better performance:
const safeContext = {
  actorId: ctx.actorEntity?.id,
  targetId: ctx.targetEntity?.id,
  // Avoid including full entity objects
};

errorHandler.handleError(error, safeContext, 'MyResolver');
```

**Prevention**:
- Pass only necessary data in context
- Use IDs instead of full object references
- Implement toJSON() methods on complex objects

---

### Problem: Missing Error Codes (SCOPE_9999)

**Symptom**: Errors always have code `SCOPE_9999` (unknown)

**Root Causes**:
- Error message doesn't match any category patterns
- Custom error types not mapped to codes
- Typos in error messages

**Solution**:
```javascript
// Explicitly provide error codes
errorHandler.handleError(
  'Custom error message',
  ctx,
  'MyResolver',
  ErrorCodes.SPECIFIC_ERROR_CODE  // Provide specific code
);

// Or ensure messages match patterns
errorHandler.handleError(
  'Actor entity is missing',  // "missing" triggers MISSING_CONTEXT
  ctx,
  'MyResolver'
);
```

**Prevention**:
- Always provide explicit error codes for known errors
- Use consistent error message patterns
- Add new error codes as needed

---

### Problem: Performance Degradation with Error Handling

**Symptom**: Slow error processing, high memory usage

**Root Causes**:
- Large context objects being serialized
- Error buffer growing too large
- Debug mode enabled in production

**Solution**:
```javascript
// 1. Minimize context size
const minimalContext = {
  id: ctx.actorEntity.id,
  depth: ctx.depth
};

// 2. Clear buffer periodically
if (errorHandler.getErrorBuffer().length > 50) {
  errorHandler.clearErrorBuffer();
}

// 3. Ensure production mode
const errorHandler = new ScopeDslErrorHandler({
  logger,
  config: {
    isDevelopment: false,
    maxBufferSize: 50  // Smaller buffer
  }
});
```

**Prevention**:
- Set NODE_ENV=production in production
- Implement buffer management strategy
- Profile error handling in load tests

---

### Problem: Error Handler Not Available

**Symptom**: `Cannot read property 'handleError' of undefined`

**Root Causes**:
- Error handler not injected into resolver
- Dependency injection misconfigured
- Legacy resolver not updated

**Solution**:
```javascript
// Make error handler optional with fallback
export default function createResolver({ logger, errorHandler = null }) {
  return {
    resolve(node, ctx) {
      if (!ctx.actorEntity) {
        if (errorHandler) {
          errorHandler.handleError(/* ... */);
        } else {
          // Fallback to direct throw
          throw new Error('Actor entity required');
        }
      }
    }
  };
}
```

**Prevention**:
- Use progressive migration strategy
- Update dependency injection configuration
- Test resolvers with and without error handler

---

### Problem: Stack Traces Missing in Development

**Symptom**: Errors lack stack traces even in development mode

**Root Causes**:
- NODE_ENV not set correctly
- Error handler misconfigured
- Error object not properly constructed

**Solution**:
```javascript
// Ensure development mode is detected
const errorHandler = new ScopeDslErrorHandler({
  logger,
  config: {
    isDevelopment: true  // Force development mode
  }
});

// Or set environment variable
process.env.NODE_ENV = 'development';
```

**Prevention**:
- Use .env files for environment configuration
- Validate NODE_ENV on startup
- Add startup logging for configuration

---

### Problem: Duplicate Errors in Buffer

**Symptom**: Same error appears multiple times in buffer

**Root Causes**:
- Error being caught and re-thrown multiple times
- Retry logic without proper error handling
- Multiple error handlers in chain

**Solution**:
```javascript
// Track handled errors
const handledErrors = new WeakSet();

function handleOnce(error, ctx, resolver) {
  if (handledErrors.has(error)) {
    throw error;  // Already handled, just re-throw
  }
  
  handledErrors.add(error);
  errorHandler.handleError(error, ctx, resolver);
}
```

**Prevention**:
- Handle errors at appropriate level only
- Avoid catching and re-throwing same error
- Use single error handler per resolution chain

## Debug Techniques

### 1. Enable Verbose Logging

```javascript
// Temporarily enable full debugging
const debugHandler = new ScopeDslErrorHandler({
  logger: {
    error: (msg, data) => {
      console.error('ERROR:', msg);
      console.error('FULL DATA:', JSON.stringify(data, null, 2));
    },
    warn: console.warn,
    info: console.info,
    debug: console.debug
  },
  config: { isDevelopment: true }
});
```

### 2. Trace Resolution Path

```javascript
// Add breadcrumbs to context
function traceableResolve(node, ctx, dispatcher) {
  const tracedCtx = {
    ...ctx,
    path: [...(ctx.path || []), node.id],
    timestamps: [...(ctx.timestamps || []), Date.now()]
  };
  
  try {
    return dispatcher(node, tracedCtx);
  } catch (error) {
    console.log('Resolution path:', tracedCtx.path);
    console.log('Timing:', tracedCtx.timestamps);
    throw error;
  }
}
```

### 3. Inspect Error Buffer

```javascript
// Analyze error patterns
function analyzeErrors(errorHandler) {
  const errors = errorHandler.getErrorBuffer();
  
  // Group by error code
  const byCode = errors.reduce((acc, err) => {
    acc[err.code] = (acc[err.code] || 0) + 1;
    return acc;
  }, {});
  
  // Find most common resolver
  const byResolver = errors.reduce((acc, err) => {
    acc[err.resolver] = (acc[err.resolver] || 0) + 1;
    return acc;
  }, {});
  
  console.table({ byCode, byResolver });
  
  // Find error hot spots
  const recentErrors = errors.slice(-10);
  console.log('Recent errors:', recentErrors);
}
```

### 4. Test Error Scenarios

```javascript
// Create test harness for error conditions
function testErrorHandling(resolver, errorHandler) {
  const testCases = [
    { ctx: {}, expectedCode: 'SCOPE_1001' },  // Missing actor
    { ctx: { actorEntity: null }, expectedCode: 'SCOPE_1001' },
    { ctx: { actorEntity: {}, depth: 100 }, expectedCode: 'SCOPE_4002' }
  ];
  
  testCases.forEach(({ ctx, expectedCode }) => {
    try {
      resolver.resolve({ type: 'test' }, ctx);
    } catch (error) {
      if (error.code !== expectedCode) {
        console.error(`Expected ${expectedCode}, got ${error.code}`);
      }
    }
  });
}
```

## Performance Issues

### High Memory Usage

**Problem**: Error buffer consuming too much memory

**Solution**:
```javascript
class ManagedErrorHandler {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.startMemoryManagement();
  }
  
  startMemoryManagement() {
    setInterval(() => {
      const buffer = this.errorHandler.getErrorBuffer();
      if (buffer.length > 25) {
        // Keep only recent errors
        const recentErrors = buffer.slice(-10);
        this.errorHandler.clearErrorBuffer();
        // Optionally re-add recent errors if needed
      }
    }, 60000);
  }
}
```

### Slow Error Processing

**Problem**: Error handling taking too long

**Solution**:
```javascript
// Profile error handling
function profileErrorHandling(errorHandler) {
  const originalHandle = errorHandler.handleError.bind(errorHandler);
  
  errorHandler.handleError = function(message, context, resolver, code) {
    const start = performance.now();
    try {
      originalHandle(message, context, resolver, code);
    } finally {
      const duration = performance.now() - start;
      if (duration > 10) {
        console.warn(`Slow error handling: ${duration}ms`);
      }
    }
  };
}
```

## Integration Problems

### Problem: Error Handler Not Compatible with Testing Framework

**Symptom**: Tests fail when error handler is used

**Solution**:
```javascript
// Create test-friendly error handler
function createTestErrorHandler() {
  const errors = [];
  
  return {
    handleError(message, context, resolver, code) {
      const error = new Error(message);
      error.code = code;
      errors.push({ message, context, resolver, code });
      throw error;
    },
    getErrorBuffer() {
      return errors;
    },
    clearErrorBuffer() {
      errors.length = 0;
    },
    // Test helper
    getLastError() {
      return errors[errors.length - 1];
    }
  };
}
```

### Problem: Async Operations Lose Error Context

**Symptom**: Errors in async operations lack proper context

**Solution**:
```javascript
async function asyncResolve(node, ctx) {
  // Capture context before async operation
  const asyncContext = { ...ctx, asyncOperation: true };
  
  try {
    const result = await fetchData(node.id);
    return result;
  } catch (error) {
    // Use captured context
    errorHandler.handleError(
      error,
      asyncContext,  // Original context preserved
      'AsyncResolver',
      ErrorCodes.ASYNC_OPERATION_FAILED
    );
  }
}
```

## Environment-Specific Issues

### Development vs Production Behavior

```javascript
// Ensure consistent behavior across environments
class EnvironmentAwareErrorHandler {
  constructor(logger) {
    const isDev = this.detectEnvironment();
    
    this.handler = new ScopeDslErrorHandler({
      logger,
      config: {
        isDevelopment: isDev,
        maxBufferSize: isDev ? 100 : 25
      }
    });
    
    logger.info(`Error handler initialized in ${isDev ? 'development' : 'production'} mode`);
  }
  
  detectEnvironment() {
    // Multiple detection methods
    return (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG === 'true' ||
      process.env.NODE_ENV === undefined  // Default to dev if not set
    );
  }
}
```

### Docker/Container Issues

```javascript
// Handle container-specific paths in stack traces
function sanitizeStackTrace(stack) {
  if (!stack) return stack;
  
  // Remove container paths
  return stack
    .replace(/\/app\//g, './')
    .replace(/\/usr\/src\/app\//g, './')
    .replace(/node_modules/g, 'deps');
}
```

## FAQ

### Q: How do I add a new error code?

**A**: Add to `src/scopeDsl/constants/errorCodes.js`:
```javascript
export const ErrorCodes = {
  // ... existing codes
  MY_NEW_ERROR: 'SCOPE_XXXX',  // Use appropriate range
};
```

### Q: Can I customize error messages?

**A**: Yes, pass custom messages to handleError:
```javascript
errorHandler.handleError(
  `Custom message with details: ${details}`,
  ctx,
  'MyResolver',
  ErrorCodes.SPECIFIC_CODE
);
```

### Q: How do I handle errors in async resolvers?

**A**: Use try-catch with async/await:
```javascript
async resolve(node, ctx) {
  try {
    return await asyncOperation();
  } catch (error) {
    errorHandler.handleError(error, ctx, 'AsyncResolver');
  }
}
```

### Q: Should I clear the error buffer?

**A**: Yes, periodically:
- In production: Clear after sending to monitoring
- In development: Clear after debugging session
- In tests: Clear between test cases

### Q: How do I test error handling?

**A**: Use test utilities:
```javascript
it('should handle missing actor', () => {
  const errorHandler = createTestErrorHandler();
  const resolver = createResolver({ errorHandler });
  
  expect(() => resolver.resolve(node, {}))
    .toThrow('Actor entity required');
  
  expect(errorHandler.getLastError().code)
    .toBe('SCOPE_1001');
});
```

### Q: Can I disable error handling temporarily?

**A**: Use null error handler:
```javascript
const resolver = createResolver({ 
  errorHandler: null  // Falls back to direct throws
});
```

### Q: How do I monitor errors in production?

**A**: Integrate with monitoring service:
```javascript
setInterval(() => {
  const errors = errorHandler.getErrorBuffer();
  if (errors.length > 0) {
    monitoringService.reportErrors(errors);
    errorHandler.clearErrorBuffer();
  }
}, 300000);  // Every 5 minutes
```

## Related Documentation

- [Error Handling Developer Guide](./error-handling-guide.md) - Complete implementation guide
- [Error Codes Reference](./error-codes-reference.md) - All error codes
- [Quick Reference](./error-handling-quick-reference.md) - Common patterns
- [Migration Guide](../migration/scopedsl-error-handling-migration.md) - Upgrading existing code
- [ScopeDSL Documentation](./README.md) - Main ScopeDSL docs

## Support

For additional help:
1. Check the [main troubleshooting guide](./troubleshooting.md)
2. Review test files for examples
3. Contact the development team

---

*Last updated: 2024-01-15*
# ScopeDSL Error Handling Quick Reference

## Common Patterns

### Missing Context
```javascript
errorHandler.handleError(
  'Missing required field',
  ctx,
  'ResolverName',
  ErrorCodes.MISSING_CONTEXT
);
```

### Invalid Data
```javascript
errorHandler.handleError(
  `Invalid type: ${typeof value}`,
  ctx,
  'ResolverName',
  ErrorCodes.INVALID_DATA
);
```

### Resolution Failed
```javascript
errorHandler.handleError(
  `Could not resolve: ${scopeId}`,
  ctx,
  'ResolverName',
  ErrorCodes.RESOLUTION_FAILED_GENERIC
);
```

### Depth Check
```javascript
if (depth > MAX_DEPTH) {
  errorHandler.handleError(
    `Depth ${depth} exceeds maximum ${MAX_DEPTH}`,
    ctx,
    'ResolverName',
    ErrorCodes.MAX_DEPTH_EXCEEDED
  );
}
```

### Cycle Detection
```javascript
if (visited.has(nodeId)) {
  errorHandler.handleError(
    `Circular reference detected: ${nodeId}`,
    ctx,
    'ResolverName',
    ErrorCodes.CYCLE_DETECTED
  );
}
```

## Error Code Cheat Sheet

| Prefix | Category   | Use Case             | Example Codes |
| ------ | ---------- | -------------------- | ------------- |
| 1xxx   | Context    | Missing dependencies | `SCOPE_1001` MISSING_ACTOR |
| 2xxx   | Data       | Invalid input        | `SCOPE_2001` INVALID_NODE_TYPE |
| 3xxx   | Resolution | Processing failures  | `SCOPE_3001` SCOPE_NOT_FOUND |
| 4xxx   | System     | Config/limits        | `SCOPE_4001` CYCLE_DETECTED |
| 5xxx   | Parse      | Syntax errors        | `SCOPE_5001` SYNTAX_ERROR |
| 6xxx   | Config     | Setup issues         | `SCOPE_6002` MISSING_CONFIG |
| 9xxx   | Unknown    | Fallback             | `SCOPE_9999` UNKNOWN_ERROR |

## Most Common Error Codes

| Code | Name | Quick Fix |
|------|------|-----------|
| `SCOPE_1001` | MISSING_ACTOR | Pass `actorEntity` in context |
| `SCOPE_1003` | MISSING_DISPATCHER | Include `dispatcher` in context |
| `SCOPE_2002` | MISSING_NODE_PARENT | Ensure filter/step nodes have parent |
| `SCOPE_2005` | INVALID_COMPONENT_ID | Use format: `mod:component` |
| `SCOPE_3001` | SCOPE_NOT_FOUND | Check scope ID exists in `.scope` files |
| `SCOPE_3004` | COMPONENT_RESOLUTION_FAILED | Verify component exists on entity |
| `SCOPE_4001` | CYCLE_DETECTED | Remove circular scope references |
| `SCOPE_4002` | MAX_DEPTH_EXCEEDED | Reduce nesting or increase limit |

## Resolver Implementation Template

```javascript
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

export default function createMyResolver({
  logger,
  errorHandler = null  // Optional for backward compatibility
}) {
  // Validate dependencies
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', logger, {
      requiredMethods: ['handleError', 'getErrorBuffer']
    });
  }

  return {
    canResolve(node) {
      // Check if this resolver can handle the node
      return node.type === 'myType';
    },

    resolve(node, ctx) {
      // Validation with error handling
      if (!ctx.actorEntity) {
        if (errorHandler) {
          errorHandler.handleError(
            'Actor entity is required',
            ctx,
            'MyResolver',
            ErrorCodes.MISSING_ACTOR
          );
        } else {
          throw new Error('Actor entity is required');
        }
      }

      try {
        // Main resolution logic
        const result = performResolution(node, ctx);
        return result;
      } catch (error) {
        if (errorHandler) {
          errorHandler.handleError(
            error,
            ctx,
            'MyResolver',
            determineErrorCode(error)
          );
        } else {
          throw error;
        }
      }
    }
  };
}
```

## Environment Variables

| Variable | Value | Effect |
|----------|-------|--------|
| `NODE_ENV` | `production` | Minimal logging (error code only) |
| `NODE_ENV` | `development` | Full debugging (context, stack trace) |
| `NODE_ENV` | (not set) | Defaults to development mode |

## Error Handler Methods

### Core Methods
```javascript
// Handle and throw error
errorHandler.handleError(
  message,           // Error message or Error object
  context,          // Resolution context
  resolverName,     // Name of resolver
  errorCode         // Optional specific error code
);

// Get error buffer for analysis
const errors = errorHandler.getErrorBuffer();

// Clear error buffer
errorHandler.clearErrorBuffer();
```

### Error Buffer Analysis
```javascript
// Count errors by category
const errorsByCategory = errors.reduce((acc, err) => {
  acc[err.category] = (acc[err.category] || 0) + 1;
  return acc;
}, {});

// Find most common errors
const errorCounts = {};
errors.forEach(e => {
  errorCounts[e.code] = (errorCounts[e.code] || 0) + 1;
});
```

## Validation Helpers

```javascript
import { validateDependency } from '../../utils/dependencyUtils.js';
import { assertPresent, assertNonBlankString } from '../../utils/dependencyUtils.js';

// Validate dependencies
validateDependency(service, 'IService', logger, {
  requiredMethods: ['method1', 'method2']
});

// Assert required values
assertPresent(value, 'Value is required');
assertNonBlankString(id, 'Entity ID', 'validation', logger);
```

## Debug Techniques

### 1. Inspect Error Buffer
```javascript
const buffer = errorHandler.getErrorBuffer();
console.log('Recent errors:', buffer);
```

### 2. Enable Verbose Logging
```javascript
const errorHandler = new ScopeDslErrorHandler({
  logger,
  config: { isDevelopment: true }
});
```

### 3. Trace Resolution Path
```javascript
// Add to context for tracking
const ctx = {
  ...originalContext,
  depth: (originalContext.depth || 0) + 1,
  path: [...(originalContext.path || []), node.id],
  visited: new Set(originalContext.visited || [])
};
```

## Recovery Strategies

### Fallback Resolution
```javascript
try {
  return primaryResolution(node, ctx);
} catch (error) {
  // Log but don't throw
  logger.warn('Primary resolution failed, trying fallback', error);
  return fallbackResolution(node, ctx);
}
```

### Default Values
```javascript
const component = entity.components[componentId] || defaultComponent;
const value = getValueSafely(data) || defaultValue;
```

### Circuit Breaking
```javascript
if (failureCount > THRESHOLD) {
  return cachedResult || emptyResult;
}
```

## Performance Tips

### Lightweight Context
```javascript
// ❌ Heavy context
errorHandler.handleError(error, ctx, 'Resolver');

// ✅ Minimal context
errorHandler.handleError(error, {
  actorId: ctx.actorEntity?.id,
  depth: ctx.depth
}, 'Resolver');
```

### Error Code Caching
```javascript
// Cache frequently used codes
const ERROR_MAP = new Map([
  ['missing', ErrorCodes.MISSING_CONTEXT],
  ['invalid', ErrorCodes.INVALID_DATA]
]);
```

### Buffer Management
```javascript
// Auto-clear in production
if (!isDevelopment && buffer.length > 25) {
  errorHandler.clearErrorBuffer();
}
```

## Async Error Handling

### Promise-based
```javascript
async resolve(node, ctx) {
  try {
    return await fetchData(node.id);
  } catch (error) {
    errorHandler.handleError(
      error, ctx, 'AsyncResolver',
      ErrorCodes.ASYNC_FAILED
    );
  }
}
```

### Callback-based
```javascript
function resolve(node, ctx, callback) {
  fetchData(node.id, (err, data) => {
    if (err) {
      errorHandler.handleError(
        err, ctx, 'CallbackResolver'
      );
    }
    callback(null, data);
  });
}
```

## Testing Patterns

### Mock Error Handler
```javascript
const mockErrorHandler = {
  errors: [],
  handleError(msg, ctx, resolver, code) {
    const error = { msg, ctx, resolver, code };
    this.errors.push(error);
    throw new Error(msg);
  },
  getErrorBuffer() { return this.errors; },
  clearErrorBuffer() { this.errors = []; }
};
```

### Test Error Conditions
```javascript
expect(() => 
  resolver.resolve({}, {})
).toThrow();

expect(mockErrorHandler.errors[0].code)
  .toBe(ErrorCodes.MISSING_ACTOR);
```

## Links

- [Full Developer Guide](./error-handling-guide.md)
- [Complete Error Codes Reference](./error-codes-reference.md)
- [Troubleshooting Guide](./error-handling-troubleshooting.md)
- [ScopeDSL Troubleshooting](./troubleshooting.md)
- [General Quick Reference](./quick-reference.md)
- [Migration Guide](../migration/scopedsl-error-handling-migration.md)
# ScopeDSL Error Handling Developer Guide

**Version**: 2.0.0  
**Last Updated**: 2024-01-15  
**Status**: Production Ready

## Overview

The ScopeDSL system uses a centralized error handling architecture that provides consistent, environment-aware error processing across all resolvers. This guide covers how to use the `ScopeDslErrorHandler` class, implement proper error handling in your resolvers, and troubleshoot common issues.

> **Quick Links:** [Error Handling Quick Reference](./error-handling-quick-reference.md) | [Code Examples](./examples/) | [Error Codes Reference](./error-codes-reference.md) | [Migration Guide](../migration/scopedsl-error-handling-migration.md)

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Using ScopeDslErrorHandler](#using-scopedserrorhandler)
3. [Error Categories and Codes](#error-categories-and-codes)
4. [Environment-Aware Processing](#environment-aware-processing)
5. [Implementing Error Handling in Resolvers](#implementing-error-handling-in-resolvers)
6. [Error Buffering and Analysis](#error-buffering-and-analysis)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)
9. [Migration Guide](#migration-guide)
10. [Performance Optimization](#performance-optimization)
11. [API Reference](#api-reference)
12. [Troubleshooting Guide](#troubleshooting-guide)

## Architecture Overview

The error handling system consists of three main components:

```
┌─────────────────────┐
│    Resolver         │
│  (Detects Error)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ScopeDslErrorHandler│
│  (Processes Error)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   ScopeDslError     │
│  (Thrown to Caller) │
└─────────────────────┘
```

### Key Components

- **ScopeDslErrorHandler**: Central error processor with environment awareness and error creation
- **ErrorCodes**: Standardized error code constants (SCOPE_XXXX format)
- **ErrorCategories**: Automatic categorization based on error patterns
- **ScopeDslError**: Custom error class for all ScopeDSL errors

> **Note:** Error creation is handled directly within `ScopeDslErrorHandler` - there is no separate error factory class.

## Using ScopeDslErrorHandler

### Basic Setup

```javascript
import ScopeDslErrorHandler from '../core/scopeDslErrorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';

// Create error handler instance
const errorHandler = new ScopeDslErrorHandler({
  logger: logger,
  config: {
    isDevelopment: process.env.NODE_ENV !== 'production',
    maxBufferSize: 100,
  },
});
```

### Handling Errors

```javascript
// In your resolver
try {
  // Resolver logic that might fail
  const result = performOperation();
} catch (error) {
  // Use error handler to process and re-throw standardized error
  errorHandler.handleError(
    error, // Original error or message
    context, // Resolution context for debugging
    'MyResolver', // Name of your resolver
    ErrorCodes.SPECIFIC_ERROR // Optional specific error code
  );
}
```

## Error Categories and Codes

### Automatic Categorization

The error handler automatically categorizes errors based on message patterns:

| Category             | Pattern Keywords            | Code Range |
| -------------------- | --------------------------- | ---------- |
| `MISSING_CONTEXT`    | missing, undefined, null    | 1xxx       |
| `INVALID_DATA`       | invalid, malformed, corrupt | 2xxx       |
| `RESOLUTION_FAILURE` | resolve, not found, failed  | 3xxx       |
| `CYCLE_DETECTED`     | cycle, circular             | 4xxx       |
| `DEPTH_EXCEEDED`     | depth, limit, exceed        | 4xxx       |
| `PARSE_ERROR`        | parse, syntax               | 5xxx       |
| `CONFIGURATION`      | config, setting, option     | 6xxx       |
| `UNKNOWN`            | (fallback)                  | 9xxx       |

### Using Specific Error Codes

```javascript
import { ErrorCodes } from '../constants/errorCodes.js';

// Use specific codes for known error conditions
if (!actorEntity) {
  errorHandler.handleError(
    'Actor entity missing from context',
    ctx,
    'FilterResolver',
    ErrorCodes.MISSING_ACTOR // SCOPE_1001
  );
}

if (depth > MAX_DEPTH) {
  errorHandler.handleError(
    `Maximum depth ${MAX_DEPTH} exceeded`,
    ctx,
    'StepResolver',
    ErrorCodes.MAX_DEPTH_EXCEEDED // SCOPE_4002
  );
}
```

## Environment-Aware Processing

### Development Mode

In development, the error handler provides detailed debugging information:

```javascript
// Development output includes:
// - Full error message
// - Error code and category
// - Sanitized context object
// - Stack trace
// - Timestamp

[ScopeDSL:FilterResolver] Missing required actor entity
{
  code: 'SCOPE_1001',
  category: 'missing_context',
  context: { /* sanitized context */ },
  timestamp: '2024-01-15T10:30:00Z',
  stack: 'Error: Missing required...\n  at FilterResolver...'
}
```

### Production Mode

In production, errors are logged with minimal information:

```javascript
// Production output (concise):
[ScopeDSL:FilterResolver] SCOPE_1001: Missing required actor entity
```

### Configuration

```javascript
const errorHandler = new ScopeDslErrorHandler({
  logger: logger,
  config: {
    // Auto-detects by default, or explicitly set
    isDevelopment: process.env.NODE_ENV !== 'production',

    // Buffer size for error analysis (default: 100)
    maxBufferSize: 100,
  },
});
```

## Implementing Error Handling in Resolvers

### Step 1: Accept Error Handler Dependency

```javascript
export default function createMyResolver({
  // Other dependencies...
  errorHandler = null, // Optional for backward compatibility
}) {
  // Validate if provided
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }

  return {
    canResolve(node) {
      /* ... */
    },
    resolve(node, ctx) {
      /* ... */
    },
  };
}
```

### Step 2: Use Error Handler in Resolution

```javascript
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
      // Fallback for backward compatibility
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
```

### Step 3: Determine Appropriate Error Codes

```javascript
function determineErrorCode(error) {
  const message = error.message.toLowerCase();

  if (message.includes('not found')) {
    return ErrorCodes.RESOLUTION_FAILED_GENERIC;
  }
  if (message.includes('invalid')) {
    return ErrorCodes.INVALID_DATA_GENERIC;
  }
  if (message.includes('cycle')) {
    return ErrorCodes.CYCLE_DETECTED;
  }

  return ErrorCodes.UNKNOWN_ERROR;
}
```

## Error Buffering and Analysis

### Accessing Error Buffer

The error handler maintains a circular buffer of recent errors for analysis:

```javascript
// Get recent errors for analysis
const recentErrors = errorHandler.getErrorBuffer();

// Analyze error patterns
const errorsByCategory = recentErrors.reduce((acc, error) => {
  acc[error.category] = (acc[error.category] || 0) + 1;
  return acc;
}, {});

console.log('Error distribution:', errorsByCategory);
```

### Buffer Management

```javascript
// Clear buffer when needed (e.g., after analysis)
errorHandler.clearErrorBuffer();

// Buffer automatically maintains size limit (default: 100)
// Oldest errors are removed when limit is reached
```

### Using Buffer for Debugging

```javascript
// In a debug endpoint or test
function analyzeErrors() {
  const errors = errorHandler.getErrorBuffer();

  // Find most common error
  const errorCounts = {};
  errors.forEach((e) => {
    errorCounts[e.code] = (errorCounts[e.code] || 0) + 1;
  });

  // Identify patterns
  const contextErrors = errors.filter((e) => e.category === 'missing_context');

  return {
    total: errors.length,
    byCode: errorCounts,
    contextErrors: contextErrors.length,
  };
}
```

## Best Practices

### 1. Always Provide Context

```javascript
// Good: Include relevant context
errorHandler.handleError(
  error,
  {
    actorEntity,
    targetEntity,
    node,
    depth: currentDepth,
  },
  'MyResolver',
  ErrorCodes.SPECIFIC_ERROR
);

// Avoid: Missing context
errorHandler.handleError(error, {}, 'MyResolver');
```

### 2. Use Specific Error Codes

```javascript
// Good: Specific error code
if (!entity.components['core:stats']) {
  errorHandler.handleError(
    'Stats component missing',
    ctx,
    'StatsResolver',
    ErrorCodes.COMPONENT_RESOLUTION_FAILED
  );
}

// Less helpful: Generic code
errorHandler.handleError(
  'Stats component missing',
  ctx,
  'StatsResolver',
  ErrorCodes.UNKNOWN_ERROR
);
```

### 3. Fail Fast with Clear Messages

```javascript
// Good: Clear, actionable message
if (!node.parent) {
  errorHandler.handleError(
    `Filter node requires parent node, but parent is ${node.parent}`,
    ctx,
    'FilterResolver',
    ErrorCodes.MISSING_NODE_PARENT
  );
}

// Less helpful: Vague message
if (!node.parent) {
  errorHandler.handleError('Invalid node', ctx, 'FilterResolver');
}
```

### 4. Handle Circular References

The error handler automatically sanitizes context to prevent circular reference issues:

```javascript
// Safe: Handler sanitizes circular references
const circularContext = {
  entity: actorEntity,
  parent: null,
};
circularContext.parent = circularContext; // Circular!

// This won't crash - handler sanitizes it
errorHandler.handleError(
  'Error with circular context',
  circularContext,
  'MyResolver'
);
```

## Common Patterns

### Pattern 1: Validation Chain

```javascript
resolve(node, ctx) {
  // Chain validations with specific error codes
  this.validateContext(ctx);
  this.validateNode(node);
  this.validateDepth(ctx.depth);

  // Proceed with resolution
  return this.performResolution(node, ctx);
}

validateContext(ctx) {
  if (!ctx.actorEntity) {
    errorHandler.handleError(
      'Missing actor entity',
      ctx,
      'MyResolver',
      ErrorCodes.MISSING_ACTOR
    );
  }

  if (!ctx.dispatcher) {
    errorHandler.handleError(
      'Missing dispatcher',
      ctx,
      'MyResolver',
      ErrorCodes.MISSING_DISPATCHER
    );
  }
}
```

### Pattern 2: Wrapped Operations

```javascript
function safeResolve(operation, ctx, resolverName) {
  try {
    return operation();
  } catch (error) {
    if (errorHandler) {
      errorHandler.handleError(error, ctx, resolverName);
    }
    throw error;
  }
}

// Usage
resolve(node, ctx) {
  return safeResolve(
    () => this.internalResolve(node, ctx),
    ctx,
    'MyResolver'
  );
}
```

### Pattern 3: Error Recovery

```javascript
resolve(node, ctx) {
  try {
    return this.primaryResolution(node, ctx);
  } catch (error) {
    // Log error but try fallback
    if (errorHandler) {
      // Buffer error for analysis but don't throw
      const errorInfo = {
        message: error.message,
        context: ctx,
        resolver: 'MyResolver'
      };

      // Try fallback resolution
      try {
        return this.fallbackResolution(node, ctx);
      } catch (fallbackError) {
        // If fallback also fails, throw original error
        errorHandler.handleError(
          error,
          ctx,
          'MyResolver',
          ErrorCodes.RESOLUTION_FAILED_GENERIC
        );
      }
    }
  }
}
```

## Migration Guide

### Migrating from Direct Error Throwing

If you're migrating existing resolvers from direct error throwing to the centralized error handler, follow these steps:

#### Step 1: Add Error Handler Dependency

```javascript
// Before
export default function createResolver({ logger }) {
  // ...
}

// After
export default function createResolver({ logger, errorHandler = null }) {
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', logger, {
      requiredMethods: ['handleError', 'getErrorBuffer']
    });
  }
  // ...
}
```

#### Step 2: Update Error Handling

```javascript
// Before
if (!ctx.actorEntity) {
  throw new Error('Actor entity is required');
}

// After
if (!ctx.actorEntity) {
  if (errorHandler) {
    errorHandler.handleError(
      'Actor entity is required',
      ctx,
      'MyResolver',
      ErrorCodes.MISSING_ACTOR
    );
  } else {
    throw new Error('Actor entity is required'); // Fallback
  }
}
```

#### Step 3: Update Catch Blocks

```javascript
// Before
try {
  return performOperation();
} catch (error) {
  logger.error('Operation failed', error);
  throw error;
}

// After
try {
  return performOperation();
} catch (error) {
  if (errorHandler) {
    errorHandler.handleError(error, ctx, 'MyResolver');
  } else {
    logger.error('Operation failed', error);
    throw error;
  }
}
```

### Progressive Migration Strategy

1. **Phase 1**: Add error handler as optional dependency
2. **Phase 2**: Implement dual-path error handling (with fallback)
3. **Phase 3**: Add specific error codes
4. **Phase 4**: Remove fallback paths once all callers provide error handler

For a complete migration guide, see [ScopeDSL Error Handling Migration Guide](../migration/scopedsl-error-handling-migration.md).

## Performance Optimization

### Minimize Context Size

Large context objects impact performance. Sanitize context before passing:

```javascript
// Avoid passing entire large objects
const minimalContext = {
  actorId: ctx.actorEntity.id,
  targetId: ctx.targetEntity?.id,
  depth: ctx.depth,
  // Only include necessary fields
};

errorHandler.handleError(error, minimalContext, 'MyResolver');
```

### Error Code Caching

Cache error code lookups for frequently occurring errors:

```javascript
const ERROR_CODE_MAP = new Map([
  ['missing actor', ErrorCodes.MISSING_ACTOR],
  ['invalid data', ErrorCodes.INVALID_DATA_GENERIC],
  ['depth exceeded', ErrorCodes.MAX_DEPTH_EXCEEDED],
]);

function getErrorCode(message) {
  for (const [pattern, code] of ERROR_CODE_MAP) {
    if (message.toLowerCase().includes(pattern)) {
      return code;
    }
  }
  return ErrorCodes.UNKNOWN_ERROR;
}
```

### Buffer Management for High-Volume Scenarios

In high-throughput scenarios, manage buffer size and clearing:

```javascript
class ErrorAnalyzer {
  constructor(errorHandler) {
    this.errorHandler = errorHandler;
    this.analysisInterval = setInterval(() => this.analyze(), 30000);
  }

  analyze() {
    const errors = this.errorHandler.getErrorBuffer();
    if (errors.length > 50) {
      // Process errors
      this.processErrors(errors);
      // Clear to prevent memory growth
      this.errorHandler.clearErrorBuffer();
    }
  }

  cleanup() {
    clearInterval(this.analysisInterval);
  }
}
```

### Conditional Error Detail

Reduce overhead in production by conditionally including detail:

```javascript
const isDevelopment = process.env.NODE_ENV !== 'production';

const errorContext = isDevelopment
  ? {
      fullEntity: ctx.actorEntity,
      stack: new Error().stack,
      timestamp: Date.now(),
      ...ctx,
    }
  : {
      actorId: ctx.actorEntity?.id,
      resolver: 'MyResolver',
    };

errorHandler.handleError(error, errorContext, 'MyResolver');
```

## API Reference

### ScopeDslErrorHandler Class

#### Constructor

```javascript
new ScopeDslErrorHandler({
  logger: ILogger,
  config?: {
    isDevelopment?: boolean,
    maxBufferSize?: number
  }
})
```

**Parameters:**

- `logger` (required): Logger instance implementing ILogger interface
- `config` (optional): Configuration object
  - `isDevelopment`: Boolean indicating development mode (default: auto-detect from NODE_ENV)
  - `maxBufferSize`: Maximum number of errors to buffer (default: 100)

#### Methods

##### handleError(message, context, resolverName, errorCode)

Processes and throws a standardized error.

```javascript
handleError(
  message: string | Error,
  context: object,
  resolverName: string,
  errorCode?: string
): never
```

**Parameters:**

- `message`: Error message string or Error object
- `context`: Resolution context (will be sanitized automatically)
- `resolverName`: Name of the resolver for identification
- `errorCode`: Optional specific error code (defaults to auto-categorization)

**Throws:** `ScopeDslError` with standardized format

**Example:**

```javascript
errorHandler.handleError(
  'Missing required field',
  { actorEntity, depth: 5 },
  'FieldResolver',
  ErrorCodes.MISSING_CONTEXT
);
```

##### getErrorBuffer()

Returns the current error buffer for analysis.

```javascript
getErrorBuffer(): Array<{
  message: string,
  code: string,
  category: string,
  context: object,
  timestamp: string,
  resolver: string
}>
```

**Returns:** Array of buffered error objects

**Example:**

```javascript
const recentErrors = errorHandler.getErrorBuffer();
console.log(`${recentErrors.length} errors in buffer`);
```

##### clearErrorBuffer()

Clears all errors from the buffer.

```javascript
clearErrorBuffer(): void
```

**Example:**

```javascript
// Clear after analysis
errorHandler.clearErrorBuffer();
```

### Error Categories

The error handler automatically categorizes errors based on message patterns:

```javascript
const ERROR_CATEGORIES = {
  MISSING_CONTEXT: /missing|undefined|null|not found in context/i,
  INVALID_DATA: /invalid|malformed|corrupt|incorrect/i,
  RESOLUTION_FAILURE: /failed to resolve|resolution failed|cannot resolve/i,
  CYCLE_DETECTED: /cycle|circular|recursive reference/i,
  DEPTH_EXCEEDED: /depth|limit|maximum.*exceeded/i,
  PARSE_ERROR: /parse|syntax|unexpected token/i,
  CONFIGURATION: /config|setting|option|initialization/i,
  UNKNOWN: /.*/, // Fallback
};
```

### ScopeDslError Class

Custom error class thrown by the error handler:

```javascript
class ScopeDslError extends Error {
  code: string;        // Error code (e.g., 'SCOPE_1001')
  category: string;    // Category name
  context: object;     // Sanitized context
  resolver: string;    // Resolver name
  timestamp: string;   // ISO timestamp
}
```

## Troubleshooting Guide

### Issue: "actorEntity is undefined in context"

**Error Code**: `SCOPE_1001`

**Cause**: The resolution context is missing the required actor entity.

**Solution**:

```javascript
// Ensure actor is passed in initial context
const context = {
  actorEntity: getActorEntity(actorId), // Must not be null/undefined
  dispatcher: resolveDispatcher,
  // ... other context
};
```

### Issue: "Maximum resolution depth exceeded"

**Error Code**: `SCOPE_4002`

**Cause**: Scope resolution has recursive references or is too deeply nested.

**Solution**:

```javascript
// Add depth tracking
resolve(node, ctx) {
  const depth = (ctx.depth || 0) + 1;

  if (depth > MAX_DEPTH) {
    errorHandler.handleError(
      `Depth ${depth} exceeds maximum ${MAX_DEPTH}`,
      ctx,
      'StepResolver',
      ErrorCodes.MAX_DEPTH_EXCEEDED
    );
  }

  // Pass depth to child resolutions
  const childCtx = { ...ctx, depth };
  return dispatcher(node.child, childCtx);
}
```

### Issue: "Circular dependency detected"

**Error Code**: `SCOPE_4001`

**Cause**: Scope references create a cycle (A → B → C → A).

**Solution**:

```javascript
// Track visited nodes
resolve(node, ctx) {
  const visited = ctx.visited || new Set();

  if (visited.has(node.id)) {
    errorHandler.handleError(
      `Circular reference detected: ${node.id}`,
      ctx,
      'ScopeReferenceResolver',
      ErrorCodes.CYCLE_DETECTED
    );
  }

  visited.add(node.id);
  const childCtx = { ...ctx, visited };
  // Continue resolution...
}
```

### Issue: "Parse error in scope expression"

**Error Code**: `SCOPE_5001`

**Cause**: Invalid syntax in scope DSL expression.

**Solution**:

```javascript
// Validate syntax before parsing
try {
  const parsed = parseExpression(expression);
} catch (parseError) {
  errorHandler.handleError(
    `Invalid syntax in expression: ${expression}`,
    { expression },
    'Parser',
    ErrorCodes.SYNTAX_ERROR
  );
}
```

### Issue: Production errors lack detail

**Symptom**: Only seeing error codes without context in production.

**Solution**:

1. Use error buffer to collect patterns:

```javascript
// Periodic analysis in production
setInterval(() => {
  const errors = errorHandler.getErrorBuffer();
  // Send to monitoring service
  monitoringService.reportErrors(errors);
  errorHandler.clearErrorBuffer();
}, 60000);
```

2. Enable development mode temporarily:

```javascript
// For debugging specific issues
const errorHandler = new ScopeDslErrorHandler({
  logger,
  config: {
    isDevelopment: true, // Temporary for debugging
  },
});
```

## Related Documentation

- [Error Handling Quick Reference](./error-handling-quick-reference.md) - Quick lookup for common patterns
- [Error Codes Reference](./error-codes-reference.md) - Complete list of error codes
- [Code Examples](./examples/) - Standalone example files:
  - [Basic Error Handling](./examples/error-handling-basic.js)
  - [Complex Error Handling](./examples/error-handling-complex.js)
  - [Error Recovery Patterns](./examples/error-handling-recovery.js)
- [Migration Guide](../migration/scopedsl-error-handling-migration.md) - Updating existing resolvers
- [ScopeDSL README](./README.md) - Main ScopeDSL documentation
- [Troubleshooting](./troubleshooting.md) - General ScopeDSL troubleshooting

## Summary

The centralized error handling system provides:

1. **Consistency**: All errors follow the same format and flow
2. **Debugging**: Rich context in development, concise in production
3. **Analysis**: Error buffering for pattern detection
4. **Maintainability**: Single source of truth for error processing
5. **Safety**: Automatic context sanitization prevents crashes

By following this guide, you can implement robust error handling in your ScopeDSL resolvers that aids both development and production debugging.

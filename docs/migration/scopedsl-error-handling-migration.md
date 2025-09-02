# ScopeDSL Error Handling Migration Guide

## Overview

This guide helps you migrate existing ScopeDSL resolvers to use the new centralized error handling system. The migration improves error consistency, debugging capabilities, and maintainability across the entire ScopeDSL system.

## Table of Contents

1. [Migration Overview](#migration-overview)
2. [Before and After Examples](#before-and-after-examples)
3. [Step-by-Step Migration Process](#step-by-step-migration-process)
4. [Testing Your Migration](#testing-your-migration)
5. [Common Pitfalls](#common-pitfalls)
6. [Rollback Procedures](#rollback-procedures)
7. [Migration Checklist](#migration-checklist)

## Migration Overview

### What's Changing

| Old Approach | New Approach |
|--------------|--------------|
| Direct `throw new Error()` | Use `errorHandler.handleError()` |
| Inconsistent error messages | Standardized error codes |
| No error categorization | Automatic categorization |
| Limited debugging context | Rich context with sanitization |
| No error buffering | Circular buffer for analysis |

### Benefits of Migration

- **Consistent Error Format**: All errors follow the same structure
- **Better Debugging**: Environment-aware error detail levels
- **Error Analysis**: Built-in error buffering and pattern detection
- **Safer Context Handling**: Automatic circular reference sanitization
- **Standardized Codes**: Easy error identification and handling

## Before and After Examples

### Example 1: Basic Error Handling

**Before (Old Pattern):**
```javascript
export default function createFilterResolver({ logicEval, entitiesGateway }) {
  return {
    resolve(node, ctx) {
      // Direct error throwing
      if (!ctx.actorEntity) {
        throw new Error('FilterResolver: actorEntity is undefined in context');
      }
      
      if (!node.parent) {
        throw new Error('Filter node must have a parent');
      }
      
      try {
        // Resolution logic
        const parentResults = ctx.dispatcher(node.parent, ctx);
        return filterResults(parentResults, node.logic);
      } catch (err) {
        // Inconsistent error handling
        console.error('Filter failed:', err);
        throw err;
      }
    }
  };
}
```

**After (New Pattern):**
```javascript
import { ErrorCodes } from '../constants/errorCodes.js';

export default function createFilterResolver({ 
  logicEval, 
  entitiesGateway,
  errorHandler = null  // New dependency
}) {
  // Validate error handler if provided
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer']
    });
  }
  
  return {
    resolve(node, ctx) {
      // Use error handler for validation
      if (!ctx.actorEntity) {
        if (errorHandler) {
          errorHandler.handleError(
            'FilterResolver: actorEntity is undefined in context',
            ctx,
            'FilterResolver',
            ErrorCodes.MISSING_ACTOR
          );
        } else {
          // Fallback for backward compatibility
          throw new Error('FilterResolver: actorEntity is undefined in context');
        }
      }
      
      if (!node.parent) {
        if (errorHandler) {
          errorHandler.handleError(
            'Filter node must have a parent',
            { node, ...ctx },
            'FilterResolver',
            ErrorCodes.MISSING_NODE_PARENT
          );
        } else {
          throw new Error('Filter node must have a parent');
        }
      }
      
      try {
        // Resolution logic remains the same
        const parentResults = ctx.dispatcher(node.parent, ctx);
        return filterResults(parentResults, node.logic);
      } catch (err) {
        // Consistent error handling
        if (errorHandler) {
          errorHandler.handleError(
            err,
            ctx,
            'FilterResolver',
            ErrorCodes.FILTER_EVAL_FAILED
          );
        } else {
          throw err;
        }
      }
    }
  };
}
```

### Example 2: Complex Validation

**Before:**
```javascript
resolve(node, ctx) {
  // Multiple validation checks with inconsistent handling
  if (!ctx.actorEntity || !ctx.actorEntity.id) {
    throw new Error('Invalid actor');
  }
  
  if (typeof ctx.actorEntity.id !== 'string') {
    throw new Error('Actor ID must be a string');
  }
  
  if (ctx.depth > 10) {
    console.warn('Deep nesting detected');
    throw new Error('Too deep');
  }
  
  // Resolution logic...
}
```

**After:**
```javascript
resolve(node, ctx) {
  // Structured validation with specific error codes
  if (!ctx.actorEntity) {
    errorHandler.handleError(
      'Actor entity is required',
      ctx,
      'MyResolver',
      ErrorCodes.MISSING_ACTOR
    );
  }
  
  if (!ctx.actorEntity.id || typeof ctx.actorEntity.id !== 'string') {
    errorHandler.handleError(
      `Invalid actor ID: ${ctx.actorEntity.id}`,
      ctx,
      'MyResolver',
      ErrorCodes.INVALID_ACTOR_ID
    );
  }
  
  const depth = ctx.depth || 0;
  if (depth > MAX_DEPTH) {
    errorHandler.handleError(
      `Resolution depth ${depth} exceeds maximum ${MAX_DEPTH}`,
      { ...ctx, depth },
      'MyResolver',
      ErrorCodes.MAX_DEPTH_EXCEEDED
    );
  }
  
  // Resolution logic...
}
```

### Example 3: Circular Reference Detection

**Before:**
```javascript
resolve(node, ctx) {
  // Manual circular reference tracking
  const visited = ctx.visited || [];
  
  if (visited.includes(node.id)) {
    throw new Error(`Circular reference: ${node.id}`);
  }
  
  visited.push(node.id);
  
  try {
    // Resolution with manual context
    return doResolve(node, { ...ctx, visited });
  } catch (err) {
    throw new Error(`Failed at ${node.id}: ${err.message}`);
  }
}
```

**After:**
```javascript
resolve(node, ctx) {
  // Improved circular reference detection
  const visited = ctx.visited || new Set();
  
  if (visited.has(node.id)) {
    errorHandler.handleError(
      `Circular reference detected in scope chain: ${node.id}`,
      { 
        nodeId: node.id,
        visitedNodes: Array.from(visited),
        ...ctx
      },
      'ScopeReferenceResolver',
      ErrorCodes.CYCLE_DETECTED
    );
  }
  
  visited.add(node.id);
  
  try {
    // Resolution with enhanced context
    return doResolve(node, { ...ctx, visited });
  } catch (err) {
    errorHandler.handleError(
      err,
      { nodeId: node.id, ...ctx },
      'ScopeReferenceResolver',
      ErrorCodes.RESOLUTION_FAILED_GENERIC
    );
  }
}
```

## Step-by-Step Migration Process

### Step 1: Add Error Handler Dependency

Update your resolver factory function to accept the error handler:

```javascript
// Before
export default function createMyResolver({ dependency1, dependency2 }) {
  // ...
}

// After
export default function createMyResolver({ 
  dependency1, 
  dependency2,
  errorHandler = null  // Add as optional for backward compatibility
}) {
  // Validate if provided
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer']
    });
  }
  // ...
}
```

### Step 2: Import Error Codes

Add the necessary imports at the top of your file:

```javascript
import { ErrorCodes } from '../constants/errorCodes.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
```

### Step 3: Replace Direct Throws

Find all `throw new Error()` statements and replace with error handler calls:

```javascript
// Find patterns like:
throw new Error('Something went wrong');
throw new ScopeDslError('Invalid state');

// Replace with:
if (errorHandler) {
  errorHandler.handleError(
    'Something went wrong',
    ctx,
    'YourResolverName',
    ErrorCodes.APPROPRIATE_CODE
  );
} else {
  // Backward compatibility
  throw new Error('Something went wrong');
}
```

### Step 4: Enhance Error Context

Add relevant context to error handler calls:

```javascript
// Instead of minimal context
errorHandler.handleError(error, {}, 'Resolver');

// Provide rich context
errorHandler.handleError(
  error,
  {
    node: node,
    actorEntity: ctx.actorEntity,
    depth: ctx.depth,
    parentResults: parentResults,
    // Any other relevant data
  },
  'Resolver',
  ErrorCodes.SPECIFIC_CODE
);
```

### Step 5: Choose Appropriate Error Codes

Map your errors to the most specific error codes:

```javascript
// Common mappings
if (!entity) → ErrorCodes.MISSING_ACTOR
if (!component) → ErrorCodes.COMPONENT_RESOLUTION_FAILED
if (circular) → ErrorCodes.CYCLE_DETECTED
if (tooDeep) → ErrorCodes.MAX_DEPTH_EXCEEDED
if (invalidData) → ErrorCodes.INVALID_DATA_GENERIC
if (parseError) → ErrorCodes.SYNTAX_ERROR
```

### Step 6: Update Tests

Update your tests to expect the new error format:

```javascript
// Before
it('should throw on missing actor', () => {
  expect(() => resolver.resolve(node, {}))
    .toThrow('actorEntity is undefined');
});

// After
it('should throw ScopeDslError on missing actor', () => {
  const errorHandler = new ScopeDslErrorHandler({ logger });
  const resolver = createResolver({ errorHandler });
  
  expect(() => resolver.resolve(node, {}))
    .toThrow('[SCOPE_1001]');
});
```

## Testing Your Migration

### Unit Test Template

```javascript
describe('MyResolver - Error Handling', () => {
  let resolver;
  let errorHandler;
  let mockLogger;
  
  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
    
    errorHandler = new ScopeDslErrorHandler({ 
      logger: mockLogger,
      config: { isDevelopment: true }
    });
    
    resolver = createMyResolver({ errorHandler });
  });
  
  it('should handle missing actor with proper error code', () => {
    const ctx = { /* no actorEntity */ };
    
    expect(() => resolver.resolve(node, ctx))
      .toThrow('[SCOPE_1001]');
    
    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('MyResolver'),
      expect.objectContaining({ code: 'SCOPE_1001' })
    );
  });
  
  it('should buffer errors for analysis', () => {
    const ctx = { /* invalid context */ };
    
    try {
      resolver.resolve(node, ctx);
    } catch (e) {
      // Expected
    }
    
    const buffer = errorHandler.getErrorBuffer();
    expect(buffer).toHaveLength(1);
    expect(buffer[0].code).toBe('SCOPE_1001');
  });
});
```

### Integration Test Checklist

- [ ] Test with valid context - should work as before
- [ ] Test with missing actor - should throw SCOPE_1001
- [ ] Test with invalid data - should throw appropriate 2xxx code
- [ ] Test circular references - should throw SCOPE_4001
- [ ] Test deep nesting - should throw SCOPE_4002
- [ ] Verify error buffering works
- [ ] Check production vs development mode behavior

## Common Pitfalls

### Pitfall 1: Forgetting Backward Compatibility

**Wrong:**
```javascript
// This breaks existing code!
resolve(node, ctx) {
  errorHandler.handleError(...);  // errorHandler might be null!
}
```

**Right:**
```javascript
resolve(node, ctx) {
  if (errorHandler) {
    errorHandler.handleError(...);
  } else {
    throw new Error(...);  // Fallback
  }
}
```

### Pitfall 2: Using Wrong Error Codes

**Wrong:**
```javascript
// Using generic code for specific error
if (!ctx.actorEntity) {
  errorHandler.handleError(
    'Missing actor',
    ctx,
    'Resolver',
    ErrorCodes.UNKNOWN_ERROR  // Too generic!
  );
}
```

**Right:**
```javascript
if (!ctx.actorEntity) {
  errorHandler.handleError(
    'Missing actor',
    ctx,
    'Resolver',
    ErrorCodes.MISSING_ACTOR  // Specific code
  );
}
```

### Pitfall 3: Losing Error Details

**Wrong:**
```javascript
catch (err) {
  // Lost original error details!
  errorHandler.handleError(
    'Resolution failed',
    ctx,
    'Resolver'
  );
}
```

**Right:**
```javascript
catch (err) {
  // Preserve original error
  errorHandler.handleError(
    err,  // Pass original error
    ctx,
    'Resolver',
    ErrorCodes.RESOLUTION_FAILED_GENERIC
  );
}
```

### Pitfall 4: Circular References in Context

**Wrong:**
```javascript
// This creates a circular reference!
const context = { parent: ctx };
context.self = context;

errorHandler.handleError(error, context, 'Resolver');
```

**Right:**
```javascript
// Error handler sanitizes automatically, but avoid if possible
const context = {
  parentId: ctx.id,  // Reference by ID instead
  // Other safe properties
};

errorHandler.handleError(error, context, 'Resolver');
```

## Rollback Procedures

If you need to rollback the migration:

### 1. Keep Backward Compatibility

The migration is designed to be backward compatible:

```javascript
// This pattern allows gradual migration
if (errorHandler) {
  // New behavior
} else {
  // Old behavior
}
```

### 2. Disable Error Handler

To temporarily disable without code changes:

```javascript
// Pass null instead of error handler
const resolver = createResolver({
  dependency1,
  dependency2,
  errorHandler: null  // Disables new error handling
});
```

### 3. Full Rollback

If complete rollback is needed:

1. Remove `errorHandler` parameter from factory functions
2. Remove error handler validation
3. Replace `errorHandler.handleError()` calls with `throw new Error()`
4. Remove ErrorCodes imports
5. Update tests to expect old error format

## Migration Checklist

Use this checklist for each resolver you migrate:

### Pre-Migration
- [ ] Identify all error throwing locations
- [ ] Note existing error messages
- [ ] Review current tests
- [ ] Check for circular reference risks

### During Migration
- [ ] Add `errorHandler` parameter to factory
- [ ] Add parameter validation
- [ ] Import `ErrorCodes`
- [ ] Replace all `throw` statements
- [ ] Add proper error codes
- [ ] Enhance error context
- [ ] Maintain backward compatibility

### Post-Migration
- [ ] Run existing tests
- [ ] Add new error handling tests
- [ ] Test in development mode
- [ ] Test in production mode
- [ ] Verify error buffering
- [ ] Check error logs format
- [ ] Update documentation

### Verification
- [ ] No regression in functionality
- [ ] Errors have proper codes
- [ ] Context is properly sanitized
- [ ] Backward compatibility works
- [ ] Tests pass in CI/CD

## Best Practices Summary

1. **Always maintain backward compatibility** during migration
2. **Use the most specific error code** available
3. **Include relevant context** in error handler calls
4. **Test both development and production** modes
5. **Verify error buffering** works correctly
6. **Update tests** to match new error format
7. **Document any custom error patterns** in your resolver

## Getting Help

If you encounter issues during migration:

1. Check the [Error Codes Reference](../scopeDsl/error-codes-reference.md)
2. Review the [Error Handling Guide](../scopeDsl/error-handling-guide.md)
3. Look at migrated resolvers for examples (e.g., `filterResolver.js`)
4. Check test files for testing patterns
5. Consult the error handler source code for details

## Next Steps

After migrating your resolvers:

1. Monitor error patterns using the error buffer
2. Add custom error codes if needed
3. Optimize error messages for clarity
4. Consider adding error recovery mechanisms
5. Document any resolver-specific error patterns

Remember: The goal is to make errors more helpful for debugging while maintaining system stability and performance.
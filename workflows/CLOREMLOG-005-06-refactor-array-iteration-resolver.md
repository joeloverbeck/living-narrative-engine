# CLOREMLOG-005-06: Refactor ArrayIterationResolver

## Overview
**Parent**: CLOREMLOG-005  
**Priority**: High  
**Estimated Effort**: 2.5 hours  
**Dependencies**: CLOREMLOG-005-05  
**Blocks**: CLOREMLOG-005-07, CLOREMLOG-005-08

## Problem Statement
ArrayIterationResolver currently contains embedded clothing accessibility logic that should be delegated to the new ClothingAccessibilityService. This refactoring will improve separation of concerns and maintainability.

## Acceptance Criteria

### 1. Remove Embedded Coverage Logic
- [ ] Remove coverage analyzer initialization from resolver
- [ ] Remove `getAllClothingItems` method
- [ ] Remove layer priority constants
- [ ] Remove coverage priority mapping

### 2. Integrate Accessibility Service
- [ ] Accept ClothingAccessibilityService in constructor
- [ ] Delegate clothing queries to service
- [ ] Maintain existing API contract
- [ ] Handle service not available gracefully

### 3. Update Tests
- [ ] Update unit tests to mock accessibility service
- [ ] Ensure existing test behavior preserved
- [ ] Add tests for service delegation

## Implementation Details

### Refactored ArrayIterationResolver
```javascript
// src/scopeDsl/nodes/arrayIterationResolver.js

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ErrorCodes } from '../constants/errorCodes.js';

/**
 * Creates an ArrayIterationStep node resolver for flattening array values.
 * Now delegates clothing accessibility logic to ClothingAccessibilityService.
 *
 * @param {object} deps - Dependencies
 * @param {object} [deps.clothingAccessibilityService] - Service for clothing queries
 * @param {object} [deps.errorHandler] - Optional error handler
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createArrayIterationResolver({
  clothingAccessibilityService = null,
  errorHandler = null,
} = {}) {
  // Validate if provided
  if (errorHandler) {
    validateDependency(errorHandler, 'IScopeDslErrorHandler', console, {
      requiredMethods: ['handleError', 'getErrorBuffer'],
    });
  }
  
  if (clothingAccessibilityService) {
    validateDependency(clothingAccessibilityService, 'ClothingAccessibilityService', console, {
      requiredMethods: ['getAccessibleItems'],
    });
  }

  const MAX_ARRAY_SIZE = 10000;

  /**
   * Process clothing access objects using accessibility service
   * @private
   */
  function processClothingAccess(clothingAccess, trace) {
    const { entityId, mode = 'topmost' } = clothingAccess;
    
    if (!clothingAccessibilityService) {
      if (trace && trace.addStep) {
        trace.addStep('No clothing accessibility service available, returning empty array');
      }
      if (errorHandler) {
        errorHandler.handleError(
          'Clothing accessibility service not available',
          { context: 'processClothingAccess', entityId, mode },
          'ArrayIterationResolver',
          ErrorCodes.SERVICE_NOT_AVAILABLE
        );
      }
      return [];
    }
    
    try {
      // Delegate to accessibility service
      const options = {
        mode,
        context: 'removal', // Default context for array iteration
        sortByPriority: true
      };
      
      const accessibleItems = clothingAccessibilityService.getAccessibleItems(
        entityId, 
        options
      );
      
      if (trace && trace.addStep) {
        trace.addStep(`Retrieved ${accessibleItems.length} accessible items for mode: ${mode}`);
      }
      
      return accessibleItems;
    } catch (error) {
      if (trace && trace.addStep) {
        trace.addStep(`Clothing access failed: ${error.message}`);
      }
      if (errorHandler) {
        errorHandler.handleError(
          error,
          { context: 'processClothingAccess', entityId, mode },
          'ArrayIterationResolver',
          ErrorCodes.CLOTHING_ACCESS_FAILED
        );
      }
      return [];
    }
  }

  return {
    /**
     * Checks if this resolver can handle the given node.
     *
     * @param {object} node - The node to check
     * @returns {boolean} True if node type is 'ArrayIterationStep'
     */
    canResolve(node) {
      return node.type === 'ArrayIterationStep';
    },

    /**
     * Resolves an ArrayIterationStep node by flattening arrays from parent results.
     *
     * @param {object} node - The ArrayIterationStep node to resolve
     * @param {object} ctx - Resolution context with actorEntity, trace, etc.
     * @returns {Set} Set of flattened values from arrays
     */
    resolve(node, ctx) {
      // Validate context
      if (!ctx.actorEntity) {
        const error = new Error(
          'ArrayIterationResolver: actorEntity is missing from context'
        );
        if (errorHandler) {
          errorHandler.handleError(
            error,
            ctx,
            'ArrayIterationResolver',
            ErrorCodes.MISSING_ACTOR
          );
        }
        throw error;
      }

      // Resolve parent node
      const parentResults = ctx.dispatcher
        ? ctx.dispatcher.resolve(node.parent, ctx)
        : new Set();

      const flattened = new Set();
      let totalArrayElements = 0;

      // Process each parent result
      for (const parentValue of parentResults) {
        if (parentValue === null || parentValue === undefined) {
          continue;
        }

        // Handle clothing access objects
        if (parentValue.isClothingAccess === true) {
          const clothingItems = processClothingAccess(parentValue, ctx.trace);
          
          for (const itemId of clothingItems) {
            totalArrayElements++;
            if (totalArrayElements > MAX_ARRAY_SIZE) {
              if (errorHandler) {
                errorHandler.handleError(
                  'Array size limit exceeded',
                  { 
                    limit: MAX_ARRAY_SIZE, 
                    current: totalArrayElements 
                  },
                  'ArrayIterationResolver',
                  ErrorCodes.ARRAY_SIZE_EXCEEDED
                );
              }
              break;
            }
            flattened.add(itemId);
          }
          continue;
        }

        // Handle regular arrays
        if (Array.isArray(parentValue)) {
          for (const item of parentValue) {
            totalArrayElements++;
            if (totalArrayElements > MAX_ARRAY_SIZE) {
              if (errorHandler) {
                errorHandler.handleError(
                  'Array size limit exceeded',
                  { 
                    limit: MAX_ARRAY_SIZE, 
                    current: totalArrayElements 
                  },
                  'ArrayIterationResolver',
                  ErrorCodes.ARRAY_SIZE_EXCEEDED
                );
              }
              break;
            }
            flattened.add(item);
          }
          continue;
        }

        // Non-array values passed through
        flattened.add(parentValue);
      }

      if (ctx.trace && ctx.trace.addStep) {
        ctx.trace.addStep(
          `ArrayIterationResolver flattened ${totalArrayElements} elements`
        );
      }

      return flattened;
    },
  };
}
```

### Update Factory Registration
```javascript
// src/scopeDsl/factories/nodeResolverFactory.js
// Update the array iteration resolver creation

import createArrayIterationResolver from '../nodes/arrayIterationResolver.js';

export function createNodeResolverFactory(container) {
  // Get services from container if available
  const clothingAccessibilityService = container?.resolve 
    ? container.resolve('ClothingAccessibilityService')
    : null;
    
  const errorHandler = container?.resolve 
    ? container.resolve('IScopeDslErrorHandler')
    : null;

  // Create resolver with services
  const arrayIterationResolver = createArrayIterationResolver({
    clothingAccessibilityService,
    errorHandler
  });
  
  // ... rest of factory setup
}
```

### Update Tests
```javascript
// tests/unit/scopeDsl/nodes/arrayIterationResolver.test.js

describe('ArrayIterationResolver with ClothingAccessibilityService', () => {
  let resolver;
  let mockAccessibilityService;
  let mockErrorHandler;
  
  beforeEach(() => {
    mockAccessibilityService = {
      getAccessibleItems: jest.fn()
    };
    
    mockErrorHandler = {
      handleError: jest.fn(),
      getErrorBuffer: jest.fn(() => [])
    };
    
    resolver = createArrayIterationResolver({
      clothingAccessibilityService: mockAccessibilityService,
      errorHandler: mockErrorHandler
    });
  });
  
  describe('Clothing access delegation', () => {
    it('should delegate clothing access to service', () => {
      const clothingAccess = {
        isClothingAccess: true,
        entityId: 'test-entity',
        mode: 'topmost'
      };
      
      mockAccessibilityService.getAccessibleItems.mockReturnValue([
        'item1', 'item2'
      ]);
      
      const ctx = {
        actorEntity: 'actor',
        dispatcher: {
          resolve: jest.fn(() => new Set([clothingAccess]))
        }
      };
      
      const result = resolver.resolve({ parent: {} }, ctx);
      
      expect(mockAccessibilityService.getAccessibleItems).toHaveBeenCalledWith(
        'test-entity',
        expect.objectContaining({
          mode: 'topmost',
          context: 'removal',
          sortByPriority: true
        })
      );
      
      expect(result).toEqual(new Set(['item1', 'item2']));
    });
    
    it('should handle service not available', () => {
      resolver = createArrayIterationResolver({
        clothingAccessibilityService: null,
        errorHandler: mockErrorHandler
      });
      
      const clothingAccess = {
        isClothingAccess: true,
        entityId: 'test-entity',
        mode: 'topmost'
      };
      
      const ctx = {
        actorEntity: 'actor',
        dispatcher: {
          resolve: jest.fn(() => new Set([clothingAccess]))
        }
      };
      
      const result = resolver.resolve({ parent: {} }, ctx);
      
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        'Clothing accessibility service not available',
        expect.any(Object),
        'ArrayIterationResolver',
        expect.any(String)
      );
      
      expect(result).toEqual(new Set());
    });
    
    it('should handle service errors gracefully', () => {
      mockAccessibilityService.getAccessibleItems.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      const clothingAccess = {
        isClothingAccess: true,
        entityId: 'test-entity'
      };
      
      const ctx = {
        actorEntity: 'actor',
        dispatcher: {
          resolve: jest.fn(() => new Set([clothingAccess]))
        }
      };
      
      const result = resolver.resolve({ parent: {} }, ctx);
      
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
      expect(result).toEqual(new Set());
    });
  });
  
  describe('Regular array handling', () => {
    it('should still handle regular arrays', () => {
      const ctx = {
        actorEntity: 'actor',
        dispatcher: {
          resolve: jest.fn(() => new Set([[1, 2, 3]]))
        }
      };
      
      const result = resolver.resolve({ parent: {} }, ctx);
      
      expect(result).toEqual(new Set([1, 2, 3]));
    });
  });
});
```

## Testing Requirements

### Regression Tests
- [ ] All existing ArrayIterationResolver tests still pass
- [ ] Layla Agirre integration test still passes
- [ ] Clothing removal functionality works correctly

### New Tests
- [ ] Service delegation tests
- [ ] Error handling when service unavailable
- [ ] Backward compatibility tests

## Success Metrics
- [ ] ArrayIterationResolver code reduced by ~150 lines
- [ ] No embedded clothing logic in resolver
- [ ] All tests pass
- [ ] No regression in functionality
- [ ] Improved separation of concerns

## Notes
- This is a breaking change for the resolver factory
- Service injection is optional for backward compatibility
- Error handling ensures graceful degradation
- Maintains exact same external API
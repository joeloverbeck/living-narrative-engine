# Scope DSL Union Operator and Enhanced Filter Syntax Specification

## Overview

This specification details the implementation of two missing features in the Living Narrative Engine's Scope DSL:

1. **Union Operator (`|`)** - Allow combining results from multiple scope expressions
2. **Enhanced Filter Syntax** - Support complex property-based filtering on scope results

## Current State Analysis

### Existing Infrastructure

The Scope DSL currently supports:

- Basic union via `+` operator (implemented in parser as `PLUS` token)
- JSON Logic filters using `[{...}]` syntax
- Clothing-specific resolvers for specialized queries
- Array iteration with `[]` syntax
- Depth guards and cycle detection

### Gaps Identified

1. **Union Operator**: The parser recognizes `PLUS` for unions but not the pipe (`|`) operator
2. **Filter Limitations**: Current filters only support entity-level filtering, not property filtering on resolved items

## Feature 1: Union Operator (`|`)

### Syntax Design

```
expression := expression '|' expression
```

Examples:

```
actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower
actor.followers | actor.intimacy:closeness.partners
entities(core:actor) | entities(core:npc)
```

### Implementation Strategy

#### 1. Tokenizer Enhancement

Add pipe token to `tokenizer.js`:

```javascript
// In tokenizer.js switch statement
case '|':
  this.push('PIPE', '|');
  break;
```

#### 2. Parser Modification

Update `parseExpr()` in `parser.js` to handle pipe operator:

```javascript
parseExpr() {
  const left = this.parseTerm();

  // Check for union operators (both + and |)
  if (this.match('PLUS') || this.match('PIPE')) {
    const operatorToken = this.advance();
    const right = this.parseExpr();
    return {
      type: 'Union',
      operator: operatorToken.value, // Track which operator was used
      left,
      right
    };
  }
  return left;
}
```

#### 3. Union Resolver Update

The existing `unionResolver.js` already handles the Union AST node correctly. No changes needed.

### Backward Compatibility

- Existing `+` operator continues to work
- Both operators produce identical AST nodes (type: 'Union')
- No breaking changes to existing scope files

## Feature 2: Enhanced Filter Syntax

### Syntax Design

Enable filtering on properties of resolved items, not just entities:

```
scope_expression[filter_expression]
```

Examples:

```
// Filter clothing items by tags
actor.topmost_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]

// Filter by material type
actor.all_clothing[][{"==": [{"var": "components.clothing:material.type"}, "leather"]}]

// Complex multi-property filter
actor.outer_clothing[][{
  "and": [
    {"in": ["protective", {"var": "components.core:tags.tags"}]},
    {">": [{"var": "components.clothing:armor.rating"}, 5]}
  ]
}]
```

### Implementation Strategy

#### 1. Filter Context Enhancement

The current `filterResolver.js` creates evaluation contexts for entities. We need to extend this to handle non-entity items (like clothing item IDs).

#### 2. Evaluation Context Factory

Create a more flexible evaluation context that can handle different item types:

```javascript
// In createEvaluationContext function
function createEvaluationContext(
  item,
  actorEntity,
  entitiesGateway,
  locationProvider,
  trace
) {
  // Existing entity handling
  if (typeof item === 'string' && item.includes(':')) {
    // This looks like an entity ID
    const entity = entitiesGateway.getEntity(item);
    if (entity) {
      return createEntityContext(
        entity,
        actorEntity,
        entitiesGateway,
        locationProvider
      );
    }
  }

  // NEW: Handle item IDs (like clothing items)
  if (typeof item === 'string') {
    // Try to resolve as an item with components
    const itemData = entitiesGateway.getComponentData(item, null);
    if (itemData) {
      return {
        id: item,
        components: itemData,
        // Expose component data at root level for simpler var access
        ...flattenComponents(itemData),
      };
    }
  }

  // Fallback for other types
  return { id: item, value: item };
}
```

#### 3. Component Data Resolution

Enhance the entities gateway to support item lookups:

```javascript
// In engine.js _createEntitiesGateway
getItemComponents: (itemId) => {
  // Check if this is an entity first
  const entity = runtimeCtx?.entityManager?.getEntity(itemId);
  if (entity) {
    return gatherEntityComponents(entity);
  }

  // Otherwise, check component registries for item definitions
  const componentRegistry = runtimeCtx?.componentRegistry;
  if (componentRegistry) {
    return componentRegistry.getItemComponents(itemId);
  }

  return null;
};
```

#### 4. Filter Resolver Enhancement

Update `filterResolver.js` to use the enhanced evaluation context:

```javascript
// In resolve method
for (const item of parentResult) {
  // Enhanced context creation handles both entities and items
  const evalCtx = createEvaluationContext(
    item,
    actorEntity,
    entitiesGateway,
    locationProvider,
    trace
  );

  if (evalCtx && logicEval.evaluate(node.logic, evalCtx)) {
    result.add(item);
  }
}
```

### Property Access Patterns

Support various property access patterns in filters:

1. **Direct component access**: `{"var": "components.core:tags.tags"}`
2. **Flattened access**: `{"var": "tags"}` (when component data is flattened)
3. **Nested properties**: `{"var": "components.clothing:armor.protection.value"}`

## Integration with Existing Features

### Clothing Resolver Compatibility

The enhanced filter syntax works seamlessly with clothing resolvers:

```
// Get all waterproof outer clothing
actor.outer_clothing[][{"in": ["waterproof", {"var": "tags"}]}]

// Get clothing with high armor rating from specific slot
actor.topmost_clothing.torso_upper[{">": [{"var": "armor_rating"}, 10]}]
```

### Union and Filter Combination

Combine both features for powerful queries:

```
// Get all protective items from upper and lower body
(actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower)[{
  "in": ["protective", {"var": "tags"}]
}]
```

## Implementation Plan

### Phase 1: Union Operator (Low Complexity)

1. Add `PIPE` token to tokenizer
2. Update parser to recognize `|` as union operator
3. Add tests for pipe operator
4. Update documentation

### Phase 2: Enhanced Filter Syntax (Medium Complexity)

1. Implement flexible evaluation context factory
2. Enhance entities gateway with item lookup capabilities
3. Update filter resolver to handle non-entity items
4. Add comprehensive tests for property filtering
5. Update documentation with examples

### Phase 3: Integration Testing (Low Complexity)

1. Test union + filter combinations
2. Test with clothing resolver chains
3. Performance testing with large datasets
4. Edge case validation

## Testing Strategy

### Unit Tests

1. **Tokenizer Tests**
   - Verify `|` produces `PIPE` token
   - Test position tracking

2. **Parser Tests**
   - Verify `|` creates Union AST nodes
   - Test precedence with other operators
   - Error handling for malformed expressions

3. **Filter Tests**
   - Property access on non-entity items
   - Complex nested property filters
   - Type coercion and null handling

### Integration Tests

1. **Union Operator**

   ```javascript
   it('should handle union of clothing queries', () => {
     const ast = parser.parse(
       'actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower'
     );
     const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);
     expect(result).toEqual(new Set(['leather_jacket_001', 'jeans_004']));
   });
   ```

2. **Enhanced Filters**

   ```javascript
   it('should handle filtered clothing results', () => {
     // Setup mock data with component properties
     mockRuntimeContext.entityManager.getItemComponents.mockImplementation(
       (itemId) => {
         if (itemId === 'leather_jacket_001') {
           return { 'core:tags': { tags: ['waterproof', 'armor'] } };
         }
         return null;
       }
     );

     const ast = parser.parse(
       'actor.topmost_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]'
     );
     const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);
     expect(result).toEqual(new Set(['leather_jacket_001']));
   });
   ```

## Performance Considerations

1. **Evaluation Context Caching**: Cache created contexts within a resolution cycle
2. **Component Lookup Optimization**: Batch component lookups when possible
3. **Filter Short-Circuiting**: Stop evaluation early for complex AND conditions

## Security Considerations

1. **Property Access Control**: Ensure filters can only access allowed component properties
2. **Infinite Loop Prevention**: Maintain existing depth guards
3. **Input Sanitization**: Validate filter expressions to prevent injection

## Migration Guide

### For Mod Developers

1. **Union Operator**: Can immediately start using `|` in scope files
2. **Property Filters**: Review existing filters and enhance with property checks where beneficial

### Example Migrations

Before:

```
// Multiple scope definitions
torso_clothing := actor.topmost_clothing.torso_upper
leg_clothing := actor.topmost_clothing.torso_lower
// Then combine programmatically
```

After:

```
// Single expression with union
upper_and_lower := actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower
```

## Future Enhancements

1. **Set Operations**: Intersection (`&`), difference (`-`)
2. **Transform Operators**: Map operations on results
3. **Aggregate Functions**: Count, sum, average in filters
4. **Named Filters**: Reusable filter definitions

## Conclusion

These enhancements make the Scope DSL more powerful while maintaining its simplicity and performance. The union operator provides intuitive result combination, while enhanced filters enable sophisticated property-based queries. Both features integrate seamlessly with existing functionality and follow established patterns in the codebase.

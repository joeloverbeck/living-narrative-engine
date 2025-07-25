# Scope DSL Union Operator and Enhanced Filter Syntax Implementation

**Project**: Living Narrative Engine  
**Feature**: Union Operator (`|`) and Enhanced Filter Syntax  
**Timeline**: 2-3 weeks  
**Priority**: High  
**Status**: Planning

## Overview

This workflow implements two critical missing features in the Living Narrative Engine's Scope DSL:

1. **Union Operator (`|`)** - Enable combining results from multiple scope expressions using the pipe operator
2. **Enhanced Filter Syntax** - Support complex property-based filtering on scope results beyond entity-level filtering

These features will enable powerful queries like:

- `actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower`
- `actor.all_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]`

## Implementation Phases

### Phase 1: Union Operator Implementation (3-4 days)

**Complexity**: Low  
**File**: [scope-dsl-union-filter-phase1-union-operator.workflow.md](./scope-dsl-union-filter-phase1-union-operator.workflow.md)

- Add `PIPE` token to tokenizer
- Update parser to recognize `|` as union operator
- Ensure backward compatibility with existing `+` operator
- Comprehensive unit and integration tests
- Documentation updates

### Phase 2: Enhanced Filter Syntax (5-7 days)

**Complexity**: Medium  
**File**: [scope-dsl-union-filter-phase2-enhanced-filters.workflow.md](./scope-dsl-union-filter-phase2-enhanced-filters.workflow.md)

- Implement flexible evaluation context factory
- Enhance entities gateway with item lookup capabilities
- Update filter resolver to handle non-entity items
- Support property access patterns in filters
- Comprehensive testing suite

### Phase 3: Integration Testing & Polish (2-3 days)

**Complexity**: Low  
**File**: [scope-dsl-union-filter-phase3-integration-testing.workflow.md](./scope-dsl-union-filter-phase3-integration-testing.workflow.md)

- Combined feature testing (union + filters)
- Performance optimization and benchmarking
- Edge case validation
- Documentation and migration guide
- Release preparation

## Key Deliverables

1. **Union Operator**
   - Tokenizer support for `|` character
   - Parser recognition and AST generation
   - Full backward compatibility with `+` operator
   - Zero breaking changes to existing scope files

2. **Enhanced Filter Syntax**
   - Property-based filtering on any resolved items
   - Support for clothing items, entity properties, and custom data
   - Flexible evaluation context handling
   - Multiple property access patterns

3. **Quality Assurance**
   - 90%+ test coverage for new features
   - Performance benchmarks showing <5% overhead
   - Comprehensive documentation
   - Migration examples for mod developers

## Technical Architecture

### Union Operator Flow

```
Expression → Tokenizer → Parser → AST (Union node) → UnionResolver → Combined Set
```

### Enhanced Filter Flow

```
Scope Result → Filter Expression → Evaluation Context → JSON Logic → Filtered Set
```

### Key Components Modified

- `src/scopeDsl/parser/tokenizer.js` - Add PIPE token
- `src/scopeDsl/parser/parser.js` - Handle pipe operator
- `src/scopeDsl/nodes/filterResolver.js` - Enhanced context creation
- `src/scopeDsl/engine.js` - Item component lookup support
- `src/scopeDsl/core/entityHelpers.js` - Flexible context factory

## Success Criteria

1. **Functional Requirements**
   - Union operator works identically to `+` operator
   - Filters can access any property on resolved items
   - All existing scope files continue to work without modification
   - New syntax integrates seamlessly with clothing resolvers

2. **Performance Requirements**
   - Query execution time increase <5% for complex queries
   - Memory usage remains stable with large result sets
   - No performance regression in existing queries

3. **Quality Requirements**
   - All tests pass (unit, integration, e2e)
   - No new linting errors
   - Documentation complete and accurate
   - Migration guide provided for mod developers

## Risk Mitigation

1. **Backward Compatibility**
   - Extensive testing with existing scope files
   - No changes to existing AST node structures
   - Careful validation of parser modifications

2. **Performance Impact**
   - Benchmark before and after implementation
   - Optimize evaluation context creation
   - Consider caching strategies for repeated lookups

3. **Edge Cases**
   - Test with malformed expressions
   - Handle null/undefined gracefully
   - Validate against infinite loops

## Dependencies

- No external library dependencies
- Requires understanding of:
  - JSON Logic evaluation
  - AST parsing and traversal
  - Set operations in JavaScript
  - Entity Component System architecture

## Testing Strategy

1. **Unit Tests** - Each modified component
2. **Integration Tests** - Feature combinations
3. **E2E Tests** - Real-world usage scenarios
4. **Performance Tests** - Benchmark suite
5. **Regression Tests** - Existing functionality

## Documentation Requirements

1. **Code Documentation**
   - JSDoc comments for all new functions
   - Inline comments for complex logic
   - Type annotations for better IDE support

2. **User Documentation**
   - Update scope DSL reference guide
   - Add examples to documentation
   - Create migration guide

3. **Developer Documentation**
   - Architecture decisions
   - Performance considerations
   - Extension points for future features

## Future Enhancements (Out of Scope)

These are noted for future consideration but NOT part of this implementation:

- Set operations (intersection `&`, difference `-`)
- Transform operators (map operations)
- Aggregate functions (count, sum, average)
- Named filter definitions

## Team Notes

- Follow existing code patterns in the scopeDsl module
- Use dependency injection for all new components
- Maintain high test coverage (>90%)
- Run all quality commands after each modification
- Update CLAUDE.md if new patterns are introduced

---

Ready to begin implementation. Proceed to Phase 1: [Union Operator Implementation](./scope-dsl-union-filter-phase1-union-operator.workflow.md)

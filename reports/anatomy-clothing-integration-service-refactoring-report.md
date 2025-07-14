# AnatomyClothingIntegrationService Refactoring Report

## Executive Summary

The `AnatomyClothingIntegrationService` is a critical bridge between the anatomy and clothing domains in the Living Narrative Engine. This architectural review has identified significant opportunities for improvement through refactoring. The service currently violates several SOLID principles, exhibits high coupling, and contains performance bottlenecks that impact maintainability and scalability.

### Critical Findings

- **Single Responsibility Violation**: Service handles 6+ distinct responsibilities
- **High Coupling**: Direct dependencies on EntityManager, BodyGraphService, and DataRegistry
- **Performance Issues**: Sequential async operations and O(n²) fallback searches
- **Technical Debt**: Defensive programming patterns compensating for unreliable dependencies
- **Testing Complexity**: 6 separate test files indicate unmanageable complexity

### Priority Recommendation

Decompose the monolithic service into focused, composable components following Domain-Driven Design principles.

## Architectural Analysis

### Current Architecture Overview

The service acts as a facade that:

1. Maps clothing slots to anatomy attachment points
2. Validates clothing-anatomy compatibility
3. Manages blueprint and slot resolution caching
4. Provides fallback mechanisms for incomplete body graphs
5. Directly queries entity components

### SOLID Principle Violations

#### Single Responsibility Principle (SRP)

The service violates SRP by handling multiple concerns:

- **Data Access**: Direct blueprint and component queries
- **Business Logic**: Slot-to-socket mapping algorithms
- **Caching**: Multiple cache management strategies
- **Validation**: Compatibility checking
- **Fallback Logic**: Compensating for BodyGraphService reliability issues
- **Entity Querying**: Direct EntityManager interactions

#### Open/Closed Principle (OCP)

Adding new slot resolution strategies requires modifying the service directly rather than extending through abstraction.

#### Dependency Inversion Principle (DIP)

The service depends on concrete implementations rather than abstractions:

```javascript
// Current: Concrete dependency
this.#bodyGraphService = bodyGraphService;

// Should be: Abstract dependency
this.#anatomyQueryService = anatomyQueryService; // Interface
```

### Coupling Analysis

#### Afferent Coupling (Ca)

Services that depend on AnatomyClothingIntegrationService:

- `ClothingManagementService`
- `ClothingInstantiationService`
- `EquipmentOrchestrator`

#### Efferent Coupling (Ce)

Services that AnatomyClothingIntegrationService depends on:

- `EntityManager` (data access)
- `BodyGraphService` (anatomy structure)
- `DataRegistry` (blueprint data)
- `BaseService` (inheritance)

**Instability**: I = Ce/(Ca+Ce) = 4/(3+4) = 0.57 (moderately unstable)

### Architectural Smells

1. **Feature Envy**: Methods like `#resolveBlueprintSlots` and `#findEntityWithSocket` manipulate data from other services extensively
2. **Inappropriate Intimacy**: Deep knowledge of component data structures (`anatomy:sockets`, `anatomy:body`)
3. **God Object Tendencies**: 654 lines handling multiple unrelated concerns

## Code Quality Assessment

### Method Complexity Analysis

| Method                                  | Lines | Cyclomatic Complexity | Issues                                            |
| --------------------------------------- | ----- | --------------------- | ------------------------------------------------- |
| `resolveClothingSlotToAttachmentPoints` | 58    | 6                     | Cache key construction, multiple resolution paths |
| `#resolveBlueprintSlots`                | 43    | 8                     | Nested loops, multiple continue statements        |
| `#getEntityAnatomyStructure`            | 57    | 7                     | Defensive fallback logic, high branching          |
| `#findAnatomyPartsByJoints`             | 62    | 9                     | O(n²) complexity, nested loops                    |
| `#validateSlotMapping`                  | 35    | 8                     | Multiple validation strategies                    |

### Code Smells Identified

#### 1. Long Methods

Methods exceeding 20 lines with multiple responsibilities:

- `getAvailableClothingSlots` (42 lines)
- `#resolveBlueprintSlots` (43 lines)
- `#getEntityAnatomyStructure` (57 lines)

#### 2. Primitive Obsession

Using strings for type-safe concepts:

```javascript
// Current
const cacheKey = `${entityId}:${slotId}`;

// Should use value objects
const cacheKey = new SlotCacheKey(entityId, slotId);
```

#### 3. Magic Strings

Repeated component type strings throughout:

- `'anatomy:sockets'` (6 occurrences)
- `'anatomy:body'` (2 occurrences)
- `'anatomy:joint'` (2 occurrences)

#### 4. Inconsistent Abstraction Levels

High-level business logic mixed with low-level implementation:

```javascript
// High-level
const mapping = slots.get(slotId);

// Low-level in same method
for (const socket of socketsComponent.sockets) {
  if (socketIds.includes(socket.id)) {
    // ...
  }
}
```

### Maintainability Issues

1. **Deep Nesting**: Up to 4 levels in `#resolveDirectSockets`
2. **Mixed Return Types**: Some methods return null, others empty collections
3. **Inconsistent Error Handling**: Throws in public methods, returns null in private
4. **String-based Orientation Detection**: Fragile heuristics in `#extractOrientation`

## Performance Analysis

### Identified Bottlenecks

#### 1. Sequential Async Operations

```javascript
// Current: Sequential processing
for (const partId of bodyParts) {
  const socketsComponent = await this.#entityManager.getComponentData(
    partId,
    'anatomy:sockets'
  );
  // Process...
}

// Should be: Parallel processing
const socketComponents = await Promise.all(
  bodyParts.map((partId) =>
    this.#entityManager.getComponentData(partId, 'anatomy:sockets')
  )
);
```

#### 2. O(n²) Fallback Search

The `#findAnatomyPartsByJoints` method performs nested iterations:

- Outer loop: All entities with joints
- Inner loop: Processing queue
- **Complexity**: O(n²) where n = number of entities

#### 3. Inefficient Cache Strategy

- **Blueprint Cache**: Never invalidated (memory leak risk)
- **Slot Resolution Cache**: No TTL or size limits
- **Missing Caches**: Socket lookups repeatedly scan same data

### Algorithmic Complexity

| Operation                | Current | Optimal                | Impact                    |
| ------------------------ | ------- | ---------------------- | ------------------------- |
| Find socket in anatomy   | O(n\*m) | O(1) with index        | High for large anatomies  |
| Resolve blueprint slots  | O(n)    | O(1) with mapping      | Medium                    |
| Fallback joint traversal | O(n²)   | O(n) with proper graph | Critical for large worlds |

## Technical Debt Inventory

### High Priority Debt

1. **Defensive Fallback Pattern** (Lines 467-481)
   - **Issue**: Compensating for unreliable BodyGraphService
   - **Impact**: Performance degradation, code complexity
   - **Root Cause**: Incomplete anatomy cache updates

2. **Incomplete Implementation** (Line 205)
   - **Comment**: "Additional validation could include..."
   - **Missing**: Layer compatibility, coverage validation, conflict detection

3. **API Inconsistency** (Line 550)
   - **Issue**: Mixed property names (entityId/parentEntityId/parentId)
   - **Impact**: Confusion, potential bugs

### Medium Priority Debt

1. **Test Proliferation**
   - **6 test files** for single service
   - **Indicates**: Overcomplicated implementation
   - **Solution**: Simplify service, consolidate tests

2. **Cache Invalidation**
   - **Missing**: Clear cache strategy
   - **Risk**: Stale data, memory leaks

### Low Priority Debt

1. **Type Safety**
   - **JSDoc types** instead of TypeScript
   - **Risk**: Runtime type errors

## Refactoring Recommendations

### 1. Decomposition Strategy

Transform the monolithic service into focused components:

```javascript
// Domain Layer
class ClothingSlot {
  constructor(id, mapping) {
    this.id = id;
    this.mapping = mapping;
  }
}

class AnatomySocket {
  constructor(entityId, socketId, orientation) {
    this.entityId = entityId;
    this.socketId = socketId;
    this.orientation = orientation;
  }
}

// Application Services
class AnatomySlotResolver {
  async resolveSlotToSockets(entityId, slotId) {
    // Pure slot resolution logic
  }
}

class AnatomyBlueprintRepository {
  async getBlueprint(recipeId) {
    // Centralized blueprint access with caching
  }
}

class AnatomySocketIndex {
  async findSocketLocation(rootEntityId, socketId) {
    // Optimized O(1) socket lookup
  }
}

class ClothingCompatibilityValidator {
  async validate(entityId, slotId, itemId) {
    // Pure validation logic
  }
}

// Infrastructure
class AnatomyClothingCache {
  constructor(cacheStrategy) {
    // Configurable caching with TTL, size limits
  }
}
```

### 2. Pattern Applications

#### Strategy Pattern for Resolution

```javascript
interface SlotResolutionStrategy {
    canResolve(mapping);
    resolve(entityId, mapping);
}

class BlueprintSlotStrategy implements SlotResolutionStrategy {
    // Blueprint-based resolution
}

class DirectSocketStrategy implements SlotResolutionStrategy {
    // Direct socket resolution
}

class SlotResolver {
    constructor(strategies) {
        this.strategies = strategies;
    }

    async resolve(entityId, mapping) {
        const strategy = this.strategies.find(s => s.canResolve(mapping));
        return strategy.resolve(entityId, mapping);
    }
}
```

#### Repository Pattern for Data Access

```javascript
interface AnatomyDataRepository {
    getBlueprint(recipeId);
    getEntitySockets(entityId);
    getBodyComponent(entityId);
}

class CachedAnatomyRepository implements AnatomyDataRepository {
    constructor(dataRegistry, cache) {
        // Centralized data access with caching
    }
}
```

#### Specification Pattern for Validation

```javascript
class SlotMappingSpecification {
  isSatisfiedBy(mapping, anatomyStructure, blueprint) {
    // Encapsulated validation logic
  }
}

class LayerCompatibilitySpecification {
  isSatisfiedBy(slot, item) {
    // Layer validation logic
  }
}
```

### 3. Performance Optimizations

#### Parallel Processing

```javascript
class OptimizedSocketFinder {
  async findSocketsInParts(partIds) {
    const socketPromises = partIds.map((id) =>
      this.entityManager.getComponentData(id, COMPONENT_TYPES.SOCKETS)
    );

    const results = await Promise.allSettled(socketPromises);
    return this.processSocketResults(results);
  }
}
```

#### Socket Index

```javascript
class AnatomySocketIndex {
  #socketToEntity = new Map(); // socketId -> entityId

  async rebuild(rootEntityId) {
    // Build O(1) lookup index
  }

  findEntity(socketId) {
    return this.#socketToEntity.get(socketId);
  }
}
```

## Implementation Roadmap

### Phase 1: Extract Data Access (Week 1)

1. Create `AnatomyBlueprintRepository` interface
2. Implement `CachedAnatomyRepository`
3. Extract all DataRegistry calls
4. Update tests

### Phase 2: Extract Socket Finding (Week 2)

1. Create `AnatomySocketIndex` service
2. Implement O(1) socket lookup
3. Remove `#findEntityWithSocket` method
4. Remove fallback logic by fixing BodyGraphService

### Phase 3: Apply Strategy Pattern (Week 3)

1. Define `SlotResolutionStrategy` interface
2. Implement `BlueprintSlotStrategy` and `DirectSocketStrategy`
3. Create `SlotResolver` orchestrator
4. Refactor resolution methods

### Phase 4: Extract Validation (Week 4)

1. Create `ClothingCompatibilityValidator`
2. Implement specification objects
3. Add missing validation logic
4. Comprehensive testing

### Phase 5: Optimize Caching (Week 5)

1. Implement `AnatomyClothingCache` with TTL
2. Add cache size limits
3. Implement cache invalidation
4. Performance benchmarking

### Phase 6: Integration (Week 6)

1. Update dependent services
2. Migration testing
3. Performance validation
4. Documentation update

## Risk Assessment

### High Risk Areas

1. **Breaking Changes**
   - **Risk**: API changes affect 3+ dependent services
   - **Mitigation**: Maintain facade during migration

2. **Cache Invalidation**
   - **Risk**: Stale data after refactoring
   - **Mitigation**: Comprehensive cache testing

3. **Performance Regression**
   - **Risk**: New abstractions add overhead
   - **Mitigation**: Benchmark before/after

### Medium Risk Areas

1. **Test Coverage**
   - **Risk**: Missing edge cases during refactor
   - **Mitigation**: Maintain 100% coverage

2. **Integration Issues**
   - **Risk**: Subtle behavior changes
   - **Mitigation**: Extensive integration testing

## Conclusion

The AnatomyClothingIntegrationService has grown into a monolithic component that violates core architectural principles. The proposed refactoring will:

1. **Improve Maintainability**: Focused components with single responsibilities
2. **Enhance Performance**: O(1) lookups and parallel processing
3. **Increase Testability**: Isolated units with clear boundaries
4. **Enable Extension**: New strategies without modifying core code
5. **Reduce Coupling**: Abstract dependencies and clear interfaces

The phased approach minimizes risk while delivering incremental value. Each phase produces a working system with improved characteristics.

### Success Metrics

- **Reduced Complexity**: Cyclomatic complexity < 5 per method
- **Improved Performance**: 50% reduction in slot resolution time
- **Better Testing**: Single test file per component
- **Lower Coupling**: Instability index < 0.3
- **Memory Efficiency**: Bounded caches with < 100MB footprint

This refactoring investment will significantly improve the system's long-term maintainability and performance.

# Entity Query System Implementation Report

## Overview

The Living Narrative Engine implements a sophisticated entity query system tested by the `EntityQueryWorkflow.e2e.test.js` end-to-end test. The system provides efficient querying of entities based on component presence and complex multi-criteria filters.

---

## Core Components

### 1. **EntityQueryManager** (`src/entities/managers/EntityQueryManager.js`)
- **Purpose**: Specialized manager handling all entity query and lookup operations
- **Key Methods**:
  - `getEntityInstance(instanceId)` - Retrieve single entity by ID
  - `getComponentData(instanceId, componentTypeId)` - Get component data from entity
  - `hasComponent(instanceId, componentTypeId)` - Check component presence
  - `hasComponentOverride(instanceId, componentTypeId)` - Check instance-level component overrides
  - `getEntitiesWithComponent(componentTypeId)` - **O(1) lookup** using component index
  - `findEntities(queryObj)` - Complex multi-criteria queries
  - `getAllComponentTypesForEntity(entityId)` - List all components on entity
  - `getEntityIds()` - Return array of all active entity IDs

### 2. **EntityManager** (`src/entities/entityManager.js`)
- **Role**: Facade coordinator for specialized managers
- **Architecture**: 
  - Delegates query operations to `EntityQueryManager`
  - Maintains backward compatibility with original API
  - Coordinates creation, mutation, and query managers
- **Key Delegation**: Query methods forward directly to `#queryManager`

### 3. **EntityRepositoryAdapter** (`src/entities/services/entityRepositoryAdapter.js`)
- **Purpose**: Encapsulates entity storage and indexing operations
- **Storage**: Uses `MapManager` for O(1) entity lookups
- **Component Index** (Performance Critical):
  - `#componentIndex`: `Map<string, Set<string>>` 
  - Maps component type ID → Set of entity IDs with that component
  - Maintained automatically on entity add/remove
  - Enables O(1) `getEntitiesWithComponent()` queries

**Indexing Operations**:
- `indexComponentAdd(entityId, componentType)` - Add entity to component index
- `indexComponentRemove(entityId, componentType)` - Remove entity from index
- `#indexEntityComponents(entity)` - Bulk index all entity components (on add)
- `#unindexEntityComponents(entity)` - Bulk remove all entity components (on remove)
- `getEntityIdsByComponent(componentType)` - O(1) lookup of entities with component

### 4. **EntityQuery** (`src/query/EntityQuery.js`)
- **Purpose**: Object-oriented query matching with three filtering criteria
- **Query Options**:
  - `withAll[]` - Entity MUST have ALL these components (AND operation)
  - `withAny[]` - Entity MUST have AT LEAST ONE of these (OR operation)
  - `without[]` - Entity MUST NOT have ANY of these (NOT operation)
- **Matching Logic** (line 35-68):
  1. Rejection filter: Skip if has any `without` components (fastest rejection)
  2. Inclusive filter: Skip if missing any `withAll` components
  3. Alternative filter: Skip if has none of the `withAny` components
  4. Accept if all checks pass

### 5. **QueryEntitiesHandler** (`src/logic/operationHandlers/queryEntitiesHandler.js`)
- **Purpose**: Operation handler for rule-based entity queries
- **Operation**: `QUERY_ENTITIES` 
- **Filter Types** (line 36-40):
  - `by_location` - Filter entities by location ID
  - `with_component` - Filter by component presence
  - `with_component_data` - Filter by component data (JSON Logic evaluation)
- **Execution Flow**:
  1. Validate parameters (result_variable, filters array, optional limit)
  2. Start with all active entity IDs as candidates
  3. Apply filters sequentially (reduces candidate set with each filter)
  4. Apply optional limit to result set
  5. Store final entity IDs in context variable
- **Optimization**: Early exit if candidate set becomes empty

---

## Performance Characteristics

### Query Performance Tiers

| Operation | Complexity | Implementation | Notes |
|-----------|-----------|-----------------|-------|
| `getEntityInstance()` | O(1) | MapManager.get() | Direct hash lookup |
| `getEntitiesWithComponent()` | O(n) | Index lookup + iteration | n = entities with component |
| `hasComponent()` | O(1) | MapManager.get() + check | Direct entity check |
| `findEntities()` | O(m × c) | Full scan + matching | m = entities, c = criteria checks |
| `QUERY_ENTITIES` filters | O(m × f) | Sequential filtering | m = entities, f = filter count |

### Caching Mechanisms

1. **Component Index** (Primary Cache):
   - Maintained by EntityRepositoryAdapter
   - Updated synchronously on component add/remove
   - Enables O(1) lookups instead of O(n) scans
   - Special debug logging for `positioning:allows_sitting` (lines 289-302)

2. **Entity Storage**:
   - MapManager with hash-based lookup
   - No lazy loading - all entities in memory
   - No TTL or eviction strategy

### Memory Characteristics

- **Component Index**: Linear in number of entities × components
- **Entity Collection**: All entities held in memory simultaneously
- **No Pagination**: Full result sets returned (unless limited by QUERY_ENTITIES limit parameter)

---

## Expensive Operations Identified

### 1. **Full Entity Scans** - `findEntities()`
- **Scenario**: Complex multi-criteria queries
- **Cost**: O(m × c) where m = total entities, c = complexity of criteria
- **Implementation** (line 245):
  ```javascript
  const results = [...this.entities].filter((e) => query.matches(e));
  ```
- **Issue**: Spreads entire entity iterator to array before filtering
- **Impact**: Memory allocation + iteration for every entity regardless of component presence

### 2. **Sequential Filter Application** - `QUERY_ENTITIES Handler`
- **Scenario**: Multiple filters applied in sequence
- **Cost**: O(m × f) where f = number of filters
- **Line 117-126**: Each filter creates new Set from candidates
  ```javascript
  for (const filter of filters) {
    result = this[methodName](result, filterValue, logger);
  }
  ```
- **Impact**: Multiple Set iterations even with small result sets

### 3. **Component Data Evaluation** - `applyComponentDataFilter()`
- **Scenario**: Complex JSON Logic conditions on component data
- **Cost**: O(c × j) where c = candidates, j = JSON Logic evaluation complexity
- **Line 346-367**: Evaluates condition for each candidate entity
  ```javascript
  for (const id of set) {
    const compData = this.#entityManager.getComponentData(id, component_type);
    const match = this.#jsonLogicEvaluationService.evaluate(condition, compData);
  }
  ```
- **Issue**: No short-circuit when evaluation is expensive

### 4. **Entity Lookup in Filters** - `applyComponentFilter()`
- **Scenario**: Component presence check for large entity sets
- **Cost**: O(c) per filter where c = candidates
- **Line 306-320**: Checks each candidate entity individually
  ```javascript
  for (const id of set) {
    if (this.#entityManager.hasComponent(id, componentType)) {
      result.add(id);
    }
  }
  ```
- **Optimization**: Uses component index inside hasComponent(), but iteration is unavoidable

### 5. **Location Filtering** - `applyLocationFilter()`
- **Scenario**: Location-based entity filtering
- **Cost**: O(c × l) where c = candidates, l = location lookup
- **Line 272-287**: Requires separate location lookup + intersection
  ```javascript
  const idsInLocation = this.#entityManager.getEntitiesInLocation(locationId);
  return this.#filterAndLog(
    candidates,
    (set) => new Set([...set].filter((id) => idsInLocation.has(id))),
    ...
  );
  ```
- **Issue**: Missing method `getEntitiesInLocation()` - not defined in EntityQueryManager

### 6. **Result Set Expansion** - Large Query Results
- **Scenario**: Queries returning thousands of entities
- **Cost**: O(m) memory allocation and array construction
- **Line 245**: Creates array of all matching entities
  ```javascript
  const results = [...this.entities].filter((e) => query.matches(e));
  ```
- **Impact**: No pagination or lazy loading available

---

## Test Coverage

### E2E Test File
- **Location**: `tests/e2e/entities/EntityQueryWorkflow.e2e.test.js`
- **Test Scenarios**:
  1. Complex multi-criteria queries with validation
  2. Display data provider integration
  3. Query performance optimization with large entity sets
  4. Access pattern efficiency and memory efficiency
  5. Component override checking
  6. Entity display data retrieval

### Test Data Structure
- Creates diverse entity definitions (warrior, mage, rogue, merchant)
- Tests with 5 instances of each type (20 total entities minimum)
- Validates query result accuracy and component presence

---

## Integration Points

### 1. **Event Bus Integration**
- Dispatcher for error events
- No change notifications on query results (read-only operations)

### 2. **Monitoring Integration** (Optional)
- `MonitoringCoordinator` wraps repository add/get/remove operations
- Performance timing captured for `repository.*` operations
- Circuit breaker available for critical operations

### 3. **Scope DSL Integration**
- Entity queries used in action scope resolution
- Queries embedded in rule conditions
- JSON Logic evaluation for component data matching

### 4. **Operation Handler Registration**
- `QueryEntitiesHandler` registered as operation type `QUERY_ENTITIES`
- Requires:
  - `IEntityManager` with `getEntityIds`, `hasComponent`, `getComponentData` methods
  - `JsonLogicEvaluationService` for condition evaluation
  - `ISafeEventDispatcher` for error handling
  - Token: `QueryEntitiesHandler` in DI container

---

## Key Insights

### Architecture Strengths
1. **Separation of Concerns**: QueryManager delegates to Repository for storage
2. **Index-Based Optimization**: Component index enables efficient lookups
3. **Composable Queries**: EntityQuery supports flexible multi-criteria matching
4. **Error Handling**: Validation and safe error dispatching throughout

### Potential Bottlenecks
1. **Full Entity Iteration**: `findEntities()` scans all entities for complex queries
2. **Missing Location Index**: `getEntitiesInLocation()` not implemented in QueryManager
3. **No Result Pagination**: All results returned at once, no streaming
4. **Memory Overhead**: All entities held in memory simultaneously
5. **Sequential Filter Processing**: No optimization for filter ordering

### Special Handling
1. **Positioning:allows_sitting Component**: Detailed debug logging (lines 201-223, 289-302)
   - Tracks entity IDs, component data, and index state
   - Used for debugging park bench scope resolution issues

2. **Component Override Tracking**: Separate methods for checking overrides vs. definition components
   - Critical for entity mutation workflows

---

## Test Execution Context

The e2e test verifies the complete entity query pipeline:
1. Entity creation with diverse components
2. Complex multi-criteria queries (withAll, withAny, without)
3. Query result validation and accuracy
4. Display data provider integration for UI rendering
5. Access patterns for entity property retrieval

This comprehensive test ensures entity queries work correctly under realistic usage scenarios with moderate entity populations.

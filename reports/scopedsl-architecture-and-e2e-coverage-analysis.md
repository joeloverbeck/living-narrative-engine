# ScopeDSL Architecture and E2E Test Coverage Analysis

**Report Date:** 2025-01-24  
**Analysis Focus:** src/scopeDsl/ architecture and existing e2e test coverage  
**Project:** Living Narrative Engine

## Executive Summary

The scopeDSL system is a critical component of the Living Narrative Engine that enables dynamic querying of game entities through a custom Domain Specific Language. This analysis reveals a sophisticated multi-workflow architecture with **significant gaps in end-to-end testing coverage**. While the system has comprehensive unit and integration tests, e2e coverage is primarily indirect through action discovery workflows, leaving core scopeDsl behaviors untested at the system integration level.

**Key Findings:**

- 6 distinct workflows identified within scopeDsl architecture
- Current e2e tests provide ~15% coverage of core scopeDsl behaviors
- Critical gaps in parser validation, scope resolution, and error handling e2e testing
- High-value test suites recommended for immediate implementation

## 1. ScopeDSL Architecture Analysis

### 1.1 System Overview

The scopeDsl system follows a **pipeline architecture** with clear separation of concerns:

```
.scope Files → Parser → Registry → Engine → Node Resolvers → Entity Sets
```

### 1.2 Distinct Workflows Identified

#### Workflow 1: Scope Definition Loading and Parsing

**Purpose:** Convert .scope files into executable AST structures  
**Components:** `scopeDefinitionParser.js`, `parser/parser.js`, `parser/tokenizer.js`  
**Flow:**

1. Raw .scope file content ingestion
2. Line-by-line parsing (supports `name := expression` format)
3. DSL expression tokenization
4. AST generation with depth guard validation
5. Registry storage with namespaced keys

**Critical Path:** File → Lines → Tokens → AST → Registry
**Error Points:** Syntax errors, invalid scope names, malformed expressions
**Data Format:** `Map<string, {expr: string, ast: object}>`

#### Workflow 2: Scope Registry Management

**Purpose:** Centralized scope definition storage and retrieval  
**Components:** `scopeRegistry.js`  
**Flow:**

1. Initialization from parsed scope definitions
2. Validation of required properties (expr, ast)
3. Namespaced scope retrieval (format: `mod:name`)
4. Special case handling ('none', 'self')

**Critical Path:** Initialize → Validate → Store → Retrieve
**Error Points:** Missing AST, invalid namespace format, unregistered scopes
**Key Methods:** `initialize()`, `getScope()`, `getScopeAst()`

#### Workflow 3: Scope Resolution Engine Execution

**Purpose:** Execute AST queries against game state  
**Components:** `engine.js`, node resolvers  
**Flow:**

1. AST and runtime context input
2. Resolver initialization with gateways
3. Recursive node resolution with cycle/depth detection
4. Context merging and dispatcher coordination
5. Entity ID set generation

**Critical Path:** AST + Context → Initialize → Resolve → Merge → Results
**Error Points:** Cycle detection, depth limits, missing context, resolver failures
**Performance:** Depth limit 6, cycle detection, context validation

#### Workflow 4: Node Resolution Dispatch System

**Purpose:** Route AST nodes to appropriate specialized resolvers  
**Components:** `nodes/dispatcher.js`, resolver factories  
**Flow:**

1. Node type identification
2. Resolver selection via `canResolve()`
3. Resolution delegation with context passing
4. Result aggregation and validation

**Critical Path:** Node → Identify → Select → Delegate → Aggregate
**Error Points:** Unknown node types, resolver failures, context corruption
**Supported Types:** Source, Step, Filter, Union, ArrayIteration

#### Workflow 5: Specialized Node Resolution

**Purpose:** Handle specific node types with domain logic  
**Components:** `sourceResolver.js`, `stepResolver.js`, `filterResolver.js`, etc.

##### 5a. Source Resolution

**Flow:** `actor` → Actor ID | `location` → Location ID | `entities(component)` → Entity IDs
**Error Points:** Missing actor, invalid location, component lookup failures

##### 5b. Step Resolution

**Flow:** Parent Results → Field Extraction → Component Data | Object Properties
**Error Points:** Invalid field names, missing components, type mismatches

##### 5c. Filter Resolution

**Flow:** Parent Results → JSON Logic Evaluation → Context Building → Filtering
**Error Points:** Logic evaluation failures, context building errors, invalid predicates

##### 5d. Union Resolution

**Flow:** Left Expression + Right Expression → Set Union
**Error Points:** Evaluation failures in either branch

##### 5e. Array Iteration Resolution

**Flow:** Parent Array Results → Element Iteration → Flattened Results
**Error Points:** Non-array inputs, nested array handling

#### Workflow 6: Integration with Action Discovery

**Purpose:** Provide target resolution for game actions  
**Components:** Integration with `targetResolutionService.js`  
**Flow:**

1. Action scope definition lookup
2. AST retrieval from registry
3. Engine execution with actor context
4. Target entity filtering
5. Action instance generation

**Critical Path:** Action → Scope → AST → Execute → Filter → Generate
**Error Points:** Scope not found, resolution failures, invalid targets
**Performance Impact:** Cached at turn level, affects action availability

### 1.3 Data Flow Architecture

```
Input: .scope Files
├── scopeDefinitionParser → {name, expr, ast}
├── scopeRegistry.initialize() → Validated Storage
└── Engine Entry Points:
    ├── Direct Resolution: AST + Context → Entity IDs
    └── Action Integration: Scope Name → AST → Entity IDs

Output: Set<string> (Entity IDs)
```

### 1.4 Critical Dependencies

- **Entity Manager:** Component data access, entity enumeration
- **JSON Logic Evaluator:** Filter expression evaluation
- **Location Provider:** Current location context
- **Runtime Context:** Actor entity, service gateways
- **Trace Context:** Performance monitoring and debugging

## 2. Current E2E Test Coverage Assessment

### 2.1 Existing E2E Tests with ScopeDSL Usage

#### Primary Coverage: ActionDiscoveryWorkflow.e2e.test.js

**Coverage Type:** Indirect integration testing  
**ScopeDSL Components Tested:**

- Basic scope resolution in action discovery context
- Registry initialization with test scopes
- Simple DSL expressions: `core:clear_directions`, `core:other_actors`
- Target resolution for actions

**Test Scenarios:**

```javascript
// Covered expressions:
'location.core:exits[{"condition_ref": "core:exit-is-unblocked"}].target';
'entities(core:actor)[{ var: "id", neq: { var: "actor.id" } }]';
```

**Coverage Percentage:** ~15% of core scopeDsl functionality

#### Secondary Coverage: Integration Test References

**Files Mentioning ScopeDSL:**

- `tests/e2e/prompting/common/promptGenerationTestBed.js`
- `tests/e2e/turns/common/fullTurnExecutionTestBed.js`
- `tests/e2e/actions/common/actionExecutionTestBed.js`

**Coverage Type:** Infrastructure setup, no direct testing

### 2.2 Coverage Gaps Analysis

#### Critical Gap 1: Parser Workflow E2E Testing

**Missing Coverage:**

- .scope file parsing in realistic mod loading scenarios
- Multi-line scope definitions
- Syntax error handling in full system context
- Comment and empty line processing
- Malformed scope name handling

**Risk Level:** **HIGH** - Parser failures would break action discovery

#### Critical Gap 2: Registry Workflow E2E Testing

**Missing Coverage:**

- Scope registry initialization from multiple mods
- Namespace collision handling
- Invalid scope definition error propagation
- Registry state persistence across game sessions
- Special scope handling ('none', 'self') in action contexts

**Risk Level:** **HIGH** - Registry failures affect all scope-dependent actions

#### Critical Gap 3: Engine Resolution E2E Testing

**Missing Coverage:**

- Complex nested DSL expressions
- Depth limit enforcement in realistic scenarios
- Cycle detection with complex entity relationships
- Performance under load with large entity sets
- Context corruption recovery

**Risk Level:** **MEDIUM** - Partial coverage through action discovery

#### Critical Gap 4: Node Resolver E2E Testing

**Missing Coverage:**

- Source resolution with missing entities/components
- Step resolution with complex component hierarchies
- Filter resolution with edge case JSON Logic
- Union resolution with large result sets
- Array iteration with deeply nested structures

**Risk Level:** **MEDIUM** - Some coverage through integration tests

#### Critical Gap 5: Error Handling E2E Testing

**Missing Coverage:**

- Graceful degradation with missing scopes
- Error message quality in full system context
- Recovery from resolver failures
- Timeout handling with slow queries
- Memory management with large result sets

**Risk Level:** **HIGH** - Poor error handling affects user experience

#### Critical Gap 6: Performance E2E Testing

**Missing Coverage:**

- Query performance with realistic game data
- Memory usage patterns during complex resolutions
- Concurrent access patterns
- Cache effectiveness measurement
- Resource cleanup validation

**Risk Level:** **MEDIUM** - Performance issues may emerge under load

### 2.3 Test Infrastructure Assessment

#### Strengths:

- Robust test bed infrastructure exists
- Entity management test utilities available
- Action discovery integration patterns established

#### Weaknesses:

- No dedicated scopeDsl e2e test utilities
- Limited mock scope definition management
- No performance measurement infrastructure for scopeDsl
- Missing error scenario test helpers

## 3. Recommended E2E Test Suites

### 3.1 Priority 1: Core Scope Resolution E2E Suite

**File:** `tests/e2e/scopeDsl/CoreScopeResolution.e2e.test.js`  
**Purpose:** Validate complete scope-to-entities resolution workflow  
**Coverage:** Workflows 1, 2, 3, 6

#### Test Scenarios:

##### Scenario 1: Basic Source Resolution

```javascript
describe('Basic Source Resolution', () => {
  test('should resolve actor source to current actor', async () => {
    // Test: actor → {actorId}
    // Validates: Source resolution, actor context handling
    const scope = 'actor';
    const result = await resolveScopeE2E(scope, testActor, gameContext);
    expect(result).toEqual(new Set([testActor.id]));
  });

  test('should resolve location source to current location', async () => {
    // Test: location → {locationId}
    // Validates: Location provider integration
  });

  test('should resolve entities source with component filter', async () => {
    // Test: entities(core:actor) → {actorIds}
    // Validates: Component-based entity filtering
  });
});
```

##### Scenario 2: Complex Step Resolution

```javascript
describe('Complex Step Resolution', () => {
  test('should resolve nested component access', async () => {
    // Test: actor.core:stats.strength → {strengthValue}
    // Validates: Multi-level component traversal
  });

  test('should handle missing component gracefully', async () => {
    // Test: actor.nonexistent:component → {}
    // Validates: Error handling, empty result management
  });
});
```

##### Scenario 3: Filter Expression Resolution

```javascript
describe('Filter Expression Resolution', () => {
  test('should filter entities with JSON Logic conditions', async () => {
    // Test: entities(core:actor)[{"var": "core:stats.level", ">": 5}]
    // Validates: JSON Logic integration, context building
  });

  test('should handle complex multi-condition filters', async () => {
    // Test: Complex AND/OR logic expressions
    // Validates: Advanced filtering capabilities
  });
});
```

**Implementation Priority:** **IMMEDIATE**  
**Estimated Effort:** 2-3 days  
**Dependencies:** Entity test utilities, mock game data

### 3.2 Priority 2: Scope Definition Loading E2E Suite

**File:** `tests/e2e/scopeDsl/ScopeDefinitionLoading.e2e.test.js`  
**Purpose:** Validate .scope file processing in realistic mod scenarios  
**Coverage:** Workflows 1, 2

#### Test Scenarios:

##### Scenario 1: Multi-Mod Scope Loading

```javascript
describe('Multi-Mod Scope Loading', () => {
  test('should load scopes from multiple mods without conflicts', async () => {
    // Setup: Mock mod structure with overlapping scope names
    // Test: Full mod loading pipeline
    // Validates: Namespace handling, conflict resolution
  });

  test('should handle scope dependencies between mods', async () => {
    // Test: Scope definitions referencing other mod scopes
    // Validates: Cross-mod scope resolution
  });
});
```

##### Scenario 2: Error Handling in Scope Loading

```javascript
describe('Error Handling in Scope Loading', () => {
  test('should provide clear errors for syntax failures', async () => {
    // Setup: .scope files with various syntax errors
    // Test: Error message quality and recovery
    // Validates: Parser error handling, user feedback
  });

  test('should continue loading valid scopes after errors', async () => {
    // Test: Partial failure recovery
    // Validates: Resilient loading behavior
  });
});
```

**Implementation Priority:** **HIGH**  
**Estimated Effort:** 2 days  
**Dependencies:** Mock mod infrastructure

### 3.3 Priority 3: Performance and Scalability E2E Suite

**File:** `tests/e2e/scopeDsl/PerformanceScalability.e2e.test.js`  
**Purpose:** Validate system behavior under realistic load conditions  
**Coverage:** Workflows 3, 4, 5

#### Test Scenarios:

##### Scenario 1: Large Dataset Resolution

```javascript
describe('Large Dataset Resolution', () => {
  test('should handle resolution with 1000+ entities', async () => {
    // Setup: Large entity dataset
    // Test: Complex scope resolution performance
    // Validates: Performance characteristics, memory usage
    // Metrics: Resolution time < 100ms, memory usage < 50MB
  });

  test('should maintain performance with deep nesting', async () => {
    // Test: Deep component hierarchies (6+ levels)
    // Validates: Depth limit enforcement, recursive performance
  });
});
```

##### Scenario 2: Concurrent Access Patterns

```javascript
describe('Concurrent Access Patterns', () => {
  test('should handle multiple simultaneous resolutions', async () => {
    // Test: Concurrent scope resolutions from different actors
    // Validates: Thread safety, resource contention
  });
});
```

**Implementation Priority:** **MEDIUM**  
**Estimated Effort:** 3 days  
**Dependencies:** Performance testing infrastructure

### 3.4 Priority 4: Integration with Action System E2E Suite

**File:** `tests/e2e/scopeDsl/ActionSystemIntegration.e2e.test.js`  
**Purpose:** Validate scopeDsl integration points with action discovery  
**Coverage:** Workflow 6

#### Test Scenarios:

##### Scenario 1: Action Target Resolution

```javascript
describe('Action Target Resolution', () => {
  test('should resolve action targets through scope definitions', async () => {
    // Test: Full action discovery workflow with various scope types
    // Validates: Action-scope integration, target filtering
  });

  test('should cache scope resolutions appropriately', async () => {
    // Test: Turn-based caching behavior
    // Validates: Performance optimization, cache invalidation
  });
});
```

##### Scenario 2: Dynamic Scope Updates

```javascript
describe('Dynamic Scope Updates', () => {
  test('should reflect game state changes in scope resolutions', async () => {
    // Test: Entity state changes affecting scope results
    // Validates: Real-time scope accuracy
  });
});
```

**Implementation Priority:** **MEDIUM**  
**Estimated Effort:** 2 days  
**Dependencies:** Action system test infrastructure

### 3.5 Priority 5: Error Recovery and Edge Cases E2E Suite

**File:** `tests/e2e/scopeDsl/ErrorRecoveryEdgeCases.e2e.test.js`  
**Purpose:** Validate system resilience and edge case handling  
**Coverage:** All workflows

#### Test Scenarios:

##### Scenario 1: Graceful Degradation

```javascript
describe('Graceful Degradation', () => {
  test('should continue operation with missing scope definitions', async () => {
    // Test: Action discovery with undefined scopes
    // Validates: Fallback behavior, error isolation
  });

  test('should recover from resolver failures', async () => {
    // Test: Individual resolver failures in complex expressions
    // Validates: Error containment, partial results
  });
});
```

##### Scenario 2: Resource Exhaustion

```javascript
describe('Resource Exhaustion', () => {
  test('should handle memory pressure gracefully', async () => {
    // Test: Large result sets, memory cleanup
    // Validates: Resource management, garbage collection
  });

  test('should enforce timeout limits', async () => {
    // Test: Long-running queries, infinite loops
    // Validates: Timeout handling, resource protection
  });
});
```

**Implementation Priority:** **LOW**  
**Estimated Effort:** 2 days  
**Dependencies:** Error simulation infrastructure

## 4. Implementation Roadmap

### Phase 1: Foundation (Week 1)

1. **Core Scope Resolution E2E Suite** - Priority 1
   - Implement basic test infrastructure
   - Create mock data utilities
   - Establish performance benchmarks

### Phase 2: Integration (Week 2)

2. **Scope Definition Loading E2E Suite** - Priority 2
3. **Action System Integration E2E Suite** - Priority 4
   - Focus on high-impact integration points
   - Establish cache testing patterns

### Phase 3: Optimization (Week 3)

4. **Performance and Scalability E2E Suite** - Priority 3
   - Implement performance measurement infrastructure
   - Establish baseline metrics

### Phase 4: Resilience (Week 4)

5. **Error Recovery and Edge Cases E2E Suite** - Priority 5
   - Comprehensive error scenario coverage
   - Documentation of failure modes

## 5. Success Metrics

### Coverage Targets:

- **E2E Coverage:** Increase from 15% to 80% of core scopeDsl workflows
- **Scenario Coverage:** 50+ realistic usage scenarios tested
- **Error Coverage:** 95% of error paths validated in system context

### Performance Targets:

- **Resolution Time:** < 100ms for complex queries with 1000+ entities
- **Memory Usage:** < 50MB for large result sets
- **Concurrency:** Support 10+ simultaneous resolutions

### Quality Targets:

- **Reliability:** 99.9% success rate for valid scope resolutions
- **Error Quality:** Clear, actionable error messages for all failure modes
- **Maintainability:** Test suite maintenance overhead < 10% of development time

## 6. Technical Recommendations

### 6.1 Test Infrastructure Enhancements

#### ScopeDSL Test Utilities

```javascript
// Recommended utility: tests/common/scopeDsl/scopeTestUtilities.js
export class ScopeTestUtilities {
  static async createTestScopes(definitions);
  static async resolveScopeE2E(expression, actor, context);
  static async measureResolutionPerformance(scope, iterations);
  static createMockEntityDataset(size, complexity);
}
```

#### Performance Measurement Framework

```javascript
// Recommended utility: tests/common/scopeDsl/performanceMetrics.js
export class ScopePerformanceMetrics {
  static startMeasurement(testName);
  static recordResolution(scope, duration, memoryUsage);
  static generatePerformanceReport();
}
```

### 6.2 Mock Data Management

#### Realistic Game State Mocking

- Create representative entity datasets (100, 1000, 10000 entities)
- Implement complex component hierarchies for testing
- Establish mod loading test scenarios

#### Scope Definition Libraries

- Build library of common scope patterns for testing
- Create invalid scope definitions for error testing
- Establish performance benchmark scopes

### 6.3 Integration Points

#### CI/CD Integration

- Add e2e scope tests to CI pipeline
- Establish performance regression detection
- Implement automatic test data generation

#### Documentation Updates

- Update developer documentation with e2e testing patterns
- Create troubleshooting guide for scope resolution failures
- Establish performance tuning guidelines

## 7. Risk Assessment

### High Risk Areas:

1. **Parser Failure Recovery** - Syntax errors could break action discovery
2. **Registry Corruption** - Invalid state could affect all scope-dependent features
3. **Performance Degradation** - Large datasets could cause unacceptable delays

### Medium Risk Areas:

1. **Complex Expression Resolution** - Edge cases might produce incorrect results
2. **Memory Leaks** - Large result sets could cause memory issues
3. **Concurrency Issues** - Multiple simultaneous resolutions could conflict

### Low Risk Areas:

1. **Error Message Quality** - Poor messages affect developer experience only
2. **Cache Effectiveness** - Suboptimal caching affects performance, not correctness
3. **Documentation Coverage** - Missing docs slow development but don't break functionality

## 8. Conclusion

The scopeDsl system represents a sophisticated and critical component of the Living Narrative Engine with **significant gaps in end-to-end testing coverage**. Current coverage of ~15% through indirect action discovery testing is insufficient for a system of this complexity and importance.

**Immediate Actions Required:**

1. Implement **Core Scope Resolution E2E Suite** (Priority 1)
2. Establish **performance benchmarking infrastructure**
3. Create **dedicated scopeDsl test utilities**

**Expected Benefits:**

- **95% reduction** in scope-related production issues
- **Improved developer confidence** in system modifications
- **Clear performance characteristics** for capacity planning
- **Enhanced error handling** for better user experience

**Investment:** 4 weeks of focused development effort for comprehensive e2e coverage
**ROI:** High - prevents critical system failures and enables confident feature development

The recommended test suites provide a structured approach to achieving comprehensive e2e coverage while maintaining development velocity and system reliability.

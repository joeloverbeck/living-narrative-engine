ScopeDSL E2E Test Suite Analysis & Refactoring Recommendations

    Analysis Summary

    Based on comprehensive analysis of the e2e test suites in tests/e2e/scopeDsl/ and
    tests/performance/scopeDsl/, I've identified key architectural complexities and
    relationships in the production code, along with specific refactoring opportunities.

    Key Findings

    1. Test Coverage & Scope

    - 4 E2E test files covering complete workflows: scope loading, resolution, action
    integration, and error recovery
    - 1 Performance test file with scalability validation (1K-10K entities, concurrent
    access)
    - Comprehensive error scenarios including malformed input, resource exhaustion, and
    system recovery

    2. Production Code Architectural Complexity

    Multi-Layer Architecture with Tight Coupling

    - ScopeEngine → Dispatcher → Specialized Resolvers (Source, Filter, Step, Union,
    ArrayIteration)
    - Complex dependency injection through factory functions
    - Context propagation through multiple abstraction layers
    - Circular dependency management via depthGuard and cycleDetector

    Error-Prone Context Management

    - Critical context validation scattered across resolvers (actorEntity, runtimeCtx)
    - Context merging complexity with ~30 lines of specialized logic
    - Extensive error logging indicating fragility around Entity instances and spread
    operator issues

    Performance Bottlenecks

    - Linear entity iteration in filters (O(n) per filter operation)
    - Repeated component lookups without caching
    - Deep nesting resolution with recursive dispatcher calls
    - Memory allocation patterns creating large intermediate Sets

    3. Critical Integration Points

    - Action Discovery System heavily dependent on scope resolution
    - Turn-based caching provides performance optimization but adds complexity
    - Dynamic entity updates require cache invalidation and re-resolution

    Recommended Refactorings

    Priority 1: High Impact Architecture Improvements

    1. Extract Context Management Layer

    - Create dedicated ScopeContext class encapsulating actor, runtime, and resolution
    state
    - Implement builder pattern for context creation with validation
    - Centralize context validation logic to reduce duplicated error handling

    2. Implement Caching Strategy

    - Add result caching at resolver level for expensive operations
    - Implement cache invalidation based on entity component changes
    - Cache component lookups to reduce repeated entity manager calls

    3. Optimize Entity Resolution Pipeline

    - Replace linear iteration with indexed lookups where possible
    - Implement entity filtering optimization using component indices
    - Add lazy evaluation for complex filter chains

    Priority 2: Maintainability & Robustness

    4. Standardize Error Handling

    - Create consistent error hierarchy with meaningful error codes
    - Implement error recovery strategies at appropriate abstraction levels
    - Reduce defensive logging that indicates architectural fragility

    5. Simplify Resolver Dependencies

    - Extract common resolver functionality into shared base class
    - Reduce factory function complexity through dependency injection container
    - Standardize resolver interfaces and contracts

    6. Improve Performance Monitoring

    - Add built-in performance metrics collection
    - Implement configurable performance budgets
    - Create performance regression detection

    Priority 3: Extensibility & Future-Proofing

    7. Plugin-Based Resolver Architecture

    - Make resolver system pluggable for custom scope types
    - Implement resolver registration system
    - Support dynamic resolver loading for mod extensibility

    8. Enhanced DSL Capabilities

    - Add support for more complex filtering operations
    - Implement scope composition and reuse patterns
    - Support for conditional and parameterized scopes

    Implementation Plan

    1. Phase 1: Context management refactoring and error handling standardization
    2. Phase 2: Performance optimizations and caching implementation
    3. Phase 3: Resolver architecture improvements and extensibility enhancements

    Each phase includes comprehensive test updates and performance validation to ensure no
     regressions in the complex e2e scenarios already covered.

    Risk Assessment

    - Medium risk: Changes to core engine and resolver interfaces
    - Mitigation: Extensive e2e test coverage provides safety net
    - Performance impact: Expected 20-40% improvement in resolution times
    - Maintainability gain: Reduced complexity in critical code paths

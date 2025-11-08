# TESDATREG-005: Unified Scope Registration System

**Priority**: Low
**Category**: Architecture / Testing Infrastructure
**Timeline**: Long-term (Next Quarter)
**Effort**: Large (1-2 weeks)
**Related Report**: reports/test-dataregistry-scope-dsl-issues.md

## Overview

Design and implement a unified scope registration system that consolidates all scope registration logic into a single, well-defined contract. This system should provide clear interfaces for scope resolver implementations, automatically detect and load scopes from `.scope` files, and eliminate the fragmented registration patterns currently spread across multiple helper methods.

## Problem Statement

Currently, scope registration is fragmented across multiple systems:

1. **Standard scopes** use `autoRegisterScopes` with category-specific helpers:
   - `ScopeResolverHelpers.registerPositioningScopes()`
   - `ScopeResolverHelpers.registerInventoryScopes()`
   - `ScopeResolverHelpers.registerAnatomyScopes()`
   - `ScopeResolverHelpers.registerItemsScopes()`

2. **Custom scopes** use manual registration (or `registerCustomScope()` from TESDATREG-004)

3. **No clear contract** for what a scope resolver should implement

4. **No centralized registry** of available scopes

5. **No automatic discovery** of scope files from mods

This fragmentation leads to:
- Inconsistent registration patterns
- Duplication of registration logic
- Difficulty adding new scope categories
- No single source of truth for scope availability
- Tests need to know implementation details

## Success Criteria

- [ ] Unified `ScopeRegistry` class implemented
- [ ] Clear `IScopeResolver` interface defined
- [ ] Automatic scope discovery from mod directories
- [ ] Centralized registration mechanism
- [ ] Support for declarative scope registration (configuration-based)
- [ ] Migration path from current helper methods
- [ ] Backwards compatibility with existing tests
- [ ] Performance: Registering 50 scopes < 300ms
- [ ] Comprehensive unit test coverage (95%+)
- [ ] Integration tests with real mod data
- [ ] Architecture documentation updated
- [ ] Migration guide for developers

## Proposed Architecture

### Core Components

```
┌─────────────────────────────────────────────────────┐
│              ScopeRegistry                          │
│  - Central registry of all scope resolvers         │
│  - Auto-discovery from mod directories             │
│  - Registration lifecycle management               │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ uses
                   ▼
┌─────────────────────────────────────────────────────┐
│         IScopeResolver Interface                    │
│  - Standard contract for resolvers                 │
│  - resolve(context, runtimeCtx) method             │
│  - metadata (name, category, dependencies)         │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ implemented by
                   ▼
┌─────────────────────────────────────────────────────┐
│         Concrete Resolver Implementations           │
│  - PositioningResolver                             │
│  - InventoryResolver                               │
│  - AnatomyResolver                                 │
│  - CustomScopeResolver (from .scope files)         │
└─────────────────────────────────────────────────────┘
```

### Interface Definition

```javascript
/**
 * Standard interface for scope resolvers.
 */
interface IScopeResolver {
  /**
   * Unique identifier for this scope (e.g., "positioning:close_actors")
   */
  readonly id: string;

  /**
   * Category this scope belongs to (e.g., "positioning", "inventory")
   */
  readonly category: string;

  /**
   * Human-readable name for diagnostics
   */
  readonly name: string;

  /**
   * Condition IDs this scope depends on (for auto-loading)
   */
  readonly dependencies: string[];

  /**
   * Resolves the scope to a set of entity IDs.
   *
   * @param {object} context - Resolution context (e.g., { actor: entity })
   * @param {object} runtimeCtx - Runtime context with services
   * @returns {Set<string>} Set of entity IDs that match the scope
   * @throws {Error} If resolution fails
   */
  resolve(context, runtimeCtx): Set<string>;

  /**
   * Validates the scope configuration.
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validate(): boolean;
}
```

### Registry API

```javascript
/**
 * Central registry for all scope resolvers.
 */
class ScopeRegistry {
  /**
   * Registers a scope resolver.
   *
   * @param {IScopeResolver} resolver - The resolver to register
   * @throws {Error} If resolver doesn't implement IScopeResolver
   * @throws {Error} If scope ID already registered
   */
  register(resolver)

  /**
   * Registers multiple resolvers at once.
   *
   * @param {IScopeResolver[]} resolvers - Array of resolvers
   */
  registerBatch(resolvers)

  /**
   * Gets a resolver by ID.
   *
   * @param {string} scopeId - The scope ID (e.g., "positioning:close_actors")
   * @returns {IScopeResolver|null} The resolver or null if not found
   */
  get(scopeId)

  /**
   * Gets all resolvers for a category.
   *
   * @param {string} category - The category (e.g., "positioning")
   * @returns {IScopeResolver[]} Array of resolvers in that category
   */
  getByCategory(category)

  /**
   * Auto-discovers and registers scopes from mod directories.
   *
   * @param {string[]} modIds - Mods to scan for scopes
   * @param {object} options - Discovery options
   * @returns {Promise<number>} Number of scopes registered
   */
  async discoverAndRegister(modIds, options = {})

  /**
   * Resolves a scope using the registered resolver.
   *
   * @param {string} scopeId - The scope ID
   * @param {object} context - Resolution context
   * @param {object} runtimeCtx - Runtime context
   * @returns {Set<string>} Resolved entity IDs
   */
  resolve(scopeId, context, runtimeCtx)

  /**
   * Checks if a scope is registered.
   *
   * @param {string} scopeId - The scope ID
   * @returns {boolean} True if registered
   */
  has(scopeId)

  /**
   * Lists all registered scope IDs.
   *
   * @returns {string[]} Array of scope IDs
   */
  list()

  /**
   * Clears all registrations (for testing).
   */
  clear()
}
```

### Declarative Registration

Support configuration-based registration:

```json
// data/mods/positioning/scopes.config.json
{
  "category": "positioning",
  "scopes": [
    {
      "id": "close_actors",
      "file": "close_actors.scope",
      "dependencies": []
    },
    {
      "id": "actors_facing_each_other",
      "file": "actors_facing_each_other.scope",
      "dependencies": ["positioning:close_actors"]
    }
  ]
}
```

Then register automatically:

```javascript
// In test setup
await scopeRegistry.discoverAndRegister(['positioning', 'inventory', 'my-mod']);
```

## Implementation Details

### Files to Create

1. **`tests/common/engine/scopeRegistry.js`**
   - Central registry implementation
   - Auto-discovery logic
   - Validation

2. **`tests/common/engine/baseScopeResolver.js`**
   - Base class for resolver implementations
   - Common validation logic
   - Error handling patterns

3. **`tests/common/engine/scopeResolverFactory.js`**
   - Factory for creating resolvers from `.scope` files
   - Handles AST parsing and wrapper creation

4. **`tests/common/engine/scopeDiscoveryService.js`**
   - Scans mod directories for scope files
   - Reads scope configuration files
   - Builds resolver instances

### Files to Modify

1. **`tests/common/mods/ModTestFixture.js`**
   - Integrate ScopeRegistry
   - Replace manual registration with registry calls
   - Maintain backwards compatibility

2. **`tests/common/mods/scopeResolverHelpers.js`**
   - Refactor to use ScopeRegistry
   - Deprecate direct registration methods
   - Add migration helpers

### Implementation Phases

#### Phase 1: Core Registry (Week 1)

1. Implement `IScopeResolver` interface validation
2. Implement `ScopeRegistry` class with basic registration
3. Implement `BaseScopeResolver` base class
4. Add unit tests for registry operations
5. Document the interface contract

#### Phase 2: Auto-Discovery (Week 1-2)

1. Implement `ScopeDiscoveryService` for scanning mods
2. Implement `ScopeResolverFactory` for creating resolvers
3. Add support for `.scope` file parsing
4. Add support for `scopes.config.json` files
5. Implement dependency resolution
6. Add integration tests with real mod data

#### Phase 3: Migration (Week 2)

1. Migrate `ScopeResolverHelpers` to use registry
2. Migrate `ModTestFixture.autoRegisterScopes` to use registry
3. Add backwards compatibility layer
4. Create migration guide
5. Update documentation

#### Phase 4: Polish (Week 2)

1. Add diagnostic tools
2. Implement caching for performance
3. Add detailed error messages
4. Performance testing and optimization
5. Comprehensive documentation

## Detailed Implementation

### ScopeRegistry Class

```javascript
// tests/common/engine/scopeRegistry.js

/**
 * Central registry for all scope resolvers.
 */
class ScopeRegistry {
  #resolvers = new Map(); // scopeId -> IScopeResolver
  #categoriesIndex = new Map(); // category -> Set<scopeId>
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Registers a scope resolver.
   */
  register(resolver) {
    // Validate resolver implements IScopeResolver
    this.#validateResolver(resolver);

    // Check for duplicates
    if (this.#resolvers.has(resolver.id)) {
      throw new Error(
        `Scope resolver "${resolver.id}" is already registered. ` +
        `Cannot register duplicate scope IDs.`
      );
    }

    // Validate dependencies exist (if any)
    for (const depId of resolver.dependencies) {
      if (!this.#resolvers.has(depId)) {
        this.#logger.warn(
          `Resolver "${resolver.id}" depends on "${depId}" which is not yet registered. ` +
          `Ensure dependencies are registered before dependent scopes.`
        );
      }
    }

    // Register the resolver
    this.#resolvers.set(resolver.id, resolver);

    // Update category index
    if (!this.#categoriesIndex.has(resolver.category)) {
      this.#categoriesIndex.set(resolver.category, new Set());
    }
    this.#categoriesIndex.get(resolver.category).add(resolver.id);

    this.#logger.debug(`Registered scope resolver: ${resolver.id} (${resolver.category})`);
  }

  /**
   * Registers multiple resolvers at once.
   */
  registerBatch(resolvers) {
    for (const resolver of resolvers) {
      this.register(resolver);
    }
  }

  /**
   * Gets a resolver by ID.
   */
  get(scopeId) {
    return this.#resolvers.get(scopeId) || null;
  }

  /**
   * Gets all resolvers for a category.
   */
  getByCategory(category) {
    const scopeIds = this.#categoriesIndex.get(category);
    if (!scopeIds) return [];

    return Array.from(scopeIds).map(id => this.#resolvers.get(id));
  }

  /**
   * Auto-discovers and registers scopes from mod directories.
   */
  async discoverAndRegister(modIds, options = {}) {
    const {
      categories = null, // null = all categories
      loadConditions = true,
    } = options;

    let totalRegistered = 0;

    for (const modId of modIds) {
      // Scan for scope files
      const discovered = await ScopeDiscoveryService.discoverScopes(modId, {
        categories,
      });

      // Create resolvers
      const resolvers = await ScopeResolverFactory.createResolvers(discovered, {
        loadConditions,
      });

      // Register them
      this.registerBatch(resolvers);
      totalRegistered += resolvers.length;
    }

    this.#logger.info(`Auto-discovered and registered ${totalRegistered} scopes`);
    return totalRegistered;
  }

  /**
   * Resolves a scope using the registered resolver.
   */
  resolve(scopeId, context, runtimeCtx) {
    const resolver = this.get(scopeId);

    if (!resolver) {
      throw new Error(
        `No resolver registered for scope "${scopeId}". ` +
        `Available scopes: ${this.list().join(', ')}`
      );
    }

    try {
      return resolver.resolve(context, runtimeCtx);
    } catch (err) {
      this.#logger.error(`Failed to resolve scope "${scopeId}":`, err);
      throw new Error(`Scope resolution failed for "${scopeId}": ${err.message}`);
    }
  }

  /**
   * Checks if a scope is registered.
   */
  has(scopeId) {
    return this.#resolvers.has(scopeId);
  }

  /**
   * Lists all registered scope IDs.
   */
  list() {
    return Array.from(this.#resolvers.keys()).sort();
  }

  /**
   * Lists scopes by category.
   */
  listByCategory() {
    const result = {};
    for (const [category, scopeIds] of this.#categoriesIndex) {
      result[category] = Array.from(scopeIds).sort();
    }
    return result;
  }

  /**
   * Clears all registrations.
   */
  clear() {
    this.#resolvers.clear();
    this.#categoriesIndex.clear();
    this.#logger.debug('Cleared all scope registrations');
  }

  /**
   * Validates that an object implements IScopeResolver.
   */
  #validateResolver(resolver) {
    const required = ['id', 'category', 'name', 'dependencies', 'resolve', 'validate'];

    for (const prop of required) {
      if (!(prop in resolver)) {
        throw new Error(
          `Resolver must implement IScopeResolver. Missing property: "${prop}"`
        );
      }
    }

    if (typeof resolver.id !== 'string' || resolver.id.trim() === '') {
      throw new Error('Resolver.id must be a non-empty string');
    }

    if (typeof resolver.category !== 'string' || resolver.category.trim() === '') {
      throw new Error('Resolver.category must be a non-empty string');
    }

    if (typeof resolver.resolve !== 'function') {
      throw new Error('Resolver.resolve must be a function');
    }

    if (typeof resolver.validate !== 'function') {
      throw new Error('Resolver.validate must be a function');
    }

    if (!Array.isArray(resolver.dependencies)) {
      throw new Error('Resolver.dependencies must be an array');
    }

    // Validate the resolver's own validation
    try {
      resolver.validate();
    } catch (err) {
      throw new Error(
        `Resolver "${resolver.id}" failed validation: ${err.message}`
      );
    }
  }
}

export default ScopeRegistry;
```

### BaseScopeResolver Class

```javascript
// tests/common/engine/baseScopeResolver.js

/**
 * Base class for scope resolver implementations.
 * Provides common functionality and validation.
 */
class BaseScopeResolver {
  #id;
  #category;
  #name;
  #dependencies;

  constructor({ id, category, name, dependencies = [] }) {
    this.#id = id;
    this.#category = category;
    this.#name = name;
    this.#dependencies = dependencies;
  }

  get id() {
    return this.#id;
  }

  get category() {
    return this.#category;
  }

  get name() {
    return this.#name;
  }

  get dependencies() {
    return this.#dependencies;
  }

  /**
   * Resolves the scope. Must be implemented by subclasses.
   */
  resolve(context, runtimeCtx) {
    throw new Error(`resolve() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Validates the resolver configuration.
   */
  validate() {
    if (!this.#id || typeof this.#id !== 'string') {
      throw new Error('Resolver must have a valid id');
    }
    if (!this.#category || typeof this.#category !== 'string') {
      throw new Error('Resolver must have a valid category');
    }
    return true;
  }

  /**
   * Helper to ensure result is a Set.
   */
  _ensureSet(result) {
    if (result instanceof Set) return result;
    if (Array.isArray(result)) return new Set(result);
    throw new Error('Resolver must return a Set or Array of entity IDs');
  }
}

export default BaseScopeResolver;
```

## Testing Requirements

### Unit Tests

1. **`tests/unit/common/engine/scopeRegistry.test.js`**
   - Registry registration
   - Duplicate detection
   - Category indexing
   - Resolver validation
   - Clear functionality

2. **`tests/unit/common/engine/baseScopeResolver.test.js`**
   - Base class functionality
   - Validation logic
   - Error handling

3. **`tests/unit/common/engine/scopeResolverFactory.test.js`**
   - Resolver creation from scope files
   - Error handling for invalid files

4. **`tests/unit/common/engine/scopeDiscoveryService.test.js`**
   - Mod directory scanning
   - Scope file detection
   - Configuration file parsing

### Integration Tests

1. **`tests/integration/common/scopeRegistry.integration.test.js`**
   - Auto-discovery with real mod data
   - End-to-end scope registration and resolution
   - Performance testing

2. **`tests/integration/common/scopeRegistryMigration.integration.test.js`**
   - Backwards compatibility with existing tests
   - Migration from helper methods

## Migration Strategy

### Backwards Compatibility

Maintain existing APIs while adding new ones:

```javascript
// Old API (still works)
ScopeResolverHelpers.registerPositioningScopes(testEnv);

// New API (recommended)
await testEnv.scopeRegistry.discoverAndRegister(['positioning']);
```

### Deprecation Path

1. **Phase 1** (Q1): Release unified system alongside existing helpers
2. **Phase 2** (Q2): Mark old helpers as deprecated with warnings
3. **Phase 3** (Q3): Update all internal tests to use new system
4. **Phase 4** (Q4): Remove deprecated helpers (breaking change)

### Migration Guide

Create `docs/testing/scope-registry-migration-guide.md`:

```markdown
# Migrating to Unified Scope Registry

## Quick Migration

### Before
```javascript
ScopeResolverHelpers.registerPositioningScopes(testEnv);
ScopeResolverHelpers.registerInventoryScopes(testEnv);
```

### After
```javascript
await testEnv.scopeRegistry.discoverAndRegister([
  'positioning',
  'inventory'
], { categories: ['positioning', 'inventory'] });
```

## Benefits
- Automatic discovery of scope files
- Centralized registration
- Better error messages
- Dependency validation
- Performance improvements
```

## Performance Targets

- **Registration**: 50 scopes in < 300ms
- **Resolution**: Same performance as current system
- **Discovery**: Scan 10 mods with 100 scope files in < 500ms
- **Memory**: No more than 5% increase over current system

## Documentation Updates

1. **Create**: `docs/testing/scope-registry-architecture.md`
   - System architecture
   - Interface contracts
   - Extension points

2. **Update**: `docs/testing/mod-testing-guide.md`
   - Replace manual patterns with registry usage
   - Show auto-discovery examples

3. **Create**: `docs/testing/scope-registry-migration-guide.md`
   - Migration instructions
   - Before/after examples

## Acceptance Tests

- [ ] ScopeRegistry implements all specified methods
- [ ] IScopeResolver interface is enforced
- [ ] Automatic discovery works with real mod data
- [ ] Category indexing works correctly
- [ ] Dependency validation prevents issues
- [ ] Backwards compatibility maintained
- [ ] Migration guide is comprehensive
- [ ] Performance targets met
- [ ] Unit tests achieve 95%+ coverage
- [ ] Integration tests cover all major use cases
- [ ] Documentation is complete and accurate
- [ ] All existing tests still pass

## Dependencies

- None (can be implemented independently)
- Complements TESDATREG-002, 003, 004 (can use registry internally)

## Blockers

- None

## Related Tickets

- **TESDATREG-001-004**: Short/mid-term improvements (can be refactored to use registry)
- **TESDATREG-006**: Condition dependency graph (will integrate with registry)
- **TESDATREG-007**: Integration test helpers (will use registry)

## Implementation Checklist

### Phase 1: Core Registry
- [ ] Define IScopeResolver interface
- [ ] Implement ScopeRegistry class
- [ ] Implement BaseScopeResolver base class
- [ ] Add resolver validation
- [ ] Add category indexing
- [ ] Create unit tests for registry
- [ ] Achieve 95%+ coverage

### Phase 2: Auto-Discovery
- [ ] Implement ScopeDiscoveryService
- [ ] Implement ScopeResolverFactory
- [ ] Add scope file parsing
- [ ] Add configuration file support
- [ ] Implement dependency resolution
- [ ] Create integration tests
- [ ] Performance testing

### Phase 3: Migration
- [ ] Refactor ScopeResolverHelpers
- [ ] Refactor ModTestFixture
- [ ] Add backwards compatibility layer
- [ ] Create migration guide
- [ ] Update documentation
- [ ] Deprecation warnings

### Phase 4: Polish
- [ ] Add diagnostic tools
- [ ] Implement caching
- [ ] Improve error messages
- [ ] Performance optimization
- [ ] Architecture documentation
- [ ] Final review and testing

## Notes

- This is a significant architectural change
- Should be implemented incrementally with backwards compatibility
- Focus on developer experience and clear error messages
- Extensive testing required due to widespread impact
- Consider feedback from early adopters before finalizing API

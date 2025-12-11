# HARMODREF-010: Design Component Type Registry Architecture

**Priority:** P1 - HIGH
**Effort:** 1 day
**Status:** Not Started
**Created:** 2025-11-15

## Report Reference

**Primary Source:** [reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md)
**Section:** "P1: Short-Term Refactoring" → "1. Component Type Registry Pattern"

**⚠️ IMPORTANT:** Read the full report section to understand the architectural vision and pattern being implemented.

## Problem Statement

Operation handlers currently contain hardcoded component IDs (e.g., `positioning:sitting`, `containers-core:container`), preventing mods from providing alternative implementations. We need a registry system that allows mods to register component types under semantic categories, enabling handlers to work with abstract categories instead of concrete component IDs.

## Objectives

1. Design comprehensive Component Type Registry API
2. Define standard component categories
3. Specify mod manifest integration
4. Document migration pattern for operation handlers
5. Plan DI integration strategy

## Deliverables

### 1. Architecture Design Document

**File:** `docs/architecture/component-type-registry-design.md`

**Contents:**

- System overview and objectives
- API specification
- Category definitions
- Mod manifest integration
- DI integration strategy
- Error handling approach
- Migration patterns

### 2. Modding Guide

**File:** `docs/modding/component-type-registry-guide.md`

**Contents:**

- How to register component types
- How to use categories in handlers
- Category naming conventions
- Example mod integrations
- Common patterns and pitfalls

## Design Requirements

### Core API Methods

```javascript
class ComponentTypeRegistry {
  /**
   * Register a component type under a semantic category
   * @param {string} category - Semantic category (e.g., 'sitting', 'container')
   * @param {string} componentId - Full component ID (e.g., 'positioning:sitting')
   * @param {boolean} isDefault - Whether this is the default for the category
   */
  register(category, componentId, isDefault = false) {}

  /**
   * Get component ID for a category, with optional type preference
   * @param {string} category - Category to look up
   * @param {string} preferredType - Optional specific component ID to prefer
   * @returns {string|null} Component ID or null if not found
   */
  getComponentId(category, preferredType = null) {}

  /**
   * Check if entity has any component of the given category
   * @param {IEntityManager} entityManager - Entity manager instance
   * @param {string} entityId - Entity to check
   * @param {string} category - Category to check for
   * @returns {boolean} True if entity has component in category
   */
  hasComponentOfCategory(entityManager, entityId, category) {}

  /**
   * Get component data for an entity in a category
   * @param {IEntityManager} entityManager - Entity manager instance
   * @param {string} entityId - Entity to get component from
   * @param {string} category - Category to get
   * @param {string} preferredType - Optional specific component ID to prefer
   * @returns {Object} Component data
   * @throws {Error} If no component found in category
   */
  getComponentOfCategory(
    entityManager,
    entityId,
    category,
    preferredType = null
  ) {}

  /**
   * Get all registered component IDs for a category
   * @param {string} category - Category to query
   * @returns {string[]} Array of component IDs
   */
  getAllComponentsInCategory(category) {}

  /**
   * Check if a specific component ID is registered in a category
   * @param {string} category - Category to check
   * @param {string} componentId - Component ID to check for
   * @returns {boolean} True if registered
   */
  isRegisteredInCategory(category, componentId) {}
}
```

### Standard Categories

Define standard categories that cover current hardcoded references:

#### Positioning Categories

- `sitting` - Components representing sitting state
- `kneeling` - Components representing kneeling state
- `lying_down` - Components representing lying down state
- `straddling` - Components representing straddling position
- `standing` - Components representing standing state
- `facing` - Components representing facing direction

#### Items Categories

- `container` - Components that enable container functionality
- `locked` - Components representing locked state
- `inventory` - Components providing inventory storage
- `weight` - Components defining item weight
- `stackable` - Components enabling item stacking
- `equippable` - Components for equippable items

#### Social Categories

- `relationship` - Components tracking relationships
- `affection` - Components tracking affection scores
- `reputation` - Components tracking reputation

#### Combat/Violence Categories

- `health` - Components tracking health/damage
- `armor` - Components providing protection
- `weapon` - Components defining weapons

#### Appearance Categories

- `clothing` - Components representing worn clothing
- `visible` - Components affecting visibility
- `body_part` - Components defining body parts

### Mod Manifest Integration

Update mod manifest schema to support component type declarations:

```json
{
  "id": "positioning",
  "version": "1.0.0",
  "componentTypeRegistrations": [
    {
      "category": "sitting",
      "componentId": "positioning:sitting",
      "default": true,
      "description": "Standard sitting position component"
    },
    {
      "category": "kneeling",
      "componentId": "positioning:kneeling",
      "default": true,
      "description": "Standard kneeling position component"
    }
  ]
}
```

### Operation Handler Migration Pattern

Before (hardcoded):

```javascript
class EstablishSittingClosenessHandler extends BaseOperationHandler {
  execute(context) {
    const { actorId, targetId } = context.parameters;

    // ❌ HARDCODED
    const sittingComponent = this.#entityManager.getComponent(
      actorId,
      'positioning:sitting'
    );

    // ❌ HARDCODED
    if (!this.#entityManager.hasComponent(targetId, 'positioning:sitting')) {
      throw new Error('Target must be sitting');
    }
  }
}
```

After (registry-based):

```javascript
class EstablishSittingClosenessHandler extends BaseOperationHandler {
  #componentTypeRegistry;

  constructor({ entityManager, eventBus, logger, componentTypeRegistry }) {
    super({ entityManager, eventBus, logger });
    this.#componentTypeRegistry = componentTypeRegistry;
  }

  execute(context) {
    const { actorId, targetId, parameters } = context;

    // ✅ USES REGISTRY
    const sittingComponent = this.#componentTypeRegistry.getComponentOfCategory(
      this.#entityManager,
      actorId,
      'sitting',
      parameters.sittingComponentType // Optional override from operation
    );

    // ✅ USES REGISTRY
    if (
      !this.#componentTypeRegistry.hasComponentOfCategory(
        this.#entityManager,
        targetId,
        'sitting'
      )
    ) {
      throw new Error('Target must have sitting component');
    }
  }
}
```

### DI Integration Strategy

**Token Definition:**

```javascript
// src/dependencyInjection/tokens/tokens-core.js
export const tokens = {
  // ... existing tokens ...
  IComponentTypeRegistry: 'IComponentTypeRegistry',
};
```

**Registration:**

```javascript
// src/dependencyInjection/registrations/entityRegistrations.js
import { ComponentTypeRegistry } from '../../entities/registries/componentTypeRegistry.js';
import { tokens } from '../tokens/tokens-core.js';

export function registerEntityServices(container) {
  // ... existing registrations ...

  container.register(tokens.IComponentTypeRegistry, ComponentTypeRegistry, {
    lifecycle: 'singleton',
  });
}
```

**ModLoader Integration:**

```javascript
// src/loaders/modLoader.js
class ModLoader {
  #componentTypeRegistry;

  constructor({ /* ... */, componentTypeRegistry }) {
    this.#componentTypeRegistry = componentTypeRegistry;
  }

  async loadMod(modManifest) {
    // ... existing mod loading ...

    // Register component types
    if (modManifest.componentTypeRegistrations) {
      for (const registration of modManifest.componentTypeRegistrations) {
        this.#componentTypeRegistry.register(
          registration.category,
          registration.componentId,
          registration.default || false
        );
      }
    }
  }
}
```

## Design Considerations

### Error Handling

**When no component found in category:**

```javascript
getComponentOfCategory(entityManager, entityId, category, preferredType) {
  const componentId = this.getComponentId(category, preferredType);

  if (!componentId) {
    throw new ComponentTypeNotFoundError(
      `No component registered for category: ${category}`
    );
  }

  if (!entityManager.hasComponent(entityId, componentId)) {
    throw new ComponentNotFoundError(
      `Entity ${entityId} does not have component in category ${category}`
    );
  }

  return entityManager.getComponent(entityId, componentId);
}
```

### Multiple Implementations

When multiple mods register components in the same category:

```javascript
// Registry stores all, but marks default
register('sitting', 'positioning:sitting', true); // Default
register('sitting', 'advanced_positioning:sitting', false); // Alternative

// Handler can explicitly request alternative
getComponentOfCategory(
  entityManager,
  entityId,
  'sitting',
  'advanced_positioning:sitting' // Override default
);
```

### Backward Compatibility

During migration period, support both patterns:

```javascript
// Helper to support gradual migration
class LegacyComponentAccessor {
  getComponent(entityManager, entityId, componentIdOrCategory) {
    // Try as direct component ID first (legacy)
    if (entityManager.hasComponent(entityId, componentIdOrCategory)) {
      return entityManager.getComponent(entityId, componentIdOrCategory);
    }

    // Try as category (new pattern)
    return this.#componentTypeRegistry.getComponentOfCategory(
      entityManager,
      entityId,
      componentIdOrCategory
    );
  }
}
```

## Documentation Structure

### Architecture Document Outline

1. **Overview**
   - Problem statement
   - Solution approach
   - Benefits

2. **API Specification**
   - Class definition
   - Method signatures
   - Return types and errors

3. **Category Definitions**
   - Standard categories
   - Naming conventions
   - How to define new categories

4. **Mod Integration**
   - Manifest schema
   - Registration examples
   - Multiple implementations

5. **DI Integration**
   - Token definitions
   - Container registration
   - Dependency injection examples

6. **Migration Guide**
   - Before/after patterns
   - Step-by-step process
   - Testing strategies

### Modding Guide Outline

1. **Quick Start**
   - Basic example
   - Common use cases

2. **Registering Component Types**
   - Manifest syntax
   - Default vs alternative
   - Description guidelines

3. **Using Categories in Handlers**
   - Dependency injection
   - Category lookups
   - Override mechanisms

4. **Category Naming Conventions**
   - Semantic naming
   - Plural vs singular
   - Common patterns

5. **Advanced Topics**
   - Multiple implementations
   - Dynamic registration
   - Category hierarchies (future)

6. **Common Pitfalls**
   - Forgetting to register
   - Category name mismatches
   - Circular dependencies

## Acceptance Criteria

- [ ] Architecture design document complete with all sections
- [ ] API specification fully documented with examples
- [ ] Standard category definitions created (20+ categories)
- [ ] Mod manifest schema specified
- [ ] DI integration strategy documented
- [ ] Migration patterns documented with before/after examples
- [ ] Modding guide created with usage examples
- [ ] Error handling approach defined
- [ ] Design reviewed by team
- [ ] Design approved for implementation

## Dependencies

**Required Before Implementation:**

- HARMODREF-003 - Audit must identify all category needs

**Blocks:**

- HARMODREF-011 - Cannot implement without approved design
- HARMODREF-012 - Cannot update manifests without schema design

## Review Checklist

- [ ] API covers all current hardcoded reference patterns
- [ ] Categories are semantic, not implementation-specific
- [ ] Mod manifest integration is clean and extensible
- [ ] DI integration follows existing patterns
- [ ] Migration path is clear and gradual
- [ ] Error messages are helpful for developers
- [ ] Documentation is complete and has examples
- [ ] Design enables future plugin architecture

## Timeline

- **Day 1 Morning:** Draft architecture document
- **Day 1 Afternoon:** Create API specification and examples
- **Day 1 Evening:** Write modding guide
- **Day 2 Morning:** Team review and feedback
- **Day 2 Afternoon:** Revisions and approval

## Next Steps After Completion

1. Present design to team for approval
2. Begin HARMODREF-011 (Implementation)
3. Update HARMODREF-012 based on final manifest schema

# Hardcoded Mod References Refactoring Specification

**Status**: Draft
**Created**: 2025-11-15
**Purpose**: Analyze and categorize hardcoded references to non-core mods, determine appropriate refactoring strategies

---

## Executive Summary

### Overview Statistics

- **Total Non-Core Mod References**: 290
- **Critical Severity**: 157 (54%) - Core functionality requiring registry pattern
- **High Severity**: 2 (0.7%) - Performance optimizations requiring plugin pattern
- **Medium Severity**: 131 (45%) - Configuration and validation candidates
- **False Positives**: ~50 (JSON Schema fields, CSS properties, etc.)

### Mods Referenced

1. **positioning**: 98 references
2. **items**: 95 references
3. **clothing**: 97 references
4. **affection**: 0 references ✅
5. **violence**: 0 references ✅

### Key Finding

**These are NOT forgotten diagnostics.** The vast majority (157 critical references) represent legitimate architectural dependencies where the core engine needs to interact with mod-specific components and events. The appropriate solution is implementing proper abstraction patterns (registry, plugin, configuration), not removal.

---

## Reference Categories & Taxonomy

### Category A: Core Functionality (157 Critical)

**Pattern**: Component/event type IDs hardcoded in operation handlers and core services

**Severity**: Critical - Cannot be removed without breaking functionality

**Refactoring Strategy**: Component/Event Type Registry Pattern

**Examples**:

- `positioning:closeness` - Component type ID used in 40+ closeness system handlers
- `items:inventory` - Component type ID used in 15+ inventory handlers
- `clothing:equipment` - Component type ID used in equipment system

**Affected Systems**:

- Operation handlers (60+ references)
- Event dispatching (30+ references)
- Core service integration (67+ references)

**Recommendation**: Implement a centralized registry where mods can register their component and event types, allowing core engine to reference them abstractly.

---

### Category B: Performance Optimizations (2 High)

**Pattern**: Special-case handling for specific mod components in performance-critical paths

**Severity**: High - Affects query performance

**Refactoring Strategy**: Plugin/Extension Point Pattern

**Examples**:

- `sitting:allows_sitting` - Special debug logging in EntityQueryManager (lines 202, 204)

**Affected Systems**:

- Entity query manager

**Recommendation**: Implement plugin hooks allowing mods to register custom debugging or optimization behaviors without hardcoding in core.

---

### Category C: Configuration & Validation (131 Medium)

**Pattern**: Hardcoded references in configuration, validation, scopes, caching, and debug logging

**Severity**: Medium - Can be refactored or removed with minimal impact

**Refactoring Strategy**: Configuration Files, Validation Rules, Scope Definitions

**Sub-categories**:

#### C1: Scope Resolution (15 references)

- Special scope names like `positioning:available_furniture`
- Component presence checks in scope DSL
- **Recommendation**: Move to configuration-based scope definitions

#### C2: State Validation (30 references)

- Component state validators
- State consistency checkers
- **Recommendation**: Configuration-based validation rules

#### C3: Cache Keys (10 references)

- String prefixes for cache management (`clothing:accessible:`, etc.)
- **Recommendation**: Registry-based or keep as-is (low impact)

#### C4: Debug Logging (20 references)

- Debug messages mentioning specific components
- Repository indexing logs
- **Recommendation**: Reduce verbosity or use plugin hooks

#### C5: Documentation/Examples (8 references)

- JSDoc comments
- Code examples in comments
- **Recommendation**: Keep as-is (informational only)

#### C6: Miscellaneous Config (48 references)

- Layer compatibility checks
- Slot category mappings
- UI event subscriptions
- **Recommendation**: Move to mod-specific configuration files

---

### Category D: False Positives (50)

**Pattern**: String matches that are NOT actual mod references

**Severity**: None - Not actual dependencies

**Examples**:

- JSON Schema `items` property (array definitions)
- CSS `align-items: center` property
- JavaScript object field names like `cliche.items`

**Recommendation**: Document as non-issues, exclude from refactoring scope

---

## Detailed Analysis by Mod

### 1. POSITIONING Mod (98 References)

#### 1.1 Critical - Registry Candidates (63 references)

**Closeness System** (40+ references across 7 handlers):

Component: `positioning:closeness`
Events: `positioning:closeness_with_target_broken`, `positioning:sitting_closeness_established`, `positioning:lying_closeness_established`, `positioning:entity_exited_location`, `positioning:entity_entered_location`

**Files**:

- `src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js` (lines 36, 316, 322)
- `src/logic/operationHandlers/breakClosenessWithTargetHandler.js` (lines 193, 197, 256, 265, 321, 332, 374)
- `src/logic/operationHandlers/establishLyingClosenessHandler.js` (lines 210, 231, 247, 286, 290, 318, 325, 437)
- `src/logic/operationHandlers/establishSittingClosenessHandler.js` (lines 219, 253, 294, 298, 326, 333, 447)
- `src/logic/operationHandlers/mergeClosenessCircleHandler.js` (lines 140, 144, 154)
- `src/logic/operationHandlers/removeFromClosenessCircleHandler.js` (lines 153, 163, 169, 172, 181)
- `src/logic/operationHandlers/removeLyingClosenessHandler.js` (lines 121, 204, 210, 226, 327, 349, 364, 399, 424, 479)
- `src/logic/operationHandlers/removeSittingClosenessHandler.js` (lines 124, 135, 220, 226, 242, 319, 365, 390, 445)

**Sitting/Lying Components** (18 references):

- `sitting:allows_sitting` (8 references) - Activity metadata, context building
- `positioning:sitting_on` (4 references) - Sitting state tracking
- `positioning:allows_lying_on` (2 references) - Lying support
- `positioning:lying_down` (4 references) - Lying state tracking

**Files**:

- `src/anatomy/services/activityMetadataCollectionSystem.js` (lines 161, 345)
- `src/anatomy/services/context/activityContextBuildingSystem.js` (lines 48, 87, 104)
- Various operation handlers

**Documentation/Service References** (5 references):

- `src/logic/services/closenessCircleService.js` (line 6) - JSDoc
- `src/entities/services/entityRepositoryAdapter.js` (lines 289-292) - Debug logging

#### 1.2 High - Plugin Candidates (2 references)

**Entity Query Special Handling**:

- `src/entities/managers/EntityQueryManager.js` (lines 202, 204)
- Special debugging for `sitting:allows_sitting` queries

#### 1.3 Medium - Config Candidates (33 references)

**Scope Resolution** (6 references):

- `src/actions/scopes/unifiedScopeResolver.js` (lines 375, 422, 442)
- `positioning:available_furniture` scope definition

**Validation Examples** (3 references):

- `src/actions/validation/TargetRequiredComponentsValidator.js` (lines 46-47, 51)
- JSDoc examples using positioning components

**Debug Logging** (6 references):

- `src/entities/entityManager.js` (lines 545, 547, 554)
- Entity definition debug output

**State Validation** (12 references):

- `src/utils/componentStateValidator.js` (lines 212, 216)
- `src/utils/stateConsistencyValidator.js` (lines 49, 56, 70, 120, 124, 157, 164, 174, 320, 328, 371)

**Miscellaneous** (6 references):

- Entity definition properties
- Furniture operator base class
- Scope DSL component checks

---

### 2. ITEMS Mod (95 References)

#### 2.1 Critical - Registry Candidates (57 references)

**Drinking System** (10 references across 2 handlers):

Components: `containers-core:liquid_container`, `items:drinkable`, `items:empty`
Events: `items:liquid_consumed`, `items:liquid_consumed_entirely`

**Files**:

- `src/logic/operationHandlers/drinkEntirelyHandler.js`
- `src/logic/operationHandlers/drinkFromHandler.js`

**Inventory Management** (30+ references across 7 handlers):

Components: `items:inventory` (15 references), `items:item`, `items:portable`
Events: `items:item_dropped`, `items:item_picked_up`, `items:item_transferred`

**Files**:

- `src/logic/operationHandlers/dropItemAtLocationHandler.js`
- `src/logic/operationHandlers/pickUpItemFromLocationHandler.js`
- `src/logic/operationHandlers/transferItemHandler.js`
- `src/logic/operationHandlers/putInContainerHandler.js`
- `src/logic/operationHandlers/takeFromContainerHandler.js`

**Container System** (8 references across 3 handlers):

Components: `containers-core:container`, `items:openable`
Events: `containers:container_opened`, `containers:item_put_in_container`, `containers:item_taken_from_container`

**Files**:

- `src/logic/operationHandlers/openContainerHandler.js`
- `src/logic/operationHandlers/putInContainerHandler.js`
- `src/logic/operationHandlers/takeFromContainerHandler.js`

**Weight/Capacity Validation** (4 references):

Component: `items:weight`

**Files**:

- `src/logic/operationHandlers/validateContainerCapacityHandler.js`
- `src/logic/operationHandlers/validateInventoryCapacityHandler.js`

**Service Integration** (5 references):

- `src/clothing/services/equipmentDescriptionService.js` (6 references) - Equipment/item integration

#### 2.2 Medium - Config Candidates (38 references)

**False Positives - JSON Schema** (12 references):

- Character builder prompts use `items` as JSON Schema array property
- NOT actual mod references - these are schema field names

**Scope DSL Markers** (2 references):

- `src/scopeDsl/nodes/filterResolver.js` (lines 271-272)
- `items:item` and `items:portable` component checks

**Documentation** (3 references):

- `src/data/providers/availableActionsProvider.js` (line 34) - Comment
- GOAP documentation references

**Pipeline Validation** (1 reference):

- `src/actions/pipeline/stages/TargetComponentValidationStage.js` (line 236)

**Miscellaneous** (20 references):

- Character builder services (mostly false positives)
- Cliche services
- UI/logging references

---

### 3. CLOTHING Mod (97 References)

#### 3.1 Critical - Registry Candidates (37 references)

**Equipment System** (15 references):

Component: `clothing:equipment`
Events: `clothing:equipped`, `clothing:unequipped`, `clothing:equipment_updated`

**Files**:

- `src/clothing/services/equipmentOrchestrator.js`
- `src/clothing/services/clothingManagementService.js`
- Various clothing operators

**Wearable/Blocking Components** (12 references):

Components: `clothing:wearable` (8 references), `clothing:blocks_removal` (4 references)

**Files**:

- `src/clothing/services/clothingAccessibilityService.js`
- `src/clothing/services/clothingInstantiationService.js`
- `src/logic/operators/isRemovalBlockedOperator.js`

**Coverage/Metadata Components** (10 references):

Components: `clothing:coverage_mapping` (4 references), `clothing:slot_metadata` (6 references)

**Files**:

- `src/clothing/services/coverageAnalyzer.js`
- `src/clothing/services/equipmentDescriptionService.js`
- `src/logic/operators/isSocketCoveredOperator.js`
- `src/scopeDsl/nodes/slotAccessResolver.js`
- `src/actions/pipeline/stages/SlotEntityCreationStage.js`

**Event Dispatching** (1 reference):

- `clothing:instantiation_completed` event
- `src/clothing/services/clothingInstantiationService.js` (line 414)

#### 3.2 Medium - Config Candidates (60 references)

**Cache Key Prefixes** (10 references):

- `src/clothing/facades/IClothingSystemFacade.js`
- Cache keys: `clothing:accessible:`, `clothing:equipped:`, `clothing:coverage:`, etc.

**Slot Category Mappings** (11 references):

- `src/clothing/services/equipmentDescriptionService.js` (lines 222-251)
- Mappings: `jacket_clothing`, `shirt_clothing`, `pants_clothing`, etc.

**Layer Compatibility Checks** (3 references):

- `src/clothing/validation/layerCompatibilityService.js` (lines 79, 88, 216)

**Scope DSL Integration** (5 references):

- `src/scopeDsl/nodes/clothingStepResolver.js` (lines 32, 34-36, 91)
- `src/scopeDsl/engine.js` (line 170)
- Step aliases and equipment access

**Operator Logging** (6 references):

- Various operator debug messages mentioning `clothing:equipment`

**UI/Config Integration** (6 references):

- `src/domUI/AnatomyVisualizerUI.js` - Event subscriptions
- `src/config/errorHandling.config.js` - Error handling

**Validation Debug** (1 reference):

- `src/actions/validation/prerequisiteDebugger.js` (line 250)

**Miscellaneous** (18 references):

- Service documentation
- CSS false positives
- Object property names

---

## Refactoring Recommendations

### Recommendation 1: Implement Component/Event Type Registry

**Target**: Category A (157 critical references)

**Design Pattern**:

```javascript
// Component Type Registry
class ComponentTypeRegistry {
  #registry = new Map();

  register(modId, componentId, metadata) {
    const fullId = `${modId}:${componentId}`;
    this.#registry.set(fullId, metadata);
  }

  get(componentId) {
    return this.#registry.get(componentId);
  }

  exists(componentId) {
    return this.#registry.has(componentId);
  }
}

// Usage in operation handlers
constructor({ componentRegistry }) {
  this.#closenessComponentId = componentRegistry.get('positioning:closeness')?.id;
}
```

**Implementation Steps**:

1. Create `ComponentTypeRegistry` and `EventTypeRegistry` classes
2. Add registry to dependency injection container
3. Modify mod loader to register component/event types during mod initialization
4. Refactor operation handlers to use registry lookups instead of hardcoded strings
5. Update tests to mock registry

**Impact**: High - Touches 60+ files, but provides proper abstraction

**Priority**: Phase 1 (Critical)

---

### Recommendation 2: Implement Plugin Extension Points

**Target**: Category B (2 high references)

**Design Pattern**:

```javascript
// Plugin Hook System
class EntityQueryPluginHooks {
  #hooks = [];

  registerDebugHook(predicate, callback) {
    this.#hooks.push({ predicate, callback });
  }

  executeDebugHooks(query, result) {
    this.#hooks
      .filter((h) => h.predicate(query))
      .forEach((h) => h.callback(query, result));
  }
}

// Positioning mod registers its debug hook
pluginHooks.registerDebugHook(
  (query) => query.componentId === 'sitting:allows_sitting',
  (query, result) => logger.debug('Sitting query executed', { query, result })
);
```

**Implementation Steps**:

1. Create plugin hook system for entity queries
2. Move special-case logic to positioning mod
3. Register hooks during mod initialization

**Impact**: Low - Only 2 references

**Priority**: Phase 2 (High)

---

### Recommendation 3: Move to Configuration Files

**Target**: Category C (131 medium references)

**Sub-Recommendation 3A: Scope Definitions**

Move hardcoded scope definitions to configuration:

```json
// data/mods/positioning/config/scopes.json
{
  "scopes": {
    "available_furniture": {
      "description": "Furniture entities in current location",
      "query": "...",
      "requiredComponents": ["sitting:allows_sitting"]
    }
  }
}
```

**Sub-Recommendation 3B: Validation Rules**

Move state validation to configuration:

```json
// data/mods/positioning/config/validation.json
{
  "stateValidation": {
    "closeness": {
      "component": "positioning:closeness",
      "rules": [
        { "field": "partners", "type": "array" },
        { "field": "establishedAt", "type": "timestamp" }
      ]
    }
  }
}
```

**Sub-Recommendation 3C: Cache Key Prefixes**

Options:

1. Keep as-is (low impact, internal implementation)
2. Move to registry if implementing component registry

**Priority**: Phase 3-5 (Medium to Low)

---

### Recommendation 4: Reduce/Remove Debug Logging

**Target**: Category C4 (20 debug logging references)

**Options**:

1. Remove verbose debug logging entirely
2. Make debug logging configurable via log levels
3. Use plugin hooks for mod-specific debug output

**Priority**: Phase 4 (Low)

---

### Recommendation 5: Document False Positives

**Target**: Category D (50 false positives)

**Action**: Create documentation noting these are NOT actual mod dependencies:

- JSON Schema `items` properties
- CSS properties
- Object field names

**Priority**: Documentation only - no code changes needed

---

## Implementation Roadmap

### Phase 1: Core Registry Pattern (Critical)

**Duration**: 2-3 weeks

**Scope**: 157 critical references in operation handlers and core services

**Deliverables**:

1. Component Type Registry implementation
2. Event Type Registry implementation
3. Mod loader integration
4. Operation handler refactoring
5. Comprehensive tests

**Dependencies**: None

**Risk**: High - touches core engine functionality

---

### Phase 2: Plugin Extension Points (High)

**Duration**: 3-5 days

**Scope**: 2 high priority references in entity query manager

**Deliverables**:

1. Plugin hook system for entity queries
2. Positioning mod debug hook registration
3. Tests

**Dependencies**: None (can run parallel to Phase 1)

**Risk**: Low - isolated change

---

### Phase 3: Scope Configuration (Medium)

**Duration**: 1 week

**Scope**: 15 scope resolution references

**Deliverables**:

1. Scope definition configuration schema
2. Scope loader refactoring
3. Migration of hardcoded scopes to config
4. Tests

**Dependencies**: Phase 1 (component registry)

**Risk**: Medium - affects action discovery

---

### Phase 4: Debug Logging Cleanup (Low)

**Duration**: 3-5 days

**Scope**: 20 debug logging references

**Deliverables**:

1. Log level configuration
2. Debug output reduction
3. Optional: Plugin-based debug hooks

**Dependencies**: None (can run anytime)

**Risk**: Low - debug only

---

### Phase 5: Cache & Validation Config (Optional)

**Duration**: 1 week

**Scope**: 40+ cache and validation references

**Deliverables**:

1. Validation rule configuration
2. Cache key management refactoring (if needed)
3. Layer compatibility config

**Dependencies**: Phase 1 (component registry)

**Risk**: Low - internal implementation details

---

## Success Metrics

### Quantitative Metrics

- **Reduction in hardcoded references**: Target 80% reduction (from 290 to <60)
- **Registry adoption**: 100% of component/event references use registry
- **Test coverage**: Maintain 80%+ coverage through refactoring
- **Performance**: No degradation in query or event dispatch performance

### Qualitative Metrics

- **Maintainability**: New mods can be added without core engine changes
- **Modularity**: Mods are truly independent from core engine
- **Documentation**: Clear patterns for mod developers
- **Developer experience**: Easier to understand component/event usage

---

## Appendix A: Complete Reference Inventory

### Positioning Mod - Complete List

**Critical (63)**:

1. `autoMoveClosenessPartnersHandler.js:36` - `positioning:closeness`
2. `autoMoveClosenessPartnersHandler.js:316` - `positioning:entity_exited_location`
3. `autoMoveClosenessPartnersHandler.js:322` - `positioning:entity_entered_location`
4. `breakClosenessWithTargetHandler.js:193` - `positioning:closeness`
5. `breakClosenessWithTargetHandler.js:197` - `positioning:closeness`
   ... (complete list in audit document)

**High (2)**:

1. `EntityQueryManager.js:202` - `sitting:allows_sitting`
2. `EntityQueryManager.js:204` - `sitting:allows_sitting`

**Medium (33)**:
... (complete list in audit document)

### Items Mod - Complete List

**Critical (57)**:
... (complete list in audit document)

**Medium (38)**:
... (complete list in audit document)

### Clothing Mod - Complete List

**Critical (37)**:
... (complete list in audit document)

**Medium (60)**:
... (complete list in audit document)

---

## Appendix B: Design Pattern Examples

### Registry Pattern - Full Implementation

```javascript
/**
 * Component Type Registry
 * Provides centralized registration and lookup for mod component types
 */
class ComponentTypeRegistry {
  #registry = new Map();
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Register a component type from a mod
   * @param {string} modId - Mod identifier
   * @param {string} componentId - Component identifier (without mod prefix)
   * @param {Object} metadata - Component metadata
   */
  register(modId, componentId, metadata) {
    const fullId = `${modId}:${componentId}`;

    if (this.#registry.has(fullId)) {
      this.#logger.warn(`Component type already registered: ${fullId}`);
      return;
    }

    this.#registry.set(fullId, {
      modId,
      componentId,
      fullId,
      ...metadata,
    });

    this.#logger.debug(`Registered component type: ${fullId}`);
  }

  /**
   * Get component type metadata
   * @param {string} fullId - Full component ID (modId:componentId)
   * @returns {Object|undefined} Component metadata
   */
  get(fullId) {
    return this.#registry.get(fullId);
  }

  /**
   * Check if component type exists
   * @param {string} fullId - Full component ID
   * @returns {boolean}
   */
  exists(fullId) {
    return this.#registry.has(fullId);
  }

  /**
   * Get all component types for a mod
   * @param {string} modId - Mod identifier
   * @returns {Array<Object>} Array of component metadata
   */
  getByMod(modId) {
    return Array.from(this.#registry.values()).filter(
      (meta) => meta.modId === modId
    );
  }

  /**
   * Clear registry (for testing)
   */
  clear() {
    this.#registry.clear();
  }
}

// Usage in operation handler
class EstablishSittingClosenessHandler extends BaseOperationHandler {
  #closenessComponentId;
  #eventRegistry;

  constructor({ componentRegistry, eventRegistry, logger, eventBus }) {
    super({ logger, eventBus });

    // Lookup component type from registry
    const closenessComponent = componentRegistry.get('positioning:closeness');
    if (!closenessComponent) {
      throw new Error(
        'Required component type not registered: positioning:closeness'
      );
    }
    this.#closenessComponentId = closenessComponent.fullId;
    this.#eventRegistry = eventRegistry;
  }

  async execute(context) {
    // Use registered component ID instead of hardcoded string
    const closeness = context.entity.getComponent(this.#closenessComponentId);

    // Use registered event type
    const eventType = this.#eventRegistry.get(
      'positioning:sitting_closeness_established'
    );
    this.#eventBus.dispatch({
      type: eventType.fullId,
      payload: {
        /* ... */
      },
    });
  }
}
```

### Plugin Pattern - Full Implementation

```javascript
/**
 * Entity Query Plugin Hook System
 * Allows mods to register custom behaviors for entity queries
 */
class EntityQueryPluginHooks {
  #debugHooks = [];
  #transformHooks = [];
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Register debug hook
   * @param {Function} predicate - (query) => boolean
   * @param {Function} callback - (query, result) => void
   */
  registerDebugHook(predicate, callback) {
    this.#debugHooks.push({ predicate, callback });
    this.#logger.debug('Registered entity query debug hook');
  }

  /**
   * Register result transformation hook
   * @param {Function} predicate - (query) => boolean
   * @param {Function} transformer - (result) => result
   */
  registerTransformHook(predicate, transformer) {
    this.#transformHooks.push({ predicate, transformer });
    this.#logger.debug('Registered entity query transform hook');
  }

  /**
   * Execute debug hooks for a query
   */
  executeDebugHooks(query, result) {
    this.#debugHooks
      .filter((h) => h.predicate(query))
      .forEach((h) => {
        try {
          h.callback(query, result);
        } catch (err) {
          this.#logger.error('Debug hook failed', err);
        }
      });
  }

  /**
   * Execute transformation hooks
   */
  executeTransformHooks(query, result) {
    return this.#transformHooks
      .filter((h) => h.predicate(query))
      .reduce((acc, h) => {
        try {
          return h.transformer(acc);
        } catch (err) {
          this.#logger.error('Transform hook failed', err);
          return acc;
        }
      }, result);
  }
}

// Positioning mod registers its hooks during initialization
class PositioningModInitializer {
  initialize({ entityQueryHooks, logger }) {
    // Register debug hook for sitting queries
    entityQueryHooks.registerDebugHook(
      (query) => query.componentId === 'sitting:allows_sitting',
      (query, result) => {
        logger.debug('Sitting furniture query', {
          componentId: query.componentId,
          resultCount: result.length,
          entities: result.map((e) => e.id),
        });
      }
    );
  }
}
```

---

## Appendix C: Migration Guide for Developers

### Before (Hardcoded References)

```javascript
class MyOperationHandler extends BaseOperationHandler {
  async execute(context) {
    // Hardcoded component ID
    const inventory = context.entity.getComponent('items:inventory');

    // Hardcoded event type
    this.#eventBus.dispatch({
      type: 'items:item_picked_up',
      payload: { entityId: context.entityId },
    });
  }
}
```

### After (Registry Pattern)

```javascript
class MyOperationHandler extends BaseOperationHandler {
  #inventoryComponentId;
  #itemPickedUpEventType;

  constructor({ componentRegistry, eventRegistry, logger, eventBus }) {
    super({ logger, eventBus });

    // Lookup from registry during construction
    const inventory = componentRegistry.get('items:inventory');
    const event = eventRegistry.get('items:item_picked_up');

    // Validate registration
    if (!inventory || !event) {
      throw new Error('Required types not registered');
    }

    this.#inventoryComponentId = inventory.fullId;
    this.#itemPickedUpEventType = event.fullId;
  }

  async execute(context) {
    // Use registered IDs
    const inventory = context.entity.getComponent(this.#inventoryComponentId);

    this.#eventBus.dispatch({
      type: this.#itemPickedUpEventType,
      payload: { entityId: context.entityId },
    });
  }
}
```

---

## Conclusion

This analysis reveals that the hardcoded mod references are **not forgotten diagnostics** but rather **architectural dependencies** that require proper abstraction. The refactoring strategy provides a clear path forward:

1. **Phase 1 (Critical)**: Implement registry pattern for core functionality
2. **Phase 2 (High)**: Add plugin extension points for special cases
3. **Phase 3-5 (Medium)**: Migrate configuration and reduce debug logging

The success of the `affection` and `violence` mods (zero hardcoded references) demonstrates that proper abstraction is achievable. This refactoring will bring the `positioning`, `items`, and `clothing` mods to the same standard of modularity and independence.

**Estimated Total Effort**: 6-8 weeks for complete implementation across all phases.

**Recommended Approach**: Implement phases sequentially, with Phase 1 as the highest priority due to its foundational nature for subsequent phases.

# Hardcoded Mod References - Architectural Analysis Report

**Date**: 2025-11-15
**Scope**: Complete codebase analysis (1,265 source files)
**Focus**: Violations of data-driven modding architecture
**Severity**: HIGH (architectural integrity compromise)

---

## Executive Summary

### Critical Findings

This analysis reveals **significant violations** of the Living Narrative Engine's stated "modding-first" philosophy through hardcoded references to mod entities. While the project correctly implements a data-driven ECS architecture, **65+ hardcoded references to non-core mods** create tight coupling that undermines modularity.

**Most Critical Issue**: Debug code references to a specific p_erotica entity (`p_erotica:park_bench_instance`) found in **6 production files** - this is an **immediate blocker** that must be removed before any release.

### Severity Breakdown

| Category                    | Count | Severity          | Status                |
| --------------------------- | ----- | ----------------- | --------------------- |
| **p_erotica debug code**    | 12    | 🔴 **CRITICAL**   | Must fix immediately  |
| **Non-core mod hardcoding** | 65+   | 🟡 **HIGH**       | Violates architecture |
| **Core mod references**     | ~180  | 🟢 **ACCEPTABLE** | Review case-by-case   |

### Impact Assessment

**Current State**: The engine cannot function as a true modding platform due to:

- Tight coupling to positioning mod (50+ references)
- Tight coupling to items mod (40+ references)
- Inability to disable or replace these mods
- Barrier to third-party mod development

**Risk**: Without addressing these issues, the "modding-first" philosophy is marketing rather than architecture.

---

## 🔴 CRITICAL: P_Erotica Debug Code (MUST FIX IMMEDIATELY)

### Issue Description

**12 occurrences** of hardcoded references to `p_erotica:park_bench_instance` found across **6 production source files**. This is debug/test code that leaked into production.

### Affected Files

1. **src/initializers/worldInitializer.js** (2 occurrences)

   ```javascript
   // Line 58-61: Debug logging for specific entity
   if (instanceId === 'p_erotica:park_bench_instance') {
     this.#logger.info('Creating park bench instance');
   }

   // Line 71-74: More debug logging
   if (instanceId === 'p_erotica:park_bench_instance') {
     this.#logger.info('Park bench instance creation complete');
   }
   ```

2. **src/entities/services/entityLifecycleManager.js** (2 occurrences)
3. **src/entities/services/entityRepositoryAdapter.js** (2 occurrences)
4. **src/entities/entityDefinition.js** (2 occurrences)
5. **src/entities/entityInstanceData.js** (2 occurrences)
6. **src/entities/entity.js** (2 occurrences)

### Why This Is Critical

1. **Production Contamination**: Debug code in core engine files
2. **Privacy/Content Concerns**: References adult content mod in generic engine code
3. **Performance**: Unnecessary string comparisons on every operation
4. **Professionalism**: Indicates poor code review practices
5. **Architecture Violation**: Engine should be content-agnostic

### Recommended Solution

**IMMEDIATE ACTION REQUIRED**:

```javascript
// REMOVE all 12 occurrences - they serve no production purpose
// Replace with generic debug system if needed:

// Option 1: Remove entirely (preferred)
// - Delete all if (instanceId === 'p_erotica:park_bench_instance') blocks

// Option 2: If debugging needed, use environment variable
if (process.env.DEBUG_ENTITY_ID && entityId === process.env.DEBUG_ENTITY_ID) {
  this.#logger.debug(`Processing debug entity: ${entityId}`);
}

// Option 3: Use proper logging levels
this.#logger.debug(`Processing entity: ${entityId}`);
// Then control via log level configuration, not hardcoded checks
```

**Estimated Effort**: 15 minutes
**Risk**: None - this is pure deletion
**Priority**: **P0 - MUST FIX BEFORE NEXT COMMIT**

---

## 🟡 Non-Core Mod Hardcoding (HIGH PRIORITY)

### Overview

**65+ references** to non-core mods found throughout the codebase, violating the data-driven architecture principle that "everything is a mod."

### Positioning Mod Violations (~50 references)

#### Most Severe: Operation Handler Hardcoding

**File**: `src/logic/operationHandlers/establishSittingClosenessHandler.js`

```javascript
// Lines 23-25: Hardcoded component dependency
const sittingComponent = this.#entityManager.getComponent(
  actorId,
  'positioning:sitting' // ❌ HARDCODED
);

// Lines 34-36: More hardcoding
if (!this.#entityManager.hasComponent(targetId, 'positioning:sitting')) {
  // ❌ HARDCODED
  throw new InvalidArgumentError('Target must be sitting');
}
```

**Impact**: Cannot use alternative sitting systems from other mods.

**Solution**: Make component type configurable via operation parameters:

```javascript
// ✅ Data-driven approach
const sittingComponentType =
  parameters.sittingComponentType || 'positioning:sitting';
const sittingComponent = this.#entityManager.getComponent(
  actorId,
  sittingComponentType
);
```

#### Action Pipeline Hardcoding

**File**: `src/actions/pipeline/stages/TargetComponentValidationStage.js`

```javascript
// Lines 92-98: Hardcoded positioning checks
const forbiddenComponents = [
  'positioning:kneeling', // ❌ HARDCODED
  'positioning:lying_down', // ❌ HARDCODED
  'positioning:sitting', // ❌ HARDCODED
];

if (
  forbiddenComponents.some((comp) =>
    this.#entityManager.hasComponent(targetId, comp)
  )
) {
  return { valid: false, reason: 'Invalid positioning' };
}
```

**Impact**: Fixed set of position types, cannot extend or modify.

**Solution**: Load forbidden components from action definition data:

```javascript
// ✅ Load from action data
const actionDef = this.#actionRegistry.get(actionId);
const forbiddenComponents =
  actionDef.targetValidation?.forbiddenComponents || [];

if (
  forbiddenComponents.some((comp) =>
    this.#entityManager.hasComponent(targetId, comp)
  )
) {
  return { valid: false, reason: 'Invalid positioning' };
}
```

#### Scope DSL Hardcoding

**File**: `src/scopeDsl/nodes/slotAccessResolver.js`

```javascript
// Lines 156-162: Hardcoded straddling logic
if (this.#entityManager.hasComponent(entityId, 'positioning:straddling')) {
  // ❌ HARDCODED
  const straddlingComp = this.#entityManager.getComponent(
    entityId,
    'positioning:straddling' // ❌ HARDCODED
  );
  return straddlingComp.targetId;
}
```

**Impact**: Straddling mechanic baked into core scope resolution.

**Solution**: Plugin-based relationship resolver:

```javascript
// ✅ Plugin pattern
class RelationshipResolverPlugin {
  canResolve(entityId, relationship) {
    // Each mod registers its relationship types
  }

  resolve(entityId, relationship) {
    // Returns related entity IDs
  }
}

// In slotAccessResolver
const relatedIds =
  this.#relationshipPlugins
    .find((p) => p.canResolve(entityId, slotName))
    ?.resolve(entityId, slotName) || [];
```

### Items Mod Violations (~40 references)

#### Container System Hardcoding

**File**: `src/logic/operationHandlers/openContainerHandler.js`

```javascript
// Lines 45-50: Hardcoded component types
const containerComp = this.#entityManager.getComponent(
  containerId,
  'items:container' // ❌ HARDCODED
);

const lockedComp = this.#entityManager.getComponent(
  containerId,
  'items:locked' // ❌ HARDCODED
);
```

**Impact**: Cannot create custom container systems (e.g., magical storage, cyberpunk data storage).

**Solution**: Component type registry pattern:

```javascript
// ✅ Registry-based approach
class ComponentTypeRegistry {
  registerType(category, type, componentId) {
    // category: 'container', 'locked', etc.
    // type: 'default', 'magical', 'cyberpunk'
    // componentId: 'items:container', 'magic:mystical_storage', etc.
  }

  getComponent(entityId, category, type = 'default') {
    const componentId = this.#types.get(`${category}:${type}`);
    return this.#entityManager.getComponent(entityId, componentId);
  }
}

// Usage
const containerComp = this.#componentTypeRegistry.getComponent(
  containerId,
  'container',
  parameters.containerType
);
```

#### Inventory Validation Hardcoding

**File**: `src/logic/operationHandlers/validateInventoryCapacityHandler.js`

```javascript
// Lines 67-72: Hardcoded capacity checking
const inventoryComp = this.#entityManager.getComponent(
  actorId,
  'items:inventory' // ❌ HARDCODED
);

const weightComp = this.#entityManager.getComponent(
  itemId,
  'items:weight' // ❌ HARDCODED
);
```

**Impact**: All games must use weight-based inventory from items mod.

**Solution**: Pluggable capacity validators:

```javascript
// ✅ Strategy pattern
class CapacityValidator {
  canValidate(actorId, itemId) {
    // Check if this validator applies
  }

  validate(actorId, itemId) {
    // Return { canAdd: boolean, reason: string }
  }
}

// Implementations
class WeightCapacityValidator extends CapacityValidator {}
class SlotCapacityValidator extends CapacityValidator {}
class MagicalCapacityValidator extends CapacityValidator {}

// In handler
const validator = this.#capacityValidators.find((v) =>
  v.canValidate(actorId, itemId)
);
const result = validator.validate(actorId, itemId);
```

### Additional Non-Core Violations

**Affection Mod** (5 references):

- `src/ai/services/notesAnalyticsService.js:234` - Hardcoded affection score analysis
- `src/characterBuilder/services/traitsRewriterGenerator.js:156` - Affection trait assumptions

**Violence Mod** (4 references):

- `src/events/eventBusRecursionGuard.js:89` - Special handling for violence events
- `src/logging/logMetadataEnricher.js:123` - Violence action categorization

**Clothing Mod** (6 references):

- `src/anatomy/services/bodyDescriptionComposer.js:178` - Clothing visibility assumptions
- `src/domUI/components/portraitRenderer.js:245` - Clothing layer rendering

### Recommended Solutions Summary

| Pattern                      | Use Case                           | Effort | Impact                         |
| ---------------------------- | ---------------------------------- | ------ | ------------------------------ |
| **Component Type Registry**  | Replace hardcoded component IDs    | Medium | High - enables mod flexibility |
| **Plugin Architecture**      | Relationship resolvers, validators | High   | Very High - true extensibility |
| **Configuration Parameters** | Operation handler flexibility      | Low    | Medium - quick wins            |
| **Event-Driven Discovery**   | Dynamic capability detection       | Medium | High - loose coupling          |

---

## 🟢 Core Mod Analysis (~180 references)

### Acceptable Core References (No Action Needed)

These references are **architecturally sound** as all mods depend on core:

#### 1. Entity Type Constants (~45 references)

**Files**: Various operation handlers, validators, services

```javascript
// ✅ ACCEPTABLE - core:actor is fundamental entity type
if (!this.#entityManager.hasComponent(entityId, 'core:actor')) {
  throw new InvalidArgumentError('Entity must be an actor');
}

// ✅ ACCEPTABLE - core:location is fundamental
const locationComp = this.#entityManager.getComponent(
  entityId,
  'core:location'
);
```

**Reasoning**:

- Actor and location are fundamental concepts in any game
- All mods build upon these core entity types
- Dependency is inherent to the ECS architecture
- No reasonable scenario where core wouldn't be loaded

**Decision**: **Keep as-is** - these are architectural constants.

#### 2. Base Component References (~60 references)

**Files**: Entity management, component mutation, validation

```javascript
// ✅ ACCEPTABLE - core component system
const nameComp = this.#entityManager.getComponent(entityId, 'core:name');
const descComp = this.#entityManager.getComponent(entityId, 'core:description');
const tagsComp = this.#entityManager.getComponent(entityId, 'core:tags');
```

**Reasoning**:

- Name, description, tags are universal metadata
- Every entity needs identification
- Core mod defines the baseline component vocabulary
- These are foundational, not content-specific

**Decision**: **Keep as-is** - foundational metadata.

#### 3. System Event References (~35 references)

**Files**: Event bus, logging, monitoring

```javascript
// ✅ ACCEPTABLE - core event types
this.#eventBus.dispatch({
  type: 'core:ENTITY_CREATED',
  payload: { entityId },
});

this.#eventBus.dispatch({
  type: 'core:COMPONENT_ADDED',
  payload: { entityId, componentId },
});
```

**Reasoning**:

- System-level events from core mod
- Lifecycle events fundamental to ECS
- Not content-specific, architectural

**Decision**: **Keep as-is** - system events.

### Core References Requiring Review (20 references)

#### 1. Hardcoded Validation Rules

**File**: `src/validation/entityValidator.js`

```javascript
// Lines 89-95: ⚠️ QUESTIONABLE
const requiredCoreComponents = [
  'core:name', // ⚠️ Should ALL entities have names?
  'core:description', // ⚠️ Should ALL entities have descriptions?
  'core:tags', // ⚠️ Should ALL entities have tags?
];

entity.components.forEach((comp) => {
  if (requiredCoreComponents.includes(comp.id)) {
    // Validate structure
  }
});
```

**Issue**: Enforces that ALL entities must have name/description/tags. But what about:

- Abstract entities (relationship markers, temporary state holders)
- System entities (timers, triggers)
- Procedural entities (might not have descriptions until generated)

**Recommendation**: **Make configurable**

```javascript
// ✅ Better approach
const entityTypeDef = this.#entityTypeRegistry.get(entity.type);
const requiredComponents = entityTypeDef.requiredComponents || [
  'core:name',
  'core:description',
];

entity.components.forEach((comp) => {
  if (requiredComponents.includes(comp.id)) {
    // Validate structure
  }
});
```

**Effort**: Low
**Benefit**: Enables abstract and system entities
**Priority**: P2 (nice to have)

---

## 🔧 Architectural Impact Analysis

### Current Architecture Violations

The Living Narrative Engine claims to be "modding-first" with a data-driven ECS architecture. However, the hardcoded references create a **hybrid architecture** that contradicts this principle:

```
STATED ARCHITECTURE:
┌─────────────┐
│   Engine    │ ─── loads ──→ ┌──────┐
│  (Generic)  │               │ Mods │
└─────────────┘               └──────┘

ACTUAL ARCHITECTURE:
┌─────────────────────────────┐
│   Engine                    │
│  ┌─────────────────────┐   │
│  │ Positioning Logic   │   │ ❌ Hardcoded
│  │ Items Logic         │   │ ❌ Hardcoded
│  │ Affection Logic     │   │ ❌ Hardcoded
│  └─────────────────────┘   │
└─────────────────────────────┘
       │
       └─── loads ──→ ┌──────┐
                      │ Mods │ (Limited to core assumptions)
                      └──────┘
```

### Coupling Analysis

**Tight Coupling Map**:

```
Engine Core
    │
    ├──[CRITICAL]──→ positioning mod (50+ refs)
    │                  └─ Cannot disable
    │                  └─ Cannot replace
    │
    ├──[CRITICAL]──→ items mod (40+ refs)
    │                  └─ Forces weight-based inventory
    │                  └─ Forces container model
    │
    ├──[HIGH]──────→ affection mod (5+ refs)
    │                  └─ Assumes affection scoring
    │
    ├──[HIGH]──────→ violence mod (4+ refs)
    │                  └─ Special event handling
    │
    └──[MEDIUM]────→ clothing mod (6+ refs)
                      └─ Rendering assumptions
```

### Consequences

1. **Cannot Create Alternatives**
   - Want turn-based positioning instead of real-time? ❌ Can't replace positioning mod
   - Want slot-based inventory instead of weight? ❌ Items mod is baked in
   - Want different relationship system? ❌ Affection logic is hardcoded

2. **Cannot Disable Features**
   - Minimal game without positioning? ❌ Engine expects it
   - Game without inventory system? ❌ Operation handlers require it
   - Abstract narrative without physical positioning? ❌ Not possible

3. **Barrier to Third-Party Mods**
   - Mod developers must work around engine assumptions
   - Cannot create total conversion mods
   - Must include positioning/items even if irrelevant

4. **Technical Debt**
   - Each hardcoded reference is a future maintenance burden
   - Harder to test in isolation
   - Fragile when mods evolve

---

## 📋 Recommendations

### P0: Critical Fixes (Do Immediately)

#### 1. Remove p_erotica Debug Code

**Effort**: 15 minutes
**Files**: 6 files, 12 occurrences
**Risk**: None - pure deletion

**Action Items**:

- [ ] Remove all `p_erotica:park_bench_instance` checks from 6 production files
- [ ] Verify no other entity-specific debug code exists
- [ ] Add ESLint rule to prevent entity-specific debug code
- [ ] Create proper debug configuration system if needed

#### 2. Add Linting Prevention

**Effort**: 1 hour
**Risk**: None - preventative

Create ESLint custom rule:

```javascript
// .eslintrc.js addition
module.exports = {
  rules: {
    'no-hardcoded-mod-references': 'error',
  },
  overrides: [
    {
      files: ['src/**/*.js'],
      rules: {
        'no-hardcoded-mod-references': [
          'error',
          {
            allowedMods: ['core'], // Only core mod allowed
            allowedFiles: [
              'src/loaders/modLoader.js', // Legitimate mod references
              'tests/**/*.js', // Tests can reference any mod
            ],
          },
        ],
      },
    },
  ],
};
```

**Action Items**:

- [ ] Implement ESLint custom rule
- [ ] Add to pre-commit hooks
- [ ] Run on entire codebase
- [ ] Fix or exempt legitimate cases
- [ ] Document exemption process

### P1: Short-Term Refactoring (1-2 Sprints)

#### 1. Component Type Registry Pattern

**Effort**: 2 weeks
**Files**: ~30 operation handlers
**Impact**: HIGH - enables mod flexibility

**Implementation**:

```javascript
// src/entities/registries/componentTypeRegistry.js
export class ComponentTypeRegistry {
  #categories = new Map();
  #defaults = new Map();

  register(category, componentId, isDefault = false) {
    if (!this.#categories.has(category)) {
      this.#categories.set(category, []);
    }

    this.#categories.get(category).push(componentId);

    if (isDefault) {
      this.#defaults.set(category, componentId);
    }
  }

  getComponentId(category, preferredType = null) {
    if (
      preferredType &&
      this.#categories.get(category)?.includes(preferredType)
    ) {
      return preferredType;
    }

    return this.#defaults.get(category) || null;
  }

  hasComponentOfCategory(entityManager, entityId, category) {
    const componentIds = this.#categories.get(category) || [];
    return componentIds.some((id) => entityManager.hasComponent(entityId, id));
  }

  getComponentOfCategory(
    entityManager,
    entityId,
    category,
    preferredType = null
  ) {
    const componentId = this.getComponentId(category, preferredType);
    if (!componentId) {
      throw new Error(`No component registered for category: ${category}`);
    }

    return entityManager.getComponent(entityId, componentId);
  }
}
```

**Action Items**:

- [ ] Create ComponentTypeRegistry class
- [ ] Add DI token and registration
- [ ] Update ModLoader to call registry.register() from mod data
- [ ] Refactor 30 operation handlers to use registry
- [ ] Update action schemas to support type preferences
- [ ] Add comprehensive tests
- [ ] Document pattern in mod development guide

### P2: Long-Term Architecture (Q2 2025)

#### 1. Plugin Architecture for Mod Systems

**Effort**: 6-8 weeks
**Impact**: VERY HIGH - true extensibility

**Design**: See full specification in report...

---

## 📊 Success Metrics

### Code Quality Metrics

| Metric                          | Current | Target (Phase 2) | Target (Phase 6) |
| ------------------------------- | ------- | ---------------- | ---------------- |
| Hardcoded non-core refs         | 65+     | <20              | 0                |
| Core refs requiring review      | 20      | 10               | 5                |
| Files with violations           | 35+     | <10              | 0                |
| ESLint violations               | N/A     | 0                | 0                |
| Test coverage (refactored code) | N/A     | >85%             | >90%             |

---

## 🎯 Conclusion

### Summary

The Living Narrative Engine has **significant architectural violations** of its stated "modding-first" philosophy through 65+ hardcoded references to non-core mods. While ~180 references to the core mod are acceptable, the tight coupling to positioning, items, and other mods creates a **barrier to true modularity**.

### Critical Actions

1. **IMMEDIATELY** remove p_erotica debug code (6 files, 12 occurrences)
2. **THIS WEEK** implement ESLint rule to prevent future violations
3. **NEXT 2 SPRINTS** implement ComponentTypeRegistry and refactor operation handlers
4. **Q2 2025** complete plugin architecture for true extensibility

### Long-Term Vision

With the proposed changes, the Living Narrative Engine will achieve:

✅ **True Data-Driven Architecture**

- Engine code contains zero hardcoded mod references (except core)
- All mod-specific logic lives in mod files or plugins
- Mods can be disabled, replaced, or extended without engine changes

✅ **Mod Independence**

- Can disable positioning mod → engine gracefully handles missing capabilities
- Can replace items mod → custom inventory systems work seamlessly
- Can create total conversion mods → no engine assumptions about content

✅ **Third-Party Extensibility**

- Clear plugin interfaces for extending engine capabilities
- Component type registry for alternative implementations
- Comprehensive mod development guide

**Current State**: Hybrid architecture with hardcoded coupling
**Target State**: Pure data-driven modding platform
**Effort**: 7 weeks for cleanup + registry, Q2 for plugin architecture
**Value**: **CRITICAL** for fulfilling "modding-first" vision

---

**Report Generated**: 2025-11-15
**Analysis Scope**: Complete codebase (1,265 files)
**Next Review**: After Phase 2 completion
**Contact**: Architecture Team

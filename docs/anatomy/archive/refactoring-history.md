# Anatomy System Refactoring History

This document chronicles the architectural evolution of the anatomy system, documenting major refactoring efforts, breaking changes, and migration guidance.

## Table of Contents

1. [Current Status](#current-status)
2. [Major Refactorings](#major-refactorings)
3. [Breaking Changes](#breaking-changes)
4. [Migration Guides](#migration-guides)
5. [Planned Improvements](#planned-improvements)

## Current Status

**Last Updated**: 2025-11-06
**Current Version**: Blueprint V2 with Structure Templates
**Status**: Stable with planned improvements

### Architecture State

- ✅ **Implemented**: OrientationResolver shared module (ANASYSREF-001)
- ✅ **Implemented**: Event-driven clothing integration via ANATOMY_GENERATED
- ✅ **Implemented**: AnatomySocketIndex for O(1) socket lookups
- ✅ **Implemented**: Structure template system (V2 blueprints)
- ✅ **Implemented**: Pattern matching for recipes (V2 patterns)
- 🟡 **Planned**: BlueprintRecipeValidator for load-time consistency checks (ANASYSREF-002)
- 🟡 **Planned**: Enhanced pattern matching warnings (ANASYSREF-002)
- 🟡 **Planned**: Comprehensive documentation (ANASYSREF-008) - **IN PROGRESS**

## Major Refactorings

### ANASYSREF-001: Orientation Resolution Extraction

**Date**: November 2025
**Priority**: 🔴 CRITICAL
**Status**: ✅ IMPLEMENTED

#### Problem Statement

SlotGenerator and SocketGenerator contained duplicate orientation resolution logic, requiring perfect synchronization. Any divergence caused massive regressions:

- Slot keys didn't match socket IDs
- Recipe patterns failed silently
- Body parts weren't generated
- Clothing attachment failed

**Root Cause**: DRY principle violation - same logic duplicated across two services.

#### Solution

Extracted shared orientation resolution logic into `OrientationResolver` module:

**Location**: `src/anatomy/shared/orientationResolver.js`

**Key Changes**:
1. Created shared OrientationResolver class
2. Updated SlotGenerator to use OrientationResolver
3. Updated SocketGenerator to use OrientationResolver
4. Centralized all orientation schemes (bilateral, quadrupedal, radial, indexed, custom)

#### Before & After

**Before** (Duplicated Logic):
```javascript
// src/anatomy/slotGenerator.js
#resolveOrientation(scheme, index, count) {
  if (scheme === 'bilateral') {
    return index === 1 ? 'left' : 'right';
  }
  // ... more logic
}

// src/anatomy/socketGenerator.js
#resolveOrientation(scheme, index, count) {
  // DUPLICATE logic with subtle differences
  if (scheme === 'bilateral') {
    return index === 1 ? 'left' : 'right';
  }
  // ... more logic
}
```

**After** (Shared Module):
```javascript
// src/anatomy/shared/orientationResolver.js
export class OrientationResolver {
  static resolveOrientation(scheme, index, totalCount, positions, arrangement) {
    // Single source of truth
  }
}

// src/anatomy/slotGenerator.js
import { OrientationResolver } from './shared/orientationResolver.js';
const orientation = OrientationResolver.resolveOrientation(scheme, index, count);

// src/anatomy/socketGenerator.js
import { OrientationResolver } from './shared/orientationResolver.js';
const orientation = OrientationResolver.resolveOrientation(scheme, index, count);
```

#### Breaking Changes

**None** - Internal refactoring only, no API changes.

#### Migration Guide

No migration needed for mod authors. This is an internal implementation change.

**For Core Developers**:
- Always use OrientationResolver for orientation logic
- Never duplicate orientation resolution
- Update OrientationResolver for new schemes (don't modify SlotGenerator/SocketGenerator)

#### Benefits

- ✅ Eliminates synchronization bugs
- ✅ Single point of maintenance
- ✅ Easier to add new orientation schemes
- ✅ Guaranteed consistency between slots and sockets
- ✅ Prevents regression of commit `af53a1948` bug

#### Tests Added

- Unit tests for OrientationResolver (`tests/unit/anatomy/shared/orientationResolver.test.js`)
- Contract tests for SlotGenerator ↔ SocketGenerator synchronization
- Regression tests for orientation mismatch bug

---

### Event-Driven Clothing Integration

**Date**: 2025 (Exact date TBD)
**Priority**: 🟡 IMPORTANT
**Status**: ✅ IMPLEMENTED

#### Problem Statement

Clothing system was tightly coupled to anatomy generation workflow:
- Direct dependency from AnatomyGenerationWorkflow to ClothingInstantiationService
- No extensibility for other systems to react to anatomy changes
- Timing issues with socket availability
- Cache invalidation coordination problems

#### Solution

Introduced event-driven integration via ANATOMY_GENERATED event:

**Event ID**: `ANATOMY_GENERATED`
**Dispatch Location**: `src/anatomy/workflows/anatomyGenerationWorkflow.js:187-210`

**Key Changes**:
1. Added EventBus dependency to AnatomyGenerationWorkflow (optional)
2. Dispatch ANATOMY_GENERATED event after anatomy generation
3. Include socket information in event payload
4. ClothingInstantiationService subscribes to event
5. Socket index built before event dispatch

#### Before & After

**Before** (Tight Coupling):
```javascript
// AnatomyGenerationWorkflow directly calls clothing service
if (this.#clothingInstantiationService) {
  await this.#clothingInstantiationService.instantiateRecipeClothing(
    ownerId,
    recipe,
    { partsMap, slotEntityMappings }
  );
}
```

**After** (Event-Driven):
```javascript
// AnatomyGenerationWorkflow dispatches event
if (this.#eventBus && this.#socketIndex) {
  const sockets = await this.#socketIndex.getEntitySockets(ownerId);
  this.#eventBus.dispatch('ANATOMY_GENERATED', {
    entityId: ownerId,
    blueprintId: blueprintId,
    sockets: sockets,
  });
}

// ClothingInstantiationService subscribes
eventBus.on('ANATOMY_GENERATED', async ({ entityId, sockets }) => {
  // Resolve and attach clothing
});
```

#### Breaking Changes

**Potentially Breaking** for custom integrations:
- ClothingInstantiationService now requires EventBus subscription
- Timing: Clothing instantiation happens AFTER event dispatch (slight delay)
- Socket index must be provided to AnatomyGenerationWorkflow

#### Migration Guide

**For Mod Authors**: No changes needed.

**For Custom Integrations**:
```javascript
// Old: Direct call to clothing service
await clothingService.instantiateRecipeClothing(...);

// New: Subscribe to event
eventBus.on('ANATOMY_GENERATED', async ({ entityId, sockets }) => {
  await clothingService.processAnatomyGenerated(entityId, sockets);
});
```

#### Benefits

- ✅ Loose coupling between anatomy and clothing
- ✅ Extensible: Other systems can subscribe to ANATOMY_GENERATED
- ✅ Better cache coordination
- ✅ Guaranteed socket availability
- ✅ Cleaner separation of concerns

---

### AnatomySocketIndex: O(1) Socket Lookups

**Date**: 2025 (Exact date TBD)
**Priority**: 🟡 IMPORTANT
**Status**: ✅ IMPLEMENTED

#### Problem Statement

Socket lookups required O(n) graph traversal:
- Slow for large anatomy hierarchies
- No caching of socket locations
- Repeated traversals during clothing attachment
- Performance degradation with complex creatures

#### Solution

Implemented `AnatomySocketIndex` service for O(1) socket lookups:

**Location**: `src/anatomy/services/anatomySocketIndex.js`

**Key Changes**:
1. Created socket index service with O(1) lookup maps
2. Integrated with CacheCoordinator
3. Auto-build on first access
4. Invalidate on anatomy structure changes
5. Include socket info in ANATOMY_GENERATED event

#### Implementation

```javascript
class AnatomySocketIndex {
  // O(1) lookup indexes
  #socketToEntityMap = new Map(); // socketId -> entityId
  #entityToSocketsMap = new Map(); // entityId -> SocketInfo[]
  #rootEntityCache = new Map(); // rootEntityId -> Set<entityId>

  async findEntityWithSocket(rootEntityId, socketId) {
    // O(1) lookup instead of O(n) traversal
    return this.#socketToEntityMap.get(socketId);
  }
}
```

#### Before & After

**Before** (O(n) Traversal):
```javascript
async #findEntityWithSocket(rootEntityId, socketId) {
  const bodyGraph = await this.#bodyGraphService.getBodyGraph(rootEntityId);
  const allPartIds = bodyGraph.getAllPartIds();

  // O(n) traversal
  for (const entityId of [rootEntityId, ...allPartIds]) {
    const socketsComponent = await this.#entityManager.getComponentData(
      entityId,
      'anatomy:sockets'
    );
    if (socketsComponent?.sockets?.some(s => s.id === socketId)) {
      return entityId;
    }
  }
  return null;
}
```

**After** (O(1) Lookup):
```javascript
async findEntityWithSocket(rootEntityId, socketId) {
  if (!this.#rootEntityCache.has(rootEntityId)) {
    await this.buildIndex(rootEntityId); // One-time O(n) build
  }
  return this.#socketToEntityMap.get(socketId); // O(1) lookup
}
```

#### Breaking Changes

**None** - New service, no API changes to existing services.

#### Migration Guide

**For Core Developers**: Use AnatomySocketIndex instead of manual traversal:

```javascript
// Old: Manual O(n) traversal
for (const partId of allPartIds) {
  const sockets = await getSocketsForEntity(partId);
  // ...
}

// New: Use socket index
const socketIndex = container.resolve('anatomySocketIndex');
const entityId = await socketIndex.findEntityWithSocket(rootEntityId, socketId);
```

#### Benefits

- ✅ O(1) socket lookups after initial index build
- ✅ Significant performance improvement for complex anatomy
- ✅ Cache coordination via CacheCoordinator
- ✅ Auto-rebuild on invalidation
- ✅ Memory-efficient (one index per root entity)

---

## Breaking Changes

### Summary of Breaking Changes

| Refactoring | Breaking Change | Severity | Migration Effort |
|-------------|----------------|----------|------------------|
| ANASYSREF-001 | None | N/A | None |
| Event-Driven Integration | Timing change for clothing | Low | Minimal |
| AnatomySocketIndex | None | N/A | None |

### Event-Driven Integration Timing Change

**Change**: Clothing instantiation now happens via event subscription (asynchronous) instead of direct call (synchronous).

**Impact**: Slight delay between anatomy generation and clothing attachment.

**Affected**: Custom integrations that depend on immediate clothing availability.

**Migration**:
```javascript
// Old: Synchronous
const result = await anatomyService.generateForEntity(...);
// Clothing immediately available in result.clothingResult

// New: Event-driven
const result = await anatomyService.generateForEntity(...);
// Wait for ANATOMY_GENERATED event
await waitForEvent('ANATOMY_GENERATED', { entityId: result.rootId });
// Now clothing is attached
```

---

## Migration Guides

### Migrating to OrientationResolver

**Target Audience**: Core developers adding new orientation schemes

**Steps**:
1. Update OrientationResolver with new scheme logic
2. Add scheme to schema enum: `data/schemas/anatomy.structure-template.schema.json`
3. Add unit tests for new scheme
4. Add contract tests for SlotGenerator ↔ SocketGenerator synchronization
5. Document in [Structure Templates Guide](./structure-templates.md)

**Example**:
```javascript
// src/anatomy/shared/orientationResolver.js
export class OrientationResolver {
  static resolveOrientation(scheme, index, totalCount, positions, arrangement) {
    switch (scheme) {
      case 'myNewScheme':
        return this.#resolveMyNewScheme(index, totalCount);
      // ... existing schemes
    }
  }

  static #resolveMyNewScheme(index, totalCount) {
    // New scheme logic
  }
}
```

### Migrating Custom Integrations to Event-Driven

**Target Audience**: Developers with custom anatomy integrations

**Steps**:
1. Add EventBus dependency to your service
2. Subscribe to ANATOMY_GENERATED event during initialization
3. Handle event asynchronously
4. Remove direct dependencies on AnatomyGenerationWorkflow
5. Test event handling

**Example**:
```javascript
class MyCustomService {
  constructor({ eventBus, anatomySocketIndex }) {
    this.#eventBus = eventBus;
    this.#socketIndex = anatomySocketIndex;

    // Subscribe to event
    this.#eventBus.on('ANATOMY_GENERATED', this.#handleAnatomyGenerated.bind(this));
  }

  async #handleAnatomyGenerated({ entityId, blueprintId, sockets }) {
    // Your custom logic
    console.log(`Anatomy generated for ${entityId}`);
    console.log(`Available sockets:`, sockets.map(s => s.id));

    // Access socket index for lookups
    const entitySockets = await this.#socketIndex.getEntitySockets(entityId);
  }
}
```

### Migrating to AnatomySocketIndex

**Target Audience**: Core developers with O(n) socket lookups

**Steps**:
1. Add AnatomySocketIndex dependency to your service
2. Replace manual graph traversal with socket index calls
3. Handle auto-rebuild (index builds on first access if needed)
4. Register caches with CacheCoordinator if needed
5. Update tests to use socket index

**Example**:
```javascript
// Before: Manual traversal
async findSocketOwner(rootEntityId, socketId) {
  const bodyGraph = await this.#bodyGraphService.getBodyGraph(rootEntityId);
  for (const partId of bodyGraph.getAllPartIds()) {
    const sockets = await this.#getSocketsForEntity(partId);
    if (sockets.some(s => s.id === socketId)) {
      return partId;
    }
  }
  return null;
}

// After: Use socket index
async findSocketOwner(rootEntityId, socketId) {
  return await this.#socketIndex.findEntityWithSocket(rootEntityId, socketId);
}
```

---

## Planned Improvements

### ANASYSREF-002: Enhanced Validation

**Status**: 🟡 PLANNED
**Priority**: 🟡 IMPORTANT
**Estimated Effort**: 10-15 hours

#### Planned Features

1. **BlueprintRecipeValidator**: Load-time validation of blueprint-recipe consistency
   - Verify recipe patterns match blueprint slot structure
   - Warn on patterns that match zero slots
   - Detect pattern-template mismatches early

2. **Enhanced Pattern Matching Warnings**:
   - Promote zero-match warnings from debug to warn level
   - Add suggestions for pattern fixes
   - Validate orientation scheme compatibility

3. **Template Change Impact Analysis**:
   - Detect template changes that break existing recipes
   - Provide migration warnings
   - Suggest pattern updates

#### Expected Benefits

- ✅ Catch configuration errors at load time
- ✅ Better error messages for developers
- ✅ Prevent silent pattern matching failures
- ✅ Easier debugging of template-recipe issues

#### Implementation Notes

See `reports/anatomy-system-refactoring-analysis.md` for detailed design.

---

### ANASYSREF-008: Documentation Updates

**Status**: 🟢 IN PROGRESS
**Priority**: 🟢 RECOMMENDED
**Estimated Effort**: 20-30 hours

#### Scope

1. ✅ Update structure-templates.md with validation requirements
2. ✅ Update recipe-patterns.md with pattern matching validation
3. ✅ Create architecture.md with architecture diagrams
4. ✅ Create troubleshooting.md with common issues
5. ✅ Create testing guide with contract testing patterns
6. ✅ Create refactoring history (this document)
7. 🟡 Create development guide for quick-start

#### Completion

Documentation is being actively updated to reflect:
- OrientationResolver architecture
- Event-driven integration
- Socket index caching
- Pattern matching best practices
- Troubleshooting workflows

---

## Historical Context

### Pre-Refactoring Issues

Before ANASYSREF-001, the anatomy system experienced:

1. **Frequent Regressions**: Template changes regularly broke anatomy generation
2. **Silent Failures**: Pattern matching failures weren't logged, causing cryptic runtime errors
3. **Difficult Debugging**: No clear path to diagnose orientation mismatches
4. **Tight Coupling**: Clothing system directly dependent on anatomy workflow
5. **Performance Issues**: O(n) socket lookups for every clothing attachment

### Commit `af53a1948` - "Fixed incredibly nasty regressions"

This commit fixed a cascade failure caused by orientation mismatch:

**Failure Chain**:
```
Template Change
  ↓
SlotGenerator produces different keys
  ↓
SocketGenerator uses old logic
  ↓
Mismatch between slot keys and socket IDs
  ↓
Recipe patterns fail (zero matches)
  ↓
No body parts generated
  ↓
Clothing fails to attach
  ↓
Tests fail with cryptic errors
```

**Root Cause**: Duplicated orientation resolution logic diverged.

**Fix**: Synchronized orientation logic (temporary fix).

**Permanent Solution**: ANASYSREF-001 extracted shared OrientationResolver.

### Lessons Learned

1. **DRY Principle**: Never duplicate critical logic across services
2. **Contract Testing**: Test synchronization requirements explicitly
3. **Fail Fast**: Validation errors should be loud, not silent
4. **Event-Driven Design**: Loose coupling enables extensibility
5. **Performance Matters**: O(1) lookups >> O(n) traversals

---

## Related Documentation

- [Architecture Guide](./architecture.md) - Current system architecture
- [Structure Templates](./structure-templates.md) - Template syntax and validation
- [Recipe Patterns](./recipe-patterns.md) - Pattern matching guide
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
- [Testing Guide](../testing/anatomy-testing-guide.md) - Contract testing patterns
- [Development Guide](../development/anatomy-development-guide.md) - Quick-start for developers
- [Refactoring Analysis Report](../../reports/anatomy-system-refactoring-analysis.md) - Detailed analysis

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-06 | Initial documentation of refactoring history |

**Maintained By**: Living Narrative Engine Core Team
**Last Review**: 2025-11-06

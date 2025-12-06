# Anatomy Graph Generation Architecture Analysis

**Date**: 2025-12-02
**Scope**: Analysis of anatomy graph generation robustness, focusing on recipe-to-graph pipeline
**Status**: Analysis Complete

---

## Executive Summary

The anatomy graph generation system is architecturally sound but has **critical robustness gaps** that allow silent data corruption. The recent chicken recipe bug (where one leg's children were overwritten by the other leg's) exemplifies a class of issues stemming from:

1. **Silent overwrites** in slot-to-entity mappings
2. **No fail-fast validation** for socket ID collisions
3. **V1/V2 version coexistence** creating maintenance complexity
4. **Missing uniqueness assertions** at multiple pipeline stages

This report identifies 12 specific pain points and provides prioritized recommendations for making the system more robust.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Data Flow: Recipe to Anatomy Graph](#2-data-flow-recipe-to-anatomy-graph)
3. [Critical Pain Points](#3-critical-pain-points)
4. [V1/V2 Version Coexistence Issues](#4-v1v2-version-coexistence-issues)
5. [The Chicken Bug: Root Cause Analysis](#5-the-chicken-bug-root-cause-analysis)
6. [Robustness Recommendations](#6-robustness-recommendations)
7. [Implementation Priority Matrix](#7-implementation-priority-matrix)
8. [Key Files Reference](#8-key-files-reference)

---

## 1. System Architecture Overview

### Core Pipeline

```
Recipe File (JSON)
    |
    v
validate-recipe-v2.js (CLI Entry Point)
    |
    v
RecipeValidationRunner (11 Validators)
    |
    v
RecipeProcessor / RecipePatternResolver
    |
    v
bodyBlueprintFactory.createAnatomyGraph()
    |
    +-- blueprintLoader (V1/V2 detection and routing)
    +-- blueprintValidator (validates recipe slots against blueprint)
    +-- AnatomyGraphContext (tracks creation state)
    +-- entityGraphBuilder.createRootEntity()
    +-- slotResolutionOrchestrator.processBlueprintSlots()
    |       +-- socketManager.validateSocketAvailability()
    |       +-- partSelectionService.selectPart()
    |       +-- entityGraphBuilder.createAndAttachPart()
    |       +-- context.mapSlotToEntity()  <-- SILENT OVERWRITE RISK
    +-- recipeConstraintEvaluator
    +-- graphIntegrityValidator
```

### Key Components

| Component        | File                                                             | Responsibility                       |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------ |
| Blueprint Loader | `src/anatomy/bodyBlueprintFactory/blueprintLoader.js`            | V1/V2 detection, template processing |
| Slot Resolution  | `src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js` | Node creation loop                   |
| Graph Context    | `src/anatomy/anatomyGraphContext.js`                             | State tracking during build          |
| Recipe Processor | `src/anatomy/recipeProcessor.js`                                 | V1 pattern expansion                 |
| Pattern Resolver | `src/anatomy/recipePatternResolver/patternResolver.js`           | V2 pattern resolution                |
| Socket Manager   | `src/anatomy/socketManager.js`                                   | Socket occupancy tracking            |
| Entity Builder   | `src/anatomy/entityGraphBuilder.js`                              | Entity creation and attachment       |

---

## 2. Data Flow: Recipe to Anatomy Graph

### Phase 1: Blueprint Loading

```javascript
// blueprintLoader.js
if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
  return processV2Blueprint(blueprint, dependencies);
}
return blueprint; // V1 pass-through
```

**V2 Processing**:

1. Load structure template from DataRegistry
2. Generate sockets via `socketGenerator.generateSockets()`
3. Generate slots via `slotGenerator.generateBlueprintSlots()`
4. Merge: `{...generatedSlots, ...additionalSlots}`

### Phase 2: Slot Resolution

```javascript
// slotResolutionOrchestrator.js
for (const [slotKey, slot] of sortedSlots) {
  const parentEntityId = context.getEntityForSlot(slot.parent);
  const childId = await entityGraphBuilder.createAndAttachPart(...);

  context.addCreatedEntity(childId);
  context.mapSlotToEntity(slotKey, childId);  // <-- OVERWRITES IF DUPLICATE KEY
}
```

### Phase 3: Context Mapping

```javascript
// anatomyGraphContext.js
mapSlotToEntity(slotKey, entityId) {
  this.#slotToEntity.set(slotKey, entityId);  // <-- NO DUPLICATE CHECK
}
```

---

## 3. Critical Pain Points

### CRITICAL-01: Silent Slot-to-Entity Mapping Overwrites

**Location**: `src/anatomy/anatomyGraphContext.js:144-146`

**Problem**: The `mapSlotToEntity()` method silently overwrites existing mappings without any warning or error.

```javascript
mapSlotToEntity(slotKey, entityId) {
  this.#slotToEntity.set(slotKey, entityId);  // Silent overwrite
}
```

**Impact**: If two slots have the same key, the second one silently replaces the first. The first entity becomes orphaned and unreachable via slot lookups.

**Evidence**: The chicken leg bug - right leg's children overwrote left leg's children because socket IDs were not unique.

---

### CRITICAL-02: No Socket ID Collision Detection

**Location**: `src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js`

**Problem**: When processing slots, the orchestrator doesn't validate that socket IDs are unique across all instances of an entity definition.

**Scenario**:

1. Blueprint has `left_leg` and `right_leg` slots
2. Both reference same entity definition (`chicken_leg`)
3. `chicken_leg` has sockets `foot` and `spur`
4. When processing `left_leg.foot`, socket `foot` is occupied
5. When processing `right_leg.foot`, a DIFFERENT entity instance should get `foot`, but collision occurs

**Current Behavior**: No validation, silent corruption.

---

### CRITICAL-03: Socket Merging Without Property Preservation

**Location**: `src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js:208-230`

**Problem**: When merging entity definition sockets with template-generated sockets, the template version completely replaces entity sockets with the same ID.

```javascript
const socketMap = new Map();
for (const socket of existingSocketList) {
  socketMap.set(socket.id, socket);
}
for (const socket of blueprint._generatedSockets) {
  socketMap.set(socket.id, socket); // Complete replacement, no merge
}
```

**Impact**: If entity definition has socket enhancements (extra fields, custom properties), template version loses them entirely.

---

### HIGH-01: No Duplicate Slot Key Validation

**Location**: `sortSlotsByDependency()` in slotResolutionOrchestrator.js

**Problem**: The dependency sorter doesn't detect or warn about duplicate slot keys in the blueprint.

```javascript
export function sortSlotsByDependency(slots) {
  const sorted = [];
  const visited = new Set();
  // No check for duplicate keys in slots object
  for (const [key, slot] of Object.entries(slots)) {
    visit(key, slot);
  }
  return sorted;
}
```

**Impact**: If `additionalSlots` accidentally duplicates a generated slot key, the duplicate silently takes precedence.

---

### HIGH-02: No Root Entity Retry for Child Entities

**Location**: `src/anatomy/entityGraphBuilder.js`

**Problem**: Root entity creation has exponential backoff retry logic (max 5 retries), but child entity creation has no such protection.

```javascript
// Root entity - has retry
async createRootEntity(rootDefinitionId, recipe, ownerId, componentOverrides) {
  // ... exponential backoff retry logic (lines 141-157)
}

// Child entity - no retry
async createAndAttachPart(parentId, socketId, partDefId, ...) {
  // No retry logic
}
```

**Impact**: If entity manager is slow/async, child entities might fail silently while root succeeds.

---

### HIGH-03: Component Override Blind Application

**Location**: `slotResolutionOrchestrator.js:194`

**Problem**: Component overrides from recipe slots are applied without validating that the target components exist on the entity definition.

```javascript
const componentOverrides = recipe.slots?.[slotKey]?.properties || {};
// Passed directly to createAndAttachPart() without validation
```

**Impact**: If `properties` references non-existent components, the override is silently ignored.

---

### MEDIUM-01: Pattern Overlap Without Warning

**Location**: `src/anatomy/recipePatternResolver/patternResolver.js`

**Problem**: When multiple V2 patterns resolve to the same slot, later patterns overwrite earlier ones without warning.

**Pattern Precedence**: `matchesGroup > matchesPattern > matchesAll`

But if two patterns at the same precedence level match the same slot, last one wins silently.

---

### MEDIUM-02: Blueprint Loader Duplicate Detection Logic

**Location**: `src/anatomy/bodyBlueprintFactory/blueprintLoader.js:115-143`

**Current State**: The loader does distinguish between intentional overrides (parent relationship changes) and unintentional duplicates, logging warnings for the latter.

**Issue**: The warning is logged but processing continues. There's no option to fail-fast on unintentional duplicates.

---

### MEDIUM-03: V1/V2 Detection Duplication

**Location**: Both `blueprintLoader.js` and `BlueprintProcessorService.js`

**Problem**: Version detection logic is duplicated across two files:

```javascript
// blueprintLoader.js:49
if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
  return processV2Blueprint(blueprint, dependencies);
}

// BlueprintProcessorService.js
detectVersion(blueprint) {
  if (blueprint.schemaVersion === '2.0') return 2;
  return 1;
}
```

**Impact**: Maintenance burden, potential for divergence.

---

### MEDIUM-04: Debug Console.log Statements in Production Code

**Location**: `slotResolutionOrchestrator.js:56-71, 192-196`

**Problem**: Multiple `console.log('[DEBUG]')` statements remain in production code.

```javascript
console.log('[DEBUG] #processBlueprintSlots CALLED');
console.log('[DEBUG]   blueprint.slots exists?', !!blueprint.slots);
// ... more debug logs
```

**Impact**: Performance overhead, noisy output, unprofessional appearance.

---

### LOW-01: Visualization Name Collision

**Location**: `src/domUI/anatomy-renderer/VisualizationComposer.js:293`

**Problem**: Two anatomy parts with the same `core:name.text` are indistinguishable in the visualizer.

```javascript
name = nameComponent?.text || id;
```

**Impact**: User confusion when viewing anatomy graphs with parts like "finger" appearing multiple times.

---

### LOW-02: O(n^2) Child Discovery in Visualizer

**Location**: `VisualizationComposer.js:320-358`

**Problem**: For each node, the visualizer iterates ALL unvisited entities to find children.

```javascript
for (const partId of allPartIds) {
  // O(n) per node
  if (!visited.has(partId)) {
    // Check if this is a child...
  }
}
```

**Impact**: Slow rendering for large anatomies (100+ parts).

---

## 4. V1/V2 Version Coexistence Issues

### Current State

| Aspect            | V1                          | V2                                 |
| ----------------- | --------------------------- | ---------------------------------- |
| Schema Detection  | No `schemaVersion` or "1.0" | `schemaVersion: "2.0"`             |
| Slots Source      | Direct: `blueprint.slots`   | Generated from `structureTemplate` |
| Pattern Expansion | `RecipeProcessor` (simple)  | `RecipePatternResolver` (complex)  |
| Configuration     | Simple slot objects         | Slots + patterns + exclusions      |

### Issues

1. **Dual implementations**: `blueprintLoader.js` and `BlueprintProcessorService.js` both have V1/V2 detection logic
2. **Processing flag inconsistency**: `_generatedSockets` array used to detect V2 processing state
3. **Pattern resolver integration**: V2 pattern handling split between `RecipeProcessor` and `RecipePatternResolver`
4. **No automatic migration path**: V1 recipes cannot be easily upgraded to V2

### Recommendation

Consolidate all version detection and processing into `BlueprintProcessorService` as the single source of truth. The loader should delegate to the service rather than implementing its own V2 processing.

---

## 5. The Chicken Bug: Root Cause Analysis

### User Report

- Right chicken leg has children: `chicken_spur` and `chicken_foot`
- Left chicken leg has NO children (they got overwritten)

### Root Cause Chain

1. **Entity Definition Issue**: `chicken_leg.entity.json` has socket IDs `foot` and `spur` (not unique)

2. **Blueprint Correctly Structured**:

   ```json
   "left_foot": { "parent": "left_leg", "socket": "foot", ... },
   "right_foot": { "parent": "right_leg", "socket": "foot", ... }
   ```

3. **Processing Order**:
   - `left_leg` created → children attached to sockets `foot`, `spur`
   - `right_leg` created → children attached to sockets `foot`, `spur`
   - Socket occupancy tracking uses `${parentId}:${socketId}` as key
   - BUT: Both legs have the SAME entity definition, so socket IDs collide

4. **Silent Corruption**:
   - No validation detected the collision
   - Second leg's children overwrote first leg's in context mappings
   - Graph appeared complete but was corrupted

### Fix Applied

The socket IDs in entity definitions were made unique (e.g., using orientation prefixes).

### Systemic Issue Remaining

No fail-fast validation exists to catch similar issues in future recipes.

---

## 6. Robustness Recommendations

### R1: Add Duplicate Key Detection to mapSlotToEntity()

**File**: `src/anatomy/anatomyGraphContext.js`

```javascript
mapSlotToEntity(slotKey, entityId) {
  if (this.#slotToEntity.has(slotKey)) {
    throw new ValidationError(
      `Slot key '${slotKey}' already mapped to entity '${this.#slotToEntity.get(slotKey)}'. ` +
      `Cannot remap to '${entityId}'. Duplicate slot keys detected.`
    );
  }
  this.#slotToEntity.set(slotKey, entityId);
}
```

**Priority**: CRITICAL - Prevents silent data corruption

---

### R2: Add Socket ID Collision Validation

**File**: `src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js`

Add pre-processing validation:

```javascript
function validateSocketUniqueness(blueprint, context, entityManager) {
  const socketUsage = new Map(); // `${entityDefId}:${socketId}` -> slotKey

  for (const [slotKey, slot] of Object.entries(blueprint.slots)) {
    if (!slot.parent) continue;

    const parentSlot = blueprint.slots[slot.parent];
    const parentDefId = /* resolve entity definition ID */;
    const fullSocketKey = `${parentDefId}:${slot.socket}`;

    if (socketUsage.has(fullSocketKey)) {
      throw new ValidationError(
        `Socket collision: socket '${slot.socket}' on entity definition '${parentDefId}' ` +
        `used by both slots '${socketUsage.get(fullSocketKey)}' and '${slotKey}'. ` +
        `Each socket can only be used once per entity instance.`
      );
    }
    socketUsage.set(fullSocketKey, slotKey);
  }
}
```

**Priority**: CRITICAL - Catches the chicken bug class of issues

---

### R3: Add Component Override Validation

**File**: `src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js`

```javascript
function validateComponentOverrides(
  partDefinitionId,
  componentOverrides,
  dataRegistry,
  logger
) {
  const partDef = dataRegistry.get('anatomyParts', partDefinitionId);
  const validComponents = Object.keys(partDef.components || {});

  for (const componentId of Object.keys(componentOverrides)) {
    if (!validComponents.includes(componentId)) {
      logger.warn(
        `Component override '${componentId}' does not exist on entity definition '${partDefinitionId}'. ` +
          `Available components: ${validComponents.join(', ')}`
      );
    }
  }
}
```

**Priority**: HIGH - Prevents silent override failures

---

### R4: Remove Debug Console.log Statements

**File**: `src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js`

Remove all `console.log('[DEBUG]')` statements and replace with proper logger calls if needed.

**Priority**: HIGH - Code hygiene

---

### R5: Consolidate V1/V2 Processing

**Files**:

- `src/anatomy/bodyBlueprintFactory/blueprintLoader.js`
- `src/anatomy/services/blueprintProcessorService.js`

Move all V2 processing logic from `blueprintLoader.processV2Blueprint()` into `BlueprintProcessorService`. The loader should simply call the service.

**Priority**: MEDIUM - Reduces maintenance burden

---

### R6: Add Slot Key Uniqueness Validator

**File**: New validator in `src/anatomy/validation/validators/`

Create `SlotKeyUniquenessValidator.js` that fails if:

- Blueprint has duplicate slot keys
- additionalSlots duplicates generated slot keys (without explicit override intent)

**Priority**: MEDIUM - Catches issues during validation

---

### R7: Add Retry Logic to Child Entity Creation

**File**: `src/anatomy/entityGraphBuilder.js`

Apply the same exponential backoff pattern used for root entities to child entities.

**Priority**: MEDIUM - Improves reliability

---

### R8: Add Name Collision Handling in Visualizer

**File**: `src/domUI/anatomy-renderer/VisualizationComposer.js`

When multiple nodes have the same display name, append an index:

```javascript
const existingCount = this.#nameUsage.get(name) || 0;
this.#nameUsage.set(name, existingCount + 1);
const displayName = existingCount > 0 ? `${name} [${existingCount + 1}]` : name;
```

**Priority**: LOW - UI improvement

---

### R9: Optimize Visualizer Child Discovery

**File**: `src/domUI/anatomy-renderer/VisualizationComposer.js`

Build parent-to-children index during initial iteration instead of O(n^2) discovery.

**Priority**: LOW - Performance optimization

---

## 7. Implementation Priority Matrix

| ID  | Issue                                      | Severity | Effort | Priority |
| --- | ------------------------------------------ | -------- | ------ | -------- |
| R1  | Duplicate key detection in mapSlotToEntity | CRITICAL | Low    | **1**    |
| R2  | Socket ID collision validation             | CRITICAL | Medium | **2**    |
| R4  | Remove debug console.log                   | HIGH     | Low    | **3**    |
| R3  | Component override validation              | HIGH     | Medium | **4**    |
| R6  | Slot key uniqueness validator              | MEDIUM   | Medium | **5**    |
| R5  | Consolidate V1/V2 processing               | MEDIUM   | High   | **6**    |
| R7  | Retry logic for child entities             | MEDIUM   | Low    | **7**    |
| R8  | Name collision in visualizer               | LOW      | Low    | **8**    |
| R9  | Optimize visualizer discovery              | LOW      | Medium | **9**    |

---

## 8. Key Files Reference

### Core Anatomy System

| File                                                             | Lines | Purpose                     |
| ---------------------------------------------------------------- | ----- | --------------------------- |
| `src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js`       | ~400  | Main orchestrator           |
| `src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js` | 371   | Slot processing loop        |
| `src/anatomy/bodyBlueprintFactory/blueprintLoader.js`            | 165   | V1/V2 detection and loading |
| `src/anatomy/anatomyGraphContext.js`                             | 185   | State tracking              |
| `src/anatomy/entityGraphBuilder.js`                              | ~300  | Entity creation             |
| `src/anatomy/socketManager.js`                                   | ~200  | Socket occupancy            |
| `src/anatomy/recipeProcessor.js`                                 | ~200  | V1 pattern expansion        |
| `src/anatomy/recipePatternResolver/patternResolver.js`           | ~300  | V2 pattern resolution       |
| `src/anatomy/services/blueprintProcessorService.js`              | ~150  | V1/V2 processing service    |

### Validation Pipeline

| File                                                                    | Purpose                         |
| ----------------------------------------------------------------------- | ------------------------------- |
| `src/anatomy/validation/RecipeValidationRunner.js`                      | Validator orchestration         |
| `src/anatomy/validation/validators/SocketSlotCompatibilityValidator.js` | Socket-slot validation          |
| `src/anatomy/validation/validators/SocketNameTplValidator.js`           | Socket name template validation |
| `src/anatomy/graphIntegrityValidator.js`                                | Final graph validation          |

### Visualization

| File                                                  | Purpose                      |
| ----------------------------------------------------- | ---------------------------- |
| `src/domUI/anatomy-renderer/VisualizationComposer.js` | Graph building and rendering |
| `src/domUI/AnatomyVisualizerUI.js`                    | UI controller                |
| `src/domUI/visualizer/VisualizerStateController.js`   | State management             |

### Entry Points

| File                            | Purpose              |
| ------------------------------- | -------------------- |
| `scripts/validate-recipe-v2.js` | CLI validation tool  |
| `src/anatomy-visualizer.js`     | Visualizer bootstrap |

---

## Conclusion

The anatomy graph generation system has a solid architectural foundation but lacks critical fail-fast validations that would prevent silent data corruption. The chicken bug is symptomatic of a broader class of issues where duplicate keys, socket collisions, and invalid overrides are processed without warning.

**Immediate actions**:

1. Implement R1 (duplicate key detection) and R2 (socket collision validation)
2. Remove debug console.log statements (R4)
3. Add component override validation (R3)

These changes will transform the system from "works most of the time" to "fails fast and clearly when misconfigured."

---

_Report generated by architecture analysis on 2025-12-02_

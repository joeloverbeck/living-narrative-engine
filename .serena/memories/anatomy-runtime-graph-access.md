# Anatomy Graph Runtime Access - Investigation Report

## Executive Summary

The anatomy graph IS generated at load time and persisted in the `anatomy:body` component. The `getAllParts()` method expects a specific nested structure that is populated during the anatomy generation workflow.

## How Anatomy Graph is Generated at Load Time

### 1. Generation Trigger
- During entity instantiation (via `entityInstanceLoader.js`)
- Entities with `anatomy:body` component + `recipeId` trigger generation
- `AnatomyGenerationService.generateAnatomyIfNeeded()` checks and initiates generation

### 2. Generation Process Flow
```
AnatomyGenerationService.generateAnatomyIfNeeded(entityId)
  ↓
AnatomyOrchestrator.orchestrateGeneration(entityId, recipeId)
  ↓
PartsMapBuildingStage.executePartsMapBuilding()
  ↓
updateAnatomyBodyComponent() — CRITICAL STEP
```

### 3. What Gets Persisted in `anatomy:body` Component

After generation completes, the component structure is:

```javascript
{
  recipeId: "modId:recipeName",  // Preserved from input
  body: {
    root: "entityId-of-root-part",      // ROOT ID
    parts: {
      "part_name_1": "entityId-1",      // Named parts map
      "part_name_2": "entityId-2",
      "part_name_3": "entityId-3",
      // ... more parts
    },
    descriptors: {                       // Optional: from recipe
      height: "tall",
      build: "athletic",
      // ... other body descriptors
    }
  }
}
```

## How `getAllParts()` Accesses the Generated Graph

### Method Signature
**File**: `src/anatomy/bodyGraphService.js` line 140
```javascript
getAllParts(bodyComponent, actorEntityId = null)
```

### Access Pattern (Lines 152-165)
```javascript
// Check if this is the full anatomy:body component with nested structure
if (bodyComponent.body && bodyComponent.body.root) {
  rootId = bodyComponent.body.root;
  // ✅ Uses the root ID from body.root
}
// Fallback for direct body structure
else if (bodyComponent.root) {
  rootId = bodyComponent.root;
}
```

**Key Point**: The method expects `bodyComponent.body.root` to exist - this is populated by `updateAnatomyBodyComponent()` during generation.

### Query Flow
1. Extract root ID from `bodyComponent.body.root` (or fallback to `bodyComponent.root`)
2. Check adjacency cache for actor entity (if provided)
3. Check query cache (caches results of getAllParts calls)
4. If cache miss: Call `AnatomyGraphAlgorithms.getAllParts()` with:
   - `cacheRootId`: The actor entity (if in cache) or blueprint root
   - `cacheManager`: Contains adjacency relationships (joints, parts)
   - `entityManager`: For entity lookups

## How Other Handlers Access Anatomy

### Example: `RegenerateDescriptionHandler`
**File**: `src/logic/operationHandlers/regenerateDescriptionHandler.js`

```javascript
const entity = this.#entityManager.getEntityInstance(entityId);
const newDescription = await this.#bodyDescriptionComposer.composeDescription(entity);
```

### How `BodyDescriptionComposer` Uses It
**File**: `src/anatomy/bodyDescriptionComposer.js` line 96

```javascript
const bodyComponent = bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
if (!bodyComponent || !bodyComponent.body || !bodyComponent.body.root) {
  return '';
}

// ✅ Gets already-generated parts list - no regeneration
const allParts = this.bodyGraphService.getAllParts(bodyComponent.body);
```

## The Cache System

### Two-Level Caching

#### 1. Adjacency Cache (`AnatomyCacheManager`)
- **Purpose**: Maps entity → {children: [], parentId}
- **Built by**: `BodyGraphService.buildAdjacencyCache(entityId)`
- **Contents**: Joint relationships between part entities
- **Timing**: Built once per actor, on-demand in `getBodyGraph()`

#### 2. Query Cache
- **Purpose**: Caches results of `getAllParts()` calls
- **Key**: Cache root ID (actor or blueprint root)
- **Hit/Miss**: Logged as "CACHE HIT" or "CACHE MISS"
- **Timing**: Populated after first query, reused for subsequent calls

### Critical Handler Code
**File**: `src/anatomy/bodyGraphService.js` line 178-195

```javascript
// If actor is in cache, use it as cache root
let cacheRootId = rootId;
if (actorEntityId && this.#cacheManager.has(actorEntityId)) {
  cacheRootId = actorEntityId;
  // Use actor entity for adjacency lookups
} else {
  // Use blueprint root for adjacency lookups
  cacheRootId = rootId;
}

// Check query cache
const cachedResult = this.#queryCache.getCachedGetAllParts(cacheRootId);
if (cachedResult !== undefined) {
  return cachedResult;  // CACHE HIT
}

// Query if not cached
const result = AnatomyGraphAlgorithms.getAllParts(
  cacheRootId,
  this.#cacheManager,
  this.#entityManager
);
```

## The Issue: Why `getAllParts()` Returns Empty

If `getAllParts()` returns empty array, the root cause is one of:

### 1. Missing `body.root` (Most Likely)
- **Symptom**: `bodyComponent.body` exists but `bodyComponent.body.root` is `undefined` or `null`
- **Cause**: Generation didn't complete (workflow stage didn't run)
- **Evidence**: Check if `anatomy:body` component only has `recipeId` field, no `body` object

### 2. Anatomy Generation Never Ran
- **Symptom**: No log messages about generation
- **Check**:
  ```javascript
  entity.getComponentData('anatomy:body')
  // If only contains: { recipeId: "..." }
  // Then generation didn't populate body.root
  ```

### 3. Cache Miss with Empty Adjacency
- **Symptom**: Logs show "CACHE MISS" but returns empty
- **Cause**: Adjacency cache not built properly for actor
- **Check**: `this.#cacheManager.size()` in logs - should be > 0

### 4. Root ID Exists but No Parts Generated
- **Symptom**: `body.root` is valid, but no child parts exist
- **Cause**: Graph generation created only root, no parts
- **Check**: Part entities should exist (created during graph generation)

## Runtime Access Pattern Summary

```
Handler needs anatomy:
  ↓
Get entity instance: entityManager.getEntityInstance(entityId)
  ↓
Get anatomy:body component: entity.getComponentData('anatomy:body')
  ↓
Access already-generated graph: bodyGraphService.getAllParts(bodyComponent.body, entityId)
  ↓
Check cache:
  ├─ Query cache hit? → return cached part IDs
  └─ Query cache miss? → Query adjacency + entity graph → cache → return
```

## Key Files and Locations

| Component | File | Key Method |
|-----------|------|-----------|
| Generation | `src/anatomy/anatomyGenerationService.js` | `generateAnatomyIfNeeded()` |
| Persists to | `src/anatomy/workflows/stages/partsMapBuildingStage.js` | `updateAnatomyBodyComponent()` |
| Runtime Access | `src/anatomy/bodyGraphService.js` | `getAllParts()` |
| Graph Query | `src/anatomy/anatomyGraphAlgorithms.js` | `getAllParts()` (static) |
| Caching | `src/anatomy/anatomyCacheManager.js` | `buildAdjacencyCache()` |
| Usage Example | `src/anatomy/bodyDescriptionComposer.js` | `composeDescription()` |

## What `bodyComponent.body` Contains After Generation

```javascript
{
  root: "generated-root-part-entity-id",
  parts: {
    "Head": "part-entity-id-1",
    "Torso": "part-entity-id-2",
    "Left Arm": "part-entity-id-3",
    "Right Arm": "part-entity-id-4",
    "Left Leg": "part-entity-id-5",
    "Right Leg": "part-entity-id-6",
    // ... plus all socket-generated parts (eyes, ears, etc.)
  },
  descriptors: {
    height: "6 feet",
    build: "athletic",
    // ... etc
  }
}
```

The `root` ID and `parts` map are used by `getAllParts()` to traverse the graph via the adjacency cache (joints).

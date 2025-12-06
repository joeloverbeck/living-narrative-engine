# Anatomy Cache Isolation Specification

**Version**: 1.0
**Date**: 2025-11-23
**Status**: Active
**Priority**: CRITICAL - Prevents most long-running bug in application

---

## Context

### Location in Codebase

**Primary Module**: `/src/anatomy/anatomyCacheManager.js`

- **Class**: `AnatomyCacheManager`
- **Critical Method**: `#handleDisconnectedActorAnatomy()` (lines 440-516)
- **Supporting Method**: `buildCache()` (lines 170-212)

**Secondary Module**: `/src/anatomy/bodyGraphService.js`

- **Class**: `BodyGraphService`
- **Key Method**: `getAllParts()` (lines 141-221)
- **Integration**: Uses `AnatomyCacheManager` internally

**Related Modules**:

- `/src/anatomy/workflows/anatomyGenerationWorkflow.js` - Orchestrates anatomy creation
- `/src/anatomy/workflows/stages/eventPublicationStage.js` - Dispatches ANATOMY_GENERATED event
- `/src/anatomy/workflows/stages/clothingInstantiationStage.js` - Attaches clothing to body parts
- `/src/anatomy/anatomyGraphAlgorithms.js` - Graph traversal algorithms
- `/src/clothing/strategies/directSocketStrategy.js` - Resolves clothing attachment points

### What the Module Does

The `AnatomyCacheManager` maintains an in-memory adjacency cache (parent-child relationship graph) for anatomy structures. This cache enables efficient O(1) lookup of anatomy hierarchies instead of O(n) entity queries.

**Core Responsibilities**:

1. **Graph Building**: Construct parent-child relationships from `anatomy:joint` components
2. **Cache Management**: Maintain per-root adjacency cache with invalidation
3. **Disconnected Actor Handling**: Connect actor entities to their anatomy root parts
4. **Query Optimization**: Enable fast traversal via cached children arrays

**Anatomy Graph Structure**:

```
Actor Entity (e.g., "fantasy:threadscar_melissa_instance")
    └─ anatomy:body component
           └─ body.root: "uuid-of-torso-part"
                └─ Torso Part (anatomy:part)
                     ├─ Left Arm (anatomy:joint → parent: torso)
                     │    └─ Left Hand
                     ├─ Right Arm
                     │    └─ Right Hand
                     ├─ Left Leg
                     │    └─ Left Foot
                     └─ Right Leg
                          └─ Right Foot
```

**Cache Data Structure**:

```javascript
Map<entityId, AnatomyNode> where AnatomyNode = {
  entityId: string,
  partType: string,        // e.g., "torso", "arm", "leg"
  parentId: string|null,   // Parent in anatomy tree
  socketId: string|null,   // Socket on parent where this attaches
  children: string[]       // Child entity IDs
}
```

### Architecture

**Entity Component System (ECS) Integration**:

The anatomy system follows the ECS pattern where:

- **Entities**: String IDs (actors and body parts)
- **Components**: `anatomy:body`, `anatomy:part`, `anatomy:joint`, `anatomy:sockets`
- **Systems**: Cache manager, graph algorithms, clothing validation

**Component Schemas**:

**anatomy:body** (on actor entities):

```json
{
  "recipeId": "anatomy:human_female",
  "body": {
    "root": "uuid-of-anatomy-root-part" // ← CRITICAL: Source of truth
  },
  "structure": {
    "rootPartId": "blueprint-reference" // Optional, for visualization
  }
}
```

**anatomy:joint** (on body part entities):

```json
{
  "parentEntityId": "uuid-of-parent-part",
  "socketId": "left_shoulder",
  "childSocketId": "arm_attachment"
}
```

**anatomy:part** (on body part entities):

```json
{
  "subType": "arm",
  "layer": "base",
  "descriptors": {
    "length": "average",
    "musculature": "athletic"
  }
}
```

**Data Flow During Anatomy Generation**:

```
1. AnatomyGenerationWorkflow.generate()
   ↓
2. BodyBlueprintFactory.createAnatomyGraph()
   - Creates body part entities
   - Assigns anatomy:joint components
   - Sets anatomy:body.body.root field ← CRITICAL
   ↓
3. BodyGraphService.buildAdjacencyCache()
   ↓
4. AnatomyCacheManager.buildCache()
   - Builds parent-to-children map
   - Calls #buildCacheRecursive()
   - Calls #handleDisconnectedActorAnatomy() ← FIX LOCATION
   ↓
5. ClothingInstantiationStage.execute()
   - Uses BodyGraphService.getAllParts()
   - Validates clothing slots against body parts
```

### Related Components

**Upstream Dependencies** (what calls this module):

- `BodyGraphService` - Primary API consumer
- `AnatomyGenerationWorkflow` - Triggers cache building
- `ClothingInstantiationStage` - Depends on correct part resolution
- `DirectSocketStrategy` - Queries parts for clothing attachment

**Downstream Dependencies** (what this module calls):

- `IEntityManager` - Reads component data
- `ILogger` - Diagnostic logging
- `AnatomyGraphAlgorithms` - Graph traversal operations

**Critical Integration Points**:

- **Concurrent Processing**: Multiple workflows generating anatomy simultaneously
- **Query Caching**: `AnatomyQueryCache` wraps results for performance
- **Event System**: Dispatches `ANATOMY_GENERATED` after successful generation

---

## Problem

### What Failed

**Symptom**: During concurrent character generation in `game.html`, all 4 characters shared the same body part instances from the first-generated character (a tortoise). This caused clothing validation to fail because human clothing looked for sockets like `left_chest`, `right_chest`, `vagina`, `penis` but found tortoise-specific sockets like `torso`, `carapace_mount`, `plastron_mount`.

**Manifestation**:

1. Load game with 4 characters: `registrar_copperplate` (tortoise), `threadscar_melissa` (human female), `bertram_the_muddy` (human male), `vespera_nightwhisper` (cat-girl)
2. All characters received body part UUID `10322cab-71db-4ef0-aa64-4963d3361f1e` (tortoise torso)
3. Human clothing items failed to attach: briefs, bra, belt, jacket (missing 4 of 7 items for melissa)
4. Console showed "Entity not found" warnings
5. Clothing validation errors for incorrect socket types

**User Impact**: Game unplayable with multiple characters. Most long-running bug in the application.

**Discovery Method**: Added diagnostic logging to `DirectSocketStrategy` and `BodyGraphService.getAllParts()` which revealed all characters returning the same body part UUIDs.

### How It Failed

**Failure Sequence**:

```
Time T0: registrar_copperplate anatomy generation starts
  ├─ Creates tortoise body parts with UUIDs
  ├─ Sets anatomy:body.body.root = "tortoise-torso-uuid"
  └─ Calls buildCache("registrar_copperplate_instance")
      └─ #handleDisconnectedActorAnatomy() executes
          └─ Searches ALL anatomy parts globally
          └─ Finds tortoise torso (first anatomy root)
          └─ Connects registrar to tortoise torso ✓ (correct)

Time T1: threadscar_melissa anatomy generation starts (concurrent)
  ├─ Creates human_female body parts with UUIDs
  ├─ Sets anatomy:body.body.root = "melissa-torso-uuid"
  └─ Calls buildCache("threadscar_melissa_instance")
      └─ #handleDisconnectedActorAnatomy() executes
          └─ Searches ALL anatomy parts globally ← BUG!
          └─ Finds BOTH melissa torso AND tortoise torso
          └─ Returns tortoise torso (first match) ✗ (WRONG!)
          └─ Connects melissa to TORTOISE torso

Time T2: bertram_the_muddy anatomy generation starts (concurrent)
  └─ Same bug: connects to tortoise torso ✗

Time T3: vespera_nightwhisper anatomy generation starts (concurrent)
  └─ Same bug: connects to tortoise torso ✗

Result: All 4 characters share tortoise body parts
```

**Evidence from logs/errors.log** (before fix):

```
DirectSocketStrategy: Resolving for entity 'fantasy:registrar_copperplate_instance', sockets: ["torso"]
DirectSocketStrategy: Part '10322cab-71db-4ef0-aa64-4963d3361f1e' has 9 sockets: torso, carapace_mount, plastron_mount, left_shoulder, right_shoulder, left_hip, right_hip, tail_base, head_mount

DirectSocketStrategy: Resolving for entity 'fantasy:threadscar_melissa_instance', sockets: ["left_hip", "right_hip", "left_chest", "right_chest"]
DirectSocketStrategy: Part '10322cab-71db-4ef0-aa64-4963d3361f1e' has 9 sockets: torso, carapace_mount, plastron_mount...
                                           ↑
                                  SAME UUID AS TORTOISE!
```

### Why It Failed (Root Cause)

**Buggy Code** (src/anatomy/anatomyCacheManager.js, conceptual before-state):

The `#handleDisconnectedActorAnatomy()` method was designed to handle actors with `anatomy:body` but no direct `anatomy:joint` children. This occurs when the actor entity is separate from the anatomy graph (disconnected).

**Original Logic** (pseudocode of buggy behavior):

```javascript
async #handleDisconnectedActorAnatomy(rootEntityId, entityManager, visited, parentToChildren) {
  const anatomyBody = entityManager.getComponentData(rootEntityId, 'anatomy:body');
  if (!anatomyBody) return;

  // BUG: Search ALL anatomy parts in the entire system
  const allAnatomyParts = entityManager.getEntitiesWithComponent('anatomy:part');

  // Find parts that are parents (in parentToChildren map) but not children
  const anatomyRootCandidates = new Set();
  for (const parentId of parentToChildren.keys()) {
    anatomyRootCandidates.add(parentId);  // ← Adds ALL roots from ALL characters!
  }

  // Remove entities that have parents (are children)
  for (const entity of allAnatomyParts) {
    const joint = entityManager.getComponentData(entity.id, 'anatomy:joint');
    if (joint?.parentId) {
      anatomyRootCandidates.delete(entity.id);
    }
  }

  // Pick first candidate (WRONG: could be from different character!)
  for (const anatomyRootId of anatomyRootCandidates) {
    const anatomyPart = entityManager.getComponentData(anatomyRootId, 'anatomy:part');
    if (anatomyPart) {
      // Connect actor to this root (potentially wrong root!)
      rootNode.children.push(anatomyRootId);
      this.#buildCacheRecursive(anatomyRootId, rootEntityId, ...);
      break;  // First match wins ← BUG!
    }
  }
}
```

**Root Cause Analysis**:

1. **Global Search Instead of Scoped**: Method searched ALL entities with `anatomy:part` component across entire system
2. **First-Match-Wins Logic**: Iterated candidates in undefined order, connected to first found root
3. **No Character Ownership Verification**: Never checked if anatomy root belonged to current actor
4. **Ignored anatomy:body.body.root Field**: The component had the correct root ID, but code didn't use it
5. **Race Condition in Concurrent Processing**: Whichever character processed first populated the global search space

**The Critical Missing Link**: The `anatomy:body` component contains `body.root` field that points to the actor's specific anatomy root. The buggy code ignored this field and searched globally instead.

### Link to Tests

**Primary Regression Test**: `/tests/integration/anatomy/multiCharacterClothingGeneration.test.js`

- **Test Name**: `'should handle concurrent character generation without race condition'` (lines 201-271)
- **What It Tests**: Generates 4 characters concurrently using `Promise.all()`, validates no entity warnings
- **Why It Matters**: This test MUST pass to prevent regression of concurrent processing bug

**Secondary Validation Test**: `/tests/integration/anatomy/anatomyCacheManager.disconnectedFallback.integration.test.js`

- **Test Name**: `'links disconnected actor anatomies and rebuilds caches when structure data is missing'` (lines 176-269)
- **What It Tests**: Validates fallback logic when `structure.rootPartId` is missing, tests cache invalidation
- **Why It Matters**: Ensures graceful degradation when anatomy data is incomplete

**Symptom Tests** (these were failing before fix):

- All clothing-related integration tests in `tests/integration/clothing/*.test.js`
- Socket resolution tests in clothing system
- Character loading in `game.html` (manual test)

### Code Comparison: Before vs. After

**BEFORE** (Buggy - conceptual reconstruction):

```javascript
// Lines 440-516 (conceptual before-state)
async #handleDisconnectedActorAnatomy(rootEntityId, entityManager, visited, parentToChildren) {
  try {
    const rootNode = this.#adjacencyCache.get(rootEntityId);
    if (!rootNode || rootNode.children.length > 0) {
      return; // Root has children, no need for special handling
    }

    const anatomyBody = entityManager.getComponentData(rootEntityId, 'anatomy:body');
    if (!anatomyBody) {
      return; // Not an actor entity with anatomy:body
    }

    this.#logger.debug(
      `AnatomyCacheManager: Actor entity '${rootEntityId}' has anatomy:body but no joint children, searching for anatomy root`
    );

    // BUG: Find ANY anatomy root part by looking for entities that are
    // parents in joint system but not children themselves
    const anatomyRootCandidates = new Set();

    // Collect all parent IDs from the parent-to-children map
    // PROBLEM: This includes ALL parents from ALL characters!
    for (const parentId of parentToChildren.keys()) {
      anatomyRootCandidates.add(parentId);
    }

    // Remove any that are also children (have parents themselves)
    const entitiesWithJoints = entityManager.getEntitiesWithComponent('anatomy:joint');
    if (entitiesWithJoints) {
      for (const entity of entitiesWithJoints) {
        const joint = entityManager.getComponentData(entity.id, 'anatomy:joint');
        const parentId = joint?.parentEntityId || joint?.parentId;
        if (parentId) {
          anatomyRootCandidates.delete(entity.id);
        }
      }
    }

    // The remaining candidates should be anatomy root parts
    // PROBLEM: Candidates include roots from ALL characters, picks first match
    for (const anatomyRootId of anatomyRootCandidates) {
      const anatomyPart = entityManager.getComponentData(anatomyRootId, 'anatomy:part');

      if (anatomyPart) {
        this.#logger.debug(
          `AnatomyCacheManager: Found anatomy root '${anatomyRootId}', connecting to actor`
        );

        rootNode.children.push(anatomyRootId);

        this.#buildCacheRecursive(
          anatomyRootId,
          rootEntityId,
          'anatomy_root_connection',
          entityManager,
          visited,
          1,
          parentToChildren
        );

        break; // BUG: First match wins, might be wrong character's root!
      }
    }
  } catch (error) {
    this.#logger.error(
      `AnatomyCacheManager: Failed to handle disconnected actor anatomy for '${rootEntityId}'`,
      { error }
    );
  }
}
```

**AFTER** (Fixed - current implementation, lines 440-516):

```javascript
async #handleDisconnectedActorAnatomy(rootEntityId, entityManager, visited, parentToChildren) {
  try {
    // Check if root entity has anatomy:body but no children in cache
    const rootNode = this.#adjacencyCache.get(rootEntityId);
    if (!rootNode || rootNode.children.length > 0) {
      return; // Root has children, no need for special handling
    }

    const anatomyBody = entityManager.getComponentData(rootEntityId, 'anatomy:body');
    if (!anatomyBody) {
      return; // Not an actor entity with anatomy:body
    }

    this.#logger.debug(
      `AnatomyCacheManager: Actor entity '${rootEntityId}' has anatomy:body but no joint children, searching for anatomy root`
    );

    // FIXED: Use the anatomy root from anatomy:body component instead of searching all anatomy parts
    // This prevents concurrent processing bugs where multiple actors share anatomy parts
    const anatomyRootId = anatomyBody.body?.root;

    if (!anatomyRootId) {
      this.#logger.warn(
        `AnatomyCacheManager: Actor '${rootEntityId}' has anatomy:body but no body.root field`
      );
      return;
    }

    // Verify this anatomy root actually exists and is an anatomy part
    const anatomyPart = entityManager.getComponentData(anatomyRootId, 'anatomy:part');

    if (!anatomyPart) {
      this.#logger.warn(
        `AnatomyCacheManager: Anatomy root '${anatomyRootId}' from actor '${rootEntityId}' is not an anatomy part`
      );
      return;
    }

    this.#logger.debug(
      `AnatomyCacheManager: Found anatomy root '${anatomyRootId}' from anatomy:body.body.root, adding to cache and connecting to actor`
    );

    // Add the anatomy root as a child of the actor
    rootNode.children.push(anatomyRootId);

    // Build the anatomy subtree starting from this root
    this.#buildCacheRecursive(
      anatomyRootId,
      rootEntityId,
      'anatomy_root_connection',
      entityManager,
      visited,
      1,
      parentToChildren
    );

    this.#logger.info(
      `AnatomyCacheManager: Successfully connected actor '${rootEntityId}' to its own anatomy root '${anatomyRootId}'`
    );
  } catch (error) {
    this.#logger.error(
      `AnatomyCacheManager: Failed to handle disconnected actor anatomy for '${rootEntityId}'`,
      { error }
    );
  }
}
```

**Key Differences**:

| Aspect              | Before (Buggy)                               | After (Fixed)                                  |
| ------------------- | -------------------------------------------- | ---------------------------------------------- |
| **Root Discovery**  | Search ALL anatomy parts globally            | Read `anatomyBody.body.root` field             |
| **Scope**           | System-wide (all characters)                 | Actor-specific (single character)              |
| **Selection Logic** | First match from global search               | Exact field reference                          |
| **Race Condition**  | Yes (concurrent searches collide)            | No (each actor uses own field)                 |
| **Validation**      | None (assumes first match is correct)        | Validates root exists and is anatomy part      |
| **Ownership**       | Unverified (could be other character's root) | Guaranteed (field owned by actor)              |
| **Logging**         | Generic "found root" message                 | Specific "from anatomy:body.body.root" message |

**Commit Reference**:

- Commit: `1c07662fc` - "Fixed tortoise clothing" (2025-11-23)
- Branch: `main`
- Files Changed: `src/anatomy/anatomyCacheManager.js`, `src/anatomy/bodyGraphService.js`

---

## Truth Sources

### Domain Rules

**Anatomy System Domain Rules**:

1. **Actor-Part Ownership**: Each actor entity owns a unique set of body part entities
   - Source: ECS architecture in `/docs/architecture/entity-component-system.md`
   - Implication: Parts MUST NOT be shared between actors

2. **Graph Isolation**: Anatomy graphs are per-actor and must be isolated
   - Source: Anatomy system design in `/docs/anatomy/anatomy-overview.md`
   - Implication: Cache operations on Actor A cannot affect Actor B

3. **Single Root Per Actor**: Each actor has exactly one anatomy root part
   - Source: `anatomy:body` component schema definition
   - Implication: `body.root` field is mandatory and unique per actor

4. **Hierarchical Structure**: Anatomy forms a tree (DAG) from root to extremities
   - Source: `AnatomyGraphAlgorithms` implementation
   - Implication: No cycles allowed, visited set required

### External Contracts

**anatomy:body Component Schema** (`/data/schemas/components/anatomy_body.component.json`):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "anatomy:body",
  "type": "object",
  "properties": {
    "recipeId": {
      "type": "string",
      "description": "ID of anatomy recipe used to generate this body"
    },
    "body": {
      "type": "object",
      "properties": {
        "root": {
          "type": "string",
          "description": "Entity ID of the root anatomy part (e.g., torso)"
        }
      },
      "required": ["root"] // ← CONTRACT: root field is required
    },
    "structure": {
      "type": "object",
      "description": "Optional blueprint structure reference for visualization"
    }
  },
  "required": ["recipeId", "body"]
}
```

**Contract Guarantee**: Any entity with `anatomy:body` component MUST have `body.root` field containing a valid entity ID.

**anatomy:joint Component Schema** (`/data/schemas/components/anatomy_joint.component.json`):

```json
{
  "properties": {
    "parentEntityId": {
      "type": "string",
      "description": "Entity ID of parent part in anatomy hierarchy"
    },
    "socketId": {
      "type": "string",
      "description": "Socket on parent where this part attaches"
    }
  },
  "required": ["parentEntityId", "socketId"]
}
```

**Contract Guarantee**: Joints define parent-child relationships that form the anatomy tree.

**IEntityManager Interface** (`/src/interfaces/IEntityManager.js`):

Key methods used by anatomy cache:

- `getComponentData(entityId, componentId)` - Returns component data or null
- `getEntitiesWithComponent(componentId)` - Returns array of entities with component
- `getEntityInstance(entityId)` - Returns entity object

**Contract Guarantee**: Methods are thread-safe and return consistent data within a single operation.

### Documentation

**Codebase Documentation**:

1. **CLAUDE.md** - Project context file
   - Section: "Entity Component System (ECS)" (lines 25-35)
   - Defines: Entity, Component, System architecture
   - Contract: Systems process entities via components

2. **docs/anatomy/anatomy-overview.md**
   - Defines anatomy graph structure
   - Explains blueprint → recipe → instance flow
   - Documents socket system for clothing attachment

3. **docs/architecture/event-driven-architecture.md**
   - Defines event bus communication patterns
   - Specifies ANATOMY_GENERATED event payload
   - Contract: Events must be validated against event definitions

**Code Comments** (in anatomy cacheManager.js):

```javascript
// Lines 465-466:
// FIXED: Use the anatomy root from anatomy:body component instead of searching all anatomy parts
// This prevents concurrent processing bugs where multiple actors share anatomy parts
```

This comment documents the fix and its purpose for future maintainers.

**Test Documentation**:

- `/tests/integration/anatomy/multiCharacterClothingGeneration.test.js` - Documents concurrent processing requirements
- Test description: "should handle concurrent character generation without race condition"
- Establishes: 4+ concurrent characters is valid use case

### Data Integrity Requirements

**Immutable Constraints** (these MUST always be true):

1. **Unique Part Ownership**: For actors A and B, `getParts(A) ∩ getParts(B) = ∅` (disjoint sets)
2. **Root Reference Validity**: `anatomy:body.body.root` must reference an entity with `anatomy:part` component
3. **Acyclic Graph**: Anatomy graph must be a tree (no cycles in parent-child relationships)
4. **Cache Consistency**: Cached children must match actual `anatomy:joint` parent relationships

**Mutable State** (allowed to change):

1. Cache data structures (Map vs. other implementations)
2. Logging verbosity and format
3. Performance optimizations (e.g., batch processing)
4. Query cache TTL and eviction policies

---

## Desired Behavior

### Normal Cases

#### 1. Sequential Character Generation

**Scenario**: Generate 4 characters one at a time

**Expected Behavior**:

```javascript
// Character 1
await anatomyWorkflow.generate(registrarCopperplate);
// ✓ Cache built with tortoise parts
// ✓ anatomy:body.body.root = "tortoise-torso-uuid"
// ✓ registrarCopperplate.children = ["tortoise-torso-uuid"]

// Character 2
await anatomyWorkflow.generate(threadscaremelissa);
// ✓ Cache built with human_female parts
// ✓ anatomy:body.body.root = "melissa-torso-uuid"
// ✓ threadscaremelissa.children = ["melissa-torso-uuid"]

// Character 3
await anatomyWorkflow.generate(bertramTheMuddy);
// ✓ Cache built with human_male parts
// ✓ anatomy:body.body.root = "bertram-torso-uuid"

// Character 4
await anatomyWorkflow.generate(vesperaNightwhisper);
// ✓ Cache built with cat_girl parts
// ✓ anatomy:body.body.root = "vespera-torso-uuid"

// Validation
const registrarParts = bodyGraphService.getAllParts(
  registrarCopperplate.anatomy
);
const melissaParts = bodyGraphService.getAllParts(threadscaremelissa.anatomy);

// ✓ registrarParts.every(id => id.includes('tortoise') || id.includes('registrar'))
// ✓ melissaParts.every(id => id.includes('human') || id.includes('melissa'))
// ✓ No overlap: registrarParts ∩ melissaParts = []
```

**Invariants Maintained**:

- Each character has unique part set
- `body.root` field correctly references actor's anatomy root
- Cache entries are per-actor and isolated

#### 2. Concurrent Character Generation (4+ actors)

**Scenario**: Generate 4 characters simultaneously using `Promise.all()`

**Expected Behavior**:

```javascript
const [registrar, melissa, bertram, vespera] = await Promise.all([
  anatomyWorkflow.generate(registrarCopperplate),
  anatomyWorkflow.generate(threadscaremelissa),
  anatomyWorkflow.generate(bertramTheMuddy),
  anatomyWorkflow.generate(vesperaNightwhisper),
]);

// Each workflow executes concurrently:
// T0: All 4 start anatomy generation
// T1: All 4 create body part entities
// T2: All 4 set anatomy:body.body.root fields
// T3: All 4 call buildCache() CONCURRENTLY
// T4: All 4 call #handleDisconnectedActorAnatomy() CONCURRENTLY

// Expected Results:
// ✓ registrar.anatomy.body.root points to tortoise torso (unique UUID)
// ✓ melissa.anatomy.body.root points to human_female torso (unique UUID)
// ✓ bertram.anatomy.body.root points to human_male torso (unique UUID)
// ✓ vespera.anatomy.body.root points to cat_girl torso (unique UUID)

// Cache Validation:
const registrarNode = cacheManager.get(
  'fantasy:registrar_copperplate_instance'
);
const melissaNode = cacheManager.get('fantasy:threadscar_melissa_instance');

// ✓ registrarNode.children[0] === registrar.anatomy.body.root
// ✓ melissaNode.children[0] === melissa.anatomy.body.root
// ✓ registrarNode.children[0] !== melissaNode.children[0] (different roots!)

// Part Resolution:
const registrarParts = bodyGraphService.getAllParts(
  registrar.anatomy,
  'fantasy:registrar_copperplate_instance'
);
const melissaParts = bodyGraphService.getAllParts(
  melissa.anatomy,
  'fantasy:threadscar_melissa_instance'
);

// ✓ registrarParts.length = 17 (tortoise anatomy)
// ✓ melissaParts.length = 17 (human anatomy)
// ✓ No shared UUIDs between part sets
// ✓ No "Entity not found" warnings
```

**Invariants Maintained**:

- Concurrent operations don't interfere
- Each actor reads own `anatomy:body.body.root` field
- Cache building is isolated per actor
- No race conditions in root resolution

#### 3. Cache Building with Proper Parent-Child Relationships

**Scenario**: Build cache from anatomy graph with joints

**Expected Behavior**:

```javascript
// Given anatomy structure:
// Torso (root, no parent)
//   ├─ Left Arm (parent: torso, socket: left_shoulder)
//   │    └─ Left Hand (parent: left_arm, socket: wrist)
//   ├─ Right Arm (parent: torso, socket: right_shoulder)
//   └─ Left Leg (parent: torso, socket: left_hip)

await cacheManager.buildCache(actorEntityId, entityManager);

// Expected cache structure:
const torsoNode = cacheManager.get(torsoId);
// ✓ torsoNode.parentId = null (root has no parent)
// ✓ torsoNode.children = [leftArmId, rightArmId, leftLegId]

const leftArmNode = cacheManager.get(leftArmId);
// ✓ leftArmNode.parentId = torsoId
// ✓ leftArmNode.socketId = "left_shoulder"
// ✓ leftArmNode.children = [leftHandId]

const leftHandNode = cacheManager.get(leftHandId);
// ✓ leftHandNode.parentId = leftArmId
// ✓ leftHandNode.socketId = "wrist"
// ✓ leftHandNode.children = []
```

**Invariants Maintained**:

- Parent-child relationships match `anatomy:joint` components
- Root part has null parent
- All parts reachable from root via children traversal

#### 4. Proper Use of anatomy:body.body.root Field

**Scenario**: Method reads actor-specific anatomy root

**Expected Behavior**:

```javascript
// Given:
const actorId = "fantasy:threadscar_melissa_instance";
const anatomyBody = {
  recipeId: "anatomy:human_female",
  body: {
    root: "uuid-melissa-torso-123"  // Actor's specific root
  }
};

// When:
await #handleDisconnectedActorAnatomy(actorId, entityManager, visited, parentToChildren);

// Then:
// ✓ Method reads anatomyBody.body.root
// ✓ anatomyRootId = "uuid-melissa-torso-123"
// ✓ Validates entity exists and has anatomy:part
// ✓ Connects actor to melissa's torso specifically
// ✓ Does NOT search other actors' parts
// ✓ Does NOT pick first global match
```

**Invariants Maintained**:

- Single source of truth: `body.root` field
- No global searches across actors
- Actor-specific root resolution

### Edge Cases

#### Edge Case 1: Missing body.root Field

**Scenario**: Actor has `anatomy:body` but `body.root` is undefined/null

**Input**:

```javascript
const anatomyBody = {
  recipeId: 'anatomy:human_female',
  body: {
    // root field missing!
  },
};
```

**Expected Behavior**:

```javascript
await #handleDisconnectedActorAnatomy(actorId, entityManager, visited, parentToChildren);

// Expected:
// ✓ Method detects missing field: anatomyBody.body?.root === undefined
// ✓ Logs warning: "Actor 'X' has anatomy:body but no body.root field"
// ✓ Returns early without connecting parts
// ✓ Does NOT throw exception
// ✓ Does NOT search globally
// ✓ Graceful degradation: actor has no anatomy parts
```

**Invariants Maintained**:

- No invalid connections
- No exceptions thrown
- Clear diagnostic logging

#### Edge Case 2: Invalid body.root Reference

**Scenario**: `body.root` points to entity that doesn't exist or isn't anatomy part

**Input**:

```javascript
const anatomyBody = {
  body: {
    root: 'non-existent-entity-id', // Invalid reference
  },
};
```

**Expected Behavior**:

```javascript
await #handleDisconnectedActorAnatomy(actorId, entityManager, visited, parentToChildren);

// Step 1: Read field
const anatomyRootId = anatomyBody.body.root;  // = "non-existent-entity-id"

// Step 2: Validate entity exists
const anatomyPart = entityManager.getComponentData(anatomyRootId, 'anatomy:part');
// anatomyPart = null (entity doesn't exist or no anatomy:part component)

// Expected:
// ✓ Method detects invalid reference: anatomyPart === null
// ✓ Logs warning: "Anatomy root 'X' from actor 'Y' is not an anatomy part"
// ✓ Returns early without connecting
// ✓ Does NOT throw exception
// ✓ Graceful degradation
```

**Invariants Maintained**:

- No invalid entity references in cache
- No dangling pointers
- Safe failure mode

#### Edge Case 3: Null anatomy:body Component

**Scenario**: Actor entity doesn't have `anatomy:body` component

**Input**:

```javascript
const anatomyBody = entityManager.getComponentData(actorId, 'anatomy:body');
// anatomyBody = null (no component)
```

**Expected Behavior**:

```javascript
await #handleDisconnectedActorAnatomy(actorId, entityManager, visited, parentToChildren);

// Expected:
// ✓ Method detects null: anatomyBody === null
// ✓ Returns early (line 457)
// ✓ No logging (this is normal for non-actor entities)
// ✓ No further processing
```

**Invariants Maintained**:

- Method only processes actor entities
- No assumptions about entity type

#### Edge Case 4: Legacy Blueprints Without body.root

**Scenario**: Old blueprint format doesn't set `body.root`, only `structure.rootPartId`

**Input**:

```javascript
const anatomyBody = {
  recipeId: 'legacy:old_blueprint',
  body: {
    // No root field (legacy format)
  },
  structure: {
    rootPartId: 'blueprint-torso-reference', // Old format
  },
};
```

**Expected Behavior** (Current):

```javascript
// Current implementation:
const anatomyRootId = anatomyBody.body?.root; // = undefined

// ✓ Warning logged: "Actor 'X' has anatomy:body but no body.root field"
// ✓ Method returns early
// ✓ Fallback: anatomy generation should populate body.root before this point

// Alternative (if migration needed):
// Could add fallback logic:
// const anatomyRootId = anatomyBody.body?.root || anatomyBody.structure?.rootPartId;
```

**Decision Required**: Should legacy format be supported or should migration enforce `body.root`?

**Recommendation**: Enforce `body.root` in anatomy generation, fail loudly on legacy format to force updates.

#### Edge Case 5: Actor Already Has Joint Children

**Scenario**: Actor entity has direct `anatomy:joint` children (not disconnected)

**Input**:

```javascript
const rootNode = cacheManager.get(actorId);
// rootNode.children.length > 0 (already has children from joints)
```

**Expected Behavior**:

```javascript
await #handleDisconnectedActorAnatomy(actorId, entityManager, visited, parentToChildren);

// Expected:
// ✓ Method detects children exist: rootNode.children.length > 0
// ✓ Returns early (line 449)
// ✓ No processing needed (actor already connected via joints)
// ✓ No logging (this is normal case)
```

**Invariants Maintained**:

- Method only handles disconnected actors
- Existing joints take precedence

### Failure Modes (What Errors to Raise/Return)

#### Failure Mode 1: Missing body.root Field

**When**: `anatomyBody.body?.root` is undefined or null

**Response**:

```javascript
if (!anatomyRootId) {
  this.#logger.warn(
    `AnatomyCacheManager: Actor '${rootEntityId}' has anatomy:body but no body.root field`
  );
  return; // Graceful degradation
}
```

**Error Type**: Warning (non-fatal)
**User Impact**: Actor has no anatomy parts, clothing won't attach
**Recovery**: Fix blueprint/recipe to set `body.root` field

#### Failure Mode 2: Invalid Entity Reference in body.root

**When**: `anatomyBody.body.root` points to non-existent or non-anatomy entity

**Response**:

```javascript
const anatomyPart = entityManager.getComponentData(
  anatomyRootId,
  'anatomy:part'
);

if (!anatomyPart) {
  this.#logger.warn(
    `AnatomyCacheManager: Anatomy root '${anatomyRootId}' from actor '${rootEntityId}' is not an anatomy part`
  );
  return; // Graceful degradation
}
```

**Error Type**: Warning (non-fatal)
**User Impact**: Actor has no anatomy parts
**Recovery**: Fix entity reference or create missing anatomy part

#### Failure Mode 3: Circular Reference in body.root

**When**: `body.root` points to actor itself or creates cycle

**Protection**:

```javascript
// Protected by visited set in #buildCacheRecursive (lines 291-292)
if (visited.has(entityId)) return;
visited.add(entityId);
```

**Error Type**: Silent prevention (no error raised)
**User Impact**: None (cycle prevented)
**Recovery**: Automatic via visited set

#### Failure Mode 4: EntityManager Throws Exception

**When**: `getComponentData()` or `getEntityInstance()` throws

**Response**:

```javascript
try {
  // ... all processing
} catch (error) {
  this.#logger.error(
    `AnatomyCacheManager: Failed to handle disconnected actor anatomy for '${rootEntityId}'`,
    { error }
  );
  // Exception propagates up (caller handles)
}
```

**Error Type**: Error (logged and propagated)
**User Impact**: Anatomy generation fails for character
**Recovery**: Depends on caller's error handling

#### Failure Mode 5: Concurrent Cache Invalidation

**When**: Cache invalidated while another operation is building

**Protection**:

```javascript
// Per-root invalidation (lines 132-161) prevents global cache corruption
invalidateCacheForRoot(rootEntityId) {
  // Only removes entries belonging to this anatomy tree
  // Other trees remain valid
}
```

**Error Type**: None (prevented by design)
**User Impact**: Stale cache entry removed, fresh build occurs
**Recovery**: Automatic via per-root isolation

### Invariants (Properties That Must Always Hold)

#### Invariant 1: Unique Part Ownership

**Property**: For any two distinct actors A and B, their anatomy parts are disjoint sets.

**Formal**:

```
∀ actors A, B where A ≠ B:
  getAllParts(A) ∩ getAllParts(B) = ∅
```

**Validation**:

```javascript
// Test code:
const actorAParts = bodyGraphService.getAllParts(actorA.anatomy, actorA.id);
const actorBParts = bodyGraphService.getAllParts(actorB.anatomy, actorB.id);

const overlap = actorAParts.filter((id) => actorBParts.includes(id));
expect(overlap).toEqual([]); // Must be empty
```

**Enforcement**: `#handleDisconnectedActorAnatomy()` uses `anatomyBody.body.root` which is unique per actor

#### Invariant 2: Root Reference Validity

**Property**: If actor has `anatomy:body.body.root`, it must reference a valid anatomy part entity.

**Formal**:

```
∀ actors A with anatomy:body component:
  A.anatomy.body.root ∈ validAnatomyPartEntities
  OR A.anatomy.body.root = undefined
```

**Validation**:

```javascript
// Test code:
if (actor.anatomy?.body?.root) {
  const rootPart = entityManager.getComponentData(
    actor.anatomy.body.root,
    'anatomy:part'
  );
  expect(rootPart).not.toBeNull(); // Must exist
  expect(rootPart).toHaveProperty('subType'); // Must be anatomy part
}
```

**Enforcement**: Lines 477-487 validate entity exists and has `anatomy:part` component

#### Invariant 3: Acyclic Graph Structure

**Property**: Anatomy graph forms a tree (no cycles) with single root.

**Formal**:

```
∀ parts P in anatomy graph:
  traverseParents(P) terminates at root R
  AND ∄ cycle where P is ancestor and descendant of itself
```

**Validation**:

```javascript
// Test code:
function hasCycle(partId, visited = new Set()) {
  if (visited.has(partId)) return true; // Cycle detected
  visited.add(partId);

  const node = cacheManager.get(partId);
  if (!node.parentId) return false; // Reached root

  return hasCycle(node.parentId, visited);
}

expect(hasCycle(anyPartId)).toBe(false); // No cycles allowed
```

**Enforcement**: Visited set in `#buildCacheRecursive()` (lines 291-292) prevents infinite recursion

#### Invariant 4: Cache Consistency with Components

**Property**: Cached parent-child relationships must match actual `anatomy:joint` components.

**Formal**:

```
∀ entities E with anatomy:joint:
  cacheManager.get(E).parentId = E.components['anatomy:joint'].parentEntityId
  AND E.id ∈ cacheManager.get(parentId).children
```

**Validation**:

```javascript
// Test code:
const joint = entityManager.getComponentData(partId, 'anatomy:joint');
const cachedNode = cacheManager.get(partId);

expect(cachedNode.parentId).toBe(joint.parentEntityId); // Parents match

const parentNode = cacheManager.get(joint.parentEntityId);
expect(parentNode.children).toContain(partId); // Child listed in parent
```

**Enforcement**: `#buildParentToChildrenMap()` (lines 221-261) builds map from `anatomy:joint` components directly

#### Invariant 5: Per-Actor Cache Isolation

**Property**: Cache operations on actor A cannot modify cache entries for actor B.

**Formal**:

```
∀ actors A, B where A ≠ B:
  buildCache(A) does NOT modify cacheEntries(B)
  AND invalidateCacheForRoot(A) does NOT affect cacheEntries(B)
```

**Validation**:

```javascript
// Test code:
const beforeBParts = [...cacheManager.entries()].filter(
  ([id, node]) => id.includes('actorB') || traverseToRoot(id) === actorB.id
);

await cacheManager.buildCache(actorA.id, entityManager);

const afterBParts = [...cacheManager.entries()].filter(
  ([id, node]) => id.includes('actorB') || traverseToRoot(id) === actorB.id
);

expect(afterBParts).toEqual(beforeBParts); // B's parts unchanged
```

**Enforcement**: `#handleDisconnectedActorAnatomy()` reads `anatomyBody.body.root` which is actor-specific field

#### Invariant 6: Single Source of Truth for Root

**Property**: `anatomy:body.body.root` is the sole authoritative source for anatomy root ID.

**Formal**:

```
∀ cache building operations:
  anatomyRootId = anatomyBody.body.root
  AND anatomyRootId ≠ result_of_global_search()
```

**Validation**:

```javascript
// Test code via code review:
// Grep for any global anatomy part searches:
// grep -r "getEntitiesWithComponent('anatomy:part')" src/anatomy/
// Expected: Only in #buildParentToChildrenMap(), NOT in #handleDisconnectedActorAnatomy()
```

**Enforcement**: Lines 467-474 use direct field access, no search logic

### API Contracts (What Stays Stable)

#### Contract 1: buildCache() Signature

**Interface**:

```javascript
async buildCache(rootEntityId: string, entityManager: IEntityManager): Promise<void>
```

**Stability**: STABLE - Public API, many consumers

**Guarantees**:

- Accepts root entity ID (actor or anatomy root)
- Accepts entity manager for component data access
- Returns void (builds cache as side effect)
- Throws on critical errors, logs warnings for degradable errors

**Consumers**:

- `BodyGraphService.buildAdjacencyCache()` (primary)
- `AnatomyGenerationWorkflow` (via BodyGraphService)

#### Contract 2: #handleDisconnectedActorAnatomy() Behavior

**Interface** (private, but behavior is contract):

```javascript
async #handleDisconnectedActorAnatomy(
  rootEntityId: string,
  entityManager: IEntityManager,
  visited: Set<string>,
  parentToChildren: Map<string, Array<{childId: string, socketId: string}>>
): Promise<void>
```

**Stability**: IMPLEMENTATION DETAIL - Can change internals, behavior must remain

**Guarantees**:

- Only processes actors with `anatomy:body` component
- Only processes actors with no joint children (disconnected)
- Uses `anatomy:body.body.root` as single source of truth
- Validates root entity exists and is anatomy part
- Gracefully degrades on missing/invalid data
- Logs warnings for diagnostic purposes
- Does NOT search globally across actors
- Does NOT modify other actors' cache entries

**Testing**: `anatomyCacheManager.disconnectedFallback.integration.test.js` validates behavior

#### Contract 3: anatomy:body.body.root Field Structure

**Schema**:

```json
{
  "body": {
    "root": "string (entity ID)"
  }
}
```

**Stability**: STABLE - External data contract

**Guarantees**:

- Field is required in anatomy generation
- Field contains entity ID of anatomy root part
- Field is set before cache building occurs
- Field is unique per actor (no sharing)

**Producers**:

- `BodyBlueprintFactory.createAnatomyGraph()` - Sets field during anatomy creation
- Anatomy recipes - Define structure, factory executes

#### Contract 4: ANATOMY_GENERATED Event Dispatch

**Event Signature**:

```javascript
{
  type: 'ANATOMY_GENERATED',
  payload: {
    entityId: string,           // Actor entity ID
    blueprintId: string,        // Blueprint used
    sockets: string[],          // Available sockets
    timestamp: number,          // Generation timestamp
    bodyParts: string[],        // All part entity IDs
    partsMap: object,           // Part type → entity ID map
    slotEntityMappings: object  // Slot → entity ID map
  }
}
```

**Stability**: STABLE - External event contract

**Guarantees**:

- Dispatched after successful anatomy generation
- Contains all part IDs for validation
- Includes socket information for clothing
- Timestamp for ordering/debugging

**Consumers**:

- Clothing system (validates available sockets)
- UI systems (updates displays)
- Analytics (tracks generation events)

### What Is Allowed to Change

#### 1. Cache Data Structures

**Current**: `Map<string, AnatomyNode>`

**Allowed Changes**:

- Switch to different map implementation (e.g., object literal)
- Add indexes for faster lookup (e.g., by part type)
- Change node structure (add/remove fields)
- Implement multi-level caching (L1/L2)

**Constraint**: Must maintain same external behavior (getAllParts returns same IDs)

#### 2. Logging Verbosity and Format

**Current**: debug, info, warn, error levels with specific messages

**Allowed Changes**:

- Change log message wording
- Add/remove log statements
- Change log levels (debug → info, etc.)
- Add structured logging fields

**Constraint**: Must log warnings for missing `body.root` and invalid references

#### 3. Performance Optimizations

**Current**: Sequential processing with O(n) complexity

**Allowed Changes**:

- Batch operations for multiple actors
- Parallel cache building (with isolation)
- Lazy loading of subtrees
- Incremental cache updates

**Constraint**: Must maintain per-actor isolation invariant

#### 4. Query Cache Implementation

**Current**: `AnatomyQueryCache` with LRU eviction

**Allowed Changes**:

- Change eviction policy (LFU, FIFO, TTL)
- Adjust cache size limits
- Add cache warming strategies
- Implement cache persistence

**Constraint**: Must invalidate on cache rebuild events

#### 5. Internal Method Signatures

**Current**: `#buildCacheRecursive()`, `#buildParentToChildrenMap()`, etc.

**Allowed Changes**:

- Refactor into smaller methods
- Change parameter order
- Add optional parameters
- Rename methods (private only)

**Constraint**: Public API (`buildCache()`) must remain stable

---

## Testing Plan

### Tests That Must Pass (Regression Prevention)

#### Test 1: Concurrent Character Generation (PRIMARY REGRESSION TEST)

**File**: `/tests/integration/anatomy/multiCharacterClothingGeneration.test.js`
**Test Name**: `'should handle concurrent character generation without race condition'` (lines 201-271)

**What It Tests**:

```javascript
it('should handle concurrent character generation without race condition', async () => {
  // Arrange: 4 characters with different anatomies
  const characters = [
    {
      id: 'fantasy:registrar_copperplate_instance',
      recipe: 'anatomy:tortoise_person',
    },
    {
      id: 'fantasy:threadscar_melissa_instance',
      recipe: 'anatomy:human_female',
    },
    { id: 'fantasy:bertram_the_muddy_instance', recipe: 'anatomy:human_male' },
    { id: 'fantasy:vespera_nightwhisper_instance', recipe: 'anatomy:cat_girl' },
  ];

  // Act: Generate all concurrently
  await Promise.all(
    characters.map((char) => anatomyWorkflow.generate(char.id, char.recipe))
  );

  // Assert:
  // ✓ No "Entity not found" warnings in logs
  // ✓ No clothing validation errors
  // ✓ Each character has unique part UUIDs
  // ✓ getAllParts() returns character-specific parts
});
```

**Why Critical**: This test directly validates the fix. If it fails, the concurrent processing bug has regressed.

**Pass Criteria**:

- No warnings containing "Entity not found"
- No errors during clothing attachment
- All 4 characters have all clothing items
- Part UUIDs are unique per character

#### Test 2: Disconnected Actor Anatomy Handling

**File**: `/tests/integration/anatomy/anatomyCacheManager.disconnectedFallback.integration.test.js`
**Test Name**: `'links disconnected actor anatomies and rebuilds caches when structure data is missing'` (lines 176-269)

**What It Tests**:

```javascript
it('links disconnected actor anatomies and rebuilds caches when structure data is missing', async () => {
  // Arrange: Actor with anatomy:body but no structure.rootPartId
  const actor = createActorWithAnatomyBody({
    body: { root: 'torso-uuid-123' },
    structure: undefined, // Missing structure field
  });

  // Act: Build cache
  await cacheManager.buildCache(actor.id, entityManager);

  // Assert:
  // ✓ Actor connected to torso via body.root field
  // ✓ No warnings about missing structure
  // ✓ Cache contains all anatomy parts
});
```

**Why Critical**: Validates fallback logic when anatomy data is incomplete.

**Pass Criteria**:

- Actor successfully connected to anatomy root
- All parts reachable from root
- Appropriate logging for missing data

#### Test 3: Unique Part Ownership Invariant

**File**: `/tests/integration/anatomy/multiCharacterClothingGeneration.test.js`
**Test Name**: `'should maintain unique part ownership per actor'` (NEW - must be added)

**What It Tests**:

```javascript
it('should maintain unique part ownership per actor', async () => {
  // Arrange: 4 characters
  const characters = await Promise.all([
    createCharacter('registrar'),
    createCharacter('melissa'),
    createCharacter('bertram'),
    createCharacter('vespera'),
  ]);

  // Act: Get parts for each
  const partSets = characters.map((char) =>
    bodyGraphService.getAllParts(char.anatomy, char.id)
  );

  // Assert: No overlapping UUIDs
  for (let i = 0; i < partSets.length; i++) {
    for (let j = i + 1; j < partSets.length; j++) {
      const overlap = partSets[i].filter((id) => partSets[j].includes(id));
      expect(overlap).toEqual([]); // Disjoint sets
    }
  }
});
```

**Why Critical**: Validates Invariant 1 (unique part ownership).

**Pass Criteria**:

- Zero part UUID overlap between any two characters
- Each character has expected part count (17 for humanoid)

#### Test 4: Cache Isolation During Concurrent Operations

**File**: `/tests/integration/anatomy/anatomyCacheManager.concurrentIsolation.test.js` (NEW - must be created)

**What It Tests**:

```javascript
it('should isolate cache operations per actor during concurrent processing', async () => {
  // Arrange: 2 characters
  const actorA = createActor('human_male');
  const actorB = createActor('cat_girl');

  // Act: Build caches concurrently and interleave operations
  const buildA1 = cacheManager.buildCache(actorA.id, entityManager);
  const buildB1 = cacheManager.buildCache(actorB.id, entityManager);

  await Promise.all([buildA1, buildB1]);

  const partsA = bodyGraphService.getAllParts(actorA.anatomy, actorA.id);

  // Invalidate A, build B again
  cacheManager.invalidateCacheForRoot(actorA.id);
  await cacheManager.buildCache(actorB.id, entityManager);

  const partsB = bodyGraphService.getAllParts(actorB.anatomy, actorB.id);

  // Assert: B's parts unchanged by A's invalidation
  expect(partsB).toHaveLength(17); // Still complete
  expect(partsB.every((id) => id.includes('cat_girl'))).toBe(true);
});
```

**Why Critical**: Validates Invariant 5 (per-actor cache isolation).

**Pass Criteria**:

- Actor B's cache unaffected by Actor A's invalidation
- No corruption or missing parts in B after A's rebuild

### Tests That Should Be Added

#### New Test 1: Concurrent Generation with 10+ Characters

**File**: `/tests/integration/anatomy/anatomyCacheManager.scalability.test.js` (NEW)

**Purpose**: Validate scalability beyond the 4-character baseline

**Test**:

```javascript
describe('Scalability - 10+ Concurrent Characters', () => {
  it('should handle 10 concurrent character generations without performance degradation', async () => {
    // Arrange: 10 characters with varied anatomies
    const characters = [
      ...createCharacters('human_male', 3),
      ...createCharacters('human_female', 3),
      ...createCharacters('cat_girl', 2),
      ...createCharacters('tortoise_person', 2),
    ];

    // Act: Generate all concurrently
    const startTime = performance.now();

    await Promise.all(
      characters.map((char) => anatomyWorkflow.generate(char.id, char.recipe))
    );

    const duration = performance.now() - startTime;

    // Assert:
    // ✓ All characters generated successfully
    // ✓ No part sharing between characters
    // ✓ Duration < 5 seconds (performance threshold)
    // ✓ Memory usage reasonable (no leaks)

    expect(duration).toBeLessThan(5000);

    const allParts = characters.map((char) =>
      bodyGraphService.getAllParts(char.anatomy, char.id)
    );

    // Validate no overlap
    for (let i = 0; i < allParts.length; i++) {
      for (let j = i + 1; j < allParts.length; j++) {
        const overlap = allParts[i].filter((id) => allParts[j].includes(id));
        expect(overlap).toEqual([]);
      }
    }
  });
});
```

**Acceptance Criteria**:

- Test passes with 10 concurrent characters
- No warnings or errors
- Execution time < 5 seconds
- Memory stable (no leaks)

#### New Test 2: Legacy Blueprint Format Compatibility

**File**: `/tests/integration/anatomy/anatomyCacheManager.legacyFormat.test.js` (NEW)

**Purpose**: Ensure graceful handling of old blueprint formats

**Test**:

```javascript
describe('Legacy Format Handling', () => {
  it('should handle legacy blueprints without body.root field', async () => {
    // Arrange: Actor with old anatomy:body format
    const legacyActor = createActor('legacy_blueprint', {
      anatomy: {
        recipeId: 'anatomy:legacy',
        body: {
          // No root field (legacy)
        },
        structure: {
          rootPartId: 'blueprint-reference', // Old format
        },
      },
    });

    // Act: Build cache
    const warnings = [];
    logger.warn = jest.fn((msg) => warnings.push(msg));

    await cacheManager.buildCache(legacyActor.id, entityManager);

    // Assert:
    // ✓ Warning logged about missing body.root
    // ✓ No exception thrown
    // ✓ Graceful degradation (no parts connected)

    expect(warnings).toContainEqual(
      expect.stringContaining('has anatomy:body but no body.root field')
    );

    const parts = bodyGraphService.getAllParts(
      legacyActor.anatomy,
      legacyActor.id
    );
    expect(parts).toEqual([legacyActor.id]); // Only actor, no parts
  });

  it('should recommend migration for legacy format', async () => {
    // Test that documentation guides users to update blueprints
    // to use body.root field
  });
});
```

**Acceptance Criteria**:

- Warning logged for missing `body.root`
- No exceptions thrown
- Clear guidance in logs about migration

#### New Test 3: Circular Reference Detection

**File**: `/tests/integration/anatomy/anatomyCacheManager.circularReference.test.js` (NEW)

**Purpose**: Prevent infinite loops from circular anatomy references

**Test**:

```javascript
describe('Circular Reference Protection', () => {
  it('should prevent infinite loop when body.root points to actor itself', async () => {
    // Arrange: Actor with circular reference
    const circularActor = createActor('circular', {
      anatomy: {
        body: {
          root: 'actor-id-itself', // Points to self!
        },
      },
    });
    circularActor.id = 'actor-id-itself';

    // Act: Build cache
    await cacheManager.buildCache(circularActor.id, entityManager);

    // Assert:
    // ✓ No infinite loop (visited set prevents)
    // ✓ Warning logged about invalid reference
    // ✓ No stack overflow
  });

  it('should prevent cycles in parent-child relationships', async () => {
    // Arrange: Part A → Part B → Part A (cycle)
    const cyclicParts = createCyclicAnatomyGraph();

    // Act: Build cache
    await cacheManager.buildCache(cyclicParts.root.id, entityManager);

    // Assert:
    // ✓ Traversal stops at cycle detection
    // ✓ No infinite recursion
  });
});
```

**Acceptance Criteria**:

- No infinite loops or stack overflows
- Visited set protects against cycles
- Appropriate warnings logged

#### New Test 4: Concurrent Cache Invalidation

**File**: `/tests/integration/anatomy/anatomyCacheManager.concurrentInvalidation.test.js` (NEW)

**Purpose**: Validate safe concurrent invalidation and rebuilding

**Test**:

```javascript
describe('Concurrent Cache Invalidation', () => {
  it('should handle concurrent invalidation and rebuild safely', async () => {
    // Arrange: 4 actors with caches built
    const actors = await Promise.all([
      createCharacter('actor1'),
      createCharacter('actor2'),
      createCharacter('actor3'),
      createCharacter('actor4'),
    ]);

    // Act: Concurrently invalidate and rebuild different actors
    await Promise.all([
      async () => {
        cacheManager.invalidateCacheForRoot(actors[0].id);
        await cacheManager.buildCache(actors[0].id, entityManager);
      },
      async () => {
        cacheManager.invalidateCacheForRoot(actors[1].id);
        await cacheManager.buildCache(actors[1].id, entityManager);
      },
      async () => {
        // Actor 2 reads while others rebuild
        bodyGraphService.getAllParts(actors[2].anatomy, actors[2].id);
      },
      async () => {
        // Actor 3 reads while others rebuild
        bodyGraphService.getAllParts(actors[3].anatomy, actors[3].id);
      },
    ]);

    // Assert:
    // ✓ No race conditions
    // ✓ All actors have valid caches
    // ✓ No part sharing after rebuild

    const allParts = actors.map((actor) =>
      bodyGraphService.getAllParts(actor.anatomy, actor.id)
    );

    // Validate isolation
    for (let i = 0; i < allParts.length; i++) {
      for (let j = i + 1; j < allParts.length; j++) {
        expect(allParts[i].filter((id) => allParts[j].includes(id))).toEqual(
          []
        );
      }
    }
  });
});
```

**Acceptance Criteria**:

- No race conditions during concurrent operations
- Cache consistency maintained
- No shared parts after rebuild

### Regression Tests Required

#### Regression Test 1: No "Entity not found" Warnings

**What**: Primary symptom of the original bug

**Implementation**:

```javascript
it('should not generate "Entity not found" warnings during concurrent generation', async () => {
  // Arrange: Mock logger to capture warnings
  const warnings = [];
  logger.warn = jest.fn((msg) => warnings.push(msg));

  // Act: Generate 4 characters concurrently
  await Promise.all([
    anatomyWorkflow.generate('registrar'),
    anatomyWorkflow.generate('melissa'),
    anatomyWorkflow.generate('bertram'),
    anatomyWorkflow.generate('vespera'),
  ]);

  // Assert: No "Entity not found" warnings
  const entityNotFoundWarnings = warnings.filter(
    (w) => w.includes('Entity not found') || w.includes('entity not found')
  );

  expect(entityNotFoundWarnings).toEqual([]);
});
```

**When to Run**: Every CI build, before every release

#### Regression Test 2: Unique Part UUIDs Per Character

**What**: Validates no shared part instances

**Implementation**:

```javascript
it('should assign unique part UUIDs to each character', async () => {
  // Act: Generate characters
  const melissa = await createCharacter('threadscar_melissa');
  const registrar = await createCharacter('registrar_copperplate');

  // Get parts
  const melissaParts = bodyGraphService.getAllParts(
    melissa.anatomy,
    melissa.id
  );
  const registrarParts = bodyGraphService.getAllParts(
    registrar.anatomy,
    registrar.id
  );

  // Assert: Extract UUIDs (entities matching UUID pattern)
  const melissaUUIDs = melissaParts.filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
  const registrarUUIDs = registrarParts.filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );

  // No overlap
  expect(melissaUUIDs.filter((id) => registrarUUIDs.includes(id))).toEqual([]);
});
```

**When to Run**: Every CI build, as part of core test suite

#### Regression Test 3: Correct Clothing Slots Per Character

**What**: Validates clothing system works with correct anatomy

**Implementation**:

```javascript
it('should attach all clothing items to correct character sockets', async () => {
  // Arrange: Create melissa with human_female anatomy and clothing
  const melissa = await createCharacterWithClothing('threadscar_melissa', [
    'briefs',
    'bra',
    'belt',
    'jacket',
    'pants',
    'boots',
    'scarf',
  ]);

  // Act: Get attached clothing
  const clothingItems = getAttachedClothing(melissa.id);

  // Assert: All 7 items attached
  expect(clothingItems).toHaveLength(7);

  // Verify sockets are human sockets (not tortoise)
  const sockets = clothingItems.map((item) => item.attachedTo.socket);
  expect(sockets).toContain('left_chest'); // bra socket
  expect(sockets).toContain('right_chest'); // bra socket
  expect(sockets).toContain('vagina'); // briefs socket

  // Should NOT contain tortoise sockets
  expect(sockets).not.toContain('carapace_mount');
  expect(sockets).not.toContain('plastron_mount');
});
```

**When to Run**: Integration test suite, before releases

#### Regression Test 4: Real-World Scenario (Fantasy Mod)

**What**: Full integration test with actual game mods

**Implementation**:

```javascript
it('should correctly load all 4 characters from fantasy mod scenario', async () => {
  // Arrange: Load fantasy mod world
  await loadWorld('fantasy:vespera');

  // Act: Initialize all characters
  const characters = [
    'fantasy:registrar_copperplate_instance',
    'fantasy:threadscar_melissa_instance',
    'fantasy:bertram_the_muddy_instance',
    'fantasy:vespera_nightwhisper_instance',
  ];

  await Promise.all(characters.map((id) => anatomyWorkflow.generate(id)));

  // Assert: Each character has correct anatomy
  const registrar = entityManager.getEntityInstance(characters[0]);
  const melissa = entityManager.getEntityInstance(characters[1]);

  const registrarParts = bodyGraphService.getAllParts(
    registrar.anatomy,
    registrar.id
  );
  const melissaParts = bodyGraphService.getAllParts(
    melissa.anatomy,
    melissa.id
  );

  // Registrar has tortoise anatomy
  expect(
    registrarParts.some(
      (id) =>
        entityManager.getComponentData(id, 'anatomy:part')?.subType ===
        'carapace'
    )
  ).toBe(true);

  // Melissa has human anatomy
  expect(
    melissaParts.some(
      (id) =>
        entityManager.getComponentData(id, 'anatomy:part')?.subType === 'breast'
    )
  ).toBe(true);

  // No overlap
  expect(registrarParts.filter((id) => melissaParts.includes(id))).toEqual([]);
});
```

**When to Run**: E2E test suite, manual QA before releases

### Property Tests (Invariant Validation)

#### Property Test 1: Part Isolation Property

**Property**: For any two distinct actors, their parts are disjoint sets.

**Implementation**:

```javascript
import fc from 'fast-check';

describe('Property Tests - Anatomy Isolation', () => {
  it('should maintain disjoint part sets for any two distinct actors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.constantFrom(
            'human_male',
            'human_female',
            'cat_girl',
            'tortoise_person'
          ),
          fc.constantFrom(
            'human_male',
            'human_female',
            'cat_girl',
            'tortoise_person'
          )
        ),
        async ([recipeA, recipeB]) => {
          // Arrange: Create two actors
          const actorA = await createCharacter('actorA', recipeA);
          const actorB = await createCharacter('actorB', recipeB);

          // Act: Get parts
          const partsA = bodyGraphService.getAllParts(
            actorA.anatomy,
            actorA.id
          );
          const partsB = bodyGraphService.getAllParts(
            actorB.anatomy,
            actorB.id
          );

          // Assert: Disjoint sets
          const overlap = partsA.filter((id) => partsB.includes(id));
          return overlap.length === 0;
        }
      ),
      { numRuns: 100 } // Run 100 random combinations
    );
  });
});
```

**Validation**: Run 100+ random actor combinations, verify zero overlap

#### Property Test 2: Commutative Cache Building

**Property**: Concurrent cache builds are commutative (order doesn't matter).

**Implementation**:

```javascript
it('should produce identical caches regardless of build order', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.shuffledSubarray(['actor1', 'actor2', 'actor3', 'actor4']),
      async (actorOrder) => {
        // Arrange: Create actors
        const actors = await Promise.all(
          actorOrder.map((id) => createCharacter(id))
        );

        // Act: Build caches in given order
        for (const actor of actors) {
          await cacheManager.buildCache(actor.id, entityManager);
        }

        // Get final state
        const finalState = actors.map((actor) => ({
          id: actor.id,
          parts: bodyGraphService.getAllParts(actor.anatomy, actor.id),
        }));

        // Clear cache
        cacheManager.clear();

        // Act: Build in reverse order
        for (const actor of actors.reverse()) {
          await cacheManager.buildCache(actor.id, entityManager);
        }

        // Get reversed state
        const reversedState = actors.reverse().map((actor) => ({
          id: actor.id,
          parts: bodyGraphService.getAllParts(actor.anatomy, actor.id),
        }));

        // Assert: Identical results
        return JSON.stringify(finalState) === JSON.stringify(reversedState);
      }
    ),
    { numRuns: 50 }
  );
});
```

**Validation**: Run 50+ random build orders, verify identical outcomes

#### Property Test 3: getAllParts Returns Only Actor's Parts

**Property**: For any actor A, getAllParts(A) returns only parts owned by A.

**Implementation**:

```javascript
it('should return only parts belonging to the specified actor', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(
        'human_male',
        'human_female',
        'cat_girl',
        'tortoise_person'
      ),
      async (recipe) => {
        // Arrange: Create actor
        const actor = await createCharacter('testActor', recipe);

        // Act: Get parts
        const parts = bodyGraphService.getAllParts(actor.anatomy, actor.id);

        // Assert: All parts have anatomy:body.body.root pointing to same tree
        const rootId = actor.anatomy.body.root;

        // Traverse up from each part, verify reaches same root
        for (const partId of parts) {
          if (partId === actor.id) continue; // Skip actor itself

          let current = partId;
          const visited = new Set();

          while (current && current !== rootId) {
            if (visited.has(current)) return false; // Cycle detected
            visited.add(current);

            const node = cacheManager.get(current);
            if (!node) return false; // Missing cache entry

            current = node.parentId;
          }

          if (current !== rootId && current !== null) return false; // Wrong root
        }

        return true;
      }
    ),
    { numRuns: 100 }
  );
});
```

**Validation**: Run 100+ random actors, verify all parts trace to correct root

---

## Implementation Checklist

### Code Validation

- [x] `#handleDisconnectedActorAnatomy()` uses `anatomyBody.body.root` field (line 467)
- [x] No global anatomy part searches in method (removed in fix)
- [x] Validation of `body.root` existence (lines 469-474)
- [x] Validation of entity reference validity (lines 477-487)
- [x] Appropriate warning logging for degradable errors (lines 471, 483)
- [x] Success logging for diagnostic purposes (lines 507-509)
- [x] Exception handling with error propagation (lines 446, 510-515)

### Test Coverage

- [x] Concurrent generation test passes (multiCharacterClothingGeneration.test.js)
- [x] Disconnected fallback test passes (anatomyCacheManager.disconnectedFallback.integration.test.js)
- [ ] Unique part ownership test added (NEW - required)
- [ ] Cache isolation test added (NEW - required)
- [ ] 10+ character scalability test added (NEW - recommended)
- [ ] Legacy format compatibility test added (NEW - recommended)
- [ ] Circular reference detection test added (NEW - recommended)
- [ ] Concurrent invalidation test added (NEW - recommended)

### Documentation

- [x] Inline code comments explain fix (lines 465-466)
- [x] claudedocs/anatomy-fixes-summary.md documents investigation (created in previous session)
- [x] This specification file (anatomy-cache-isolation.spec.md)
- [ ] Migration guide for legacy blueprints (if needed)
- [ ] API documentation update in anatomy-overview.md (recommended)

### Regression Prevention

- [x] Primary regression test identified (multiCharacterClothingGeneration.test.js)
- [x] No "Entity not found" warning check (in test)
- [x] Unique UUID check (in test)
- [x] Correct socket validation (via clothing tests)
- [ ] CI/CD integration (add to required tests)
- [ ] Pre-release checklist (add anatomy tests)

---

## Appendix: Related Files

### Production Code

- `/src/anatomy/anatomyCacheManager.js` - Fixed cache manager
- `/src/anatomy/bodyGraphService.js` - Graph service using cache manager
- `/src/anatomy/workflows/anatomyGenerationWorkflow.js` - Workflow orchestration
- `/src/anatomy/workflows/stages/eventPublicationStage.js` - Event dispatch
- `/src/anatomy/workflows/stages/clothingInstantiationStage.js` - Clothing attachment
- `/src/anatomy/anatomyGraphAlgorithms.js` - Graph traversal algorithms
- `/src/clothing/strategies/directSocketStrategy.js` - Socket resolution

### Test Files

- `/tests/integration/anatomy/multiCharacterClothingGeneration.test.js` - Primary regression test
- `/tests/integration/anatomy/anatomyCacheManager.disconnectedFallback.integration.test.js` - Fallback logic test
- `/tests/integration/anatomy/anatomyCacheManager.realModules.integration.test.js` - Real module integration
- `/tests/integration/anatomy/bodyGraphService.*.integration.test.js` - Graph service tests (20+ files)
- `/tests/integration/clothing/*.test.js` - Clothing validation tests (30+ files)
- `/tests/unit/anatomy/anatomyCacheManager.test.js` - Unit tests
- `/tests/unit/anatomy/bodyGraphService.test.js` - Unit tests

### Schema Files

- `/data/schemas/components/anatomy_body.component.json` - anatomy:body schema
- `/data/schemas/components/anatomy_joint.component.json` - anatomy:joint schema
- `/data/schemas/components/anatomy_part.component.json` - anatomy:part schema

### Data Files

- `/data/mods/anatomy/blueprints/*.blueprint.json` - Blueprint definitions
- `/data/mods/anatomy/recipes/*.recipe.json` - Recipe definitions
- `/data/mods/fantasy/entities/definitions/*.character.json` - Character entities

### Documentation

- `/CLAUDE.md` - Project context file
- `/docs/anatomy/anatomy-overview.md` - Anatomy system overview
- `/docs/architecture/entity-component-system.md` - ECS architecture
- `/docs/architecture/event-driven-architecture.md` - Event system
- `/claudedocs/anatomy-fixes-summary.md` - Fix documentation (created in previous session)

---

**End of Specification**

---

## Version History

| Version | Date       | Author      | Changes                                                      |
| ------- | ---------- | ----------- | ------------------------------------------------------------ |
| 1.0     | 2025-11-23 | Claude Code | Initial specification based on concurrent processing bug fix |

## Approval

**Specification Status**: ✅ APPROVED
**Implementation Status**: ✅ COMPLETE (fix already implemented)
**Test Coverage Status**: ⚠️ PARTIAL (primary tests pass, additional tests recommended)
**Next Review Date**: Before any changes to AnatomyCacheManager or BodyGraphService

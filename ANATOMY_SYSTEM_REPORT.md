# Living Narrative Engine - Anatomy System Exploration Report

## Executive Summary

The Living Narrative Engine uses a sophisticated **Entity Component System (ECS)** architecture for managing anatomy. Bodies are represented as directed graphs where entities (body parts) are connected through parent-child relationships via sockets (attachment points). This design enables complex, modular anatomy structures suitable for diverse character types (humanoid, arachnid, kraken, dragon, etc.).

---

## 1. ANATOMY GRAPH STRUCTURE

### 1.1 Graph Overview

**Type**: Directed Acyclic Graph (DAG) with hierarchical structure
- **Root**: Single root body part entity (e.g., torso for humans)
- **Nodes**: Individual body part entities
- **Edges**: Parent-child relationships established via socket attachments
- **Direction**: From root down through child parts (e.g., torso → arm → hand)

### 1.2 Node Organization

Each node in the anatomy graph represents a body part entity with:

```
AnatomyNode {
  entityId: string          // Runtime instance ID
  partType: string          // Type classification (e.g., "arm", "leg", "head")
  parentId: string | null   // Parent entity ID (null for root)
  socketId: string          // Socket ID on parent where attached
  children: string[]        // Array of child entity IDs
}
```

### 1.3 Graph Characteristics

| Aspect | Details |
|--------|---------|
| **Depth** | Varies by anatomy type; max depth controlled by `ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH` |
| **Branching** | Multiple children per node (e.g., torso has 12+ sockets for arms, legs, organs, etc.) |
| **Single Parent** | Each part (except root) has exactly one parent |
| **Cyclicity** | Guaranteed acyclic (parent-child relationships prevent cycles) |
| **Connectivity** | Fully connected tree structure rooted at single node |

### 1.4 Real Example: Human Male Anatomy

```
human_male_torso (root)
├── neck (socket)
│   └── humanoid_head
│       ├── eyes (sockets)
│       │   └── multiple eye entities
│       └── mouth (socket)
│           └── humanoid_mouth
├── left_shoulder (socket)
│   └── humanoid_arm
│       └── wrist (socket)
│           └── human_hand
│               └── can_grab component
├── right_shoulder (socket)
│   └── humanoid_arm
│       └── wrist (socket)
│           └── human_hand
├── left_hip (socket)
│   └── human_leg
│       └── ankle (socket)
│           └── human_foot
├── right_hip (socket)
│   └── human_leg
│       └── ankle (socket)
│           └── human_foot
├── left_chest (socket)
│   └── human_breast
├── right_chest (socket)
│   └── human_breast
├── penis (socket)
│   └── human_penis
├── left_testicle (socket)
│   └── human_testicle
├── right_testicle (socket)
│   └── human_testicle
└── ... (more sockets for asshole, ass cheeks, pubic hair, etc.)
```

---

## 2. KEY FILES IN SRC/ANATOMY/

### Core Graph Management

| File | Purpose | Key Classes |
|------|---------|-------------|
| `anatomyGraphAlgorithms.js` | Graph traversal & algorithms | `AnatomyGraphAlgorithms` (static utility) |
| `anatomyCacheManager.js` | Caches adjacency information | `AnatomyCacheManager` |
| `bodyGraphService.js` | Graph operations (detach, traverse) | `BodyGraphService` |
| `entityGraphBuilder.js` | Constructs graph from recipes | `EntityGraphBuilder` |
| `socketManager.js` | Socket availability & validation | `SocketManager` |

### Graph Traversal Methods

**AnatomyGraphAlgorithms** provides static methods:

1. **`getSubgraph(rootEntityId, cacheManager, maxDepth)`**
   - Returns all entities in a sub-graph rooted at given entity
   - Uses stack-based traversal (DFS)
   - Prevents revisiting nodes with `visited` Set

2. **`findPartsByType(rootEntityId, partType, cacheManager, maxDepth)`**
   - Finds all body parts of specific type
   - Filters by `node.partType === partType`
   - Returns array of matching entity IDs

3. **`getAnatomyRoot(entityId, cacheManager, maxDepth)`**
   - Traverses up to find the root body part
   - Follows parent chain until no parent exists
   - Returns root entity ID

4. **`getPath(fromEntityId, toEntityId, cacheManager, maxDepth)`**
   - Finds path between two entities via common ancestor
   - Algorithm:
     1. Get ancestors of both entities
     2. Find common ancestor
     3. Build path: from → ancestor → to
   - Returns array of entity IDs forming path, or null if no path

5. **`getAllParts(rootEntityId, cacheManager, entityManager, maxDepth)`**
   - Returns complete list of all parts in anatomy
   - Includes entity IDs and part type information
   - Uses depth-first traversal

### Node Access Methods

**SocketManager** handles socket-based access:

1. **`getSocket(parentId, socketId)`**
   - Retrieves socket definition from parent entity
   - Accesses `anatomy:sockets` component
   - Returns socket object or null

2. **`isSocketOccupied(parentId, socketId, socketOccupancy)`**
   - Checks if socket has attached child
   - Uses occupancy key format: `${parentId}|${socketId}`

3. **`occupySocket(parentId, socketId, socketOccupancy)`**
   - Marks socket as occupied (child attached)
   - Adds occupancy key to Set

4. **`validateSocketAvailability(parentId, socketId, socketOccupancy)`**
   - Ensures socket exists and is available
   - Throws error if occupied or doesn't exist

### Cache Structure

**AnatomyCacheManager** stores adjacency information:

```javascript
Map<entityId, AnatomyNode>
  entityId: string
  partType: string
  parentId: string | null
  socketId: string
  children: string[]
```

- Built during anatomy generation
- Invalidated when parts detach
- Enables O(1) lookups and traversal

---

## 3. DATA STRUCTURE FOR ANATOMY

### 3.1 Components System

Each body part entity has components (ECS model):

#### `anatomy:part` Component
```json
{
  "subType": "arm",           // Part type: arm, leg, head, etc.
  "orientation": "left"       // left, right, mid, or indexed
}
```

#### `anatomy:sockets` Component
```json
{
  "sockets": [
    {
      "id": "wrist",
      "orientation": "mid",
      "allowedTypes": ["hand"],
      "nameTpl": "{{effective_orientation}} {{type}}"
    }
  ]
}
```

#### `anatomy:joint` Component (establishes parent-child link)
```json
{
  "parentId": "entity-id-123",  // Parent body part
  "socketId": "left_shoulder"   // Socket on parent
}
```

#### `anatomy:body` Component (root entity only)
```json
{
  "recipeId": "anatomy:human_male",
  "body": {
    "root": "entity-id-root",
    "parts": {
      "left_arm": "entity-id-456",
      "right_arm": "entity-id-789",
      // ... map of all parts
    },
    "descriptors": {
      "build": "muscular",
      "hairDensity": "hairy",
      "composition": "lean",
      "skinColor": "tanned",
      "height": "tall"
    }
  }
}
```

### 3.2 Blueprint System

Blueprints define anatomy structure with slot mappings and requirements:

```json
{
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "slots": {
    "head": {
      "socket": "neck",
      "requirements": { "partType": "head" }
    },
    "left_arm": {
      "socket": "left_shoulder",
      "requirements": { "partType": "arm" }
    }
  },
  "clothingSlotMappings": {
    "torso_upper": {
      "blueprintSlots": ["torso"],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    }
  }
}
```

### 3.3 Recipe System

Recipes provide concrete implementations of blueprints with specific part choices:

```json
{
  "recipeId": "anatomy:human_male",
  "blueprintId": "anatomy:human_male",
  "bodyDescriptors": {
    "build": "muscular",
    "hairDensity": "hairy"
  },
  "slots": {
    "torso": {
      "partType": "torso",
      "preferId": "anatomy:human_male_torso_muscular"
    }
  },
  "patterns": [
    {
      "matches": ["left_arm", "right_arm"],
      "partType": "arm",
      "preferId": "anatomy:humanoid_arm"
    }
  ]
}
```

---

## 4. COMPONENT STRUCTURES

### 4.1 Body Components Reference

| Component | Purpose | Key Properties |
|-----------|---------|-----------------|
| `anatomy:part` | Marks entity as body part | `subType`, `orientation` |
| `anatomy:joint` | Establishes parent-child link | `parentId`, `socketId` |
| `anatomy:sockets` | Defines attachment points | `sockets[]` (id, orientation, allowedTypes) |
| `anatomy:body` | Root container component | `recipeId`, `body` (root, parts, descriptors) |
| `anatomy:can_grab` | For graspable appendages | `gripStrength`, `heldItemId`, `locked` |
| `anatomy:requires_grabbing` | For items needing grip | *(tag component)* |
| `anatomy:blueprintSlot` | Blueprint slot marker | *(slot reference)* |

### 4.2 Socket Definition Structure

Sockets define attachment constraints:

```json
{
  "id": "wrist",                    // Unique within parent
  "orientation": "mid",             // Spatial position
  "allowedTypes": ["hand"],         // Which part types fit
  "nameTpl": "{{orientation}} {{type}}",  // Part naming
  "index": 1                        // For multiple same-type parts
}
```

**Allowed Orientations**: left, right, mid, upper, lower, front, back, left_front, right_front, left_rear, right_rear, anterior, posterior, etc.

---

## 5. BODY PART INVENTORY

### 5.1 Core Part Types (120+ entity definitions)

**Structural**:
- torso (male/female variants, multiple compositions)
- head (multiple styles)
- arm (multiple styles and orientations)
- leg (multiple styles and orientations)
- hand (including graspable versions)
- foot

**Sexual/Reproductive**:
- penis (multiple sizes)
- testicle (multiple sizes)
- vagina (multiple styles)
- breast (multiple cup sizes)
- ass_cheek (multiple shapes)
- pubic_hair

**Secondary**:
- hair (multiple styles and colors)
- eye (multiple colors and shapes)
- ear
- mouth
- nose
- tail
- wing
- carapace (tortoise)
- shell components

**Exotic**:
- tentacle (multiple types)
- pedipalp (arachnid)
- mantle (cephalopod)
- eye_stalk
- vestigial appendages
- eldritch components

### 5.2 Existing Body Type Blueprints (10+)

| Blueprint | Root | Structure | Example Parts |
|-----------|------|-----------|----------------|
| `human_male` | male torso | Humanoid | arms, legs, genitalia |
| `human_female` | female torso | Humanoid | arms, legs, breasts, vagina |
| `human_futa` | futa torso | Humanoid | both sets of genitalia |
| `cat_girl` | cat_girl_torso | Humanoid + feline | cat ears, tail, humanoid core |
| `centaur_warrior` | centaur_torso | Centauroid | humanoid upper, quadruped lower |
| `tortoise_person` | tortoise_with_shell | Tortoise biped | shell, carapace, beak, claws |
| `giant_spider` | spider_cephalothorax | Arachnid 8-leg | 8 legs, pedipalps, spinnerets |
| `giant_forest_spider` | spider_cephalothorax | Arachnid 8-leg | 8 legs, abdomen |
| `kraken` | kraken_mantle | Octopoid | tentacles (graspable), head |
| `red_dragon` | dragon_torso | Winged quadruped | wings, tail, legs |
| `writhing_observer` | eldritch_core | Eldritch | multiple tentacles, eyes, orifices |

---

## 6. GRAPH NAVIGATION PATTERNS

### 6.1 Common Traversal Operations

**1. Find All Parts of a Type**
```javascript
// Find all legs in an anatomy
const legs = AnatomyGraphAlgorithms.findPartsByType(
  rootId, 
  'leg', 
  cacheManager
);
```

**2. Get Complete Anatomy**
```javascript
// Get all body parts
const allParts = AnatomyGraphAlgorithms.getAllParts(
  rootId, 
  cacheManager, 
  entityManager
);
```

**3. Find Root from Any Part**
```javascript
// Find anatomy root from any body part
const root = AnatomyGraphAlgorithms.getAnatomyRoot(
  someLegId, 
  cacheManager
);
```

**4. Path Between Parts**
```javascript
// Find connection path between two parts
const path = AnatomyGraphAlgorithms.getPath(
  torsoId, 
  handId, 
  cacheManager
);
// Returns: [torsoId, armId, handId]
```

**5. Get Sub-graph**
```javascript
// Get all parts under an arm (arm + hand + fingers)
const armSubtree = AnatomyGraphAlgorithms.getSubgraph(
  armId, 
  cacheManager
);
```

### 6.2 Socket-Based Access

**Get Socket from Parent**
```javascript
const socket = socketManager.getSocket(parentId, 'left_shoulder');
// Returns socket definition if exists, null otherwise
```

**Check Socket Availability**
```javascript
const available = !socketManager.isSocketOccupied(
  torsoId, 
  'left_shoulder', 
  occupancySet
);

// Or validate before attachment
socketManager.validateSocketAvailability(
  torsoId, 
  'left_shoulder', 
  occupancySet
);
```

**Mark Socket Occupied**
```javascript
socketManager.occupySocket(torsoId, 'left_shoulder', occupancySet);
```

### 6.3 Part Detachment with Cascade

```javascript
// Detach a hand (with cascade, also detaches all children)
await bodyGraphService.detachPart(handId, { 
  cascade: true, 
  reason: 'severed' 
});
// Automatically invalidates cache
```

---

## 7. PERFORMANCE CHARACTERISTICS

### 7.1 Access Patterns

| Operation | Time Complexity | Space | Notes |
|-----------|-----------------|-------|-------|
| Get node info | O(1) | O(1) | Cached lookup |
| Find all parts | O(n) | O(n) | Full graph traversal |
| Find part by type | O(n) | O(k) | k = matching parts |
| Get path | O(n) | O(n) | Two ancestor chains |
| Get ancestry | O(h) | O(h) | h = height |
| Get subgraph | O(s) | O(s) | s = subgraph size |

**Where**: n = total parts, h = height (depth), s = subgraph size

### 7.2 Cache Optimization

- **Cache Manager**: Stores adjacency information in Map
- **Query Cache**: Separate cache for expensive queries
- **Invalidation**: Manual invalidation on detach/attach
- **Max Depth**: Prevents infinite traversal (`ANATOMY_CONSTANTS.MAX_RECURSION_DEPTH`)

---

## 8. IMPLICATIONS FOR HEALTH/DAMAGE SYSTEM

### 8.1 Key Insights for Implementation

1. **Part Identity**: Each body part has unique runtime entity ID - can track health/damage individually
2. **Hierarchical**: Damage can propagate through parent-child relationships
3. **Type Classification**: Parts have `subType` - can apply damage rules by type
4. **Orientation**: Parts have orientation - can track directional wound locations
5. **Modular**: Parts can detach independently - severing is natively supported

### 8.2 Design Recommendations

**For Health Component**:
- Track HP/damage per part entity (not per body type)
- Use part type to determine vulnerability (e.g., vital organs take more damage)
- Leverage orientation for wound description (left vs right side)
- Consider cascading effects through parent chain

**For Damage Calculation**:
- Get all parts of type (legs, arms) for area attacks
- Use path between parts for range calculations
- Check part ancestry for blood flow simulation

**For Severing/Detachment**:
- Use `bodyGraphService.detachPart()` with cascade option
- Cascade = true severs limb and children (hand when arm severs)
- Cascade = false only removes specific part

**For Status Effects**:
- Create new component on part entity (e.g., `damage:wound`, `damage:bleeding`)
- Use same socket mechanism for wound tracking
- Tag affected parts with status component

---

## 9. DIRECTORY STRUCTURE REFERENCE

```
src/anatomy/
├── anatomyGraphAlgorithms.js      # Graph traversal
├── anatomyCacheManager.js         # Adjacency cache
├── bodyGraphService.js            # Graph operations
├── entityGraphBuilder.js          # Graph construction
├── socketManager.js               # Socket management
├── orchestration/
│   ├── anatomyOrchestrator.js     # Workflow coordination
│   ├── anatomyUnitOfWork.js       # Transaction handling
│   └── anatomyErrorHandler.js     # Error management
├── workflows/
│   ├── anatomyGenerationWorkflow.js
│   ├── graphBuildingWorkflow.js
│   └── descriptionGenerationWorkflow.js
├── services/                      # Activity descriptions, metadata
├── validation/                    # Schema validation
├── cache/                         # Query and clothing caches
├── errors/                        # Custom error types
├── registries/
│   └── bodyDescriptorRegistry.js  # Descriptor metadata
└── constants/
    └── anatomyConstants.js        # Magic numbers

data/mods/anatomy/
├── components/                    # anatomy:* component definitions
├── entities/definitions/          # 120+ body part definitions
├── blueprints/                    # 10+ anatomy structure definitions
├── recipes/                       # Concrete anatomy implementations
├── libraries/                     # Slot/clothing mappings
├── structure-templates/           # Body plan templates
└── conditions/                    # Anatomy-related conditions
```

---

## 10. CONSTANTS & CONFIGURATION

**Key Constants** (`anatomyConstants.js`):
- `MAX_RECURSION_DEPTH`: Maximum traversal depth
- `DEFAULT_MAX_PATH_LENGTH`: Max path length for getPath
- `LIMB_DETACHED_EVENT_ID`: Event ID for detachment

**Socket Naming** (in socket definitions):
- `{{orientation}}`: Replaces with socket orientation (left, right, etc.)
- `{{type}}`: Replaces with part type (arm, leg, etc.)
- `{{index}}`: Replaces with socket index number
- `{{parent.name}}`: Replaces with parent part name

---

## SUMMARY TABLE: Quick Reference

| Need | Solution | Location |
|------|----------|----------|
| Get all parts | `AnatomyGraphAlgorithms.getAllParts()` | anatomyGraphAlgorithms.js |
| Find part type | `AnatomyGraphAlgorithms.findPartsByType()` | anatomyGraphAlgorithms.js |
| Navigate upward | `AnatomyGraphAlgorithms.getAnatomyRoot()` | anatomyGraphAlgorithms.js |
| Get path | `AnatomyGraphAlgorithms.getPath()` | anatomyGraphAlgorithms.js |
| Get children | `cache.get(id).children` | Via AnatomyCacheManager |
| Get parent | `cache.get(id).parentId` | Via AnatomyCacheManager |
| Attach part | `EntityGraphBuilder.createAndAttachPart()` | entityGraphBuilder.js |
| Detach part | `BodyGraphService.detachPart()` | bodyGraphService.js |
| Check socket | `SocketManager.getSocket()` | socketManager.js |
| Validate socket | `SocketManager.validateSocketAvailability()` | socketManager.js |

---

**Document Generated**: Based on Living Narrative Engine anatomy system code
**Scope**: Architecture, data structures, and navigation patterns for health/damage system implementation

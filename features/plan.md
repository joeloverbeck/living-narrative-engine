# Anatomy System Implementation Plan

## Overview

This document provides a comprehensive plan for implementing a 100% data-driven anatomy pipeline in the Living Narrative Engine. The system allows modders to describe creatures with arbitrary body parts, counts, and tags, while the engine assembles valid, socket-aware graphs supporting procedural variation and runtime events.

## System Architecture

### Core Concepts

- **Recipe**: Designer-authored file that states what parts a creature should have (types, tags, counts, preferences, exclusions)
- **Blueprint**: Graph definition that states where parts can attach (sockets, orientation, joint metadata)
- **Socket**: Attachment point declared on a part; defines allowed child types plus joint physics & naming info
- **Part Definition**: Entity file that represents an individual body part and advertises its own sockets
- **Factory**: Runtime service that combines a blueprint with a recipe and spawns the final entity graph
- **Validator**: Service that guarantees produced graphs respect socket limits and recipe constraints

### File Structure

```
data/
├── schemas/
│   ├── anatomy.recipe.schema.json      # Recipe validation schema
│   ├── anatomy.blueprint.schema.json   # Blueprint validation schema
│   └── anatomy.part.schema.json       # Part definition validation schema
├── mods/
│   └── [mod_name]/
│       └── anatomy/
│           ├── recipes/               # *.recipe.json files
│           ├── blueprints/           # *.bp.json files
│           └── parts/                # *.part.json files

src/
├── anatomy/
│   ├── bodyBlueprintFactory.js      # Main factory service
│   ├── graphIntegrityValidator.js   # Validation service
│   └── bodyGraphService.js          # Runtime graph management
└── loaders/
    ├── anatomyRecipeLoader.js        # Loads recipe files
    ├── anatomyBlueprintLoader.js     # Loads blueprint files
    └── anatomyPartLoader.js          # Loads part definitions
```

## Implementation Components

### 1. JSON Schemas

#### anatomy.recipe.schema.json
Defines the structure for recipe files with:
- `recipeId`: Unique identifier
- `slots`: Map of slot configurations
  - `partType`: Required part type
  - `preferId`: Optional exact entity to prefer
  - `tags`: Required component tags
  - `notTags`: Excluded component tags
  - `count`: Desired count (min/max/exact)
- `constraints`: Global constraints
  - `requires`: Co-presence requirements
  - `excludes`: Mutual exclusion rules
- `includes`: Optional macro imports
- `isMacro`: Flag for macro recipes

#### anatomy.blueprint.schema.json
Defines the structure for blueprint files with:
- `root`: Root entity definition ID
- `attachments`: Static parent-child relationships
  - `parent`: Parent entity ID
  - `socket`: Socket ID on parent
  - `child`: Child entity ID

#### anatomy.part.schema.json
Defines the structure for part definition files with:
- `id`: Unique part identifier
- `components`: Array of components
  - `anatomy:part`: Required, with `subType`
  - `anatomy:sockets`: Optional socket definitions
- `tags`: Tag components for filtering

### 2. Component Definitions

#### anatomy:part
Marks an entity as an anatomy body part:
```json
{
  "type": "anatomy:part",
  "subType": "leg"  // Specific part type
}
```

#### anatomy:sockets
Defines attachment points on a body part:
```json
{
  "type": "anatomy:sockets",
  "sockets": [{
    "id": "ankle",
    "orientation": "mid",
    "allowedTypes": ["foot", "paw"],
    "maxCount": 1,
    "jointType": "hinge",
    "breakThreshold": 25,
    "nameTpl": "{{orientation}} {{type}}"
  }]
}
```

#### anatomy:joint
Represents a connection between body parts:
```json
{
  "type": "anatomy:joint",
  "parentId": "entity-uuid",
  "socketId": "ankle",
  "jointType": "hinge",
  "breakThreshold": 25
}
```

### 3. Loader Services

#### AnatomyRecipeLoader
- Extends `BaseManifestItemLoader`
- Loads `*.recipe.json` files from `anatomy/recipes/`
- Validates constraint structure
- Stores in registry under `anatomyRecipes` key

#### AnatomyBlueprintLoader
- Extends `BaseManifestItemLoader`
- Loads `*.bp.json` files from `anatomy/blueprints/`
- Generates IDs from filenames
- Validates attachment references
- Stores in registry under `anatomyBlueprints` key

#### AnatomyPartLoader
- Extends `BaseManifestItemLoader`
- Loads `*.part.json` files from `anatomy/parts/`
- Transforms to standard entity definitions
- Validates anatomy components
- Stores as both entity definitions and anatomy part references

### 4. Core Services

#### BodyBlueprintFactory
Main factory service that assembles anatomy graphs:

**Algorithm**:
1. Load blueprint and recipe
2. Create root entity
3. Process static attachments from blueprint
4. Fill remaining sockets depth-first:
   - Find matching recipe slot by partType
   - Build candidate list (type match ∧ tags present ∧ notTags absent)
   - Select part (prefer preferId, else random)
   - Create entity with joint component
   - Apply name template
   - Recurse on child sockets
5. Validate assembled graph
6. Return root ID and all created entities

**Key Methods**:
- `createAnatomyGraph(blueprintId, recipeId, options)`
- `#findCandidateParts(recipeSlot, allowedTypes)`
- `#createAndAttachPart(parentId, socketId, partDefinitionId)`
- `#generatePartName(socket, childEntity, parentId)`

#### GraphIntegrityValidator
Validates assembled anatomy graphs:

**Validation Checks**:
1. Socket occupancy doesn't exceed maxCount
2. Recipe requires/excludes constraints satisfied
3. No cycles in the graph
4. Joint consistency (parent exists, socket exists)
5. No orphaned parts
6. Part types match socket allowedTypes

**Returns**: `{valid: boolean, errors: string[], warnings: string[]}`

#### BodyGraphService
Runtime management of anatomy graphs:

**Features**:
- Adjacency cache for fast traversal
- Part detachment with cascade support
- Path finding between parts
- Query parts by type
- Damage threshold checking
- Cache validation

**Key Methods**:
- `buildAdjacencyCache(rootEntityId)`
- `detachPart(partEntityId, options)`
- `findPartsByType(rootEntityId, partType)`
- `getAnatomyRoot(partEntityId)`
- `shouldDetachFromDamage(partEntityId, damageAmount)`

### 5. Event System

#### LIMB_DETACHED Event
Dispatched when a body part is detached:
```json
{
  "type": "anatomy:limb_detached",
  "payload": {
    "detachedEntityId": "uuid",
    "parentEntityId": "uuid",
    "socketId": "ankle",
    "detachedCount": 3,
    "reason": "damage",
    "timestamp": 1234567890
  }
}
```

## Usage Examples

### Creating a Humanoid Body

1. Define the recipe (`humanoid_female.recipe.json`):
```json
{
  "recipeId": "anatomy:humanoid_female",
  "slots": {
    "torso": {
      "partType": "torso",
      "count": {"exact": 1}
    },
    "arms": {
      "partType": "arm",
      "count": {"exact": 2}
    },
    "legs": {
      "partType": "leg",
      "count": {"exact": 2}
    }
  }
}
```

2. Define the blueprint (`humanoid.bp.json`):
```json
{
  "root": "anatomy:torso_human",
  "attachments": [
    {"parent": "anatomy:torso_human", "socket": "arm_left", "child": "anatomy:arm_human"},
    {"parent": "anatomy:torso_human", "socket": "arm_right", "child": "anatomy:arm_human"}
  ]
}
```

3. Create the anatomy:
```javascript
const factory = container.resolve(tokens.BodyBlueprintFactory);
const { rootId, entities } = await factory.createAnatomyGraph(
  'anatomy:humanoid',
  'anatomy:humanoid_female',
  { seed: 12345 }
);
```

### Runtime Limb Detachment

```javascript
const graphService = container.resolve(tokens.BodyGraphService);

// Check damage threshold
if (graphService.shouldDetachFromDamage(armEntityId, 30)) {
  // Detach the arm and all attached parts
  const result = await graphService.detachPart(armEntityId, {
    cascade: true,
    reason: 'damage'
  });
  
  // Result contains detached entity IDs
  console.log(`Detached ${result.detached.length} parts`);
}
```

## Error Handling

The system follows fail-fast principles:
- Schema validation errors halt mod loading
- Runtime assembly errors dispatch `SYSTEM_ERROR_OCCURRED_ID` events
- Soft constraint violations log warnings
- Entity creation failures trigger cleanup

## Extensibility

### Future Enhancements
1. **Macro System**: Pre-processor for recipe composition
2. **Index Numbering**: Support for {{index}} in name templates
3. **Multi-parent Geometry**: Parts requiring multiple simultaneous sockets
4. **Vascular/Nerve Systems**: Advanced physiological modeling

### Integration Points
- Custom operations for anatomy manipulation
- Action system integration for targeted damage
- Save/load persistence of anatomy state
- UI visualization of body part status

## Testing Strategy

### Unit Tests
- Loader validation
- Factory assembly logic
- Validator rule checking
- Graph service operations

### Integration Tests
- Full pipeline from files to entities
- Multi-mod compatibility
- Save/load round trips
- Event dispatching

### Test Fixtures
Create sample creatures:
- Simple biped
- Multi-limbed creature
- Modular robot
- Edge cases (cycles, missing parts)

## Performance Considerations

- Adjacency cache for O(1) lookups
- Depth-first traversal for deterministic assembly
- Lazy loading of part definitions
- Efficient candidate filtering

## Security

- No executable code in data files
- All behavior in engine code
- Validated namespaced IDs
- Sanitized name generation

This plan provides a complete implementation of the anatomy system while maintaining compatibility with the existing ECS architecture and mod system.
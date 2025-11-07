# Anatomy System Architecture

This document describes the architecture of the Living Narrative Engine's anatomy system, including its components, data flow, and integration points.

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Architecture](#core-architecture)
3. [Generation Pipeline](#generation-pipeline)
4. [Event-Driven Integration](#event-driven-integration)
5. [Key Services](#key-services)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Caching Strategy](#caching-strategy)
8. [Extension Points](#extension-points)

## System Overview

### Design Philosophy

The anatomy system follows a **"Blueprint → Recipe → Instance"** generation pipeline with three core principles:

1. **Separation of Concerns**: Structure (blueprints) separate from content (recipes)
2. **Template-Based Generation**: Parameterized templates for non-human creatures
3. **Event-Driven Integration**: Loosely coupled with clothing and other systems

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Anatomy System                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Data Layer (Mods)                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Structure  │  │  Blueprints │  │   Recipes   │         │
│  │  Templates  │  │  (V1 / V2)  │  │  (Patterns) │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                 │                 │                 │
│  ───────┴─────────────────┴─────────────────┴──────────────  │
│                                                               │
│  Service Layer                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │        AnatomyGenerationWorkflow                     │    │
│  │    (Orchestrates anatomy creation & events)         │    │
│  └───────────────────┬─────────────────────────────────┘    │
│                      │                                       │
│         ┌────────────┼────────────┐                         │
│         ▼            ▼            ▼                         │
│  ┌───────────┐ ┌──────────┐ ┌──────────────┐              │
│  │  Blueprint│ │  Recipe  │ │ Entity Graph │              │
│  │  Factory  │ │ Processor│ │   Builder    │              │
│  └───────────┘ └──────────┘ └──────────────┘              │
│         │            │            │                         │
│  ───────┴────────────┴────────────┴──────────────────────  │
│                                                               │
│  Support Services                                            │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐    │
│  │     Slot     │ │   Socket    │ │  Orientation     │    │
│  │  Generator   │ │  Generator  │ │   Resolver       │    │
│  └──────┬───────┘ └──────┬──────┘ └─────────┬────────┘    │
│         └────────────────┼────────────────────┘             │
│                          ▼                                  │
│                  ┌───────────────┐                          │
│                  │ Socket Index  │                          │
│                  │  (O(1) cache) │                          │
│                  └───────────────┘                          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                           │
                           │ ANATOMY_GENERATED event
                           ▼
                  ┌─────────────────┐
                  │  Clothing       │
                  │  System         │
                  └─────────────────┘
```

## Core Architecture

### Blueprint System

Blueprints define the **structure** of anatomy:

- **V1 Blueprints**: Explicit slot definitions
- **V2 Blueprints**: Template-based with Structure Templates

**Key Classes**:
- `BodyBlueprintFactory` (`src/anatomy/bodyBlueprintFactory.js`)
- `SlotGenerator` (`src/anatomy/slotGenerator.js`) - V2 only
- `SocketGenerator` (`src/anatomy/socketGenerator.js`) - V2 only

**Data Files**:
- `data/mods/anatomy/blueprints/*.blueprint.json`
- `data/mods/anatomy/structure-templates/*.structure-template.json`

### Recipe System

Recipes define the **content** for anatomy:

- Part type selection
- Pattern matching for repeating limbs
- Component properties and tags
- Clothing items

**Key Classes**:
- `RecipeProcessor` (`src/anatomy/recipeProcessor.js`)
- `RecipePatternResolver` (`src/anatomy/recipePatternResolver/patternResolver.js`)
- `PartSelectionService` (`src/anatomy/partSelectionService.js`)

**Data Files**:
- `data/mods/anatomy/recipes/*.recipe.json` (primary location)
- `data/mods/core/recipes/*.recipe.json` (additional recipes may exist in other mods)

### Entity Graph

The runtime representation of anatomy:

- ECS entities for each body part
- Components: `anatomy:part`, `anatomy:sockets`, `anatomy:body`
- Hierarchical structure via parent-child relationships

**Key Classes**:
- `EntityGraphBuilder` (`src/anatomy/entityGraphBuilder.js`)
- `BodyGraphService` (`src/anatomy/bodyGraphService.js`)
- `AnatomySocketIndex` (`src/anatomy/services/anatomySocketIndex.js`)

## Generation Pipeline

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Blueprint Resolution                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Load blueprint from mod data                         │ │
│ │ 2. If V2: Load structure template                       │ │
│ │ 3. If V2: Generate slots from template                  │ │
│ │ 4. Create BlueprintInstance with slots                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Recipe Processing                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Load recipe from mod data                            │ │
│ │ 2. Resolve patterns to blueprint slots                  │ │
│ │ 3. Select parts for each slot                           │ │
│ │ 4. Build slot → entity mapping                          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: Entity Graph Building                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Create root entity (owner)                           │ │
│ │ 2. Create part entities                                 │ │
│ │ 3. Establish parent-child relationships                 │ │
│ │ 4. Generate sockets for each part                       │ │
│ │ 5. Apply components and properties                      │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 4: Post-Generation                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Update anatomy:body component                        │ │
│ │ 2. Create blueprint slot entities                       │ │
│ │ 3. Create clothing slot metadata                        │ │
│ │ 4. Build socket index (O(1) cache)                      │ │
│ │ 5. Dispatch ANATOMY_GENERATED event                     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 5: Clothing Instantiation (Optional)                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Listen for ANATOMY_GENERATED event                   │ │
│ │ 2. Resolve clothing slots via SlotResolver              │ │
│ │ 3. Create clothing entities                             │ │
│ │ 4. Attach to anatomy sockets                            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### OrientationResolver: Critical Synchronization

**Location**: `src/anatomy/shared/orientationResolver.js`

**Purpose**: Single source of truth for orientation resolution logic

**Critical Requirement**: Both SlotGenerator and SocketGenerator MUST use OrientationResolver to maintain synchronization.

**Design**:
```javascript
export class OrientationResolver {
  static resolveOrientation(scheme, index, totalCount, positions, arrangement) {
    // Centralized logic ensures:
    // - SlotGenerator slot keys match SocketGenerator socket IDs
    // - Consistent orientation naming across system
    // - Single point of maintenance
  }
}
```

**Supported Schemes**:
- `bilateral`: Left/right pairs (e.g., arms, wings)
- `quadrupedal`: Four-legged arrangement (left_front, right_front, left_rear, right_rear)
- `radial`: Circular arrangement (octagonal default: anterior, anterior_right, etc.)
- `indexed`: Numeric sequences (1, 2, 3, ...)
- `custom`: Explicit position arrays

**Usage**:
```javascript
// SlotGenerator generates slot key
const slotKey = `leg_${OrientationResolver.resolveOrientation('bilateral', 1, 4)}`;
// Result: "leg_left_front"

// SocketGenerator generates matching socket ID
const socketId = `leg_${OrientationResolver.resolveOrientation('bilateral', 1, 4)}`;
// Result: "leg_left_front" ✅ SYNCHRONIZED
```

## Event-Driven Integration

### ANATOMY_GENERATED Event

**Event ID**: `ANATOMY_GENERATED`

**Dispatch Location**: `src/anatomy/workflows/anatomyGenerationWorkflow.js:197` (within event publishing block at lines 187-217)

**Event Payload**:
```javascript
{
  entityId: string,        // Owner entity ID
  blueprintId: string,     // Blueprint used for generation
  sockets: Array<{         // Available sockets for attachment
    id: string,            // Socket ID (e.g., "leg_left_front")
    orientation: string    // Socket orientation (e.g., "left_front")
  }>,
  timestamp: number,       // Generation timestamp
  bodyParts: Array,        // Generated body part entities
  partsMap: Object,        // Part name to entity ID mapping
  slotEntityMappings: Object  // Slot to entity mappings
}
```

**Purpose**: Notifies other systems (especially clothing) that anatomy generation completed

**Timing**: Dispatched after:
1. Anatomy entity graph is built
2. anatomy:body component is updated
3. Socket index is ready
4. BEFORE clothing instantiation

**Example Subscriber** (Clothing System):
```javascript
// ClothingInstantiationService subscribes to ANATOMY_GENERATED
eventBus.on('ANATOMY_GENERATED', async ({ entityId, sockets }) => {
  // 1. Resolve clothing slots using SlotResolver
  const resolvedSlots = await slotResolver.resolve(entityId, clothingItem);

  // 2. Find matching socket from anatomy
  const targetSocket = sockets.find(s => s.id === resolvedSlots.socketId);

  // 3. Attach clothing to socket
  if (targetSocket) {
    await attachClothing(entityId, clothingItem, targetSocket);
  }
});
```

### Integration Flow

```
AnatomyGenerationWorkflow
  ↓
  1. Generate anatomy entities
  ↓
  2. Build socket index
  ↓
  3. Dispatch ANATOMY_GENERATED event
  ↓
  ┌──────────────────────────────┐
  │   Event Bus                  │
  └──────────────────────────────┘
  ↓
  Multiple subscribers can process:
  ├─ ClothingInstantiationService (attach clothing)
  ├─ DescriptionGenerationService (generate descriptions)
  ├─ CacheInvalidationService (clear stale caches)
  └─ ... (other systems)
```

**Benefits**:
- **Loose coupling**: Clothing system doesn't directly depend on anatomy workflow
- **Extensibility**: New systems can subscribe to ANATOMY_GENERATED
- **Timing control**: Event guarantees anatomy is ready before clothing
- **Cache coordination**: Event triggers cache invalidation/rebuilding

## Key Services

### AnatomyGenerationWorkflow

**Location**: `src/anatomy/workflows/anatomyGenerationWorkflow.js`

**Purpose**: Orchestrates complete anatomy generation process

**Key Methods**:
- `generate(blueprintId, recipeId, options)`: Main entry point
- `#buildPartsMap(entities)`: Maps part names to entity IDs
- `#updateAnatomyBodyComponent(...)`: Updates anatomy:body component
- `#createClothingSlotMetadata(...)`: Creates metadata for clothing integration

**Dependencies**:
- EntityManager
- DataRegistry
- BodyBlueprintFactory
- ClothingInstantiationService (optional)
- EventBus (optional - for ANATOMY_GENERATED event)
- AnatomySocketIndex (optional - for socket caching)

### AnatomySocketIndex

**Location**: `src/anatomy/services/anatomySocketIndex.js`

**Purpose**: O(1) socket lookup and indexing

**Key Methods**:
- `buildIndex(rootEntityId)`: Builds/rebuilds socket index for entity hierarchy
- `findEntityWithSocket(rootEntityId, socketId)`: O(1) socket → entity lookup
- `getEntitySockets(entityId)`: Returns all sockets for an entity
- `getEntitiesWithSockets(rootEntityId)`: Returns entities with sockets in hierarchy
- `invalidateIndex(rootEntityId)`: Clears cached index
- `clearCache()`: Clears all indexes

**Internal Structure**:
```javascript
// O(1) lookup indexes
#socketToEntityMap: Map<socketId, entityId>
#entityToSocketsMap: Map<entityId, SocketInfo[]>
#rootEntityCache: Map<rootEntityId, Set<entityId>>
```

**Cache Registration**:
```javascript
// Registers with CacheCoordinator for coordinated invalidation
cacheCoordinator.registerCache('anatomySocketIndex:socketToEntity', this.#socketToEntityMap);
cacheCoordinator.registerCache('anatomySocketIndex:entityToSockets', this.#entityToSocketsMap);
cacheCoordinator.registerCache('anatomySocketIndex:rootEntity', this.#rootEntityCache);
```

**Performance**:
- **Index building**: O(n) where n = number of entities in hierarchy
- **Socket lookup**: O(1) after index built
- **Memory**: ~3 maps per root entity + socket/entity info
- **Auto-rebuild**: Index builds on first access if missing

### BodyBlueprintFactory

**Location**: `src/anatomy/bodyBlueprintFactory.js`

**Purpose**: Creates anatomy graphs from blueprints and recipes

**Key Methods**:
- `createAnatomyGraph(blueprintId, recipeId, options)`: Main factory method
- `#loadBlueprint(blueprintId)`: Loads and validates blueprint
- `#processV2Blueprint(blueprint)`: Handles V2 template-based blueprints
- `#generateSocketsFromTemplate(...)`: Generates sockets from structure template

**V1 vs V2 Processing**:
```
V1 Blueprint:
  ├─ Load blueprint definition
  ├─ Use explicit slots from blueprint.slots
  └─ Generate entities directly

V2 Blueprint:
  ├─ Load blueprint definition
  ├─ Load structure template
  ├─ Generate slots via SlotGenerator
  ├─ Generate sockets via SocketGenerator
  └─ Generate entities from generated slots
```

### RecipePatternResolver

**Location**: `src/anatomy/recipePatternResolver/patternResolver.js`

**Purpose**: Resolves recipe patterns to blueprint slots

**Note**: RecipePatternResolver has been refactored into a modular architecture with separate matcher, validator, and utility modules within the `recipePatternResolver/` directory.

**Supported Patterns**:
- `matches`: Explicit slot list (V1)
- `matchesGroup`: Slot group selector (V2)
- `matchesPattern`: Wildcard matching (V2)
- `matchesAll`: Property-based filtering (V2)

**Resolution Priority**:
1. Explicit `slots` definitions (highest)
2. Most specific pattern (matchesAll > matchesPattern > matchesGroup)
3. First matching pattern

**Validation**:
- Ensures exactly one matcher per pattern
- Logs zero-match patterns at debug level (intentional for optional patterns)
- Verifies blueprint slots exist

## Data Flow Diagrams

### Complete Generation Flow

```
┌────────────┐
│  Mod Data  │ (Structure Templates, Blueprints, Recipes, Entity Defs)
└─────┬──────┘
      │
      ▼
┌────────────────────────────────────────────────────────────┐
│  DataRegistry (Load & Cache)                               │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│  AnatomyGenerationService.generateForEntity()              │
│  (Facade - delegates to workflow)                          │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│  AnatomyGenerationWorkflow.generate()                      │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ├─────────────────────┐
                        ▼                     ▼
              ┌──────────────────┐  ┌──────────────────┐
              │ Blueprint Phase  │  │  Recipe Phase    │
              │  ┌────────────┐  │  │  ┌────────────┐  │
              │  │  V1: Use   │  │  │  │  Pattern   │  │
              │  │  explicit  │  │  │  │  Matching  │  │
              │  │  slots     │  │  │  │            │  │
              │  └────────────┘  │  │  └────────────┘  │
              │  ┌────────────┐  │  │  ┌────────────┐  │
              │  │  V2: Load  │  │  │  │  Part      │  │
              │  │  template, │  │  │  │  Selection │  │
              │  │  generate  │  │  │  │            │  │
              │  │  slots     │  │  │  └────────────┘  │
              │  └────────────┘  │  │                  │
              └──────────────────┘  └──────────────────┘
                        │                     │
                        └──────────┬──────────┘
                                   ▼
                        ┌──────────────────┐
                        │ Entity Graph     │
                        │ Building Phase   │
                        │  ┌────────────┐  │
                        │  │  Create    │  │
                        │  │  entities  │  │
                        │  │            │  │
                        │  │  Generate  │  │
                        │  │  sockets   │  │
                        │  │            │  │
                        │  │  Build     │  │
                        │  │  hierarchy │  │
                        │  └────────────┘  │
                        └─────────┬────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ Post-Generation  │
                        │  ┌────────────┐  │
                        │  │  Update    │  │
                        │  │  components│  │
                        │  │            │  │
                        │  │  Build     │  │
                        │  │  socket    │  │
                        │  │  index     │  │
                        │  │            │  │
                        │  │  Dispatch  │  │
                        │  │  event     │  │
                        │  └────────────┘  │
                        └─────────┬────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ Event Bus        │
                        │ (ANATOMY_        │
                        │  GENERATED)      │
                        └─────────┬────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ Clothing         │
                        │ Integration      │
                        └──────────────────┘
```

### Pattern Matching Flow

```
Recipe Pattern
      │
      ▼
┌──────────────────────┐
│ Pattern Type?        │
└──────────────────────┘
      │
      ├─── V1: matches (explicit list)
      │         │
      │         ▼
      │    Direct slot lookup
      │
      ├─── V2: matchesGroup
      │         │
      │         ▼
      │    Filter by limbSet/appendage type
      │
      ├─── V2: matchesPattern
      │         │
      │         ▼
      │    Wildcard matching on slot keys
      │
      └─── V2: matchesAll
                │
                ▼
           Property-based filtering
                │
                ▼
         (slotType, orientation, socketId)

      │
      ▼
┌──────────────────────┐
│ Matched Slots        │
└──────────────────────┘
      │
      ▼
Apply exclusions (if any)
      │
      ▼
┌──────────────────────┐
│ Final Slot Set       │
└──────────────────────┘
```

## Caching Strategy

### Socket Index Cache

**Purpose**: Eliminate O(n) graph traversals for socket lookups

**Cache Structure**:
- `socketToEntityMap`: socketId → entityId
- `entityToSocketsMap`: entityId → SocketInfo[]
- `rootEntityCache`: rootEntityId → Set<entityId> (hierarchy)

**Cache Lifecycle**:
1. **Build**: On first access or explicit `buildIndex()` call
2. **Use**: O(1) lookups during clothing attachment
3. **Invalidate**: When anatomy structure changes
4. **Rebuild**: Automatically on next access after invalidation

**Cache Coordination**:
```javascript
// CacheCoordinator manages multiple caches
cacheCoordinator.registerCache('anatomySocketIndex:socketToEntity', socketMap);
cacheCoordinator.registerCache('anatomySocketIndex:entityToSockets', entityMap);
cacheCoordinator.registerCache('anatomySocketIndex:rootEntity', rootCache);

// Event-triggered invalidation
eventBus.on('ANATOMY_STRUCTURE_CHANGED', ({ rootEntityId }) => {
  anatomySocketIndex.invalidateIndex(rootEntityId);
});
```

### Blueprint/Recipe Cache

**Purpose**: Avoid re-parsing JSON on every anatomy generation

**Cache Location**: DataRegistry

**Cache Invalidation**: Mod reload only (blueprints/recipes don't change at runtime)

### Body Descriptor Registry

**Location**: `src/anatomy/registries/bodyDescriptorRegistry.js`

**Purpose**: Centralized source of truth for body descriptor metadata

The Body Descriptor Registry eliminates the need for manual synchronization across multiple files by providing a single, authoritative source for all descriptor configuration.

#### Registry Structure

Each descriptor in the registry contains complete metadata:

```javascript
{
  schemaProperty: 'height',           // Property name in JSON schema (camelCase)
  displayLabel: 'Height',             // Human-readable label
  displayKey: 'height',               // Key in formatting config
  dataPath: 'body.descriptors.height', // Path in body component
  validValues: ['gigantic', 'very-tall', ...], // Valid values or null
  displayOrder: 10,                   // Display priority (lower = earlier)
  extractor: (bodyComponent) => ...,  // Extraction function
  formatter: (value) => ...,          // Formatting function
  required: false,                    // Whether required
}
```

#### Current Descriptors

The registry currently defines 6 descriptors:

- **height** (order: 10) - Enumerated: gigantic, very-tall, tall, average, short, petite, tiny
- **skinColor** (order: 20) - Free-form string
- **build** (order: 30) - Enumerated: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky
- **composition** (order: 40) - Enumerated: underweight, lean, average, soft, chubby, overweight, obese
- **hairDensity** (order: 50) - Enumerated: hairless, sparse, light, moderate, hairy, very-hairy
- **smell** (order: 60) - Free-form string

**Next Available Display Order**: 70

#### API Functions

```javascript
import {
  BODY_DESCRIPTOR_REGISTRY,
  getDescriptorMetadata,
  getAllDescriptorNames,
  getDescriptorsByDisplayOrder,
  validateDescriptorValue,
} from './registries/bodyDescriptorRegistry.js';

// Get specific descriptor metadata
const meta = getDescriptorMetadata('height');

// Get all descriptor names
const names = getAllDescriptorNames();
// Returns: ['height', 'skinColor', 'build', 'composition', 'hairDensity', 'smell']

// Get descriptors sorted by display order
const ordered = getDescriptorsByDisplayOrder();

// Validate a descriptor value
const result = validateDescriptorValue('height', 'tall');
// Returns: { valid: true } or { valid: false, error: "..." }
```

#### Integration Points

**Recipe Processing**:
- Recipes define body descriptors in `bodyDescriptors` field
- AnatomyGenerationWorkflow copies descriptors to body component during generation
- Stored at `body.descriptors.{schemaProperty}` in anatomy:body component

**Validation**:
- `BodyDescriptorValidator` class (`src/anatomy/validators/bodyDescriptorValidator.js`) - System-wide validation with instance methods for comprehensive consistency checks
- `BodyDescriptorValidator` utilities (`src/anatomy/utils/bodyDescriptorValidator.js`) - Runtime validation helpers used by workflows (imported by AnatomyGenerationWorkflow)
- CLI tool (`npm run validate:body-descriptors`) checks system consistency
- Validates: registry completeness, formatting config, recipe descriptors

**Description Generation**:
- `BodyDescriptionComposer` uses registry extractors to retrieve values
- Registry formatters generate display strings
- Display order determines appearance order in descriptions

#### Files Synchronized by Registry

The registry serves as the source of truth for:

1. **JSON Schema** (`data/schemas/anatomy.recipe.schema.json` lines 135-198)
   - Property definitions must match registry `schemaProperty`
   - Enum arrays must match registry `validValues`

2. **Formatting Config** (`data/mods/anatomy/anatomy-formatting/default.json`)
   - `descriptionOrder` array must include all registry `displayKey` values
   - Descriptors missing from this array won't appear in descriptions

3. **Body Component Structure**
   - Descriptors stored at `body.descriptors.{schemaProperty}`
   - Accessed via registry `dataPath` property

#### Validation Tool

**Command**: `npm run validate:body-descriptors`

**Location**: `scripts/validate-body-descriptors.js`

**Validator Class**: `src/anatomy/validators/bodyDescriptorValidator.js` (used by CLI script for comprehensive system validation)

**Runtime Validators**: `src/anatomy/utils/bodyDescriptorValidator.js` (utility functions used during anatomy generation)

**Validates**:
- Registry completeness
- Formatting configuration includes all descriptors
- Sample recipes use valid descriptor values
- System consistency across all files

**CI/CD Integration**:
```yaml
- name: Validate Body Descriptors
  run: npm run validate:body-descriptors
```

#### Adding New Descriptors

To add a new body descriptor:

1. Add entry to `BODY_DESCRIPTOR_REGISTRY` with all 9 properties
2. Update JSON schema in `data/schemas/anatomy.recipe.schema.json`
3. Add `displayKey` to `descriptionOrder` in formatting config
4. Run `npm run validate:body-descriptors` to verify
5. Add tests in `tests/unit/anatomy/registries/bodyDescriptorRegistry.test.js`

**Documentation**: See [Adding Body Descriptors Guide](./adding-body-descriptors.md) for step-by-step instructions

## Extension Points

### Adding New Orientation Schemes

1. Update OrientationResolver (`src/anatomy/shared/orientationResolver.js`)
2. Add new scheme case in `resolveOrientation()` method
3. Update schema (`data/schemas/anatomy.structure-template.schema.json`)
4. Document in [Structure Templates Guide](./structure-templates.md)

### Adding New Pattern Matchers

1. Update RecipePatternResolver (`src/anatomy/recipePatternResolver.js`)
2. Add new matcher method (e.g., `#resolveMatchesX()`)
3. Update schema (`data/schemas/anatomy.recipe.schema.json`)
4. Document in [Recipe Patterns Guide](./recipe-patterns.md)

### Subscribing to Anatomy Events

```javascript
// Register event handler during initialization
eventBus.on('ANATOMY_GENERATED', async (payload) => {
  const { entityId, blueprintId, sockets } = payload;

  // Your custom logic here
  // - Update UI
  // - Trigger animations
  // - Generate descriptions
  // - Validate constraints
  // etc.
});
```

### Custom Validation Hooks

Future extension point for custom validation (planned in ANASYSREF-002):
```javascript
// Custom validator for blueprint-recipe consistency
class BlueprintRecipeValidator {
  validate(blueprint, recipe) {
    // Custom validation logic
    // Returns validation errors or null
  }
}
```

## Performance Considerations

### Generation Performance

- **Blueprint V1**: Fast (explicit slots)
- **Blueprint V2**: Slower (template processing + slot generation)
- **Large limb counts** (>20): Noticeable impact on generation time
- **Complex patterns**: Pattern matching overhead increases with pattern count

### Lookup Performance

- **Socket index**: O(1) after initial O(n) build
- **Without index**: O(n) traversal for each lookup
- **Recommendation**: Always use socket index for production

### Memory Usage

- **Per root entity**: ~3 maps + socket/entity data
- **Typical character**: ~100 KB
- **Complex creature** (50+ parts): ~500 KB
- **Recommendation**: Invalidate indexes for inactive entities

## Related Documentation

- [Structure Templates](./structure-templates.md) - Template syntax and examples
- [Recipe Patterns](./recipe-patterns.md) - Pattern matching guide
- [Body Descriptor Registry](./body-descriptor-registry.md) - Registry architecture and API
- [Adding Body Descriptors](./adding-body-descriptors.md) - Step-by-step guide for adding descriptors
- [Body Descriptor Validator Reference](./body-descriptor-validator-reference.md) - Validator API documentation
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
- [Refactoring History](./refactoring-history.md) - Architectural evolution
- [Testing Guide](../testing/anatomy-testing-guide.md) - Testing patterns
- [Development Guide](../development/anatomy-development-guide.md) - Quick-start for developers

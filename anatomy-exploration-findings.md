# Anatomy Mod Structure Exploration - Complete Findings

## 1. MOD STRUCTURE OVERVIEW

### Data Location: `/data/mods/anatomy/`

**Subdirectories:**
- `components/` - Component definitions (14 files)
- `events/` - Event definitions (10 files)
- `entities/definitions/` - Body part entity definitions (240+ humanoid/creature parts)
- `blueprints/` - Character blueprints (12 files, e.g., human_female.blueprint.json)
- `recipes/` - Anatomy recipes (12 files)
- `libraries/` - Slot libraries (1 file: humanoid.slot-library.json)
- `parts/` - Part definitions (2 files)
- `structure-templates/` - Body structure templates (6 files for different body types)
- `damage-types/` - Damage type definitions (3 files: blunt, piercing, slashing)
- `conditions/` - Condition definitions (2 files)
- `lookups/` - Lookup data (empty)
- `anatomy-formatting/` - Formatting configuration (1 file)

**Key File:** `/data/mods/anatomy/mod-manifest.json`

---

## 2. COMPONENT FILES (data/mods/anatomy/components/)

### Files (14 total):
1. `body.component.json` - Main body component with recipe reference and generated anatomy
2. `part.component.json` - Marks entity as body part with subType, orientation, damage propagation
3. `part_health.component.json` - Health tracking for body parts
4. `joint.component.json` - Joint properties
5. `sockets.component.json` - Socket definitions for attachment points
6. `blueprintSlot.component.json` - Blueprint slot reference
7. `can_grab.component.json` - Grabbing capability (grip strength, held item)
8. `requires_grabbing.component.json` - Requires grabbing to use
9. `bleeding.component.json` - Bleeding status (severity, remaining turns, tick damage)
10. `burning.component.json` - Burning status
11. `poisoned.component.json` - Poison status
12. `fractured.component.json` - Fracture status
13. `stunned.component.json` - Stun status
14. `visibility_rules.component.json` - Visibility rules

### Component Schema Pattern:
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:componentName",
  "description": "...",
  "dataSchema": { /* JSON Schema */ }
}
```

### Key Example - body.component.json:
- **recipeId**: Namespaced ID of anatomy recipe
- **body**: Generated anatomy structure
  - **root**: Entity instance ID of root body part
  - **parts**: Map of part identifiers to entity IDs
  - **descriptors**: Body-level descriptors (build, hairDensity, composition, skinColor, smell, height)

---

## 3. EVENT FILES (data/mods/anatomy/events/)

### Files (10 total):
1. `anatomy_generated.event.json` - Dispatched after anatomy generation completes
2. `part_health_changed.event.json` - Part health modified
3. `part_state_changed.event.json` - Part state changed (health, damage effects)
4. `limb_detached.event.json` - Limb detached/destroyed
5. `interaction_click.event.json` - User click on anatomy visualizer
6. `interaction_pan.event.json` - Pan gesture on visualizer
7. `interaction_panstart.event.json` - Pan start on visualizer
8. `interaction_panend.event.json` - Pan end on visualizer
9. `interaction_zoom.event.json` - Zoom gesture on visualizer
10. `visualizer_state_changed.event.json` - UI visualizer state changed

### Event Schema Pattern:
```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "anatomy:eventName",
  "description": "...",
  "payloadSchema": { /* JSON Schema */ }
}
```

### Key Example - anatomy_generated.event.json:
- **entityId**: Entity ID for which anatomy was generated
- **blueprintId**: Blueprint ID used
- **sockets**: Available sockets array
- **timestamp**: Generation timestamp
- **bodyParts**: Array of body part entity IDs
- **partsMap**: Map of part types to entity IDs
- **slotEntityMappings**: Map of slots to entity IDs

---

## 4. ENTITY DEFINITIONS (data/mods/anatomy/entities/definitions/)

### Scale: 240+ entity files

### Naming Convention: `{bodyPartDescriptor}.entity.json`

### Examples:
- **Human parts**: human_hand.entity.json, human_leg.entity.json, human_male_torso.entity.json
- **Human anatomy variants**: human_breast_d_cup.entity.json, human_penis_thick_large.entity.json
- **Humanoid variants**: humanoid_arm_muscular_hairy.entity.json, humanoid_head_beautiful.entity.json
- **Creature parts**: chicken_wing.entity.json, dragon_tail.entity.json, spider_abdomen.entity.json
- **Special**: blueprint_slot.entity.json, equipment_mount.entity.json

### Entity Definition Pattern:
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:partName",
  "description": "...",
  "components": {
    "anatomy:part": { "subType": "..." },
    "anatomy:part_health": { "currentHealth": N, "maxHealth": N },
    "anatomy:can_grab": { /* if applicable */ },
    "core:name": { "text": "..." }
  }
}
```

### Component Composition Pattern:
- **anatomy:part** - Subtype + orientation (identifies part type)
- **anatomy:part_health** - Health management (currentHealth, maxHealth, state)
- **anatomy:can_grab** - Optional, only for grabbing appendages (gripStrength, heldItemId, locked)
- **core:name** - Display name
- **Additional components** - As needed (joints, sockets, etc.)

### Real Example - human_hand.entity.json:
```json
{
  "anatomy:can_grab": { "gripStrength": 1.0, "heldItemId": null, "locked": false },
  "anatomy:part": { "subType": "hand" },
  "anatomy:part_health": { "currentHealth": 15, "maxHealth": 15, "state": "healthy" },
  "core:name": { "text": "hand" }
}
```

---

## 5. SERVICE ARCHITECTURE (src/anatomy/services/)

### Directory Structure:
```
src/anatomy/services/
├── context/
│   └── activityContextBuildingSystem.js
├── filtering/
│   └── activityFilteringSystem.js
├── grouping/
│   └── activityGroupingSystem.js
├── validation/
│   └── activityConditionValidator.js
├── activityDescriptionFacade.js       ← MAIN FACADE
├── activityDescriptionService.js
├── activityIndexManager.js
├── activityMetadataCollectionSystem.js
├── activityNLGSystem.js
├── anatomySocketIndex.js
├── bleedingTickSystem.js              ← EXAMPLE TICK SYSTEM
├── blueprintProcessorService.js
├── burningTickSystem.js
├── damageTypeEffectsService.js
├── entityMatcherService.js
├── poisonTickSystem.js
└── (20+ additional services)
```

### Service Naming Pattern:
- **Files**: camelCase (`bleedingTickSystem.js`)
- **Classes**: PascalCase (`BleedingTickSystem`)

### Service Structure Template:

#### Constructor Pattern (BleedingTickSystem Example):
```javascript
/**
 * @param {object} deps
 * @param {ILogger} deps.logger
 * @param {EntityManager} deps.entityManager
 * @param {ISafeEventDispatcher} deps.safeEventDispatcher
 * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher
 */
constructor({ logger, entityManager, safeEventDispatcher, validatedEventDispatcher }) {
  super();

  this.#logger = this._init('BleedingTickSystem', logger, {
    entityManager: {
      value: entityManager,
      requiredMethods: ['getComponentData', 'addComponent', 'removeComponent', 'getEntitiesWithComponent'],
    },
    safeEventDispatcher: {
      value: safeEventDispatcher,
      requiredMethods: ['dispatch'],
    },
    validatedEventDispatcher: {
      value: validatedEventDispatcher,
      requiredMethods: ['subscribe'],
    },
  });

  this.#entityManager = entityManager;
  this.#dispatcher = safeEventDispatcher;
  this.#eventSubscriber = validatedEventDispatcher;

  this.#subscribeToEvents();
}
```

#### Key Characteristics:
1. **Extends BaseService** - `extends BaseService`
2. **Private fields** - Uses `#` prefix for all private class fields
3. **Validation** - Uses `_init()` to validate dependencies
4. **Event subscription** - Services subscribe to events in constructor
5. **Clean up** - Implements `destroy()` method to unsubscribe

### ActivityDescriptionFacade Pattern (Complex Service):

**Orchestrates 7 specialized services:**
1. ActivityCacheManager - Caching with TTL and invalidation
2. ActivityIndexManager - Index building
3. ActivityMetadataCollectionSystem - Metadata collection
4. ActivityNLGSystem - Natural language generation
5. ActivityGroupingSystem - Activity grouping
6. ActivityContextBuildingSystem - Context building
7. ActivityFilteringSystem - Condition filtering

**Dependency Injection Pattern:**
```javascript
constructor({
  logger,
  entityManager,
  anatomyFormattingService,
  cacheManager,
  indexManager,
  metadataCollectionSystem,
  nlgSystem,
  groupingSystem,
  contextBuildingSystem,
  filteringSystem,
  activityIndex = null,
  eventBus = null,
}) {
  // Validate all dependencies
  validateDependency(service, 'ServiceName', logger, {
    requiredMethods: ['method1', 'method2']
  });
  
  // Assign and use
}
```

---

## 6. DEPENDENCY INJECTION PATTERNS

### DI Token Location: `src/dependencyInjection/tokens/tokens-core.js`

### Anatomy-Related Tokens (examples):
```javascript
// Loaders
AnatomyRecipeLoader: 'AnatomyRecipeLoader',
AnatomyBlueprintLoader: 'AnatomyBlueprintLoader',
AnatomyBlueprintPartLoader: 'AnatomyBlueprintPartLoader',
AnatomySlotLibraryLoader: 'AnatomySlotLibraryLoader',
AnatomyFormattingLoader: 'AnatomyFormattingLoader',
AnatomyStructureTemplateLoader: 'AnatomyStructureTemplateLoader',
DamageTypeLoader: 'DamageTypeLoader',

// Services
DamageTypeEffectsService: 'DamageTypeEffectsService',
BleedingTickSystem: 'BleedingTickSystem',
BurningTickSystem: 'BurningTickSystem',
PoisonTickSystem: 'PoisonTickSystem',
BodyBlueprintFactory: 'BodyBlueprintFactory',
GraphIntegrityValidator: 'GraphIntegrityValidator',
BodyGraphService: 'BodyGraphService',
AnatomyGenerationService: 'AnatomyGenerationService',
AnatomyInitializationService: 'AnatomyInitializationService',
AnatomyDescriptionService: 'AnatomyDescriptionService',
AnatomyFormattingService: 'AnatomyFormattingService',
ActivityDescriptionService: 'ActivityDescriptionService',
LayerCompatibilityService: 'LayerCompatibilityService',
SlotResolver: 'SlotResolver',
PartSelectionService: 'PartSelectionService',
SocketManager: 'SocketManager',

// Interfaces (I-prefixed)
IAnatomyBlueprintRepository: 'IAnatomyBlueprintRepository',
IRecipeValidationRunner: 'IRecipeValidationRunner',
IAnatomySocketIndex: 'IAnatomySocketIndex',
IAnatomyCacheCoordinator: 'IAnatomyCacheCoordinator',
IEntityMatcherService: 'IEntityMatcherService',
IBlueprintProcessorService: 'IBlueprintProcessorService',
```

### Token Naming Convention:
- **Services**: PascalCase (no prefix) - `BleedingTickSystem`
- **Interfaces**: I-prefixed PascalCase - `IAnatomySocketIndex`
- **Loaders**: PascalCase + 'Loader' - `AnatomyRecipeLoader`
- **Keep alphabetically sorted**

### Registration Location: `src/dependencyInjection/registrations/orchestrationRegistrations.js`

### Example Service Registration Pattern (from code review):
```javascript
const anatomyFormattingService = c.resolve(tokens.AnatomyFormattingService);
```

---

## 7. REGISTRY PATTERN

### Location: `src/anatomy/registries/bodyDescriptorRegistry.js`

### Purpose:
Single source of truth for body descriptor metadata with 9 properties per descriptor:
- `schemaProperty` - Property name in JSON schema (camelCase)
- `displayLabel` - Human-readable label
- `displayKey` - Key in formatting config (snake_case)
- `dataPath` - Path in body component
- `validValues` - Array of valid values or null
- `displayOrder` - Numeric priority (10, 20, 30, ...)
- `extractor` - Function to extract value from body component
- `formatter` - Function to format value for display
- `required` - Whether descriptor is required

### Current Descriptors (6):
- height (10)
- skinColor (20)
- build (30)
- composition (40)
- hairDensity (50)
- smell (60)

### Next Available Display Order: 70

---

## 8. FILE NAMING CONVENTIONS

### Components: `{name}.component.json`
- Examples: `body.component.json`, `part_health.component.json`

### Events: `{name}.event.json`
- Examples: `anatomy_generated.event.json`, `part_health_changed.event.json`

### Entities: `{descriptor}.entity.json`
- Examples: `human_hand.entity.json`, `dragon_wing.entity.json`

### Blueprints: `{name}.blueprint.json`
- Examples: `human_female.blueprint.json`, `red_dragon.blueprint.json`

### Recipes: `{name}.recipe.json`
- Examples: `human_female.recipe.json`, `giant_forest_spider.recipe.json`

### Services: `{serviceName}.js`
- camelCase with PascalCase class name
- Examples: `bleedingTickSystem.js` (class: BleedingTickSystem)

### Registries: `{name}Registry.js`
- PascalCase: `bodyDescriptorRegistry.js` (class: BodyDescriptorRegistry)

---

## 9. ID NAMESPACE PATTERN

### Format: `{modId}:{identifier}`

### Anatomy Module Examples:
- `anatomy:body` - Component ID
- `anatomy:part` - Component ID
- `anatomy:part_health` - Component ID
- `anatomy:human_hand` - Entity definition ID
- `anatomy:anatomy_generated` - Event ID
- `anatomy:bleeding` - Component ID
- `anatomy:bleeding_started` - Event ID
- `anatomy:bleeding_stopped` - Event ID

### Pattern Rules:
- Namespace is always lowercase (modId)
- Identifier is always lowercase with underscores
- Format: `modId:identifier`

---

## 10. TOP-LEVEL ANATOMY SERVICES (src/anatomy/)

### Main Services (non-subdirectory):
- `anatomyCacheManager.js` (16 KB) - Cache management
- `anatomyDescriptionService.js` (8.6 KB) - Description generation
- `anatomyGenerationService.js` (7.4 KB) - Core generation logic
- `anatomyGraphAlgorithms.js` (9 KB) - Graph algorithms
- `anatomyGraphContext.js` (4.4 KB) - Graph context management
- `anatomyInitializationService.js` (14 KB) - Initialization workflow
- `BodyDescriptionOrchestrator.js` (6.4 KB) - Description orchestration
- `bodyDescriptionComposer.js` (27.6 KB) - Description composition
- `bodyGraphService.js` (12.6 KB) - Body graph operations
- `bodyPartDescriptionBuilder.js` (5.3 KB) - Part description building
- `descriptorFormatter.js` (4.8 KB) - Descriptor formatting
- `entityGraphBuilder.js` (12.4 KB) - Entity graph construction
- `graphIntegrityValidator.js` (4.4 KB) - Validation
- `partSelectionService.js` (18.3 KB) - Part selection logic
- `recipeConstraintEvaluator.js` (9.6 KB) - Recipe constraints
- `recipeProcessor.js` (6.3 KB) - Recipe processing
- `slotGenerator.js` (11 KB) - Slot generation
- `socketGenerator.js` (8 KB) - Socket generation
- `socketManager.js` (7.6 KB) - Socket management

### Subdirectories (specialized services):
- `bodyBlueprintFactory/` - Blueprint factory
- `cache/` - Caching services
- `configuration/` - Configuration
- `constants/` - Constants
- `errors/` - Custom errors
- `facades/` - Facade patterns
- `integration/` - Integration services
- `orchestration/` - Orchestration services
- `recipePatternResolver/` - Recipe patterns
- `repositories/` - Data repositories
- `shared/` - Shared utilities
- `templates/` - Templates
- `utils/` - Utilities
- `validation/` - Validation services
- `validators/` - Validators
- `workflows/` - Workflows

---

## 11. VALIDATION AND CONSTANTS

### Location: `src/anatomy/constants/`

### Files:
- `anatomyConstants.js` - Core anatomy constants
- `bodyDescriptorConstants.js` - Body descriptor constants

### Pattern:
```javascript
// Constants for IDs, enums, defaults
export const COMPONENT_ID = 'anatomy:componentName';
export const EVENT_TYPE = 'anatomy:eventType';
export const SEVERITY_MAP = { minor: 1, moderate: 3, severe: 5 };
```

---

## 12. TICK SYSTEM PATTERN (Special)

### Examples: BleedingTickSystem, BurningTickSystem, PoisonTickSystem

### Characteristics:
1. **Extends BaseService** - All inherit from BaseService
2. **Event subscription** - Subscribe to TURN_ENDED event
3. **Component processing** - Processes entities with specific components
4. **State management** - Decrements duration, applies damage
5. **Event emission** - Dispatches started/stopped events
6. **Cleanup** - Removes component when duration expires or part destroyed

### Key Methods:
- `processTick()` - Main processing method called on turn end
- `destroy()` - Cleanup subscriptions
- `#processBleedingPart()` - Individual entity processing (private)

---

## 13. KEY ARCHITECTURAL PATTERNS OBSERVED

### 1. **Modular Service Organization**
- Facade pattern for complex subsystems (ActivityDescriptionFacade)
- Delegation to specialized services
- Clean separation of concerns

### 2. **Dependency Injection**
- Constructor-based injection with validation
- Token-based service resolution
- Interface-based contracts (I-prefixed)

### 3. **Component-Based Architecture**
- ECS pattern (Entity-Component-System)
- Components are JSON data attached to entities
- Systems process entities based on component presence

### 4. **Event-Driven Communication**
- Event bus for inter-service communication
- Subscription-based event handling
- Component changes trigger events

### 5. **Data-First (Modding-First) Philosophy**
- All game content is data (JSON files in mods)
- Minimal code, maximum configuration
- Services interpret data according to schemas

### 6. **Validation-Heavy Approach**
- Schema validation for all data
- Runtime validation of dependencies
- Clear error messages and suggestions

---

## 14. SUMMARY OF PATTERNS

| Pattern | Location | Example |
|---------|----------|---------|
| Component Definition | `data/mods/anatomy/components/` | body.component.json |
| Entity Definition | `data/mods/anatomy/entities/definitions/` | human_hand.entity.json |
| Event Definition | `data/mods/anatomy/events/` | anatomy_generated.event.json |
| Service Class | `src/anatomy/services/` | BleedingTickSystem |
| DI Token | `src/dependencyInjection/tokens/tokens-core.js` | BleedingTickSystem: 'BleedingTickSystem' |
| DI Registration | `src/dependencyInjection/registrations/` | Factory in orchestrationRegistrations.js |
| Registry | `src/anatomy/registries/` | bodyDescriptorRegistry.js |
| Facade | `src/anatomy/services/` | ActivityDescriptionFacade.js |
| Tick System | `src/anatomy/services/` | bleedingTickSystem.js |

---

## 15. STRUCTURAL INSIGHTS FOR NEW ANATOMY SERVICES

When adding new anatomy services, follow these patterns:

### Component & Entity Files (Mod Data):
```json
// Component: data/mods/anatomy/components/[name].component.json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:[name]",
  "description": "...",
  "dataSchema": { /* Properties and validation rules */ }
}

// Entity: data/mods/anatomy/entities/definitions/[descriptor].entity.json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:[name]",
  "description": "...",
  "components": { /* Component data */ }
}

// Event: data/mods/anatomy/events/[name].event.json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "anatomy:[name]",
  "description": "...",
  "payloadSchema": { /* Event payload schema */ }
}
```

### Service Class (Code):
```javascript
// src/anatomy/services/[serviceName].js
import { BaseService } from '../../utils/serviceBase.js';

class ServiceName extends BaseService {
  #logger;
  #entityManager;
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super();
    
    this.#logger = this._init('ServiceName', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  async someMethod() {
    // Implementation
  }

  destroy() {
    // Cleanup
  }
}

export default ServiceName;
```

### DI Registration:
1. Add token in `src/dependencyInjection/tokens/tokens-core.js`
2. Register factory in `src/dependencyInjection/registrations/orchestrationRegistrations.js`
3. Use via DI container: `const service = c.resolve(tokens.ServiceName)`

---

**End of exploration findings. Ready for implementation.**

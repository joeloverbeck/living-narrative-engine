# BODCLODES: Body Description Composition Architecture

## Technical Analysis for Activity Description Implementation

**Document ID**: BODCLODES-001
**Created**: 2025-10-25
**Purpose**: Architectural analysis of body description composition system to guide Activity section implementation
**Scope**: `src/anatomy/` description generation pipeline

---

## Executive Summary

### System Overview

The Living Narrative Engine's anatomy description system generates formatted natural language descriptions of character bodies through a multi-stage pipeline. The system transforms entity component data into structured text output like:

```
Height: tall
Build: stocky
Body hair: hairy
Hair: short, brown, wavy
Eyes: brown, almond
Torso: hairy, thick
Arms: hairy, muscular
Wearing: brown leather belt | green cotton chore jacket | ...
```

### Key Architectural Patterns

1. **Orchestration Pattern**: Top-level coordinator delegates to specialized services
2. **Template Strategy Pattern**: Pluggable formatting strategies for different part groupings
3. **Configuration-Driven Ordering**: Centralized description order configuration
4. **Service Injection for Extensions**: Equipment service demonstrates extension point pattern
5. **Component-Based Data Model**: ECS architecture with descriptor components

### Critical Insight for Activity Implementation

The **Equipment Description Service** integration (lines 144-154 in `BodyDescriptionComposer.js`) provides the **exact architectural pattern** needed for implementing an Activity section:

```javascript
// Handle equipment descriptions
if (partType === 'equipment' && this.equipmentDescriptionService) {
  const equipmentDescription =
    await this.equipmentDescriptionService.generateEquipmentDescription(
      bodyEntity.id
    );
  if (equipmentDescription) {
    lines.push(equipmentDescription);
  }
  processedTypes.add(partType);
  continue;
}
```

This pattern can be replicated for an **Activity Description Service**.

---

## Architecture Overview

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              BodyDescriptionOrchestrator                     │
│  (Top-level coordinator for description generation)          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ orchestrates
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              BodyDescriptionComposer                         │
│  (Main composition logic - assembles complete description)   │
└──┬──────────────┬──────────────┬────────────────────────────┘
   │              │              │
   │ uses         │ uses         │ uses
   ▼              ▼              ▼
┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐
│Description│  │DescriptionTemplate│  │EquipmentDescription │
│Configuration│  │(Formatting)   │  │Service (Extension)  │
└──────────┘  └────┬─────────┘  └─────────────────────────┘
                   │
                   │ uses
                   ▼
        ┌──────────────────────┐
        │PartGroupingStrategies│
        │  - SinglePartStrategy │
        │  - PairedPartsStrategy│
        │  - MultiplePartsStrategy│
        └──────────────────────┘
```

### Data Flow

```
Entity with Components
    │
    ▼
Extract Body-Level Descriptors (Height, Build, etc.)
    │
    ▼
Extract Body Parts from Graph
    │
    ▼
Group Parts by Type (eyes, arms, legs, etc.)
    │
    ▼
Generate Part Descriptions
    │
    ▼
Apply Formatting Strategies
    │
    ▼
Handle Equipment Extension (INJECTION POINT)
    │
    ▼
Assemble Final Description
    │
    ▼
Formatted Text Output
```

---

## Description Generation Pipeline (Deep Dive)

### Stage 1: Body-Level Descriptors

**Location**: `bodyDescriptionComposer.js:108-125`

**Purpose**: Extract and format top-level body descriptors that aren't tied to specific anatomy parts.

**Configuration-Driven Order**:

```javascript
// From descriptionConfiguration.js:14-35
_defaultDescriptionOrder = [
  'height', // Body descriptor
  'build', // Body descriptor
  'body_composition', // Body descriptor
  'body_hair', // Body descriptor
  'skin_color', // Body descriptor
  'hair', // Part type
  'eye', // Part type
  // ... more part types
];
```

**Extraction Logic**:

```javascript
// bodyDescriptionComposer.js:404-435
extractBodyLevelDescriptors(bodyEntity) {
  const descriptors = {};

  const heightDescription = this.extractHeightDescription(bodyEntity);
  if (heightDescription) {
    descriptors.height = `Height: ${heightDescription}`;
  }

  const skinColorDescription = this.extractSkinColorDescription(bodyEntity);
  if (skinColorDescription) {
    descriptors.skin_color = `Skin color: ${skinColorDescription}`;
  }

  // ... more descriptors

  return descriptors;
}
```

**Data Source**: Two fallback mechanisms:

1. **Primary**: `bodyComponent.body.descriptors.height` (nested in anatomy:body)
2. **Fallback**: Entity-level descriptor components (deprecated)

**Output Format**: `"Label: value"` pairs (e.g., `"Height: tall"`)

### Stage 2: Body Part Descriptions

**Location**: `bodyDescriptionComposer.js:128-168`

**Purpose**: Process anatomy parts in configured order, applying appropriate formatting strategies.

**Part Grouping**:

```javascript
// bodyDescriptionComposer.js:180-232
groupPartsByType(partIds) {
  const partsByType = new Map();

  for (const partId of partIds) {
    const entity = this.entityFinder.getEntityInstance(partId);
    if (!entity || !entity.hasComponent('anatomy:part')) {
      continue;
    }

    const anatomyPart = entity.getComponentData('anatomy:part');
    const subType = anatomyPart.subType; // 'eye', 'arm', 'leg', etc.

    if (!partsByType.has(subType)) {
      partsByType.set(subType, []);
    }
    partsByType.get(subType).push(entity);
  }

  return partsByType;
}
```

**Strategy Selection**:

```javascript
// descriptionTemplate.js:27-54
formatDescription(partType, parts) {
  const descriptions = this.extractDescriptions(parts);

  // Get the appropriate strategy
  const strategy = this.strategyFactory.getStrategy(
    partType,
    parts,
    descriptions,
    this.config
  );

  // Use the strategy to format the description
  return strategy.format(
    partType,
    parts,
    descriptions,
    this.textFormatter,
    this.config
  );
}
```

**Formatting Strategies**:

1. **SinglePartStrategy**: One part of a type
   - Output: `"Torso: hairy, thick"`

2. **PairedPartsStrategy**: Exactly two parts (eyes, arms, etc.)
   - Same descriptors: `"Eyes: brown, almond"`
   - Different descriptors:
     ```
     Left arm: muscular, hairy
     Right arm: thin, smooth
     ```

3. **MultiplePartsStrategy**: 3+ parts (fallback)
   - Same descriptors: `"Wings: feathered, large"`
   - Different descriptors:
     ```
     Tail 1: long, scaly
     Tail 2: short, furry
     ```

**Critical Pattern**: Parts are **not** formatted individually and concatenated. The strategy receives **all parts of a type** and formats them as a **cohesive unit**.

### Stage 3: Equipment Description Extension

**Location**: `bodyDescriptionComposer.js:144-154`

**Purpose**: Demonstrate extension point pattern for additional description sections.

**Integration Pattern**:

```javascript
// Injected via constructor
constructor({
  bodyPartDescriptionBuilder,
  bodyGraphService,
  entityFinder,
  anatomyFormattingService,
  partDescriptionGenerator,
  equipmentDescriptionService = null, // ← Optional injection
  logger = null,
}) {
  // ...
  this.equipmentDescriptionService = equipmentDescriptionService;
}

// Usage in description loop
for (const partType of descriptionOrder) {
  // Skip body descriptors (already processed)
  if (['build', 'body_composition', 'body_hair', 'skin_color'].includes(partType)) {
    processedTypes.add(partType);
    continue;
  }

  // Handle equipment descriptions
  if (partType === 'equipment' && this.equipmentDescriptionService) {
    const equipmentDescription =
      await this.equipmentDescriptionService.generateEquipmentDescription(
        bodyEntity.id
      );
    if (equipmentDescription) {
      lines.push(equipmentDescription);
    }
    processedTypes.add(partType);
    continue;
  }

  // Process body parts...
}
```

**Key Observations**:

- Service is **optional** (null safety)
- Injected via **constructor dependency**
- Checked within **configured order loop**
- Returns **complete formatted string**
- Async operation supported
- Added to **same lines array** as other sections

### Stage 4: Final Assembly

**Location**: `bodyDescriptionComposer.js:171`

**Purpose**: Join all description sections with newlines.

```javascript
return lines.join('\n');
```

**Output Structure**:

```
Height: tall
Build: stocky
Body hair: hairy
Hair: short, brown, wavy
Eyes: brown, almond
Torso: hairy, thick
Arms: hairy, muscular
Legs: hairy, muscular
Wearing: brown leather belt | green cotton chore jacket | ...
```

---

## Key Components Deep Dive

### 1. BodyDescriptionOrchestrator

**File**: `src/anatomy/BodyDescriptionOrchestrator.js`

**Responsibility**: Top-level coordination for description generation workflows.

**Key Methods**:

```javascript
/**
 * Generate descriptions for all parts of a body and the body itself
 */
async generateAllDescriptions(bodyEntity) {
  // Generate descriptions for all body parts
  const allPartIds = this.#bodyGraphService.getAllParts(bodyComponent.body);
  const partDescriptions =
    this.#partDescriptionGenerator.generateMultiplePartDescriptions(allPartIds);

  // Generate the full body description
  const bodyDescription = await this.generateBodyDescription(bodyEntity);

  return { bodyDescription, partDescriptions };
}

/**
 * Generate the full body description
 */
async generateBodyDescription(bodyEntity) {
  const description =
    await this.#bodyDescriptionComposer.composeDescription(bodyEntity);

  // Error handling for empty descriptions
  if (!description || description.trim() === '') {
    await this.#eventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: `Failed to generate body description for entity "${nameText}"`,
      // ...
    });
  }

  return description;
}
```

**Design Pattern**: Facade pattern providing simple interface to complex subsystem.

### 2. BodyDescriptionComposer

**File**: `src/anatomy/bodyDescriptionComposer.js`

**Responsibility**: Main composition logic assembling complete body descriptions.

**Architecture**:

```javascript
class BodyDescriptionComposer {
  #logger;

  constructor({
    bodyPartDescriptionBuilder,
    bodyGraphService,
    entityFinder,
    anatomyFormattingService,
    partDescriptionGenerator,
    equipmentDescriptionService = null, // ← Extension point
    logger = null,
  }) {
    // Dependency injection
    this.bodyPartDescriptionBuilder = bodyPartDescriptionBuilder;
    this.bodyGraphService = bodyGraphService;
    this.entityFinder = entityFinder;
    this.anatomyFormattingService = anatomyFormattingService;
    this.partDescriptionGenerator = partDescriptionGenerator;
    this.equipmentDescriptionService = equipmentDescriptionService;
    this.#logger = ensureValidLogger(logger, 'BodyDescriptionComposer');

    // Initialize configuration and template services
    this.config = new DescriptionConfiguration(anatomyFormattingService);
    this.descriptionTemplate = new DescriptionTemplate({
      config: this.config,
      textFormatter: new TextFormatter(),
      partDescriptionGenerator: this.partDescriptionGenerator,
    });
  }

  async composeDescription(bodyEntity) {
    // 1. Validation
    // 2. Extract body-level descriptors
    // 3. Group parts by type
    // 4. Process in configured order
    // 5. Handle extensions (equipment, activity, etc.)
    // 6. Assemble final description
  }
}
```

**Critical Flow**:

```javascript
async composeDescription(bodyEntity) {
  // Get all body parts
  const allParts = this.bodyGraphService.getAllParts(bodyComponent.body);
  const partsByType = this.groupPartsByType(allParts);

  const lines = [];
  const descriptionOrder = this.config.getDescriptionOrder();
  const processedTypes = new Set();

  // STAGE 1: Add body-level descriptors
  const bodyLevelDescriptors = this.extractBodyLevelDescriptors(bodyEntity);
  const bodyDescriptorOrder = this.getBodyDescriptorOrder(descriptionOrder);

  for (const descriptorType of bodyDescriptorOrder) {
    if (bodyLevelDescriptors[descriptorType]) {
      lines.push(bodyLevelDescriptors[descriptorType]);
    }
  }

  // STAGE 2 & 3: Process parts and extensions in configured order
  for (const partType of descriptionOrder) {
    // Skip body descriptors (already processed)
    if (['build', 'body_composition', 'body_hair', 'skin_color'].includes(partType)) {
      processedTypes.add(partType);
      continue;
    }

    // EXTENSION POINT: Equipment
    if (partType === 'equipment' && this.equipmentDescriptionService) {
      const equipmentDescription =
        await this.equipmentDescriptionService.generateEquipmentDescription(
          bodyEntity.id
        );
      if (equipmentDescription) {
        lines.push(equipmentDescription);
      }
      processedTypes.add(partType);
      continue;
    }

    // EXTENSION POINT: Activity (future implementation)
    // if (partType === 'activity' && this.activityDescriptionService) {
    //   const activityDescription =
    //     await this.activityDescriptionService.generateActivityDescription(
    //       bodyEntity.id
    //     );
    //   if (activityDescription) {
    //     lines.push(activityDescription);
    //   }
    //   processedTypes.add(partType);
    //   continue;
    // }

    // Process body parts
    if (partsByType.has(partType)) {
      const parts = partsByType.get(partType);
      const structuredLine = this.descriptionTemplate.createStructuredLine(
        partType,
        parts
      );
      if (structuredLine) {
        lines.push(structuredLine);
      }
      processedTypes.add(partType);
    }
  }

  // STAGE 4: Assemble
  return lines.join('\n');
}
```

### 3. DescriptionConfiguration

**File**: `src/anatomy/configuration/descriptionConfiguration.js`

**Responsibility**: Centralized configuration for description ordering and formatting rules.

**Key Configuration**:

```javascript
class DescriptionConfiguration {
  constructor(anatomyFormattingService = null) {
    this.anatomyFormattingService = anatomyFormattingService;

    // Default description order - body descriptors first, then parts
    this._defaultDescriptionOrder = [
      'height', // Body-level
      'build', // Body-level
      'body_composition', // Body-level
      'body_hair', // Body-level
      'skin_color', // Body-level
      'hair', // Part
      'eye', // Part
      'face', // Part
      // ... more parts
      'equipment', // EXTENSION POINT
      // 'activity',      // FUTURE EXTENSION POINT
    ];

    this._defaultPairedParts = new Set([
      'eye',
      'ear',
      'arm',
      'leg',
      'hand',
      'foot',
      'breast',
      'wing',
      'testicle',
    ]);

    this._defaultIrregularPlurals = {
      foot: 'feet',
      tooth: 'teeth',
    };
  }

  getDescriptionOrder() {
    return (
      this.anatomyFormattingService?.getDescriptionOrder?.() || [
        ...this._defaultDescriptionOrder,
      ]
    );
  }

  getPairedParts() {
    return (
      this.anatomyFormattingService?.getPairedParts?.() ||
      new Set(this._defaultPairedParts)
    );
  }

  getIrregularPlurals() {
    return (
      this.anatomyFormattingService?.getIrregularPlurals?.() || {
        ...this._defaultIrregularPlurals,
      }
    );
  }
}
```

**Design Pattern**: Configuration service with fallback defaults and optional service override.

**Critical for Activity Implementation**: Add `'activity'` to the `_defaultDescriptionOrder` array after `'equipment'`.

### 4. DescriptionTemplate

**File**: `src/anatomy/templates/descriptionTemplate.js`

**Responsibility**: Formatting body part descriptions using pluggable strategies.

**Architecture**:

```javascript
class DescriptionTemplate {
  constructor({
    config,
    textFormatter = new TextFormatter(),
    strategyFactory = new PartGroupingStrategyFactory(),
    partDescriptionGenerator = null,
  }) {
    this.config = config;
    this.textFormatter = textFormatter;
    this.strategyFactory = strategyFactory;
    this.partDescriptionGenerator = partDescriptionGenerator;
  }

  formatDescription(partType, parts) {
    if (!parts || parts.length === 0) return '';

    // Extract descriptions from core:description component
    const descriptions = this.extractDescriptions(parts);
    if (descriptions.length === 0) return '';

    // Get the appropriate strategy
    const strategy = this.strategyFactory.getStrategy(
      partType,
      parts,
      descriptions,
      this.config
    );

    // Use the strategy to format the description
    return strategy.format(
      partType,
      parts,
      descriptions,
      this.textFormatter,
      this.config
    );
  }

  extractDescriptions(parts) {
    return parts
      .map((part) => {
        const descComponent = part.getComponentData('core:description');

        // If we have a persisted description, use it
        if (descComponent && descComponent.text) {
          return descComponent.text;
        }

        // If no persisted description, generate on-the-fly
        if (this.partDescriptionGenerator && part.id) {
          return (
            this.partDescriptionGenerator.generatePartDescription(part.id) || ''
          );
        }

        return '';
      })
      .filter((desc) => desc);
  }
}
```

**Strategy Pattern Implementation**: Delegates formatting to specialized strategies based on part configuration.

### 5. Part Grouping Strategies

**File**: `src/anatomy/configuration/partGroupingStrategies.js`

**Responsibility**: Encapsulate different formatting rules for different part configurations.

**Strategy Hierarchy**:

```javascript
class PartGroupingStrategy {
  canHandle(partType, parts, descriptions, config) {
    throw new Error('canHandle must be implemented by subclass');
  }

  format(partType, parts, descriptions, textFormatter, config) {
    throw new Error('format must be implemented by subclass');
  }
}

// Strategy 1: Single part
class SinglePartStrategy extends PartGroupingStrategy {
  canHandle(partType, parts, descriptions, config) {
    return descriptions.length === 1;
  }

  format(partType, parts, descriptions, textFormatter, config) {
    const label = textFormatter.getPartLabel(
      partType,
      1,
      () => partType,
      new Set()
    );
    return textFormatter.formatLabelValue(label, descriptions[0]);
    // Output: "Torso: hairy, thick"
  }
}

// Strategy 2: Paired parts (eyes, ears, arms, legs, etc.)
class PairedPartsStrategy extends PartGroupingStrategy {
  canHandle(partType, parts, descriptions, config) {
    const pairedParts = config.getPairedParts();
    return pairedParts.has(partType) && descriptions.length === 2;
  }

  format(partType, parts, descriptions, textFormatter, config) {
    const allSame = descriptions.every((desc) => desc === descriptions[0]);

    if (allSame) {
      // Same description for both parts
      const label = textFormatter.getPartLabel(
        partType,
        2,
        pluralizer,
        pairedParts
      );
      return textFormatter.formatLabelValue(label, descriptions[0]);
      // Output: "Eyes: brown, almond"
    } else {
      // Different descriptions for left/right
      const lines = [];
      for (let i = 0; i < descriptions.length; i++) {
        const name = names[i] || '';
        if (name.includes('left')) {
          lines.push(
            textFormatter.formatSidedItem('Left', partType, descriptions[i])
          );
        } else if (name.includes('right')) {
          lines.push(
            textFormatter.formatSidedItem('Right', partType, descriptions[i])
          );
        } else {
          lines.push(
            textFormatter.formatIndexedItem(partType, i + 1, descriptions[i])
          );
        }
      }
      return textFormatter.joinLines(lines);
      // Output:
      // Left arm: muscular, hairy
      // Right arm: thin, smooth
    }
  }
}

// Strategy 3: Multiple parts (fallback for any count)
class MultiplePartsStrategy extends PartGroupingStrategy {
  canHandle(partType, parts, descriptions, config) {
    return descriptions.length > 0; // Catch-all
  }

  format(partType, parts, descriptions, textFormatter, config) {
    const allSame = descriptions.every((desc) => desc === descriptions[0]);

    if (allSame) {
      const label = textFormatter.getPartLabel(
        partType,
        descriptions.length,
        pluralizer,
        pairedParts
      );
      return textFormatter.formatLabelValue(label, descriptions[0]);
      // Output: "Wings: feathered, large"
    } else {
      const lines = descriptions.map((desc, index) =>
        textFormatter.formatIndexedItem(partType, index + 1, desc)
      );
      return textFormatter.joinLines(lines);
      // Output:
      // Tail 1: long, scaly
      // Tail 2: short, furry
    }
  }
}

// Strategy factory
class PartGroupingStrategyFactory {
  constructor() {
    this.strategies = [
      new SinglePartStrategy(),
      new PairedPartsStrategy(),
      new MultiplePartsStrategy(), // Must be last (fallback)
    ];
  }

  getStrategy(partType, parts, descriptions, config) {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(partType, parts, descriptions, config)) {
        return strategy;
      }
    }
    throw new Error(`No strategy found for part type: ${partType}`);
  }
}
```

**Design Pattern**: Strategy + Factory patterns for extensible formatting.

**Critical for Activity**: Activity descriptions won't use these strategies - they'll generate their own complete formatted string (like Equipment does).

### 6. EquipmentDescriptionService

**File**: `src/clothing/services/equipmentDescriptionService.js`

**Responsibility**: Generate "Wearing:" descriptions from equipped clothing items.

**Architecture** (Simplified):

```javascript
class EquipmentDescriptionService {
  #logger;
  #entityManager;
  #descriptorFormatter;
  #clothingManagementService;
  #anatomyFormattingService;

  constructor({
    logger,
    entityManager,
    descriptorFormatter,
    clothingManagementService,
    anatomyFormattingService,
  }) {
    // Dependency injection
    this.#entityManager = entityManager;
    this.#descriptorFormatter = descriptorFormatter;
    this.#clothingManagementService = clothingManagementService;
    this.#anatomyFormattingService = anatomyFormattingService;
  }

  /**
   * Generate equipment description for an entity
   */
  async generateEquipmentDescription(entityId) {
    // 1. Get equipped items from clothing management service
    const { items: equippedItems, equippedData } =
      await this.#getEquippedItems(entityId);

    // 2. Calculate exposure descriptions (naked torso, exposed genitals, etc.)
    const exposureNotes = this.#calculateExposureDescriptions(
      equippedData,
      entityId
    );

    if (equippedItems.length === 0 && exposureNotes.length === 0) {
      return '';
    }

    // 3. Group items by category (outerwear, tops, bottoms, etc.)
    const groupedItems = this.#groupItemsByCategory(equippedItems);

    // 4. Generate item descriptions
    const itemDescriptions = await this.#generateItemDescriptions(groupedItems);

    // 5. Format complete equipment description
    return this.#formatEquipmentDescription(itemDescriptions, exposureNotes);
  }

  #formatEquipmentDescription(itemDescriptions, exposureNotes = []) {
    // Get configuration
    const config =
      this.#anatomyFormattingService.getEquipmentIntegrationConfig();

    // Flatten all descriptions in category order
    const allDescriptions = [];
    for (const { descriptions } of itemDescriptions) {
      allDescriptions.push(...descriptions);
    }

    // Format using configuration
    const prefix = config.prefix || 'Wearing: ';
    const suffix = config.suffix || '.';
    const itemSeparator = config.itemSeparator || ' | ';

    // Build sentence with proper grammar
    let baseDescription = '';
    if (allDescriptions.length === 1) {
      baseDescription = `${prefix}${allDescriptions[0]}${suffix}`;
    } else if (allDescriptions.length === 2) {
      baseDescription = `${prefix}${allDescriptions[0]} and ${allDescriptions[1]}${suffix}`;
    } else {
      const lastItem = allDescriptions.pop();
      baseDescription = `${prefix}${allDescriptions.join(itemSeparator)}, and ${lastItem}${suffix}`;
    }

    // Append exposure notes if present
    const exposuresText = exposureNotes.join(' ');
    if (exposuresText) {
      return `${baseDescription} ${exposuresText}`.trim();
    }

    return baseDescription;
  }
}
```

**Key Patterns**:

1. **Service Orchestration**: Coordinates multiple services (ClothingManagement, EntityManager, etc.)
2. **Data Transformation**: Transforms structured component data → natural language
3. **Configuration-Driven**: Uses `anatomyFormattingService.getEquipmentIntegrationConfig()` for formatting rules
4. **Metadata Usage**: Reads `clothing:slot_metadata` component for exposure calculations
5. **Complete Output**: Returns fully formatted string, not individual components

**Output Example**:

```
Wearing: brown leather belt | green cotton chore jacket | deep-navy cotton fitted boxer briefs | green cotton button-down shirt | indigo denim jeans, and sand-beige leather chukka boots.
```

---

## Equipment Integration Pattern (Deep Analysis)

### Integration Architecture

The Equipment service integration demonstrates the **exact pattern** needed for Activity implementation:

```
┌──────────────────────────────────────────────────────────────┐
│            BodyDescriptionComposer                           │
│                                                              │
│  constructor({                                               │
│    // ... other services                                     │
│    equipmentDescriptionService = null, // ← Optional         │
│  }) {                                                        │
│    this.equipmentDescriptionService = equipmentDescriptionService;│
│  }                                                           │
│                                                              │
│  async composeDescription(bodyEntity) {                      │
│    // ... process body descriptors and parts                │
│                                                              │
│    for (const partType of descriptionOrder) {               │
│      // Check if this iteration is for equipment            │
│      if (partType === 'equipment' &&                        │
│          this.equipmentDescriptionService) {                │
│                                                              │
│        const description = await this.equipmentDescriptionService│
│          .generateEquipmentDescription(bodyEntity.id);      │
│                                                              │
│        if (description) {                                    │
│          lines.push(description);                           │
│        }                                                     │
│        processedTypes.add(partType);                        │
│        continue;                                             │
│      }                                                       │
│    }                                                         │
│    return lines.join('\n');                                 │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

### Dependency Injection

**Registration Pattern** (from `worldAndEntityRegistrations.js`):

```javascript
// Equipment service registration
container.register('EquipmentDescriptionService', EquipmentDescriptionService, {
  logger: tokens.ILogger,
  entityManager: tokens.IEntityManager,
  descriptorFormatter: 'DescriptorFormatter',
  clothingManagementService: 'ClothingManagementService',
  anatomyFormattingService: 'AnatomyFormattingService',
});

// BodyDescriptionComposer registration
container.register('BodyDescriptionComposer', BodyDescriptionComposer, {
  bodyPartDescriptionBuilder: 'BodyPartDescriptionBuilder',
  bodyGraphService: 'BodyGraphService',
  entityFinder: tokens.IEntityFinder,
  anatomyFormattingService: 'AnatomyFormattingService',
  partDescriptionGenerator: 'PartDescriptionGenerator',
  equipmentDescriptionService: 'EquipmentDescriptionService', // ← Injected
  logger: tokens.ILogger,
});
```

**For Activity Implementation**: Add similar registration for `ActivityDescriptionService`.

### Configuration Integration

**Equipment Configuration** (from `anatomyFormattingService.js`):

```javascript
getEquipmentIntegrationConfig() {
  return {
    prefix: 'Wearing: ',
    suffix: '.',
    itemSeparator: ' | ',
  };
}
```

**For Activity Implementation**: Add similar `getActivityIntegrationConfig()` method:

```javascript
getActivityIntegrationConfig() {
  return {
    prefix: 'Activity: ',
    suffix: '.',
    // Additional configuration as needed
  };
}
```

### Metadata Usage Pattern

Equipment service demonstrates how to **read component metadata** to determine what to describe:

```javascript
#calculateExposureDescriptions(equippedData, entityId) {
  const exposureNotes = [];

  // Read metadata component
  const slotMetadata = this.#entityManager.getComponentData(
    entityId,
    'clothing:slot_metadata'
  );

  const slotMappings = slotMetadata?.slotMappings;

  // Use metadata to determine descriptions
  if (this.#isSlotUnoccupied(equippedData, 'torso_upper')) {
    exposureNotes.push('Torso is fully exposed.');

    if (this.#slotCoversBreasts(torsoUpperMapping.coveredSockets) &&
        this.#entityHasBreastAnatomy(entityId)) {
      exposureNotes.push('The breasts are exposed.');
    }
  }

  return exposureNotes;
}
```

**For Activity Implementation**: Similar pattern for activity metadata:

```javascript
#collectActivityDescriptions(entityId) {
  const activityDescriptions = [];

  // Find components marked for activity description
  const bodyComponent = this.#entityManager.getComponentData(
    entityId,
    'anatomy:body'
  );

  // Iterate through all parts looking for activity metadata
  for (const partId of this.#getAllPartIds(bodyComponent)) {
    const activityMetadata = this.#entityManager.getComponentData(
      partId,
      'anatomy:activity_metadata' // ← New component type
    );

    if (activityMetadata?.shouldDescribeInActivity) {
      // Generate description for this activity
      const description = this.#formatActivity(activityMetadata);
      activityDescriptions.push(description);
    }
  }

  return activityDescriptions;
}
```

### Async Operation Support

Equipment service is **async** because it coordinates with other services:

```javascript
async generateEquipmentDescription(entityId) {
  // Async call to clothing service
  const { items, equippedData } = await this.#getEquippedItems(entityId);

  // More async operations...
  const itemDescriptions = await this.#generateItemDescriptions(groupedItems);

  return this.#formatEquipmentDescription(itemDescriptions, exposureNotes);
}
```

**For Activity Implementation**: Also use async if needed (e.g., reading from multiple entities):

```javascript
async generateActivityDescription(entityId) {
  // Potentially async operations
  const activities = await this.#collectOngoingActivities(entityId);
  return this.#formatActivities(activities);
}
```

### Testing Considerations

Equipment service has comprehensive test coverage demonstrating what to test:

1. **Service existence check**: `if (this.equipmentDescriptionService)`
2. **Empty result handling**: `if (description) { lines.push(description); }`
3. **Null safety**: Service can be null without breaking
4. **Integration with configuration**: Uses `getEquipmentIntegrationConfig()`
5. **Metadata component reading**: Tests for missing/malformed metadata
6. **Multi-entity coordination**: Tests interaction with ClothingManagementService

---

## Extension Points for Activity Section

### 1. Configuration Extension

**File**: `src/anatomy/configuration/descriptionConfiguration.js`

**Change Required**:

```javascript
this._defaultDescriptionOrder = [
  'height',
  'build',
  'body_composition',
  'body_hair',
  'skin_color',
  'hair',
  'eye',
  'face',
  // ... more parts
  'equipment',
  'activity', // ← ADD THIS LINE
];
```

**Impact**: Activity descriptions will be processed after equipment, following the configured order.

### 2. Service Injection Point

**File**: `src/anatomy/bodyDescriptionComposer.js`

**Change Required**:

```javascript
constructor({
  bodyPartDescriptionBuilder,
  bodyGraphService,
  entityFinder,
  anatomyFormattingService,
  partDescriptionGenerator,
  equipmentDescriptionService = null,
  activityDescriptionService = null, // ← ADD THIS LINE
  logger = null,
}) {
  // ... existing initialization
  this.equipmentDescriptionService = equipmentDescriptionService;
  this.activityDescriptionService = activityDescriptionService; // ← ADD THIS LINE
  this.#logger = ensureValidLogger(logger, 'BodyDescriptionComposer');
  // ...
}
```

**Impact**: Activity service becomes available to composition logic.

### 3. Description Loop Integration

**File**: `src/anatomy/bodyDescriptionComposer.js`

**Change Required** (add after equipment handling):

```javascript
for (const partType of descriptionOrder) {
  // ... existing body descriptor skip logic

  // Handle equipment descriptions
  if (partType === 'equipment' && this.equipmentDescriptionService) {
    // ... existing equipment code
    continue;
  }

  // Handle activity descriptions ← ADD THIS BLOCK
  if (partType === 'activity' && this.activityDescriptionService) {
    const activityDescription =
      await this.activityDescriptionService.generateActivityDescription(
        bodyEntity.id
      );
    if (activityDescription) {
      lines.push(activityDescription);
    }
    processedTypes.add(partType);
    continue;
  }

  // Process body parts
  // ... existing part processing code
}
```

**Impact**: Activity descriptions are generated and inserted in configured position.

### 4. Component Metadata Pattern

**New Component Schema**: `data/schemas/components/anatomy-activity-metadata.schema.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:activity_metadata",
  "description": "Metadata marking components that should be described in Activity section",
  "dataSchema": {
    "type": "object",
    "properties": {
      "shouldDescribeInActivity": {
        "type": "boolean",
        "description": "Whether this component should contribute to activity description"
      },
      "activityType": {
        "type": "string",
        "enum": ["positioning", "interaction", "physical_state", "engagement"],
        "description": "Type of activity this represents"
      },
      "targetEntityId": {
        "type": "string",
        "description": "Optional: Entity ID if activity involves another entity"
      },
      "description": {
        "type": "string",
        "description": "Optional: Override description text"
      }
    },
    "required": ["shouldDescribeInActivity", "activityType"]
  }
}
```

**Usage Example**:

```json
{
  "anatomy:activity_metadata": {
    "shouldDescribeInActivity": true,
    "activityType": "interaction",
    "targetEntityId": "character_2",
    "description": "hugging"
  }
}
```

### 5. Service Interface

**New Service**: `src/anatomy/services/activityDescriptionService.js`

**Skeleton**:

```javascript
/**
 * Service for generating activity descriptions based on component metadata
 */
class ActivityDescriptionService {
  #logger;
  #entityManager;
  #anatomyFormattingService;

  constructor({ logger, entityManager, anatomyFormattingService }) {
    this.#logger = ensureValidLogger(logger, 'ActivityDescriptionService');
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(anatomyFormattingService, 'AnatomyFormattingService');

    this.#entityManager = entityManager;
    this.#anatomyFormattingService = anatomyFormattingService;
  }

  /**
   * Generate activity description for an entity
   *
   * @param {string} entityId - Entity ID to generate activity description for
   * @returns {Promise<string>} Formatted activity description
   */
  async generateActivityDescription(entityId) {
    try {
      this.#logger.debug(
        `Generating activity description for entity: ${entityId}`
      );

      // 1. Find all components with activity metadata
      const activities = this.#collectActivityMetadata(entityId);

      if (activities.length === 0) {
        return '';
      }

      // 2. Format activities into natural language
      return this.#formatActivityDescription(activities);
    } catch (error) {
      this.#logger.error(
        `Failed to generate activity description for entity ${entityId}`,
        error
      );
      return '';
    }
  }

  /**
   * Collect all activity metadata from entity components
   *
   * @param {string} entityId - Entity ID
   * @returns {Array<object>} Activity metadata objects
   * @private
   */
  #collectActivityMetadata(entityId) {
    const activities = [];

    // Get entity instance
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      return activities;
    }

    // Check all entity components for activity metadata
    // This could be optimized by maintaining an index
    const componentIds = entity.getComponentIds?.() || [];

    for (const componentId of componentIds) {
      const component = entity.getComponentData(componentId);

      // Check if component has activity metadata
      if (component?.anatomy_activity_metadata) {
        const metadata = component.anatomy_activity_metadata;

        if (metadata.shouldDescribeInActivity) {
          activities.push({
            componentId,
            activityType: metadata.activityType,
            targetEntityId: metadata.targetEntityId,
            description: metadata.description,
          });
        }
      }
    }

    return activities;
  }

  /**
   * Format activity descriptions into natural language
   *
   * @param {Array<object>} activities - Activity metadata objects
   * @returns {string} Formatted activity description
   * @private
   */
  #formatActivityDescription(activities) {
    const config =
      this.#anatomyFormattingService.getActivityIntegrationConfig();

    const descriptions = [];

    for (const activity of activities) {
      let description = '';

      // Use custom description if provided
      if (activity.description) {
        description = activity.description;
      } else {
        // Generate description from activity type
        description = this.#generateDescriptionFromType(activity);
      }

      if (description) {
        descriptions.push(description);
      }
    }

    if (descriptions.length === 0) {
      return '';
    }

    // Format using configuration
    const prefix = config.prefix || 'Activity: ';
    const suffix = config.suffix || '';
    const separator = config.separator || ', ';

    // Simple concatenation for now (can be enhanced with natural language generation)
    const activityText = descriptions.join(separator);

    return `${prefix}${activityText}${suffix}`;
  }

  /**
   * Generate description from activity type
   *
   * @param {object} activity - Activity metadata
   * @returns {string} Generated description
   * @private
   */
  #generateDescriptionFromType(activity) {
    const { activityType, targetEntityId } = activity;

    // Get target entity name if available
    let targetName = '';
    if (targetEntityId) {
      const targetEntity =
        this.#entityManager.getEntityInstance(targetEntityId);
      const nameComponent = targetEntity?.getComponentData('core:name');
      targetName = nameComponent?.text || targetEntityId;
    }

    // Generate description based on type
    switch (activityType) {
      case 'interaction':
        return targetName ? `interacting with ${targetName}` : 'interacting';

      case 'positioning':
        return targetName ? `positioned with ${targetName}` : 'positioned';

      case 'physical_state':
        return 'in a physical state';

      case 'engagement':
        return targetName ? `engaged with ${targetName}` : 'engaged';

      default:
        return '';
    }
  }
}

export default ActivityDescriptionService;
```

### 6. Configuration Service Extension

**File**: `src/services/anatomyFormattingService.js`

**Change Required**:

```javascript
/**
 * Get activity integration configuration
 *
 * @returns {object} Activity configuration
 */
getActivityIntegrationConfig() {
  return {
    prefix: 'Activity: ',
    suffix: '',
    separator: ', ',
  };
}
```

### 7. Dependency Injection Registration

**File**: `src/dependencyInjection/registrations/worldAndEntityRegistrations.js`

**Change Required**:

```javascript
// Register ActivityDescriptionService
container.register('ActivityDescriptionService', ActivityDescriptionService, {
  logger: tokens.ILogger,
  entityManager: tokens.IEntityManager,
  anatomyFormattingService: 'AnatomyFormattingService',
});

// Update BodyDescriptionComposer registration
container.register('BodyDescriptionComposer', BodyDescriptionComposer, {
  bodyPartDescriptionBuilder: 'BodyPartDescriptionBuilder',
  bodyGraphService: 'BodyGraphService',
  entityFinder: tokens.IEntityFinder,
  anatomyFormattingService: 'AnatomyFormattingService',
  partDescriptionGenerator: 'PartDescriptionGenerator',
  equipmentDescriptionService: 'EquipmentDescriptionService',
  activityDescriptionService: 'ActivityDescriptionService', // ← ADD THIS
  logger: tokens.ILogger,
});
```

---

## Technical Recommendations

### Implementation Approach

#### Phase 1: Minimal Viable Implementation

1. **Create Component Schema** (`anatomy:activity_metadata`)
   - Define minimal schema with `shouldDescribeInActivity` flag
   - Add validation rules

2. **Create Activity Description Service**
   - Implement basic service following Equipment pattern
   - Start with simple string concatenation
   - Return empty string if no activities

3. **Integrate into Composer**
   - Add service injection
   - Add configuration order entry
   - Add description loop handling

4. **Create Basic Tests**
   - Service returns empty for no activities
   - Service formats single activity
   - Service integrates with composer
   - Null safety tests

#### Phase 2: Enhanced Formatting

1. **Improve Natural Language Generation**
   - Use entity names from target references
   - Handle verb conjugation properly
   - Support multiple simultaneous activities

2. **Add Activity Types**
   - Positioning activities (kneeling, straddling, etc.)
   - Interaction activities (hugging, holding hands, etc.)
   - Physical state activities (bending over, lying down, etc.)
   - Engagement activities (mouth engagement, etc.)

3. **Configuration Enhancement**
   - Support customizable prefixes/suffixes
   - Add separator configuration
   - Support prioritization rules

#### Phase 3: Advanced Features

1. **Context-Aware Descriptions**
   - Use relationship context for better phrasing
   - Consider spatial positioning
   - Account for ongoing actions vs. states

2. **Metadata Enrichment**
   - Add priority levels for multiple activities
   - Support custom description overrides
   - Enable conditional visibility rules

3. **Performance Optimization**
   - Cache activity metadata lookups
   - Index components with activity metadata
   - Lazy load entity references

### Component Design Patterns

#### 1. Follow Equipment Service Structure

```javascript
class ActivityDescriptionService {
  // Same dependency pattern
  #logger;
  #entityManager;
  #anatomyFormattingService;

  constructor({ logger, entityManager, anatomyFormattingService }) {
    // Validation
    // Assignment
  }

  // Main public interface (async)
  async generateActivityDescription(entityId) {
    // Orchestrate
    // Error handling
    // Return formatted string
  }

  // Private helpers
  #collectActivityMetadata(entityId) {}
  #formatActivityDescription(activities) {}
  #generateDescriptionFromType(activity) {}
}
```

#### 2. Use Metadata Components

Instead of hardcoding logic, use component metadata:

```javascript
// Component on entity or part
{
  "anatomy:activity_metadata": {
    "shouldDescribeInActivity": true,
    "activityType": "interaction",
    "targetEntityId": "character_2",
    "verb": "hugging"
  }
}
```

#### 3. Support Multiple Activities

Actor could be doing multiple things simultaneously:

```javascript
// Entity could have multiple activity metadata components
{
  "positioning:kneeling": {
    "anatomy:activity_metadata": {
      "shouldDescribeInActivity": true,
      "activityType": "positioning",
      "description": "kneeling"
    }
  },
  "interaction:holding_hand": {
    "anatomy:activity_metadata": {
      "shouldDescribeInActivity": true,
      "activityType": "interaction",
      "targetEntityId": "character_2",
      "description": "holding hands with Character 2"
    }
  }
}

// Output: "Activity: kneeling, holding hands with Character 2"
```

### Integration Best Practices

#### 1. Null Safety

Always check if service is injected:

```javascript
if (partType === 'activity' && this.activityDescriptionService) {
  // Use service
}
```

#### 2. Empty String Handling

Service should return empty string, not null/undefined:

```javascript
async generateActivityDescription(entityId) {
  try {
    // ... logic
    if (activities.length === 0) {
      return ''; // ← Empty string, not null
    }
    return formattedDescription;
  } catch (error) {
    this.#logger.error('...', error);
    return ''; // ← Empty string on error
  }
}
```

#### 3. Async Operations

Support async if needed:

```javascript
// In composer
if (partType === 'activity' && this.activityDescriptionService) {
  const activityDescription =
    await this.activityDescriptionService.generateActivityDescription(
      bodyEntity.id
    );
  // ...
}
```

#### 4. Configuration Injection

Use configuration service for all formatting rules:

```javascript
#formatActivityDescription(activities) {
  const config = this.#anatomyFormattingService.getActivityIntegrationConfig();

  const prefix = config.prefix || 'Activity: ';
  const suffix = config.suffix || '';
  // ...
}
```

### Testing Considerations

#### Unit Tests Required

1. **Service Tests** (`tests/unit/anatomy/services/activityDescriptionService.test.js`)
   - Constructor validation
   - Empty activity handling
   - Single activity formatting
   - Multiple activity formatting
   - Entity name resolution
   - Error handling

2. **Integration Tests** (`tests/integration/anatomy/activityDescription.integration.test.js`)
   - Full pipeline with composer
   - Multiple simultaneous activities
   - Target entity name resolution
   - Configuration override behavior

3. **Composer Tests** (update `tests/unit/anatomy/bodyDescriptionComposer.test.js`)
   - Activity service injection
   - Activity in description order
   - Empty activity handling
   - Full description with activities

#### Test Examples

```javascript
describe('ActivityDescriptionService', () => {
  describe('generateActivityDescription', () => {
    it('should return empty string when no activity metadata exists', async () => {
      const service = createService();
      const result = await service.generateActivityDescription('entity_1');
      expect(result).toBe('');
    });

    it('should format single activity', async () => {
      const entity = createEntityWithActivityMetadata({
        shouldDescribeInActivity: true,
        activityType: 'interaction',
        targetEntityId: 'entity_2',
        description: 'hugging Alicia Western',
      });

      const service = createService();
      const result = await service.generateActivityDescription(entity.id);

      expect(result).toBe('Activity: hugging Alicia Western');
    });

    it('should format multiple activities', async () => {
      const entity = createEntityWithMultipleActivities([
        { description: 'kneeling' },
        { description: 'holding hands with Jon Ureña' },
      ]);

      const service = createService();
      const result = await service.generateActivityDescription(entity.id);

      expect(result).toBe('Activity: kneeling, holding hands with Jon Ureña');
    });

    it('should resolve target entity names', async () => {
      const target = createEntity({ id: 'entity_2', name: 'Alicia Western' });
      const actor = createEntityWithActivityMetadata({
        shouldDescribeInActivity: true,
        activityType: 'interaction',
        targetEntityId: 'entity_2',
      });

      const service = createService();
      const result = await service.generateActivityDescription(actor.id);

      expect(result).toContain('Alicia Western');
    });
  });
});
```

### Potential Challenges

#### 1. Entity Reference Resolution

**Challenge**: Resolving target entity names efficiently.

**Solution**: Cache entity lookups or use entity name cache service if available.

```javascript
#resolveEntityName(entityId) {
  // Check cache first
  if (this.#entityNameCache.has(entityId)) {
    return this.#entityNameCache.get(entityId);
  }

  // Resolve from entity manager
  const entity = this.#entityManager.getEntityInstance(entityId);
  const nameComponent = entity?.getComponentData('core:name');
  const name = nameComponent?.text || entityId;

  // Cache for future use
  this.#entityNameCache.set(entityId, name);

  return name;
}
```

#### 2. Component Discovery Performance

**Challenge**: Finding all components with activity metadata could be slow.

**Solution**: Maintain an index of components with activity metadata:

```javascript
// In a dedicated indexing service
class ActivityMetadataIndex {
  #index = new Map(); // entityId → component IDs with metadata

  addActivityMetadata(entityId, componentId) {
    if (!this.#index.has(entityId)) {
      this.#index.set(entityId, new Set());
    }
    this.#index.get(entityId).add(componentId);
  }

  getActivityComponents(entityId) {
    return Array.from(this.#index.get(entityId) || []);
  }
}
```

#### 3. Natural Language Generation Complexity

**Challenge**: Generating natural-sounding descriptions for complex activities.

**Solution**: Start simple, iterate with templates:

```javascript
// Phase 1: Direct description strings
{ description: 'hugging Alicia Western' }

// Phase 2: Template-based generation
{
  activityType: 'interaction',
  verb: 'hugging',
  targetEntityId: 'entity_2'
}
// → "hugging {target.name}"

// Phase 3: Context-aware generation
{
  activityType: 'interaction',
  verb: 'hugging',
  targetEntityId: 'entity_2',
  context: { positioning: 'standing', proximity: 'close' }
}
// → "standing close and hugging {target.name}"
```

#### 4. Multiple Activity Prioritization

**Challenge**: Determining which activities to show when many exist.

**Solution**: Add priority levels to metadata:

```javascript
{
  "anatomy:activity_metadata": {
    "shouldDescribeInActivity": true,
    "activityType": "interaction",
    "priority": 10, // Higher = more important
    "description": "hugging Alicia Western"
  }
}

// In service
#collectActivityMetadata(entityId) {
  const activities = /* ... collect ... */;

  // Sort by priority (descending)
  return activities.sort((a, b) =>
    (b.priority || 0) - (a.priority || 0)
  );
}
```

#### 5. Testing Entity Interactions

**Challenge**: Testing interactions between multiple entities.

**Solution**: Use test bed utilities:

```javascript
describe('Activity with multiple entities', () => {
  it('should describe interaction between two characters', async () => {
    const testBed = createTestBed();

    const jon = testBed.createEntity({
      id: 'jon',
      name: 'Jon Ureña',
    });

    const alicia = testBed.createEntity({
      id: 'alicia',
      name: 'Alicia Western',
    });

    // Add activity metadata to jon
    testBed.addComponent(jon.id, 'positioning:hugging', {
      'anatomy:activity_metadata': {
        shouldDescribeInActivity: true,
        activityType: 'interaction',
        targetEntityId: alicia.id,
        description: 'hugging',
      },
    });

    const service = testBed.getService('ActivityDescriptionService');
    const result = await service.generateActivityDescription(jon.id);

    expect(result).toBe('Activity: hugging Alicia Western');
  });
});
```

---

## Implementation Checklist

### Minimal Viable Implementation

- [ ] **Create component schema**
  - [ ] `data/schemas/components/anatomy-activity-metadata.schema.json`
  - [ ] Define required fields: `shouldDescribeInActivity`, `activityType`
  - [ ] Add optional fields: `targetEntityId`, `description`, `priority`
  - [ ] Register schema in schema loader

- [ ] **Create service**
  - [ ] `src/anatomy/services/activityDescriptionService.js`
  - [ ] Implement constructor with dependency validation
  - [ ] Implement `generateActivityDescription(entityId)`
  - [ ] Implement `#collectActivityMetadata(entityId)`
  - [ ] Implement `#formatActivityDescription(activities)`
  - [ ] Add error handling and logging

- [ ] **Update configuration**
  - [ ] Add `'activity'` to `descriptionConfiguration.js` order
  - [ ] Add `getActivityIntegrationConfig()` to `anatomyFormattingService.js`

- [ ] **Integrate into composer**
  - [ ] Add `activityDescriptionService` to constructor parameters
  - [ ] Add activity handling in `composeDescription()` loop
  - [ ] Ensure proper async support

- [ ] **Register in DI container**
  - [ ] Register `ActivityDescriptionService` in `worldAndEntityRegistrations.js`
  - [ ] Update `BodyDescriptionComposer` registration with activity service dependency

- [ ] **Create unit tests**
  - [ ] Test service with no activities (empty string)
  - [ ] Test service with single activity
  - [ ] Test service with multiple activities
  - [ ] Test entity name resolution
  - [ ] Test error handling

- [ ] **Create integration tests**
  - [ ] Test full pipeline through composer
  - [ ] Test configuration override
  - [ ] Test with multiple entities

### Enhanced Features (Future)

- [ ] **Natural language improvements**
  - [ ] Implement verb conjugation
  - [ ] Add contextual phrasing
  - [ ] Support relationship-aware descriptions

- [ ] **Performance optimizations**
  - [ ] Implement activity metadata indexing
  - [ ] Add entity name caching
  - [ ] Optimize component discovery

- [ ] **Advanced metadata**
  - [ ] Add priority levels
  - [ ] Support conditional visibility
  - [ ] Enable custom description overrides

---

## Appendix: Code Reference Map

### Key Files by Responsibility

| Responsibility                  | File Path                                                              |
| ------------------------------- | ---------------------------------------------------------------------- |
| **Top-level orchestration**     | `src/anatomy/BodyDescriptionOrchestrator.js`                           |
| **Main composition logic**      | `src/anatomy/bodyDescriptionComposer.js`                               |
| **Configuration**               | `src/anatomy/configuration/descriptionConfiguration.js`                |
| **Formatting templates**        | `src/anatomy/templates/descriptionTemplate.js`                         |
| **Text utilities**              | `src/anatomy/templates/textFormatter.js`                               |
| **Formatting strategies**       | `src/anatomy/configuration/partGroupingStrategies.js`                  |
| **Part description generation** | `src/anatomy/PartDescriptionGenerator.js`                              |
| **Part description building**   | `src/anatomy/bodyPartDescriptionBuilder.js`                            |
| **Equipment extension**         | `src/clothing/services/equipmentDescriptionService.js`                 |
| **Dependency injection**        | `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` |
| **Formatting service**          | `src/services/anatomyFormattingService.js`                             |

### Key Patterns by Location

| Pattern                        | Location                         | Lines   |
| ------------------------------ | -------------------------------- | ------- |
| **Service injection**          | `bodyDescriptionComposer.js`     | 15-39   |
| **Extension point**            | `bodyDescriptionComposer.js`     | 144-154 |
| **Configuration order**        | `descriptionConfiguration.js`    | 14-35   |
| **Strategy selection**         | `descriptionTemplate.js`         | 27-54   |
| **Body descriptor extraction** | `bodyDescriptionComposer.js`     | 404-435 |
| **Part grouping**              | `bodyDescriptionComposer.js`     | 180-232 |
| **Metadata usage**             | `equipmentDescriptionService.js` | 523-564 |
| **Final assembly**             | `bodyDescriptionComposer.js`     | 171     |

### Example Output Format

```
Height: tall                              ← Body descriptor
Build: stocky                             ← Body descriptor
Body hair: hairy                          ← Body descriptor
Head: bearded                             ← Part (single)
Hair: short, brown, wavy                  ← Part (single)
Eyes: brown, almond                       ← Part (paired, same)
Torso: hairy, thick                       ← Part (single)
Arms: hairy, muscular                     ← Part (paired, same)
Legs: hairy, muscular                     ← Part (paired, same)
Ass: firm, thick                          ← Part (single)
Pubic hair: curly                         ← Part (single)
Penis: large, meaty, thick                ← Part (single)
Testicles: thick                          ← Part (single)
Wearing: brown leather belt | green...    ← Extension (equipment)
Activity: Jon Ureña is hugging Alicia Western  ← NEW EXTENSION
```

---

## Conclusion

The body description composition system follows a well-structured, extensible architecture that makes adding an "Activity:" section straightforward. By following the **Equipment Description Service** pattern, implementing the Activity feature requires:

1. **Component Schema**: Define `anatomy:activity_metadata` for marking activity-related components
2. **Service Implementation**: Create `ActivityDescriptionService` following Equipment pattern
3. **Configuration Update**: Add `'activity'` to description order
4. **Integration**: Inject service into `BodyDescriptionComposer` and handle in description loop
5. **Testing**: Comprehensive unit and integration tests

The architecture's separation of concerns, dependency injection, and configuration-driven design ensure that this extension can be implemented without modifying core anatomy logic, maintaining system stability and testability.

**Next Steps**: Follow the implementation checklist to build the minimal viable Activity section, then iterate with enhanced features based on user needs.

---

**End of Document**

# Damage Simulator Tool - Brainstorming Document

## Executive Summary

This document outlines the design for a new developer tool page called "Damage Simulator" that allows users to:
1. Select anatomy recipes and visualize body parts hierarchically
2. Compose custom damage capabilities for simulated attacks
3. Apply damage through the real APPLY_DAMAGE handler
4. View real-time analytics on damage outcomes and hit probability distributions

The tool will share significant code with the existing `anatomy-visualizer.html` while providing unique damage-focused functionality.

---

## 1. Current System Analysis

### 1.1 APPLY_DAMAGE Handler Overview

**Location**: `src/logic/operationHandlers/applyDamageHandler.js` (703 lines)

**Key Flow**:
```
APPLY_DAMAGE Handler
    ├─ Validates params & resolves entity/part references
    ├─ Manages hit location caching (reuses location in same action)
    ├─ Selects random part if no explicit part_ref (weighted selection)
    └─ Delegates to DamageResolutionService
         ├─ Updates health component
         ├─ Classifies severity
         ├─ Applies damage type effects (DamageTypeEffectsService)
         │   ├─ Dismemberment (priority 1, exits early if triggered)
         │   ├─ Fracture (priority 2, may trigger stun)
         │   ├─ Bleed (priority 3)
         │   ├─ Burn (priority 4)
         │   └─ Poison (priority 5)
         ├─ Propagates damage to children (DamagePropagationService)
         ├─ Evaluates death conditions (DeathCheckService)
         └─ Composes narrative (DamageNarrativeComposer)
```

**Key Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `entity_ref` | string/object | Target entity (placeholders: primary, secondary, tertiary) |
| `part_ref` | string/object | Specific part (optional, random if missing) |
| `damage_entry` | object | `{ name, amount, [metadata], [damage_tags] }` |
| `damage_multiplier` | number | Multiplier (default: 1) |
| `exclude_damage_types` | array | Types to skip |

### 1.2 Damage Capability Schema

**Location**: `data/schemas/damage-capability-entry.schema.json`

```json
{
  "name": "slashing",           // Required: damage type identifier
  "amount": 10,                 // Required: base damage (≥0)
  "penetration": 0.3,           // Optional: internal propagation weight (0-1)
  "bleed": { "enabled": true, "severity": "moderate", "baseDurationTurns": 3 },
  "fracture": { "enabled": true, "thresholdFraction": 0.5, "stunChance": 0.15 },
  "burn": { "enabled": true, "dps": 2, "durationTurns": 3, "canStack": true },
  "poison": { "enabled": true, "tickDamage": 1, "durationTurns": 3, "scope": "part" },
  "dismember": { "enabled": true, "thresholdFraction": 0.7 },
  "flags": ["magical", "silver"]  // Custom extensibility
}
```

### 1.3 Hit Probability Weight System

**Location**: `src/anatomy/utils/hitProbabilityWeightUtils.js`

- `hit_probability_weight` on `anatomy:part` component controls targeting probability
- Weight 0 = internal organ (never targeted directly)
- Default weight = 1.0 for parts without explicit value
- Example weights: torso=100, head=18, arm=8, leg=11, hair=0.25, vagina=2

**Selection Algorithm**:
```javascript
// Weighted random selection
const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
const roll = rng.random() * totalWeight;
let cumulative = 0;
for (const part of parts) {
  cumulative += part.weight;
  if (roll <= cumulative) return part;
}
```

### 1.4 Anatomy Visualizer Architecture

**Location**: `anatomy-visualizer.html` + `src/anatomy-visualizer.js`

**Key Services (Reusable)**:
| Service | Purpose | Reusability |
|---------|---------|-------------|
| `VisualizerStateController` | State machine + async loading | HIGH - generic |
| `AnatomyLoadingDetector` | Polls for anatomy completion | HIGH - generic |
| `VisualizationComposer` | Graph data structure builder | MEDIUM - needs adaptation |
| `EntityManager` | Entity CRUD operations | CORE - already shared |
| `IDataRegistry` | Entity definition access | CORE - already shared |

**Recipe Selection Flow**:
```
Dropdown.change → _loadEntity(defId)
  ├─ entityManager.createEntityInstance(defId)
  ├─ VisualizerStateController.selectEntity(instanceId)
  │   ├─ AnatomyLoadingDetector.waitForEntityWithAnatomy()
  │   └─ State: IDLE → LOADING → LOADED
  └─ Render graph on LOADED state
```

---

## 2. Proposed Architecture

### 2.1 File Structure

```
/
├─ damage-simulator.html                    # New page entry point
├─ css/damage-simulator.css                 # Page-specific styles
├─ src/
│   ├─ damage-simulator.js                  # Entry point (mirrors anatomy-visualizer.js)
│   ├─ domUI/
│   │   ├─ damage-simulator/
│   │   │   ├─ DamageSimulatorUI.js          # Main UI controller
│   │   │   ├─ HierarchicalAnatomyRenderer.js # Card-based anatomy display
│   │   │   ├─ DamageCapabilityComposer.js    # Damage configuration UI
│   │   │   ├─ DamageAnalyticsPanel.js        # Analytics display
│   │   │   ├─ DamageExecutionService.js      # Damage application bridge
│   │   │   └─ HitProbabilityCalculator.js    # Hit chance analytics
│   │   └─ shared/                            # Refactored shared code
│   │       ├─ RecipeSelectorService.js       # Extract from AnatomyVisualizerUI
│   │       ├─ EntityLoadingService.js        # Extract loading logic
│   │       └─ AnatomyDataExtractor.js        # Extract anatomy traversal
│   └─ dependencyInjection/
│       └─ registrations/
│           └─ damageSimulatorRegistrations.js
├─ tests/
│   ├─ unit/domUI/damage-simulator/
│   └─ integration/damage-simulator/
└─ esbuild.damage-simulator.config.js
```

### 2.2 Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    damage-simulator.html                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Recipe Selector (shared with anatomy-visualizer)       │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────────────┐   │
│  │   Hierarchical       │  │   Damage Capability          │   │
│  │   Anatomy Display    │  │   Composer                   │   │
│  │                      │  │                              │   │
│  │   ┌─ Torso [100HP]  │  │   ┌─ Damage Type ─────────┐ │   │
│  │   │  ├─ Head [50HP] │  │   │  [slashing ▼]         │ │   │
│  │   │  │  ├─ L.Eye    │  │   └────────────────────────┘ │   │
│  │   │  │  └─ R.Eye    │  │   ┌─ Amount ──────────────┐ │   │
│  │   │  ├─ L.Arm [25HP]│  │   │  [10] slider          │ │   │
│  │   │  └─ R.Arm [25HP]│  │   └────────────────────────┘ │   │
│  │   └─ ...            │  │   ┌─ Effects ─────────────┐ │   │
│  │                      │  │   │  [x] Bleed           │ │   │
│  └──────────────────────┘  │   │  [ ] Fracture        │ │   │
│                            │   │  [ ] Dismember       │ │   │
│                            │   └────────────────────────┘ │   │
│                            │                              │   │
│                            │   [ Apply Damage ]           │   │
│                            └──────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   Analytics Panel                                        │   │
│  │                                                          │   │
│  │   Hits to Destroy:           Hit Probability:           │   │
│  │   ├─ Torso: 10 hits          ├─ Torso: 65.4%           │   │
│  │   ├─ Head: 5 hits            ├─ Head: 11.8%            │   │
│  │   ├─ L.Arm: 3 hits           ├─ L.Arm: 5.2%            │   │
│  │   └─ R.Eye: 1 hit            └─ R.Eye: 0.8%            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Specifications

### 3.1 Recipe Selection (Reused from Anatomy Visualizer)

**Shared Functionality**:
- Entity definition dropdown population (filter by `anatomy:body` component)
- Entity instance creation on selection
- Anatomy loading with polling (AnatomyLoadingDetector)
- State management (VisualizerStateController pattern)

**Refactoring Opportunity**:
Extract from `AnatomyVisualizerUI`:
```javascript
// Current: AnatomyVisualizerUI._populateEntitySelector()
// Refactor to: RecipeSelectorService.populateSelector(selectElement, registry)

class RecipeSelectorService {
  populateSelector(selectElement, registry) {
    const definitions = registry.getAllEntityDefinitions();
    const anatomyDefs = definitions.filter(def =>
      def.components?.['anatomy:body']
    );
    // ... populate options
  }

  async loadEntityForVisualization(defId, entityManager, stateController) {
    // Extracted entity creation + state coordination
  }
}
```

### 3.2 Hierarchical Anatomy Display

**Requirements**:
- Display all body parts as cards in tree structure
- Show parent-child relationships visually (indentation/nesting)
- Display mechanical components only (exclude `descriptors:*` namespace)
- Prominently show health (current/max) on each card
- Show oxygen capacity for respiratory organs
- Update display after each damage application

**Card Structure**:
```
┌──────────────────────────────────────────┐
│  [Part Name]                    [Health] │
│  ─────────────────────────────────────── │
│  Components:                             │
│  • anatomy:part_health                   │
│  • damage-types:damage_capabilities      │
│  • anatomy:sockets (3 slots)             │
│  ─────────────────────────────────────── │
│  Status Effects:                         │
│  • 🩸 Bleeding (2 turns remaining)       │
└──────────────────────────────────────────┘
```

**Health Display**:
```
Health: ███████░░░ 70/100 HP
O2:     ██████████ 10/10
```

**Component Filtering**:
```javascript
// Filter out descriptive components
const mechanicalComponents = Object.entries(components)
  .filter(([id]) => !id.startsWith('descriptors:'))
  .filter(([id]) => !['core:name', 'core:description'].includes(id));
```

**Hierarchy Traversal** (BFS from root):
```javascript
buildHierarchy(bodyData) {
  const root = bodyData.root;
  const hierarchy = { id: root, children: [] };

  // BFS to build tree structure
  const queue = [hierarchy];
  while (queue.length > 0) {
    const node = queue.shift();
    const children = this.getChildParts(node.id);
    for (const child of children) {
      const childNode = { id: child.id, children: [] };
      node.children.push(childNode);
      queue.push(childNode);
    }
  }
  return hierarchy;
}
```

### 3.3 Damage Capability Composer

**Requirements**:
- Allow user to compose damage entry matching schema
- Provide presets from existing weapon definitions
- Enable/disable individual effects with configuration
- Real-time validation against schema

**UI Elements**:
```
┌─ Damage Configuration ──────────────────────┐
│                                             │
│  Preset: [Select weapon...] [Load]          │
│  ────────────────────────────────────────   │
│                                             │
│  Damage Type: [slashing ▼]                  │
│  Base Amount: [────●────] 15                │
│  Penetration: [──●──────] 0.3               │
│                                             │
│  ┌─ Effects ─────────────────────────────┐ │
│  │ [x] Bleed                             │ │
│  │     Severity: [moderate ▼]            │ │
│  │     Duration: [3] turns               │ │
│  │                                       │ │
│  │ [ ] Fracture                          │ │
│  │     Threshold: 50%                    │ │
│  │     Stun Chance: 15%                  │ │
│  │                                       │ │
│  │ [ ] Burn                              │ │
│  │ [ ] Poison                            │ │
│  │ [ ] Dismember                         │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Damage Multiplier: [1.0]                   │
│                                             │
│  Custom Flags: [magical] [+]                │
│                                             │
└─────────────────────────────────────────────┘
```

**Preset Loading**:
```javascript
// Load from existing weapon entities
const weapons = registry.getAllEntityDefinitions()
  .filter(def => def.components?.['damage-types:damage_capabilities']);

// Example: Load rapier preset
loadPreset('vespera_rapier') → {
  entries: [
    { name: 'piercing', amount: 18, penetration: 0.6 },
    { name: 'slashing', amount: 8, penetration: 0.1 }
  ]
}
```

### 3.4 Damage Execution

**Requirements**:
- Apply damage using real APPLY_DAMAGE handler
- Support targeting specific parts OR random selection
- Capture all events for display
- Update anatomy display after each application

**Implementation**:
```javascript
class DamageExecutionService {
  constructor({ applyDamageHandler, entityManager, eventBus }) {
    this.handler = applyDamageHandler;
    this.entityManager = entityManager;
    this.eventBus = eventBus;
  }

  async applyDamage(targetEntityId, damageEntry, options = {}) {
    const params = {
      entity_ref: targetEntityId,
      damage_entry: damageEntry,
      damage_multiplier: options.multiplier || 1,
      part_ref: options.specificPart || undefined  // Random if undefined
    };

    // Create execution context
    const context = this.createExecutionContext();

    // Subscribe to events for result capture
    const results = [];
    const unsub = this.eventBus.subscribe('anatomy:damage_applied', (event) => {
      results.push(event.payload);
    });

    try {
      await this.handler.execute(params, context);
      return { success: true, results };
    } finally {
      unsub();
    }
  }
}
```

**Target Selection UI**:
```
┌─ Target ─────────────────────────────────┐
│  ( ) Random (weighted)                   │
│  (●) Specific Part: [Torso ▼]           │
└──────────────────────────────────────────┘

[ APPLY DAMAGE ]
```

### 3.5 Analytics Panel

**Requirements**:
1. **Hits to Destroy**: Calculate hits needed to reduce each part to 0 HP
2. **Hit Probability**: Show weighted probability of each part being targeted
3. **Effect Probability**: Show chance of triggering each effect
4. **Update in real-time** as damage config changes

**Hits to Destroy Calculation**:
```javascript
calculateHitsToDestroy(partHealth, damageAmount, effects) {
  // Base calculation
  let effectiveDamage = damageAmount;

  // Account for bleeding DOT
  if (effects.bleed?.enabled) {
    const bleedTotal = getBleedTickDamage(effects.bleed.severity)
                      * effects.bleed.baseDurationTurns;
    effectiveDamage += bleedTotal;  // Simplified
  }

  return Math.ceil(partHealth / effectiveDamage);
}
```

**Hit Probability Calculation**:
```javascript
calculateHitProbabilities(parts) {
  const eligible = filterEligibleHitTargets(parts);
  const totalWeight = eligible.reduce((sum, p) => sum + p.weight, 0);

  return eligible.map(part => ({
    id: part.id,
    name: part.name,
    weight: part.weight,
    probability: (part.weight / totalWeight) * 100
  }));
}
```

**Analytics Display**:
```
┌─ Damage Analytics ───────────────────────────────────────────────┐
│                                                                  │
│  ┌─ Hits to Destroy ─────────────┐ ┌─ Hit Probability ────────┐ │
│  │  Part          Hits  Overkill │ │  Part          Chance    │ │
│  │  ─────────────────────────────│ │  ─────────────────────── │ │
│  │  Torso         7     +5 dmg   │ │  Torso         65.4%  ██ │ │
│  │  Head          4     +2 dmg   │ │  Head          11.8%  █  │ │
│  │  Left Arm      2     +0 dmg   │ │  Left Arm       5.2%  ▌  │ │
│  │  Right Arm     2     +0 dmg   │ │  Right Arm      5.2%  ▌  │ │
│  │  Left Eye      1     +5 dmg   │ │  Left Ear       1.3%  ▏  │ │
│  │  ─────────────────────────────│ │  ─────────────────────── │ │
│  │  * With bleed DOT included    │ │  Weight 0 = Not targeted │ │
│  └───────────────────────────────┘ └────────────────────────┘   │
│                                                                  │
│  ┌─ Effect Trigger Analysis ─────────────────────────────────┐  │
│  │  Dismember: Head (15 dmg needed at 0.7 threshold)        │  │
│  │  Fracture:  Any part at 50%+ damage in single hit        │  │
│  │  Bleed:     Every hit (moderate = 3 tick dmg/turn)       │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Code Refactoring Opportunities

### 4.1 Extract Shared Recipe Selector

**Current**: `AnatomyVisualizerUI._populateEntitySelector()` is tightly coupled

**Proposed**: Create `RecipeSelectorService`

```javascript
// src/domUI/shared/RecipeSelectorService.js
export class RecipeSelectorService {
  #registry;
  #logger;

  constructor({ dataRegistry, logger }) {
    this.#registry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Populate a select element with entity definitions that have a specific component
   * @param {HTMLSelectElement} selectElement
   * @param {string} requiredComponent - e.g., 'anatomy:body'
   * @param {Object} options
   */
  populateWithComponent(selectElement, requiredComponent, options = {}) {
    const definitions = this.#registry.getAllEntityDefinitions();
    const filtered = definitions.filter(def =>
      def.components?.[requiredComponent]
    );

    // Sort alphabetically
    filtered.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

    // Clear and populate
    selectElement.innerHTML = '<option value="">Select...</option>';
    for (const def of filtered) {
      const option = document.createElement('option');
      option.value = def.id;
      option.textContent = def.name || def.id;
      selectElement.appendChild(option);
    }

    return filtered;
  }
}
```

**Usage in both tools**:
```javascript
// anatomy-visualizer.js
recipeSelectorService.populateWithComponent(
  entitySelector,
  'anatomy:body'
);

// damage-simulator.js
recipeSelectorService.populateWithComponent(
  entitySelector,
  'anatomy:body'
);
```

### 4.2 Extract Entity Loading Logic

**Current**: Mixed in `AnatomyVisualizerUI._loadEntity()`

**Proposed**: Create `EntityLoadingService`

```javascript
// src/domUI/shared/EntityLoadingService.js
export class EntityLoadingService {
  #entityManager;
  #stateController;
  #logger;

  async loadEntityWithAnatomy(definitionId) {
    // 1. Clear previous
    this.#entityManager.clearAllInstances();

    // 2. Reset state
    this.#stateController.reset();

    // 3. Validate definition has anatomy
    const definition = this.#registry.getEntityDefinition(definitionId);
    if (!definition?.components?.['anatomy:body']) {
      throw new InvalidArgumentError('Definition lacks anatomy:body component');
    }

    // 4. Create instance
    const instanceId = this.#entityManager.createEntityInstance(definitionId);

    // 5. Wait for anatomy via state controller
    await this.#stateController.selectEntity(instanceId);

    return instanceId;
  }
}
```

### 4.3 Extract Anatomy Data Extraction

**Current**: `VisualizationComposer.buildGraphData()` builds graph-specific structure

**Proposed**: Create `AnatomyDataExtractor` for generic traversal

```javascript
// src/domUI/shared/AnatomyDataExtractor.js
export class AnatomyDataExtractor {
  /**
   * Extract hierarchical part data from anatomy:body component
   * @returns {Object} Tree structure with part details
   */
  extractHierarchy(bodyData, entityManager) {
    const root = bodyData.root;
    const visited = new Set();

    const buildNode = (partId) => {
      if (visited.has(partId)) return null;
      visited.add(partId);

      const entity = entityManager.getEntityInstance(partId);
      const components = entity?.components || {};

      // Get children via anatomy:joint
      const children = this.getChildren(partId, bodyData, entityManager);

      return {
        id: partId,
        name: components['core:name']?.name || partId,
        components: this.filterMechanicalComponents(components),
        health: components['anatomy:part_health'],
        children: children.map(buildNode).filter(Boolean)
      };
    };

    return buildNode(root);
  }

  filterMechanicalComponents(components) {
    return Object.fromEntries(
      Object.entries(components).filter(([id]) =>
        !id.startsWith('descriptors:') &&
        !['core:name', 'core:description'].includes(id)
      )
    );
  }
}
```

---

## 5. Additional Beneficial Features

### 5.1 Damage History Log

Track all damage applications in current session:

```
┌─ Damage History ─────────────────────────────────────────────┐
│  #  Time      Part        Damage    Effects         Result   │
│  ─────────────────────────────────────────────────────────── │
│  1  10:23:45  Torso       15 slash  Bleed(mod)      85→70 HP │
│  2  10:23:52  Left Arm    15 slash  Bleed(mod)      25→10 HP │
│  3  10:24:01  Head        15 slash  Bleed+Frac      50→35 HP │
│  4  10:24:15  Torso       15 slash  Bleed(mod)      70→55 HP │
│  ─────────────────────────────────────────────────────────── │
│  Total Damage Dealt: 60 | Hits: 4 | Effects: 4 bleeds, 1 frac│
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Multi-Hit Simulation

Apply multiple hits automatically to test combat scenarios:

```
┌─ Multi-Hit Simulation ─────────────────────────┐
│                                                │
│  Number of Hits: [10]                          │
│  Delay Between: [100ms ▼]                      │
│                                                │
│  Target Mode:                                  │
│  (●) Random (weighted)                         │
│  ( ) Round-robin all parts                     │
│  ( ) Focus single part: [Head ▼]              │
│                                                │
│  [ Run Simulation ]  [ Reset Entity ]          │
└────────────────────────────────────────────────┘
```

### 5.3 Resistance/Vulnerability Testing

Test how resistances affect damage:

```
┌─ Resistance Configuration ─────────────────────┐
│                                                │
│  Add Resistance to Target:                     │
│  [x] Fire Resistance (50% reduction)           │
│  [ ] Slashing Immunity                         │
│  [ ] Bleed Immunity                            │
│                                                │
│  (For testing armor/equipment effects)         │
└────────────────────────────────────────────────┘
```

### 5.4 Export/Import Configurations

Save and load damage configurations:

```javascript
// Export format
{
  "version": "1.0",
  "damageConfig": {
    "entries": [...],
    "multiplier": 1.5
  },
  "targetEntity": "anatomy:humanoid_standard",
  "simulationSettings": {
    "multiHit": 10,
    "targetMode": "random"
  }
}
```

### 5.5 Comparison Mode

Compare two damage configurations side-by-side:

```
┌─ Config A: Rapier ─────────────┐ ┌─ Config B: Longsword ──────────┐
│  18 piercing, 8 slashing       │ │  22 slashing                   │
│  Hits to kill torso: 6         │ │  Hits to kill torso: 5         │
│  Avg bleeding DOT: 9/hit       │ │  Avg bleeding DOT: 9/hit       │
│  Dismember chance: None        │ │  Dismember chance: 30%         │
└────────────────────────────────┘ └────────────────────────────────┘
```

### 5.6 Death Condition Monitoring

Show death state and conditions:

```
┌─ Death Monitoring ─────────────────────────────┐
│                                                │
│  Death Conditions:                             │
│  ├─ Torso destroyed: ❌ (55/100 HP)           │
│  ├─ Head destroyed:  ❌ (50/50 HP)            │
│  └─ Heart destroyed: ❌ (40/40 HP)            │
│                                                │
│  Entity Status: ALIVE                          │
│  Next death check after: Torso damage          │
└────────────────────────────────────────────────┘
```

### 5.7 Damage Type Quick Reference

Inline help showing damage type characteristics:

```
┌─ Quick Reference: Slashing ────────────────────┐
│                                                │
│  Typical Effects:                              │
│  • Moderate-severe bleeding                    │
│  • Can trigger dismemberment at high damage    │
│  • Low penetration (surface wounds)            │
│                                                │
│  Best Against: Unarmored soft tissue           │
│  Weak Against: Armored targets                 │
│                                                │
│  Example Weapons: Longsword, Dagger, Claws     │
└────────────────────────────────────────────────┘
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

```
tests/unit/domUI/damage-simulator/
├─ HierarchicalAnatomyRenderer.test.js
│   ├─ Should render tree structure from anatomy data
│   ├─ Should filter out descriptor components
│   ├─ Should display health bars correctly
│   ├─ Should update after damage application
│   └─ Should handle missing health components
│
├─ DamageCapabilityComposer.test.js
│   ├─ Should validate against schema
│   ├─ Should load weapon presets
│   ├─ Should enable/disable effects correctly
│   └─ Should emit config change events
│
├─ DamageAnalyticsPanel.test.js
│   ├─ Should calculate hits to destroy accurately
│   ├─ Should calculate hit probabilities correctly
│   ├─ Should update on config changes
│   └─ Should handle edge cases (0 weight, 0 damage)
│
├─ HitProbabilityCalculator.test.js
│   ├─ Should filter ineligible parts (weight 0)
│   ├─ Should calculate percentages correctly
│   └─ Should use default weight for missing values
│
└─ DamageExecutionService.test.js
    ├─ Should call handler with correct params
    ├─ Should capture damage events
    └─ Should support specific part targeting
```

### 6.2 Integration Tests

```
tests/integration/damage-simulator/
├─ damageSimulatorWorkflow.integration.test.js
│   ├─ Should load entity and display anatomy
│   ├─ Should apply damage and update display
│   └─ Should track damage history
│
├─ analyticsAccuracy.integration.test.js
│   ├─ Should match actual hits to predictions
│   └─ Should correctly predict effect triggers
│
└─ presetLoading.integration.test.js
    ├─ Should load weapon presets correctly
    └─ Should handle missing weapons gracefully
```

### 6.3 E2E Tests

```
tests/e2e/damage-simulator/
├─ fullDamageWorkflow.e2e.test.js
│   ├─ Select entity → Configure damage → Apply → Verify updates
│   └─ Multi-hit simulation → Verify death conditions
│
└─ uiInteraction.e2e.test.js
    ├─ All controls respond correctly
    └─ Analytics update in real-time
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Estimated: 2-3 days)
1. Create HTML page structure with CSS
2. Set up entry point and DI registrations
3. Implement RecipeSelectorService (shared)
4. Implement EntityLoadingService (shared)
5. Basic entity loading and state management

### Phase 2: Anatomy Display (Estimated: 2 days)
1. Implement HierarchicalAnatomyRenderer
2. Create card component for body parts
3. Add component filtering logic
4. Add health bar visualization
5. Implement oxygen capacity display

### Phase 3: Damage Configuration (Estimated: 2 days)
1. Implement DamageCapabilityComposer
2. Add damage type selection
3. Add effect configuration panels
4. Implement preset loading from weapons
5. Add schema validation

### Phase 4: Damage Execution (Estimated: 1-2 days)
1. Implement DamageExecutionService
2. Wire up to real APPLY_DAMAGE handler
3. Add target selection (random vs specific)
4. Implement display update after damage
5. Add damage history log

### Phase 5: Analytics (Estimated: 2 days)
1. Implement HitProbabilityCalculator
2. Create analytics panel UI
3. Add hits-to-destroy calculation
4. Add effect trigger analysis
5. Implement real-time updates

### Phase 6: Enhancements (Estimated: 2-3 days)
1. Multi-hit simulation
2. Export/import configurations
3. Comparison mode
4. Death condition monitoring
5. Quick reference tooltips

### Phase 7: Testing & Polish (Estimated: 2 days)
1. Unit tests for all components
2. Integration tests for workflows
3. E2E tests for full scenarios
4. Performance optimization
5. Documentation

---

## 8. Technical Considerations

### 8.1 Performance
- Use virtual scrolling for large anatomy trees
- Debounce analytics recalculation on rapid config changes
- Cache hit probability calculations until config changes

### 8.2 State Management
- Reuse VisualizerStateController pattern
- Add damage-specific states (SIMULATING, etc.)
- Track damage history in memory (clear on entity change)

### 8.3 Event Handling
- Subscribe to `anatomy:damage_applied` for result capture
- Subscribe to `anatomy:part_health_changed` for display updates
- Subscribe to `anatomy:*_started` events for effect tracking

### 8.4 Error Handling
- Validate damage config before execution
- Handle missing entities gracefully
- Provide clear error messages for invalid configurations

---

## 9. Open Questions

1. **Should damage history persist across entity changes?**
   - Recommendation: Clear on entity change, but allow export

2. **Should we support custom damage types not in schema?**
   - Recommendation: No, enforce schema compliance

3. **How to handle parts with 0 health already?**
   - Recommendation: Show as "destroyed" with visual indicator

4. **Should analytics show propagation damage separately?**
   - Recommendation: Yes, show primary + propagated damage breakdown

5. **Multi-entity support (target selection from multiple loaded entities)?**
   - Recommendation: Phase 2 feature, start with single entity

---

## 10. Conclusion

The Damage Simulator will be a powerful developer tool for testing and balancing the damage system. By reusing code from the anatomy visualizer and leveraging the existing APPLY_DAMAGE infrastructure, implementation can be efficient while providing significant value for game balancing and debugging.

Key success metrics:
- Accurately predict hits-to-destroy within 10% margin
- Real-time analytics update under 100ms
- Support all existing damage types and effects
- Clear visualization of complex damage outcomes

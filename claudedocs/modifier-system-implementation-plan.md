# Data-Driven Modifier System Implementation Plan

## Executive Summary

This plan details the service architecture for implementing a data-driven modifier system that evaluates conditions from action definitions (`chanceBased.modifiers`) and applies them during chance calculations. The system checks components on actor, targets, and actor's location to collect applicable modifiers and their display tags.

## Current Architecture Analysis

### Existing Services

| Service | Location | Current Role |
|---------|----------|--------------|
| `ModifierCollectorService` | `src/combat/services/ModifierCollectorService.js` | Phase 5 stub - collects modifiers but `#collectActionModifiers` returns `[]` |
| `ChanceCalculationService` | `src/combat/services/ChanceCalculationService.js` | Orchestrates probability calculation, already calls `modifierCollectorService.collectModifiers()` |
| `ProbabilityCalculatorService` | `src/combat/services/ProbabilityCalculatorService.js` | Applies modifiers via `#applyModifiers()`: `(base + totalFlat) * totalPercentage` |
| `JsonLogicEvaluationService` | `src/logic/jsonLogicEvaluationService.js` | Evaluates JSON Logic conditions with custom operators |
| `MultiTargetActionFormatter` | `src/actions/formatters/MultiTargetActionFormatter.js` | Handles `{chance}` placeholder injection |

### Data Flow (Current)

```
ActionDef.chanceBased.modifiers → ModifierCollectorService.collectModifiers()
                                          ↓
                                  { totalFlat: 0, totalPercentage: 1, modifiers: [] }
                                          ↓
                        ProbabilityCalculatorService.calculate()
                                          ↓
                        (baseChance + totalFlat) * totalPercentage
```

### Current Schema (`chanceModifier` definition)

```json
{
  "condition": { "$ref": "condition-container.schema.json" },
  "modifier": { "type": "integer" },
  "description": { "type": "string" }
}
```

---

## Design Decisions

### 1. Modifier Types
Support both **flat** and **percentage** modifiers:
- Flat: `+10`, `-5` (added to base chance)
- Percentage: `1.2` (multiplier, where 1.0 = no change)

### 2. Display Tags
Add new `tag` property for UI display (short labels like "+10% Darkness")

### 3. Location Resolution
Auto-resolve actor's location from `core:position` component

### 4. Condition Evaluation
Leverage existing `JsonLogicEvaluationService` with enriched context containing:
- `actor`: Actor entity with components
- `primary`, `secondary`, `tertiary`: Target entities with components
- `location`: Actor's location entity with components

---

## Architecture Design

### Service Responsibilities

#### 1. `ModifierCollectorService` (MODIFY)
**Current**: Stub returning empty modifiers
**New**: Full implementation

**Responsibilities**:
- Build evaluation context with actor, targets, and location
- Iterate through `actionConfig.modifiers` array
- Evaluate each modifier's condition using `JsonLogicEvaluationService`
- Collect applicable modifiers with their display tags
- Apply stacking rules (already implemented)
- Calculate totals (modify to support percentage)

**New Dependencies**:
- `JsonLogicEvaluationService` - for condition evaluation

#### 2. `ModifierContextBuilder` (NEW SERVICE)
**Location**: `src/combat/services/ModifierContextBuilder.js`

**Responsibilities**:
- Build JSON Logic evaluation context from entity IDs
- Auto-resolve actor's location from `core:position`
- Build component accessor objects for actor, targets, location
- Provide consistent context structure for condition evaluation

#### 3. `ChanceCalculationService` (MINOR MODIFY)
**Changes**:
- Pass resolved target IDs to `modifierCollectorService.collectModifiers()`
- Include modifier tags in display result

#### 4. `MultiTargetActionFormatter` (MODIFY)
**Changes**:
- Accept modifier tags alongside chance value
- Support new `{modifiers}` placeholder or append tags to `{chance}`

---

## Detailed Implementation Plan

### Phase 1: Schema Updates

#### 1.1 Update `chanceModifier` Definition

**File**: `data/schemas/action.schema.json`

```json
"chanceModifier": {
  "type": "object",
  "description": "Conditional modifier to action success probability",
  "properties": {
    "condition": {
      "$ref": "./condition-container.schema.json#",
      "description": "Condition that must be true for modifier to apply. Context includes: actor, primary, secondary, tertiary, location"
    },
    "type": {
      "type": "string",
      "enum": ["flat", "percentage"],
      "default": "flat",
      "description": "flat: adds to chance (e.g., +10), percentage: multiplies chance (e.g., 1.2 = +20%)"
    },
    "value": {
      "type": "number",
      "description": "Modifier value. For flat: integer added to chance. For percentage: multiplier (1.0 = no change, 1.2 = +20%)"
    },
    "tag": {
      "type": "string",
      "description": "Short display label for UI (e.g., '+10% Darkness', '-5% Wounded')"
    },
    "description": {
      "type": "string",
      "description": "Human-readable description of modifier for tooltips"
    },
    "stackId": {
      "type": "string",
      "description": "Optional stacking group. Same stackId uses highest value only"
    }
  },
  "required": ["condition", "value"],
  "additionalProperties": false
}
```

**Migration Note**: Existing `modifier` field renamed to `value`, `type` defaults to "flat" for backward compatibility.

---

### Phase 2: Create ModifierContextBuilder Service

#### 2.1 New Service

**File**: `src/combat/services/ModifierContextBuilder.js`

```javascript
/**
 * @file Builds evaluation context for modifier condition checks
 */

class ModifierContextBuilder {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    // Validate dependencies
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Build context for modifier condition evaluation
   *
   * @param {object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.primaryId] - Primary target ID
   * @param {string} [params.secondaryId] - Secondary target ID
   * @param {string} [params.tertiaryId] - Tertiary target ID
   * @returns {ModifierEvaluationContext}
   */
  buildContext({ actorId, primaryId, secondaryId, tertiaryId }) {
    // Build actor context with components
    const actor = this.#buildEntityContext(actorId);
    
    // Auto-resolve location from actor's core:position
    const locationId = this.#resolveActorLocation(actorId);
    const location = locationId ? this.#buildEntityContext(locationId) : null;
    
    // Build target contexts
    const primary = primaryId ? this.#buildEntityContext(primaryId) : null;
    const secondary = secondaryId ? this.#buildEntityContext(secondaryId) : null;
    const tertiary = tertiaryId ? this.#buildEntityContext(tertiaryId) : null;

    return {
      actor,
      location,
      primary,
      secondary,
      tertiary,
      // Convenience aliases
      target: primary, // Legacy compatibility
    };
  }

  #buildEntityContext(entityId) {
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) return null;

    return {
      id: entityId,
      components: this.#buildComponentsAccessor(entityId),
    };
  }

  #buildComponentsAccessor(entityId) {
    // Create proxy-like object for lazy component access
    const accessor = {};
    const entity = this.#entityManager.getEntityInstance(entityId);
    
    if (entity?.componentTypeIds) {
      for (const componentId of entity.componentTypeIds) {
        Object.defineProperty(accessor, componentId, {
          get: () => this.#entityManager.getComponentData(entityId, componentId),
          enumerable: true,
        });
      }
    }
    
    return accessor;
  }

  #resolveActorLocation(actorId) {
    const position = this.#entityManager.getComponentData(actorId, 'core:position');
    return position?.locationId ?? null;
  }
}

export default ModifierContextBuilder;
```

---

### Phase 3: Implement ModifierCollectorService

#### 3.1 Update ModifierCollectorService

**File**: `src/combat/services/ModifierCollectorService.js`

**Key Changes**:

```javascript
class ModifierCollectorService {
  #entityManager;
  #logger;
  #jsonLogicService;  // NEW
  #contextBuilder;    // NEW

  constructor({ entityManager, logger, jsonLogicEvaluationService, modifierContextBuilder }) {
    // ... validation ...
    this.#jsonLogicService = jsonLogicEvaluationService;
    this.#contextBuilder = modifierContextBuilder;
  }

  /**
   * Collects all applicable modifiers for a chance calculation
   *
   * @param {object} params
   * @param {string} params.actorId
   * @param {string} [params.primaryId] - Primary target ID
   * @param {string} [params.secondaryId] - Secondary target ID
   * @param {string} [params.tertiaryId] - Tertiary target ID
   * @param {object} [params.actionConfig] - Action's chanceBased configuration
   * @returns {ModifierCollection}
   */
  collectModifiers({ actorId, primaryId, secondaryId, tertiaryId, actionConfig }) {
    const allModifiers = [];

    if (actionConfig?.modifiers?.length) {
      // Build evaluation context
      const context = this.#contextBuilder.buildContext({
        actorId,
        primaryId,
        secondaryId,
        tertiaryId,
      });

      // Evaluate each modifier's condition
      for (const modConfig of actionConfig.modifiers) {
        const applicable = this.#evaluateModifierCondition(modConfig, context);
        if (applicable) {
          allModifiers.push(this.#createModifierFromConfig(modConfig));
        }
      }
    }

    // Apply stacking rules (existing)
    const stackedModifiers = this.#applyStackingRules(allModifiers);

    // Calculate totals (updated for percentage support)
    const totals = this.#calculateTotals(stackedModifiers);

    return {
      modifiers: stackedModifiers,
      totalFlat: totals.totalFlat,
      totalPercentage: totals.totalPercentage,
      tags: stackedModifiers.map(m => m.tag).filter(Boolean),
    };
  }

  #evaluateModifierCondition(modConfig, context) {
    if (!modConfig.condition) return true; // No condition = always applies

    try {
      return this.#jsonLogicService.evaluate(modConfig.condition, context);
    } catch (err) {
      this.#logger.warn(`Modifier condition evaluation failed: ${err.message}`);
      return false;
    }
  }

  #createModifierFromConfig(modConfig) {
    return {
      type: modConfig.type ?? 'flat',
      value: modConfig.value ?? modConfig.modifier ?? 0, // Support legacy 'modifier' field
      tag: modConfig.tag ?? null,
      description: modConfig.description ?? null,
      stackId: modConfig.stackId ?? null,
    };
  }

  #calculateTotals(modifiers) {
    let totalFlat = 0;
    let totalPercentage = 1; // Identity for multiplication

    for (const mod of modifiers) {
      if (mod.type === 'flat') {
        totalFlat += mod.value;
      } else if (mod.type === 'percentage') {
        // Percentage modifiers stack multiplicatively
        totalPercentage *= mod.value;
      }
    }

    return { totalFlat, totalPercentage };
  }
}
```

---

### Phase 4: Update ChanceCalculationService

#### 4.1 Pass Target IDs

**File**: `src/combat/services/ChanceCalculationService.js`

**Changes to `calculateForDisplay`**:

```javascript
calculateForDisplay({ actorId, targetId, actionDef, resolvedTargets }) {
  // ... existing skill resolution ...

  // Extract target IDs from resolvedTargets if available
  const primaryId = resolvedTargets?.primary?.[0]?.id ?? targetId;
  const secondaryId = resolvedTargets?.secondary?.[0]?.id;
  const tertiaryId = resolvedTargets?.tertiary?.[0]?.id;

  // Collect modifiers with full target context
  const modifierCollection = this.#modifierCollectorService.collectModifiers({
    actorId,
    primaryId,
    secondaryId,
    tertiaryId,
    actionConfig: chanceBased,
  });

  // ... existing probability calculation ...

  return {
    chance: roundedChance,
    displayText: `${roundedChance}%`,
    modifierTags: modifierCollection.tags, // NEW
    breakdown: {
      // ... existing fields ...
      modifierTags: modifierCollection.tags, // NEW
    },
  };
}
```

---

### Phase 5: Update MultiTargetActionFormatter

#### 5.1 Inject Modifier Tags

**File**: `src/actions/formatters/MultiTargetActionFormatter.js`

**Changes to `#formatCombinations`**:

```javascript
// In the chance calculation block (around line 185-210):
if (canCalculate) {
  const displayResult = _options.chanceCalculationService.calculateForDisplay({
    actorId: _options.actorId,
    targetId,
    actionDef,
    resolvedTargets: combination, // Pass full combination for target context
  });

  // Replace chance placeholder
  template = template.replace(
    '{chance}',
    displayResult.displayText.replace('%', '')
  );

  // NEW: Replace modifiers placeholder if present
  if (template.includes('{modifiers}') && displayResult.modifierTags?.length) {
    const tagsDisplay = displayResult.modifierTags.join(', ');
    template = template.replace('{modifiers}', tagsDisplay);
  } else if (template.includes('{modifiers}')) {
    template = template.replace('{modifiers}', '');
  }
}
```

---

### Phase 6: DI Registration Updates

#### 6.1 Add Token

**File**: `src/dependencyInjection/tokens/tokens-core.js`

```javascript
// Add to tokens object:
ModifierContextBuilder: 'ModifierContextBuilder',
```

#### 6.2 Update Combat Registrations

**File**: `src/dependencyInjection/registrations/combatRegistrations.js`

```javascript
import ModifierContextBuilder from '../../combat/services/ModifierContextBuilder.js';

// Add ModifierContextBuilder registration
registrar.singletonFactory(tokens.ModifierContextBuilder, (c) =>
  new ModifierContextBuilder({
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
  })
);

// Update ModifierCollectorService registration
registrar.singletonFactory(tokens.ModifierCollectorService, (c) =>
  new ModifierCollectorService({
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
    jsonLogicEvaluationService: c.resolve(tokens.JsonLogicEvaluationService),
    modifierContextBuilder: c.resolve(tokens.ModifierContextBuilder),
  })
);
```

---

## Example Usage

### Action Definition with Modifiers

```json
{
  "id": "combat:melee_attack",
  "name": "Attack",
  "template": "Attack {target} ({chance}%){modifiers}",
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": { "component": "skills:melee", "default": 10 },
    "targetSkill": { "component": "skills:defense", "default": 5 },
    "formula": "ratio",
    "modifiers": [
      {
        "condition": {
          "has_component": ["location", "environment:darkness"]
        },
        "type": "flat",
        "value": -10,
        "tag": "-10 Darkness",
        "description": "Reduced accuracy in darkness"
      },
      {
        "condition": {
          "==": [{ "var": "actor.components.status:wounded.severity" }, "severe"]
        },
        "type": "percentage",
        "value": 0.8,
        "tag": "-20% Wounded",
        "description": "Severe wounds reduce effectiveness"
      },
      {
        "condition": {
          "has_component": ["primary", "traits:vulnerable"]
        },
        "type": "flat",
        "value": 15,
        "tag": "+15 Vulnerable",
        "description": "Target is vulnerable to attacks"
      }
    ]
  }
}
```

### Resulting Display

```
Attack Goblin (65%) -10 Darkness, +15 Vulnerable
```

---

## Testing Strategy

### Unit Tests

1. **ModifierContextBuilder**
   - Context building with all entity types
   - Location auto-resolution
   - Missing entity handling

2. **ModifierCollectorService**
   - Condition evaluation with various JSON Logic rules
   - Flat and percentage modifier totals
   - Stacking rules with mixed types
   - Tag collection

3. **ChanceCalculationService**
   - Integration with updated ModifierCollectorService
   - Modifier tags in display result

### Integration Tests

1. **Full Pipeline**
   - Action definition with modifiers
   - Condition evaluation against real entities
   - Display formatting with tags

2. **Edge Cases**
   - Missing target entities
   - Invalid conditions
   - Empty modifier arrays

---

## Migration Considerations

### Backward Compatibility

1. **Schema**: `modifier` field still accepted, mapped to `value` with `type: "flat"`
2. **API**: `collectModifiers` accepts legacy `targetId` parameter (maps to `primaryId`)
3. **Display**: `{modifiers}` placeholder is optional - no change required for existing templates

### Deprecation Warnings

```javascript
if (modConfig.modifier !== undefined) {
  this.#logger.warn(
    `chanceModifier.modifier is deprecated, use 'value' with 'type' instead`
  );
}
```

---

## Critical Files for Implementation

1. **`/home/joeloverbeck/projects/living-narrative-engine/src/combat/services/ModifierCollectorService.js`**
   - Core logic to modify - implement `#collectActionModifiers` and add `JsonLogicEvaluationService` dependency

2. **`/home/joeloverbeck/projects/living-narrative-engine/data/schemas/action.schema.json`**
   - Schema to update - extend `chanceModifier` definition with `type`, `value`, `tag`, `stackId`

3. **`/home/joeloverbeck/projects/living-narrative-engine/src/dependencyInjection/registrations/combatRegistrations.js`**
   - DI registration to update - add `ModifierContextBuilder` and update `ModifierCollectorService` dependencies

4. **`/home/joeloverbeck/projects/living-narrative-engine/src/combat/services/ChanceCalculationService.js`**
   - Minor modification - pass `resolvedTargets` to `collectModifiers` and include `modifierTags` in result

5. **`/home/joeloverbeck/projects/living-narrative-engine/src/actions/formatters/MultiTargetActionFormatter.js`**
   - Pattern to follow for `{modifiers}` placeholder handling - similar to existing `{chance}` injection

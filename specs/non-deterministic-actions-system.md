# Non-Deterministic Actions System Specification

## Overview

This specification defines the architecture for implementing non-deterministic (chance-based) actions in the Living Narrative Engine. The system supports skill-based probability calculations, environmental modifiers, degrees of success/failure, and displays probability percentages in action templates.

**Design Principles:**
- Full extensible service architecture for future combat system
- Data-driven configuration via JSON action schema extensions
- Individual skill components following existing gate patterns
- Probability percentage displayed in action discovery templates

---

## 1. Architecture Overview

```
ACTION DISCOVERY PIPELINE (with chance injection)
┌─────────────────────────────────────────────────────────────────────────────┐
│  Component ───▶ Prerequisite ───▶ Target ───▶ ACTION FORMATTING            │
│  Filtering      Evaluation        Resolution   STAGE                        │
│                                               ┌──────────────────────────┐  │
│                                               │ ChanceCalculationService │  │
│                                               │ - Resolve skills         │  │
│                                               │ - Apply modifiers        │  │
│                                               │ - Calculate probability  │  │
│                                               │ - Inject {chance}%       │  │
│                                               └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

RULE EXECUTION PHASE (outcome resolution)
┌─────────────────────────────────────────────────────────────────────────────┐
│                     RESOLVE_OUTCOME Operation                                │
│                                                                             │
│  ┌─────────────────┐   ┌──────────────────┐   ┌────────────────────┐       │
│  │ SkillResolver   │──▶│ ModifierCollector │──▶│ ProbabilityCalc    │       │
│  │ Service         │   │ Service           │   │ Service            │       │
│  └─────────────────┘   └──────────────────┘   └────────┬───────────┘       │
│                                                         │                   │
│                                               ┌─────────▼───────────┐       │
│                                               │ OutcomeDeterminer   │       │
│                                               │ Service             │       │
│                                               └─────────────────────┘       │
│                                                                             │
│  Output: {                                                                  │
│    outcome: 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'FUMBLE',         │
│    roll: 47, threshold: 55, margin: -8, modifiers: [...]                   │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Layer Architecture

### 2.1 SkillResolverService

**Location:** `src/combat/services/SkillResolverService.js`

**Purpose:** Retrieves skill values from entity components with default fallback.

```javascript
class SkillResolverService {
  constructor({ entityManager, logger }) { ... }

  /**
   * @param {string} entityId - Entity to query
   * @param {string} skillComponentId - e.g., 'skills:melee_skill'
   * @param {number} defaultValue - Fallback if component missing (default: 0)
   * @returns {{ baseValue: number, hasComponent: boolean }}
   */
  getSkillValue(entityId, skillComponentId, defaultValue = 0) { ... }
}
```

**DI Token:** `SkillResolverService`

### 2.2 ModifierCollectorService

**Location:** `src/combat/services/ModifierCollectorService.js`

**Purpose:** Collects and aggregates applicable modifiers from entity buffs, equipment, and environment.

```javascript
class ModifierCollectorService {
  constructor({ entityManager, logger }) { ... }

  /**
   * @param {Object} params
   * @param {string} params.actorId
   * @param {string} params.targetId
   * @param {string} params.locationId
   * @param {Object} params.actionConfig - Action's chance configuration
   * @returns {{
   *   modifiers: Array<{id, source, value, type, description}>,
   *   totalFlat: number,
   *   totalPercentage: number
   * }}
   */
  collectModifiers(params) { ... }
}
```

**Modifier Stacking Rules:**
- Flat modifiers: Sum all applicable
- Percentage modifiers: Applied multiplicatively after flat
- Same-source stacking: Same `stackId` uses highest value only

**DI Token:** `ModifierCollectorService`

### 2.3 ProbabilityCalculatorService

**Location:** `src/combat/services/ProbabilityCalculatorService.js`

**Purpose:** Calculates success probability using configurable formulas.

```javascript
class ProbabilityCalculatorService {
  constructor({ logger }) { ... }

  /**
   * @param {Object} params
   * @param {number} params.actorSkill
   * @param {number} params.targetSkill - For opposed checks
   * @param {number} params.difficulty - For fixed difficulty checks
   * @param {string} params.formula - 'ratio' | 'logistic' | 'linear'
   * @param {Object} params.modifiers - From ModifierCollectorService
   * @param {Object} params.bounds - { min: 5, max: 95 }
   * @returns {{ baseChance: number, finalChance: number, breakdown: Object }}
   */
  calculate(params) { ... }
}
```

**Supported Formulas:**

| Formula | Calculation | Best For |
|---------|-------------|----------|
| `ratio` (default) | `actor / (actor + target) * 100` | Opposed skill checks |
| `logistic` | `100 / (1 + e^(-0.1 * diff))` | Bell-curve distribution |
| `linear` | `50 + (actor - difficulty)` | Fixed difficulty checks |

**DI Token:** `ProbabilityCalculatorService`

### 2.4 OutcomeDeterminerService

**Location:** `src/combat/services/OutcomeDeterminerService.js`

**Purpose:** Resolves final outcome with degrees of success/failure.

```javascript
class OutcomeDeterminerService {
  constructor({ logger }) { ... }

  /**
   * @param {Object} params
   * @param {number} params.finalChance - Calculated probability (0-100)
   * @param {Object} params.thresholds - { criticalSuccess: 5, criticalFailure: 95 }
   * @returns {{
   *   outcome: 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'FUMBLE',
   *   roll: number,
   *   margin: number,
   *   isCritical: boolean
   * }}
   */
  determine(params) { ... }
}
```

**Outcome Thresholds:**
- **CRITICAL_SUCCESS**: Roll <= criticalSuccessThreshold (default 5) AND success
- **SUCCESS**: Roll <= finalChance
- **FAILURE**: Roll > finalChance
- **FUMBLE**: Roll >= criticalFailureThreshold (default 95) AND failure

**DI Token:** `OutcomeDeterminerService`

### 2.5 ChanceCalculationService (Orchestrator)

**Location:** `src/combat/services/ChanceCalculationService.js`

**Purpose:** Orchestrates all services for complete chance calculation. Used by both action discovery (for display) and rule execution (for resolution).

```javascript
class ChanceCalculationService {
  constructor({
    skillResolverService,
    modifierCollectorService,
    probabilityCalculatorService,
    outcomeDeterminerService,
    entityManager,
    logger
  }) { ... }

  /**
   * Calculate chance for action discovery display
   * @returns {{ chance: number, displayText: string, breakdown: Object }}
   */
  calculateForDisplay({ actorId, targetId, actionDef }) { ... }

  /**
   * Resolve outcome for rule execution
   * @returns {{ outcome, roll, threshold, margin, modifiers }}
   */
  resolveOutcome({ actorId, targetId, actionDef }) { ... }
}
```

**DI Token:** `ChanceCalculationService`

---

## 3. Schema Extensions

### 3.1 Action Schema Extension (`data/schemas/action.schema.json`)

Add `chanceBased` optional property:

```json
{
  "chanceBased": {
    "type": "object",
    "description": "Configuration for non-deterministic action with probability calculation",
    "properties": {
      "enabled": { "type": "boolean", "default": false },
      "contestType": {
        "type": "string",
        "enum": ["opposed", "fixed_difficulty"],
        "description": "opposed: actor vs target skill, fixed_difficulty: actor vs static value"
      },
      "actorSkill": {
        "type": "object",
        "properties": {
          "component": { "$ref": "./common.schema.json#/definitions/namespacedId" },
          "property": { "type": "string", "default": "value" },
          "default": { "type": "number", "default": 0 }
        },
        "required": ["component"]
      },
      "targetSkill": {
        "type": "object",
        "properties": {
          "component": { "$ref": "./common.schema.json#/definitions/namespacedId" },
          "property": { "type": "string", "default": "value" },
          "default": { "type": "number", "default": 0 }
        },
        "required": ["component"]
      },
      "fixedDifficulty": { "type": "integer", "minimum": 0 },
      "difficultyModifier": { "type": "integer", "default": 0 },
      "formula": {
        "type": "string",
        "enum": ["ratio", "logistic", "linear"],
        "default": "ratio"
      },
      "bounds": {
        "type": "object",
        "properties": {
          "min": { "type": "integer", "default": 5, "minimum": 0, "maximum": 100 },
          "max": { "type": "integer", "default": 95, "minimum": 0, "maximum": 100 }
        }
      },
      "modifiers": {
        "type": "array",
        "items": { "$ref": "#/$defs/chanceModifier" }
      },
      "outcomes": {
        "type": "object",
        "properties": {
          "criticalSuccessThreshold": { "type": "integer", "default": 5 },
          "criticalFailureThreshold": { "type": "integer", "default": 95 }
        }
      }
    },
    "required": ["enabled", "contestType", "actorSkill"]
  }
}
```

### 3.2 Chance Modifier Definition

Add to action schema `$defs`:

```json
{
  "$defs": {
    "chanceModifier": {
      "type": "object",
      "properties": {
        "condition": { "$ref": "./condition-container.schema.json" },
        "modifier": { "type": "integer" },
        "description": { "type": "string" }
      },
      "required": ["condition", "modifier"]
    }
  }
}
```

### 3.3 RESOLVE_OUTCOME Operation Schema

**File:** `data/schemas/operations/resolveOutcome.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/resolveOutcome.schema.json",
  "title": "RESOLVE_OUTCOME Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "RESOLVE_OUTCOME" },
        "parameters": {
          "type": "object",
          "properties": {
            "actor_skill_component": { "type": "string" },
            "target_skill_component": { "type": "string" },
            "actor_skill_default": { "type": "integer", "default": 0 },
            "target_skill_default": { "type": "integer", "default": 0 },
            "formula": { "type": "string", "enum": ["ratio", "logistic", "linear"], "default": "ratio" },
            "difficulty_modifier": { "type": "integer", "default": 0 },
            "result_variable": { "type": "string" }
          },
          "required": ["actor_skill_component", "result_variable"]
        }
      }
    }
  ]
}
```

---

## 4. Mod Structure

### 4.1 Skills Mod

**Directory:** `data/mods/skills/`

```
data/mods/skills/
├── mod-manifest.json
└── components/
    ├── melee_skill.component.json
    ├── ranged_skill.component.json
    ├── defense_skill.component.json
    ├── dodge_skill.component.json
    └── parry_skill.component.json
```

**mod-manifest.json:**
```json
{
  "id": "skills",
  "version": "1.0.0",
  "name": "Skills System",
  "description": "Character skills for non-deterministic action resolution",
  "dependencies": ["core"]
}
```

**melee_skill.component.json:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "skills:melee_skill",
  "description": "Melee combat proficiency",
  "dataSchema": {
    "type": "object",
    "properties": {
      "value": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 10
      }
    },
    "required": ["value"]
  }
}
```

**defense_skill.component.json:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "skills:defense_skill",
  "description": "Defensive combat skill for avoiding attacks",
  "dataSchema": {
    "type": "object",
    "properties": {
      "value": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 0
      }
    },
    "required": ["value"]
  }
}
```

### 4.2 Damage Types Mod

**Directory:** `data/mods/damage-types/`

```
data/mods/damage-types/
├── mod-manifest.json
└── components/
    └── can_cut.component.json
```

**can_cut.component.json:**
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "damage-types:can_cut",
  "description": "Marker indicating entity can deal cutting damage",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

---

## 5. Example Implementation

### 5.1 Swing Weapon Action

**File:** `data/mods/weapons/actions/swing_at_target.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "weapons:swing_at_target",
  "name": "Swing at Target",
  "description": "Swing a cutting weapon at a target",
  "template": "swing {weapon} at {target} ({chance}%)",
  "generateCombinations": true,
  "required_components": {
    "actor": ["positioning:wielding"],
    "primary": ["weapons:weapon", "damage-types:can_cut"]
  },
  "targets": {
    "primary": {
      "scope": "weapons:wielded_cutting_weapons",
      "placeholder": "weapon",
      "description": "Weapon to swing"
    },
    "secondary": {
      "scope": "core:other_actors_in_location",
      "placeholder": "target",
      "description": "Target to attack"
    }
  },
  "chanceBased": {
    "enabled": true,
    "contestType": "opposed",
    "actorSkill": {
      "component": "skills:melee_skill",
      "property": "value",
      "default": 10
    },
    "targetSkill": {
      "component": "skills:defense_skill",
      "property": "value",
      "default": 0
    },
    "formula": "ratio",
    "bounds": { "min": 5, "max": 95 },
    "outcomes": {
      "criticalSuccessThreshold": 5,
      "criticalFailureThreshold": 95
    }
  }
}
```

### 5.2 Swing Weapon Rule

**File:** `data/mods/weapons/rules/handle_swing_at_target.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_swing_at_target",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "weapons:event-is-action-swing-at-target" },
  "actions": [
    { "type": "GET_NAME", "parameters": { "entity_ref": "actor", "result_variable": "actorName" } },
    { "type": "GET_NAME", "parameters": { "entity_ref": "secondary", "result_variable": "targetName" } },
    { "type": "GET_NAME", "parameters": { "entity_ref": "primary", "result_variable": "weaponName" } },
    {
      "type": "RESOLVE_OUTCOME",
      "parameters": {
        "actor_skill_component": "skills:melee_skill",
        "target_skill_component": "skills:defense_skill",
        "actor_skill_default": 10,
        "target_skill_default": 0,
        "formula": "ratio",
        "result_variable": "attackResult"
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": { "==": [{ "var": "context.attackResult.outcome" }, "CRITICAL_SUCCESS"] },
        "then_actions": [
          {
            "type": "DISPATCH_PERCEPTIBLE_EVENT",
            "parameters": {
              "location_id": "{context.actorPosition.locationId}",
              "description_text": "{context.actorName} lands a devastating blow with their {context.weaponName} on {context.targetName}!",
              "perception_type": "action_target_general",
              "actor_id": "{event.payload.actorId}",
              "target_id": "{event.payload.secondaryId}"
            }
          },
          { "macro": "core:logSuccessAndEndTurn" }
        ],
        "else_actions": [
          {
            "type": "IF",
            "parameters": {
              "condition": { "==": [{ "var": "context.attackResult.outcome" }, "SUCCESS"] },
              "then_actions": [
                {
                  "type": "DISPATCH_PERCEPTIBLE_EVENT",
                  "parameters": {
                    "location_id": "{context.actorPosition.locationId}",
                    "description_text": "{context.actorName} swings their {context.weaponName} at {context.targetName}, cutting their flesh.",
                    "perception_type": "action_target_general",
                    "actor_id": "{event.payload.actorId}",
                    "target_id": "{event.payload.secondaryId}"
                  }
                },
                { "macro": "core:logSuccessAndEndTurn" }
              ],
              "else_actions": [
                {
                  "type": "IF",
                  "parameters": {
                    "condition": { "==": [{ "var": "context.attackResult.outcome" }, "FUMBLE"] },
                    "then_actions": [
                      {
                        "type": "DISPATCH_PERCEPTIBLE_EVENT",
                        "parameters": {
                          "location_id": "{context.actorPosition.locationId}",
                          "description_text": "{context.actorName} swings wildly and loses grip on their {context.weaponName}!",
                          "perception_type": "action_target_general",
                          "actor_id": "{event.payload.actorId}"
                        }
                      },
                      { "macro": "core:logFailureAndEndTurn" }
                    ],
                    "else_actions": [
                      {
                        "type": "DISPATCH_PERCEPTIBLE_EVENT",
                        "parameters": {
                          "location_id": "{context.actorPosition.locationId}",
                          "description_text": "{context.actorName} swings their {context.weaponName} at {context.targetName}, but the swing fails to connect.",
                          "perception_type": "action_target_general",
                          "actor_id": "{event.payload.actorId}",
                          "target_id": "{event.payload.secondaryId}"
                        }
                      },
                      { "macro": "core:logFailureAndEndTurn" }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
}
```

---

## 6. JSON Logic Operator

### 6.1 getSkillValue Operator

**File:** `src/logic/operators/getSkillValueOperator.js`

**Usage:**
```json
{ "getSkillValue": ["actor", "skills:melee_skill", "value", 0] }
```

**Arguments:**
1. Entity reference (e.g., "actor", "target")
2. Component ID
3. Property path within component
4. Default value if component/property missing

**Registration:** Add to `src/logic/jsonLogicCustomOperators.js`

---

## 7. Action Discovery Integration

### 7.1 Chance Injection in ActionFormattingStage

**File to modify:** `src/actions/pipeline/stages/ActionFormattingStage.js`

**Changes:**
1. Detect actions with `chanceBased.enabled: true`
2. For each discovered action instance, call `ChanceCalculationService.calculateForDisplay()`
3. Replace `{chance}` placeholder in template with calculated percentage

**Alternative approach:** Create a new pipeline stage `ChanceCalculationStage` that runs after `MultiTargetResolutionStage` and before `ActionFormattingStage`.

### 7.2 Template Placeholder

Actions with `chanceBased` use `{chance}` placeholder:
```
"template": "swing {weapon} at {target} ({chance}%)"
```

The formatter resolves this to:
```
"swing longsword at chicken (55%)"
```

---

## 8. Implementation Files

### 8.1 New Files to Create

| File | Purpose |
|------|---------|
| `src/combat/services/SkillResolverService.js` | Skill value retrieval |
| `src/combat/services/ModifierCollectorService.js` | Modifier aggregation |
| `src/combat/services/ProbabilityCalculatorService.js` | Formula calculations |
| `src/combat/services/OutcomeDeterminerService.js` | Outcome resolution |
| `src/combat/services/ChanceCalculationService.js` | Service orchestrator |
| `src/combat/index.js` | Combat module exports |
| `src/logic/operationHandlers/resolveOutcomeHandler.js` | RESOLVE_OUTCOME handler |
| `src/logic/operators/getSkillValueOperator.js` | JSON Logic operator |
| `src/dependencyInjection/registrations/combatRegistrations.js` | DI registrations |
| `data/schemas/operations/resolveOutcome.schema.json` | Operation schema |
| `data/mods/skills/mod-manifest.json` | Skills mod manifest |
| `data/mods/skills/components/melee_skill.component.json` | Melee skill |
| `data/mods/skills/components/defense_skill.component.json` | Defense skill |
| `data/mods/damage-types/mod-manifest.json` | Damage types manifest |
| `data/mods/damage-types/components/can_cut.component.json` | Cutting marker |
| `data/mods/weapons/actions/swing_at_target.action.json` | Combat action |
| `data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json` | Action condition |
| `data/mods/weapons/rules/handle_swing_at_target.rule.json` | Combat rule |
| `data/mods/weapons/scopes/wielded_cutting_weapons.scope` | Scope for cutting weapons |

### 8.2 Files to Modify

| File | Change |
|------|--------|
| `data/schemas/action.schema.json` | Add `chanceBased` property and `chanceModifier` definition |
| `data/schemas/operation.schema.json` | Add `$ref` to resolveOutcome.schema.json |
| `src/utils/preValidationUtils.js` | Add `RESOLVE_OUTCOME` to `KNOWN_OPERATION_TYPES` |
| `src/dependencyInjection/tokens/tokens-core.js` | Add service tokens |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Register handler factory |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Map RESOLVE_OUTCOME to handler |
| `src/logic/jsonLogicCustomOperators.js` | Register getSkillValue operator |
| `src/actions/pipeline/stages/ActionFormattingStage.js` | Inject chance calculation |
| `data/game.json` | Add skills and damage-types mods |
| Weapon entity definitions | Add `damage-types:can_cut` component |

### 8.3 Test Files to Create

| File | Purpose |
|------|---------|
| `tests/unit/combat/services/SkillResolverService.test.js` | Unit tests |
| `tests/unit/combat/services/ProbabilityCalculatorService.test.js` | Formula tests |
| `tests/unit/combat/services/OutcomeDeterminerService.test.js` | Outcome tests |
| `tests/unit/logic/operationHandlers/resolveOutcomeHandler.test.js` | Handler tests |
| `tests/unit/logic/operators/getSkillValueOperator.test.js` | Operator tests |
| `tests/integration/mods/weapons/swingAtTargetChanceDisplay.test.js` | Display integration |
| `tests/integration/mods/weapons/swingAtTargetOutcomeResolution.test.js` | Rule integration |

---

## 9. Implementation Phases

### Phase 1: Core Services (Foundation)
1. Create `skills` mod with `melee_skill` and `defense_skill` components
2. Create `damage-types` mod with `can_cut` component
3. Implement `SkillResolverService`
4. Implement `ProbabilityCalculatorService` with ratio formula
5. Implement `OutcomeDeterminerService`
6. Unit tests for all services

### Phase 2: Operation Handler
1. Create `resolveOutcome.schema.json`
2. Implement `ResolveOutcomeHandler`
3. Register in DI and operation types
4. Unit and integration tests

### Phase 3: Action Discovery Integration
1. Extend `action.schema.json` with `chanceBased` property
2. Create `getSkillValue` JSON Logic operator
3. Modify `ActionFormattingStage` for chance injection
4. Integration tests for chance display

### Phase 4: Combat Action
1. Create `swing_at_target` action
2. Create `wielded_cutting_weapons` scope
3. Create condition and rule files
4. Add `can_cut` to existing weapon entities
5. Full end-to-end testing

### Phase 5: Modifiers (Enhancement)
1. Implement `ModifierCollectorService`
2. Create `ChanceCalculationService` orchestrator
3. Add environmental modifier support
4. Add conditional modifiers to action schema

---

## 10. DI Token Additions

Add to `src/dependencyInjection/tokens/tokens-core.js`:

```javascript
// Combat Services
SkillResolverService: 'SkillResolverService',
ModifierCollectorService: 'ModifierCollectorService',
ProbabilityCalculatorService: 'ProbabilityCalculatorService',
OutcomeDeterminerService: 'OutcomeDeterminerService',
ChanceCalculationService: 'ChanceCalculationService',
ResolveOutcomeHandler: 'ResolveOutcomeHandler',
```

---

## 11. Future Extensibility

This architecture supports future enhancements:

- **Damage System**: Add damage calculation service using same patterns
- **Armor System**: Modifiers from equipment components
- **Buffs/Debuffs**: Temporary modifiers on entities
- **Environmental Effects**: Location-based modifiers
- **Different Contest Types**: Group checks, extended contests
- **Weapon Properties**: Special modifiers from weapon components
- **Stance Modifiers**: Position-based bonuses/penalties

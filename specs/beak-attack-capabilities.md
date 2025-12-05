# Beak Attack Capabilities Specification

## Overview

This specification defines the implementation of beak-based piercing attack capabilities for the Living Narrative Engine. The feature enables creatures with beaks (krakens, chickens, tortoises) to use their beaks as natural weapons with a "peck" attack action.

## Analysis Summary

### Existing Weapons with Damage Capabilities

| Weapon | Damage Types | Primary Amount | Penetration |
|--------|--------------|----------------|-------------|
| vespera_rapier | piercing, slashing | 18, 8 | 12, 4 |
| vespera_main_gauche | piercing | 10 | 6 |
| threadscar_melissa_longsword | slashing | 22 | 8 |
| rill_practice_stick | blunt | 5 | 0 |

### Existing Beak Entities

| Entity ID | SubType | Health | Weight | Notes |
|-----------|---------|--------|--------|-------|
| anatomy:beak | beak | 35 | 5 | Kraken beak (large) |
| anatomy:chicken_beak | chicken_beak | 5 | 0.005 | Small, fragile |
| anatomy:tortoise_beak | tortoise_beak | 8 | 0.05 | Hard, crushing |

### Attack Actions Reference

- **strike_target**: Template `'strike {target} with {weapon} ({chance}% chance)'`
- **thrust_at_target**: Template `'thrust at {target} with {weapon} ({chance}% chance)'`

Both use:
- `chanceBased: true`
- `opposedContest` with attacker skill vs defender dodge
- `generateCombinations: true`
- Multi-target resolution (primary: weapon, secondary: target)

## Implementation Plan

### 1. Add Damage Capabilities to Beak Entities

#### 1.1 anatomy:beak (Kraken Beak)
**File**: `data/mods/anatomy/entities/definitions/beak.entity.json`

Add component:
```json
"damage-types:damage_capabilities": {
  "entries": [
    {
      "name": "piercing",
      "amount": 15,
      "penetration": 10,
      "bleed": 0.3,
      "dismember": 0,
      "fracture": 0
    }
  ]
}
```

**Rationale**: Large kraken beak - significant piercing damage comparable to a rapier.

#### 1.2 anatomy:chicken_beak (Chicken Beak)
**File**: `data/mods/anatomy/entities/definitions/chicken_beak.entity.json`

Add component:
```json
"damage-types:damage_capabilities": {
  "entries": [
    {
      "name": "piercing",
      "amount": 2,
      "penetration": 1,
      "bleed": 0.1,
      "dismember": 0,
      "fracture": 0
    }
  ]
}
```

**Rationale**: Small beak - minimal damage, mostly annoyance.

#### 1.3 anatomy:tortoise_beak (Tortoise Beak)
**File**: `data/mods/anatomy/entities/definitions/tortoise_beak.entity.json`

Add component:
```json
"damage-types:damage_capabilities": {
  "entries": [
    {
      "name": "piercing",
      "amount": 6,
      "penetration": 4,
      "bleed": 0.15,
      "dismember": 0,
      "fracture": 0.1
    }
  ]
}
```

**Rationale**: Hard, crushing beak - moderate piercing with slight fracture chance.

---

### 2. New Operator: hasPartSubTypeContaining

#### 2.1 Problem Statement

Existing operators (`hasPartOfType`, `hasPartWithComponentValue`, `hasPartOfTypeWithComponentValue`) all use strict equality (`===`) for matching. We need substring matching to find body parts where subType **contains** "beak" to match:
- "beak"
- "chicken_beak"
- "tortoise_beak"

#### 2.2 Implementation

**File**: `src/logic/operators/hasPartSubTypeContainingOperator.js`

```javascript
/**
 * @file Operator to check if entity has body part with subType containing a substring
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

class HasPartSubTypeContainingOperator {
  #logger;
  #bodySystemTagService;

  constructor({ logger, bodySystemTagService }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(bodySystemTagService, 'IBodySystemTagService', logger, {
      requiredMethods: ['getBodyParts'],
    });
    this.#logger = logger;
    this.#bodySystemTagService = bodySystemTagService;
  }

  /**
   * Check if entity has a body part with subType containing the substring
   * @param {string} entityId - The entity to check
   * @param {string} substring - The substring to search for in subType
   * @returns {boolean} True if any body part's subType contains the substring
   */
  execute(entityId, substring) {
    if (!entityId || !substring) {
      this.#logger.warn('hasPartSubTypeContaining: Missing entityId or substring');
      return false;
    }

    const bodyParts = this.#bodySystemTagService.getBodyParts(entityId);
    if (!bodyParts || bodyParts.length === 0) {
      return false;
    }

    return bodyParts.some(part => {
      const subType = part.components?.['anatomy:part']?.subType;
      return subType && subType.toLowerCase().includes(substring.toLowerCase());
    });
  }
}

export default HasPartSubTypeContainingOperator;
```

#### 2.3 Registration

**File**: `src/logic/jsonLogicCustomOperators.js`

Add to operator registrations:
```javascript
jsonLogic.add_operation('hasPartSubTypeContaining', (entityId, substring) => {
  const operator = container.resolve(tokens.HasPartSubTypeContainingOperator);
  return operator.execute(entityId, substring);
});
```

**File**: `src/dependencyInjection/tokens/tokens-core.js`

Add token:
```javascript
HasPartSubTypeContainingOperator: 'HasPartSubTypeContainingOperator',
```

**File**: `src/dependencyInjection/registrations/operatorRegistrations.js`

Add factory registration.

---

### 3. New Scope: actor_beak_body_parts

#### 3.1 Purpose

Resolve to the actor's body parts where subType contains "beak". This scope is used as the primary target for the peck action (the weapon/beak to use).

#### 3.2 Implementation

**File**: `data/mods/violence/scopes/actor_beak_body_parts.scope.json`

```json
{
  "$schema": "schema://living-narrative-engine/scope.schema.json",
  "id": "violence:actor_beak_body_parts",
  "description": "Resolves to actor's body parts with subType containing 'beak'",
  "expression": "actor.body.graph.nodes[{\"and\": [{\"!=\": [{\"var\": \"type\"}, \"root\"]}, {\"in\": [\"beak\", {\"var\": \"subType\"}]}]}]"
}
```

**Note**: The scope uses the body graph traversal pattern with a filter for subType containing "beak". The `in` operator in JSON Logic checks if "beak" is a substring of subType.

#### 3.3 Alternative: Dedicated Operator in Scope

If the JSON Logic `in` operator doesn't support substring matching on strings (it's designed for arrays), we may need:

```json
{
  "$schema": "schema://living-narrative-engine/scope.schema.json",
  "id": "violence:actor_beak_body_parts",
  "description": "Resolves to actor's body parts with subType containing 'beak'",
  "expression": "actor.body.graph.nodes[{\"stringContains\": [{\"var\": \"subType\"}, \"beak\"]}]"
}
```

This would require a `stringContains` JSON Logic operator to be registered.

---

### 4. Peck Action Definition

**File**: `data/mods/violence/actions/peck_target.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "violence:peck_target",
  "commandName": "peck",
  "description": "Peck at a target with your beak",
  "template": "peck {target} with {weapon} ({chance}% chance)",
  "target_domain": "characters",
  "category": "violence:attack",
  "tags": ["attack", "melee", "natural_weapon", "beak"],
  "multiTarget": {
    "enabled": true,
    "primary": {
      "label": "weapon",
      "scope": "violence:actor_beak_body_parts",
      "required_components": ["damage-types:damage_capabilities"],
      "forbidden_components": []
    },
    "secondary": {
      "label": "target",
      "scope": "violence:valid_attack_targets",
      "required_components": ["core:actor"],
      "forbidden_components": ["core:dead"]
    },
    "generateCombinations": true
  },
  "chanceBased": true,
  "chanceCalculation": {
    "type": "opposedContest",
    "attacker": {
      "skill": "combat:beak_fighting",
      "fallbackSkill": "combat:unarmed",
      "attribute": "physical:agility"
    },
    "defender": {
      "skill": "combat:dodge",
      "attribute": "physical:agility"
    },
    "modifiers": {
      "weapon_quality": true,
      "range_penalty": false,
      "stance_bonus": true
    }
  },
  "resolutionType": "contested",
  "contestOutcomes": {
    "criticalSuccessThreshold": 20,
    "fumbleThreshold": -15
  },
  "visualScheme": {
    "backgroundColor": "#8b0000",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#b71c1c",
    "hoverTextColor": "#ffebee"
  }
}
```

**Key Design Decisions**:
- Uses `violence:actor_beak_body_parts` scope for primary target (the beak)
- Uses existing `violence:valid_attack_targets` for secondary target
- Skill fallback to `combat:unarmed` if no `combat:beak_fighting` skill
- Same visual scheme as other violence actions (dark red)

---

### 5. Peck Condition Definition

**File**: `data/mods/violence/conditions/event-is-action-peck-target.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "violence:event-is-action-peck-target",
  "description": "Checks if the event is a peck_target action attempt",
  "condition": {
    "and": [
      { "==": [{ "var": "event.type" }, "core:attempt_action"] },
      { "==": [{ "var": "event.payload.actionId" }, "violence:peck_target"] }
    ]
  }
}
```

---

### 6. Beak Fumble Macro

Unlike melee weapon fumbles (which drop the weapon), beak fumbles should cause the attacker to lose balance and fall.

**File**: `data/mods/violence/macros/handleBeakFumble.macro.json`

```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "violence:handleBeakFumble",
  "description": "Handles fumble outcome for beak attacks - actor loses balance and falls",
  "operations": [
    {
      "type": "ADD_COMPONENT",
      "parameters": {
        "entity_id": { "var": "context.actorId" },
        "component_type": "positioning:fallen",
        "data": {
          "reason": "lost_balance_attacking",
          "timestamp": { "var": "context.timestamp" }
        }
      }
    },
    {
      "type": "DISPATCH_PERCEPTIBLE_EVENT",
      "parameters": {
        "event_type": "violence:attack_fumbled",
        "payload": {
          "actorId": { "var": "context.actorId" },
          "targetId": { "var": "context.targetId" },
          "weaponId": { "var": "context.weaponId" },
          "attackVerb": { "var": "context.attackVerb" },
          "outcome": "FUMBLE"
        },
        "narrative": {
          "template": "{actor} lunges forward with {possessive} beak but completely misses, losing balance and falling to the ground!",
          "variables": {
            "actor": { "var": "context.actorName" },
            "possessive": { "var": "context.actorPossessive" }
          }
        },
        "visualScheme": {
          "backgroundColor": "#8b0000",
          "textColor": "#ffffff"
        }
      }
    }
  ]
}
```

---

### 7. Peck Rule Definition

**File**: `data/mods/violence/rules/handle_peck_target.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_peck_target",
  "event_type": "core:attempt_action",
  "priority": 100,
  "conditions": [
    { "$ref": "violence:event-is-action-peck-target" }
  ],
  "actions": [
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "attackVerb",
        "value": "peck"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "attackVerbPast",
        "value": "pecks"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "hitDescription",
        "value": "piercing strike"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "excludeDamageTypes",
        "value": ["slashing", "blunt"]
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "successMessage",
        "value": "{actor} {attackVerbPast} at {target} with {possessive} beak"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "failureMessage",
        "value": "{actor} {attackVerb}s at {target} but misses"
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "CRITICAL_SUCCESS"]
        },
        "then_actions": [
          { "macro": "weapons:handleMeleeCritical" }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "SUCCESS"]
        },
        "then_actions": [
          { "macro": "weapons:handleMeleeHit" }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "FAILURE"]
        },
        "then_actions": [
          { "macro": "weapons:handleMeleeMiss" }
        ]
      }
    },
    {
      "type": "IF",
      "parameters": {
        "condition": {
          "==": [{ "var": "context.attackResult.outcome" }, "FUMBLE"]
        },
        "then_actions": [
          { "macro": "violence:handleBeakFumble" }
        ]
      }
    }
  ]
}
```

**Key Design Decisions**:
- Uses existing `weapons:handleMeleeCritical`, `weapons:handleMeleeHit`, `weapons:handleMeleeMiss` macros for hit/miss handling
- Uses new `violence:handleBeakFumble` macro for fumble (falling instead of dropping weapon)
- Excludes slashing and blunt damage types (beak only does piercing)

---

### 8. Testing Requirements

#### 8.1 Action Discovery Tests

**File**: `tests/integration/mods/violence/peck_target_action_discovery.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/modTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';

describe('violence:peck_target action discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('violence', 'violence:peck_target');
    ScopeResolverHelpers.registerPositioningScopes(fixture.scopeResolver);
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('positive scenarios', () => {
    it('should discover peck action when actor has a beak body part', async () => {
      // Arrange: Create actor with beak in body graph
      const scenario = fixture.createActorWithBodyPart({
        actorName: 'Kraken',
        bodyPartEntity: 'anatomy:beak',
        bodyPartSubType: 'beak'
      });

      // Create target
      const target = fixture.createEntity('Target', ['core:actor']);

      // Act
      const actions = await fixture.discoverActions(scenario.actor.id);

      // Assert
      expect(actions).toContainActionWithId('violence:peck_target');
    });

    it('should discover peck action for chicken_beak subType', async () => {
      const scenario = fixture.createActorWithBodyPart({
        actorName: 'Chicken',
        bodyPartEntity: 'anatomy:chicken_beak',
        bodyPartSubType: 'chicken_beak'
      });
      const target = fixture.createEntity('Target', ['core:actor']);

      const actions = await fixture.discoverActions(scenario.actor.id);

      expect(actions).toContainActionWithId('violence:peck_target');
    });

    it('should discover peck action for tortoise_beak subType', async () => {
      const scenario = fixture.createActorWithBodyPart({
        actorName: 'Tortoise',
        bodyPartEntity: 'anatomy:tortoise_beak',
        bodyPartSubType: 'tortoise_beak'
      });
      const target = fixture.createEntity('Target', ['core:actor']);

      const actions = await fixture.discoverActions(scenario.actor.id);

      expect(actions).toContainActionWithId('violence:peck_target');
    });
  });

  describe('negative scenarios', () => {
    it('should NOT discover peck action when actor has no beak', async () => {
      // Create human actor without beak
      const scenario = fixture.createStandardActorTarget(['Human', 'Target']);

      const actions = await fixture.discoverActions(scenario.actor.id);

      expect(actions).not.toContainActionWithId('violence:peck_target');
    });

    it('should NOT discover peck action when beak lacks damage_capabilities', async () => {
      // Create actor with beak that has no damage_capabilities
      const scenario = fixture.createActorWithBodyPart({
        actorName: 'Damaged Creature',
        bodyPartEntity: 'anatomy:beak',
        bodyPartSubType: 'beak',
        excludeComponents: ['damage-types:damage_capabilities']
      });
      const target = fixture.createEntity('Target', ['core:actor']);

      const actions = await fixture.discoverActions(scenario.actor.id);

      expect(actions).not.toContainActionWithId('violence:peck_target');
    });

    it('should NOT discover peck action when target is dead', async () => {
      const scenario = fixture.createActorWithBodyPart({
        actorName: 'Kraken',
        bodyPartEntity: 'anatomy:beak',
        bodyPartSubType: 'beak'
      });
      const target = fixture.createEntity('Dead Target', ['core:actor', 'core:dead']);

      const actions = await fixture.discoverActions(scenario.actor.id);
      const peckActions = actions.filter(a =>
        a.actionId === 'violence:peck_target' &&
        a.targets?.secondary?.id === target.id
      );

      expect(peckActions).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should generate combinations for multiple beaks', async () => {
      // Actor with two beaks (theoretical creature)
      const scenario = fixture.createActorWithMultipleBodyParts({
        actorName: 'Two-Headed Bird',
        bodyParts: [
          { entity: 'anatomy:beak', subType: 'beak', instanceId: 'beak_1' },
          { entity: 'anatomy:beak', subType: 'beak', instanceId: 'beak_2' }
        ]
      });
      const target = fixture.createEntity('Target', ['core:actor']);

      const actions = await fixture.discoverActions(scenario.actor.id);
      const peckActions = actions.filter(a => a.actionId === 'violence:peck_target');

      // Should have 2 combinations (one for each beak)
      expect(peckActions.length).toBeGreaterThanOrEqual(2);
    });
  });
});
```

#### 8.2 Rule Execution Tests

**File**: `tests/integration/mods/violence/peck_target_rule_execution.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/modTestFixture.js';
import '../../../common/mods/domainMatchers.js';

describe('handle_peck_target rule execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forRule('violence', 'handle_peck_target');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('outcome handling', () => {
    it('should apply damage on SUCCESS outcome', async () => {
      const scenario = fixture.createBeakAttackScenario({
        attackOutcome: 'SUCCESS',
        beakDamage: 15
      });

      await fixture.executeRule(scenario);

      // Verify damage was applied to target
      expect(scenario.target).toHaveReceivedDamage({
        type: 'piercing',
        minAmount: 1
      });
    });

    it('should apply critical damage on CRITICAL_SUCCESS outcome', async () => {
      const scenario = fixture.createBeakAttackScenario({
        attackOutcome: 'CRITICAL_SUCCESS',
        beakDamage: 15
      });

      await fixture.executeRule(scenario);

      expect(scenario.target).toHaveReceivedDamage({
        type: 'piercing',
        multiplier: 2 // Critical doubles damage
      });
    });

    it('should not apply damage on FAILURE outcome', async () => {
      const scenario = fixture.createBeakAttackScenario({
        attackOutcome: 'FAILURE',
        beakDamage: 15
      });

      await fixture.executeRule(scenario);

      expect(scenario.target).not.toHaveReceivedDamage();
    });

    it('should cause actor to fall on FUMBLE outcome', async () => {
      const scenario = fixture.createBeakAttackScenario({
        attackOutcome: 'FUMBLE',
        beakDamage: 15
      });

      await fixture.executeRule(scenario);

      // Verify actor has fallen component
      expect(scenario.actor).toHaveComponent('positioning:fallen');
      // Verify target was not damaged
      expect(scenario.target).not.toHaveReceivedDamage();
    });
  });

  describe('damage type filtering', () => {
    it('should only apply piercing damage, not slashing', async () => {
      // Create beak with both piercing and slashing (shouldn't happen, but test filtering)
      const scenario = fixture.createBeakAttackScenario({
        attackOutcome: 'SUCCESS',
        beakDamageEntries: [
          { name: 'piercing', amount: 10 },
          { name: 'slashing', amount: 5 }
        ]
      });

      await fixture.executeRule(scenario);

      expect(scenario.target).toHaveReceivedDamage({ type: 'piercing' });
      expect(scenario.target).not.toHaveReceivedDamage({ type: 'slashing' });
    });
  });

  describe('narrative generation', () => {
    it('should generate correct attack narrative on success', async () => {
      const scenario = fixture.createBeakAttackScenario({
        attackOutcome: 'SUCCESS',
        actorName: 'Kraken'
      });

      const events = await fixture.executeRuleAndCaptureEvents(scenario);

      const narrativeEvent = events.find(e => e.type === 'violence:attack_hit');
      expect(narrativeEvent.payload.narrative).toContain('pecks');
      expect(narrativeEvent.payload.narrative).toContain('beak');
    });

    it('should generate fumble narrative with falling', async () => {
      const scenario = fixture.createBeakAttackScenario({
        attackOutcome: 'FUMBLE',
        actorName: 'Chicken'
      });

      const events = await fixture.executeRuleAndCaptureEvents(scenario);

      const fumbleEvent = events.find(e => e.type === 'violence:attack_fumbled');
      expect(fumbleEvent.payload.narrative).toContain('losing balance');
      expect(fumbleEvent.payload.narrative).toContain('falling');
    });
  });
});
```

#### 8.3 Operator Unit Tests

**File**: `tests/unit/logic/operators/hasPartSubTypeContainingOperator.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import HasPartSubTypeContainingOperator from '../../../../src/logic/operators/hasPartSubTypeContainingOperator.js';

describe('HasPartSubTypeContainingOperator', () => {
  let operator;
  let mockLogger;
  let mockBodySystemTagService;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockBodySystemTagService = {
      getBodyParts: jest.fn()
    };

    operator = new HasPartSubTypeContainingOperator({
      logger: mockLogger,
      bodySystemTagService: mockBodySystemTagService
    });
  });

  describe('execute', () => {
    it('should return true when body part subType contains substring', () => {
      mockBodySystemTagService.getBodyParts.mockReturnValue([
        { components: { 'anatomy:part': { subType: 'chicken_beak' } } }
      ]);

      const result = operator.execute('entity1', 'beak');

      expect(result).toBe(true);
    });

    it('should return true for exact match', () => {
      mockBodySystemTagService.getBodyParts.mockReturnValue([
        { components: { 'anatomy:part': { subType: 'beak' } } }
      ]);

      const result = operator.execute('entity1', 'beak');

      expect(result).toBe(true);
    });

    it('should return false when no body parts contain substring', () => {
      mockBodySystemTagService.getBodyParts.mockReturnValue([
        { components: { 'anatomy:part': { subType: 'arm' } } },
        { components: { 'anatomy:part': { subType: 'leg' } } }
      ]);

      const result = operator.execute('entity1', 'beak');

      expect(result).toBe(false);
    });

    it('should return false when entity has no body parts', () => {
      mockBodySystemTagService.getBodyParts.mockReturnValue([]);

      const result = operator.execute('entity1', 'beak');

      expect(result).toBe(false);
    });

    it('should be case-insensitive', () => {
      mockBodySystemTagService.getBodyParts.mockReturnValue([
        { components: { 'anatomy:part': { subType: 'CHICKEN_BEAK' } } }
      ]);

      const result = operator.execute('entity1', 'beak');

      expect(result).toBe(true);
    });

    it('should return false for missing entityId', () => {
      const result = operator.execute(null, 'beak');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false for missing substring', () => {
      const result = operator.execute('entity1', null);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
```

---

## File Checklist

### New Files to Create

| File | Type | Priority |
|------|------|----------|
| `src/logic/operators/hasPartSubTypeContainingOperator.js` | Operator | High |
| `data/mods/violence/scopes/actor_beak_body_parts.scope.json` | Scope | High |
| `data/mods/violence/actions/peck_target.action.json` | Action | High |
| `data/mods/violence/conditions/event-is-action-peck-target.condition.json` | Condition | High |
| `data/mods/violence/macros/handleBeakFumble.macro.json` | Macro | High |
| `data/mods/violence/rules/handle_peck_target.rule.json` | Rule | High |
| `tests/integration/mods/violence/peck_target_action_discovery.test.js` | Test | High |
| `tests/integration/mods/violence/peck_target_rule_execution.test.js` | Test | High |
| `tests/unit/logic/operators/hasPartSubTypeContainingOperator.test.js` | Test | High |

### Files to Modify

| File | Modification |
|------|--------------|
| `data/mods/anatomy/entities/definitions/beak.entity.json` | Add damage_capabilities |
| `data/mods/anatomy/entities/definitions/chicken_beak.entity.json` | Add damage_capabilities |
| `data/mods/anatomy/entities/definitions/tortoise_beak.entity.json` | Add damage_capabilities |
| `src/logic/jsonLogicCustomOperators.js` | Register hasPartSubTypeContaining |
| `src/dependencyInjection/tokens/tokens-core.js` | Add operator token |
| `src/dependencyInjection/registrations/operatorRegistrations.js` | Register operator factory |

---

## Dependencies

### Required Mods
- `core` (base functionality)
- `anatomy` (body part system)
- `damage-types` (damage_capabilities component)
- `violence` (attack infrastructure)
- `weapons` (melee attack macros)
- `positioning` (fallen component for fumble)

### Required Skills (may need creation)
- `combat:beak_fighting` (new skill for beak combat proficiency)
- `combat:unarmed` (fallback skill - should exist)
- `combat:dodge` (defender skill - should exist)

---

## Implementation Order

1. **Phase 1: Operator & Scope** (enables body part selection)
   - Create `hasPartSubTypeContainingOperator.js`
   - Register operator
   - Create `actor_beak_body_parts.scope.json`
   - Unit test operator

2. **Phase 2: Beak Damage** (enables beaks as weapons)
   - Add damage_capabilities to all 3 beak entities
   - Verify with schema validation

3. **Phase 3: Action & Condition** (enables action discovery)
   - Create `peck_target.action.json`
   - Create `event-is-action-peck-target.condition.json`
   - Integration test action discovery

4. **Phase 4: Rule & Macro** (enables action execution)
   - Create `handleBeakFumble.macro.json`
   - Create `handle_peck_target.rule.json`
   - Integration test rule execution

5. **Phase 5: Validation & Polish**
   - Run full test suite
   - Schema validation
   - Manual testing

---

## Open Questions

1. **Skill System**: Does `combat:beak_fighting` skill need to be created? What mod should own it?

2. **Damage Values**: Are the proposed damage values balanced?
   - Kraken beak: 15 piercing (comparable to rapier)
   - Chicken beak: 2 piercing (minimal)
   - Tortoise beak: 6 piercing (moderate)

3. **Body Graph Traversal**: Does the scope DSL support the proposed filter syntax for body graph nodes? May need verification.

4. **stringContains Operator**: If JSON Logic's `in` operator doesn't support string substring matching, a new `stringContains` operator may be needed for the scope.

5. **Macro Location**: Should `handleBeakFumble.macro.json` be in violence mod or anatomy mod?

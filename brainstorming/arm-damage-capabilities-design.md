# Arm-Specific Damage Capabilities for Slap and Punch Actions

**Status**: Design Finalized
**Created**: 2025-12-29
**Updated**: 2025-12-29
**Goal**: Design data-driven damage capabilities for arms to support slap and punch-related actions, where muscular arms deal more damage than slim ones.

---

## Design Decisions (Finalized)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Implementation Approach** | **Option A: Explicit on entities** | "No magical runtime calculation" - damage capabilities defined directly in arm entity files |
| **Body Part for Damage** | **Arms (not hands)** | Arm build determines power; hand is delivery mechanism |
| **Fumble Behavior** | **Off-balance (like beaks)** | Consistency with existing peck fumble; actor becomes off-balance |

---

## 1. Current System Analysis

### How Beaks Use Damage Capabilities (Reference Pattern)

The beak-based peck system provides an excellent template for arm-based attacks:

#### Beak Damage Capability Structure
```json
{
  "damage-types:damage_capabilities": {
    "entries": [{
      "name": "piercing",
      "amount": 15,
      "penetration": 0.5,
      "bleed": { "enabled": true, "severity": "minor", "baseDurationTurns": 2 },
      "fracture": { "enabled": true, "thresholdFraction": 0.9 }
    }]
  }
}
```

#### Key Observations from Beak System
| Aspect | Beak Implementation | Relevance for Arms |
|--------|---------------------|-------------------|
| **Damage Type** | `piercing` (beaks pierce flesh) | Arms should use `blunt` (fists hit, don't pierce) |
| **Scaling** | Kraken beak: 15 dmg, Chicken: 2 dmg | Arm damage should scale by build descriptor |
| **Effects** | Bleed (piercing wounds), Fracture | Fracture makes sense for punches, maybe stunChance |
| **Action Filtering** | `excludeDamageTypes: ["slashing", "blunt"]` | Arm attacks: `excludeDamageTypes: ["slashing", "piercing"]` |

### Current Arm Entity Structure

Arms currently have **no damage capabilities**. They only receive damage:

```json
{
  "anatomy:part": {
    "subType": "arm",
    "hit_probability_weight": 8.0,
    "health_calculation_weight": 3
  },
  "anatomy:part_health": { "currentHealth": 25, "maxHealth": 25 },
  "anatomy:sockets": { "sockets": [{ "id": "wrist", "allowedTypes": ["hand"] }] },
  "core:weight": { "weight": 4.0 }
}
```

### Build Descriptor Correlation

Arms already have build descriptors that correlate to physical capability:

| Build Descriptor | Hit Probability Weight | Implied Strength |
|------------------|------------------------|------------------|
| `slim` | 7.2 | Weakest |
| `lean` | ~7.5 | Weak |
| `standard` | 8.0 | Average |
| `athletic` | ~8.0 | Average+ |
| `muscular` | 8.8 | Strong |
| `hulking` | 9.6 | Strongest |

---

## 2. Proposed Design: Arm Damage Capabilities

### Option A: Add Damage Capabilities to Each Arm Entity Definition

**Approach**: Modify each arm entity file to include `damage-types:damage_capabilities`.

#### Example: Muscular Arm
```json
{
  "damage-types:damage_capabilities": {
    "entries": [{
      "name": "blunt",
      "amount": 8,
      "penetration": 0.2,
      "fracture": {
        "enabled": true,
        "thresholdFraction": 0.6,
        "stunChance": 0.15
      }
    }]
  }
}
```

#### Proposed Damage Scaling by Build

| Arm Variant | Damage Amount | Fracture Threshold | Stun Chance |
|-------------|---------------|--------------------| ------------|
| `humanoid_arm_slim` | 3 | 0.9 (hard to fracture) | 0.02 |
| `humanoid_arm_lean` | 4 | 0.85 | 0.05 |
| `humanoid_arm` (base) | 5 | 0.8 | 0.08 |
| `humanoid_arm_athletic` | 6 | 0.75 | 0.10 |
| `humanoid_arm_muscular` | 8 | 0.6 | 0.15 |
| `humanoid_arm_hulking` | 12 | 0.5 | 0.25 |

**Pros**:
- Simple, follows existing beak pattern exactly
- Data-driven, no code changes needed
- Clear damage values per arm type

**Cons**:
- Requires modifying all 18+ arm entity files
- Hardcoded damage values per entity
- New arm variants require manual damage assignment

---

### Option B: Dynamic Damage Calculation Based on Build Descriptor (Recommended)

**Approach**: Create a handler/operator that calculates arm damage dynamically based on the `descriptors:build` component.

#### Implementation Strategy

1. **New Operator**: `calculate_arm_damage` or extend `GET_DAMAGE_CAPABILITIES`
2. **Logic**: Read `descriptors:build` from arm entity → map to damage values
3. **Fallback**: Use weight-based calculation if no build descriptor (already exists in GET_DAMAGE_CAPABILITIES)

#### Build-to-Damage Mapping Table
```javascript
const ARM_BUILD_DAMAGE_MAP = {
  'slim': { baseDamage: 3, fractureMod: 0.9, stunChance: 0.02 },
  'lean': { baseDamage: 4, fractureMod: 0.85, stunChance: 0.05 },
  'lissom': { baseDamage: 3, fractureMod: 0.9, stunChance: 0.03 },
  'soft': { baseDamage: 4, fractureMod: 0.85, stunChance: 0.03 },
  'athletic': { baseDamage: 6, fractureMod: 0.75, stunChance: 0.10 },
  'muscular': { baseDamage: 8, fractureMod: 0.6, stunChance: 0.15 },
  'thick': { baseDamage: 7, fractureMod: 0.65, stunChance: 0.12 },
  'hulking': { baseDamage: 12, fractureMod: 0.5, stunChance: 0.25 },
  // Default for unknown/missing build
  'default': { baseDamage: 5, fractureMod: 0.8, stunChance: 0.08 }
};
```

**Pros**:
- Zero changes to existing arm entities
- Automatically works with any new arm variant
- Central configuration point
- Build descriptor is already on arm entities

**Cons**:
- Requires new operation handler or operator
- Slightly more complex than direct component lookup
- Logic lives in code, not data (though config is data)

---

### Option C: Hybrid Approach

**Approach**: Support both explicit `damage_capabilities` component AND dynamic calculation.

1. If arm has `damage-types:damage_capabilities` → use it (explicit override)
2. If no explicit component → calculate from `descriptors:build`
3. If no build descriptor → use weight-based fallback (existing behavior)

This matches the existing `GET_DAMAGE_CAPABILITIES` handler pattern which already has weight-based fallback.

**Pros**:
- Maximum flexibility
- Backward compatible
- Allows creature arms to have special damage (e.g., clawed arms)
- Automatic reasonable defaults for most arms

**Cons**:
- Three-tier resolution adds complexity
- Need clear documentation on precedence

---

## 3. Action Design: Slap and Punch Actions

### Proposed Action: `violence:slap_target`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "violence:slap_target",
  "name": "Slap",
  "description": "Slap the target with an open hand",
  "target_info": {
    "primary": {
      "scope": "violence:actor_arm_body_parts",
      "required_components": ["damage-types:damage_capabilities"]
    },
    "secondary": {
      "scope": "core:actors_in_location"
    }
  },
  "prerequisites": {
    "conditions": [
      { "condition": "violence:actor-has-arm" }
    ],
    "forbidden_components": {
      "actor": ["recovery-states:restrained", "recovery-states:fallen"]
    }
  },
  "combat_settings": {
    "skill_contest": {
      "actor_skill_path": "combat.melee_skill",
      "target_skill_path": "combat.defense_skill",
      "opposed": true
    }
  }
}
```

### Proposed Action: `violence:punch_target`

Similar structure, but with different flavor:
- Higher damage potential
- Different fumble behavior (hurt own hand?)
- Different hit messages ("punches" vs "slaps")

### Proposed Action: `violence:sucker_punch`

Surprise attack variant:
- Requires target not facing actor OR target unaware
- Higher damage multiplier
- Higher critical chance
- Custom fumble (miss completely, off-balance)

---

## 4. Scope Definition: Actor's Arms

New scope file needed: `data/mods/violence/scopes/actor_arm_body_parts.scope`

```json
{
  "$schema": "schema://living-narrative-engine/scope.schema.json",
  "id": "violence:actor_arm_body_parts",
  "definition": "actor.body_parts[][ { \"and\": [ { \"==\": [{ \"var\": \"subType\" }, \"arm\"] }, { \"has_component\": \"damage-types:damage_capabilities\" } ] } ]"
}
```

**Note**: This mirrors the beak scope pattern: `violence:actor_beak_body_parts`

---

## 5. Rule Design: Handle Punch/Slap

### Rule: `handle_punch_target.rule.json`

Key differences from `handle_peck_target`:

```json
{
  "operations": [
    {
      "type": "QUERY_COMPONENT",
      "entity_ref": "primary",
      "component_id": "damage-types:damage_capabilities",
      "save_to": "variables.weaponDamage"
    },
    {
      "type": "SET_VALUE",
      "value": ["slashing", "piercing"],
      "save_to": "variables.excludeDamageTypes"
    }
  ]
}
```

**Damage Type Filtering**:
- Punches use `blunt` damage only
- Exclude `slashing` and `piercing` (arms don't cut or stab)

### Fumble Behavior

Unlike beaks (where the creature falls), arm attack fumbles could:
- Hurt actor's hand (self-damage to hand body part)
- Miss badly and become off-balance
- Hit wrong target (if multiple nearby)

---

## 6. Implementation Plan (Finalized)

### Phase 1: Add Damage Capabilities to All Arm Entities (18 files)

**No code changes required** - purely data-driven. Add `damage-types:damage_capabilities` component to each arm entity file based on its build descriptor.

#### Complete Damage Values Table

| Arm Entity | Build | Damage | Penetration | Fracture | Stun % |
|------------|-------|--------|-------------|----------|--------|
| `humanoid_arm` | base | 5 | 0.2 | 0.8 | 8% |
| `humanoid_arm_slim` | slim | 3 | 0.15 | 0.9 | 2% |
| `humanoid_arm_lean` | lean | 4 | 0.15 | 0.85 | 5% |
| `humanoid_arm_soft` | soft | 4 | 0.15 | 0.85 | 3% |
| `humanoid_arm_soft_lissom` | lissom | 3 | 0.15 | 0.9 | 3% |
| `humanoid_arm_athletic` | athletic | 6 | 0.2 | 0.75 | 10% |
| `humanoid_arm_muscular` | muscular | 8 | 0.25 | 0.6 | 15% |
| `humanoid_arm_muscular_hairy` | muscular | 8 | 0.25 | 0.6 | 15% |
| `humanoid_arm_thick_hairy` | thick | 7 | 0.2 | 0.65 | 12% |
| `humanoid_arm_hulking` | hulking | 12 | 0.3 | 0.5 | 25% |
| `humanoid_arm_hulking_hairy` | hulking | 12 | 0.3 | 0.5 | 25% |
| `humanoid_arm_hulking_scarred` | hulking | 12 | 0.3 | 0.5 | 25% |
| `humanoid_arm_scarred` | base | 5 | 0.2 | 0.8 | 8% |
| `humanoid_arm_weathered_tannery_stained` | base | 5 | 0.2 | 0.8 | 8% |
| `tortoise_arm` | creature | 4 | 0.15 | 0.85 | 5% |
| `newt_folk_arm` | slim | 3 | 0.15 | 0.9 | 2% |
| `toad_folk_arm` | (verify) | 6 | 0.2 | 0.75 | 10% |
| `eldritch_vestigial_arm` | vestigial | 2 | 0.1 | 0.95 | 1% |

#### Example Entity Modification

**Before** (`humanoid_arm_muscular.entity.json`):
```json
{
  "components": {
    "anatomy:part": { ... },
    "anatomy:part_health": { ... },
    "descriptors:build": { "build": "muscular" }
  }
}
```

**After** (`humanoid_arm_muscular.entity.json`):
```json
{
  "components": {
    "anatomy:part": { ... },
    "anatomy:part_health": { ... },
    "descriptors:build": { "build": "muscular" },
    "damage-types:damage_capabilities": {
      "entries": [{
        "name": "blunt",
        "amount": 8,
        "penetration": 0.25,
        "fracture": {
          "enabled": true,
          "thresholdFraction": 0.6,
          "stunChance": 0.15
        }
      }]
    }
  }
}
```

### Phase 2: Create Supporting Mod Files

#### 2.1 Condition: `violence:actor-has-arm.condition.json`
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "violence:actor-has-arm",
  "description": "Check if actor has at least one arm body part with damage capabilities",
  "logic": {
    "some": [
      { "var": "actor.body_parts" },
      { "and": [
        { "==": [{ "var": "subType" }, "arm"] },
        { "has_component": ["damage-types:damage_capabilities"] }
      ]}
    ]
  }
}
```

#### 2.2 Scope: `violence:actor_arm_body_parts.scope`
```json
{
  "$schema": "schema://living-narrative-engine/scope.schema.json",
  "id": "violence:actor_arm_body_parts",
  "description": "All arm body parts of the actor that have damage capabilities",
  "definition": "actor.body_parts[][ { \"and\": [ { \"==\": [{ \"var\": \"subType\" }, \"arm\"] }, { \"has_component\": \"damage-types:damage_capabilities\" } ] } ]"
}
```

#### 2.3 Macro: `violence:handleArmFumble.macro.json`
```json
{
  "$schema": "schema://living-narrative-engine/macro.schema.json",
  "id": "violence:handleArmFumble",
  "description": "Handle fumble for arm-based attacks - actor becomes off-balance",
  "parameters": ["actorId", "targetId", "locationId"],
  "operations": [
    {
      "type": "DISPATCH_EVENT",
      "event": {
        "type": "ENTITY_SPOKE",
        "payload": {
          "speaker": "system",
          "text": "{{actorName}} swings wildly but misses completely, thrown off-balance by the momentum!"
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "entity_ref": "actor",
      "component_id": "recovery-states:off_balance",
      "data": { "duration": 1 }
    }
  ]
}
```

### Phase 3: Create Actions

#### 3.1 Action: `violence:slap_target.action.json`
(Full action definition - see Section 3 above)

#### 3.2 Action: `violence:punch_target.action.json`
Similar structure with different messages and potentially higher damage multiplier.

### Phase 4: Create Rules

#### 4.1 Rule: `handle_slap_target.rule.json`
Key configuration:
- `excludeDamageTypes: ["slashing", "piercing"]`
- Fumble macro: `violence:handleArmFumble`
- Attack verb: "slaps"

#### 4.2 Rule: `handle_punch_target.rule.json`
Key configuration:
- `excludeDamageTypes: ["slashing", "piercing"]`
- Fumble macro: `violence:handleArmFumble`
- Attack verb: "punches"
- Potentially damage multiplier: 1.2 (punches hit harder than slaps)

### Phase 5: Create Tests

Following existing patterns:
- `tests/integration/mods/violence/slap_target_action_discovery.test.js`
- `tests/integration/mods/violence/slap_target_action.test.js`
- `tests/integration/mods/violence/punch_target_action_discovery.test.js`
- `tests/integration/mods/violence/punch_target_action.test.js`

Test scenarios:
1. Action discovered when actor has arm with damage capabilities
2. Action NOT discovered when actor's arms lack damage capabilities
3. Damage scales correctly based on arm build (muscular > slim)
4. Fumble results in off-balance state
5. Critical hit applies bonus damage
6. Forbidden states prevent action (restrained, fallen)

---

## 7. Open Questions

### Question 1: Should hands have damage capabilities instead of arms?

**Current Design**: Arms get damage capabilities
**Alternative**: Hands get damage capabilities (since you punch with hands, not arms)

**Considerations**:
- Arms contain hands via sockets
- Anatomically, punch power comes from arm (shoulder, bicep) + hand
- Slaps definitely use the hand/palm
- Sucker punches use the whole arm's momentum

**Recommendation**: Associate damage with the ARM, not the hand. The arm's build (muscular vs slim) affects power. The hand is just the delivery mechanism.

### Question 2: What about creature arms with claws?

Creature arms like `tortoise_arm`, `newt_folk_arm` might have claws. These could:
- Have explicit `damage_capabilities` with `slashing` damage
- Override the blunt-only assumption

This argues for the **Hybrid Approach (Option C)**.

### Question 3: Should soft/lissom arms deal less damage?

| Descriptor | Interpretation |
|------------|---------------|
| `soft` | Less muscle definition, less power |
| `lissom` | Flexible/supple, not necessarily weak |
| `athletic` | Toned, good power |

**Recommendation**: `soft` = 4 damage (below average), `lissom` = 3 damage (weakest).

### Question 4: Combined descriptors?

What about `humanoid_arm_muscular_hairy` or `humanoid_arm_hulking_scarred`?

**Approach**: Parse the `descriptors:build` component, not the entity name. The component should have a single build value.

If an arm has both `descriptors:build` and `descriptors:texture`:
- Use build for damage calculation
- Texture doesn't affect damage (scarred arms hit just as hard)

---

## 8. Finalized Approach Summary

**Go with Option A (Explicit on Entities)**:

Per user decision: "No magical runtime calculation" - all damage capabilities are defined explicitly in arm entity JSON files.

**Implementation Strategy**:
1. **Add `damage-types:damage_capabilities` to all 18 arm entity files** based on build descriptor
2. **Create supporting mod files**: condition, scope, macro, actions, rules
3. **Write comprehensive tests** following existing violence mod patterns
4. **No code changes required** - purely data-driven implementation

**Data flow**:
```
Action: slap_target
  → Prerequisite: violence:actor-has-arm (checks for arm with damage_capabilities)
  → Scope: actor_arm_body_parts (filters for arms with damage)
  → Rule: QUERY_COMPONENT(damage_capabilities) from primary (arm entity)
  → APPLY_DAMAGE with excludeDamageTypes: ["slashing", "piercing"]
  → Fumble: violence:handleArmFumble (off-balance)
```

**Files to Create/Modify**:
- 18 arm entity files (add damage_capabilities component)
- 1 condition: `actor-has-arm.condition.json`
- 1 scope: `actor_arm_body_parts.scope`
- 1 macro: `handleArmFumble.macro.json`
- 2 actions: `slap_target.action.json`, `punch_target.action.json`
- 2 rules: `handle_slap_target.rule.json`, `handle_punch_target.rule.json`
- 4+ test files

---

## 9. Comparison: Beak vs Arm Attack Systems

| Aspect | Beak (peck) | Arm (punch/slap) |
|--------|-------------|------------------|
| **Body Part** | beak | arm |
| **Scope** | `actor_beak_body_parts` | `actor_arm_body_parts` |
| **Damage Type** | piercing | blunt |
| **Exclude Types** | slashing, blunt | slashing, piercing |
| **Effects** | bleed, fracture | fracture, stun |
| **Fumble** | Fall to ground | Hurt own hand / off-balance |
| **Scaling Factor** | Species (kraken > chicken) | Build descriptor (hulking > slim) |
| **Has Sockets** | No | Yes (contains hand) |

---

## 10. Implementation Checklist

### Phase 1: Arm Entity Modifications (18 files)
- [ ] `humanoid_arm.entity.json` - Add damage_capabilities (base: 5 dmg)
- [ ] `humanoid_arm_slim.entity.json` - Add damage_capabilities (slim: 3 dmg)
- [ ] `humanoid_arm_lean.entity.json` - Add damage_capabilities (lean: 4 dmg)
- [ ] `humanoid_arm_soft.entity.json` - Add damage_capabilities (soft: 4 dmg)
- [ ] `humanoid_arm_soft_lissom.entity.json` - Add damage_capabilities (lissom: 3 dmg)
- [ ] `humanoid_arm_athletic.entity.json` - Add damage_capabilities (athletic: 6 dmg)
- [ ] `humanoid_arm_muscular.entity.json` - Add damage_capabilities (muscular: 8 dmg)
- [ ] `humanoid_arm_muscular_hairy.entity.json` - Add damage_capabilities (muscular: 8 dmg)
- [ ] `humanoid_arm_thick_hairy.entity.json` - Add damage_capabilities (thick: 7 dmg)
- [ ] `humanoid_arm_hulking.entity.json` - Add damage_capabilities (hulking: 12 dmg)
- [ ] `humanoid_arm_hulking_hairy.entity.json` - Add damage_capabilities (hulking: 12 dmg)
- [ ] `humanoid_arm_hulking_scarred.entity.json` - Add damage_capabilities (hulking: 12 dmg)
- [ ] `humanoid_arm_scarred.entity.json` - Add damage_capabilities (base: 5 dmg)
- [ ] `humanoid_arm_weathered_tannery_stained.entity.json` - Add damage_capabilities (base: 5 dmg)
- [ ] `tortoise_arm.entity.json` - Add damage_capabilities (creature: 4 dmg)
- [ ] `newt_folk_arm.entity.json` - Add damage_capabilities (slim: 3 dmg)
- [ ] `toad_folk_arm.entity.json` - Verify build, add damage_capabilities
- [ ] `eldritch_vestigial_arm.entity.json` - Add damage_capabilities (vestigial: 2 dmg)

### Phase 2: Supporting Mod Files
- [ ] Create `violence:actor-has-arm.condition.json`
- [ ] Create `violence:actor_arm_body_parts.scope`
- [ ] Create `violence:handleArmFumble.macro.json`

### Phase 3: Actions
- [ ] Create `violence:slap_target.action.json`
- [ ] Create `violence:punch_target.action.json`

### Phase 4: Rules
- [ ] Create `handle_slap_target.rule.json`
- [ ] Create `handle_punch_target.rule.json`

### Phase 5: Tests
- [ ] Create `slap_target_action_discovery.test.js`
- [ ] Create `slap_target_action.test.js`
- [ ] Create `punch_target_action_discovery.test.js`
- [ ] Create `punch_target_action.test.js`
- [ ] Create arm damage capabilities validation tests

### Phase 6: Future Enhancements
- [ ] Consider `violence:sucker_punch` action (surprise attack variant)
- [ ] Consider adding slashing damage to creature arms with claws
- [ ] Document pattern for future body-part-based attacks

---

## Appendix A: Files to Analyze

### Existing Files (Reference)
- `data/mods/violence/actions/peck_target.action.json`
- `data/mods/violence/rules/handle_peck_target.rule.json`
- `data/mods/violence/scopes/actor_beak_body_parts.scope`
- `data/mods/violence/conditions/actor-has-beak.condition.json`
- `src/logic/operationHandlers/getDamageCapabilitiesHandler.js`
- `src/logic/operationHandlers/applyDamageHandler.js`

### Arm Entities
- `data/mods/anatomy/entities/definitions/humanoid_arm*.entity.json` (14 files)
- `data/mods/anatomy-creatures/entities/definitions/*_arm.entity.json` (4 files)

### Beak Entities (for comparison)
- `data/mods/anatomy-creatures/entities/definitions/beak.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/chicken_beak.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_beak.entity.json`

---

## Appendix B: Existing Build Descriptors in Arm Entities

From analysis of arm entity files:

| Entity File | Build Descriptor |
|-------------|------------------|
| humanoid_arm | (none - base) |
| humanoid_arm_slim | slim |
| humanoid_arm_lean | lean |
| humanoid_arm_soft | (uses firmness, not build) |
| humanoid_arm_soft_lissom | lissom (+ soft firmness) |
| humanoid_arm_athletic | athletic |
| humanoid_arm_muscular | muscular |
| humanoid_arm_muscular_hairy | muscular |
| humanoid_arm_hulking | hulking |
| humanoid_arm_hulking_hairy | hulking |
| humanoid_arm_hulking_scarred | hulking |
| humanoid_arm_thick_hairy | thick |
| humanoid_arm_scarred | (none - base) |
| humanoid_arm_weathered_tannery_stained | (needs verification) |
| tortoise_arm | (creature-specific) |
| newt_folk_arm | slim |
| toad_folk_arm | (needs verification) |
| eldritch_vestigial_arm | (needs verification) |

**Note**: Need to verify exact component values in entity files before finalizing damage mapping.

# Ticket 08: Migrate Positioning Conditions

## Overview
**Phase**: 2 - Core Logic Migration  
**Priority**: High  
**Estimated Time**: 3-4 hours  
**Dependencies**: Tickets 04-07 (Components, Events, Actions Migration)  
**Implements**: Report section "Conditions to Move" - 5 positioning conditions

## Objective
Migrate five positioning conditions from the intimacy mod to the posturing mod, updating all namespace references and making the spatial logic domain-agnostic for use across combat, social, and intimate game contexts.

## Background
**Conditions to Migrate**:
1. `both-actors-facing-each-other.condition.json`
2. `actor-is-behind-entity.condition.json`
3. `entity-not-in-facing-away.condition.json`
4. `actor-in-entity-facing-away.condition.json`
5. `entity-in-facing-away.condition.json`

**Namespace Changes Required**:
- Condition IDs: `intimacy:*` → `posturing:*`
- Component references: `intimacy:facing_away` → `posturing:facing_away`
- Scope references: `intimacy:*` → `posturing:*` (where applicable)

**From Migration Analysis**:
- All conditions contain pure spatial logic
- No intimacy-specific dependencies in logic
- Critical for violence mod integration (backstab requirements, defensive positioning)
- Used extensively in rules and action scoping

## Implementation Tasks

### Task 8.1: Migrate both-actors-facing-each-other Condition
**Source**: `data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json`  
**Target**: `data/mods/posturing/conditions/both-actors-facing-each-other.condition.json`

**Expected Current Structure**:
```json
{
  "id": "intimacy:both-actors-facing-each-other",
  "description": "Checks if both actors are facing each other (neither has the other in their facing_away list)",
  "logic": {
    "and": [
      {
        "!": {
          "in": [
            {"var": "target"},
            {"var": "actor.intimacy:facing_away.facing_away_from"}
          ]
        }
      },
      {
        "!": {
          "in": [
            {"var": "actor"},
            {"var": "target.intimacy:facing_away.facing_away_from"}
          ]
        }
      }
    ]
  }
}
```

**Updated Content**:
```json
{
  "id": "posturing:both-actors-facing-each-other",
  "description": "Checks if both actors are facing each other (neither has the other in their facing_away list). Used for combat engagement, social interaction, and intimate positioning.",
  "logic": {
    "and": [
      {
        "!": {
          "in": [
            {"var": "target"},
            {"var": "actor.posturing:facing_away.facing_away_from"}
          ]
        }
      },
      {
        "!": {
          "in": [
            {"var": "actor"},
            {"var": "target.posturing:facing_away.facing_away_from"}
          ]
        }
      }
    ]
  }
}
```

### Task 8.2: Migrate actor-is-behind-entity Condition
**Source**: `data/mods/intimacy/conditions/actor-is-behind-entity.condition.json`  
**Target**: `data/mods/posturing/conditions/actor-is-behind-entity.condition.json`

**Expected Current Structure**:
```json
{
  "id": "intimacy:actor-is-behind-entity",
  "description": "Checks if the actor is behind the entity (entity is facing away from actor)",
  "logic": {
    "in": [
      {"var": "actor"},
      {"var": "target.intimacy:facing_away.facing_away_from"}
    ]
  }
}
```

**Updated Content**:
```json
{
  "id": "posturing:actor-is-behind-entity",
  "description": "Checks if the actor is behind the entity (entity is facing away from actor). Used for backstab attacks, surprise actions, and intimate positioning.",
  "logic": {
    "in": [
      {"var": "actor"},
      {"var": "target.posturing:facing_away.facing_away_from"}
    ]
  }
}
```

### Task 8.3: Migrate entity-not-in-facing-away Condition
**Source**: `data/mods/intimacy/conditions/entity-not-in-facing-away.condition.json`  
**Target**: `data/mods/posturing/conditions/entity-not-in-facing-away.condition.json`

**Expected Current Structure**:
```json
{
  "id": "intimacy:entity-not-in-facing-away",
  "description": "Checks if the entity is not in the actor's facing away list",
  "logic": {
    "!": {
      "in": [
        {"var": "target"},
        {"var": "actor.intimacy:facing_away.facing_away_from"}
      ]
    }
  }
}
```

**Updated Content**:
```json
{
  "id": "posturing:entity-not-in-facing-away",
  "description": "Checks if the entity is not in the actor's facing away list. Used for face-to-face combat, direct social interaction, and intimate engagement.",
  "logic": {
    "!": {
      "in": [
        {"var": "target"},
        {"var": "actor.posturing:facing_away.facing_away_from"}
      ]
    }
  }
}
```

### Task 8.4: Migrate actor-in-entity-facing-away Condition
**Source**: `data/mods/intimacy/conditions/actor-in-entity-facing-away.condition.json`  
**Target**: `data/mods/posturing/conditions/actor-in-entity-facing-away.condition.json`

**Expected Current Structure**:
```json
{
  "id": "intimacy:actor-in-entity-facing-away",
  "description": "Checks if the actor is in the entity's facing away list",
  "logic": {
    "in": [
      {"var": "actor"},
      {"var": "target.intimacy:facing_away.facing_away_from"}
    ]
  }
}
```

**Updated Content**:
```json
{
  "id": "posturing:actor-in-entity-facing-away",
  "description": "Checks if the actor is in the entity's facing away list. Used for positional advantage in combat, social dynamics, and intimate scenarios.",
  "logic": {
    "in": [
      {"var": "actor"},
      {"var": "target.posturing:facing_away.facing_away_from"}
    ]
  }
}
```

### Task 8.5: Migrate entity-in-facing-away Condition
**Source**: `data/mods/intimacy/conditions/entity-in-facing-away.condition.json`  
**Target**: `data/mods/posturing/conditions/entity-in-facing-away.condition.json`

**Expected Current Structure**:
```json
{
  "id": "intimacy:entity-in-facing-away",
  "description": "Checks if the entity is in the actor's facing away list",
  "logic": {
    "in": [
      {"var": "target"},
      {"var": "actor.intimacy:facing_away.facing_away_from"}
    ]
  }
}
```

**Updated Content**:
```json
{
  "id": "posturing:entity-in-facing-away",
  "description": "Checks if the entity is in the actor's facing away list. Used for stealth positioning, social avoidance, and intimate dynamics.",
  "logic": {
    "in": [
      {"var": "target"},
      {"var": "actor.posturing:facing_away.facing_away_from"}
    ]
  }
}
```

## Implementation Steps

### Step 1: Read and Analyze Current Conditions
```bash
# Read all current condition files
cat data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json
cat data/mods/intimacy/conditions/actor-is-behind-entity.condition.json
cat data/mods/intimacy/conditions/entity-not-in-facing-away.condition.json
cat data/mods/intimacy/conditions/actor-in-entity-facing-away.condition.json
cat data/mods/intimacy/conditions/entity-in-facing-away.condition.json

# Note any deviations from expected structure
# Verify component references and logic patterns
```

### Step 2: Create Posturing Conditions Directory
```bash
# Verify posturing conditions directory exists
ls -la data/mods/posturing/conditions/

# Create if needed
mkdir -p data/mods/posturing/conditions/
```

### Step 3: Migrate Each Condition
```bash
# Copy all condition files
cp data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json data/mods/posturing/conditions/
cp data/mods/intimacy/conditions/actor-is-behind-entity.condition.json data/mods/posturing/conditions/
cp data/mods/intimacy/conditions/entity-not-in-facing-away.condition.json data/mods/posturing/conditions/
cp data/mods/intimacy/conditions/actor-in-entity-facing-away.condition.json data/mods/posturing/conditions/
cp data/mods/intimacy/conditions/entity-in-facing-away.condition.json data/mods/posturing/conditions/

# Edit each file to:
# - Update id: intimacy:* → posturing:*
# - Update description to be domain-agnostic
# - Update component references: intimacy:facing_away → posturing:facing_away
```

### Step 4: Validate Condition Loading
```bash
# Test loading
npm run dev

# Check console for:
# - All 5 posturing:* conditions registered
# - No validation errors
# - Logic compilation successful
# - Conditions appear in posturing mod inventory
```

## Acceptance Criteria

### ✅ Condition Migration Completion
- [ ] All 5 condition files copied to posturing mod
- [ ] All condition IDs updated to posturing namespace
- [ ] All descriptions updated to be domain-agnostic
- [ ] All component references updated to `posturing:facing_away`

### ✅ Logic Validation
- [ ] JSON Logic syntax is valid for all conditions
- [ ] Component path references are correct
- [ ] Variable references follow proper format
- [ ] Logic compilation succeeds without errors

### ✅ Domain-Agnostic Descriptions
- [ ] Both-actors-facing mentions combat, social, intimate contexts
- [ ] Actor-is-behind mentions backstab attacks, surprise actions
- [ ] Entity-not-in-facing mentions face-to-face combat, direct interaction
- [ ] Actor-in-entity-facing mentions positional advantage, social dynamics
- [ ] Entity-in-facing mentions stealth positioning, social avoidance

### ✅ Registration and Integration
- [ ] All conditions register under posturing namespace
- [ ] No validation errors during loading
- [ ] Conditions appear in posturing mod condition inventory
- [ ] Logic can be evaluated without errors

## Risk Assessment

### 🚨 Potential Issues
1. **Component Path Issues**: Component references might not resolve correctly
2. **Logic Compilation Errors**: JSON Logic syntax might be invalid
3. **Variable Reference Problems**: Variable paths might be incorrect
4. **Condition Evaluation Failures**: Logic might not evaluate at runtime

### 🛡️ Risk Mitigation
1. **Component Verification**: Ensure `posturing:facing_away` component is available
2. **Syntax Validation**: Validate JSON Logic syntax before testing
3. **Path Testing**: Test variable path resolution
4. **Runtime Testing**: Test condition evaluation with sample data

## Test Cases

### Test Case 1: Condition Registration
```bash
npm run dev
# Expected: All 5 posturing:* conditions registered
# Expected: No syntax or compilation errors
```

### Test Case 2: Component Reference Resolution
```bash
# Test that conditions can access posturing:facing_away component
# Expected: Component paths resolve correctly
# Expected: No "component not found" errors
```

### Test Case 3: Logic Evaluation
```bash
# Test condition logic with sample data
# Expected: Conditions evaluate to true/false correctly
# Expected: No runtime evaluation errors
```

### Test Case 4: Cross-Context Usage
```bash
# Test conditions work for different contexts (combat, social, intimate)
# Expected: Logic works regardless of usage context
# Expected: Spatial relationships are properly detected
```

## File Changes Summary

### New Files Created
- `data/mods/posturing/conditions/both-actors-facing-each-other.condition.json`
- `data/mods/posturing/conditions/actor-is-behind-entity.condition.json`
- `data/mods/posturing/conditions/entity-not-in-facing-away.condition.json`
- `data/mods/posturing/conditions/actor-in-entity-facing-away.condition.json`
- `data/mods/posturing/conditions/entity-in-facing-away.condition.json`

### Namespace Changes Applied
- **All Condition IDs**: `intimacy:*` → `posturing:*`
- **Component References**: `intimacy:facing_away` → `posturing:facing_away`
- **Logic Paths**: Updated to use posturing namespace component paths

### Domain Enhancement
- **Combat Context**: Added backstab, face-to-face combat, positional advantage
- **Social Context**: Added interaction, avoidance, social dynamics
- **Intimate Context**: Maintained intimate positioning use cases
- **Multi-Context**: Made all conditions applicable across domains

## Success Metrics
- **Zero** condition loading errors
- **All 5** conditions registered under posturing namespace
- **Successful** logic compilation for all conditions
- **Proper** component path resolution

## Violence Mod Integration Opportunities

### Combat-Relevant Conditions
- **actor-is-behind-entity**: Perfect for backstab attack requirements
- **both-actors-facing-each-other**: Essential for face-to-face combat
- **entity-not-in-facing-away**: Required for direct combat actions
- **actor-in-entity-facing-away**: Enables positional advantage mechanics

### Example Violence Integration
```json
{
  "id": "violence:backstab",
  "scope": "violence:enemies_in_melee_range",
  "required_conditions": [
    "posturing:actor-is-behind-entity"
  ]
}
```

## Dependencies for Next Tickets
- **Ticket 09**: Scope migration will complete positioning system
- **Tickets 10-13**: Intimacy updates will change condition references
- **Tickets 14-16**: Tests will need condition namespace updates

## Post-Migration Validation
After completion:
1. **All Conditions Available**: 5 conditions accessible via posturing namespace
2. **Logic Functional**: Conditions evaluate correctly in all contexts
3. **Component Integration**: Proper integration with posturing:facing_away
4. **Multi-Context Ready**: Conditions support combat, social, and intimate use

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Core Migration Phase
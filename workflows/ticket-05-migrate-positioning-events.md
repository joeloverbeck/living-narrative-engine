# Ticket 05: Migrate Positioning Events

## Overview
**Phase**: 2 - Core Logic Migration  
**Priority**: Critical  
**Estimated Time**: 2-3 hours  
**Dependencies**: Ticket 04 (facing_away Component Migration)  
**Implements**: Report section "Event System Analysis" - 3 positioning events

## Objective
Migrate three positioning events from intimacy mod to posturing mod, updating their namespaces and making them domain-agnostic for use across multiple game contexts including combat, social interactions, and intimate scenarios.

## Background
**Events to Migrate**:
1. `actor_turned_around.event.json` - `intimacy:actor_turned_around` → `posturing:actor_turned_around`
2. `actor_faced_everyone.event.json` - `intimacy:actor_faced_everyone` → `posturing:actor_faced_everyone`  
3. `actor_faced_forward.event.json` - `intimacy:actor_faced_forward` → `posturing:actor_faced_forward`

**From Migration Analysis**:
- All three events are generic positioning events with no intimacy-specific logic
- Used in rules, actions, and extensively in test suites
- Enable spatial relationship changes that apply to any game context
- Critical for violence mod integration (backstab, defensive positioning, etc.)

## Implementation Tasks

### Task 5.1: Migrate actor_turned_around Event
**Source**: `data/mods/intimacy/events/actor_turned_around.event.json`  
**Target**: `data/mods/posturing/events/actor_turned_around.event.json`

**Current Content** (based on report):
```json
{
  "id": "intimacy:actor_turned_around",
  "description": "Dispatched when an actor turns another actor around so they are facing away.",
  "payloadSchema": {
    "properties": {
      "actor": { "description": "The ID of the actor who was turned around." },
      "turned_by": { "description": "The ID of the actor who initiated the turn around action." }
    }
  }
}
```

**Updated Content**:
```json
{
  "id": "posturing:actor_turned_around",
  "description": "Dispatched when an actor turns another actor around so they are facing away. Used in combat, social, and intimate contexts for spatial positioning.",
  "payloadSchema": {
    "type": "object",
    "required": ["actor", "turned_by"],
    "properties": {
      "actor": { 
        "type": "string",
        "description": "The ID of the actor who was turned around." 
      },
      "turned_by": { 
        "type": "string",
        "description": "The ID of the actor who initiated the turn around action." 
      }
    }
  }
}
```

### Task 5.2: Migrate actor_faced_everyone Event
**Source**: `data/mods/intimacy/events/actor_faced_everyone.event.json`  
**Target**: `data/mods/posturing/events/actor_faced_everyone.event.json`

**Current Content** (based on report):
```json
{
  "id": "intimacy:actor_faced_everyone",
  "description": "Dispatched when an actor turns around to face everyone they were facing away from.",
  "payloadSchema": {
    "properties": {
      "actor": { "description": "The ID of the actor who turned around" },
      "faced": { "description": "The name of the specific target the action was performed on" }
    }
  }
}
```

**Updated Content**:
```json
{
  "id": "posturing:actor_faced_everyone",
  "description": "Dispatched when an actor turns around to face everyone they were facing away from. Applies to combat readiness, social engagement, and intimate interactions.",
  "payloadSchema": {
    "type": "object",
    "required": ["actor", "faced"],
    "properties": {
      "actor": { 
        "type": "string",
        "description": "The ID of the actor who turned around" 
      },
      "faced": { 
        "type": "string",
        "description": "The name of the specific target the action was performed on" 
      }
    }
  }
}
```

### Task 5.3: Migrate actor_faced_forward Event
**Source**: `data/mods/intimacy/events/actor_faced_forward.event.json`  
**Target**: `data/mods/posturing/events/actor_faced_forward.event.json`

**Current Content** (based on report):
```json
{
  "id": "intimacy:actor_faced_forward",
  "description": "Dispatched when an actor faces forward toward another actor after previously facing away.",
  "payloadSchema": {
    "properties": {
      "actor": { "description": "The ID of the actor who is now facing forward." },
      "facing": { "description": "The ID of the actor who is now being faced." }
    }
  }
}
```

**Updated Content**:
```json
{
  "id": "posturing:actor_faced_forward",
  "description": "Dispatched when an actor faces forward toward another actor after previously facing away. Used for defensive positioning, social acknowledgment, and intimate engagement.",
  "payloadSchema": {
    "type": "object",
    "required": ["actor", "facing"],
    "properties": {
      "actor": { 
        "type": "string",
        "description": "The ID of the actor who is now facing forward." 
      },
      "facing": { 
        "type": "string",
        "description": "The ID of the actor who is now being faced." 
      }
    }
  }
}
```

### Task 5.4: Schema Enhancement
**Improvements Made**:
1. **Added `type: "object"`** to all payloadSchema definitions
2. **Added `required` arrays** to specify mandatory fields
3. **Added `type: "string"`** to all property definitions
4. **Enhanced descriptions** to be domain-agnostic
5. **Maintained payload structure** for backward compatibility

## Implementation Steps

### Step 1: Backup and Analyze Current Events
```bash
# Read current event files
cat data/mods/intimacy/events/actor_turned_around.event.json
cat data/mods/intimacy/events/actor_faced_everyone.event.json
cat data/mods/intimacy/events/actor_faced_forward.event.json

# Verify posturing events directory exists
ls -la data/mods/posturing/events/
```

### Step 2: Create Posturing Events
```bash
# Copy each event file to posturing mod
cp data/mods/intimacy/events/actor_turned_around.event.json data/mods/posturing/events/
cp data/mods/intimacy/events/actor_faced_everyone.event.json data/mods/posturing/events/
cp data/mods/intimacy/events/actor_faced_forward.event.json data/mods/posturing/events/

# Edit each file to update namespace, description, and schema
```

### Step 3: Update Event Namespaces and Schemas
For each event file:
1. Update `id` field from `intimacy:*` to `posturing:*`
2. Update description to be domain-agnostic
3. Add proper schema structure with types and required fields
4. Validate JSON syntax

### Step 4: Test Event Registration
```bash
# Start development server
npm run dev

# Check console for:
# - posturing:actor_turned_around event registered
# - posturing:actor_faced_everyone event registered
# - posturing:actor_faced_forward event registered
# - No schema validation errors
```

## Acceptance Criteria

### ✅ Event Migration Completion
- [ ] `actor_turned_around.event.json` copied to posturing mod
- [ ] `actor_faced_everyone.event.json` copied to posturing mod  
- [ ] `actor_faced_forward.event.json` copied to posturing mod
- [ ] All event IDs updated to posturing namespace

### ✅ Schema Enhancement
- [ ] All events have proper `type: "object"` in payloadSchema
- [ ] All events have `required` arrays defining mandatory fields
- [ ] All properties have `type: "string"` definitions
- [ ] JSON syntax is valid for all event files

### ✅ Domain-Agnostic Descriptions
- [ ] actor_turned_around mentions combat, social, intimate contexts
- [ ] actor_faced_everyone mentions readiness, engagement, interactions
- [ ] actor_faced_forward mentions defensive, social, intimate positioning
- [ ] No intimacy-specific language remains

### ✅ Registration and Validation
- [ ] All three events register under posturing namespace
- [ ] No schema validation errors occur
- [ ] Events appear in posturing mod event inventory
- [ ] No duplicate event registration warnings

## Risk Assessment

### 🚨 Potential Issues
1. **Schema Validation Failures**: Enhanced schemas might not validate properly
2. **Event Registration Conflicts**: Duplicate events between intimacy and posturing
3. **Payload Structure Changes**: Schema enhancements might break compatibility  
4. **Namespace Resolution Issues**: Rules might not find events under new namespaces

### 🛡️ Risk Mitigation
1. **Schema Testing**: Validate each schema independently before testing
2. **Registration Monitoring**: Watch for duplicate event warnings
3. **Payload Compatibility**: Maintain exact payload structure while adding validation
4. **Namespace Tracking**: Document all namespace changes for later reference updates

## Validation Testing

### Test Case 1: Event Registration
```bash
npm run dev

# Expected Output:
# "posturing:actor_turned_around event registered"
# "posturing:actor_faced_everyone event registered"  
# "posturing:actor_faced_forward event registered"
# No schema validation errors
```

### Test Case 2: Schema Validation
```bash
# For each event, validate schema structure
# Expected: All payloadSchema definitions are valid
# Expected: Required fields are properly defined
# Expected: Property types are correctly specified
```

### Test Case 3: Payload Compatibility
```bash
# Test that existing payload structures still work
# Expected: actor and turned_by fields work for actor_turned_around
# Expected: actor and faced fields work for actor_faced_everyone
# Expected: actor and facing fields work for actor_faced_forward
```

## File Changes Summary

### New Files Created
- `data/mods/posturing/events/actor_turned_around.event.json`
- `data/mods/posturing/events/actor_faced_everyone.event.json`
- `data/mods/posturing/events/actor_faced_forward.event.json`

### Key Changes Per Event
1. **Namespace Update**: `intimacy:*` → `posturing:*`
2. **Description Enhancement**: Domain-specific → Domain-agnostic
3. **Schema Improvement**: Added types, required fields, proper structure
4. **Context Expansion**: Added combat, social, defensive use cases

## Success Metrics
- **Zero** event registration errors
- **All three** events available under posturing namespace
- **Enhanced** schema validation without breaking changes
- **Domain-agnostic** descriptions supporting multiple use cases

## Cross-Reference Validation

**From Migration Analysis Report**:
- ✅ `actor_turned_around` - Used in `turn_around.rule.json`
- ✅ `actor_faced_everyone` - Used in `turn_around_to_face.rule.json`
- ✅ `actor_faced_forward` - Used in `turn_around.rule.json`
- ✅ All three events have generic positioning logic

## Dependencies for Next Tickets
- **Tickets 06-07**: Actions and rules will reference these events
- **Ticket 08**: Conditions may check for these events
- **Tickets 10-13**: Intimacy updates will change event references
- **Tickets 14-16**: Tests will need event namespace updates

## Post-Migration Validation
After completion:
1. **Events Available**: All three events accessible via posturing namespace
2. **Schemas Valid**: Enhanced schemas pass validation
3. **Ready for Rules**: Events can be referenced by rules and actions
4. **Multi-Context**: Events support combat, social, and intimate scenarios

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Core Migration Phase
# Ticket 02: Complete Posturing Mod Manifest

## Overview
**Phase**: 1 - Foundation Setup  
**Priority**: Critical  
**Estimated Time**: 1-2 hours  
**Dependencies**: Ticket 01 (Foundation Setup)  
**Implements**: Report recommendations for posturing mod manifest completion

## Objective
Complete the posturing mod manifest to properly declare all components, events, actions, rules, conditions, and scopes that will be migrated from the intimacy mod, ensuring proper mod loading and content registration.

## Background
Current `data/mods/posturing/mod-manifest.json`:
```json
{
  "$schema": "http://example.com/schemas/mod-manifest.schema.json",
  "id": "posturing",
  "version": "1.0.0",
  "name": "posturing",
  "content": {}
}
```

**Issues**:
- Missing proper schema reference
- Empty content object
- No description or metadata
- Missing dependency declarations
- Incomplete content declarations

## Implementation Tasks

### Task 2.1: Update Manifest Metadata
**File**: `data/mods/posturing/mod-manifest.json`

**Complete Manifest Content**:
```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "posturing",
  "version": "1.0.0",
  "name": "posturing",
  "description": "Core positioning and facing mechanics for spatial relationships between actors. Provides fundamental positioning logic used by other mods for intimate, combat, and social interactions.",
  "author": "Living Narrative Engine Team",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    {
      "id": "core",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "actions": [
      "turn_around.action.json",
      "turn_around_to_face.action.json"
    ],
    "components": [
      "facing_away.component.json"
    ],
    "conditions": [
      "both-actors-facing-each-other.condition.json",
      "actor-is-behind-entity.condition.json",
      "entity-not-in-facing-away.condition.json",
      "actor-in-entity-facing-away.condition.json",
      "entity-in-facing-away.condition.json"
    ],
    "entities": {
      "definitions": [],
      "instances": []
    },
    "events": [
      "actor_turned_around.event.json",
      "actor_faced_everyone.event.json",
      "actor_faced_forward.event.json"
    ],
    "macros": [],
    "rules": [
      "turn_around.rule.json",
      "turn_around_to_face.rule.json"
    ],
    "scopes": [
      "actors_im_facing_away_from.scope",
      "close_actors_facing_away.scope"
    ]
  }
}
```

### Task 2.2: Content Declaration Analysis

**Components (1 item)**:
- `facing_away.component.json` - Core component for tracking spatial facing relationships

**Events (3 items)**:
- `actor_turned_around.event.json` - When actor is turned around by another
- `actor_faced_everyone.event.json` - When actor faces all previously faced-away entities
- `actor_faced_forward.event.json` - When actor turns to face forward

**Actions (2 items)**:
- `turn_around.action.json` - Action to turn an actor around
- `turn_around_to_face.action.json` - Action to turn around to face someone

**Rules (2 items)**:
- `turn_around.rule.json` - Handles turn around action processing
- `turn_around_to_face.rule.json` - Handles turn around to face action processing

**Conditions (5 items)**:
- `both-actors-facing-each-other.condition.json` - Check if two actors face each other
- `actor-is-behind-entity.condition.json` - Check if actor is behind an entity
- `entity-not-in-facing-away.condition.json` - Check if entity is not in facing away list
- `actor-in-entity-facing-away.condition.json` - Check if actor is in entity's facing away list
- `entity-in-facing-away.condition.json` - Check if entity is in facing away list

**Scopes (2 items)**:
- `actors_im_facing_away_from.scope` - Get actors current actor is facing away from
- `close_actors_facing_away.scope` - Get close actors that are facing away (requires dependency analysis)

### Task 2.3: Validate Manifest Structure
**Validation Requirements**:
1. Schema reference matches other mod manifests
2. All content items will exist after migration
3. Dependencies are correctly declared
4. Content structure follows established patterns

## Acceptance Criteria

### ✅ Manifest Completeness
- [ ] Schema reference uses correct living-narrative-engine schema
- [ ] Description clearly explains posturing mod purpose
- [ ] Author and version information is complete
- [ ] Dependencies section includes core mod

### ✅ Content Declaration Accuracy
- [ ] All 1 component properly declared
- [ ] All 3 events properly declared  
- [ ] All 2 actions properly declared
- [ ] All 2 rules properly declared
- [ ] All 5 conditions properly declared
- [ ] All 2 scopes properly declared

### ✅ Structural Validation
- [ ] JSON is valid and well-formed
- [ ] Content structure matches other mod manifests
- [ ] File names match established patterns
- [ ] Empty sections (entities, macros) are properly declared

### ✅ Integration Testing
- [ ] Mod loads successfully with new manifest
- [ ] No validation errors during startup
- [ ] Manifest parsing completes without issues
- [ ] Content registration works properly

## Risk Assessment

### 🚨 Potential Issues
1. **Schema Validation Errors**: Incorrect schema reference could prevent loading
2. **Content Mismatch**: Declared content doesn't match actual files during migration
3. **Dependency Issues**: Missing core dependency could cause loading failures
4. **JSON Syntax Errors**: Malformed JSON would prevent mod loading

### 🛡️ Risk Mitigation
1. **Schema Validation**: Use exact schema reference from working mods
2. **Content Verification**: Cross-reference with migration analysis report
3. **JSON Validation**: Use JSON validator before testing
4. **Incremental Testing**: Test manifest changes before proceeding to migration

## Implementation Steps

### Step 1: Backup Current Manifest
```bash
cp data/mods/posturing/mod-manifest.json data/mods/posturing/mod-manifest.json.backup
```

### Step 2: Update Manifest Content
1. Open `data/mods/posturing/mod-manifest.json`
2. Replace entire content with complete manifest
3. Validate JSON syntax
4. Save file

### Step 3: Validate Schema and Structure
```bash
# Test mod loading
npm run dev

# Check console for manifest validation
# Look for posturing mod in loaded mods list
```

### Step 4: Verify Content Registration
1. Confirm no schema validation errors
2. Check that posturing mod appears in system
3. Verify content sections are recognized
4. Test that dependencies resolve properly

## File Dependencies

**Referenced Files** (will be created in subsequent tickets):
```
data/mods/posturing/
├── actions/
│   ├── turn_around.action.json
│   └── turn_around_to_face.action.json
├── components/
│   └── facing_away.component.json
├── conditions/
│   ├── both-actors-facing-each-other.condition.json
│   ├── actor-is-behind-entity.condition.json
│   ├── entity-not-in-facing-away.condition.json
│   ├── actor-in-entity-facing-away.condition.json
│   └── entity-in-facing-away.condition.json
├── events/
│   ├── actor_turned_around.event.json
│   ├── actor_faced_everyone.event.json
│   └── actor_faced_forward.event.json
├── rules/
│   ├── turn_around.rule.json
│   └── turn_around_to_face.rule.json
└── scopes/
    ├── actors_im_facing_away_from.scope
    └── close_actors_facing_away.scope
```

## Success Metrics
- **Zero** manifest validation errors
- **All** content sections properly declared
- **Successful** mod loading with new manifest
- **Proper** dependency resolution

## Cross-Reference Validation

**From Migration Analysis Report**:
- ✅ `facing_away.component.json` (1 component)
- ✅ 3 positioning events listed correctly
- ✅ 2 actions identified for migration
- ✅ 2 rules identified for migration  
- ✅ 5 conditions identified for migration
- ✅ 2 scopes identified for migration

**Total Content Items**: 15 items to be migrated and declared

## Dependencies for Next Tickets
- **Ticket 03**: Requires manifest to be complete for dependency validation
- **All Migration Tickets (04-09)**: Require proper content declaration to register migrated files
- **Intimacy Update Tickets (10-13)**: Need posturing manifest to be complete before removing content from intimacy

## Post-Implementation Notes
After completion:
1. **Document** the complete content inventory
2. **Verify** that intimacy mod can still resolve posturing dependency
3. **Prepare** for actual file migration in subsequent tickets
4. **Test** that empty content sections don't cause issues

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Foundation Phase
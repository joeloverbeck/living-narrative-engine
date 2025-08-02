# positioning Mod Migration Analysis Report

**Date**: January 2025  
**Project**: Living Narrative Engine  
**Focus**: Architecture Analysis and Migration Strategy

## Executive Summary

This report analyzes the usage patterns of `facing_away.component.json` and related positioning events within the intimacy mod, with the goal of migrating generic positioning logic to the new `positioning` mod. The analysis reveals significant architectural coupling that requires careful migration planning.

### Key Findings

- **67 total references** to `facing_away` component across the codebase
- **3 positioning events** currently namespaced under intimacy mod
- **Mixed concerns**: Generic spatial positioning logic intermixed with intimacy-specific behaviors
- **Cross-mod potential**: Violence mod would benefit from facing/positioning mechanics
- **Migration complexity**: High due to extensive integration with intimacy-specific actions

### Recommendations

1. **Migrate core positioning system** to positioning mod
2. **Maintain backwards compatibility** during transition period
3. **Refactor intimacy-specific actions** to depend on positioning mod
4. **Enable violence mod integration** with positioning mechanics

---

## Component Usage Analysis

### Core Component: `facing_away.component.json`

**Current Location**: `data/mods/intimacy/components/facing_away.component.json`  
**Current ID**: `intimacy:facing_away`  
**Proposed New ID**: `positioning:facing_away`

**Component Schema**:

```json
{
  "id": "intimacy:facing_away",
  "description": "Tracks which actors this entity is facing away from in an intimate context",
  "dataSchema": {
    "type": "object",
    "required": ["facing_away_from"],
    "properties": {
      "facing_away_from": {
        "type": "array",
        "description": "Entity IDs this actor is facing away from",
        "items": {
          "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
        }
      }
    }
  }
}
```

**Analysis**: The component itself is domain-agnostic and purely tracks spatial relationships. The intimate context mentioned in the description is restrictive - this component could apply to any scenario requiring facing/positioning logic.

### Usage Statistics

| Category                        | Count | Examples                                        |
| ------------------------------- | ----- | ----------------------------------------------- |
| **Direct Component References** | 25    | Rules, actions, conditions                      |
| **Scope DSL Usage**             | 8     | `actor.intimacy:facing_away.facing_away_from[]` |
| **Test Cases**                  | 34    | Integration and unit tests                      |
| **Total References**            | 67    | Across entire codebase                          |

---

## Event System Analysis

### Event 1: `actor_turned_around.event.json`

**Current ID**: `intimacy:actor_turned_around`  
**Proposed New ID**: `positioning:actor_turned_around`

```json
{
  "id": "intimacy:actor_turned_around",
  "description": "Dispatched when an actor turns another actor around so they are facing away.",
  "payloadSchema": {
    "properties": {
      "actor": { "description": "The ID of the actor who was turned around." },
      "turned_by": {
        "description": "The ID of the actor who initiated the turn around action."
      }
    }
  }
}
```

**Usage**: Referenced in `turn_around.rule.json` and multiple test cases. Generic positioning event with no intimacy-specific logic.

### Event 2: `actor_faced_everyone.event.json`

**Current ID**: `intimacy:actor_faced_everyone`  
**Proposed New ID**: `positioning:actor_faced_everyone`

```json
{
  "id": "intimacy:actor_faced_everyone",
  "description": "Dispatched when an actor turns around to face everyone they were facing away from.",
  "payloadSchema": {
    "properties": {
      "actor": { "description": "The ID of the actor who turned around" },
      "faced": {
        "description": "The name of the specific target the action was performed on"
      }
    }
  }
}
```

**Usage**: Referenced in `turn_around_to_face.rule.json`. Generic event applicable to any positioning scenario.

### Event 3: `actor_faced_forward.event.json`

**Current ID**: `intimacy:actor_faced_forward`  
**Proposed New ID**: `positioning:actor_faced_forward`

```json
{
  "id": "intimacy:actor_faced_forward",
  "description": "Dispatched when an actor faces forward toward another actor after previously facing away.",
  "payloadSchema": {
    "properties": {
      "actor": {
        "description": "The ID of the actor who is now facing forward."
      },
      "facing": { "description": "The ID of the actor who is now being faced." }
    }
  }
}
```

**Usage**: Referenced in `turn_around.rule.json` for state transitions. Generic positioning logic.

---

## Cross-Mod Impact Assessment

### Intimacy Mod Dependencies

**High-Coupling Actions** (require intimacy context):

- `massage_back.action.json` - Requires behind position + intimate context
- `place_hand_on_waist.action.json` - Intimate behind-position action
- Various kissing/intimate actions that check facing states

**Generic Actions** (suitable for positioning mod):

- `turn_around.action.json` - Pure positioning logic
- `turn_around_to_face.action.json` - Generic facing change

### Violence Mod Integration Opportunities

**Potential Use Cases**:

- **Backstab/Sneak Attack**: Require target to be facing away
- **Defensive Positioning**: Turn to face attackers
- **Ambush Mechanics**: Take advantage of facing-away state
- **Combat Positioning**: Strategic turning in combat

**Example Violence Integration**:

```json
{
  "id": "violence:backstab",
  "name": "Backstab",
  "scope": "violence:close_enemies_facing_away",
  "required_components": {
    "target": ["positioning:facing_away"]
  }
}
```

### Core Mod Integration

**Foundation Requirements**:

- Basic positioning should be available without intimacy dependency
- Core spatial relationships (facing, behind, etc.) are fundamental mechanics
- Multiple mods benefit from shared positioning vocabulary

---

## Detailed Migration Strategy

### Phase 1: Foundation Setup

1. **Create positioning mod structure**:

   ```
   data/mods/positioning/
   ├── components/
   ├── events/
   ├── actions/
   ├── rules/
   ├── conditions/
   ├── scopes/
   └── mod-manifest.json
   ```

2. **Copy core positioning components** with new namespacing:
   - `positioning:facing_away` (from `intimacy:facing_away`)

3. **Copy positioning events** with new IDs:
   - `positioning:actor_turned_around`
   - `positioning:actor_faced_everyone`
   - `positioning:actor_faced_forward`

### Phase 2: Core Logic Migration

**Components to Move**:

- ✅ `facing_away.component.json` → `positioning:facing_away`

**Events to Move**:

- ✅ `actor_turned_around.event.json` → `positioning:actor_turned_around`
- ✅ `actor_faced_everyone.event.json` → `positioning:actor_faced_everyone`
- ✅ `actor_faced_forward.event.json` → `positioning:actor_faced_forward`

**Actions to Move**:

- ✅ `turn_around.action.json` → `positioning:turn_around`
- ✅ `turn_around_to_face.action.json` → `positioning:turn_around_to_face`

**Rules to Move**:

- ✅ `turn_around.rule.json` → `positioning:turn_around`
- ✅ `turn_around_to_face.rule.json` → `positioning:turn_around_to_face`

**Conditions to Move**:

- ✅ `both-actors-facing-each-other.condition.json` → `positioning:both-actors-facing-each-other`
- ✅ `actor-is-behind-entity.condition.json` → `positioning:actor-is-behind-entity`
- ✅ `entity-not-in-facing-away.condition.json` → `positioning:entity-not-in-facing-away`
- ✅ `actor-in-entity-facing-away.condition.json` → `positioning:actor-in-entity-facing-away`
- ✅ `entity-in-facing-away.condition.json` → `positioning:entity-in-facing-away`

**Scopes to Move**:

- ✅ `actors_im_facing_away_from.scope` → `positioning:actors_im_facing_away_from`
- ⚠️ `close_actors_facing_away.scope` → Requires intimacy dependency analysis

### Phase 3: Intimacy Mod Refactoring

**Actions to Keep in Intimacy** (require intimate context):

- `massage_back.action.json` - Update to use `positioning:facing_away`
- `place_hand_on_waist.action.json` - Update to use `positioning:facing_away`

**Dependencies to Update**:

- All intimacy rules referencing `intimacy:facing_away` → `positioning:facing_away`
- All intimacy conditions using facing logic → update references
- All intimacy scopes using facing logic → update references

### Phase 4: Test Migration

**Test Files Requiring Updates**: 34 files

- `/tests/integration/rules/stepBackRule.integration.test.js`
- `/tests/integration/rules/turnAroundToFaceRule.integration.test.js`
- `/tests/integration/rules/turnAroundRule.integration.test.js`
- `/tests/unit/events/intimacyEventValidation.test.js`

**Update Strategy**:

1. Update component references: `intimacy:facing_away` → `positioning:facing_away`
2. Update event references: `intimacy:actor_*` → `positioning:actor_*`
3. Ensure test isolation between mods
4. Add new positioning mod tests

---

## Risk Assessment

### High Risk Areas

1. **Scope Dependencies**: `close_actors_facing_away.scope` combines positioning with intimacy logic
2. **Event Handler Coupling**: Rules expect intimacy-namespaced events
3. **Test Coupling**: 34 test files directly reference intimacy positioning

### Migration Risks

| Risk                          | Impact | Probability | Mitigation                                     |
| ----------------------------- | ------ | ----------- | ---------------------------------------------- |
| **Circular Dependencies**     | High   | Medium      | Careful dependency ordering during migration   |
| **Test Failures**             | Medium | High        | Comprehensive test updates with each phase     |
| **Runtime Errors**            | High   | Low         | Gradual migration with backwards compatibility |
| **Scope Resolution Failures** | Medium | Medium      | Update scope DSL parsing for new namespaces    |

### Mitigation Strategies

1. **Backwards Compatibility**: Maintain intimacy references during transition
2. **Gradual Migration**: Move components in phases with validation
3. **Comprehensive Testing**: Update all test suites before final migration
4. **Dependency Validation**: Ensure proper mod loading order

---

## Implementation Recommendations

### Immediate Actions

1. **Update positioning mod manifest** to include all core positioning components
2. **Create positioning component schemas** with generic descriptions
3. **Migrate core positioning logic** without intimacy dependencies
4. **Update intimacy mod** to depend on positioning mod

### Mod Dependencies

**New Dependency Structure**:

```
positioning (base positioning)
    ↑
intimacy (intimate positioning behaviors)
    ↑
violence (combat positioning behaviors)
```

### Component ID Mapping

| Current ID                      | New ID                             | Notes          |
| ------------------------------- | ---------------------------------- | -------------- |
| `intimacy:facing_away`          | `positioning:facing_away`          | Core component |
| `intimacy:actor_turned_around`  | `positioning:actor_turned_around`  | Generic event  |
| `intimacy:actor_faced_everyone` | `positioning:actor_faced_everyone` | Generic event  |
| `intimacy:actor_faced_forward`  | `positioning:actor_faced_forward`  | Generic event  |
| `intimacy:turn_around`          | `positioning:turn_around`          | Core action    |
| `intimacy:turn_around_to_face`  | `positioning:turn_around_to_face`  | Core action    |

### Validation Checklist

- [ ] All positioning components are domain-agnostic
- [ ] No intimacy-specific logic in positioning mod
- [ ] Violence mod can integrate with positioning
- [ ] Backwards compatibility maintained
- [ ] All tests pass after migration
- [ ] Scope DSL parsing works with new namespaces
- [ ] Event handlers updated for new event IDs
- [ ] Component references updated throughout codebase

---

## Conclusion

The migration of facing/positioning logic from the intimacy mod to the new positioning mod is architecturally sound and necessary for proper separation of concerns. The positioning system is fundamentally generic and will enable better cross-mod integration, particularly with the violence mod.

The migration requires careful planning due to extensive coupling (67 references), but the benefits of proper domain separation and reusability justify the effort. Following the phased approach outlined above will minimize risks and ensure a successful transition.

**Next Steps**: Begin with Phase 1 (Foundation Setup) and proceed incrementally through each phase with comprehensive testing at each stage.

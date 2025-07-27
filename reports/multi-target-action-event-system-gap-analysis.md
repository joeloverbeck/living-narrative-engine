# Multi-Target Action Event System Gap Analysis

## Executive Summary

This report analyzes the current implementation of multi-target actions in the Living Narrative Engine and identifies a critical gap between the action formatting system and the event/rules system. While the engine has implemented sophisticated multi-target action formatting capabilities through the `MultiTargetActionFormatter`, the event system and rules are still limited to processing a single target, creating a fundamental disconnect in the architecture.

**Key Finding**: Multi-target actions can be formatted and displayed to users (e.g., "adjust Alice's red dress"), but when executed, only a single target is passed to rules through the `core:attempt_action` event, limiting the system's ability to process actions that naturally involve multiple targets.

## Current Architecture Analysis

### 1. Multi-Target Action Formatting System ✅ IMPLEMENTED

The multi-target formatting system is fully functional and includes:

**MultiTargetActionFormatter** (`src/actions/formatters/MultiTargetActionFormatter.js`)
- Supports multi-placeholder templates (e.g., "adjust {person}'s {clothing}")
- Generates target combinations for complex scenarios
- Handles both single actions and combination generation
- Maintains backward compatibility with legacy formatters

**ActionFormattingStage** (`src/actions/pipeline/stages/ActionFormattingStage.js`)
- Processes multi-target resolved data
- Extracts multiple `targetIds` and includes them in action parameters
- Provides fallback to legacy formatting when needed
- Creates rich action information with `isMultiTarget` flag

**Example of Working Multi-Target Formatting:**
```javascript
// Input template: "adjust {person}'s {clothing}"
// Resolved targets: { person: [alice_entity], clothing: [red_dress_entity] }
// Output: "adjust Alice's red dress"
// Action params: { 
//   targetIds: { person: ["alice_123"], clothing: ["dress_456"] },
//   isMultiTarget: true 
// }
```

### 2. Event System Limitation ❌ SINGLE TARGET ONLY

The event system remains restricted to single targets:

**Event Schema** (`data/mods/core/events/attempt_action.event.json`)
```json
{
  "eventName": "core:attempt_action",
  "actorId": "string (required)",
  "actionId": "string (required)", 
  "targetId": "string (optional)",     // ← SINGLE TARGET ONLY
  "originalInput": "string (required)"
}
```

**Command Processor** (`src/commands/commandProcessor.js:186-196`)
```javascript
#createAttemptActionPayload(actor, turnAction) {
  const { actionDefinitionId, resolvedParameters, commandString } = turnAction;
  return {
    eventName: ATTEMPT_ACTION_ID,
    actorId: actor.id,
    actionId: actionDefinitionId,
    targetId: resolvedParameters?.targetId || null,  // ← SINGLE TARGET
    originalInput: commandString || actionDefinitionId,
  };
}
```

### 3. Rules System Limitation ❌ SINGLE TARGET ACCESS

All rules can only access a single target through the event payload:

**Example Rule** (`data/mods/core/rules/follow.rule.json`)
```json
{
  "event_type": "core:attempt_action",
  "actions": [
    {
      "type": "CHECK_FOLLOW_CYCLE",
      "parameters": {
        "follower_id": "{event.payload.actorId}",
        "leader_id": "{event.payload.targetId}"    // ← SINGLE TARGET ONLY
      }
    }
  ]
}
```

**Pattern Analysis**: All 11 core rules examined follow this same pattern:
- `{event.payload.actorId}` - Actor performing action
- `{event.payload.targetId}` - Single target (if any)
- `{event.payload.actionId}` - Action being performed
- `{event.payload.originalInput}` - Original command text

## The Gap: Multi-Target Actions vs Single-Target Events

### Data Flow Disconnect

```
1. Action Discovery Pipeline
   ├── MultiTargetResolutionStage → Resolves multiple targets
   ├── ActionFormattingStage → Formats with multiple placeholders
   └── Creates action with targetIds: { person: ["alice"], clothing: ["dress"] }

2. Command Processing
   ├── CommandProcessor receives formatted action
   ├── Takes ONLY primary target: resolvedParameters?.targetId
   └── Creates event payload with single targetId: "alice"

3. Rule Processing  
   ├── Rules receive attempt_action event
   ├── Can ONLY access {event.payload.targetId}: "alice"  
   └── Cannot access secondary target "dress"
```

### Impact on Action Execution

For an action like "adjust Alice's red dress":

1. **Formatting**: ✅ Works correctly - produces "adjust Alice's red dress"
2. **Event Creation**: ❌ Loses secondary target - only passes Alice's ID
3. **Rule Execution**: ❌ Cannot determine which dress to adjust

### Specific Examples of Affected Actions

1. **"adjust {person}'s {clothing}"**
   - Formatted: "adjust Alice's red dress"
   - Event: `targetId: "alice_123"` (dress information lost)
   - Rule problem: Cannot determine which clothing item to adjust

2. **"throw {item} at {target}"**
   - Formatted: "throw knife at goblin"  
   - Event: `targetId: "knife_456"` (goblin information lost)
   - Rule problem: Cannot determine throw target

3. **"give {item} to {recipient}"**
   - Formatted: "give coin to merchant"
   - Event: `targetId: "coin_789"` (recipient information lost)
   - Rule problem: Cannot determine who receives the item

## Implementation Gap: Specification vs Reality

### Multi-Target System Specification

The `specs/multi-target-action-system.spec.md` defines an enhanced event payload:

```javascript
// PLANNED but NOT IMPLEMENTED
{
  eventName: "core:attempt_action",
  actorId: "entity_123",
  actionId: "combat:throw",
  // Multi-target structure
  targets: {
    primary: "knife_456",
    secondary: "goblin_789"
  },
  // Backward compatibility
  targetId: "knife_456",
  originalInput: "throw knife at goblin"
}
```

### Current Reality Gap

1. **Event Schema**: Still uses single `targetId` field
2. **Command Processor**: Still creates single-target payloads
3. **Rules**: Still access only `{event.payload.targetId}`
4. **Timeline**: Multi-target formatting implemented, but event system updates missing

## Technical Analysis: Where Multi-Target Data is Lost

### Target Data Extraction (Working)

In `ActionFormattingStage.js:356-362`:
```javascript
#extractTargetIds(resolvedTargets) {
  const targetIds = {};
  for (const [key, targets] of Object.entries(resolvedTargets)) {
    targetIds[key] = targets.map((t) => t.id);
  }
  return targetIds;
}
```

**This data exists** in the formatted action but is never passed to the event system.

### Command Processor Bottleneck (Critical Gap)

In `commandProcessor.js:186-196`, the bottleneck occurs:
```javascript
// Multi-target data from formatting stage is available here
// but only primary target is extracted:
targetId: resolvedParameters?.targetId || null
```

**The `resolvedParameters` object likely contains the full multi-target data, but only the primary target is extracted.**

### Event Schema Limitation (Missing Implementation)

The `attempt_action.event.json` schema needs to be updated to support:
```json
{
  "properties": {
    "targets": {
      "type": "object",
      "description": "Multiple targets by role",
      "additionalProperties": {
        "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId"
      }
    },
    "targetId": {
      "description": "Primary target for backward compatibility"
    }
  }
}
```

## Risk Assessment

### High Impact Risks

1. **Feature Limitation**: Multi-target actions cannot be properly implemented
2. **User Experience**: Actions appear to work but execute incorrectly
3. **Modder Confusion**: Action formatting works but rules fail mysteriously
4. **Technical Debt**: Growing gap between formatting and execution systems

### Business Impact

1. **Reduced Game Complexity**: Cannot implement rich multi-target interactions
2. **Modding Limitations**: Modders cannot create sophisticated actions
3. **Player Frustration**: Actions don't behave as expected from their descriptions

### Technical Impact

1. **Architecture Inconsistency**: Formatting and event systems diverging
2. **Maintenance Burden**: Workarounds and patches accumulating
3. **Future Development**: New features blocked by fundamental limitation

## Recommendations

### Priority 1: Critical Path (Must Fix)

1. **Update Event Schema** (`attempt_action.event.json`)
   ```json
   {
     "targets": {
       "type": "object",
       "additionalProperties": { "$ref": "...#/definitions/namespacedId" }
     },
     "targetId": { "description": "Primary target for backward compatibility" }
   }
   ```

2. **Enhance Command Processor** (`commandProcessor.js`)
   ```javascript
   #createAttemptActionPayload(actor, turnAction) {
     return {
       eventName: ATTEMPT_ACTION_ID,
       actorId: actor.id,
       actionId: actionDefinitionId,
       targets: resolvedParameters?.targets || {},
       targetId: resolvedParameters?.targetId || null, // Backward compatibility
       originalInput: commandString || actionDefinitionId,
     };
   }
   ```

3. **Update Core Rules** (Backward Compatible)
   ```json
   {
     "parameters": {
       "primary_target": "{event.payload.targets.primary || event.payload.targetId}",
       "secondary_target": "{event.payload.targets.secondary}"
     }
   }
   ```

### Priority 2: System Enhancement

1. **Create Multi-Target Rule Examples**
   - Demonstrate how rules can access multiple targets
   - Provide templates for common multi-target patterns
   - Document best practices for multi-target rule design

2. **Add Validation Layer**
   - Validate that multi-target actions have corresponding rule support
   - Warn when actions reference targets not accessible in rules
   - Provide development-time feedback for action/rule mismatches

3. **Improve Documentation**
   - Update modding documentation with multi-target examples
   - Explain the relationship between action formatting and rule execution
   - Provide migration guide for existing single-target actions

### Priority 3: Future Enhancements

1. **Rule Helper Functions**
   - Create utility functions for common multi-target patterns
   - Simplify access to target hierarchies and relationships
   - Provide type checking for target compatibility

2. **Developer Tools**
   - Add debugging support for multi-target action flow
   - Create visualization tools for target resolution
   - Implement action/rule compatibility checking

## Implementation Strategy

### Phase 1: Foundation (Week 1-2)
- Update event schema with backward-compatible multi-target support
- Modify command processor to pass multi-target data
- Test with existing single-target rules (should continue working)

### Phase 2: Rule Enhancement (Week 3-4)  
- Update 2-3 core rules to demonstrate multi-target capability
- Create example multi-target actions with corresponding rules
- Validate end-to-end multi-target action execution

### Phase 3: Documentation & Testing (Week 5-6)
- Update all documentation with multi-target examples
- Create comprehensive test suite for multi-target scenarios
- Provide migration guide for modders

### Phase 4: Ecosystem Enhancement (Week 7-8)
- Add development tools for multi-target debugging
- Create rule templates for common patterns
- Implement validation and warning systems

## Conclusion

The Living Narrative Engine has successfully implemented sophisticated multi-target action formatting but is blocked from utilizing this capability due to limitations in the event system and rules. The gap is well-defined and fixable with targeted changes to the event schema, command processor, and rule examples.

**The core issue is architectural**: the multi-target data exists and flows through the formatting system but is lost at the command processor bottleneck before reaching the rules system. Fixing this requires coordination between the event schema, command processor, and rule patterns, but can be done in a backward-compatible manner.

**Immediate Action Required**: Update the event system to pass multi-target data while maintaining backward compatibility with existing single-target rules. This will unlock the full potential of the multi-target action system and enable sophisticated game interactions that are currently impossible to implement correctly.
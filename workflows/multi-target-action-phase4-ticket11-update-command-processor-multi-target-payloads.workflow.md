# Ticket: INVALID - Reassess Multi-Target Action Processing

## Ticket ID: PHASE4-TICKET11

## Priority: Low (REASSESSMENT REQUIRED)

## Estimated Time: REASSESSMENT REQUIRED

## Dependencies: REASSESSMENT REQUIRED

## Blocks: REASSESSMENT REQUIRED

## Overview

**IMPORTANT: This ticket is based on incorrect assumptions about the current codebase architecture.**

After analysis, it has been determined that:
1. Multi-target actions are already implemented via `MultiTargetActionFormatter`
2. The current `core:attempt_action` event payload is simple and standardized
3. Rules are designed to work with the current simple payload structure
4. No changes to CommandProcessor or event payload structure are needed

## Current State Analysis (CORRECTED)

The current system uses a simple, standardized payload structure as defined in `data/mods/core/events/attempt_action.event.json`:

```javascript
{
  eventName: 'core:attempt_action',
  actorId: 'actor_001',          // Required
  actionId: 'action:id',         // Required  
  targetId: 'target_001',        // Optional - single target ID
  originalInput: 'command text'  // Required - original command
}
```

Multi-target actions are handled through:
- `MultiTargetActionFormatter` for formatting multiple target combinations
- Action pipeline stages that resolve multiple targets 
- Combination generation for multi-target scenarios

**The event payload structure should NOT be changed** - it is designed to be simple and stable.

## Recommended Actions (CORRECTED)

### Current Multi-Target Architecture (NO CHANGES NEEDED)

The system already handles multi-target actions correctly:

1. **Event Schema**: `data/mods/core/events/attempt_action.event.json` defines the stable, simple payload:
   ```json
   {
     "eventName": "core:attempt_action",
     "actorId": "string (required)",
     "actionId": "string (required)", 
     "targetId": "string (optional)",
     "originalInput": "string (required)"
   }
   ```

2. **CommandProcessor**: `src/commands/commandProcessor.js` creates payloads matching this schema via `#createAttemptActionPayload()`

3. **Multi-Target Processing**: `src/actions/formatters/MultiTargetActionFormatter.js` handles multiple targets through:
   - Target combination generation
   - Multi-placeholder template formatting
   - Per-target action formatting

4. **Rules**: All rules in `data/mods/*/rules/` access event data via:
   - `{event.payload.actorId}`
   - `{event.payload.targetId}`
   - `{event.payload.actionId}`
   - `{event.payload.originalInput}`

### Why This Ticket is Invalid

**The CommandProcessor already works correctly and should NOT be modified.**

Analysis of `src/commands/commandProcessor.js` shows:

1. **Correct Payload Creation**: The `#createAttemptActionPayload()` method creates payloads that exactly match the event schema:
   ```javascript
   return {
     eventName: ATTEMPT_ACTION_ID,           // 'core:attempt_action'
     actorId: actor.id,                      // Required
     actionId: actionDefinitionId,           // Required  
     targetId: resolvedParameters?.targetId || null,  // Optional
     originalInput: commandString || actionDefinitionId  // Required
   };
   ```

2. **No Multi-Target Payload Needed**: Multi-target actions work through the formatter system, not event payloads. Each individual action gets its own simple payload.

3. **Rules Work Correctly**: All existing rules access the simple payload structure and don't need complex multi-target data.

### Alternative: Investigate Actual Needs

Instead of this ticket, consider:

1. **Review Multi-Target Action Pipeline**: Examine how `MultiTargetActionFormatter` and action pipeline stages work together
2. **Improve Documentation**: Document the existing multi-target architecture  
3. **Add Examples**: Create example multi-target actions that demonstrate the current system
4. **Performance Analysis**: Analyze if multi-target processing has performance bottlenecks

## Conclusion

**This ticket should be CLOSED as INVALID due to incorrect assumptions.**

### Key Findings

1. **Multi-Target Actions Already Work**: The system has `MultiTargetActionFormatter` handling multi-target scenarios correctly

2. **Event Payload is Correctly Simple**: The `core:attempt_action` event payload is intentionally simple and stable, focusing on basic action identification rather than complex target data

3. **No Breaking Changes Needed**: The current architecture separates concerns appropriately:
   - **Event payload**: Simple, stable identification data
   - **Action processing**: Complex multi-target logic in formatters and pipeline stages  
   - **Rules**: Work with simple, predictable event data

4. **Rules Function Correctly**: All rules in core, intimacy, and sex mods access `{event.payload.actorId}`, `{event.payload.targetId}`, and `{event.payload.actionId}` successfully

### Recommendation

Close this ticket and focus on:
- Improving documentation of existing multi-target architecture
- Creating examples that demonstrate current multi-target capabilities
- Performance optimization of existing multi-target processing if needed

---

**TICKET STATUS: INVALID / CLOSED**

This ticket was based on fundamental misunderstandings of the current architecture. Multi-target actions already work correctly through the existing `MultiTargetActionFormatter` system, and the simple event payload structure is intentionally designed to be stable and predictable.



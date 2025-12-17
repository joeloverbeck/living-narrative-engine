# SENAWAPEREVE-008: Example Rule and Documentation

**Status**: Completed
**Priority**: LOW
**Effort**: Small

## Summary

Create one example enhanced rule demonstrating `alternate_descriptions` and document the migration guide for modders to enhance their existing rules.

## File list it expects to touch

- **Modify**: `data/mods/positioning/rules/bend_over.rule.json` (add alternate_descriptions)
- **Create**: `docs/modding/sense-aware-perception.md`

## Out of scope (must NOT change)

- Migrating other existing rules to use alternate_descriptions
- Creating multiple example rules
- Performance optimization
- Handler or service code
- Schema files
- Any other positioning mod files (except the one rule)

## Architecture Discrepancy Found

**Original Assumption**: The ticket assumed `bend_over.rule.json` already contained a `DISPATCH_PERCEPTIBLE_EVENT` operation that could simply be enhanced with `alternate_descriptions`.

**Actual Structure**: The rule uses the `core:logSuccessAndEndTurn` macro, which internally uses `DISPATCH_EVENT` with `eventType: "core:perceptible_event"` - NOT the `DISPATCH_PERCEPTIBLE_EVENT` operation that supports `alternate_descriptions`.

**Resolution**: Replace the macro with inline operations:
1. `DISPATCH_PERCEPTIBLE_EVENT` with `alternate_descriptions`
2. `DISPATCH_EVENT` for `core:display_successful_action_result` (UI feedback)
3. `DISPATCH_EVENT` for `core:action_success` (game state tracking)
4. `END_TURN` operation

This preserves all existing functionality while enabling sense-aware perception.

## Acceptance criteria

### Specific tests that must pass

- `npm run validate` passes (modified rule validates against schema)
- `npm run test:integration -- --testPathPattern="positioning"` passes
- `npm run test:integration -- --testPathPattern="bend_over"` passes (if exists)

### Invariants that must remain true

- `bend_over.rule.json` continues to work in lit conditions
- Existing tests for positioning mod pass
- Documentation is complete and accurate
- Documentation follows existing docs style

## Implementation details

### Enhanced rule (`bend_over.rule.json`)

Replace the macro-based ending with inline operations supporting `alternate_descriptions`:

**Before** (using macro):
```json
{
  "type": "SET_VARIABLE",
  "parameters": { "variable_name": "logMessage", "value": "{context.actorName} bends over {context.surfaceName}." }
},
{
  "type": "SET_VARIABLE",
  "parameters": { "variable_name": "perceptionType", "value": "physical.self_action" }
},
{
  "type": "SET_VARIABLE",
  "parameters": { "variable_name": "locationId", "value": "{context.actorPosition.locationId}" }
},
{
  "type": "SET_VARIABLE",
  "parameters": { "variable_name": "targetId", "value": "{event.payload.targetId}" }
},
{ "macro": "core:logSuccessAndEndTurn" }
```

**After** (inline operations with alternate_descriptions):
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Dispatch sense-aware perceptible event for bending over.",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} bends over {context.surfaceName}.",
    "perception_type": "physical.self_action",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "You hear the rustle of clothing and shifting of weight as someone changes position nearby."
    }
  }
},
{
  "type": "DISPATCH_EVENT",
  "comment": "Dispatch display event for UI.",
  "parameters": {
    "eventType": "core:display_successful_action_result",
    "payload": { "message": "{context.actorName} bends over {context.surfaceName}." }
  }
},
{
  "type": "DISPATCH_EVENT",
  "comment": "Dispatch action success event for game state tracking.",
  "parameters": {
    "eventType": "core:action_success",
    "payload": {
      "eventName": "core:action_success",
      "actionId": "{event.payload.actionId}",
      "actorId": "{event.payload.actorId}",
      "targetId": "{event.payload.targetId}",
      "success": true
    }
  }
},
{
  "type": "END_TURN",
  "parameters": { "entityId": "{event.payload.actorId}", "success": true }
}
```

**Note on alternate_descriptions**:
- Only `auditory` is included - tactile and limited were deemed unrealistic for detecting a bend over action
- Air movement from someone bending is too subtle for tactile perception
- Posture changes are too subtle for limited sensory detection

### Documentation (`docs/modding/sense-aware-perception.md`)

```markdown
# Sense-Aware Perception System

## Overview

The sense-aware perception system allows events to be filtered and adapted based on:
- **Recipient sensory capabilities** (eyes, ears, nose status from anatomy)
- **Environmental conditions** (lighting)
- **Perception type** (visual, auditory, etc.)

This creates more immersive gameplay where characters in darkness or with damaged senses receive appropriate descriptions rather than impossible perceptions.

## Sense Categories

| Category | Requirements | Example Events |
|----------|--------------|----------------|
| `visual` | Light + functioning eyes | Movement, gestures, physical actions |
| `auditory` | Functioning ears | Speech, sounds, music |
| `olfactory` | Functioning nose | Smells, scents |
| `tactile` | Physical contact | Touch, direct interaction |
| `proprioceptive` | Self only | Own actions, internal states |
| `omniscient` | Always delivered | System messages, errors |

## Adding Alternate Descriptions

To make your rules sense-aware, add `alternate_descriptions` to your `DISPATCH_PERCEPTIBLE_EVENT` operations:

### Basic Example

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "Bob does a handstand, balancing upside-down.",
    "perception_type": "physical.self_action",
    "actor_id": "{context.actorId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "You hear sounds of exertion and shuffling nearby.",
      "tactile": "You feel vibrations through the floor from movement.",
      "limited": "You sense activity nearby."
    }
  }
}
```

### Available Fallback Keys

- `auditory` - Used when recipient can hear but not see
- `tactile` - Used when recipient can feel but not see/hear
- `olfactory` - Used for smell-based fallback (rare)
- `limited` - Final fallback when specific senses unavailable

### Filtering Behavior

1. **Primary sense check**: Based on `perception_type`, the system checks if the primary sense is available
2. **Fallback cascade**: If primary unavailable, tries each fallback in array order
3. **Limited fallback**: If no specific fallback works, uses `limited` text
4. **Silent filter**: If no text available, recipient simply doesn't receive the event

## Disabling Sense Filtering

For special cases (debugging, supernatural events, etc.), set `sense_aware: false`:

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "description_text": "The ground shakes violently.",
    "sense_aware": false
  }
}
```

## Perception Type Mappings

Each perception type has a primary sense and fallback senses:

| Type | Primary | Fallbacks |
|------|---------|-----------|
| `communication.speech` | auditory | tactile |
| `physical.self_action` | visual | auditory, tactile |
| `item.drop` | auditory | visual |
| `intimacy.sensual` | tactile | visual, auditory |
| `error.system_error` | omniscient | (none - always delivered) |

For the complete mapping, see the perception type registry.

## Manual Sensory Override

For entities without anatomy (spirits, constructs), add the `perception:sensory_capability` component:

```json
{
  "perception:sensory_capability": {
    "canSee": true,
    "canHear": true,
    "canSmell": false,
    "canFeel": true,
    "overrideMode": "manual"
  }
}
```

## Migration Guide

Existing rules continue to work unchanged. To enhance them:

1. Identify rules with `DISPATCH_PERCEPTIBLE_EVENT`
2. Consider what the event would sound/feel like
3. Add appropriate `alternate_descriptions`
4. Test in dark/blind conditions

No changes are required for backward compatibility - rules without `alternate_descriptions` use existing behavior.
```

## Dependencies

- SENAWAPEREVE-007 (handlers integrated - feature functional)

## Dependent tickets

- None (final ticket in series)

## Outcome

**Completed**: 2025-12-17

### Changes Made

1. **Modified**: `data/mods/positioning/rules/bend_over.rule.json`
   - Replaced macro-based ending with inline operations
   - Added `DISPATCH_PERCEPTIBLE_EVENT` with `alternate_descriptions.auditory`
   - Preserved `core:action_success` event for game state tracking
   - Preserved `core:display_successful_action_result` for UI feedback

2. **Created**: `docs/modding/sense-aware-perception.md`
   - Comprehensive documentation of the sense-aware perception system
   - Migration guide for modders
   - Real-world example from bend_over.rule.json
   - Notes on macro replacement when needed

### Test Results

- `npm run validate`: PASSED (0 violations across 65 mods)
- `bend_over_action.test.js`: 12/12 tests passed
- `bendingOverSystem.integration.test.js`: 16/16 tests passed

### Notes

- Only `auditory` fallback included (per user guidance) - tactile and limited deemed unrealistic
- Architecture discrepancy documented: rule used macro not direct DISPATCH_PERCEPTIBLE_EVENT
- Solution maintains full backward compatibility while enabling sense-aware features

# Rub Penis Over Clothes - Multiple Targets Implementation Spec

## Spec Corrections Summary

**IMPORTANT**: This spec has been corrected based on analysis of the current production code. Key corrections made:

1. **Clothing mod dependency**: The sex mod does NOT currently depend on the clothing mod, but the clothing mod IS loaded in game.json and provides the required scope
2. **Scope already exists**: `clothing:target_topmost_torso_lower_clothing_no_accessories` already exists - no need to create a new scope in sex mod
3. **Current action structure**: The action already uses `targets.primary` structure, not a single target pattern
4. **Placeholder correction**: Current action uses `"target"` placeholder instead of expected `"primary"`
5. **Rule references**: Updated to reflect actual payload structure patterns from fondle_ass implementation

## Overview

This specification outlines the enhancement of the `rub_penis_over_clothes` action to use multiple targets (primary and secondary) pattern, similar to the recently updated `fondle_ass` action. The goal is to replace the generic "clothes" reference with a specific reference to the topmost clothing item of the lower torso clothing slot.

## Current Implementation

### Current Action (`data/mods/sex/actions/rub_penis_over_clothes.action.json`)
- Uses single target pattern under `targets.primary` with scope `sex:actors_with_penis_facing_each_other_covered`
- Placeholder: `"target"` (not `"primary"` as expected for primary target)
- Template: `"rub {target}'s penis over the clothes"`
- Generic "clothes" reference

### Current Rule (`data/mods/sex/rules/handle_rub_penis_over_clothes.rule.json`)
- Processes single target (`target`)
- Log message: `"{context.actorName} rubs {context.targetName}'s penis over the clothes."`
- Uses `targetId` from `event.payload.targetId`

## Proposed Implementation

### Reference Implementation (fondle_ass pattern)

The `fondle_ass` action was successfully updated to use:
- **Primary target**: Person whose body part to interact with (`intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target`)
- **Secondary target**: Specific clothing item (`clothing:target_topmost_torso_lower_clothing_no_accessories`)
- **Context relationship**: Secondary target uses `"contextFrom": "primary"`

### Required Changes

#### 1. Add Clothing Mod Dependency
**File**: `data/mods/sex/mod-manifest.json`

**Changes**:
- Add "clothing" to the dependencies array to enable use of clothing scopes

**New dependency entry**:
```json
{
  "id": "clothing",
  "version": "^1.0.0"
}
```

**Rationale**: 
- The clothing mod already provides the required scope `clothing:target_topmost_torso_lower_clothing_no_accessories`
- No need to duplicate existing functionality in the sex mod
- Leverages existing, tested clothing system scopes
- Maintains proper mod dependency relationships

#### 2. Action Update
**File**: `data/mods/sex/actions/rub_penis_over_clothes.action.json`

**Changes**:
- Update `primary` target placeholder from `"target"` to `"primary"`
- Add `secondary` target (clothing item) with `contextFrom: "primary"`
- Update template to use `{primary}` and `{secondary}` placeholders

**Updated structure**:
```json
{
  "targets": {
    "primary": {
      "scope": "sex:actors_with_penis_facing_each_other_covered",
      "placeholder": "primary",
      "description": "Person with clothed penis to rub"
    },
    "secondary": {
      "scope": "clothing:target_topmost_torso_lower_clothing_no_accessories",
      "placeholder": "secondary", 
      "description": "Clothing item over which to rub",
      "contextFrom": "primary"
    }
  },
  "template": "rub {primary}'s penis over the {secondary}"
}
```

#### 3. Rule Update
**File**: `data/mods/sex/rules/handle_rub_penis_over_clothes.rule.json`

**Changes**:
- Update variable extraction to use `primary` and `secondary` instead of `target`
- Add clothing name extraction from secondary target
- Update log message to include specific clothing item
- Update `targetId` reference from `event.payload.targetId` to `event.payload.primaryId`

**Key modifications**:
- Replace `GET_NAME` for `target` with `GET_NAME` for `primary` (storing as `primaryName`)
- Add `GET_NAME` for `secondary` (storing as `clothingName`)
- Update log message: `"{context.actorName} rubs {context.primaryName}'s penis over the {context.clothingName}."`
- Change `targetId` value from `{event.payload.targetId}` to `{event.payload.primaryId}`

## Technical Considerations

### Dependency Management
- **Mod dependency**: Add clothing mod dependency to sex mod manifest
- **Scope reuse**: Leverage existing `clothing:target_topmost_torso_lower_clothing_no_accessories` scope
- **Pattern consistency**: Follow established fondle_ass action pattern
- **Context mechanism**: Use `contextFrom` to establish primary→secondary relationship

### Backward Compatibility
- This is a breaking change for any existing saves or references
- Action ID remains the same (`sex:rub_penis_over_clothes`)
- Template structure changes from single to dual placeholders

### Target Resolution Flow
1. Primary scope resolves to actor with covered penis
2. Secondary scope receives primary actor as context via `contextFrom`
3. Secondary scope queries primary actor's topmost lower torso clothing
4. Both targets passed to rule for processing

## Implementation Dependencies

### Required Files
1. **Modified**: `data/mods/sex/mod-manifest.json` (add clothing dependency)
2. **Modified**: `data/mods/sex/actions/rub_penis_over_clothes.action.json`
3. **Modified**: `data/mods/sex/rules/handle_rub_penis_over_clothes.rule.json`

### External Dependencies
- **Clothing mod**: Must be loaded and available (already satisfied in current game.json)
- **Existing scope**: `clothing:target_topmost_torso_lower_clothing_no_accessories` (already exists)
- Target resolution system must handle `contextFrom` mechanism (already supported)
- Action processing system must support multiple target payloads (already supported)

## Validation Requirements

### Testing Areas
1. **Target Resolution**: Verify both primary and secondary targets resolve correctly
2. **Context Flow**: Confirm secondary target receives primary as context
3. **Template Rendering**: Ensure action template displays specific clothing names
4. **Rule Processing**: Validate rule correctly processes dual targets
5. **Edge Cases**: Test scenarios with no/multiple clothing items

### Success Criteria
- Action displays specific clothing item names instead of generic "clothes"
- Rule generates descriptive text with clothing details
- No regression in existing functionality
- Consistent pattern with other dual-target intimate actions

## Migration Notes

### Development Workflow
1. Add clothing dependency to sex mod manifest
2. Update action definition (fix placeholder and add secondary target)
3. Update corresponding rule (change to primary/secondary pattern)
4. Test target resolution and template rendering
5. Validate rule processing and logging

### Risk Mitigation
- Test with various clothing combinations
- Verify fallback behavior for edge cases
- Ensure consistent naming conventions
- Validate cross-reference integrity

## Future Considerations

This pattern could be extended to other similar actions that currently use generic clothing references, promoting more specific and immersive action descriptions throughout the intimate action system.
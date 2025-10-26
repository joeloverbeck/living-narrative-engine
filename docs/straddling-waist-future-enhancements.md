# Straddling Waist System - Future Enhancements

## Overview

This document outlines potential enhancements to the straddling waist system that are NOT currently implemented. These are edge cases and features that would improve the system but are not critical for initial release.

## Auto-Dismount Scenarios

### 1. Target Stands Up

**Scenario:** Actor A is straddling Actor B. Actor B stands up.

**Current Behavior:** Not handled - would result in invalid state

**Desired Behavior:** Actor A should be automatically dismounted

**Implementation Requirements:**
- Modify `positioning:get_up_from_furniture` rule
- Add check for actors with `straddling_waist` component targeting the standing actor
- Dispatch dismount events for all straddling actors
- Handle cascading cleanup (facing_away component, movement lock)

**Complexity:** Medium

**Priority:** Medium

### 2. Closeness Broken

**Scenario:** Actor A is straddling Actor B. Closeness between them is broken (e.g., `step_back`).

**Current Behavior:** Not handled - would result in invalid state

**Desired Behavior:** Actor A should be automatically dismounted

**Implementation Requirements:**
- Create reactive rule listening to closeness component removal
- Check if removed partner has `straddling_waist` component
- Dispatch automatic dismount event
- Handle cleanup for both actors

**Complexity:** Medium

**Priority:** Medium

### 3. Location Change

**Scenario:** Actor A is straddling Actor B. Actor B attempts to change location.

**Current Behavior:** Movement lock should prevent this, but no specific validation

**Desired Behavior:**
- Option 1: Prevent location change entirely
- Option 2: Auto-dismount and allow location change

**Implementation Requirements:**
- Add event handler for location change events
- Check if actor has `straddling_waist` component
- Either block or auto-dismount based on design decision

**Complexity:** Low

**Priority:** Low

## Additional Actions

### 1. Turn Around While Straddling

**Scenario:** Actor A is straddling Actor B while facing them. Actor A wants to face away without dismounting.

**Current Behavior:** Existing `physical-control:turn_around` action manipulates the `facing_away` component for close actors

**Status:** **Needs Verification** - The generic `physical-control:turn_around` action exists and handles the `facing_away` component. Needs testing to confirm it works correctly when actor has `straddling_waist` component.

**Verification Requirements:**
- Test if `physical-control:turn_around` action is available when actor is straddling
- Verify the action correctly toggles the `facing_away` component
- Confirm the `straddling_waist.facing_away` field is updated correctly
- Ensure no conflicts with straddling-specific state

**Note:** The `straddling_waist` component already has a `facing_away` boolean field (implemented). If the existing `turn_around` action doesn't work with straddling, a specialized action may be needed.

**Complexity:** Low (if new action needed)

**Priority:** Medium (verification), Low (new implementation if needed)

### 2. Shift Position on Lap

**Scenario:** Actor A is straddling Actor B. Actor A wants to adjust position slightly.

**Current Behavior:** Not available

**Desired Behavior:** Cosmetic action for narrative variety

**Implementation Requirements:**
- New action: `positioning:shift_position_on_lap`
- No component changes
- Only generates log message and perceptible event
- Pure narrative/flavor action

**Complexity:** Very Low

**Priority:** Very Low

### 3. Multiple Actor Straddling

**Scenario:** Two or more actors straddle the same target simultaneously.

**Current Behavior:** Not supported (single straddler per target)

**Desired Behavior:** Allow multiple actors to straddle same sitting target

**Implementation Requirements:**
- Modify component schema to track multiple straddlers
- Update scope queries
- Handle cleanup when any straddler dismounts
- Consider physical constraints and validation

**Complexity:** High

**Priority:** Low

## Integration with Other Systems

### 1. Anatomy System Integration

**Purpose:** Check leg availability for straddling

**Requirements:**
- Add prerequisite checking leg functionality
- Validate actor can physically straddle
- Handle edge cases (injured legs, prosthetics, etc.)

**Complexity:** Medium

**Priority:** Low

### 2. Clothing System Integration

**Purpose:** Restrict straddling based on clothing

**Requirements:**
- Check clothing restrictions (e.g., tight skirts)
- Add prerequisite for compatible clothing
- Handle edge cases and special clothing types

**Complexity:** Medium

**Priority:** Low

### 3. Weight/Size System Integration

**Purpose:** Validate physical compatibility

**Requirements:**
- Check relative sizes of actor and target
- Add prerequisite for size compatibility
- Handle edge cases and special scenarios

**Complexity:** High

**Priority:** Low

## Performance Optimizations

### 1. Scope Query Caching

**Purpose:** Cache scope query results for frequently-accessed data

**Benefits:** Reduced computation for repeated queries

**Complexity:** Medium

**Priority:** Low

### 2. Component Index

**Purpose:** Index actors by component type for faster lookups

**Benefits:** Faster `actor_im_straddling` scope evaluation

**Complexity:** High

**Priority:** Very Low

## Testing Gaps

### 1. Concurrent Action Handling

**Scenario:** Two actors attempt to straddle same target simultaneously

**Current Coverage:** Not tested

**Desired Coverage:** Validate race condition handling

**Priority:** Medium

### 2. Component Desync Scenarios

**Scenario:** Manual component manipulation creates invalid state

**Current Coverage:** Not tested

**Desired Coverage:** Validate error handling and recovery

**Priority:** Low

### 3. Cross-Mod Interaction

**Scenario:** Other mods interact with straddling system

**Current Coverage:** Not tested

**Desired Coverage:** Validate compatibility with other positioning mods

**Priority:** Medium

## Conclusion

These enhancements are documented for future consideration. The current implementation provides a solid foundation, but these features would improve robustness and user experience.

**Recommendations:**
1. **High Priority**: Verify existing `physical-control:turn_around` action compatibility with straddling state
2. **Medium Priority**: Prioritize auto-dismount scenarios for next iteration, as they address the most critical edge cases
3. **Note**: Before implementing new "turn around while straddling" action, confirm the existing `turn_around` action doesn't already handle this case

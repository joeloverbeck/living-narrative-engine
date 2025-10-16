# POSSITDOW-003: Create `handle_sit_down_at_distance` Rule

**Phase:** 2 - Systems Integration
**Priority:** High
**Estimated Effort:** 6 hours

## Goal

Implement a new rule under `data/mods/positioning/rules` that processes the `positioning:sit_down_at_distance` action, reserves the correct seat, and preserves existing adjacency behaviors.

## Context

The specification calls for a rule that mirrors `handle_sit_down.rule.json` while enforcing a two-seat buffer. The rule must claim the appropriate spot atomically, attach the `positioning:sitting_on` component to the acting entity, and conclude via the standard success macro.

## Tasks

### 1. Set Up Rule Skeleton
- Create `data/mods/positioning/rules/handle_sit_down_at_distance.rule.json` (or analogous filename).
- Configure the trigger to listen for `core:attempt_action` events filtered to the new action ID.
- Import or duplicate any helper conditions (e.g., `positioning:event-is-action-sit-down`) when necessary; if reusing is impossible, add a companion condition file as part of this ticket.

### 2. Resolve Seat Indexing
- Fetch the targeted furniture's `positioning:allows_sitting` component and store `spots` for reuse.
- Resolve the secondary occupant's `spot_index` via their `positioning:sitting_on` component or by scanning the `spots` array for their entity ID.
- Calculate `targetIndex = secondaryIndex + 2` and confirm indices `secondaryIndex + 1` and `targetIndex` are both null.

### 3. Claim Seat Atomically
- Use `ATOMIC_MODIFY_COMPONENT` to write the acting entity ID into `spots[targetIndex]`.
- Abort and log a graceful failure if the atomic operation reports a conflict, leaving the actor unseated and avoiding misleading success messages.

### 4. Apply Actor State Updates
- Add `positioning:sitting_on` to the actor with `furniture_id`, `spot_index`, and any additional metadata required to match the base sit-down rule.
- Issue `LOCK_MOVEMENT` and `ESTABLISH_SITTING_CLOSENESS` operations exactly as in the existing rule to maintain parity (closeness will naturally skip due to the gap).

### 5. Emit Success Telemetry
- Craft a success log referencing the furniture (`primary`) and the occupant (`secondary`), highlighting the deliberate empty seat.
- End the rule with `core:logSuccessAndEndTurn` to remain consistent with other positioning actions.

### 6. Validation and Regression Checks
- Run rule/schema linting as applicable.
- Manually verify that the legacy `handle_sit_down` rule remains unchanged and still registers for its original action ID.

## Acceptance Criteria
- New rule file exists and correctly handles seat reservation with a two-seat buffer.
- Atomic seat claim prevents race-condition errors and surfaces appropriate failure logging.
- Actor ends the rule with correct components and the turn is finalized via the standard macro.

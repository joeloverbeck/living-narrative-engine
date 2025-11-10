# WEASYSIMP-013: Create Chamber Round Action and Rule

**Phase:** Weapons Mod Core
**Timeline:** 0.5 days
**Status:** Not Started
**Dependencies:** WEASYSIMP-009
**Priority:** P1

## Overview

Create `weapons:chamber_round` action and rule for manually chambering rounds in bolt-action/pump weapons.

## Files to Create

1. Action: `chamber_round.action.json` (spec lines 667-695)
2. Condition: `event-is-action-chamber-round.condition.json`
3. Rule: `handle_chamber_round.rule.json` (spec lines 1811-1865)

Rule operations: MODIFY_COMPONENT (set chambered=true), GET_TIMESTAMP, DISPATCH_EVENT, END_TURN

## Acceptance Criteria

- [ ] 3 files created
- [ ] Action requires unchambered weapons scope
- [ ] Rule sets chambered flag
- [ ] Dispatches round_chambered event
- [ ] Validates

## Related Tickets

- **Depends On:** WEASYSIMP-009, WEASYSIMP-016

# WEASYSIMP-010: Create Weapons Mod State Component

**Phase:** Weapons Mod Core
**Timeline:** 0.5 days
**Status:** Not Started
**Dependencies:** WEASYSIMP-008
**Priority:** P0

## Overview

Create `weapons:jammed` state component for tracking weapon jam conditions.

## Component to Create

**File:** `data/mods/weapons/components/jammed.component.json`

Spec reference: Lines 498-527

Properties:
- `jamType`: enum ["stovepipe", "double_feed", "failure_to_extract", "squib_load"]
- `timestamp`: number

Both required. This is a transient state component, present only while weapon is jammed.

## Acceptance Criteria

- [ ] `jammed.component.json` created
- [ ] Valid JSON and schema
- [ ] Enum values match spec
- [ ] Required fields specified
- [ ] `npm run validate` passes

## Related Tickets

- **Depends On:** WEASYSIMP-008
- **Blocks:** WEASYSIMP-014 (Clear Jam action)

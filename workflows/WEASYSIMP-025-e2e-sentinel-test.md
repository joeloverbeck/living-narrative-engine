# WEASYSIMP-025: Create E2E Sentinel Scenario Test

**Phase:** Testing & Validation
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-018, WEASYSIMP-019
**Priority:** P1

## Overview

Create end-to-end test for the complete sentinel patrol scenario: patrol, detect hostile, aim, shoot, reload, continue.

## Test to Create

### E2E Test (`tests/e2e/weapons/`)

**File:** `sentinelPatrol.e2e.test.js`

Test scenario (from spec lines 1986-1996):
1. Create two sentinels (Alpha with pistol, Beta with rifle)
2. Create hostile entities
3. Place all at same location
4. Sentinel Alpha aims pistol at hostile
5. Sentinel Alpha shoots until ammo depleted (15 rounds)
6. Sentinel Alpha reloads
7. Sentinel Alpha continues shooting
8. Sentinel Beta engages with rifle
9. Handle jam scenario (if implemented)
10. Verify all events dispatched
11. Verify all component states correct

## Acceptance Criteria

- [ ] E2E test file created
- [ ] Complete scenario workflow tested
- [ ] Both sentinels tested (pistol and rifle)
- [ ] Hostile entities created
- [ ] Multiple engagement cycles tested
- [ ] Reload tested under combat conditions
- [ ] Event sequence verified
- [ ] Component states verified throughout
- [ ] Test passes

## Related Tickets

- **Depends On:** WEASYSIMP-018, WEASYSIMP-019
- **Validates:** Complete weapons system integration

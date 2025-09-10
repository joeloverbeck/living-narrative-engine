# Turn Around Kneel Interaction Test Extraction Summary

## Problem

The test file `tests/integration/mods/positioning/turnAroundKneelInteraction.integration.test.js` had 3 tests:

1. "should not allow kneeling before an actor when facing away" - FIXED ✅
2. "should allow kneeling after turning back to face" - FIXED ✅
3. "should correctly handle multiple actors with mixed facing states" - FAILS when run with others, PASSES when run alone

## Root Cause Analysis

- Tests 1 & 2 failed due to missing `core:actor-mouth-available` condition in test setup - FIXED
- Test 3 has scope resolution issues when run with other tests:
  - When run alone: scope `positioning:actors_in_location_facing` correctly resolves to `['test:actor3']`
  - When run with others: scope resolves to empty array `[]`
  - Issue appears to be related to dynamic entity creation (actor3) and scope engine caching

## Solution Attempted

Per user suggestion: "Why not just extract that third test, that apparently runs in isolation, into its own test suite?"

Created new file: `tests/integration/mods/positioning/turnAroundKneelInteractionMultiActor.integration.test.js`

- Extracted the third test into its own test suite
- Updated original file to only have the first two tests (which now pass)
- New isolated test file still fails with same scope resolution issue

## Current Status

- Original test file with 2 tests: ✅ PASSES
- New isolated test file with 1 test: ❌ FAILS (same scope resolution issue)

## Technical Details

The issue is that the scope `positioning:actors_in_location_facing` doesn't find actor3 even though:

- actor3 is created with correct components
- actor3 has `positioning:closeness` with partners
- actor3 is at the same location
- ActionIndex is rebuilt after adding actor3

The test isolation issue suggests there may be some shared state or caching in the scope engine that isn't properly reset between tests.

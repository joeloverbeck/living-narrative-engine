# ActionButtonsRenderer Dispose Test Fix

## Issue

The test `tests/unit/domUI/actionButtonsRenderer.dispose.test.js` was failing because it made an incorrect assumption about the number of DOM event listeners registered by the production code.

## Root Cause

The test expected only 2 DOM event listeners to be removed during disposal (1 click + 1 keydown), but the production code actually registers 6 listeners:

1. 1 click listener on the send button
2. 1 keydown listener on the container (inherited from SelectableListDisplayComponent)
3. 4 hover event delegation listeners on the container:
   - mouseenter
   - mouseleave
   - focusin
   - focusout

The hover functionality was added to support visual customization features (ACTBUTVIS-008) but the test was not updated accordingly.

## Fix Applied

Updated line 349 in `tests/unit/domUI/actionButtonsRenderer.dispose.test.js`:

- Changed expectation from "Removing 2 DOM event listeners" to "Removing 6 DOM event listeners"
- Updated comment to accurately describe all 6 listeners

## Result

All tests in the dispose test suite now pass successfully.

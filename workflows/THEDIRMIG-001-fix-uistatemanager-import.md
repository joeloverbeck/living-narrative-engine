# THEDIRMIG-001: Fix UIStateManager Import Issue

## Overview

Replace the locally defined UI_STATES constant in ThematicDirectionsManagerController with an import from the shared UIStateManager module. This is a critical first step that aligns the controller with base controller requirements and prevents conflicts.

## Priority

**CRITICAL** - Blocks all subsequent migration steps

## Dependencies

- **Blocks**: None (first ticket in migration)
- **Enables**: THEDIRMIG-002 (class declaration update)

## Acceptance Criteria

- [ ] Local UI_STATES constant is removed from the controller
- [ ] UI_STATES is imported from the correct shared module
- [ ] All references to UI_STATES continue to work correctly
- [ ] No TypeScript/ESLint errors introduced
- [ ] Existing tests continue to pass without modification

## Implementation Steps

### Step 1: Analyze Current UI_STATES Usage

**File**: `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

```javascript
// CURRENT CODE TO REMOVE (lines ~10-15):
const UI_STATES = {
  EMPTY: 'empty',
  LOADING: 'loading',
  RESULTS: 'results',
  ERROR: 'error',
};
```

**Verification**: Search for all usages of UI_STATES in the file:
```bash
grep -n "UI_STATES" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
```

### Step 2: Add UIStateManager Import

**Add to imports section** (top of file):
```javascript
import { UI_STATES } from '../../shared/characterBuilder/uiStateManager.js';
```

**Important**: Verify the correct import path by checking if the file exists:
```bash
ls -la src/shared/characterBuilder/uiStateManager.js
```

If the path is different, adjust accordingly. Common alternatives:
- `../../shared/uiStateManager.js`
- `../../characterBuilder/shared/uiStateManager.js`

### Step 3: Remove Local UI_STATES Constant

Delete the entire local UI_STATES constant definition block.

### Step 4: Verify All UI_STATES References

Ensure all existing references continue to work:
- `UI_STATES.EMPTY`
- `UI_STATES.LOADING`
- `UI_STATES.RESULTS`
- `UI_STATES.ERROR`

Common usage patterns to check:
```javascript
// In state management methods
this.#uiStateManager.setState(UI_STATES.LOADING);
this.#uiStateManager.setState(UI_STATES.RESULTS);
this.#uiStateManager.setState(UI_STATES.ERROR);
this.#uiStateManager.setState(UI_STATES.EMPTY);

// In conditional checks
if (currentState === UI_STATES.LOADING) { ... }
```

### Step 5: Run Linting and Type Checking

```bash
npm run lint -- src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
npm run typecheck
```

Fix any import-related issues that arise.

### Step 6: Test the Changes

Run the controller's test suite to ensure nothing breaks:
```bash
npm test -- tests/unit/domUI/thematicDirectionsManagerController.test.js
npm test -- tests/integration/domUI/thematicDirectionsManagerController.integration.test.js
```

### Step 7: Verify Runtime Behavior

If possible, manually test the thematic directions manager page:
1. Open `thematic-directions-manager.html` in browser
2. Verify all UI states work:
   - Empty state (no directions)
   - Loading state (during data fetch)
   - Results state (showing directions)
   - Error state (network failure)

## Potential Issues and Solutions

### Issue 1: Import Path Incorrect
**Symptom**: Module not found error
**Solution**: 
1. Use find to locate uiStateManager.js:
   ```bash
   find src -name "uiStateManager.js" -type f
   ```
2. Adjust import path based on actual location

### Issue 2: UI_STATES Structure Mismatch
**Symptom**: Property access errors (e.g., "Cannot read property 'EMPTY' of undefined")
**Solution**:
1. Compare the shared UI_STATES structure with the local one
2. If different, may need to update property references
3. Check if shared version uses different property names

### Issue 3: Circular Dependency
**Symptom**: Module loading errors
**Solution**:
1. Check if uiStateManager imports anything from thematicDirectionsManagerController
2. If so, refactor to break the circular dependency

## Code Example - Final Result

```javascript
// Top of file imports
import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
import { UI_STATES } from '../../shared/characterBuilder/uiStateManager.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
// ... other imports

// REMOVED: const UI_STATES = { ... }

export class ThematicDirectionsManagerController {
  // ... rest of the controller implementation
  // All UI_STATES references now use the imported constant
}
```

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

## Files Created

- None

## Definition of Done

- [ ] Local UI_STATES constant removed
- [ ] UI_STATES imported from shared module
- [ ] All existing UI_STATES references working
- [ ] No linting errors
- [ ] No TypeScript errors
- [ ] All existing tests pass
- [ ] Manual testing confirms UI states work correctly
- [ ] Code committed with descriptive message
# THEDIRMIG-002: Update Class Declaration to Extend BaseCharacterBuilderController

## Overview

Update the ThematicDirectionsManagerController class declaration to extend BaseCharacterBuilderController instead of being a standalone class. This fundamental change enables the controller to inherit all base functionality including lifecycle management, resource cleanup, and standardized patterns.

## Priority

**CRITICAL** - Core structural change required for migration

## Dependencies

- **Blocked by**: THEDIRMIG-001 (UIStateManager import fix)
- **Blocks**: THEDIRMIG-003 (constructor simplification)
- **Enables**: All subsequent migration tickets

## Acceptance Criteria

- [ ] Class extends BaseCharacterBuilderController
- [ ] All necessary imports are added
- [ ] Class compiles without errors
- [ ] Existing public API remains unchanged
- [ ] No breaking changes to external consumers

## Implementation Steps

### Step 1: Add BaseCharacterBuilderController Import

**File**: `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

Add to the imports section:
```javascript
import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
```

### Step 2: Update Class Declaration

**Current Code**:
```javascript
export class ThematicDirectionsManagerController {
  // Private fields
  #logger;
  #characterBuilderService;
  #uiStateManager;
  #eventBus;
  #schemaValidator;
  // ... other private fields
```

**Updated Code**:
```javascript
export class ThematicDirectionsManagerController extends BaseCharacterBuilderController {
  // Page-specific private fields only
  #currentFilter = '';
  #currentConcept = null;
  #directionsData = [];
  #conceptsData = [];
  #inPlaceEditors = new Map();
  #conceptDropdown = null;
  #pendingModalAction = null;
  #orphanedCount = 0;
  // ... other page-specific fields
```

### Step 3: Remove Base Class Private Fields

Remove private fields that are now inherited from BaseCharacterBuilderController:
- `#logger` → Use `this.logger` (inherited)
- `#characterBuilderService` → Use `this.characterBuilderService` (inherited)
- `#uiStateManager` → Use `this.uiStateManager` (inherited)
- `#eventBus` → Use `this.eventBus` (inherited)
- `#schemaValidator` → Use `this.schemaValidator` (inherited)

### Step 4: Update Field References Throughout the Class

Search and replace all private field references with inherited properties:

```bash
# Find all private field usages
grep -n "this\.#logger" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
grep -n "this\.#characterBuilderService" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
grep -n "this\.#uiStateManager" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
grep -n "this\.#eventBus" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
grep -n "this\.#schemaValidator" src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
```

Replace patterns:
- `this.#logger` → `this.logger`
- `this.#characterBuilderService` → `this.characterBuilderService`
- `this.#uiStateManager` → `this.uiStateManager`
- `this.#eventBus` → `this.eventBus`
- `this.#schemaValidator` → `this.schemaValidator`

### Step 5: Add Placeholder Methods for Abstract Requirements

The base class requires two abstract methods. Add placeholder implementations:

```javascript
/**
 * Cache DOM elements needed by the controller
 * @protected
 * @override
 */
_cacheElements() {
  // TODO: Implement in THEDIRMIG-004
  throw new Error('_cacheElements() must be implemented');
}

/**
 * Set up event listeners using base class helpers
 * @protected
 * @override
 */
_setupEventListeners() {
  // TODO: Implement in THEDIRMIG-005
  throw new Error('_setupEventListeners() must be implemented');
}
```

### Step 6: Verify Compilation

Run linting and type checking:
```bash
npm run lint -- src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js
npm run typecheck
```

### Step 7: Update Constructor Call

Temporarily update the constructor to call super():
```javascript
constructor(dependencies) {
  super(dependencies); // Add this line
  
  // Keep existing constructor body for now
  // It will be simplified in THEDIRMIG-003
  validateDependency(dependencies.logger, 'ILogger', dependencies.logger, {
    requiredMethods: ['debug', 'info', 'warn', 'error'],
  });
  // ... rest of existing validation
}
```

## Code Structure After Changes

```javascript
import { BaseCharacterBuilderController } from '../../characterBuilder/controllers/BaseCharacterBuilderController.js';
import { UI_STATES } from '../../shared/characterBuilder/uiStateManager.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { InPlaceEditor } from '../../shared/components/InPlaceEditor.js';
import { PreviousItemsDropdown } from '../../shared/components/PreviousItemsDropdown.js';
// ... other imports

/**
 * @class ThematicDirectionsManagerController
 * @extends BaseCharacterBuilderController
 * @description Manages the thematic directions interface with base controller functionality
 */
export class ThematicDirectionsManagerController extends BaseCharacterBuilderController {
  // Page-specific private fields
  #currentFilter = '';
  #currentConcept = null;
  #directionsData = [];
  #conceptsData = [];
  #inPlaceEditors = new Map();
  #conceptDropdown = null;
  #pendingModalAction = null;
  #orphanedCount = 0;

  constructor(dependencies) {
    super(dependencies);
    // Existing constructor body (to be cleaned up in THEDIRMIG-003)
  }

  // Abstract method placeholders
  _cacheElements() {
    throw new Error('_cacheElements() must be implemented');
  }

  _setupEventListeners() {
    throw new Error('_setupEventListeners() must be implemented');
  }

  // Rest of existing methods with updated field references
  // this.#logger → this.logger
  // this.#characterBuilderService → this.characterBuilderService
  // etc.
}
```

## Potential Issues and Solutions

### Issue 1: Method Name Conflicts
**Symptom**: Methods with same names in base and derived class
**Solution**: 
1. Identify conflicting method names
2. Rename page-specific methods with underscore prefix
3. Or override base methods if behavior should replace

### Issue 2: Property Access Errors
**Symptom**: "Cannot read property of undefined" errors
**Solution**:
1. Ensure super() is called before accessing inherited properties
2. Check that property names match exactly (logger vs #logger)

### Issue 3: Import Path Issues
**Symptom**: Module not found for BaseCharacterBuilderController
**Solution**:
1. Verify path: `ls -la src/characterBuilder/controllers/BaseCharacterBuilderController.js`
2. Adjust import path if needed

## Files Modified

- [ ] `src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js`

## Files Created

- None

## Definition of Done

- [ ] Class extends BaseCharacterBuilderController
- [ ] All necessary imports added
- [ ] Private fields migrated to inherited properties
- [ ] All field references updated throughout class
- [ ] Abstract method placeholders added
- [ ] No compilation errors
- [ ] No linting errors
- [ ] Existing tests still pass (may have errors due to incomplete implementation)
- [ ] Code committed with descriptive message
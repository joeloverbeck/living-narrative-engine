# MOVMODMIG-004: Migrate Movement Actions

## Overview
Migrate the go action from core mod to movement mod, including updating the visual theme to Explorer Cyan and updating all namespace references.

## Current State
- **File Location**: `data/mods/core/actions/go.action.json`
- **Current ID**: `core:go`
- **Visual Theme**: Classic Blue-Grey (#455a64)
- **Dependencies**: References `core:clear_directions` and `core:actor-can-move`

## Objectives
1. Copy go.action.json to movement mod
2. Update action ID to movement namespace
3. Apply Explorer Cyan visual theme
4. Update all internal references to movement namespace
5. Validate action schema compliance
6. Update movement mod manifest

## Technical Requirements

### Current Action Structure
```json
// Current: data/mods/core/actions/go.action.json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:go",
  "name": "Go",
  "description": "Move to another location",
  "scope": "core:clear_directions",
  "prerequisite": {
    "condition": "core:actor-can-move"
  },
  "visual": {
    "backgroundColor": "#455a64",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#37474f",
    "hoverTextColor": "#ffffff"
  }
}
```

### Target Action Structure
```json
// Target: data/mods/movement/actions/go.action.json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "movement:go",
  "name": "Go",
  "description": "Move to another location",
  "scope": "movement:clear_directions",
  "prerequisite": {
    "condition": "movement:actor-can-move"
  },
  "visual": {
    "backgroundColor": "#006064",
    "textColor": "#e0f7fa",
    "hoverBackgroundColor": "#00838f",
    "hoverTextColor": "#ffffff"
  },
  "metadata": {
    "migratedFrom": "core:go",
    "migrationDate": "2024-01-XX",
    "migrationTicket": "MOVMODMIG-004"
  }
}
```

## Implementation Steps

### Step 1: Copy Action File
```bash
# Copy the action file to movement mod
cp data/mods/core/actions/go.action.json data/mods/movement/actions/go.action.json

# Verify copy was successful
ls -la data/mods/movement/actions/go.action.json
```

### Step 2: Update Action ID and References
```javascript
// Update script for go.action.json
const fs = require('fs');
const path = require('path');

const actionPath = 'data/mods/movement/actions/go.action.json';
const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

// Update ID
action.id = 'movement:go';

// Update scope reference
action.scope = 'movement:clear_directions';

// Update prerequisite condition
if (action.prerequisite && action.prerequisite.condition) {
  action.prerequisite.condition = 'movement:actor-can-move';
}

// Save updated action
fs.writeFileSync(actionPath, JSON.stringify(action, null, 2));
```

### Step 3: Apply Explorer Cyan Theme
```javascript
// Apply new visual configuration
const applyExplorerCyan = (action) => {
  action.visual = {
    backgroundColor: "#006064",
    textColor: "#e0f7fa",
    hoverBackgroundColor: "#00838f",
    hoverTextColor: "#ffffff"
  };

  // Add theme metadata
  action.visualTheme = {
    name: "Explorer Cyan",
    wcagCompliance: {
      normal: "AAA",
      hover: "AA"
    },
    contrastRatios: {
      normal: "12.3:1",
      hover: "5.8:1"
    }
  };

  return action;
};
```

### Step 4: Add Migration Metadata
```javascript
// Add migration tracking information
const addMigrationMetadata = (action) => {
  action.metadata = {
    migratedFrom: "core:go",
    migrationDate: new Date().toISOString(),
    migrationTicket: "MOVMODMIG-004",
    version: "1.0.0"
  };

  return action;
};
```

### Step 5: Validate Schema Compliance
```javascript
// Location: scripts/validate-action-schema.js
const Ajv = require('ajv');
const fs = require('fs');

const validateAction = (actionPath) => {
  const ajv = new Ajv();
  const schema = JSON.parse(
    fs.readFileSync('data/schemas/action.schema.json', 'utf8')
  );
  const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

  const validate = ajv.compile(schema);
  const valid = validate(action);

  if (!valid) {
    console.error('Validation errors:', validate.errors);
    return false;
  }

  console.log('Action validates successfully');
  return true;
};

// Validate migrated action
validateAction('data/mods/movement/actions/go.action.json');
```

### Step 6: Update Movement Mod Manifest
```json
// Update: data/mods/movement/mod-manifest.json
{
  "id": "movement",
  "version": "1.0.0",
  "content": {
    "actions": [
      "movement:go"  // Add this entry
    ],
    "rules": [],
    "conditions": [],
    "scopes": []
  }
}
```

### Step 7: Create Visual Test Page
```html
<!-- Location: test/visual/movement-action-test.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Movement Action Visual Test</title>
  <style>
    .action-button {
      padding: 10px 20px;
      margin: 10px;
      border: none;
      cursor: pointer;
      transition: all 0.3s;
    }

    .explorer-cyan {
      background-color: #006064;
      color: #e0f7fa;
    }

    .explorer-cyan:hover {
      background-color: #00838f;
      color: #ffffff;
    }

    .classic-blue {
      background-color: #455a64;
      color: #ffffff;
    }

    .classic-blue:hover {
      background-color: #37474f;
      color: #ffffff;
    }
  </style>
</head>
<body>
  <h1>Movement Action Visual Comparison</h1>
  <h2>New Explorer Cyan Theme</h2>
  <button class="action-button explorer-cyan">Go</button>

  <h2>Old Classic Blue Theme</h2>
  <button class="action-button classic-blue">Go</button>

  <h2>WCAG Compliance</h2>
  <ul>
    <li>Explorer Cyan Normal: 12.3:1 (AAA)</li>
    <li>Explorer Cyan Hover: 5.8:1 (AA)</li>
    <li>Classic Blue Normal: 7.9:1 (AAA)</li>
    <li>Classic Blue Hover: 9.8:1 (AAA)</li>
  </ul>
</body>
</html>
```

## Validation Criteria

### File Migration
- [ ] go.action.json exists in movement/actions/
- [ ] File is valid JSON
- [ ] File permissions are correct

### Namespace Updates
- [ ] ID changed from `core:go` to `movement:go`
- [ ] Scope reference updated to `movement:clear_directions`
- [ ] Prerequisite updated to `movement:actor-can-move`

### Visual Theme
- [ ] Explorer Cyan colors applied correctly
- [ ] WCAG compliance verified
- [ ] Hover states work properly

### Schema Compliance
- [ ] Action validates against action.schema.json
- [ ] All required fields present
- [ ] No schema violations

## Testing Requirements

### Unit Tests
```javascript
// Location: tests/unit/mods/movement/actions/go.test.js
describe('Movement Go Action', () => {
  it('should have correct movement namespace', () => {
    const action = loadAction('movement:go');
    expect(action.id).toBe('movement:go');
  });

  it('should reference movement scope', () => {
    const action = loadAction('movement:go');
    expect(action.scope).toBe('movement:clear_directions');
  });

  it('should have Explorer Cyan colors', () => {
    const action = loadAction('movement:go');
    expect(action.visual.backgroundColor).toBe('#006064');
    expect(action.visual.textColor).toBe('#e0f7fa');
  });

  it('should have migration metadata', () => {
    const action = loadAction('movement:go');
    expect(action.metadata.migratedFrom).toBe('core:go');
    expect(action.metadata.migrationTicket).toBe('MOVMODMIG-004');
  });
});
```

### Visual Tests
```javascript
// Location: tests/visual/movement-action-colors.test.js
describe('Movement Action Visual Theme', () => {
  it('should meet WCAG AAA for normal state', () => {
    const contrast = calculateContrast('#006064', '#e0f7fa');
    expect(contrast).toBeGreaterThanOrEqual(7);
  });

  it('should meet WCAG AA for hover state', () => {
    const contrast = calculateContrast('#00838f', '#ffffff');
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});
```

### Integration Tests
```javascript
// Location: tests/integration/mods/movement/actionLoading.test.js
describe('Movement Action Loading', () => {
  it('should load go action from movement mod', () => {
    const modLoader = new ModLoader();
    modLoader.loadMod('movement');

    const action = modLoader.getAction('movement:go');
    expect(action).toBeDefined();
  });

  it('should resolve movement dependencies', () => {
    const action = loadAction('movement:go');
    const scope = loadScope(action.scope);
    const condition = loadCondition(action.prerequisite.condition);

    expect(scope).toBeDefined();
    expect(condition).toBeDefined();
  });
});
```

## Risk Assessment

### Risks
1. **Visual Regression**: New colors might not work in all contexts
2. **Reference Breakage**: Other files might still reference `core:go`
3. **Schema Changes**: Action schema might have changed
4. **Loading Order**: Movement mod might load before dependencies

### Mitigation
1. Test visual theme in multiple browsers and contexts
2. Use compatibility layer from MOVMODMIG-003
3. Validate against latest schema version
4. Ensure proper dependency declaration in manifest

## Dependencies
- **Requires**: MOVMODMIG-001, MOVMODMIG-002, MOVMODMIG-003
- **Blocks**: MOVMODMIG-007, MOVMODMIG-008
- **Related**: MOVMODMIG-005, MOVMODMIG-006

## Estimated Effort
**Story Points**: 3
**Time Estimate**: 2-3 hours

## Acceptance Criteria
- [ ] go.action.json successfully migrated to movement mod
- [ ] All namespace references updated to movement
- [ ] Explorer Cyan theme applied and validated
- [ ] Migration metadata included
- [ ] Schema validation passes
- [ ] Unit tests pass
- [ ] Visual tests confirm WCAG compliance
- [ ] Movement mod manifest updated
- [ ] No errors when loading movement mod

## Notes
- This is the first content migration, sets pattern for others
- Pay special attention to visual testing for accessibility
- The Explorer Cyan theme should enhance the exploration theme
- Consider creating automated migration script for similar actions in future
# BENOVERSYS-003: Create Action Definitions

## Overview
Create two action definitions for the bending over system: `bend_over` to initiate bending over a surface, and `straighten_up` to stop bending over. These actions will integrate with the existing positioning system while maintaining mutual exclusivity with sitting and kneeling.

## Prerequisites
- BENOVERSYS-001 completed (component definitions exist)
- BENOVERSYS-002 completed (scope definitions exist)
- Understanding of action schema structure
- Knowledge of existing positioning actions (sit_down, get_up_from_furniture, kneel_before)

## Acceptance Criteria
1. `bend_over` action created with proper component requirements
2. `straighten_up` action created with correct prerequisites
3. Both actions have appropriate visual styling
4. Mutual exclusivity with other positioning states enforced
5. Action templates provide clear user feedback
6. Actions validate against action schema

## Implementation Steps

### Step 1: Create bend_over Action
Create `data/mods/positioning/actions/bend_over.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:bend_over",
  "name": "Bend over",
  "description": "Bend over an available surface",
  "targets": "positioning:available_surfaces",
  "required_components": {
    "actor": []
  },
  "forbidden_components": {
    "actor": [
      "positioning:sitting_on",
      "positioning:bending_over",
      "positioning:kneeling_before"
    ]
  },
  "template": "bend over {target}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#5e35b1",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#4527a0",
    "hoverTextColor": "#ffffff"
  }
}
```

**Key Design Decisions:**
- `targets`: Uses the `available_surfaces` scope to find valid targets
- `forbidden_components`: Ensures actor isn't already in another positioning state
- `template`: Simple, clear action description
- `visual`: Purple theme to distinguish from sitting (might be blue) and kneeling

### Step 2: Create straighten_up Action
Create `data/mods/positioning/actions/straighten_up.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:straighten_up",
  "name": "Straighten up",
  "description": "Stop bending over the surface",
  "targets": "positioning:surface_im_bending_over",
  "required_components": {
    "actor": ["positioning:bending_over"]
  },
  "forbidden_components": {
    "actor": []
  },
  "template": "straighten up from {target}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#5e35b1",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#4527a0",
    "hoverTextColor": "#ffffff"
  }
}
```

**Key Design Decisions:**
- `targets`: Uses `surface_im_bending_over` scope to identify current surface
- `required_components`: Actor must have `bending_over` component
- `template`: Clearly indicates the action reverses bending state
- Visual consistency with bend_over action

### Step 3: Validate Action Schemas
Run validation for both actions:

```bash
# Validate bend_over action
npm run validate-action data/mods/positioning/actions/bend_over.action.json

# Validate straighten_up action
npm run validate-action data/mods/positioning/actions/straighten_up.action.json
```

### Step 4: Update Positioning Mod Manifest
Add the new actions to `data/mods/positioning/mod-manifest.json`:

```json
{
  "actions": [
    // ... existing actions
    "positioning:bend_over",
    "positioning:straighten_up"
  ]
}
```

## Testing Requirements

### Unit Tests

1. **Action Schema Validation**:
```javascript
describe('Bending action definitions', () => {
  it('should validate bend_over action schema', () => {
    const bendOverAction = loadAction('positioning:bend_over');
    expect(validateActionSchema(bendOverAction)).toBe(true);
    expect(bendOverAction.targets).toBe('positioning:available_surfaces');
  });

  it('should validate straighten_up action schema', () => {
    const straightenUpAction = loadAction('positioning:straighten_up');
    expect(validateActionSchema(straightenUpAction)).toBe(true);
    expect(straightenUpAction.required_components.actor).toContain('positioning:bending_over');
  });
});
```

2. **Action Availability Tests**:
```javascript
describe('Action availability', () => {
  it('should show bend_over when surfaces available and not positioned', () => {
    const actor = {
      id: 'test:actor',
      components: {
        'core:position': { locationId: 'kitchen:room' }
      }
    };

    const actions = getAvailableActions(actor);
    expect(actions).toContainEqual(
      expect.objectContaining({ id: 'positioning:bend_over' })
    );
  });

  it('should not show bend_over when sitting', () => {
    const actor = {
      id: 'test:actor',
      components: {
        'positioning:sitting_on': { furniture_id: 'test:chair' }
      }
    };

    const actions = getAvailableActions(actor);
    expect(actions).not.toContainEqual(
      expect.objectContaining({ id: 'positioning:bend_over' })
    );
  });

  it('should show straighten_up only when bending', () => {
    const actor = {
      id: 'test:actor',
      components: {
        'positioning:bending_over': { surface_id: 'test:counter' }
      }
    };

    const actions = getAvailableActions(actor);
    expect(actions).toContainEqual(
      expect.objectContaining({ id: 'positioning:straighten_up' })
    );
  });
});
```

3. **Mutual Exclusivity Tests**:
```javascript
describe('Positioning state mutual exclusivity', () => {
  it('should prevent bending while sitting', () => {
    const actor = {
      components: {
        'positioning:sitting_on': { furniture_id: 'test:chair' }
      }
    };

    expect(canPerformAction(actor, 'positioning:bend_over')).toBe(false);
  });

  it('should prevent sitting while bending', () => {
    const actor = {
      components: {
        'positioning:bending_over': { surface_id: 'test:counter' }
      }
    };

    expect(canPerformAction(actor, 'positioning:sit_down')).toBe(false);
  });

  it('should prevent kneeling while bending', () => {
    const actor = {
      components: {
        'positioning:bending_over': { surface_id: 'test:counter' }
      }
    };

    expect(canPerformAction(actor, 'positioning:kneel_before')).toBe(false);
  });
});
```

### Integration Tests

1. **Action Discovery Integration**:
   - Verify action discovery service finds both actions
   - Test action filtering based on component state
   - Ensure proper target resolution from scopes

2. **UI Integration**:
   - Verify actions appear in UI with correct styling
   - Test action button hover states
   - Confirm template string formatting with target names

## Code Examples

### Example Action Execution Flow
```javascript
// When bend_over action is selected
async function executeBendOver(actor, targetSurfaceId) {
  // Verify target is valid
  const availableSurfaces = await evaluateScope('positioning:available_surfaces', actor);
  const targetSurface = availableSurfaces.find(s => s.id === targetSurfaceId);

  if (!targetSurface) {
    throw new Error('Invalid target surface');
  }

  // Dispatch action event
  eventBus.dispatch({
    type: 'ACTION_ATTEMPTED',
    payload: {
      actionId: 'positioning:bend_over',
      actorId: actor.id,
      targetId: targetSurfaceId
    }
  });
}
```

### Example Action Template Formatting
```javascript
// Template: "bend over {target}"
const formattedAction = formatTemplate(
  "bend over {target}",
  {
    target: "the kitchen counter"
  }
);
// Result: "bend over the kitchen counter"
```

## Notes
- Actions use consistent visual theme to group positioning actions
- Templates are concise and clear for better UX
- Forbidden components list ensures state consistency
- No prerequisites needed (unlike some complex actions)
- Future enhancement: Could add stamina cost or other requirements

## Dependencies
- Blocks: BENOVERSYS-004, BENOVERSYS-005, BENOVERSYS-006 (conditions and rules need actions)
- Blocked by: BENOVERSYS-001, BENOVERSYS-002 (requires components and scopes)

## Estimated Effort
- 30 minutes implementation
- 45 minutes testing and validation

## Risk Assessment
- **Low Risk**: Actions are well-isolated from existing functionality
- **Mitigation**: Careful validation of mutual exclusivity rules
- **Recovery**: Simple file modification if adjustments needed

## Success Metrics
- Both action files created with correct schema
- Action validation passes
- Actions appear in discovery when appropriate
- Mutual exclusivity with other positioning states confirmed
- UI displays actions with proper styling
# MOULOCSYS-007: Update Core Mod Manifest

**Phase**: System Integration  
**Priority**: Critical  
**Complexity**: Low  
**Dependencies**: MOULOCSYS-001 (component), MOULOCSYS-002 (condition)  
**Estimated Time**: 1-2 hours

## Summary

Update the core mod manifest to include the new mouth engagement component and mouth availability condition. This ensures the mod loader recognizes and loads these new assets during game initialization.

## Technical Requirements

### File to Modify

`data/mods/core/mod-manifest.json`

### Manifest Updates

#### Add Component Reference
```json
{
  "components": [
    // ... existing components ...
    "core:mouth_engagement"
  ]
}
```

#### Add Condition Reference
```json
{
  "conditions": [
    // ... existing conditions ...
    "core:actor-mouth-available"
  ]
}
```

#### Complete Updated Manifest Structure
```json
{
  "id": "core",
  "version": "1.0.0",
  "name": "Core System Components",
  "description": "Essential game mechanics and base systems",
  "dependencies": [],
  "components": [
    // ... existing core components ...
    "core:actor",
    "core:name",
    "core:movement",
    "core:mouth_engagement"  // NEW
  ],
  "conditions": [
    // ... existing core conditions ...
    "core:actor-can-move",
    "core:actor-mouth-available"  // NEW
  ],
  "actions": [
    // ... existing actions remain unchanged ...
  ],
  "rules": [
    // ... existing rules remain unchanged ...
  ],
  "entities": [
    // ... existing entities remain unchanged ...
  ]
}
```

## Implementation Details

### Manifest Loading Process

#### Component Loading
1. Mod loader reads manifest
2. Finds "core:mouth_engagement" in components list
3. Loads `data/mods/core/components/mouth_engagement.component.json`
4. Registers component with AJV validator
5. Makes available to entity system

#### Condition Loading
1. Mod loader reads manifest
2. Finds "core:actor-mouth-available" in conditions list
3. Loads `data/mods/core/conditions/actor-mouth-available.condition.json`
4. Registers with condition evaluator
5. Makes available for use in prerequisites

### Validation Requirements

#### JSON Schema Compliance
```javascript
// The manifest must validate against mod-manifest.schema.json
{
  "components": {
    "type": "array",
    "items": {
      "type": "string",
      "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z_][a-zA-Z0-9_]*$"
    }
  },
  "conditions": {
    "type": "array", 
    "items": {
      "type": "string",
      "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z_][a-zA-Z0-9_]*$"
    }
  }
}
```

#### File Existence
- `components/mouth_engagement.component.json` must exist
- `conditions/actor-mouth-available.condition.json` must exist
- Files must be valid JSON

## Acceptance Criteria

### Manifest Updates
- [ ] **Component Added**: "core:mouth_engagement" in components array
- [ ] **Condition Added**: "core:actor-mouth-available" in conditions array
- [ ] **JSON Valid**: Manifest parses as valid JSON
- [ ] **Schema Valid**: Validates against mod-manifest.schema.json
- [ ] **Order Preserved**: Existing entries maintain their order

### Loading Verification
- [ ] **Component Loads**: Component loads without errors during startup
- [ ] **Condition Loads**: Condition loads without errors during startup
- [ ] **No Duplicates**: No duplicate entries in manifest
- [ ] **File References**: All referenced files exist and are valid

## Testing Strategy

### Manual Validation

#### JSON Validation
```bash
# Validate JSON syntax
npm run validate:json data/mods/core/mod-manifest.json

# Validate against schema
npm run validate:schemas
```

#### Startup Testing
```bash
# Start game and check for loading errors
npm run dev

# Look for these log entries:
# "Loading component: core:mouth_engagement"
# "Loading condition: core:actor-mouth-available"
# No "Failed to load" errors
```

### Automated Tests

File: `tests/unit/mods/core/coreModManifest.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { validateAgainstSchema } from '../../../common/utils/schemaValidator.js';

describe('Core Mod Manifest', () => {
  let manifest;

  beforeAll(() => {
    const manifestPath = 'data/mods/core/mod-manifest.json';
    const manifestContent = readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(manifestContent);
  });

  describe('Structure', () => {
    it('should be valid JSON', () => {
      expect(manifest).toBeDefined();
      expect(typeof manifest).toBe('object');
    });

    it('should validate against mod-manifest schema', () => {
      const isValid = validateAgainstSchema(
        manifest,
        'mod-manifest.schema.json'
      );
      expect(isValid).toBe(true);
    });

    it('should have required properties', () => {
      expect(manifest.id).toBe('core');
      expect(manifest.components).toBeInstanceOf(Array);
      expect(manifest.conditions).toBeInstanceOf(Array);
    });
  });

  describe('Mouth Engagement Integration', () => {
    it('should include mouth_engagement component', () => {
      expect(manifest.components).toContain('core:mouth_engagement');
    });

    it('should include actor-mouth-available condition', () => {
      expect(manifest.conditions).toContain('core:actor-mouth-available');
    });

    it('should not have duplicate entries', () => {
      const componentCounts = {};
      manifest.components.forEach(comp => {
        componentCounts[comp] = (componentCounts[comp] || 0) + 1;
      });

      Object.entries(componentCounts).forEach(([comp, count]) => {
        expect(count).toBe(1);
      });

      const conditionCounts = {};
      manifest.conditions.forEach(cond => {
        conditionCounts[cond] = (conditionCounts[cond] || 0) + 1;
      });

      Object.entries(conditionCounts).forEach(([cond, count]) => {
        expect(count).toBe(1);
      });
    });
  });

  describe('File References', () => {
    it('should have corresponding component file', () => {
      const fs = require('fs');
      const componentPath = 'data/mods/core/components/mouth_engagement.component.json';
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should have corresponding condition file', () => {
      const fs = require('fs');
      const conditionPath = 'data/mods/core/conditions/actor-mouth-available.condition.json';
      expect(fs.existsSync(conditionPath)).toBe(true);
    });
  });
});
```

### Integration Tests

File: `tests/integration/mods/core/mouthEngagementLoading.test.js`

```javascript
describe('Mouth Engagement Loading Integration', () => {
  let gameEngine;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
  });

  it('should load mouth_engagement component during startup', async () => {
    const componentRegistry = gameEngine.componentRegistry;
    
    expect(componentRegistry.hasComponent('core:mouth_engagement')).toBe(true);
    
    const schema = componentRegistry.getSchema('core:mouth_engagement');
    expect(schema).toBeDefined();
    expect(schema.properties.locked).toBeDefined();
  });

  it('should load actor-mouth-available condition during startup', async () => {
    const conditionEvaluator = gameEngine.conditionEvaluator;
    
    const hasCondition = conditionEvaluator.hasCondition('core:actor-mouth-available');
    expect(hasCondition).toBe(true);
  });

  it('should be able to use mouth engagement component', async () => {
    const entityManager = gameEngine.entityManager;
    const entity = await entityManager.createEntity('test_entity');
    
    // Should not throw
    await entityManager.addComponent(entity, 'core:mouth_engagement', {
      locked: false,
      forcedOverride: false
    });
    
    const component = entityManager.getComponentData(entity, 'core:mouth_engagement');
    expect(component.locked).toBe(false);
  });

  it('should be able to evaluate mouth availability condition', async () => {
    const actor = await createTestActor({ hasMouth: true });
    
    const conditionEvaluator = gameEngine.conditionEvaluator;
    const result = await conditionEvaluator.evaluate(
      'core:actor-mouth-available',
      { actor }
    );
    
    expect(typeof result).toBe('boolean');
  });
});
```

## Edge Cases and Considerations

### Manifest Ordering
- Components typically loaded before conditions
- Dependencies resolved before dependent items
- Core mod loads before all other mods

### Version Compatibility
- Manifest version should remain unchanged
- New additions are backward compatible
- Older game versions gracefully ignore unknown components

### Loading Failures
- Invalid component JSON causes startup failure
- Missing referenced files cause warnings
- Schema validation errors prevent mod loading

## Dependencies and Integration

### Loading Order
1. Core mod manifest loaded first
2. Component files loaded and validated
3. Condition files loaded and validated
4. Other mods loaded (may reference core components)

### System Integration
- AJV validator gains new component schema
- Condition evaluator gains new condition
- Entity manager can create mouth engagement components
- Action system can check mouth availability

## Definition of Done

- [ ] Manifest updated with new entries
- [ ] JSON syntax valid
- [ ] Schema validation passes
- [ ] No duplicate entries
- [ ] Referenced files exist
- [ ] Game starts without loading errors
- [ ] Component usable by entity system
- [ ] Condition usable by action system
- [ ] Tests written and passing
- [ ] Integration verified
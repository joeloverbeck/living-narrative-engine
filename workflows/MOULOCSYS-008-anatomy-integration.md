# MOULOCSYS-008: Add Mouth Engagement to Anatomy

**Phase**: System Integration  
**Priority**: High  
**Complexity**: Medium  
**Dependencies**: MOULOCSYS-001 (component), MOULOCSYS-007 (manifest)  
**Estimated Time**: 3-4 hours

## Summary

Update the humanoid mouth entity definition to include the `core:mouth_engagement` component by default. This ensures all mouth parts created through the anatomy system automatically have mouth engagement tracking capabilities.

## Technical Requirements

### File to Modify

`data/mods/anatomy/entities/definitions/humanoid_mouth.entity.json`

### Entity Definition Update

#### Complete Updated Entity
```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "anatomy:humanoid_mouth",
  "description": "A humanoid mouth with engagement tracking capabilities for preventing conflicting oral actions",
  "components": {
    "anatomy:part": {
      "subType": "mouth"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "teeth",
          "allowedTypes": ["teeth"],
          "nameTpl": "{{type}}"
        }
      ]
    },
    "core:name": {
      "text": "mouth"
    },
    "core:mouth_engagement": {
      "locked": false,
      "forcedOverride": false
    }
  }
}
```

### Integration Benefits

#### Automatic Availability
- All new mouth parts include engagement component
- No manual component addition required
- Consistent mouth engagement support across all entities

#### Clean Initialization
- Default unlocked state (locked: false)
- Reserved forcedOverride for future features
- Compatible with existing mouth parts

## Acceptance Criteria

### Entity Definition Updates
- [ ] **Component Added**: core:mouth_engagement in components section
- [ ] **Default Values**: locked: false, forcedOverride: false
- [ ] **Schema Valid**: Validates against entity-definition.schema.json
- [ ] **JSON Valid**: Parses correctly as JSON
- [ ] **Existing Components**: All existing components preserved

### Integration Verification
- [ ] **New Mouths**: Newly created mouths have engagement component
- [ ] **Condition Works**: actor-mouth-available works with anatomy mouths
- [ ] **Handler Works**: Lock/unlock operations work with anatomy mouths
- [ ] **No Conflicts**: No conflicts with existing anatomy system

## Testing Strategy

### Unit Tests

File: `tests/unit/mods/anatomy/humanoidMouth.test.js`

```javascript
describe('Humanoid Mouth Entity - Mouth Engagement', () => {
  let entityFactory;
  let entityManager;

  beforeEach(() => {
    const testBed = createTestBed();
    entityFactory = testBed.entityFactory;
    entityManager = testBed.entityManager;
  });

  it('should include mouth_engagement component by default', async () => {
    const mouth = await entityFactory.createFromDefinition(
      'anatomy:humanoid_mouth'
    );

    const engagement = entityManager.getComponentData(
      mouth.id,
      'core:mouth_engagement'
    );

    expect(engagement).toEqual({
      locked: false,
      forcedOverride: false
    });
  });

  it('should still include all existing components', async () => {
    const mouth = await entityFactory.createFromDefinition(
      'anatomy:humanoid_mouth'
    );

    // Verify anatomy:part component
    const partComponent = entityManager.getComponentData(
      mouth.id,
      'anatomy:part'
    );
    expect(partComponent.subType).toBe('mouth');

    // Verify core:name component
    const nameComponent = entityManager.getComponentData(
      mouth.id,
      'core:name'
    );
    expect(nameComponent.text).toBe('mouth');

    // Verify anatomy:sockets component
    const socketsComponent = entityManager.getComponentData(
      mouth.id,
      'anatomy:sockets'
    );
    expect(socketsComponent.sockets).toHaveLength(1);
    expect(socketsComponent.sockets[0].id).toBe('teeth');
  });
});
```

### Integration Tests

File: `tests/integration/mods/anatomy/mouthEngagementIntegration.test.js`

```javascript
describe('Mouth Engagement - Anatomy Integration', () => {
  let gameEngine;
  let entityManager;
  let operationInterpreter;

  beforeEach(async () => {
    gameEngine = await createTestGameEngine();
    entityManager = gameEngine.entityManager;
    operationInterpreter = gameEngine.operationInterpreter;
  });

  it('should work with anatomy-based actors', async () => {
    // Create actor with anatomy system
    const actor = await createActorWithAnatomy(entityManager, {
      bodyType: 'humanoid'
    });

    // Get mouth part
    const mouthParts = getMouthParts(entityManager, actor.id);
    expect(mouthParts).toHaveLength(1);
    
    const mouth = mouthParts[0];
    expect(mouth.engagement).toEqual({
      locked: false,
      forcedOverride: false
    });

    // Test locking
    await operationInterpreter.execute({
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor.id }
    });

    // Verify locked
    const updatedMouthParts = getMouthParts(entityManager, actor.id);
    expect(updatedMouthParts[0].engagement.locked).toBe(true);
  });

  it('should work with mouth availability condition', async () => {
    const actor = await createActorWithAnatomy(entityManager, {
      bodyType: 'humanoid'
    });

    const conditionEvaluator = gameEngine.conditionEvaluator;

    // Initially available
    let available = await conditionEvaluator.evaluate(
      'core:actor-mouth-available',
      { actor: actor.id }
    );
    expect(available).toBe(true);

    // Lock mouth
    await operationInterpreter.execute({
      type: 'LOCK_MOUTH_ENGAGEMENT',
      parameters: { actor_id: actor.id }
    });

    // Should be unavailable
    available = await conditionEvaluator.evaluate(
      'core:actor-mouth-available',
      { actor: actor.id }
    );
    expect(available).toBe(false);
  });
});
```

## Definition of Done

- [ ] Entity definition updated with mouth_engagement component
- [ ] JSON syntax valid
- [ ] Schema validation passes
- [ ] Default values set correctly
- [ ] Integration tests passing
- [ ] New mouth parts have engagement component
- [ ] Existing functionality preserved
- [ ] Compatible with lock/unlock operations
# ACTDESC-011: Update Description Order Configuration

## Status
🟡 **Pending**

## Phase
**Phase 3: Integration** (Week 2)

## Description
Add `'activity'` to the `defaultDescriptionOrder` array in `DescriptionConfiguration` to enable activity descriptions in the body description pipeline.

## Background
The description order controls which sections appear in body descriptions and their sequence. Adding 'activity' activates the integration point created in ACTDESC-010.

**Reference**: Design document lines 1792-1807 (Description Configuration Update)

## Technical Specification

### File to Modify
`src/anatomy/configuration/descriptionConfiguration.js`

### Update Required
```javascript
this._defaultDescriptionOrder = [
  'height',
  'build',
  'body_composition',
  'body_hair',
  'skin_color',
  'hair',
  'eye',
  'face',
  'nose',
  'ears',
  'mouth',
  'teeth',
  'neck',
  'shoulders',
  'chest',
  'breasts',
  'back',
  'arms',
  'hands',
  'abdomen',
  'hips',
  'buttocks',
  'groin',
  'legs',
  'feet',
  'equipment',
  'activity',  // ← ADD THIS LINE
];
```

## Placement Decision
**Position**: After `'equipment'`

**Rationale**:
- Equipment is about what character wears
- Activity is about what character is doing
- Logical flow: Physical description → What they're wearing → What they're doing
- Matches design document recommendation (line 1805)

## Acceptance Criteria
- [ ] `'activity'` added to `defaultDescriptionOrder` array
- [ ] Placed after `'equipment'` entry
- [ ] No other changes to order
- [ ] Configuration loads without errors
- [ ] Activity descriptions appear in body descriptions when service is active

## Dependencies
- **Requires**: ACTDESC-010 (Composer integration must handle 'activity')
- **Blocks**: ACTDESC-013 (Integration tests need this active)

## Testing Requirements

```javascript
describe('DescriptionConfiguration - Activity Order', () => {
  it('should include activity in default description order', () => {
    const config = new DescriptionConfiguration();
    const order = config.getDescriptionOrder();

    expect(order).toContain('activity');
  });

  it('should place activity after equipment', () => {
    const config = new DescriptionConfiguration();
    const order = config.getDescriptionOrder();

    const equipmentIndex = order.indexOf('equipment');
    const activityIndex = order.indexOf('activity');

    expect(activityIndex).toBeGreaterThan(equipmentIndex);
  });

  it('should allow activity order to be customized', () => {
    const config = new DescriptionConfiguration();
    const customOrder = ['height', 'activity', 'equipment'];

    config.setDescriptionOrder(customOrder);

    expect(config.getDescriptionOrder()).toEqual(customOrder);
  });
});
```

## Integration Test
```javascript
describe('Body Description with Activity', () => {
  it('should include activity section when entity has activities', async () => {
    const entity = createTestEntity({
      id: 'jon',
      components: {
        'anatomy:body': { /* body data */ },
        'core:name': { text: 'Jon Ureña' },
        'positioning:kneeling_before': {
          entityId: 'alicia',
          activityMetadata: {
            shouldDescribeInActivity: true,
            template: '{actor} is kneeling before {target}',
            targetRole: 'entityId',
            priority: 75,
          },
        },
      },
    });

    const orchestrator = container.resolve('BodyDescriptionOrchestrator');
    const { bodyDescription } = await orchestrator.generateAllDescriptions(entity);

    expect(bodyDescription).toContain('Activity:');
    expect(bodyDescription).toContain('kneeling before');
  });
});
```

## Implementation Notes
1. **Single Line Change**: Literally just add one line to the array
2. **No Breaking Changes**: Adding an entry to description order doesn't break existing code
3. **Optional Feature**: Activity descriptions only appear if:
   - ActivityDescriptionService is injected
   - Entity has activity components with metadata
4. **Customizable**: Users can still customize description order to exclude 'activity' if desired

## Alternative Placements Considered
| Placement | Rationale | Decision |
|-----------|-----------|----------|
| **After 'equipment'** | Logical flow: body → clothing → activity | ✅ **CHOSEN** |
| At end of list | Doesn't disrupt existing order | ❌ Less logical |
| Before 'equipment' | Activity before attire | ❌ Weird to describe activity before mentioning clothing |
| At beginning | Immediately visible | ❌ Disrupts physical description flow |

## Reference Files
- Config file: `src/anatomy/configuration/descriptionConfiguration.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1792-1807)

## Success Metrics
- Configuration change successful
- Activity descriptions appear in generated descriptions
- Descriptions maintain logical flow
- No breaking changes to existing functionality

## Related Tickets
- **Requires**: ACTDESC-010 (Composer must handle 'activity' type)
- **Blocks**: ACTDESC-013 (Integration tests)
- **Enables**: All Phase 2+ features (activity descriptions now active)

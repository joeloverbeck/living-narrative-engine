# ACTDESC-010: Integrate ActivityDescriptionService with BodyDescriptionComposer

## Status
🟡 **Pending**

## Phase
**Phase 3: Integration** (Week 2)

## Description
Update `BodyDescriptionComposer` to inject and call `ActivityDescriptionService`, following the exact pattern used by `EquipmentDescriptionService`.

## Background
This integrates the activity description system into the main body description pipeline as an optional extension point.

**Reference**: Design document lines 1666-1728 (Integration into BodyDescriptionComposer)

## Technical Specification

### File to Modify
`src/anatomy/bodyDescriptionComposer.js`

### Constructor Update
```javascript
constructor({
  bodyPartDescriptionBuilder,
  bodyGraphService,
  entityFinder,
  anatomyFormattingService,
  partDescriptionGenerator,
  equipmentDescriptionService = null,
  activityDescriptionService = null, // ← ADD THIS
  logger = null,
}) {
  // ... existing validation

  this.equipmentDescriptionService = equipmentDescriptionService;
  this.activityDescriptionService = activityDescriptionService; // ← STORE

  this.#logger = ensureValidLogger(logger, 'BodyDescriptionComposer');

  // ... rest of constructor
}
```

### composeDescription Method Update
```javascript
async composeDescription(bodyEntity) {
  // ... existing body descriptor and part processing

  for (const partType of descriptionOrder) {
    // ... handle body descriptors

    // Handle equipment descriptions (EXISTING)
    if (partType === 'equipment' && this.equipmentDescriptionService) {
      const equipmentDescription =
        await this.equipmentDescriptionService.generateEquipmentDescription(
          bodyEntity.id
        );
      if (equipmentDescription) {
        lines.push(equipmentDescription);
      }
      processedTypes.add(partType);
      continue;
    }

    // Handle activity descriptions (NEW)
    if (partType === 'activity' && this.activityDescriptionService) {
      const activityDescription =
        await this.activityDescriptionService.generateActivityDescription(
          bodyEntity.id
        );
      if (activityDescription) {
        lines.push(activityDescription);
      }
      processedTypes.add(partType);
      continue;
    }

    // ... handle body parts
  }

  return lines.join('\n');
}
```

## Acceptance Criteria
- [ ] Constructor updated with `activityDescriptionService` parameter
- [ ] Parameter defaults to `null` (optional dependency)
- [ ] Service stored in instance field
- [ ] `composeDescription` method calls service when partType is 'activity'
- [ ] Only calls service if it's injected (null check)
- [ ] Only adds description if service returns non-empty string
- [ ] Marks 'activity' as processed type
- [ ] Uses `continue` to skip remaining loop logic
- [ ] Follows exact pattern of equipment service integration
- [ ] No breaking changes to existing functionality

## Dependencies
- **Requires**: ACTDESC-005 (Service exists)
- **Requires**: ACTDESC-008 (Service generates descriptions)
- **Blocks**: ACTDESC-004 (DI registration needs this structure)
- **Blocks**: ACTDESC-013 (Integration tests)

## Testing Requirements

```javascript
describe('BodyDescriptionComposer - Activity Integration', () => {
  it('should call activity service when injected', async () => {
    const mockActivityService = createMock([' generateActivityDescription']);
    mockActivityService.generateActivityDescription.mockResolvedValue(
      'Activity: Jon is kneeling before Alicia'
    );

    const composer = new BodyDescriptionComposer({
      // ... other deps
      activityDescriptionService: mockActivityService,
    });

    const result = await composer.composeDescription(mockBodyEntity);

    expect(mockActivityService.generateActivityDescription).toHaveBeenCalledWith(
      mockBodyEntity.id
    );
    expect(result).toContain('Activity: Jon is kneeling before Alicia');
  });

  it('should work without activity service (backward compatibility)', async () => {
    const composer = new BodyDescriptionComposer({
      // ... other deps
      activityDescriptionService: null, // Not injected
    });

    const result = await composer.composeDescription(mockBodyEntity);

    // Should not crash, just no activity line
    expect(result).not.toContain('Activity:');
  });

  it('should not add line if service returns empty string', async () => {
    const mockActivityService = createMock(['generateActivityDescription']);
    mockActivityService.generateActivityDescription.mockResolvedValue('');

    const composer = new BodyDescriptionComposer({
      // ... other deps
      activityDescriptionService: mockActivityService,
    });

    const result = await composer.composeDescription(mockBodyEntity);

    expect(result).not.toContain('Activity:');
  });

  it('should process activity in correct order', async () => {
    // Assuming description order includes 'activity' after 'equipment'
    mockConfig.descriptionOrder = ['height', 'equipment', 'activity'];

    const result = await composer.composeDescription(mockBodyEntity);
    const lines = result.split('\n');

    // Activity line should appear after equipment line
    const equipmentIndex = lines.findIndex(l => l.includes('Equipment:'));
    const activityIndex = lines.findIndex(l => l.includes('Activity:'));

    if (equipmentIndex >= 0 && activityIndex >= 0) {
      expect(activityIndex).toBeGreaterThan(equipmentIndex);
    }
  });
});
```

## Implementation Notes
1. **Optional Dependency**: Service must default to `null` for backward compatibility
2. **Null Check**: Always check `if (this.activityDescriptionService)` before calling
3. **Empty String Handling**: Only push to lines if description is truthy
4. **Pattern Consistency**: Follow equipment service integration exactly
5. **No Validation**: Don't validate service dependency (it's optional)

## Migration Guide
Existing code that creates BodyDescriptionComposer won't break:
```javascript
// Old code (still works)
const composer = new BodyDescriptionComposer({
  bodyPartDescriptionBuilder,
  bodyGraphService,
  // ... other required deps
});

// New code (with activity support)
const composer = new BodyDescriptionComposer({
  bodyPartDescriptionBuilder,
  bodyGraphService,
  // ... other required deps
  activityDescriptionService, // ← Optional
});
```

## Reference Files
- Composer file: `src/anatomy/bodyDescriptionComposer.js`
- Equipment pattern: Look for `equipmentDescriptionService` in same file
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1666-1728)

## Success Metrics
- Service is called when injected
- Backward compatibility maintained
- Activity descriptions appear in correct position
- No breaking changes

## Related Tickets
- **Requires**: ACTDESC-008 (Service generates descriptions)
- **Blocks**: ACTDESC-004 (DI registration)
- **Blocks**: ACTDESC-011 (Description order config)
- **Blocks**: ACTDESC-013 (Integration tests)

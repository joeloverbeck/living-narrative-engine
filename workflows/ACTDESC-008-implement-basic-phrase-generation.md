# ACTDESC-008: Implement Basic Phrase Generation

## Status
🟡 **Pending**

## Phase
**Phase 2: Core Service Implementation** (Week 1-2)

## Description
Implement `#formatActivityDescription()` and `#generateActivityPhrase()` methods to convert activity objects into formatted natural language strings using simple concatenation (Phase 1 approach).

## Background
This implements the basic description generation pipeline, creating simple but functional activity descriptions. Phase 2 will enhance with smart composition.

**Reference**: Design document lines 1580-1634, 1089-1121 (Format Activity Description, Phase 1 Implementation)

## Technical Specification

### Methods to Implement

```javascript
/**
 * Format activities into natural language description.
 * Phase 1: Simple concatenation
 *
 * @param {Array<object>} activities - Sorted activity objects
 * @param {object} entity - Entity instance
 * @returns {string} Formatted description
 * @private
 */
#formatActivityDescription(activities, entity) {
  const config = this.#anatomyFormattingService.getActivityIntegrationConfig();

  // Get actor name
  const actorName = this.#resolveEntityName(entity.id);

  // Generate descriptions for each activity
  const descriptions = activities.map(activity =>
    this.#generateActivityPhrase(actorName, activity)
  );

  if (descriptions.length === 0) {
    return '';
  }

  // Format with configuration
  const prefix = config.prefix || 'Activity: ';
  const suffix = config.suffix || '';
  const separator = config.separator || '. ';

  const activityText = descriptions.join(separator);
  return `${prefix}${activityText}${suffix}`;
}

/**
 * Generate a single activity phrase.
 *
 * @param {string} actorName - Name of entity performing activity
 * @param {object} activity - Activity object
 * @returns {string} Activity phrase
 * @private
 */
#generateActivityPhrase(actorName, activity) {
  const targetName = activity.targetEntityId
    ? this.#resolveEntityName(activity.targetEntityId)
    : '';

  if (activity.type === 'inline') {
    // Use template
    return activity.template
      .replace('{actor}', actorName)
      .replace('{target}', targetName);
  } else {
    // Dedicated metadata: construct from verb/adverb
    const verb = activity.verb || 'interacting with';
    const adverb = activity.adverb ? ` ${activity.adverb}` : '';

    if (targetName) {
      return `${actorName} is ${verb} ${targetName}${adverb}`;
    } else {
      return `${actorName} is ${verb}${adverb}`;
    }
  }
}
```

## Acceptance Criteria
- [ ] Methods implemented in ActivityDescriptionService
- [ ] Retrieves configuration from AnatomyFormattingService
- [ ] Generates phrases for each activity
- [ ] Uses template replacement for inline activities
- [ ] Constructs verb-based phrases for dedicated activities
- [ ] Joins multiple activities with configured separator
- [ ] Adds configured prefix and suffix
- [ ] Returns empty string if no activities
- [ ] Handles activities without targets
- [ ] Handles missing verb (defaults to "interacting with")

## Dependencies
- **Requires**: ACTDESC-005 (Service class)
- **Requires**: ACTDESC-006, ACTDESC-007 (Activity objects)
- **Requires**: ACTDESC-009 (Entity name resolution)
- **Requires**: ACTDESC-003 (Configuration)
- **Blocks**: ACTDESC-010 (Integration needs working generation)

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Phrase Generation', () => {
  it('should format single inline activity', async () => {
    const activity = {
      type: 'inline',
      template: '{actor} is kneeling before {target}',
      targetEntityId: 'alicia',
      priority: 75,
    };

    mockEntityManager.getEntityInstance.mockImplementation(id => {
      if (id === 'jon') return createMockEntity({ name: 'Jon Ureña' });
      if (id === 'alicia') return createMockEntity({ name: 'Alicia Western' });
    });

    const result = service['#generateActivityPhrase']('Jon Ureña', activity);
    expect(result).toBe('Jon Ureña is kneeling before Alicia Western');
  });

  it('should format dedicated activity with verb', () => {
    const activity = {
      type: 'dedicated',
      verb: 'kissing',
      targetEntityId: 'alicia',
      priority: 90,
    };

    const result = service['#generateActivityPhrase']('Jon Ureña', activity);
    expect(result).toBe('Jon Ureña is kissing Alicia Western');
  });

  it('should include adverb in dedicated activity', () => {
    const activity = {
      type: 'dedicated',
      verb: 'hugging',
      adverb: 'tightly',
      targetEntityId: 'alicia',
    };

    const result = service['#generateActivityPhrase']('Jon Ureña', activity);
    expect(result).toBe('Jon Ureña is hugging Alicia Western tightly');
  });

  it('should handle activity without target', () => {
    const activity = {
      type: 'dedicated',
      verb: 'meditating',
    };

    const result = service['#generateActivityPhrase']('Jon Ureña', activity);
    expect(result).toBe('Jon Ureña is meditating');
  });

  it('should join multiple activities with separator', () => {
    const activities = [
      { type: 'inline', template: '{actor} is kneeling before {target}', targetEntityId: 'alicia' },
      { type: 'inline', template: '{actor} is holding hands with {target}', targetEntityId: 'alicia' },
    ];

    const result = service['#formatActivityDescription'](activities, mockEntity);
    expect(result).toBe(
      'Activity: Jon Ureña is kneeling before Alicia Western. Jon Ureña is holding hands with Alicia Western'
    );
  });

  it('should use config prefix and suffix', () => {
    mockFormattingService.getActivityIntegrationConfig.mockReturnValue({
      prefix: '>>> ',
      suffix: ' <<<',
      separator: ' | ',
    });

    const activities = [
      { type: 'inline', template: '{actor} waves', targetEntityId: null },
    ];

    const result = service['#formatActivityDescription'](activities, mockEntity);
    expect(result).toBe('>>> Jon Ureña waves <<<');
  });

  it('should return empty string for no activities', () => {
    const result = service['#formatActivityDescription']([], mockEntity);
    expect(result).toBe('');
  });
});
```

## Implementation Notes
1. **Template Replacement**: Simple string replace for `{actor}` and `{target}`
2. **Phase 1 Limitations**: No pronoun usage, no smart grouping (separate tickets)
3. **Default Verb**: Use "interacting with" if verb missing
4. **Configuration**: Always retrieve fresh config (not cached at this stage)
5. **Empty Targets**: Handle gracefully by omitting target from phrase

## Example Output
```
// Single activity
"Activity: Jon Ureña is kneeling before Alicia Western"

// Multiple activities (Phase 1 - simple concatenation)
"Activity: Jon Ureña is kneeling before Alicia Western. Jon Ureña is holding hands with Alicia Western"

// Activity without target
"Activity: Jon Ureña is meditating"
```

## Reference Files
- Service file: `src/anatomy/services/activityDescriptionService.js`
- Config: `src/services/anatomyFormattingService.js` (ACTDESC-003)
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1580-1634)

## Success Metrics
- Generates grammatically correct phrases
- Configuration properly applied
- All template placeholders replaced
- No runtime errors

## Related Tickets
- **Requires**: ACTDESC-006, ACTDESC-007 (Activity objects)
- **Requires**: ACTDESC-009 (Name resolution)
- **Blocks**: ACTDESC-010 (Integration)
- **Enhanced By**: ACTDESC-015 (Smart composition - Phase 2)

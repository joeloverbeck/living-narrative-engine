# ACTDESC-015: Implement Smart Activity Grouping

## Status
🟡 **Pending**

## Phase
**Phase 5: Natural Language Enhancements** (Week 3)

## Description
Implement intelligent activity grouping to combine related activities with conjunctions ("and", "while") instead of separate sentences, creating more fluent natural language.

## Background
Phase 1 creates separate sentences for each activity. Smart grouping produces more natural descriptions like "Jon is kneeling before Alicia and holding her hands" instead of "Jon is kneeling before Alicia. Jon is holding hands with Alicia."

**Reference**: Design document lines 1808-1875 (Smart Activity Composition Algorithm)

## Technical Specification

### Grouping Strategy
```javascript
/**
 * Group activities intelligently for natural composition.
 *
 * Grouping Rules:
 * 1. Same target → group with "and"
 * 2. Sequential actions → group with "while"
 * 3. Related activities (metadata.grouping.groupKey) → group together
 * 4. Different targets → separate sentences
 *
 * @param {Array<object>} activities - Sorted activities
 * @returns {Array<ActivityGroup>} Grouped activities
 * @private
 */
#groupActivities(activities) {
  const groups = [];
  let currentGroup = null;

  for (const activity of activities) {
    if (!currentGroup) {
      // Start first group
      currentGroup = {
        primaryActivity: activity,
        relatedActivities: [],
        conjunction: null,
      };
    } else if (this.#shouldGroupWith(currentGroup.primaryActivity, activity)) {
      // Add to current group
      currentGroup.relatedActivities.push({
        activity,
        conjunction: this.#determineConjunction(currentGroup.primaryActivity, activity),
      });
    } else {
      // Finish current group, start new one
      groups.push(currentGroup);
      currentGroup = {
        primaryActivity: activity,
        relatedActivities: [],
        conjunction: null,
      };
    }
  }

  // Add final group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Determine if activity should group with another.
 *
 * @param {object} first - First activity
 * @param {object} second - Second activity
 * @returns {boolean} Should group
 * @private
 */
#shouldGroupWith(first, second) {
  // Same target entities
  if (first.targetEntityId && first.targetEntityId === second.targetEntityId) {
    return true;
  }

  // Explicit grouping metadata
  if (first.grouping?.groupKey && first.grouping.groupKey === second.grouping?.groupKey) {
    return true;
  }

  // No target for either (solo activities can't group meaningfully)
  return false;
}

/**
 * Determine appropriate conjunction for grouped activities.
 *
 * @param {object} first - First activity
 * @param {object} second - Second activity
 * @returns {string} Conjunction ("and", "while")
 * @private
 */
#determineConjunction(first, second) {
  // Simultaneous activities (both have high priority)
  if (Math.abs(first.priority - second.priority) <= 10) {
    return 'while';
  }

  // Sequential activities
  return 'and';
}
```

### Enhanced Formatting with Groups
```javascript
/**
 * Format activity groups into natural language.
 *
 * @param {Array<ActivityGroup>} groups - Activity groups
 * @param {string} actorName - Actor name
 * @param {object} actorPronouns - Actor pronouns
 * @returns {Array<string>} Formatted group descriptions
 * @private
 */
#formatActivityGroups(groups, actorName, actorPronouns) {
  const config = this.#anatomyFormattingService.getActivityIntegrationConfig();
  const usePronoun = config.nameResolution?.usePronounsWhenAvailable;

  return groups.map((group, index) => {
    const actorRef = index === 0 ? actorName : (usePronoun ? actorPronouns.subject : actorName);

    // Format primary activity
    let description = this.#generateActivityPhrase(
      actorRef,
      group.primaryActivity,
      index > 0 && usePronoun
    );

    // Add related activities with conjunctions
    for (const related of group.relatedActivities) {
      const conjunction = related.conjunction;
      const relatedPhrase = this.#generateActivityPhrase(
        '', // No actor for grouped activities
        related.activity,
        usePronoun
      );

      // Extract just the verb phrase (remove "is" from beginning)
      const verbPhrase = relatedPhrase.replace(/^(he|she|they|it) is /, '');
      description += ` ${conjunction} ${verbPhrase}`;
    }

    return description;
  });
}
```

### Updated Main Formatting Method
```javascript
/**
 * Format activities with grouping and pronouns.
 * Phase 2: Smart composition
 *
 * @param {Array<object>} activities - Sorted activities
 * @param {object} entity - Entity instance
 * @returns {string} Formatted description
 * @private
 */
#formatActivityDescription(activities, entity) {
  if (activities.length === 0) {
    return '';
  }

  const config = this.#anatomyFormattingService.getActivityIntegrationConfig();
  const actorName = this.#resolveEntityName(entity.id);
  const actorGender = this.#detectEntityGender(entity.id);
  const actorPronouns = this.#getPronounSet(actorGender);

  // Group activities intelligently
  const groups = this.#groupActivities(activities);

  // Format each group
  const descriptions = this.#formatActivityGroups(groups, actorName, actorPronouns);

  const prefix = config.prefix || 'Activity: ';
  const suffix = config.suffix || '';
  const separator = config.separator || '. ';

  const activityText = descriptions.join(separator);
  return `${prefix}${activityText}${suffix}`;
}
```

## Example Transformations

### Phase 1 (No Grouping)
```
"Activity: Jon is kneeling before Alicia. Jon is holding hands with Alicia"
```

### Phase 2 (With Grouping + Pronouns)
```
"Activity: Jon is kneeling before Alicia and holding her hands"
```

### Multiple Targets
```
Phase 1: "Jon is embracing Alicia. Jon is whispering to Alicia. Jon is waving at Bobby"
Phase 2: "Jon is embracing Alicia and whispering to her. He is waving at Bobby"
```

### Simultaneous Activities
```
Phase 1: "Jon is kneeling before Alicia. Jon is looking at Alicia"
Phase 2: "Jon is kneeling before Alicia while looking at her"
```

## Acceptance Criteria
- [ ] Activities with same target grouped together
- [ ] Related activities (metadata.grouping) grouped
- [ ] Appropriate conjunctions used ("and" vs "while")
- [ ] Different targets create separate groups
- [ ] Pronouns work correctly in grouped phrases
- [ ] Verb phrases extracted correctly for secondary activities
- [ ] Configuration respected
- [ ] Tests verify grouping logic
- [ ] Natural-sounding output

## Dependencies
- **Requires**: ACTDESC-014 (Pronoun resolution)
- **Requires**: ACTDESC-008 (Basic phrase generation)
- **Blocks**: ACTDESC-016 (Context-aware composition needs grouping)

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Smart Grouping', () => {
  it('should group activities with same target using "and"', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is kneeling before {target}', 'alicia', 75);
    addActivity(jon, '{actor} is holding hands with {target}', 'alicia', 80);

    const description = await service.generateActivityDescription('jon');

    expect(description).toMatch(/kneeling before.*and holding/);
    expect(description).not.toMatch(/\./); // Single sentence
  });

  it('should use "while" for simultaneous activities', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is kneeling', 'alicia', 75);
    addActivity(jon, '{actor} is looking at {target}', 'alicia', 78); // Close priority

    const description = await service.generateActivityDescription('jon');

    expect(description).toMatch(/while/);
  });

  it('should separate activities with different targets', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is embracing {target}', 'alicia', 80);
    addActivity(jon, '{actor} is waving at {target}', 'bobby', 70);

    const description = await service.generateActivityDescription('jon');

    expect(description).toMatch(/\./); // Two sentences
    expect(description).toMatch(/embracing.*bobby/i);
  });

  it('should group by explicit grouping metadata', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is hugging {target}', 'alicia', 80, {
      grouping: { groupKey: 'intimate_contact' },
    });
    addActivity(jon, '{actor} is kissing {target}', 'bobby', 75, {
      grouping: { groupKey: 'intimate_contact' },
    });

    const description = await service.generateActivityDescription('jon');

    // Should group even with different targets because of groupKey
    expect(description).toMatch(/and/);
  });

  it('should extract verb phrases correctly for grouped activities', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is kneeling before {target}', 'alicia', 75);
    addActivity(jon, '{actor} is holding hands with {target}', 'alicia', 80);

    const description = await service.generateActivityDescription('jon');

    // Should be "kneeling before Alicia and holding her hands"
    // NOT "kneeling before Alicia and is holding her hands"
    expect(description).not.toMatch(/and is holding/);
    expect(description).toMatch(/and holding/);
  });

  it('should handle three grouped activities', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is kneeling', 'alicia', 75);
    addActivity(jon, '{actor} is holding hands with {target}', 'alicia', 80);
    addActivity(jon, '{actor} is gazing at {target}', 'alicia', 82);

    const description = await service.generateActivityDescription('jon');

    expect(description).toMatch(/and.*and/); // Two "and" conjunctions
  });
});
```

## Implementation Notes
1. **Verb Extraction**: Remove actor pronoun and "is" from secondary phrases
2. **Conjunction Logic**: "while" for simultaneous (Δpriority ≤ 10), "and" otherwise
3. **Grouping Limits**: Consider max 3-4 activities per group for readability
4. **Configuration**: Add `maxActivitiesPerGroup` to config if needed
5. **Fallback**: If grouping fails, revert to separate sentences

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1808-1875)

## Success Metrics
- Natural-sounding grouped descriptions
- Correct conjunction usage
- Proper target-based grouping
- Tests verify grouping scenarios
- Backward compatibility maintained

## Related Tickets
- **Requires**: ACTDESC-014 (Pronouns), ACTDESC-008 (Phrases)
- **Blocks**: ACTDESC-016 (Context-aware composition)
- **Enhances**: Natural language quality significantly

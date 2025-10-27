# ACTDESC-015: Implement Smart Activity Grouping

## Status
🟡 **Pending**

## Phase
**Phase 5: Natural Language Enhancements** (Week 3)

## Description
Implement intelligent activity grouping to combine related activities with conjunctions ("and", "while") instead of separate sentences, creating more fluent natural language.

## Background
Phase 1 creates separate sentences for each activity. In the current implementation (`src/anatomy/services/activityDescriptionService.js`) the private `#formatActivityDescription` method simply iterates over the limited activities, calls `#generateActivityPhrase` for each one, and joins the resulting sentences using the configured separator from `AnatomyFormattingService.getActivityIntegrationConfig()` (default `. `).

This produces grammatically correct but repetitive text such as "Activity: Jon is kneeling before Alicia. He is holding her hands" when pronoun support is enabled. Smart grouping should build on that implementation to merge related activities into a single fluent sentence (for example, "Activity: Jon is kneeling before Alicia and holding her hands") without regressing the existing configuration and pronoun handling.

**Reference**: Design document lines 1808-1875 (Smart Activity Composition Algorithm)

## Technical Specification

### Grouping Strategy
`ActivityDescriptionService` does not currently expose any grouping helpers, so this enhancement needs to introduce new private utilities that operate on the prioritised `activities` array passed into `#formatActivityDescription`.

```javascript
/**
 * Group activities intelligently for natural composition.
 *
 * Grouping rules (in priority order):
 * 1. Explicit grouping metadata (matching `grouping.groupKey`) keeps activities together even if the targets differ.
 * 2. Same resolved target entity (`targetEntityId` or legacy `targetId`) groups the activities.
 * 3. Otherwise, start a new sentence.
 *
 * @param {Array<object>} activities - Activities sorted by priority
 * @returns {Array<ActivityGroup>} Grouped activities
 * @private
 */
#groupActivities(activities) {
  const groups = [];
  let currentGroup = null;

  for (const activity of activities) {
    if (!currentGroup) {
      currentGroup = this.#startActivityGroup(activity);
      continue;
    }

    if (this.#shouldGroupActivities(currentGroup.primaryActivity, activity)) {
      currentGroup.relatedActivities.push({
        activity,
        conjunction: this.#determineConjunction(
          currentGroup.primaryActivity,
          activity
        ),
      });
      continue;
    }

    groups.push(currentGroup);
    currentGroup = this.#startActivityGroup(activity);
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

#startActivityGroup(activity) {
  return {
    primaryActivity: activity,
    relatedActivities: [],
  };
}

/**
 * Determine if two activities should live in the same group.
 *
 * @param {object} first - Primary activity in the current group
 * @param {object} second - Candidate activity
 * @returns {boolean}
 * @private
 */
#shouldGroupActivities(first, second) {
  const firstGroupKey = first.grouping?.groupKey;
  const secondGroupKey = second.grouping?.groupKey;

  if (firstGroupKey && firstGroupKey === secondGroupKey) {
    return true;
  }

  const firstTarget = first.targetEntityId ?? first.targetId;
  const secondTarget = second.targetEntityId ?? second.targetId;

  if (firstTarget && firstTarget === secondTarget) {
    return true;
  }

  return false;
}

/**
 * Determine the conjunction connecting two activities.
 *
 * @param {object} first - Primary activity
 * @param {object} second - Related activity
 * @returns {string}
 * @private
 */
#determineConjunction(first, second) {
  const firstPriority = first.priority ?? 0;
  const secondPriority = second.priority ?? 0;

  return Math.abs(firstPriority - secondPriority) <= 10 ? 'while' : 'and';
}
```

### Enhanced Formatting with Groups
`#formatActivityDescription` already resolves the actor name, gender, and pronoun set, enforces the `maxActivities` limit from configuration, and then formats each activity individually. Introduce grouping *after* the slice to `maxActivities` but *before* the existing formatting loop so the surrounding logic stays intact.

```javascript
/**
 * Format activity groups into natural language.
 *
 * @param {Array<ActivityGroup>} groups - Activity groups
 * @param {string} actorName - Actor name resolved via #resolveEntityName
 * @param {object} actorPronouns - Pronoun set returned by #getPronounSet
 * @param {object} config - Activity integration config
 * @returns {Array<string>} Formatted group descriptions
 * @private
 */
#formatActivityGroups(groups, actorName, actorPronouns, config) {
  const usePronoun = config.nameResolution?.usePronounsWhenAvailable;

  return groups
    .map((group, index) => {
      const useActorPronoun = index > 0 && usePronoun;
      const actorRef = useActorPronoun ? actorPronouns.subject : actorName;

      const { fullPhrase: primaryPhrase } = this.#generateActivityPhrase(
        actorRef,
        group.primaryActivity,
        useActorPronoun
      );

      if (!primaryPhrase) {
        return '';
      }

      let description = primaryPhrase;

      for (const related of group.relatedActivities) {
        const { verbPhrase } = this.#generateActivityPhrase(
          actorPronouns.subject,
          related.activity,
          usePronoun,
          { omitActor: true }
        );

        if (!verbPhrase) {
          continue;
        }

        description += ` ${related.conjunction} ${verbPhrase}`;
      }

      return description;
    })
    .filter(Boolean);
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
  const config =
    this.#anatomyFormattingService.getActivityIntegrationConfig?.() ?? {};

  if (activities.length === 0) {
    return '';
  }

  const actorId = entity?.id;
  const actorName = this.#resolveEntityName(actorId);
  const actorGender = this.#detectEntityGender(actorId);
  const actorPronouns = this.#getPronounSet(actorGender);

  const maxActivities = config.maxActivities ?? 10;
  const limitedActivities = activities.slice(0, maxActivities);

  const groups = this.#groupActivities(limitedActivities);
  const descriptions = this.#formatActivityGroups(
    groups,
    actorName,
    actorPronouns,
    config
  );

  if (descriptions.length === 0) {
    return '';
  }

  const prefix = config.prefix ?? '';
  const suffix = config.suffix ?? '';
  const separator = config.separator ?? '. ';

  const activityText = descriptions.join(separator);
  return `${prefix}${activityText}${suffix}`.trim();
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
- [ ] Activities that share a resolved target (`targetEntityId` / `targetId`) group into a single sentence using "and" by default
- [ ] Explicit grouping metadata (`grouping.groupKey`) groups activities even when targets differ
- [ ] Conjunction choice honours the ±10 priority threshold ("while" for simultaneous, otherwise "and")
- [ ] Activities without grouping alignment stay in separate sentences
- [ ] Pronoun configuration continues to apply for subsequent sentences and grouped verb phrases
- [ ] Secondary phrases drop duplicate actor/pronoun text (no "and is holding" artifacts)
- [ ] Config-driven limits (`maxActivities`, prefix/suffix/separator) still respected
- [ ] Unit tests cover grouping, conjunction selection, metadata overrides, and fallbacks
- [ ] Output remains natural and backwards-compatible when grouping is not possible

## Dependencies
- **Requires**: ACTDESC-014 (Pronoun resolution)
- **Requires**: ACTDESC-008 (Basic phrase generation)
- **Blocks**: ACTDESC-016 (Context-aware composition needs grouping)

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Smart Grouping', () => {
  const createEntityWithGender = (id, name, gender) => ({
    id,
    componentTypeIds: ['core:name', 'core:gender'],
    getComponentData: jest.fn((componentId) => {
      if (componentId === 'core:name') {
        return { text: name };
      }
      if (componentId === 'core:gender') {
        return { value: gender };
      }
      return undefined;
    }),
  });

  const createInlineActivity = (
    template,
    targetId,
    priority,
    overrides = {}
  ) => ({
    type: 'inline',
    template,
    priority,
    targetEntityId: targetId,
    ...overrides,
  });

  const createDedicatedActivity = (
    verb,
    targetId,
    priority,
    groupKey = null,
    overrides = {}
  ) => ({
    type: 'dedicated',
    verb,
    priority,
    targetEntityId: targetId,
    grouping: groupKey ? { groupKey } : undefined,
    ...overrides,
  });

  beforeEach(() => {
    mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
      prefix: 'Activity: ',
      suffix: '',
      separator: '. ',
      nameResolution: { usePronounsWhenAvailable: true },
      maxActivities: 5,
    });

    mockEntityManager.getEntityInstance.mockImplementation((id) =>
      createEntityWithGender(id, `${id} Name`, id === 'jon' ? 'male' : 'female')
    );
  });

  it('groups activities with the same target using "and"', async () => {
    mockActivityIndex.findActivitiesForEntity.mockReturnValue([
      createInlineActivity('{actor} is kneeling before {target}', 'alicia', 80),
      createInlineActivity('{actor} is holding hands with {target}', 'alicia', 70),
    ]);

    const description = await service.generateActivityDescription('jon');

    expect(description).toBe('Activity: Jon Name is kneeling before Alicia Name and holding her hands');
  });

  it('uses "while" when priorities are within the simultaneous threshold', async () => {
    mockActivityIndex.findActivitiesForEntity.mockReturnValue([
      createInlineActivity('{actor} is kneeling', 'alicia', 80),
      createInlineActivity('{actor} is looking at {target}', 'alicia', 75),
    ]);

    const description = await service.generateActivityDescription('jon');

    expect(description).toContain('while');
  });

  it('keeps separate sentences when targets differ and no grouping metadata matches', async () => {
    mockActivityIndex.findActivitiesForEntity.mockReturnValue([
      createInlineActivity('{actor} is embracing {target}', 'alicia', 80),
      createInlineActivity('{actor} is waving at {target}', 'bobby', 70),
    ]);

    const description = await service.generateActivityDescription('jon');

    expect(description.split('. ').length).toBeGreaterThan(1);
  });

  it('allows grouping via explicit grouping metadata even when targets differ', async () => {
    mockActivityIndex.findActivitiesForEntity.mockReturnValue([
      createDedicatedActivity('hugging', 'alicia', 80, 'intimate_contact'),
      createDedicatedActivity('kissing', 'bobby', 75, 'intimate_contact'),
    ]);

    const description = await service.generateActivityDescription('jon');

    expect(description).toContain('and');
    expect(description.split('. ').length).toBe(1);
  });

  it('omits duplicate "is" in grouped verb phrases', async () => {
    mockActivityIndex.findActivitiesForEntity.mockReturnValue([
      createInlineActivity('{actor} is kneeling before {target}', 'alicia', 80),
      createInlineActivity('{actor} is holding hands with {target}', 'alicia', 70),
    ]);

    const description = await service.generateActivityDescription('jon');

    expect(description).not.toMatch(/and is holding/);
    expect(description).toContain('and holding');
  });
});
```

## Implementation Notes
1. **Verb Extraction**: Extend `#generateActivityPhrase` so it can return both a `fullPhrase` (current behaviour) and a `verbPhrase` without the actor/copula when `omitActor` is requested. Keep existing call sites working without changes.
2. **Conjunction Logic**: Use a shared helper for the ±10 priority threshold so tests can cover both "and" and "while" paths.
3. **Grouping Limits**: Honour existing `maxActivities` trimming before grouping; consider introducing an optional `maxActivitiesPerGroup` config value if readability becomes an issue, but default to unlimited grouping for now.
4. **Configuration**: Respect prefix/suffix/separator from `AnatomyFormattingService.getActivityIntegrationConfig()` and reuse the optional chaining already present in the service.
5. **Fallback**: If grouping yields no phrases (for example, all related phrases were empty), fall back to the pre-grouping behaviour by returning an empty string so upstream code continues gracefully.

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

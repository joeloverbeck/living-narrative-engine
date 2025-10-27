# ACTDESC-016: Implement Context-Aware Composition

## Status
🟡 **Pending**

## Phase
**Phase 5: Natural Language Enhancements** (Week 3)

## Description
Implement context-aware description composition that adapts language based on activity context, entity states, and relationship metadata to produce more natural and contextually appropriate descriptions.

## Background
Beyond simple grouping, context-aware composition adjusts language based on what's actually happening, who's involved, and the nature of their relationship.

**Reference**: Design document lines 1876-1911 (Context-Aware Enhancements)

## Technical Specification

### Context Utilities
```javascript
/**
 * Build lightweight context for an activity based on available component data.
 *
 * @param {string} actorId - Actor entity ID.
 * @param {object} activity - Activity metadata collected by the service.
 * @returns {object} Normalised context payload.
 * @private
 */
#buildActivityContext(actorId, activity) {
  const targetId = activity?.targetEntityId ?? activity?.targetId ?? null;

  const context = {
    targetId,
    intensity: this.#determineActivityIntensity(activity?.priority),
    relationshipTone: 'neutral',
    targetGender: null,
  };

  if (!targetId) {
    return context;
  }

  const actorEntity = this.#entityManager.getEntityInstance(actorId);

  context.targetGender = this.#detectEntityGender(targetId);

  const closenessData = actorEntity?.getComponentData?.('positioning:closeness');
  if (Array.isArray(closenessData?.partners) && closenessData.partners.includes(targetId)) {
    context.relationshipTone = 'closeness_partner';
  }

  // Future tickets can extend this with additional component lookups (e.g. dedicated relationship mods).
  return context;
}

/**
 * Map activity priority onto an intensity bucket.
 *
 * @param {number} [priority=0] - Activity priority score.
 * @returns {string} Intensity level identifier.
 * @private
 */
#determineActivityIntensity(priority = 0) {
  if (priority >= 90) return 'intense';
  if (priority >= 70) return 'elevated';
  return 'casual';
}
```

### Contextual Adjustments
```javascript
/**
 * Apply contextual tone adjustments to an activity payload before rendering.
 *
 * @param {object} activity - Original activity metadata.
 * @param {object} context - Context payload from #buildActivityContext.
 * @returns {object} Activity metadata with contextual overrides.
 * @private
 */
#applyContextualTone(activity, context) {
  const adjusted = { ...activity };

  // Relationship-driven tone tweaks based on the closeness circle.
  if (context.relationshipTone === 'closeness_partner') {
    adjusted.contextualTone = 'intimate';

    if (typeof adjusted.adverb === 'string') {
      adjusted.adverb = this.#mergeAdverb(adjusted.adverb, 'tenderly');
    } else if (adjusted.type === 'dedicated') {
      adjusted.adverb = 'tenderly';
    }

    if (typeof adjusted.template === 'string') {
      adjusted.template = this.#injectSoftener(adjusted.template, 'tenderly');
    }
  }

  // Priority-driven tone tweaks.
  if (context.intensity === 'intense') {
    adjusted.contextualTone = 'intense';

    if (typeof adjusted.adverb === 'string') {
      adjusted.adverb = this.#mergeAdverb(adjusted.adverb, 'fiercely');
    } else if (adjusted.type === 'dedicated') {
      adjusted.adverb = 'fiercely';
    }

    if (typeof adjusted.template === 'string') {
      adjusted.template = this.#injectSoftener(adjusted.template, 'fiercely');
    }
  }

  return adjusted;
}
```

### Formatting Integration
```javascript
/**
 * Format activities with context awareness.
 *
 * @param {Array<object>} activities - Sorted activities.
 * @param {object} entity - Actor entity instance.
 * @returns {string} Formatted description string.
 * @private
 */
#formatActivityDescription(activities, entity) {
  if (!activities.length) {
    return '';
  }

  const config =
    this.#anatomyFormattingService.getActivityIntegrationConfig?.() ?? {};
  const actorId = entity?.id;
  const actorName = this.#resolveEntityName(actorId);
  const actorGender = this.#detectEntityGender(actorId);
  const actorPronouns = this.#getPronounSet(actorGender);
  const pronounsEnabled =
    config.nameResolution?.usePronounsWhenAvailable === true;

  const groups = this.#groupActivities(activities);
  const descriptions = [];

  groups.forEach((group, index) => {
    const isFirstGroup = index === 0;
    const useActorPronounForPrimary = !isFirstGroup && pronounsEnabled;
    const actorReference = useActorPronounForPrimary
      ? actorPronouns.subject
      : actorName;

    const context = this.#buildActivityContext(actorId, group.primaryActivity);
    const contextualPrimary = this.#applyContextualTone(
      group.primaryActivity,
      context
    );

    const primaryResult = this.#generateActivityPhrase(
      actorReference,
      contextualPrimary,
      context.targetId ? pronounsEnabled : false
    );

    const primaryPhrase =
      typeof primaryResult === 'string'
        ? primaryResult
        : primaryResult?.fullPhrase ?? '';

    if (!primaryPhrase.trim()) {
      return;
    }

    let groupDescription = primaryPhrase.trim();

    for (const related of group.relatedActivities) {
      const relatedContext = this.#buildActivityContext(
        actorId,
        related.activity
      );
      const contextualRelated = this.#applyContextualTone(
        related.activity,
        relatedContext
      );

      const phraseComponents = this.#generateActivityPhrase(
        actorReference,
        contextualRelated,
        pronounsEnabled,
        { omitActor: true }
      );

      const fragment = this.#buildRelatedActivityFragment(
        related.conjunction,
        phraseComponents,
        {
          actorName,
          actorReference,
          actorPronouns,
          pronounsEnabled,
        }
      );

      if (fragment) {
        groupDescription = `${groupDescription} ${fragment}`.trim();
      }
    }

    if (groupDescription) {
      descriptions.push(groupDescription);
    }
  });

  if (!descriptions.length) {
    return '';
  }

  const prefix = config.prefix ?? '';
  const suffix = config.suffix ?? '';
  const separator = config.separator ?? '. ';

  const activityText = descriptions.join(separator);
  return `${prefix}${activityText}${suffix}`.trim();
}
```

### Tone Helpers
```javascript
/**
 * Append a contextual adverb without duplicating descriptors.
 *
 * @param {string} currentAdverb - Existing adverb text.
 * @param {string} injected - Contextual adverb to merge.
 * @returns {string} Combined adverb string.
 * @private
 */
#mergeAdverb(currentAdverb, injected) {
  if (!injected) {
    return currentAdverb;
  }

  if (!currentAdverb) {
    return injected;
  }

  const normalised = currentAdverb.trim();
  if (!normalised.length) {
    return injected;
  }

  const lower = normalised.toLowerCase();
  if (lower.includes(injected.toLowerCase())) {
    return normalised;
  }

  return `${normalised} ${injected}`.trim();
}

/**
 * Inject contextual descriptors into templates that reference {target}.
 *
 * @param {string} template - Activity template string.
 * @param {string} descriptor - Descriptor to inject (e.g. 'tenderly').
 * @returns {string} Updated template string.
 * @private
 */
#injectSoftener(template, descriptor) {
  if (!descriptor || typeof template !== 'string') {
    return template;
  }

  if (!template.includes('{target}')) {
    return template;
  }

  return template.replace('{target}', `${descriptor} {target}`);
}
```

## Acceptance Criteria
- [ ] Closeness circle data detected via `positioning:closeness`
- [ ] Activity intensity buckets derived from priority scores
- [ ] Contextual tone applied without requiring relationship tracker services
- [ ] Grouped activities share consistent contextual tone and pronoun logic
- [ ] Missing target/context falls back to neutral phrasing
- [ ] Formatting configuration options (`prefix`, `separator`, pronouns) still honoured
- [ ] Unit tests cover closeness tone, intensity adjustments, and grouping behaviour
- [ ] Language adjustments remain natural (no duplicated descriptors)

## Dependencies
- **Requires**: ACTDESC-015 (Grouping), ACTDESC-014 (Pronouns)
- **Blocks**: Phase 6 advanced features
- **Enhances**: Natural language quality

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Context Awareness', () => {
  it('uses closeness partners to soften phrasing', async () => {
    const jon = createEntity('jon', 'male');
    const alicia = createEntity('alicia', 'female');

    addComponent(jon, 'positioning:closeness', { partners: ['alicia'] });
    addComponent(alicia, 'positioning:closeness', { partners: ['jon'] });

    addActivity(jon, '{actor} is holding hands with {target}', 'alicia', 80);

    const description = await service.generateActivityDescription('jon');

    expect(description).toMatch(/tenderly/);
  });

  it('falls back to neutral tone when no context exists', async () => {
    const jon = createEntity('jon', 'male');
    const stranger = createEntity('stranger', 'neutral');

    addActivity(jon, '{actor} is waving at {target}', 'stranger', 60);

    const description = await service.generateActivityDescription('jon');

    expect(description).not.toMatch(/tenderly|fiercely/);
  });

  it('intensifies language for high-priority activities', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is embracing {target}', 'alicia', 95);

    const description = await service.generateActivityDescription('jon');

    expect(description).toMatch(/fiercely/);
  });

  it('maps priority to intensity buckets', () => {
    expect(service['#determineActivityIntensity'](95)).toBe('intense');
    expect(service['#determineActivityIntensity'](75)).toBe('elevated');
    expect(service['#determineActivityIntensity'](40)).toBe('casual');
  });

  it('does not duplicate descriptors when merging adverbs', () => {
    const merged = service['#mergeAdverb']('gently', 'gently');
    expect(merged).toBe('gently');
  });
});
```

## Implementation Notes
1. **Context Priority**: Closeness tone > Intensity > Neutral fallback
2. **Performance**: Cache closeness lookups to avoid repeated component fetches
3. **Graceful Degradation**: Missing context should return untouched descriptions
4. **Configurability**: Add `enableContextAwareness` config flag under `activityIntegration`
5. **Extensibility**: Design helpers to support future context types (location, mood, time of day)

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1876-1911)

## Success Metrics
- Contextually appropriate language using available component data
- Closeness sensitivity without relying on external trackers
- Intensity wording matches priority tiers
- Natural adjustments (no awkward repetitions or grammar issues)
- Tests verify context detection and application

## Related Tickets
- **Requires**: ACTDESC-014, ACTDESC-015
- **Enhances**: Natural language composition significantly
- **Enables**: Phase 6 advanced features

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

### Context Detection Methods
```javascript
/**
 * Detect relationship context between entities.
 *
 * @param {string} actorId - Actor entity ID
 * @param {string} targetId - Target entity ID
 * @returns {object} Relationship context
 * @private
 */
#getRelationshipContext(actorId, targetId) {
  const actorEntity = this.#entityManager.getEntityInstance(actorId);
  if (!actorEntity) {
    return { type: 'unknown', intimacy: 0 };
  }

  // Check for explicit relationship components
  const relationshipComponents = [
    'relationships:partner',
    'relationships:family',
    'relationships:friend',
    'relationships:acquaintance',
  ];

  for (const compType of relationshipComponents) {
    const comp = actorEntity.getComponentData(compType);
    if (comp?.entityId === targetId || comp?.targetId === targetId) {
      return {
        type: compType.split(':')[1],
        intimacy: comp.intimacyLevel || 50,
      };
    }
  }

  return { type: 'stranger', intimacy: 0 };
}

/**
 * Detect activity intensity/nature.
 *
 * @param {object} activity - Activity object
 * @returns {string} Intensity: 'casual', 'moderate', 'intense'
 * @private
 */
#getActivityIntensity(activity) {
  // Priority-based intensity
  if (activity.priority >= 90) return 'intense';
  if (activity.priority >= 70) return 'moderate';
  return 'casual';
}
```

### Enhanced Template Resolution with Context
```javascript
/**
 * Resolve template with context-aware adjustments.
 *
 * @param {string} template - Base template
 * @param {object} context - Activity context
 * @returns {string} Context-aware template
 * @private
 */
#applyContextToTemplate(template, context) {
  const { relationship, intensity, actorGender, targetGender } = context;

  // Adjust language based on relationship intimacy
  if (relationship.intimacy > 75) {
    // More intimate language for close relationships
    template = template
      .replace('holding hands with', 'holding hands tenderly with')
      .replace('looking at', 'gazing lovingly at');
  }

  // Adjust based on intensity
  if (intensity === 'intense') {
    template = template
      .replace('embracing', 'clinging to')
      .replace('kissing', 'passionately kissing');
  }

  return template;
}
```

### Context-Aware Formatting
```javascript
/**
 * Format activities with context awareness.
 *
 * @param {Array<object>} activities - Sorted activities
 * @param {object} entity - Entity instance
 * @returns {string} Context-aware description
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

  // Group activities
  const groups = this.#groupActivities(activities);

  // Format each group with context
  const descriptions = groups.map((group, index) => {
    const actorRef = index === 0 ? actorName : (
      config.nameResolution?.usePronounsWhenAvailable
        ? actorPronouns.subject
        : actorName
    );

    // Gather context for primary activity
    const context = this.#gatherActivityContext(entity.id, group.primaryActivity);

    // Format with context
    return this.#formatGroupWithContext(actorRef, group, context);
  });

  const prefix = config.prefix || 'Activity: ';
  const suffix = config.suffix || '';
  const separator = config.separator || '. ';

  const activityText = descriptions.join(separator);
  return `${prefix}${activityText}${suffix}`;
}

/**
 * Gather comprehensive context for activity.
 *
 * @param {string} actorId - Actor ID
 * @param {object} activity - Activity object
 * @returns {object} Activity context
 * @private
 */
#gatherActivityContext(actorId, activity) {
  const context = {
    actorGender: this.#detectEntityGender(actorId),
    intensity: this.#getActivityIntensity(activity),
    relationship: null,
    targetGender: null,
  };

  if (activity.targetEntityId) {
    context.relationship = this.#getRelationshipContext(actorId, activity.targetEntityId);
    context.targetGender = this.#detectEntityGender(activity.targetEntityId);
  }

  return context;
}

/**
 * Format activity group with context awareness.
 *
 * @param {string} actorRef - Actor reference
 * @param {object} group - Activity group
 * @param {object} context - Context object
 * @returns {string} Formatted description
 * @private
 */
#formatGroupWithContext(actorRef, group, context) {
  let template = group.primaryActivity.template || this.#constructTemplateFromVerb(group.primaryActivity);

  // Apply context adjustments to template
  template = this.#applyContextToTemplate(template, context);

  // Generate primary phrase
  let description = this.#generateActivityPhrase(actorRef, {
    ...group.primaryActivity,
    template,
  }, context.targetGender !== null);

  // Add related activities with context-aware conjunctions
  for (const related of group.relatedActivities) {
    const relatedContext = this.#gatherActivityContext(actorRef, related.activity);
    const relatedTemplate = this.#applyContextToTemplate(
      related.activity.template || this.#constructTemplateFromVerb(related.activity),
      relatedContext
    );

    const verbPhrase = this.#extractVerbPhrase(relatedTemplate, context);
    description += ` ${related.conjunction} ${verbPhrase}`;
  }

  return description;
}

/**
 * Construct template from verb (for dedicated metadata).
 *
 * @param {object} activity - Activity object
 * @returns {string} Constructed template
 * @private
 */
#constructTemplateFromVerb(activity) {
  const verb = activity.verb || 'interacting with';
  const adverb = activity.adverb ? ` ${activity.adverb}` : '';

  if (activity.targetEntityId) {
    return `{actor} is ${verb} {target}${adverb}`;
  } else {
    return `{actor} is ${verb}${adverb}`;
  }
}
```

## Acceptance Criteria
- [ ] Relationship context detected from components
- [ ] Activity intensity determined from priority
- [ ] Templates adjusted based on relationship intimacy
- [ ] Language intensity reflects activity priority
- [ ] Context preserved across grouped activities
- [ ] Graceful fallback for missing context
- [ ] Configuration flags respected
- [ ] Tests verify context awareness
- [ ] Natural contextual adjustments

## Dependencies
- **Requires**: ACTDESC-015 (Grouping), ACTDESC-014 (Pronouns)
- **Blocks**: Phase 6 advanced features
- **Enhances**: Natural language quality

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Context Awareness', () => {
  it('should adjust language for intimate relationships', async () => {
    const jon = createEntity('jon', 'male');
    const alicia = createEntity('alicia', 'female');

    // Add partner relationship
    addComponent(jon, 'relationships:partner', {
      entityId: 'alicia',
      intimacyLevel: 90,
    });

    addActivity(jon, '{actor} is holding hands with {target}', 'alicia', 80);

    const description = await service.generateActivityDescription('jon');

    // Should use more intimate language
    expect(description).toMatch(/tenderly/);
  });

  it('should use casual language for strangers', async () => {
    const jon = createEntity('jon', 'male');
    const stranger = createEntity('stranger', 'neutral');

    // No relationship component (strangers)
    addActivity(jon, '{actor} is waving at {target}', 'stranger', 60);

    const description = await service.generateActivityDescription('jon');

    // Should use casual language
    expect(description).not.toMatch(/tenderly|lovingly/);
  });

  it('should intensify language for high-priority activities', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is embracing {target}', 'alicia', 95); // Very high priority

    const description = await service.generateActivityDescription('jon');

    // Should use intense language
    expect(description).toMatch(/clinging|passionately/);
  });

  it('should detect relationship type from components', () => {
    const jon = createEntity('jon', 'male');
    addComponent(jon, 'relationships:partner', {
      entityId: 'alicia',
      intimacyLevel: 80,
    });

    const context = service['#getRelationshipContext']('jon', 'alicia');

    expect(context.type).toBe('partner');
    expect(context.intimacy).toBe(80);
  });

  it('should determine activity intensity from priority', () => {
    const intenseActivity = { priority: 95 };
    const moderateActivity = { priority: 75 };
    const casualActivity = { priority: 50 };

    expect(service['#getActivityIntensity'](intenseActivity)).toBe('intense');
    expect(service['#getActivityIntensity'](moderateActivity)).toBe('moderate');
    expect(service['#getActivityIntensity'](casualActivity)).toBe('casual');
  });

  it('should apply context adjustments to templates', () => {
    const context = {
      relationship: { intimacy: 85, type: 'partner' },
      intensity: 'intense',
    };

    const template = '{actor} is kissing {target}';
    const adjusted = service['#applyContextToTemplate'](template, context);

    expect(adjusted).toMatch(/passionately/);
  });
});
```

## Implementation Notes
1. **Context Priority**: Relationship > Intensity > Default
2. **Performance**: Cache relationship contexts
3. **Graceful Degradation**: Missing context shouldn't break descriptions
4. **Configurability**: Add `enableContextAwareness` config flag
5. **Extensibility**: Design for future context types (location, time, mood)

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1876-1911)

## Success Metrics
- Contextually appropriate language
- Relationship sensitivity
- Intensity matching
- Natural adjustments
- Tests verify context detection and application

## Related Tickets
- **Requires**: ACTDESC-014, ACTDESC-015
- **Enhances**: Natural language composition significantly
- **Enables**: Phase 6 advanced features

# ACTDESC-014: Implement Pronoun Resolution System

## Status
🟡 **Pending**

## Phase
**Phase 5: Natural Language Enhancements** (Week 3)

## Description
Implement intelligent pronoun resolution to replace repeated entity names with appropriate pronouns (he/she/they/it) based on gender context, creating more natural-sounding activity descriptions.

## Background
Phase 1 uses simple name repetition ("Jon is kneeling before Alicia. Jon is holding hands with Alicia"). Pronoun resolution makes this more natural ("Jon is kneeling before Alicia and holding her hands").

**Reference**: Design document lines 1741-1790 (Pronoun Resolution, Phase 2 Natural Language)

## Objectives
- Detect appropriate pronouns based on entity gender
- Replace actor names with pronouns in subsequent phrases
- Replace target names with possessive/objective pronouns
- Respect configuration flags for pronoun usage
- Handle pronoun ambiguity gracefully

## Technical Specification

### Configuration Addition
```javascript
// In AnatomyFormattingService
getActivityIntegrationConfig() {
  return {
    // ... existing config
    nameResolution: {
      usePronounsWhenAvailable: true,  // ← NEW
      fallbackToNames: true,            // ← NEW
      respectGenderComponents: true,    // ← NEW
    },
  };
}
```

### Gender Detection Method
```javascript
/**
 * Detect entity gender for pronoun resolution.
 *
 * @param {string} entityId - Entity ID
 * @returns {string} Gender: 'male', 'female', 'neutral', or 'unknown'
 * @private
 */
#detectEntityGender(entityId) {
  const entity = this.#entityManager.getEntityInstance(entityId);
  if (!entity) {
    return 'unknown';
  }

  // Check for explicit gender component
  const genderComponent = entity.getComponentData('character:gender');
  if (genderComponent?.value) {
    return genderComponent.value; // 'male', 'female', 'neutral'
  }

  // Check anatomy:body for gender markers
  const bodyComponent = entity.getComponentData('anatomy:body');
  if (bodyComponent?.sex) {
    return bodyComponent.sex; // 'male', 'female'
  }

  // Default to neutral pronouns if unknown
  return 'neutral';
}
```

### Pronoun Mapping
```javascript
/**
 * Get pronouns for entity based on gender.
 *
 * @param {string} gender - Gender value
 * @returns {object} Pronoun set
 * @private
 */
#getPronounSet(gender) {
  const pronounSets = {
    male: {
      subject: 'he',
      object: 'him',
      possessive: 'his',
      possessivePronoun: 'his',
    },
    female: {
      subject: 'she',
      object: 'her',
      possessive: 'her',
      possessivePronoun: 'hers',
    },
    neutral: {
      subject: 'they',
      object: 'them',
      possessive: 'their',
      possessivePronoun: 'theirs',
    },
    unknown: {
      subject: 'they',
      object: 'them',
      possessive: 'their',
      possessivePronoun: 'theirs',
    },
  };

  return pronounSets[gender] || pronounSets.neutral;
}
```

### Enhanced Phrase Generation
```javascript
/**
 * Format activities with pronoun resolution.
 * Phase 2: Smart pronoun usage
 *
 * @param {Array<object>} activities - Sorted activity objects
 * @param {object} entity - Entity instance
 * @returns {string} Formatted description with pronouns
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

  const descriptions = [];
  let usedActorName = false;

  for (const activity of activities) {
    // First activity: use full name
    if (!usedActorName) {
      descriptions.push(this.#generateActivityPhrase(actorName, activity, false));
      usedActorName = true;
    } else if (config.nameResolution?.usePronounsWhenAvailable) {
      // Subsequent activities: use pronouns if enabled
      descriptions.push(
        this.#generateActivityPhrase(actorPronouns.subject, activity, true)
      );
    } else {
      // Fall back to names if pronouns disabled
      descriptions.push(this.#generateActivityPhrase(actorName, activity, false));
    }
  }

  const prefix = config.prefix || 'Activity: ';
  const suffix = config.suffix || '';
  const separator = config.separator || '. ';

  const activityText = descriptions.join(separator);
  return `${prefix}${activityText}${suffix}`;
}

/**
 * Generate a single activity phrase with optional pronoun usage.
 *
 * @param {string} actorRef - Actor name or pronoun
 * @param {object} activity - Activity object
 * @param {boolean} usePronounsForTarget - Whether to use pronouns for target
 * @returns {string} Activity phrase
 * @private
 */
#generateActivityPhrase(actorRef, activity, usePronounsForTarget = false) {
  let targetRef = '';

  if (activity.targetEntityId) {
    if (usePronounsForTarget) {
      const targetGender = this.#detectEntityGender(activity.targetEntityId);
      const targetPronouns = this.#getPronounSet(targetGender);
      targetRef = targetPronouns.object; // "him", "her", "them"
    } else {
      targetRef = this.#resolveEntityName(activity.targetEntityId);
    }
  }

  if (activity.type === 'inline') {
    return activity.template
      .replace('{actor}', actorRef)
      .replace('{target}', targetRef);
  } else {
    const verb = activity.verb || 'interacting with';
    const adverb = activity.adverb ? ` ${activity.adverb}` : '';

    if (targetRef) {
      return `${actorRef} is ${verb} ${targetRef}${adverb}`;
    } else {
      return `${actorRef} is ${verb}${adverb}`;
    }
  }
}
```

### Template Enhancement for Pronouns
```javascript
/**
 * Enhanced template replacement supporting pronoun placeholders.
 *
 * Templates can now use:
 * - {actor} → actor name or subject pronoun
 * - {target} → target name or object pronoun
 * - {target.possessive} → possessive form ("his", "her", "their")
 *
 * @param {string} template - Template string
 * @param {string} actorRef - Actor reference
 * @param {object} targetPronouns - Target pronoun set
 * @returns {string} Resolved template
 * @private
 */
#resolveTemplate(template, actorRef, targetPronouns) {
  return template
    .replace('{actor}', actorRef)
    .replace('{target.possessive}', targetPronouns.possessive)
    .replace('{target}', targetPronouns.object);
}
```

## Example Transformations

### Phase 1 (No Pronouns)
```
"Activity: Jon is kneeling before Alicia. Jon is holding hands with Alicia"
```

### Phase 2 (With Pronouns)
```
"Activity: Jon is kneeling before Alicia and holding her hands"
```

### Multiple Targets
```
Phase 1: "Jon is holding hands with Alicia. Jon is embracing Bobby"
Phase 2: "Jon is holding hands with Alicia and embracing him"
```

## Acceptance Criteria
- [ ] Gender detection implemented for entities
- [ ] Pronoun sets defined for male/female/neutral/unknown
- [ ] First activity uses full actor name
- [ ] Subsequent activities use subject pronouns ("he", "she", "they")
- [ ] Target entities use object pronouns ("him", "her", "them")
- [ ] Possessive pronouns available for templates
- [ ] Configuration flag respected (usePronounsWhenAvailable)
- [ ] Graceful fallback when pronouns unavailable
- [ ] Neutral pronouns for unknown gender
- [ ] Tests verify pronoun correctness

## Dependencies
- **Requires**: ACTDESC-008 (Basic phrase generation)
- **Requires**: ACTDESC-013 (Tests passing)
- **Blocks**: ACTDESC-015 (Smart grouping needs pronouns)

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Pronoun Resolution', () => {
  it('should use subject pronoun for actor in second activity', async () => {
    const jonEntity = createEntityWithGender('jon', 'male');
    addActivity(jonEntity, 'kneeling', 'alicia', 75);
    addActivity(jonEntity, 'holding hands', 'alicia', 85);

    const description = await service.generateActivityDescription('jon');

    // First activity: "Jon is..."
    // Second activity: "he is..."
    expect(description).toMatch(/Jon is.*he is/i);
  });

  it('should use object pronoun for target entity', async () => {
    const jonEntity = createEntityWithGender('jon', 'male');
    const aliciaEntity = createEntityWithGender('alicia', 'female');

    addActivity(jonEntity, '{actor} is kneeling before {target}', 'alicia', 75);
    addActivity(jonEntity, '{actor} is holding hands with {target}', 'alicia', 85);

    const description = await service.generateActivityDescription('jon');

    expect(description).toContain('her'); // "holding hands with her"
  });

  it('should use neutral pronouns for unknown gender', async () => {
    const entity = createEntityWithGender('entity', 'unknown');
    addActivity(entity, 'meditating', null, 50);
    addActivity(entity, 'standing', null, 60);

    const description = await service.generateActivityDescription('entity');

    expect(description).toMatch(/they/i);
  });

  it('should respect usePronounsWhenAvailable flag', async () => {
    config.nameResolution.usePronounsWhenAvailable = false;

    const jonEntity = createEntityWithGender('jon', 'male');
    addActivity(jonEntity, 'kneeling', 'alicia', 75);
    addActivity(jonEntity, 'holding hands', 'alicia', 85);

    const description = await service.generateActivityDescription('jon');

    // Should use names, not pronouns
    expect(description).not.toMatch(/\bhe\b/i);
    expect(description).toMatch(/Jon.*Jon/);
  });

  it('should handle possessive pronouns in templates', async () => {
    const jonEntity = createEntityWithGender('jon', 'male');
    const aliciaEntity = createEntityWithGender('alicia', 'female');

    addActivity(
      jonEntity,
      '{actor} touches {target.possessive} shoulder',
      'alicia',
      75
    );

    const description = await service.generateActivityDescription('jon');

    expect(description).toContain('her shoulder');
  });

  it('should detect gender from character:gender component', () => {
    const entity = createMockEntity({
      components: {
        'character:gender': { value: 'female' },
      },
    });

    const gender = service['#detectEntityGender'](entity.id);
    expect(gender).toBe('female');
  });

  it('should detect gender from anatomy:body component', () => {
    const entity = createMockEntity({
      components: {
        'anatomy:body': { sex: 'male' },
      },
    });

    const gender = service['#detectEntityGender'](entity.id);
    expect(gender).toBe('male');
  });

  it('should prioritize character:gender over anatomy:body', () => {
    const entity = createMockEntity({
      components: {
        'character:gender': { value: 'neutral' },
        'anatomy:body': { sex: 'male' },
      },
    });

    const gender = service['#detectEntityGender'](entity.id);
    expect(gender).toBe('neutral');
  });
});
```

## Implementation Notes
1. **Gender Priority**: character:gender > anatomy:body > neutral default
2. **Pronoun Safety**: Always default to neutral pronouns for unknown
3. **Template Compatibility**: Existing templates continue working
4. **Configuration**: Make pronoun usage opt-in via config flag
5. **Performance**: Cache gender detection results along with names

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Config: `src/services/anatomyFormattingService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 1741-1790)

## Success Metrics
- Natural-sounding descriptions with pronouns
- Correct pronoun usage based on gender
- Configuration flags working correctly
- All tests passing with pronoun scenarios
- Backward compatibility maintained

## Related Tickets
- **Requires**: ACTDESC-008 (Phrase generation)
- **Blocks**: ACTDESC-015 (Smart grouping)
- **Enhances**: Phase 1 implementation with natural language

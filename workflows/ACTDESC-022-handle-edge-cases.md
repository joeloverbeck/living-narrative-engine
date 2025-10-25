# ACTDESC-022: Handle Edge Cases and Corner Scenarios

## Status
🟡 **Pending**

## Phase
**Phase 7: Production Polish** (Week 4-5)

## Description
Implement comprehensive handling for edge cases, corner scenarios, and unusual states that could occur in production: empty activities, circular references, extremely long descriptions, special characters, and unusual entity configurations.

## Background
Production systems encounter unexpected scenarios. This ticket ensures the activity description system handles all edge cases gracefully without degrading user experience.

**Reference**: Design document lines 2656-2745 (Edge Case Handling)

## Technical Specification

### Edge Case Categories

#### 1. Empty or Missing Data
```javascript
/**
 * Handle empty activity scenarios.
 */
async generateActivityDescription(entityId) {
  // ... existing validation

  const entity = this.#entityManager.getEntityInstance(entityId);
  if (!entity) {
    return ''; // Already handled
  }

  const allActivities = [...inlineActivities, ...dedicatedActivities];

  // Edge case: No activities
  if (allActivities.length === 0) {
    return ''; // Not an error, just no activities
  }

  // Edge case: All activities filtered out by visibility
  const filteredActivities = this.#filterActivitiesSafe(sortedActivities, entity);
  if (filteredActivities.length === 0) {
    this.#logger.debug(`All activities filtered for ${entityId}`);
    return '';
  }

  // ... continue processing
}
```

#### 2. Circular References
```javascript
/**
 * Detect and prevent circular activity references.
 *
 * @param {Array<object>} activities - Activities to check
 * @returns {Array<object>} Safe activities
 * @private
 */
#detectCircularReferences(activities) {
  const seen = new Set();
  const safe = [];

  for (const activity of activities) {
    const key = `${activity.sourceComponent}:${activity.targetEntityId || 'solo'}`;

    if (seen.has(key)) {
      this.#logger.warn(`Circular reference detected: ${key}`);
      continue;
    }

    seen.add(key);
    safe.push(activity);
  }

  return safe;
}
```

#### 3. Extremely Long Descriptions
```javascript
/**
 * Limit description length to prevent UI overflow.
 *
 * @param {string} description - Generated description
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated description
 * @private
 */
#limitDescriptionLength(description, maxLength = 500) {
  if (description.length <= maxLength) {
    return description;
  }

  // Truncate at sentence boundary
  const truncated = description.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');

  if (lastPeriod > maxLength * 0.7) {
    // Good sentence boundary found
    return truncated.substring(0, lastPeriod + 1);
  }

  // No good boundary, hard truncate with ellipsis
  return truncated.substring(0, maxLength - 3) + '...';
}
```

#### 4. Special Characters
```javascript
/**
 * Sanitize entity name for safe display.
 *
 * @param {string} name - Entity name
 * @returns {string} Sanitized name
 * @private
 */
#sanitizeEntityName(name) {
  if (!name || typeof name !== 'string') {
    return 'Unknown';
  }

  // Remove control characters
  let sanitized = name.replace(/[\x00-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Fallback if empty after sanitization
  if (sanitized.length === 0) {
    return 'Unknown';
  }

  return sanitized;
}
```

#### 5. Self-Targeting Activities
```javascript
/**
 * Handle activities where actor targets themselves.
 *
 * @param {string} actorId - Actor ID
 * @param {object} activity - Activity object
 * @returns {string} Phrase
 * @private
 */
#generateActivityPhrase(actorRef, activity, usePronounsForTarget = false) {
  let targetRef = '';

  if (activity.targetEntityId) {
    // Edge case: Self-targeting
    if (activity.targetEntityId === activity.actorId) {
      targetRef = usePronounsForTarget
        ? this.#getReflexivePronoun(this.#detectEntityGender(activity.actorId))
        : actorRef;
    } else {
      targetRef = usePronounsForTarget
        ? this.#getPronounSet(this.#detectEntityGender(activity.targetEntityId)).object
        : this.#resolveEntityName(activity.targetEntityId);
    }
  }

  // ... continue with template replacement
}

/**
 * Get reflexive pronoun for gender.
 *
 * @param {string} gender - Gender
 * @returns {string} Reflexive pronoun
 * @private
 */
#getReflexivePronoun(gender) {
  const reflexive = {
    male: 'himself',
    female: 'herself',
    neutral: 'themselves',
    unknown: 'themselves',
  };

  return reflexive[gender] || 'themselves';
}
```

#### 6. Missing Target Entities
```javascript
/**
 * Handle missing target entities gracefully.
 *
 * @param {string} targetId - Target ID
 * @returns {string} Name or fallback
 * @private
 */
#resolveEntityNameSafe(entityId) {
  try {
    // Check cache first
    if (this.#entityNameCache.has(entityId)) {
      return this.#entityNameCache.get(entityId);
    }

    const entity = this.#entityManager.getEntityInstance(entityId);

    // Edge case: Missing entity
    if (!entity) {
      this.#logger.debug(`Target entity not found: ${entityId}, using ID`);
      const fallback = this.#sanitizeEntityName(entityId);
      this.#entityNameCache.set(entityId, fallback);
      return fallback;
    }

    const nameComponent = entity.getComponentData('core:name');
    const name = this.#sanitizeEntityName(nameComponent?.text) || entityId;

    this.#entityNameCache.set(entityId, name);
    return name;
  } catch (err) {
    this.#logger.error(`Failed to resolve name for ${entityId}`, err);
    return this.#sanitizeEntityName(entityId) || 'Unknown';
  }
}
```

#### 7. Duplicate Activities
```javascript
/**
 * Remove duplicate activities based on content.
 *
 * @param {Array<object>} activities - Activities
 * @returns {Array<object>} Deduplicated activities
 * @private
 */
#deduplicateActivities(activities) {
  const seen = new Map();
  const unique = [];

  for (const activity of activities) {
    // Create content hash
    const hash = `${activity.template || activity.verb}:${activity.targetEntityId || 'solo'}`;

    if (seen.has(hash)) {
      // Keep higher priority version
      const existing = seen.get(hash);
      if ((activity.priority || 50) > (existing.priority || 50)) {
        // Replace with higher priority
        const index = unique.indexOf(existing);
        unique[index] = activity;
        seen.set(hash, activity);
      }
      continue;
    }

    seen.set(hash, activity);
    unique.push(activity);
  }

  return unique;
}
```

### Configuration Additions
```javascript
getActivityIntegrationConfig() {
  return {
    // ... existing config
    edgeCases: {
      maxDescriptionLength: 500,
      handleCircularReferences: true,
      deduplicateActivities: true,
      sanitizeNames: true,
      reflexivePronounsForSelfTarget: true,
    },
  };
}
```

## Acceptance Criteria
- [ ] Empty activity lists handled gracefully
- [ ] Circular references detected and prevented
- [ ] Extremely long descriptions truncated intelligently
- [ ] Special characters sanitized
- [ ] Self-targeting activities use reflexive pronouns
- [ ] Missing target entities handled with fallbacks
- [ ] Duplicate activities deduplicated
- [ ] Configuration controls edge case handling
- [ ] Tests verify all edge cases
- [ ] No crashes on unusual inputs

## Dependencies
- **Requires**: All Phase 6 features (ACTDESC-018 to ACTDESC-021)
- **Blocks**: ACTDESC-024 (Documentation needs complete implementation)
- **Enhances**: Production robustness

## Testing Requirements

```javascript
describe('ActivityDescriptionService - Edge Cases', () => {
  it('should return empty string for entity with no activities', async () => {
    const jon = createEntity('jon', 'male');
    // No activities added

    const description = await service.generateActivityDescription('jon');
    expect(description).toBe('');
  });

  it('should detect and prevent circular references', () => {
    const activities = [
      { sourceComponent: 'comp1', targetEntityId: 'alicia', priority: 75 },
      { sourceComponent: 'comp1', targetEntityId: 'alicia', priority: 80 }, // Duplicate
    ];

    const safe = service['#detectCircularReferences'](activities);
    expect(safe).toHaveLength(1);
  });

  it('should truncate extremely long descriptions', () => {
    const longDescription = 'Activity: ' + 'Jon is doing something. '.repeat(50);

    const truncated = service['#limitDescriptionLength'](longDescription, 500);

    expect(truncated.length).toBeLessThanOrEqual(500);
    expect(truncated).toMatch(/\.$/); // Should end with period
  });

  it('should sanitize entity names with special characters', () => {
    const names = [
      'Jon\x00Ureña',        // Control character
      '  Jon   ',             // Extra whitespace
      '',                     // Empty
      '\t\nJon\r',           // Whitespace chars
    ];

    const sanitized = names.map(n => service['#sanitizeEntityName'](n));

    expect(sanitized[0]).not.toContain('\x00');
    expect(sanitized[1]).toBe('Jon');
    expect(sanitized[2]).toBe('Unknown');
    expect(sanitized[3]).toBe('Jon');
  });

  it('should use reflexive pronouns for self-targeting', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is meditating on {target}', 'jon', 75); // Self-target

    const description = await service.generateActivityDescription('jon');

    expect(description).toMatch(/himself|Jon/);
  });

  it('should handle missing target entities', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} is looking for {target}', 'missing_entity', 75);

    const description = await service.generateActivityDescription('jon');

    // Should use target ID as fallback
    expect(description).toContain('missing_entity');
  });

  it('should deduplicate activities intelligently', () => {
    const activities = [
      { template: '{actor} waves', targetEntityId: 'alicia', priority: 70 },
      { template: '{actor} waves', targetEntityId: 'alicia', priority: 80 }, // Higher priority duplicate
    ];

    const deduplicated = service['#deduplicateActivities'](activities);

    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].priority).toBe(80); // Kept higher priority
  });

  it('should handle entity with only filtered activities', async () => {
    const jon = createEntity('jon', 'male');
    addActivity(jon, '{actor} waves', null, 75, {
      conditions: {
        requiredComponents: ['nonexistent:component'],
      },
    });

    const description = await service.generateActivityDescription('jon');

    // All activities filtered, should return empty string
    expect(description).toBe('');
  });

  it('should handle extremely nested pronoun resolution', async () => {
    const jon = createEntity('jon', 'male');

    // Many activities with same target
    for (let i = 0; i < 20; i++) {
      addActivity(jon, `{actor} action${i} {target}`, 'alicia', 90 - i);
    }

    const description = await service.generateActivityDescription('jon');

    // Should not crash, should use pronouns correctly
    expect(description).toBeDefined();
    expect(description.length).toBeGreaterThan(0);
  });
});
```

## Implementation Notes
1. **Fail Gracefully**: Return empty string > crash
2. **Sanitize Inputs**: Clean all user-facing strings
3. **Detect Duplicates**: Based on content, not object identity
4. **Length Limits**: Prevent UI overflow
5. **Reflexive Pronouns**: "himself", "herself", "themselves" for self-targets

## Reference Files
- Service: `src/anatomy/services/activityDescriptionService.js`
- Design document: `brainstorming/ACTDESC-activity-description-composition-design.md` (lines 2656-2745)

## Success Metrics
- All edge cases handled gracefully
- No crashes on unusual inputs
- Intelligent fallbacks for missing data
- Tests verify all scenarios
- Production-ready robustness

## Related Tickets
- **Requires**: All Phase 6 features
- **Enhances**: Production readiness and reliability
- **Enables**: Safe deployment to all users

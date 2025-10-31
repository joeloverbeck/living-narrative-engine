# ACTDESSERREF-008: Extract Context Building System

**Priority**: LOW | **Effort**: 5 days | **Risk**: LOW | **Accuracy**: 70%
**Dependencies**: None | **Phase**: 3 - Complex Extractions (Weeks 7-10)

## Context

Extract the context building system from ActivityDescriptionService (lines 2569-2688). **CRITICAL**: Relationship tone detection uses inline closeness component queries, NOT a non-existent RelationshipService.

**File Location**: `src/anatomy/services/activityDescriptionService.js`

## Methods to Extract

- `#buildActivityContext(actorId, activity)` - Line 2569
- `#determineActivityIntensity(priority)` - Line 2623
- `#applyContextualTone(activity, context)` - Line 2650

## Relationship Detection (NO RelationshipService!)

```javascript
// ACTUAL implementation (line 2569)
#buildActivityContext(actorId, activity) {
  const context = {
    actorId,
    targetId: activity.targetId || null,
  };

  // Get closeness data DIRECTLY from component (no service)
  const actorEntity = this.#entityManager.getEntityInstance(actorId);
  const closenessData = actorEntity?.getComponentData?.('positioning:closeness');

  if (activity.targetId) {
    const partners = closenessData?.partners ?? [];

    if (partners.includes(activity.targetId)) {
      context.relationshipTone = 'closeness_partner';
    } else if (closenessData?.actorsCloseToMe?.includes(activity.targetId)) {
      context.relationshipTone = 'closeness_nearby';
    } else {
      context.relationshipTone = 'closeness_distant';
    }
  }

  // Map priority to intensity
  context.activityIntensity = this.#determineActivityIntensity(activity.priority);

  // Apply contextual modifiers
  return this.#applyContextualTone(activity, context);
}
```

## Target Architecture

**Location**: `src/anatomy/services/context/activityContextBuildingSystem.js`

```javascript
class ActivityContextBuildingSystem {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  buildActivityContext(actorId, activity) {
    const context = {
      actorId,
      targetId: activity.targetId || null,
    };

    // Inline closeness component queries (NO RelationshipService)
    const actorEntity = this.#entityManager.getEntityInstance(actorId);
    const closenessData = actorEntity?.getComponentData?.('positioning:closeness');

    if (activity.targetId) {
      context.relationshipTone = this.#detectRelationshipTone(closenessData, activity.targetId);
    }

    context.activityIntensity = this.determineActivityIntensity(activity.priority);

    return this.applyContextualTone(activity, context);
  }

  #detectRelationshipTone(closenessData, targetId) {
    const partners = closenessData?.partners ?? [];

    if (partners.includes(targetId)) {
      return 'closeness_partner';
    } else if (closenessData?.actorsCloseToMe?.includes(targetId)) {
      return 'closeness_nearby';
    } else {
      return 'closeness_distant';
    }
  }

  determineActivityIntensity(priority) { /* Line 2623 */ }
  applyContextualTone(activity, context) { /* Line 2650 */ }

  getTestHooks() {
    return {
      buildActivityContext: (...args) => this.buildActivityContext(...args),
    };
  }
}
```

## Acceptance Criteria

- [ ] ActivityContextBuildingSystem class created
- [ ] Inline closeness queries (NO RelationshipService)
- [ ] Relationship tone detection (partner/nearby/distant)
- [ ] Intensity mapping
- [ ] Tone application
- [ ] Test hooks preserved
- [ ] Unit tests achieve 90%+ coverage
- [ ] All existing tests pass

## Dependencies

None (uses EntityManager directly)

## Related Tickets

- ACTDESSERREF-006 (NLG uses context)

# ACTDESSERREF-004: Extract Metadata Collection System

**Priority**: HIGH | **Effort**: 5 days | **Risk**: LOW | **Accuracy**: 80% (minor fixes)
**Dependencies**: None | **Phase**: 2 - Core Extractions (Weeks 3-6)

## Context

Extract the 3-tier metadata collection system from ActivityDescriptionService (lines 387-737). This system discovers activity metadata from ActivityIndex (optional), inline component metadata, and dedicated metadata components.

**File Location**: `src/anatomy/services/activityDescriptionService.js`

## Methods to Extract

- `#collectActivityMetadata(entityId, entity)` - Line 387 (master collector)
- `#collectInlineMetadata(entity)` - Line 436 (**NOT** `#discoverInlineMetadata`)
- `#parseInlineMetadata(componentId, data, metadata)` - Line 469
- `#collectDedicatedMetadata(entity)` - Line 613 (**NOT** `#discoverDedicatedMetadata`)
- `#parseDedicatedMetadata(metadata, entity)` - Line 646
- `#deduplicateActivitiesBySignature(activities)` - Line 719

## Target Architecture

**Location**: `src/anatomy/services/metadata/activityMetadataCollectionSystem.js`

```javascript
class ActivityMetadataCollectionSystem {
  #entityManager;
  #activityIndex; // Optional Phase 3 optimization
  #logger;

  constructor({ entityManager, activityIndex = null, logger }) {
    this.#entityManager = entityManager;
    this.#activityIndex = activityIndex;
    this.#logger = logger;
  }

  /**
   * Master collector - implements 3-tier fallback
   */
  collectActivityMetadata(entityId, entity) {
    const activities = [];

    // Tier 1: Optional ActivityIndex (fastest)
    if (this.#activityIndex?.findActivitiesForEntity) {
      const indexed = this.#activityIndex.findActivitiesForEntity(entityId);
      activities.push(...indexed);
    }

    // Tier 2: Inline component metadata (fallback)
    const inline = this.collectInlineMetadata(entity);
    activities.push(...inline);

    // Tier 3: Dedicated metadata components (fallback)
    const dedicated = this.collectDedicatedMetadata(entity);
    activities.push(...dedicated);

    // Deduplicate
    return this.deduplicateActivitiesBySignature(activities);
  }

  collectInlineMetadata(entity) { /* Line 436 logic */ }
  parseInlineMetadata(componentId, data, metadata) { /* Line 469 logic */ }
  collectDedicatedMetadata(entity) { /* Line 613 logic */ }
  parseDedicatedMetadata(metadata, entity) { /* Line 646 logic */ }
  deduplicateActivitiesBySignature(activities) { /* Line 719 logic */ }
}
```

## Acceptance Criteria

- [ ] ActivityMetadataCollectionSystem class created
- [ ] All 6 methods extracted with **correct names** (collect not discover)
- [ ] 3-tier fallback architecture maintained
- [ ] Deduplication logic preserved
- [ ] Unit tests achieve 90%+ coverage
- [ ] All existing tests pass
- [ ] No performance regression

## Dependencies

None (self-contained extraction)

## Related Tickets

- ACTDESSERREF-003 (Index Management)
- ACTDESSERREF-005 (Filtering uses metadata)

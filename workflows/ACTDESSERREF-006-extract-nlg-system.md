# ACTDESSERREF-006: Extract Natural Language Generation System

**Priority**: MEDIUM | **Effort**: 7 days | **Risk**: MEDIUM | **Accuracy**: 80%
**Dependencies**: ACTDESSERREF-001 (Caching) | **Phase**: 3 - Complex Extractions (Weeks 7-10)

## Context

Extract the Natural Language Generation system from ActivityDescriptionService (lines 1668-2406, 2204-2386). **CRITICAL**: Pronoun logic is **self-contained**, NOT dependent on AnatomyFormattingService.

**File Location**: `src/anatomy/services/activityDescriptionService.js`

## Methods to Extract

### Name Resolution
- `#resolveEntityName(entityId)` - Line 2204
- `#shouldUsePronounForTarget(targetEntityId)` - Line 2232
- `#sanitizeEntityName(name)` - Line 2755

### Pronoun Resolution (Self-Contained!)
- `#detectEntityGender(entityId)` - Line 2263 (via `core:gender` component)
- `#getPronounSet(gender)` - Line 2285
- `#getReflexivePronoun(pronouns)` - Line 2304

### Phrase Generation
- `#generateActivityPhrase(activity, names, pronounSets, context)` - Line 1668
- `#sanitizeVerbPhrase(phrase)` - Line 1776
- `#buildRelatedActivityFragment(relatedActivity, conjunction, names, pronounSets)` - Line 1800

### Tone Modifiers
- `#mergeAdverb(currentAdverb, injected)` - Line 2333
- `#injectSoftener(template, descriptor)` - Line 2359

### Composition
- `#truncateDescription(description, maxLength)` - Line 2386
- `#formatActivityDescription(groups, entityId, context)` - Line 1139 (209 lines - break into sub-methods)

## Target Architecture

**Location**: `src/anatomy/services/nlg/activityNLGSystem.js`

```javascript
class ActivityNLGSystem {
  #entityManager;
  #cacheManager;
  #logger;
  #config;

  constructor({ entityManager, cacheManager, logger, config }) {
    this.#entityManager = entityManager;
    this.#cacheManager = cacheManager;
    this.#logger = logger;
    this.#config = config;
  }

  // Name resolution
  resolveEntityName(entityId) { /* Line 2204 - uses cache */ }
  sanitizeEntityName(name) { /* Line 2755 */ }

  // Pronoun resolution (self-contained, NO AnatomyFormattingService!)
  detectEntityGender(entityId) {
    // Uses EntityManager to query core:gender component
    const cached = this.#cacheManager.get('gender', entityId);
    if (cached) return cached;

    const entity = this.#entityManager.getEntityInstance(entityId);
    const genderData = entity?.getComponentData?.('core:gender');
    const gender = genderData?.value ?? 'unknown';

    this.#cacheManager.set('gender', entityId, gender);
    return gender;
  }

  getPronounSet(gender) {
    const pronounSets = {
      male: { subject: 'he', object: 'him', possessive: 'his', possessivePronoun: 'his' },
      female: { subject: 'she', object: 'her', possessive: 'her', possessivePronoun: 'hers' },
      neutral: { subject: 'they', object: 'them', possessive: 'their', possessivePronoun: 'theirs' },
      unknown: { subject: 'they', object: 'them', possessive: 'their', possessivePronoun: 'theirs' },
    };
    return pronounSets[gender] || pronounSets.neutral;
  }

  getReflexivePronoun(pronouns) { /* Line 2304 */ }

  // Phrase generation
  generateActivityPhrase(activity, names, pronounSets, context) { /* Line 1668 */ }
  sanitizeVerbPhrase(phrase) { /* Line 1776 */ }
  buildRelatedActivityFragment(relatedActivity, conjunction, names, pronounSets) { /* Line 1800 */ }

  // Tone modifiers
  mergeAdverb(currentAdverb, injected) { /* Line 2333 */ }
  injectSoftener(template, descriptor) { /* Line 2359 */ }

  // Composition
  truncateDescription(description, maxLength) { /* Line 2386 */ }
  formatActivityDescription(groups, entityId, context) {
    // Break 209-line method into sub-methods
  }

  getTestHooks() {
    return {
      mergeAdverb: (...args) => this.mergeAdverb(...args),
      injectSoftener: (...args) => this.injectSoftener(...args),
      sanitizeVerbPhrase: (...args) => this.sanitizeVerbPhrase(...args),
      buildRelatedActivityFragment: (...args) => this.buildRelatedActivityFragment(...args),
    };
  }
}
```

## Key Corrections

1. **NO AnatomyFormattingService dependency** - pronouns are self-contained
2. **Gender detection via EntityManager** - queries `core:gender` component directly
3. **Cache integration** - uses shared ActivityCacheManager
4. **Test hooks MUST be preserved** - 19+ hooks from existing tests

## Acceptance Criteria

- [ ] ActivityNLGSystem class created
- [ ] Self-contained pronoun logic (no AnatomyFormattingService)
- [ ] Gender detection via core:gender component
- [ ] Cache integration for name/gender caches
- [ ] All 12+ methods extracted
- [ ] Test hooks preserved (4 hooks minimum)
- [ ] Unit tests achieve 90%+ coverage
- [ ] All existing tests pass (6,658 lines)

## Dependencies

- ACTDESSERREF-001 (ActivityCacheManager)

## Related Tickets

- ACTDESSERREF-001 (Caching System)
- ACTDESSERREF-007 (Grouping provides groups for NLG)

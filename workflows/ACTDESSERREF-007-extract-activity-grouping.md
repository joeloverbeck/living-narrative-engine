# ACTDESSERREF-007: Extract Activity Grouping System

**Priority**: MEDIUM | **Effort**: 8 days | **Risk**: HIGH | **Accuracy**: 40% (algorithm rewrite)
**Dependencies**: ACTDESSERREF-003 (Index Management) | **Phase**: 3 - Complex Extractions (Weeks 7-10)

## Context

Extract the activity grouping system from ActivityDescriptionService (lines 1040-2003). **CRITICAL**: Original report completely misunderstood the algorithm. This is **sequential pair-wise comparison**, NOT target-based grouping.

**File Location**: `src/anatomy/services/activityDescriptionService.js`

## Corrected Algorithm Understanding

```javascript
// ACTUAL algorithm (line 1839)
#groupActivities(activities, cacheKey) {
  const prioritized = this.#sortByPriority(activities, cacheKey);
  const index = this.#getActivityIndex(activities, cacheKey);
  const groups = [];
  const processed = new Set();

  for (let i = 0; i < prioritized.length; i++) {
    if (processed.has(i)) continue;

    // Create new group with current activity as PRIMARY
    const activity = prioritized[i];
    const group = this.#startActivityGroup(activity);
    processed.add(i);

    // Check ALL remaining candidates against this PRIMARY
    for (let j = i + 1; j < prioritized.length; j++) {
      if (processed.has(j)) continue;

      const candidate = prioritized[j];

      // PAIR-WISE COMPARISON
      if (this.#shouldGroupActivities(group.primaryActivity, candidate)) {
        // Select conjunction based on priority proximity
        const conjunction = this.#determineConjunction(
          group.primaryActivity,
          candidate
        );

        group.relatedActivities.push({
          activity: candidate,
          conjunction: conjunction  // "while" or "and"
        });

        processed.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}
```

## Methods to Extract (CORRECTED SIGNATURES)

- `#groupActivities(activities, cacheKey)` - Line 1839 (sequential pair-wise)
- `#sortByPriority(activities, cacheKey)` - Line 1040
- `#startActivityGroup(activity)` - Line 1905
- `#shouldGroupActivities(first, second)` - Line 1925 (pair-wise check)
- `#determineConjunction(first, second)` - Line 1968 (**takes TWO activities**, not groupKey!)
- `#activitiesOccurSimultaneously(p1, p2)` - Line 1987

## Conjunction Selection (Corrected)

```javascript
#determineConjunction(first, second) {
  // Compare TWO activities (not a group key)
  const firstPriority = first.priority ?? 0;
  const secondPriority = second.priority ?? 0;

  // Simultaneous if priorities are close (≤10 difference)
  if (this.#activitiesOccurSimultaneously(firstPriority, secondPriority)) {
    return 'while';  // Parallel actions
  }

  return 'and';  // Sequential actions
}

#activitiesOccurSimultaneously(p1, p2) {
  return Math.abs(p1 - p2) <= 10;
}
```

## Target Architecture

**Location**: `src/anatomy/services/grouping/activityGroupingSystem.js`

```javascript
class ActivityGroupingSystem {
  #indexManager;
  #logger;
  #config;

  constructor({ indexManager, logger, config }) {
    this.#indexManager = indexManager;
    this.#logger = logger;
    this.#config = config;
  }

  // Grouping algorithm (CORRECTED)
  groupActivities(activities, cacheKey = null) { /* Line 1839 - sequential pair-wise */ }
  sortByPriority(activities, cacheKey = null) { /* Line 1040 */ }

  // Group management
  startActivityGroup(activity) { /* Line 1905 */ }
  shouldGroupActivities(first, second) { /* Line 1925 - pair-wise */ }

  // Conjunction selection (CORRECTED SIGNATURE)
  determineConjunction(first, second) { /* Line 1968 - takes TWO activities */ }
  activitiesOccurSimultaneously(priority1, priority2) { /* Line 1987 */ }

  getTestHooks() {
    return {
      groupActivities: (...args) => this.groupActivities(...args),
    };
  }
}
```

## Acceptance Criteria

- [ ] ActivityGroupingSystem class created with CORRECTED algorithm
- [ ] Sequential pair-wise grouping implemented (NOT target-based)
- [ ] Conjunction selection based on priority proximity
- [ ] Index integration for optimization
- [ ] All 6 methods extracted with correct signatures
- [ ] Test hooks preserved
- [ ] Extensive unit tests (algorithm critical!)
- [ ] Property-based tests for grouping logic
- [ ] All existing tests pass

## CRITICAL TESTING

This is the highest risk refactoring. Requires:
- Characterization tests BEFORE extraction (ACTDESSERREF-002)
- Property-based tests for algorithm validation
- Golden master tests for regression detection
- Performance benchmarks (large datasets)

## Dependencies

- ACTDESSERREF-003 (ActivityIndexManager)
- ACTDESSERREF-002 (Characterization tests MUST be complete first)

## Related Tickets

- ACTDESSERREF-002 (Characterization Tests)
- ACTDESSERREF-003 (Index Management)
- ACTDESSERREF-006 (NLG uses groups)

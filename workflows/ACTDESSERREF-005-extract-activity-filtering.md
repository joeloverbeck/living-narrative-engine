# ACTDESSERREF-005: Extract Activity Filtering System

**Priority**: MEDIUM | **Effort**: 6 days | **Risk**: MEDIUM | **Accuracy**: 60% (rewrite required)
**Dependencies**: None | **Phase**: 2 - Core Extractions (Weeks 3-6)

## Context

Extract the 4-stage activity filtering pipeline from ActivityDescriptionService (lines 775-1025). **CRITICAL**: Original report had wrong method names - this ticket uses **corrected** signatures.

**File Location**: `src/anatomy/services/activityDescriptionService.js`

## Methods to Extract (CORRECTED NAMES)

- `#filterByConditions(activities, entity)` - Line 775 (**NOT** `#evaluateActivityConditions`)
- `#evaluateActivityVisibility(activity, entity)` - Line 801 (**NOT** `#isActivityVisible`)
- `#buildLogicContext(activity, entity)` - Line 881 (**NOT** `#buildConditionContext`)
- `#extractEntityData(entity)` - Line 925
- `#isEmptyConditionsObject(conditions)` - Line 950
- `#matchesPropertyCondition(activity, rule)` - Line 1099
- `#hasRequiredComponents(entity, required)` - Line 980 (**NOT** `#checkComponentRequirements`)
- `#hasForbiddenComponents(entity, forbidden)` - Line 1014 (missing from original report!)

## 4-Stage Filter Pipeline

```javascript
filterByConditions(activities, entity) {
  return activities.filter(activity => {
    // Stage 1: Property-based filtering
    if (!this.matchesPropertyCondition(activity, someRule)) {
      return false;
    }

    // Stage 2: Required components
    if (activity.requiredComponents) {
      if (!this.hasRequiredComponents(entity, activity.requiredComponents)) {
        return false;
      }
    }

    // Stage 3: Forbidden components
    if (activity.forbiddenComponents) {
      if (this.hasForbiddenComponents(entity, activity.forbiddenComponents)) {
        return false;
      }
    }

    // Stage 4: Custom JSON Logic conditions
    if (!this.isEmptyConditionsObject(activity.conditions)) {
      const context = this.buildLogicContext(activity, entity);
      const result = this.#jsonLogicEvaluationService.evaluateConditions(
        activity.conditions,
        context
      );
      if (!result) return false;
    }

    return true;
  });
}
```

## Target Architecture

**Location**: `src/anatomy/services/filtering/activityFilteringSystem.js`

```javascript
class ActivityFilteringSystem {
  #entityManager;
  #jsonLogicEvaluationService;  // NOT LogicExpressionEvaluator
  #logger;

  constructor({ entityManager, jsonLogicEvaluationService, logger }) {
    this.#entityManager = entityManager;
    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#logger = logger;
  }

  // All methods with CORRECTED signatures
  filterByConditions(activities, entity) { /* Line 775 */ }
  evaluateActivityVisibility(activity, entity) { /* Line 801 */ }
  buildLogicContext(activity, entity) { /* Line 881 */ }
  extractEntityData(entity) { /* Line 925 */ }
  isEmptyConditionsObject(conditions) { /* Line 950 */ }
  matchesPropertyCondition(activity, rule) { /* Line 1099 */ }
  hasRequiredComponents(entity, required) { /* Line 980 */ }
  hasForbiddenComponents(entity, forbidden) { /* Line 1014 */ }

  getTestHooks() {
    return {
      evaluateActivityVisibility: (...args) => this.evaluateActivityVisibility(...args),
      buildLogicContext: (...args) => this.buildLogicContext(...args),
      filterByConditions: (...args) => this.filterByConditions(...args),
    };
  }
}
```

## Acceptance Criteria

- [ ] ActivityFilteringSystem class created with CORRECTED method names
- [ ] All 8 methods extracted (including `#hasForbiddenComponents`)
- [ ] 4-stage filter pipeline preserved
- [ ] JSON Logic integration maintained
- [ ] Test hooks exposed
- [ ] Unit tests achieve 90%+ coverage
- [ ] All existing tests pass

## Dependencies

- Requires `jsonLogicEvaluationService` dependency (correct name)
- Requires `EntityManager` for component checks

## Related Tickets

- ACTDESSERREF-004 (Metadata Collection)
- ACTDESSERREF-006 (NLG uses filtered activities)

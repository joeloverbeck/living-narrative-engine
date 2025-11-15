# HARMODREF-013: Refactor EstablishSittingClosenessHandler to Use Registry

**Priority:** P1 - HIGH
**Effort:** 2 hours
**Status:** Not Started

## Report Reference
[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Most Severe: Operation Handler Hardcoding"

## Problem Statement
Refactor establishSittingClosenessHandler.js to use Component Type Registry instead of hardcoded positioning:sitting references. This serves as proof-of-concept for the registry pattern.

## Affected Files
1. `src/logic/operationHandlers/establishSittingClosenessHandler.js`
2. `data/schemas/operations/establish_sitting_closeness.schema.json`
3. `tests/unit/logic/operationHandlers/establishSittingClosenessHandler.test.js`
4. `tests/integration/mods/positioning/establishSittingCloseness.integration.test.js`

## Implementation

### Before
```javascript
const sittingComponent = this.#entityManager.getComponent(
  actorId,
  'positioning:sitting'  // ❌ HARDCODED
);
```

### After
```javascript
constructor({ entityManager, eventBus, logger, componentTypeRegistry }) {
  super({ entityManager, eventBus, logger });
  this.#componentTypeRegistry = componentTypeRegistry;
}

execute(context) {
  const { actorId, targetId, parameters } = context;
  
  const sittingComponent = this.#componentTypeRegistry.getComponentOfCategory(
    this.#entityManager,
    actorId,
    'sitting',
    parameters.sittingComponentType  // ✅ CONFIGURABLE
  );
}
```

## Acceptance Criteria
- [ ] No hardcoded positioning:sitting references
- [ ] Uses IComponentTypeRegistry
- [ ] Operation schema includes sittingComponentType parameter
- [ ] Tests pass with >85% coverage
- [ ] Integration tests validate alternative types

## Dependencies
HARMODREF-012 (mods must declare registrations)

## Testing
```bash
npm run test:unit -- tests/unit/logic/operationHandlers/establishSittingClosenessHandler.test.js
npm run test:integration -- tests/integration/mods/positioning/establishSittingCloseness.integration.test.js
```

# GOAPIMPL-023: Knowledge System Integration

**Priority**: MEDIUM
**Estimated Effort**: 3-4 hours
**Dependencies**: GOAPIMPL-007 (Context Assembly), GOAPIMPL-021 (GOAP Controller)

## Description

Implement `core:known_to` component system and knowledge-limited scope filtering. Ensures planning respects actor knowledge boundaries (no omniscience).

The knowledge system prevents actors from planning with entities they don't know about - making AI behavior more realistic and believable.

## Acceptance Criteria

- [ ] `core:known_to` component defined with schema
- [ ] `core:visible` component defined with schema
- [ ] Turn start updates `known_to` for visible entities
- [ ] Planning scopes filter by `known_to`
- [ ] Knowledge propagates correctly (seeing = knowing)
- [ ] Knowledge persists across turns
- [ ] Knowledge system integrates with GOAP planner
- [ ] 90%+ test coverage

## Files to Create

### Component Definitions
- `data/mods/core/components/known_to.component.json` - Knowledge tracking component
- `data/mods/core/components/visible.component.json` - Visibility marking component

### Knowledge Manager
- `src/goap/knowledge/knowledgeManager.js` - Knowledge update service

### Tests
- `tests/unit/goap/knowledge/knowledgeManager.test.js` - Unit tests
- `tests/integration/goap/knowledgeLimitation.integration.test.js` - Integration tests

## Files to Modify

### Turn System Integration
- Turn start logic (add knowledge update hook)
- Location: Find turn manager or turn start processing

### Scope DSL Filtering
- Add `known_to` filtering to scope resolution
- Location: Scope DSL engine or scope resolver

### Dependency Injection
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IKnowledgeManager` token
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register service

## Testing Requirements

### Unit Tests
- [ ] Test `known_to` component structure
- [ ] Test knowledge updates on visibility
- [ ] Test knowledge persistence
- [ ] Test knowledge filtering logic
- [ ] Test knowledge propagation rules

### Integration Tests
- [ ] Test actor only plans with known entities
- [ ] Test knowledge update on turn start
- [ ] Test visibility detection
- [ ] Test knowledge-limited scope queries
- [ ] Test multi-actor knowledge scenarios

## Component Schemas

### core:known_to Component
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:known_to",
  "description": "Tracks entities that this actor knows about",
  "dataSchema": {
    "type": "object",
    "properties": {
      "entities": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Array of entity IDs known to this actor"
      }
    },
    "required": ["entities"]
  }
}
```

### core:visible Component
```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:visible",
  "description": "Marks entity as currently visible to actors",
  "dataSchema": {
    "type": "object",
    "properties": {
      "visibleTo": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Array of actor IDs that can see this entity"
      }
    },
    "required": ["visibleTo"]
  }
}
```

## Knowledge Manager

### Knowledge Update Process
```javascript
class KnowledgeManager {
  updateKnowledge(actor, worldState) {
    // 1. Find visible entities
    const visibleEntities = this.findVisibleEntities(actor, worldState);

    // 2. Get current knowledge
    const knownTo = actor.components['core:known_to'] || {
      entities: []
    };

    // 3. Add newly visible entities
    for (const entity of visibleEntities) {
      if (!knownTo.entities.includes(entity.id)) {
        knownTo.entities.push(entity.id);
      }
    }

    // 4. Update actor component
    this.componentMutator.modify(actor.id, 'core:known_to', knownTo);
  }

  findVisibleEntities(actor, worldState) {
    // Find entities marked as visible to this actor
    // or entities in same location (simplified visibility)

    return worldState.entities.filter(entity =>
      this.isVisible(entity, actor)
    );
  }

  isVisible(entity, actor) {
    // Check if entity is visible to actor
    // Options:
    // 1. Check core:visible component
    // 2. Check same location
    // 3. Check line of sight (advanced)

    // Simple implementation: same location
    return entity.components['core:located_at']?.location ===
           actor.components['core:located_at']?.location;
  }
}
```

## Turn Start Integration

### Knowledge Update Hook
```javascript
// In turn start processing
turnStart() {
  // Update visibility
  this.updateVisibility();

  // Update knowledge
  for (const actor of this.getActors()) {
    this.knowledgeManager.updateKnowledge(actor, this.worldState);
  }

  // Continue with turn decisions...
}
```

## Scope DSL Filtering

### Knowledge-Limited Scope Resolution
```javascript
// In scope resolver
resolveScope(scopeExpr, context) {
  let candidates = this.evaluateScope(scopeExpr);

  // Filter by knowledge
  if (context.actor) {
    const knownEntities = context.actor.components['core:known_to']?.entities || [];
    candidates = candidates.filter(entity =>
      knownEntities.includes(entity.id)
    );
  }

  return candidates;
}
```

## Knowledge Propagation Rules

### When Knowledge is Gained
1. **Visibility**: Seeing entity → knowing entity
2. **Interaction**: Interacting with entity → knowing entity
3. **Communication**: Told about entity → knowing entity
4. **Discovery**: Finding entity → knowing entity

### When Knowledge is Lost (Optional)
- **Forgetting**: Time-based decay (advanced)
- **Death**: Entity dies → remove from knowledge
- For MVP: Knowledge never lost (simpler)

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 140-160 - **PRIMARY REFERENCE** - Knowledge limitation and preventing omniscience

### Schema References
- `data/schemas/task.schema.json` - Knowledge-limited scopes (planningScope, parameterScopes)

## Implementation Notes

### Knowledge vs Visibility
- **Visibility**: Current perception (changes every turn)
- **Knowledge**: Accumulated information (persists across turns)

Relationship: Visibility → Knowledge (one-way)

### Performance Optimization
- Cache known_to component queries
- Batch knowledge updates
- Incremental visibility checks (only check changes)

### Knowledge Initialization
New actors start with:
- Self-knowledge (knows own ID)
- Initial environment knowledge (same location entities)
- Configured "known NPCs" (if any)

### Scope Filtering Impact
Without knowledge filtering:
```javascript
// Omniscient - sees all food in world
scope: "world.items[type='food']"
→ Returns: [food1, food2, food3] (all food)
```

With knowledge filtering:
```javascript
// Knowledge-limited - only sees known food
scope: "world.items[type='food']"
→ Returns: [food2] (only known food)
```

### Testing Knowledge Limitation
Create test scenarios:
1. Actor in room with food (visible) → can plan to eat
2. Actor in different room from food (not visible) → cannot plan to eat
3. Actor sees food, moves away → still knows about food (persists)

## Integration Points

### Required Services (inject)
- `IComponentMutationService` - Update components
- `IEntityManager` - Entity queries
- `ILogger` - Logging

### Used By
- Turn system (knowledge updates)
- GOAPIMPL-007 (Context Assembly) - Filter world state by knowledge
- GOAPIMPL-018 (GOAP Planner) - Knowledge-limited planning

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate knowledge-limited planning
- Component schemas defined and validated
- Knowledge updates work on turn start
- Scope filtering respects knowledge boundaries
- Actor only plans with known entities
- Service integrates with DI container
- Documentation explains knowledge system and integration

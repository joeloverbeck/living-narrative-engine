# GOAPIMPL-022: GOAP Action Decider Integration

**Priority**: HIGH
**Estimated Effort**: 2-3 hours
**Dependencies**: GOAPIMPL-021 (GOAP Controller)

## Description

Integrate GOAPController with existing action decider system for 'goap' player type. Replace placeholder/stub action decider with functional GOAP integration.

This ticket connects the GOAP system to the game's turn system, enabling GOAP-controlled actors to make decisions during gameplay.

## Acceptance Criteria

- [ ] GOAPActionDecider implemented for 'goap' player type
- [ ] Integrated with GOAPController
- [ ] Works with existing turn-based execution system
- [ ] Compatible with other player types (llm, player)
- [ ] Handles GOAP failures gracefully (falls back to idle/default action)
- [ ] Logs decisions for debugging
- [ ] 90%+ test coverage

## Files to Create

### Main Implementation
- `src/goap/goapActionDecider.js` - Action decider implementation

### Tests
- `tests/unit/goap/goapActionDecider.test.js` - Unit tests
- `tests/integration/goap/actionDeciderIntegration.integration.test.js` - Integration tests

## Files to Modify

### Action Decider System
- Existing action decider registry (search for 'goap' player type integration)
- Turn system integration (wherever player type decides actions)

### Dependency Injection
- `src/dependencyInjection/registrations/goapRegistrations.js` - Register action decider

## Testing Requirements

### Unit Tests
- [ ] Test action decision with GOAP controller
- [ ] Test GOAP failure fallback
- [ ] Test turn-based execution
- [ ] Test integration with action executor
- [ ] Test decision logging

### Integration Tests
- [ ] Test GOAP decider in complete turn cycle
- [ ] Test multi-actor scenarios (GOAP + other types)
- [ ] Test goal achievement workflow
- [ ] Test replanning scenarios
- [ ] Test integration with game state

## Action Decider Interface

### Existing Action Decider Pattern
```javascript
class ActionDecider {
  async decideAction(actor, context) {
    // Return action to execute this turn
    // or null to idle
  }
}
```

### GOAP Action Decider Implementation
```javascript
class GOAPActionDecider {
  constructor({ goapController, logger }) {
    this.#goapController = goapController;
    this.#logger = logger;
  }

  async decideAction(actor, context) {
    try {
      // 1. Use GOAP controller to decide
      const action = await this.#goapController.decideTurn(
        actor,
        context.world
      );

      if (!action) {
        // 2. No action decided → idle
        this.#logger.debug('GOAP idle', { actorId: actor.id });
        return null;
      }

      // 3. Log decision
      this.#logger.info('GOAP action decided', {
        actorId: actor.id,
        actionId: action.actionId,
        targets: action.targets
      });

      return action;

    } catch (error) {
      // 4. GOAP error → fallback to idle
      this.#logger.error('GOAP decision failed', error);
      return null;  // Idle on error
    }
  }
}
```

## Player Type Registration

### Register GOAP Player Type
```javascript
// In action decider registry or player type system
playerTypeRegistry.register('goap', GOAPActionDecider);
```

### Actor Configuration
```json
{
  "id": "actor-npc-1",
  "components": {
    "core:player_type": {
      "type": "goap"
    },
    "core:goals": {
      "goals": [
        {
          "id": "stay_fed",
          "priority": 10,
          "conditions": [...]
        }
      ]
    }
  }
}
```

## Turn System Integration

### Turn Execution Flow
```
Turn Start
  ↓
Get active actors
  ↓
For each actor:
  ├─ Get player type (llm, player, goap)
  ├─ Get action decider for type
  ├─ Call decider.decideAction(actor, context)
  ├─ Execute returned action
  └─ Update world state
  ↓
Turn End
```

### GOAP Integration Point
```javascript
// In turn manager or similar
const playerType = actor.components['core:player_type'].type;
const decider = this.getActionDecider(playerType);

const action = await decider.decideAction(actor, {
  world: this.worldState,
  turn: this.currentTurn
});

if (action) {
  await this.executeAction(action);
}
```

## Reference Documentation

### Specifications
- `specs/goap-system-specs.md` lines 239-241 - 'goap' player type placeholder

### Existing Systems
- Explore existing action decider implementations:
  - LLM action decider (if exists)
  - Player-controlled decider
- Find player type registry location
- Find turn system integration point

## Implementation Notes

### Context Assembly for Turn
```javascript
const context = {
  actor: actor,
  world: worldState,
  turn: currentTurn,
  // Any other context needed by GOAP
};
```

### Error Handling Strategy
If GOAP fails at any point:
1. Log error with full context
2. Return null (idle action)
3. Dispatch error event for monitoring
4. Don't crash game loop

### Fallback Behavior
When GOAP returns null (idle):
- Actor does nothing this turn
- Maintains position and state
- GOAP will try again next turn

### Performance Monitoring
Log decision time:
```javascript
const startTime = Date.now();
const action = await goapController.decideTurn(...);
const duration = Date.now() - startTime;

if (duration > 100) {
  logger.warn('Slow GOAP decision', { duration, actorId });
}
```

### Multi-Actor Coordination
GOAP Controller instances:
- **Per-actor**: Each actor has own controller (simple)
- **Shared**: One controller manages multiple actors (complex)

Start with per-actor for MVP.

## Integration Checklist

1. **Find action decider registry**
   - Search for 'player type' or 'action decider'
   - Identify where 'llm' and 'player' types are registered

2. **Implement GOAPActionDecider**
   - Match existing decider interface
   - Integrate with GOAPController
   - Add error handling

3. **Register GOAP player type**
   - Add to registry with 'goap' key
   - Test registration works

4. **Test with example actor**
   - Create test actor with 'goap' player type
   - Add goals to actor
   - Run turn and verify GOAP decides action

5. **Verify integration**
   - GOAP actions execute correctly
   - Turn system continues normally
   - Other player types unaffected

## Integration Points

### Required Services (inject)
- `IGOAPController` (GOAPIMPL-021) - Make decisions
- `ILogger` - Logging

### Used By
- Turn manager/turn system
- Action decider registry
- Player type system

## Success Validation

✅ **Done when**:
- All unit tests pass with 90%+ coverage
- Integration tests validate GOAP in turn cycle
- GOAPActionDecider registered for 'goap' player type
- Test actor with GOAP type makes decisions
- GOAP decisions execute correctly
- Error handling prevents game crashes
- Service integrates with DI container
- Documentation explains integration and configuration

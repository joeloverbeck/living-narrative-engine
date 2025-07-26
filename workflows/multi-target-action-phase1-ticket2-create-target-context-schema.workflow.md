# Ticket: Create target-context.schema.json

## Ticket ID: PHASE1-TICKET2
## Priority: High
## Estimated Time: 2-3 hours
## Dependencies: None
## Blocks: PHASE3-TICKET8, PHASE3-TICKET9

## Overview

Create a new schema file that defines the structure of the context object passed to scope DSL expressions during target resolution. This context enables secondary targets to access previously resolved targets, allowing for context-aware scope evaluation.

## Purpose

The target context schema serves multiple purposes:
1. Documents the context structure for modders writing scope files
2. Enables validation of context objects in tests
3. Provides type information for development tools
4. Ensures consistency across the scope evaluation system

## Implementation Steps

### Step 1: Create Schema File

Create new file: `data/schemas/target-context.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/target-context.schema.json",
  "title": "Target Context Schema",
  "description": "Defines the context object structure passed to scope DSL expressions during multi-target resolution. This context enables dependent target resolution where secondary targets can use primary target data.",
  "type": "object",
  "properties": {
    "actor": {
      "type": "object",
      "description": "The entity performing the action. Always available in scope context.",
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique identifier of the actor entity"
        },
        "components": {
          "type": "object",
          "description": "All components attached to the actor entity",
          "additionalProperties": true
        }
      },
      "required": ["id", "components"]
    },
    
    "target": {
      "type": "object",
      "description": "Primary target entity when contextFrom='primary' is specified. Only available in secondary/tertiary target resolution.",
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique identifier of the target entity"
        },
        "components": {
          "type": "object",
          "description": "All components attached to the target entity",
          "additionalProperties": true
        }
      },
      "required": ["id", "components"]
    },
    
    "targets": {
      "type": "object",
      "description": "All resolved targets keyed by their definition name (primary, secondary, etc). Available during resolution of subsequent targets.",
      "additionalProperties": {
        "type": "array",
        "description": "Array of entity objects that matched the scope for this target definition",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique identifier of the resolved entity"
            },
            "components": {
              "type": "object",
              "description": "All components attached to the resolved entity",
              "additionalProperties": true
            }
          },
          "required": ["id", "components"]
        }
      }
    },
    
    "location": {
      "type": "object",
      "description": "The location entity where the action is taking place. Usually the actor's current location.",
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique identifier of the location entity"
        },
        "components": {
          "type": "object",
          "description": "All components attached to the location entity",
          "additionalProperties": true
        }
      },
      "required": ["id", "components"]
    },
    
    "game": {
      "type": "object",
      "description": "Global game state object providing access to game-wide data",
      "properties": {
        "turnNumber": {
          "type": "integer",
          "description": "Current game turn number",
          "minimum": 0
        },
        "timeOfDay": {
          "type": "string",
          "description": "Current time of day in the game world",
          "enum": ["dawn", "morning", "noon", "afternoon", "evening", "night", "midnight"]
        },
        "weather": {
          "type": "string",
          "description": "Current weather conditions"
        }
      },
      "additionalProperties": true
    }
  },
  
  "required": ["actor", "location", "game"],
  
  "examples": [
    {
      "$comment": "Context for primary target resolution",
      "actor": {
        "id": "player_123",
        "components": {
          "core:inventory": {
            "items": ["sword_456", "potion_789"]
          }
        }
      },
      "location": {
        "id": "room_001",
        "components": {
          "core:description": {
            "name": "Town Square"
          }
        }
      },
      "game": {
        "turnNumber": 42,
        "timeOfDay": "afternoon"
      }
    },
    {
      "$comment": "Context for secondary target resolution with primary target",
      "actor": {
        "id": "player_123",
        "components": {}
      },
      "target": {
        "id": "npc_456",
        "components": {
          "clothing:equipment": {
            "equipped": {
              "torso_upper": {
                "outer": "jacket_001"
              }
            }
          }
        }
      },
      "targets": {
        "primary": [
          {
            "id": "npc_456",
            "components": {}
          }
        ]
      },
      "location": {
        "id": "room_001",
        "components": {}
      },
      "game": {
        "turnNumber": 42
      }
    }
  ],
  
  "definitions": {
    "entityReference": {
      "type": "object",
      "description": "Standard entity reference structure used throughout the context",
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_]+$",
          "description": "Entity identifier"
        },
        "components": {
          "type": "object",
          "description": "Component data keyed by component ID",
          "additionalProperties": true
        }
      },
      "required": ["id", "components"]
    }
  }
}
```

### Step 2: Create TypeScript Type Definitions

Create type definition file: `src/types/targetContext.d.ts`

```typescript
/**
 * Context object passed to scope DSL expressions during target resolution
 */
export interface TargetContext {
  /**
   * The entity performing the action
   */
  actor: EntityContext;
  
  /**
   * Primary target when contextFrom is used (optional)
   */
  target?: EntityContext;
  
  /**
   * All resolved targets keyed by name
   */
  targets?: Record<string, EntityContext[]>;
  
  /**
   * Current location entity
   */
  location: EntityContext;
  
  /**
   * Global game state
   */
  game: GameContext;
}

/**
 * Entity representation in scope context
 */
export interface EntityContext {
  /**
   * Unique entity identifier
   */
  id: string;
  
  /**
   * All components attached to the entity
   */
  components: Record<string, any>;
}

/**
 * Game state representation in scope context
 */
export interface GameContext {
  /**
   * Current turn number
   */
  turnNumber: number;
  
  /**
   * Current time of day
   */
  timeOfDay?: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'midnight';
  
  /**
   * Current weather
   */
  weather?: string;
  
  /**
   * Additional game state properties
   */
  [key: string]: any;
}
```

### Step 3: Add Schema Registration

Update schema registration to include the new schema:

In `src/data/schemaRegistry.js` or similar:

```javascript
// Add to schema imports
import targetContextSchema from '../../data/schemas/target-context.schema.json';

// Add to schema registration
schemaRegistry.register('target-context', targetContextSchema);
```

### Step 4: Create Context Builder Utility

Create utility class: `src/scopeDsl/utils/targetContextBuilder.js`

```javascript
/**
 * Builds context objects for scope DSL evaluation
 */
export class TargetContextBuilder {
  #entityManager;
  #gameStateManager;
  
  constructor({ entityManager, gameStateManager }) {
    this.#entityManager = entityManager;
    this.#gameStateManager = gameStateManager;
  }
  
  /**
   * Build base context for primary target resolution
   */
  buildBaseContext(actorId, locationId) {
    const actor = this.#buildEntityContext(actorId);
    const location = this.#buildEntityContext(locationId);
    const game = this.#buildGameContext();
    
    return {
      actor,
      location,
      game
    };
  }
  
  /**
   * Build context for dependent target resolution
   */
  buildDependentContext(baseContext, resolvedTargets, targetDef) {
    const context = { ...baseContext };
    
    // Add all resolved targets
    context.targets = { ...resolvedTargets };
    
    // Add specific target if contextFrom is specified
    if (targetDef.contextFrom && resolvedTargets[targetDef.contextFrom]) {
      // Use first resolved target as the context target
      const primaryTargets = resolvedTargets[targetDef.contextFrom];
      if (primaryTargets.length > 0) {
        context.target = this.#buildEntityContext(primaryTargets[0].id);
      }
    }
    
    return context;
  }
  
  /**
   * Build entity context with all components
   */
  #buildEntityContext(entityId) {
    const entity = this.#entityManager.getEntity(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    
    return {
      id: entity.id,
      components: entity.getAllComponents()
    };
  }
  
  /**
   * Build game state context
   */
  #buildGameContext() {
    return {
      turnNumber: this.#gameStateManager.getCurrentTurn(),
      timeOfDay: this.#gameStateManager.getTimeOfDay(),
      weather: this.#gameStateManager.getWeather()
      // Add other game state as needed
    };
  }
}
```

## Testing Requirements

### Unit Tests

Create test file: `tests/unit/schemas/targetContextSchema.test.js`

```javascript
describe('Target Context Schema', () => {
  let validator;
  
  beforeEach(() => {
    validator = new AjvSchemaValidator();
    validator.addSchema('target-context', targetContextSchema);
  });
  
  describe('Base Context Validation', () => {
    it('should validate minimal context', () => {
      const context = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 0 }
      };
      
      expect(validator.validate('target-context', context)).toBe(true);
    });
    
    it('should require actor, location, and game', () => {
      const invalid = {
        actor: { id: 'player', components: {} }
        // missing location and game
      };
      
      expect(validator.validate('target-context', invalid)).toBe(false);
    });
  });
  
  describe('Target Context Validation', () => {
    it('should validate context with target', () => {
      const context = {
        actor: { id: 'player', components: {} },
        target: { id: 'npc', components: {} },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };
      
      expect(validator.validate('target-context', context)).toBe(true);
    });
    
    it('should validate context with targets object', () => {
      const context = {
        actor: { id: 'player', components: {} },
        targets: {
          primary: [{ id: 'item1', components: {} }],
          secondary: [{ id: 'npc1', components: {} }]
        },
        location: { id: 'room', components: {} },
        game: { turnNumber: 1 }
      };
      
      expect(validator.validate('target-context', context)).toBe(true);
    });
  });
});
```

### Integration Tests

Create test file: `tests/integration/scopeDsl/targetContextUsage.test.js`

```javascript
describe('Target Context Usage in Scope DSL', () => {
  let scopeInterpreter;
  let contextBuilder;
  
  beforeEach(() => {
    const testBed = new ScopeDslTestBed();
    scopeInterpreter = testBed.getScopeInterpreter();
    contextBuilder = testBed.getContextBuilder();
  });
  
  it('should use target from context in dependent scope', async () => {
    // Create scope that uses target from context
    const scope = 'target.topmost_clothing[]';
    
    // Build context with target
    const context = {
      actor: { id: 'player', components: {} },
      target: {
        id: 'npc',
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { outer: 'jacket' }
            }
          }
        }
      },
      location: { id: 'room', components: {} },
      game: { turnNumber: 1 }
    };
    
    // Evaluate scope with context
    const result = await scopeInterpreter.evaluate(scope, context);
    
    expect(result).toContain('jacket');
  });
});
```

## Acceptance Criteria

1. ✅ Schema file created and properly formatted
2. ✅ Schema validates all required context structures
3. ✅ TypeScript definitions match schema structure
4. ✅ Schema is registered in the system
5. ✅ Context builder utility creates valid contexts
6. ✅ Unit tests validate schema correctness
7. ✅ Integration tests show context usage in scopes
8. ✅ Documentation includes clear examples
9. ✅ Schema supports all context variations (with/without target)
10. ✅ Performance impact is minimal (<1ms validation)

## Documentation Requirements

Add to scope DSL documentation:

```markdown
## Scope Evaluation Context

When a scope expression is evaluated, it receives a context object containing:

- `actor`: The entity performing the action
- `location`: Current location entity  
- `game`: Global game state
- `target`: Primary target (when using contextFrom)
- `targets`: All resolved targets (during multi-target resolution)

### Example Context Usage

```dsl
# Access actor's inventory
actor.core:inventory.items[]

# Access target's clothing (when contextFrom="primary")
target.topmost_clothing[]

# Access game state
game.turnNumber
```
```

## Performance Considerations

- Context objects should be built lazily (only include needed data)
- Component data should not be deep-cloned unless necessary
- Consider caching entity contexts within a turn
- Validation should be fast (<1ms per context)

## Security Considerations

- Ensure scope expressions cannot modify context objects
- Validate all entity IDs before building contexts
- Limit context object size to prevent memory issues
- Sanitize game state data before inclusion
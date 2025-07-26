# Ticket: Add Validation Tests for New Schemas

## Ticket ID: PHASE1-TICKET3
## Priority: High
## Estimated Time: 3-4 hours
## Dependencies: PHASE1-TICKET1, PHASE1-TICKET2
## Blocks: PHASE2-TICKET4

## Overview

Create comprehensive validation tests for the new multi-target action schema and target context schema. These tests ensure schema correctness, validate edge cases, and verify backward compatibility with existing action definitions.

## Test Categories

1. **Schema Structure Tests**: Validate the schemas themselves are well-formed
2. **Positive Validation Tests**: Valid configurations that should pass
3. **Negative Validation Tests**: Invalid configurations that should fail
4. **Backward Compatibility Tests**: Existing actions continue to work
5. **Edge Case Tests**: Boundary conditions and unusual configurations
6. **Performance Tests**: Schema validation speed

## Implementation Steps

### Step 1: Create Action Schema Validation Tests

Create file: `tests/unit/schemas/multiTargetActionSchema.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { AjvSchemaValidator } from '../../../src/validation/ajvSchemaValidator.js';
import actionSchema from '../../../data/schemas/action.schema.json';
import { readFileSync } from 'fs';
import { glob } from 'glob';

describe('Multi-Target Action Schema Validation', () => {
  let validator;
  
  beforeEach(() => {
    validator = new AjvSchemaValidator();
    validator.addSchema('action', actionSchema);
  });
  
  describe('Schema Structure', () => {
    it('should have valid JSON Schema structure', () => {
      expect(actionSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(actionSchema.type).toBe('object');
      expect(actionSchema.definitions.targetDefinition).toBeDefined();
    });
    
    it('should define targetDefinition correctly', () => {
      const targetDef = actionSchema.definitions.targetDefinition;
      expect(targetDef.type).toBe('object');
      expect(targetDef.properties.scope).toBeDefined();
      expect(targetDef.properties.placeholder).toBeDefined();
      expect(targetDef.required).toEqual(['scope', 'placeholder']);
    });
  });
  
  describe('Backward Compatibility', () => {
    it('should accept legacy scope property', () => {
      const legacyAction = {
        id: 'test:legacy',
        name: 'Legacy Action',
        description: 'Uses old scope property',
        scope: 'test:valid_targets',
        template: 'test {target}'
      };
      
      const result = validator.validate('action', legacyAction);
      expect(result.valid).toBe(true);
    });
    
    it('should accept string targets property', () => {
      const stringTargetAction = {
        id: 'test:string_target',
        name: 'String Target',
        description: 'Uses string targets for compatibility',
        targets: 'test:valid_targets',
        template: 'test {target}'
      };
      
      const result = validator.validate('action', stringTargetAction);
      expect(result.valid).toBe(true);
    });
    
    it('should validate all existing core actions', async () => {
      const actionFiles = await glob('data/mods/core/actions/*.action.json');
      
      for (const file of actionFiles) {
        const content = readFileSync(file, 'utf-8');
        const action = JSON.parse(content);
        const result = validator.validate('action', action);
        
        expect(result.valid).toBe(true);
        if (!result.valid) {
          console.error(`Failed to validate ${file}:`, result.errors);
        }
      }
    });
  });
  
  describe('Multi-Target Validation', () => {
    describe('Valid Configurations', () => {
      it('should accept single primary target', () => {
        const action = {
          id: 'test:single_primary',
          name: 'Single Primary',
          description: 'Action with one target',
          targets: {
            primary: {
              scope: 'test:items',
              placeholder: 'item'
            }
          },
          template: 'use {item}'
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(true);
      });
      
      it('should accept primary and secondary targets', () => {
        const action = {
          id: 'test:two_targets',
          name: 'Two Targets',
          description: 'Action with two targets',
          targets: {
            primary: {
              scope: 'test:items',
              placeholder: 'item',
              description: 'The item to use'
            },
            secondary: {
              scope: 'test:actors',
              placeholder: 'target',
              description: 'The target actor'
            }
          },
          template: 'use {item} on {target}'
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(true);
      });
      
      it('should accept contextFrom reference', () => {
        const action = {
          id: 'test:context_aware',
          name: 'Context Aware',
          description: 'Secondary target uses primary context',
          targets: {
            primary: {
              scope: 'test:actors',
              placeholder: 'person'
            },
            secondary: {
              scope: 'test:target_items',
              placeholder: 'item',
              contextFrom: 'primary'
            }
          },
          template: 'take {item} from {person}'
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(true);
      });
      
      it('should accept optional targets', () => {
        const action = {
          id: 'test:optional_target',
          name: 'Optional Target',
          description: 'Action with optional secondary target',
          targets: {
            primary: {
              scope: 'test:required',
              placeholder: 'main'
            },
            secondary: {
              scope: 'test:optional',
              placeholder: 'extra',
              optional: true
            }
          },
          template: 'do {main} with optional {extra}'
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(true);
      });
      
      it('should accept generateCombinations flag', () => {
        const action = {
          id: 'test:combinations',
          name: 'Combinations',
          description: 'Generates all combinations',
          targets: {
            primary: {
              scope: 'test:items',
              placeholder: 'item'
            },
            secondary: {
              scope: 'test:targets',
              placeholder: 'target'
            }
          },
          template: 'throw {item} at {target}',
          generateCombinations: true
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(true);
      });
    });
    
    describe('Invalid Configurations', () => {
      it('should reject both targets and scope', () => {
        const action = {
          id: 'test:both_props',
          name: 'Both Properties',
          description: 'Has both targets and scope',
          targets: 'test:targets',
          scope: 'test:scope', // Should not have both
          template: 'test {target}'
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            message: expect.stringContaining('scope')
          })
        );
      });
      
      it('should reject invalid placeholder names', () => {
        const action = {
          id: 'test:bad_placeholder',
          name: 'Bad Placeholder',
          description: 'Invalid placeholder pattern',
          targets: {
            primary: {
              scope: 'test:items',
              placeholder: '123invalid' // Starts with number
            }
          },
          template: 'use {123invalid}'
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(false);
      });
      
      it('should reject invalid contextFrom values', () => {
        const action = {
          id: 'test:bad_context',
          name: 'Bad Context',
          description: 'Invalid contextFrom',
          targets: {
            primary: {
              scope: 'test:items',
              placeholder: 'item'
            },
            secondary: {
              scope: 'test:targets',
              placeholder: 'target',
              contextFrom: 'tertiary' // Only 'primary' allowed currently
            }
          },
          template: 'use {item} on {target}'
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(false);
      });
      
      it('should reject missing required fields', () => {
        const action = {
          id: 'test:missing_fields',
          name: 'Missing Fields',
          description: 'Missing template',
          targets: {
            primary: {
              scope: 'test:items',
              placeholder: 'item'
            }
          }
          // Missing template
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(false);
      });
      
      it('should reject empty targets object', () => {
        const action = {
          id: 'test:empty_targets',
          name: 'Empty Targets',
          description: 'No target definitions',
          targets: {}, // Empty object
          template: 'test'
        };
        
        const result = validator.validate('action', action);
        expect(result.valid).toBe(false);
      });
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle very long placeholder names', () => {
      const action = {
        id: 'test:long_placeholder',
        name: 'Long Placeholder',
        description: 'Very long placeholder name',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'a'.repeat(100) // 100 character placeholder
          }
        },
        template: `use {${'a'.repeat(100)}}`
      };
      
      const result = validator.validate('action', action);
      expect(result.valid).toBe(true);
    });
    
    it('should handle unicode in descriptions', () => {
      const action = {
        id: 'test:unicode',
        name: 'Unicode Test',
        description: 'Test with émojis 🎮 and special chars',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
            description: 'The item to use 🎯'
          }
        },
        template: 'use {item}'
      };
      
      const result = validator.validate('action', action);
      expect(result.valid).toBe(true);
    });
  });
});
```

### Step 2: Create Target Context Schema Tests

Create file: `tests/unit/schemas/targetContextSchema.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { AjvSchemaValidator } from '../../../src/validation/ajvSchemaValidator.js';
import targetContextSchema from '../../../data/schemas/target-context.schema.json';

describe('Target Context Schema Validation', () => {
  let validator;
  
  beforeEach(() => {
    validator = new AjvSchemaValidator();
    validator.addSchema('target-context', targetContextSchema);
  });
  
  describe('Schema Structure', () => {
    it('should have valid JSON Schema structure', () => {
      expect(targetContextSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(targetContextSchema.type).toBe('object');
      expect(targetContextSchema.required).toContain('actor');
      expect(targetContextSchema.required).toContain('location');
      expect(targetContextSchema.required).toContain('game');
    });
  });
  
  describe('Valid Contexts', () => {
    it('should accept minimal valid context', () => {
      const context = {
        actor: {
          id: 'player_123',
          components: {}
        },
        location: {
          id: 'room_456',
          components: {}
        },
        game: {
          turnNumber: 0
        }
      };
      
      const result = validator.validate('target-context', context);
      expect(result.valid).toBe(true);
    });
    
    it('should accept context with components', () => {
      const context = {
        actor: {
          id: 'player_123',
          components: {
            'core:inventory': {
              items: ['sword_001', 'potion_002']
            },
            'core:stats': {
              health: 100,
              mana: 50
            }
          }
        },
        location: {
          id: 'room_456',
          components: {
            'core:description': {
              name: 'Tavern',
              description: 'A cozy tavern'
            }
          }
        },
        game: {
          turnNumber: 42,
          timeOfDay: 'evening',
          weather: 'rainy'
        }
      };
      
      const result = validator.validate('target-context', context);
      expect(result.valid).toBe(true);
    });
    
    it('should accept context with target', () => {
      const context = {
        actor: {
          id: 'player_123',
          components: {}
        },
        target: {
          id: 'npc_789',
          components: {
            'clothing:equipment': {
              equipped: {
                torso_upper: {
                  outer: 'jacket_001'
                }
              }
            }
          }
        },
        location: {
          id: 'room_456',
          components: {}
        },
        game: {
          turnNumber: 1
        }
      };
      
      const result = validator.validate('target-context', context);
      expect(result.valid).toBe(true);
    });
    
    it('should accept context with targets array', () => {
      const context = {
        actor: {
          id: 'player_123',
          components: {}
        },
        targets: {
          primary: [
            {
              id: 'item_001',
              components: {}
            },
            {
              id: 'item_002',
              components: {}
            }
          ],
          secondary: [
            {
              id: 'npc_001',
              components: {}
            }
          ]
        },
        location: {
          id: 'room_456',
          components: {}
        },
        game: {
          turnNumber: 1
        }
      };
      
      const result = validator.validate('target-context', context);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Invalid Contexts', () => {
    it('should reject missing required fields', () => {
      const invalidContexts = [
        {
          // Missing actor
          location: { id: 'room', components: {} },
          game: { turnNumber: 0 }
        },
        {
          // Missing location
          actor: { id: 'player', components: {} },
          game: { turnNumber: 0 }
        },
        {
          // Missing game
          actor: { id: 'player', components: {} },
          location: { id: 'room', components: {} }
        }
      ];
      
      for (const context of invalidContexts) {
        const result = validator.validate('target-context', context);
        expect(result.valid).toBe(false);
      }
    });
    
    it('should reject invalid entity structure', () => {
      const context = {
        actor: {
          id: 'player',
          // Missing components
        },
        location: {
          id: 'room',
          components: {}
        },
        game: {
          turnNumber: 0
        }
      };
      
      const result = validator.validate('target-context', context);
      expect(result.valid).toBe(false);
    });
    
    it('should reject invalid game state', () => {
      const context = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: {
          // Missing turnNumber
          timeOfDay: 'morning'
        }
      };
      
      const result = validator.validate('target-context', context);
      expect(result.valid).toBe(false);
    });
    
    it('should reject invalid timeOfDay enum', () => {
      const context = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: {} },
        game: {
          turnNumber: 0,
          timeOfDay: 'invalid_time' // Not in enum
        }
      };
      
      const result = validator.validate('target-context', context);
      expect(result.valid).toBe(false);
    });
  });
});
```

### Step 3: Create Performance Tests

Create file: `tests/performance/schemas/schemaValidationPerformance.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { AjvSchemaValidator } from '../../../src/validation/ajvSchemaValidator.js';
import actionSchema from '../../../data/schemas/action.schema.json';
import targetContextSchema from '../../../data/schemas/target-context.schema.json';

describe('Schema Validation Performance', () => {
  let validator;
  
  beforeEach(() => {
    validator = new AjvSchemaValidator();
    validator.addSchema('action', actionSchema);
    validator.addSchema('target-context', targetContextSchema);
  });
  
  describe('Action Schema Performance', () => {
    it('should validate simple actions quickly', () => {
      const action = {
        id: 'test:simple',
        name: 'Simple',
        description: 'Test',
        targets: 'test:targets',
        template: 'test {target}'
      };
      
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        validator.validate('action', action);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      expect(avgTime).toBeLessThan(5); // < 5ms average
    });
    
    it('should validate complex multi-target actions quickly', () => {
      const action = {
        id: 'test:complex',
        name: 'Complex',
        description: 'Complex multi-target action',
        targets: {
          primary: {
            scope: 'test:items',
            placeholder: 'item',
            description: 'The item to use'
          },
          secondary: {
            scope: 'test:targets',
            placeholder: 'target',
            description: 'The target',
            contextFrom: 'primary',
            optional: true
          }
        },
        template: 'use {item} on {target}',
        generateCombinations: true,
        required_components: {
          actor: ['core:inventory', 'core:stats']
        },
        forbidden_components: {
          actor: ['core:immobilized']
        },
        prerequisites: [
          {
            logic: { '>=': [{ var: 'actor.stats.mana' }, 10] },
            failure_message: 'Not enough mana'
          }
        ]
      };
      
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        validator.validate('action', action);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      expect(avgTime).toBeLessThan(10); // < 10ms average
    });
  });
  
  describe('Context Schema Performance', () => {
    it('should validate contexts quickly', () => {
      const context = {
        actor: {
          id: 'player',
          components: {
            'core:inventory': { items: Array(100).fill('item') },
            'core:stats': { health: 100, mana: 50 }
          }
        },
        target: {
          id: 'npc',
          components: {
            'clothing:equipment': { equipped: {} }
          }
        },
        targets: {
          primary: Array(10).fill({ id: 'item', components: {} }),
          secondary: Array(10).fill({ id: 'npc', components: {} })
        },
        location: {
          id: 'room',
          components: {}
        },
        game: {
          turnNumber: 42,
          timeOfDay: 'afternoon',
          weather: 'sunny'
        }
      };
      
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        validator.validate('target-context', context);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      expect(avgTime).toBeLessThan(1); // < 1ms average
    });
  });
});
```

### Step 4: Create Integration Tests

Create file: `tests/integration/schemas/schemaIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { ScopeInterpreter } from '../../../src/scopeDsl/scopeInterpreter.js';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Schema Integration Tests', () => {
  let testBed;
  let processor;
  let interpreter;
  
  beforeEach(() => {
    testBed = new IntegrationTestBed();
    processor = testBed.getService('actionCandidateProcessor');
    interpreter = testBed.getService('scopeInterpreter');
  });
  
  it('should process multi-target actions with valid schemas', async () => {
    // Create multi-target action
    const action = {
      id: 'test:throw',
      name: 'Throw',
      description: 'Throw item at target',
      targets: {
        primary: {
          scope: 'test:throwable_items',
          placeholder: 'item'
        },
        secondary: {
          scope: 'test:valid_targets',
          placeholder: 'target'
        }
      },
      template: 'throw {item} at {target}',
      generateCombinations: true
    };
    
    // Create test entities
    const actor = testBed.createEntity('player', {
      'core:inventory': { items: ['rock_001', 'rock_002'] }
    });
    
    const target1 = testBed.createEntity('goblin_001', {
      'core:position': { locationId: 'room_001' }
    });
    
    const target2 = testBed.createEntity('goblin_002', {
      'core:position': { locationId: 'room_001' }
    });
    
    // Process action
    const result = await processor.process(action, actor, {
      location: 'room_001'
    });
    
    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(4); // 2 items × 2 targets
  });
  
  it('should build valid context for dependent scopes', async () => {
    // Create scope that uses context
    const scope = 'target.topmost_clothing[]';
    
    // Create context with schema-valid structure
    const context = {
      actor: {
        id: 'player',
        components: {}
      },
      target: {
        id: 'npc',
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: {
                outer: 'jacket_001'
              }
            }
          }
        }
      },
      location: {
        id: 'room',
        components: {}
      },
      game: {
        turnNumber: 1
      }
    };
    
    // Evaluate scope
    const result = await interpreter.evaluate(scope, context);
    
    expect(result).toContain('jacket_001');
  });
});
```

## Testing Strategy

### Test Execution Order

1. **Schema Structure Tests** - Verify schemas are well-formed
2. **Unit Tests** - Test individual validation rules
3. **Integration Tests** - Test schemas in real system
4. **Performance Tests** - Ensure validation speed
5. **Regression Tests** - Verify existing content works

### Test Data Management

Create test fixtures directory: `tests/fixtures/schemas/`

```javascript
// tests/fixtures/schemas/validActions.js
export const validActions = {
  legacy: {
    id: 'test:legacy',
    name: 'Legacy',
    description: 'Legacy action',
    scope: 'test:targets',
    template: 'test {target}'
  },
  
  multiTarget: {
    id: 'test:multi',
    name: 'Multi',
    description: 'Multi-target',
    targets: {
      primary: {
        scope: 'test:items',
        placeholder: 'item'
      },
      secondary: {
        scope: 'test:targets',
        placeholder: 'target'
      }
    },
    template: 'use {item} on {target}'
  }
};

// tests/fixtures/schemas/invalidActions.js
export const invalidActions = {
  bothProperties: {
    id: 'test:invalid',
    name: 'Invalid',
    description: 'Has both properties',
    targets: 'test:targets',
    scope: 'test:scope',
    template: 'test'
  },
  
  missingRequired: {
    id: 'test:incomplete',
    name: 'Incomplete',
    // Missing description and template
    targets: 'test:targets'
  }
};
```

## Acceptance Criteria

1. ✅ All schema structure tests pass
2. ✅ Valid configurations are accepted
3. ✅ Invalid configurations are rejected with clear errors
4. ✅ All existing action files validate successfully
5. ✅ Performance targets met (<5ms simple, <10ms complex)
6. ✅ Integration tests show schemas work in system
7. ✅ Test coverage >95% for schema validation code
8. ✅ Edge cases handled gracefully
9. ✅ Clear error messages for validation failures
10. ✅ Test fixtures organized and reusable

## Common Validation Errors

Document common errors for modders:

```markdown
## Common Schema Validation Errors

### Action Schema

1. **Both targets and scope**: Cannot use both properties
   - Solution: Use only `targets` (preferred) or `scope` (legacy)

2. **Invalid placeholder**: Must start with letter, alphanumeric+underscore
   - Bad: `123item`, `item-name`, `item.type`
   - Good: `item`, `item_name`, `itemType`

3. **Invalid contextFrom**: Currently only supports "primary"
   - Bad: `contextFrom: "secondary"`
   - Good: `contextFrom: "primary"`

### Context Schema

1. **Missing required fields**: Must have actor, location, game
2. **Invalid entity structure**: Entities must have id and components
3. **Invalid timeOfDay**: Must be one of the allowed values
```

## Performance Optimization

- Pre-compile schemas for faster validation
- Cache validation results within same turn
- Use fast-json-stringify for context building
- Minimize schema complexity where possible

## Future Enhancements

- Property-based testing with fast-check
- Visual schema documentation generator
- Schema migration tooling
- Real-time validation in mod editor
# Ticket: Write Migration Guide

## Ticket ID: PHASE5-TICKET16
## Priority: Low
## Estimated Time: 6-8 hours
## Dependencies: PHASE5-TICKET15
## Blocks: PHASE5-TICKET17

## Overview

Create a comprehensive migration guide for developers and modders transitioning from single-target actions to the new multi-target action system. This guide will provide step-by-step instructions, examples, and best practices for upgrading existing actions while maintaining backward compatibility.

## Goals

1. **Seamless Migration**: Clear path from legacy to multi-target format
2. **Backward Compatibility**: Ensure existing actions continue working
3. **Best Practices**: Guide for optimal multi-target implementation
4. **Troubleshooting**: Common migration issues and solutions
5. **Gradual Transition**: Support for phased migration approach

## Migration Categories

1. **Simple Single-Target Conversions**: Basic target wrapping
2. **Enhanced Single-Target**: Adding validation and optimization
3. **True Multi-Target**: Converting to multiple targets
4. **Context-Dependent**: Adding target dependencies
5. **Performance Optimization**: Improving existing actions

## Implementation Steps

### Step 1: Create Main Migration Guide

Create file: `docs/migration/single-to-multi-target-actions.md`

```markdown
# Migration Guide: Single-Target to Multi-Target Actions

This guide helps you migrate existing single-target actions to the new multi-target action system while maintaining backward compatibility and improving functionality.

## Overview

The new multi-target action system is **fully backward compatible** with existing single-target actions. You can migrate actions incrementally without breaking existing gameplay.

### Migration Benefits

- **Multiple Targets**: Support actions with multiple different targets
- **Context Dependencies**: Later targets can use data from earlier targets
- **Better Validation**: Enhanced target validation with JSON Schema
- **Performance Optimization**: Built-in combination limits and caching
- **Improved UX**: More flexible and intuitive action definitions

### Migration Timeline

**Phase 1**: Existing actions continue working unchanged
**Phase 2**: Gradually convert high-priority actions to multi-target format
**Phase 3**: Add new multi-target features (context dependencies, validation)
**Phase 4**: Optimize performance and add advanced patterns

## Understanding the Changes

### Old Format (Single-Target)

```json
{
  "id": "core:give_item",
  "name": "give {target}",
  "target": {
    "scope": "location.core:actors[]",
    "validation": { "conscious": true }
  },
  "conditions": [
    {
      "description": "Target must be conscious",
      "condition": { "var": "target.conscious" }
    }
  ],
  "effects": [
    {
      "operation": {
        "type": "dispatchEvent",
        "eventType": "ITEM_GIVEN",
        "payload": {
          "recipient": "target.id"
        }
      }
    }
  ],
  "command": "give item to {target.name}",
  "result": "You give the item to {target.name}."
}
```

### New Format (Multi-Target)

```json
{
  "id": "core:give_item_enhanced",
  "name": "give {item} to {person}",
  "targetDefinitions": {
    "item": {
      "name": "item",
      "description": "Item to give",
      "scope": "actor.core:inventory.items[]",
      "required": true,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:item": {
                "type": "object",
                "properties": {
                  "tradeable": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    },
    "person": {
      "name": "person",
      "description": "Person to receive the item",
      "scope": "location.core:actors[]",
      "required": true,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:actor": {
                "type": "object",
                "properties": {
                  "conscious": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    }
  },
  "conditions": [
    {
      "description": "Both actor and recipient must be conscious",
      "condition": {
        "and": [
          { "var": "actor.components.core:actor.conscious" },
          { "var": "person.components.core:actor.conscious" }
        ]
      }
    }
  ],
  "effects": [
    {
      "description": "Remove item from actor's inventory",
      "operation": {
        "type": "modifyComponent",
        "entityId": "actor.id",
        "componentId": "core:inventory",
        "modifications": {
          "items": {
            "operation": "remove",
            "value": "item.id"
          }
        }
      }
    },
    {
      "description": "Add item to recipient's inventory",
      "operation": {
        "type": "modifyComponent",
        "entityId": "person.id",
        "componentId": "core:inventory",
        "modifications": {
          "items": {
            "operation": "add",
            "value": "item.id"
          }
        }
      }
    },
    {
      "description": "Dispatch enhanced give event",
      "operation": {
        "type": "dispatchEvent",
        "eventType": "ITEM_GIVEN_ENHANCED",
        "payload": {
          "giver": "actor.id",
          "recipient": "person.id",
          "item": "item.id",
          "itemName": "item.components.core:item.name"
        }
      }
    }
  ],
  "command": "give {item.components.core:item.name} to {person.components.core:actor.name}",
  "result": "You give {item.components.core:item.name} to {person.components.core:actor.name}."
}
```

## Migration Strategies

### Strategy 1: Minimal Conversion (Backward Compatible)

Convert existing single-target to multi-target format with minimal changes:

**Step 1**: Wrap target in `targetDefinitions`

```json
// Before
{
  "target": {
    "scope": "location.core:actors[]",
    "validation": { "conscious": true }
  }
}

// After
{
  "targetDefinitions": {
    "target": {
      "name": "target",
      "description": "Target for the action",
      "scope": "location.core:actors[]",
      "required": true,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:actor": {
                "type": "object",
                "properties": {
                  "conscious": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Step 2**: Update template references

```json
// Before
{
  "command": "talk to {target.name}",
  "result": "You talk to {target.name}."
}

// After
{
  "command": "talk to {target.components.core:actor.name}",
  "result": "You talk to {target.components.core:actor.name}."
}
```

### Strategy 2: Enhanced Single-Target

Improve existing actions with better validation and features:

```json
{
  "targetDefinitions": {
    "target": {
      "name": "conversation partner",
      "description": "Person to have a conversation with",
      "scope": "location.core:actors[]",
      "required": true,
      "maxCombinations": 5,
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:actor": {
                "type": "object",
                "properties": {
                  "conscious": { "type": "boolean", "const": true },
                  "willing_to_talk": { "type": "boolean", "const": true }
                },
                "required": ["conscious", "willing_to_talk"]
              }
            },
            "required": ["core:actor"]
          }
        }
      }
    }
  }
}
```

### Strategy 3: True Multi-Target Conversion

Transform single-target actions into multi-target actions:

**Example**: Convert "use item" to "use {tool} on {target}"

```json
// Before: Generic use action
{
  "id": "core:use_item",
  "name": "use {target}",
  "target": {
    "scope": "actor.core:inventory.items[] | location.core:objects[]"
  }
}

// After: Specific tool usage
{
  "id": "core:use_tool_on_target",
  "name": "use {tool} on {target}",
  "targetDefinitions": {
    "tool": {
      "name": "tool",
      "description": "Tool or item to use",
      "scope": "actor.core:inventory.items[]",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:item": {
                "type": "object",
                "properties": {
                  "usable": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    },
    "target": {
      "name": "target",
      "description": "Object or person to use the tool on",
      "scope": "location.core:actors[] | location.core:objects[]",
      "validation": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "not": { "const": "actor.id" }
          }
        }
      }
    }
  }
}
```

### Strategy 4: Context-Dependent Actions

Add context dependencies for advanced interactions:

```json
{
  "targetDefinitions": {
    "container": {
      "name": "container",
      "description": "Locked container to unlock",
      "scope": "location.core:objects[]",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:container": {
                "type": "object",
                "properties": {
                  "locked": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    },
    "key": {
      "name": "key",
      "description": "Key that can unlock this container",
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "container",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:key": {
                "type": "object",
                "properties": {
                  "types": {
                    "type": "array",
                    "contains": {
                      "const": { "var": "target.components.core:container.lock_type" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Step-by-Step Migration Process

### Phase 1: Preparation and Analysis

**Step 1**: Inventory Existing Actions
```bash
# Find all action files
find data/mods -name "*.action.json" -type f

# Analyze action complexity
grep -r "target" data/mods --include="*.action.json" | wc -l
```

**Step 2**: Categorize Actions by Migration Complexity

- **Simple**: Single target, basic validation
- **Moderate**: Single target, complex validation or conditions
- **Complex**: Multiple implicit targets or complex logic
- **Advanced**: Actions that would benefit from context dependencies

**Step 3**: Create Migration Plan

```json
{
  "migrationPlan": {
    "phase1": {
      "duration": "1-2 weeks",
      "actions": ["simple_talk", "basic_move", "simple_examine"],
      "strategy": "minimal_conversion"
    },
    "phase2": {
      "duration": "2-3 weeks", 
      "actions": ["give_item", "use_item", "attack"],
      "strategy": "enhanced_single_target"
    },
    "phase3": {
      "duration": "3-4 weeks",
      "actions": ["trade", "craft", "unlock"],
      "strategy": "true_multi_target"
    }
  }
}
```

### Phase 2: Conversion Process

**Step 1**: Create Migration Script Template

```javascript
// migration-helper.js
class ActionMigrator {
  static convertSingleToMultiTarget(oldAction) {
    const newAction = {
      id: oldAction.id,
      name: oldAction.name,
      description: oldAction.description,
      category: oldAction.category,
      targetDefinitions: {}
    };

    // Convert target to targetDefinitions
    if (oldAction.target) {
      newAction.targetDefinitions.target = {
        name: "target",
        description: "Target for the action",
        scope: oldAction.target.scope,
        required: true,
        validation: this.convertValidation(oldAction.target.validation)
      };
    }

    // Update conditions and effects
    newAction.conditions = this.updateConditions(oldAction.conditions);
    newAction.effects = this.updateEffects(oldAction.effects);
    
    // Update templates
    newAction.command = this.updateTemplate(oldAction.command);
    newAction.result = this.updateTemplate(oldAction.result);

    return newAction;
  }

  static convertValidation(oldValidation) {
    if (!oldValidation) return undefined;
    
    // Convert simple validation to JSON Schema
    return {
      type: "object",
      properties: {
        components: {
          type: "object",
          // Add component-specific validation based on old format
        }
      }
    };
  }

  static updateTemplate(template) {
    if (!template) return template;
    
    // Update template variable references
    return template
      .replace(/\{target\.name\}/g, '{target.components.core:actor.name || target.components.core:object.name}')
      .replace(/\{target\.(\w+)\}/g, '{target.components.core:actor.$1 || target.components.core:object.$1}');
  }
}
```

**Step 2**: Migrate Actions Systematically

```javascript
// Example migration for specific action
const oldGiveAction = {
  "id": "core:give_item",
  "name": "give item to {target}",
  "target": {
    "scope": "location.core:actors[]",
    "validation": { "conscious": true }
  },
  "command": "give item to {target.name}",
  "result": "You give the item to {target.name}."
};

const newGiveAction = {
  "id": "core:give_item_v2",
  "name": "give {item} to {person}",
  "targetDefinitions": {
    "item": {
      "name": "item",
      "description": "Item to give away",
      "scope": "actor.core:inventory.items[]",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:item": {
                "type": "object",
                "properties": {
                  "tradeable": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    },
    "person": {
      "name": "person", 
      "description": "Person to receive the item",
      "scope": "location.core:actors[]",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:actor": {
                "type": "object",
                "properties": {
                  "conscious": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    }
  },
  "command": "give {item.components.core:item.name} to {person.components.core:actor.name}",
  "result": "You give {item.components.core:item.name} to {person.components.core:actor.name}."
};
```

### Phase 3: Testing and Validation

**Step 1**: Create Migration Tests

```javascript
// migration.test.js
describe('Action Migration', () => {
  describe('Single to Multi-Target Conversion', () => {
    it('should convert basic single-target action', () => {
      const oldAction = loadAction('test:old_talk');
      const newAction = ActionMigrator.convertSingleToMultiTarget(oldAction);
      
      expect(newAction.targetDefinitions).toBeDefined();
      expect(newAction.targetDefinitions.target).toBeDefined();
      expect(newAction.targetDefinitions.target.scope).toBe(oldAction.target.scope);
    });

    it('should maintain backward compatibility', async () => {
      const testBed = new IntegrationTestBed();
      
      // Test old action still works
      const oldResult = await testBed.processAction('core:give_item_old', 'player');
      expect(oldResult.success).toBe(true);
      
      // Test new action works better
      const newResult = await testBed.processAction('core:give_item_v2', 'player');
      expect(newResult.success).toBe(true);
      expect(newResult.value.actions.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Comparison', () => {
    it('should perform at least as well as old actions', async () => {
      const testBed = new IntegrationTestBed();
      
      const oldStart = performance.now();
      await testBed.processAction('core:old_action', 'player');
      const oldDuration = performance.now() - oldStart;
      
      const newStart = performance.now();
      await testBed.processAction('core:new_action', 'player');
      const newDuration = performance.now() - newStart;
      
      expect(newDuration).toBeLessThanOrEqual(oldDuration * 1.5); // Allow 50% overhead
    });
  });
});
```

**Step 2**: Validation Checklist

```markdown
## Migration Validation Checklist

### Functionality
- [ ] Action appears in available actions list
- [ ] Target resolution works correctly
- [ ] Conditions evaluate properly  
- [ ] Effects execute successfully
- [ ] Command text displays correctly
- [ ] Result text shows properly

### Performance
- [ ] Target resolution time d old action time + 50%
- [ ] Memory usage similar to old actions
- [ ] No memory leaks during repeated execution
- [ ] Combination limits prevent excessive processing

### Compatibility
- [ ] Existing save games work unchanged
- [ ] Event payloads remain compatible
- [ ] Rule system integration functions
- [ ] AI memory system compatibility maintained

### Quality
- [ ] Error handling improved or maintained
- [ ] User experience enhanced
- [ ] Code maintainability improved
- [ ] Documentation updated
```

## Common Migration Patterns

### Pattern 1: Simple Target Wrapping

**Use Case**: Basic actions with single target

```json
// Before
{
  "target": { "scope": "location.core:actors[]" }
}

// After  
{
  "targetDefinitions": {
    "target": {
      "name": "target",
      "description": "Target for action",
      "scope": "location.core:actors[]"
    }
  }
}
```

### Pattern 2: Enhanced Validation

**Use Case**: Actions needing better target validation

```json
// Before
{
  "target": {
    "scope": "location.core:actors[]",
    "validation": { "conscious": true }
  }
}

// After
{
  "targetDefinitions": {
    "target": {
      "scope": "location.core:actors[]",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:actor": {
                "type": "object",
                "properties": {
                  "conscious": { "type": "boolean", "const": true },
                  "alive": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Pattern 3: Multi-Target Expansion

**Use Case**: Actions that can benefit from multiple targets

```json
// Before: Generic "use" action
{
  "id": "core:use",
  "name": "use {target}",
  "target": { "scope": "actor.core:inventory.items[]" }
}

// After: Specific tool usage
{
  "id": "core:use_tool_on",
  "name": "use {tool} on {target}",
  "targetDefinitions": {
    "tool": {
      "scope": "actor.core:inventory.items[]",
      "validation": { "usable": true }
    },
    "target": {
      "scope": "location.core:actors[] | location.core:objects[]"
    }
  }
}
```

### Pattern 4: Context Dependencies

**Use Case**: Actions where one target affects another

```json
{
  "targetDefinitions": {
    "container": {
      "scope": "location.core:objects[]",
      "validation": { "locked": true }
    },
    "key": {
      "scope": "actor.core:inventory.items[]",
      "contextFrom": "container",
      "validation": { "matches_lock": true }
    }
  }
}
```

## Troubleshooting Migration Issues

### Issue 1: Target Resolution Fails

**Problem**: Converted action doesn't find valid targets

**Solution**:
1. Check scope expression syntax
2. Verify validation schema format
3. Test with simplified validation first
4. Add debug logging for target resolution

```javascript
// Debug target resolution
console.log('Scope result:', await scopeInterpreter.evaluate(scope, context));
console.log('Validation result:', ajvValidator.validate(schema, entity));
```

### Issue 2: Template Variables Undefined

**Problem**: Action text shows {undefined} or {null}

**Solution**:
1. Update template variable paths
2. Add fallback values
3. Check entity component structure

```json
// Safe template with fallbacks
{
  "command": "talk to {target.components.core:actor.name || target.id}"
}
```

### Issue 3: Performance Degradation

**Problem**: Migrated actions are significantly slower

**Solution**:
1. Add combination limits
2. Optimize scope expressions
3. Move validation to scope level
4. Profile and benchmark

```json
{
  "maxCombinations": 25,
  "targetDefinitions": {
    "target": {
      "maxCombinations": 5,
      "scope": "location.core:actors[{\"conscious\": true}]" // Filter in scope
    }
  }
}
```

### Issue 4: Validation Too Restrictive

**Problem**: No targets pass new validation

**Solution**:
1. Start with minimal validation
2. Add validation incrementally
3. Test with known good entities
4. Check entity component data

```json
// Start simple
{
  "validation": {
    "type": "object"
  }
}

// Add complexity gradually
{
  "validation": {
    "type": "object",
    "properties": {
      "components": {
        "type": "object",
        "properties": {
          "core:actor": { "type": "object" }
        }
      }
    }
  }
}
```

## Best Practices for Migration

### 1. Plan Incrementally

- Start with simple, high-usage actions
- Test thoroughly before moving to complex actions
- Maintain old actions during transition period
- Use feature flags for gradual rollout

### 2. Maintain Compatibility

- Keep old action IDs functional
- Ensure event payloads remain compatible
- Test with existing save games
- Provide deprecation warnings, not breaking changes

### 3. Improve Gradually

- Add basic multi-target support first
- Enhance with validation and optimization later
- Add context dependencies only when beneficial
- Document improvements and migration rationale

### 4. Test Extensively

- Unit test each migrated action
- Integration test with full game systems
- Performance test with realistic data sets
- User acceptance test with actual gameplay

### 5. Document Changes

- Record migration decisions and rationale
- Update action documentation
- Create examples for common patterns
- Share lessons learned with team

## Migration Timeline Example

### Week 1-2: Preparation
- [ ] Analyze existing actions
- [ ] Create migration plan
- [ ] Set up migration tools
- [ ] Create test framework

### Week 3-4: Simple Actions
- [ ] Migrate basic single-target actions
- [ ] Test compatibility
- [ ] Update documentation
- [ ] Monitor performance

### Week 5-7: Enhanced Actions  
- [ ] Add improved validation
- [ ] Optimize performance
- [ ] Add combination limits
- [ ] Test with larger datasets

### Week 8-10: Multi-Target Actions
- [ ] Convert suitable actions to multi-target
- [ ] Add context dependencies where beneficial
- [ ] Create new multi-target actions
- [ ] Comprehensive testing

### Week 11-12: Optimization & Cleanup
- [ ] Performance optimization
- [ ] Code cleanup
- [ ] Documentation completion
- [ ] Training and handoff

## Success Metrics

### Functionality Metrics
- 100% of migrated actions work correctly
- 0 breaking changes to existing gameplay
- Improved action validation and error handling
- Enhanced user experience with better action descriptions

### Performance Metrics
- Migration overhead d 20% for simple actions
- No memory leaks in migrated actions
- Target resolution time d 100ms for complex actions
- Combination generation respects performance limits

### Quality Metrics
- Improved test coverage (e 90%)
- Reduced technical debt
- Better code maintainability
- Comprehensive documentation

Remember: Migration is a process, not a destination. Take time to do it right, test thoroughly, and maintain backward compatibility throughout the transition.
```

### Step 2: Create Quick Migration Reference

Create file: `docs/migration/quick-migration-reference.md`

```markdown
# Quick Migration Reference

Fast reference for common migration scenarios and patterns.

## Basic Conversion Checklist

### 1. Wrap Target Definition
```json
// Before
{ "target": { "scope": "...", "validation": {...} } }

// After  
{ "targetDefinitions": { "target": { "name": "...", "scope": "...", "validation": {...} } } }
```

### 2. Update Template Variables
```json
// Before
{ "command": "action {target.property}" }

// After
{ "command": "action {target.components.namespace:component.property}" }
```

### 3. Convert Validation
```json
// Before
{ "validation": { "property": "value" } }

// After
{
  "validation": {
    "type": "object",
    "properties": {
      "components": {
        "type": "object", 
        "properties": {
          "namespace:component": {
            "type": "object",
            "properties": {
              "property": { "const": "value" }
            }
          }
        }
      }
    }
  }
}
```

## Common Migration Patterns

### Pattern: Talk Action
```json
// Before
{
  "id": "core:talk",
  "name": "talk to {target}",
  "target": {
    "scope": "location.core:actors[]",
    "validation": { "conscious": true }
  }
}

// After
{
  "id": "core:talk_v2", 
  "name": "talk to {person}",
  "targetDefinitions": {
    "person": {
      "name": "person",
      "description": "Person to talk to",
      "scope": "location.core:actors[]",
      "validation": {
        "type": "object",
        "properties": {
          "components": {
            "type": "object",
            "properties": {
              "core:actor": {
                "type": "object",
                "properties": {
                  "conscious": { "type": "boolean", "const": true }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Pattern: Use Item ’ Use Tool On Target
```json
// Before
{
  "id": "core:use",
  "name": "use {target}",
  "target": { "scope": "actor.core:inventory.items[]" }
}

// After
{
  "id": "core:use_tool",
  "name": "use {tool} on {target}",
  "targetDefinitions": {
    "tool": {
      "scope": "actor.core:inventory.items[]",
      "validation": { "usable": true }
    },
    "target": {
      "scope": "location.core:actors[] | location.core:objects[]"
    }
  }
}
```

### Pattern: Give Item
```json
// Before: Implicit item selection
{
  "id": "core:give",
  "name": "give item to {target}",
  "target": { "scope": "location.core:actors[]" }
}

// After: Explicit item and person selection
{
  "id": "core:give_explicit",
  "name": "give {item} to {person}",
  "targetDefinitions": {
    "item": {
      "scope": "actor.core:inventory.items[]",
      "validation": { "tradeable": true }
    },
    "person": {
      "scope": "location.core:actors[]",
      "validation": { "conscious": true }
    }
  }
}
```

## Quick Troubleshooting

### No Targets Found
1. Check scope syntax: `actor.core:inventory.items[]`
2. Verify validation schema format
3. Test with minimal validation: `{ "type": "object" }`
4. Add combination limits: `"maxCombinations": 10`

### Template Errors
1. Update paths: `{target.name}` ’ `{target.components.core:actor.name}`
2. Add fallbacks: `{target.components.core:actor.name || target.id}`
3. Check component structure in test data

### Performance Issues
1. Add limits: `"maxCombinations": 25`
2. Filter in scope: `location.core:actors[{"conscious": true}]`
3. Use specific scopes: `actor.core:inventory.weapons[]`

### Validation Failures
1. Start simple: `{ "type": "object" }`
2. Add properties incrementally
3. Check required vs optional fields
4. Test with known good entities

## Migration Commands

### Find Actions to Migrate
```bash
# Find all single-target actions
grep -r '"target"' data/mods --include="*.action.json"

# Find actions by complexity
grep -r '"scope".*\[\]' data/mods --include="*.action.json" | wc -l
```

### Test Migration
```bash
# Run migration tests
npm run test:migration

# Test specific action
npm run test -- --grep "migration.*give_item"

# Performance test
npm run test:performance:migration
```

### Validate Migrated Actions
```bash
# Schema validation
npm run validate:actions

# Lint migrated actions
npm run lint:actions

# Full integration test
npm run test:integration:actions
```

## Common Gotchas

1. **Template Variables**: Don't forget `components.` in paths
2. **Validation Schema**: Always specify `"type": "object"`
3. **Scope Syntax**: Use brackets for arrays: `items[]`
4. **Context Dependencies**: Ensure target order in definitions
5. **Performance**: Always set `maxCombinations` for multi-target actions

## Emergency Rollback

If migration causes issues:

1. **Revert Action Files**: Use git to restore old versions
2. **Update Action IDs**: Change game.json to use old action IDs  
3. **Clear Cache**: Restart application to clear cached actions
4. **Test Functionality**: Verify old actions work correctly
5. **Plan Fix**: Analyze issues and plan corrective migration

```bash
# Quick rollback commands
git checkout HEAD~1 -- data/mods/core/actions/
npm run restart
npm run test:integration
```
```

### Step 3: Create Migration Tools

Create file: `tools/migration/action-migrator.js`

```javascript
/**
 * Action Migration Tool
 * Helps convert single-target actions to multi-target format
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ActionMigrator {
  constructor(options = {}) {
    this.options = {
      preserveOriginal: true,
      addValidation: true,
      optimizeScopes: true,
      addCombinationLimits: true,
      ...options
    };
  }

  /**
   * Migrate a single action from old to new format
   */
  migrateAction(oldAction) {
    const newAction = {
      id: oldAction.id + '_v2',
      name: oldAction.name,
      description: oldAction.description,
      category: oldAction.category,
      targetDefinitions: {}
    };

    // Convert target to targetDefinitions
    if (oldAction.target) {
      newAction.targetDefinitions.target = this.convertTarget(oldAction.target);
    }

    // Copy other properties
    if (oldAction.conditions) {
      newAction.conditions = this.updateConditions(oldAction.conditions);
    }
    
    if (oldAction.effects) {
      newAction.effects = oldAction.effects; // Effects usually don't need changes
    }

    // Update templates
    if (oldAction.command) {
      newAction.command = this.updateTemplate(oldAction.command);
    }
    
    if (oldAction.result) {
      newAction.result = this.updateTemplate(oldAction.result);
    }

    // Add performance optimization
    if (this.options.addCombinationLimits) {
      newAction.maxCombinations = 25;
    }

    return newAction;
  }

  /**
   * Convert old target format to new targetDefinitions format
   */
  convertTarget(oldTarget) {
    const newTarget = {
      name: "target",
      description: "Target for the action",
      scope: oldTarget.scope,
      required: true
    };

    // Convert validation
    if (oldTarget.validation && this.options.addValidation) {
      newTarget.validation = this.convertValidation(oldTarget.validation);
    }

    // Add combination limits
    if (this.options.addCombinationLimits) {
      newTarget.maxCombinations = 10;
    }

    return newTarget;
  }

  /**
   * Convert old validation format to JSON Schema
   */
  convertValidation(oldValidation) {
    const schema = {
      type: "object",
      properties: {
        components: {
          type: "object",
          properties: {}
        }
      }
    };

    // Convert common validation patterns
    if (oldValidation.conscious) {
      schema.properties.components.properties['core:actor'] = {
        type: "object",
        properties: {
          conscious: { type: "boolean", const: true }
        }
      };
    }

    if (oldValidation.alive) {
      if (!schema.properties.components.properties['core:actor']) {
        schema.properties.components.properties['core:actor'] = {
          type: "object",
          properties: {}
        };
      }
      schema.properties.components.properties['core:actor'].properties.alive = {
        type: "boolean",
        const: true
      };
    }

    if (oldValidation.type) {
      schema.properties.components.properties['core:item'] = {
        type: "object", 
        properties: {
          type: { type: "string", const: oldValidation.type }
        }
      };
    }

    return schema;
  }

  /**
   * Update template variables to new format
   */
  updateTemplate(template) {
    return template
      .replace(/\{target\.name\}/g, '{target.components.core:actor.name || target.components.core:object.name || target.components.core:item.name}')
      .replace(/\{target\.(\w+)\}/g, '{target.components.core:actor.$1 || target.components.core:object.$1}');
  }

  /**
   * Update condition references
   */
  updateConditions(conditions) {
    return conditions.map(condition => ({
      ...condition,
      condition: this.updateJsonLogic(condition.condition)
    }));
  }

  /**
   * Update JSON Logic expressions for new format
   */
  updateJsonLogic(logic) {
    const jsonString = JSON.stringify(logic);
    const updated = jsonString
      .replace(/target\.(\w+)/g, 'target.components.core:actor.$1')
      .replace(/target\.components\.core:actor\.components/g, 'target.components');
    
    return JSON.parse(updated);
  }

  /**
   * Migrate all actions in a directory
   */
  async migrateDirectory(inputDir, outputDir) {
    const results = {
      migrated: [],
      errors: [],
      skipped: []
    };

    const files = await this.findActionFiles(inputDir);
    
    for (const file of files) {
      try {
        const oldAction = JSON.parse(fs.readFileSync(file, 'utf8'));
        
        // Skip if already migrated
        if (oldAction.targetDefinitions) {
          results.skipped.push(file);
          continue;
        }

        const newAction = this.migrateAction(oldAction);
        
        // Create output path
        const relativePath = path.relative(inputDir, file);
        const outputPath = path.join(outputDir, relativePath);
        const outputFile = outputPath.replace('.action.json', '_v2.action.json');
        
        // Ensure output directory exists
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
        
        // Write migrated action
        fs.writeFileSync(outputFile, JSON.stringify(newAction, null, 2));
        
        results.migrated.push({
          original: file,
          migrated: outputFile,
          action: newAction
        });

      } catch (error) {
        results.errors.push({
          file,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Find all action files in a directory
   */
  async findActionFiles(dir) {
    const files = [];
    
    const scan = (currentDir) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.name.endsWith('.action.json')) {
          files.push(fullPath);
        }
      }
    };

    scan(dir);
    return files;
  }

  /**
   * Generate migration report
   */
  generateReport(results) {
    const report = {
      summary: {
        total: results.migrated.length + results.errors.length + results.skipped.length,
        migrated: results.migrated.length,
        errors: results.errors.length,
        skipped: results.skipped.length
      },
      details: results
    };

    return report;
  }

  /**
   * Validate migrated action
   */
  validateMigration(originalAction, migratedAction) {
    const issues = [];

    // Check required fields
    if (!migratedAction.targetDefinitions) {
      issues.push('Missing targetDefinitions');
    }

    if (!migratedAction.targetDefinitions?.target) {
      issues.push('Missing target definition');
    }

    // Check template updates
    if (migratedAction.command && migratedAction.command.includes('{target.')) {
      const oldRefs = migratedAction.command.match(/\{target\.\w+\}/g);
      if (oldRefs && !oldRefs.every(ref => ref.includes('components'))) {
        issues.push('Template variables not fully updated');
      }
    }

    // Check performance optimizations
    if (!migratedAction.maxCombinations) {
      issues.push('Missing performance limits');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// CLI Usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrator = new ActionMigrator();
  
  const inputDir = process.argv[2] || 'data/mods';
  const outputDir = process.argv[3] || 'data/mods/migrated';
  
  console.log('Starting action migration...');
  console.log(`Input: ${inputDir}`);
  console.log(`Output: ${outputDir}`);
  
  migrator.migrateDirectory(inputDir, outputDir)
    .then(results => {
      const report = migrator.generateReport(results);
      
      console.log('\nMigration Summary:');
      console.log(`Total actions: ${report.summary.total}`);
      console.log(`Migrated: ${report.summary.migrated}`);
      console.log(`Errors: ${report.summary.errors}`);
      console.log(`Skipped: ${report.summary.skipped}`);
      
      if (report.summary.errors > 0) {
        console.log('\nErrors:');
        results.errors.forEach(error => {
          console.log(`  ${error.file}: ${error.error}`);
        });
      }
      
      // Write detailed report
      fs.writeFileSync(
        path.join(outputDir, 'migration-report.json'),
        JSON.stringify(report, null, 2)
      );
      
      console.log(`\nDetailed report written to ${outputDir}/migration-report.json`);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
```

### Step 4: Create Migration Tests

Create file: `tests/integration/migration/actionMigration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionMigrator } from '../../../tools/migration/action-migrator.js';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Action Migration Integration', () => {
  let testBed;
  let migrator;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    migrator = new ActionMigrator();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Basic Migration', () => {
    it('should migrate simple talk action', () => {
      const oldAction = {
        id: 'test:talk',
        name: 'talk to {target}',
        description: 'Have a conversation',
        category: 'social',
        target: {
          scope: 'location.core:actors[]',
          validation: { conscious: true }
        },
        command: 'talk to {target.name}',
        result: 'You talk to {target.name}.'
      };

      const migratedAction = migrator.migrateAction(oldAction);

      expect(migratedAction.id).toBe('test:talk_v2');
      expect(migratedAction.targetDefinitions).toBeDefined();
      expect(migratedAction.targetDefinitions.target).toBeDefined();
      expect(migratedAction.targetDefinitions.target.scope).toBe('location.core:actors[]');
      expect(migratedAction.command).toContain('components.core:actor.name');
    });

    it('should maintain backward compatibility', async () => {
      // Create test entities
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' },
        'core:position': { locationId: 'room' }
      });

      const npc = testBed.createEntity('npc', {
        'core:actor': { name: 'NPC', conscious: true },
        'core:position': { locationId: 'room' }
      });

      const room = testBed.createEntity('room', {
        'core:location': { name: 'Test Room' },
        'core:actors': ['player', 'npc']
      });

      // Test old format action
      const oldAction = {
        id: 'test:talk_old',
        name: 'talk to {target}',
        target: {
          scope: 'location.core:actors[]',
          validation: { conscious: true }
        }
      };

      // Test migrated action
      const migratedAction = migrator.migrateAction(oldAction);

      // Load both actions
      testBed.loadAction(oldAction);
      testBed.loadAction(migratedAction);

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        location: { id: 'room', components: room.getAllComponents() },
        game: { turnNumber: 1 }
      };

      // Test old action still works
      const oldResult = await testBed.processAction('test:talk_old', 'player', context);
      expect(oldResult.success).toBe(true);

      // Test migrated action works
      const newResult = await testBed.processAction('test:talk_old_v2', 'player', context);
      expect(newResult.success).toBe(true);

      // Both should find the same target
      expect(oldResult.value.actions.length).toBe(newResult.value.actions.length);
    });
  });

  describe('Performance Migration', () => {
    it('should add performance optimizations', () => {
      const oldAction = {
        id: 'test:performance',
        name: 'test action',
        target: { scope: 'game.entities[]' }
      };

      const migratedAction = migrator.migrateAction(oldAction);

      expect(migratedAction.maxCombinations).toBe(25);
      expect(migratedAction.targetDefinitions.target.maxCombinations).toBe(10);
    });

    it('should perform reasonably compared to old actions', async () => {
      // Create many entities for performance testing
      const entities = [];
      for (let i = 0; i < 50; i++) {
        entities.push(testBed.createEntity(`entity_${i}`, {
          'core:actor': { name: `Entity ${i}`, conscious: true }
        }));
      }

      const room = testBed.createEntity('room', {
        'core:location': { name: 'Crowded Room' },
        'core:actors': entities.map(e => e.id)
      });

      const oldAction = {
        id: 'test:performance_old',
        name: 'test action',
        target: { scope: 'location.core:actors[]' }
      };

      const migratedAction = migrator.migrateAction(oldAction);

      testBed.loadAction(oldAction);
      testBed.loadAction(migratedAction);

      const context = {
        actor: { id: 'player', components: {} },
        location: { id: 'room', components: room.getAllComponents() },
        game: { turnNumber: 1 }
      };

      // Test old action performance
      const oldStart = performance.now();
      await testBed.processAction('test:performance_old', 'player', context);
      const oldDuration = performance.now() - oldStart;

      // Test migrated action performance
      const newStart = performance.now();
      await testBed.processAction('test:performance_old_v2', 'player', context);
      const newDuration = performance.now() - newStart;

      // Migrated should be within 50% of old performance
      expect(newDuration).toBeLessThan(oldDuration * 1.5);
    });
  });

  describe('Validation Migration', () => {
    it('should convert validation correctly', () => {
      const oldAction = {
        id: 'test:validation',
        name: 'test action',
        target: {
          scope: 'location.core:actors[]',
          validation: {
            conscious: true,
            alive: true
          }
        }
      };

      const migratedAction = migrator.migrateAction(oldAction);

      expect(migratedAction.targetDefinitions.target.validation).toBeDefined();
      expect(migratedAction.targetDefinitions.target.validation.type).toBe('object');
      expect(migratedAction.targetDefinitions.target.validation.properties.components).toBeDefined();
    });

    it('should validate targets correctly', async () => {
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' }
      });

      const consciousNpc = testBed.createEntity('conscious_npc', {
        'core:actor': { name: 'Conscious NPC', conscious: true, alive: true }
      });

      const unconsciousNpc = testBed.createEntity('unconscious_npc', {
        'core:actor': { name: 'Unconscious NPC', conscious: false, alive: true }
      });

      const room = testBed.createEntity('room', {
        'core:location': { name: 'Test Room' },
        'core:actors': ['player', 'conscious_npc', 'unconscious_npc']
      });

      const oldAction = {
        id: 'test:validation_test',
        name: 'test action',
        target: {
          scope: 'location.core:actors[]',
          validation: { conscious: true }
        }
      };

      const migratedAction = migrator.migrateAction(oldAction);
      testBed.loadAction(migratedAction);

      const context = {
        actor: { id: 'player', components: player.getAllComponents() },
        location: { id: 'room', components: room.getAllComponents() },
        game: { turnNumber: 1 }
      };

      const result = await testBed.processAction(migratedAction.id, 'player', context);

      expect(result.success).toBe(true);
      // Should only find conscious NPC, not unconscious one
      expect(result.value.actions.length).toBe(1);
      expect(result.value.actions[0].targetId).toBe('conscious_npc');
    });
  });

  describe('Template Migration', () => {
    it('should update template variables correctly', () => {
      const oldAction = {
        id: 'test:template',
        name: 'test action',
        target: { scope: 'location.core:actors[]' },
        command: 'talk to {target.name}',
        result: 'You talk to {target.name} about {target.mood}.'
      };

      const migratedAction = migrator.migrateAction(oldAction);

      expect(migratedAction.command).not.toContain('{target.name}');
      expect(migratedAction.command).toContain('components.core:actor.name');
      expect(migratedAction.result).toContain('components.core:actor.mood');
    });

    it('should provide fallback values in templates', () => {
      const oldAction = {
        id: 'test:fallback',
        name: 'test action',
        target: { scope: 'location.core:actors[]' },
        command: 'interact with {target.name}'
      };

      const migratedAction = migrator.migrateAction(oldAction);

      // Should include fallbacks for different entity types
      expect(migratedAction.command).toContain('||');
      expect(migratedAction.command).toContain('core:object.name');
      expect(migratedAction.command).toContain('core:item.name');
    });
  });

  describe('Migration Validation', () => {
    it('should validate successful migration', () => {
      const oldAction = {
        id: 'test:validate',
        name: 'test action',
        target: { scope: 'location.core:actors[]' },
        command: 'action {target.name}'
      };

      const migratedAction = migrator.migrateAction(oldAction);
      const validation = migrator.validateMigration(oldAction, migratedAction);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect migration issues', () => {
      const oldAction = {
        id: 'test:invalid',
        name: 'test action',
        target: { scope: 'location.core:actors[]' }
      };

      const incompleteAction = {
        id: 'test:invalid_v2',
        name: 'test action',
        command: 'action {target.name}' // Not updated
      };

      const validation = migrator.validateMigration(oldAction, incompleteAction);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Missing targetDefinitions');
      expect(validation.issues).toContain('Template variables not fully updated');
    });
  });
});
```

## Acceptance Criteria

1.  Complete migration guide with step-by-step instructions
2.  Quick reference for common migration patterns
3.  Migration tools and automation scripts
4.  Comprehensive test suite for migration validation
5.  Performance comparison framework
6.  Backward compatibility verification
7.  Troubleshooting guide for common migration issues
8.  Best practices for gradual migration approach
9.  Success metrics and validation criteria
10.  Emergency rollback procedures

## Documentation Requirements

### For Developers
- Complete migration process documentation
- Automated migration tools with CLI interface
- Test frameworks for migration validation
- Performance benchmarking tools

### For Modders
- Quick migration reference with common patterns
- Best practices for action improvement
- Troubleshooting guide for migration issues
- Examples of successful migrations

## Future Enhancements

1. **Visual Migration Tool**: GUI application for interactive migration
2. **Migration Analytics**: Dashboard showing migration progress and metrics
3. **Automated Testing**: CI/CD integration for migration validation
4. **Community Sharing**: Platform for sharing migration patterns and solutions
5. **AI-Assisted Migration**: AI-powered suggestions for optimal migration strategies
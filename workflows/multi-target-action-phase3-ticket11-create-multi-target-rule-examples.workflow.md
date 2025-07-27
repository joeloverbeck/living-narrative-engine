# Ticket 11: Create Multi-Target Rule Examples

## Overview

Create comprehensive rule examples that demonstrate how to access and utilize the enhanced multi-target event data in the rules system. These examples will serve as documentation, validation, and templates for mod developers implementing multi-target actions while maintaining backward compatibility with existing single-target rules.

## Dependencies

- Ticket 10: Implement Backward Compatibility Layer (must be completed)
- Ticket 08: Update Attempt Action Payload Creation (must be completed)

## Blocks

- Ticket 12: Update Core Rules for Multi-Target Support
- Ticket 13: Add Rules Testing Framework

## Priority: High

## Estimated Time: 6-8 hours

## Background

With the enhanced event schema and command processor now supporting multi-target actions, the rules system needs examples demonstrating how to access and utilize this data. These examples will validate the enhanced schema works correctly, provide templates for mod developers, and ensure rules can seamlessly handle both legacy and enhanced formats.

## Implementation Details

### 1. Create Core Multi-Target Rule Examples

**File**: `data/mods/core/rules/examples/multiTargetExamples.json`

```json
{
  "description": "Multi-target rule examples demonstrating enhanced event access patterns",
  "rules": [
    {
      "id": "core:multi_target_throw_example",
      "name": "Multi-Target Throw Example",
      "description": "Example rule showing how to access multiple targets in a throw action",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
              {"==": [{"var": "event.actionId"}, "combat:throw"]},
              {"var": "event.targets"}
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "log_rule_execution",
          "data": {
            "message": "Multi-target throw detected",
            "actorId": {"var": "event.actorId"},
            "thrownItem": {"var": "event.targets.item"},
            "targetEntity": {"var": "event.targets.target"},
            "primaryTarget": {"var": "event.targetId"},
            "allTargets": {"var": "event.targets"}
          }
        },
        {
          "type": "validate_throw_targets",
          "conditions": [
            {
              "description": "Verify item exists and is throwable",
              "logic": {
                "and": [
                  {"var": "event.targets.item"},
                  {"!=": [{"var": "event.targets.item"}, ""]}
                ]
              }
            },
            {
              "description": "Verify target is valid",
              "logic": {
                "and": [
                  {"var": "event.targets.target"},
                  {"!=": [{"var": "event.targets.target"}, ""]}
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "id": "core:multi_target_interaction_example",
      "name": "Multi-Target Interaction Example", 
      "description": "Example rule for complex interactions with multiple target types",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
              {"in": [{"var": "event.actionId"}, ["interaction:use_item_on", "interaction:combine"]]},
              {"var": "event.targets"},
              {">": [{"var": "event.targets | keys | length"}, 1]}
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "process_multi_target_interaction",
          "data": {
            "actor": {"var": "event.actorId"},
            "action": {"var": "event.actionId"},
            "targets": {"var": "event.targets"},
            "targetCount": {"var": "event.targets | keys | length"},
            "primaryTarget": {"var": "event.targetId"}
          }
        },
        {
          "type": "foreach_target",
          "iterate": {"var": "event.targets | entries"},
          "operations": [
            {
              "type": "log_target_processing",
              "data": {
                "targetType": {"var": "current.0"},
                "targetId": {"var": "current.1"},
                "processingOrder": {"var": "index"}
              }
            }
          ]
        }
      ]
    },
    {
      "id": "core:backward_compatibility_example",
      "name": "Backward Compatibility Example",
      "description": "Rule that works with both legacy and enhanced formats",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
              {"==": [{"var": "event.actionId"}, "core:follow"]}
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "handle_follow_action",
          "data": {
            "actor": {"var": "event.actorId"},
            "targetId": {"var": "event.targetId"},
            "hasMultipleTargets": {"!!": {"var": "event.targets"}},
            "targetType": {
              "if": [
                {"var": "event.targets"},
                "enhanced_format",
                "legacy_format"
              ]
            }
          }
        },
        {
          "type": "conditional_multi_target_processing",
          "condition": {"var": "event.targets"},
          "ifTrue": [
            {
              "type": "log_rule_execution", 
              "data": {
                "message": "Enhanced format follow action",
                "targets": {"var": "event.targets"}
              }
            }
          ],
          "ifFalse": [
            {
              "type": "log_rule_execution",
              "data": {
                "message": "Legacy format follow action",
                "targetId": {"var": "event.targetId"}
              }
            }
          ]
        }
      ]
    },
    {
      "id": "core:combat_multi_target_example",
      "name": "Combat Multi-Target Example",
      "description": "Complex combat rule with weapon, target, and location targets",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
              {"in": [{"var": "event.actionId"}, ["combat:attack", "combat:throw", "combat:cast_spell"]]},
              {"var": "event.targets"}
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "setup_combat_context",
          "data": {
            "attacker": {"var": "event.actorId"},
            "weapon": {"var": "event.targets.weapon"},
            "target": {"var": "event.targets.target"},
            "location": {"var": "event.targets.location"},
            "spell": {"var": "event.targets.spell"},
            "item": {"var": "event.targets.item"}
          }
        },
        {
          "type": "validate_combat_targets",
          "validations": [
            {
              "name": "weapon_validation",
              "condition": {
                "if": [
                  {"var": "event.targets.weapon"},
                  {"and": [
                    {"!=": [{"var": "event.targets.weapon"}, ""]},
                    {"var": "entities[event.targets.weapon].components['core:item'].isWeapon"}
                  ]},
                  true
                ]
              }
            },
            {
              "name": "target_validation", 
              "condition": {
                "and": [
                  {"var": "event.targets.target"},
                  {"!=": [{"var": "event.targets.target"}, ""]},
                  {"var": "entities[event.targets.target]"}
                ]
              }
            }
          ]
        },
        {
          "type": "execute_combat_action",
          "data": {
            "actionType": {"var": "event.actionId"},
            "combatContext": "setup_combat_context_result",
            "validationResults": "validate_combat_targets_result"
          }
        }
      ]
    }
  ]
}
```

### 2. Create Rule Pattern Templates

**File**: `data/mods/core/rules/templates/multiTargetPatterns.json`

```json
{
  "description": "Reusable patterns for multi-target rule development",
  "patterns": {
    "detect_multi_target": {
      "description": "Pattern to detect if event has multi-target data",
      "logic": {
        "and": [
          {"var": "event.targets"},
          {"!=": [{"var": "event.targets"}, {}]},
          {">": [{"var": "event.targets | keys | length"}, 0]}
        ]
      }
    },
    "get_primary_target": {
      "description": "Pattern to get primary target (backward compatible)",
      "logic": {
        "if": [
          {"var": "event.targetId"},
          {"var": "event.targetId"},
          {
            "if": [
              {"var": "event.targets.primary"},
              {"var": "event.targets.primary"},
              {
                "if": [
                  {"var": "event.targets.target"},
                  {"var": "event.targets.target"},
                  {"var": "event.targets | values | first"}
                ]
              }
            ]
          }
        ]
      }
    },
    "iterate_targets": {
      "description": "Pattern to iterate over all targets",
      "foreach": {
        "items": {"var": "event.targets | entries"},
        "as": "target_entry",
        "operations": [
          {
            "type": "process_target",
            "data": {
              "targetType": {"var": "target_entry.0"},
              "targetId": {"var": "target_entry.1"}
            }
          }
        ]
      }
    },
    "count_targets": {
      "description": "Pattern to count targets",
      "logic": {
        "if": [
          {"var": "event.targets"},
          {"var": "event.targets | keys | length"},
          {
            "if": [
              {"var": "event.targetId"},
              1,
              0
            ]
          }
        ]
      }
    },
    "has_target_type": {
      "description": "Pattern to check if specific target type exists",
      "parameters": ["targetType"],
      "logic": {
        "and": [
          {"var": "event.targets"},
          {"var": "event.targets[targetType]"},
          {"!=": [{"var": "event.targets[targetType]"}, ""]}
        ]
      }
    },
    "get_target_by_type": {
      "description": "Pattern to safely get target by type",
      "parameters": ["targetType", "defaultValue"],
      "logic": {
        "if": [
          {"var": "event.targets[targetType]"},
          {"var": "event.targets[targetType]"},
          {"var": "defaultValue"}
        ]
      }
    },
    "validate_required_targets": {
      "description": "Pattern to validate required target types exist",
      "parameters": ["requiredTypes"],
      "logic": {
        "reduce": [
          {"var": "requiredTypes"},
          {
            "and": [
              {"var": "accumulator"},
              {"var": "event.targets[current]"},
              {"!=": [{"var": "event.targets[current]"}, ""]}
            ]
          },
          true
        ]
      }
    }
  }
}
```

### 3. Create Advanced Rule Examples

**File**: `data/mods/core/rules/examples/advancedMultiTargetExamples.json`

```json
{
  "description": "Advanced multi-target rule examples for complex scenarios",
  "rules": [
    {
      "id": "core:crafting_multi_target_example",
      "name": "Crafting Multi-Target Example",
      "description": "Crafting rule that processes multiple ingredients and tools",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
              {"==": [{"var": "event.actionId"}, "crafting:craft"]},
              {"var": "event.targets"},
              {"var": "event.targets.ingredients"},
              {"var": "event.targets.tool"}
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "validate_crafting_requirements",
          "data": {
            "crafter": {"var": "event.actorId"},
            "tool": {"var": "event.targets.tool"},
            "mainIngredient": {"var": "event.targets.ingredient"},
            "allTargets": {"var": "event.targets"}
          }
        },
        {
          "type": "calculate_crafting_outcome",
          "factors": {
            "toolQuality": {"var": "entities[event.targets.tool].components['core:item'].quality"},
            "crafterSkill": {"var": "entities[event.actorId].components['core:skills'].crafting"},
            "ingredientCount": {"var": "event.targets | keys | length"}
          }
        }
      ]
    },
    {
      "id": "core:trade_multi_target_example", 
      "name": "Trade Multi-Target Example",
      "description": "Trading rule handling multiple items and currencies",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
              {"==": [{"var": "event.actionId"}, "interaction:trade"]},
              {"var": "event.targets"},
              {"var": "event.targets.trader"},
              {">": [{"var": "event.targets | keys | length"}, 2]}
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "setup_trade_context",
          "data": {
            "customer": {"var": "event.actorId"},
            "trader": {"var": "event.targets.trader"},
            "offeredItems": {
              "filter": [
                {"var": "event.targets | entries"},
                {"in": [{"var": "current.0"}, ["item", "currency", "offering"]]}
              ]
            },
            "requestedItems": {
              "filter": [
                {"var": "event.targets | entries"},
                {"in": [{"var": "current.0"}, ["wanted", "seeking", "request"]]}
              ]
            }
          }
        },
        {
          "type": "validate_trade_items",
          "foreach": {
            "items": {"var": "event.targets | entries"},
            "operations": [
              {
                "type": "validate_item_ownership",
                "data": {
                  "itemId": {"var": "current.1"},
                  "itemType": {"var": "current.0"},
                  "owner": {
                    "if": [
                      {"in": [{"var": "current.0"}, ["item", "currency", "offering"]]},
                      {"var": "event.actorId"},
                      {"var": "event.targets.trader"}
                    ]
                  }
                }
              }
            ]
          }
        }
      ]
    },
    {
      "id": "core:spell_multi_target_example",
      "name": "Spell Multi-Target Example", 
      "description": "Spellcasting with multiple targets and components",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
              {"==": [{"var": "event.actionId"}, "magic:cast_spell"]},
              {"var": "event.targets"},
              {"var": "event.targets.spell"}
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "gather_spell_components",
          "data": {
            "caster": {"var": "event.actorId"},
            "spell": {"var": "event.targets.spell"},
            "target": {"var": "event.targets.target"},
            "components": {
              "material": {"var": "event.targets.component"},
              "focus": {"var": "event.targets.focus"},
              "catalyst": {"var": "event.targets.catalyst"}
            },
            "location": {"var": "event.targets.location"}
          }
        },
        {
          "type": "validate_spell_requirements",
          "checks": [
            {
              "name": "mana_cost",
              "condition": {
                ">=": [
                  {"var": "entities[event.actorId].components['core:mana'].current"},
                  {"var": "spells[event.targets.spell].manaCost"}
                ]
              }
            },
            {
              "name": "spell_components",
              "condition": {
                "if": [
                  {"var": "spells[event.targets.spell].requiresComponents"},
                  {"var": "event.targets.component"},
                  true
                ]
              }
            },
            {
              "name": "valid_target",
              "condition": {
                "if": [
                  {"var": "spells[event.targets.spell].requiresTarget"},
                  {"and": [
                    {"var": "event.targets.target"},
                    {"var": "entities[event.targets.target]"}
                  ]},
                  true
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "id": "core:performance_optimization_example",
      "name": "Performance Optimization Example",
      "description": "Optimized rule for handling large multi-target scenarios",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              {"==": [{"var": "event.eventName"}, "core:attempt_action"]},
              {"var": "event.targets"},
              {">": [{"var": "event.targets | keys | length"}, 5]}
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "batch_process_targets",
          "optimization": {
            "batchSize": 3,
            "parallelProcessing": true,
            "cacheResults": true
          },
          "data": {
            "actor": {"var": "event.actorId"},
            "action": {"var": "event.actionId"},
            "targetBatches": {
              "chunk": [
                {"var": "event.targets | entries"},
                3
              ]
            }
          }
        },
        {
          "type": "validate_performance_metrics",
          "thresholds": {
            "maxProcessingTime": 50,
            "maxMemoryUsage": 1024,
            "maxTargetCount": 20
          }
        }
      ]
    }
  ]
}
```

### 4. Create Testing Rules

**File**: `data/mods/core/rules/tests/multiTargetRuleTests.json`

```json
{
  "description": "Test rules for validating multi-target functionality",
  "testRules": [
    {
      "id": "test:multi_target_basic",
      "name": "Basic Multi-Target Test",
      "description": "Test basic multi-target data access",
      "testEvent": {
        "eventName": "core:attempt_action",
        "actorId": "test_actor",
        "actionId": "test:multi_action",
        "targets": {
          "item": "test_item",
          "target": "test_target"
        },
        "targetId": "test_target",
        "originalInput": "test command",
        "timestamp": 1234567890
      },
      "expectedResults": {
        "targetCount": 2,
        "hasMultipleTargets": true,
        "primaryTarget": "test_target",
        "itemTarget": "test_item"
      },
      "rule": {
        "conditions": [
          {
            "type": "json_logic",
            "logic": {"var": "event.targets"}
          }
        ],
        "operations": [
          {
            "type": "test_assertion",
            "assertions": [
              {"==": [{"var": "event.targets | keys | length"}, 2]},
              {"==": [{"var": "event.targets.item"}, "test_item"]},
              {"==": [{"var": "event.targets.target"}, "test_target"]},
              {"==": [{"var": "event.targetId"}, "test_target"]}
            ]
          }
        ]
      }
    },
    {
      "id": "test:backward_compatibility",
      "name": "Backward Compatibility Test", 
      "description": "Test legacy format compatibility",
      "testEvent": {
        "eventName": "core:attempt_action",
        "actorId": "test_actor",
        "actionId": "core:follow",
        "targetId": "test_target",
        "originalInput": "follow target",
        "timestamp": 1234567890
      },
      "expectedResults": {
        "targetCount": 1,
        "hasMultipleTargets": false,
        "primaryTarget": "test_target"
      },
      "rule": {
        "conditions": [
          {
            "type": "json_logic",
            "logic": {"var": "event.targetId"}
          }
        ],
        "operations": [
          {
            "type": "test_assertion",
            "assertions": [
              {"==": [{"var": "event.targetId"}, "test_target"]},
              {"!": {"var": "event.targets"}},
              {"==": [{"var": "event.actionId"}, "core:follow"]}
            ]
          }
        ]
      }
    },
    {
      "id": "test:pattern_validation",
      "name": "Pattern Validation Test",
      "description": "Test reusable patterns work correctly",
      "testEvents": [
        {
          "description": "Multi-target event",
          "event": {
            "eventName": "core:attempt_action", 
            "actorId": "test_actor",
            "actionId": "test:action",
            "targets": {"item": "item1", "target": "target1"},
            "targetId": "target1",
            "originalInput": "test",
            "timestamp": 1234567890
          },
          "expectedPatternResults": {
            "detect_multi_target": true,
            "get_primary_target": "target1", 
            "count_targets": 2,
            "has_target_type_item": true,
            "has_target_type_location": false
          }
        },
        {
          "description": "Legacy event",
          "event": {
            "eventName": "core:attempt_action",
            "actorId": "test_actor", 
            "actionId": "core:follow",
            "targetId": "legacy_target",
            "originalInput": "follow",
            "timestamp": 1234567890
          },
          "expectedPatternResults": {
            "detect_multi_target": false,
            "get_primary_target": "legacy_target",
            "count_targets": 1,
            "has_target_type_primary": false
          }
        }
      ]
    }
  ]
}
```

## Testing Requirements

### 1. Rule Validation Tests

- **JSON Logic validation**: All rule conditions parse correctly
- **Pattern functionality**: Reusable patterns work as expected
- **Backward compatibility**: Legacy rules continue working
- **Error handling**: Invalid target access handled gracefully

### 2. Integration Testing

- **Event processing**: Rules correctly process multi-target events
- **Performance**: Rule evaluation performance within acceptable limits
- **Memory usage**: No memory leaks from complex target processing

### 3. Real-World Scenario Testing

- **Game actions**: Rules work with actual game scenarios
- **Edge cases**: Unusual target combinations handled correctly
- **Stress testing**: Performance under high rule evaluation loads

## Success Criteria

1. **Comprehensive Examples**: Rules demonstrate all multi-target patterns
2. **Backward Compatibility**: Existing single-target rules unaffected
3. **Performance**: Rule evaluation < 5ms for complex multi-target scenarios
4. **Documentation**: Clear examples for mod developers
5. **Validation**: All test rules pass consistently

## Files Created

- `data/mods/core/rules/examples/multiTargetExamples.json`
- `data/mods/core/rules/templates/multiTargetPatterns.json` 
- `data/mods/core/rules/examples/advancedMultiTargetExamples.json`
- `data/mods/core/rules/tests/multiTargetRuleTests.json`

## Files Modified

None (new rule files only)

## Validation Steps

1. Validate all JSON rule files parse correctly
2. Test rule examples with actual multi-target events
3. Verify backward compatibility with existing rules
4. Test pattern templates in various combinations
5. Run performance tests on complex rule scenarios

## Notes

- Rule examples provide comprehensive documentation for developers
- Pattern templates enable reusable rule development
- Test rules validate multi-target functionality works correctly
- Advanced examples show complex real-world usage patterns

## Risk Assessment

**Low Risk**: New rule files only, no modifications to existing rules or engine code. Examples are isolated and can be easily removed if issues arise.

## Next Steps

After this ticket completion:
1. Move to Ticket 12: Update Core Rules for Multi-Target Support
2. Begin updating existing core rules to utilize multi-target data
3. Validate rule examples work with actual game scenarios
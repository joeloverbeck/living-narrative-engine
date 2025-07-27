# Ticket 12: Update Core Rules for Multi-Target Support

## Overview

Update existing core rules to utilize the enhanced multi-target event data while maintaining complete backward compatibility. This involves selectively enhancing key rules that can benefit from multi-target access patterns and ensuring all existing single-target rules continue to function unchanged.

## Dependencies

- Ticket 11: Create Multi-Target Rule Examples (must be completed)
- Ticket 10: Implement Backward Compatibility Layer (must be completed)

## Blocks

- Ticket 13: Add Rules Testing Framework
- Ticket 14: Comprehensive Integration Testing

## Priority: High

## Estimated Time: 8-10 hours

## Background

The core rules system currently operates on single-target assumptions. With the enhanced event schema providing multi-target data, selected core rules need updates to leverage this information while ensuring no existing functionality is broken. This selective enhancement approach minimizes risk while demonstrating multi-target capabilities.

## Implementation Details

### 1. Update Combat Rules

**File**: `data/mods/core/rules/combat.json`

Enhance existing combat rules to support multi-target scenarios:

```json
{
  "rules": [
    {
      "id": "core:attempt_attack",
      "name": "Attempt Attack",
      "description": "Enhanced attack rule with multi-target weapon and target support",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              { "==": [{ "var": "event.eventName" }, "core:attempt_action"] },
              {
                "in": [
                  { "var": "event.actionId" },
                  ["core:attack", "combat:attack", "combat:strike"]
                ]
              }
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "setup_attack_context",
          "data": {
            "attacker": { "var": "event.actorId" },
            "primaryTarget": {
              "if": [
                { "var": "event.targets.target" },
                { "var": "event.targets.target" },
                { "var": "event.targetId" }
              ]
            },
            "weapon": {
              "if": [
                { "var": "event.targets.weapon" },
                { "var": "event.targets.weapon" },
                {
                  "var": "entities[event.actorId].components['core:equipment'].mainHand"
                }
              ]
            },
            "attackType": {
              "if": [
                { "var": "event.targets" },
                "multi_target_enhanced",
                "legacy_single_target"
              ]
            }
          }
        },
        {
          "type": "validate_attack_requirements",
          "validations": [
            {
              "name": "attacker_exists",
              "condition": { "var": "entities[event.actorId]" }
            },
            {
              "name": "target_exists",
              "condition": {
                "if": [
                  { "var": "event.targets.target" },
                  { "var": "entities[event.targets.target]" },
                  { "var": "entities[event.targetId]" }
                ]
              }
            },
            {
              "name": "weapon_validity",
              "condition": {
                "if": [
                  { "var": "event.targets.weapon" },
                  {
                    "and": [
                      { "var": "entities[event.targets.weapon]" },
                      {
                        "var": "entities[event.targets.weapon].components['core:item'].isWeapon"
                      }
                    ]
                  },
                  true
                ]
              }
            }
          ]
        },
        {
          "type": "calculate_attack_outcome",
          "factors": {
            "attackerStats": {
              "var": "entities[event.actorId].components['core:stats']"
            },
            "targetStats": {
              "if": [
                { "var": "event.targets.target" },
                {
                  "var": "entities[event.targets.target].components['core:stats']"
                },
                { "var": "entities[event.targetId].components['core:stats']" }
              ]
            },
            "weaponStats": {
              "if": [
                { "var": "event.targets.weapon" },
                {
                  "var": "entities[event.targets.weapon].components['core:item']"
                },
                {
                  "var": "entities[entities[event.actorId].components['core:equipment'].mainHand].components['core:item']"
                }
              ]
            },
            "environmentalFactors": {
              "location": { "var": "event.targets.location" },
              "conditions": { "var": "event.targets.conditions" }
            }
          }
        },
        {
          "type": "apply_attack_effects",
          "effects": [
            {
              "type": "damage_calculation",
              "target": {
                "if": [
                  { "var": "event.targets.target" },
                  { "var": "event.targets.target" },
                  { "var": "event.targetId" }
                ]
              },
              "source": { "var": "event.actorId" },
              "weapon": {
                "if": [
                  { "var": "event.targets.weapon" },
                  { "var": "event.targets.weapon" },
                  {
                    "var": "entities[event.actorId].components['core:equipment'].mainHand"
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "id": "core:attempt_throw",
      "name": "Attempt Throw",
      "description": "Enhanced throw rule with explicit item and target support",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              { "==": [{ "var": "event.eventName" }, "core:attempt_action"] },
              {
                "in": [
                  { "var": "event.actionId" },
                  ["core:throw", "combat:throw"]
                ]
              },
              {
                "or": [
                  {
                    "and": [
                      { "var": "event.targets.item" },
                      { "var": "event.targets.target" }
                    ]
                  },
                  { "var": "event.targetId" }
                ]
              }
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "setup_throw_context",
          "data": {
            "thrower": { "var": "event.actorId" },
            "thrownItem": {
              "if": [
                { "var": "event.targets.item" },
                { "var": "event.targets.item" },
                {
                  "if": [
                    { "var": "event.targetId" },
                    {
                      "var": "entities[event.actorId].components['core:inventory'].heldItem"
                    },
                    null
                  ]
                }
              ]
            },
            "target": {
              "if": [
                { "var": "event.targets.target" },
                { "var": "event.targets.target" },
                { "var": "event.targetId" }
              ]
            },
            "throwType": {
              "if": [
                {
                  "and": [
                    { "var": "event.targets.item" },
                    { "var": "event.targets.target" }
                  ]
                },
                "multi_target_throw",
                "legacy_throw"
              ]
            }
          }
        },
        {
          "type": "validate_throw_requirements",
          "validations": [
            {
              "name": "item_throwable",
              "condition": {
                "if": [
                  { "var": "event.targets.item" },
                  {
                    "var": "entities[event.targets.item].components['core:item'].isThrowable"
                  },
                  true
                ]
              }
            },
            {
              "name": "item_in_inventory",
              "condition": {
                "if": [
                  { "var": "event.targets.item" },
                  {
                    "in": [
                      { "var": "event.targets.item" },
                      {
                        "var": "entities[event.actorId].components['core:inventory'].items"
                      }
                    ]
                  },
                  true
                ]
              }
            },
            {
              "name": "target_in_range",
              "condition": {
                "<=": [
                  {
                    "var": "distance(event.actorId, event.targets.target || event.targetId)"
                  },
                  {
                    "var": "entities[event.targets.item || 'default'].components['core:item'].throwRange || 10"
                  }
                ]
              }
            }
          ]
        },
        {
          "type": "execute_throw",
          "effects": [
            {
              "type": "remove_from_inventory",
              "actor": { "var": "event.actorId" },
              "item": {
                "if": [
                  { "var": "event.targets.item" },
                  { "var": "event.targets.item" },
                  {
                    "var": "entities[event.actorId].components['core:inventory'].heldItem"
                  }
                ]
              }
            },
            {
              "type": "projectile_motion",
              "from": { "var": "event.actorId" },
              "to": {
                "if": [
                  { "var": "event.targets.target" },
                  { "var": "event.targets.target" },
                  { "var": "event.targetId" }
                ]
              },
              "item": {
                "if": [
                  { "var": "event.targets.item" },
                  { "var": "event.targets.item" },
                  {
                    "var": "entities[event.actorId].components['core:inventory'].heldItem"
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### 2. Update Interaction Rules

**File**: `data/mods/core/rules/interactions.json`

Enhance interaction rules for multi-target scenarios:

```json
{
  "rules": [
    {
      "id": "core:attempt_use_item",
      "name": "Attempt Use Item",
      "description": "Enhanced use item rule with multi-target support",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              { "==": [{ "var": "event.eventName" }, "core:attempt_action"] },
              {
                "in": [
                  { "var": "event.actionId" },
                  ["core:use", "interaction:use", "interaction:use_item_on"]
                ]
              }
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "determine_use_context",
          "data": {
            "user": { "var": "event.actorId" },
            "item": {
              "if": [
                { "var": "event.targets.item" },
                { "var": "event.targets.item" },
                { "var": "event.targetId" }
              ]
            },
            "target": { "var": "event.targets.target" },
            "location": { "var": "event.targets.location" },
            "useType": {
              "if": [
                { "var": "event.targets.target" },
                "use_item_on_target",
                {
                  "if": [
                    { "var": "event.targets.location" },
                    "use_item_at_location",
                    "use_item_standalone"
                  ]
                }
              ]
            }
          }
        },
        {
          "type": "validate_use_requirements",
          "validations": [
            {
              "name": "item_usable",
              "condition": {
                "if": [
                  { "var": "event.targets.item" },
                  {
                    "var": "entities[event.targets.item].components['core:item'].isUsable"
                  },
                  {
                    "var": "entities[event.targetId].components['core:item'].isUsable"
                  }
                ]
              }
            },
            {
              "name": "target_compatible",
              "condition": {
                "if": [
                  { "var": "event.targets.target" },
                  {
                    "var": "entities[event.targets.target].components['core:interactive']"
                  },
                  true
                ]
              }
            },
            {
              "name": "user_has_item",
              "condition": {
                "in": [
                  {
                    "if": [
                      { "var": "event.targets.item" },
                      { "var": "event.targets.item" },
                      { "var": "event.targetId" }
                    ]
                  },
                  {
                    "var": "entities[event.actorId].components['core:inventory'].items"
                  }
                ]
              }
            }
          ]
        },
        {
          "type": "execute_item_use",
          "effects": [
            {
              "type": "conditional_item_effects",
              "condition": { "var": "validation_results.all_passed" },
              "ifTrue": [
                {
                  "type": "apply_item_effects",
                  "item": {
                    "if": [
                      { "var": "event.targets.item" },
                      { "var": "event.targets.item" },
                      { "var": "event.targetId" }
                    ]
                  },
                  "user": { "var": "event.actorId" },
                  "target": { "var": "event.targets.target" },
                  "location": { "var": "event.targets.location" }
                },
                {
                  "type": "update_item_durability",
                  "item": {
                    "if": [
                      { "var": "event.targets.item" },
                      { "var": "event.targets.item" },
                      { "var": "event.targetId" }
                    ]
                  }
                }
              ],
              "ifFalse": [
                {
                  "type": "notify_use_failed",
                  "reason": { "var": "validation_results.failed_checks" }
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "core:attempt_give",
      "name": "Attempt Give Item",
      "description": "Enhanced give item rule with explicit item and recipient",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              { "==": [{ "var": "event.eventName" }, "core:attempt_action"] },
              {
                "in": [
                  { "var": "event.actionId" },
                  ["core:give", "interaction:give", "interaction:trade"]
                ]
              },
              {
                "or": [
                  {
                    "and": [
                      { "var": "event.targets.item" },
                      { "var": "event.targets.recipient" }
                    ]
                  },
                  { "var": "event.targetId" }
                ]
              }
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "setup_give_context",
          "data": {
            "giver": { "var": "event.actorId" },
            "recipient": {
              "if": [
                { "var": "event.targets.recipient" },
                { "var": "event.targets.recipient" },
                { "var": "event.targetId" }
              ]
            },
            "item": {
              "if": [
                { "var": "event.targets.item" },
                { "var": "event.targets.item" },
                {
                  "var": "entities[event.actorId].components['core:inventory'].heldItem"
                }
              ]
            },
            "giveType": {
              "if": [
                {
                  "and": [
                    { "var": "event.targets.item" },
                    { "var": "event.targets.recipient" }
                  ]
                },
                "explicit_give",
                "contextual_give"
              ]
            }
          }
        },
        {
          "type": "validate_give_transaction",
          "validations": [
            {
              "name": "giver_has_item",
              "condition": {
                "in": [
                  {
                    "if": [
                      { "var": "event.targets.item" },
                      { "var": "event.targets.item" },
                      {
                        "var": "entities[event.actorId].components['core:inventory'].heldItem"
                      }
                    ]
                  },
                  {
                    "var": "entities[event.actorId].components['core:inventory'].items"
                  }
                ]
              }
            },
            {
              "name": "recipient_can_receive",
              "condition": {
                "<=": [
                  {
                    "var": "entities[event.targets.recipient || event.targetId].components['core:inventory'].items | length"
                  },
                  {
                    "var": "entities[event.targets.recipient || event.targetId].components['core:inventory'].maxItems"
                  }
                ]
              }
            },
            {
              "name": "item_tradeable",
              "condition": {
                "!=": [
                  {
                    "var": "entities[event.targets.item || entities[event.actorId].components['core:inventory'].heldItem].components['core:item'].bound"
                  },
                  true
                ]
              }
            }
          ]
        },
        {
          "type": "execute_give_transaction",
          "effects": [
            {
              "type": "transfer_item",
              "from": { "var": "event.actorId" },
              "to": {
                "if": [
                  { "var": "event.targets.recipient" },
                  { "var": "event.targets.recipient" },
                  { "var": "event.targetId" }
                ]
              },
              "item": {
                "if": [
                  { "var": "event.targets.item" },
                  { "var": "event.targets.item" },
                  {
                    "var": "entities[event.actorId].components['core:inventory'].heldItem"
                  }
                ]
              }
            },
            {
              "type": "update_relationship",
              "between": [
                { "var": "event.actorId" },
                {
                  "if": [
                    { "var": "event.targets.recipient" },
                    { "var": "event.targets.recipient" },
                    { "var": "event.targetId" }
                  ]
                }
              ],
              "modifier": 0.1
            }
          ]
        }
      ]
    }
  ]
}
```

### 3. Update Movement Rules

**File**: `data/mods/core/rules/movement.json`

Enhance movement rules with location targeting:

```json
{
  "rules": [
    {
      "id": "core:attempt_follow",
      "name": "Attempt Follow",
      "description": "Enhanced follow rule with backward compatibility",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              { "==": [{ "var": "event.eventName" }, "core:attempt_action"] },
              { "==": [{ "var": "event.actionId" }, "core:follow"] },
              {
                "or": [
                  { "var": "event.targets.target" },
                  { "var": "event.targetId" }
                ]
              }
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "setup_follow_context",
          "data": {
            "follower": { "var": "event.actorId" },
            "target": {
              "if": [
                { "var": "event.targets.target" },
                { "var": "event.targets.target" },
                { "var": "event.targetId" }
              ]
            },
            "followType": {
              "if": [
                { "var": "event.targets" },
                "enhanced_follow",
                "legacy_follow"
              ]
            },
            "followDistance": {
              "if": [
                { "var": "event.targets.distance" },
                { "var": "event.targets.distance" },
                "default"
              ]
            }
          }
        },
        {
          "type": "validate_follow_requirements",
          "validations": [
            {
              "name": "target_exists",
              "condition": {
                "var": "entities[event.targets.target || event.targetId]"
              }
            },
            {
              "name": "target_followable",
              "condition": {
                "!=": [
                  {
                    "var": "entities[event.targets.target || event.targetId].components['core:actor'].followable"
                  },
                  false
                ]
              }
            },
            {
              "name": "not_self_follow",
              "condition": {
                "!=": [
                  { "var": "event.actorId" },
                  {
                    "if": [
                      { "var": "event.targets.target" },
                      { "var": "event.targets.target" },
                      { "var": "event.targetId" }
                    ]
                  }
                ]
              }
            }
          ]
        },
        {
          "type": "execute_follow_action",
          "effects": [
            {
              "type": "set_following_state",
              "follower": { "var": "event.actorId" },
              "target": {
                "if": [
                  { "var": "event.targets.target" },
                  { "var": "event.targets.target" },
                  { "var": "event.targetId" }
                ]
              },
              "distance": {
                "if": [
                  { "var": "event.targets.distance" },
                  { "var": "event.targets.distance" },
                  3
                ]
              }
            },
            {
              "type": "notify_follow_started",
              "follower": { "var": "event.actorId" },
              "target": {
                "if": [
                  { "var": "event.targets.target" },
                  { "var": "event.targets.target" },
                  { "var": "event.targetId" }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      "id": "core:attempt_go",
      "name": "Attempt Go To Location",
      "description": "Enhanced movement rule with explicit location targeting",
      "conditions": [
        {
          "type": "json_logic",
          "logic": {
            "and": [
              { "==": [{ "var": "event.eventName" }, "core:attempt_action"] },
              {
                "in": [
                  { "var": "event.actionId" },
                  ["core:go", "movement:move", "movement:travel"]
                ]
              },
              {
                "or": [
                  { "var": "event.targets.location" },
                  { "var": "event.targets.destination" },
                  { "var": "event.targetId" }
                ]
              }
            ]
          }
        }
      ],
      "operations": [
        {
          "type": "setup_movement_context",
          "data": {
            "mover": { "var": "event.actorId" },
            "destination": {
              "if": [
                { "var": "event.targets.location" },
                { "var": "event.targets.location" },
                {
                  "if": [
                    { "var": "event.targets.destination" },
                    { "var": "event.targets.destination" },
                    { "var": "event.targetId" }
                  ]
                }
              ]
            },
            "route": { "var": "event.targets.route" },
            "speed": { "var": "event.targets.speed" },
            "movementType": {
              "if": [
                { "var": "event.targets" },
                "enhanced_movement",
                "legacy_movement"
              ]
            }
          }
        },
        {
          "type": "validate_movement",
          "validations": [
            {
              "name": "destination_accessible",
              "condition": {
                "var": "locations[event.targets.location || event.targets.destination || event.targetId].accessible"
              }
            },
            {
              "name": "path_available",
              "condition": {
                "var": "pathExists(entities[event.actorId].location, event.targets.location || event.targets.destination || event.targetId)"
              }
            },
            {
              "name": "movement_allowed",
              "condition": {
                "!=": [
                  {
                    "var": "entities[event.actorId].components['core:status'].immobilized"
                  },
                  true
                ]
              }
            }
          ]
        },
        {
          "type": "execute_movement",
          "effects": [
            {
              "type": "update_location",
              "entity": { "var": "event.actorId" },
              "newLocation": {
                "if": [
                  { "var": "event.targets.location" },
                  { "var": "event.targets.location" },
                  {
                    "if": [
                      { "var": "event.targets.destination" },
                      { "var": "event.targets.destination" },
                      { "var": "event.targetId" }
                    ]
                  }
                ]
              },
              "movementSpeed": {
                "if": [
                  { "var": "event.targets.speed" },
                  { "var": "event.targets.speed" },
                  {
                    "var": "entities[event.actorId].components['core:stats'].speed"
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### 4. Create Rule Migration Helper

**File**: `src/utils/ruleMigrationHelper.js`

Create a helper for migrating existing rules:

```javascript
/**
 * @file Helper utilities for migrating rules to multi-target support
 */

import { ensureValidLogger } from './loggerUtils.js';

/**
 * Helper class for migrating rules to support multi-target events
 */
export class RuleMigrationHelper {
  #logger;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
  }

  /**
   * Analyzes a rule to determine multi-target migration opportunities
   * @param {Object} rule - Rule to analyze
   * @returns {Object} Migration analysis result
   */
  analyzeRuleForMigration(rule) {
    const analysis = {
      ruleId: rule.id,
      migrationOpportunities: [],
      riskAssessment: 'low',
      backwardCompatible: true,
      recommendations: [],
    };

    // Analyze conditions for target access patterns
    this.#analyzeConditions(rule.conditions || [], analysis);

    // Analyze operations for target usage
    this.#analyzeOperations(rule.operations || [], analysis);

    // Provide migration recommendations
    this.#generateRecommendations(analysis);

    return analysis;
  }

  /**
   * Generates a backward-compatible multi-target version of a rule
   * @param {Object} rule - Original rule
   * @param {Object} migrationOptions - Migration configuration
   * @returns {Object} Enhanced rule with multi-target support
   */
  generateEnhancedRule(rule, migrationOptions = {}) {
    const enhancedRule = JSON.parse(JSON.stringify(rule)); // Deep clone

    // Add backward compatibility note
    enhancedRule.description =
      (enhancedRule.description || '') +
      ' (Enhanced with multi-target support while maintaining backward compatibility)';

    // Enhance conditions
    enhancedRule.conditions = this.#enhanceConditions(
      rule.conditions || [],
      migrationOptions
    );

    // Enhance operations
    enhancedRule.operations = this.#enhanceOperations(
      rule.operations || [],
      migrationOptions
    );

    return enhancedRule;
  }

  /**
   * Validates that an enhanced rule maintains backward compatibility
   * @param {Object} originalRule - Original rule
   * @param {Object} enhancedRule - Enhanced rule
   * @returns {Object} Validation result
   */
  validateBackwardCompatibility(originalRule, enhancedRule) {
    const validation = {
      isCompatible: true,
      issues: [],
      warnings: [],
    };

    // Check that original conditions are preserved
    this.#validateConditionCompatibility(
      originalRule.conditions || [],
      enhancedRule.conditions || [],
      validation
    );

    // Check that original operations are preserved
    this.#validateOperationCompatibility(
      originalRule.operations || [],
      enhancedRule.operations || [],
      validation
    );

    return validation;
  }

  /**
   * Analyzes rule conditions for migration opportunities
   * @param {Array} conditions - Rule conditions
   * @param {Object} analysis - Analysis result object
   */
  #analyzeConditions(conditions, analysis) {
    for (const condition of conditions) {
      if (condition.type === 'json_logic' && condition.logic) {
        this.#analyzeJsonLogic(condition.logic, analysis, 'condition');
      }
    }
  }

  /**
   * Analyzes rule operations for migration opportunities
   * @param {Array} operations - Rule operations
   * @param {Object} analysis - Analysis result object
   */
  #analyzeOperations(operations, analysis) {
    for (const operation of operations) {
      if (operation.data) {
        this.#analyzeDataObject(operation.data, analysis, 'operation');
      }
      if (operation.condition) {
        this.#analyzeJsonLogic(
          operation.condition,
          analysis,
          'operation_condition'
        );
      }
    }
  }

  /**
   * Analyzes JSON Logic for target access patterns
   * @param {Object} logic - JSON Logic object
   * @param {Object} analysis - Analysis result
   * @param {string} context - Context of analysis
   */
  #analyzeJsonLogic(logic, analysis, context) {
    const jsonString = JSON.stringify(logic);

    // Look for targetId access
    if (jsonString.includes('event.targetId')) {
      analysis.migrationOpportunities.push({
        type: 'target_id_access',
        context,
        description:
          'Direct targetId access can be enhanced with fallback to targets object',
        enhancement: 'Add conditional logic to check targets object first',
      });
    }

    // Look for action-specific patterns that could benefit from multi-target
    const multiTargetActions = [
      'throw',
      'attack',
      'use',
      'give',
      'trade',
      'craft',
    ];
    for (const action of multiTargetActions) {
      if (jsonString.includes(action)) {
        analysis.migrationOpportunities.push({
          type: 'multi_target_action',
          context,
          action,
          description: `Action '${action}' could benefit from multi-target enhancement`,
          enhancement: 'Add support for targets object access patterns',
        });
      }
    }
  }

  /**
   * Analyzes data objects for target references
   * @param {Object} data - Data object
   * @param {Object} analysis - Analysis result
   * @param {string} context - Context of analysis
   */
  #analyzeDataObject(data, analysis, context) {
    const dataString = JSON.stringify(data);

    if (dataString.includes('event.targetId')) {
      analysis.migrationOpportunities.push({
        type: 'data_target_access',
        context,
        description: 'Data object accesses targetId directly',
        enhancement: 'Enhance with conditional multi-target access',
      });
    }
  }

  /**
   * Generates migration recommendations
   * @param {Object} analysis - Analysis result
   */
  #generateRecommendations(analysis) {
    const opportunityCount = analysis.migrationOpportunities.length;

    if (opportunityCount === 0) {
      analysis.recommendations.push(
        'No multi-target migration opportunities identified'
      );
      return;
    }

    if (opportunityCount <= 2) {
      analysis.riskAssessment = 'low';
      analysis.recommendations.push('Low-risk migration with minimal changes');
    } else if (opportunityCount <= 5) {
      analysis.riskAssessment = 'medium';
      analysis.recommendations.push(
        'Medium complexity migration - test thoroughly'
      );
    } else {
      analysis.riskAssessment = 'high';
      analysis.recommendations.push(
        'High complexity migration - consider phased approach'
      );
    }

    // Specific recommendations based on opportunity types
    const opportunityTypes = new Set(
      analysis.migrationOpportunities.map((opp) => opp.type)
    );

    if (opportunityTypes.has('target_id_access')) {
      analysis.recommendations.push(
        'Replace direct targetId access with conditional logic checking targets object first'
      );
    }

    if (opportunityTypes.has('multi_target_action')) {
      analysis.recommendations.push(
        'Enhance action-specific logic to utilize multiple target types'
      );
    }

    if (opportunityTypes.has('data_target_access')) {
      analysis.recommendations.push(
        'Update data access patterns to support both legacy and enhanced formats'
      );
    }
  }

  /**
   * Enhances rule conditions for multi-target support
   * @param {Array} conditions - Original conditions
   * @param {Object} options - Migration options
   * @returns {Array} Enhanced conditions
   */
  #enhanceConditions(conditions, options) {
    return conditions.map((condition) => {
      if (condition.type === 'json_logic' && condition.logic) {
        return {
          ...condition,
          logic: this.#enhanceJsonLogic(condition.logic, options),
        };
      }
      return condition;
    });
  }

  /**
   * Enhances rule operations for multi-target support
   * @param {Array} operations - Original operations
   * @param {Object} options - Migration options
   * @returns {Array} Enhanced operations
   */
  #enhanceOperations(operations, options) {
    return operations.map((operation) => {
      const enhanced = { ...operation };

      if (operation.data) {
        enhanced.data = this.#enhanceDataObject(operation.data, options);
      }

      if (operation.condition) {
        enhanced.condition = this.#enhanceJsonLogic(
          operation.condition,
          options
        );
      }

      return enhanced;
    });
  }

  /**
   * Enhances JSON Logic for multi-target support
   * @param {Object} logic - Original JSON Logic
   * @param {Object} options - Migration options
   * @returns {Object} Enhanced JSON Logic
   */
  #enhanceJsonLogic(logic, options) {
    // This is a simplified enhancement - in practice would need more sophisticated logic
    const logicString = JSON.stringify(logic);

    if (logicString.includes('event.targetId')) {
      // Replace direct targetId access with conditional access
      return this.#createConditionalTargetAccess(logic);
    }

    return logic;
  }

  /**
   * Enhances data objects for multi-target support
   * @param {Object} data - Original data object
   * @param {Object} options - Migration options
   * @returns {Object} Enhanced data object
   */
  #enhanceDataObject(data, options) {
    const enhanced = { ...data };

    // Look for targetId references and enhance them
    for (const [key, value] of Object.entries(data)) {
      if (
        value &&
        typeof value === 'object' &&
        value.var === 'event.targetId'
      ) {
        enhanced[key] = this.#createConditionalTargetVar();
      }
    }

    return enhanced;
  }

  /**
   * Creates conditional target access logic
   * @param {Object} originalLogic - Original logic accessing targetId
   * @returns {Object} Enhanced conditional logic
   */
  #createConditionalTargetAccess(originalLogic) {
    // Create a conditional that checks targets object first, then falls back to targetId
    return {
      if: [
        { var: 'event.targets.target' },
        { var: 'event.targets.target' },
        { var: 'event.targetId' },
      ],
    };
  }

  /**
   * Creates conditional target variable access
   * @returns {Object} Conditional variable access
   */
  #createConditionalTargetVar() {
    return {
      if: [
        { var: 'event.targets.target' },
        { var: 'event.targets.target' },
        { var: 'event.targetId' },
      ],
    };
  }

  /**
   * Validates condition compatibility
   * @param {Array} original - Original conditions
   * @param {Array} enhanced - Enhanced conditions
   * @param {Object} validation - Validation result
   */
  #validateConditionCompatibility(original, enhanced, validation) {
    if (original.length !== enhanced.length) {
      validation.warnings.push('Condition count changed during enhancement');
    }

    // Additional compatibility checks would go here
  }

  /**
   * Validates operation compatibility
   * @param {Array} original - Original operations
   * @param {Array} enhanced - Enhanced operations
   * @param {Object} validation - Validation result
   */
  #validateOperationCompatibility(original, enhanced, validation) {
    if (original.length !== enhanced.length) {
      validation.warnings.push('Operation count changed during enhancement');
    }

    // Additional compatibility checks would go here
  }
}

export default RuleMigrationHelper;
```

## Testing Requirements

### 1. Rule Functionality Tests

- **Enhanced rules**: All updated rules work with multi-target events
- **Backward compatibility**: All rules work with legacy single-target events
- **Performance**: Rule evaluation performance within acceptable limits
- **Error handling**: Rules handle malformed events gracefully

### 2. Integration Testing

- **End-to-end scenarios**: Complete action flows work correctly
- **Rule interactions**: Multiple rules can process same event
- **State consistency**: Game state remains consistent across rule executions

### 3. Migration Testing

- **Migration helper**: Utility correctly identifies migration opportunities
- **Enhanced rule generation**: Generated rules maintain functionality
- **Compatibility validation**: Validation correctly identifies issues

## Success Criteria

1. **Enhanced Functionality**: Core rules utilize multi-target data effectively
2. **Complete Compatibility**: All existing functionality preserved
3. **Performance**: No performance regression in rule evaluation
4. **Documentation**: Migration patterns clearly documented
5. **Validation**: All enhanced rules pass comprehensive testing

## Files Created

- `src/utils/ruleMigrationHelper.js`

## Files Modified

- `data/mods/core/rules/combat.json` (enhance combat rules)
- `data/mods/core/rules/interactions.json` (enhance interaction rules)
- `data/mods/core/rules/movement.json` (enhance movement rules)

## Validation Steps

1. Test all enhanced rules with multi-target events
2. Verify backward compatibility with legacy events
3. Test migration helper functionality
4. Validate rule performance under load
5. Test end-to-end game scenarios with enhanced rules

## Notes

- All enhancements maintain strict backward compatibility
- Migration helper provides safe upgrade path for custom rules
- Enhanced rules demonstrate multi-target capabilities without breaking existing functionality
- Performance impact is minimal due to conditional logic patterns

## Risk Assessment

**Medium Risk**: Modifications to core rules could affect game functionality. Extensive testing and backward compatibility measures minimize risk. Migration helper provides safe upgrade path.

## Next Steps

After this ticket completion:

1. Move to Ticket 13: Add Rules Testing Framework
2. Create comprehensive testing framework for rule validation
3. Begin comprehensive integration testing of multi-target system

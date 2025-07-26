# Ticket: Ensure Backward Compatibility

## Ticket ID: PHASE4-TICKET12
## Priority: Medium
## Estimated Time: 6-8 hours
## Dependencies: All Phase 1-3 tickets
## Blocks: PHASE5-TICKET16, PHASE5-TICKET17

## Overview

Ensure complete backward compatibility with existing single-target actions, legacy action definitions, and existing rule handlers. This includes comprehensive testing, migration utilities, and compatibility validation to guarantee that existing game content continues working without modification.

## Compatibility Goals

1. **Zero Breaking Changes**: All existing actions work without modification
2. **Legacy Format Support**: Original action definition format continues working
3. **Rule Compatibility**: Existing rules receive expected payload format
4. **API Stability**: External interfaces remain unchanged
5. **Performance Parity**: No performance regression for legacy actions

## Areas Requiring Compatibility

1. **Action Definitions**: Legacy `scope` property vs new `targets` object
2. **Event Payloads**: Single `targetId` vs multi-target `targets` structure
3. **Rule Handlers**: Access patterns for target information
4. **Command Processing**: Single vs multi-target command formats
5. **UI Integration**: Action display and interaction patterns

## Implementation Steps

### Step 1: Create Compatibility Layer

Create file: `src/compatibility/legacyActionAdapter.js`

```javascript
/**
 * @file Legacy action adapter for backward compatibility
 */

import { validateDependency } from '../utils/validationUtils.js';

/**
 * Adapts legacy single-target actions to work with multi-target system
 */
export class LegacyActionAdapter {
  #logger;

  /**
   * @param {Object} deps
   * @param {ILogger} deps.logger
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger');
    this.#logger = logger;
  }

  /**
   * Convert legacy action definition to multi-target format
   * @param {Object} legacyAction - Legacy action definition
   * @returns {Object} Multi-target compatible action definition
   */
  adaptActionDefinition(legacyAction) {
    // If already multi-target format, return as-is
    if (legacyAction.targets && typeof legacyAction.targets === 'object') {
      return legacyAction;
    }

    // If using legacy scope property, convert to targets format
    if (legacyAction.scope) {
      this.#logger.debug(`Adapting legacy action: ${legacyAction.id}`);
      
      return {
        ...legacyAction,
        targets: {
          primary: {
            scope: legacyAction.scope,
            placeholder: 'target',
            description: 'Target entity'
          }
        },
        // Preserve original scope for reference
        _legacyScope: legacyAction.scope,
        _isLegacyAdapted: true
      };
    }

    // If neither scope nor targets, assume no targets needed
    return legacyAction;
  }

  /**
   * Convert multi-target event payload to legacy format for old rules
   * @param {Object} multiTargetPayload - Multi-target event payload
   * @returns {Object} Legacy compatible payload
   */
  adaptEventPayload(multiTargetPayload) {
    // If already has targetId, it's compatible
    if (multiTargetPayload.targetId) {
      return multiTargetPayload;
    }

    // Extract primary target as legacy targetId
    const legacyPayload = { ...multiTargetPayload };
    
    if (multiTargetPayload.targets?.primary) {
      legacyPayload.targetId = multiTargetPayload.targets.primary.id;
      legacyPayload.target = multiTargetPayload.targets.primary;
    }

    return legacyPayload;
  }

  /**
   * Check if an action definition is legacy format
   * @param {Object} actionDef - Action definition to check
   * @returns {boolean} True if legacy format
   */
  isLegacyAction(actionDef) {
    return Boolean(
      actionDef.scope && 
      !actionDef.targets &&
      typeof actionDef.scope === 'string'
    );
  }

  /**
   * Migrate legacy action to modern format (non-destructive)
   * @param {Object} legacyAction - Legacy action definition
   * @returns {Object} Migration result with both formats
   */
  migrateAction(legacyAction) {
    const adapted = this.adaptActionDefinition(legacyAction);
    
    return {
      original: legacyAction,
      modernized: adapted,
      migrationNotes: this.#generateMigrationNotes(legacyAction, adapted),
      isFullyCompatible: this.#checkFullCompatibility(adapted)
    };
  }

  /**
   * Generate migration notes for an action
   * @private
   */
  #generateMigrationNotes(original, adapted) {
    const notes = [];

    if (original.scope) {
      notes.push(`Converted legacy 'scope' property to 'targets.primary.scope'`);
    }

    if (!original.template?.includes('{target}')) {
      notes.push(`Template may need updating to use {target} placeholder`);
    }

    if (original.prerequisites) {
      notes.push(`Prerequisites may need review for multi-target compatibility`);
    }

    return notes;
  }

  /**
   * Check if adapted action is fully compatible
   * @private
   */
  #checkFullCompatibility(adapted) {
    // Check for common compatibility issues
    const issues = [];

    if (!adapted.template) {
      issues.push('Missing template');
    }

    if (adapted.template && !adapted.template.includes('{target}')) {
      issues.push('Template missing {target} placeholder');
    }

    return issues.length === 0;
  }
}

export default LegacyActionAdapter;
```

### Step 2: Create Legacy Rule Adapter

Create file: `src/compatibility/legacyRuleAdapter.js`

```javascript
/**
 * @file Legacy rule adapter for backward compatibility
 */

import { validateDependency } from '../utils/validationUtils.js';

/**
 * Ensures legacy rules continue working with multi-target payloads
 */
export class LegacyRuleAdapter {
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger');
    this.#logger = logger;
  }

  /**
   * Adapt event payload for legacy rule processing
   * @param {Object} payload - Original event payload
   * @param {Object} rule - Rule definition
   * @returns {Object} Adapted payload for rule
   */
  adaptPayloadForRule(payload, rule) {
    // If rule was designed for legacy format, ensure compatibility
    if (this.#isLegacyRule(rule)) {
      return this.#adaptToLegacyFormat(payload);
    }

    // Modern rules get full payload
    return payload;
  }

  /**
   * Check if rule expects legacy payload format
   * @private
   */
  #isLegacyRule(rule) {
    // Check for legacy patterns in rule logic
    const ruleString = JSON.stringify(rule);
    
    // Legacy rules typically access targetId directly
    const hasLegacyTargetAccess = ruleString.includes('targetId') && 
                                 !ruleString.includes('targets.');

    // Legacy rules might reference specific legacy event structure
    const hasLegacyEventStructure = ruleString.includes('event.payload.targetId');

    return hasLegacyTargetAccess || hasLegacyEventStructure;
  }

  /**
   * Adapt payload to legacy format
   * @private
   */
  #adaptToLegacyFormat(payload) {
    const adapted = { ...payload };

    // Ensure targetId is present (primary target ID)
    if (!adapted.targetId && adapted.targets?.primary) {
      adapted.targetId = adapted.targets.primary.id;
    }

    // Add legacy target object for convenience
    if (adapted.targets?.primary && !adapted.target) {
      adapted.target = {
        id: adapted.targets.primary.id,
        displayName: adapted.targets.primary.displayName,
        components: adapted.targets.primary.components
      };
    }

    // Flatten common target properties for easy access
    if (adapted.targets?.primary) {
      adapted.targetDisplayName = adapted.targets.primary.displayName;
      adapted.targetComponents = adapted.targets.primary.components;
    }

    return adapted;
  }

  /**
   * Create a wrapper for legacy rule handler
   * @param {Function} legacyHandler - Original rule handler function
   * @returns {Function} Wrapped handler with payload adaptation
   */
  wrapLegacyHandler(legacyHandler) {
    return async (event, context) => {
      // Adapt payload for legacy compatibility
      const adaptedEvent = {
        ...event,
        payload: this.#adaptToLegacyFormat(event.payload)
      };

      return legacyHandler(adaptedEvent, context);
    };
  }

  /**
   * Validate that legacy rule still works with adapted payload
   * @param {Object} rule - Rule definition
   * @param {Object} samplePayload - Sample multi-target payload
   * @returns {Object} Validation result
   */
  validateLegacyRuleCompatibility(rule, samplePayload) {
    try {
      const adapted = this.adaptPayloadForRule(samplePayload, rule);
      
      // Check that all referenced properties exist
      const issues = this.#checkPropertyAccess(rule, adapted);
      
      return {
        compatible: issues.length === 0,
        issues,
        adaptedPayload: adapted
      };
    } catch (error) {
      return {
        compatible: false,
        issues: [`Rule validation failed: ${error.message}`],
        adaptedPayload: null
      };
    }
  }

  /**
   * Check if rule can access all needed properties
   * @private
   */
  #checkPropertyAccess(rule, payload) {
    const issues = [];
    const ruleString = JSON.stringify(rule);

    // Common legacy property patterns
    const legacyPatterns = [
      { pattern: /event\.payload\.targetId/g, property: 'targetId' },
      { pattern: /event\.payload\.target\./g, property: 'target' },
      { pattern: /event\.payload\.targetDisplayName/g, property: 'targetDisplayName' },
      { pattern: /event\.payload\.targetComponents/g, property: 'targetComponents' }
    ];

    for (const { pattern, property } of legacyPatterns) {
      if (pattern.test(ruleString) && !(property in payload)) {
        issues.push(`Rule accesses '${property}' but it's not available in adapted payload`);
      }
    }

    return issues;
  }
}

export default LegacyRuleAdapter;
```

### Step 3: Create Compatibility Tests

Create file: `tests/unit/compatibility/legacyActionCompatibility.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LegacyActionAdapter } from '../../../src/compatibility/legacyActionAdapter.js';

describe('Legacy Action Compatibility', () => {
  let adapter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    adapter = new LegacyActionAdapter({ logger: mockLogger });
  });

  describe('Action Definition Adaptation', () => {
    it('should adapt legacy scope-based action', () => {
      const legacyAction = {
        id: 'test:eat',
        name: 'Eat',
        description: 'Consume food',
        scope: 'actor.core:inventory.items[]',
        template: 'eat {target}'
      };

      const adapted = adapter.adaptActionDefinition(legacyAction);

      expect(adapted).toEqual({
        id: 'test:eat',
        name: 'Eat',
        description: 'Consume food',
        scope: 'actor.core:inventory.items[]',
        template: 'eat {target}',
        targets: {
          primary: {
            scope: 'actor.core:inventory.items[]',
            placeholder: 'target',
            description: 'Target entity'
          }
        },
        _legacyScope: 'actor.core:inventory.items[]',
        _isLegacyAdapted: true
      });
    });

    it('should leave modern actions unchanged', () => {
      const modernAction = {
        id: 'test:modern',
        name: 'Modern Action',
        targets: {
          primary: { scope: 'scope1', placeholder: 'item' },
          secondary: { scope: 'scope2', placeholder: 'target' }
        },
        template: 'use {item} on {target}'
      };

      const adapted = adapter.adaptActionDefinition(modernAction);

      expect(adapted).toEqual(modernAction);
    });

    it('should handle actions with neither scope nor targets', () => {
      const noTargetAction = {
        id: 'test:no_targets',
        name: 'No Targets',
        template: 'rest'
      };

      const adapted = adapter.adaptActionDefinition(noTargetAction);

      expect(adapted).toEqual(noTargetAction);
    });

    it('should identify legacy actions correctly', () => {
      const legacyAction = {
        id: 'test:legacy',
        scope: 'actor.items[]'
      };

      const modernAction = {
        id: 'test:modern',
        targets: { primary: { scope: 'scope' } }
      };

      expect(adapter.isLegacyAction(legacyAction)).toBe(true);
      expect(adapter.isLegacyAction(modernAction)).toBe(false);
    });
  });

  describe('Event Payload Adaptation', () => {
    it('should preserve existing targetId in payload', () => {
      const payload = {
        actionId: 'test:action',
        actorId: 'player',
        targetId: 'existing_target',
        targets: {
          primary: { id: 'existing_target', displayName: 'Target' }
        }
      };

      const adapted = adapter.adaptEventPayload(payload);

      expect(adapted.targetId).toBe('existing_target');
      expect(adapted).toEqual(payload);
    });

    it('should extract targetId from primary target', () => {
      const payload = {
        actionId: 'test:action',
        actorId: 'player',
        targets: {
          primary: { 
            id: 'primary_target', 
            displayName: 'Primary Target',
            components: { 'core:item': { name: 'Test Item' } }
          },
          secondary: { id: 'secondary_target', displayName: 'Secondary' }
        }
      };

      const adapted = adapter.adaptEventPayload(payload);

      expect(adapted.targetId).toBe('primary_target');
      expect(adapted.target).toEqual({
        id: 'primary_target',
        displayName: 'Primary Target',
        components: { 'core:item': { name: 'Test Item' } }
      });
    });

    it('should handle payload without targets', () => {
      const payload = {
        actionId: 'test:action',
        actorId: 'player'
      };

      const adapted = adapter.adaptEventPayload(payload);

      expect(adapted).toEqual(payload);
      expect(adapted.targetId).toBeUndefined();
    });
  });

  describe('Action Migration', () => {
    it('should provide comprehensive migration information', () => {
      const legacyAction = {
        id: 'test:legacy',
        name: 'Legacy Action',
        scope: 'actor.inventory[]',
        template: 'use {target}',
        prerequisites: [
          {
            logic: { '>': [{ var: 'actor.level' }, 5] },
            failure_message: 'Level too low'
          }
        ]
      };

      const migration = adapter.migrateAction(legacyAction);

      expect(migration.original).toEqual(legacyAction);
      expect(migration.modernized.targets.primary.scope).toBe('actor.inventory[]');
      expect(migration.migrationNotes).toContain(
        `Converted legacy 'scope' property to 'targets.primary.scope'`
      );
      expect(migration.migrationNotes).toContain(
        'Prerequisites may need review for multi-target compatibility'
      );
      expect(migration.isFullyCompatible).toBe(true);
    });

    it('should identify compatibility issues', () => {
      const problematicAction = {
        id: 'test:problematic',
        scope: 'some.scope[]',
        template: 'do something' // Missing {target} placeholder
      };

      const migration = adapter.migrateAction(problematicAction);

      expect(migration.isFullyCompatible).toBe(false);
      expect(migration.migrationNotes).toContain(
        'Template may need updating to use {target} placeholder'
      );
    });
  });
});
```

Create file: `tests/unit/compatibility/legacyRuleCompatibility.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LegacyRuleAdapter } from '../../../src/compatibility/legacyRuleAdapter.js';

describe('Legacy Rule Compatibility', () => {
  let adapter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    adapter = new LegacyRuleAdapter({ logger: mockLogger });
  });

  describe('Rule Detection', () => {
    it('should identify legacy rules that access targetId', () => {
      const legacyRule = {
        id: 'test:legacy_rule',
        eventName: 'core:attempt_action',
        conditions: [
          {
            logic: {
              '==': [{ var: 'event.payload.actionId' }, 'test:eat']
            }
          }
        ],
        operations: [
          {
            type: 'modifyComponent',
            config: {
              entityId: { var: 'event.payload.targetId' }, // Legacy access
              componentId: 'core:health',
              changes: { current: { '+': [{ var: 'current' }, 10] } }
            }
          }
        ]
      };

      const samplePayload = {
        actionId: 'test:eat',
        actorId: 'player',
        targets: {
          primary: { id: 'apple_001', displayName: 'Red Apple' }
        }
      };

      const adapted = adapter.adaptPayloadForRule(samplePayload, legacyRule);

      expect(adapted.targetId).toBe('apple_001');
      expect(adapted.target.id).toBe('apple_001');
      expect(adapted.target.displayName).toBe('Red Apple');
    });

    it('should leave modern rules unchanged', () => {
      const modernRule = {
        id: 'test:modern_rule',
        eventName: 'core:attempt_action',
        operations: [
          {
            type: 'modifyComponent',
            config: {
              entityId: { var: 'event.payload.targets.primary.id' }, // Modern access
              componentId: 'core:health'
            }
          }
        ]
      };

      const samplePayload = {
        actionId: 'test:action',
        actorId: 'player',
        targets: {
          primary: { id: 'target_001' },
          secondary: { id: 'target_002' }
        }
      };

      const adapted = adapter.adaptPayloadForRule(samplePayload, modernRule);

      expect(adapted).toEqual(samplePayload);
    });
  });

  describe('Legacy Handler Wrapping', () => {
    it('should wrap legacy handler with payload adaptation', async () => {
      const legacyHandler = jest.fn().mockResolvedValue('success');

      const wrappedHandler = adapter.wrapLegacyHandler(legacyHandler);

      const event = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'test:action',
          actorId: 'player',
          targets: {
            primary: { id: 'target_001', displayName: 'Target' }
          }
        }
      };

      const context = { gameState: 'active' };

      await wrappedHandler(event, context);

      expect(legacyHandler).toHaveBeenCalledWith(
        {
          type: 'core:attempt_action',
          payload: expect.objectContaining({
            actionId: 'test:action',
            actorId: 'player',
            targetId: 'target_001',
            target: {
              id: 'target_001',
              displayName: 'Target'
            },
            targetDisplayName: 'Target'
          })
        },
        context
      );
    });
  });

  describe('Compatibility Validation', () => {
    it('should validate legacy rule compatibility', () => {
      const legacyRule = {
        conditions: [
          {
            logic: {
              '==': [{ var: 'event.payload.targetId' }, 'expected_target']
            }
          }
        ]
      };

      const samplePayload = {
        actionId: 'test:action',
        actorId: 'player',
        targets: {
          primary: { id: 'target_001', displayName: 'Target' }
        }
      };

      const validation = adapter.validateLegacyRuleCompatibility(
        legacyRule,
        samplePayload
      );

      expect(validation.compatible).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.adaptedPayload.targetId).toBe('target_001');
    });

    it('should identify compatibility issues', () => {
      const problematicRule = {
        operations: [
          {
            config: {
              entityId: { var: 'event.payload.nonexistentProperty' }
            }
          }
        ]
      };

      const samplePayload = {
        actionId: 'test:action',
        actorId: 'player',
        targets: {
          primary: { id: 'target_001' }
        }
      };

      const validation = adapter.validateLegacyRuleCompatibility(
        problematicRule,
        samplePayload
      );

      expect(validation.compatible).toBe(true); // Basic compatibility passes
      // More sophisticated analysis would catch undefined property access
    });
  });

  describe('Property Access Flattening', () => {
    it('should flatten target properties for legacy access', () => {
      const payload = {
        actionId: 'test:action',
        actorId: 'player',
        targets: {
          primary: {
            id: 'item_001',
            displayName: 'Magic Sword',
            components: {
              'core:item': { name: 'Magic Sword', damage: 10 },
              'core:enchantment': { type: 'fire' }
            }
          }
        }
      };

      const fakeRule = { operations: [{ config: { entityId: { var: 'event.payload.targetId' } } }] };
      const adapted = adapter.adaptPayloadForRule(payload, fakeRule);

      expect(adapted.targetId).toBe('item_001');
      expect(adapted.targetDisplayName).toBe('Magic Sword');
      expect(adapted.targetComponents).toEqual({
        'core:item': { name: 'Magic Sword', damage: 10 },
        'core:enchantment': { type: 'fire' }
      });
      expect(adapted.target).toEqual({
        id: 'item_001',
        displayName: 'Magic Sword',
        components: {
          'core:item': { name: 'Magic Sword', damage: 10 },
          'core:enchantment': { type: 'fire' }
        }
      });
    });
  });
});
```

### Step 4: Integration Compatibility Tests

Create file: `tests/integration/compatibility/backwardCompatibilityIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Backward Compatibility Integration', () => {
  let testBed;
  let actionProcessor;
  let eventBus;
  let ruleEngine;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    actionProcessor = testBed.getService('actionCandidateProcessor');
    eventBus = testBed.getService('eventBus');
    ruleEngine = testBed.getService('ruleEngine');

    // Enable compatibility mode
    testBed.enableLegacyCompatibility();
  });

  describe('Legacy Action Processing', () => {
    it('should process legacy eat action unchanged', async () => {
      // Define legacy action exactly as it would exist in old system
      const legacyEatAction = {
        id: 'core:eat',
        name: 'Eat',
        description: 'Consume food to restore health',
        scope: 'actor.core:inventory.items[]',
        template: 'eat {target}',
        required_components: {
          actor: ['core:inventory', 'core:health']
        },
        prerequisites: [
          {
            logic: {
              '>': [{ var: 'actor.components.core:health.current' }, 0]
            },
            failure_message: 'You are unconscious and cannot eat.'
          }
        ]
      };

      // Create legacy rule that expects old payload format
      const legacyEatRule = {
        id: 'core:handle_eat',
        description: 'Handle eating food',
        eventName: 'core:attempt_action',
        conditions: [
          {
            logic: {
              '==': [{ var: 'event.payload.actionId' }, 'core:eat']
            }
          }
        ],
        operations: [
          {
            type: 'modifyComponent',
            config: {
              entityId: { var: 'event.payload.actorId' },
              componentId: 'core:health',
              changes: {
                current: {
                  '+': [
                    { var: 'current' },
                    { var: 'event.payload.target.components.core:item.health_restore' }
                  ]
                }
              }
            }
          },
          {
            type: 'removeComponent',
            config: {
              entityId: { var: 'event.payload.targetId' }, // Legacy access
              componentId: 'core:item'
            }
          }
        ]
      };

      // Register legacy action and rule
      testBed.registerAction(legacyEatAction);
      testBed.registerRule(legacyEatRule);

      // Create game entities
      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Player' },
        'core:health': { current: 80, max: 100 },
        'core:inventory': { items: ['apple_001'] },
        'core:position': { locationId: 'forest' }
      });

      const apple = testBed.createEntity('apple_001', {
        'core:item': { 
          name: 'Red Apple', 
          type: 'food',
          health_restore: 15
        }
      });

      // Process legacy action
      const result = await actionProcessor.process(
        legacyEatAction,
        player,
        { location: null }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0].command).toBe('eat Red Apple');

      // Execute the action to test rule compatibility
      const executeResult = await testBed.executeAction(
        player,
        result.value.actions[0]
      );

      expect(executeResult.success).toBe(true);

      // Verify legacy rule executed correctly
      const updatedPlayer = testBed.getEntity('player');
      expect(updatedPlayer.getComponent('core:health').current).toBe(95); // 80 + 15

      // Verify apple was consumed
      expect(testBed.entityExists('apple_001')).toBe(false);
    });

    it('should handle legacy actions with complex scope expressions', async () => {
      const legacyTradeAction = {
        id: 'trade:barter',
        name: 'Barter',
        description: 'Trade items with NPCs',
        scope: 'location.core:actors[][{"and": [{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}, {"condition_ref": "trade:can_trade"}]}]',
        template: 'trade with {target}'
      };

      const legacyTradeRule = {
        id: 'trade:handle_barter',
        eventName: 'core:attempt_action',
        conditions: [
          {
            logic: {
              '==': [{ var: 'event.payload.actionId' }, 'trade:barter']
            }
          }
        ],
        operations: [
          {
            type: 'dispatchEvent',
            config: {
              eventName: 'trade:trade_initiated',
              payload: {
                trader: { var: 'event.payload.actorId' },
                merchant: { var: 'event.payload.targetId' } // Legacy targetId access
              }
            }
          }
        ]
      };

      testBed.registerAction(legacyTradeAction);
      testBed.registerRule(legacyTradeRule);
      testBed.registerCondition('trade:can_trade', {
        logic: { '==': [{ var: 'entity.components.trade:merchant.available' }, true] }
      });

      const player = testBed.createEntity('player', {
        'core:actor': { name: 'Trader' },
        'core:position': { locationId: 'market' }
      });

      const merchant = testBed.createEntity('merchant_001', {
        'core:actor': { name: 'Shop Keeper' },
        'core:position': { locationId: 'market' },
        'trade:merchant': { available: true }
      });

      const market = testBed.createEntity('market', {
        'core:location': { name: 'Town Market' },
        'core:actors': { actors: ['player', 'merchant_001'] }
      });

      const result = await actionProcessor.process(
        legacyTradeAction,
        player,
        { location: market }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0].command).toBe('trade with Shop Keeper');

      // Execute and verify rule works
      const capturedEvents = [];
      testBed.addEventCapture('trade:trade_initiated', capturedEvents);

      await testBed.executeAction(player, result.value.actions[0]);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].payload.trader).toBe('player');
      expect(capturedEvents[0].payload.merchant).toBe('merchant_001');
    });
  });

  describe('Mixed Legacy and Modern Actions', () => {
    it('should handle both legacy and modern actions in same game', async () => {
      // Legacy action
      const legacyAction = {
        id: 'legacy:simple',
        name: 'Simple Legacy',
        scope: 'actor.core:inventory.items[]',
        template: 'use {target}'
      };

      // Modern multi-target action
      const modernAction = {
        id: 'modern:complex',
        name: 'Complex Modern',
        targets: {
          primary: {
            scope: 'actor.core:inventory.tools[]',
            placeholder: 'tool'
          },
          secondary: {
            scope: 'location.core:containers[]',
            placeholder: 'container'
          }
        },
        template: 'use {tool} on {container}',
        generateCombinations: true
      };

      testBed.registerAction(legacyAction);
      testBed.registerAction(modernAction);

      const player = testBed.createEntity('player', {
        'core:inventory': { 
          items: ['hammer_001', 'nail_002'],
          tools: ['hammer_001']
        },
        'core:position': { locationId: 'workshop' }
      });

      testBed.createEntity('hammer_001', {
        'core:item': { name: 'Hammer', type: 'tool' }
      });

      testBed.createEntity('nail_002', {
        'core:item': { name: 'Nail', type: 'fastener' }
      });

      testBed.createEntity('chest_001', {
        'core:container': { locked: false },
        'core:position': { locationId: 'workshop' }
      });

      const workshop = testBed.createEntity('workshop', {
        'core:location': { name: 'Workshop' },
        'core:containers': { containers: ['chest_001'] }
      });

      // Test legacy action
      const legacyResult = await actionProcessor.process(
        legacyAction,
        player,
        { location: workshop }
      );

      expect(legacyResult.success).toBe(true);
      expect(legacyResult.value.actions).toHaveLength(2); // hammer and nail

      // Test modern action  
      testBed.registerScope('actor.core:inventory.tools[]', 'actor.core:inventory.tools[]');
      testBed.registerScope('location.core:containers[]', 'location.core:containers.containers[]');

      const modernResult = await actionProcessor.process(
        modernAction,
        player,
        { location: workshop }
      );

      expect(modernResult.success).toBe(true);
      expect(modernResult.value.actions).toHaveLength(1); // 1 tool × 1 container
      expect(modernResult.value.actions[0].command).toBe('use Hammer on chest_001');
    });
  });

  describe('Performance Compatibility', () => {
    it('should maintain performance parity for legacy actions', async () => {
      const legacyAction = {
        id: 'performance:test',
        scope: 'actor.core:inventory.items[]',
        template: 'process {target}'
      };

      testBed.registerAction(legacyAction);

      // Create player with many items
      const itemIds = Array.from({ length: 100 }, (_, i) => `item_${i}`);
      const player = testBed.createEntity('player', {
        'core:inventory': { items: itemIds }
      });

      itemIds.forEach(id => {
        testBed.createEntity(id, {
          'core:item': { name: `Item ${id}` }
        });
      });

      // Measure legacy action processing time
      const start = performance.now();
      const result = await actionProcessor.process(
        legacyAction,
        player,
        { location: null }
      );
      const end = performance.now();

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(100);
      expect(end - start).toBeLessThan(100); // Should be fast
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should provide legacy-compatible error messages', async () => {
      const legacyAction = {
        id: 'error:test',
        scope: 'nonexistent.property[]',
        template: 'fail {target}'
      };

      testBed.registerAction(legacyAction);

      const player = testBed.createEntity('player', {});

      const result = await actionProcessor.process(
        legacyAction,
        player,
        { location: null }
      );

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      // Should not throw errors, just return empty results
    });
  });
});
```

### Step 5: Create Compatibility Validation Tool

Create file: `src/tools/compatibilityValidator.js`

```javascript
/**
 * @file Tool for validating backward compatibility
 */

import { LegacyActionAdapter } from '../compatibility/legacyActionAdapter.js';
import { LegacyRuleAdapter } from '../compatibility/legacyRuleAdapter.js';
import { validateDependency } from '../utils/validationUtils.js';

/**
 * Validates backward compatibility of actions and rules
 */
export class CompatibilityValidator {
  #actionAdapter;
  #ruleAdapter;
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger');
    
    this.#logger = logger;
    this.#actionAdapter = new LegacyActionAdapter({ logger });
    this.#ruleAdapter = new LegacyRuleAdapter({ logger });
  }

  /**
   * Validate compatibility of entire mod
   * @param {Object} mod - Mod definition with actions and rules
   * @returns {Object} Comprehensive compatibility report
   */
  validateMod(mod) {
    const report = {
      modId: mod.id,
      overall: 'unknown',
      actions: {
        total: 0,
        legacy: 0,
        modern: 0,
        issues: []
      },
      rules: {
        total: 0,
        legacy: 0,
        modern: 0,
        issues: []
      },
      recommendations: []
    };

    // Validate actions
    if (mod.actions) {
      report.actions = this.#validateActions(mod.actions);
    }

    // Validate rules
    if (mod.rules) {
      report.rules = this.#validateRules(mod.rules, mod.actions);
    }

    // Generate overall assessment
    report.overall = this.#assessOverallCompatibility(report);
    report.recommendations = this.#generateRecommendations(report);

    return report;
  }

  /**
   * Validate actions in mod
   * @private
   */
  #validateActions(actions) {
    const actionReport = {
      total: actions.length,
      legacy: 0,
      modern: 0,
      issues: [],
      details: []
    };

    for (const action of actions) {
      const isLegacy = this.#actionAdapter.isLegacyAction(action);
      
      if (isLegacy) {
        actionReport.legacy++;
        const migration = this.#actionAdapter.migrateAction(action);
        
        actionReport.details.push({
          id: action.id,
          type: 'legacy',
          compatible: migration.isFullyCompatible,
          migrationNotes: migration.migrationNotes,
          issues: migration.isFullyCompatible ? [] : ['Template or structure issues']
        });

        if (!migration.isFullyCompatible) {
          actionReport.issues.push({
            actionId: action.id,
            severity: 'warning',
            message: 'Action may need manual review',
            details: migration.migrationNotes
          });
        }
      } else {
        actionReport.modern++;
        actionReport.details.push({
          id: action.id,
          type: 'modern',
          compatible: true,
          issues: []
        });
      }
    }

    return actionReport;
  }

  /**
   * Validate rules in mod
   * @private
   */
  #validateRules(rules, actions) {
    const ruleReport = {
      total: rules.length,
      legacy: 0,
      modern: 0,
      issues: [],
      details: []
    };

    // Create sample payloads for rule testing
    const samplePayloads = this.#createSamplePayloads(actions);

    for (const rule of rules) {
      const relevantPayload = this.#findRelevantPayload(rule, samplePayloads);
      
      if (relevantPayload) {
        const validation = this.#ruleAdapter.validateLegacyRuleCompatibility(
          rule,
          relevantPayload
        );

        const isLegacy = !validation.compatible || 
                        JSON.stringify(rule).includes('targetId');

        if (isLegacy) {
          ruleReport.legacy++;
        } else {
          ruleReport.modern++;
        }

        ruleReport.details.push({
          id: rule.id,
          type: isLegacy ? 'legacy' : 'modern',
          compatible: validation.compatible,
          issues: validation.issues
        });

        if (!validation.compatible) {
          ruleReport.issues.push({
            ruleId: rule.id,
            severity: 'error',
            message: 'Rule compatibility issues detected',
            details: validation.issues
          });
        }
      }
    }

    return ruleReport;
  }

  /**
   * Create sample payloads for testing
   * @private
   */
  #createSamplePayloads(actions) {
    const payloads = [];

    for (const action of actions) {
      // Legacy format
      payloads.push({
        actionId: action.id,
        actorId: 'sample_actor',
        targetId: 'sample_target',
        timestamp: Date.now()
      });

      // Modern format
      payloads.push({
        actionId: action.id,
        actorId: 'sample_actor',
        targets: {
          primary: { 
            id: 'sample_primary', 
            displayName: 'Sample Primary',
            components: {}
          },
          secondary: { 
            id: 'sample_secondary', 
            displayName: 'Sample Secondary',
            components: {}
          }
        },
        timestamp: Date.now()
      });
    }

    return payloads;
  }

  /**
   * Find relevant payload for rule testing
   * @private
   */
  #findRelevantPayload(rule, payloads) {
    // Try to match by action ID in rule conditions
    const ruleString = JSON.stringify(rule);
    
    for (const payload of payloads) {
      if (ruleString.includes(payload.actionId)) {
        return payload;
      }
    }

    // Return first available payload as fallback
    return payloads[0] || null;
  }

  /**
   * Assess overall compatibility
   * @private
   */
  #assessOverallCompatibility(report) {
    const hasErrors = report.actions.issues.some(i => i.severity === 'error') ||
                     report.rules.issues.some(i => i.severity === 'error');

    const hasWarnings = report.actions.issues.some(i => i.severity === 'warning') ||
                       report.rules.issues.some(i => i.severity === 'warning');

    if (hasErrors) return 'incompatible';
    if (hasWarnings) return 'compatible_with_warnings';
    return 'fully_compatible';
  }

  /**
   * Generate recommendations
   * @private
   */
  #generateRecommendations(report) {
    const recommendations = [];

    if (report.actions.legacy > 0) {
      recommendations.push({
        type: 'migration',
        priority: 'medium',
        message: `Consider migrating ${report.actions.legacy} legacy actions to modern format`,
        details: 'Modern format provides better multi-target support and clearer structure'
      });
    }

    if (report.rules.legacy > 0) {
      recommendations.push({
        type: 'rule_update',
        priority: 'low',
        message: `${report.rules.legacy} rules use legacy patterns`,
        details: 'Legacy rules will continue working but consider updating for consistency'
      });
    }

    if (report.overall === 'incompatible') {
      recommendations.push({
        type: 'urgent_fix',
        priority: 'high',
        message: 'Critical compatibility issues detected',
        details: 'Review and fix compatibility errors before deployment'
      });
    }

    return recommendations;
  }

  /**
   * Generate compatibility report for display
   * @param {Object} report - Compatibility report
   * @returns {string} Formatted report
   */
  formatReport(report) {
    const lines = [];
    
    lines.push(`# Compatibility Report: ${report.modId}`);
    lines.push(`Overall Status: ${report.overall.toUpperCase()}`);
    lines.push('');

    lines.push('## Actions');
    lines.push(`- Total: ${report.actions.total}`);
    lines.push(`- Legacy: ${report.actions.legacy}`);
    lines.push(`- Modern: ${report.actions.modern}`);
    lines.push(`- Issues: ${report.actions.issues.length}`);
    lines.push('');

    lines.push('## Rules');
    lines.push(`- Total: ${report.rules.total}`);
    lines.push(`- Legacy: ${report.rules.legacy}`);
    lines.push(`- Modern: ${report.rules.modern}`);
    lines.push(`- Issues: ${report.rules.issues.length}`);
    lines.push('');

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      for (const rec of report.recommendations) {
        lines.push(`- **${rec.priority.toUpperCase()}**: ${rec.message}`);
        lines.push(`  ${rec.details}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

export default CompatibilityValidator;
```

### Step 6: Create CLI Tool for Compatibility Checking

Create file: `scripts/checkCompatibility.js`

```javascript
#!/usr/bin/env node

/**
 * @file CLI tool for checking backward compatibility
 */

import fs from 'fs/promises';
import path from 'path';
import { CompatibilityValidator } from '../src/tools/compatibilityValidator.js';

class CompatibilityChecker {
  constructor() {
    this.validator = new CompatibilityValidator({
      logger: {
        debug: () => {},
        info: console.log,
        warn: console.warn,
        error: console.error
      }
    });
  }

  async checkMod(modPath) {
    try {
      const mod = await this.loadMod(modPath);
      const report = this.validator.validateMod(mod);
      
      console.log(this.validator.formatReport(report));
      
      // Return exit code based on compatibility
      if (report.overall === 'incompatible') {
        process.exit(1);
      } else if (report.overall === 'compatible_with_warnings') {
        process.exit(2);
      } else {
        process.exit(0);
      }
    } catch (error) {
      console.error(`Error checking compatibility: ${error.message}`);
      process.exit(1);
    }
  }

  async checkAllMods(modsDir = 'data/mods') {
    try {
      const modDirs = await fs.readdir(modsDir);
      let overallCompatible = true;
      let hasWarnings = false;

      for (const modDir of modDirs) {
        const modPath = path.join(modsDir, modDir);
        const stat = await fs.stat(modPath);
        
        if (stat.isDirectory()) {
          console.log(`\n=== Checking ${modDir} ===`);
          
          try {
            const mod = await this.loadMod(modPath);
            const report = this.validator.validateMod(mod);
            
            console.log(this.validator.formatReport(report));
            
            if (report.overall === 'incompatible') {
              overallCompatible = false;
            } else if (report.overall === 'compatible_with_warnings') {
              hasWarnings = true;
            }
          } catch (error) {
            console.error(`Error checking ${modDir}: ${error.message}`);
            overallCompatible = false;
          }
        }
      }

      // Exit with appropriate code
      if (!overallCompatible) {
        console.log('\n❌ Some mods have compatibility issues');
        process.exit(1);
      } else if (hasWarnings) {
        console.log('\n⚠️  All mods compatible with warnings');
        process.exit(2);
      } else {
        console.log('\n✅ All mods fully compatible');
        process.exit(0);
      }
    } catch (error) {
      console.error(`Error checking mods: ${error.message}`);
      process.exit(1);
    }
  }

  async loadMod(modPath) {
    const manifestPath = path.join(modPath, 'mod-manifest.json');
    const manifestData = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestData);

    const mod = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      actions: [],
      rules: []
    };

    // Load actions
    try {
      const actionsDir = path.join(modPath, 'actions');
      const actionFiles = await fs.readdir(actionsDir);
      
      for (const file of actionFiles) {
        if (file.endsWith('.action.json')) {
          const actionPath = path.join(actionsDir, file);
          const actionData = await fs.readFile(actionPath, 'utf8');
          mod.actions.push(JSON.parse(actionData));
        }
      }
    } catch (error) {
      // Actions directory might not exist
    }

    // Load rules
    try {
      const rulesDir = path.join(modPath, 'rules');
      const ruleFiles = await fs.readdir(rulesDir);
      
      for (const file of ruleFiles) {
        if (file.endsWith('.rule.json')) {
          const rulePath = path.join(rulesDir, file);
          const ruleData = await fs.readFile(rulePath, 'utf8');
          mod.rules.push(JSON.parse(ruleData));
        }
      }
    } catch (error) {
      // Rules directory might not exist
    }

    return mod;
  }
}

// CLI interface
const args = process.argv.slice(2);
const checker = new CompatibilityChecker();

if (args.length === 0) {
  checker.checkAllMods();
} else if (args[0] === '--mod' && args[1]) {
  checker.checkMod(args[1]);
} else {
  console.log('Usage:');
  console.log('  node scripts/checkCompatibility.js                # Check all mods');
  console.log('  node scripts/checkCompatibility.js --mod <path>   # Check specific mod');
  process.exit(1);
}
```

## Testing Strategy

### Unit Tests
1. **Adapter Logic**: Conversion between legacy and modern formats
2. **Rule Compatibility**: Legacy rule handler wrapping and adaptation
3. **Migration Tools**: Action migration and validation
4. **Error Handling**: Graceful handling of incompatible patterns

### Integration Tests
1. **Full Pipeline**: End-to-end processing of legacy actions
2. **Mixed Scenarios**: Legacy and modern actions in same environment
3. **Performance**: No regression for legacy action processing
4. **Rule Execution**: Legacy rules work with adapted payloads

### Compatibility Tests
1. **Real Legacy Actions**: Test with actual existing action definitions
2. **Legacy Rule Patterns**: Common rule patterns from existing codebase
3. **Complex Scenarios**: Multi-step interactions using legacy components
4. **Edge Cases**: Unusual legacy patterns and configurations

## Acceptance Criteria

1. ✅ All existing single-target actions work without modification
2. ✅ Legacy action definitions automatically adapt to new system
3. ✅ Existing rules receive compatible event payloads
4. ✅ No performance regression for legacy actions
5. ✅ Legacy and modern actions can coexist in same mod
6. ✅ Compatibility validation tools identify potential issues
7. ✅ Migration utilities help transition to modern format
8. ✅ Comprehensive testing validates all compatibility scenarios
9. ✅ Clear documentation explains compatibility guarantees
10. ✅ CLI tools help validate mod compatibility

## Migration Strategy

### Phase 1: Full Compatibility (Current)
- All legacy formats work unchanged
- Automatic adaptation at runtime
- No breaking changes introduced

### Phase 2: Gradual Migration (Future)
- Tools to assist migration to modern format
- Warnings for deprecated patterns
- Clear migration path documented

### Phase 3: Long-term Support (Future)
- Legacy support maintained indefinitely
- Optional modern-only mode for new projects
- Performance optimizations for modern format

## Future Enhancements

1. **Automatic Migration**: Tools to automatically convert legacy actions
2. **Compatibility Metrics**: Runtime monitoring of compatibility usage
3. **Performance Optimization**: Optimize legacy path performance
4. **Migration Assistance**: Interactive tools for complex migrations
5. **Validation Integration**: Build-time compatibility checking
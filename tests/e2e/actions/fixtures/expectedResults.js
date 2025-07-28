/**
 * @file Expected results for multi-target action E2E tests
 * @description Defines expected outcomes for various test scenarios
 */

export const expectedOperationSequences = {
  // Expected operations for basic throw action
  throwItem: [
    {
      type: 'modifyComponent',
      entityId: 'player',
      componentId: 'core:inventory',
      operation: 'removeItem',
      itemId: 'rock_001'
    },
    {
      type: 'dispatchEvent',
      eventType: 'ITEM_THROWN_AT_TARGET',
      payload: {
        actorId: 'player',
        itemId: 'rock_001',
        targetId: 'guard_001'
      }
    },
    {
      type: 'modifyComponent',
      entityId: 'guard_001',
      componentId: 'core:health',
      operation: 'decrease',
      amount: 5
    }
  ],

  // Expected operations for unlock action
  unlockContainer: [
    {
      type: 'modifyComponent',
      entityId: 'chest_001',
      componentId: 'core:container',
      changes: { locked: false }
    },
    {
      type: 'modifyComponent',
      entityId: 'brass_key_001',
      componentId: 'core:item',
      operation: 'decreaseDurability',
      amount: 1
    },
    {
      type: 'dispatchEvent',
      eventType: 'CONTAINER_UNLOCKED',
      payload: {
        actorId: 'player',
        containerId: 'chest_001',
        keyId: 'brass_key_001'
      }
    }
  ],

  // Expected operations for enchantment
  enchantItem: [
    {
      type: 'validatePrerequisites',
      checks: ['intelligence >= 15']
    },
    {
      type: 'modifyComponent',
      entityId: 'sword_001',
      componentId: 'core:enchantment',
      changes: {
        type: 'fire',
        power: 5,
        source: 'crystal_001'
      }
    },
    {
      type: 'modifyComponent',
      entityId: 'player',
      componentId: 'core:inventory',
      operation: 'removeItem',
      itemId: 'crystal_001'
    },
    {
      type: 'dispatchEvent',
      eventType: 'ITEM_ENCHANTED',
      payload: {
        actorId: 'player',
        itemId: 'sword_001',
        enchantmentType: 'fire',
        catalystId: 'crystal_001'
      }
    }
  ],

  // Expected operations for transfer
  transferItems: [
    {
      type: 'validateContainer',
      containerId: 'chest_001',
      checkCapacity: true
    },
    {
      type: 'forEach',
      items: ['item_001', 'item_002'],
      operation: {
        type: 'transferItem',
        from: 'player',
        to: 'chest_001'
      }
    },
    {
      type: 'modifyComponent',
      entityId: 'player',
      componentId: 'core:inventory',
      operation: 'updateItems'
    },
    {
      type: 'modifyComponent',
      entityId: 'chest_001',
      componentId: 'core:container',
      operation: 'updateItems'
    }
  ],

  // Expected operations for healing
  healWounded: [
    {
      type: 'forEach',
      targets: ['wounded_ally_1', 'wounded_ally_2'],
      operation: {
        type: 'modifyComponent',
        componentId: 'core:health',
        operation: 'heal',
        amount: 20
      }
    },
    {
      type: 'dispatchEvent',
      eventType: 'HEALING_PERFORMED',
      payload: {
        healerId: 'healer',
        targetIds: ['wounded_ally_1', 'wounded_ally_2'],
        healAmount: 20
      }
    }
  ]
};

export const expectedEventSequences = {
  // Events for throw action
  throwItem: [
    {
      type: 'ACTION_INITIATED',
      payload: {
        actionId: 'test:throw_item',
        actorId: 'player',
        targets: { primary: 'rock_001', secondary: 'guard_001' }
      }
    },
    {
      type: 'INVENTORY_ITEM_REMOVED',
      payload: {
        entityId: 'player',
        itemId: 'rock_001'
      }
    },
    {
      type: 'ITEM_THROWN_AT_TARGET',
      payload: {
        actorId: 'player',
        itemId: 'rock_001',
        targetId: 'guard_001',
        distance: 3
      }
    },
    {
      type: 'ENTITY_DAMAGED',
      payload: {
        entityId: 'guard_001',
        damage: 5,
        damageType: 'impact',
        sourceId: 'player'
      }
    },
    {
      type: 'ACTION_COMPLETED',
      payload: {
        actionId: 'test:throw_item',
        actorId: 'player',
        success: true
      }
    }
  ],

  // Events for explosion (cascading)
  explosion: [
    {
      type: 'ACTION_INITIATED',
      payload: {
        actionId: 'test:throw_explosive',
        actorId: 'player',
        targets: { primary: 'bomb_001', secondary: 'enemy_001' }
      }
    },
    {
      type: 'EXPLOSIVE_THROWN',
      payload: {
        actorId: 'player',
        explosiveId: 'bomb_001',
        targetPosition: { x: 2, y: 0 }
      }
    },
    {
      type: 'EXPLOSION_TRIGGERED',
      payload: {
        position: { x: 2, y: 0 },
        radius: 5,
        damage: 50
      }
    },
    // Cascading damage events
    {
      type: 'AREA_DAMAGE_APPLIED',
      payload: {
        targetId: 'enemy_001',
        damage: 50, // Full damage at center
        distance: 0
      }
    },
    {
      type: 'AREA_DAMAGE_APPLIED',
      payload: {
        targetId: 'enemy_002',
        damage: 25, // Reduced damage at distance
        distance: 4.24
      }
    },
    {
      type: 'AREA_DAMAGE_APPLIED',
      payload: {
        targetId: 'enemy_003',
        damage: 15, // Further reduced at edge
        distance: 5
      }
    }
  ],

  // Events for formation change
  formationChange: [
    {
      type: 'FORMATION_ORDERED',
      payload: {
        leaderId: 'leader',
        formationType: 'defensive',
        affectedEntities: ['follower1', 'follower2', 'follower3']
      }
    },
    {
      type: 'ENTITY_POSITION_CHANGED',
      payload: { entityId: 'follower1', newPosition: { x: -1, y: 0 } }
    },
    {
      type: 'ENTITY_POSITION_CHANGED',
      payload: { entityId: 'follower2', newPosition: { x: 0, y: -1 } }
    },
    {
      type: 'ENTITY_POSITION_CHANGED',
      payload: { entityId: 'follower3', newPosition: { x: 1, y: 0 } }
    },
    {
      type: 'FORMATION_ESTABLISHED',
      payload: {
        formationType: 'defensive',
        leaderId: 'leader',
        members: ['follower1', 'follower2', 'follower3']
      }
    }
  ]
};

export const expectedStateChanges = {
  // State changes after throw action
  throwItem: {
    player: {
      'core:inventory': {
        items: [] // Rock removed
      }
    },
    guard_001: {
      'core:health': {
        current: 95, // Damaged by 5
        max: 100
      }
    },
    rock_001: {
      'core:position': {
        locationId: 'room_001',
        x: 3,
        y: 2
      }
    }
  },

  // State changes after unlock
  unlockContainer: {
    chest_001: {
      'core:container': {
        locked: false,
        lock_type: 'brass'
      }
    },
    brass_key_001: {
      'core:item': {
        durability: 99 // Decreased by 1
      }
    }
  },

  // State changes after enchantment
  enchantItem: {
    sword_001: {
      'core:enchantment': {
        type: 'fire',
        power: 5,
        source: 'crystal_001'
      },
      'core:weapon': {
        damage: 15, // Base 10 + 5 from enchantment
        damageType: ['slashing', 'fire']
      }
    },
    player: {
      'core:inventory': {
        items: ['sword_001'] // Crystal consumed
      }
    }
  },

  // State changes after healing
  healWounded: {
    wounded_ally_1: {
      'core:health': {
        current: 50, // Healed from 30
        max: 100
      }
    },
    wounded_ally_2: {
      'core:health': {
        current: 80, // Healed from 60
        max: 100
      }
    },
    healthy_ally: {
      'core:health': {
        current: 100, // Unchanged
        max: 100
      }
    }
  }
};

export const expectedValidationErrors = {
  // Missing target
  missingTarget: {
    error: 'Required target not found',
    code: 'TARGET_NOT_FOUND',
    details: {
      target: 'secondary',
      scope: 'location.actors[{"==": [{"var": "conscious"}, true]}]'
    }
  },

  // Context resolution failure
  contextFailure: {
    error: 'Context resolution failed: No wounded body part found',
    code: 'CONTEXT_RESOLUTION_FAILED',
    details: {
      target: 'bodyPart',
      contextFrom: 'person',
      reason: 'No matching elements in context path'
    }
  },

  // Circular dependency
  circularDependency: {
    error: 'Circular dependency detected',
    code: 'CIRCULAR_DEPENDENCY',
    dependencyCycle: ['primary', 'tertiary', 'secondary', 'primary']
  },

  // Prerequisite failure
  prerequisiteFailed: {
    error: 'Prerequisite check failed',
    code: 'PREREQUISITE_FAILED',
    details: {
      failedRule: { '>=': [{ var: 'actor.components.core:stats.dexterity' }, 15] },
      failureMessage: 'You need better aim or need to get closer to the target.'
    }
  },

  // Capacity exceeded
  capacityExceeded: {
    error: 'Container capacity exceeded',
    code: 'CAPACITY_EXCEEDED',
    details: {
      containerId: 'chest_001',
      currentItems: 48,
      capacity: 50,
      attemptedToAdd: 5
    }
  }
};

/**
 * Helper to verify operation sequence matches expected
 * @param {Array} actual - Actual operations executed
 * @param {Array} expected - Expected operation sequence
 * @returns {boolean} True if sequences match
 */
export function verifyOperationSequence(actual, expected) {
  if (actual.length !== expected.length) {
    return false;
  }

  return actual.every((op, index) => {
    const expectedOp = expected[index];
    return (
      op.type === expectedOp.type &&
      JSON.stringify(op.params) === JSON.stringify(expectedOp.params)
    );
  });
}

/**
 * Helper to verify state changes match expected
 * @param {object} beforeState - State before action
 * @param {object} afterState - State after action
 * @param {object} expectedChanges - Expected state changes
 * @returns {object} Validation result
 */
export function verifyStateChanges(beforeState, afterState, expectedChanges) {
  const errors = [];

  for (const [entityId, expectedComponents] of Object.entries(expectedChanges)) {
    for (const [componentId, expectedValues] of Object.entries(expectedComponents)) {
      const actualValue = afterState[entityId]?.[componentId];
      const expectedValue = expectedValues;

      if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
        errors.push({
          entityId,
          componentId,
          expected: expectedValue,
          actual: actualValue
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
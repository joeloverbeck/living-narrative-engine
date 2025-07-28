/**
 * @file Multi-target action definitions for E2E testing
 * @description Test action definitions covering various multi-target scenarios
 */

export const multiTargetActions = {
  // Basic throw action with two targets
  basicThrow: {
    id: 'test:throw_item',
    name: 'Throw Item',
    targets: {
      primary: {
        scope:
          'actor.inventory[{"==": [{"var": "components.core:item.throwable"}, true]}]',
        placeholder: 'item',
        description: 'Item to throw',
      },
      secondary: {
        scope:
          'location.actors[{"==": [{"var": "components.core:actor.conscious"}, true]}]',
        placeholder: 'target',
        description: 'Target to throw at',
      },
    },
    prerequisites: [
      {
        logic: {
          '>=': [{ var: 'actor.components.core:stats.dexterity' }, 10],
        },
        failure_message: 'You need at least 10 dexterity to throw items.',
      },
    ],
    template: 'throw {item} at {target}',
    generateCombinations: true,
  },

  // Context-dependent unlock action
  contextDependentUnlock: {
    id: 'test:unlock_container',
    name: 'Unlock Container',
    targets: {
      primary: {
        scope:
          'location.objects[{"==": [{"var": "components.core:container.locked"}, true]}]',
        placeholder: 'container',
        description: 'Locked container',
      },
      secondary: {
        scope:
          'actor.inventory[{"in": [{"var": "container.components.core:container.lock_type"}, {"var": "components.core:key.types"}]}]',
        placeholder: 'key',
        description: 'Matching key',
        contextFrom: 'primary',
      },
    },
    template: 'unlock {container} with {key}',
  },

  // Complex 3+ target enchantment action
  complexEnchantment: {
    id: 'test:enchant_item',
    name: 'Enchant Item',
    targets: {
      primary: {
        scope:
          'actor.inventory[{"==": [{"var": "components.core:item.enchantable"}, true]}]',
        placeholder: 'item',
        description: 'Item to enchant',
      },
      secondary: {
        scope: 'test:elements',
        placeholder: 'element',
        description: 'Enchantment element',
      },
      tertiary: {
        scope:
          'actor.inventory[{"==": [{"var": "components.core:item.catalyst"}, true]}]',
        placeholder: 'catalyst',
        description: 'Enchantment catalyst',
      },
    },
    prerequisites: [
      {
        logic: {
          '>=': [{ var: 'actor.components.core:stats.intelligence' }, 15],
        },
        failure_message: 'You need at least 15 intelligence to enchant items.',
      },
    ],
    template: 'enchant {item} with {element} using {catalyst}',
  },

  // Action with optional targets
  giveWithNote: {
    id: 'test:give_item_with_note',
    name: 'Give Item',
    targets: {
      primary: {
        scope: 'actor.inventory[]',
        placeholder: 'item',
        description: 'Item to give',
      },
      secondary: {
        scope: 'location.actors[{"!=": [{"var": "id"}, {"var": "actor.id"}]}]',
        placeholder: 'recipient',
        description: 'Person to give to',
      },
      tertiary: {
        scope:
          'actor.inventory[{"==": [{"var": "components.core:item.type"}, "note"]}]',
        placeholder: 'note',
        description: 'Optional note',
        optional: true,
      },
    },
    template: 'give {item} to {recipient}{ with {note}}',
  },

  // Action with conditional operations
  healWounded: {
    id: 'test:heal_wounded',
    name: 'Heal Wounded',
    targets: {
      primary: {
        scope:
          'location.actors[{"<": [{"var": "components.core:health.current"}, {"var": "components.core:health.max"}]}]',
        placeholder: 'wounded',
        description: 'Wounded person',
      },
    },
    prerequisites: [
      {
        logic: {
          '>=': [{ var: 'actor.components.core:stats.wisdom' }, 12],
        },
        failure_message: 'You need at least 12 wisdom to heal others.',
      },
    ],
    template: 'heal {wounded}',
  },

  // Transfer multiple items action
  transferItems: {
    id: 'test:transfer_items',
    name: 'Transfer Items',
    targets: {
      primary: {
        scope: 'actor.inventory[]',
        placeholder: 'items',
        description: 'Items to transfer',
      },
      secondary: {
        scope:
          'location.objects[{"!=": [{"var": "components.core:container"}, null]}]',
        placeholder: 'container',
        description: 'Container to transfer to',
      },
    },
    template: 'transfer {items} to {container}',
  },

  // Nested context dependency - bandage specific wound
  bandageWound: {
    id: 'test:bandage_wound',
    name: 'Bandage Wound',
    targets: {
      primary: {
        scope: 'location.actors[]',
        placeholder: 'person',
        description: 'Person to help',
      },
      secondary: {
        scope:
          'person.components.core:body.parts[{"==": [{"var": "wounded"}, true]}]',
        placeholder: 'bodyPart',
        description: 'Wounded body part',
        contextFrom: 'primary',
      },
    },
    template: "bandage {person}'s {bodyPart}",
  },

  // Dynamic selection - steal from richest
  stealFromRichest: {
    id: 'test:steal_from_richest',
    name: 'Steal',
    targets: {
      primary: {
        scope: 'location.actors[{"!=": [{"var": "id"}, {"var": "actor.id"}]}]',
        placeholder: 'target',
        description: 'Target to steal from',
      },
    },
    prerequisites: [
      {
        logic: {
          max: [
            { var: 'targets.primary' },
            { var: 'components.core:wealth.gold' },
          ],
        },
      },
    ],
    template: 'steal from {target}',
  },

  // Area effect action - explosion
  throwExplosive: {
    id: 'test:throw_explosive',
    name: 'Throw Explosive',
    targets: {
      primary: {
        scope:
          'actor.inventory[{"==": [{"var": "components.core:item.explosive"}, true]}]',
        placeholder: 'explosive',
        description: 'Explosive item',
      },
      secondary: {
        scope: 'location.actors[{"!=": [{"var": "id"}, {"var": "actor.id"}]}]',
        placeholder: 'target',
        description: 'Primary target',
      },
    },
    template: 'throw {explosive} at {target}',
  },

  // Trade action with validation
  tradeItems: {
    id: 'test:trade_items',
    name: 'Trade Items',
    targets: {
      primary: {
        scope: 'actor.inventory[]',
        placeholder: 'offer',
        description: 'Items to offer',
      },
      secondary: {
        scope:
          'location.actors[{"==": [{"var": "components.core:actor.trader"}, true]}]',
        placeholder: 'trader',
        description: 'Trader',
      },
      tertiary: {
        scope: 'trader.components.core:inventory.items[]',
        placeholder: 'desired',
        description: 'Desired items',
        contextFrom: 'secondary',
      },
    },
    prerequisites: [
      {
        logic: {
          '>=': [
            { var: 'actor.components.core:wealth.gold' },
            { var: 'trader.components.core:trader.asking_price' },
          ],
        },
        failure_message: "You don't have enough gold for this trade.",
      },
    ],
    template: 'trade {offer} to {trader} for {desired}',
  },

  // Formation change affecting multiple entities
  orderFormation: {
    id: 'test:order_formation',
    name: 'Order Formation',
    targets: {
      primary: {
        scope: 'test:formations',
        placeholder: 'formation',
        description: 'Formation type',
      },
    },
    prerequisites: [
      {
        logic: {
          '>': [
            { var: 'actor.components.core:leadership.followers.length' },
            0,
          ],
        },
        failure_message: 'You need followers to order a formation.',
      },
    ],
    template: 'order {formation} formation',
  },

  // Dual equip action for testing multiple component modifications
  equipDual: {
    id: 'test:equip_dual',
    name: 'Equip Dual',
    targets: {
      primary: {
        scope:
          'actor.inventory[{"==": [{"var": "components.core:item.equippable"}, true]}]',
        placeholder: 'weapon',
        description: 'Weapon to equip',
      },
      secondary: {
        scope:
          'actor.inventory[{"==": [{"var": "components.core:item.equippable"}, true]}]',
        placeholder: 'shield',
        description: 'Shield to equip',
      },
    },
    prerequisites: [
      {
        logic: {
          '>=': [{ var: 'actor.components.core:stats.strength' }, 10],
        },
        failure_message: 'You need at least 10 strength to dual wield.',
      },
    ],
    template: 'equip {weapon} and {shield}',
  },

  // Circular dependency test action (should fail)
  circularDependency: {
    id: 'test:circular_action',
    name: 'Circular Test',
    targets: {
      primary: {
        scope:
          'test:entities[{"==": [{"var": "id"}, {"var": "targets.tertiary.related"}]}]',
        placeholder: 'first',
        description: 'First target',
        contextFrom: 'tertiary',
      },
      secondary: {
        scope:
          'test:entities[{"==": [{"var": "id"}, {"var": "targets.primary.connected"}]}]',
        placeholder: 'second',
        description: 'Second target',
        contextFrom: 'primary',
      },
      tertiary: {
        scope:
          'test:entities[{"==": [{"var": "id"}, {"var": "targets.secondary.linked"}]}]',
        placeholder: 'third',
        description: 'Third target',
        contextFrom: 'secondary',
      },
    },
    template: 'test {first} {second} {third}',
  },
};

// Export helper to get action by ID
/**
 *
 * @param actionId
 */
export function getTestAction(actionId) {
  return Object.values(multiTargetActions).find(
    (action) => action.id === actionId
  );
}

// Export action IDs for easy reference
export const TEST_ACTION_IDS = {
  BASIC_THROW: 'test:throw_item',
  UNLOCK_CONTAINER: 'test:unlock_container',
  ENCHANT_ITEM: 'test:enchant_item',
  GIVE_WITH_NOTE: 'test:give_item_with_note',
  HEAL_WOUNDED: 'test:heal_wounded',
  TRANSFER_ITEMS: 'test:transfer_items',
  BANDAGE_WOUND: 'test:bandage_wound',
  STEAL_FROM_RICHEST: 'test:steal_from_richest',
  THROW_EXPLOSIVE: 'test:throw_explosive',
  TRADE_ITEMS: 'test:trade_items',
  ORDER_FORMATION: 'test:order_formation',
  EQUIP_DUAL: 'test:equip_dual',
  CIRCULAR_DEPENDENCY: 'test:circular_action',
};

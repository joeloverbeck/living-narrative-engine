/**
 * @file Test entity definitions for multi-target E2E tests
 * @description Provides entity templates and builders for various test scenarios
 */

export const testEntityTemplates = {
  // Basic actor template
  actor: {
    definitionId: 'test:actor',
    components: {
      'core:actor': { name: 'Test Actor', conscious: true },
      'core:stats': {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        wisdom: 10,
      },
      'core:position': { locationId: null },
      'core:inventory': { items: [], capacity: 20 },
      'core:health': { current: 100, max: 100 },
    },
  },

  // Throwable item template
  throwableItem: {
    definitionId: 'test:throwable_item',
    components: {
      'core:item': {
        name: 'Rock',
        throwable: true,
        weight: 1,
      },
    },
  },

  // Container template
  container: {
    definitionId: 'test:container',
    components: {
      'core:object': { name: 'Chest' },
      'core:position': { locationId: null },
      'core:container': {
        locked: false,
        lock_type: null,
        capacity: 50,
        items: [],
      },
    },
  },

  // Key template
  key: {
    definitionId: 'test:key',
    components: {
      'core:item': {
        name: 'Key',
        weight: 0.1,
      },
      'core:key': { types: [] },
    },
  },

  // Enchantable item template
  enchantableItem: {
    definitionId: 'test:enchantable_item',
    components: {
      'core:item': {
        name: 'Sword',
        enchantable: true,
        weight: 3,
      },
      'core:weapon': {
        damage: 10,
        type: 'slashing',
      },
    },
  },

  // Catalyst item template
  catalyst: {
    definitionId: 'test:catalyst',
    components: {
      'core:item': {
        name: 'Magic Crystal',
        catalyst: true,
        weight: 0.5,
      },
    },
  },

  // Location template
  location: {
    definitionId: 'test:location',
    components: {
      'core:location': { name: 'Test Room' },
      'core:actors': [],
      'core:objects': [],
      'core:contents': { items: [] },
    },
  },

  // Wounded actor template
  woundedActor: {
    definitionId: 'test:wounded_actor',
    components: {
      'core:actor': { name: 'Wounded Person', conscious: true },
      'core:health': { current: 50, max: 100 },
      'core:body': {
        parts: {
          head: { wounded: false },
          left_arm: { wounded: false },
          right_arm: { wounded: false },
          torso: { wounded: false },
          left_leg: { wounded: false },
          right_leg: { wounded: false },
        },
      },
    },
  },

  // Merchant template
  merchant: {
    definitionId: 'test:merchant',
    components: {
      'core:actor': { name: 'Merchant', conscious: true, trader: true },
      'core:wealth': { gold: 1000 },
      'core:inventory': { items: [], capacity: 100 },
      'core:trader': {
        prices: {},
        asking_price: 0,
        buyback_rate: 0.5,
      },
    },
  },

  // Explosive item template
  explosiveItem: {
    definitionId: 'test:explosive_item',
    components: {
      'core:item': {
        name: 'Bomb',
        explosive: true,
        throwable: true,
        weight: 2,
      },
      'core:explosive': {
        damage: 50,
        radius: 5,
        falloff: 0.7, // Damage reduction per meter
      },
    },
  },

  // Note item template
  noteItem: {
    definitionId: 'test:note_item',
    components: {
      'core:item': {
        name: 'Note',
        type: 'note',
        weight: 0.05,
      },
      'core:readable': {
        text: 'Test message',
      },
    },
  },

  // Shield/armor item template
  armorItem: {
    definitionId: 'test:armor_item',
    components: {
      'core:item': {
        name: 'Shield',
        equippable: true,
        slot: 'offHand',
        weight: 5,
      },
      'core:armor': {
        defense: 5,
      },
    },
  },
};

/**
 * Creates an entity configuration with overrides
 *
 * @param {string} templateName - Name of the template to use
 * @param {object} overrides - Component overrides
 * @returns {object} Entity configuration
 */
export function createEntityConfig(templateName, overrides = {}) {
  const template = testEntityTemplates[templateName];
  if (!template) {
    throw new Error(`Unknown entity template: ${templateName}`);
  }

  return {
    definitionId: template.definitionId,
    components: deepMerge(template.components, overrides),
  };
}

/**
 * Creates multiple test entities for a scenario
 *
 * @param {object} scenario - Scenario configuration
 * @returns {object} Map of entity configs by role
 */
export function createScenarioEntities(scenario) {
  const entities = {};

  switch (scenario.type) {
    case 'throw':
      entities.actor = createEntityConfig('actor', {
        'core:stats': { dexterity: 15 },
        'core:inventory': { items: ['rock_001'] },
      });
      entities.target = createEntityConfig('actor', {
        'core:actor': { name: 'Target Guard' },
      });
      entities.item = createEntityConfig('throwableItem');
      entities.location = createEntityConfig('location', {
        'core:actors': ['player', 'guard_001'],
      });
      break;

    case 'unlock':
      entities.actor = createEntityConfig('actor', {
        'core:inventory': { items: ['brass_key_001', 'iron_key_001'] },
      });
      entities.container = createEntityConfig('container', {
        'core:container': {
          locked: true,
          lock_type: 'brass',
          items: ['treasure_001'],
        },
      });
      entities.brassKey = createEntityConfig('key', {
        'core:item': { name: 'Brass Key' },
        'core:key': { types: ['brass'] },
      });
      entities.ironKey = createEntityConfig('key', {
        'core:item': { name: 'Iron Key' },
        'core:key': { types: ['iron'] },
      });
      entities.location = createEntityConfig('location', {
        'core:actors': ['player'],
        'core:objects': ['chest_001'],
      });
      break;

    case 'enchant':
      entities.actor = createEntityConfig('actor', {
        'core:stats': { intelligence: 20 },
        'core:inventory': { items: ['sword_001', 'crystal_001'] },
      });
      entities.weapon = createEntityConfig('enchantableItem');
      entities.catalyst = createEntityConfig('catalyst');
      entities.location = createEntityConfig('location', {
        'core:actors': ['player'],
      });
      break;

    case 'heal':
      entities.healer = createEntityConfig('actor', {
        'core:stats': { wisdom: 15 },
        'core:actor': { name: 'Healer' },
      });
      entities.wounded1 = createEntityConfig('woundedActor', {
        'core:actor': { name: 'Wounded Ally 1' },
        'core:health': { current: 30, max: 100 },
      });
      entities.wounded2 = createEntityConfig('woundedActor', {
        'core:actor': { name: 'Wounded Ally 2' },
        'core:health': { current: 60, max: 100 },
      });
      entities.healthy = createEntityConfig('actor', {
        'core:actor': { name: 'Healthy Ally' },
        'core:health': { current: 100, max: 100 },
      });
      entities.location = createEntityConfig('location', {
        'core:actors': ['healer', 'wounded1', 'wounded2', 'healthy'],
      });
      break;

    case 'explosion':
      entities.actor = createEntityConfig('actor', {
        'core:inventory': { items: ['bomb_001'] },
        'core:position': { x: 0, y: 0, locationId: 'battlefield' },
      });
      entities.explosive = createEntityConfig('explosiveItem');
      // Create targets at various distances
      entities.targets = [
        createEntityConfig('actor', {
          'core:actor': { name: 'Enemy 1' },
          'core:position': { x: 2, y: 0, locationId: 'battlefield' },
        }),
        createEntityConfig('actor', {
          'core:actor': { name: 'Enemy 2' },
          'core:position': { x: 3, y: 3, locationId: 'battlefield' },
        }),
        createEntityConfig('actor', {
          'core:actor': { name: 'Enemy 3' },
          'core:position': { x: 5, y: 0, locationId: 'battlefield' },
        }),
      ];
      entities.location = createEntityConfig('location', {
        'core:location': { name: 'Battlefield' },
        'core:actors': ['player', 'enemy1', 'enemy2', 'enemy3'],
      });
      break;

    case 'trade':
      entities.player = createEntityConfig('actor', {
        'core:wealth': { gold: 100 },
        'core:inventory': { items: ['item_001', 'item_002'] },
      });
      entities.merchant = createEntityConfig('merchant', {
        'core:trader': { asking_price: 50 },
        'core:inventory': { items: ['rare_item_001'] },
      });
      entities.location = createEntityConfig('location', {
        'core:actors': ['player', 'merchant'],
      });
      break;

    case 'formation':
      entities.leader = createEntityConfig('actor', {
        'core:actor': { name: 'Leader' },
        'core:leadership': {
          followers: ['follower1', 'follower2', 'follower3'],
        },
      });
      entities.followers = [
        createEntityConfig('actor', {
          'core:actor': { name: 'Follower 1' },
          'core:following': { leader: 'leader' },
        }),
        createEntityConfig('actor', {
          'core:actor': { name: 'Follower 2' },
          'core:following': { leader: 'leader' },
        }),
        createEntityConfig('actor', {
          'core:actor': { name: 'Follower 3' },
          'core:following': { leader: 'leader' },
        }),
      ];
      entities.location = createEntityConfig('location', {
        'core:actors': ['leader', 'follower1', 'follower2', 'follower3'],
      });
      break;

    case 'equip':
      entities.actor = createEntityConfig('actor', {
        'core:stats': { strength: 15, attack: 10, defense: 10 },
        'core:inventory': { items: ['sword_001', 'shield_001'] },
        'core:equipment': { mainHand: null, offHand: null },
      });
      entities.weapon = createEntityConfig('enchantableItem', {
        'core:item': {
          name: 'Iron Sword',
          equippable: true,
          slot: 'mainHand',
          weight: 5,
        },
        'core:weapon': { damage: 10 },
      });
      entities.shield = createEntityConfig('armorItem', {
        'core:item': {
          name: 'Wooden Shield',
          equippable: true,
          slot: 'offHand',
          weight: 8,
        },
        'core:armor': { defense: 5 },
      });
      entities.location = createEntityConfig('location', {
        'core:actors': ['player'],
      });
      break;

    case 'transfer':
      entities.actor = createEntityConfig('actor', {
        'core:inventory': { items: ['item_001', 'item_002', 'item_003'] },
      });
      entities.container = createEntityConfig('container', {
        'core:container': {
          locked: false,
          capacity: 50,
          items: [],
        },
      });
      entities.location = createEntityConfig('location', {
        'core:actors': ['player'],
        'core:objects': ['chest_001'],
      });
      break;

    case 'bandage':
      entities.actor = createEntityConfig('actor', {
        'core:stats': { wisdom: 15 },
        'core:inventory': { items: ['bandage_001'] },
      });
      entities.wounded1 = createEntityConfig('woundedActor', {
        'core:actor': { name: 'Alice' },
        'core:body': {
          parts: {
            head: { wounded: false },
            left_arm: { wounded: true, severity: 'moderate' },
            right_arm: { wounded: false },
            torso: { wounded: true },
            left_leg: { wounded: true, severity: 'minor' },
            right_leg: { wounded: false },
          },
        },
      });
      entities.target = createEntityConfig('woundedActor', {
        'core:actor': { name: 'Wounded Person' },
        'core:body': {
          parts: {
            head: { wounded: false },
            left_arm: { wounded: true },
            right_arm: { wounded: false },
            torso: { wounded: true },
            left_leg: { wounded: false },
            right_leg: { wounded: false },
          },
        },
      });
      entities.location = createEntityConfig('location', {
        'core:actors': ['player', 'alice_001', 'wounded_person'],
      });
      break;

    case 'steal':
      entities.actor = createEntityConfig('actor', {
        'core:stats': { stealth: 15 },
        'core:inventory': { items: [] },
      });
      entities.merchant = createEntityConfig('actor', {
        'core:actor': { name: 'Wealthy Merchant' },
        'core:wealth': { gold: 500 },
        'core:inventory': { items: ['valuable_001', 'valuable_002'] },
      });
      entities.location = createEntityConfig('location', {
        'core:actors': ['player', 'merchant_002'],
      });
      break;

    case 'circular':
      entities.actor = createEntityConfig('actor');
      entities.entityA = createEntityConfig('actor', {
        'core:test': { related: 'entity_c' },
      });
      entities.entityB = createEntityConfig('actor', {
        'core:test': { connected: 'entity_a' },
      });
      entities.entityC = createEntityConfig('actor', {
        'core:test': { linked: 'entity_b' },
      });
      entities.location = createEntityConfig('location', {
        'core:actors': ['player'],
        'core:objects': ['entity_a', 'entity_b', 'entity_c'],
      });
      break;

    case 'validation':
      entities.actor = createEntityConfig('actor', {
        'core:stats': { wisdom: 15 },
        'core:inventory': { items: ['bandage_001'] },
      });
      entities.wounded1 = createEntityConfig('actor', {
        'core:actor': { name: 'Alice' },
        'core:body': {
          parts: {
            left_arm: { wounded: true, severity: 'moderate' },
            right_arm: { wounded: false },
            left_leg: { wounded: true, severity: 'minor' },
          },
        },
      });
      entities.wounded2 = createEntityConfig('actor', {
        'core:actor': { name: 'Bob' },
        'core:body': {
          parts: {
            head: { wounded: false },
            torso: { wounded: false },
          },
        },
      });
      entities.healthy = createEntityConfig('actor', {
        'core:actor': { name: 'Charlie' },
        'core:body': {
          parts: {
            head: { wounded: false },
            torso: { wounded: false },
            left_arm: { wounded: false },
            right_arm: { wounded: false },
          },
        },
      });
      entities.location = createEntityConfig('location', {
        'core:actors': [
          'player',
          'wounded_ally_1',
          'wounded_ally_2',
          'healthy_ally',
        ],
      });
      break;

    default:
      throw new Error(`Unknown scenario type: ${scenario.type}`);
  }

  return entities;
}

/**
 * Deep merge utility for component overrides
 *
 * @param target
 * @param source
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// Export entity instance IDs for reference
export const TEST_ENTITY_IDS = {
  PLAYER: 'player',
  GUARD: 'guard_001',
  ROCK: 'rock_001',
  CHEST: 'chest_001',
  BRASS_KEY: 'brass_key_001',
  IRON_KEY: 'iron_key_001',
  SWORD: 'sword_001',
  CRYSTAL: 'crystal_001',
  BOMB: 'bomb_001',
  MERCHANT: 'merchant_001',
  ROOM: 'room_001',
  BATTLEFIELD: 'battlefield_001',
};

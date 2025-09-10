/**
 * @file Shared Test Fixtures for Multi-Mod E2E Tests
 * @description Pre-defined mod configurations to eliminate duplication and improve performance
 */

/**
 * Shared fixture definitions for common multi-mod test scenarios
 * These fixtures are reused across multiple tests to reduce setup overhead
 */
export const SharedFixtures = {
  /**
   * Basic cross-mod dependency chain: core -> base -> extension
   */
  crossModDependencyChain: {
    coreMod: {
      scopes: [
        {
          name: 'actors',
          content: 'base:actors := entities(core:actor)',
        },
        {
          name: 'enhanced_actors',
          content:
            'base:enhanced_actors := entities(core:actor)[{"==": [{"var": "entity.components.base:special.enhanced"}, true]}]',
        },
      ],
      components: [
        {
          name: 'special',
          content: {
            id: 'base:special',
            description: 'Special enhancement component',
            dataSchema: {
              type: 'object',
              properties: {
                enhanced: { type: 'boolean' },
                power: { type: 'number' },
              },
              required: ['enhanced'],
            },
          },
        },
      ],
    },
    extensionMod: {
      scopes: [
        {
          name: 'super_actors',
          content:
            'extension:super_actors := entities(core:actor)[{"and": [{"condition_ref": "base:is-enhanced"}, {">": [{"var": "entity.components.base:special.power"}, 50]}]}]',
        },
        {
          name: 'base_and_super',
          content:
            'extension:base_and_super := base:enhanced_actors + extension:super_actors',
        },
      ],
      conditions: [
        {
          name: 'is-enhanced',
          content: {
            id: 'base:is-enhanced',
            description: 'Checks if entity has enhancement',
            logic: {
              '==': [{ var: 'entity.components.base:special.enhanced' }, true],
            },
          },
        },
      ],
    },
  },

  /**
   * Complex dependency chain: core -> base -> extension -> advanced (4 levels)
   */
  complexDependencyChain: {
    coreMod: {
      scopes: [
        {
          name: 'all_entities',
          content: 'core_mod:all_entities := entities(core:actor)',
        },
      ],
      components: [
        {
          name: 'tier',
          content: {
            id: 'core_mod:tier',
            description: 'Entity tier component',
            dataSchema: {
              type: 'object',
              properties: {
                level: { type: 'number' },
                category: { type: 'string' },
              },
              required: ['level'],
            },
          },
        },
      ],
    },
    baseMod: {
      scopes: [
        {
          name: 'tiered_entities',
          content:
            'base_mod:tiered_entities := core_mod:all_entities[{">": [{"var": "entity.components.core_mod:tier.level"}, 1]}]',
        },
      ],
    },
    extensionMod: {
      scopes: [
        {
          name: 'high_tier_entities',
          content:
            'ext_mod:high_tier_entities := base_mod:tiered_entities[{">": [{"var": "entity.components.core_mod:tier.level"}, 5]}]',
        },
      ],
    },
    advancedMod: {
      scopes: [
        {
          name: 'elite_entities',
          content:
            'adv_mod:elite_entities := ext_mod:high_tier_entities[{">=": [{"var": "entity.components.core_mod:tier.level"}, 10]}]',
        },
        {
          name: 'all_tiers_union',
          content:
            'adv_mod:all_tiers_union := core_mod:all_entities + base_mod:tiered_entities + ext_mod:high_tier_entities',
        },
      ],
    },
  },

  /**
   * Multi-namespace coexistence scenario
   */
  multiNamespaceCoexistence: {
    coreUtilsMod: {
      scopes: [
        {
          name: 'basic_actors',
          content: 'core_utils:basic_actors := entities(core:actor)',
        },
        {
          name: 'player_entities',
          content:
            'core_utils:player_entities := entities(core:actor)[{"var": "entity.components.core:actor.isPlayer", "==": true}]',
        },
      ],
    },
    gameplayMod: {
      scopes: [
        {
          name: 'combat_actors',
          content:
            'gameplay:combat_actors := core_utils:basic_actors[{"has": [{"var": "entity.components"}, "gameplay:combat"]}]',
        },
        {
          name: 'non_combat_actors',
          content:
            'gameplay:non_combat_actors := core_utils:basic_actors[{"!": {"has": [{"var": "entity.components"}, "gameplay:combat"]}}]',
        },
      ],
      components: [
        {
          name: 'combat',
          content: {
            id: 'gameplay:combat',
            description: 'Combat capability component',
            dataSchema: {
              type: 'object',
              properties: {
                level: { type: 'number' },
                style: { type: 'string' },
              },
            },
          },
        },
      ],
    },
    socialMod: {
      scopes: [
        {
          name: 'social_actors',
          content:
            'social:interactive_actors := core_utils:basic_actors[{"has": [{"var": "entity.components"}, "social:personality"]}]',
        },
        {
          name: 'mixed_actors',
          content:
            'social:mixed_actors := gameplay:combat_actors + social:interactive_actors',
        },
      ],
      components: [
        {
          name: 'personality',
          content: {
            id: 'social:personality',
            description: 'Social personality component',
            dataSchema: {
              type: 'object',
              properties: {
                traits: { type: 'array' },
                mood: { type: 'string' },
              },
            },
          },
        },
      ],
    },
  },

  /**
   * Override and extension patterns
   */
  overridePatterns: {
    baseMod: {
      scopes: [
        {
          name: 'default_behavior',
          content:
            'base:target_selection := entities(core:actor)[{"var": "entity.components.core:actor.isPlayer", "==": false}]',
        },
        {
          name: 'basic_filter',
          content: 'base:basic_filter := base:target_selection',
        },
      ],
    },
    overrideMod: {
      scopes: [
        {
          name: 'enhanced_behavior',
          content:
            'base:target_selection := entities(core:actor)[{"and": [{"var": "entity.components.core:actor.isPlayer", "==": false}, {">": [{"var": "entity.components.override:priority.value"}, 0]}]}]',
        },
        {
          name: 'override_filter',
          content:
            'override:enhanced_filter := base:target_selection[{">": [{"var": "entity.components.override:priority.value"}, 5]}]',
        },
      ],
      components: [
        {
          name: 'priority',
          content: {
            id: 'override:priority',
            description: 'Priority system component',
            dataSchema: {
              type: 'object',
              properties: {
                value: { type: 'number' },
              },
              required: ['value'],
            },
          },
        },
      ],
    },
  },

  /**
   * Extension patterns - multiple extensions building on core
   */
  extensionPatterns: {
    coreMod: {
      scopes: [
        {
          name: 'core_entities',
          content: 'core_ext:all_entities := entities(core:actor)',
        },
        {
          name: 'extensible_base',
          content:
            'core_ext:extensible := core_ext:all_entities[{"has": [{"var": "entity.components"}, "core:actor"]}]',
        },
      ],
    },
    extensionA: {
      scopes: [
        {
          name: 'extension_a_entities',
          content:
            'ext_a:enhanced := core_ext:extensible[{"has": [{"var": "entity.components"}, "ext_a:feature"]}]',
        },
        {
          name: 'extension_a_contribution',
          content:
            'core_ext:extensible_enhanced := core_ext:extensible + ext_a:enhanced',
        },
      ],
      components: [
        {
          name: 'feature',
          content: {
            id: 'ext_a:feature',
            description: 'Extension A feature',
            dataSchema: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
              },
            },
          },
        },
      ],
    },
    extensionB: {
      scopes: [
        {
          name: 'extension_b_entities',
          content:
            'ext_b:special := core_ext:extensible[{"has": [{"var": "entity.components"}, "ext_b:special"]}]',
        },
        {
          name: 'extension_b_contribution',
          content:
            'core_ext:extensible_special := core_ext:extensible + ext_b:special',
        },
      ],
      components: [
        {
          name: 'special',
          content: {
            id: 'ext_b:special',
            description: 'Extension B special feature',
            dataSchema: {
              type: 'object',
              properties: {
                type: { type: 'string' },
              },
            },
          },
        },
      ],
    },
    combinedExtension: {
      scopes: [
        {
          name: 'combined_extensions',
          content: 'combined:all_extensions := ext_a:enhanced + ext_b:special',
        },
        {
          name: 'intersection',
          content:
            'combined:intersection := ext_a:enhanced[{"has": [{"var": "entity.components"}, "ext_b:special"]}]',
        },
      ],
    },
  },
};

/**
 * Pre-configured test entity sets for different scenarios
 */
export const EntityFixtures = {
  /**
   * Basic test entities for cross-mod scenarios
   */
  crossModEntities: [
    {
      id: 'enhanced-actor-1',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'base:special': { enhanced: true, power: 30 },
      },
    },
    {
      id: 'super-actor-1',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'base:special': { enhanced: true, power: 75 },
      },
    },
    {
      id: 'normal-actor-1',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
      },
    },
  ],

  /**
   * Tiered entities for complex dependency chains
   */
  tieredEntities: [
    {
      id: 'tier-0-entity',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core_mod:tier': { level: 0, category: 'test' },
      },
    },
    {
      id: 'tier-3-entity',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core_mod:tier': { level: 3, category: 'test' },
      },
    },
    {
      id: 'tier-7-entity',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core_mod:tier': { level: 7, category: 'test' },
      },
    },
    {
      id: 'tier-12-entity',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'core_mod:tier': { level: 12, category: 'test' },
      },
    },
  ],

  /**
   * Multi-namespace entities
   */
  multiNamespaceEntities: [
    {
      id: 'combat-only-actor',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'gameplay:combat': { level: 5, style: 'warrior' },
      },
    },
    {
      id: 'social-only-actor',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'social:personality': { traits: ['friendly'], mood: 'happy' },
      },
    },
    {
      id: 'mixed-actor',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'gameplay:combat': { level: 3, style: 'rogue' },
        'social:personality': { traits: ['cunning'], mood: 'neutral' },
      },
    },
    {
      id: 'basic-actor',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
      },
    },
  ],

  /**
   * Priority-based entities for override patterns
   */
  priorityEntities: [
    {
      id: 'low-priority-actor',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'override:priority': { value: 1 },
      },
    },
    {
      id: 'high-priority-actor',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'override:priority': { value: 8 },
      },
    },
    {
      id: 'no-priority-actor',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
      },
    },
  ],

  /**
   * Extension entities for extension patterns
   */
  extensionEntities: [
    {
      id: 'ext-a-only',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'ext_a:feature': { enabled: true },
      },
    },
    {
      id: 'ext-b-only',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'ext_b:special': { type: 'unique' },
      },
    },
    {
      id: 'both-extensions',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
        'ext_a:feature': { enabled: true },
        'ext_b:special': { type: 'unique' },
      },
    },
    {
      id: 'no-extensions',
      components: {
        'core:actor': { isPlayer: false },
        'core:position': { locationId: 'test-location-1' },
      },
    },
  ],
};

export default { SharedFixtures, EntityFixtures };

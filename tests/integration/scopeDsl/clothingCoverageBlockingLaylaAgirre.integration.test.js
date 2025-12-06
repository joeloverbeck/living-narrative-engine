/**
 * @file Integration test for Layla Agirre coverage blocking scenario
 * @description Tests the specific bug where boxer brief is incorrectly shown as removable
 * when covered by trousers in the topmost_torso_lower_clothing_no_accessories scope
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import fs from 'fs';
import path from 'path';

// Import actual scope file content
const targetTopMostTorsoLowerNoAccessoriesScopeContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../data/mods/clothing/scopes/target_topmost_torso_lower_clothing_no_accessories.scope'
  ),
  'utf8'
);

describe('Layla Agirre Coverage Blocking Integration Test', () => {
  let entityManager;
  let logger;
  let scopeRegistry;
  let scopeEngine;
  let jsonLogicEval;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([]);
    jsonLogicEval = new JsonLogicEvaluationService({ entityManager, logger });

    // Parse and register the scope
    const parsedScopes = parseScopeDefinitions(
      targetTopMostTorsoLowerNoAccessoriesScopeContent,
      'test-scope-file.scope'
    );

    scopeRegistry = new ScopeRegistry();
    // parseScopeDefinitions returns a Map, so convert to object for initialize()
    const scopeDefinitions = {};
    Array.from(parsedScopes.entries()).forEach(([name, scopeData]) => {
      scopeDefinitions[name] = scopeData;
    });
    scopeRegistry.initialize(scopeDefinitions);

    scopeEngine = new ScopeEngine({ scopeRegistry });
  });

  describe('Layla Agirre scenario', () => {
    it('should only return trousers as removable, blocking boxer brief access', () => {
      // Create Layla Agirre entity
      const laylaAgirre = entityManager.createEntity('layla_agirre');
      entityManager.addComponent('layla_agirre', 'core:actor', {
        name: 'Layla Agirre',
      });
      entityManager.addComponent('layla_agirre', 'clothing:equipment', {
        equipped: {
          torso_lower: {
            base: 'asudem:trousers',
            underwear: 'asudem:boxer_brief',
          },
        },
      });

      // Create trousers entity with coverage mapping
      const trousers = entityManager.createEntity('asudem:trousers');
      entityManager.addComponent('asudem:trousers', 'clothing:item', {
        name: 'trousers',
        slot: 'torso_lower',
        layer: 'base',
      });
      entityManager.addComponent(
        'asudem:trousers',
        'clothing:coverage_mapping',
        {
          covers: ['torso_lower'],
          coveragePriority: 'base',
        }
      );

      // Create boxer brief entity with coverage mapping
      const boxerBrief = entityManager.createEntity('asudem:boxer_brief');
      entityManager.addComponent('asudem:boxer_brief', 'clothing:item', {
        name: 'boxer brief',
        slot: 'torso_lower',
        layer: 'underwear',
      });
      entityManager.addComponent(
        'asudem:boxer_brief',
        'clothing:coverage_mapping',
        {
          covers: ['torso_lower'],
          coveragePriority: 'underwear',
        }
      );

      // Create player entity
      const player = entityManager.createEntity('player');
      entityManager.addComponent('player', 'core:actor', {
        name: 'Player',
      });

      // Resolve the scope for Layla as target
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actorEntity: player, // Player is the actor
        target: laylaAgirre, // Layla is the target
        location: null,
      };

      // Get the AST from scope registry
      const scopeAst = scopeRegistry.getScopeAst(
        'clothing:target_topmost_torso_lower_clothing_no_accessories'
      );
      console.log('Target entity:', runtimeCtx.target);
      console.log(
        'Equipment:',
        entityManager.getComponent('layla_agirre', 'clothing:equipment')
      );
      console.log('Scope AST:', JSON.stringify(scopeAst, null, 2));

      const result = scopeEngine.resolve(
        scopeAst,
        player, // actorEntity
        runtimeCtx
      );

      console.log('Result:', Array.from(result));

      // Should only contain trousers, not boxer brief
      expect(result).toContain('asudem:trousers');
      expect(result).not.toContain('asudem:boxer_brief');
      expect(result.size).toBe(1);
    });

    it('should return both items when trousers are removed', () => {
      // Create Layla Agirre entity without trousers
      const laylaAgirre = entityManager.createEntity('layla_agirre');
      entityManager.addComponent('layla_agirre', 'core:actor', {
        name: 'Layla Agirre',
      });
      entityManager.addComponent('layla_agirre', 'clothing:equipment', {
        equipped: {
          torso_lower: {
            underwear: 'asudem:boxer_brief',
          },
        },
      });

      // Create boxer brief entity
      const boxerBrief = entityManager.createEntity('asudem:boxer_brief');
      entityManager.addComponent('asudem:boxer_brief', 'clothing:item', {
        name: 'boxer brief',
        slot: 'torso_lower',
        layer: 'underwear',
      });
      entityManager.addComponent(
        'asudem:boxer_brief',
        'clothing:coverage_mapping',
        {
          covers: ['torso_lower'],
          coveragePriority: 'underwear',
        }
      );

      // Create player entity
      const player = entityManager.createEntity('player');
      entityManager.addComponent('player', 'core:actor', {
        name: 'Player',
      });

      // Resolve the scope
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actorEntity: player,
        target: laylaAgirre,
        location: null,
      };

      // Get the AST from scope registry
      const scopeAst = scopeRegistry.getScopeAst(
        'clothing:target_topmost_torso_lower_clothing_no_accessories'
      );

      const result = scopeEngine.resolve(
        scopeAst,
        player, // actorEntity
        runtimeCtx
      );

      // Should now contain boxer brief since it's not blocked
      expect(result).toContain('asudem:boxer_brief');
      expect(result.size).toBe(1);
    });

    it('should handle complex multi-layer scenarios correctly', () => {
      // Create entity with multiple layers of clothing
      const target = entityManager.createEntity('target');
      entityManager.addComponent('target', 'core:actor', {
        name: 'Target',
      });
      entityManager.addComponent('target', 'clothing:equipment', {
        equipped: {
          torso_lower: {
            outer: 'jacket',
            base: 'shirt',
            underwear: 'undershirt',
          },
          legs: {
            outer: 'coat_tails', // Covers legs and torso_lower
            base: 'pants',
            underwear: 'long_underwear',
          },
          groin: {
            underwear: 'underwear',
          },
        },
      });

      // Create clothing items with various coverage patterns
      const jacket = entityManager.createEntity('jacket');
      entityManager.addComponent('jacket', 'clothing:item', {
        name: 'jacket',
        slot: 'torso_lower',
        layer: 'outer',
      });
      entityManager.addComponent('jacket', 'clothing:coverage_mapping', {
        covers: ['torso_lower', 'arms'],
        coveragePriority: 'outer',
      });

      const shirt = entityManager.createEntity('shirt');
      entityManager.addComponent('shirt', 'clothing:item', {
        name: 'shirt',
        slot: 'torso_lower',
        layer: 'base',
      });
      entityManager.addComponent('shirt', 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      });

      const undershirt = entityManager.createEntity('undershirt');
      entityManager.addComponent('undershirt', 'clothing:item', {
        name: 'undershirt',
        slot: 'torso_lower',
        layer: 'underwear',
      });
      entityManager.addComponent('undershirt', 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'underwear',
      });

      const coatTails = entityManager.createEntity('coat_tails');
      entityManager.addComponent('coat_tails', 'clothing:item', {
        name: 'coat tails',
        slot: 'legs',
        layer: 'outer',
      });
      entityManager.addComponent('coat_tails', 'clothing:coverage_mapping', {
        covers: ['legs', 'torso_lower', 'groin'],
        coveragePriority: 'outer',
      });

      const pants = entityManager.createEntity('pants');
      entityManager.addComponent('pants', 'clothing:item', {
        name: 'pants',
        slot: 'legs',
        layer: 'base',
      });
      entityManager.addComponent('pants', 'clothing:coverage_mapping', {
        covers: ['legs', 'groin'],
        coveragePriority: 'base',
      });

      const longUnderwear = entityManager.createEntity('long_underwear');
      entityManager.addComponent('long_underwear', 'clothing:item', {
        name: 'long underwear',
        slot: 'legs',
        layer: 'underwear',
      });
      entityManager.addComponent(
        'long_underwear',
        'clothing:coverage_mapping',
        {
          covers: ['legs'],
          coveragePriority: 'underwear',
        }
      );

      const underwear = entityManager.createEntity('underwear');
      entityManager.addComponent('underwear', 'clothing:item', {
        name: 'underwear',
        slot: 'groin',
        layer: 'underwear',
      });
      entityManager.addComponent('underwear', 'clothing:coverage_mapping', {
        covers: ['groin'],
        coveragePriority: 'underwear',
      });

      // Create player entity
      const player = entityManager.createEntity('player');
      entityManager.addComponent('player', 'core:actor', {
        name: 'Player',
      });

      // Resolve the scope
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actorEntity: player,
        target: target,
        location: null,
      };

      // Get the AST from scope registry
      const scopeAst = scopeRegistry.getScopeAst(
        'clothing:target_topmost_torso_lower_clothing_no_accessories'
      );

      const result = scopeEngine.resolve(
        scopeAst,
        player, // actorEntity
        runtimeCtx
      );

      // Should only contain the topmost accessible items from torso_lower slot
      // Since scope queries torso_lower specifically, only items in torso_lower slot are considered
      // jacket (outer layer) blocks shirt and undershirt (base and underwear layers) in same slot
      expect(result).toContain('jacket');
      expect(result).not.toContain('shirt'); // Blocked by jacket (same slot, higher priority)
      expect(result).not.toContain('undershirt'); // Blocked by jacket (same slot, higher priority)

      // Items in other slots are not returned since scope is torso_lower specific
      expect(result).not.toContain('coat_tails'); // Different slot (legs)
      expect(result).not.toContain('pants'); // Different slot (legs)
      expect(result).not.toContain('long_underwear'); // Different slot (legs)
      expect(result).not.toContain('underwear'); // Different slot (groin)
    });

    it('should handle items without coverage mapping data using fallback', () => {
      // Create entity with items that lack coverage mapping
      const target = entityManager.createEntity('target');
      entityManager.addComponent('target', 'core:actor', {
        name: 'Target',
      });
      entityManager.addComponent('target', 'clothing:equipment', {
        equipped: {
          torso_lower: {
            outer: 'jacket_no_mapping',
            base: 'shirt_no_mapping',
          },
        },
      });

      // Create items without coverage mapping (will use fallback)
      const jacket = entityManager.createEntity('jacket_no_mapping');
      entityManager.addComponent('jacket', 'clothing:item', {
        name: 'jacket',
        slot: 'torso_lower',
        layer: 'outer',
      });
      // No coverage_mapping component - will fall back to slot-based coverage

      const shirt = entityManager.createEntity('shirt_no_mapping');
      entityManager.addComponent('shirt', 'clothing:item', {
        name: 'shirt',
        slot: 'torso_lower',
        layer: 'base',
      });
      // No coverage_mapping component

      // Create player entity
      const player = entityManager.createEntity('player');
      entityManager.addComponent('player', 'core:actor', {
        name: 'Player',
      });

      // Resolve the scope
      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actorEntity: player,
        target: target,
        location: null,
      };

      // Get the AST from scope registry
      const scopeAst = scopeRegistry.getScopeAst(
        'clothing:target_topmost_torso_lower_clothing_no_accessories'
      );

      const result = scopeEngine.resolve(
        scopeAst,
        player, // actorEntity
        runtimeCtx
      );

      // With fallback, outer layer (jacket) should block base layer (shirt) in same slot
      expect(result).toContain('jacket_no_mapping');
      expect(result).not.toContain('shirt_no_mapping');
    });
  });

  describe('Performance validation', () => {
    it('should handle large equipment sets efficiently', () => {
      const target = entityManager.createEntity('target');
      entityManager.addComponent('target', 'core:actor', {
        name: 'Target',
      });

      // Create a large equipped component with many items
      const equipped = {};
      const slots = [
        'head',
        'torso_lower',
        'arms',
        'hands',
        'legs',
        'feet',
        'groin',
      ];
      const layers = ['outer', 'base', 'underwear'];

      // Create 21 items (7 slots * 3 layers)
      slots.forEach((slot) => {
        equipped[slot] = {};
        layers.forEach((layer) => {
          const itemId = `${slot}_${layer}_item`;
          equipped[slot][layer] = itemId;

          // Create the item entity
          const item = entityManager.createEntity(itemId);
          entityManager.addComponent(itemId, 'clothing:item', {
            name: `${slot} ${layer}`,
            slot: slot,
            layer: layer,
          });
          entityManager.addComponent(itemId, 'clothing:coverage_mapping', {
            covers: [slot],
            coveragePriority: layer,
          });
        });
      });

      entityManager.addComponent('target', 'clothing:equipment', { equipped });

      // Create player entity
      const player = entityManager.createEntity('player');
      entityManager.addComponent('player', 'core:actor', {
        name: 'Player',
      });

      // Measure performance
      const startTime = Date.now();

      const runtimeCtx = {
        entityManager,
        jsonLogicEval,
        logger,
        actorEntity: player,
        target: target,
        location: null,
      };

      // Get the AST from scope registry
      const scopeAst = scopeRegistry.getScopeAst(
        'clothing:target_topmost_torso_lower_clothing_no_accessories'
      );

      const result = scopeEngine.resolve(
        scopeAst,
        player, // actorEntity
        runtimeCtx
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (< 100ms for 21 items)
      expect(executionTime).toBeLessThan(100);

      // Should only return torso_lower items (since scope queries for torso_lower slot)
      expect(result.size).toBe(1); // Only torso_lower_outer_item
      expect(result).toContain('torso_lower_outer_item');
      expect(result).not.toContain('torso_lower_base_item');
      expect(result).not.toContain('torso_lower_underwear_item');

      // Other slots should not be returned since scope is torso_lower specific
      ['head', 'arms', 'hands', 'legs', 'feet', 'groin'].forEach((slot) => {
        expect(result).not.toContain(`${slot}_outer_item`);
        expect(result).not.toContain(`${slot}_base_item`);
        expect(result).not.toContain(`${slot}_underwear_item`);
      });
    });
  });
});

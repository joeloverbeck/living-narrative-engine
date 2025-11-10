/**
 * @file Integration tests for remove_clothing action with coverage blocking
 * @description Tests how the action discovery system integrates with coverage-blocked
 * scope results to only show removable clothing items. Ensures that blocked items
 * don't appear in available actions and that actions update correctly as items are removed.
 * @see workflows/CLOREMLOG-003-create-coverage-blocking-integration-tests.md
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionDiscoveryServiceTestBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import createCoverageAnalyzer from '../../../src/clothing/analysis/coverageAnalyzer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);

// Import the remove_clothing action definition
import removeClothingAction from '../../../data/mods/clothing/actions/remove_clothing.action.json';

// Import real scope resolution components for the test
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';

// Unmock the real singleton to ensure the test and SUT use the same instance
jest.unmock('../../../src/scopeDsl/scopeRegistry.js');

describe('Remove Clothing Action with Coverage Blocking Integration', () => {
  let testBed;
  let entityManager;
  let actionDiscoveryService;
  let coverageAnalyzer;
  let entitiesGateway;
  let targetResolutionService;

  beforeEach(() => {
    // Create test bed with mock dependencies
    testBed = new ActionDiscoveryServiceTestBed();
    entityManager = new SimpleEntityManager([]);
    
    // Create entities gateway for coverage analyzer and scope resolution
    entitiesGateway = {
      getComponentData: (entityId, componentType) => {
        const entity = entityManager.getEntityInstance(entityId);
        return entity ? entity.getComponentData(componentType) : null;
      },
      hasComponent: (entityId, componentType) => {
        const entity = entityManager.getEntityInstance(entityId);
        return entity ? entity.hasComponent(componentType) : false;
      },
      getEntities: () => {
        return Array.from(entityManager.entities);
      }
    };

    // Create coverage analyzer
    coverageAnalyzer = createCoverageAnalyzer({ entitiesGateway });

    // Replace the entityManager in test bed mocks
    testBed.mocks.entityManager = entityManager;
    
    // Configure action index mock to return remove_clothing action
    testBed.mocks.actionIndex.getCandidateActions = jest.fn((actor) => {
      // Only return action if actor has clothing:equipment component
      const hasEquipment = entityManager.getComponentData(actor.id, 'clothing:equipment');
      if (hasEquipment) {
        // Create a modified version with scope at top level for the mock
        const actionWithScope = {
          ...removeClothingAction,
          scope: removeClothingAction.targets.primary.scope // Add scope at top level
        };
        return [actionWithScope];
      }
      return [];
    });

    // Configure target resolution service to use real scope resolution
    testBed.mocks.targetResolutionService.resolveTargets = jest.fn((scopeName, actorEntity, context) => {
      // Handle the clothing:topmost_clothing scope
      if (scopeName === 'clothing:topmost_clothing') {
        const targets = [];
        const equipment = entityManager.getComponentData(actorEntity.id, 'clothing:equipment');
        
        if (equipment?.equipped) {
          // Get topmost items from each slot using coverage analyzer
          const analysis = coverageAnalyzer.analyzeCoverageBlocking(equipment.equipped, actorEntity.id);
          
          // Iterate through all slots and layers to find accessible items
          for (const [slotName, slotData] of Object.entries(equipment.equipped)) {
            if (!slotData || typeof slotData !== 'object') continue;
            
            // Check layers in priority order
            const layerOrder = ['outer', 'base', 'underwear'];
            for (const layer of layerOrder) {
              if (slotData[layer]) {
                const itemId = slotData[layer];
                // Check if this item is accessible (not blocked by coverage)
                if (analysis.isAccessible(itemId, slotName, layer)) {
                  const item = entityManager.getEntityInstance(itemId);
                  if (item) {
                    targets.push({
                      entityId: itemId,
                      displayName: itemId,
                      components: item.components || {},
                    });
                    break; // Only take the topmost accessible item per slot
                  }
                }
              }
            }
          }
        }
        
        return {
          success: true,
          value: targets,
        };
      }
      
      // Default fallback for other scopes
      return {
        success: true,
        value: [],
      };
    });

    // Create action discovery service using test bed
    actionDiscoveryService = testBed.createStandardDiscoveryService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Action Discovery with Coverage Blocking', () => {
    it('should only show accessible clothing in remove_clothing actions', async () => {
      // Create actor with layered clothing
      const actor = entityManager.createEntity('test:actor');
      entityManager.addComponent('test:actor', 'core:actor', {
        name: 'Test Actor',
      });
      entityManager.addComponent('test:actor', 'clothing:equipment', {
        equipped: {
          torso_lower: {
            base: 'clothing:jeans',
            underwear: 'clothing:boxers',
          },
        }
      });

      // Create jeans (accessible)
      const jeans = entityManager.createEntity('clothing:jeans');
      entityManager.addComponent('clothing:jeans', 'clothing:item', {
        name: 'jeans',
        slot: 'torso_lower',
        layer: 'base',
      });
      entityManager.addComponent('clothing:jeans', 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      });

      // Create boxers (blocked by jeans)
      const boxers = entityManager.createEntity('clothing:boxers');
      entityManager.addComponent('clothing:boxers', 'clothing:item', {
        name: 'boxers',
        slot: 'torso_lower',
        layer: 'underwear',
      });
      entityManager.addComponent('clothing:boxers', 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'underwear',
      });

      // Get available actions for the actor
      const testActor = entityManager.getEntityInstance('test:actor');
      const context = {
        actor: testActor,
        location: null,
        allEntities: Array.from(entityManager.entities),
      };
      
      const result = await actionDiscoveryService.getValidActions(testActor, context);
      const actions = result.actions || result.validActions || [];
      const removeActions = actions.filter(a => a.id === 'clothing:remove_clothing');

      // Should only have one remove action (for jeans)
      expect(removeActions).toHaveLength(1);
      expect(removeActions[0].params?.targetId || removeActions[0].targetId).toBe('clothing:jeans');
      
      // Should not have action for blocked boxers
      const boxersAction = removeActions.find(a => 
        (a.params?.targetId || a.targetId) === 'clothing:boxers'
      );
      expect(boxersAction).toBeUndefined();
    });

    it('should update available actions when equipment changes', async () => {
      // Create actor with layered clothing
      const actor = entityManager.createEntity('dynamic:actor');
      entityManager.addComponent('dynamic:actor', 'core:actor', {
        name: 'Dynamic Test Actor',
      });
      entityManager.addComponent('dynamic:actor', 'clothing:equipment', {
        equipped: {
          torso_lower: {
            base: 'dynamic:pants',
            underwear: 'dynamic:underwear',
          },
        }
      });

      // Create pants
      const pants = entityManager.createEntity('dynamic:pants');
      entityManager.addComponent('dynamic:pants', 'clothing:item', {
        name: 'pants',
        slot: 'torso_lower',
        layer: 'base',
      });
      entityManager.addComponent('dynamic:pants', 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      });

      // Create underwear
      const underwear = entityManager.createEntity('dynamic:underwear');
      entityManager.addComponent('dynamic:underwear', 'clothing:item', {
        name: 'underwear',
        slot: 'torso_lower',
        layer: 'underwear',
      });
      entityManager.addComponent('dynamic:underwear', 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'underwear',
      });

      // Initial state: only pants should be removable
      const dynamicActor = entityManager.getEntityInstance('dynamic:actor');
      const context = {
        actor: dynamicActor,
        location: null,
        allEntities: Array.from(entityManager.entities),
      };
      let result = await actionDiscoveryService.getValidActions(dynamicActor, context);
      let actions = result.actions || result.validActions || [];
      let removeActions = actions.filter(a => a.id === 'clothing:remove_clothing');
      
      expect(removeActions).toHaveLength(1);
      expect(removeActions[0].params?.targetId || removeActions[0].targetId).toBe('dynamic:pants');

      // Simulate removing pants
      const equipment = entityManager.getComponentData('dynamic:actor', 'clothing:equipment');
      delete equipment.equipped.torso_lower.base;
      entityManager.addComponent('dynamic:actor', 'clothing:equipment', equipment);

      // After removing pants: underwear should now be removable
      result = await actionDiscoveryService.getValidActions(dynamicActor, context);
      actions = result.actions || result.validActions || [];
      removeActions = actions.filter(a => a.id === 'clothing:remove_clothing');
      
      expect(removeActions).toHaveLength(1);
      expect(removeActions[0].params?.targetId || removeActions[0].targetId).toBe('dynamic:underwear');
    });

    it('should handle multiple slots with different blocking states', async () => {
      // Create actor with clothing in multiple slots
      const actor = entityManager.createEntity('multi:actor');
      entityManager.addComponent('multi:actor', 'core:actor', {
        name: 'Multi-slot Actor',
      });
      entityManager.addComponent('multi:actor', 'clothing:equipment', {
        equipped: {
          torso_upper: {
            outer: 'multi:jacket',
            base: 'multi:shirt',
          },
          torso_lower: {
            base: 'multi:pants',
            underwear: 'multi:underwear',
          },
          feet: {
            base: 'multi:shoes',
          },
        }
      });

      // Create all clothing items
      const items = [
        { id: 'multi:jacket', slot: 'torso_upper', layer: 'outer', covers: ['torso_upper'] },
        { id: 'multi:shirt', slot: 'torso_upper', layer: 'base', covers: ['torso_upper'] },
        { id: 'multi:pants', slot: 'torso_lower', layer: 'base', covers: ['torso_lower'] },
        { id: 'multi:underwear', slot: 'torso_lower', layer: 'underwear', covers: ['torso_lower'] },
        { id: 'multi:shoes', slot: 'feet', layer: 'base', covers: ['feet'] },
      ];

      items.forEach(item => {
        const entity = entityManager.createEntity(item.id);
        entityManager.addComponent(item.id, 'clothing:item', {
          name: item.id,
          slot: item.slot,
          layer: item.layer,
        });
        entityManager.addComponent(item.id, 'clothing:coverage_mapping', {
          covers: item.covers,
          coveragePriority: item.layer,
        });
      });

      // Get available actions
      const multiActor = entityManager.getEntityInstance('multi:actor');
      const context = {
        actor: multiActor,
        location: null,
        allEntities: Array.from(entityManager.entities),
      };
      const result = await actionDiscoveryService.getValidActions(multiActor, context);
      const actions = result.actions || result.validActions || [];
      const removeActions = actions.filter(a => a.id === 'clothing:remove_clothing');

      // Should have actions for:
      // - jacket (topmost in torso_upper)
      // - pants (topmost in torso_lower)
      // - shoes (only item in feet)
      expect(removeActions).toHaveLength(3);
      
      const targetIds = removeActions.map(a => a.params?.targetId || a.targetId);
      expect(targetIds).toContain('multi:jacket');
      expect(targetIds).toContain('multi:pants');
      expect(targetIds).toContain('multi:shoes');
      
      // Should NOT have actions for blocked items:
      expect(targetIds).not.toContain('multi:shirt'); // Blocked by jacket
      expect(targetIds).not.toContain('multi:underwear'); // Blocked by pants
    });
  });

  describe('Edge Cases in Action Discovery', () => {
    it('should handle equipment with no coverage data', async () => {
      // Create actor with items lacking coverage data
      const actor = entityManager.createEntity('nocov:actor');
      entityManager.addComponent('nocov:actor', 'core:actor', {
        name: 'No Coverage Actor',
      });
      entityManager.addComponent('nocov:actor', 'clothing:equipment', {
        equipped: {
          torso_lower: {
            base: 'nocov:item1',
            underwear: 'nocov:item2',
          },
        }
      });

      // Create items WITHOUT coverage mapping
      const item1 = entityManager.createEntity('nocov:item1');
      entityManager.addComponent('nocov:item1', 'clothing:item', {
        name: 'item1',
        slot: 'torso_lower',
        layer: 'base',
      });
      // No coverage_mapping component

      const item2 = entityManager.createEntity('nocov:item2');
      entityManager.addComponent('nocov:item2', 'clothing:item', {
        name: 'item2',
        slot: 'torso_lower',
        layer: 'underwear',
      });
      // No coverage_mapping component

      // Should still generate actions (fallback to layer-based logic)
      const nocovActor = entityManager.getEntityInstance('nocov:actor');
      const context = {
        actor: nocovActor,
        location: null,
        allEntities: Array.from(entityManager.entities),
      };
      const result = await actionDiscoveryService.getValidActions(nocovActor, context);
      const actions = result.actions || result.validActions || [];
      const removeActions = actions.filter(a => a.id === 'clothing:remove_clothing');

      // Without coverage data, should fall back to showing topmost item
      expect(removeActions.length).toBeGreaterThan(0);
    });

    it('should handle empty equipment slots', async () => {
      // Create actor with empty equipment
      const actor = entityManager.createEntity('empty:actor');
      entityManager.addComponent('empty:actor', 'core:actor', {
        name: 'Empty Equipment Actor',
      });
      entityManager.addComponent('empty:actor', 'clothing:equipment', {
        equipped: {},
      });

      // Should return no remove_clothing actions
      const emptyActor = entityManager.getEntityInstance('empty:actor');
      const context = {
        actor: emptyActor,
        location: null,
        allEntities: Array.from(entityManager.entities),
      };
      const result = await actionDiscoveryService.getValidActions(emptyActor, context);
      const actions = result.actions || result.validActions || [];
      const removeActions = actions.filter(a => a.id === 'clothing:remove_clothing');

      expect(removeActions).toHaveLength(0);
    });

    it('should handle partially equipped slots', async () => {
      // Create actor with some slots having only underwear
      const actor = entityManager.createEntity('partial:actor');
      entityManager.addComponent('partial:actor', 'core:actor', {
        name: 'Partial Equipment Actor',
      });
      entityManager.addComponent('partial:actor', 'clothing:equipment', {
        equipped: {
          torso_upper: {
            // No outer or base layer
            underwear: 'partial:bra',
          },
          torso_lower: {
            base: 'partial:skirt',
            // No underwear
          },
        }
      });

      // Create items
      const bra = entityManager.createEntity('partial:bra');
      entityManager.addComponent('partial:bra', 'clothing:item', {
        name: 'bra',
        slot: 'torso_upper',
        layer: 'underwear',
      });
      entityManager.addComponent('partial:bra', 'clothing:coverage_mapping', {
        covers: ['torso_upper'],
        coveragePriority: 'underwear',
      });

      const skirt = entityManager.createEntity('partial:skirt');
      entityManager.addComponent('partial:skirt', 'clothing:item', {
        name: 'skirt',
        slot: 'torso_lower',
        layer: 'base',
      });
      entityManager.addComponent('partial:skirt', 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      });

      // Get available actions
      const partialActor = entityManager.getEntityInstance('partial:actor');
      const context = {
        actor: partialActor,
        location: null,
        allEntities: Array.from(entityManager.entities),
      };
      const result = await actionDiscoveryService.getValidActions(partialActor, context);
      const actions = result.actions || result.validActions || [];
      const removeActions = actions.filter(a => a.id === 'clothing:remove_clothing');

      // Should have actions for both items (no blocking)
      expect(removeActions).toHaveLength(2);
      
      const targetIds = removeActions.map(a => a.params?.targetId || a.targetId);
      expect(targetIds).toContain('partial:bra');
      expect(targetIds).toContain('partial:skirt');
    });
  });

  describe('Action Prerequisites with Coverage', () => {
    it('should validate prerequisites based on coverage accessibility', async () => {
      // Create actor
      const actor = entityManager.createEntity('prereq:actor');
      entityManager.addComponent('prereq:actor', 'core:actor', {
        name: 'Prerequisites Actor',
      });
      entityManager.addComponent('prereq:actor', 'clothing:equipment', {
        equipped: {
          torso_lower: {
            outer: 'prereq:coat',
            base: 'prereq:pants',
            underwear: 'prereq:underwear',
          },
        }
      });

      // Create layered items
      const items = [
        { id: 'prereq:coat', slot: 'torso_lower', layer: 'outer', covers: ['torso_lower'] },
        { id: 'prereq:pants', slot: 'torso_lower', layer: 'base', covers: ['torso_lower'] },
        { id: 'prereq:underwear', slot: 'torso_lower', layer: 'underwear', covers: ['torso_lower'] },
      ];

      items.forEach(item => {
        const entity = entityManager.createEntity(item.id);
        entityManager.addComponent(item.id, 'clothing:item', {
          name: item.id,
          slot: item.slot,
          layer: item.layer,
        });
        entityManager.addComponent(item.id, 'clothing:coverage_mapping', {
          covers: item.covers,
          coveragePriority: item.layer,
        });
      });

      // Verify action prerequisites respect coverage blocking
      const prereqActor = entityManager.getEntityInstance('prereq:actor');
      const context = {
        actor: prereqActor,
        location: null,
        allEntities: Array.from(entityManager.entities),
      };
      let result = await actionDiscoveryService.getValidActions(prereqActor, context);
      let actions = result.actions || result.validActions || [];
      let removeActions = actions.filter(a => a.id === 'clothing:remove_clothing');

      // Only coat should be removable initially
      expect(removeActions).toHaveLength(1);
      expect(removeActions[0].params?.targetId || removeActions[0].targetId).toBe('prereq:coat');

      // Simulate removing coat
      const equipment = entityManager.getComponentData('prereq:actor', 'clothing:equipment');
      delete equipment.equipped.torso_lower.outer;
      entityManager.addComponent('prereq:actor', 'clothing:equipment', equipment);

      // Now pants should be removable
      result = await actionDiscoveryService.getValidActions(prereqActor, context);
      actions = result.actions || result.validActions || [];
      const updatedRemoveActions = actions.filter(a => a.id === 'clothing:remove_clothing');
      
      expect(updatedRemoveActions).toHaveLength(1);
      expect(updatedRemoveActions[0].params?.targetId || updatedRemoveActions[0].targetId).toBe('prereq:pants');
    });
  });
});
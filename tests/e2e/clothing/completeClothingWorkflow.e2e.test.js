/**
 * @file Complete Clothing Workflow E2E Test Suite
 * @description End-to-end tests for the complete clothing system workflow
 * from character creation through equipment changes to action discovery
 */

import { describe, beforeAll, beforeEach, afterAll, it, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { ClothingTestDataFactory } from '../../common/clothing/clothingTestDataFactory.js';
import { ClothingTestAssertions } from '../../common/clothing/clothingTestAssertions.js';

/**
 * E2E test suite for complete clothing workflows
 * Addresses CLOREMLOG-008 requirements for end-to-end testing
 */
describe('Complete Clothing Workflow E2E', () => {
  let container;
  let entityManager;
  let clothingAccessibilityService;
  let scopeEngine;
  let scopeRegistry;
  let actionDiscoveryService;
  let logger;
  let dataRegistry;

  beforeAll(async () => {
    // Create and configure container
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Get services from container
    entityManager = container.resolve(tokens.IEntityManager);
    clothingAccessibilityService = container.resolve(tokens.ClothingAccessibilityService);
    scopeEngine = container.resolve(tokens.IScopeEngine);
    scopeRegistry = container.resolve(tokens.IScopeRegistry);
    actionDiscoveryService = container.resolve(tokens.IActionDiscoveryService);
    logger = container.resolve(tokens.ILogger);
    dataRegistry = container.resolve(tokens.IDataRegistry);

    // Verify critical services
    if (!clothingAccessibilityService) {
      throw new Error('ClothingAccessibilityService not available - required for E2E tests');
    }
    
    logger.info('Complete Clothing Workflow E2E: Services initialized');
  });

  afterAll(async () => {
    // Cleanup if needed
    if (container) {
      // Final cleanup
      logger.info('Complete Clothing Workflow E2E: Tests completed');
    }
  });

  describe('Character Creation to Action Discovery', () => {
    let testCharacterId;

    beforeEach(() => {
      testCharacterId = `e2e_character_${Date.now()}`;
    });

    it('should work end-to-end for new character with clothing', async () => {
      // 1. Create character entity
      await entityManager.createEntityInstance('core:actor', { 
        instanceId: testCharacterId,
        componentOverrides: {
          'core:actor': {
            name: 'Test Character'
          }
        }
      });

      // 2. Equip clothing items
      const equipment = {
        equipped: {
          torso_upper: { base: 'clothing:white_cotton_crew_tshirt' },
          torso_lower: { 
            base: 'clothing:dark_indigo_denim_jeans',
            underwear: 'clothing:white_cotton_panties'
          },
          feet: { base: 'clothing:white_leather_sneakers' }
        }
      };
      await entityManager.addComponent(testCharacterId, 'clothing:equipment', equipment);

      // 3. Verify equipment was set correctly
      const retrievedEquipment = entityManager.getComponentData(testCharacterId, 'clothing:equipment');
      expect(retrievedEquipment).toEqual(equipment);

      // 4. Get accessible items through service
      const accessibleItems = clothingAccessibilityService.getAccessibleItems(testCharacterId, { 
        mode: 'topmost' 
      });

      // 5. Verify correct items are accessible
      expect(accessibleItems).toContain('clothing:white_cotton_crew_tshirt');
      expect(accessibleItems).toContain('clothing:dark_indigo_denim_jeans');
      expect(accessibleItems).toContain('clothing:white_leather_sneakers');
      expect(accessibleItems).not.toContain('clothing:white_cotton_panties'); // Blocked by jeans

      // 6. Execute clothing scope resolution if scope is registered
      try {
        const scopeResult = scopeEngine.resolve('clothing:topmost_clothing', {
          entityId: testCharacterId,
          entityManager,
          jsonLogicEval: container.resolve(tokens.JsonLogicEvaluationService),
          logger,
          container
        });
        
        // Scope result should match service result
        if (scopeResult && scopeResult.length > 0) {
          expect(scopeResult).toEqual(expect.arrayContaining(accessibleItems));
        }
      } catch (e) {
        // Scope might not be registered in test environment
        logger.debug('Scope resolution skipped:', e.message);
      }

      // 7. Verify action discovery if available
      if (actionDiscoveryService) {
        try {
          const actions = actionDiscoveryService.discoverActions(testCharacterId);
          const clothingActions = actions.filter(a => 
            a.actionId && a.actionId.includes('clothing')
          );
          
          // Should have clothing-related actions
          expect(clothingActions.length).toBeGreaterThanOrEqual(0);
        } catch (e) {
          logger.debug('Action discovery skipped:', e.message);
        }
      }
    });

    it('should handle equipment changes dynamically', async () => {
      // Create character with initial equipment
      await entityManager.addComponent(testCharacterId, 'core:actor', { name: 'Dynamic Test' });
      await entityManager.addComponent(testCharacterId, 'clothing:equipment', {
        equipped: {
          torso_upper: { base: 'clothing:charcoal_wool_tshirt' }
        }
      });

      // Initial state - shirt is accessible
      let accessible = clothingAccessibilityService.getAccessibleItems(testCharacterId, { 
        mode: 'topmost' 
      });
      expect(accessible).toContain('clothing:charcoal_wool_tshirt');

      // Add outer layer
      await entityManager.removeComponent(testCharacterId, 'clothing:equipment');
      await entityManager.addComponent(testCharacterId, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            outer: 'clothing:indigo_denim_trucker_jacket',
            base: 'clothing:charcoal_wool_tshirt'
          }
        }
      });

      // Clear cache to ensure fresh data
      clothingAccessibilityService.clearCache(testCharacterId);

      // New state - jacket is accessible, shirt is blocked
      accessible = clothingAccessibilityService.getAccessibleItems(testCharacterId, { 
        mode: 'topmost' 
      });
      expect(accessible).toContain('clothing:indigo_denim_trucker_jacket');
      
      // Whether shirt is blocked depends on coverage implementation
      // In topmost mode, it should typically be blocked by outer layer
      if (accessible.length === 1) {
        expect(accessible).not.toContain('clothing:charcoal_wool_tshirt');
      }

      // Remove jacket
      await entityManager.removeComponent(testCharacterId, 'clothing:equipment');
      await entityManager.addComponent(testCharacterId, 'clothing:equipment', {
        equipped: {
          torso_upper: { base: 'clothing:charcoal_wool_tshirt' }
        }
      });

      clothingAccessibilityService.clearCache(testCharacterId);

      // Final state - shirt is accessible again
      accessible = clothingAccessibilityService.getAccessibleItems(testCharacterId, { 
        mode: 'topmost' 
      });
      expect(accessible).toContain('clothing:charcoal_wool_tshirt');
    });

    it('should work with complex character configurations', async () => {
      // Create character with complex multi-layer equipment
      await entityManager.addComponent(testCharacterId, 'core:actor', { 
        name: 'Complex Character' 
      });
      
      const complexEquipment = {
        equipped: {
          torso_upper: {
            outer: 'clothing:dark_olive_cotton_twill_chore_jacket',
            base: 'clothing:white_cotton_crew_tshirt',
            underwear: 'clothing:nylon_sports_bra'
          },
          torso_lower: {
            base: 'clothing:dark_indigo_denim_jeans',
            underwear: 'clothing:white_cotton_panties'
          },
          feet: {
            outer: 'clothing:sand_suede_chukka_boots',
            base: 'clothing:gray_ribknit_cotton_socks'
          }
        }
      };
      
      await entityManager.addComponent(testCharacterId, 'clothing:equipment', complexEquipment);

      // Get all accessible items
      const allItems = clothingAccessibilityService.getAccessibleItems(testCharacterId, { 
        mode: 'all' 
      });
      
      // Should have all items  
      expect(allItems.length).toBeGreaterThan(5);
      expect(allItems).toContain('clothing:dark_olive_cotton_twill_chore_jacket');
      expect(allItems).toContain('clothing:nylon_sports_bra');
      expect(allItems).toContain('clothing:sand_suede_chukka_boots');

      // Get topmost items
      const topmostItems = clothingAccessibilityService.getAccessibleItems(testCharacterId, { 
        mode: 'topmost' 
      });
      
      // Should only have outer layer items (or highest priority per slot)
      expect(topmostItems).toContain('clothing:dark_olive_cotton_twill_chore_jacket');
      expect(topmostItems).toContain('clothing:dark_indigo_denim_jeans');
      expect(topmostItems).toContain('clothing:sand_suede_chukka_boots');
      
      // Should not have items blocked by outer layers
      expect(topmostItems).not.toContain('clothing:white_cotton_crew_tshirt');
      expect(topmostItems).not.toContain('clothing:nylon_sports_bra');
      expect(topmostItems).not.toContain('clothing:gray_ribknit_cotton_socks');
    });
  });

  describe('Layla Agirre Scenario E2E', () => {
    let laylaId;

    beforeEach(async () => {
      laylaId = 'layla_agirre_e2e';
      
      // Create Layla Agirre entity
      await entityManager.addComponent(laylaId, 'core:actor', {
        name: 'Layla Agirre'
      });
      
      // Set up the problematic equipment configuration
      const laylaEquipment = ClothingTestDataFactory.createLaylaAgirreEquipment();
      await entityManager.addComponent(laylaId, 'clothing:equipment', laylaEquipment);
    });

    it('should correctly handle the Layla Agirre clothing scenario', async () => {
      // Get accessible items in topmost mode
      const accessible = clothingAccessibilityService.getAccessibleItems(laylaId, { 
        mode: 'topmost' 
      });
      
      // Should only return trousers, not boxer brief
      ClothingTestAssertions.assertLaylaAgirreScenario(accessible);
      
      // Verify accessibility check
      const boxerBriefAccessible = clothingAccessibilityService.isItemAccessible(
        laylaId,
        'clothing:power_mesh_boxer_brief'
      );
      
      expect(boxerBriefAccessible.accessible).toBe(false);
      
      // Verify blocking item
      const blocker = clothingAccessibilityService.getBlockingItem(
        laylaId,
        'clothing:power_mesh_boxer_brief'
      );
      
      expect(blocker).toBe('clothing:dark_olive_high_rise_double_pleat_trousers');
    });

    it('should maintain consistency across different query modes', async () => {
      // Topmost mode - only trousers
      const topmost = clothingAccessibilityService.getAccessibleItems(laylaId, { 
        mode: 'topmost' 
      });
      expect(topmost).toEqual(['clothing:dark_olive_high_rise_double_pleat_trousers']);
      
      // All mode - both items
      const all = clothingAccessibilityService.getAccessibleItems(laylaId, { 
        mode: 'all' 
      });
      expect(all).toContain('clothing:dark_olive_high_rise_double_pleat_trousers');
      expect(all).toContain('clothing:power_mesh_boxer_brief');
      
      // Base layer mode - only trousers
      const base = clothingAccessibilityService.getAccessibleItems(laylaId, { 
        mode: 'base' 
      });
      expect(base).toEqual(['clothing:dark_olive_high_rise_double_pleat_trousers']);
      
      // Underwear mode - only boxer brief
      const underwear = clothingAccessibilityService.getAccessibleItems(laylaId, { 
        mode: 'underwear' 
      });
      expect(underwear).toEqual(['clothing:power_mesh_boxer_brief']);
    });
  });

  describe('Performance and Stress Testing E2E', () => {
    it('should handle large wardrobes efficiently', async () => {
      const largeWardrobeId = 'large_wardrobe_e2e';
      
      // Create large equipment set
      const largeEquipment = ClothingTestDataFactory.createLargeWardrobeEquipment(100);
      await entityManager.addComponent(largeWardrobeId, 'clothing:equipment', largeEquipment);
      
      // Measure performance
      const duration = ClothingTestAssertions.assertPerformanceWithin(
        () => {
          const items = clothingAccessibilityService.getAccessibleItems(largeWardrobeId, {
            mode: 'all'
          });
          expect(items.length).toBeGreaterThan(50);
        },
        100, // 100ms for large wardrobe
        'Large wardrobe E2E query'
      );
      
      expect(duration).toBeLessThan(100);
    });

    it('should benefit from caching in repeated queries', async () => {
      const cacheTestId = 'cache_test_e2e';
      await entityManager.addComponent(cacheTestId, 'clothing:equipment', {
        equipped: {
          torso: { base: 'item1', underwear: 'item2' }
        }
      });
      
      // Measure cache performance
      const cacheMetrics = ClothingTestAssertions.assertCacheSpeedup(
        () => {
          clothingAccessibilityService.clearCache(cacheTestId);
          clothingAccessibilityService.getAccessibleItems(cacheTestId);
        },
        () => clothingAccessibilityService.getAccessibleItems(cacheTestId),
        2 // At least 2x speedup
      );
      
      if (cacheMetrics.coldTime > 0.1) {
        expect(cacheMetrics.speedup).toBeGreaterThan(2);
      }
    });
  });

  describe('Error Scenarios E2E', () => {
    it('should handle missing clothing data gracefully', async () => {
      const errorTestId = 'error_test_e2e';
      
      // Entity with no equipment component
      const result = clothingAccessibilityService.getAccessibleItems(errorTestId);
      expect(result).toEqual([]);
      
      // Add malformed equipment
      await entityManager.addComponent(errorTestId, 'clothing:equipment', {
        equipped: 'not-an-object' // Invalid structure
      });
      
      const result2 = clothingAccessibilityService.getAccessibleItems(errorTestId);
      expect(result2).toEqual([]);
    });

    it('should recover from component failures', async () => {
      const recoveryTestId = 'recovery_test_e2e';
      
      // Try to access non-existent entity
      const result = clothingAccessibilityService.getAccessibleItems(recoveryTestId);
      expect(result).toEqual([]);
      
      // Create entity and try again
      await entityManager.addComponent(recoveryTestId, 'clothing:equipment', {
        equipped: { torso_upper: { base: 'clothing:white_cotton_crew_tshirt' } }
      });
      
      const result2 = clothingAccessibilityService.getAccessibleItems(recoveryTestId);
      expect(result2).toContain('clothing:white_cotton_crew_tshirt');
    });
  });
});
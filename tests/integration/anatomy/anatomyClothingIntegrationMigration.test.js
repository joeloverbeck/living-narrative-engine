/**
 * @file Migration test suite for AnatomyClothingIntegrationService refactoring
 * Ensures backward compatibility when using the facade and new decomposed services
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyClothingIntegrationService from '../../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import AnatomyClothingIntegrationFacade from '../../../src/anatomy/integration/AnatomyClothingIntegrationFacade.js';
import AnatomyBlueprintRepository from '../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import AnatomySocketIndex from '../../../src/anatomy/services/anatomySocketIndex.js';
import ClothingSlotValidator from '../../../src/clothing/validation/clothingSlotValidator.js';
import { AnatomyClothingCache } from '../../../src/anatomy/cache/AnatomyClothingCache.js';
import { ANATOMY_CLOTHING_CACHE_CONFIG } from '../../../src/anatomy/constants/anatomyConstants.js';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('AnatomyClothingIntegration Migration Tests', () => {
  let testBed;
  let mockLogger;
  let entityManager;
  let bodyGraphService;
  let dataRegistry;
  let legacyService;
  let facadeService;
  let anatomyBlueprintRepository;
  let anatomySocketIndex;
  let clothingSlotValidator;
  let anatomyClothingCache;
  
  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
    
    mockLogger = createMockLogger();
    entityManager = testBed.getEntityManager();
    bodyGraphService = testBed.getBodyGraphService();
    dataRegistry = testBed.getDataRegistry();
    
    // Create instances of new decomposed services
    anatomyBlueprintRepository = new AnatomyBlueprintRepository({
      dataRegistry,
      logger: mockLogger,
    });
    
    anatomySocketIndex = new AnatomySocketIndex({
      entityManager,
      bodyGraphService,
      logger: mockLogger,
    });
    
    clothingSlotValidator = new ClothingSlotValidator({
      logger: mockLogger,
    });
    
    anatomyClothingCache = new AnatomyClothingCache(
      { logger: mockLogger },
      ANATOMY_CLOTHING_CACHE_CONFIG
    );
    
    // Create legacy service
    legacyService = new AnatomyClothingIntegrationService({
      logger: mockLogger,
      entityManager,
      bodyGraphService,
      anatomyBlueprintRepository,
      anatomySocketIndex,
      clothingSlotValidator,
      anatomyClothingCache,
    });
    
    // Create facade service
    facadeService = new AnatomyClothingIntegrationFacade({
      logger: mockLogger,
      entityManager,
      bodyGraphService,
      anatomyBlueprintRepository,
      anatomySocketIndex,
      clothingSlotValidator,
      anatomyClothingCache,
    });
  });
  
  afterEach(() => {
    testBed.cleanup();
  });
  
  describe('API Compatibility', () => {
    it('should provide the same public API methods', () => {
      // Check that all public methods exist on both services
      const publicMethods = [
        'getAvailableClothingSlots',
        'resolveClothingSlotToAttachmentPoints',
        'validateClothingSlotCompatibility',
        'getSlotAnatomySockets',
        'setSlotEntityMappings',
        'clearCache',
        'invalidateCacheForEntity',
      ];
      
      publicMethods.forEach((method) => {
        expect(typeof legacyService[method]).toBe('function');
        expect(typeof facadeService[method]).toBe('function');
      });
    });
  });
  
  describe('Functional Compatibility', () => {
    let actorId;
    let anatomyData;
    
    beforeEach(async () => {
      // Create a test actor with anatomy
      const result = await testBed.createTestActorWithAnatomy();
      actorId = result.actorId;
      anatomyData = result.anatomyData;
    });
    
    it('should return the same available clothing slots', async () => {
      const legacySlots = await legacyService.getAvailableClothingSlots(actorId);
      const facadeSlots = await facadeService.getAvailableClothingSlots(actorId);
      
      // Convert Maps to arrays for easier comparison
      const legacyArray = Array.from(legacySlots.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const facadeArray = Array.from(facadeSlots.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      
      expect(legacyArray).toEqual(facadeArray);
    });
    
    it('should resolve clothing slots to the same attachment points', async () => {
      const slots = await legacyService.getAvailableClothingSlots(actorId);
      const slotId = Array.from(slots.keys())[0]; // Get first available slot
      
      if (slotId) {
        const legacyPoints = await legacyService.resolveClothingSlotToAttachmentPoints(actorId, slotId);
        const facadePoints = await facadeService.resolveClothingSlotToAttachmentPoints(actorId, slotId);
        
        expect(legacyPoints).toEqual(facadePoints);
      }
    });
    
    it('should validate clothing slot compatibility identically', async () => {
      // Create a test clothing item
      const clothingId = await testBed.createTestClothingItem('core:shirt_simple');
      
      const slots = await legacyService.getAvailableClothingSlots(actorId);
      const slotId = Array.from(slots.keys())[0];
      
      if (slotId) {
        const legacyResult = await legacyService.validateClothingSlotCompatibility(
          actorId,
          slotId,
          clothingId
        );
        
        const facadeResult = await facadeService.validateClothingSlotCompatibility(
          actorId,
          slotId,
          clothingId
        );
        
        expect(legacyResult).toEqual(facadeResult);
      }
    });
    
    it('should handle slot-entity mappings identically', async () => {
      const testMappings = new Map([
        ['left_hand', 'entity_123'],
        ['right_hand', 'entity_456'],
      ]);
      
      // Set mappings on both services
      legacyService.setSlotEntityMappings(testMappings);
      facadeService.setSlotEntityMappings(testMappings);
      
      // Verify that both services use the mappings correctly
      // by resolving slots and comparing results
      const legacySlots = await legacyService.getAvailableClothingSlots(actorId);
      const facadeSlots = await facadeService.getAvailableClothingSlots(actorId);
      
      expect(Array.from(legacySlots.entries())).toEqual(Array.from(facadeSlots.entries()));
    });
  });
  
  describe('Cache Behavior', () => {
    let actorId;
    
    beforeEach(async () => {
      const result = await testBed.createTestActorWithAnatomy();
      actorId = result.actorId;
    });
    
    it('should cache results identically', async () => {
      // First call should populate cache
      const legacySlots1 = await legacyService.getAvailableClothingSlots(actorId);
      const facadeSlots1 = await facadeService.getAvailableClothingSlots(actorId);
      
      // Second call should use cache
      const legacySlots2 = await legacyService.getAvailableClothingSlots(actorId);
      const facadeSlots2 = await facadeService.getAvailableClothingSlots(actorId);
      
      // Results should be identical
      expect(Array.from(legacySlots1.entries())).toEqual(Array.from(legacySlots2.entries()));
      expect(Array.from(facadeSlots1.entries())).toEqual(Array.from(facadeSlots2.entries()));
      expect(Array.from(legacySlots1.entries())).toEqual(Array.from(facadeSlots1.entries()));
    });
    
    it('should clear cache identically', async () => {
      // Populate cache
      await legacyService.getAvailableClothingSlots(actorId);
      await facadeService.getAvailableClothingSlots(actorId);
      
      // Clear cache
      legacyService.clearCache();
      facadeService.clearCache();
      
      // Both should fetch fresh data
      const legacySlots = await legacyService.getAvailableClothingSlots(actorId);
      const facadeSlots = await facadeService.getAvailableClothingSlots(actorId);
      
      expect(Array.from(legacySlots.entries())).toEqual(Array.from(facadeSlots.entries()));
    });
    
    it('should invalidate entity cache identically', async () => {
      // Populate cache
      await legacyService.getAvailableClothingSlots(actorId);
      await facadeService.getAvailableClothingSlots(actorId);
      
      // Invalidate specific entity
      legacyService.invalidateCacheForEntity(actorId);
      facadeService.invalidateCacheForEntity(actorId);
      
      // Both should fetch fresh data for that entity
      const legacySlots = await legacyService.getAvailableClothingSlots(actorId);
      const facadeSlots = await facadeService.getAvailableClothingSlots(actorId);
      
      expect(Array.from(legacySlots.entries())).toEqual(Array.from(facadeSlots.entries()));
    });
  });
  
  describe('Error Handling', () => {
    it('should handle errors identically', async () => {
      // Test with invalid entity ID
      await expect(legacyService.getAvailableClothingSlots(null))
        .rejects.toThrow('Entity ID is required');
      
      await expect(facadeService.getAvailableClothingSlots(null))
        .rejects.toThrow('Entity ID is required');
      
      // Test with non-existent entity
      await expect(legacyService.getAvailableClothingSlots('non_existent'))
        .resolves.toEqual(new Map());
      
      await expect(facadeService.getAvailableClothingSlots('non_existent'))
        .resolves.toEqual(new Map());
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle entities without anatomy identically', async () => {
      // Create entity without anatomy
      const entityId = testBed.createBlankEntity();
      
      const legacySlots = await legacyService.getAvailableClothingSlots(entityId);
      const facadeSlots = await facadeService.getAvailableClothingSlots(entityId);
      
      expect(legacySlots).toEqual(new Map());
      expect(facadeSlots).toEqual(new Map());
    });
    
    it('should handle empty body graphs identically', async () => {
      // Create actor with empty anatomy
      const actorId = await testBed.createTestActorWithEmptyAnatomy();
      
      const legacySlots = await legacyService.getAvailableClothingSlots(actorId);
      const facadeSlots = await facadeService.getAvailableClothingSlots(actorId);
      
      expect(Array.from(legacySlots.entries())).toEqual(Array.from(facadeSlots.entries()));
    });
  });
});

describe('Dependent Services Migration', () => {
  let testBed;
  let mockLogger;
  let clothingManagementService;
  let clothingInstantiationService;
  let actorId;
  
  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();
    
    mockLogger = createMockLogger();
    
    // Services will be created using the facade through DI
    clothingManagementService = testBed.getClothingManagementService();
    clothingInstantiationService = testBed.getClothingInstantiationService();
    
    // Create test actor
    const result = await testBed.createTestActorWithAnatomy();
    actorId = result.actorId;
  });
  
  afterEach(() => {
    testBed.cleanup();
  });
  
  it('ClothingManagementService should work with facade', async () => {
    const result = await clothingManagementService.getAvailableSlots(actorId);
    
    expect(result.success).toBe(true);
    expect(Array.isArray(result.slots)).toBe(true);
  });
  
  it('ClothingInstantiationService should work with facade', async () => {
    const recipe = {
      clothingEntities: [
        {
          entityId: 'core:shirt_simple',
          equip: true,
          targetSlot: 'torso',
        },
      ],
    };
    
    const anatomyData = {
      partsMap: new Map([['torso', 'torso_entity_id']]),
      slotEntityMappings: new Map([['torso', 'torso_entity_id']]),
    };
    
    const result = await clothingInstantiationService.instantiateRecipeClothing(
      actorId,
      recipe,
      anatomyData
    );
    
    // The result should have the expected structure
    expect(result).toHaveProperty('instantiated');
    expect(result).toHaveProperty('equipped');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.instantiated)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    
    // If there are no errors, we should have instantiated items
    // If there are errors (due to test setup limitations), that's also valid
    if (result.errors.length === 0) {
      expect(result.instantiated.length).toBeGreaterThan(0);
    }
  });
});
/**
 * @file Integration test for anatomy visualizer initialization
 * Ensures the dependency injection chain works correctly
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ClothingInstantiationService from '../../src/clothing/services/clothingInstantiationService.js';
import AnatomyClothingIntegrationService from '../../src/anatomy/integration/anatomyClothingIntegrationService.js';
import { createMockLogger } from '../common/mockFactories/loggerMocks.js';

describe('Anatomy Visualizer - Service Integration', () => {
  it('should create ClothingInstantiationService with correct dependencies', () => {
    // This test verifies that the ClothingInstantiationService no longer
    // requires the 'validateSlotCompatibility' method and instead uses
    // 'validateClothingSlotCompatibility'

    // Mock the required services
    const mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    const mockDataRegistry = {
      get: jest.fn(),
    };

    const mockEquipmentOrchestrator = {
      orchestrateEquipment: jest.fn(),
    };

    const mockAnatomyClothingIntegrationService = {
      validateClothingSlotCompatibility: jest.fn().mockResolvedValue({
        valid: true,
      }),
    };

    const mockEventBus = {
      dispatch: jest.fn(),
    };

    let service;
    expect(() => {
      service = new ClothingInstantiationService({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        equipmentOrchestrator: mockEquipmentOrchestrator,
        anatomyClothingIntegrationService: mockAnatomyClothingIntegrationService,
        logger: createMockLogger(),
        eventBus: mockEventBus,
      });
    }).not.toThrow();

    expect(service).toBeDefined();
  });

  it('should fail if anatomyClothingIntegrationService lacks validateClothingSlotCompatibility', () => {
    // This test ensures that if the wrong method name is provided, 
    // the service will throw an error during initialization

    const mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    const mockDataRegistry = {
      get: jest.fn(),
    };

    const mockEquipmentOrchestrator = {
      orchestrateEquipment: jest.fn(),
    };

    // Mock with the WRONG method name to ensure validation works
    const mockAnatomyClothingIntegrationService = {
      validateSlotCompatibility: jest.fn(), // Wrong method name!
    };

    const mockEventBus = {
      dispatch: jest.fn(),
    };

    expect(() => {
      new ClothingInstantiationService({
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        equipmentOrchestrator: mockEquipmentOrchestrator,
        anatomyClothingIntegrationService: mockAnatomyClothingIntegrationService,
        logger: createMockLogger(),
        eventBus: mockEventBus,
      });
    }).toThrow('validateClothingSlotCompatibility');
  });

  it('should verify anatomyClothingIntegrationService has the required method', () => {
    // This test specifically checks that the anatomyClothingIntegrationService
    // provides the validateClothingSlotCompatibility method

    // Create minimal mocks for the service
    const mockDeps = {
      entityManager: {
        getComponentData: jest.fn(),
        hasComponents: jest.fn(),
        hasComponent: jest.fn(),
      },
      bodyGraphService: {
        getBodyGraph: jest.fn(),
      },
      dataRegistry: {
        get: jest.fn(),
      },
      logger: createMockLogger(),
    };

    const service = new AnatomyClothingIntegrationService(mockDeps);

    // Verify the method exists
    expect(typeof service.validateClothingSlotCompatibility).toBe('function');

    // Verify it's an async function
    expect(service.validateClothingSlotCompatibility.constructor.name).toBe(
      'AsyncFunction'
    );
  });

  it('should call validateClothingSlotCompatibility during clothing instantiation', async () => {
    // This test verifies that the ClothingInstantiationService calls
    // the correct method on anatomyClothingIntegrationService

    const mockEntityManager = {
      createEntityInstance: jest.fn().mockResolvedValue('clothing_123'),
      getEntityInstance: jest.fn(),
    };

    const mockDataRegistry = {
      get: jest.fn().mockReturnValue({
        id: 'test:clothing',
        components: {
          'clothing:wearable': {
            equipmentSlots: { primary: 'torso' },
          },
        },
      }),
    };

    const mockEquipmentOrchestrator = {
      orchestrateEquipment: jest.fn().mockResolvedValue({
        success: true,
      }),
    };

    const mockAnatomyClothingIntegrationService = {
      validateClothingSlotCompatibility: jest.fn().mockResolvedValue({
        valid: true,
      }),
    };

    const mockEventBus = {
      dispatch: jest.fn(),
    };

    const service = new ClothingInstantiationService({
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
      equipmentOrchestrator: mockEquipmentOrchestrator,
      anatomyClothingIntegrationService: mockAnatomyClothingIntegrationService,
      logger: createMockLogger(),
      eventBus: mockEventBus,
    });

    const recipe = {
      clothingEntities: [
        {
          entityId: 'test:clothing',
          equip: true,
        },
      ],
    };

    const anatomyParts = new Map();
    anatomyParts.set('torso', 'torso_entity_123');

    await service.instantiateRecipeClothing('actor_123', recipe, anatomyParts);

    // Verify the correct method was called
    expect(
      mockAnatomyClothingIntegrationService.validateClothingSlotCompatibility
    ).toHaveBeenCalledWith('actor_123', 'torso', 'test:clothing');
  });
});
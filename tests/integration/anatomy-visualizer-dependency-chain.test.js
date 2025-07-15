/**
 * @file Integration test for anatomy visualizer dependency chain
 * Ensures all services can be properly instantiated without the resolveClothingSlot error
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SlotResolver from '../../src/anatomy/integration/SlotResolver.js';
import { createMockLogger } from '../common/mockFactories/loggerMocks.js';

describe('Anatomy Visualizer - Dependency Chain Integration', () => {
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let mockAnatomyBlueprintRepository;
  let mockAnatomySocketIndex;
  let mockCache;
  let slotResolver;

  beforeEach(() => {
    // Create mocks for the minimal dependencies needed by SlotResolver
    mockLogger = createMockLogger();

    mockEntityManager = {
      getComponentData: jest.fn().mockResolvedValue({ recipeId: 'human_base' }),
      hasComponent: jest.fn().mockReturnValue(true),
    };

    mockBodyGraphService = {
      getBodyGraph: jest.fn().mockResolvedValue({
        getConnectedParts: jest.fn().mockReturnValue([]),
      }),
    };

    mockAnatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn().mockResolvedValue({
        id: 'human_base',
        slots: {
          'torso.chest': {
            socket: 'chest',
            type: 'torso',
          },
        },
        clothingSlotMappings: {
          'torso.chest': {
            blueprintSlots: ['torso.chest'],
          },
        },
      }),
    };

    mockAnatomySocketIndex = {
      findEntityWithSocket: jest.fn().mockResolvedValue('torso_entity'),
    };

    mockCache = {
      get: jest.fn().mockReturnValue(undefined),
      set: jest.fn(),
      clearType: jest.fn(),
    };

    // Create SlotResolver instance
    slotResolver = new SlotResolver({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      anatomySocketIndex: mockAnatomySocketIndex,
      cache: mockCache,
    });
  });

  it('should successfully create SlotResolver with resolveClothingSlot method', () => {
    // Verify the SlotResolver was created successfully
    expect(slotResolver).toBeDefined();
    expect(typeof slotResolver.resolveClothingSlot).toBe('function');
    expect(typeof slotResolver.resolve).toBe('function');
    expect(typeof slotResolver.setSlotEntityMappings).toBe('function');
  });

  it('should allow resolveClothingSlot to be called without errors', async () => {
    // This tests that the resolveClothingSlot method exists and can be called
    // This was the original issue - the method was missing
    const result = await slotResolver.resolveClothingSlot(
      'test_entity',
      'torso.chest'
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({
      entityId: 'torso_entity',
      socketId: 'chest',
      slotPath: 'torso.chest',
    });
  });

  it('should validate that resolveClothingSlot method is accessible for dependency injection', () => {
    // This ensures that when ClothingInstantiationService receives a SlotResolver instance,
    // it will have the resolveClothingSlot method available
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(slotResolver)
    );
    expect(methods).toContain('resolveClothingSlot');

    // Also verify the method is actually callable
    // Note: This is an async method, so we just verify it exists and is callable
    // The actual execution test is in the next test case
    expect(typeof slotResolver.resolveClothingSlot).toBe('function');
  });

  it('should throw error for unknown clothing slots', async () => {
    // Mock to return no blueprint slots
    mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue({
      slots: {},
      clothingSlotMappings: {},
    });

    // Verify that unknown slots throw the expected error
    await expect(
      slotResolver.resolveClothingSlot('test_entity', 'unknown_slot')
    ).rejects.toThrow('Clothing slot \'unknown_slot\' not found');
  });

  it('should demonstrate that the dependency chain issue is resolved', () => {
    // The original error was:
    // "Invalid or missing method 'resolveClothingSlot' on dependency 'slotResolver'"
    // This test confirms the method exists and is properly implemented

    const slotResolverInterface = {
      resolve: expect.any(Function),
      resolveClothingSlot: expect.any(Function),
      setSlotEntityMappings: expect.any(Function),
      clearCache: expect.any(Function),
      addStrategy: expect.any(Function),
      getStrategyCount: expect.any(Function),
    };

    // Verify all expected methods are present
    for (const [method, matcher] of Object.entries(slotResolverInterface)) {
      expect(typeof slotResolver[method]).toBe('function');
    }
  });
});

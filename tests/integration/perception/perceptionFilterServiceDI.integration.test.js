/**
 * @file Integration test for PerceptionFilterService DI instantiation
 * @description Verifies that PerceptionFilterService can be properly instantiated
 * via the DI container with real LightingStateService. This test reproduces
 * the runtime error: "Invalid or missing method 'getLightingState' on dependency
 * 'ILightingStateService'" that occurred during action execution.
 * @see tickets/SENAWAPEREVE-005-perception-filter-service.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import PerceptionFilterService from '../../../src/perception/services/perceptionFilterService.js';
import { LightingStateService } from '../../../src/locations/services/lightingStateService.js';

describe('PerceptionFilterService DI Integration', () => {
  let mockLogger;
  let mockEntityManager;
  let mockSensoryCapabilityService;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest.fn().mockReturnValue(null),
    };

    mockSensoryCapabilityService = {
      getSensoryCapabilities: jest.fn().mockReturnValue({
        canSee: true,
        canHear: true,
        canSmell: true,
        canFeel: true,
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor validation with real LightingStateService', () => {
    it('should successfully instantiate with real LightingStateService', () => {
      // Arrange - Create real LightingStateService instance
      const lightingStateService = new LightingStateService({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      // Act & Assert - Should not throw
      expect(() => {
        new PerceptionFilterService({
          sensoryCapabilityService: mockSensoryCapabilityService,
          lightingStateService: lightingStateService,
          logger: mockLogger,
        });
      }).not.toThrow();
    });

    it('should use getLocationLightingState method from LightingStateService', () => {
      // Arrange
      const lightingStateService = new LightingStateService({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      const perceptionFilterService = new PerceptionFilterService({
        sensoryCapabilityService: mockSensoryCapabilityService,
        lightingStateService: lightingStateService,
        logger: mockLogger,
      });

      // Act - Call filterEventForRecipients which uses the lighting service
      const eventData = {
        perception_type: 'movement.arrival',
        description_text: 'Someone arrives.',
      };

      perceptionFilterService.filterEventForRecipients(
        eventData,
        ['recipient1'],
        'location1',
        'actor1'
      );

      // Assert - Verify that getLocationLightingState was called (via entityManager)
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        'location1',
        'locations:naturally_dark'
      );
    });

    it('should correctly interpret lighting state from LightingStateService return value', () => {
      // Arrange - Location that is naturally dark with no light sources
      mockEntityManager.hasComponent.mockReturnValue(true); // naturally_dark = true
      mockEntityManager.getComponentData.mockReturnValue({ sources: [] }); // no light sources

      const lightingStateService = new LightingStateService({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      const perceptionFilterService = new PerceptionFilterService({
        sensoryCapabilityService: mockSensoryCapabilityService,
        lightingStateService: lightingStateService,
        logger: mockLogger,
      });

      // Act - Visual event in dark location
      const eventData = {
        perception_type: 'movement.arrival',
        description_text: 'Someone arrives.',
        alternate_descriptions: {
          auditory: 'You hear footsteps.',
        },
      };

      // Mock that recipient can hear but not see in the dark
      mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue({
        canSee: true, // has vision capability
        canHear: true,
        canSmell: false,
        canFeel: true,
      });

      const results = perceptionFilterService.filterEventForRecipients(
        eventData,
        ['recipient1'],
        'dark_location',
        'actor1'
      );

      // Assert - In dark location, visual perception should fail, auditory should work
      expect(results).toHaveLength(1);
      expect(results[0].canPerceive).toBe(true);
      expect(results[0].sense).toBe('auditory');
      expect(results[0].descriptionText).toBe('You hear footsteps.');
    });

    it('should handle lit location correctly', () => {
      // Arrange - Location that is NOT naturally dark (ambient light)
      mockEntityManager.hasComponent.mockReturnValue(false); // naturally_dark = false

      const lightingStateService = new LightingStateService({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });

      const perceptionFilterService = new PerceptionFilterService({
        sensoryCapabilityService: mockSensoryCapabilityService,
        lightingStateService: lightingStateService,
        logger: mockLogger,
      });

      // Act - Visual event in lit location
      const eventData = {
        perception_type: 'movement.arrival',
        description_text: 'Someone arrives.',
      };

      const results = perceptionFilterService.filterEventForRecipients(
        eventData,
        ['recipient1'],
        'lit_location',
        'actor1'
      );

      // Assert - In lit location, visual perception should work
      expect(results).toHaveLength(1);
      expect(results[0].canPerceive).toBe(true);
      expect(results[0].sense).toBe('visual');
      expect(results[0].descriptionText).toBe('Someone arrives.');
    });
  });
});

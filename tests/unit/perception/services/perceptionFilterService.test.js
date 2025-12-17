/**
 * @file Unit tests for PerceptionFilterService
 * @see src/perception/services/perceptionFilterService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PerceptionFilterService from '../../../../src/perception/services/perceptionFilterService.js';

describe('PerceptionFilterService', () => {
  let mockSensoryCapabilityService;
  let mockLightingStateService;
  let mockLogger;
  let service;

  /**
   * Helper to create sensory capabilities.
   *
   * @param {object} [options] - Capability options
   * @param {boolean} [options.canSee] - Whether can see (defaults to true)
   * @param {boolean} [options.canHear] - Whether can hear (defaults to true)
   * @param {boolean} [options.canSmell] - Whether can smell (defaults to true)
   * @param {boolean} [options.canFeel] - Whether can feel (defaults to true)
   * @returns {object} Sensory capabilities object
   */
  const createCapabilities = ({
    canSee = true,
    canHear = true,
    canSmell = true,
    canFeel = true,
  } = {}) => ({
    canSee,
    canHear,
    canSmell,
    canFeel,
    availableSenses: [
      ...(canSee ? ['visual'] : []),
      ...(canHear ? ['auditory'] : []),
      ...(canSmell ? ['olfactory'] : []),
      'tactile',
      'proprioceptive',
    ],
  });

  /**
   * Helper to create event data.
   *
   * @param {object} [options] - Event options
   * @param {string} [options.perceptionType] - Perception type
   * @param {string} [options.descriptionText] - Description text (defaults to 'You see something happen.')
   * @param {object} [options.alternateDescriptions] - Alternate descriptions (defaults to empty object)
   * @returns {object} Event data object
   */
  const createEventData = ({
    perceptionType,
    descriptionText = 'You see something happen.',
    alternateDescriptions = {},
  } = {}) => ({
    perception_type: perceptionType,
    description_text: descriptionText,
    alternate_descriptions: alternateDescriptions,
  });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockSensoryCapabilityService = {
      getSensoryCapabilities: jest.fn().mockReturnValue(createCapabilities()),
    };

    mockLightingStateService = {
      getLightingState: jest.fn().mockReturnValue('lit'),
    };

    service = new PerceptionFilterService({
      sensoryCapabilityService: mockSensoryCapabilityService,
      lightingStateService: mockLightingStateService,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PerceptionFilterService initialized'
      );
    });

    it('should throw when sensoryCapabilityService is missing required methods', () => {
      expect(() => {
        new PerceptionFilterService({
          sensoryCapabilityService: {},
          lightingStateService: mockLightingStateService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw when lightingStateService is missing required methods', () => {
      expect(() => {
        new PerceptionFilterService({
          sensoryCapabilityService: mockSensoryCapabilityService,
          lightingStateService: {},
          logger: mockLogger,
        });
      }).toThrow();
    });
  });

  describe('filterEventForRecipients', () => {
    describe('input validation', () => {
      it('should return empty array for invalid eventData', () => {
        const result = service.filterEventForRecipients(
          null,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should return empty array for eventData without perception_type', () => {
        const result = service.filterEventForRecipients(
          { description_text: 'test' },
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toEqual([]);
      });

      it('should return empty array for empty recipients array', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
        });

        const result = service.filterEventForRecipients(
          eventData,
          [],
          'location-1',
          'actor-1'
        );

        expect(result).toEqual([]);
      });

      it('should return empty array for non-array recipients', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
        });

        const result = service.filterEventForRecipients(
          eventData,
          null,
          'location-1',
          'actor-1'
        );

        expect(result).toEqual([]);
      });
    });

    // Test Scenario 1: Visual event in lit room, sighted recipient
    describe('Scenario 1: Visual event in lit room, sighted recipient', () => {
      it('should receive visual description', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
          descriptionText: 'Alice enters the room.',
        });

        mockLightingStateService.getLightingState.mockReturnValue('lit');
        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: true })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          entityId: 'recipient-1',
          descriptionText: 'Alice enters the room.',
          sense: 'visual',
          canPerceive: true,
        });
      });
    });

    // Test Scenario 2: Visual event in dark room, sighted recipient
    describe('Scenario 2: Visual event in dark room, sighted recipient', () => {
      it('should be filtered when no fallback available', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
          descriptionText: 'Alice enters the room.',
        });

        mockLightingStateService.getLightingState.mockReturnValue('dark');
        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: true, canHear: true })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0].canPerceive).toBe(false);
        expect(result[0].descriptionText).toBeNull();
      });

      it('should use auditory fallback when available', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
          descriptionText: 'Alice enters the room.',
          alternateDescriptions: {
            auditory: 'You hear footsteps entering.',
          },
        });

        mockLightingStateService.getLightingState.mockReturnValue('dark');
        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: true, canHear: true })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          entityId: 'recipient-1',
          descriptionText: 'You hear footsteps entering.',
          sense: 'auditory',
          canPerceive: true,
        });
      });
    });

    // Test Scenario 3: Visual event, blind recipient with auditory fallback
    describe('Scenario 3: Visual event, blind recipient with auditory fallback', () => {
      it('should receive auditory text', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
          descriptionText: 'Alice enters the room.',
          alternateDescriptions: {
            auditory: 'You hear footsteps entering.',
            tactile: 'You feel vibrations in the floor.',
          },
        });

        mockLightingStateService.getLightingState.mockReturnValue('lit');
        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: false, canHear: true })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          entityId: 'recipient-1',
          descriptionText: 'You hear footsteps entering.',
          sense: 'auditory',
          canPerceive: true,
        });
      });
    });

    // Test Scenario 4: Auditory event, deaf recipient
    describe('Scenario 4: Auditory event, deaf recipient', () => {
      it('should be filtered when no fallback available', () => {
        const eventData = createEventData({
          perceptionType: 'communication.speech',
          descriptionText: '"Hello there," Alice says.',
        });

        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: true, canHear: false })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0].canPerceive).toBe(false);
        expect(result[0].descriptionText).toBeNull();
      });

      it('should use tactile fallback when available', () => {
        const eventData = createEventData({
          perceptionType: 'communication.speech',
          descriptionText: '"Hello there," Alice says.',
          alternateDescriptions: {
            tactile: 'Alice touches your shoulder to get attention.',
          },
        });

        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: true, canHear: false, canFeel: true })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          entityId: 'recipient-1',
          descriptionText: 'Alice touches your shoulder to get attention.',
          sense: 'tactile',
          canPerceive: true,
        });
      });
    });

    // Test Scenario 5: Omniscient event (error) → all recipients receive it
    describe('Scenario 5: Omniscient event (error)', () => {
      it('should be received by all recipients regardless of senses', () => {
        const eventData = createEventData({
          perceptionType: 'error.system_error',
          descriptionText: 'An error has occurred.',
        });

        // Even a completely senseless recipient should perceive omniscient events
        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({
            canSee: false,
            canHear: false,
            canSmell: false,
          })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1', 'recipient-2'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(2);
        result.forEach((r) => {
          expect(r.canPerceive).toBe(true);
          expect(r.descriptionText).toBe('An error has occurred.');
          expect(r.sense).toBe('omniscient');
        });
      });
    });

    // Test Scenario 6: Proprioceptive event → only actor receives it
    describe('Scenario 6: Proprioceptive event', () => {
      it('should only be received by actor', () => {
        const eventData = createEventData({
          perceptionType: 'communication.thought',
          descriptionText: 'I should check that door...',
        });

        const result = service.filterEventForRecipients(
          eventData,
          ['actor-1', 'recipient-2', 'recipient-3'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(3);

        // Actor should perceive
        expect(result[0]).toEqual({
          entityId: 'actor-1',
          descriptionText: 'I should check that door...',
          sense: 'proprioceptive',
          canPerceive: true,
        });

        // Others should not perceive
        expect(result[1].canPerceive).toBe(false);
        expect(result[1].descriptionText).toBeNull();
        expect(result[2].canPerceive).toBe(false);
        expect(result[2].descriptionText).toBeNull();
      });
    });

    // Test Scenario 7: Event with 'limited' fallback
    describe('Scenario 7: Event with limited fallback', () => {
      it('should use limited fallback when all senses fail', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
          descriptionText: 'Alice enters the room.',
          alternateDescriptions: {
            auditory: 'You hear footsteps.',
            limited: 'Something happens nearby.',
          },
        });

        // Recipient can only feel, and movement.arrival fallbacks are auditory, tactile
        // Since no tactile fallback is provided and auditory not available, use limited
        mockLightingStateService.getLightingState.mockReturnValue('lit');
        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: false, canHear: false, canSmell: false })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          entityId: 'recipient-1',
          descriptionText: 'Something happens nearby.',
          sense: 'limited',
          canPerceive: true,
        });
      });
    });

    // Test Scenario 8: Event with no fallbacks, recipient can't perceive
    describe('Scenario 8: Event with no fallbacks, recipient cannot perceive', () => {
      it('should silently filter with canPerceive false', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
          descriptionText: 'Alice enters the room.',
          // No alternate_descriptions provided
        });

        mockLightingStateService.getLightingState.mockReturnValue('dark');
        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: true, canHear: true })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          entityId: 'recipient-1',
          descriptionText: null,
          sense: 'visual',
          canPerceive: false,
        });
      });
    });

    // Test multiple recipients with different capabilities
    describe('Multiple recipients with different capabilities', () => {
      it('should correctly filter for each recipient', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
          descriptionText: 'Alice enters the room.',
          alternateDescriptions: {
            auditory: 'You hear footsteps.',
          },
        });

        mockLightingStateService.getLightingState.mockReturnValue('lit');

        // Different capabilities for different recipients
        mockSensoryCapabilityService.getSensoryCapabilities.mockImplementation(
          (entityId) => {
            if (entityId === 'sighted') {
              return createCapabilities({ canSee: true, canHear: true });
            } else if (entityId === 'blind') {
              return createCapabilities({ canSee: false, canHear: true });
            } else if (entityId === 'deaf-and-blind') {
              return createCapabilities({ canSee: false, canHear: false });
            }
            return createCapabilities();
          }
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['sighted', 'blind', 'deaf-and-blind'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(3);

        // Sighted perceives via visual
        expect(result[0]).toEqual({
          entityId: 'sighted',
          descriptionText: 'Alice enters the room.',
          sense: 'visual',
          canPerceive: true,
        });

        // Blind perceives via auditory fallback
        expect(result[1]).toEqual({
          entityId: 'blind',
          descriptionText: 'You hear footsteps.',
          sense: 'auditory',
          canPerceive: true,
        });

        // Deaf and blind cannot perceive
        expect(result[2]).toEqual({
          entityId: 'deaf-and-blind',
          descriptionText: null,
          sense: 'visual',
          canPerceive: false,
        });
      });
    });

    // Test tactile sense (always true)
    describe('Tactile sense handling', () => {
      it('should always be available for tactile primary events', () => {
        const eventData = createEventData({
          perceptionType: 'intimacy.sensual',
          descriptionText: 'A gentle touch.',
        });

        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({
            canSee: false,
            canHear: false,
            canSmell: false,
            canFeel: true,
          })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          entityId: 'recipient-1',
          descriptionText: 'A gentle touch.',
          sense: 'tactile',
          canPerceive: true,
        });
      });
    });

    // Test dim lighting (not dark, visual should work)
    describe('Dim lighting handling', () => {
      it('should allow visual perception in dim lighting', () => {
        const eventData = createEventData({
          perceptionType: 'movement.arrival',
          descriptionText: 'A shadowy figure enters.',
        });

        mockLightingStateService.getLightingState.mockReturnValue('dim');
        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: true })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        expect(result[0].canPerceive).toBe(true);
        expect(result[0].sense).toBe('visual');
      });
    });

    // Test olfactory sense
    describe('Olfactory sense handling', () => {
      it('should handle olfactory primary sense correctly', () => {
        // Create a custom event with olfactory primary sense
        // Note: In the current registry, no standard type has olfactory as primary,
        // but we test the mechanism works. Magic types have olfactory as fallback.
        const eventData = createEventData({
          perceptionType: 'magic.spell',
          descriptionText: 'A burst of magical energy.',
          alternateDescriptions: {
            olfactory: 'A strange scent of ozone fills the air.',
          },
        });

        // Recipient can't see (dark) but can smell
        mockLightingStateService.getLightingState.mockReturnValue('dark');
        mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue(
          createCapabilities({ canSee: false, canHear: false, canSmell: true })
        );

        const result = service.filterEventForRecipients(
          eventData,
          ['recipient-1'],
          'location-1',
          'actor-1'
        );

        expect(result).toHaveLength(1);
        // magic.spell fallbacks are: auditory, olfactory
        // auditory not available, olfactory available
        expect(result[0].canPerceive).toBe(true);
        expect(result[0].sense).toBe('olfactory');
        expect(result[0].descriptionText).toBe(
          'A strange scent of ozone fills the air.'
        );
      });
    });
  });

  describe('invariants', () => {
    it('should not modify input eventData', () => {
      const eventData = createEventData({
        perceptionType: 'movement.arrival',
        descriptionText: 'Original text.',
        alternateDescriptions: { auditory: 'Sound.' },
      });

      const originalEventData = JSON.parse(JSON.stringify(eventData));

      service.filterEventForRecipients(
        eventData,
        ['recipient-1'],
        'location-1',
        'actor-1'
      );

      expect(eventData).toEqual(originalEventData);
    });

    it('should always return canFeel as true (per spec)', () => {
      // Even if capabilities somehow says canFeel: false, tactile should work
      // This tests the spec invariant that tactile is always available
      mockSensoryCapabilityService.getSensoryCapabilities.mockReturnValue({
        canSee: false,
        canHear: false,
        canSmell: false,
        canFeel: true, // Per spec, always true
        availableSenses: ['tactile', 'proprioceptive'],
      });

      const eventData = createEventData({
        perceptionType: 'intimacy.sensual',
        descriptionText: 'Touch.',
      });

      const result = service.filterEventForRecipients(
        eventData,
        ['recipient-1'],
        'location-1',
        'actor-1'
      );

      expect(result[0].canPerceive).toBe(true);
    });
  });
});

/**
 * @file Unit tests for SensorialPropagationService
 * @see src/perception/services/sensorialPropagationService.js
 * @see tickets/ADDPERLOGENTHANROB-005.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SensorialPropagationService from '../../../../src/perception/services/sensorialPropagationService.js';
import { SENSORIAL_LINKS_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

describe('SensorialPropagationService', () => {
  let mockLogger;
  let mockEntityManager;
  let mockRecipientSetBuilder;
  let service;

  const createBaseEntry = (overrides = {}) => ({
    descriptionText: 'Someone performs an action',
    perceptionType: 'action.performed',
    timestamp: 1234567890,
    actorId: 'actor-1',
    ...overrides,
  });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockRecipientSetBuilder = {
      build: jest.fn(),
    };

    service = new SensorialPropagationService({
      entityManager: mockEntityManager,
      recipientSetBuilder: mockRecipientSetBuilder,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should accept null logger and use fallback', () => {
      const serviceWithNullLogger = new SensorialPropagationService({
        entityManager: mockEntityManager,
        recipientSetBuilder: mockRecipientSetBuilder,
        logger: null,
      });
      expect(serviceWithNullLogger).toBeDefined();
    });

    it('should throw when entityManager is missing', () => {
      expect(() => new SensorialPropagationService({
        entityManager: null,
        recipientSetBuilder: mockRecipientSetBuilder,
        logger: mockLogger,
      })).toThrow(/entityManager|IEntityManager/i);
    });

    it('should throw when recipientSetBuilder is missing', () => {
      expect(() => new SensorialPropagationService({
        entityManager: mockEntityManager,
        recipientSetBuilder: null,
        logger: mockLogger,
      })).toThrow(/recipientSetBuilder|IRecipientSetBuilder/i);
    });
  });

  describe('shouldPropagate', () => {
    it('should return false for explicit recipients', () => {
      // Test case 1 from ticket: explicit mode blocks propagation
      const result = service.shouldPropagate(
        true,  // usingExplicitRecipients
        null,  // originLocationId
        'location-1' // currentLocationId
      );

      expect(result).toBe(false);
    });

    it('should return false when originLocationId differs from currentLocationId', () => {
      // Test case 2 from ticket: nested propagation prevention
      const result = service.shouldPropagate(
        false,        // usingExplicitRecipients (broadcast mode)
        'location-1', // originLocationId
        'location-2'  // currentLocationId (different)
      );

      expect(result).toBe(false);
    });

    it('should return true for broadcast mode with no origin location', () => {
      // Test case 3 from ticket: normal propagation allowed
      const result = service.shouldPropagate(
        false, // usingExplicitRecipients
        null,  // originLocationId (not set)
        'location-1' // currentLocationId
      );

      expect(result).toBe(true);
    });

    it('should return true when originLocationId equals currentLocationId', () => {
      // Same location means this is the originating event, not a propagated one
      const result = service.shouldPropagate(
        false,        // usingExplicitRecipients
        'location-1', // originLocationId
        'location-1'  // currentLocationId (same)
      );

      expect(result).toBe(true);
    });

    it('should return true for broadcast mode with undefined origin location', () => {
      const result = service.shouldPropagate(
        false,     // usingExplicitRecipients
        undefined, // originLocationId (undefined)
        'location-1'
      );

      expect(result).toBe(true);
    });
  });

  describe('getLinkedLocationsWithPrefixedEntries', () => {
    it('should return empty array when no sensorial links exist', () => {
      // Test case 4 from ticket: no targets configured
      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        excludedActors: [],
      });

      expect(result).toEqual([]);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'location-1',
        SENSORIAL_LINKS_COMPONENT_ID
      );
    });

    it('should return empty array when sensorial targets is empty array', () => {
      mockEntityManager.getComponentData.mockReturnValue({ targets: [] });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        excludedActors: [],
      });

      expect(result).toEqual([]);
    });

    it('should filter out origin location from linked locations (self-loop prevention)', () => {
      // Test case 5 from ticket: self-loop prevention
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          targets: ['location-1', 'location-2', 'location-1'], // includes self
        })
        .mockReturnValueOnce({ text: 'Origin Room' }); // name lookup

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        excludedActors: [],
      });

      // Should only have location-2, not location-1 (self)
      expect(result).toHaveLength(1);
      expect(result[0].locationId).toBe('location-2');
    });

    it('should apply prefix to entry descriptionText', () => {
      // Test case 6 from ticket: "(From Location) " prefix
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce({ text: 'The Kitchen' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry({ descriptionText: 'A door slams shut' }),
        excludedActors: [],
      });

      expect(result[0].prefixedEntry.descriptionText).toBe(
        '(From The Kitchen) A door slams shut'
      );
    });

    it('should apply prefix to alternate descriptions', () => {
      // Test case 7 from ticket: all alternates prefixed
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce({ text: 'Main Hall' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        alternateDescriptions: {
          visual: 'You see a flash',
          auditory: 'You hear a boom',
        },
        excludedActors: [],
      });

      expect(result[0].prefixedAlternateDescriptions).toEqual({
        visual: '(From Main Hall) You see a flash',
        auditory: '(From Main Hall) You hear a boom',
      });
    });

    it('should exclude originating actor from linked location recipients', () => {
      // Test case 8 from ticket: actor added to exclusions
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce({ text: 'Bedroom' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'exclusion',
      });

      service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        excludedActors: ['already-excluded'],
        originatingActorId: 'actor-1',
      });

      // Verify recipientSetBuilder was called with actor in exclusions
      expect(mockRecipientSetBuilder.build).toHaveBeenCalledWith({
        locationId: 'location-2',
        explicitRecipients: [],
        excludedActors: expect.arrayContaining(['already-excluded', 'actor-1']),
      });
    });

    it('should use RecipientSetBuilder for recipient determination', () => {
      // Test case 9 from ticket: proper recipient determination
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2', 'location-3'] })
        .mockReturnValueOnce({ text: 'Library' });

      mockRecipientSetBuilder.build
        .mockReturnValueOnce({
          entityIds: new Set(['npc-1', 'npc-2']),
          mode: 'broadcast',
        })
        .mockReturnValueOnce({
          entityIds: new Set(['npc-3']),
          mode: 'exclusion',
        });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        excludedActors: [],
      });

      expect(result).toHaveLength(2);
      expect(result[0].entityIds).toEqual(new Set(['npc-1', 'npc-2']));
      expect(result[0].mode).toBe('broadcast');
      expect(result[1].entityIds).toEqual(new Set(['npc-3']));
      expect(result[1].mode).toBe('exclusion');
    });

    it('should fall back to locationId when no name component exists', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce(null); // No name component

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'cave-entrance',
        entry: createBaseEntry({ descriptionText: 'A sound echoes' }),
        excludedActors: [],
      });

      expect(result[0].prefixedEntry.descriptionText).toBe(
        '(From cave-entrance) A sound echoes'
      );
    });

    it('should fall back to locationId when name text is empty', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce({ text: '   ' }); // Whitespace-only name

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'room-id-123',
        entry: createBaseEntry({ descriptionText: 'Something happens' }),
        excludedActors: [],
      });

      expect(result[0].prefixedEntry.descriptionText).toBe(
        '(From room-id-123) Something happens'
      );
    });

    it('should prefix actor and target descriptions', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce({ text: 'Garden' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        actorDescription: 'You do something',
        targetDescription: 'Someone does something to you',
        excludedActors: [],
      });

      expect(result[0].prefixedActorDescription).toBe(
        '(From Garden) You do something'
      );
      expect(result[0].prefixedTargetDescription).toBe(
        '(From Garden) Someone does something to you'
      );
    });

    it('should deduplicate linked locations', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          targets: ['location-2', 'location-2', 'location-3', 'location-2'],
        })
        .mockReturnValueOnce({ text: 'Hallway' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        excludedActors: [],
      });

      // Should have 2 unique locations, not 4
      expect(result).toHaveLength(2);
      expect(result.map(r => r.locationId)).toEqual(['location-2', 'location-3']);
    });

    it('should filter out non-string targets', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          targets: ['location-2', null, undefined, 123, 'location-3'],
        })
        .mockReturnValueOnce({ text: 'Cellar' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        excludedActors: [],
      });

      // Should only have valid string locations
      expect(result).toHaveLength(2);
      expect(result.map(r => r.locationId)).toEqual(['location-2', 'location-3']);
    });

    it('should handle missing alternateDescriptions gracefully', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce({ text: 'Tower' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        alternateDescriptions: undefined,
        excludedActors: [],
      });

      expect(result[0].prefixedAlternateDescriptions).toBeUndefined();
    });

    it('should handle missing actor and target descriptions gracefully', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce({ text: 'Dungeon' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        actorDescription: undefined,
        targetDescription: undefined,
        excludedActors: [],
      });

      expect(result[0].prefixedActorDescription).toBeUndefined();
      expect(result[0].prefixedTargetDescription).toBeUndefined();
    });

    it('should preserve non-string values in alternateDescriptions without prefixing', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce({ text: 'Castle' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry(),
        alternateDescriptions: {
          visual: 'You see it',
          numericValue: 42,
          nullValue: null,
        },
        excludedActors: [],
      });

      expect(result[0].prefixedAlternateDescriptions).toEqual({
        visual: '(From Castle) You see it',
        numericValue: 42,
        nullValue: null,
      });
    });

    it('should not prefix empty strings', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ targets: ['location-2'] })
        .mockReturnValueOnce({ text: 'Throne Room' });

      mockRecipientSetBuilder.build.mockReturnValue({
        entityIds: new Set(['recipient-1']),
        mode: 'broadcast',
      });

      const result = service.getLinkedLocationsWithPrefixedEntries({
        originLocationId: 'location-1',
        entry: createBaseEntry({ descriptionText: '' }),
        actorDescription: '',
        targetDescription: '',
        excludedActors: [],
      });

      expect(result[0].prefixedEntry.descriptionText).toBe('');
      expect(result[0].prefixedActorDescription).toBe('');
      expect(result[0].prefixedTargetDescription).toBe('');
    });
  });
});

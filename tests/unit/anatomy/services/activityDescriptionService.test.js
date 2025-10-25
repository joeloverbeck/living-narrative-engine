import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ActivityDescriptionService from '../../../../src/anatomy/services/activityDescriptionService.js';

describe('ActivityDescriptionService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockAnatomyFormattingService;
  let mockActivityIndex;

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn((id) => ({
        id,
        name: `Entity ${id}`,
      })),
      getComponentData: jest.fn(),
    };

    mockAnatomyFormattingService = {
      getActivityIntegrationConfig: jest.fn().mockReturnValue({
        enabled: true,
        prefix: 'Activity: ',
        suffix: '.',
      }),
    };

    mockActivityIndex = {
      findActivitiesForEntity: jest.fn().mockReturnValue([]),
    };

    // Create service instance
    service = new ActivityDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      anatomyFormattingService: mockAnatomyFormattingService,
      activityIndex: mockActivityIndex,
    });
  });

  describe('Constructor', () => {
    it('should validate logger dependency', () => {
      expect(() => new ActivityDescriptionService({
        logger: null,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
      })).not.toThrow(); // ensureValidLogger provides fallback
    });

    it('should validate entityManager dependency', () => {
      expect(() => new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: null,
        anatomyFormattingService: mockAnatomyFormattingService,
      })).toThrow(/Missing required dependency.*IEntityManager/);
    });

    it('should validate anatomyFormattingService dependency', () => {
      expect(() => new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: null,
      })).toThrow(/Missing required dependency.*AnatomyFormattingService/);
    });

    it('should validate entityManager has required methods', () => {
      const invalidEntityManager = {
        // missing getEntityInstance method
        someOtherMethod: jest.fn(),
      };

      expect(() => new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: invalidEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
      })).toThrow(/Invalid or missing method.*getEntityInstance/);
    });

    it('should accept optional activityIndex parameter', () => {
      const mockActivityIndex = {
        findActivitiesForEntity: jest.fn(),
      };

      const serviceWithIndex = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        activityIndex: mockActivityIndex,
      });

      expect(serviceWithIndex).toBeDefined();
    });

    it('should default activityIndex to null when not provided', () => {
      const serviceWithoutIndex = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
      });

      expect(serviceWithoutIndex).toBeDefined();
    });
  });

  describe('generateActivityDescription', () => {
    it('should validate entityId parameter', async () => {
      await expect(
        service.generateActivityDescription('')
      ).rejects.toThrow(/Invalid entityId/);

      await expect(
        service.generateActivityDescription(null)
      ).rejects.toThrow(/Invalid entityId/);

      await expect(
        service.generateActivityDescription(undefined)
      ).rejects.toThrow(/Invalid entityId/);

      await expect(
        service.generateActivityDescription('   ')
      ).rejects.toThrow(/Invalid entityId/);
    });

    it('should return empty string when no activities found', async () => {
      const result = await service.generateActivityDescription('entity_1');
      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No activities found for entity: entity_1')
      );
    });

    it('should log debug information at start', async () => {
      await service.generateActivityDescription('entity_1');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Generating activity description for entity: entity_1')
      );
    });

    it('should format the highest priority visible activity', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          verb: 'kneels before',
          targetId: 'entity_2',
          priority: 1,
          condition: () => true,
        },
        {
          actorId: 'entity_1',
          verb: 'stands near',
          targetId: 'entity_3',
          priority: 5,
        },
        {
          actorId: 'entity_1',
          visible: false,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity_1') {
          return { id, displayName: 'Jon Ureña' };
        }
        if (id === 'entity_2') {
          return { id, displayName: 'Alicia Western' };
        }
        if (id === 'entity_3') {
          return { id, displayName: 'Dylan' };
        }
        return { id, name: `Entity ${id}` };
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: Jon Ureña stands near Dylan.');
      expect(mockActivityIndex.findActivitiesForEntity).toHaveBeenCalledWith(
        'entity_1'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('entity_3');
    });

    it('should return empty string when filtering removes all activities', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          visible: false,
        },
        {
          actorId: 'entity_1',
          condition: () => false,
        },
        {
          actorId: 'entity_1',
          condition: () => {
            throw new Error('bad condition');
          },
        },
      ]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'No visible activities available after filtering for entity: entity_1'
        )
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Condition evaluation failed for activity description entry',
        expect.any(Error)
      );
    });

    it('should return empty string when formatting produces no description', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          priority: 10,
        },
      ]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'No formatted activity description produced for entity: entity_1'
        )
      );
    });

    it('should handle non-array metadata from index gracefully', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue({ invalid: true });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Activity index returned invalid data for entity entity_1')
      );
    });

    it('should handle metadata retrieval errors gracefully', async () => {
      mockActivityIndex.findActivitiesForEntity.mockImplementation(() => {
        throw new Error('Index failure');
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to collect activity metadata for entity entity_1',
        expect.any(Error)
      );
    });

    it('should discard falsy activities returned by the index', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        null,
        undefined,
        false,
        {
          actorId: 'entity_1',
          verb: 'greets',
          targetId: 'entity_2',
        },
      ]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: Entity entity_1 greets Entity entity_2.');
      expect(mockActivityIndex.findActivitiesForEntity).toHaveBeenCalledWith(
        'entity_1'
      );
    });

    it('should prioritize entries with the highest priority value', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          verb: 'waits patiently',
          priority: 1,
        },
        {
          actorId: 'entity_1',
          verb: 'takes center stage',
          priority: 10,
        },
        {
          actorId: 'entity_1',
          verb: 'considers the options',
          priority: 5,
        },
      ]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: Entity entity_1 takes center stage.');
    });

    it('should treat missing priority as the lowest weight during sorting', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          verb: 'leads the charge',
          priority: 9,
        },
        {
          actorId: 'entity_1',
          verb: 'lingers near the exit',
        },
        {
          actorId: 'entity_1',
          verb: 'assesses the options',
          priority: 4,
        },
      ]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: Entity entity_1 leads the charge.');
    });

    it('should reuse cached entity names across calls', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          description: 'kneels before',
          targetId: 'entity_2',
          priority: 2,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity_1') {
          return { id, name: 'Jon' };
        }
        if (id === 'entity_2') {
          return { id, name: 'Alicia' };
        }
        return { id, name: id };
      });

      const first = await service.generateActivityDescription('entity_1');
      expect(first).toBe('Activity: Jon kneels before Alicia.');

      await service.generateActivityDescription('entity_1');

      const actorCalls = mockEntityManager.getEntityInstance.mock.calls.filter(
        ([id]) => id === 'entity_1'
      );
      const targetCalls = mockEntityManager.getEntityInstance.mock.calls.filter(
        ([id]) => id === 'entity_2'
      );

      expect(actorCalls.length).toBe(3); // two entity fetches and one cached resolution
      expect(targetCalls.length).toBe(1);
    });

    it('should use description text when provided without a target', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          description: 'leaps across the chasm',
          priority: 4,
        },
      ]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe(
        'Activity: Entity entity_1 leaps across the chasm.'
      );
    });

    it('should fall back to entity id when name resolution fails', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          verb: 'observes',
          targetId: 'missing_entity',
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'missing_entity') {
          throw new Error('not found');
        }
        return { id, name: `Entity ${id}` };
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: Entity entity_1 observes missing_entity.');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to resolve entity name for missing_entity',
        expect.any(Error)
      );
    });

    it('should treat missing priority values as lowest rank', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          verb: 'whispers to',
          targetId: 'entity_2',
          priority: 2,
        },
        {
          actorId: 'entity_1',
          verb: 'glances at',
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity_1') {
          return { id, name: 'Observer' };
        }
        if (id === 'entity_2') {
          return { id, name: 'Subject' };
        }
        return { id, name: id };
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: Observer whispers to Subject.');
    });

    it('should use Unknown entity label when actor id is missing', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          description: 'performs an unknown action',
          priority: 1,
        },
      ]);

      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe(
        'Activity: Unknown entity performs an unknown action.'
      );
    });

    it('should return empty string when no activity index is provided', async () => {
      const serviceWithoutIndex = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
      });

      const result = await serviceWithoutIndex.generateActivityDescription(
        'entity_1'
      );

      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No activities found for entity: entity_1')
      );
    });

    it('should treat missing finder method on the index as no activities', async () => {
      const serviceWithInvalidIndex = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        activityIndex: { findActivitiesForEntity: null },
      });

      const result = await serviceWithInvalidIndex.generateActivityDescription(
        'entity_1'
      );

      expect(result).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No activities found for entity: entity_1')
      );
    });

    it('should handle logger errors gracefully and return empty string', async () => {
      const throwingLogger = {
        ...mockLogger,
        debug: jest.fn(() => {
          throw new Error('Logger failure');
        }),
      };

      const serviceWithThrowingLogger = new ActivityDescriptionService({
        logger: throwingLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        activityIndex: mockActivityIndex,
      });

      const result = await serviceWithThrowingLogger.generateActivityDescription(
        'entity_1'
      );

      expect(result).toBe('');
      expect(throwingLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate activity description for entity entity_1'),
        expect.any(Error)
      );
    });

    it('should fall back to raw entity id when name metadata is absent', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'mystery_actor',
          verb: 'observes',
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'mystery_actor') {
          return { id };
        }
        return { id, name: id };
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: mystery_actor observes.');

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        name: `Entity ${id}`,
      }));
    });

    it('should default to entityId when the entity record is empty', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'faceless_actor',
          verb: 'waits',
          priority: 2,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'faceless_actor') {
          return {};
        }
        return { id, name: `Entity ${id}` };
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: faceless_actor waits.');

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        name: `Entity ${id}`,
      }));
    });

    it('should default to an interaction verb when target is present without verb', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          targetId: 'entity_2',
          priority: 3,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        name: id === 'entity_2' ? 'Target' : `Entity ${id}`,
      }));

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: Entity entity_1 interacts with Target.');

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        name: `Entity ${id}`,
      }));
    });

    it('should honor formatting defaults when config omits prefix and suffix', async () => {
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        enabled: true,
      });

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          verb: 'gestures',
        },
      ]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Entity entity_1 gestures');

      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        enabled: true,
        prefix: 'Activity: ',
        suffix: '.',
      });
    });

    it('should gracefully handle formatting services without configuration getter', async () => {
      const minimalFormattingService = {};
      const lightweightIndex = {
        findActivitiesForEntity: jest.fn().mockReturnValue([
          {
            actorId: 'entity_1',
            verb: 'observes',
          },
        ]),
      };

      const serviceWithoutGetter = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: minimalFormattingService,
        activityIndex: lightweightIndex,
      });

      const result = await serviceWithoutGetter.generateActivityDescription(
        'entity_1'
      );

      expect(result).toBe('Entity entity_1 observes');
      expect(lightweightIndex.findActivitiesForEntity).toHaveBeenCalledWith(
        'entity_1'
      );
    });
  });

  describe('Placeholder Implementation', () => {
    it('should return empty string as placeholder for now', async () => {
      // This test verifies the current placeholder behavior
      // Future tickets (ACTDESC-006, ACTDESC-007, ACTDESC-008) will change this
      const result = await service.generateActivityDescription('entity_1');
      expect(result).toBe('');
    });
  });
});

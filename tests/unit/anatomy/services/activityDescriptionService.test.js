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
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id };
          }
          return undefined;
        }),
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
        const nameMap = {
          'entity_1': 'Jon Ureña',
          'entity_2': 'Alicia Western',
          'entity_3': 'Dylan',
        };
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: nameMap[id] || id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('entity_1');

      // Phase 2: Now processes ALL visible activities, not just highest priority
      expect(result).toBe('Activity: Jon Ureña stands near Dylan. Jon Ureña kneels before Alicia Western.');
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

    it('should return no dedicated activities when metadata component is missing', async () => {
      const dedicatedEntity = {
        id: 'entity_1',
        componentTypeIds: [],
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest
          .fn()
          .mockImplementation((componentId) => {
            if (componentId === 'activity:description_metadata') {
              return null;
            }
            return undefined;
          }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(dedicatedEntity);
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(dedicatedEntity.getComponentData).toHaveBeenCalledWith(
        'activity:description_metadata'
      );
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        'Failed to parse dedicated metadata',
        expect.any(Error)
      );
    });

    it('should log an error when dedicated metadata parsing fails', async () => {
      const dedicatedEntity = {
        id: 'entity_1',
        componentTypeIds: [],
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest
          .fn()
          .mockImplementation((componentId) => {
            if (componentId === 'activity:description_metadata') {
              return {
                sourceComponent: 'pose:stance',
                targetRole: 'entityId',
              };
            }

            if (componentId === 'pose:stance') {
              throw new Error('component failure');
            }

            return undefined;
          }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(dedicatedEntity);
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse dedicated metadata',
        expect.any(Error)
      );
    });

    it('should log an error when inline metadata collection fails', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      mockEntityManager.getEntityInstance
        .mockImplementationOnce(() => ({
          id: 'entity_1',
          componentTypeIds: ['core:name'],
          getComponentData: jest.fn(),
        }))
        .mockImplementationOnce(() => {
          throw new Error('Inline failure');
        });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to collect inline metadata for entity entity_1',
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

      expect(result).toBe('Activity: entity_1 greets entity_2.');
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

      // Phase 2: Processes all activities, highest priority first
      expect(result).toBe('Activity: entity_1 takes center stage. entity_1 considers the options. entity_1 waits patiently.');
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

      // Phase 2: Processes all activities, with missing priority treated as 0 (lowest)
      expect(result).toBe('Activity: entity_1 leads the charge. entity_1 assesses the options. entity_1 lingers near the exit.');
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
        const nameMap = {
          'entity_1': 'Jon',
          'entity_2': 'Alicia',
        };
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: nameMap[id] || id };
            }
            return undefined;
          }),
        };
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

      // After ACTDESC-006 & ACTDESC-007 & ACTDESC-014:
      // Per generateActivityDescription: 3 calls for metadata collection + name resolution + gender detection
      // First call: entity_1 (inline metadata) + entity_1 (dedicated metadata) + entity_1 (name) + entity_1 (gender) = 4
      // Second call: entity_1 (inline metadata) + entity_1 (dedicated metadata) + entity_1 (cached name) + entity_1 (gender) = 4
      // Total for entity_1: 4 + 4 = 8, but first name resolution + 1 cached = 9
      // Context-aware tone evaluation adds closeness lookups per call, resulting in 11 actor fetches
      expect(actorCalls.length).toBe(11);
      // Context-aware tone evaluation performs gender checks per call (no caching yet)
      expect(targetCalls.length).toBe(3);
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
        'Activity: entity_1 leaps across the chasm.'
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
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: entity_1 observes missing_entity.');
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
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Observer' };
              }
              return undefined;
            }),
          };
        }
        if (id === 'entity_2') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Subject' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('entity_1');

      // Phase 2: Processes all activities, with missing priority coming last
      expect(result).toBe('Activity: Observer whispers to Subject. Observer glances at.');
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

    it('should trim whitespace in descriptions and formatting config output', async () => {
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        enabled: true,
        prefix: '  Activity: ',
        suffix: '.   ',
      });

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          description: '  keeps watch  ',
          targetId: 'entity_2',
          priority: 7,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id === 'entity_2' ? 'Perimeter Guard' : id };
          }
          return undefined;
        }),
      }));

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe(
        'Activity: entity_1 keeps watch Perimeter Guard.'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'entity_2'
      );

      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        enabled: true,
        prefix: 'Activity: ',
        suffix: '.',
      });
      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id };
          }
          return undefined;
        }),
      }));
    });

    it('should treat whitespace-only descriptions as empty output', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          description: '   ',
          type: 'inline',
          priority: 3,
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

    it('should treat legacy whitespace descriptions as empty output', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          description: '   ',
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

    it('should ignore legacy activities with whitespace verbs', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          verb: '   ',
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

    it('should fall back to raw entity id when name metadata is absent', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'mystery_actor',
          verb: 'observes',
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity_1') {
          return { id: 'entity_1' };
        }
        if (id === 'mystery_actor') {
          return { id };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('entity_1');

      // Phase 2: Actor name is resolved from entity passed to generateActivityDescription (entity_1)
      expect(result).toBe('Activity: entity_1 observes.');

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id };
          }
          return undefined;
        }),
      }));
    });

    it('should fall back to target id when target entity cannot be resolved', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'inline',
          actorId: 'entity_1',
          template: '{actor} acknowledges {target}',
          targetId: 'missing_target',
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'missing_target') {
          return undefined;
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe(
        'Activity: entity_1 acknowledges missing_target.'
      );

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id };
          }
          return undefined;
        }),
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
        if (id === 'entity_1') {
          return { id: 'entity_1' }; // Has id but no name
        }
        if (id === 'faceless_actor') {
          return {};
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('entity_1');

      // Phase 2: When entity has id but no name, uses id as fallback
      expect(result).toBe('Activity: entity_1 waits.');

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id };
          }
          return undefined;
        }),
      }));
    });

    it('should default to an interaction verb when target is present without verb', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          targetId: 'entity_2',
          priority: 3,
          // Phase 2: Need type for generateActivityPhrase to process correctly
          type: 'dedicated',
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id === 'entity_2' ? 'Target' : id };
          }
          return undefined;
        }),
      }));

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: entity_1 is interacting with Target.');

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id };
          }
          return undefined;
        }),
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

      expect(result).toBe('entity_1 gestures');

      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        enabled: true,
        prefix: 'Activity: ',
        suffix: '.',
      });
    });

    it('should use inline description fallback when target name is available', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'inline',
          actorId: 'entity_1',
          description: ' greets warmly ',
          targetId: 'entity_2',
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id };
          }
          return undefined;
        }),
      }));

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe(
        'Activity: entity_1 greets warmly entity_2.'
      );

      mockEntityManager.getEntityInstance.mockImplementation((id) => ({
        id,
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: id };
          }
          return undefined;
        }),
      }));
    });

    it('should use inline description fallback when template is missing and no target is provided', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'inline',
          actorId: 'entity_1',
          description: ' waits patiently ',
        },
      ]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: entity_1 waits patiently.');
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

      expect(result).toBe('entity_1 observes');
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

  describe('Inline Metadata Collection', () => {
    it('should collect inline metadata from components', async () => {
      // Testing private #collectInlineMetadata through public generateActivityDescription()
      // Create mock entity with correct API (componentTypeIds getter + getComponentData method)
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['positioning:kneeling_before'],
        getComponentData: jest.fn((id) => {
          if (id === 'positioning:kneeling_before') {
            return {
              entityId: 'alicia',
              activityMetadata: {
                shouldDescribeInActivity: true,
                template: '{actor} is kneeling before {target}',
                targetRole: 'entityId',
                priority: 75,
              },
            };
          }
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Alicia Western' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('jon');

      // Verify inline metadata was collected and processed
      expect(result).toContain('jon'); // Actor name in result
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'positioning:kneeling_before'
      );
    });

    it('should skip components without activityMetadata', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name', 'anatomy:body'],
        getComponentData: jest.fn((id) => {
          if (id === 'core:name') return { text: 'Jon' };
          if (id === 'anatomy:body') return { /* body data */ };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('jon');

      // Should not include any activity descriptions from these components
      expect(result).toBe('');
      expect(mockEntity.getComponentData).toHaveBeenCalled();
    });

    it('should skip dedicated metadata components', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['activity:description_metadata'],
        getComponentData: jest.fn((id) => {
          if (id === 'activity:description_metadata')
            return { /* metadata */ };
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('jon');

      // Dedicated metadata components should be processed differently (not inline)
      expect(mockEntity.getComponentData).not.toHaveBeenCalledWith(
        'activity:description_metadata'
      );
      expect(result).toBe('');
    });

    it('should handle missing template gracefully', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['bad:component'],
        getComponentData: jest.fn((id) => {
          if (id === 'bad:component') {
            return {
              activityMetadata: {
                shouldDescribeInActivity: true,
                // Missing template
              },
            };
          }
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('jon');

      // Should log warning about missing template
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing template')
      );
      expect(result).toBe('');
    });

    it('should log an error when inline metadata parsing throws', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['bad:component'],
        getComponentData: jest.fn((id) => {
          if (id === 'bad:component') {
            return {
              activityMetadata: {
                shouldDescribeInActivity: true,
                template: 123, // Non-string to trigger parsing failure
              },
            };
          }
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('jon');

      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse inline metadata for bad:component',
        expect.any(Error)
      );
    });

    it('should use default values for optional properties', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['simple:activity'],
        getComponentData: jest.fn((id) => {
          if (id === 'simple:activity') {
            return {
              entityId: 'someone',
              activityMetadata: {
                shouldDescribeInActivity: true,
                template: '{actor} waves',
                // No targetRole (should default to 'entityId')
                // No priority (should default to 50)
              },
            };
          }
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'someone') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Someone' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('jon');

      // Verify default priority (50) is used and template is processed
      expect(result).toContain('jon'); // Actor in result
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'simple:activity'
      );
    });

    it('should resolve targetEntityId from custom targetRole', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['companionship:following'],
        getComponentData: jest.fn((id) => {
          if (id === 'companionship:following') {
            return {
              leaderId: 'alicia',
              activityMetadata: {
                shouldDescribeInActivity: true,
                template: '{actor} is following {target}',
                targetRole: 'leaderId',
                priority: 40,
              },
            };
          }
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Alicia Western' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('jon');

      // Verify custom targetRole (leaderId) is resolved correctly
      expect(result).toContain('jon'); // Actor in result
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'companionship:following'
      );
    });
  });

  describe('Dedicated Metadata Collection', () => {
    describe('Through generateActivityDescription', () => {
      it('should collect and format dedicated metadata component', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: ['kissing:kissing', 'activity:description_metadata', 'core:name'],
          components: {
            'kissing:kissing': {
              partner: 'alicia',
              initiator: true,
            },
            'activity:description_metadata': {
              sourceComponent: 'kissing:kissing',
              descriptionType: 'verb',
              verb: 'kissing',
              targetRole: 'partner',
              priority: 90,
            },
            'core:name': {
              text: 'Jon Ureña',
            },
          },
          hasComponent: jest.fn((compId) => compId === 'activity:description_metadata'),
          getComponentData: jest.fn((compId) => mockEntity.components[compId] || null),
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return mockEntity;
          if (id === 'alicia') return { id, displayName: 'Alicia Western' };
          return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
        });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        // Should include the dedicated metadata activity
        expect(result).toBeTruthy();
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'activity:description_metadata'
        );
      });

      it('should handle errors when collecting dedicated metadata gracefully', async () => {
        mockEntityManager.getEntityInstance
          .mockImplementationOnce((id) => ({
            id,
            componentTypeIds: [],
            getComponentData: jest.fn(),
          }))
          .mockImplementationOnce(() => {
            throw new Error('Dedicated metadata failure');
          });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('entity_1');

        expect(result).toBe('');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to collect dedicated metadata for entity entity_1',
          expect.any(Error)
        );
      });

      it('should combine inline and dedicated metadata activities', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: [
            'positioning:kneeling_before',
            'kissing:kissing',
            'activity:description_metadata',
            'core:name',
          ],
          components: {
            'positioning:kneeling_before': {
              entityId: 'alicia',
              activityMetadata: {
                shouldDescribeInActivity: true,
                template: '{actor} is kneeling before {target}',
                priority: 70,
              },
            },
            'kissing:kissing': {
              partner: 'alicia',
              initiator: true,
            },
            'activity:description_metadata': {
              sourceComponent: 'kissing:kissing',
              descriptionType: 'verb',
              verb: 'kissing',
              targetRole: 'partner',
              priority: 90,
            },
            'core:name': {
              text: 'Jon Ureña',
            },
          },
          hasComponent: jest.fn((compId) => {
            return (
              compId === 'activity:description_metadata' ||
              compId === 'positioning:kneeling_before'
            );
          }),
          getComponentData: jest.fn((compId) => mockEntity.components[compId] || null),
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return mockEntity;
          if (id === 'alicia') return { id, displayName: 'Alicia Western' };
          return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
        });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        // Should prioritize dedicated metadata (priority 90) over inline (priority 70)
        expect(result).toBeTruthy();
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('kissing:kissing');
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'activity:description_metadata'
        );
      });

      it('should return empty string when no metadata component exists', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: ['positioning:kneeling_before', 'core:name'],
          components: {
            'positioning:kneeling_before': { entityId: 'alicia' },
            'core:name': { text: 'Jon Ureña' },
          },
          hasComponent: jest.fn(() => false),
          getComponentData: jest.fn((compId) => mockEntity.components[compId] || null),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        // No inline metadata, no dedicated metadata
        expect(result).toBe('');
      });

      it('should log warning when sourceComponent is missing', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: ['core:name'],
          hasComponent: jest.fn((compId) => compId === 'activity:description_metadata'),
          getComponentData: jest.fn((compId) => {
            if (compId === 'core:name') {
              return { text: 'Jon Ureña' };
            }
            if (compId === 'activity:description_metadata') {
              return {
                // Missing sourceComponent
                descriptionType: 'verb',
                verb: 'doing something',
              };
            }
            return null;
          }),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('missing sourceComponent')
        );
      });

      it('should log warning when source component data is missing', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: ['core:name'],
          hasComponent: jest.fn((compId) => compId === 'activity:description_metadata'),
          getComponentData: jest.fn((compId) => {
            if (compId === 'core:name') {
              return { text: 'Jon Ureña' };
            }
            if (compId === 'activity:description_metadata') {
              return {
                sourceComponent: 'nonexistent:component',
                descriptionType: 'verb',
                verb: 'doing',
              };
            }
            return null; // Source component doesn't exist
          }),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Source component not found')
        );
      });

      it('should include all metadata properties in formatted output', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: ['positioning:hugging', 'activity:description_metadata', 'core:name'],
          components: {
            'positioning:hugging': {
              embraced_entity_id: 'alicia',
              initiated: true,
            },
            'activity:description_metadata': {
              sourceComponent: 'positioning:hugging',
              descriptionType: 'verb',
              verb: 'hugging',
              adverb: 'tightly',
              targetRole: 'embraced_entity_id',
              priority: 85,
              conditions: { requiredComponents: ['positioning:standing'] },
              grouping: { groupKey: 'physical_contact' },
            },
            'core:name': {
              text: 'Jon Ureña',
            },
          },
          hasComponent: jest.fn((compId) => compId === 'activity:description_metadata'),
          getComponentData: jest.fn((compId) => mockEntity.components[compId] || null),
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return mockEntity;
          if (id === 'alicia') return { id, displayName: 'Alicia Western' };
          return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
        });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        expect(result).toBeTruthy();
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('positioning:hugging');
      });

      it('should default priority to 50 when not specified', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: ['core:action', 'activity:description_metadata', 'core:name'],
          components: {
            'core:action': { targetId: 'alicia' },
            'activity:description_metadata': {
              sourceComponent: 'core:action',
              verb: 'greeting',
              // No priority specified - should default to 50
            },
            'core:name': {
              text: 'Jon Ureña',
            },
          },
          hasComponent: jest.fn((compId) => compId === 'activity:description_metadata'),
          getComponentData: jest.fn((compId) => mockEntity.components[compId] || null),
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return mockEntity;
          if (id === 'alicia') return { id, displayName: 'Alicia Western' };
          return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
        });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        // Activity should be included with default priority
        expect(result).toBeTruthy();
      });

      it('should handle parsing errors gracefully without crashing', async () => {
        const mockEntity = {
          id: 'jon',
          name: 'Jon Ureña',
          componentTypeIds: [],
          hasComponent: jest.fn((compId) => compId === 'activity:description_metadata'),
          getComponentData: jest.fn(() => {
            throw new Error('Unexpected parsing error');
          }),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        expect(result).toBe('');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to collect dedicated metadata for entity jon',
          expect.any(Error)
        );
      });

      it('should use targetRole to resolve correct target entity', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: ['social:greeting', 'activity:description_metadata', 'core:name'],
          components: {
            'social:greeting': {
              greetedPersonId: 'alicia',
              other_field: 'value',
            },
            'activity:description_metadata': {
              sourceComponent: 'social:greeting',
              verb: 'greeting',
              targetRole: 'greetedPersonId',
              priority: 75,
            },
            'core:name': {
              text: 'Jon Ureña',
            },
          },
          hasComponent: jest.fn((compId) => compId === 'activity:description_metadata'),
          getComponentData: jest.fn((compId) => mockEntity.components[compId] || null),
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return mockEntity;
          if (id === 'alicia') return { id, displayName: 'Alicia Western' };
          return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
        });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        expect(result).toBeTruthy();
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('social:greeting');
      });

      it('should default to entityId when targetRole is not specified', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: ['core:interaction', 'activity:description_metadata', 'core:name'],
          components: {
            'core:interaction': {
              entityId: 'alicia',
              other_field: 'value',
            },
            'activity:description_metadata': {
              sourceComponent: 'core:interaction',
              verb: 'interacting',
              // No targetRole specified - should default to 'entityId'
            },
            'core:name': {
              text: 'Jon Ureña',
            },
          },
          hasComponent: jest.fn((compId) => compId === 'activity:description_metadata'),
          getComponentData: jest.fn((compId) => mockEntity.components[compId] || null),
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return mockEntity;
          if (id === 'alicia') return { id, displayName: 'Alicia Western' };
          return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
        });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        expect(result).toBeTruthy();
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('core:interaction');
      });
    });
  });

  describe('Template-Based Phrase Generation (Phase 2)', () => {
    beforeEach(() => {
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        enabled: true,
        prefix: 'Activity: ',
        suffix: '',
        separator: '. ',
      });
    });

    it('should use template replacement for inline activities', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'inline',
          template: '{actor} is kneeling before {target}',
          targetEntityId: 'alicia',
          priority: 75,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Alicia Western' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('Activity: Jon Ureña is kneeling before Alicia Western');
    });

    it('should format dedicated activity with verb', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'dedicated',
          verb: 'kissing',
          targetEntityId: 'alicia',
          priority: 90,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Alicia Western' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('Activity: Jon Ureña is kissing Alicia Western fiercely');
    });

    it('should include adverb in dedicated activity', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'dedicated',
          verb: 'hugging',
          adverb: 'tightly',
          targetEntityId: 'alicia',
          priority: 85,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Alicia Western' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('Activity: Jon Ureña is hugging Alicia Western tightly');
    });

    it('should handle activity without target', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'dedicated',
          verb: 'meditating',
          priority: 60,
        },
      ]);

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('Activity: Jon Ureña is meditating');
    });

    it('should join multiple activities with separator (ENHANCEMENT)', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'inline',
          template: '{actor} is kneeling before {target}',
          targetEntityId: 'alicia',
          priority: 75,
        },
        {
          type: 'inline',
          template: '{actor} is holding hands with {target}',
          targetEntityId: 'alicia',
          priority: 60,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Alicia Western' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe(
        'Activity: Jon Ureña is kneeling before Alicia Western and holding hands with Alicia Western'
      );
    });

    it('should process ALL activities not just first (KEY ENHANCEMENT)', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        { type: 'inline', template: '{actor} kneels', priority: 75 },
        { type: 'inline', template: '{actor} waves', priority: 50 },
        { type: 'inline', template: '{actor} smiles', priority: 25 },
      ]);

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateActivityDescription('jon');

      // Should include ALL three activities, not just the first
      expect(result).toContain('kneels');
      expect(result).toContain('waves');
      expect(result).toContain('smiles');
    });

    it('should use config prefix and suffix', async () => {
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
        prefix: '>>> ',
        suffix: ' <<<',
        separator: ' | ',
      });

      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        { type: 'inline', template: '{actor} waves', targetEntityId: null, priority: 50 },
      ]);

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('>>> Jon Ureña waves <<<');
    });

    it('should return empty string for no activities', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('');
    });

    it('should handle template without target placeholder', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'inline',
          template: '{actor} stretches',
          priority: 40,
        },
      ]);

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('Activity: Jon Ureña stretches');
    });

    it('should handle multiple targets across activities', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'inline',
          template: '{actor} is kneeling before {target}',
          targetEntityId: 'alicia',
          priority: 75,
        },
        {
          type: 'inline',
          template: '{actor} is holding hands with {target}',
          targetEntityId: 'alicia',
          priority: 60,
        },
        {
          type: 'inline',
          template: '{actor} is following {target}',
          targetEntityId: 'bob',
          priority: 40,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Alicia Western' };
              }
              return undefined;
            }),
          };
        }
        if (id === 'bob') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Bob Smith' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe(
        'Activity: Jon Ureña is kneeling before Alicia Western and holding hands with Alicia Western. Jon Ureña is following Bob Smith'
      );
    });

    it('should default verb to "interacting with" when missing in dedicated activity', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'dedicated',
          // No verb specified
          targetEntityId: 'alicia',
          priority: 50,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'jon') return mockEntity;
        if (id === 'alicia') {
          return {
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Alicia Western' };
              }
              return undefined;
            }),
          };
        }
        return {
          id,
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return undefined;
          }),
        };
      });

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('Activity: Jon Ureña is interacting with Alicia Western');
    });

    it('should maintain backward compatibility with legacy activities', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          // No type specified (legacy)
          description: 'waves',
          priority: 50,
        },
      ]);

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('Activity: Jon Ureña waves');
    });

    it('should filter out empty phrases from final result', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['core:name'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: 'Jon Ureña' };
          }
          return undefined;
        }),
      };

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'inline',
          template: '{actor} waves',
          priority: 60,
        },
        {
          type: 'inline',
          // Invalid activity - no template or description
          priority: 50,
        },
        {
          type: 'inline',
          template: '{actor} smiles',
          priority: 40,
        },
      ]);

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const result = await service.generateActivityDescription('jon');
      expect(result).toBe('Activity: Jon Ureña waves. Jon Ureña smiles');
      expect(result).not.toContain('undefined');
    });
  });

  // ACTDESC-014: Pronoun Resolution Tests
  describe('Pronoun Resolution (ACTDESC-014)', () => {
    /**
     * Helper to create an entity with gender component
     *
     * @param {string} id - Entity ID
     * @param {string} name - Entity name
     * @param {string} gender - Gender value ('male', 'female', 'neutral')
     * @returns {object} Mock entity with gender component
     */
    const createEntityWithGender = (id, name, gender) => ({
      id,
      componentTypeIds: ['core:name', 'core:gender'],
      getComponentData: jest.fn((componentId) => {
        if (componentId === 'core:name') {
          return { text: name };
        }
        if (componentId === 'core:gender') {
          return { value: gender };
        }
        return undefined;
      }),
      hasComponent: jest.fn((componentId) => {
        return componentId === 'core:name' || componentId === 'core:gender';
      }),
    });

    describe('Gender Detection', () => {
      it('should detect male gender from core:gender component', async () => {
        const mockEntity = createEntityWithGender('jon', 'Jon Ureña', 'male');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} waves',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const result = await service.generateActivityDescription('jon');
        expect(result).toBeTruthy();
      });

      it('should detect female gender from core:gender component', async () => {
        const mockEntity = createEntityWithGender('alicia', 'Alicia Western', 'female');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} smiles',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const result = await service.generateActivityDescription('alicia');
        expect(result).toBeTruthy();
      });

      it('should default to neutral gender when component missing', async () => {
        const mockEntity = {
          id: 'person',
          componentTypeIds: ['core:name'],
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: 'Person' };
            }
            return undefined;
          }),
        };

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} stands',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const result = await service.generateActivityDescription('person');
        expect(result).toBeTruthy();
      });

      it('should handle neutral gender explicitly', async () => {
        const mockEntity = createEntityWithGender('alex', 'Alex Smith', 'neutral');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} nods',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const result = await service.generateActivityDescription('alex');
        expect(result).toBeTruthy();
      });
    });

    describe('Subject Pronoun Usage', () => {
      it('should use "he" for male actors in subsequent activities', async () => {
        const mockActor = createEntityWithGender('jon', 'Jon Ureña', 'male');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} stands',
            priority: 70,
          },
          {
            type: 'inline',
            template: '{actor} waves',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('jon');
        expect(result).toBe('Activity: Jon Ureña stands. he waves');
      });

      it('should use "she" for female actors in subsequent activities', async () => {
        const mockActor = createEntityWithGender('alicia', 'Alicia Western', 'female');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} sits',
            priority: 70,
          },
          {
            type: 'inline',
            template: '{actor} smiles',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('alicia');
        expect(result).toBe('Activity: Alicia Western sits. she smiles');
      });

      it('should use "they" for neutral actors in subsequent activities', async () => {
        const mockActor = createEntityWithGender('alex', 'Alex Smith', 'neutral');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} arrives',
            priority: 70,
          },
          {
            type: 'inline',
            template: '{actor} looks around',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('alex');
        expect(result).toBe('Activity: Alex Smith arrives. they looks around');
      });

      it('should always use full name for first activity', async () => {
        const mockActor = createEntityWithGender('jon', 'Jon Ureña', 'male');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} enters',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('jon');
        expect(result).toBe('Activity: Jon Ureña enters');
        expect(result).not.toContain(' he ');
      });
    });

    describe('Object Pronoun Usage for Targets', () => {
      it('should use "him" for male targets when pronouns enabled', async () => {
        const mockActor = createEntityWithGender('alicia', 'Alicia Western', 'female');
        const mockTarget = createEntityWithGender('jon', 'Jon Ureña', 'male');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} waves at {target}',
            targetEntityId: 'jon',
            priority: 70,
          },
          {
            type: 'inline',
            template: '{actor} talks to {target}',
            targetEntityId: 'jon',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'alicia') return mockActor;
          if (id === 'jon') return mockTarget;
          return null;
        });

        const result = await service.generateActivityDescription('alicia');
        expect(result).toBe(
          'Activity: Alicia Western waves at Jon Ureña while she talks to him'
        );
      });

      it('should use "her" for female targets when pronouns enabled', async () => {
        const mockActor = createEntityWithGender('jon', 'Jon Ureña', 'male');
        const mockTarget = createEntityWithGender('alicia', 'Alicia Western', 'female');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} approaches {target}',
            targetEntityId: 'alicia',
            priority: 70,
          },
          {
            type: 'inline',
            template: '{actor} greets {target}',
            targetEntityId: 'alicia',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return mockActor;
          if (id === 'alicia') return mockTarget;
          return null;
        });

        const result = await service.generateActivityDescription('jon');
        expect(result).toBe(
          'Activity: Jon Ureña approaches Alicia Western while he greets her'
        );
      });

      it('should use "them" for neutral targets when pronouns enabled', async () => {
        const mockActor = createEntityWithGender('jon', 'Jon Ureña', 'male');
        const mockTarget = createEntityWithGender('alex', 'Alex Smith', 'neutral');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} notices {target}',
            targetEntityId: 'alex',
            priority: 70,
          },
          {
            type: 'inline',
            template: '{actor} waves to {target}',
            targetEntityId: 'alex',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return mockActor;
          if (id === 'alex') return mockTarget;
          return null;
        });

        const result = await service.generateActivityDescription('jon');
        expect(result).toBe(
          'Activity: Jon Ureña notices Alex Smith while he waves to them'
        );
      });
    });

    describe('Configuration Flag Behavior', () => {
      it('should use names when usePronounsWhenAvailable is false', async () => {
        const mockActor = createEntityWithGender('jon', 'Jon Ureña', 'male');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} stands',
            priority: 70,
          },
          {
            type: 'inline',
            template: '{actor} waves',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: false,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('jon');
        expect(result).toBe('Activity: Jon Ureña stands. Jon Ureña waves');
        expect(result).not.toContain(' he ');
      });

      it('should handle missing nameResolution configuration gracefully', async () => {
        const mockActor = createEntityWithGender('jon', 'Jon Ureña', 'male');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} sits',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('jon');
        expect(result).toBeTruthy();
      });
    });

    describe('Complex Activity Scenarios', () => {
      it('should handle three activities with mixed pronouns', async () => {
        const mockActor = createEntityWithGender('jon', 'Jon Ureña', 'male');
        const mockTarget = createEntityWithGender('alicia', 'Alicia Western', 'female');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} kneels before {target}',
            targetEntityId: 'alicia',
            priority: 80,
          },
          {
            type: 'inline',
            template: '{actor} holds hands with {target}',
            targetEntityId: 'alicia',
            priority: 70,
          },
          {
            type: 'inline',
            template: '{actor} smiles',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return mockActor;
          if (id === 'alicia') return mockTarget;
          return null;
        });

        const result = await service.generateActivityDescription('jon');
        expect(result).toBe(
          'Activity: Jon Ureña kneels before Alicia Western while he holds hands with her. he smiles'
        );
      });

      it('should handle dedicated activity type with pronouns', async () => {
        const mockActor = createEntityWithGender('alicia', 'Alicia Western', 'female');
        const mockTarget = createEntityWithGender('jon', 'Jon Ureña', 'male');

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'dedicated',
            verb: 'standing beside',
            targetEntityId: 'jon',
            priority: 70,
          },
          {
            type: 'dedicated',
            verb: 'talking to',
            targetEntityId: 'jon',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'alicia') return mockActor;
          if (id === 'jon') return mockTarget;
          return null;
        });

        const result = await service.generateActivityDescription('alicia');
        expect(result).toBe(
          'Activity: Alicia Western is standing beside Jon Ureña while talking to him'
        );
      });
    });

    describe('Smart Activity Grouping (ACTDESC-015)', () => {
      const createEntityWithGender = (id, name, gender) => ({
        id,
        componentTypeIds: ['core:name', 'core:gender'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: name };
          }
          if (componentId === 'core:gender') {
            return { value: gender };
          }
          return undefined;
        }),
      });

      const createInlineActivity = (template, targetId, priority, overrides = {}) => ({
        type: 'inline',
        template,
        priority,
        targetEntityId: targetId,
        ...overrides,
      });

      const createDedicatedActivity = (
        verb,
        targetId,
        priority,
        groupKey = null,
        overrides = {}
      ) => ({
        type: 'dedicated',
        verb,
        priority,
        targetEntityId: targetId,
        grouping: groupKey ? { groupKey } : undefined,
        ...overrides,
      });

      beforeEach(() => {
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: { usePronounsWhenAvailable: true },
          maxActivities: 5,
        });

        const nameMap = {
          jon: 'Jon Name',
          alicia: 'Alicia Name',
          bobby: 'Bobby Name',
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) =>
          createEntityWithGender(
            id,
            nameMap[id] ?? `${id} Name`,
            id === 'jon' ? 'male' : 'female'
          )
        );
      });

      it('groups activities with the same target using "and"', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          createInlineActivity(
            '{actor} is kneeling before {target}',
            'alicia',
            80
          ),
          createInlineActivity(
            '{actor} is holding hands with {target}',
            'alicia',
            50
          ),
        ]);

        const description = await service.generateActivityDescription('jon');

        expect(description).toBe(
          'Activity: Jon Name is kneeling before Alicia Name and holding hands with her'
        );
      });

      it('uses "while" when priorities are within the simultaneous threshold', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          createInlineActivity('{actor} is kneeling', 'alicia', 80),
          createInlineActivity('{actor} is looking at {target}', 'alicia', 75),
        ]);

        const description = await service.generateActivityDescription('jon');

        expect(description).toContain('while');
      });

      it('keeps separate sentences when targets differ and no grouping metadata matches', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          createInlineActivity('{actor} is embracing {target}', 'alicia', 80),
          createInlineActivity('{actor} is waving at {target}', 'bobby', 70),
        ]);

        const description = await service.generateActivityDescription('jon');

        expect(description.split('. ').length).toBeGreaterThan(1);
      });

      it('allows grouping via explicit grouping metadata even when targets differ', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          createDedicatedActivity('hugging', 'alicia', 80, 'intimate_contact'),
          createDedicatedActivity('kissing', 'bobby', 40, 'intimate_contact'),
        ]);

        const description = await service.generateActivityDescription('jon');

        expect(description).toContain('and kissing');
        expect(description.split('. ').length).toBe(1);
      });

      it('omits duplicate "is" in grouped verb phrases', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          createInlineActivity(
            '{actor} is kneeling before {target}',
            'alicia',
            80
          ),
          createInlineActivity(
            '{actor} is holding hands with {target}',
            'alicia',
            50
          ),
        ]);

        const description = await service.generateActivityDescription('jon');

        expect(description).not.toMatch(/and is holding/);
        expect(description).toContain('and holding');
      });
    });

    describe('Context Awareness (ACTDESC-016)', () => {
      const buildEntity = (id, { name, gender, closeness } = {}) => ({
        id,
        componentTypeIds: [],
        hasComponent: jest.fn(() => false),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:name') {
            return { text: name ?? id };
          }
          if (componentId === 'core:gender' && gender) {
            return { value: gender };
          }
          if (componentId === 'positioning:closeness') {
            return closeness ?? null;
          }
          return undefined;
        }),
      });

      beforeEach(() => {
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '.',
          separator: '. ',
          enableContextAwareness: true,
          nameResolution: { usePronounsWhenAvailable: false },
        });
      });

      it('uses closeness partners to soften phrasing', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} is holding hands with {target}',
            targetEntityId: 'alicia',
            priority: 80,
          },
        ]);

        const jonEntity = buildEntity('jon', {
          name: 'Jon',
          closeness: { partners: ['alicia'] },
        });
        const aliciaEntity = buildEntity('alicia', { name: 'Alicia Western' });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return jonEntity;
          if (id === 'alicia') return aliciaEntity;
          return buildEntity(id);
        });

        const description = await service.generateActivityDescription('jon');

        expect(description).toMatch(/tenderly/);
      });

      it('falls back to neutral tone when no context exists', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} is waving at {target}',
            targetEntityId: 'stranger',
            priority: 60,
          },
        ]);

        const jonEntity = buildEntity('jon', { name: 'Jon' });
        const strangerEntity = buildEntity('stranger', { name: 'Stranger' });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return jonEntity;
          if (id === 'stranger') return strangerEntity;
          return buildEntity(id);
        });

        const description = await service.generateActivityDescription('jon');

        expect(description).not.toMatch(/tenderly|fiercely/);
      });

      it('intensifies language for high-priority activities', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} is embracing {target}',
            targetEntityId: 'alicia',
            priority: 95,
          },
        ]);

        const jonEntity = buildEntity('jon', {
          name: 'Jon',
          closeness: { partners: [] },
        });
        const aliciaEntity = buildEntity('alicia', { name: 'Alicia Western' });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return jonEntity;
          if (id === 'alicia') return aliciaEntity;
          return buildEntity(id);
        });

        const description = await service.generateActivityDescription('jon');

        expect(description).toMatch(/fiercely/);
      });

      it('avoids duplicating descriptors when contextual adverbs match', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'dedicated',
            verb: 'whispering to',
            targetEntityId: 'alicia',
            priority: 80,
            adverb: 'tenderly',
          },
        ]);

        const jonEntity = buildEntity('jon', {
          name: 'Jon',
          closeness: { partners: ['alicia'] },
        });
        const aliciaEntity = buildEntity('alicia', { name: 'Alicia Western' });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return jonEntity;
          if (id === 'alicia') return aliciaEntity;
          return buildEntity(id);
        });

        const description = await service.generateActivityDescription('jon');

        const tenderlyMatches = description.match(/tenderly/g) || [];
        expect(tenderlyMatches.length).toBe(1);
      });

      it('maintains contextual tone across grouped activities', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} is embracing {target}',
            targetEntityId: 'alicia',
            priority: 80,
          },
          {
            type: 'inline',
            template: '{actor} is whispering to {target}',
            targetEntityId: 'alicia',
            priority: 78,
          },
        ]);

        const jonEntity = buildEntity('jon', {
          name: 'Jon',
          closeness: { partners: ['alicia'] },
        });
        const aliciaEntity = buildEntity('alicia', { name: 'Alicia Western' });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return jonEntity;
          if (id === 'alicia') return aliciaEntity;
          return buildEntity(id);
        });

        const description = await service.generateActivityDescription('jon');

        const tenderlyMatches = description.match(/tenderly/g) || [];
        expect(tenderlyMatches.length).toBeGreaterThanOrEqual(2);
      });

      it('can disable context awareness via configuration', async () => {
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '.',
          separator: '. ',
          enableContextAwareness: false,
        });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} is embracing {target}',
            targetEntityId: 'alicia',
            priority: 95,
          },
        ]);

        const jonEntity = buildEntity('jon', { name: 'Jon' });
        const aliciaEntity = buildEntity('alicia', { name: 'Alicia Western' });

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') return jonEntity;
          if (id === 'alicia') return aliciaEntity;
          return buildEntity(id);
        });

        const description = await service.generateActivityDescription('jon');

        expect(description).not.toMatch(/fiercely/);
      });
    });

    describe('Error Handling', () => {
      it('should handle gender detection errors gracefully', async () => {
        const mockEntity = {
          id: 'broken',
          componentTypeIds: ['core:name'],
          getComponentData: jest.fn(() => {
            throw new Error('Component access failed');
          }),
        };

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} exists',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue({
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
          nameResolution: {
            usePronounsWhenAvailable: true,
          },
        });

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const result = await service.generateActivityDescription('broken');
        expect(result).toBeTruthy();
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });
  });
});

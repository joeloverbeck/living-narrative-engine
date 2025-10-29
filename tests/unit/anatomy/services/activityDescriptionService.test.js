import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ActivityDescriptionService from '../../../../src/anatomy/services/activityDescriptionService.js';
import EventBus from '../../../../src/events/eventBus.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  COMPONENTS_BATCH_ADDED_ID,
  ENTITY_REMOVED_ID,
} from '../../../../src/constants/eventIds.js';
import {
  NAME_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('ActivityDescriptionService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockAnatomyFormattingService;
  let mockActivityIndex;
  let mockJsonLogicEvaluationService;
  let mockEventBus;
  let defaultGetEntityInstanceImplementation;

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
    };

    defaultGetEntityInstanceImplementation = (id) => ({
      id,
      componentTypeIds: [],
      getComponentData: jest.fn((componentId) => {
        if (componentId === 'core:name') {
          return { text: id };
        }

        if (componentId === 'positioning:closeness') {
          return null;
        }

        if (componentId === 'core:gender') {
          return null;
        }

        return undefined;
      }),
      hasComponent: jest.fn().mockReturnValue(false),
    });

    mockEntityManager = {
      getEntityInstance: jest.fn(defaultGetEntityInstanceImplementation),
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

    mockJsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    const subscribedListeners = new Map();

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn((eventId, handler) => {
        if (!subscribedListeners.has(eventId)) {
          subscribedListeners.set(eventId, new Set());
        }
        subscribedListeners.get(eventId).add(handler);
        return () => {
          subscribedListeners.get(eventId)?.delete(handler);
        };
      }),
      unsubscribe: jest.fn((eventId, handler) => {
        subscribedListeners.get(eventId)?.delete(handler);
      }),
      listenerCount: jest.fn(
        (eventId) => subscribedListeners.get(eventId)?.size ?? 0
      ),
    };

    // Create service instance
    service = new ActivityDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      anatomyFormattingService: mockAnatomyFormattingService,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      activityIndex: mockActivityIndex,
    });
  });

  afterEach(() => {
    if (service) {
      service.destroy();
    }
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should validate logger dependency', () => {
      expect(
        () =>
          new ActivityDescriptionService({
            logger: null,
            entityManager: mockEntityManager,
            anatomyFormattingService: mockAnatomyFormattingService,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
          })
      ).not.toThrow(); // ensureValidLogger provides fallback
    });

    it('should validate entityManager dependency', () => {
      expect(
        () =>
          new ActivityDescriptionService({
            logger: mockLogger,
            entityManager: null,
            anatomyFormattingService: mockAnatomyFormattingService,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
          })
      ).toThrow(/Missing required dependency.*IEntityManager/);
    });

    it('should validate anatomyFormattingService dependency', () => {
      expect(
        () =>
          new ActivityDescriptionService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            anatomyFormattingService: null,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
          })
      ).toThrow(/Missing required dependency.*AnatomyFormattingService/);
    });

    it('should validate entityManager has required methods', () => {
      const invalidEntityManager = {
        // missing getEntityInstance method
        someOtherMethod: jest.fn(),
      };

      expect(
        () =>
          new ActivityDescriptionService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            anatomyFormattingService: mockAnatomyFormattingService,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
          })
      ).toThrow(/Invalid or missing method.*getEntityInstance/);
    });

    it('should accept optional activityIndex parameter', () => {
      const mockActivityIndex = {
        findActivitiesForEntity: jest.fn(),
      };

      const serviceWithIndex = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        activityIndex: mockActivityIndex,
      });

      expect(serviceWithIndex).toBeDefined();
    });

    it('should default activityIndex to null when not provided', () => {
      const serviceWithoutIndex = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      });

      expect(serviceWithoutIndex).toBeDefined();
    });

    it('should validate jsonLogicEvaluationService dependency', () => {
      expect(
        () =>
          new ActivityDescriptionService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            anatomyFormattingService: mockAnatomyFormattingService,
            jsonLogicEvaluationService: null,
          })
      ).toThrow(/JsonLogicEvaluationService/);
    });
  });

  describe('generateActivityDescription', () => {
    it('should validate entityId parameter', async () => {
      await expect(service.generateActivityDescription('')).rejects.toThrow(
        /Invalid entityId/
      );

      await expect(service.generateActivityDescription(null)).rejects.toThrow(
        /Invalid entityId/
      );

      await expect(
        service.generateActivityDescription(undefined)
      ).rejects.toThrow(/Invalid entityId/);

      await expect(service.generateActivityDescription('   ')).rejects.toThrow(
        /Invalid entityId/
      );
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
        expect.stringContaining(
          'Generating activity description for entity: entity_1'
        )
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
          entity_1: 'Jon Ureña',
          entity_2: 'Alicia Western',
          entity_3: 'Dylan',
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
      expect(result).toBe(
        'Activity: Jon Ureña stands near Dylan. Jon Ureña kneels before Alicia Western.'
      );
      expect(mockActivityIndex.findActivitiesForEntity).toHaveBeenCalledWith(
        'entity_1'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'entity_3'
      );
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
      mockActivityIndex.findActivitiesForEntity.mockReturnValue({
        invalid: true,
      });

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Activity index returned invalid data for entity entity_1'
        )
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
        getComponentData: jest.fn().mockImplementation((componentId) => {
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
        getComponentData: jest.fn().mockImplementation((componentId) => {
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
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('pose:stance'),
        expect.any(Error)
      );
    });

    it('should log an error when inline metadata collection fails', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const problematicEntity = {
        id: 'entity_1',
        get componentTypeIds() {
          throw new Error('Inline failure');
        },
        getComponentData: jest.fn(),
        hasComponent: jest.fn().mockReturnValue(false),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(problematicEntity);

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
      expect(result).toBe(
        'Activity: entity_1 takes center stage. entity_1 considers the options. entity_1 waits patiently.'
      );
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
      expect(result).toBe(
        'Activity: entity_1 leads the charge. entity_1 assesses the options. entity_1 lingers near the exit.'
      );
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
          entity_1: 'Jon',
          entity_2: 'Alicia',
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

      // Entity reuse and caching reduce lookups across repeated calls.
      // First invocation performs four lookups (metadata, name, gender, closeness),
      // the second relies on caches for name/closeness, resulting in two additional lookups.
      expect(actorCalls.length).toBe(6);
      // Context-aware tone evaluation performs gender checks per call (optimized to 2 calls)
      expect(targetCalls.length).toBe(2);
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

      expect(result).toBe('Activity: entity_1 leaps across the chasm.');
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
      expect(mockLogger.debug).toHaveBeenCalledWith(
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
      expect(result).toBe(
        'Activity: Observer whispers to Subject. Observer glances at.'
      );
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

      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('entity_1')
      );
    });

    it('should return empty string when no activity index is provided', async () => {
      const serviceWithoutIndex = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      });

      const result =
        await serviceWithoutIndex.generateActivityDescription('entity_1');

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
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        activityIndex: { findActivitiesForEntity: null },
      });

      const result =
        await serviceWithInvalidIndex.generateActivityDescription('entity_1');

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
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        activityIndex: mockActivityIndex,
      });

      const result =
        await serviceWithThrowingLogger.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(throwingLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to generate activity description for entity entity_1'
        ),
        expect.any(Error)
      );
    });

    it('should trim whitespace in descriptions and formatting config output', async () => {
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
        {
          enabled: true,
          prefix: '  Activity: ',
          suffix: '.   ',
        }
      );

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

      expect(result).toBe('Activity: entity_1 keeps watch Perimeter Guard.');
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'entity_2'
      );

      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
        {
          enabled: true,
          prefix: 'Activity: ',
          suffix: '.',
        }
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

      expect(result).toBe('Activity: entity_1 acknowledges missing_target.');

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
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
        {
          enabled: true,
        }
      );

      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          actorId: 'entity_1',
          verb: 'gestures',
        },
      ]);

      const result = await service.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: entity_1 gestures.');

      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
        {
          enabled: true,
          prefix: 'Activity: ',
          suffix: '.',
        }
      );
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

      expect(result).toBe('Activity: entity_1 greets warmly entity_2.');

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
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        activityIndex: lightweightIndex,
      });

      const result =
        await serviceWithoutGetter.generateActivityDescription('entity_1');

      expect(result).toBe('Activity: entity_1 observes.');
      expect(lightweightIndex.findActivitiesForEntity).toHaveBeenCalledWith(
        'entity_1'
      );
    });
  });

  describe('event dispatch error handling', () => {
    it('logs error when event bus dispatch fails', async () => {
      const failingEventBus = {
        dispatch: jest.fn(() => {
          throw new Error('dispatch failure');
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const serviceWithEventBus = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        eventBus: failingEventBus,
      });

      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('lookup failed');
      });

      const result =
        await serviceWithEventBus.generateActivityDescription('entity_1');

      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to dispatch activity description error event',
        expect.any(Error)
      );

      serviceWithEventBus.destroy();
    });
  });

  describe('cache lifecycle management', () => {
    const createSetIntervalSpy = () => {
      const unrefMock = jest.fn();
      const setIntervalSpy = jest
        .spyOn(global, 'setInterval')
        .mockImplementation((handler) => {
          // Immediately register the handler without scheduling execution.
          return { unref: unrefMock };
        });
      return { setIntervalSpy, unrefMock };
    };

    it('calls unref on the cleanup interval when available', () => {
      const { setIntervalSpy, unrefMock } = createSetIntervalSpy();
      const clearIntervalSpy = jest
        .spyOn(global, 'clearInterval')
        .mockImplementation(() => {});

      const localService = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      });

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
      expect(unrefMock).toHaveBeenCalled();

      localService.destroy();
      expect(clearIntervalSpy).toHaveBeenCalled();

      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    const captureCacheReference = (action) => {
      const originalSet = Map.prototype.set;
      let capturedMap = null;
      const mapSpy = jest
        .spyOn(Map.prototype, 'set')
        .mockImplementation(function (key, value) {
          capturedMap = this;
          return originalSet.call(this, key, value);
        });

      action();

      mapSpy.mockRestore();

      if (!capturedMap) {
        throw new Error('Failed to capture cache reference');
      }

      return capturedMap;
    };

    it('cleans up expired and invalid cache entries and enforces capacity limits', () => {
      const { setIntervalSpy } = createSetIntervalSpy();

      const localService = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      });

      const hooks = localService.getTestHooks();

      const entityNameCache = captureCacheReference(() =>
        hooks.setEntityNameCacheEntry('keep', 'value')
      );

      entityNameCache.set('ghost', undefined);
      entityNameCache.set('stale', {
        value: 'old',
        expiresAt: Date.now() - 1000,
      });
      entityNameCache.set('keep', {
        value: 'fresh',
        expiresAt: Date.now() + 1000,
      });

      const activityIndexCache = captureCacheReference(() =>
        hooks.setActivityIndexCacheEntry('seed', {
          signature: 'sig',
          index: hooks.buildActivityIndex([]),
        })
      );

      for (let i = 0; i < 101; i += 1) {
        activityIndexCache.set(`extra-${i}`, {
          value: i,
          expiresAt: Date.now() + 1000,
        });
      }

      hooks.cleanupCaches();

      expect(entityNameCache.has('ghost')).toBe(false);
      expect(entityNameCache.has('stale')).toBe(false);
      expect(entityNameCache.has('keep')).toBe(true);
      expect(activityIndexCache.size).toBe(0);

      localService.destroy();
      setIntervalSpy.mockRestore();
    });

    it('exposes activity index caching helpers for deterministic reuse', () => {
      const { setIntervalSpy } = createSetIntervalSpy();

      const localService = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      });

      const hooks = localService.getTestHooks();

      const emptyIndex = hooks.getActivityIndex([], 'cache-key');
      expect(emptyIndex.byPriority).toEqual([]);
      expect(emptyIndex.byTarget instanceof Map).toBe(true);

      const activities = [
        {
          type: 'inline',
          sourceComponent: 'core:pose',
          targetEntityId: 'target-1',
          priority: 80,
        },
        {
          type: 'dedicated',
          descriptionType: 'custom',
          targetId: 'target-2',
          priority: 40,
        },
      ];

      const uncachedIndex = hooks.getActivityIndex(activities);
      expect(uncachedIndex.byPriority[0]).toBe(activities[0]);

      const cacheKey = 'priority:test-entity';
      const firstIndex = hooks.getActivityIndex(activities, cacheKey);
      expect(firstIndex.byPriority[0]).toBe(activities[0]);

      const snapshotAfterFirst = hooks.getCacheSnapshot();
      expect(snapshotAfterFirst.activityIndex.has(cacheKey)).toBe(true);

      const cachedIndex = hooks.getActivityIndex(activities, cacheKey);
      expect(cachedIndex).toBe(firstIndex);

      const updatedActivities = [
        { ...activities[0] },
        { ...activities[1], targetEntityId: 'target-3' },
      ];

      const rebuiltIndex = hooks.getActivityIndex(updatedActivities, cacheKey);
      expect(rebuiltIndex).not.toBe(firstIndex);

      localService.destroy();
      setIntervalSpy.mockRestore();
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
          if (id === 'anatomy:body')
            return {
              /* body data */
            };
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
            return {
              /* metadata */
            };
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

    it('should treat undefined shouldDescribeInActivity as true (schema default)', async () => {
      // This test verifies the fix for the bug where undefined shouldDescribeInActivity
      // was treated as falsy, preventing activities from being collected
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['positioning:hugging'],
        getComponentData: jest.fn((id) => {
          if (id === 'positioning:hugging') {
            return {
              embraced_entity_id: 'alicia',
              activityMetadata: {
                // shouldDescribeInActivity is undefined (omitted) - should default to true
                template: '{actor} is hugging {target}',
                targetRole: 'embraced_entity_id',
                priority: 66,
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

      // Verify activity was collected despite shouldDescribeInActivity being undefined
      expect(result).toBeTruthy();
      expect(result).toContain('hugging');
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'positioning:hugging'
      );
    });

    it('should skip activities when shouldDescribeInActivity is explicitly false', async () => {
      const mockEntity = {
        id: 'jon',
        componentTypeIds: ['hidden:activity'],
        getComponentData: jest.fn((id) => {
          if (id === 'hidden:activity') {
            return {
              entityId: 'someone',
              activityMetadata: {
                shouldDescribeInActivity: false, // Explicitly hidden
                template: '{actor} is doing something',
              },
            };
          }
          return null;
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const result = await service.generateActivityDescription('jon');

      // Should return empty string because activity is explicitly hidden
      expect(result).toBe('');
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
          componentTypeIds: [
            'kissing:kissing',
            'activity:description_metadata',
            'core:name',
          ],
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
          hasComponent: jest.fn(
            (compId) => compId === 'activity:description_metadata'
          ),
          getComponentData: jest.fn(
            (compId) => mockEntity.components[compId] || null
          ),
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
        const problematicEntity = {
          id: 'entity_1',
          componentTypeIds: ['activity:description_metadata'],
          hasComponent: jest.fn(() => {
            throw new Error('Dedicated metadata failure');
          }),
          getComponentData: jest.fn(),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(problematicEntity);
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('entity_1');

        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Failed to verify dedicated metadata component'
          ),
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
          getComponentData: jest.fn(
            (compId) => mockEntity.components[compId] || null
          ),
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
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'kissing:kissing'
        );
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
          getComponentData: jest.fn(
            (compId) => mockEntity.components[compId] || null
          ),
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
          hasComponent: jest.fn(
            (compId) => compId === 'activity:description_metadata'
          ),
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
          hasComponent: jest.fn(
            (compId) => compId === 'activity:description_metadata'
          ),
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
          componentTypeIds: [
            'positioning:hugging',
            'positioning:standing',
            'activity:description_metadata',
            'core:name',
          ],
          components: {
            'positioning:hugging': {
              embraced_entity_id: 'alicia',
              initiated: true,
            },
            'positioning:standing': {},
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
          hasComponent: jest.fn(
            (compId) =>
              compId === 'activity:description_metadata' ||
              compId === 'positioning:standing'
          ),
          getComponentData: jest.fn(
            (compId) => mockEntity.components[compId] || null
          ),
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
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'positioning:hugging'
        );
      });

      it('should default priority to 50 when not specified', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: [
            'core:action',
            'activity:description_metadata',
            'core:name',
          ],
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
          hasComponent: jest.fn(
            (compId) => compId === 'activity:description_metadata'
          ),
          getComponentData: jest.fn(
            (compId) => mockEntity.components[compId] || null
          ),
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
          hasComponent: jest.fn(
            (compId) => compId === 'activity:description_metadata'
          ),
          getComponentData: jest.fn(() => {
            throw new Error('Unexpected parsing error');
          }),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const result = await service.generateActivityDescription('jon');

        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to read dedicated metadata for jon',
          expect.any(Error)
        );
      });

      it('should use targetRole to resolve correct target entity', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: [
            'social:greeting',
            'activity:description_metadata',
            'core:name',
          ],
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
          hasComponent: jest.fn(
            (compId) => compId === 'activity:description_metadata'
          ),
          getComponentData: jest.fn(
            (compId) => mockEntity.components[compId] || null
          ),
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
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'social:greeting'
        );
      });

      it('should default to entityId when targetRole is not specified', async () => {
        const mockEntity = {
          id: 'jon',
          componentTypeIds: [
            'core:interaction',
            'activity:description_metadata',
            'core:name',
          ],
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
          hasComponent: jest.fn(
            (compId) => compId === 'activity:description_metadata'
          ),
          getComponentData: jest.fn(
            (compId) => mockEntity.components[compId] || null
          ),
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
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'core:interaction'
        );
      });
    });
  });

  describe('Template-Based Phrase Generation (Phase 2)', () => {
    beforeEach(() => {
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
        {
          enabled: true,
          prefix: 'Activity: ',
          suffix: '',
          separator: '. ',
        }
      );
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
      expect(result).toBe(
        'Activity: Jon Ureña is kneeling before Alicia Western'
      );
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
      expect(result).toBe(
        'Activity: Jon Ureña is kissing Alicia Western fiercely'
      );
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
      expect(result).toBe(
        'Activity: Jon Ureña is hugging Alicia Western tightly'
      );
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
      mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
        {
          prefix: '>>> ',
          suffix: ' <<<',
          separator: ' | ',
        }
      );

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
          targetEntityId: null,
          priority: 50,
        },
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
      expect(result).toBe(
        'Activity: Jon Ureña is interacting with Alicia Western'
      );
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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const result = await service.generateActivityDescription('jon');
        expect(result).toBeTruthy();
      });

      it('should detect female gender from core:gender component', async () => {
        const mockEntity = createEntityWithGender(
          'alicia',
          'Alicia Western',
          'female'
        );

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} smiles',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const result = await service.generateActivityDescription('person');
        expect(result).toBeTruthy();
      });

      it('should handle neutral gender explicitly', async () => {
        const mockEntity = createEntityWithGender(
          'alex',
          'Alex Smith',
          'neutral'
        );

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} nods',
            priority: 60,
          },
        ]);

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('jon');
        expect(result).toBe('Activity: Jon Ureña stands. he waves');
      });

      it('should use "she" for female actors in subsequent activities', async () => {
        const mockActor = createEntityWithGender(
          'alicia',
          'Alicia Western',
          'female'
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('alicia');
        expect(result).toBe('Activity: Alicia Western sits. she smiles');
      });

      it('should use "they" for neutral actors in subsequent activities', async () => {
        const mockActor = createEntityWithGender(
          'alex',
          'Alex Smith',
          'neutral'
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('jon');
        expect(result).toBe('Activity: Jon Ureña enters');
        expect(result).not.toContain(' he ');
      });
    });

    describe('Object Pronoun Usage for Targets', () => {
      it('should use "him" for male targets when pronouns enabled', async () => {
        const mockActor = createEntityWithGender(
          'alicia',
          'Alicia Western',
          'female'
        );
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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

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
        const mockTarget = createEntityWithGender(
          'alicia',
          'Alicia Western',
          'female'
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

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
        const mockTarget = createEntityWithGender(
          'alex',
          'Alex Smith',
          'neutral'
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: false,
            },
          }
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
          }
        );

        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = await service.generateActivityDescription('jon');
        expect(result).toBeTruthy();
      });
    });

    describe('Complex Activity Scenarios', () => {
      it('should handle three activities with mixed pronouns', async () => {
        const mockActor = createEntityWithGender('jon', 'Jon Ureña', 'male');
        const mockTarget = createEntityWithGender(
          'alicia',
          'Alicia Western',
          'female'
        );

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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

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
        const mockActor = createEntityWithGender(
          'alicia',
          'Alicia Western',
          'female'
        );
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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

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

      const createInlineActivity = (
        template,
        targetId,
        priority,
        overrides = {}
      ) => ({
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
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: { usePronounsWhenAvailable: true },
            maxActivities: 5,
          }
        );

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

    describe('Conditional visibility (ACTDESC-018)', () => {
      let entityStore;

      const registerEntity = (entity) => {
        entityStore.set(entity.id, entity);
        return entity;
      };

      const createEntity = (id, name = id, gender = 'neutral') => {
        const components = {
          'core:name': { text: name },
          'core:gender': { value: gender },
        };
        const componentTypeIds = ['core:name', 'core:gender'];

        return {
          id,
          componentTypeIds,
          components,
          hasComponent(componentId) {
            return Object.prototype.hasOwnProperty.call(
              components,
              componentId
            );
          },
          getComponentData(componentId) {
            return components[componentId] ?? null;
          },
        };
      };

      const addComponent = (entity, componentId, data) => {
        entity.components[componentId] = data;
        if (!entity.componentTypeIds.includes(componentId)) {
          entity.componentTypeIds.push(componentId);
        }
      };

      const addInlineActivity = (
        entity,
        {
          template,
          targetId = null,
          priority = 50,
          conditions = null,
          componentId = `test:activity_${entity.componentTypeIds.length}`,
          sourceData = {},
        }
      ) => {
        const metadata = {
          shouldDescribeInActivity: true,
          template,
          priority,
        };

        if (targetId) {
          metadata.targetRole = 'targetId';
        }

        if (conditions) {
          metadata.conditions = conditions;
        }

        const componentData = {
          ...sourceData,
          targetId,
          activityMetadata: metadata,
        };

        addComponent(entity, componentId, componentData);

        return componentId;
      };

      beforeEach(() => {
        entityStore = new Map();
        mockJsonLogicEvaluationService.evaluate.mockClear();
        mockJsonLogicEvaluationService.evaluate.mockImplementation(() => true);
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (entityStore.has(id)) {
            return entityStore.get(id);
          }

          return {
            id,
            componentTypeIds: [],
            hasComponent: () => false,
            getComponentData: () => null,
          };
        });
      });

      it('should enforce showOnlyIfProperty rules', async () => {
        const actor = registerEntity(createEntity('jon', 'Jon Ureña', 'male'));
        const target = registerEntity(
          createEntity('alicia', 'Alicia Western', 'female')
        );

        const componentId = addInlineActivity(actor, {
          template: '{actor} is kissing {target}',
          targetId: target.id,
          priority: 85,
          conditions: {
            showOnlyIfProperty: {
              property: 'initiator',
              equals: true,
            },
          },
          componentId: 'intimacy:kissing',
          sourceData: { initiator: false },
        });

        let description = await service.generateActivityDescription(actor.id);
        expect(description).not.toContain('kissing');

        actor.components[componentId].initiator = true;

        description = await service.generateActivityDescription(actor.id);
        expect(description).toContain('kissing');
      });

      it('should require components for visibility', async () => {
        const actor = registerEntity(createEntity('jon', 'Jon Ureña', 'male'));

        addInlineActivity(actor, {
          template: '{actor} is kneeling',
          priority: 70,
          conditions: {
            requiredComponents: ['positioning:kneeling_before'],
          },
          componentId: 'positioning:kneeling_before_meta',
        });

        let description = await service.generateActivityDescription(actor.id);
        expect(description).not.toContain('kneeling');

        addComponent(actor, 'positioning:kneeling_before', {
          entityId: 'alicia',
        });

        description = await service.generateActivityDescription(actor.id);
        expect(description).toContain('kneeling');
      });

      it('should forbid components for visibility', async () => {
        const actor = registerEntity(createEntity('jon', 'Jon Ureña', 'male'));

        addInlineActivity(actor, {
          template: '{actor} is meditating',
          priority: 60,
          conditions: {
            forbiddenComponents: ['positioning:standing'],
          },
          componentId: 'mindfulness:meditation',
        });

        let description = await service.generateActivityDescription(actor.id);
        expect(description).toContain('meditating');

        addComponent(actor, 'positioning:standing', {});

        description = await service.generateActivityDescription(actor.id);
        expect(description).not.toContain('meditating');
      });

      it('should evaluate custom JSON Logic', async () => {
        const actor = registerEntity(createEntity('jon', 'Jon Ureña', 'male'));
        const target = registerEntity(
          createEntity('alicia', 'Alicia Western', 'female')
        );

        addComponent(actor, 'relationships:partner', { entityId: target.id });

        const customLogic = {
          in: [
            'alicia',
            { var: 'entity.components.relationships:partner.entityId' },
          ],
        };

        addInlineActivity(actor, {
          template: '{actor} is embracing {target}',
          targetId: target.id,
          priority: 85,
          conditions: {
            customLogic,
          },
          componentId: 'intimacy:embrace',
        });

        mockJsonLogicEvaluationService.evaluate.mockImplementation(
          (logic, context) => {
            expect(logic).toBe(customLogic);
            expect(
              context.entity.components['relationships:partner'].entityId
            ).toBe(target.id);
            expect(context.target?.id).toBe(target.id);
            return true;
          }
        );

        const description = await service.generateActivityDescription(actor.id);

        expect(description).toContain('embracing');
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalled();
      });

      it('should handle missing conditions gracefully', async () => {
        const actor = registerEntity(createEntity('jon', 'Jon Ureña', 'male'));

        addInlineActivity(actor, {
          template: '{actor} is waving',
          priority: 50,
          componentId: 'social:waving',
        });

        const description = await service.generateActivityDescription(actor.id);

        expect(description).toContain('waving');
      });

      it('should fail open on JSON Logic errors', async () => {
        const actor = registerEntity(createEntity('jon', 'Jon Ureña', 'male'));

        addInlineActivity(actor, {
          template: '{actor} is waving',
          priority: 50,
          conditions: {
            customLogic: { invalid: 'logic' },
          },
          componentId: 'social:waving_invalid',
        });

        mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
          throw new Error('bad logic');
        });

        const description = await service.generateActivityDescription(actor.id);

        expect(description).toContain('waving');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to evaluate custom logic',
          expect.any(Error)
        );
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
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '.',
            separator: '. ',
            enableContextAwareness: true,
            nameResolution: { usePronounsWhenAvailable: false },
          }
        );
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

        expect(description).toMatch(/holding hands/i);
        expect(description).not.toMatch(/tenderly/);
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

        expect(description).toMatch(/embracing/i);
        expect(description).toMatch(/whispering/i);
        expect(description).not.toMatch(/tenderly/);
      });

      it('can disable context awareness via configuration', async () => {
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '.',
            separator: '. ',
            enableContextAwareness: false,
          }
        );

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

    describe('Test hooks', () => {
      it('merges adverbs across edge cases', () => {
        const hooks = service.getTestHooks();

        expect(hooks.mergeAdverb('calmly', '   ')).toBe('calmly');
        expect(hooks.mergeAdverb('   ', 'tenderly')).toBe('tenderly');
        expect(hooks.mergeAdverb('Softly', 'tenderly')).toBe('Softly tenderly');
        expect(hooks.mergeAdverb('Tenderly', 'tenderly')).toBe('Tenderly');
        expect(hooks.mergeAdverb(null, 'tenderly')).toBe('tenderly');
        expect(hooks.mergeAdverb('calmly', null)).toBe('calmly');
      });

      it('injects contextual softeners appropriately', () => {
        const hooks = service.getTestHooks();
        const templateObj = { value: 'raw' };

        expect(hooks.injectSoftener(templateObj, 'tenderly')).toBe(templateObj);
        expect(hooks.injectSoftener('{actor} signals', 'tenderly')).toBe(
          '{actor} signals'
        );
        expect(
          hooks.injectSoftener('{actor} greets tenderly {target}', 'tenderly')
        ).toBe('{actor} greets tenderly {target}');
        expect(hooks.injectSoftener('{actor} meets {target}', 'tenderly')).toBe(
          '{actor} meets tenderly {target}'
        );
        expect(hooks.injectSoftener('{actor} meets {target}', '   ')).toBe(
          '{actor} meets {target}'
        );
      });

      it('sanitizes verb phrases for grouping logic', () => {
        const hooks = service.getTestHooks();

        expect(hooks.sanitizeVerbPhrase(null)).toBe('');
        expect(hooks.sanitizeVerbPhrase('   ')).toBe('');
        expect(hooks.sanitizeVerbPhrase('is watching closely')).toBe(
          'watching closely'
        );
      });

      it('builds related activity fragments across conjunction scenarios', () => {
        const hooks = service.getTestHooks();
        const baseContext = {
          actorName: 'Jon',
          actorReference: 'Jon',
          actorPronouns: { subject: 'he' },
          pronounsEnabled: false,
        };

        expect(
          hooks.buildRelatedActivityFragment('and', null, baseContext)
        ).toBe('');

        expect(
          hooks.buildRelatedActivityFragment(
            'and',
            { verbPhrase: '', fullPhrase: '' },
            baseContext
          )
        ).toBe('');

        expect(
          hooks.buildRelatedActivityFragment(
            'while',
            {
              verbPhrase: 'is watching them',
              fullPhrase: 'Jon is watching them',
            },
            baseContext
          )
        ).toBe('while watching them');

        const pronounContext = {
          actorName: 'Jon',
          actorReference: 'Jon',
          actorPronouns: { subject: 'they' },
          pronounsEnabled: true,
        };

        expect(
          hooks.buildRelatedActivityFragment(
            'while',
            {
              verbPhrase: 'guarding the door',
              fullPhrase: 'Jon is guarding the door',
            },
            pronounContext
          )
        ).toBe('while they guarding the door');

        expect(
          hooks.buildRelatedActivityFragment(
            'while',
            { verbPhrase: '   ', fullPhrase: ' Jon stands guard ' },
            baseContext
          )
        ).toBe('while Jon stands guard');

        expect(
          hooks.buildRelatedActivityFragment(
            undefined,
            { verbPhrase: '   ' },
            baseContext
          )
        ).toBe('');

        expect(
          hooks.buildRelatedActivityFragment(
            'and',
            {
              verbPhrase: 'patrolling the hall',
              fullPhrase: 'Jon is patrolling the hall',
            },
            baseContext
          )
        ).toBe('and patrolling the hall');

        expect(
          hooks.buildRelatedActivityFragment(
            'while',
            { verbPhrase: 'staring ahead', fullPhrase: 'Staring ahead' },
            {
              actorName: '',
              actorReference: '',
              actorPronouns: { subject: '' },
              pronounsEnabled: false,
            }
          )
        ).toBe('while staring ahead');

        expect(
          hooks.buildRelatedActivityFragment(
            'while',
            { verbPhrase: '', fullPhrase: '   ' },
            baseContext
          )
        ).toBe('');

        expect(
          hooks.buildRelatedActivityFragment(
            'and',
            { verbPhrase: null, fullPhrase: '  Keeps watch  ' },
            baseContext
          )
        ).toBe('and Keeps watch');
      });

      it('uses the object pronoun for self-targets when reflexives are disabled', () => {
        const hooks = service.getTestHooks();
        const phrase = hooks.generateActivityPhrase(
          'Alex',
          {
            type: 'inline',
            template: '{actor} greets {target}',
            targetEntityId: 'actor-self',
          },
          true,
          {
            actorId: 'actor-self',
            actorName: 'Alex',
            actorPronouns: { subject: 'he', object: 'him' },
            preferReflexivePronouns: false,
          }
        );

        expect(phrase).toBe('Alex greets him');
      });

      it('evaluates visibility and condition helpers through hooks', () => {
        const hooks = service.getTestHooks();
        const activity = {
          sourceData: {},
          conditions: {
            customLogic: { some: 'rule' },
            requiredComponents: ['pose:stance'],
            forbiddenComponents: ['pose:resting'],
            showOnlyIfProperty: { equals: 'ready' },
          },
        };

        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

        const entity = {
          hasComponent: jest
            .fn()
            .mockImplementation((componentId) => componentId === 'pose:stance'),
        };

        const visible = hooks.evaluateActivityVisibility(activity, entity);

        expect(visible).toBe(false);
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
          activity.conditions.customLogic,
          expect.objectContaining({ entity: expect.any(Object) })
        );
        expect(hooks.isEmptyConditionsObject(null)).toBe(true);
        expect(
          hooks.matchesPropertyCondition(activity, {
            equals: 'ready',
          })
        ).toBe(true);
        expect(
          hooks.hasRequiredComponents(
            null,
            activity.conditions.requiredComponents
          )
        ).toBe(false);
        expect(
          hooks.hasForbiddenComponents(
            null,
            activity.conditions.forbiddenComponents
          )
        ).toBe(false);
        expect(
          hooks.evaluateActivityVisibility(
            {
              metadata: { shouldDescribeInActivity: false },
              conditions: { requiredComponents: ['pose:stance'] },
            },
            entity
          )
        ).toBe(false);
        expect(
          hooks.matchesPropertyCondition(
            { sourceData: { stance: 'ready' } },
            { property: 'stance', equals: 'ready' }
          )
        ).toBe(true);
        expect(
          hooks.matchesPropertyCondition(
            { sourceData: { stance: 'idle' } },
            { property: 'stance', equals: 'ready' }
          )
        ).toBe(false);
        expect(
          hooks.hasRequiredComponents(
            { hasComponent: (id) => id === 'pose:stance' },
            activity.conditions.requiredComponents
          )
        ).toBe(true);
        expect(
          hooks.hasForbiddenComponents(
            { hasComponent: (id) => id === 'pose:resting' },
            activity.conditions.forbiddenComponents
          )
        ).toBe(true);
      });

      it('builds logic context while tolerating missing targets', () => {
        const hooks = service.getTestHooks();
        const entity = {
          id: 'actor-1',
          componentTypeIds: ['core:name'],
          getComponentData: jest.fn(() => ({ text: 'Actor' })),
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'target-1') {
            throw new Error('missing target');
          }
          return entity;
        });

        const context = hooks.buildLogicContext(
          {
            sourceData: { verb: 'watching' },
            targetEntityId: 'target-1',
          },
          entity
        );

        expect(context.activity).toEqual({ verb: 'watching' });
        expect(context.target).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          "Failed to resolve target entity 'target-1' for activity conditions",
          expect.any(Error)
        );
        expect(hooks.extractEntityData(null)).toBeNull();

        const contextWithoutSource = hooks.buildLogicContext({}, entity);
        expect(contextWithoutSource.activity).toEqual({});
      });

      it('builds activity context with caching and warning recovery', () => {
        const hooks = service.getTestHooks();

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'actor-1') {
            throw new Error('no closeness');
          }
          if (id === 'target-1') {
            return {
              id: 'target-1',
              componentTypeIds: ['core:gender'],
              getComponentData: jest.fn((componentId) => {
                if (componentId === 'core:gender') {
                  return { value: 'female' };
                }
                return undefined;
              }),
            };
          }
          return { id, componentTypeIds: [], getComponentData: jest.fn() };
        });

        const firstContext = hooks.buildActivityContext('actor-1', {
          targetEntityId: 'target-1',
          priority: 95,
        });

        expect(firstContext.intensity).toBe('intense');
        expect(firstContext.targetGender).toBe('female');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to retrieve closeness data for actor-1',
          expect.any(Error)
        );

        mockLogger.warn.mockClear();

        const secondContext = hooks.buildActivityContext('actor-1', {
          targetEntityId: 'target-1',
          priority: 10,
        });

        expect(secondContext.intensity).toBe('casual');
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('applies contextual tone overrides for dedicated activities', () => {
        const hooks = service.getTestHooks();

        const intimate = hooks.applyContextualTone(
          { type: 'dedicated', template: '{actor} embraces {target}' },
          { targetId: 'target-1', relationshipTone: 'closeness_partner' }
        );

        expect(intimate.contextualTone).toBe('intimate');
        expect(intimate.adverb).toBeUndefined();
        expect(intimate.template).toBe('{actor} embraces {target}');

        const intense = hooks.applyContextualTone(
          {
            type: 'dedicated',
            adverb: 'quietly',
            template: '{actor} studies {target}',
          },
          { targetId: 'target-1', intensity: 'intense' }
        );

        expect(intense.adverb).toBe('quietly fiercely');
        expect(intense.template).toContain('fiercely {target}');
      });

      it('generates empty fragments when phrases cannot be constructed', () => {
        const hooks = service.getTestHooks();

        const fragments = hooks.generateActivityPhrase(
          'Jon',
          {
            type: 'inline',
            description: '   ',
            activityMetadata: {},
          },
          false,
          { omitActor: true }
        );

        expect(fragments).toEqual({ fullPhrase: '', verbPhrase: '' });

        const fragmentsWithoutActor = hooks.generateActivityPhrase(
          '   ',
          {
            type: 'inline',
            template: '{actor} observes {target}',
            targetId: 'someone',
          },
          false,
          { omitActor: true }
        );

        expect(fragmentsWithoutActor.verbPhrase).toBe('observes someone');

        const actorFragments = hooks.generateActivityPhrase(
          'Jon',
          {
            type: 'inline',
            template: '{actor} reassures {target}',
            targetId: 'friend',
          },
          false,
          { omitActor: true }
        );

        expect(actorFragments.verbPhrase).toBe('reassures friend');

        const defaultPronounInvocation = hooks.generateActivityPhrase('Jon', {
          type: 'inline',
          template: '{actor} lingers',
        });

        expect(defaultPronounInvocation).toBe('Jon lingers');

        const nullActorFragments = hooks.generateActivityPhrase(
          null,
          {
            type: 'inline',
            template: '{actor} signals {target}',
            targetId: 'partner',
          },
          false,
          { omitActor: true }
        );

        expect(nullActorFragments.fullPhrase).toBe('null signals partner');
      });

      it('resolves unnamed entities by their identifier when caching lookups', async () => {
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: '',
            suffix: '',
            separator: '. ',
            enableContextAwareness: false,
            nameResolution: { usePronounsWhenAvailable: false },
          }
        );

        const actorEntity = {
          id: 'jon',
          componentTypeIds: ['core:name'],
          hasComponent: jest.fn(() => false),
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: 'Jon' };
            }
            if (componentId === 'core:gender') {
              return { value: 'male' };
            }
            return null;
          }),
        };

        const unnamedTarget = {
          id: 'mysterious-target',
          componentTypeIds: [],
          hasComponent: jest.fn(() => false),
          getComponentData: jest.fn(() => null),
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') {
            return actorEntity;
          }
          if (id === 'target-entity') {
            return unnamedTarget;
          }

          return {
            id,
            componentTypeIds: [],
            hasComponent: jest.fn(() => false),
            getComponentData: jest.fn(() => null),
          };
        });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            type: 'inline',
            template: '{actor} observes {target}',
            targetEntityId: 'target-entity',
            priority: 90,
          },
        ]);

        const description = await service.generateActivityDescription('jon');

        expect(description).toBe('Jon observes mysterious-target');
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
          'target-entity'
        );
        expect(unnamedTarget.getComponentData).toHaveBeenCalledWith(
          'core:name'
        );

        mockEntityManager.getEntityInstance.mockClear();

        const hooks = service.getTestHooks();
        const cachedPhrase = hooks.generateActivityPhrase(
          'Jon',
          {
            type: 'inline',
            template: '{actor} greets {target}',
            targetId: 'target-entity',
          },
          false
        );

        expect(cachedPhrase).toBe('Jon greets mysterious-target');
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      it('filters collections and resolves pronoun/intensity helpers', () => {
        const hooks = service.getTestHooks();

        expect(hooks.filterByConditions(null, {})).toEqual([]);
        expect(hooks.filterByConditions([], {})).toEqual([]);

        expect(hooks.determineActivityIntensity(95)).toBe('intense');
        expect(hooks.determineActivityIntensity(75)).toBe('elevated');
        expect(hooks.determineActivityIntensity(10)).toBe('casual');

        expect(
          hooks.determineConjunction({ priority: 10 }, { priority: 8 })
        ).toBe('while');
        expect(
          hooks.determineConjunction({ priority: 10 }, { priority: 40 })
        ).toBe('and');
        expect(hooks.activitiesOccurSimultaneously(10, 19)).toBe(true);
        expect(hooks.activitiesOccurSimultaneously(10, 50)).toBe(false);
        expect(hooks.determineConjunction({}, {})).toBe('while');
        expect(hooks.determineConjunction({}, { priority: 100 })).toBe('and');
        expect(hooks.activitiesOccurSimultaneously()).toBe(true);

        expect(hooks.getPronounSet('unknown').subject).toBe('they');
        expect(hooks.getPronounSet('custom').object).toBe('them');
        expect(hooks.getPronounSet().possessivePronoun).toBe('theirs');

        expect(
          hooks.matchesPropertyCondition(null, {
            property: 'stance',
            equals: 'ready',
          })
        ).toBe(false);
      });
    });

    describe('Test hook utilities', () => {
      it('builds related fragments and groups activities for edge cases', () => {
        const hooks = service.getTestHooks();
        const result = hooks.buildRelatedActivityFragment(
          'while',
          { fullPhrase: '   ', verbPhrase: '   ' },
          {
            actorName: 'Jon',
            actorReference: 'Jon',
            actorPronouns: { subject: 'he' },
            pronounsEnabled: true,
          }
        );

        expect(result).toBe('');
        expect(hooks.groupActivities(null)).toEqual([]);
      });

      it('resolves entity names and detects gender when data is missing', () => {
        const hooks = service.getTestHooks();

        expect(hooks.resolveEntityName(null)).toBe('Unknown entity');

        mockEntityManager.getEntityInstance
          .mockImplementationOnce(() => null)
          .mockImplementationOnce(() => ({
            getComponentData: jest.fn().mockReturnValue({ value: 'female' }),
          }));

        expect(hooks.resolveEntityName('ghost')).toBe('ghost');
        expect(hooks.detectEntityGender('')).toBe('unknown');
        expect(hooks.detectEntityGender('alice')).toBe('female');
      });

      it('exposes cache utilities for inspection and maintenance', () => {
        const hooks = service.getTestHooks();
        hooks.setEntityNameCacheEntry('actor', 'Jon');
        hooks.setGenderCacheEntry('actor', 'neutral');
        hooks.setActivityIndexCacheEntry('cache-key', {
          signature: 'sig',
          index: { all: [] },
        });

        const snapshot = hooks.getCacheSnapshot();
        expect(snapshot.entityName.get('actor').value).toBe('Jon');
        expect(snapshot.gender.get('actor').value).toBe('neutral');
        expect(snapshot.activityIndex.get('cache-key').value.signature).toBe(
          'sig'
        );
      });

      it('removes expired cache entries during scheduled cleanup', () => {
        const intervalSpy = jest
          .spyOn(globalThis, 'setInterval')
          .mockImplementation((fn) => ({ unref: jest.fn() }));

        const cleanupService = new ActivityDescriptionService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          anatomyFormattingService: mockAnatomyFormattingService,
          jsonLogicEvaluationService: mockJsonLogicEvaluationService,
          activityIndex: mockActivityIndex,
        });

        const hooks = cleanupService.getTestHooks();
        hooks.setEntityNameCacheRawEntry('stale', {
          value: 'old',
          expiresAt: -1,
        });
        expect(hooks.getCacheSnapshot().entityName.has('stale')).toBe(true);

        expect(intervalSpy).toHaveBeenCalled();
        const scheduled = intervalSpy.mock.calls[0][0];
        expect(typeof scheduled).toBe('function');

        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(10_000);
        scheduled();
        dateSpy.mockRestore();

        expect(hooks.getCacheSnapshot().entityName.has('stale')).toBe(false);

        cleanupService.destroy();
        intervalSpy.mockRestore();
      });

      it('drops invalid cache entries before resolving entity names', () => {
        const hooks = service.getTestHooks();

        mockEntityManager.getEntityInstance.mockImplementation((id) => ({
          id,
          getComponentData: jest.fn().mockImplementation((componentId) => {
            if (componentId === 'core:name') {
              return { text: `Name ${id}` };
            }
            return undefined;
          }),
        }));

        hooks.setEntityNameCacheRawEntry('ghost', undefined);
        expect(hooks.resolveEntityName('ghost')).toBe('Name ghost');

        const nowSpy = jest.spyOn(Date, 'now');
        nowSpy.mockReturnValue(1000);
        hooks.setEntityNameCacheRawEntry('expired', {
          value: 'Stale',
          expiresAt: 500,
        });
        nowSpy.mockReturnValue(1500);

        expect(hooks.resolveEntityName('expired')).toBe('Name expired');
        nowSpy.mockRestore();
      });

      it('provides pronoun and component helper access', () => {
        const hooks = service.getTestHooks();

        expect(hooks.getPronounSet('female')).toEqual(
          expect.objectContaining({ subject: 'she', object: 'her' })
        );
        expect(hooks.getPronounSet('unknown').subject).toBe('they');

        mockEntityManager.getEntityInstance.mockReturnValueOnce({
          id: 'entity-1',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:gender') {
              return { value: 'male' };
            }
            return null;
          }),
        });

        expect(hooks.detectEntityGender('entity-1')).toBe('male');
        expect(hooks.detectEntityGender(null)).toBe('unknown');

        expect(hooks.isEmptyConditionsObject(null)).toBe(true);
        expect(hooks.isEmptyConditionsObject({ active: true })).toBe(false);

        expect(
          hooks.matchesPropertyCondition(
            { sourceData: { status: 'ready' } },
            { property: 'status', equals: 'ready' }
          )
        ).toBe(true);
        expect(
          hooks.matchesPropertyCondition(
            { sourceData: { status: 'ready' } },
            { property: 'status', equals: 'idle' }
          )
        ).toBe(false);
        expect(hooks.matchesPropertyCondition({}, null)).toBe(true);

        const componentEntity = {
          id: 'component-entity',
          hasComponent: jest.fn((componentId) => componentId === 'core:trait'),
        };

        expect(
          hooks.hasRequiredComponents(componentEntity, ['core:trait'])
        ).toBe(true);
        expect(
          hooks.hasForbiddenComponents(componentEntity, ['core:trait'])
        ).toBe(true);
        expect(
          hooks.hasRequiredComponents({ hasComponent: null }, ['core:trait'])
        ).toBe(false);
        expect(
          hooks.hasForbiddenComponents({ hasComponent: null }, ['core:trait'])
        ).toBe(false);

        const extractionEntity = {
          id: 'extract-me',
          componentTypeIds: ['core:name'],
          getComponentData: jest.fn(() => ({ text: 'Extract' })),
        };

        expect(hooks.extractEntityData(extractionEntity)).toEqual({
          id: 'extract-me',
          components: { 'core:name': { text: 'Extract' } },
        });
        expect(hooks.extractEntityData(null)).toBeNull();
      });

      it('warns and filters out activities when visibility evaluation throws', () => {
        const hooks = service.getTestHooks();
        mockLogger.warn.mockClear();

        const faultyActivity = {};
        Object.defineProperty(faultyActivity, 'metadata', {
          enumerable: true,
          get() {
            throw new Error('metadata access failed');
          },
        });

        const result = hooks.filterByConditions([faultyActivity], {
          id: 'entity-1',
        });

        expect(result).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to evaluate activity visibility for activity metadata',
          expect.any(Error)
        );
      });

      it('handles required component iteration failures gracefully', () => {
        const hooks = service.getTestHooks();
        mockLogger.warn.mockClear();

        const entity = {
          id: 'entity-req',
          hasComponent: jest.fn().mockReturnValue(true),
        };

        const required = ['core:trait'];
        required.every = () => {
          throw new Error('every failed');
        };

        expect(hooks.hasRequiredComponents(entity, required)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to evaluate required components'),
          expect.any(Error)
        );
      });

      it('handles forbidden component evaluation failures', () => {
        const hooks = service.getTestHooks();
        mockLogger.warn.mockClear();

        const throwingEntity = {
          id: 'entity-forbidden',
          hasComponent: jest.fn(() => {
            throw new Error('lookup failed');
          }),
        };

        expect(
          hooks.hasForbiddenComponents(throwingEntity, ['core:trait'])
        ).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to verify forbidden component core:trait'),
          expect.any(Error)
        );

        mockLogger.warn.mockClear();

        const safeEntity = {
          id: 'entity-safe',
          hasComponent: jest.fn().mockReturnValue(false),
        };

        const forbidden = ['core:trait'];
        forbidden.some = () => {
          throw new Error('iteration failed');
        };

        expect(hooks.hasForbiddenComponents(safeEntity, forbidden)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to evaluate forbidden components'),
          expect.any(Error)
        );
      });

      it('deduplicates activities with invalid entries without mutating source', () => {
        const hooks = service.getTestHooks();

        expect(hooks.deduplicateActivitiesBySignature(null)).toEqual([]);

        const emptyActivities = [];
        const dedupedEmpty = hooks.deduplicateActivitiesBySignature(
          emptyActivities
        );
        expect(dedupedEmpty).toEqual([]);
        expect(dedupedEmpty).not.toBe(emptyActivities);

        const deduped = hooks.deduplicateActivitiesBySignature([
          null,
          {
            type: 'inline',
            template: '{actor} waits patiently',
            targetEntityId: 'target-1',
          },
        ]);

        expect(deduped).toHaveLength(1);
        expect(hooks.buildActivityDeduplicationKey(null)).toBe('invalid');
      });

      describe('formatActivityDescription edge cases', () => {
        it('returns an empty string for falsy or empty activity collections', () => {
          const hooks = service.getTestHooks();

          expect(hooks.formatActivityDescription(null, null)).toBe('');
          expect(hooks.formatActivityDescription([], { id: 'actor' })).toBe('');
        });

        it('short-circuits when activity integration is disabled in the config', () => {
          const hooks = service.getTestHooks();
          mockLogger.debug.mockClear();

          mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValueOnce({
            enabled: false,
          });

          const description = hooks.formatActivityDescription(
            [
              {
                type: 'inline',
                template: '{actor} waits',
                targetEntityId: 'target-disabled',
              },
            ],
            { id: 'actor-disabled' }
          );

          expect(description).toBe('');
          expect(mockLogger.debug).toHaveBeenCalledWith(
            'Activity description formatting disabled via configuration'
          );
        });

        it('handles iterable grouping results and phrase generation failures', () => {
          const hooks = service.getTestHooks();
          mockLogger.warn.mockClear();
          mockLogger.error.mockClear();

          const failingPrimary = {
            targetEntityId: 'target-iterable',
            priority: 100,
            grouping: { groupKey: 'shared-group' },
          };

          Object.defineProperty(failingPrimary, 'type', {
            enumerable: true,
            get() {
              throw new Error('primary phrase failure');
            },
          });

          Object.defineProperty(failingPrimary, 'toneFlag', {
            enumerable: true,
            get() {
              throw new Error('tone failure');
            },
          });

          const successfulPrimary = {
            type: 'inline',
            template: '{actor} observes {target}',
            targetEntityId: 'target-success',
            priority: 80,
            grouping: { groupKey: 'success-group' },
          };

          const relatedPhraseFailure = {
            targetEntityId: 'target-related',
            priority: 75,
            type: 'inline',
          };

          Object.defineProperty(relatedPhraseFailure, 'template', {
            enumerable: true,
            get() {
              throw new Error('related phrase failure');
            },
          });

          const fragmentWrapper = {
            activity: {
              type: 'inline',
              template: '{actor} nods at {target}',
              targetEntityId: 'target-fragment',
              priority: 60,
            },
          };

          Object.defineProperty(fragmentWrapper, 'conjunction', {
            enumerable: true,
            get() {
              throw new Error('fragment failure');
            },
          });

          const actorEntity = {
            id: 'actor-entity',
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Actor Name' };
              }

              if (componentId === 'core:gender') {
                return { value: 'male' };
              }

              return null;
            }),
          };

          const targetFactory = (id) => ({
            id,
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: `${id}-name` };
              }

              if (componentId === 'core:gender') {
                return { value: 'female' };
              }

              return null;
            }),
            hasComponent: jest.fn().mockReturnValue(true),
          });

          mockEntityManager.getEntityInstance.mockImplementation((id) => {
            if (id === 'actor-entity') {
              return actorEntity;
            }

            return targetFactory(id);
          });

          const originalIsArray = Array.isArray;
          const isArraySpy = jest
            .spyOn(Array, 'isArray')
            .mockImplementation((value) => {
              if (
                originalIsArray(value) &&
                value.length >= 0 &&
                value[0] &&
                typeof value[0] === 'object' &&
                Object.prototype.hasOwnProperty.call(value[0], 'primaryActivity') &&
                Object.prototype.hasOwnProperty.call(value[0], 'relatedActivities')
              ) {
                value.push(null);

                value.forEach((group, index) => {
                  if (
                    group &&
                    Object.prototype.hasOwnProperty.call(
                      group,
                      'relatedActivities'
                    ) &&
                    originalIsArray(group.relatedActivities)
                  ) {
                    group.relatedActivities.push(null);

                    if (index === 1) {
                      group.relatedActivities.push({
                        activity: relatedPhraseFailure,
                        conjunction: 'and',
                      });
                      group.relatedActivities.push(fragmentWrapper);
                    }
                  }
                });

                return false;
              }

              return originalIsArray(value);
            });

          const description = hooks.formatActivityDescription(
            [failingPrimary, successfulPrimary],
            actorEntity
          );

          expect(description).toContain('Activity:');

          expect(mockLogger.warn).toHaveBeenCalledWith(
            'Failed to apply contextual tone to activity',
            expect.any(Error)
          );
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to generate primary activity phrase',
            expect.any(Error)
          );
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to generate related activity phrase',
            expect.any(Error)
          );
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to build related activity fragment',
            expect.any(Error)
          );

          isArraySpy.mockRestore();
        });

        it('warns when grouped activities cannot be iterated', () => {
          const hooks = service.getTestHooks();
          mockLogger.warn.mockClear();

          const originalIsArray = Array.isArray;
          const isArraySpy = jest
            .spyOn(Array, 'isArray')
            .mockImplementation((value) => {
              if (
                originalIsArray(value) &&
                value.length >= 0 &&
                value[0] &&
                typeof value[0] === 'object' &&
                Object.prototype.hasOwnProperty.call(value[0], 'primaryActivity')
              ) {
                Object.defineProperty(value, 'forEach', {
                  configurable: true,
                  value: undefined,
                });
                return false;
              }

              return originalIsArray(value);
            });

          const description = hooks.formatActivityDescription(
            [
              {
                type: 'inline',
                template: '{actor} waves at {target}',
                targetEntityId: 'target-warning',
                priority: 10,
              },
            ],
            { id: 'actor-warning' }
          );

          expect(description).toBe('');
          expect(mockLogger.warn).toHaveBeenCalledWith(
            'Grouping activities returned unexpected data; ignoring result'
          );

          isArraySpy.mockRestore();
        });

        it('reports grouping failures when group construction throws', () => {
          const hooks = service.getTestHooks();
          mockLogger.error.mockClear();

          const throwingActivity = {
            type: 'inline',
            template: '{actor} studies the room',
            targetEntityId: 'target-throw',
            priority: 20,
          };

          Object.defineProperty(throwingActivity, 'grouping', {
            enumerable: true,
            get() {
              throw new Error('grouping failure');
            },
          });

          const description = hooks.formatActivityDescription(
            [throwingActivity],
            { id: 'actor-group' }
          );

          expect(description).toBe('');
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to group activities for formatting',
            expect.any(Error)
          );
        });
      });

      it('exposes subscription helpers for cache invalidation', () => {
        const hooks = service.getTestHooks();

        expect(() => hooks.subscribeToInvalidationEvents()).not.toThrow();

        mockLogger.warn.mockClear();
        const failingBus = {
          subscribe: jest.fn(() => {
            throw new Error('subscribe failed');
          }),
          dispatch: jest.fn(),
          unsubscribe: jest.fn(),
        };

        hooks.setEventBus(failingBus);
        hooks.subscribeToInvalidationEvents();

        expect(failingBus.subscribe).toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Failed to subscribe to cache invalidation event'
          ),
          expect.any(Error)
        );

        const handlers = {};
        const unsubscribe = jest.fn();
        const capturingBus = {
          subscribe: jest.fn((eventId, handler) => {
            handlers[eventId] = handler;
            return unsubscribe;
          }),
          dispatch: jest.fn(),
          unsubscribe: jest.fn(),
        };

        mockLogger.warn.mockClear();
        hooks.setEventBus(capturingBus);
        hooks.subscribeToInvalidationEvents();

        hooks.setEntityNameCacheEntry('entity-2', 'Name');
        hooks.setClosenessCacheEntry('entity-clos', ['partner']);
        expect(hooks.getCacheSnapshot().entityName.has('entity-2')).toBe(true);
        expect(hooks.getCacheSnapshot().closeness.has('entity-clos')).toBe(true);

        handlers[COMPONENT_ADDED_ID]({ payload: {} });
        expect(hooks.getCacheSnapshot().entityName.has('entity-2')).toBe(true);
        expect(hooks.getCacheSnapshot().closeness.has('entity-clos')).toBe(true);

        handlers[COMPONENT_REMOVED_ID]({ payload: {} });
        expect(hooks.getCacheSnapshot().entityName.has('entity-2')).toBe(true);
        expect(hooks.getCacheSnapshot().closeness.has('entity-clos')).toBe(true);

        hooks.setEntityNameCacheEntry('entity-2', 'Name');
        handlers[COMPONENT_ADDED_ID]({
          payload: {
            componentTypeId: NAME_COMPONENT_ID,
            entity: { id: 'entity-2' },
          },
        });

        expect(hooks.getCacheSnapshot().entityName.has('entity-2')).toBe(false);

        hooks.setClosenessCacheEntry('entity-clos', ['partner']);
        handlers[COMPONENT_ADDED_ID]({
          payload: {
            componentTypeId: 'positioning:closeness',
            entity: { id: 'entity-clos' },
          },
        });
        expect(hooks.getCacheSnapshot().closeness.has('entity-clos')).toBe(false);

        hooks.setClosenessCacheEntry('removed-clos', ['partner']);
        handlers[COMPONENT_REMOVED_ID]({
          payload: {
            componentTypeId: 'positioning:closeness',
            entity: { id: 'removed-clos' },
          },
        });
        expect(hooks.getCacheSnapshot().closeness.has('removed-clos')).toBe(false);

        hooks.setClosenessCacheEntry('batch-clos', ['partner']);
        handlers[COMPONENTS_BATCH_ADDED_ID]({
          payload: {
            updates: [
              {
                componentTypeId: 'positioning:closeness',
                instanceId: 'batch-clos',
              },
            ],
          },
        });
        expect(hooks.getCacheSnapshot().closeness.has('batch-clos')).toBe(false);

        hooks.setEventBus(null);
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

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValue(
          {
            prefix: 'Activity: ',
            suffix: '',
            separator: '. ',
            nameResolution: {
              usePronounsWhenAvailable: true,
            },
          }
        );

        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const result = await service.generateActivityDescription('broken');
        expect(result).toBeTruthy();
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('returns empty string and logs when entity lookup fails', async () => {
        mockEntityManager.getEntityInstance.mockReturnValueOnce(null);

        const description =
          await service.generateActivityDescription('missing');

        expect(description).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('missing')
        );
      });

      it('continues processing when inline metadata parsing throws', async () => {
        const entity = {
          id: 'jon',
          componentTypeIds: ['comp1', 'comp2'],
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'comp1') {
              return {
                activityMetadata: {
                  shouldDescribeInActivity: true,
                  template: '{actor} is invalid',
                },
                get entityId() {
                  throw new Error('Broken inline metadata');
                },
              };
            }

            if (componentId === 'comp2') {
              return {
                entityId: 'valid-target',
                activityMetadata: {
                  shouldDescribeInActivity: true,
                  template: '{actor} is valid',
                  priority: 75,
                },
              };
            }

            return null;
          }),
          hasComponent: jest.fn().mockReturnValue(false),
        };

        mockEntityManager.getEntityInstance.mockReturnValue(entity);
        mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

        const description = await service.generateActivityDescription('jon');

        expect(description).toContain('valid');
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('comp1'),
          expect.any(Error)
        );
      });

      it('warns and falls back when integration config is invalid', async () => {
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockReturnValueOnce(
          null
        );

        mockActivityIndex.findActivitiesForEntity.mockReturnValueOnce([
          {
            actorId: 'jon',
            description: 'greets everyone warmly',
            priority: 50,
            type: 'inline',
            template: '{actor} greets everyone warmly',
          },
        ]);

        mockEntityManager.getEntityInstance.mockImplementation((id) => ({
          id,
          componentTypeIds: [],
          hasComponent: jest.fn().mockReturnValue(false),
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return null;
          }),
        }));

        const description = await service.generateActivityDescription('jon');

        expect(description).toBe('Activity: jon greets everyone warmly.');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Activity integration config missing or invalid; using defaults'
        );
      });

      it('uses default formatting config when service throws', async () => {
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockImplementation(
          () => {
            throw new Error('Config error');
          }
        );

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            actorId: 'jon',
            description: 'performs a valid action',
            priority: 50,
          },
        ]);

        mockEntityManager.getEntityInstance.mockImplementation((id) => ({
          id,
          componentTypeIds: [],
          hasComponent: jest.fn().mockReturnValue(false),
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:name') {
              return { text: id };
            }
            return null;
          }),
        }));

        const description = await service.generateActivityDescription('jon');

        expect(description).toMatch(/^Activity:/);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to get activity integration config'),
          expect.any(Error)
        );
      });

      it('falls back to entityId when name resolution fails', () => {
        mockEntityManager.getEntityInstance.mockImplementation(() => {
          throw new Error('Entity manager error');
        });

        const hooks = service.getTestHooks();
        expect(hooks.resolveEntityName).toBeDefined();

        const name = hooks.resolveEntityName('entity_id');

        expect(name).toBe('entity_id');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('entity_id'),
          expect.any(Error)
        );
      });

      it('dispatches error events when eventBus is provided', async () => {
        const serviceWithEventBus = new ActivityDescriptionService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          anatomyFormattingService: mockAnatomyFormattingService,
          jsonLogicEvaluationService: mockJsonLogicEvaluationService,
          activityIndex: mockActivityIndex,
          eventBus: mockEventBus,
        });

        mockEntityManager.getEntityInstance.mockImplementation(() => {
          throw new Error('Critical error');
        });

        await serviceWithEventBus.generateActivityDescription('jon');

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ACTIVITY_DESCRIPTION_ERROR',
            payload: expect.objectContaining({ entityId: 'jon' }),
          })
        );
      });

      it('returns empty string on cascading failures without throwing', async () => {
        mockEntityManager.getEntityInstance.mockImplementation(() => {
          throw new Error('Entity error');
        });

        mockAnatomyFormattingService.getActivityIntegrationConfig.mockImplementation(
          () => {
            throw new Error('Config error');
          }
        );

        const description = await service.generateActivityDescription('jon');

        expect(description).toBe('');
      });
    });

    describe('edge case handling (ACTDESC-022)', () => {
      it('returns an empty string when no activities exist', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValueOnce([]);

        const description = await service.generateActivityDescription('jon');

        expect(description).toBe('');
      });

      it('deduplicates duplicate metadata before formatting', () => {
        const hooks = service.getTestHooks();
        const activities = [
          { template: '{actor} waves', targetEntityId: 'alicia', priority: 70 },
          { template: '{actor} waves', targetEntityId: 'alicia', priority: 80 },
        ];

        const deduplicated = hooks.deduplicateActivitiesBySignature(activities);

        expect(deduplicated).toHaveLength(1);
        expect(deduplicated[0].priority).toBe(80);
      });

      it('truncates extremely long descriptions', () => {
        const hooks = service.getTestHooks();
        const longDescription =
          'Activity: ' + 'Jon is doing something. '.repeat(50);

        const truncated = hooks.truncateDescription(longDescription, 500);

        expect(truncated.length).toBeLessThanOrEqual(500);
        expect(truncated.endsWith('.') || truncated.endsWith('...')).toBe(true);
      });

      it('sanitises entity names with special characters', () => {
        const hooks = service.getTestHooks();

        const sanitized = hooks.sanitizeEntityName('  Jon\x00Ureña  ');

        expect(sanitized).toBe('JonUreña');
      });

      it('uses reflexive pronouns for self-targeting activities', async () => {
        mockAnatomyFormattingService.getActivityIntegrationConfig.mockImplementation(
          () => ({
            enabled: true,
            prefix: 'Activity: ',
            suffix: '.',
            separator: '. ',
            maxActivities: 10,
            enableContextAwareness: false,
            maxDescriptionLength: 500,
            deduplicateActivities: true,
            nameResolution: {
              usePronounsWhenAvailable: true,
              preferReflexivePronouns: true,
            },
          })
        );

        mockActivityIndex.findActivitiesForEntity.mockReturnValueOnce([
          {
            type: 'inline',
            template: '{actor} admires {target}',
            targetEntityId: 'jon',
            priority: 50,
          },
        ]);

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') {
            return {
              id: 'jon',
              componentTypeIds: [],
              hasComponent: jest.fn().mockReturnValue(false),
              getComponentData: jest.fn((componentId) => {
                if (componentId === 'core:name') {
                  return { text: 'Jon Ureña' };
                }
                if (componentId === 'core:gender') {
                  return { value: 'male' };
                }
                return null;
              }),
            };
          }

          return null;
        });

        const description = await service.generateActivityDescription('jon');

        expect(description.startsWith('Activity: Jon Ureña')).toBe(true);
        expect(description).toContain('admires');
        expect(description).toContain('himself');
        expect(description.trim().endsWith('.')).toBe(true);
      });

      it('falls back gracefully when a target entity is missing', async () => {
        mockActivityIndex.findActivitiesForEntity.mockReturnValueOnce([
          {
            type: 'inline',
            template: '{actor} greets {target}',
            targetEntityId: 'missing-entity',
            priority: 40,
          },
        ]);

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') {
            return {
              id: 'jon',
              componentTypeIds: [],
              hasComponent: jest.fn().mockReturnValue(false),
              getComponentData: jest.fn((componentId) => {
                if (componentId === 'core:name') {
                  return { text: 'Jon Ureña' };
                }
                return null;
              }),
            };
          }

          return null;
        });

        const description = await service.generateActivityDescription('jon');

        expect(description.startsWith('Activity: Jon Ureña')).toBe(true);
        expect(description).toContain('greets');
        expect(description).toContain('missing-entity');
        expect(description.trim().endsWith('.')).toBe(true);
      });
    });

    describe('cache invalidation', () => {
      let eventBus;
      let serviceWithEventBus;
      let hooks;
      let entityName;
      let entity;

      beforeEach(() => {
        eventBus = new EventBus({ logger: mockLogger });
        entityName = 'Jon Ureña';
        entity = {
          id: 'jon',
          componentTypeIds: [
            NAME_COMPONENT_ID,
            'activity:description_metadata',
            'activity:metadata_source',
          ],
          hasComponent: jest.fn(
            (componentId) => componentId === 'activity:description_metadata'
          ),
          getComponentData: jest.fn((componentId) => {
            if (componentId === NAME_COMPONENT_ID) {
              return { text: entityName };
            }
            if (componentId === 'core:gender') {
              return { value: 'male' };
            }
            if (componentId === 'activity:description_metadata') {
              return {
                sourceComponent: 'activity:metadata_source',
                template: '{actor} trains',
                verb: 'trains',
                descriptionType: 'training',
                grouping: { groupKey: 'training' },
              };
            }
            if (componentId === 'activity:metadata_source') {
              return { entityId: 'jon' };
            }
            return null;
          }),
        };

        mockEntityManager.getEntityInstance.mockImplementation((id) => {
          if (id === 'jon') {
            return entity;
          }
          return {
            id,
            componentTypeIds: [NAME_COMPONENT_ID],
            hasComponent: jest.fn(() => false),
            getComponentData: jest.fn((componentId) => {
              if (componentId === NAME_COMPONENT_ID) {
                return { text: id };
              }
              if (componentId === 'core:gender') {
                return { value: 'neutral' };
              }
              return null;
            }),
          };
        });

        mockActivityIndex.findActivitiesForEntity.mockReturnValue([
          {
            actorId: 'jon',
            template: '{actor} trains hard',
            description: 'trains hard',
            priority: 100,
            type: 'inline',
          },
        ]);

        serviceWithEventBus = new ActivityDescriptionService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          anatomyFormattingService: mockAnatomyFormattingService,
          jsonLogicEvaluationService: mockJsonLogicEvaluationService,
          activityIndex: mockActivityIndex,
          eventBus,
        });

        hooks = serviceWithEventBus.getTestHooks();
      });

      afterEach(() => {
        serviceWithEventBus.destroy();
      });

      it('invalidates name cache when a name component is updated', async () => {
        hooks.setEntityNameCacheEntry('jon', 'Jon Ureña');

        await eventBus.dispatch(COMPONENT_ADDED_ID, {
          entity: { id: 'jon' },
          componentTypeId: NAME_COMPONENT_ID,
        });

        expect(hooks.getCacheSnapshot().entityName.has('jon')).toBe(false);
      });

      it('invalidates gender cache when the gender component changes', async () => {
        hooks.setGenderCacheEntry('jon', 'male');

        await eventBus.dispatch(COMPONENT_ADDED_ID, {
          entity: { id: 'jon' },
          componentTypeId: 'core:gender',
        });

        expect(hooks.getCacheSnapshot().gender.has('jon')).toBe(false);
      });

      it('invalidates activity cache when metadata updates', async () => {
        hooks.setActivityIndexCacheEntry('jon', {
          signature: 'abc',
          index: {},
        });

        await eventBus.dispatch(COMPONENT_ADDED_ID, {
          entity: { id: 'jon' },
          componentTypeId: 'activity:description_metadata',
        });

        expect(hooks.getCacheSnapshot().activityIndex.has('jon')).toBe(false);
      });

      it('invalidates caches when monitored components are removed', async () => {
        hooks.setEntityNameCacheEntry('jon', 'Jon');
        hooks.setGenderCacheEntry('jon', 'male');
        hooks.setActivityIndexCacheEntry('jon', {
          signature: 'abc',
          index: {},
        });

        await eventBus.dispatch(COMPONENT_REMOVED_ID, {
          entity: { id: 'jon' },
          componentTypeId: NAME_COMPONENT_ID,
        });

        expect(hooks.getCacheSnapshot().entityName.has('jon')).toBe(false);

        hooks.setGenderCacheEntry('jon', 'male');
        await eventBus.dispatch(COMPONENT_REMOVED_ID, {
          entity: { id: 'jon' },
          componentTypeId: 'core:gender',
        });

        expect(hooks.getCacheSnapshot().gender.has('jon')).toBe(false);

        hooks.setActivityIndexCacheEntry('jon', {
          signature: 'abc',
          index: {},
        });
        await eventBus.dispatch(COMPONENT_REMOVED_ID, {
          entity: { id: 'jon' },
          componentTypeId: 'activity:description_metadata',
        });

        expect(hooks.getCacheSnapshot().activityIndex.has('jon')).toBe(false);
      });

      it('invalidates all caches when an entity is removed', async () => {
        hooks.setEntityNameCacheEntry('jon', 'Jon');
        hooks.setGenderCacheEntry('jon', 'male');
        hooks.setActivityIndexCacheEntry('jon', {
          signature: 'abc',
          index: {},
        });
        hooks.setClosenessCacheEntry('jon', ['alicia']);

        await eventBus.dispatch(ENTITY_REMOVED_ID, {
          entity: { id: 'jon' },
        });

        const snapshot = hooks.getCacheSnapshot();
        expect(snapshot.entityName.has('jon')).toBe(false);
        expect(snapshot.gender.has('jon')).toBe(false);
        expect(snapshot.activityIndex.has('jon')).toBe(false);
        expect(snapshot.closeness.has('jon')).toBe(false);
      });

      it('supports batch invalidation helpers', () => {
        hooks.setEntityNameCacheEntry('jon', 'Jon');
        hooks.setEntityNameCacheEntry('alicia', 'Alicia');
        hooks.setEntityNameCacheEntry('bobby', 'Bobby');

        serviceWithEventBus.invalidateEntities(['jon', 'alicia']);

        const snapshot = hooks.getCacheSnapshot().entityName;
        expect(snapshot.has('jon')).toBe(false);
        expect(snapshot.has('alicia')).toBe(false);
        expect(snapshot.has('bobby')).toBe(true);
      });

      it('ignores batch component events that lack valid updates', async () => {
        hooks.setEntityNameCacheEntry('batch-invalid', 'Name');
        hooks.setGenderCacheEntry('batch-invalid', 'female');
        hooks.setActivityIndexCacheEntry('batch-invalid', {
          signature: 'sig',
          index: {},
        });

        await eventBus.dispatch(COMPONENTS_BATCH_ADDED_ID, null);
        await eventBus.dispatch(COMPONENTS_BATCH_ADDED_ID, {
          updates: [],
        });

        const snapshot = hooks.getCacheSnapshot();
        expect(snapshot.entityName.has('batch-invalid')).toBe(true);
        expect(snapshot.gender.has('batch-invalid')).toBe(true);
        expect(snapshot.activityIndex.has('batch-invalid')).toBe(true);
      });

      it('processes batch component updates and invalidates relevant caches', async () => {
        hooks.setEntityNameCacheEntry('batch-entity', 'Batch Name');
        hooks.setGenderCacheEntry('batch-entity', 'nonbinary');
        hooks.setActivityIndexCacheEntry('batch-entity', {
          signature: 'sig',
          index: {},
        });
        hooks.setClosenessCacheEntry('batch-entity', ['friend']);

        await eventBus.dispatch(COMPONENTS_BATCH_ADDED_ID, {
          updates: [
            { componentTypeId: NAME_COMPONENT_ID },
            { componentTypeId: NAME_COMPONENT_ID, instanceId: 'batch-entity' },
            { componentTypeId: 'core:gender', entityId: 'batch-entity' },
            {
              componentTypeId: 'activity:description_metadata',
              entity: { id: 'batch-entity' },
            },
          ],
        });

        const snapshot = hooks.getCacheSnapshot();
        expect(snapshot.entityName.has('batch-entity')).toBe(false);
        expect(snapshot.gender.has('batch-entity')).toBe(false);
        expect(snapshot.activityIndex.has('batch-entity')).toBe(false);
        expect(snapshot.closeness.has('batch-entity')).toBe(true);
      });

      it('warns when invalidateEntities receives non-array input', () => {
        mockLogger.warn.mockClear();

        serviceWithEventBus.invalidateEntities('jon');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActivityDescriptionService: invalidateEntities called with non-array'
      );
    });

      it('supports selective cache invalidation', () => {
        hooks.setEntityNameCacheEntry('jon', 'Jon');
        hooks.setGenderCacheEntry('jon', 'male');
        hooks.setActivityIndexCacheEntry('jon', {
          signature: 'abc',
          index: {},
        });
        hooks.setClosenessCacheEntry('jon', ['alicia']);

        serviceWithEventBus.invalidateCache('jon', 'name');

        const snapshot = hooks.getCacheSnapshot();
        expect(snapshot.entityName.has('jon')).toBe(false);
        expect(snapshot.gender.has('jon')).toBe(true);
        expect(snapshot.activityIndex.has('jon')).toBe(true);
        expect(snapshot.closeness.has('jon')).toBe(true);
      });

    it('invalidates gender and activity caches and warns on unknown types', () => {
      mockLogger.warn.mockClear();

      hooks.setGenderCacheEntry('jon', 'male');
      serviceWithEventBus.invalidateCache('jon', 'gender');
      expect(hooks.getCacheSnapshot().gender.has('jon')).toBe(false);

      hooks.setActivityIndexCacheEntry('jon', {
        signature: 'sig',
        index: {
          byTarget: new Map(),
          byPriority: [],
          byGroupKey: new Map(),
          all: [],
        },
      });
      serviceWithEventBus.invalidateCache('jon', 'activity');
      expect(hooks.getCacheSnapshot().activityIndex.has('jon')).toBe(false);

      hooks.setClosenessCacheEntry('jon', ['alicia']);
      serviceWithEventBus.invalidateCache('jon', 'closeness');
      expect(hooks.getCacheSnapshot().closeness.has('jon')).toBe(false);

      hooks.setEntityNameCacheEntry('jon', 'Jon');
      hooks.setGenderCacheEntry('jon', 'male');
      hooks.setActivityIndexCacheEntry('jon', {
        signature: 'sig',
        index: {
          byTarget: new Map(),
          byPriority: [],
          byGroupKey: new Map(),
          all: [],
        },
      });
      hooks.setClosenessCacheEntry('jon', ['alicia']);
      serviceWithEventBus.invalidateCache('jon', 'all');

      const snapshot = hooks.getCacheSnapshot();
      expect(snapshot.entityName.has('jon')).toBe(false);
      expect(snapshot.gender.has('jon')).toBe(false);
      expect(snapshot.activityIndex.has('jon')).toBe(false);
      expect(snapshot.closeness.has('jon')).toBe(false);

      serviceWithEventBus.invalidateCache('jon', 'unknown');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActivityDescriptionService: Unknown cache type: unknown'
      );
    });

    it('logs a warning if unsubscribe handlers throw during destroy', () => {
      const unsubscribe = jest.fn(() => {
        throw new Error('unsubscribe failed');
      });

      const throwingBus = {
        subscribe: jest.fn(() => unsubscribe),
        dispatch: jest.fn(),
        unsubscribe: jest.fn(),
      };

      const localService = new ActivityDescriptionService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        anatomyFormattingService: mockAnatomyFormattingService,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        activityIndex: mockActivityIndex,
        eventBus: throwingBus,
      });

      mockLogger.warn.mockClear();
      localService.destroy();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActivityDescriptionService: Failed to unsubscribe cache invalidation handler',
        expect.any(Error)
      );
    });

    it('unsubscribes from cache invalidation events on destroy', () => {
      const before = eventBus.listenerCount(COMPONENT_ADDED_ID);

        serviceWithEventBus.destroy();

        const after = eventBus.listenerCount(COMPONENT_ADDED_ID);
        expect(after).toBeLessThan(before);
      });

      it('refreshes caches after invalidation when generating descriptions', async () => {
        await serviceWithEventBus.generateActivityDescription('jon');
        expect(hooks.getCacheSnapshot().entityName.get('jon')?.value).toBe(
          'Jon Ureña'
        );

        entityName = 'Jon "Red" Ureña';

        await eventBus.dispatch(COMPONENT_ADDED_ID, {
          entity: { id: 'jon' },
          componentTypeId: NAME_COMPONENT_ID,
        });

        await serviceWithEventBus.generateActivityDescription('jon');

        expect(hooks.getCacheSnapshot().entityName.get('jon')?.value).toBe(
          'Jon "Red" Ureña'
        );
      });

      it('does not leak listeners when services are created and destroyed repeatedly', () => {
        serviceWithEventBus.destroy();

        for (let i = 0; i < 50; i++) {
          const tempService = new ActivityDescriptionService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            anatomyFormattingService: mockAnatomyFormattingService,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            activityIndex: mockActivityIndex,
            eventBus,
          });
          tempService.destroy();
        }

        expect(eventBus.listenerCount(COMPONENT_ADDED_ID)).toBeLessThan(10);
      });
    });
  });

  describe('test hooks utility coverage', () => {
    let hooks;

    beforeEach(() => {
      hooks = service.getTestHooks();
    });

    describe('#truncateDescription', () => {
      it('returns empty string when provided a non-string input', () => {
        expect(hooks.truncateDescription(123, 50)).toBe('');
      });

      it('returns empty string for whitespace-only input', () => {
        expect(hooks.truncateDescription('   ', 100)).toBe('');
      });

      it('returns trimmed text when max length is not finite', () => {
        expect(hooks.truncateDescription(' Activity summary ', 0)).toBe(
          'Activity summary'
        );
      });

      it('preserves the final full sentence when within the limit', () => {
        const description =
          'First sentence. Second sentence continues for a bit longer.';
        expect(hooks.truncateDescription(description, 25)).toBe(
          'First sentence.'
        );
      });

      it('appends an ellipsis when truncating without a sentence boundary', () => {
        expect(
          hooks.truncateDescription('No periods in this description', 10)
        ).toBe('No peri...');
      });
    });

    describe('#sanitizeEntityName', () => {
      it('returns a fallback when provided a non-string input', () => {
        expect(hooks.sanitizeEntityName(null)).toBe('Unknown entity');
      });

      it('removes control and zero-width characters before collapsing whitespace', () => {
        expect(hooks.sanitizeEntityName(' ​‌ ')).toBe(
          'Unknown entity'
        );
      });
    });

    describe('#getReflexivePronoun', () => {
      it.each([
        ['himself', 'he'],
        ['herself', 'she'],
        ['itself', 'it'],
        ['myself', 'I'],
        ['yourself', 'You'],
        ['ourselves', 'we'],
        ['themselves', 'they'],
      ])('returns %s for subject %s', (expected, subject) => {
        expect(hooks.getReflexivePronoun({ subject })).toBe(expected);
      });
    });

    describe('#shouldUsePronounForTarget', () => {
      it('returns false when target identifier is missing', () => {
        expect(hooks.shouldUsePronounForTarget(null)).toBe(false);
      });

      it('returns false when the entity manager cannot resolve a target', () => {
        mockEntityManager.getEntityInstance.mockImplementationOnce(() => null);

        expect(hooks.shouldUsePronounForTarget('missing-target')).toBe(false);
      });

      it('returns true when the target advertises the actor component', () => {
        mockEntityManager.getEntityInstance.mockImplementationOnce(() => ({
          hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID),
          getComponentData: jest.fn(),
        }));

        expect(hooks.shouldUsePronounForTarget('actor-target')).toBe(true);
      });

      it('returns true when actor metadata exists on the entity', () => {
        mockEntityManager.getEntityInstance.mockImplementationOnce(() => ({
          hasComponent: jest.fn().mockReturnValue(false),
          getComponentData: jest.fn((componentId) =>
            componentId === ACTOR_COMPONENT_ID ? { id: 'actor-target' } : null
          ),
        }));

        expect(hooks.shouldUsePronounForTarget('actor-target')).toBe(true);
      });

      it('logs a debug message and returns false when lookup throws', () => {
        const error = new Error('lookup failed');
        mockLogger.debug.mockClear();
        mockEntityManager.getEntityInstance.mockImplementationOnce(() => {
          throw error;
        });

        expect(hooks.shouldUsePronounForTarget('trouble-target')).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('trouble-target'),
          error
        );
      });
    });

    describe('#detectEntityGender', () => {
      it('returns unknown when the entity is not present', () => {
        mockEntityManager.getEntityInstance.mockImplementationOnce(() => null);

        expect(hooks.detectEntityGender('mystery-entity')).toBe('unknown');
      });

      it('warns and defaults to neutral when lookup throws', () => {
        const error = new Error('gender lookup failed');
        mockLogger.warn.mockClear();
        mockEntityManager.getEntityInstance.mockImplementationOnce(() => {
          throw error;
        });

        expect(hooks.detectEntityGender('troubled-entity')).toBe('neutral');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('troubled-entity'),
          error
        );
      });
    });

    it('exposes advanced helpers through test hooks', () => {
      const originalImplementation =
        mockEntityManager.getEntityInstance.getMockImplementation();

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-with-partner') {
          return {
            id,
            componentTypeIds: ['positioning:closeness'],
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'positioning:closeness') {
                return { partners: ['target-entity'] };
              }
              if (componentId === 'core:name') {
                return { text: 'Actor With Partner' };
              }
              if (componentId === 'core:gender') {
                return { value: 'male' };
              }
              return undefined;
            }),
            hasComponent: jest.fn(
              (componentId) => componentId === 'required:present'
            ),
          };
        }

        if (id === 'target-entity') {
          return {
            id,
            componentTypeIds: ['core:gender'],
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Target Entity' };
              }
              if (componentId === 'core:gender') {
                return { value: 'female' };
              }
              return undefined;
            }),
            hasComponent: jest.fn().mockReturnValue(false),
          };
        }

        return defaultGetEntityInstanceImplementation(id);
      });

      const actorEntity = {
        id: 'actor-entity',
        componentTypeIds: ['component:a'],
        getComponentData: jest.fn((componentId) =>
          componentId === 'component:a' ? { active: true } : null
        ),
        hasComponent: jest.fn(
          (componentId) => componentId === 'required:present'
        ),
      };

      const forbiddenEntity = {
        id: 'forbidden',
        hasComponent: jest.fn(
          (componentId) => componentId === 'forbidden:present'
        ),
      };

      const activity = {
        visible: true,
        metadata: {},
        priority: 95,
        type: 'inline',
        template: '{actor} reassures {target}',
        targetEntityId: 'target-entity',
        sourceData: { property: 'match' },
      };

      expect(hooks.evaluateActivityVisibility(activity, actorEntity)).toBe(
        true
      );

      const logicContext = hooks.buildLogicContext(activity, actorEntity);
      expect(logicContext).toMatchObject({
        entity: { id: 'actor-entity' },
        target: { id: 'target-entity' },
      });

      const builtContext = hooks.buildActivityContext(
        'actor-with-partner',
        activity
      );
      expect(builtContext).toMatchObject({
        targetId: 'target-entity',
        relationshipTone: 'closeness_partner',
        targetGender: 'female',
      });

      const tonedActivity = hooks.applyContextualTone(
        { ...activity, type: 'dedicated' },
        builtContext
      );
      expect(tonedActivity.contextualTone).toBe('intimate');
      expect(tonedActivity.adverb).toBeUndefined();

      const phrase = hooks.generateActivityPhrase('Alex', activity, false, {
        actorId: 'actor-with-partner',
        actorName: 'Alex',
        actorPronouns: { subject: 'he', object: 'him' },
      });
      expect(phrase).toBe('Alex reassures Target Entity');

      expect(hooks.filterByConditions([activity], actorEntity)).toHaveLength(1);
      expect(hooks.determineActivityIntensity(activity.priority)).toBe(
        'intense'
      );
      expect(
        hooks.determineConjunction({ priority: 50 }, { priority: 55 })
      ).toBe('while');
      expect(hooks.activitiesOccurSimultaneously(10, 15)).toBe(true);
      expect(hooks.getPronounSet('female').subject).toBe('she');
      expect(hooks.detectEntityGender('target-entity')).toBe('female');
      expect(hooks.isEmptyConditionsObject({})).toBe(true);
      expect(
        hooks.matchesPropertyCondition(activity, {
          property: 'property',
          equals: 'match',
        })
      ).toBe(true);
      expect(
        hooks.hasRequiredComponents(actorEntity, ['required:present'])
      ).toBe(true);
      expect(
        hooks.hasForbiddenComponents(forbiddenEntity, [
          'forbidden:missing',
          'forbidden:present',
        ])
      ).toBe(true);

      const extracted = hooks.extractEntityData({
        id: 'extracted',
        componentTypeIds: ['alpha', 'beta'],
        getComponentData: jest.fn((componentId) => ({
          id: componentId,
        })),
      });
      expect(extracted).toEqual({
        id: 'extracted',
        components: {
          alpha: { id: 'alpha' },
          beta: { id: 'beta' },
        },
      });

      mockEntityManager.getEntityInstance.mockImplementation(
        originalImplementation ?? defaultGetEntityInstanceImplementation
      );
    });

    it('continues collecting entity data when a component accessor throws', () => {
      const hooks = service.getTestHooks();

      mockLogger.warn.mockClear();

      const entity = {
        id: 'resilient-entity',
        componentTypeIds: ['safe', 'fragile', 'stable'],
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'safe') {
            return { ok: true };
          }

          if (componentId === 'fragile') {
            throw new Error('component exploded');
          }

          if (componentId === 'stable') {
            return { label: 'value' };
          }

          return undefined;
        }),
      };

      const extracted = hooks.extractEntityData(entity);

      expect(extracted).toEqual({
        id: 'resilient-entity',
        components: {
          safe: { ok: true },
          stable: { label: 'value' },
        },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract component data for fragile'),
        expect.any(Error)
      );
    });
  });

  describe('deduplication handling', () => {
    it('should log when duplicate activities are removed', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([
        {
          type: 'inline',
          template: '{actor} greets {target}',
          targetEntityId: 'entity_2',
          priority: 5,
        },
        {
          type: 'inline',
          template: '{actor} greets {target}',
          targetEntityId: 'entity_2',
          priority: 1,
        },
      ]);

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity_1') {
          return {
            id,
            componentTypeIds: [],
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Actor One' };
              }
              return undefined;
            }),
          };
        }

        if (id === 'entity_2') {
          return {
            id,
            componentTypeIds: [],
            getComponentData: jest.fn((componentId) => {
              if (componentId === 'core:name') {
                return { text: 'Target Two' };
              }
              return undefined;
            }),
          };
        }

        return defaultGetEntityInstanceImplementation(id);
      });

      const description = await service.generateActivityDescription('entity_1');

      expect(description).toBe('Activity: Actor One greets Target Two.');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Deduplicated 1 duplicate activities')
      );
    });

    it('should return empty description when deduplication removes all candidates', async () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue(['placeholder']);

      const description = await service.generateActivityDescription('entity_1');

      expect(description).toBe('');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No activities remaining after deduplication')
      );
    });
  });

  describe('metadata collector test hooks', () => {
    it('should handle unresolved entities when collecting metadata', () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('lookup failure');
      });

      const hooks = service.getTestHooks();
      const activities = hooks.collectActivityMetadata('missing-entity', null);

      expect(Array.isArray(activities)).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve entity for metadata collection'),
        expect.any(Error)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No entity available for inline metadata collection: missing-entity'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No entity available for dedicated metadata collection: missing-entity'
      );
    });

    it('should log when dedicated metadata collection throws unexpectedly', () => {
      mockActivityIndex.findActivitiesForEntity.mockReturnValue([]);

      const throwingEntity = {
        id: 'entity-dedicated-throw',
        componentTypeIds: [],
        getComponentData: jest.fn(),
      };

      Object.defineProperty(throwingEntity, 'hasComponent', {
        get() {
          throw new Error('hasComponent getter failure');
        },
      });

      const hooks = service.getTestHooks();
      const activities = hooks.collectActivityMetadata(
        'entity-dedicated-throw',
        throwingEntity
      );

      expect(activities).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to collect dedicated metadata for entity entity-dedicated-throw'
        ),
        expect.any(Error)
      );
    });

    it('should emit defensive warnings during inline metadata collection', () => {
      const hooks = service.getTestHooks();

      hooks.collectInlineMetadata(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot collect inline metadata without a valid entity'
      );

      hooks.collectInlineMetadata({
        id: 'inline-missing-getter',
        componentTypeIds: ['inline:missing'],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing getComponentData; skipping inline:missing')
      );

      hooks.collectInlineMetadata({
        id: 'inline-invalid-data',
        componentTypeIds: ['inline:invalid'],
        getComponentData: jest.fn().mockReturnValue(null),
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Component inline:invalid returned invalid data')
      );

      hooks.collectInlineMetadata({
        id: 'inline-malformed-metadata',
        componentTypeIds: ['inline:malformed'],
        getComponentData: jest.fn().mockReturnValue({
          activityMetadata: 'not-an-object',
        }),
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Activity metadata for inline:malformed is malformed')
      );
    });

    it('should expose parseInlineMetadata helper output', () => {
      const hooks = service.getTestHooks();

      const parsed = hooks.parseInlineMetadata(
        'inline:component',
        { entityId: 'target-inline' },
        { template: '{actor} salutes {target}', priority: 7 }
      );

      expect(parsed).toEqual(
        expect.objectContaining({
          sourceComponent: 'inline:component',
          targetEntityId: 'target-inline',
          template: '{actor} salutes {target}',
          priority: 7,
        })
      );
    });

    it('warns and recovers when inline metadata provides invalid targetRole output', async () => {
      mockLogger.warn.mockClear();

      const inlineComponentId = 'inline:malformed-target';

      const actorEntity = {
        id: 'actor-inline-warning',
        componentTypeIds: ['core:name', inlineComponentId],
        getComponentData: jest.fn((componentId) => {
          if (componentId === inlineComponentId) {
            return {
              partner: { id: 'not-a-string' },
              activityMetadata: {
                shouldDescribeInActivity: true,
                template: '{actor} greets {target}',
                targetRole: 'partner',
                priority: 55,
              },
            };
          }

          if (componentId === 'core:name') {
            return { text: 'Actor Inline' };
          }

          return undefined;
        }),
        hasComponent: jest.fn().mockReturnValue(false),
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'actor-inline-warning') {
          return actorEntity;
        }

        return defaultGetEntityInstanceImplementation(id);
      });

      const description = await service.generateActivityDescription(
        'actor-inline-warning'
      );

      expect(description).toContain('Actor Inline greets');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid target entity reference for role partner'
        )
      );

      mockEntityManager.getEntityInstance.mockImplementation(
        defaultGetEntityInstanceImplementation
      );
    });

    it('warns when inline metadata target resolves to a blank string', () => {
      const hooks = service.getTestHooks();
      mockLogger.warn.mockClear();

      const parsed = hooks.parseInlineMetadata(
        'inline:blank-target',
        { entityId: '   ' },
        { template: '{actor} waves', targetRole: 'entityId' }
      );

      expect(parsed).toEqual(
        expect.objectContaining({ targetEntityId: null, targetId: null })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('blank target entity reference')
      );
    });

    it('should cover dedicated metadata guard branches', () => {
      const hooks = service.getTestHooks();

      hooks.collectDedicatedMetadata(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot collect dedicated metadata without a valid entity'
      );

      hooks.collectDedicatedMetadata({
        id: 'dedicated-missing-has',
        componentTypeIds: [],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Entity dedicated-missing-has is missing hasComponent; skipping dedicated metadata'
        )
      );

      hooks.collectDedicatedMetadata({
        id: 'dedicated-has-throws',
        componentTypeIds: [],
        hasComponent: jest.fn(() => {
          throw new Error('explode');
        }),
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to verify dedicated metadata component'),
        expect.any(Error)
      );

      hooks.collectDedicatedMetadata({
        id: 'dedicated-missing-getter',
        componentTypeIds: [],
        hasComponent: jest.fn().mockReturnValue(true),
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Entity dedicated-missing-getter is missing getComponentData; skipping dedicated metadata'
        )
      );

      hooks.collectDedicatedMetadata({
        id: 'dedicated-getter-throws',
        componentTypeIds: [],
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn(() => {
          throw new Error('read failure');
        }),
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read dedicated metadata for dedicated-getter-throws'),
        expect.any(Error)
      );

      hooks.collectDedicatedMetadata({
        id: 'dedicated-invalid',
        componentTypeIds: [],
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest
          .fn()
          .mockImplementation((componentId) =>
            componentId === 'activity:description_metadata' ? null : undefined
          ),
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Dedicated metadata for dedicated-invalid is invalid')
      );

      const metadataThrow = {};
      Object.defineProperty(metadataThrow, 'sourceComponent', {
        get() {
          throw new Error('metadata explosion');
        },
      });

      hooks.collectDedicatedMetadata({
        id: 'dedicated-parse-failure',
        componentTypeIds: [],
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'activity:description_metadata') {
            return metadataThrow;
          }
          if (componentId === 'pose:stance') {
            return { entityId: 'target' };
          }
          return undefined;
        }),
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse dedicated metadata',
        expect.any(Error)
      );
    });

    it('should expose parseDedicatedMetadata edge cases for coverage', () => {
      const hooks = service.getTestHooks();

      expect(hooks.parseDedicatedMetadata(null, { getComponentData: jest.fn() })).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Dedicated metadata payload is invalid; skipping'
      );

      expect(
        hooks.parseDedicatedMetadata(
          { sourceComponent: 'comp' },
          { id: 'entity', getComponentData: undefined }
        )
      ).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot parse dedicated metadata without component access')
      );

      expect(
        hooks.parseDedicatedMetadata(
          {},
          { id: 'entity', getComponentData: jest.fn() }
        )
      ).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Dedicated metadata missing sourceComponent'
      );

      const sourceData = {};
      Object.defineProperty(sourceData, 'entityId', {
        get() {
          throw new Error('target failure');
        },
      });

      const parsed = hooks.parseDedicatedMetadata(
        {
          sourceComponent: 'pose:stance',
          template: '{actor} watches {target}',
        },
        {
          id: 'entity',
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'pose:stance') {
              return sourceData;
            }
            return undefined;
          }),
        }
      );

      expect(parsed).toEqual(
        expect.objectContaining({ sourceComponent: 'pose:stance', targetEntityId: null })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve target entity for dedicated metadata pose:stance'),
        expect.any(Error)
      );
    });

    it('should guard against component access errors in hasRequiredComponents', () => {
      const hooks = service.getTestHooks();

      const entity = {
        id: 'entity-required-components',
        hasComponent: jest.fn(() => {
          throw new Error('component failure');
        }),
      };

      expect(hooks.hasRequiredComponents(entity, ['core:required'])).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to verify required component core:required for entity-required-components'
        ),
        expect.any(Error)
      );
    });
  });
});

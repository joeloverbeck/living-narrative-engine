import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DismemberedBodyPartSpawner from '../../../../src/anatomy/services/dismemberedBodyPartSpawner.js';

describe('DismemberedBodyPartSpawner', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEventBus;
  let mockEntityLifecycleManager;
  let mockGameDataRepository;
  let mockUnsubscribe;

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

    mockUnsubscribe = jest.fn();
    mockEventBus = {
      subscribe: jest.fn().mockReturnValue(mockUnsubscribe),
      dispatch: jest.fn(),
    };

    mockEntityLifecycleManager = {
      createEntityInstance: jest
        .fn()
        .mockResolvedValue({ id: 'spawned-entity-1' }),
    };

    mockGameDataRepository = {
      getEntityDefinition: jest.fn().mockReturnValue(null),
    };

    service = new DismemberedBodyPartSpawner({
      logger: mockLogger,
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      entityLifecycleManager: mockEntityLifecycleManager,
      gameDataRepository: mockGameDataRepository,
    });
  });

  describe('constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            entityLifecycleManager: mockEntityLifecycleManager,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            logger: mockLogger,
            eventBus: mockEventBus,
            entityLifecycleManager: mockEntityLifecycleManager,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow();
    });

    it('should throw if eventBus is missing', () => {
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            logger: mockLogger,
            entityManager: mockEntityManager,
            entityLifecycleManager: mockEntityLifecycleManager,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow();
    });

    it('should throw if entityLifecycleManager is missing', () => {
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow();
    });

    it('should throw if gameDataRepository is missing', () => {
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            entityLifecycleManager: mockEntityLifecycleManager,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing getComponentData method', () => {
      const invalidEntityManager = {};
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            eventBus: mockEventBus,
            entityLifecycleManager: mockEntityLifecycleManager,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow();
    });

    it('should throw if eventBus missing subscribe method', () => {
      const invalidEventBus = { dispatch: jest.fn() };
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: invalidEventBus,
            entityLifecycleManager: mockEntityLifecycleManager,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow();
    });

    it('should throw if eventBus missing dispatch method', () => {
      const invalidEventBus = { subscribe: jest.fn() };
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: invalidEventBus,
            entityLifecycleManager: mockEntityLifecycleManager,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow();
    });

    it('should throw if entityLifecycleManager missing createEntityInstance method', () => {
      const invalidManager = {};
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            entityLifecycleManager: invalidManager,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow();
    });

    it('should throw if gameDataRepository missing getEntityDefinition method', () => {
      const invalidRepository = {};
      expect(
        () =>
          new DismemberedBodyPartSpawner({
            logger: mockLogger,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            entityLifecycleManager: mockEntityLifecycleManager,
            gameDataRepository: invalidRepository,
          })
      ).toThrow();
    });
  });

  describe('initialize', () => {
    it('should subscribe to anatomy:dismembered event', () => {
      service.initialize();

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'anatomy:dismembered',
        expect.any(Function)
      );
    });

    it('should log initialization message', () => {
      service.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized')
      );
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from events when initialized', () => {
      service.initialize();
      service.destroy();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should not throw if called before initialize', () => {
      expect(() => service.destroy()).not.toThrow();
    });

    it('should only unsubscribe once even if destroy called multiple times', () => {
      service.initialize();
      service.destroy();
      service.destroy();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleDismemberment', () => {
    let handleDismemberment;

    /**
     * Helper to create event structure matching what the event bus dispatches.
     * The event bus wraps payloads with { type, payload } structure.
     */
    const createEvent = (payload) => ({
      type: 'anatomy:dismembered',
      payload,
    });

    beforeEach(() => {
      service.initialize();
      // Get the handler that was passed to subscribe
      handleDismemberment = mockEventBus.subscribe.mock.calls[0][1];
    });

    describe('successful spawning', () => {
      beforeEach(() => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (entityId === 'part-leg-1' && componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_leg' };
            }
            if (
              entityId === 'entity-sarah' &&
              componentId === 'core:position'
            ) {
              return { locationId: 'location-tavern' };
            }
            if (entityId === 'entity-sarah' && componentId === 'core:name') {
              return { text: 'Sarah' };
            }
            return null;
          }
        );
        // Weight comes from entity definition's core:weight component
        mockGameDataRepository.getEntityDefinition.mockImplementation(
          (defId) => {
            if (defId === 'anatomy:human_leg') {
              return {
                id: 'anatomy:human_leg',
                components: {
                  'anatomy:part': { subType: 'leg' },
                  'core:weight': { weight: 8.5 },
                },
              };
            }
            return null;
          }
        );
      });

      it('should spawn body part entity with correct name', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-sarah',
            partId: 'part-leg-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          'anatomy:human_leg',
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:name': { text: "Sarah's left leg" },
            }),
          })
        );
      });

      it('should spawn body part at character location', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-sarah',
            partId: 'part-leg-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          'anatomy:human_leg',
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:position': { locationId: 'location-tavern' },
            }),
          })
        );
      });

      it('should add items-core:item component', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-sarah',
            partId: 'part-leg-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          'anatomy:human_leg',
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'items-core:item': {},
            }),
          })
        );
      });

      it('should add items-core:portable component', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-sarah',
            partId: 'part-leg-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          'anatomy:human_leg',
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'items-core:portable': {},
            }),
          })
        );
      });

      it('should use weight from entity definition core:weight component', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-sarah',
            partId: 'part-leg-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(mockGameDataRepository.getEntityDefinition).toHaveBeenCalledWith(
          'anatomy:human_leg'
        );
        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          'anatomy:human_leg',
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:weight': { weight: 8.5 },
            }),
          })
        );
      });

      it('should dispatch body_part_spawned event', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-sarah',
            partId: 'part-leg-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:body_part_spawned',
          expect.objectContaining({
            entityId: 'entity-sarah',
            entityName: 'Sarah',
            spawnedEntityId: 'spawned-entity-1',
            spawnedEntityName: "Sarah's left leg",
            partType: 'leg',
            orientation: 'left',
            definitionId: 'anatomy:human_leg',
            timestamp: expect.any(Number),
          })
        );
      });

      it('should log successful spawning', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-sarah',
            partId: 'part-leg-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Spawned body part entity')
        );
      });
    });

    describe('name generation', () => {
      beforeEach(() => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_arm' };
            }
            if (componentId === 'core:position') {
              return { locationId: 'location-1' };
            }
            if (componentId === 'core:name') {
              return { text: 'Marcus' };
            }
            return null;
          }
        );
        // Set up entity definition with weight
        mockGameDataRepository.getEntityDefinition.mockReturnValue({
          id: 'anatomy:human_arm',
          components: {
            'anatomy:part': { subType: 'arm' },
            'core:weight': { weight: 4.0 },
          },
        });
      });

      it('should include orientation for left parts', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'arm',
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:name': { text: "Marcus's left arm" },
            }),
          })
        );
      });

      it('should include orientation for right parts', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'arm',
            orientation: 'right',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:name': { text: "Marcus's right arm" },
            }),
          })
        );
      });

      it('should exclude orientation for mid parts', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'head',
            orientation: 'mid',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:name': { text: "Marcus's head" },
            }),
          })
        );
      });

      it('should handle null orientation', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'spine',
            orientation: null,
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:name': { text: "Marcus's spine" },
            }),
          })
        );
      });

      it('should handle missing part type', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: null,
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:name': { text: "Marcus's left body part" },
            }),
          })
        );
      });
    });

    describe('weight handling', () => {
      it('should use default weight when entity definition has no core:weight', async () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_finger' };
            }
            if (componentId === 'core:position') {
              return { locationId: 'location-1' };
            }
            if (componentId === 'core:name') {
              return { text: 'Test' };
            }
            return null;
          }
        );
        // Entity definition with no core:weight component
        mockGameDataRepository.getEntityDefinition.mockReturnValue({
          id: 'anatomy:human_finger',
          components: {
            'anatomy:part': { subType: 'finger' },
            // No core:weight here
          },
        });

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'finger',
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:weight': { weight: 1.0 },
            }),
          })
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Missing weight')
        );
      });

      it('should use default weight when entity definition is not found', async () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:unknown_part' };
            }
            if (componentId === 'core:position') {
              return { locationId: 'location-1' };
            }
            if (componentId === 'core:name') {
              return { text: 'Test' };
            }
            return null;
          }
        );
        // Entity definition not found
        mockGameDataRepository.getEntityDefinition.mockReturnValue(null);

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'unknown',
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:weight': { weight: 1.0 },
            }),
          })
        );
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Missing weight')
        );
      });

      it('should not log warning when weight is present in entity definition', async () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_leg' };
            }
            if (componentId === 'core:position') {
              return { locationId: 'location-1' };
            }
            if (componentId === 'core:name') {
              return { text: 'Test' };
            }
            return null;
          }
        );
        // Entity definition with weight
        mockGameDataRepository.getEntityDefinition.mockReturnValue({
          id: 'anatomy:human_leg',
          components: {
            'anatomy:part': { subType: 'leg' },
            'core:weight': { weight: 10.5 },
          },
        });

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should log error and skip spawning when definitionId is missing', async () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return {}; // Missing definitionId
            }
            return null;
          }
        );

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('missing definitionId')
        );
        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).not.toHaveBeenCalled();
      });

      it('should log error and skip spawning when part data is null', async () => {
        mockEntityManager.getComponentData.mockReturnValue(null);

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('missing definitionId')
        );
        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).not.toHaveBeenCalled();
      });

      it('should log warning and skip when character has no position', async () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_leg' };
            }
            if (componentId === 'core:position') {
              return null; // Missing position
            }
            return null;
          }
        );

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('missing position')
        );
        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).not.toHaveBeenCalled();
      });

      it('should log warning and skip when locationId is missing', async () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_leg' };
            }
            if (componentId === 'core:position') {
              return {}; // Position but no locationId
            }
            return null;
          }
        );

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('missing position')
        );
        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).not.toHaveBeenCalled();
      });

      it('should use Unknown when character name is missing', async () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_leg' };
            }
            if (componentId === 'core:position') {
              return { locationId: 'location-1' };
            }
            if (componentId === 'core:name') {
              return null; // Missing name
            }
            return null;
          }
        );

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:name': { text: "Unknown's left leg" },
            }),
          })
        );
      });

      it('should log error when entity creation throws', async () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_leg' };
            }
            if (componentId === 'core:position') {
              return { locationId: 'location-1' };
            }
            if (componentId === 'core:name') {
              return { text: 'Test' };
            }
            return null;
          }
        );
        mockEntityLifecycleManager.createEntityInstance.mockRejectedValue(
          new Error('Entity creation failed')
        );

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to spawn body part'),
          expect.any(Error)
        );
        expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
          'anatomy:body_part_spawned',
          expect.anything()
        );
      });

      it('should use Unknown for event when getEntityName throws', async () => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_leg' };
            }
            if (componentId === 'core:position') {
              return { locationId: 'location-1' };
            }
            if (componentId === 'core:name') {
              throw new Error('Component access error');
            }
            return null;
          }
        );

        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'leg',
            orientation: 'left',
          })
        );

        expect(
          mockEntityLifecycleManager.createEntityInstance
        ).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            componentOverrides: expect.objectContaining({
              'core:name': { text: "Unknown's left leg" },
            }),
          })
        );
      });
    });

    describe('event payload completeness', () => {
      beforeEach(() => {
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'anatomy:part') {
              return { definitionId: 'anatomy:human_arm' };
            }
            if (componentId === 'core:position') {
              return { locationId: 'location-1' };
            }
            if (componentId === 'core:name') {
              return { text: 'Elena' };
            }
            return null;
          }
        );
        // Set up entity definition with weight
        mockGameDataRepository.getEntityDefinition.mockReturnValue({
          id: 'anatomy:human_arm',
          components: {
            'anatomy:part': { subType: 'arm' },
            'core:weight': { weight: 4.0 },
          },
        });
      });

      it('should set partType to unknown when not provided', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
          })
        );

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:body_part_spawned',
          expect.objectContaining({
            partType: 'unknown',
          })
        );
      });

      it('should set orientation to null when not provided', async () => {
        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'arm',
          })
        );

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'anatomy:body_part_spawned',
          expect.objectContaining({
            orientation: null,
          })
        );
      });

      it('should include timestamp in event', async () => {
        const beforeTime = Date.now();
        await handleDismemberment(
          createEvent({
            entityId: 'entity-1',
            partId: 'part-1',
            partType: 'arm',
            orientation: 'left',
          })
        );
        const afterTime = Date.now();

        const dispatchCall = mockEventBus.dispatch.mock.calls.find(
          (call) => call[0] === 'anatomy:body_part_spawned'
        );
        expect(dispatchCall[1].timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(dispatchCall[1].timestamp).toBeLessThanOrEqual(afterTime);
      });
    });
  });
});

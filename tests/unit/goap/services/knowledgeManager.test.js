/**
 * @file Unit tests for KnowledgeManager
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import KnowledgeManager from '../../../../src/goap/services/knowledgeManager.js';
import {
  ACTOR_KNOWLEDGE_UPDATED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../../src/constants/systemEventIds.js';

describe('KnowledgeManager', () => {
  let manager;
  let mockComponentMutationService;
  let mockEntityManager;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Create mock component mutation service
    mockComponentMutationService = {
      addComponent: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      entities: [],
    };

    // Create manager instance
    manager = new KnowledgeManager({
      componentMutationService: mockComponentMutationService,
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventBus: mockEventBus,
    });
  });

  describe('constructor', () => {
    it('should create manager with all required dependencies', () => {
      expect(manager).toBeInstanceOf(KnowledgeManager);
    });

    it('should throw error if componentMutationService is missing', () => {
      expect(() => {
        new KnowledgeManager({
          componentMutationService: null,
          entityManager: mockEntityManager,
          logger: mockLogger,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error if componentMutationService lacks addComponent method', () => {
      expect(() => {
        new KnowledgeManager({
          componentMutationService: {},
          entityManager: mockEntityManager,
          logger: mockLogger,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error if entityManager is missing', () => {
      expect(() => {
        new KnowledgeManager({
          componentMutationService: mockComponentMutationService,
          entityManager: null,
          logger: mockLogger,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new KnowledgeManager({
          componentMutationService: mockComponentMutationService,
          entityManager: mockEntityManager,
          logger: null,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should throw error if eventBus is missing', () => {
      expect(() => {
        new KnowledgeManager({
          componentMutationService: mockComponentMutationService,
          entityManager: mockEntityManager,
          logger: mockLogger,
          eventBus: null,
        });
      }).toThrow();
    });
  });

  describe('updateKnowledge - basic functionality', () => {
    it('should update knowledge when actor sees new visible entity', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const visibleEntity = {
        id: 'entity1',
        components: {
          'core:position': { locationId: 'room1' },
        },
      };

      mockEntityManager.entities = [actor, visibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockComponentMutationService.addComponent).toHaveBeenCalledWith(
        'actor1',
        'core:known_to',
        expect.objectContaining({
          entities: expect.arrayContaining(['actor1', 'entity1']),
        })
      );
    });

    it('should add multiple visible entities to knowledge', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const entity1 = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };
      const entity2 = {
        id: 'entity2',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, entity1, entity2];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockComponentMutationService.addComponent).toHaveBeenCalledWith(
        'actor1',
        'core:known_to',
        expect.objectContaining({
          entities: expect.arrayContaining(['actor1', 'entity1', 'entity2']),
        })
      );
    });

    it('should initialize self-knowledge when core:known_to component is missing', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
        },
      };

      const visibleEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, visibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockComponentMutationService.addComponent).toHaveBeenCalledWith(
        'actor1',
        'core:known_to',
        expect.objectContaining({
          entities: expect.arrayContaining(['actor1', 'entity1']),
        })
      );
    });

    it('should preserve existing knowledge when adding new entities', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1', 'oldEntity'] },
        },
      };

      const newEntity = {
        id: 'newEntity',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, newEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockComponentMutationService.addComponent).toHaveBeenCalledWith(
        'actor1',
        'core:known_to',
        expect.objectContaining({
          entities: expect.arrayContaining([
            'actor1',
            'oldEntity',
            'newEntity',
          ]),
        })
      );
    });

    it('should not add duplicate entities to knowledge', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1', 'entity1'] },
        },
      };

      const visibleEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, visibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      // Should not call addComponent since entity is already known
      expect(mockComponentMutationService.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('updateKnowledge - visibility detection', () => {
    it('should only detect entities in the same location', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const sameLocationEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };

      const differentLocationEntity = {
        id: 'entity2',
        components: { 'core:position': { locationId: 'room2' } },
      };

      mockEntityManager.entities = [
        actor,
        sameLocationEntity,
        differentLocationEntity,
      ];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockComponentMutationService.addComponent).toHaveBeenCalledWith(
        'actor1',
        'core:known_to',
        expect.objectContaining({
          entities: ['actor1', 'entity1'], // Only entity1, not entity2
        })
      );
    });

    it('should skip entities in different locations', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const differentLocationEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room2' } },
      };

      mockEntityManager.entities = [actor, differentLocationEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      // Should not update knowledge since no visible entities
      expect(mockComponentMutationService.addComponent).not.toHaveBeenCalled();
    });

    it('should respect core:visible component when isVisible is false', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const invisibleEntity = {
        id: 'entity1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:visible': { isVisible: false },
        },
      };

      mockEntityManager.entities = [actor, invisibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      // Should not detect invisible entity
      expect(mockComponentMutationService.addComponent).not.toHaveBeenCalled();
    });

    it('should default to visible when core:visible component is missing', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const entityWithoutVisibleComponent = {
        id: 'entity1',
        components: {
          'core:position': { locationId: 'room1' },
        },
      };

      mockEntityManager.entities = [actor, entityWithoutVisibleComponent];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      // Should detect entity (defaults to visible)
      expect(mockComponentMutationService.addComponent).toHaveBeenCalledWith(
        'actor1',
        'core:known_to',
        expect.objectContaining({
          entities: expect.arrayContaining(['actor1', 'entity1']),
        })
      );
    });

    it('should skip actor from their own visibility detection', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      mockEntityManager.entities = [actor];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      // Should not add self again or call mutation
      expect(mockComponentMutationService.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('updateKnowledge - component mutation', () => {
    it('should call ComponentMutationService with correct parameters', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const visibleEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, visibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockComponentMutationService.addComponent).toHaveBeenCalledWith(
        'actor1',
        'core:known_to',
        { entities: ['actor1', 'entity1'] }
      );
    });

    it('should skip component update when no new knowledge discovered', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1', 'entity1'] },
        },
      };

      const visibleEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, visibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockComponentMutationService.addComponent).not.toHaveBeenCalled();
    });

    it('should update component with complete knowledge array', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1', 'oldEntity'] },
        },
      };

      const entity1 = {
        id: 'newEntity1',
        components: { 'core:position': { locationId: 'room1' } },
      };
      const entity2 = {
        id: 'newEntity2',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, entity1, entity2];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockComponentMutationService.addComponent).toHaveBeenCalledWith(
        'actor1',
        'core:known_to',
        expect.objectContaining({
          entities: expect.arrayContaining([
            'actor1',
            'oldEntity',
            'newEntity1',
            'newEntity2',
          ]),
        })
      );
    });
  });

  describe('updateKnowledge - event dispatching', () => {
    it('should dispatch ACTOR_KNOWLEDGE_UPDATED event when knowledge changes', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const visibleEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, visibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        ACTOR_KNOWLEDGE_UPDATED_ID,
        expect.objectContaining({
          actorId: 'actor1',
          newEntitiesCount: 1,
          totalKnownCount: 2,
        })
      );
    });

    it('should include correct actorId in event payload', async () => {
      const actor = {
        id: 'testActor',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['testActor'] },
        },
      };

      const visibleEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, visibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('testActor', {});

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        ACTOR_KNOWLEDGE_UPDATED_ID,
        expect.objectContaining({
          actorId: 'testActor',
        })
      );
    });

    it('should include new entities count in event payload', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const entity1 = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };
      const entity2 = {
        id: 'entity2',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, entity1, entity2];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        ACTOR_KNOWLEDGE_UPDATED_ID,
        expect.objectContaining({
          newEntitiesCount: 2,
        })
      );
    });

    it('should not dispatch event when no knowledge changes', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1', 'entity1'] },
        },
      };

      const visibleEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, visibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('updateKnowledge - error handling', () => {
    it('should handle actor without location component gracefully', async () => {
      const actorWithoutLocation = {
        id: 'actor1',
        components: {
          'core:known_to': { entities: ['actor1'] },
        },
      };

      mockEntityManager.entities = [actorWithoutLocation];
      mockEntityManager.getEntityInstance.mockReturnValue(actorWithoutLocation);

      await manager.updateKnowledge('actor1', {});

      // Should not throw and not update knowledge
      expect(mockComponentMutationService.addComponent).not.toHaveBeenCalled();
    });

    it('should handle entity manager errors gracefully', async () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity manager error');
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update knowledge',
        expect.objectContaining({
          actorId: 'actor1',
          error: 'Entity manager error',
        })
      );
    });

    it('should handle component mutation errors gracefully', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const visibleEntity = {
        id: 'entity1',
        components: { 'core:position': { locationId: 'room1' } },
      };

      mockEntityManager.entities = [actor, visibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      mockComponentMutationService.addComponent.mockRejectedValue(
        new Error('Mutation failed')
      );

      await manager.updateKnowledge('actor1', {});

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update knowledge',
        expect.objectContaining({
          actorId: 'actor1',
          error: 'Mutation failed',
        })
      );
    });

    it('should log errors without throwing', async () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Test error');
      });

      // Should not throw
      await expect(
        manager.updateKnowledge('actor1', {})
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should dispatch SYSTEM_ERROR_OCCURRED event on failure', async () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Test error');
      });

      await manager.updateKnowledge('actor1', {});

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          error: 'Test error',
          context: 'KnowledgeManager.updateKnowledge',
          actorId: 'actor1',
        })
      );
    });
  });

  describe('updateKnowledge - edge cases', () => {
    it('should handle empty entity manager gracefully', async () => {
      mockEntityManager.entities = [];
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      await manager.updateKnowledge('actor1', {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Actor not found: actor1')
      );
      expect(mockComponentMutationService.addComponent).not.toHaveBeenCalled();
    });

    it('should handle actor in empty location', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'emptyRoom' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      mockEntityManager.entities = [actor];
      mockEntityManager.getEntityInstance.mockReturnValue(actor);

      await manager.updateKnowledge('actor1', {});

      // No new entities, so no update
      expect(mockComponentMutationService.addComponent).not.toHaveBeenCalled();
    });

    it('should handle all entities marked invisible', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const invisibleEntity = {
        id: 'entity1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:visible': { isVisible: false },
        },
      };

      mockEntityManager.entities = [actor, invisibleEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      await manager.updateKnowledge('actor1', {});

      // No visible entities, so no update
      expect(mockComponentMutationService.addComponent).not.toHaveBeenCalled();
    });

    it('should handle malformed core:visible component gracefully', async () => {
      const actor = {
        id: 'actor1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:known_to': { entities: ['actor1'] },
        },
      };

      const malformedEntity = {
        id: 'entity1',
        components: {
          'core:position': { locationId: 'room1' },
          'core:visible': { isVisible: 'not-a-boolean' }, // Malformed
        },
      };

      mockEntityManager.entities = [actor, malformedEntity];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return mockEntityManager.entities.find((e) => e.id === id);
      });

      // Should handle gracefully (defaults to visible with truthy value)
      await manager.updateKnowledge('actor1', {});

      expect(mockComponentMutationService.addComponent).toHaveBeenCalled();
    });
  });
});

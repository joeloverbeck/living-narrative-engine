/**
 * @file Unit tests for uncovered methods in BodyGraphService
 * @see src/anatomy/bodyGraphService.js
 * 
 * These tests specifically target uncovered lines 289-290, 342-399
 * to improve test coverage to close to 100%
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('BodyGraphService - Uncovered Methods', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;
  let mockQueryCache;

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
      removeComponent: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    mockQueryCache = {
      getCachedFindPartsByType: jest.fn(),
      cacheFindPartsByType: jest.fn(),
      getCachedGetAllParts: jest.fn(),
      cacheGetAllParts: jest.fn(),
      invalidateRoot: jest.fn(),
    };

    // Create service instance
    service = new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      queryCache: mockQueryCache,
    });
  });

  describe('getConnectedParts (lines 289-290)', () => {
    beforeEach(async () => {
      // Setup a simple anatomy structure
      const entities = [
        { id: 'torso-1' },
        { id: 'arm-1' },
        { id: 'hand-1' },
        { id: 'finger-1' },
      ];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === 'anatomy:body' && id === 'torso-1') {
          return { body: { root: 'torso-1' } };
        }
        if (componentId === 'anatomy:part') {
          if (id === 'torso-1') return { subType: 'torso' };
          if (id === 'arm-1') return { subType: 'arm' };
          if (id === 'hand-1') return { subType: 'hand' };
          if (id === 'finger-1') return { subType: 'finger' };
        }
        if (componentId === 'anatomy:joint') {
          if (id === 'arm-1') return { parentId: 'torso-1', socketId: 'shoulder' };
          if (id === 'hand-1') return { parentId: 'arm-1', socketId: 'wrist' };
          if (id === 'finger-1') return { parentId: 'hand-1', socketId: 'finger_joint' };
        }
        return null;
      });

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // arm-1
        entities[2], // hand-1
        entities[3], // finger-1
      ]);

      // Build the cache
      await service.buildAdjacencyCache('torso-1');
    });

    it('should return connected parts (children) when node exists and has children', async () => {
      // Get the body graph which contains getConnectedParts
      const bodyGraph = await service.getBodyGraph('torso-1');
      
      // Test getConnectedParts method
      const connectedParts = bodyGraph.getConnectedParts('torso-1');
      
      // Should return the arm as a child of torso
      expect(connectedParts).toContain('arm-1');
      expect(connectedParts).toHaveLength(1);
    });

    it('should return empty array when node exists but has no children', async () => {
      const bodyGraph = await service.getBodyGraph('torso-1');
      
      // Test a leaf node (finger has no children)
      const connectedParts = bodyGraph.getConnectedParts('finger-1');
      
      expect(connectedParts).toEqual([]);
    });

    it('should return empty array when node does not exist in cache', async () => {
      const bodyGraph = await service.getBodyGraph('torso-1');
      
      // Test a non-existent entity
      const connectedParts = bodyGraph.getConnectedParts('non-existent-entity');
      
      expect(connectedParts).toEqual([]);
    });
  });

  describe('hasCache (lines 342-343)', () => {
    it('should return true when cache exists for root entity', async () => {
      // Setup and build cache
      const entities = [{ id: 'torso-1' }];
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });
      mockEntityManager.getComponentData.mockReturnValue(null);
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      
      await service.buildAdjacencyCache('torso-1');
      
      // Test hasCache method
      const result = service.hasCache('torso-1');
      
      expect(result).toBe(true);
    });

    it('should return false when cache does not exist for root entity', () => {
      // Test hasCache method without building cache
      const result = service.hasCache('non-existent-root');
      
      expect(result).toBe(false);
    });
  });

  describe('getChildren (lines 351-354)', () => {
    beforeEach(async () => {
      // Setup anatomy structure
      const entities = [
        { id: 'torso-1' },
        { id: 'arm-1' },
        { id: 'hand-1' },
      ];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === 'anatomy:part') {
          if (id === 'torso-1') return { subType: 'torso' };
          if (id === 'arm-1') return { subType: 'arm' };
          if (id === 'hand-1') return { subType: 'hand' };
        }
        if (componentId === 'anatomy:joint') {
          if (id === 'arm-1') return { parentId: 'torso-1', socketId: 'shoulder' };
          if (id === 'hand-1') return { parentId: 'arm-1', socketId: 'wrist' };
        }
        return null;
      });

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // arm-1
        entities[2], // hand-1
      ]);

      await service.buildAdjacencyCache('torso-1');
    });

    it('should return children when entity has children in cache', () => {
      const children = service.getChildren('torso-1');
      
      expect(children).toContain('arm-1');
      expect(children).toHaveLength(1);
    });

    it('should return empty array when entity has no children in cache', () => {
      const children = service.getChildren('hand-1');
      
      expect(children).toEqual([]);
    });

    it('should return empty array when entity does not exist in cache', () => {
      const children = service.getChildren('non-existent-entity');
      
      expect(children).toEqual([]);
    });
  });

  describe('getParent (lines 362-365)', () => {
    beforeEach(async () => {
      // Setup anatomy structure
      const entities = [
        { id: 'torso-1' },
        { id: 'arm-1' },
        { id: 'hand-1' },
      ];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === 'anatomy:part') {
          if (id === 'torso-1') return { subType: 'torso' };
          if (id === 'arm-1') return { subType: 'arm' };
          if (id === 'hand-1') return { subType: 'hand' };
        }
        if (componentId === 'anatomy:joint') {
          if (id === 'arm-1') return { parentId: 'torso-1', socketId: 'shoulder' };
          if (id === 'hand-1') return { parentId: 'arm-1', socketId: 'wrist' };
        }
        return null;
      });

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // arm-1
        entities[2], // hand-1
      ]);

      await service.buildAdjacencyCache('torso-1');
    });

    it('should return parent when entity has parent in cache', () => {
      const parent = service.getParent('arm-1');
      
      expect(parent).toBe('torso-1');
    });

    it('should return null when entity has no parent in cache', () => {
      const parent = service.getParent('torso-1');
      
      expect(parent).toBeNull();
    });

    it('should return null when entity does not exist in cache', () => {
      const parent = service.getParent('non-existent-entity');
      
      expect(parent).toBeNull();
    });
  });

  describe('getAncestors (lines 373-388)', () => {
    beforeEach(async () => {
      // Setup multi-level anatomy structure
      const entities = [
        { id: 'torso-1' },
        { id: 'arm-1' },
        { id: 'hand-1' },
        { id: 'finger-1' },
      ];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === 'anatomy:part') {
          if (id === 'torso-1') return { subType: 'torso' };
          if (id === 'arm-1') return { subType: 'arm' };
          if (id === 'hand-1') return { subType: 'hand' };
          if (id === 'finger-1') return { subType: 'finger' };
        }
        if (componentId === 'anatomy:joint') {
          if (id === 'arm-1') return { parentId: 'torso-1', socketId: 'shoulder' };
          if (id === 'hand-1') return { parentId: 'arm-1', socketId: 'wrist' };
          if (id === 'finger-1') return { parentId: 'hand-1', socketId: 'finger_joint' };
        }
        return null;
      });

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // arm-1
        entities[2], // hand-1
        entities[3], // finger-1
      ]);

      await service.buildAdjacencyCache('torso-1');
    });

    it('should return single parent for entity with one ancestor', () => {
      const ancestors = service.getAncestors('arm-1');
      
      expect(ancestors).toEqual(['torso-1']);
    });

    it('should return multiple ancestors ordered from nearest to farthest', () => {
      const ancestors = service.getAncestors('finger-1');
      
      expect(ancestors).toEqual(['hand-1', 'arm-1', 'torso-1']);
    });

    it('should return empty array for entity with no parent (root entity)', () => {
      const ancestors = service.getAncestors('torso-1');
      
      expect(ancestors).toEqual([]);
    });

    it('should return empty array for entity not in cache', () => {
      const ancestors = service.getAncestors('non-existent-entity');
      
      expect(ancestors).toEqual([]);
    });
  });

  describe('getAllDescendants (lines 396-400)', () => {
    beforeEach(async () => {
      // Setup anatomy structure with multiple levels
      const entities = [
        { id: 'torso-1' },
        { id: 'arm-1' },
        { id: 'hand-1' },
        { id: 'finger-1' },
        { id: 'fingertip-1' },
      ];

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
        throw new Error(`Entity ${id} not found`);
      });

      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === 'anatomy:part') {
          if (id === 'torso-1') return { subType: 'torso' };
          if (id === 'arm-1') return { subType: 'arm' };
          if (id === 'hand-1') return { subType: 'hand' };
          if (id === 'finger-1') return { subType: 'finger' };
          if (id === 'fingertip-1') return { subType: 'fingertip' };
        }
        if (componentId === 'anatomy:joint') {
          if (id === 'arm-1') return { parentId: 'torso-1', socketId: 'shoulder' };
          if (id === 'hand-1') return { parentId: 'arm-1', socketId: 'wrist' };
          if (id === 'finger-1') return { parentId: 'hand-1', socketId: 'finger_joint' };
          if (id === 'fingertip-1') return { parentId: 'finger-1', socketId: 'tip' };
        }
        return null;
      });

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        entities[1], // arm-1
        entities[2], // hand-1
        entities[3], // finger-1
        entities[4], // fingertip-1
      ]);

      await service.buildAdjacencyCache('torso-1');
    });

    it('should return all descendants excluding the root entity itself', () => {
      const descendants = service.getAllDescendants('torso-1');
      
      // Should include all descendants but not torso-1 itself
      expect(descendants).toContain('arm-1');
      expect(descendants).toContain('hand-1');
      expect(descendants).toContain('finger-1');
      expect(descendants).toContain('fingertip-1');
      expect(descendants).not.toContain('torso-1');
      expect(descendants).toHaveLength(4);
    });

    it('should return direct descendants for intermediate nodes', () => {
      const descendants = service.getAllDescendants('arm-1');
      
      expect(descendants).toContain('hand-1');
      expect(descendants).toContain('finger-1');
      expect(descendants).toContain('fingertip-1');
      expect(descendants).not.toContain('arm-1');
      expect(descendants).toHaveLength(3);
    });

    it('should return empty array for entity with no descendants', () => {
      const descendants = service.getAllDescendants('fingertip-1');
      
      expect(descendants).toEqual([]);
    });

    it('should return empty array for entity not in cache', () => {
      const descendants = service.getAllDescendants('non-existent-entity');
      
      expect(descendants).toEqual([]);
    });
  });
});
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CycleDetectionRule } from '../../../../../src/anatomy/validation/rules/cycleDetectionRule.js';

describe('CycleDetectionRule', () => {
  let rule;
  let mockContext;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
    };

    // Create validation context
    mockContext = {
      entityIds: [],
      entityManager: mockEntityManager,
      logger: mockLogger,
    };

    // Create rule instance
    rule = new CycleDetectionRule();
  });

  describe('rule properties', () => {
    it('should have correct ruleId', () => {
      expect(rule.ruleId).toBe('cycle-detection');
    });

    it('should have correct ruleName', () => {
      expect(rule.ruleName).toBe('Cycle Detection');
    });
  });

  describe('validate', () => {
    it('should return no issues for empty graph', async () => {
      const issues = await rule.validate(mockContext);

      expect(issues).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CycleDetectionRule: No cycles detected'
      );
    });

    it('should return no issues for acyclic graph', async () => {
      // Setup
      mockContext.entityIds = ['root', 'child1', 'child2', 'grandchild'];

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:joint') {
          const joints = {
            'child1': { parentId: 'root', socketId: 'socket1' },
            'child2': { parentId: 'root', socketId: 'socket2' },
            'grandchild': { parentId: 'child1', socketId: 'socket3' },
          };
          return joints[entityId] || null;
        }
        return null;
      });

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify
      expect(issues).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CycleDetectionRule: No cycles detected'
      );
    });

    it('should detect direct cycle', async () => {
      // Setup - entity1 -> entity2 -> entity1
      mockContext.entityIds = ['entity1', 'entity2'];

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:joint') {
          if (entityId === 'entity1') {
            return { parentId: 'entity2', socketId: 'socket1' };
          }
          if (entityId === 'entity2') {
            return { parentId: 'entity1', socketId: 'socket2' };
          }
        }
        return null;
      });

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].message).toBe('Cycle detected in anatomy graph');
      expect(issues[0].ruleId).toBe('cycle-detection');
      expect(issues[0].context.involvedEntities).toHaveLength(2);
      expect(issues[0].context.involvedEntities).toContain('entity1');
      expect(issues[0].context.involvedEntities).toContain('entity2');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CycleDetectionRule: Found cycles'
      );
    });

    it('should detect indirect cycle', async () => {
      // Setup - A -> B -> C -> A
      mockContext.entityIds = ['A', 'B', 'C'];

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:joint') {
          const joints = {
            'A': { parentId: 'C', socketId: 'socket1' },
            'B': { parentId: 'A', socketId: 'socket2' },
            'C': { parentId: 'B', socketId: 'socket3' },
          };
          return joints[entityId];
        }
        return null;
      });

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].message).toBe('Cycle detected in anatomy graph');
    });

    it('should handle multiple disconnected cycles', async () => {
      // Setup - Two separate cycles
      mockContext.entityIds = ['A', 'B', 'C', 'D'];

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:joint') {
          const joints = {
            'A': { parentId: 'B', socketId: 'socket1' },
            'B': { parentId: 'A', socketId: 'socket2' },
            'C': { parentId: 'D', socketId: 'socket3' },
            'D': { parentId: 'C', socketId: 'socket4' },
          };
          return joints[entityId];
        }
        return null;
      });

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify - should detect at least one cycle
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues[0].severity).toBe('error');
    });

    it('should handle graph with multiple roots', async () => {
      // Setup - Two separate trees
      mockContext.entityIds = ['root1', 'child1', 'root2', 'child2'];

      mockEntityManager.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === 'anatomy:joint') {
          const joints = {
            'child1': { parentId: 'root1', socketId: 'socket1' },
            'child2': { parentId: 'root2', socketId: 'socket2' },
          };
          return joints[entityId] || null;
        }
        return null;
      });

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify
      expect(issues).toEqual([]);
    });
  });
});
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OrphanDetectionRule } from '../../../../../src/anatomy/validation/rules/orphanDetectionRule.js';

describe('OrphanDetectionRule', () => {
  let rule;
  let mockEntityManager;
  let mockLogger;
  let mockContext;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
    };

    mockContext = {
      entityIds: [],
      entityManager: mockEntityManager,
      logger: mockLogger,
      setMetadata: jest.fn(),
    };

    rule = new OrphanDetectionRule();
  });

  describe('rule metadata', () => {
    it('reports a stable identifier and display name', () => {
      expect(rule.ruleId).toBe('orphan-detection');
      expect(rule.ruleName).toBe('Orphan Detection');
    });
  });

  describe('validate', () => {
    it('returns no issues when every joint resolves to an entity in the graph', async () => {
      mockContext.entityIds = ['root', 'child'];
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId !== 'anatomy:joint') return null;
          if (entityId === 'child') {
            return { parentId: 'root', socketId: 'neck' };
          }
          return null;
        }
      );

      const issues = await rule.validate(mockContext);

      expect(issues).toEqual([]);
      expect(mockContext.setMetadata).toHaveBeenCalledWith('rootEntities', [
        'root',
      ]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OrphanDetectionRule: Checking for orphans in graph with 2 entities'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OrphanDetectionRule: Found 0 orphans and 1 root entities'
      );
    });

    it('flags orphaned parts whose parents are missing from the graph', async () => {
      mockContext.entityIds = ['stray-arm'];
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:joint' && entityId === 'stray-arm') {
            return { parentId: 'missing-torso', socketId: 'shoulder' };
          }
          return null;
        }
      );

      const issues = await rule.validate(mockContext);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        severity: 'error',
        message:
          "Orphaned part 'stray-arm' has parent 'missing-torso' not in graph",
        ruleId: 'orphan-detection',
        context: {
          entityId: 'stray-arm',
          parentId: 'missing-torso',
          socketId: 'shoulder',
        },
      });
      expect(mockContext.setMetadata).toHaveBeenCalledWith('rootEntities', []);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OrphanDetectionRule: Found 1 orphans and 0 root entities'
      );
    });

    it('emits a warning when multiple root entities are present', async () => {
      mockContext.entityIds = ['root-a', 'root-b'];
      mockEntityManager.getComponentData.mockImplementation(() => null);

      const issues = await rule.validate(mockContext);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        severity: 'warning',
        message: 'Multiple root entities found: root-a, root-b',
        ruleId: 'orphan-detection',
        context: {
          rootEntities: ['root-a', 'root-b'],
          count: 2,
        },
      });
      expect(mockContext.setMetadata).toHaveBeenCalledWith('rootEntities', [
        'root-a',
        'root-b',
      ]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OrphanDetectionRule: Found 0 orphans and 2 root entities'
      );
    });
  });
});

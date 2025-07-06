import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { JointConsistencyRule } from '../../../../../src/anatomy/validation/rules/jointConsistencyRule.js';

describe('JointConsistencyRule', () => {
  let rule;
  let mockContext;
  let mockEntityManager;
  let mockLogger;

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
    };
    rule = new JointConsistencyRule();
  });

  describe('rule properties', () => {
    it('should have correct ruleId', () => {
      expect(rule.ruleId).toBe('joint-consistency');
    });

    it('should have correct ruleName', () => {
      expect(rule.ruleName).toBe('Joint Consistency Validation');
    });
  });

  describe('validate', () => {
    it('returns no issues for valid joints', async () => {
      mockContext.entityIds = ['parent', 'child'];
      mockEntityManager.getComponentData.mockImplementation((id, comp) => {
        if (id === 'child' && comp === 'anatomy:joint') {
          return { parentId: 'parent', socketId: 'socket1' };
        }
        if (id === 'parent' && comp === 'anatomy:sockets') {
          return { sockets: [{ id: 'socket1' }] };
        }
        return null;
      });

      const issues = await rule.validate(mockContext);
      expect(issues).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JointConsistencyRule: Validating joints for 2 entities'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'JointConsistencyRule: Found 0 joint consistency violations'
      );
    });

    it('detects incomplete joint data', async () => {
      mockContext.entityIds = ['child'];
      mockEntityManager.getComponentData.mockImplementation((id, comp) => {
        if (id === 'child' && comp === 'anatomy:joint') {
          return { socketId: 'socket1' }; // missing parentId
        }
        return null;
      });

      const issues = await rule.validate(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe(
        "Entity 'child' has incomplete joint data"
      );
      expect(issues[0].context.missingFields).toEqual(['parentId']);
    });

    it('detects non-existent parent', async () => {
      mockContext.entityIds = ['child'];
      mockEntityManager.getComponentData.mockImplementation((id, comp) => {
        if (id === 'child' && comp === 'anatomy:joint') {
          return { parentId: 'missing', socketId: 'socket1' };
        }
        return null;
      });

      const issues = await rule.validate(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe(
        "Entity 'child' has joint referencing non-existent parent 'missing'"
      );
    });

    it('detects missing socket on parent', async () => {
      mockContext.entityIds = ['parent', 'child'];
      mockEntityManager.getComponentData.mockImplementation((id, comp) => {
        if (id === 'child' && comp === 'anatomy:joint') {
          return { parentId: 'parent', socketId: 'missingSocket' };
        }
        if (id === 'parent' && comp === 'anatomy:sockets') {
          return { sockets: [{ id: 'otherSocket' }] };
        }
        return null;
      });

      const issues = await rule.validate(mockContext);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe(
        "Entity 'child' attached to non-existent socket 'missingSocket' on parent 'parent'"
      );
    });

    it('skips entities without joint component', async () => {
      mockContext.entityIds = ['parent', 'child'];
      mockEntityManager.getComponentData.mockImplementation((id, comp) => {
        if (id === 'parent' && comp === 'anatomy:sockets') {
          return { sockets: [] };
        }
        return null;
      });

      const issues = await rule.validate(mockContext);
      expect(issues).toEqual([]);
    });
  });
});

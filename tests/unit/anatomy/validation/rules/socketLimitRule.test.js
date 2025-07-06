import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SocketLimitRule } from '../../../../../src/anatomy/validation/rules/socketLimitRule.js';

describe('SocketLimitRule', () => {
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
      socketOccupancy: new Set(),
      entityManager: mockEntityManager,
      logger: mockLogger,
    };

    // Create rule instance
    rule = new SocketLimitRule();
  });

  describe('rule properties', () => {
    it('should have correct ruleId', () => {
      expect(rule.ruleId).toBe('socket-limit');
    });

    it('should have correct ruleName', () => {
      expect(rule.ruleName).toBe('Socket Limit Validation');
    });
  });

  describe('validate', () => {
    it('should return no issues when all sockets exist', async () => {
      // Setup
      mockContext.socketOccupancy.add('parent-1:socket-1');
      mockContext.socketOccupancy.add('parent-2:socket-2');

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:sockets') {
            if (entityId === 'parent-1') {
              return { sockets: [{ id: 'socket-1' }] };
            }
            if (entityId === 'parent-2') {
              return { sockets: [{ id: 'socket-2' }] };
            }
          }
          return null;
        }
      );

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify
      expect(issues).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SocketLimitRule: Validating 2 occupied sockets'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SocketLimitRule: Found 0 socket limit violations'
      );
    });

    it('should return error when socket not found', async () => {
      // Setup
      mockContext.socketOccupancy.add('parent-1:missing-socket');

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'parent-1' && componentId === 'anatomy:sockets') {
            return { sockets: [{ id: 'other-socket' }] };
          }
          return null;
        }
      );

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        severity: 'error',
        message: "Socket 'missing-socket' not found on entity 'parent-1'",
        ruleId: 'socket-limit',
        context: { parentId: 'parent-1', socketId: 'missing-socket' },
      });
    });

    it('should handle missing sockets component', async () => {
      // Setup
      mockContext.socketOccupancy.add('parent-1:socket-1');
      mockEntityManager.getComponentData.mockReturnValue(null);

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toBe(
        "Socket 'socket-1' not found on entity 'parent-1'"
      );
    });

    it('should handle empty socket occupancy', async () => {
      // Setup - empty socketOccupancy set

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify
      expect(issues).toEqual([]);
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should validate multiple socket issues', async () => {
      // Setup
      mockContext.socketOccupancy.add('parent-1:socket-1');
      mockContext.socketOccupancy.add('parent-1:socket-2');
      mockContext.socketOccupancy.add('parent-2:socket-3');

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'anatomy:sockets') {
            if (entityId === 'parent-1') {
              return { sockets: [{ id: 'socket-1' }] }; // missing socket-2
            }
            // parent-2 returns null
          }
          return null;
        }
      );

      // Execute
      const issues = await rule.validate(mockContext);

      // Verify
      expect(issues).toHaveLength(2);
      expect(issues[0].message).toBe(
        "Socket 'socket-2' not found on entity 'parent-1'"
      );
      expect(issues[1].message).toBe(
        "Socket 'socket-3' not found on entity 'parent-2'"
      );
    });
  });
});

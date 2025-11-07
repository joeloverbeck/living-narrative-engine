/**
 * @file Unit tests for special entity ID tokens in contextAssembler
 * Tests the 'system' special token handling
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { populateParticipant } from '../../../src/logic/contextAssembler.js';

describe('contextAssembler - Special Entity Tokens', () => {
  let mockLogger;
  let mockEntityManager;
  let evaluationContext;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponent: jest.fn(() => null), // Component accessor returns null for 'system'
    };

    evaluationContext = {};
  });

  describe("'system' token handling", () => {
    it("should create context for 'system' actor without entity lookup", () => {
      populateParticipant('actor', 'system', evaluationContext, mockEntityManager, mockLogger);

      expect(evaluationContext.actor).toBeDefined();
      expect(evaluationContext.actor.id).toBe('system');
      expect(evaluationContext.actor.components).toBeDefined();
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should create context for 'system' target without entity lookup", () => {
      populateParticipant('target', 'system', evaluationContext, mockEntityManager, mockLogger);

      expect(evaluationContext.target).toBeDefined();
      expect(evaluationContext.target.id).toBe('system');
      expect(evaluationContext.target.components).toBeDefined();
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should log debug message for 'system' token", () => {
      populateParticipant('actor', 'system', evaluationContext, mockEntityManager, mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Special 'system' token detected")
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Creating minimal context without entity lookup')
      );
    });

    it("should not trigger warnings for 'system' token", () => {
      populateParticipant('actor', 'system', evaluationContext, mockEntityManager, mockLogger);

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should create components accessor object for system token', () => {
      populateParticipant('actor', 'system', evaluationContext, mockEntityManager, mockLogger);

      // Component accessor should be an object (Proxy)
      expect(typeof evaluationContext.actor.components).toBe('object');
      expect(evaluationContext.actor.components).toBeDefined();

      // Component accessor should work with property access and return null for non-existent components
      // (The actual implementation creates a Proxy that uses entityManager.getComponentData)
      mockEntityManager.getComponentData = jest.fn(() => null);
      const hasComponent = evaluationContext.actor.components.someComponent;
      expect(hasComponent).toBeNull();
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('system', 'someComponent');
    });
  });

  describe('Regular entity ID handling (unchanged behavior)', () => {
    it('should still perform entity lookup for regular entity IDs', () => {
      const mockEntity = { id: 'entity-123' };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      populateParticipant('actor', 'entity-123', evaluationContext, mockEntityManager, mockLogger);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('entity-123');
      expect(evaluationContext.actor).toBeDefined();
      expect(evaluationContext.actor.id).toBe('entity-123');
    });

    it('should warn for non-existent regular entity IDs', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      populateParticipant('actor', 'nonexistent', evaluationContext, mockEntityManager, mockLogger);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('nonexistent');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Actor entity not found for ID [nonexistent]')
      );
    });

    it('should handle numeric entity IDs correctly', () => {
      const mockEntity = { id: 42 };
      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      populateParticipant('actor', 42, evaluationContext, mockEntityManager, mockLogger);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(42);
      expect(evaluationContext.actor).toBeDefined();
      expect(evaluationContext.actor.id).toBe(42);
    });
  });

  describe('Edge cases', () => {
    it("should handle 'system' case-sensitively", () => {
      // 'System' (capitalized) should NOT be treated as special token
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      populateParticipant('actor', 'System', evaluationContext, mockEntityManager, mockLogger);

      // Should attempt entity lookup since it's not exactly 'system'
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('System');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle empty string entity ID', () => {
      populateParticipant('actor', '', evaluationContext, mockEntityManager, mockLogger);

      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(evaluationContext.actor).toBeUndefined();
    });

    it('should handle null entity ID', () => {
      populateParticipant('actor', null, evaluationContext, mockEntityManager, mockLogger);

      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      expect(evaluationContext.actor).toBeUndefined();
    });
  });
});

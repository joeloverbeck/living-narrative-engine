/**
 * @file Tests for AnatomyLoadingDetector - Replaces 100ms timeout hack with proper anatomy detection
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

describe('AnatomyLoadingDetector - Anatomy Detection', () => {
  let anatomyLoadingDetector;
  let mockEntityManager;
  let mockEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    // Mock dependencies
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockEventDispatcher = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // This will fail initially - we haven't implemented AnatomyLoadingDetector yet
    const {
      AnatomyLoadingDetector,
    } = require('../../../../src/domUI/visualizer/AnatomyLoadingDetector.js');
    anatomyLoadingDetector = new AnatomyLoadingDetector({
      entityManager: mockEntityManager,
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    if (anatomyLoadingDetector && anatomyLoadingDetector.dispose) {
      anatomyLoadingDetector.dispose();
    }
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should require entityManager dependency', () => {
      const {
        AnatomyLoadingDetector,
      } = require('../../../../src/domUI/visualizer/AnatomyLoadingDetector.js');

      expect(() => {
        new AnatomyLoadingDetector({
          eventDispatcher: mockEventDispatcher,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: entityManager.');
    });

    it('should require eventDispatcher dependency', () => {
      const {
        AnatomyLoadingDetector,
      } = require('../../../../src/domUI/visualizer/AnatomyLoadingDetector.js');

      expect(() => {
        new AnatomyLoadingDetector({
          entityManager: mockEntityManager,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: eventDispatcher.');
    });

    it('should initialize with proper dependencies', () => {
      expect(anatomyLoadingDetector).toBeDefined();
    });
  });

  describe('Anatomy Detection', () => {
    it('should detect when anatomy is fully loaded', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          body: { parts: ['test:part1', 'test:part2'] },
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const result = await anatomyLoadingDetector.waitForAnatomyReady(entityId);

      expect(result).toBe(true);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        entityId
      );
      expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
    });

    it('should handle entity not found gracefully', async () => {
      const entityId = 'nonexistent:entity';
      mockEntityManager.getEntityInstance.mockRejectedValue(
        new Error('Entity not found')
      );

      const result = await anatomyLoadingDetector.waitForAnatomyReady(entityId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get entity'),
        expect.any(Error)
      );
    });

    it('should handle missing anatomy:body component', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue(null),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const result = await anatomyLoadingDetector.waitForAnatomyReady(entityId);

      expect(result).toBe(false);
    });

    it('should handle empty anatomy body', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({}),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const result = await anatomyLoadingDetector.waitForAnatomyReady(entityId);

      expect(result).toBe(false);
    });
  });

  describe('Event-Based Detection', () => {
    it('should listen for ENTITY_CREATED_ID events', () => {
      const entityId = 'test:entity:123';
      const callback = jest.fn();

      anatomyLoadingDetector.waitForEntityCreation(entityId, callback);

      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:entity_created',
        expect.any(Function)
      );
    });

    it('should call callback when target entity is created', () => {
      const entityId = 'test:entity:123';
      const callback = jest.fn();
      let eventHandler;

      mockEventDispatcher.subscribe.mockImplementation((eventType, handler) => {
        eventHandler = handler;
        return () => {}; // mock unsubscribe
      });

      anatomyLoadingDetector.waitForEntityCreation(entityId, callback);

      // Simulate entity creation event
      eventHandler({
        type: 'ENTITY_CREATED_ID',
        payload: { instanceId: entityId },
      });

      expect(callback).toHaveBeenCalledWith(entityId);
    });

    it('should not call callback for different entity', () => {
      const targetEntityId = 'test:entity:123';
      const differentEntityId = 'test:entity:456';
      const callback = jest.fn();
      let eventHandler;

      mockEventDispatcher.subscribe.mockImplementation((eventType, handler) => {
        eventHandler = handler;
        return () => {}; // mock unsubscribe
      });

      anatomyLoadingDetector.waitForEntityCreation(targetEntityId, callback);

      // Simulate entity creation event for different entity
      eventHandler({
        type: 'ENTITY_CREATED_ID',
        payload: { instanceId: differentEntityId },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should unsubscribe from events when callback is called', () => {
      const entityId = 'test:entity:123';
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      let eventHandler;

      mockEventDispatcher.subscribe.mockImplementation((eventType, handler) => {
        eventHandler = handler;
        return mockUnsubscribe;
      });

      anatomyLoadingDetector.waitForEntityCreation(entityId, callback);

      // Simulate entity creation event
      eventHandler({
        type: 'ENTITY_CREATED_ID',
        payload: { instanceId: entityId },
      });

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Timeout and Retry Logic', () => {
    it('should use configurable timeout for anatomy detection', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = {
        getComponentData: jest
          .fn()
          .mockReturnValueOnce(null) // First call - not ready
          .mockReturnValueOnce({ body: { parts: ['test:part1'] } }), // Second call - ready
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const result = await anatomyLoadingDetector.waitForAnatomyReady(
        entityId,
        {
          timeout: 1000,
          retryInterval: 50,
        }
      );

      expect(result).toBe(true);
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(2);
    });

    it('should timeout if anatomy is never ready', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue(null), // Always not ready
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const result = await anatomyLoadingDetector.waitForAnatomyReady(
        entityId,
        {
          timeout: 100, // Short timeout for test
          retryInterval: 20,
        }
      );

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Timeout waiting for anatomy'),
        expect.any(Object)
      );
    });

    it('should use exponential backoff for retries', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = {
        getComponentData: jest
          .fn()
          .mockReturnValueOnce(null)
          .mockReturnValueOnce(null)
          .mockReturnValueOnce({ body: { parts: ['test:part1'] } }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const result = await anatomyLoadingDetector.waitForAnatomyReady(
        entityId,
        {
          timeout: 1000,
          retryInterval: 50,
          useExponentialBackoff: true,
        }
      );

      expect(result).toBe(true);
      // Verify it took 3 attempts to succeed
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(3);
    });
  });
});

describe('AnatomyLoadingDetector - Comprehensive Integration', () => {
  let anatomyLoadingDetector;
  let mockEntityManager;
  let mockEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockEventDispatcher = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const {
      AnatomyLoadingDetector,
    } = require('../../../../src/domUI/visualizer/AnatomyLoadingDetector.js');
    anatomyLoadingDetector = new AnatomyLoadingDetector({
      entityManager: mockEntityManager,
      eventDispatcher: mockEventDispatcher,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    if (anatomyLoadingDetector && anatomyLoadingDetector.dispose) {
      anatomyLoadingDetector.dispose();
    }
    jest.clearAllMocks();
  });

  describe('Complete Workflow Integration', () => {
    it('should provide complete entity creation and anatomy detection workflow', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue({
          body: { parts: ['test:part1', 'test:part2'] },
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      let eventHandler;
      const mockUnsubscribe = jest.fn();
      mockEventDispatcher.subscribe.mockImplementation((eventType, handler) => {
        eventHandler = handler;
        return mockUnsubscribe;
      });

      // Start waiting for entity and anatomy
      const promise = anatomyLoadingDetector.waitForEntityWithAnatomy(entityId);

      // Simulate entity creation event
      eventHandler({
        type: 'ENTITY_CREATED_ID',
        payload: { instanceId: entityId },
      });

      const result = await promise;

      expect(result).toBe(true);
      expect(mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:entity_created',
        expect.any(Function)
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        entityId
      );
      expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle workflow failure gracefully', async () => {
      const entityId = 'test:entity:123';

      let eventHandler;
      const mockUnsubscribe = jest.fn();
      mockEventDispatcher.subscribe.mockImplementation((eventType, handler) => {
        eventHandler = handler;
        return mockUnsubscribe;
      });

      // Make entity manager fail
      mockEntityManager.getEntityInstance.mockRejectedValue(
        new Error('Entity fetch failed')
      );

      // Start waiting for entity and anatomy
      const promise = anatomyLoadingDetector.waitForEntityWithAnatomy(entityId);

      // Simulate entity creation event
      eventHandler({
        type: 'ENTITY_CREATED_ID',
        payload: { instanceId: entityId },
      });

      const result = await promise;

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should dispose event subscriptions on cleanup', () => {
      const mockUnsubscribe1 = jest.fn();
      const mockUnsubscribe2 = jest.fn();

      mockEventDispatcher.subscribe
        .mockReturnValueOnce(mockUnsubscribe1)
        .mockReturnValueOnce(mockUnsubscribe2);

      // Create some subscriptions
      anatomyLoadingDetector.waitForEntityCreation('entity1', () => {});
      anatomyLoadingDetector.waitForEntityCreation('entity2', () => {});

      anatomyLoadingDetector.dispose();

      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockUnsubscribe2).toHaveBeenCalled();
    });

    it('should prevent operations after disposal', () => {
      anatomyLoadingDetector.dispose();

      expect(() => {
        anatomyLoadingDetector.waitForEntityCreation('entity1', () => {});
      }).toThrow('AnatomyLoadingDetector has been disposed');
    });
  });
});

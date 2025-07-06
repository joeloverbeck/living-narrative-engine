/**
 * @file This test suite tests the behavior of HasBodyPartWithComponentValueHandler.
 * @see tests/unit/logic/operationHandlers/hasBodyPartWithComponentValueHandler.test.js
 */

import HasBodyPartWithComponentValueHandler from '../../../../src/logic/operationHandlers/hasBodyPartWithComponentValueHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';

describe('HasBodyPartWithComponentValueHandler', () => {
  let mockEntityManager;
  let mockBodyGraphService;
  let mockLogger;
  let handler;
  let executionContext;
  let dispatcher;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    executionContext = {
      evaluationContext: {
        context: {},
        variables: {
          actor: { id: 'actor-123' },
          target: { id: 'target-456' },
        },
      },
      instanceId: 'test-instance',
      logger: mockLogger,
    };
    handler = new HasBodyPartWithComponentValueHandler({
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      logger: mockLogger,
      safeEventDispatcher: dispatcher,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return true when body part has component with expected value', () => {
    // Arrange
    const params = ['actor', 'core:movement', 'locked', false];
    const mockEntity = {
      id: 'actor-123',
      getComponentData: jest.fn().mockReturnValue({ 
        body: { 
          root: 'body-123',
          parts: { 
            'left leg': 'left-leg-123',
            'right leg': 'right-leg-123'
          }
        }
      }),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
      found: true,
      partId: 'left-leg-123',
    });

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('actor-123');
    expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
    expect(mockBodyGraphService.hasPartWithComponentValue).toHaveBeenCalledWith(
      { 
        body: { 
          root: 'body-123',
          parts: { 
            'left leg': 'left-leg-123',
            'right leg': 'right-leg-123'
          }
        }
      },
      'core:movement',
      'locked',
      false
    );
    expect(result).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  test('should return false when body part does not have component with expected value', () => {
    // Arrange
    const params = ['actor', 'core:movement', 'locked', true];
    const mockEntity = {
      id: 'actor-123',
      getComponentData: jest.fn().mockReturnValue({ 
        body: { 
          root: 'body-123',
          parts: { 
            'left leg': 'left-leg-123',
            'right leg': 'right-leg-123'
          }
        }
      }),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
      found: false,
    });

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(result).toBe(false);
  });

  test('should return false when entity has no anatomy:body component', () => {
    // Arrange
    const params = ['actor', 'core:movement', 'locked', false];
    const mockEntity = {
      id: 'actor-123',
      getComponentData: jest.fn().mockReturnValue(null),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
    expect(mockBodyGraphService.hasPartWithComponentValue).not.toHaveBeenCalled();
    expect(result).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Entity actor-123 has no anatomy:body component'
    );
  });

  test('should return false when entity cannot be resolved', () => {
    // Arrange
    const params = ['nonexistent', 'core:movement', 'locked', false];
    mockEntityManager.getEntityInstance.mockReturnValue(null);

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(result).toBe(false);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Entity not found for reference: "nonexistent"'
    );
    expect(mockBodyGraphService.hasPartWithComponentValue).not.toHaveBeenCalled();
  });

  test('should handle direct entity ID references', () => {
    // Arrange
    const params = ['entity-789', 'core:movement', 'locked', false];
    const mockEntity = {
      id: 'entity-789',
      getComponentData: jest.fn().mockReturnValue({ 
        body: { 
          root: 'body-789',
          parts: { 
            'left leg': 'leg-789',
            'right leg': 'leg-789-r'
          }
        }
      }),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
      found: true,
      partId: 'leg-789',
    });

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('entity-789');
    expect(result).toBe(true);
  });

  test('should handle entity object references', () => {
    // Arrange
    const entityRef = { id: 'entity-999' };
    const params = [entityRef, 'core:movement', 'locked', false];
    const mockEntity = {
      id: 'entity-999',
      getComponentData: jest.fn().mockReturnValue({ 
        body: { 
          root: 'body-999',
          parts: { 
            'left leg': 'leg-999',
            'right leg': 'leg-999-r'
          }
        }
      }),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
      found: true,
      partId: 'leg-999',
    });

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('entity-999');
    expect(result).toBe(true);
  });

  test('should return false for invalid parameter count', () => {
    // Arrange
    const params = ['actor', 'core:movement'];

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(result).toBe(false);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'hasBodyPartWithComponentValue requires exactly 4 parameters'
        ),
      })
    );
  });

  test('should return false for non-array parameters', () => {
    // Arrange
    const params = 'not-an-array';

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(result).toBe(false);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining(
          'hasBodyPartWithComponentValue requires exactly 4 parameters'
        ),
      })
    );
  });

  test('should handle errors in bodyGraphService gracefully', () => {
    // Arrange
    const params = ['actor', 'core:movement', 'locked', false];
    const mockEntity = {
      id: 'actor-123',
      getComponentData: jest.fn().mockReturnValue({ 
        body: { 
          root: 'body-123',
          parts: { 
            'left leg': 'left-leg-123',
            'right leg': 'right-leg-123'
          }
        }
      }),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    const error = new Error('Service failure');
    mockBodyGraphService.hasPartWithComponentValue.mockImplementation(() => {
      throw error;
    });

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(result).toBe(false);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.any(String),
        details: expect.objectContaining({
          error: error,
        }),
      })
    );
  });

  test('should resolve context variable entity references', () => {
    // Arrange
    executionContext.evaluationContext.variables = {
      myEntity: 'entity-555',
    };
    const params = ['myEntity', 'core:movement', 'locked', false];
    const mockEntity = {
      id: 'entity-555',
      getComponentData: jest.fn().mockReturnValue({ 
        body: { 
          root: 'body-555',
          parts: { 
            'left leg': 'leg-555',
            'right leg': 'leg-555-r'
          }
        }
      }),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
      found: true,
      partId: 'leg-555',
    });

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('entity-555');
    expect(result).toBe(true);
  });

  test('should resolve context variable entity object references', () => {
    // Arrange
    executionContext.evaluationContext.variables = {
      myEntity: { id: 'entity-666' },
    };
    const params = ['myEntity', 'core:movement', 'locked', false];
    const mockEntity = {
      id: 'entity-666',
      getComponentData: jest.fn().mockReturnValue({ 
        body: { 
          root: 'body-666',
          parts: { 
            'left leg': 'leg-666',
            'right leg': 'leg-666-r'
          }
        }
      }),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
      found: true,
      partId: 'leg-666',
    });

    // Act
    const result = handler.execute(params, executionContext);

    // Assert
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('entity-666');
    expect(result).toBe(true);
  });

  test('should log debug messages with proper context', () => {
    // Arrange
    const params = ['actor', 'core:movement', 'locked', false];
    const mockEntity = {
      id: 'actor-123',
      getComponentData: jest.fn().mockReturnValue({ 
        body: { 
          root: 'body-123',
          parts: { 
            'left leg': 'left-leg-123',
            'right leg': 'right-leg-123'
          }
        }
      }),
    };
    mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
    mockBodyGraphService.hasPartWithComponentValue.mockReturnValue({
      found: true,
      partId: 'left-leg-123',
    });

    // Act
    handler.execute(params, executionContext);

    // Assert
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Checked body parts for component core:movement.locked=false: true',
      expect.objectContaining({
        entityId: 'actor-123',
        result: { found: true, partId: 'left-leg-123' },
      })
    );
  });
});
/**
 * @file Test suite for async description generation with Promise handling
 * @description Tests to ensure async/await patterns work correctly in the description generation flow
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionOrchestrator } from '../../../src/anatomy/BodyDescriptionOrchestrator.js';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import { DescriptionGenerationWorkflow } from '../../../src/anatomy/workflows/descriptionGenerationWorkflow.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('Async Description Generation', () => {
  let mockLogger;
  let mockBodyDescriptionComposer;
  let mockBodyGraphService;
  let mockEventDispatcher;
  let mockEntityManager;
  let mockPartDescriptionGenerator;
  let mockEntityFinder;
  let mockComponentManager;
  let mockEventDispatchService;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    mockBodyDescriptionComposer = {
      composeDescription: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      addComponent: jest.fn(),
    };

    mockPartDescriptionGenerator = {
      generateMultiplePartDescriptions: jest.fn(),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };

    mockComponentManager = {
      addComponent: jest.fn(),
    };

    mockEventDispatchService = {
      safeDispatchEvent: jest.fn(),
    };
  });

  describe('BodyDescriptionOrchestrator async methods', () => {
    let orchestrator;

    beforeEach(() => {
      orchestrator = new BodyDescriptionOrchestrator({
        logger: mockLogger,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        eventDispatcher: mockEventDispatcher,
        entityManager: mockEntityManager,
        partDescriptionGenerator: mockPartDescriptionGenerator,
      });
    });

    it('should handle async generateBodyDescription correctly', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue({ text: 'Test Entity' }),
      };

      const expectedDescription = 'A detailed body description';
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        expectedDescription
      );

      // Act
      const result = await orchestrator.generateBodyDescription(mockEntity);

      // Assert
      expect(result).toBe(expectedDescription);
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledTimes(1);
    });

    it('should handle async generateAllDescriptions correctly', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-1' },
        }),
      };

      const expectedDescription = 'A detailed body description';
      const expectedPartDescriptions = new Map([
        ['part-1', 'Part description'],
      ]);

      mockBodyGraphService.getAllParts.mockReturnValue(['part-1']);
      mockPartDescriptionGenerator.generateMultiplePartDescriptions.mockReturnValue(
        expectedPartDescriptions
      );
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        expectedDescription
      );

      // Act
      const result = await orchestrator.generateAllDescriptions(mockEntity);

      // Assert
      expect(result).toEqual({
        bodyDescription: expectedDescription,
        partDescriptions: expectedPartDescriptions,
      });
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);
    });

    it('should handle async getOrGenerateBodyDescription correctly', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ text: 'Existing desc' }),
      };

      const expectedDescription = 'A newly generated description';
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        expectedDescription
      );

      // Act
      const result =
        await orchestrator.getOrGenerateBodyDescription(mockEntity);

      // Assert
      expect(result).toBe(expectedDescription);
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);
    });

    it('should handle Promise rejection in generateBodyDescription', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue({ text: 'Test Entity' }),
      };

      const expectedError = new Error('Description generation failed');
      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        expectedError
      );

      // Act & Assert
      await expect(
        orchestrator.generateBodyDescription(mockEntity)
      ).rejects.toThrow(expectedError);
    });

    it('should handle empty description returned from async composeDescription', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue({ text: 'Test Entity' }),
      };

      mockBodyDescriptionComposer.composeDescription.mockResolvedValue('');

      // Act
      const result = await orchestrator.generateBodyDescription(mockEntity);

      // Assert
      expect(result).toBe('');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Description is empty'),
        })
      );
    });
  });

  describe('AnatomyDescriptionService async methods', () => {
    let anatomyService;

    beforeEach(() => {
      anatomyService = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder: {},
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
        eventDispatchService: mockEventDispatchService,
      });
    });

    it('should handle async generateAllDescriptions correctly', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-1' },
        }),
      };

      const expectedDescription = 'A detailed body description';
      mockBodyGraphService.getAllParts.mockReturnValue(['part-1']);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        expectedDescription
      );

      // Act
      await anatomyService.generateAllDescriptions(mockEntity);

      // Assert
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(mockBodyGraphService.getAllParts).toHaveBeenCalledTimes(1);
    });

    it('should handle async generateBodyDescription correctly', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue({ text: 'Test Entity' }),
      };

      const expectedDescription = 'A detailed body description';
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        expectedDescription
      );
      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);

      // Act
      await anatomyService.generateBodyDescription(mockEntity);

      // Assert
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);
      expect(mockComponentManager.addComponent).toHaveBeenCalledWith(
        'test-entity',
        'core:description',
        { text: expectedDescription }
      );
    });

    it('should handle async getOrGenerateBodyDescription correctly', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ text: 'Existing desc' }),
      };

      const expectedDescription = 'A newly generated description';
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        expectedDescription
      );

      // Act
      const result =
        await anatomyService.getOrGenerateBodyDescription(mockEntity);

      // Assert
      expect(result).toBe(expectedDescription);
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);
    });

    it('should handle Promise rejection in generateBodyDescription', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue({ text: 'Test Entity' }),
      };

      const expectedError = new Error('Description generation failed');
      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        expectedError
      );
      mockEntityFinder.getEntityInstance.mockReturnValue(mockEntity);

      // Act & Assert
      await expect(
        anatomyService.generateBodyDescription(mockEntity)
      ).rejects.toThrow(expectedError);
    });
  });

  describe('DescriptionGenerationWorkflow async methods', () => {
    let workflow;

    beforeEach(() => {
      workflow = new DescriptionGenerationWorkflow({
        entityManager: mockEntityManager,
        logger: mockLogger,
        anatomyDescriptionService: new AnatomyDescriptionService({
          bodyPartDescriptionBuilder: {},
          bodyDescriptionComposer: mockBodyDescriptionComposer,
          bodyGraphService: mockBodyGraphService,
          entityFinder: mockEntityFinder,
          componentManager: mockComponentManager,
          eventDispatchService: mockEventDispatchService,
        }),
      });
    });

    it('should handle async generateAll correctly', async () => {
      // Arrange
      const entityId = 'test-entity';
      const mockEntity = {
        id: entityId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-1' },
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyGraphService.getAllParts.mockReturnValue(['part-1']);
      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        'A detailed body description'
      );

      // Act
      await workflow.generateAll(entityId);

      // Assert
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        entityId
      );
      expect(
        mockBodyDescriptionComposer.composeDescription
      ).toHaveBeenCalledWith(mockEntity);
    });

    it('should handle Promise rejection in generateAll', async () => {
      // Arrange
      const entityId = 'test-entity';
      const mockEntity = {
        id: entityId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-1' },
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyGraphService.getAllParts.mockReturnValue(['part-1']); // Fix: mock getAllParts
      const expectedError = new Error('Description generation failed');
      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        expectedError
      );

      // Act & Assert
      await expect(workflow.generateAll(entityId)).rejects.toThrow(
        `Failed to generate descriptions for entity '${entityId}': ${expectedError.message}`
      );
    });

    it('should propagate error correctly without swallowing it', async () => {
      // Arrange
      const entityId = 'test-entity';
      const mockEntity = {
        id: entityId,
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-1' },
        }),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockBodyGraphService.getAllParts.mockReturnValue(['part-1']); // Fix: mock getAllParts
      const originalError = new Error('Async operation failed');
      mockBodyDescriptionComposer.composeDescription.mockRejectedValue(
        originalError
      );

      // Act & Assert
      await expect(workflow.generateAll(entityId)).rejects.toThrow(
        'Failed to generate descriptions'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate descriptions'),
        expect.objectContaining({
          error: originalError.message,
          stack: originalError.stack,
        })
      );
    });
  });

  describe('Promise handling edge cases', () => {
    let orchestrator;

    beforeEach(() => {
      orchestrator = new BodyDescriptionOrchestrator({
        logger: mockLogger,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        eventDispatcher: mockEventDispatcher,
        entityManager: mockEntityManager,
        partDescriptionGenerator: mockPartDescriptionGenerator,
      });
    });

    it('should handle null return from async composeDescription', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue({ text: 'Test Entity' }),
      };

      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(null);

      // Act
      const result = await orchestrator.generateBodyDescription(mockEntity);

      // Assert
      expect(result).toBeNull();
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Description is empty'),
        })
      );
    });

    it('should handle undefined return from async composeDescription', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue({ text: 'Test Entity' }),
      };

      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        undefined
      );

      // Act
      const result = await orchestrator.generateBodyDescription(mockEntity);

      // Assert
      expect(result).toBeUndefined();
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Description is empty'),
        })
      );
    });

    it('should handle whitespace-only return from async composeDescription', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue({ text: 'Test Entity' }),
      };

      mockBodyDescriptionComposer.composeDescription.mockResolvedValue(
        '   \n\t   '
      );

      // Act
      const result = await orchestrator.generateBodyDescription(mockEntity);

      // Assert
      expect(result).toBe('   \n\t   ');
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Description is empty'),
        })
      );
    });

    it('should not call trim() on Promise objects', async () => {
      // Arrange
      const mockEntity = {
        id: 'test-entity',
        getComponentData: jest.fn().mockReturnValue({ text: 'Test Entity' }),
      };

      // This test ensures we don't accidentally call .trim() on a Promise
      // which was the original bug
      const promiseSpy = jest.fn().mockResolvedValue('Valid description');
      mockBodyDescriptionComposer.composeDescription = promiseSpy;

      // Act
      const result = await orchestrator.generateBodyDescription(mockEntity);

      // Assert
      expect(result).toBe('Valid description');
      expect(promiseSpy).toHaveBeenCalledTimes(1);
      // The key assertion: we should never call .trim() on the Promise itself
      expect(promiseSpy.mock.results[0].value).toBeInstanceOf(Promise);
    });
  });
});

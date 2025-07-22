/**
 * @file Unit tests for CharacterBuilderService event dispatch with correct format
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  CharacterBuilderService,
  CHARACTER_BUILDER_EVENTS,
  CharacterBuilderError,
} from '../../../src/characterBuilder/services/characterBuilderService.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('CharacterBuilderService - Event Dispatch', () => {
  let service;
  let mockStorageService;
  let mockDirectionGenerator;
  let mockEventBus;
  let logger;

  beforeEach(() => {
    // Create real logger for testing
    logger = new ConsoleLogger('error');

    // Mock storage service
    mockStorageService = {
      initialize: jest.fn().mockResolvedValue(),
      storeCharacterConcept: jest.fn(),
      saveCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      updateCharacterConcept: jest.fn(),
    };

    // Mock direction generator
    mockDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
    };

    service = new CharacterBuilderService({
      logger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('event dispatch format', () => {
    it('should dispatch events with correct format (eventName, payload)', async () => {
      // Arrange
      const concept = 'A brave warrior seeking redemption';
      const savedConcept = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        concept,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockStorageService.storeCharacterConcept.mockResolvedValue(savedConcept);

      // Act
      await service.createCharacterConcept(concept, { autoSave: true });

      // Assert - should use dispatch(eventName, payload) NOT dispatch({ type, payload })
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED,
        expect.objectContaining({
          conceptId: savedConcept.id,
          concept: concept,
          autoSaved: true,
        })
      );

      // Should NOT be called with object containing type
      expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          payload: expect.any(Object),
        })
      );
    });

    it('should dispatch error events with correct format', async () => {
      // Arrange
      const concept = 'A character that will fail to save';
      const error = new Error('Database connection failed');
      mockStorageService.storeCharacterConcept.mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.createCharacterConcept(concept, { autoSave: true })
      ).rejects.toThrow(CharacterBuilderError);

      // Verify error event dispatched correctly
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED,
        expect.objectContaining({
          error: expect.stringContaining('Failed to create character concept'),
          operation: 'createCharacterConcept',
          concept: concept,
          attempts: 3,
          finalError: 'Database connection failed',
        })
      );
    });
  });

  describe('all event types', () => {
    it('should dispatch CONCEPT_CREATED event correctly', async () => {
      // Arrange
      const concept = 'A mysterious mage';
      const savedConcept = {
        id: 'concept-1',
        concept,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockStorageService.storeCharacterConcept.mockResolvedValue(savedConcept);

      // Act
      await service.createCharacterConcept(concept);

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_CREATED', // Actual string value
        expect.objectContaining({
          conceptId: 'concept-1',
        })
      );
    });

    it('should dispatch DIRECTIONS_GENERATED event correctly', async () => {
      // Arrange
      const conceptId = 'concept-1';
      const concept = {
        id: conceptId,
        concept: 'A brave knight',
      };
      const directions = [
        {
          id: 'dir-1',
          theme: 'Adventure',
          description: 'Epic quest',
        },
      ];

      mockStorageService.getCharacterConcept.mockResolvedValue(concept);
      mockDirectionGenerator.generateDirections.mockResolvedValue(directions);
      mockStorageService.storeThematicDirections.mockResolvedValue(directions);

      // Act
      await service.generateThematicDirections(conceptId);

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'THEMATIC_DIRECTIONS_GENERATED', // Actual string value
        expect.objectContaining({
          conceptId,
          directionCount: 1,
          autoSaved: true,
        })
      );
    });

    it('should dispatch CONCEPT_UPDATED event correctly', async () => {
      // Arrange
      const conceptId = 'concept-1';
      const updates = { status: 'completed' };
      const updatedConcept = {
        id: conceptId,
        concept: 'Updated concept',
        status: 'completed',
      };

      mockStorageService.getCharacterConcept.mockResolvedValue({
        id: conceptId,
        concept: 'Original concept',
        status: 'draft',
      });
      mockStorageService.saveCharacterConcept.mockResolvedValue(updatedConcept);

      // Act
      const result = await service.updateCharacterConcept(conceptId, updates);

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_UPDATED', // Actual string value
        expect.objectContaining({
          concept: updatedConcept,
          updates,
        })
      );
    });

    it('should dispatch CONCEPT_DELETED event correctly', async () => {
      // Arrange
      const conceptId = 'concept-1';
      mockStorageService.deleteCharacterConcept.mockResolvedValue(true);

      // Act
      await service.deleteCharacterConcept(conceptId);

      // Assert
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_DELETED', // Actual string value
        expect.objectContaining({
          conceptId,
        })
      );
    });

    it('should dispatch ERROR_OCCURRED event correctly', async () => {
      // Arrange
      const conceptId = 'concept-1';
      const error = new Error('Update failed');
      mockStorageService.updateCharacterConcept.mockRejectedValue(error);

      // Act & Assert
      await expect(
        service.updateCharacterConcept(conceptId, { status: 'error' })
      ).rejects.toThrow(CharacterBuilderError);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED', // Actual string value
        expect.objectContaining({
          error: expect.stringContaining('Failed to update character concept'),
          operation: 'updateCharacterConcept',
          conceptId,
        })
      );
    });
  });

  describe('event payload validation', () => {
    it('should include all required fields in error payloads', async () => {
      // Arrange
      const concept = 'Test concept';
      const error = new Error('Storage error');
      mockStorageService.storeCharacterConcept.mockRejectedValue(error);

      // Act
      try {
        await service.createCharacterConcept(concept);
      } catch (e) {
        // Expected error
      }

      // Assert
      const errorCall = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0] === CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED
      );
      expect(errorCall).toBeDefined();

      const errorPayload = errorCall[1];
      expect(errorPayload).toHaveProperty('error');
      expect(errorPayload).toHaveProperty('operation');
      expect(errorPayload).toHaveProperty('finalError');
      expect(errorPayload.error).toContain(
        'Failed to create character concept'
      );
      expect(errorPayload.operation).toBe('createCharacterConcept');
    });

    it('should truncate long concept text in payloads', async () => {
      // Arrange
      const longConcept = 'A'.repeat(150); // 150 characters
      const error = new Error('Failed');
      mockStorageService.storeCharacterConcept.mockRejectedValue(error);

      // Act
      try {
        await service.createCharacterConcept(longConcept);
      } catch (e) {
        // Expected error
      }

      // Assert
      const errorCall = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0] === CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED
      );
      const errorPayload = errorCall[1];
      expect(errorPayload.concept).toBe('A'.repeat(100) + '...');
    });
  });
});

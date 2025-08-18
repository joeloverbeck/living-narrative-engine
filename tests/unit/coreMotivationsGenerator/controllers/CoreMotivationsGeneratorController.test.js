/**
 * @file Unit tests for CoreMotivationsGeneratorController
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CoreMotivationsGeneratorControllerTestBed } from '../../../common/coreMotivationsGeneratorControllerTestBed.js';

describe('CoreMotivationsGeneratorController', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new CoreMotivationsGeneratorControllerTestBed();
    await testBed.setup();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with required dependencies', () => {
      expect(testBed.controller).toBeDefined();
      expect(testBed.controller.constructor.name).toBe(
        'CoreMotivationsGeneratorController'
      );
    });

    it('should load current concept on initialization', async () => {
      // Arrange
      const mockConcepts = [
        { id: 'concept-1', concept: 'A brave warrior' },
        { id: 'concept-2', concept: 'A wise mage' },
      ];
      testBed.mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        mockConcepts
      );

      // Act
      await testBed.controller.initialize();

      // Assert
      expect(
        testBed.mockCharacterBuilderService.getAllCharacterConcepts
      ).toHaveBeenCalled();
      expect(testBed.logger.info).toHaveBeenCalledWith(
        'Loaded concept: concept-2'
      );
    });

    it('should load eligible directions with clichés', async () => {
      // Arrange
      const { directions } = testBed.setupSuccessfulDirectionLoad();

      // Act
      await testBed.controller.initialize();

      // Assert
      expect(
        testBed.mockCharacterBuilderService.getThematicDirectionsByConceptId
      ).toHaveBeenCalled();
      expect(
        testBed.mockCharacterBuilderService.hasClichesForDirection
      ).toHaveBeenCalledTimes(directions.length);
    });

    it('should dispatch initialization event', async () => {
      // Arrange
      testBed.setupSuccessfulDirectionLoad();

      // Act
      await testBed.controller.initialize();

      // Assert
      const initEvent = testBed.dispatchedEvents.find(
        (event) => event.type === 'CORE_MOTIVATIONS_UI_INITIALIZED'
      );
      expect(initEvent).toBeDefined();
      expect(initEvent.payload.conceptId).toBeDefined();
      expect(initEvent.payload.eligibleDirectionsCount).toBeGreaterThanOrEqual(
        0
      );
    });

    it('should throw error when no character concept found', async () => {
      // Arrange
      testBed.mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );

      // Act & Assert
      await expect(testBed.controller.initialize()).rejects.toThrow(
        'No character concept found'
      );
    });
  });

  describe('Direction Management', () => {
    beforeEach(async () => {
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();
    });

    it('should display eligible directions', () => {
      // Assert
      const container = document.getElementById('direction-selector');
      expect(container.style.display).not.toBe('none');
      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should handle direction selection', async () => {
      // Arrange
      const directionId = 'test-direction-1';
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Act
      const container = document.getElementById('direction-selector');
      const directionElement = container.querySelector(
        `[data-direction-id="${directionId}"]`
      );
      directionElement.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Assert
      expect(directionElement.classList.contains('selected')).toBe(true);
      expect(
        testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledWith(directionId);
    });

    it('should dispatch direction selected event', async () => {
      // Arrange
      const directionId = 'test-direction-1';
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Act
      const container = document.getElementById('direction-selector');
      const directionElement = container.querySelector(
        `[data-direction-id="${directionId}"]`
      );
      directionElement.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Assert
      const selectionEvent = testBed.dispatchedEvents.find(
        (event) => event.type === 'CORE_MOTIVATIONS_DIRECTION_SELECTED'
      );
      expect(selectionEvent).toBeDefined();
      expect(selectionEvent.payload.directionId).toBe(directionId);
    });
  });

  describe('Motivation Generation', () => {
    beforeEach(async () => {
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();
      await testBed.selectDirection('test-direction-1');
    });

    it('should generate motivations successfully', async () => {
      // Arrange
      const mockMotivations = [
        { id: 'motivation-1', text: 'Seek adventure', createdAt: new Date() },
      ];
      testBed.mockCoreMotivationsGenerator.generate.mockResolvedValue(
        mockMotivations
      );
      testBed.mockCharacterBuilderService.saveCoreMotivations.mockResolvedValue(
        ['motivation-1']
      );

      // Act
      const generateBtn = document.getElementById('generate-btn');
      generateBtn.click();
      await testBed.waitForAsyncOperations();

      // Assert
      expect(testBed.mockCoreMotivationsGenerator.generate).toHaveBeenCalled();
      expect(
        testBed.mockCharacterBuilderService.saveCoreMotivations
      ).toHaveBeenCalledWith('test-direction-1', mockMotivations);
    });

    it('should dispatch generation started event', async () => {
      // Arrange
      testBed.mockCoreMotivationsGenerator.generate.mockResolvedValue([]);
      testBed.mockCharacterBuilderService.saveCoreMotivations.mockResolvedValue(
        []
      );

      // Act
      const generateBtn = document.getElementById('generate-btn');
      generateBtn.click();
      await testBed.waitForAsyncOperations();

      // Assert
      const startEvent = testBed.dispatchedEvents.find(
        (event) => event.type === 'CORE_MOTIVATIONS_GENERATION_STARTED'
      );
      expect(startEvent).toBeDefined();
      expect(startEvent.payload.directionId).toBe('test-direction-1');
    });

    it('should dispatch generation completed event', async () => {
      // Arrange
      const mockMotivations = [
        { id: 'motivation-1', text: 'Seek adventure', createdAt: new Date() },
      ];
      testBed.mockCoreMotivationsGenerator.generate.mockResolvedValue(
        mockMotivations
      );
      testBed.mockCharacterBuilderService.saveCoreMotivations.mockResolvedValue(
        ['motivation-1']
      );

      // Act
      const generateBtn = document.getElementById('generate-btn');
      generateBtn.click();
      await testBed.waitForAsyncOperations();

      // Assert
      const completedEvent = testBed.dispatchedEvents.find(
        (event) => event.type === 'CORE_MOTIVATIONS_GENERATION_COMPLETED'
      );
      expect(completedEvent).toBeDefined();
      expect(completedEvent.payload.motivationIds).toEqual(['motivation-1']);
    });

    it('should handle generation failure', async () => {
      // Arrange
      const error = new Error('Generation failed');
      testBed.mockCoreMotivationsGenerator.generate.mockRejectedValue(error);

      // Act
      const generateBtn = document.getElementById('generate-btn');
      generateBtn.click();
      await testBed.waitForAsyncOperations();

      // Assert
      const failedEvent = testBed.dispatchedEvents.find(
        (event) => event.type === 'CORE_MOTIVATIONS_GENERATION_FAILED'
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent.payload.error).toBe('Generation failed');
    });
  });

  describe('Motivation Management', () => {
    beforeEach(async () => {
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();
      await testBed.selectDirection('test-direction-1');
    });

    it('should display existing motivations', async () => {
      // Arrange
      const mockMotivations = [
        {
          id: 'motivation-1',
          text: 'Seek adventure',
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 'motivation-2',
          text: 'Protect the innocent',
          createdAt: new Date('2023-01-02'),
        },
      ];
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockMotivations
      );

      // Act
      await testBed.controller.initialize();
      await testBed.selectDirection('test-direction-1');

      // Assert
      const container = document.getElementById('motivations-container');
      expect(container.style.display).not.toBe('none');
      expect(
        testBed.mockDisplayEnhancer.createMotivationBlock
      ).toHaveBeenCalledTimes(2);
    });

    it('should delete specific motivation', async () => {
      // Arrange
      testBed.mockCharacterBuilderService.removeCoreMotivationItem.mockResolvedValue(
        true
      );
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Act
      const deleteBtn = testBed.createMockDeleteButton('motivation-1');
      deleteBtn.click();
      await testBed.waitForAsyncOperations();

      // Assert
      expect(
        testBed.mockCharacterBuilderService.removeCoreMotivationItem
      ).toHaveBeenCalledWith('test-direction-1', 'motivation-1');
    });

    it('should clear all motivations with confirmation', async () => {
      // Arrange
      // First ensure we have motivations to clear
      const mockMotivations = [
        { id: 'motivation-1', text: 'Test motivation', createdAt: new Date() },
      ];
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockMotivations
      );

      // Load the motivations into the controller state
      await testBed.selectDirection('test-direction-1');

      testBed.mockCharacterBuilderService.clearCoreMotivationsForDirection.mockResolvedValue(
        1
      );
      testBed.setupConfirmationModal();

      // Act
      const clearBtn = document.getElementById('clear-all-btn');
      clearBtn.click();

      // Wait for modal to be displayed
      await testBed.waitForAsyncOperations();

      const confirmBtn = document.getElementById('confirm-clear');
      confirmBtn.click();

      // Wait for the async handler to complete
      await testBed.waitForAsyncOperations();

      // Assert
      expect(
        testBed.mockCharacterBuilderService.clearCoreMotivationsForDirection
      ).toHaveBeenCalledWith('test-direction-1');
    });
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();
      await testBed.selectDirection('test-direction-1');
    });

    it('should export motivations to text', async () => {
      // Arrange
      const mockMotivations = [
        { id: 'motivation-1', text: 'Seek adventure', createdAt: new Date() },
      ];
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockMotivations
      );

      // Load motivations into controller state by selecting direction
      await testBed.selectDirection('test-direction-1');

      testBed.mockDisplayEnhancer.formatMotivationsForExport.mockReturnValue(
        'Exported text'
      );

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(),
        },
      });

      // Act
      const exportBtn = document.getElementById('export-btn');
      exportBtn.click();
      await testBed.waitForAsyncOperations();

      // Assert
      expect(
        testBed.mockDisplayEnhancer.formatMotivationsForExport
      ).toHaveBeenCalled();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Exported text'
      );
    });

    it('should show warning when no motivations to export', async () => {
      // Arrange
      // Ensure no motivations are loaded (default state)
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Re-select direction to ensure empty motivations are loaded
      await testBed.selectDirection('test-direction-1');

      // Mock the showWarning method before the controller uses it
      const controller = testBed.controller;
      const originalShowWarning = controller.showWarning;
      controller.showWarning = jest.fn();

      // Act
      const exportBtn = document.getElementById('export-btn');
      exportBtn.disabled = false; // Ensure button is enabled for test
      exportBtn.click();

      // Assert
      expect(controller.showWarning).toHaveBeenCalledWith(
        'No motivations to export'
      );

      // Restore original method
      controller.showWarning = originalShowWarning;
    });
  });

  describe('UI State Management', () => {
    beforeEach(async () => {
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();
    });

    it('should disable generate button when no direction selected', () => {
      // Assert
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn.disabled).toBe(true);
    });

    it('should enable generate button when direction selected', async () => {
      // Act
      await testBed.selectDirection('test-direction-1');

      // Assert
      const generateBtn = document.getElementById('generate-btn');
      expect(generateBtn.disabled).toBe(false);
    });

    it('should disable buttons during generation', async () => {
      // Arrange
      await testBed.selectDirection('test-direction-1');

      // Mock the required services for generation
      testBed.mockCharacterBuilderService.getCharacterConceptById.mockResolvedValue(
        { id: 'concept-1', concept: 'A brave warrior' }
      );
      testBed.mockCharacterBuilderService.getClichesByDirectionId.mockResolvedValue(
        [{ id: 'cliche-1', text: 'Test cliche' }]
      );

      let resolveFn;
      const generationPromise = new Promise((resolve) => {
        resolveFn = resolve;
      });

      testBed.mockCoreMotivationsGenerator.generate.mockImplementation(() => {
        // Check button state while generation is in progress
        const btn = document.getElementById('generate-btn');
        expect(btn.disabled).toBe(true);
        return generationPromise;
      });

      testBed.mockCharacterBuilderService.saveCoreMotivations.mockResolvedValue(
        ['motivation-1']
      );

      // Act
      const generateBtn = document.getElementById('generate-btn');

      // Start generation (this is async)
      const clickPromise = generateBtn.click();

      // Clean up - resolve the promise
      resolveFn([]);

      // Wait for generation to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it('should show loading indicator during generation', async () => {
      // Arrange
      await testBed.selectDirection('test-direction-1');

      // Mock the required services for generation
      testBed.mockCharacterBuilderService.getCharacterConceptById.mockResolvedValue(
        { id: 'concept-1', concept: 'A brave warrior' }
      );
      testBed.mockCharacterBuilderService.getClichesByDirectionId.mockResolvedValue(
        [{ id: 'cliche-1', text: 'Test cliche' }]
      );

      let resolveFn;
      const generationPromise = new Promise((resolve) => {
        resolveFn = resolve;
      });

      testBed.mockCoreMotivationsGenerator.generate.mockImplementation(() => {
        // Check loading indicator while generation is in progress
        const indicator = document.getElementById('loading-indicator');
        expect(indicator.style.display).toBe('flex');
        return generationPromise;
      });

      testBed.mockCharacterBuilderService.saveCoreMotivations.mockResolvedValue(
        ['motivation-1']
      );

      // Act
      const generateBtn = document.getElementById('generate-btn');

      // Start generation (this is async)
      const clickPromise = generateBtn.click();

      // Clean up - resolve the promise
      resolveFn([]);

      // Wait for generation to complete
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      // Arrange
      const error = new Error('Initialization failed');
      testBed.mockCharacterBuilderService.getAllCharacterConcepts.mockRejectedValue(
        error
      );
      const controller = testBed.controller;
      controller.showError = jest.fn();

      // Act & Assert
      await expect(controller.initialize()).rejects.toThrow(
        'Initialization failed'
      );
      expect(controller.showError).toHaveBeenCalledWith(
        'Failed to initialize. Please refresh the page.'
      );
    });

    it('should handle direction loading errors', async () => {
      // Arrange
      const error = new Error('Direction loading failed');
      testBed.mockCharacterBuilderService.getThematicDirectionsByConceptId.mockRejectedValue(
        error
      );

      // Act & Assert
      await expect(testBed.controller.initialize()).rejects.toThrow(
        'Direction loading failed'
      );
    });
  });

  describe('Keyboard Shortcuts', () => {
    beforeEach(async () => {
      testBed.setupSuccessfulDirectionLoad();
      await testBed.controller.initialize();
      await testBed.selectDirection('test-direction-1');
    });

    it('should trigger generation with Ctrl+Enter', async () => {
      // Arrange
      testBed.mockCoreMotivationsGenerator.generate.mockResolvedValue([]);
      testBed.mockCharacterBuilderService.saveCoreMotivations.mockResolvedValue(
        []
      );

      // Act
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
      });
      document.dispatchEvent(event);
      await testBed.waitForAsyncOperations();

      // Assert
      expect(testBed.mockCoreMotivationsGenerator.generate).toHaveBeenCalled();
    });
  });
});

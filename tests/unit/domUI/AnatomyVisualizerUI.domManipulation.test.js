/**
 * @file AnatomyVisualizerUI.domManipulation.test.js
 * @description Unit tests for DOM manipulation methods in AnatomyVisualizerUI
 */

import { jest } from '@jest/globals';

// Mock DomUtils
jest.mock('../../../src/utils/domUtils.js', () => ({
  DomUtils: {
    textToHtml: jest.fn(),
  },
}));

import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';
import { DomUtils } from '../../../src/utils/domUtils.js';

describe('AnatomyVisualizerUI - DOM Manipulation', () => {
  let mockLogger;
  let mockRegistry;
  let mockEntityManager;
  let mockAnatomyDescriptionService;
  let mockEventDispatcher;
  let mockVisualizerStateController;
  let mockVisualizationComposer;
  let mockClothingManagementService;
  let mockDocument;
  let visualizerUI;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock registry
    mockRegistry = {
      getAllEntityDefinitions: jest.fn(),
      getEntityDefinition: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      createEntityInstance: jest.fn(),
      getEntityInstance: jest.fn(),
      removeEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
    };

    // Mock anatomy description service
    mockAnatomyDescriptionService = {};

    // Mock clothing management service
    mockClothingManagementService = {
      getEquippedItems: jest.fn(),
    };

    // Mock event dispatcher
    mockEventDispatcher = {
      subscribe: jest.fn(),
    };

    // Mock visualizer state controller
    mockVisualizerStateController = {
      selectEntity: jest.fn(),
      handleError: jest.fn(),
      reset: jest.fn(),
      startRendering: jest.fn(),
      completeRendering: jest.fn(),
    };

    // Mock visualization composer
    mockVisualizationComposer = {
      initialize: jest.fn(),
      renderGraph: jest.fn(),
      clear: jest.fn(),
    };

    // Mock document
    mockDocument = {
      getElementById: jest.fn(),
      createElement: jest.fn(),
    };

    // Create instance
    visualizerUI = new AnatomyVisualizerUI({
      logger: mockLogger,
      registry: mockRegistry,
      entityManager: mockEntityManager,
      anatomyDescriptionService: mockAnatomyDescriptionService,
      eventDispatcher: mockEventDispatcher,
      documentContext: { document: mockDocument },
      visualizerStateController: mockVisualizerStateController,
      visualizationComposer: mockVisualizationComposer,
      clothingManagementService: mockClothingManagementService,
    });

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('_escapeHtml', () => {
    it('should escape HTML characters', () => {
      // Arrange
      const unsafeString =
        '<script>alert("xss")</script> & "quotes" & \'apostrophes\'';

      // Act
      const result = visualizerUI._escapeHtml(unsafeString);

      // Assert
      expect(result).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;quotes&quot; &amp; &#039;apostrophes&#039;'
      );
    });

    it('should handle empty string', () => {
      // Act
      const result = visualizerUI._escapeHtml('');

      // Assert
      expect(result).toBe('');
    });

    it('should handle string with no HTML characters', () => {
      // Arrange
      const safeString = 'This is a safe string with no HTML characters';

      // Act
      const result = visualizerUI._escapeHtml(safeString);

      // Assert
      expect(result).toBe(safeString);
    });
  });

  describe('_showMessage', () => {
    it('should display escaped message in graph container', () => {
      // Arrange
      const message = '<script>alert("xss")</script>Loading...';
      const mockGraphContainer = {
        innerHTML: '',
      };
      mockDocument.getElementById.mockReturnValue(mockGraphContainer);

      // Act
      visualizerUI._showMessage(message);

      // Assert
      expect(mockDocument.getElementById).toHaveBeenCalledWith(
        'anatomy-graph-container'
      );
      expect(mockGraphContainer.innerHTML).toBe(
        '<div class="message">&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;Loading...</div>'
      );
    });

    it('should handle missing graph container', () => {
      // Arrange
      const message = 'Loading...';
      mockDocument.getElementById.mockReturnValue(null);

      // Act
      visualizerUI._showMessage(message);

      // Assert
      expect(mockDocument.getElementById).toHaveBeenCalledWith(
        'anatomy-graph-container'
      );
      // Should not throw error
    });
  });

  describe('_updateEntityDescription', () => {
    it('should update description with entity text', () => {
      // Arrange
      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:description') {
            return { text: 'This is a test description\nWith multiple lines' };
          }
          return null;
        }),
      };

      const mockDescriptionContent = {
        innerHTML: '',
      };
      mockDocument.getElementById.mockReturnValue(mockDescriptionContent);

      DomUtils.textToHtml.mockReturnValue(
        'This is a test description<br>With multiple lines'
      );

      // Act
      visualizerUI._updateEntityDescription(mockEntity);

      // Assert
      expect(mockDocument.getElementById).toHaveBeenCalledWith(
        'entity-description-content'
      );
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'core:description'
      );
      expect(DomUtils.textToHtml).toHaveBeenCalledWith(
        'This is a test description\nWith multiple lines'
      );
      expect(mockDescriptionContent.innerHTML).toBe(
        '<p>This is a test description<br>With multiple lines</p>'
      );
    });

    it('should handle entity without description', () => {
      // Arrange
      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };

      const mockDescriptionContent = {
        innerHTML: '',
      };
      mockDocument.getElementById.mockReturnValue(mockDescriptionContent);

      // Act
      visualizerUI._updateEntityDescription(mockEntity);

      // Assert
      expect(mockDescriptionContent.innerHTML).toBe(
        '<p>No description available for this entity.</p>'
      );
    });

    it('should handle entity with empty description text', () => {
      // Arrange
      const mockEntity = {
        getComponentData: jest.fn((type) => {
          if (type === 'core:description') {
            return { text: '' };
          }
          return null;
        }),
      };

      const mockDescriptionContent = {
        innerHTML: '',
      };
      mockDocument.getElementById.mockReturnValue(mockDescriptionContent);

      // Act
      visualizerUI._updateEntityDescription(mockEntity);

      // Assert
      expect(mockDescriptionContent.innerHTML).toBe(
        '<p>No description available for this entity.</p>'
      );
    });

    it('should handle missing description content element', () => {
      // Arrange
      const mockEntity = {
        getComponentData: jest.fn(() => ({ text: 'Test' })),
      };

      mockDocument.getElementById.mockReturnValue(null);

      // Act
      visualizerUI._updateEntityDescription(mockEntity);

      // Assert
      expect(mockDocument.getElementById).toHaveBeenCalledWith(
        'entity-description-content'
      );
      // Should not throw error
    });
  });

  describe('_clearVisualization', () => {
    it('should clear all visualization elements', async () => {
      // Arrange
      const mockDescriptionContent = { innerHTML: 'existing content' };
      const mockEquipmentContent = { innerHTML: 'existing equipment' };

      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'entity-description-content') return mockDescriptionContent;
        if (id === 'equipment-content') return mockEquipmentContent;
        return null;
      });

      jest.spyOn(visualizerUI, '_clearPreviousEntities').mockResolvedValue();

      // Act
      await visualizerUI._clearVisualization();

      // Assert
      expect(mockVisualizerStateController.reset).toHaveBeenCalled();
      expect(visualizerUI._clearPreviousEntities).toHaveBeenCalled();
      expect(mockVisualizationComposer.clear).toHaveBeenCalled();
      expect(mockDescriptionContent.innerHTML).toBe(
        '<p>Select an entity to view its description.</p>'
      );
      expect(mockEquipmentContent.innerHTML).toBe(
        '<p class="message">Select an entity to view its equipment.</p>'
      );
      expect(visualizerUI._equipmentCache.size).toBe(0);
    });

    it('should handle missing DOM elements gracefully', async () => {
      // Arrange
      mockDocument.getElementById.mockReturnValue(null);
      jest.spyOn(visualizerUI, '_clearPreviousEntities').mockResolvedValue();

      // Act
      await visualizerUI._clearVisualization();

      // Assert
      expect(mockVisualizerStateController.reset).toHaveBeenCalled();
      expect(visualizerUI._clearPreviousEntities).toHaveBeenCalled();
      expect(mockVisualizationComposer.clear).toHaveBeenCalled();
      // Should not throw error
    });

    it('should handle error during entity cleanup', async () => {
      // Arrange
      const mockDescriptionContent = { innerHTML: 'existing content' };
      const mockEquipmentContent = { innerHTML: 'existing equipment' };

      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'entity-description-content') return mockDescriptionContent;
        if (id === 'equipment-content') return mockEquipmentContent;
        return null;
      });

      const error = new Error('Cleanup failed');
      jest
        .spyOn(visualizerUI, '_clearPreviousEntities')
        .mockRejectedValue(error);

      // Act
      await expect(visualizerUI._clearVisualization()).rejects.toThrow(
        'Cleanup failed'
      );

      // Assert
      expect(mockVisualizerStateController.reset).toHaveBeenCalled();
      expect(visualizerUI._clearPreviousEntities).toHaveBeenCalled();
      // Should propagate the error
    });
  });

  describe('_setupEventListeners', () => {
    it('should setup event listener for entity selector', () => {
      // Arrange
      const mockSelector = {
        addEventListener: jest.fn(),
      };
      mockDocument.getElementById.mockReturnValue(mockSelector);

      // Act
      visualizerUI._setupEventListeners();

      // Assert
      expect(mockDocument.getElementById).toHaveBeenCalledWith(
        'entity-selector'
      );
      expect(mockSelector.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('should handle missing entity selector', () => {
      // Arrange
      mockDocument.getElementById.mockReturnValue(null);

      // Act
      visualizerUI._setupEventListeners();

      // Assert
      expect(mockDocument.getElementById).toHaveBeenCalledWith(
        'entity-selector'
      );
      // Should not throw error
    });

    it('should handle selector change with entity ID', () => {
      // Arrange
      const mockSelector = {
        addEventListener: jest.fn(),
      };
      mockDocument.getElementById.mockReturnValue(mockSelector);

      jest.spyOn(visualizerUI, '_loadEntity').mockResolvedValue();

      // Act
      visualizerUI._setupEventListeners();

      // Get the event handler
      const [, eventHandler] = mockSelector.addEventListener.mock.calls[0];

      // Simulate change event
      const mockEvent = {
        target: { value: 'test-entity-123' },
      };

      eventHandler(mockEvent);

      // Assert
      expect(visualizerUI._loadEntity).toHaveBeenCalledWith('test-entity-123');
    });

    it('should handle selector change with empty value', () => {
      // Arrange
      const mockSelector = {
        addEventListener: jest.fn(),
      };
      mockDocument.getElementById.mockReturnValue(mockSelector);

      jest.spyOn(visualizerUI, '_clearVisualization').mockResolvedValue();

      // Act
      visualizerUI._setupEventListeners();

      // Get the event handler
      const [, eventHandler] = mockSelector.addEventListener.mock.calls[0];

      // Simulate change event
      const mockEvent = {
        target: { value: '' },
      };

      eventHandler(mockEvent);

      // Assert
      expect(visualizerUI._clearVisualization).toHaveBeenCalled();
    });
  });
});

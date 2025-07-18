/**
 * @file AnatomyVisualizerUI.equipmentUI.test.js
 * @description Unit tests for equipment UI rendering in AnatomyVisualizerUI
 */

import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';
import { jest } from '@jest/globals';

describe('AnatomyVisualizerUI - Equipment UI Rendering', () => {
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
      createDocumentFragment: jest.fn(),
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
  });

  describe('_updateEquipmentDisplay', () => {
    it('should display error message when equipment result is not successful', () => {
      // Arrange
      const mockContainer = { innerHTML: '' };
      mockDocument.getElementById.mockReturnValue(mockContainer);

      const equipmentResult = {
        success: false,
        error: 'Failed to fetch equipment',
      };

      // Act
      visualizerUI._updateEquipmentDisplay(equipmentResult);

      // Assert
      expect(mockDocument.getElementById).toHaveBeenCalledWith(
        'equipment-content'
      );
      expect(mockContainer.innerHTML).toBe(
        '<p class="message error">Failed to load equipment data</p>'
      );
    });

    it('should display no equipment message when entity has no equipment', () => {
      // Arrange
      const mockContainer = { innerHTML: '' };
      mockDocument.getElementById.mockReturnValue(mockContainer);

      const equipmentResult = {
        success: true,
        hasEquipment: false,
      };

      // Act
      visualizerUI._updateEquipmentDisplay(equipmentResult);

      // Assert
      expect(mockContainer.innerHTML).toBe(
        '<p class="message">This entity has no equipment</p>'
      );
    });

    it('should display no items message when no equipment data', () => {
      // Arrange
      const mockContainer = { innerHTML: '' };
      mockDocument.getElementById.mockReturnValue(mockContainer);

      const equipmentResult = {
        success: true,
        hasEquipment: true,
        equipmentData: [],
      };

      // Act
      visualizerUI._updateEquipmentDisplay(equipmentResult);

      // Assert
      expect(mockContainer.innerHTML).toBe(
        '<p class="message">No items equipped</p>'
      );
    });

    it('should display no items message when equipment data is null', () => {
      // Arrange
      const mockContainer = { innerHTML: '' };
      mockDocument.getElementById.mockReturnValue(mockContainer);

      const equipmentResult = {
        success: true,
        hasEquipment: true,
        equipmentData: null,
      };

      // Act
      visualizerUI._updateEquipmentDisplay(equipmentResult);

      // Assert
      expect(mockContainer.innerHTML).toBe(
        '<p class="message">No items equipped</p>'
      );
    });

    it('should render equipment data when available', () => {
      // Arrange
      const mockContainer = { innerHTML: '', appendChild: jest.fn() };
      const mockFragment = { appendChild: jest.fn() };

      mockDocument.getElementById.mockReturnValue(mockContainer);
      mockDocument.createDocumentFragment.mockReturnValue(mockFragment);

      const equipmentResult = {
        success: true,
        hasEquipment: true,
        equipmentData: [
          {
            slotId: 'head',
            layers: [
              {
                layerName: 'base',
                items: [{ name: 'Hat', material: 'cotton' }],
              },
            ],
          },
        ],
      };

      jest
        .spyOn(visualizerUI, '_createEquipmentFragment')
        .mockReturnValue(mockFragment);

      // Act
      visualizerUI._updateEquipmentDisplay(equipmentResult);

      // Assert
      expect(mockContainer.innerHTML).toBe('');
      expect(visualizerUI._createEquipmentFragment).toHaveBeenCalledWith(
        equipmentResult.equipmentData
      );
      expect(mockContainer.appendChild).toHaveBeenCalledWith(mockFragment);
    });

    it('should handle missing equipment container', () => {
      // Arrange
      mockDocument.getElementById.mockReturnValue(null);

      const equipmentResult = {
        success: true,
        hasEquipment: true,
        equipmentData: [],
      };

      // Act
      visualizerUI._updateEquipmentDisplay(equipmentResult);

      // Assert
      expect(mockDocument.getElementById).toHaveBeenCalledWith(
        'equipment-content'
      );
      // Should not throw error
    });
  });

  describe('_createEquipmentFragment', () => {
    it('should create fragment with equipment slots', () => {
      // Arrange
      const mockFragment = { appendChild: jest.fn() };
      const mockSlotElement = { className: 'equipment-slot' };

      mockDocument.createDocumentFragment.mockReturnValue(mockFragment);
      jest
        .spyOn(visualizerUI, '_createSlotElement')
        .mockReturnValue(mockSlotElement);

      const equipmentData = [
        {
          slotId: 'head',
          layers: [
            {
              layerName: 'base',
              items: [{ name: 'Hat' }],
            },
          ],
        },
        {
          slotId: 'torso',
          layers: [
            {
              layerName: 'base',
              items: [{ name: 'Shirt' }],
            },
          ],
        },
      ];

      // Act
      const result = visualizerUI._createEquipmentFragment(equipmentData);

      // Assert
      expect(result).toBe(mockFragment);
      expect(visualizerUI._createSlotElement).toHaveBeenCalledTimes(2);
      expect(mockFragment.appendChild).toHaveBeenCalledTimes(2);
    });
  });

  describe('_createSlotElement', () => {
    it('should create slot element with header and layers', () => {
      // Arrange
      const mockSlotDiv = { className: '', appendChild: jest.fn() };
      const mockHeader = { className: '', textContent: '' };
      const mockLayerDiv = { className: 'equipment-layer' };

      let createElementCallCount = 0;
      mockDocument.createElement.mockImplementation((tag) => {
        if (tag === 'div') {
          createElementCallCount++;
          return createElementCallCount === 1 ? mockSlotDiv : mockHeader;
        }
        return mockHeader;
      });

      jest
        .spyOn(visualizerUI, '_createLayerElement')
        .mockReturnValue(mockLayerDiv);
      jest.spyOn(visualizerUI, '_formatSlotName').mockReturnValue('Head');

      const slotData = {
        slotId: 'head',
        layers: [
          {
            layerName: 'base',
            items: [{ name: 'Hat' }],
          },
        ],
      };

      // Act
      const result = visualizerUI._createSlotElement(slotData);

      // Assert
      expect(result).toBe(mockSlotDiv);
      expect(mockSlotDiv.className).toBe('equipment-slot');
      expect(mockHeader.className).toBe('equipment-slot-header');
      expect(mockHeader.textContent).toBe('Head');
      expect(mockSlotDiv.appendChild).toHaveBeenCalledWith(mockHeader);
      expect(mockSlotDiv.appendChild).toHaveBeenCalledWith(mockLayerDiv);
    });
  });

  describe('_createLayerElement', () => {
    it('should create layer element with name and items', () => {
      // Arrange
      const mockLayerDiv = { className: '', appendChild: jest.fn() };
      const mockLayerName = { className: '', textContent: '' };
      const mockItemDiv = { className: 'equipment-item' };

      let createElementCallCount = 0;
      mockDocument.createElement.mockImplementation((tag) => {
        if (tag === 'div') {
          createElementCallCount++;
          return createElementCallCount === 1 ? mockLayerDiv : mockLayerName;
        }
        return mockLayerName;
      });

      jest
        .spyOn(visualizerUI, '_createItemElement')
        .mockReturnValue(mockItemDiv);

      const layerData = {
        layerName: 'base',
        items: [
          { name: 'Hat', material: 'cotton' },
          { name: 'Shirt', material: 'linen' },
        ],
      };

      // Act
      const result = visualizerUI._createLayerElement(layerData);

      // Assert
      expect(result).toBe(mockLayerDiv);
      expect(mockLayerDiv.className).toBe('equipment-layer');
      expect(mockLayerName.className).toBe('equipment-layer-name');
      expect(mockLayerName.textContent).toBe('Layer: base');
      expect(mockLayerDiv.appendChild).toHaveBeenCalledWith(mockLayerName);
      expect(visualizerUI._createItemElement).toHaveBeenCalledTimes(2);
      expect(mockLayerDiv.appendChild).toHaveBeenCalledWith(mockItemDiv);
    });
  });

  describe('_createItemElement', () => {
    it('should create item element with name and details', () => {
      // Arrange
      const mockItemDiv = { className: '', appendChild: jest.fn() };
      const mockNameSpan = { className: '', textContent: '' };
      const mockDetailsSpan = { className: '', textContent: '' };

      mockDocument.createElement.mockImplementation((tag) => {
        if (tag === 'div') return mockItemDiv;
        return tag === 'span' ? mockNameSpan : mockDetailsSpan;
      });

      // Mock multiple createElement calls for spans
      let spanCallCount = 0;
      mockDocument.createElement.mockImplementation((tag) => {
        if (tag === 'div') return mockItemDiv;
        if (tag === 'span') {
          spanCallCount++;
          return spanCallCount === 1 ? mockNameSpan : mockDetailsSpan;
        }
        return {};
      });

      const itemData = {
        name: 'Blue Hat',
        material: 'cotton',
        color: 'blue',
      };

      // Act
      const result = visualizerUI._createItemElement(itemData);

      // Assert
      expect(result).toBe(mockItemDiv);
      expect(mockItemDiv.className).toBe('equipment-item');
      expect(mockNameSpan.className).toBe('equipment-item-name');
      expect(mockNameSpan.textContent).toBe('• Blue Hat');
      expect(mockDetailsSpan.className).toBe('equipment-item-details');
      expect(mockDetailsSpan.textContent).toBe(' (cotton, blue)');
      expect(mockItemDiv.appendChild).toHaveBeenCalledWith(mockNameSpan);
      expect(mockItemDiv.appendChild).toHaveBeenCalledWith(mockDetailsSpan);
    });

    it('should create item element without details when material and color are unknown', () => {
      // Arrange
      const mockItemDiv = { className: '', appendChild: jest.fn() };
      const mockNameSpan = { className: '', textContent: '' };

      mockDocument.createElement.mockImplementation((tag) => {
        if (tag === 'div') return mockItemDiv;
        return mockNameSpan;
      });

      const itemData = {
        name: 'Simple Hat',
        material: 'unknown',
        color: 'unknown',
      };

      // Act
      const result = visualizerUI._createItemElement(itemData);

      // Assert
      expect(result).toBe(mockItemDiv);
      expect(mockItemDiv.className).toBe('equipment-item');
      expect(mockNameSpan.className).toBe('equipment-item-name');
      expect(mockNameSpan.textContent).toBe('• Simple Hat');
      expect(mockItemDiv.appendChild).toHaveBeenCalledWith(mockNameSpan);
      expect(mockItemDiv.appendChild).toHaveBeenCalledTimes(1); // Only name span
    });

    it('should create item element with partial details', () => {
      // Arrange
      const mockItemDiv = { className: '', appendChild: jest.fn() };
      const mockNameSpan = { className: '', textContent: '' };
      const mockDetailsSpan = { className: '', textContent: '' };

      let spanCallCount = 0;
      mockDocument.createElement.mockImplementation((tag) => {
        if (tag === 'div') return mockItemDiv;
        if (tag === 'span') {
          spanCallCount++;
          return spanCallCount === 1 ? mockNameSpan : mockDetailsSpan;
        }
        return {};
      });

      const itemData = {
        name: 'Leather Boots',
        material: 'leather',
        color: 'unknown',
      };

      // Act
      const result = visualizerUI._createItemElement(itemData);

      // Assert
      expect(result).toBe(mockItemDiv);
      expect(mockDetailsSpan.textContent).toBe(' (leather)');
      expect(mockItemDiv.appendChild).toHaveBeenCalledWith(mockDetailsSpan);
    });
  });

  describe('_formatSlotName', () => {
    it('should format slot ID to human-readable name', () => {
      // Test cases
      expect(visualizerUI._formatSlotName('head')).toBe('Head');
      expect(visualizerUI._formatSlotName('underwear_upper')).toBe(
        'Underwear Upper'
      );
      expect(visualizerUI._formatSlotName('left_hand')).toBe('Left Hand');
      expect(visualizerUI._formatSlotName('torso_outer')).toBe('Torso Outer');
    });

    it('should handle single word slot names', () => {
      expect(visualizerUI._formatSlotName('torso')).toBe('Torso');
      expect(visualizerUI._formatSlotName('legs')).toBe('Legs');
    });

    it('should handle empty string', () => {
      expect(visualizerUI._formatSlotName('')).toBe('');
    });
  });
});

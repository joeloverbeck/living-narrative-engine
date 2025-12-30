/**
 * @file RecipeSelectorService.test.js
 * @description Unit tests for RecipeSelectorService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RecipeSelectorService from '../../../../src/domUI/shared/RecipeSelectorService.js';

describe('RecipeSelectorService', () => {
  let mockDataRegistry;
  let mockLogger;
  let mockSelectElement;
  let service;

  beforeEach(() => {
    // Mock data registry
    mockDataRegistry = {
      getAllEntityDefinitions: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock select element with children array for testing
    const children = [];
    mockSelectElement = {
      innerHTML: '',
      appendChild: jest.fn((child) => {
        children.push(child);
      }),
      get children() {
        return children;
      },
    };

    // Mock document.createElement
    global.document = {
      createElement: jest.fn((tag) => ({
        value: '',
        textContent: '',
      })),
    };

    service = new RecipeSelectorService({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    delete global.document;
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw when dataRegistry is missing required methods', () => {
      expect(() => {
        new RecipeSelectorService({
          dataRegistry: {},
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw when logger is missing required methods', () => {
      expect(() => {
        new RecipeSelectorService({
          dataRegistry: mockDataRegistry,
          logger: {},
        });
      }).toThrow();
    });
  });

  describe('populateWithComponent', () => {
    it('should populate select element with entities having specified component', () => {
      // Arrange
      const mockDefinitions = [
        {
          id: 'test:entity1',
          components: {
            'anatomy:body': { templateId: 'humanoid' },
            'core:name': { text: 'Entity One' },
          },
        },
        {
          id: 'test:entity2',
          components: {
            'anatomy:body': { templateId: 'beast' },
            'core:name': { text: 'Entity Two' },
          },
        },
      ];
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue(mockDefinitions);

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(mockSelectElement.appendChild).toHaveBeenCalledTimes(3); // 1 default + 2 entities
      expect(mockLogger.info).toHaveBeenCalledWith(
        'RecipeSelectorService: Found 2 entities with anatomy:body'
      );
    });

    it('should filter entities without the required component', () => {
      // Arrange
      const mockDefinitions = [
        {
          id: 'test:with-anatomy',
          components: {
            'anatomy:body': { templateId: 'humanoid' },
          },
        },
        {
          id: 'test:without-anatomy',
          components: {
            'core:name': { text: 'No Body' },
          },
        },
        {
          id: 'test:with-different',
          components: {
            'some:other': { data: 'value' },
          },
        },
      ];
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue(mockDefinitions);

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test:with-anatomy');
    });

    it('should sort entities alphabetically by name', () => {
      // Arrange
      const mockDefinitions = [
        {
          id: 'test:zebra',
          components: {
            'anatomy:body': {},
            'core:name': { text: 'Zebra Entity' },
          },
        },
        {
          id: 'test:alpha',
          components: {
            'anatomy:body': {},
            'core:name': { text: 'Alpha Entity' },
          },
        },
        {
          id: 'test:middle',
          components: {
            'anatomy:body': {},
            'core:name': { text: 'Middle Entity' },
          },
        },
      ];
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue(mockDefinitions);

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].components['core:name'].text).toBe('Alpha Entity');
      expect(result[1].components['core:name'].text).toBe('Middle Entity');
      expect(result[2].components['core:name'].text).toBe('Zebra Entity');
    });

    it('should handle entities with only id (no name)', () => {
      // Arrange
      const mockDefinitions = [
        {
          id: 'test:entity-no-name',
          components: {
            'anatomy:body': {},
          },
        },
        {
          id: 'test:entity-with-name',
          components: {
            'anatomy:body': {},
            'core:name': { text: 'Named Entity' },
          },
        },
      ];
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue(mockDefinitions);

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert - sorted by name/id, so Named Entity comes first (N < t)
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('test:entity-with-name');
      expect(result[1].id).toBe('test:entity-no-name');
    });

    it('should add default "Select..." option', () => {
      // Arrange
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue([]);
      let capturedOption = null;
      mockSelectElement.appendChild = jest.fn((child) => {
        capturedOption = child;
      });

      // Act
      service.populateWithComponent(mockSelectElement, 'anatomy:body');

      // Assert
      expect(mockSelectElement.appendChild).toHaveBeenCalledTimes(1); // Just default
      expect(capturedOption.value).toBe('');
      expect(capturedOption.textContent).toBe('Select...');
    });

    it('should use custom placeholder text when provided', () => {
      // Arrange
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue([]);
      let capturedOption = null;
      mockSelectElement.appendChild = jest.fn((child) => {
        capturedOption = child;
      });

      // Act
      service.populateWithComponent(mockSelectElement, 'anatomy:body', {
        placeholderText: 'Choose an entity...',
      });

      // Assert
      expect(capturedOption.textContent).toBe('Choose an entity...');
    });

    it('should clear previous options before populating', () => {
      // Arrange
      mockSelectElement.innerHTML = '<option>Old Option</option>';
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue([]);

      // Act
      service.populateWithComponent(mockSelectElement, 'anatomy:body');

      // Assert
      expect(mockSelectElement.innerHTML).toBe('');
    });

    it('should return array of filtered definitions', () => {
      // Arrange
      const mockDefinitions = [
        {
          id: 'test:entity1',
          components: { 'anatomy:body': {} },
        },
        {
          id: 'test:entity2',
          components: { 'other:component': {} },
        },
      ];
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue(mockDefinitions);

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test:entity1');
    });

    it('should handle empty registry gracefully', () => {
      // Arrange
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue([]);

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert
      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'RecipeSelectorService: Registry returned no definitions'
      );
    });

    it('should handle null select element gracefully', () => {
      // Act
      const result = service.populateWithComponent(null, 'anatomy:body');

      // Assert
      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RecipeSelectorService: No select element provided, returning empty array'
      );
    });

    it('should handle null/undefined definitions in registry', () => {
      // Arrange
      const mockDefinitions = [
        null,
        undefined,
        {
          id: 'test:valid',
          components: { 'anatomy:body': {} },
        },
      ];
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue(mockDefinitions);

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test:valid');
    });

    it('should handle entities with null components', () => {
      // Arrange
      const mockDefinitions = [
        {
          id: 'test:null-components',
          components: null,
        },
        {
          id: 'test:valid',
          components: { 'anatomy:body': {} },
        },
      ];
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue(mockDefinitions);

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test:valid');
    });

    it('should handle registry error gracefully', () => {
      // Arrange
      const error = new Error('Registry error');
      mockDataRegistry.getAllEntityDefinitions.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'RecipeSelectorService: Failed to populate selector:',
        error
      );
      expect(mockSelectElement.innerHTML).toBe(
        '<option value="">Error loading entities</option>'
      );
    });

    it('should handle undefined registry result', () => {
      // Arrange
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue(undefined);

      // Act
      const result = service.populateWithComponent(
        mockSelectElement,
        'anatomy:body'
      );

      // Assert
      expect(result).toEqual([]);
    });
  });
});

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  loadBlueprint,
  detectBlueprintVersion,
  loadStructureTemplate,
} from '../../../../src/anatomy/bodyBlueprintFactory/blueprintLoader.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

describe('blueprintLoader', () => {
  let mockDataRegistry;
  let mockBlueprintProcessorService;
  let mockLogger;

  beforeEach(() => {
    mockDataRegistry = {
      get: jest.fn(),
    };

    mockBlueprintProcessorService = {
      processBlueprint: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('loadBlueprint', () => {
    it('should throw InvalidArgumentError if blueprint not found', () => {
      mockDataRegistry.get.mockReturnValue(null);

      expect(() =>
        loadBlueprint('test:missing', {
          dataRegistry: mockDataRegistry,
          blueprintProcessorService: mockBlueprintProcessorService,
        })
      ).toThrow(InvalidArgumentError);

      expect(() =>
        loadBlueprint('test:missing', {
          dataRegistry: mockDataRegistry,
          blueprintProcessorService: mockBlueprintProcessorService,
        })
      ).toThrow("Blueprint 'test:missing' not found in registry");
    });

    it('should delegate to blueprintProcessorService for all blueprints', () => {
      const rawBlueprint = {
        id: 'test:humanoid',
        root: 'core:body',
        schemaVersion: '2.0',
        structureTemplate: 'core:biped',
      };

      const processedBlueprint = {
        ...rawBlueprint,
        slots: { head: {}, torso: {} },
        _generatedSockets: [{ id: 'socket1' }],
        _generatedSlots: { head: {}, torso: {} },
      };

      mockDataRegistry.get.mockReturnValue(rawBlueprint);
      mockBlueprintProcessorService.processBlueprint.mockReturnValue(
        processedBlueprint
      );

      const result = loadBlueprint('test:humanoid', {
        dataRegistry: mockDataRegistry,
        blueprintProcessorService: mockBlueprintProcessorService,
      });

      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyBlueprints',
        'test:humanoid'
      );
      expect(mockBlueprintProcessorService.processBlueprint).toHaveBeenCalledWith(
        rawBlueprint
      );
      expect(result).toBe(processedBlueprint);
    });

    it('should delegate V1 blueprints to processor service', () => {
      const v1Blueprint = {
        id: 'test:simple',
        root: 'core:body',
        slots: { head: {} },
      };

      const processedBlueprint = { ...v1Blueprint };

      mockDataRegistry.get.mockReturnValue(v1Blueprint);
      mockBlueprintProcessorService.processBlueprint.mockReturnValue(
        processedBlueprint
      );

      const result = loadBlueprint('test:simple', {
        dataRegistry: mockDataRegistry,
        blueprintProcessorService: mockBlueprintProcessorService,
      });

      expect(mockBlueprintProcessorService.processBlueprint).toHaveBeenCalledWith(
        v1Blueprint
      );
      expect(result).toBe(processedBlueprint);
    });
  });

  describe('detectBlueprintVersion', () => {
    it('should return 2 for V2 blueprints', () => {
      const blueprint = { schemaVersion: '2.0' };
      expect(detectBlueprintVersion(blueprint)).toBe(2);
    });

    it('should return 1 for blueprints without schemaVersion', () => {
      const blueprint = { id: 'test:old' };
      expect(detectBlueprintVersion(blueprint)).toBe(1);
    });

    it('should return 1 for V1 blueprints with explicit version', () => {
      const blueprint = { schemaVersion: '1.0' };
      expect(detectBlueprintVersion(blueprint)).toBe(1);
    });

    it('should return 1 for blueprints with empty schemaVersion', () => {
      const blueprint = { schemaVersion: '' };
      expect(detectBlueprintVersion(blueprint)).toBe(1);
    });
  });

  describe('loadStructureTemplate', () => {
    it('should return template when found', () => {
      const template = { slots: ['head', 'torso'] };
      mockDataRegistry.get.mockReturnValue(template);

      const result = loadStructureTemplate(
        'core:biped',
        mockDataRegistry,
        mockLogger
      );

      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyStructureTemplates',
        'core:biped'
      );
      expect(result).toBe(template);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "BlueprintLoader: Loaded structure template 'core:biped'"
      );
    });

    it('should throw ValidationError if template not found', () => {
      mockDataRegistry.get.mockReturnValue(null);

      expect(() =>
        loadStructureTemplate('core:missing', mockDataRegistry, mockLogger)
      ).toThrow(ValidationError);

      expect(() =>
        loadStructureTemplate('core:missing', mockDataRegistry, mockLogger)
      ).toThrow('Structure template not found: core:missing');
    });
  });
});

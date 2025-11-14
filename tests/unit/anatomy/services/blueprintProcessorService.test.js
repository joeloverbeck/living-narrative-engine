/**
 * @file Unit tests for BlueprintProcessorService
 *
 * Tests the blueprint processing service which centralizes V1/V2 blueprint
 * processing logic for both production and validation contexts.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import BlueprintProcessorService from '../../../../src/anatomy/services/blueprintProcessorService.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

describe('BlueprintProcessorService', () => {
  let testBed;
  let service;
  let mockLogger;
  let mockDataRegistry;
  let mockSocketGenerator;
  let mockSlotGenerator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockDataRegistry = testBed.createMock('dataRegistry', ['get']);
    mockSocketGenerator = testBed.createMock('socketGenerator', [
      'generateSockets',
    ]);
    mockSlotGenerator = testBed.createMock('slotGenerator', [
      'generateBlueprintSlots',
    ]);

    service = new BlueprintProcessorService({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      socketGenerator: mockSocketGenerator,
      slotGenerator: mockSlotGenerator,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Version Detection', () => {
    it('should detect V1 blueprints (schemaVersion 1.0)', () => {
      const blueprint = { id: 'test:bp1', schemaVersion: 1.0 };
      expect(service.detectVersion(blueprint)).toBe(1);
    });

    it('should detect V1 blueprints (missing schemaVersion)', () => {
      const blueprint = { id: 'test:bp1' };
      expect(service.detectVersion(blueprint)).toBe(1);
    });

    it('should detect V2 blueprints (schemaVersion "2.0")', () => {
      const blueprint = { id: 'test:bp2', schemaVersion: '2.0' };
      expect(service.detectVersion(blueprint)).toBe(2);
    });
  });

  describe('Already-Processed Detection', () => {
    it('should detect unprocessed blueprints', () => {
      const blueprint = { id: 'test:bp1' };
      expect(service.isProcessed(blueprint)).toBe(false);
    });

    it('should detect processed blueprints with array format', () => {
      const blueprint = {
        id: 'test:bp1',
        _generatedSockets: [{ id: 'socket1' }],
      };
      expect(service.isProcessed(blueprint)).toBe(true);
    });

    it('should detect processed blueprints with boolean format (legacy)', () => {
      const blueprint = { id: 'test:bp1', _generatedSockets: true };
      expect(service.isProcessed(blueprint)).toBe(true);
    });

    it('should handle empty array as processed', () => {
      const blueprint = { id: 'test:bp1', _generatedSockets: [] };
      expect(service.isProcessed(blueprint)).toBe(true);
    });
  });

  describe('V1 Blueprint Processing', () => {
    it('should return V1 blueprints unchanged', () => {
      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: 1.0,
        root: 'torso',
        slots: {
          head: { socket: 'neck', type: 'body_part' },
          torso: { socket: null, type: 'body_part' },
        },
      };

      const result = service.processBlueprint(blueprint);

      expect(result).toEqual(blueprint);
      expect(result).toBe(blueprint); // Same reference
    });

    it('should log debug message for V1 pass-through', () => {
      const blueprint = { id: 'test:bp1', schemaVersion: 1.0 };

      service.processBlueprint(blueprint);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('V1 blueprint')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('pass-through')
      );
    });

    it('should not call generators for V1 blueprints', () => {
      const blueprint = { id: 'test:bp1', schemaVersion: 1.0 };

      service.processBlueprint(blueprint);

      expect(mockSocketGenerator.generateSockets).not.toHaveBeenCalled();
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
    });
  });

  describe('V2 Blueprint Processing', () => {
    const mockStructureTemplate = {
      id: 'core:humanoid_structure',
      regions: [
        {
          id: 'torso',
          sockets: [{ id: 'neck', position: 'top', orientation: 'up' }],
        },
      ],
    };

    const mockGeneratedSockets = [
      { id: 'neck', regionId: 'torso', position: 'top', orientation: 'up' },
    ];

    const mockGeneratedSlots = {
      head: { socket: 'neck', type: 'body_part' },
      torso: { socket: null, type: 'body_part' },
    };

    beforeEach(() => {
      mockDataRegistry.get.mockReturnValue(mockStructureTemplate);
      mockSocketGenerator.generateSockets.mockReturnValue(
        mockGeneratedSockets
      );
      mockSlotGenerator.generateBlueprintSlots.mockReturnValue(
        mockGeneratedSlots
      );
    });

    it('should load structure template from DataRegistry', () => {
      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        root: 'torso',
        structureTemplate: 'core:humanoid_structure',
      };

      service.processBlueprint(blueprint);

      expect(mockDataRegistry.get).toHaveBeenCalledWith(
        'anatomyStructureTemplates',
        'core:humanoid_structure'
      );
    });

    it('should throw ValidationError if structure template not found', () => {
      mockDataRegistry.get.mockReturnValue(null);

      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        structureTemplate: 'missing:template',
      };

      expect(() => service.processBlueprint(blueprint)).toThrow(
        ValidationError
      );
      expect(() => service.processBlueprint(blueprint)).toThrow(
        /Structure template not found: missing:template/
      );
    });

    it('should generate sockets from structure template', () => {
      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        root: 'torso',
        structureTemplate: 'core:humanoid_structure',
      };

      service.processBlueprint(blueprint);

      expect(mockSocketGenerator.generateSockets).toHaveBeenCalledWith(
        mockStructureTemplate
      );
    });

    it('should generate slots from structure template', () => {
      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        root: 'torso',
        structureTemplate: 'core:humanoid_structure',
      };

      service.processBlueprint(blueprint);

      expect(mockSlotGenerator.generateBlueprintSlots).toHaveBeenCalledWith(
        mockStructureTemplate
      );
    });

    it('should return enriched blueprint with generated slots', () => {
      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        root: 'torso',
        structureTemplate: 'core:humanoid_structure',
      };

      const result = service.processBlueprint(blueprint);

      expect(result.slots).toEqual(mockGeneratedSlots);
    });

    it('should return enriched blueprint with _generatedSockets as array', () => {
      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        root: 'torso',
        structureTemplate: 'core:humanoid_structure',
      };

      const result = service.processBlueprint(blueprint);

      expect(result._generatedSockets).toEqual(mockGeneratedSockets);
      expect(Array.isArray(result._generatedSockets)).toBe(true);
    });

    it('should preserve original blueprint fields', () => {
      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        root: 'torso',
        structureTemplate: 'core:humanoid_structure',
        customField: 'custom_value',
      };

      const result = service.processBlueprint(blueprint);

      expect(result.id).toBe('test:humanoid');
      expect(result.schemaVersion).toBe('2.0');
      expect(result.root).toBe('torso');
      expect(result.structureTemplate).toBe('core:humanoid_structure');
      expect(result.customField).toBe('custom_value');
    });

    it('should log processing completion', () => {
      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        structureTemplate: 'core:humanoid_structure',
      };

      service.processBlueprint(blueprint);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('processed successfully')
      );
    });
  });

  describe('Slot Merging (additionalSlots)', () => {
    const mockStructureTemplate = {
      id: 'core:humanoid_structure',
      regions: [],
    };

    const mockGeneratedSockets = [];

    beforeEach(() => {
      mockDataRegistry.get.mockReturnValue(mockStructureTemplate);
      mockSocketGenerator.generateSockets.mockReturnValue(
        mockGeneratedSockets
      );
    });

    it('should merge additionalSlots with generated slots', () => {
      const mockGeneratedSlots = {
        head: { socket: 'neck', type: 'body_part' },
        torso: { socket: null, type: 'body_part' },
      };

      const additionalSlots = {
        left_arm: { socket: 'left_shoulder', type: 'limb' },
      };

      mockSlotGenerator.generateBlueprintSlots.mockReturnValue(
        mockGeneratedSlots
      );

      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        structureTemplate: 'core:humanoid_structure',
        additionalSlots,
      };

      const result = service.processBlueprint(blueprint);

      expect(result.slots).toEqual({
        ...mockGeneratedSlots,
        ...additionalSlots,
      });
    });

    it('should prioritize additionalSlots over generated slots', () => {
      const mockGeneratedSlots = {
        head: { socket: 'neck', type: 'body_part' },
        torso: { socket: null, type: 'body_part' },
      };

      const additionalSlots = {
        head: { socket: 'custom_neck', type: 'custom_part' },
      };

      mockSlotGenerator.generateBlueprintSlots.mockReturnValue(
        mockGeneratedSlots
      );

      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        structureTemplate: 'core:humanoid_structure',
        additionalSlots,
      };

      const result = service.processBlueprint(blueprint);

      expect(result.slots.head).toEqual({
        socket: 'custom_neck',
        type: 'custom_part',
      });
    });

    it('should handle missing additionalSlots (use empty object)', () => {
      const mockGeneratedSlots = {
        head: { socket: 'neck', type: 'body_part' },
      };

      mockSlotGenerator.generateBlueprintSlots.mockReturnValue(
        mockGeneratedSlots
      );

      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        structureTemplate: 'core:humanoid_structure',
      };

      const result = service.processBlueprint(blueprint);

      expect(result.slots).toEqual(mockGeneratedSlots);
    });

    it('should log warning when additionalSlots override generated slots', () => {
      const mockGeneratedSlots = {
        head: { socket: 'neck', type: 'body_part' },
      };

      const additionalSlots = {
        head: { socket: 'custom_neck', type: 'custom_part' },
      };

      mockSlotGenerator.generateBlueprintSlots.mockReturnValue(
        mockGeneratedSlots
      );

      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        structureTemplate: 'core:humanoid_structure',
        additionalSlots,
      };

      service.processBlueprint(blueprint);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Additional slots override generated slots')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('head')
      );
    });

    it('should not log warning when additionalSlots are new (no conflicts)', () => {
      const mockGeneratedSlots = {
        head: { socket: 'neck', type: 'body_part' },
      };

      const additionalSlots = {
        left_arm: { socket: 'left_shoulder', type: 'limb' },
      };

      mockSlotGenerator.generateBlueprintSlots.mockReturnValue(
        mockGeneratedSlots
      );

      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        structureTemplate: 'core:humanoid_structure',
        additionalSlots,
      };

      service.processBlueprint(blueprint);

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Optimization - Skip Reprocessing', () => {
    it('should skip processing if blueprint already has _generatedSockets', () => {
      const blueprint = {
        id: 'test:humanoid',
        schemaVersion: '2.0',
        structureTemplate: 'core:humanoid_structure',
        _generatedSockets: [{ id: 'socket1' }],
        slots: { head: { socket: 'neck' } },
      };

      const result = service.processBlueprint(blueprint);

      expect(result).toBe(blueprint); // Same reference
      expect(mockDataRegistry.get).not.toHaveBeenCalled();
      expect(mockSocketGenerator.generateSockets).not.toHaveBeenCalled();
      expect(mockSlotGenerator.generateBlueprintSlots).not.toHaveBeenCalled();
    });

    it('should log debug message when skipping reprocessing', () => {
      const blueprint = {
        id: 'test:humanoid',
        _generatedSockets: [],
      };

      service.processBlueprint(blueprint);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('already processed')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty structure template (generates no slots)', () => {
      const mockEmptyTemplate = { id: 'empty:template', regions: [] };
      mockDataRegistry.get.mockReturnValue(mockEmptyTemplate);
      mockSocketGenerator.generateSockets.mockReturnValue([]);
      mockSlotGenerator.generateBlueprintSlots.mockReturnValue({});

      const blueprint = {
        id: 'test:empty',
        schemaVersion: '2.0',
        structureTemplate: 'empty:template',
      };

      const result = service.processBlueprint(blueprint);

      expect(result.slots).toEqual({});
      expect(result._generatedSockets).toEqual([]);
    });

    it('should handle structure template with only sockets (no slots)', () => {
      const mockTemplate = { id: 'sockets:only', regions: [] };
      const mockSockets = [{ id: 'socket1' }];

      mockDataRegistry.get.mockReturnValue(mockTemplate);
      mockSocketGenerator.generateSockets.mockReturnValue(mockSockets);
      mockSlotGenerator.generateBlueprintSlots.mockReturnValue({});

      const blueprint = {
        id: 'test:sockets_only',
        schemaVersion: '2.0',
        structureTemplate: 'sockets:only',
      };

      const result = service.processBlueprint(blueprint);

      expect(result.slots).toEqual({});
      expect(result._generatedSockets).toEqual(mockSockets);
    });

    it('should handle additionalSlots without generated slots', () => {
      mockDataRegistry.get.mockReturnValue({ regions: [] });
      mockSocketGenerator.generateSockets.mockReturnValue([]);
      mockSlotGenerator.generateBlueprintSlots.mockReturnValue({});

      const additionalSlots = {
        custom_slot: { socket: 'custom_socket', type: 'custom' },
      };

      const blueprint = {
        id: 'test:additionalOnly',
        schemaVersion: '2.0',
        structureTemplate: 'empty:template',
        additionalSlots,
      };

      const result = service.processBlueprint(blueprint);

      expect(result.slots).toEqual(additionalSlots);
    });

    it('should handle null or undefined fields gracefully', () => {
      mockDataRegistry.get.mockReturnValue({ regions: [] });
      mockSocketGenerator.generateSockets.mockReturnValue([]);
      mockSlotGenerator.generateBlueprintSlots.mockReturnValue({});

      const blueprint = {
        id: 'test:nullFields',
        schemaVersion: '2.0',
        structureTemplate: 'empty:template',
        root: null,
        additionalSlots: undefined,
      };

      const result = service.processBlueprint(blueprint);

      expect(result).toHaveProperty('_generatedSockets');
      expect(result).toHaveProperty('slots');
    });
  });

  describe('Error Handling', () => {
    it('should log error when structure template not found', () => {
      mockDataRegistry.get.mockReturnValue(null);

      const blueprint = {
        id: 'test:missing',
        schemaVersion: '2.0',
        structureTemplate: 'missing:template',
      };

      expect(() => service.processBlueprint(blueprint)).toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Structure template not found')
      );
    });

    it('should throw ValidationError with descriptive message', () => {
      mockDataRegistry.get.mockReturnValue(null);

      const blueprint = {
        id: 'test:missing',
        schemaVersion: '2.0',
        structureTemplate: 'invalid:template',
      };

      expect(() => service.processBlueprint(blueprint)).toThrow(
        'Structure template not found: invalid:template'
      );
    });
  });
});

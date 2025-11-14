import { describe, it, expect, beforeEach } from '@jest/globals';
import EntityMatcherService from '../../../../src/anatomy/services/entityMatcherService.js';

describe('EntityMatcherService', () => {
  let service;
  let mockLogger;
  let mockDataRegistry;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    service = new EntityMatcherService({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  // Helper to create mock entity definitions
  const createMockEntityDef = (id, subType, components = {}) => ({
    id,
    components: {
      'anatomy:part': { subType },
      ...components,
    },
  });

  describe('constructor', () => {
    it('should initialize with logger and dataRegistry', () => {
      expect(service).toBeDefined();
    });

    it('should throw if logger is missing', () => {
      expect(() => new EntityMatcherService({ dataRegistry: mockDataRegistry })).toThrow();
    });

    it('should throw if dataRegistry is missing', () => {
      expect(() => new EntityMatcherService({ logger: mockLogger })).toThrow();
    });

    it('should throw if dataRegistry missing required methods', () => {
      const invalidRegistry = { get: jest.fn() }; // Missing getAll
      expect(() => new EntityMatcherService({
        logger: mockLogger,
        dataRegistry: invalidRegistry
      })).toThrow();
    });
  });

  describe('findMatchingEntities', () => {
    it('should match by partType only', () => {
      const criteria = { partType: 'head' };
      const allEntityDefs = [
        createMockEntityDef('anatomy:head1', 'head'),
        createMockEntityDef('anatomy:head2', 'head'),
        createMockEntityDef('anatomy:hand', 'hand'),
      ];

      const result = service.findMatchingEntities(criteria, allEntityDefs);

      expect(result).toHaveLength(2);
      expect(result).toContain('anatomy:head1');
      expect(result).toContain('anatomy:head2');
    });

    it('should match by partType + tags', () => {
      const criteria = { partType: 'head', tags: ['descriptors:hair'] };
      const allEntityDefs = [
        createMockEntityDef('anatomy:head_bald', 'head'),
        createMockEntityDef('anatomy:head_hairy', 'head', {
          'descriptors:hair': { color: 'black' },
        }),
        createMockEntityDef('anatomy:hand', 'hand'),
      ];

      const result = service.findMatchingEntities(criteria, allEntityDefs);

      expect(result).toHaveLength(1);
      expect(result).toContain('anatomy:head_hairy');
    });

    it('should match by partType + properties', () => {
      const criteria = {
        partType: 'head',
        properties: {
          'descriptors:hair': { color: 'black' },
        },
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:head_black_hair', 'head', {
          'descriptors:hair': { color: 'black' },
        }),
        createMockEntityDef('anatomy:head_brown_hair', 'head', {
          'descriptors:hair': { color: 'brown' },
        }),
      ];

      const result = service.findMatchingEntities(criteria, allEntityDefs);

      expect(result).toHaveLength(1);
      expect(result).toContain('anatomy:head_black_hair');
    });

    it('should match by partType + tags + properties', () => {
      const criteria = {
        partType: 'torso',
        tags: ['descriptors:build', 'descriptors:skin'],
        properties: {
          'descriptors:build': { build: 'muscular' },
          'descriptors:skin': { color: 'tan' },
        },
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:torso_perfect', 'torso', {
          'descriptors:build': { build: 'muscular' },
          'descriptors:skin': { color: 'tan' },
        }),
        createMockEntityDef('anatomy:torso_wrong_build', 'torso', {
          'descriptors:build': { build: 'slim' },
          'descriptors:skin': { color: 'tan' },
        }),
        createMockEntityDef('anatomy:torso_missing_skin', 'torso', {
          'descriptors:build': { build: 'muscular' },
        }),
      ];

      const result = service.findMatchingEntities(criteria, allEntityDefs);

      expect(result).toHaveLength(1);
      expect(result).toContain('anatomy:torso_perfect');
    });

    it('should return empty array when no matches found', () => {
      const criteria = { partType: 'nonexistent' };
      const allEntityDefs = [
        createMockEntityDef('anatomy:head', 'head'),
      ];

      const result = service.findMatchingEntities(criteria, allEntityDefs);

      expect(result).toHaveLength(0);
    });

    it('should handle empty entity definitions array', () => {
      const criteria = { partType: 'head' };
      const result = service.findMatchingEntities(criteria, []);

      expect(result).toHaveLength(0);
    });

    it('should skip entities missing anatomy:part component', () => {
      const criteria = { partType: 'head' };
      const allEntityDefs = [
        { id: 'anatomy:invalid', components: {} }, // Missing anatomy:part
        createMockEntityDef('anatomy:head', 'head'),
      ];

      const result = service.findMatchingEntities(criteria, allEntityDefs);

      expect(result).toHaveLength(1);
      expect(result).toContain('anatomy:head');
    });

    it('should reject entities with invalid property values', () => {
      const criteria = {
        partType: 'head',
        properties: {
          'descriptors:hair': { color: 'black', length: 'long' },
        },
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:head_black_long', 'head', {
          'descriptors:hair': { color: 'black', length: 'long' },
        }),
        createMockEntityDef('anatomy:head_black_short', 'head', {
          'descriptors:hair': { color: 'black', length: 'short' },
        }),
      ];

      const result = service.findMatchingEntities(criteria, allEntityDefs);

      expect(result).toHaveLength(1);
      expect(result).toContain('anatomy:head_black_long');
    });
  });

  describe('findMatchingEntitiesForSlot', () => {
    it('should match with wildcard allowedTypes', () => {
      const requirements = {
        partType: 'head',
        allowedTypes: ['*'],
        tags: [],
        properties: {},
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:head1', 'head'),
        createMockEntityDef('anatomy:head2', 'head'),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(2);
    });

    it('should filter by allowedTypes array', () => {
      const requirements = {
        partType: null, // No specific partType required
        allowedTypes: ['head', 'skull'],
        tags: [],
        properties: {},
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:head', 'head'),
        createMockEntityDef('anatomy:skull', 'skull'),
        createMockEntityDef('anatomy:brain', 'brain'),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(2);
      expect(result).toContain('anatomy:head');
      expect(result).toContain('anatomy:skull');
      expect(result).not.toContain('anatomy:brain');
    });

    it('should exclude entities when subType not in allowedTypes', () => {
      const requirements = {
        partType: null, // No specific partType, rely on allowedTypes
        allowedTypes: ['arm'],
        tags: [],
        properties: {},
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:arm', 'arm'),
        createMockEntityDef('anatomy:leg', 'leg'),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(1);
      expect(result).toContain('anatomy:arm');
    });

    it('should match by partType + allowedTypes + tags', () => {
      const requirements = {
        partType: null, // No specific partType, use allowedTypes
        allowedTypes: ['finger', 'toe'],
        tags: ['descriptors:nails'],
        properties: {},
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:finger_nailed', 'finger', {
          'descriptors:nails': { length: 'short' },
        }),
        createMockEntityDef('anatomy:finger_no_nails', 'finger'),
        createMockEntityDef('anatomy:toe_nailed', 'toe', {
          'descriptors:nails': { length: 'long' },
        }),
        createMockEntityDef('anatomy:ear', 'ear'),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(2);
      expect(result).toContain('anatomy:finger_nailed');
      expect(result).toContain('anatomy:toe_nailed');
    });

    it('should match combined requirements (pattern + blueprint)', () => {
      const requirements = {
        partType: null, // No specific partType, rely on allowedTypes
        allowedTypes: ['arm', 'leg'],
        tags: ['descriptors:muscle', 'descriptors:skin'],
        properties: {
          'descriptors:muscle': { tone: 'defined' },
        },
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:arm_perfect', 'arm', {
          'descriptors:muscle': { tone: 'defined' },
          'descriptors:skin': { color: 'tan' },
        }),
        createMockEntityDef('anatomy:arm_weak', 'arm', {
          'descriptors:muscle': { tone: 'soft' },
          'descriptors:skin': { color: 'tan' },
        }),
        createMockEntityDef('anatomy:leg_perfect', 'leg', {
          'descriptors:muscle': { tone: 'defined' },
          'descriptors:skin': { color: 'pale' },
        }),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(2);
      expect(result).toContain('anatomy:arm_perfect');
      expect(result).toContain('anatomy:leg_perfect');
    });

    it('should return empty array when no matches found', () => {
      const requirements = {
        partType: 'nonexistent',
        allowedTypes: ['*'],
        tags: [],
        properties: {},
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:head', 'head'),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(0);
    });

    it('should handle empty entity definitions array', () => {
      const requirements = {
        partType: 'head',
        allowedTypes: ['*'],
        tags: [],
        properties: {},
      };

      const result = service.findMatchingEntitiesForSlot(requirements, []);

      expect(result).toHaveLength(0);
    });

    it('should skip entities missing anatomy:part component', () => {
      const requirements = {
        partType: 'head',
        allowedTypes: ['*'],
        tags: [],
        properties: {},
      };
      const allEntityDefs = [
        { id: 'anatomy:invalid', components: {} },
        createMockEntityDef('anatomy:head', 'head'),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(1);
      expect(result).toContain('anatomy:head');
    });

    it('should match without partType if only allowedTypes specified', () => {
      const requirements = {
        partType: null,
        allowedTypes: ['head', 'skull'],
        tags: [],
        properties: {},
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:head', 'head'),
        createMockEntityDef('anatomy:skull', 'skull'),
        createMockEntityDef('anatomy:hand', 'hand'),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(2);
      expect(result).toContain('anatomy:head');
      expect(result).toContain('anatomy:skull');
    });

    it('should validate property values correctly', () => {
      const requirements = {
        partType: 'torso',
        allowedTypes: ['*'],
        tags: [],
        properties: {
          'descriptors:venom': { potency: 'high', color: 'green' },
        },
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:torso_perfect', 'torso', {
          'descriptors:venom': { potency: 'high', color: 'green' },
        }),
        createMockEntityDef('anatomy:torso_wrong_potency', 'torso', {
          'descriptors:venom': { potency: 'low', color: 'green' },
        }),
        createMockEntityDef('anatomy:torso_partial', 'torso', {
          'descriptors:venom': { potency: 'high' }, // Missing color
        }),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(1);
      expect(result).toContain('anatomy:torso_perfect');
    });

    it('should handle complex nested properties', () => {
      const requirements = {
        partType: 'organ',
        allowedTypes: ['*'],
        tags: [],
        properties: {
          'descriptors:function': { primary: 'digestion', secondary: 'absorption' },
        },
      };
      const allEntityDefs = [
        createMockEntityDef('anatomy:stomach', 'organ', {
          'descriptors:function': { primary: 'digestion', secondary: 'absorption' },
        }),
        createMockEntityDef('anatomy:liver', 'organ', {
          'descriptors:function': { primary: 'filtration', secondary: 'detoxification' },
        }),
      ];

      const result = service.findMatchingEntitiesForSlot(requirements, allEntityDefs);

      expect(result).toHaveLength(1);
      expect(result).toContain('anatomy:stomach');
    });
  });

  describe('mergePropertyRequirements', () => {
    it('should merge non-overlapping components', () => {
      const patternProperties = {
        'descriptors:venom': { potency: 'high' },
      };
      const blueprintProperties = {
        'descriptors:color': { hue: 'green' },
      };

      const result = service.mergePropertyRequirements(
        patternProperties,
        blueprintProperties
      );

      expect(result).toEqual({
        'descriptors:venom': { potency: 'high' },
        'descriptors:color': { hue: 'green' },
      });
    });

    it('should deep merge overlapping components', () => {
      const patternProperties = {
        'descriptors:venom': { potency: 'high' },
      };
      const blueprintProperties = {
        'descriptors:venom': { color: 'green' },
      };

      const result = service.mergePropertyRequirements(
        patternProperties,
        blueprintProperties
      );

      expect(result).toEqual({
        'descriptors:venom': { potency: 'high', color: 'green' },
      });
    });

    it('should handle empty pattern properties', () => {
      const patternProperties = {};
      const blueprintProperties = {
        'descriptors:venom': { color: 'green' },
      };

      const result = service.mergePropertyRequirements(
        patternProperties,
        blueprintProperties
      );

      expect(result).toEqual({
        'descriptors:venom': { color: 'green' },
      });
    });

    it('should handle empty blueprint properties', () => {
      const patternProperties = {
        'descriptors:venom': { potency: 'high' },
      };
      const blueprintProperties = {};

      const result = service.mergePropertyRequirements(
        patternProperties,
        blueprintProperties
      );

      expect(result).toEqual({
        'descriptors:venom': { potency: 'high' },
      });
    });

    it('should handle both empty properties', () => {
      const result = service.mergePropertyRequirements({}, {});

      expect(result).toEqual({});
    });

    it('should preserve all properties in complex merge', () => {
      const patternProperties = {
        'descriptors:venom': { potency: 'high', delivery: 'bite' },
        'descriptors:defense': { mechanism: 'camouflage' },
      };
      const blueprintProperties = {
        'descriptors:venom': { color: 'green' },
        'descriptors:attack': { method: 'strike' },
      };

      const result = service.mergePropertyRequirements(
        patternProperties,
        blueprintProperties
      );

      expect(result).toEqual({
        'descriptors:venom': { potency: 'high', delivery: 'bite', color: 'green' },
        'descriptors:defense': { mechanism: 'camouflage' },
        'descriptors:attack': { method: 'strike' },
      });
    });

    it('should overwrite pattern properties when blueprint has same key', () => {
      const patternProperties = {
        'descriptors:color': { hue: 'red' },
      };
      const blueprintProperties = {
        'descriptors:color': { hue: 'blue' },
      };

      const result = service.mergePropertyRequirements(
        patternProperties,
        blueprintProperties
      );

      expect(result).toEqual({
        'descriptors:color': { hue: 'blue' },
      });
    });
  });
});

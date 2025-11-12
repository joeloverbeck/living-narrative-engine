import { describe, it, beforeEach, expect } from '@jest/globals';
import {
  resolveSlotGroup,
  validateMatchesGroup,
} from '../../../src/anatomy/recipePatternResolver/matchers/groupMatcher.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

class SecondCallMissingTemplateRegistry extends InMemoryDataRegistry {
  constructor(options = {}) {
    super(options);
    this._calls = new Map();
  }

  get(type, id) {
    if (type === 'anatomyStructureTemplates' && id) {
      const key = `${type}:${id}`;
      const callCount = this._calls.get(key) ?? 0;
      this._calls.set(key, callCount + 1);

      if (callCount >= 1) {
        return undefined;
      }
    }

    return super.get(type, id);
  }
}

const buildValidTemplate = () => ({
  id: 'test:multi_template',
  topology: {
    rootType: 'torso',
    limbSets: [
      {
        type: 'arm',
        count: 2,
        arrangement: 'bilateral',
        socketPattern: {
          idTemplate: 'arm_{{orientation}}',
          allowedTypes: ['test:arm_part'],
          orientationScheme: 'bilateral',
          positions: ['left', 'right'],
        },
      },
    ],
    appendages: [
      {
        type: 'antenna',
        count: 2,
        socketPattern: {
          idTemplate: 'antenna_{{index}}',
          allowedTypes: ['test:antenna_part'],
          orientationScheme: 'radial',
        },
      },
    ],
  },
});

describe('groupMatcher integration', () => {
  let logger;
  let dataRegistry;
  let slotGenerator;
  let blueprint;
  let deps;

  beforeEach(() => {
    logger = createMockLogger();
    dataRegistry = new InMemoryDataRegistry({ logger });
    slotGenerator = new SlotGenerator({ logger });
    blueprint = {
      id: 'test:blueprint',
      schemaVersion: '2.0',
      structureTemplate: 'test:multi_template',
    };

    dataRegistry.store(
      'anatomyStructureTemplates',
      'test:multi_template',
      buildValidTemplate(),
    );

    deps = { dataRegistry, slotGenerator, logger };
  });

  describe('resolveSlotGroup', () => {
    it('throws when blueprint lacks structure template and allowMissing is false', () => {
      const missingBlueprint = { id: 'test:missing', schemaVersion: '2.0' };
      expect(() =>
        resolveSlotGroup('limbSet:arm', missingBlueprint, {}, deps),
      ).toThrow(
        new ValidationError(
          "Cannot resolve slot group 'limbSet:arm': blueprint has no structure template",
        ),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Cannot resolve slot group 'limbSet:arm': blueprint has no structure template",
      );
    });

    it('returns empty array when blueprint lacks structure template but allowMissing is true', () => {
      const localLogger = createMockLogger();
      const missingBlueprint = { id: 'test:missing', schemaVersion: '2.0' };
      const localDeps = {
        dataRegistry,
        slotGenerator,
        logger: localLogger,
      };

      const result = resolveSlotGroup(
        'limbSet:arm',
        missingBlueprint,
        { allowMissing: true },
        localDeps,
      );

      expect(result).toEqual([]);
      expect(localLogger.warn).toHaveBeenCalledWith(
        "Cannot resolve slot group 'limbSet:arm': blueprint has no structure template",
      );
    });

    it('rejects invalid group reference formats', () => {
      expect(() =>
        resolveSlotGroup('limbSet-only', blueprint, {}, deps),
      ).toThrow(
        new ValidationError("Invalid slot group reference format: 'limbSet-only'"),
      );
    });

    it('rejects unknown group types', () => {
      expect(() =>
        resolveSlotGroup('invalid:arm', blueprint, {}, deps),
      ).toThrow(
        new ValidationError(
          "Invalid slot group type: 'invalid'. Expected 'limbSet' or 'appendage'",
        ),
      );
    });

    it('provides available group hints when requested group is missing', () => {
      expect(() =>
        resolveSlotGroup('limbSet:wing', blueprint, {}, deps),
      ).toThrow(
        new ValidationError(
          "Slot group 'limbSet:wing' not found in structure template 'test:multi_template'. Available groups: 'limbSet:arm'.",
        ),
      );
    });
  });

  describe('validateMatchesGroup', () => {
    it('rejects unsupported group types with informative error', () => {
      const pattern = { matchesGroup: 'invalid:thing' };

      expect(() =>
        validateMatchesGroup(pattern, blueprint, 0, deps),
      ).toThrow(
        new ValidationError(
          "Pattern 1: Slot group 'invalid:thing' format invalid. Expected 'limbSet:{type}' or 'appendage:{type}'.",
        ),
      );
    });

    it('wraps nested ValidationError from resolveSlotGroup with pattern context', () => {
      const flakyRegistry = new SecondCallMissingTemplateRegistry({ logger });
      flakyRegistry.store(
        'anatomyStructureTemplates',
        'test:multi_template',
        buildValidTemplate(),
      );

      const flakyDeps = {
        dataRegistry: flakyRegistry,
        slotGenerator,
        logger,
      };

      const pattern = { matchesGroup: 'limbSet:arm' };

      expect(() =>
        validateMatchesGroup(pattern, blueprint, 0, flakyDeps),
      ).toThrow(
        new ValidationError(
          "Pattern 1: Structure template not found: test:multi_template",
        ),
      );
    });

    it('rethrows unexpected errors from resolveSlotGroup without masking them', () => {
      const fragileTemplate = {
        id: 'test:fragile_template',
        topology: {
          limbSets: [
            {
              type: 'arm',
              count: 2,
              // Intentionally omit socketPattern so SlotGenerator throws
            },
          ],
        },
      };

      dataRegistry.store(
        'anatomyStructureTemplates',
        'test:fragile_template',
        fragileTemplate,
      );

      const fragileBlueprint = {
        ...blueprint,
        structureTemplate: 'test:fragile_template',
      };

      const pattern = { matchesGroup: 'limbSet:arm' };

      expect(() =>
        validateMatchesGroup(pattern, fragileBlueprint, 0, deps),
      ).toThrow(TypeError);
    });
  });
});


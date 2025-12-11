import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SocketNameTplValidator } from '../../../../../src/anatomy/validation/validators/SocketNameTplValidator.js';
import { createTestBed } from '../../../../common/testBed.js';
import ValidationResultBuilder from '../../../../../src/anatomy/validation/core/ValidationResultBuilder.js';

describe('SocketNameTplValidator', () => {
  let logger;
  let mockDataRegistry;

  beforeEach(() => {
    ({ mockLogger: logger } = createTestBed());
    mockDataRegistry = {
      getEntityDefinition: jest.fn(),
    };
  });

  const createValidator = (overrides = {}) =>
    new SocketNameTplValidator({
      logger,
      dataRegistry: mockDataRegistry,
      ...overrides,
    });

  describe('constructor', () => {
    it('initializes with expected defaults', () => {
      const validator = createValidator();
      expect(validator.name).toBe('socket-nametpl-uniqueness');
      expect(validator.priority).toBe(23);
      expect(validator.failFast).toBe(true);
    });

    it('throws when logger is missing', () => {
      expect(
        () => new SocketNameTplValidator({ dataRegistry: mockDataRegistry })
      ).toThrow();
    });

    it('throws when dataRegistry is missing', () => {
      expect(() => new SocketNameTplValidator({ logger })).toThrow();
    });
  });

  describe('performValidation', () => {
    const createBuilder = (recipeId = 'test:recipe') =>
      new ValidationResultBuilder(recipeId);

    describe('literal duplicate detection', () => {
      it('should reject entity with duplicate literal nameTpl values', async () => {
        // Arrange - entity with two sockets having identical literal nameTpl
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [
            { id: 'socket_1', nameTpl: 'tentacle' },
            { id: 'socket_2', nameTpl: 'tentacle' }, // Duplicate!
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        // Act
        await validator.performValidation(recipe, {}, builder);

        // Assert
        const result = builder.build();
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].type).toBe('DUPLICATE_SOCKET_NAMETPL');
      });

      it('should accept entity with unique literal nameTpl values', async () => {
        // Arrange - entity with different literal nameTpl values
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [
            { id: 'socket_1', nameTpl: 'tentacle 1' },
            { id: 'socket_2', nameTpl: 'tentacle 2' },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        // Act
        await validator.performValidation(recipe, {}, builder);

        // Assert
        const result = builder.build();
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('should detect multiple groups of duplicates', async () => {
        // Arrange - entity with multiple duplicate groups
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [
            { id: 'tentacle_1', nameTpl: 'tentacle' },
            { id: 'tentacle_2', nameTpl: 'tentacle' },
            { id: 'eye_1', nameTpl: 'eye' },
            { id: 'eye_2', nameTpl: 'eye' },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        // Act
        await validator.performValidation(recipe, {}, builder);

        // Assert
        const result = builder.build();
        expect(result.isValid).toBe(false);
        // Should report errors for both duplicate groups
        expect(result.errors.length).toBe(2);
      });
    });

    describe('template variable handling', () => {
      it('should accept same nameTpl template when allowedTypes differ', async () => {
        // Arrange - like chicken_leg.entity.json: {{type}} but different allowedTypes
        const recipe = {
          rootEntityDefinitionId: 'anatomy-creatures:chicken_leg',
        };
        const entityDef = {
          id: 'anatomy-creatures:chicken_leg',
          sockets: [
            { id: 'foot', nameTpl: '{{type}}', allowedTypes: ['chicken_foot'] },
            { id: 'spur', nameTpl: '{{type}}', allowedTypes: ['chicken_spur'] },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        // Act
        await validator.performValidation(recipe, {}, builder);

        // Assert
        const result = builder.build();
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });

      it('should reject same nameTpl template when allowedTypes overlap', async () => {
        // Arrange - same template, overlapping allowedTypes = collision risk
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [
            { id: 'socket_1', nameTpl: '{{type}}', allowedTypes: ['tentacle'] },
            { id: 'socket_2', nameTpl: '{{type}}', allowedTypes: ['tentacle'] },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        // Act
        await validator.performValidation(recipe, {}, builder);

        // Assert
        const result = builder.build();
        expect(result.isValid).toBe(false);
        expect(result.errors[0].type).toBe('DUPLICATE_SOCKET_NAMETPL');
      });

      it('should accept templates with orientation variables', async () => {
        // Arrange - orientation makes names unique even with same type
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [
            {
              id: 'socket_1',
              nameTpl: '{{orientation}} tentacle',
              allowedTypes: ['tentacle'],
            },
            {
              id: 'socket_2',
              nameTpl: '{{orientation}} tentacle',
              allowedTypes: ['tentacle'],
            },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        // Act
        await validator.performValidation(recipe, {}, builder);

        // Assert
        const result = builder.build();
        expect(result.isValid).toBe(true);
      });

      it('should accept templates with effective_orientation variables', async () => {
        // Arrange
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [
            {
              id: 'socket_1',
              nameTpl: '{{effective_orientation}} tentacle',
              allowedTypes: ['tentacle'],
            },
            {
              id: 'socket_2',
              nameTpl: '{{effective_orientation}} tentacle',
              allowedTypes: ['tentacle'],
            },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        // Act
        await validator.performValidation(recipe, {}, builder);

        // Assert
        const result = builder.build();
        expect(result.isValid).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle entity with no sockets', async () => {
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
      });

      it('should handle entity with undefined sockets', async () => {
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
      });

      it('should handle missing entity definition gracefully', async () => {
        const recipe = {
          rootEntityDefinitionId: 'anatomy:nonexistent',
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(undefined);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        // Should not crash, just skip validation
        expect(result.isValid).toBe(true);
      });

      it('should handle socket without nameTpl', async () => {
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [
            { id: 'socket_1' }, // No nameTpl
            { id: 'socket_2', nameTpl: 'tentacle' },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
      });

      it('should validate all entity definitions referenced by recipe attachments', async () => {
        // Arrange - recipe with attachments referencing other entity definitions
        const recipe = {
          rootEntityDefinitionId: 'anatomy:parent',
          attachments: [
            { entityDefinitionId: 'anatomy:child_1' },
            { entityDefinitionId: 'anatomy:child_2' },
          ],
        };

        const parentDef = {
          id: 'anatomy:parent',
          sockets: [{ id: 'socket_1', nameTpl: 'parent part' }],
        };
        const child1Def = {
          id: 'anatomy:child_1',
          sockets: [
            { id: 'socket_a', nameTpl: 'duplicate' },
            { id: 'socket_b', nameTpl: 'duplicate' }, // Duplicate in child_1
          ],
        };
        const child2Def = {
          id: 'anatomy:child_2',
          sockets: [{ id: 'socket_x', nameTpl: 'unique' }],
        };

        mockDataRegistry.getEntityDefinition.mockImplementation((id) => {
          if (id === 'anatomy:parent') return parentDef;
          if (id === 'anatomy:child_1') return child1Def;
          if (id === 'anatomy:child_2') return child2Def;
          return undefined;
        });

        const validator = createValidator();
        const builder = createBuilder();

        // Act
        await validator.performValidation(recipe, {}, builder);

        // Assert
        const result = builder.build();
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('child_1'))).toBe(
          true
        );
      });
    });

    describe('error messages', () => {
      it('should include entity ID in error message', async () => {
        const recipe = {
          rootEntityDefinitionId: 'anatomy-creatures:eldritch_mass',
        };
        const entityDef = {
          id: 'anatomy-creatures:eldritch_mass',
          sockets: [
            { id: 'tentacle_1', nameTpl: 'tentacle' },
            { id: 'tentacle_2', nameTpl: 'tentacle' },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.errors[0].message).toContain('anatomy-creatures:eldritch_mass');
      });

      it('should include duplicate nameTpl value in error message', async () => {
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [
            { id: 'socket_1', nameTpl: 'vestigial arm' },
            { id: 'socket_2', nameTpl: 'vestigial arm' },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.errors[0].message).toContain('vestigial arm');
      });

      it('should include socket IDs with duplicates in error message', async () => {
        const recipe = {
          rootEntityDefinitionId: 'anatomy:test_entity',
        };
        const entityDef = {
          id: 'anatomy:test_entity',
          sockets: [
            { id: 'wing_1', nameTpl: 'membrane wing' },
            { id: 'wing_2', nameTpl: 'membrane wing' },
          ],
        };
        mockDataRegistry.getEntityDefinition.mockReturnValue(entityDef);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.errors[0].message).toContain('wing_1');
        expect(result.errors[0].message).toContain('wing_2');
      });
    });
  });
});

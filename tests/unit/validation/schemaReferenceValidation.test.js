/**
 * @file Tests for schema reference validation, specifically for anatomy schemas
 */

const AjvSchemaValidator =
  require('../../../src/validation/ajvSchemaValidator.js').default;
const fs = require('fs');
const path = require('path');

/**
 * Creates a mock logger for testing.
 *
 * @returns {object} mock logger
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('Schema Reference Validation', () => {
  let validator;
  let logger;
  let anatomyBlueprintSchema;
  let anatomyRecipeSchema;
  let commonSchema;

  beforeAll(() => {
    // Load the schemas from the data directory
    const schemaDir = path.join(__dirname, '../../../data/schemas');

    commonSchema = JSON.parse(
      fs.readFileSync(path.join(schemaDir, 'common.schema.json'), 'utf8')
    );

    anatomyBlueprintSchema = JSON.parse(
      fs.readFileSync(
        path.join(schemaDir, 'anatomy.blueprint.schema.json'),
        'utf8'
      )
    );

    anatomyRecipeSchema = JSON.parse(
      fs.readFileSync(
        path.join(schemaDir, 'anatomy.recipe.schema.json'),
        'utf8'
      )
    );
  });

  beforeEach(() => {
    // Create fresh instances for each test
    logger = createMockLogger();
    validator = new AjvSchemaValidator({ logger });
  });

  afterAll(() => {
    validator = null;
    logger = null;
  });

  describe('Anatomy Schema Cross-References', () => {
    it('should load anatomy.recipe.schema.json with slotDefinition', async () => {
      // Add common schema first since anatomy schemas reference it
      await validator.addSchema(commonSchema, commonSchema.$id);
      await validator.addSchema(anatomyRecipeSchema, anatomyRecipeSchema.$id);

      const schemaIds = validator.getLoadedSchemaIds();
      expect(schemaIds).toContain(
        'http://example.com/schemas/anatomy.recipe.schema.json'
      );
    });

    it('should load anatomy.blueprint.schema.json with references to anatomy.recipe.schema.json', async () => {
      // First add the common schema
      await validator.addSchema(commonSchema, commonSchema.$id);
      // Then add the recipe schema which is referenced
      await validator.addSchema(anatomyRecipeSchema, anatomyRecipeSchema.$id);

      // Then add the blueprint schema
      await validator.addSchema(
        anatomyBlueprintSchema,
        anatomyBlueprintSchema.$id
      );

      const schemaIds = validator.getLoadedSchemaIds();
      expect(schemaIds).toContain(
        'http://example.com/schemas/anatomy.blueprint.schema.json'
      );
    });

    it('should validate that anatomy.blueprint.schema.json references use correct relative paths', () => {
      const schemaContent = JSON.stringify(anatomyBlueprintSchema);

      // Check that we're using ./ instead of ../
      expect(schemaContent).toContain(
        '"./anatomy.recipe.schema.json#/definitions/slotDefinition"'
      );
      expect(schemaContent).not.toContain(
        '"../anatomy.recipe.schema.json#/definitions/slotDefinition"'
      );
    });

    it('should successfully validate schema references after loading both schemas', async () => {
      // Add all required schemas
      await validator.addSchema(commonSchema, commonSchema.$id);
      await validator.addSchema(anatomyRecipeSchema, anatomyRecipeSchema.$id);
      await validator.addSchema(
        anatomyBlueprintSchema,
        anatomyBlueprintSchema.$id
      );

      // Validate references
      const refsValid = validator.validateSchemaRefs(
        anatomyBlueprintSchema.$id
      );
      expect(refsValid).toBe(true);

      // Check that no errors were logged
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining("can't resolve reference")
      );
    });

    it('should validate a sample anatomy blueprint against the schema', async () => {
      // Add all required schemas
      await validator.addSchema(commonSchema, commonSchema.$id);
      await validator.addSchema(anatomyRecipeSchema, anatomyRecipeSchema.$id);
      await validator.addSchema(
        anatomyBlueprintSchema,
        anatomyBlueprintSchema.$id
      );

      // Sample blueprint data
      const sampleBlueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:torso',
        slots: {
          head_slot: {
            socket: 'head_socket',
            requirements: {
              partType: 'head'
            }
          },
          arm_slot_left: {
            socket: 'left_arm_socket',
            requirements: {
              partType: 'arm'
            },
            optional: true
          }
        },
        defaultSlots: {
          arm_slots: {
            partType: 'arm',
            count: { min: 1, max: 2 }
          }
        }
      };

      // Get the validator function for the schema
      const validateFn = validator.getValidator(anatomyBlueprintSchema.$id);
      expect(validateFn).toBeDefined();

      // Validate the sample data
      const result = validateFn(sampleBlueprint);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Dist Folder Consistency', () => {
    it('should ensure dist folder schemas match source schemas', async () => {
      const distSchemaPath = path.join(
        __dirname,
        '../../../dist/data/schemas/anatomy.blueprint.schema.json'
      );

      try {
        const distSchema = JSON.parse(fs.readFileSync(distSchemaPath, 'utf8'));
        const distContent = JSON.stringify(distSchema);

        // Check that dist version also uses correct relative paths
        expect(distContent).toContain(
          '"./anatomy.recipe.schema.json#/definitions/slotDefinition"'
        );
        expect(distContent).not.toContain(
          '"../anatomy.recipe.schema.json#/definitions/slotDefinition"'
        );
      } catch (error) {
        // If dist doesn't exist yet, that's okay - this test will help catch issues after build
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    });
  });

  describe('Schema Loading Error Detection', () => {
    it('should detect and report unresolved schema references', async () => {
      // Create a schema with an invalid reference
      const schemaWithBadRef = {
        $id: 'http://example.com/schemas/test-bad-ref.schema.json',
        type: 'object',
        properties: {
          slot: {
            $ref: '../nonexistent.schema.json#/definitions/something',
          },
        },
      };

      // Adding a schema with bad references will fail during addSchema
      let addError = null;
      try {
        await validator.addSchema(schemaWithBadRef, schemaWithBadRef.$id);
      } catch (error) {
        addError = error;
      }

      // The schema with bad references should fail to add
      expect(addError).toBeTruthy();
      expect(addError.message).toContain("can't resolve reference");

      // Since the schema failed to add, getValidator should return undefined
      const validateFn = validator.getValidator(schemaWithBadRef.$id);
      expect(validateFn).toBeUndefined();
    });
  });
});

import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

describe('Inline Activity Metadata Pattern', () => {
  let ajv;
  let componentSchema;
  let commonSchema;
  let kneelingBeforeSchema;

  beforeAll(() => {
    ajv = new Ajv({ strict: false, allErrors: true });

    // Load schemas
    const schemaPath = path.join(dirname, '../../../data/schemas');
    const modsPath = path.join(dirname, '../../../data/mods');

    commonSchema = JSON.parse(
      fs.readFileSync(path.join(schemaPath, 'common.schema.json'), 'utf8')
    );
    componentSchema = JSON.parse(
      fs.readFileSync(path.join(schemaPath, 'component.schema.json'), 'utf8')
    );
    kneelingBeforeSchema = JSON.parse(
      fs.readFileSync(
        path.join(
          modsPath,
          'deference-states/components/kneeling_before.component.json'
        ),
        'utf8'
      )
    );

    // Add schemas to AJV
    ajv.addSchema(commonSchema);
    ajv.addSchema(componentSchema);
  });

  describe('Schema Loading', () => {
    it('should load the kneeling_before schema with inline metadata', () => {
      expect(kneelingBeforeSchema).toBeDefined();
      expect(kneelingBeforeSchema.id).toBe('deference-states:kneeling_before');
      expect(
        kneelingBeforeSchema.dataSchema.properties.activityMetadata
      ).toBeDefined();
    });

    it('should validate against component schema', () => {
      const validate = ajv.compile(componentSchema);
      const valid = validate(kneelingBeforeSchema);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should accept component data without activityMetadata (optional)', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
      };
      const valid = validate(validData);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    it('should maintain additionalProperties: false on parent schema', () => {
      expect(kneelingBeforeSchema.dataSchema.additionalProperties).toBe(false);
    });

    it('should reject unknown properties at component level', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const invalidData = {
        entityId: 'core:entity_123',
        unknownProperty: 'should fail',
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'additionalProperties',
        })
      );
    });
  });

  describe('Inline Metadata Structure', () => {
    it('should have activityMetadata as optional property', () => {
      const dataSchema = kneelingBeforeSchema.dataSchema;
      expect(dataSchema.properties.activityMetadata).toBeDefined();
      expect(dataSchema.required).not.toContain('activityMetadata');
    });

    it('should enforce additionalProperties: false on activityMetadata', () => {
      expect(
        kneelingBeforeSchema.dataSchema.properties.activityMetadata
          .additionalProperties
      ).toBe(false);
    });

    it('should define all standard inline metadata properties', () => {
      const metadata =
        kneelingBeforeSchema.dataSchema.properties.activityMetadata.properties;
      expect(metadata.shouldDescribeInActivity).toBeDefined();
      expect(metadata.template).toBeDefined();
      expect(metadata.targetRole).toBeDefined();
      expect(metadata.priority).toBeDefined();
    });
  });

  describe('Valid Inline Metadata', () => {
    it('should accept component data with complete activityMetadata', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: '{actor} is kneeling before {target}',
          targetRole: 'entityId',
          priority: 75,
        },
      };
      const valid = validate(validData);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    it('should accept activityMetadata with minimal properties', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {},
      };
      const valid = validate(validData);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    it('should accept activityMetadata with only shouldDescribeInActivity', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          shouldDescribeInActivity: false,
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept activityMetadata with custom template', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: '{actor} kneels respectfully before {target}',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept activityMetadata with custom targetRole', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          targetRole: 'customEntityId',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });
  });

  describe('Priority Validation', () => {
    it('should accept priority within valid range (0-100)', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);

      [0, 25, 50, 75, 100].forEach((priority) => {
        const validData = {
          entityId: 'core:entity_123',
          activityMetadata: {
            priority,
          },
        };
        const valid = validate(validData);
        if (!valid) {
          console.error(
            `Priority ${priority} validation errors:`,
            validate.errors
          );
        }
        expect(valid).toBe(true);
      });
    });

    it('should reject priority below 0', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const invalidData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          priority: -1,
        },
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'minimum',
        })
      );
    });

    it('should reject priority above 100', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const invalidData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          priority: 101,
        },
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'maximum',
        })
      );
    });

    it('should reject non-integer priority', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const invalidData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          priority: 75.5,
        },
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
        })
      );
    });
  });

  describe('Type Validation', () => {
    it('should reject non-boolean shouldDescribeInActivity', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const invalidData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          shouldDescribeInActivity: 'yes',
        },
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
        })
      );
    });

    it('should reject non-string template', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const invalidData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: 123,
        },
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
        })
      );
    });

    it('should reject non-string targetRole', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const invalidData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          targetRole: ['entityId'],
        },
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
        })
      );
    });
  });

  describe('Additional Properties Validation', () => {
    it('should reject unknown properties in activityMetadata', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const invalidData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          priority: 75,
          unknownProperty: 'should fail',
        },
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'additionalProperties',
        })
      );
    });
  });

  describe('Template Placeholder Patterns', () => {
    it('should accept templates with {actor} placeholder', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: '{actor} is doing something',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept templates with {target} placeholder', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: 'observing {target}',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept templates with both {actor} and {target}', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: '{actor} is kneeling before {target}',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept templates with future placeholders {verb} and {adverb}', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: '{actor} is {verb} {target} {adverb}',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept templates without any placeholders', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: 'in a kneeling position',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });
  });

  describe('Default Values', () => {
    it('should define default value for shouldDescribeInActivity', () => {
      const metadata =
        kneelingBeforeSchema.dataSchema.properties.activityMetadata.properties;
      expect(metadata.shouldDescribeInActivity.default).toBe(true);
    });

    it('should define default value for template', () => {
      const metadata =
        kneelingBeforeSchema.dataSchema.properties.activityMetadata.properties;
      expect(metadata.template.default).toBe(
        '{actor} is kneeling before {target}'
      );
    });

    it('should define default value for targetRole', () => {
      const metadata =
        kneelingBeforeSchema.dataSchema.properties.activityMetadata.properties;
      expect(metadata.targetRole.default).toBe('entityId');
    });

    it('should define default value for priority', () => {
      const metadata =
        kneelingBeforeSchema.dataSchema.properties.activityMetadata.properties;
      expect(metadata.priority.default).toBe(75);
    });
  });

  describe('Complete Example Validation', () => {
    it('should validate high priority activity example', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: '{actor} is kneeling submissively before {target}',
          targetRole: 'entityId',
          priority: 90,
        },
      };
      const valid = validate(validData);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    it('should validate hidden activity example', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          shouldDescribeInActivity: false,
          priority: 0,
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should validate medium priority activity example', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: '{actor} kneels politely before {target}',
          priority: 60,
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });
  });

  describe('Integration with Component Schema', () => {
    it('should validate complete component with inline metadata', () => {
      const validate = ajv.compile(componentSchema);
      const valid = validate(kneelingBeforeSchema);
      if (!valid) {
        console.error('Component schema validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    it('should maintain schema compatibility with existing validation', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);

      // Test that existing validation still works
      const invalidEntityId = {
        entityId: 'invalid id without namespace',
      };
      const valid = validate(invalidEntityId);
      expect(valid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should accept empty string template', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: '',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept very long template string', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);
      const longTemplate =
        '{actor} is ' +
        'very '.repeat(100) +
        'respectfully kneeling before {target}';
      const validData = {
        entityId: 'core:entity_123',
        activityMetadata: {
          template: longTemplate,
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept priority at boundary values', () => {
      const validate = ajv.compile(kneelingBeforeSchema.dataSchema);

      // Test 0
      let validData = {
        entityId: 'core:entity_123',
        activityMetadata: { priority: 0 },
      };
      expect(validate(validData)).toBe(true);

      // Test 100
      validData = {
        entityId: 'core:entity_123',
        activityMetadata: { priority: 100 },
      };
      expect(validate(validData)).toBe(true);
    });
  });
});

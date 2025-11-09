import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

describe('Activity Description Metadata Schema', () => {
  let ajv;
  let componentSchema;
  let commonSchema;
  let descriptionMetadataSchema;

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
    descriptionMetadataSchema = JSON.parse(
      fs.readFileSync(
        path.join(
          modsPath,
          'activity/components/description_metadata.component.json'
        ),
        'utf8'
      )
    );

    // Add schemas to AJV
    ajv.addSchema(commonSchema);
    ajv.addSchema(componentSchema);
  });

  describe('Schema Loading', () => {
    it('should load the schema without errors', () => {
      expect(descriptionMetadataSchema).toBeDefined();
      expect(descriptionMetadataSchema.id).toBe('activity:description_metadata');
    });

    it('should have correct $schema reference', () => {
      expect(descriptionMetadataSchema.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('should validate against component schema', () => {
      const validate = ajv.compile(componentSchema);
      const valid = validate(descriptionMetadataSchema);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('Required Properties', () => {
    it('should require sourceComponent and descriptionType', () => {
      const dataSchema = descriptionMetadataSchema.dataSchema;
      expect(dataSchema.required).toContain('sourceComponent');
      expect(dataSchema.required).toContain('descriptionType');
      expect(dataSchema.required).toHaveLength(2);
    });

    it('should reject data missing sourceComponent', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const invalidData = {
        descriptionType: 'template',
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'required',
          params: expect.objectContaining({ missingProperty: 'sourceComponent' }),
        })
      );
    });

    it('should reject data missing descriptionType', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const invalidData = {
        sourceComponent: 'kissing:kissing',
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'required',
          params: expect.objectContaining({ missingProperty: 'descriptionType' }),
        })
      );
    });
  });

  describe('Description Type Enum', () => {
    const descriptionTypes = ['template', 'verb', 'custom', 'conditional'];

    descriptionTypes.forEach((type) => {
      it(`should accept descriptionType: ${type}`, () => {
        const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
        const validData = {
          sourceComponent: 'test:component',
          descriptionType: type,
        };
        const valid = validate(validData);
        if (!valid) {
          console.error('Validation errors:', validate.errors);
        }
        expect(valid).toBe(true);
      });
    });

    it('should reject invalid descriptionType', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const invalidData = {
        sourceComponent: 'test:component',
        descriptionType: 'invalid_type',
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'enum',
        })
      );
    });
  });

  describe('Optional Properties', () => {
    it('should accept valid template string', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'kissing:kissing',
        descriptionType: 'template',
        template: '{actor} is {verb} {target}',
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept valid verb and adverb', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'kissing:kissing',
        descriptionType: 'verb',
        verb: 'kissing',
        adverb: 'passionately',
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept valid targetRole', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'companionship:following',
        descriptionType: 'template',
        targetRole: 'leaderId',
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });
  });

  describe('Priority Property', () => {
    it('should accept priority within valid range (0-100)', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);

      [0, 50, 100].forEach((priority) => {
        const validData = {
          sourceComponent: 'test:component',
          descriptionType: 'template',
          priority,
        };
        const valid = validate(validData);
        expect(valid).toBe(true);
      });
    });

    it('should reject priority below 0', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const invalidData = {
        sourceComponent: 'test:component',
        descriptionType: 'template',
        priority: -1,
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
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const invalidData = {
        sourceComponent: 'test:component',
        descriptionType: 'template',
        priority: 101,
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'maximum',
        })
      );
    });
  });

  describe('Conditions Object', () => {
    it('should accept showOnlyIfProperty condition', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'test:component',
        descriptionType: 'conditional',
        conditions: {
          showOnlyIfProperty: {
            property: 'intensity',
            equals: 'high',
          },
        },
      };
      const valid = validate(validData);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    it('should accept hideIfTargetHasComponent condition', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'kissing:kissing',
        descriptionType: 'template',
        conditions: {
          hideIfTargetHasComponent: 'kissing:being_kissed',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept requiredComponents array', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'test:component',
        descriptionType: 'template',
        conditions: {
          requiredComponents: ['core:actor', 'positioning:standing'],
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should reject showOnlyIfProperty missing required fields', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const invalidData = {
        sourceComponent: 'test:component',
        descriptionType: 'conditional',
        conditions: {
          showOnlyIfProperty: {
            property: 'intensity',
            // missing 'equals'
          },
        },
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
    });
  });

  describe('Grouping Object', () => {
    it('should accept grouping with groupKey', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'test:component',
        descriptionType: 'template',
        grouping: {
          groupKey: 'intimate_contact',
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should accept grouping with combineWith array', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'test:component',
        descriptionType: 'template',
        grouping: {
          groupKey: 'intimate_contact',
          combineWith: ['kissing', 'embracing', 'hugging'],
        },
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });
  });

  describe('Additional Properties', () => {
    it('should reject additional properties not in schema', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const invalidData = {
        sourceComponent: 'test:component',
        descriptionType: 'template',
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

  describe('Complete Valid Examples', () => {
    it('should validate a complete template-based metadata', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'kissing:kissing',
        descriptionType: 'template',
        template: '{actor} is {verb} {target} {adverb}',
        verb: 'kissing',
        adverb: 'passionately',
        targetRole: 'partner',
        priority: 75,
        conditions: {
          requiredComponents: ['core:actor'],
        },
        grouping: {
          groupKey: 'intimate_contact',
          combineWith: ['embracing', 'caressing'],
        },
      };
      const valid = validate(validData);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    it('should validate minimal required metadata', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'companionship:following',
        descriptionType: 'verb',
      };
      const valid = validate(validData);
      expect(valid).toBe(true);
    });

    it('should validate conditional metadata with all conditions', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validData = {
        sourceComponent: 'positioning:kneeling',
        descriptionType: 'conditional',
        template: '{actor} is kneeling before {target}',
        priority: 90,
        conditions: {
          showOnlyIfProperty: {
            property: 'posture',
            equals: 'kneeling',
          },
          hideIfTargetHasComponent: 'positioning:lying_down',
          requiredComponents: ['core:actor', 'positioning:can_kneel'],
        },
      };
      const valid = validate(validData);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe('NamespacedId Validation', () => {
    it('should accept valid namespaced component IDs', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const validIds = [
        'core:actor',
        'kissing:kissing',
        'positioning:kneeling_before',
        'positioning:fucking_vaginally',
      ];

      validIds.forEach((id) => {
        const validData = {
          sourceComponent: id,
          descriptionType: 'template',
        };
        const valid = validate(validData);
        if (!valid) {
          console.error(`Failed for ID: ${id}`, validate.errors);
        }
        expect(valid).toBe(true);
      });
    });

    it('should reject invalid component ID format', () => {
      const validate = ajv.compile(descriptionMetadataSchema.dataSchema);
      const invalidData = {
        sourceComponent: 'invalid component id', // spaces not allowed
        descriptionType: 'template',
      };
      const valid = validate(invalidData);
      expect(valid).toBe(false);
    });
  });
});

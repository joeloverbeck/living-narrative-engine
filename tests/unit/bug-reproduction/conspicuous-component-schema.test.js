import fs from 'fs';
import path from 'path';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

describe('Bug Reproduction: Conspicuous Component Schema Validation', () => {
  let validator;
  let componentSchema;
  let conspicuousComponent;

  beforeAll(async () => {
    // Setup validator
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    validator = new AjvSchemaValidator({ logger: mockLogger });

    // Load schema and component data
    const projectRoot = process.cwd();
    const schemaPath = path.join(projectRoot, 'data/schemas/common.schema.json');
    const componentSchemaPath = path.join(projectRoot, 'data/schemas/component.schema.json');
    const conspicuousPath = path.join(projectRoot, 'data/mods/core/components/conspicuous.component.json');

    const commonSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    componentSchema = JSON.parse(fs.readFileSync(componentSchemaPath, 'utf8'));
    conspicuousComponent = JSON.parse(fs.readFileSync(conspicuousPath, 'utf8'));

    // We need to load common schema as well because component schema references it
     await validator.addSchema(commonSchema, commonSchema.$id);
     await validator.addSchema(componentSchema, componentSchema.$id);
  });

  it('should pass validation for conspicuous.component.json after fix', async () => {
    // Validate
    const result = validator.validate(componentSchema.$id, conspicuousComponent);

    // Expect success
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });
});
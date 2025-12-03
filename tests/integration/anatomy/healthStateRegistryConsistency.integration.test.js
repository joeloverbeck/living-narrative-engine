import fs from 'fs';
import path from 'path';
import { validateSchemaConsistency } from '../../../src/anatomy/validators/healthStateValidator.js';
import {
  calculateStateFromPercentage,
  getFirstPersonDescription,
  getThirdPersonDescription,
} from '../../../src/anatomy/registries/healthStateRegistry.js';

describe('Health State Registry Consistency', () => {
  it('should match the schema enum definition', () => {
    // Locate the schema file
    const schemaPath = path.resolve(
      process.cwd(),
      'data/mods/anatomy/components/part_health.component.json'
    );

    // Read and parse schema
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    const schemaEnum = schema.dataSchema.properties.state.enum;

    // Validate consistency
    const result = validateSchemaConsistency(schemaEnum);

    if (!result.valid) {
      console.error('Schema Consistency Errors:', result.errors);
    }

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should have narrative descriptions for all schema states', () => {
    // Locate the schema file
    const schemaPath = path.resolve(
      process.cwd(),
      'data/mods/anatomy/components/part_health.component.json'
    );

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    const schemaEnum = schema.dataSchema.properties.state.enum;

    schemaEnum.forEach((state) => {
      const firstPerson = getFirstPersonDescription(state);
      const thirdPerson = getThirdPersonDescription(state);

      expect(firstPerson).toBeTruthy();
      expect(thirdPerson).toBeTruthy();
    });
  });

  it('should cover the full 0-100% range without gaps', () => {
    // Check every integer percentage from 0 to 100
    for (let i = 0; i <= 100; i++) {
      const state = calculateStateFromPercentage(i);
      expect(state).toBeDefined();
    }
  });
});

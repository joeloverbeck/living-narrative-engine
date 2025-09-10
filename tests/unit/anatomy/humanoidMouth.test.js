import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Humanoid Mouth Entity - Mouth Engagement', () => {
  let mouthDefinition;

  beforeAll(() => {
    // Read the actual entity definition file
    const definitionPath = path.join(
      process.cwd(),
      'data/mods/anatomy/entities/definitions/humanoid_mouth.entity.json'
    );
    const content = fs.readFileSync(definitionPath, 'utf8');
    mouthDefinition = JSON.parse(content);
  });

  test('should include mouth_engagement component by default', () => {
    expect(mouthDefinition.components['core:mouth_engagement']).toBeDefined();
    expect(mouthDefinition.components['core:mouth_engagement']).toEqual({
      locked: false,
      forcedOverride: false,
    });
  });

  test('should still include all existing components', () => {
    // Verify all components are present
    expect(mouthDefinition.components['anatomy:part']).toBeDefined();
    expect(mouthDefinition.components['anatomy:part'].subType).toBe('mouth');
    expect(mouthDefinition.components['core:name']).toBeDefined();
    expect(mouthDefinition.components['core:name'].text).toBe('mouth');
    expect(mouthDefinition.components['anatomy:sockets']).toBeDefined();
    expect(mouthDefinition.components['anatomy:sockets'].sockets).toHaveLength(
      1
    );
    expect(mouthDefinition.components['anatomy:sockets'].sockets[0].id).toBe(
      'teeth'
    );
  });

  test('should have correct default values for mouth engagement', () => {
    // Verify default values
    const mouthEngagement = mouthDefinition.components['core:mouth_engagement'];
    expect(mouthEngagement).toBeDefined();
    expect(mouthEngagement.locked).toBe(false);
    expect(mouthEngagement.forcedOverride).toBe(false);
  });

  test('should have updated description mentioning engagement tracking', () => {
    // Verify description is updated
    expect(mouthDefinition.description).toContain('engagement tracking');
  });

  test('should have valid JSON schema reference', () => {
    expect(mouthDefinition.$schema).toBe(
      'schema://living-narrative-engine/entity-definition.schema.json'
    );
  });

  test('should have correct entity ID', () => {
    expect(mouthDefinition.id).toBe('anatomy:humanoid_mouth');
  });
});

/**
 * @file Integration test to verify warding mod components load correctly.
 * @see data/mods/warding/components/corrupted.component.json
 * @see data/mods/skills/components/warding_skill.component.json
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import path from 'path';
import fs from 'fs';

/**
 * Integration Test – Warding Mod Component Loading
 *
 * This test verifies that:
 * 1. The warding:corrupted marker component is properly structured
 * 2. The skills:warding_skill skill component is properly structured
 * 3. Both components follow their respective patterns (marker vs skill)
 * 4. The warding mod manifest is correctly configured
 */
describe('Warding Mod Components - Integration', () => {
  let testBed;
  let corruptedComponent;
  let wardingSkillComponent;
  let wardingManifest;
  let skillsManifest;

  beforeEach(() => {
    testBed = createTestBed();

    // Load the corrupted marker component
    const corruptedPath = path.resolve(
      process.cwd(),
      'data/mods/warding/components/corrupted.component.json'
    );
    corruptedComponent = JSON.parse(fs.readFileSync(corruptedPath, 'utf8'));

    // Load the warding skill component
    const wardingSkillPath = path.resolve(
      process.cwd(),
      'data/mods/skills/components/warding_skill.component.json'
    );
    wardingSkillComponent = JSON.parse(
      fs.readFileSync(wardingSkillPath, 'utf8')
    );

    // Load the warding mod manifest
    const wardingManifestPath = path.resolve(
      process.cwd(),
      'data/mods/warding/mod-manifest.json'
    );
    wardingManifest = JSON.parse(fs.readFileSync(wardingManifestPath, 'utf8'));

    // Load the skills mod manifest
    const skillsManifestPath = path.resolve(
      process.cwd(),
      'data/mods/skills/mod-manifest.json'
    );
    skillsManifest = JSON.parse(fs.readFileSync(skillsManifestPath, 'utf8'));
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('warding:corrupted Marker Component', () => {
    it('should have correct component ID', () => {
      expect(corruptedComponent.id).toBe('warding:corrupted');
    });

    it('should reference correct schema', () => {
      expect(corruptedComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('should have a meaningful description', () => {
      expect(corruptedComponent.description).toBeDefined();
      expect(typeof corruptedComponent.description).toBe('string');
      expect(corruptedComponent.description.length).toBeGreaterThan(0);
      expect(
        corruptedComponent.description.toLowerCase()
      ).toContain('corrupted');
    });

    it('should be a marker component with empty properties', () => {
      expect(corruptedComponent.dataSchema).toBeDefined();
      expect(corruptedComponent.dataSchema.type).toBe('object');
      expect(corruptedComponent.dataSchema.properties).toEqual({});
    });

    it('should disallow additional properties', () => {
      expect(corruptedComponent.dataSchema.additionalProperties).toBe(false);
    });

    it('should follow the same pattern as vampirism:is_vampire marker', () => {
      const isVampirePath = path.resolve(
        process.cwd(),
        'data/mods/vampirism/components/is_vampire.component.json'
      );
      const isVampire = JSON.parse(fs.readFileSync(isVampirePath, 'utf8'));

      expect(corruptedComponent.dataSchema.type).toBe(isVampire.dataSchema.type);
      expect(corruptedComponent.dataSchema.properties).toEqual(
        isVampire.dataSchema.properties
      );
      expect(corruptedComponent.dataSchema.additionalProperties).toBe(
        isVampire.dataSchema.additionalProperties
      );
    });
  });

  describe('skills:warding_skill Skill Component', () => {
    it('should have correct component ID', () => {
      expect(wardingSkillComponent.id).toBe('skills:warding_skill');
    });

    it('should reference correct schema', () => {
      expect(wardingSkillComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });

    it('should have a meaningful description', () => {
      expect(wardingSkillComponent.description).toBeDefined();
      expect(typeof wardingSkillComponent.description).toBe('string');
      expect(wardingSkillComponent.description.length).toBeGreaterThan(0);
      expect(
        wardingSkillComponent.description.toLowerCase()
      ).toContain('warding');
    });

    it('should have value property with correct constraints', () => {
      expect(wardingSkillComponent.dataSchema.properties.value).toBeDefined();
      const valueProp = wardingSkillComponent.dataSchema.properties.value;

      expect(valueProp.type).toBe('integer');
      expect(valueProp.minimum).toBe(0);
      expect(valueProp.maximum).toBe(100);
      expect(valueProp.default).toBe(10);
    });

    it('should require the value property', () => {
      expect(wardingSkillComponent.dataSchema.required).toContain('value');
    });

    it('should disallow additional properties', () => {
      expect(wardingSkillComponent.dataSchema.additionalProperties).toBe(false);
    });

    it('should follow the same pattern as skills:melee_skill', () => {
      const meleeSkillPath = path.resolve(
        process.cwd(),
        'data/mods/skills/components/melee_skill.component.json'
      );
      const meleeSkill = JSON.parse(fs.readFileSync(meleeSkillPath, 'utf8'));

      // Verify structure matches
      expect(wardingSkillComponent.dataSchema.type).toBe(
        meleeSkill.dataSchema.type
      );
      expect(
        Object.keys(wardingSkillComponent.dataSchema.properties)
      ).toEqual(Object.keys(meleeSkill.dataSchema.properties));
      expect(wardingSkillComponent.dataSchema.required).toEqual(
        meleeSkill.dataSchema.required
      );
      expect(wardingSkillComponent.dataSchema.additionalProperties).toBe(
        meleeSkill.dataSchema.additionalProperties
      );

      // Verify value property constraints match
      const wardingValue = wardingSkillComponent.dataSchema.properties.value;
      const meleeValue = meleeSkill.dataSchema.properties.value;
      expect(wardingValue.type).toBe(meleeValue.type);
      expect(wardingValue.minimum).toBe(meleeValue.minimum);
      expect(wardingValue.maximum).toBe(meleeValue.maximum);
      expect(wardingValue.default).toBe(meleeValue.default);
    });
  });

  describe('Warding Mod Manifest', () => {
    it('should have correct mod ID', () => {
      expect(wardingManifest.id).toBe('warding');
    });

    it('should reference correct schema', () => {
      expect(wardingManifest.$schema).toBe(
        'schema://living-narrative-engine/mod-manifest.schema.json'
      );
    });

    it('should depend on core mod', () => {
      const coreDep = wardingManifest.dependencies.find((d) => d.id === 'core');
      expect(coreDep).toBeDefined();
      expect(coreDep.version).toBe('>=1.0.0');
    });

    it('should depend on skills mod', () => {
      const skillsDep = wardingManifest.dependencies.find(
        (d) => d.id === 'skills'
      );
      expect(skillsDep).toBeDefined();
      expect(skillsDep.version).toBe('>=1.0.0');
    });

    it('should list corrupted component', () => {
      expect(wardingManifest.content.components).toContain(
        'corrupted.component.json'
      );
    });
  });

  describe('Skills Mod Manifest - Warding Skill Integration', () => {
    it('should list warding_skill component', () => {
      expect(skillsManifest.content.components).toContain(
        'warding_skill.component.json'
      );
    });

    it('should have correct skills mod ID', () => {
      expect(skillsManifest.id).toBe('skills');
    });
  });

  describe('Component File Existence and Validity', () => {
    it('should have corrupted component in warding mod directory', () => {
      const componentPath = path.resolve(
        process.cwd(),
        'data/mods/warding/components/corrupted.component.json'
      );
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should have warding_skill component in skills mod directory', () => {
      const componentPath = path.resolve(
        process.cwd(),
        'data/mods/skills/components/warding_skill.component.json'
      );
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should parse corrupted component as valid JSON', () => {
      expect(() => {
        const componentPath = path.resolve(
          process.cwd(),
          'data/mods/warding/components/corrupted.component.json'
        );
        JSON.parse(fs.readFileSync(componentPath, 'utf8'));
      }).not.toThrow();
    });

    it('should parse warding_skill component as valid JSON', () => {
      expect(() => {
        const componentPath = path.resolve(
          process.cwd(),
          'data/mods/skills/components/warding_skill.component.json'
        );
        JSON.parse(fs.readFileSync(componentPath, 'utf8'));
      }).not.toThrow();
    });
  });
});

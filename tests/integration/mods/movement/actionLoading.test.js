import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import path from 'path';
import fs from 'fs';

describe('Movement Action Loading Integration', () => {
  let testBed;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Movement Mod Content Loading', () => {
    it('should load go action from movement mod', () => {
      // Load the movement mod manifest
      const manifestPath = path.resolve(
        process.cwd(),
        'data/mods/movement/mod-manifest.json'
      );
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      // Verify the action is listed in the manifest
      expect(manifest.content.actions).toContain('go.action.json');

      // Load the action file
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      expect(fs.existsSync(actionPath)).toBe(true);

      const actionContent = fs.readFileSync(actionPath, 'utf8');
      const action = JSON.parse(actionContent);

      // Verify action is loaded correctly
      expect(action).toBeDefined();
      expect(action.id).toBe('movement:go');
    });

    it('should load movement conditions referenced by go action', () => {
      // Load the condition file
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions/actor-can-move.condition.json'
      );
      expect(fs.existsSync(conditionPath)).toBe(true);

      const conditionContent = fs.readFileSync(conditionPath, 'utf8');
      const condition = JSON.parse(conditionContent);

      // Verify condition is loaded correctly
      expect(condition).toBeDefined();
      expect(condition.id).toBe('movement:actor-can-move');
    });

    it('should load movement scopes referenced by go action', () => {
      // Load the scope file
      const scopePath = path.resolve(
        process.cwd(),
        'data/mods/movement/scopes/clear_directions.scope'
      );
      expect(fs.existsSync(scopePath)).toBe(true);

      const scopeContent = fs.readFileSync(scopePath, 'utf8');

      // Verify scope content
      expect(scopeContent).toContain('movement:clear_directions');
      expect(scopeContent).toContain('movement:exit-is-unblocked');
    });
  });

  describe('Dependency Resolution', () => {
    it('should resolve movement dependencies in go action', () => {
      // Load the go action
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      // Check targets structure
      expect(action.targets.primary.scope).toBe('movement:clear_directions');

      // Check prerequisites array
      expect(Array.isArray(action.prerequisites)).toBe(true);
      expect(action.prerequisites[0].logic.condition_ref).toBe(
        'movement:actor-can-move'
      );

      // Verify the referenced scope exists
      const scopePath = path.resolve(
        process.cwd(),
        'data/mods/movement/scopes/clear_directions.scope'
      );
      expect(fs.existsSync(scopePath)).toBe(true);

      // Verify the referenced condition exists
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions/actor-can-move.condition.json'
      );
      expect(fs.existsSync(conditionPath)).toBe(true);
    });

    it('should have proper namespace migration from core to movement', () => {
      // Load both actions to compare (if core version still exists)
      const movementActionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const movementAction = JSON.parse(
        fs.readFileSync(movementActionPath, 'utf8')
      );

      // Verify all functional core: references have been updated to movement:
      // Note: metadata.migratedFrom intentionally retains "movement:go" for tracking
      expect(movementAction.id).not.toContain('core:');
      expect(movementAction.targets.primary.scope).not.toContain('core:');
      expect(movementAction.prerequisites[0].logic.condition_ref).not.toContain(
        'core:'
      );

      // Verify movement namespace is used consistently
      expect(movementAction.id).toMatch(/^movement:/);
      expect(movementAction.targets.primary.scope).toMatch(/^movement:/);
      expect(movementAction.prerequisites[0].logic.condition_ref).toMatch(
        /^movement:/
      );
    });
  });

  describe('Mod Manifest Integrity', () => {
    it('should have all migrated content listed in movement mod manifest', () => {
      const manifestPath = path.resolve(
        process.cwd(),
        'data/mods/movement/mod-manifest.json'
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // Verify actions are listed
      expect(manifest.content.actions).toBeDefined();
      expect(manifest.content.actions).toContain('go.action.json');

      // Verify conditions are listed
      expect(manifest.content.conditions).toBeDefined();
      expect(manifest.content.conditions).toContain(
        'actor-can-move.condition.json'
      );

      // Verify scopes are listed
      expect(manifest.content.scopes).toBeDefined();
      expect(manifest.content.scopes).toContain('clear_directions.scope');
    });

    it('should maintain dependency on core mod', () => {
      const manifestPath = path.resolve(
        process.cwd(),
        'data/mods/movement/mod-manifest.json'
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      expect(manifest.dependencies).toBeDefined();
      expect(manifest.dependencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'core',
            version: expect.any(String),
          }),
        ])
      );
    });
  });

  describe('Schema Compliance', () => {
    it('should validate go action against action schema', () => {
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      // Check required fields
      expect(action.$schema).toBe(
        'schema://living-narrative-engine/action.schema.json'
      );
      expect(action.id).toBeDefined();
      expect(action.name).toBeDefined();
      expect(action.description).toBeDefined();
      expect(action.template).toBeDefined();
      expect(action.targets).toBeDefined();

      // Check targets structure
      expect(action.targets.primary).toBeDefined();
      expect(action.targets.primary.scope).toBeDefined();
      expect(action.targets.primary.placeholder).toBeDefined();

      // Check prerequisites structure
      if (action.prerequisites) {
        expect(Array.isArray(action.prerequisites)).toBe(true);
        action.prerequisites.forEach((prereq) => {
          expect(prereq.logic || prereq.failure_message).toBeDefined();
        });
      }

      // Check visual structure
      if (action.visual) {
        expect(action.visual.backgroundColor).toBeDefined();
        expect(action.visual.textColor).toBeDefined();
      }
    });

    it('should validate condition against condition schema', () => {
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions/actor-can-move.condition.json'
      );
      const condition = JSON.parse(fs.readFileSync(conditionPath, 'utf8'));

      // Check required fields
      expect(condition.$schema).toBe(
        'schema://living-narrative-engine/condition.schema.json'
      );
      expect(condition.id).toBeDefined();
      expect(condition.description).toBeDefined();
      expect(condition.logic).toBeDefined();
    });
  });
});

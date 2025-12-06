import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import path from 'path';
import fs from 'fs';

describe('Movement Flow Integration', () => {
  let testBed;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should load complete movement workflow components', () => {
    // Load action
    const actionPath = path.resolve(
      process.cwd(),
      'data/mods/movement/actions/go.action.json'
    );
    const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

    // Load referenced condition
    const conditionPath = path.resolve(
      process.cwd(),
      'data/mods/movement/conditions/actor-can-move.condition.json'
    );
    const condition = JSON.parse(fs.readFileSync(conditionPath, 'utf8'));

    // Load referenced scope
    const scopePath = path.resolve(
      process.cwd(),
      'data/mods/movement/scopes/clear_directions.scope'
    );
    const scopeContent = fs.readFileSync(scopePath, 'utf8');

    // Verify connections
    expect(action.targets.primary.scope).toBe('movement:clear_directions');
    expect(action.prerequisites[0].logic.condition_ref).toBe(condition.id);
    expect(scopeContent).toBeDefined();
    expect(scopeContent.length).toBeGreaterThan(0);
  });

  it('should validate rule integration', () => {
    // Load the movement rule
    const rulePath = path.resolve(
      process.cwd(),
      'data/mods/movement/rules/go.rule.json'
    );
    const rule = JSON.parse(fs.readFileSync(rulePath, 'utf8'));

    expect(rule.rule_id).toBe('handle_go_action');
    expect(rule.condition).toBeDefined();
    expect(rule.condition.condition_ref).toBe('movement:event-is-action-go');
    expect(rule.event_type).toBe('core:attempt_action');
    expect(Array.isArray(rule.actions)).toBe(true);
  });

  it('should have all movement components properly namespaced', () => {
    // Load all movement components
    const action = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          'data/mods/movement/actions/go.action.json'
        ),
        'utf8'
      )
    );
    const conditions = [
      'actor-can-move',
      'event-is-action-go',
      'exit-is-unblocked',
    ].map((name) =>
      JSON.parse(
        fs.readFileSync(
          path.resolve(
            process.cwd(),
            `data/mods/movement/conditions/${name}.condition.json`
          ),
          'utf8'
        )
      )
    );

    // Verify action and conditions use movement namespace
    expect(action.id).toMatch(/^movement:/);
    conditions.forEach((condition) => {
      expect(condition.id).toMatch(/^movement:/);
    });
    // Rule uses different format but references movement conditions
    const rule = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), 'data/mods/movement/rules/go.rule.json'),
        'utf8'
      )
    );
    expect(rule.condition.condition_ref).toMatch(/^movement:/);
  });

  it('should have valid schema references for all components', () => {
    const action = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          'data/mods/movement/actions/go.action.json'
        ),
        'utf8'
      )
    );
    const rule = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), 'data/mods/movement/rules/go.rule.json'),
        'utf8'
      )
    );
    const condition = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          'data/mods/movement/conditions/actor-can-move.condition.json'
        ),
        'utf8'
      )
    );

    expect(action.$schema).toBe(
      'schema://living-narrative-engine/action.schema.json'
    );
    expect(rule.$schema).toBe(
      'schema://living-narrative-engine/rule.schema.json'
    );
    expect(condition.$schema).toBe(
      'schema://living-narrative-engine/condition.schema.json'
    );
  });

  it('should have complete action-rule-condition chain', () => {
    // Load components
    const action = JSON.parse(
      fs.readFileSync(
        path.resolve(
          process.cwd(),
          'data/mods/movement/actions/go.action.json'
        ),
        'utf8'
      )
    );
    const rule = JSON.parse(
      fs.readFileSync(
        path.resolve(process.cwd(), 'data/mods/movement/rules/go.rule.json'),
        'utf8'
      )
    );

    // Verify action has prerequisites
    expect(action.prerequisites).toBeDefined();
    expect(Array.isArray(action.prerequisites)).toBe(true);
    expect(action.prerequisites.length).toBeGreaterThan(0);

    // Verify rule references the action event condition
    expect(rule.condition.condition_ref).toBe('movement:event-is-action-go');

    // Verify rule handles go actions
    expect(rule.rule_id).toBe('handle_go_action');
    expect(rule.event_type).toBe('core:attempt_action');
  });

  it('should have mod manifest with correct dependencies', () => {
    const manifestPath = path.resolve(
      process.cwd(),
      'data/mods/movement/mod-manifest.json'
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.id).toBe('movement');
    expect(manifest.name).toBeDefined();
    expect(manifest.version).toBeDefined();
    expect(manifest.dependencies).toBeDefined();
    expect(Array.isArray(manifest.dependencies)).toBe(true);
  });

  describe('Component Loading Validation', () => {
    it('should have all referenced conditions exist', () => {
      const action = JSON.parse(
        fs.readFileSync(
          path.resolve(
            process.cwd(),
            'data/mods/movement/actions/go.action.json'
          ),
          'utf8'
        )
      );

      // Extract all condition references from prerequisites
      const conditionRefs = action.prerequisites
        .filter((prereq) => prereq.logic?.condition_ref)
        .map((prereq) => prereq.logic.condition_ref);

      // Verify each referenced condition file exists
      conditionRefs.forEach((ref) => {
        const conditionId = ref.split(':')[1]; // Remove namespace
        const conditionPath = path.resolve(
          process.cwd(),
          `data/mods/movement/conditions/${conditionId}.condition.json`
        );
        expect(fs.existsSync(conditionPath)).toBe(true);
      });
    });

    it('should have all referenced scopes exist', () => {
      const action = JSON.parse(
        fs.readFileSync(
          path.resolve(
            process.cwd(),
            'data/mods/movement/actions/go.action.json'
          ),
          'utf8'
        )
      );

      // Extract scope reference
      const scopeRef = action.targets.primary.scope;
      const scopeId = scopeRef.split(':')[1]; // Remove namespace
      const scopePath = path.resolve(
        process.cwd(),
        `data/mods/movement/scopes/${scopeId}.scope`
      );

      expect(fs.existsSync(scopePath)).toBe(true);
    });
  });

  describe('Explorer Cyan Theme Consistency', () => {
    it('should have consistent visual theme across movement actions', () => {
      const actionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/actions/go.action.json'
      );
      const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

      // Verify Explorer Cyan colors
      expect(action.visual.backgroundColor).toBe('#006064');
      expect(action.visual.textColor).toBe('#e0f7fa');
      expect(action.visual.hoverBackgroundColor).toBe('#00838f');
      expect(action.visual.hoverTextColor).toBe('#ffffff');
    });
  });
});

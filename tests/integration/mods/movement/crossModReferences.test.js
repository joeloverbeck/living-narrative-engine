import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Cross-Mod References', () => {
  describe('Positioning to Movement References', () => {
    it('should resolve movement conditions from positioning mod - turn_around action', () => {
      // Load positioning action that references movement condition
      const turnAroundPath = path.resolve(
        process.cwd(),
        'data/mods/physical-control/actions/turn_around.action.json'
      );
      const turnAroundAction = JSON.parse(
        fs.readFileSync(turnAroundPath, 'utf8')
      );

      // Verify it references movement condition
      const conditionRef =
        turnAroundAction.prerequisites[0].logic.condition_ref;
      expect(conditionRef).toBe('movement:actor-can-move');

      // Verify the referenced condition exists
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions/actor-can-move.condition.json'
      );
      expect(fs.existsSync(conditionPath)).toBe(true);

      // Load and verify the condition structure
      const condition = JSON.parse(fs.readFileSync(conditionPath, 'utf8'));
      expect(condition.id).toBe('movement:actor-can-move');
    });

    it('should have get_close action reference positioning condition', () => {
      // get_close was migrated to personal-space mod
      const getClosePath = path.resolve(
        process.cwd(),
        'data/mods/personal-space/actions/get_close.action.json'
      );
      const getCloseAction = JSON.parse(fs.readFileSync(getClosePath, 'utf8'));

      // Verify positioning condition reference (moved from movement to avoid circular dependency)
      const hasPositioningRef = getCloseAction.prerequisites.some(
        (prereq) => prereq.logic?.condition_ref === 'positioning:actor-can-move'
      );
      expect(hasPositioningRef).toBe(true);
    });

    it('should have step_back action with appropriate conditions', () => {
      // step_back was migrated to personal-space mod
      const stepBackPath = path.resolve(
        process.cwd(),
        'data/mods/personal-space/actions/step_back.action.json'
      );
      const stepBackAction = JSON.parse(fs.readFileSync(stepBackPath, 'utf8'));

      // Step back is about ending closeness, not necessarily requiring movement ability
      // It may use other conditions like mouth availability
      expect(stepBackAction.prerequisites).toBeDefined();
      expect(Array.isArray(stepBackAction.prerequisites)).toBe(true);
    });

    it('should have place_yourself_behind action with appropriate conditions', () => {
      const placeBehindPath = path.resolve(
        process.cwd(),
        'data/mods/maneuvering/actions/place_yourself_behind.action.json'
      );
      const placeBehindAction = JSON.parse(
        fs.readFileSync(placeBehindPath, 'utf8')
      );

      // This action may or may not require movement ability depending on implementation
      expect(placeBehindAction.prerequisites).toBeDefined();
      expect(Array.isArray(placeBehindAction.prerequisites)).toBe(true);
    });

    it('should have turn_around_to_face action with appropriate conditions', () => {
      const turnToFacePath = path.resolve(
        process.cwd(),
        'data/mods/facing/actions/turn_around_to_face.action.json'
      );
      const turnToFaceAction = JSON.parse(
        fs.readFileSync(turnToFacePath, 'utf8')
      );

      // Turning around doesn't necessarily require movement ability
      expect(turnToFaceAction.prerequisites).toBeDefined();
      expect(Array.isArray(turnToFaceAction.prerequisites)).toBe(true);
    });

    it('should have turn_your_back action with appropriate conditions', () => {
      const turnBackPath = path.resolve(
        process.cwd(),
        'data/mods/facing/actions/turn_your_back.action.json'
      );
      const turnBackAction = JSON.parse(fs.readFileSync(turnBackPath, 'utf8'));

      // Turning your back doesn't necessarily require movement ability
      expect(turnBackAction.prerequisites).toBeDefined();
      expect(Array.isArray(turnBackAction.prerequisites)).toBe(true);
    });
  });

  describe('Movement Condition Availability', () => {
    it('should have movement:actor-can-move condition accessible to other mods', () => {
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions/actor-can-move.condition.json'
      );

      // Verify the condition exists
      expect(fs.existsSync(conditionPath)).toBe(true);

      // Verify the condition structure
      const condition = JSON.parse(fs.readFileSync(conditionPath, 'utf8'));
      expect(condition.id).toBe('movement:actor-can-move');
      expect(condition.description).toBeDefined();
      expect(condition.logic).toBeDefined();
      expect(condition.$schema).toBe(
        'schema://living-narrative-engine/condition.schema.json'
      );
    });

    it('should have all movement conditions properly exported for cross-mod use', () => {
      const conditionsDir = path.resolve(
        process.cwd(),
        'data/mods/movement/conditions'
      );

      const conditionFiles = fs
        .readdirSync(conditionsDir)
        .filter((file) => file.endsWith('.condition.json'));

      // Verify each condition is properly structured for cross-mod use
      conditionFiles.forEach((file) => {
        const conditionPath = path.join(conditionsDir, file);
        const condition = JSON.parse(fs.readFileSync(conditionPath, 'utf8'));

        // Must have movement namespace for cross-mod reference
        expect(condition.id).toMatch(/^movement:/);
        // Must have schema for validation
        expect(condition.$schema).toBeDefined();
        // Must have logic for evaluation
        expect(condition.logic).toBeDefined();
      });
    });
  });

  describe('Mod Manifest Dependencies', () => {
    it('should have movement mod declare dependency on positioning mod', () => {
      const movementManifestPath = path.resolve(
        process.cwd(),
        'data/mods/movement/mod-manifest.json'
      );
      const movementManifest = JSON.parse(
        fs.readFileSync(movementManifestPath, 'utf8')
      );

      // Movement now depends on positioning (reversed to avoid circular dependency)
      // Dependencies are objects with id and version, not just strings
      const hasPositioningDep = movementManifest.dependencies.some(
        (dep) => dep.id === 'positioning'
      );
      expect(hasPositioningDep).toBe(true);
    });

    it('should have movement mod available as a dependency', () => {
      const movementManifestPath = path.resolve(
        process.cwd(),
        'data/mods/movement/mod-manifest.json'
      );
      const movementManifest = JSON.parse(
        fs.readFileSync(movementManifestPath, 'utf8')
      );

      // Movement mod should be properly structured for dependency
      expect(movementManifest.id).toBe('movement');
      expect(movementManifest.name).toBeDefined();
      expect(movementManifest.version).toBeDefined();
    });
  });

  describe('Cross-Mod Reference Validation', () => {
    it('should have positioning actions with valid prerequisite structures', () => {
      const positioningActionsDir = path.resolve(
        process.cwd(),
        'data/mods/positioning/actions'
      );

      const actionFiles = fs
        .readdirSync(positioningActionsDir)
        .filter((file) => file.endsWith('.action.json'));

      // All positioning actions should have valid prerequisite structures
      actionFiles.forEach((file) => {
        const actionPath = path.join(positioningActionsDir, file);
        const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

        // Actions should have prerequisites array
        expect(action.prerequisites).toBeDefined();
        expect(Array.isArray(action.prerequisites)).toBe(true);

        // Each prerequisite should have a valid structure
        action.prerequisites.forEach((prereq) => {
          expect(prereq.logic).toBeDefined();
        });

        // Check that all condition references use proper namespacing
        const conditionRefs = action.prerequisites
          .map((prereq) => prereq.logic.condition_ref)
          .filter((ref) => ref !== undefined);

        conditionRefs.forEach((conditionRef) => {
          expect(conditionRef).toMatch(/^[a-z_]+:[a-z-_]+$/);
        });
      });
    });

    it('should not have broken cross-mod references', () => {
      const positioningActionsDir = path.resolve(
        process.cwd(),
        'data/mods/positioning/actions'
      );

      const actionFiles = fs
        .readdirSync(positioningActionsDir)
        .filter((file) => file.endsWith('.action.json'));

      actionFiles.forEach((actionFile) => {
        const actionPath = path.join(positioningActionsDir, actionFile);
        const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));

        if (!action.prerequisites) {
          return;
        }

        // Collect all movement condition references
        const movementConditionRefs = action.prerequisites
          .map((prereq) => prereq.logic?.condition_ref)
          .filter((ref) => ref?.startsWith('movement:'));

        // Verify each movement condition reference exists
        movementConditionRefs.forEach((conditionRef) => {
          const conditionId = conditionRef.split(':')[1];
          const conditionPath = path.resolve(
            process.cwd(),
            `data/mods/movement/conditions/${conditionId}.condition.json`
          );

          const conditionExists = fs.existsSync(conditionPath);
          expect(conditionExists).toBe(
            true,
            `${actionFile} references non-existent condition: ${conditionRef}`
          );
        });
      });
    });
  });
});

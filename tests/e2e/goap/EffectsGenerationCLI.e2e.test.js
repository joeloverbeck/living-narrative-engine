/**
 * @file Effects Generation CLI End-to-End Test
 * @description Full end-to-end test for CLI commands: npm run generate:effects and npm run validate:effects
 *
 * Test Priority: CRITICAL (Priority 1)
 * Test Complexity: Medium
 *
 * This test validates the complete effects generation and validation CLI workflows,
 * ensuring that CLI argument parsing, file I/O, error reporting, and exit codes work correctly.
 *
 * Test Scenarios:
 * 1. Generate effects for entire mod - verify all actions updated
 * 2. Generate effects for single action - verify only that action updated
 * 3. Handle missing rules gracefully - verify warning logged
 * 4. Handle malformed rule operations - verify error logged
 * 5. Regenerate after rule modification - verify effects updated correctly
 * 6. Validate mod with all valid effects - verify success report
 * 7. Detect missing effects - verify warning in report
 * 8. Detect schema violations - verify error in report
 * 9. Generate validation report (JSON) - verify structure correct
 *
 * Success Criteria:
 * - CLI executes without errors
 * - Effects generated for all valid actions
 * - Schema validation passes
 * - Error messages clear and actionable
 * - File I/O operations work correctly
 * - Exit codes correct (0 for success, 1 for errors)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const projectRoot = process.cwd();

// Test timeout for CLI operations (30 seconds)
const CLI_TIMEOUT = 30000;

describe('Effects Generation CLI E2E', () => {
  const testModPath = path.join(projectRoot, 'data', 'mods', 'test_goap_cli');
  const testActionPath = path.join(testModPath, 'actions');
  const testRulePath = path.join(testModPath, 'rules');
  let originalPositioningAction = null;

  beforeAll(async () => {
    // Create test mod directory structure
    await fs.mkdir(testModPath, { recursive: true });
    await fs.mkdir(testActionPath, { recursive: true });
    await fs.mkdir(testRulePath, { recursive: true });

    // Create mod manifest
    const manifest = {
      id: 'test_goap_cli',
      version: '1.0.0',
      name: 'Test GOAP CLI Mod',
      description: 'Test mod for GOAP CLI e2e testing',
      dependencies: ['core'],
    };
    await fs.writeFile(
      path.join(testModPath, 'mod-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    // Create test action: simple_test_action
    const simpleAction = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test_goap_cli:simple_test_action',
      name: 'Simple Test Action',
      description: 'A simple action for testing effects generation',
      targets: 'none',
      template: 'perform simple test',
      visual: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
    };
    await fs.writeFile(
      path.join(testActionPath, 'simple_test_action.action.json'),
      JSON.stringify(simpleAction, null, 2),
      'utf8'
    );

    // Create corresponding rule: handle_simple_test_action
    const simpleRule = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'handle_simple_test_action',
      comment: 'Test rule with simple state-changing operations',
      event_type: 'core:attempt_action',
      condition: {
        '==': [{ var: 'event.payload.actionId' }, 'test_goap_cli:simple_test_action'],
      },
      actions: [
        {
          type: 'REMOVE_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:test_component_a',
          },
        },
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:test_component_b',
            value: { testValue: 42 },
          },
        },
      ],
    };
    await fs.writeFile(
      path.join(testRulePath, 'handle_simple_test_action.rule.json'),
      JSON.stringify(simpleRule, null, 2),
      'utf8'
    );

    // Create test action WITHOUT corresponding rule: action_without_rule
    const actionWithoutRule = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test_goap_cli:action_without_rule',
      name: 'Action Without Rule',
      description: 'An action without a corresponding rule',
      targets: 'none',
      template: 'perform action without rule',
      visual: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
    };
    await fs.writeFile(
      path.join(testActionPath, 'action_without_rule.action.json'),
      JSON.stringify(actionWithoutRule, null, 2),
      'utf8'
    );

    // Create test action with malformed rule: action_with_bad_rule
    const actionWithBadRule = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test_goap_cli:action_with_bad_rule',
      name: 'Action With Bad Rule',
      description: 'An action with a malformed rule',
      targets: 'none',
      template: 'perform action with bad rule',
      visual: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
    };
    await fs.writeFile(
      path.join(testActionPath, 'action_with_bad_rule.action.json'),
      JSON.stringify(actionWithBadRule, null, 2),
      'utf8'
    );

    // Create malformed rule (missing required parameters)
    const malformedRule = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'handle_action_with_bad_rule',
      comment: 'Malformed rule for testing error handling',
      event_type: 'core:attempt_action',
      condition: {
        '==': [{ var: 'event.payload.actionId' }, 'test_goap_cli:action_with_bad_rule'],
      },
      actions: [
        {
          type: 'ADD_COMPONENT',
          // Missing required 'parameters' field - malformed operation
          comment: 'This operation is malformed',
        },
      ],
    };
    await fs.writeFile(
      path.join(testRulePath, 'handle_action_with_bad_rule.rule.json'),
      JSON.stringify(malformedRule, null, 2),
      'utf8'
    );

    // Backup a real positioning action for regeneration test
    const positioningActionPath = path.join(
      projectRoot,
      'data/mods/positioning/actions/sit_down.action.json'
    );
    try {
      originalPositioningAction = await fs.readFile(positioningActionPath, 'utf8');
    } catch (err) {
      // If file doesn't exist, that's okay for the test
      originalPositioningAction = null;
    }
  }, CLI_TIMEOUT);

  afterAll(async () => {
    // Cleanup test mod directory
    try {
      await fs.rm(testModPath, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }

    // Restore original positioning action if it was backed up
    if (originalPositioningAction) {
      const positioningActionPath = path.join(
        projectRoot,
        'data/mods/positioning/actions/sit_down.action.json'
      );
      try {
        await fs.writeFile(positioningActionPath, originalPositioningAction, 'utf8');
      } catch (err) {
        // Ignore restore errors
      }
    }
  });

  describe('Effects Generation Workflow', () => {
    it('should generate effects for single action via CLI', async () => {
      // Execute CLI command for single action
      let stdout;
      let stderr;
      let exitCode;

      try {
        stdout = execSync(
          'npm run generate:effects -- --action=test_goap_cli:simple_test_action',
          {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: CLI_TIMEOUT,
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );
        exitCode = 0;
      } catch (error) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
        exitCode = error.status || 1;
      }

      // Verify CLI executed successfully
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Generating effects for action');
      expect(stdout).toContain('test_goap_cli:simple_test_action');

      // Read the action file to verify effects were written
      const actionContent = await fs.readFile(
        path.join(testActionPath, 'simple_test_action.action.json'),
        'utf8'
      );
      const action = JSON.parse(actionContent);

      // Verify planningEffects field was added
      expect(action.planningEffects).toBeDefined();
      expect(action.planningEffects.effects).toBeDefined();
      expect(Array.isArray(action.planningEffects.effects)).toBe(true);

      // Verify effects match rule operations
      expect(action.planningEffects.effects).toHaveLength(2);
      expect(action.planningEffects.effects[0]).toMatchObject({
        operation: 'REMOVE_COMPONENT',
        entity: 'actor',
        component: 'core:test_component_a',
      });
      expect(action.planningEffects.effects[1]).toMatchObject({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'core:test_component_b',
        data: { testValue: 42 },
      });

      // Verify cost was calculated
      expect(action.planningEffects.cost).toBeDefined();
      expect(typeof action.planningEffects.cost).toBe('number');
      expect(action.planningEffects.cost).toBeGreaterThan(0);
    }, CLI_TIMEOUT);

    it('should generate effects for entire mod via CLI', async () => {
      // First, remove planningEffects from simple_test_action to test mod-level generation
      const actionPath = path.join(testActionPath, 'simple_test_action.action.json');
      const actionContent = await fs.readFile(actionPath, 'utf8');
      const action = JSON.parse(actionContent);
      delete action.planningEffects;
      await fs.writeFile(actionPath, JSON.stringify(action, null, 2), 'utf8');

      // Execute CLI command for entire mod
      let stdout;
      let exitCode;

      try {
        stdout = execSync('npm run generate:effects -- --mod=test_goap_cli', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: CLI_TIMEOUT,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        exitCode = 0;
      } catch (error) {
        stdout = error.stdout || '';
        exitCode = error.status || 1;
      }

      // Verify CLI executed successfully
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Generating effects for mod');
      expect(stdout).toContain('test_goap_cli');

      // Read the action file to verify effects were written
      const updatedActionContent = await fs.readFile(actionPath, 'utf8');
      const updatedAction = JSON.parse(updatedActionContent);

      // Verify planningEffects field was added back
      expect(updatedAction.planningEffects).toBeDefined();
      expect(updatedAction.planningEffects.effects).toHaveLength(2);
    }, CLI_TIMEOUT);

    it('should handle missing rule gracefully', async () => {
      // Execute CLI command for action without rule
      let stdout;
      let stderr;
      let exitCode;

      try {
        stdout = execSync(
          'npm run generate:effects -- --action=test_goap_cli:action_without_rule',
          {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: CLI_TIMEOUT,
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );
        exitCode = 0;
      } catch (error) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
        exitCode = error.status || 1;
      }

      // CLI should complete but log warning
      expect(stdout || stderr).toMatch(/warn|no rule found|rule not found/i);

      // Action file should be unchanged (no planningEffects added)
      const actionContent = await fs.readFile(
        path.join(testActionPath, 'action_without_rule.action.json'),
        'utf8'
      );
      const action = JSON.parse(actionContent);

      // Verify planningEffects was not added
      expect(action.planningEffects).toBeUndefined();
    }, CLI_TIMEOUT);

    it('should handle malformed rule operations gracefully', async () => {
      // Execute CLI command for action with malformed rule
      let stdout;
      let stderr;
      let exitCode;

      try {
        stdout = execSync(
          'npm run generate:effects -- --action=test_goap_cli:action_with_bad_rule',
          {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: CLI_TIMEOUT,
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );
        exitCode = 0;
      } catch (error) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
        exitCode = error.status || 1;
      }

      // CLI should handle error gracefully (may exit with error code or log error)
      // Either way, output should mention the error
      expect(stdout || stderr).toMatch(/error|failed|invalid/i);

      // Action file should not have invalid planningEffects
      const actionContent = await fs.readFile(
        path.join(testActionPath, 'action_with_bad_rule.action.json'),
        'utf8'
      );
      const action = JSON.parse(actionContent);

      // Either no planningEffects or valid planningEffects (but not malformed data)
      if (action.planningEffects) {
        expect(action.planningEffects).toHaveProperty('effects');
        expect(Array.isArray(action.planningEffects.effects)).toBe(true);
      }
    }, CLI_TIMEOUT);

    it('should regenerate effects after rule modification', async () => {
      // First, generate effects for simple_test_action
      execSync('npm run generate:effects -- --action=test_goap_cli:simple_test_action', {
        cwd: projectRoot,
        timeout: CLI_TIMEOUT,
      });

      // Read current effects
      let actionContent = await fs.readFile(
        path.join(testActionPath, 'simple_test_action.action.json'),
        'utf8'
      );
      let action = JSON.parse(actionContent);
      const originalEffects = action.planningEffects;

      // Modify the rule (add another operation)
      const rulePath = path.join(testRulePath, 'handle_simple_test_action.rule.json');
      const ruleContent = await fs.readFile(rulePath, 'utf8');
      const rule = JSON.parse(ruleContent);

      rule.actions.push({
        type: 'MODIFY_COMPONENT',
        parameters: {
          entity_ref: 'actor',
          component_type: 'core:test_component_b',
          updates: {
            testValue: 100,
          },
        },
      });

      await fs.writeFile(rulePath, JSON.stringify(rule, null, 2), 'utf8');

      // Regenerate effects
      execSync('npm run generate:effects -- --action=test_goap_cli:simple_test_action', {
        cwd: projectRoot,
        timeout: CLI_TIMEOUT,
      });

      // Read updated effects
      actionContent = await fs.readFile(
        path.join(testActionPath, 'simple_test_action.action.json'),
        'utf8'
      );
      action = JSON.parse(actionContent);

      // Verify effects were updated
      expect(action.planningEffects.effects).toHaveLength(3);
      expect(action.planningEffects.effects[2]).toMatchObject({
        operation: 'MODIFY_COMPONENT',
        entity: 'actor',
        component: 'core:test_component_b',
        updates: {
          testValue: 100,
        },
      });

      // Verify old effects were replaced (not appended)
      expect(action.planningEffects.effects).not.toEqual(originalEffects.effects);
    }, CLI_TIMEOUT);
  });

  describe('Effects Validation Workflow', () => {
    it('should validate mod with all valid effects', async () => {
      // Ensure simple_test_action has valid effects
      execSync('npm run generate:effects -- --action=test_goap_cli:simple_test_action', {
        cwd: projectRoot,
        timeout: CLI_TIMEOUT,
      });

      // Execute validation CLI
      let stdout;
      let exitCode;

      try {
        stdout = execSync('npm run validate:effects -- --mod=test_goap_cli', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: CLI_TIMEOUT,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        exitCode = 0;
      } catch (error) {
        stdout = error.stdout || '';
        exitCode = error.status || 1;
      }

      // Verify validation passed for valid action
      expect(stdout).toContain('test_goap_cli:simple_test_action');
      expect(stdout).toMatch(/✓|valid|success/i);

      // Verify summary shows results
      expect(stdout).toMatch(/summary|total|valid/i);
    }, CLI_TIMEOUT);

    it('should detect missing effects', async () => {
      // Execute validation CLI (action_without_rule has no effects)
      let stdout;
      let stderr;
      let exitCode;

      try {
        stdout = execSync('npm run validate:effects -- --mod=test_goap_cli', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: CLI_TIMEOUT,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        exitCode = 0;
      } catch (error) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
        exitCode = error.status || 1;
      }

      // Verify warning for action without effects
      expect(stdout || stderr).toContain('action_without_rule');
      expect(stdout || stderr).toMatch(/warn|missing|no.*effects/i);
    }, CLI_TIMEOUT);

    it('should detect schema violations', async () => {
      // Create action with invalid planningEffects (violates schema)
      const invalidAction = {
        $schema: 'schema://living-narrative-engine/action.schema.json',
        id: 'test_goap_cli:action_with_invalid_effects',
        name: 'Action With Invalid Effects',
        description: 'An action with schema-violating effects',
        targets: 'none',
        template: 'perform action with invalid effects',
        visual: {
          backgroundColor: '#000000',
          textColor: '#ffffff',
        },
        planningEffects: {
          effects: [
            {
              // Invalid: missing required 'operation' field
              entity: 'actor',
              component: 'core:test',
            },
          ],
        },
      };

      await fs.writeFile(
        path.join(testActionPath, 'action_with_invalid_effects.action.json'),
        JSON.stringify(invalidAction, null, 2),
        'utf8'
      );

      // Execute validation CLI
      let stdout;
      let stderr;
      let exitCode;

      try {
        stdout = execSync('npm run validate:effects -- --mod=test_goap_cli', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: CLI_TIMEOUT,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        exitCode = 0;
      } catch (error) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
        exitCode = error.status || 1;
      }

      // Verify error for schema violation
      expect(stdout || stderr).toContain('action_with_invalid_effects');
      expect(stdout || stderr).toMatch(/error|invalid|schema/i);

      // Exit code should be 1 (errors detected)
      expect(exitCode).toBe(1);
    }, CLI_TIMEOUT);

    it('should generate validation report in JSON format', async () => {
      const reportPath = path.join(projectRoot, 'test-validation-report.json');

      // Execute validation with report flag
      try {
        execSync(`npm run validate:effects -- --mod=test_goap_cli --report=${reportPath}`, {
          cwd: projectRoot,
          timeout: CLI_TIMEOUT,
        });
      } catch (error) {
        // Validation may fail due to test errors, but report should still be generated
      }

      // Verify report file was created
      const reportExists = await fs
        .access(reportPath)
        .then(() => true)
        .catch(() => false);
      expect(reportExists).toBe(true);

      // Read and parse report
      const reportContent = await fs.readFile(reportPath, 'utf8');
      const report = JSON.parse(reportContent);

      // Verify report structure
      expect(report).toHaveProperty('summary');
      expect(report.summary).toHaveProperty('total');
      expect(report.summary).toHaveProperty('valid');
      expect(report.summary).toHaveProperty('warnings');
      expect(report.summary).toHaveProperty('errors');
      expect(report).toHaveProperty('actions');
      expect(Array.isArray(report.actions)).toBe(true);

      // Verify report contains our test actions
      const actionIds = report.actions.map((a) => a.actionId);
      expect(actionIds).toContain('test_goap_cli:simple_test_action');

      // Cleanup report file
      await fs.unlink(reportPath).catch(() => {});
    }, CLI_TIMEOUT);
  });

  describe('CLI Argument Parsing', () => {
    it('should support --mod argument', async () => {
      let stdout;

      try {
        stdout = execSync('npm run generate:effects -- --mod=test_goap_cli', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: CLI_TIMEOUT,
        });
      } catch (error) {
        stdout = error.stdout || '';
      }

      // Verify mod argument was recognized
      expect(stdout).toContain('test_goap_cli');
      expect(stdout).toMatch(/mod|generating/i);
    }, CLI_TIMEOUT);

    it('should support --action argument', async () => {
      let stdout;

      try {
        stdout = execSync(
          'npm run generate:effects -- --action=test_goap_cli:simple_test_action',
          {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: CLI_TIMEOUT,
          }
        );
      } catch (error) {
        stdout = error.stdout || '';
      }

      // Verify action argument was recognized
      expect(stdout).toContain('test_goap_cli:simple_test_action');
      expect(stdout).toMatch(/action|generating/i);
    }, CLI_TIMEOUT);

    it('should support --report argument for validation', async () => {
      const reportPath = path.join(projectRoot, 'test-cli-args-report.json');

      try {
        execSync(`npm run validate:effects -- --report=${reportPath}`, {
          cwd: projectRoot,
          timeout: CLI_TIMEOUT,
        });
      } catch (error) {
        // May fail validation, but report should be generated
      }

      // Verify report file was created
      const reportExists = await fs
        .access(reportPath)
        .then(() => true)
        .catch(() => false);
      expect(reportExists).toBe(true);

      // Cleanup
      await fs.unlink(reportPath).catch(() => {});
    }, CLI_TIMEOUT);
  });

  describe('Error Handling and Exit Codes', () => {
    it('should exit with code 0 on successful generation', async () => {
      let exitCode;

      try {
        execSync('npm run generate:effects -- --action=test_goap_cli:simple_test_action', {
          cwd: projectRoot,
          timeout: CLI_TIMEOUT,
        });
        exitCode = 0;
      } catch (error) {
        exitCode = error.status || 1;
      }

      expect(exitCode).toBe(0);
    }, CLI_TIMEOUT);

    it('should exit with code 1 on validation errors', async () => {
      let exitCode;

      try {
        execSync('npm run validate:effects -- --mod=test_goap_cli', {
          cwd: projectRoot,
          timeout: CLI_TIMEOUT,
        });
        exitCode = 0;
      } catch (error) {
        exitCode = error.status || 1;
      }

      // Should exit with 1 due to validation errors in test mod
      expect(exitCode).toBe(1);
    }, CLI_TIMEOUT);

    it('should provide clear error messages', async () => {
      let stdout;
      let stderr;

      try {
        stdout = execSync('npm run generate:effects -- --action=nonexistent:action', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: CLI_TIMEOUT,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
      }

      // Verify error message is present and descriptive
      const output = stdout + stderr;
      expect(output).toMatch(/error|not found|failed/i);
    }, CLI_TIMEOUT);
  });
});

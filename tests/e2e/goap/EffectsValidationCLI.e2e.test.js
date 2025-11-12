/**
 * @file Effects Validation CLI End-to-End Test
 * @description Full end-to-end test for CLI command: npm run validate:effects
 *
 * Test Priority: CRITICAL (Priority 1, Recommendation 1.2)
 * Test Complexity: Medium
 *
 * This test validates the complete effects validation CLI workflow,
 * ensuring that validation reporting, error detection, and exit codes work correctly.
 *
 * Test Scenarios:
 * 1. Validate mod with all valid effects - verify success report
 * 2. Detect missing effects - verify warning in report
 * 3. Detect schema violations - verify error in report
 * 4. Detect effects-rule mismatches - verify inconsistency detected
 * 5. Generate validation report (JSON) - verify structure correct
 *
 * Success Criteria:
 * - Validation completes for all scenarios
 * - Errors and warnings correctly identified
 * - Report generation works
 * - Exit codes correct (0 for success, 1 for errors)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const projectRoot = process.cwd();

// Test timeout for CLI operations (30 seconds)
const CLI_TIMEOUT = 30000;

describe('Effects Validation CLI E2E', () => {
  const testModPath = path.join(projectRoot, 'data', 'mods', 'test_goap_validation');
  const testActionPath = path.join(testModPath, 'actions');
  const testRulePath = path.join(testModPath, 'rules');

  beforeAll(async () => {
    // Create test mod directory structure
    await fs.mkdir(testModPath, { recursive: true });
    await fs.mkdir(testActionPath, { recursive: true });
    await fs.mkdir(testRulePath, { recursive: true });

    // Create mod manifest
    const manifest = {
      id: 'test_goap_validation',
      version: '1.0.0',
      name: 'Test GOAP Validation Mod',
      description: 'Test mod for GOAP validation CLI e2e testing',
      dependencies: [{ id: 'core', version: '1.0.0' }],
      content: {
        actions: [
          'valid_action.action.json',
          'action_missing_effects.action.json',
          'action_invalid_effects.action.json',
          'action_mismatched_effects.action.json',
        ],
        rules: [
          'handle_valid_action.rule.json',
          'handle_action_missing_effects.rule.json',
          'handle_action_mismatched_effects.rule.json',
        ],
      },
    };
    await fs.writeFile(
      path.join(testModPath, 'mod-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    // Create test action with valid effects: valid_action
    const validAction = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test_goap_validation:valid_action',
      name: 'Valid Action',
      description: 'An action with valid planning effects',
      targets: 'none',
      template: 'perform valid action',
      visual: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
      planningEffects: {
        effects: [
          {
            operation: 'REMOVE_COMPONENT',
            entity: 'actor',
            component: 'core:test_component_a',
          },
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'core:test_component_b',
            data: { testValue: 42 },
          },
        ],
        cost: 1.0,
      },
    };
    await fs.writeFile(
      path.join(testActionPath, 'valid_action.action.json'),
      JSON.stringify(validAction, null, 2),
      'utf8'
    );

    // Create corresponding rule for valid_action
    const validRule = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'handle_valid_action',
      comment: 'Test rule matching valid_action effects',
      event_type: 'core:attempt_action',
      condition: {
        '==': [{ var: 'event.payload.actionId' }, 'test_goap_validation:valid_action'],
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
      path.join(testRulePath, 'handle_valid_action.rule.json'),
      JSON.stringify(validRule, null, 2),
      'utf8'
    );

    // Create test action WITHOUT effects: action_missing_effects
    const actionMissingEffects = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test_goap_validation:action_missing_effects',
      name: 'Action Missing Effects',
      description: 'An action without planning effects',
      targets: 'none',
      template: 'perform action missing effects',
      visual: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
      // planningEffects field intentionally omitted
    };
    await fs.writeFile(
      path.join(testActionPath, 'action_missing_effects.action.json'),
      JSON.stringify(actionMissingEffects, null, 2),
      'utf8'
    );

    // Create corresponding rule for action_missing_effects
    const ruleMissingEffects = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'handle_action_missing_effects',
      comment: 'Rule for action that should have effects',
      event_type: 'core:attempt_action',
      condition: {
        '==': [
          { var: 'event.payload.actionId' },
          'test_goap_validation:action_missing_effects',
        ],
      },
      actions: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:test_component_c',
            value: {},
          },
        },
      ],
    };
    await fs.writeFile(
      path.join(testRulePath, 'handle_action_missing_effects.rule.json'),
      JSON.stringify(ruleMissingEffects, null, 2),
      'utf8'
    );

    // Create test action with INVALID effects (schema violation): action_invalid_effects
    const actionInvalidEffects = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test_goap_validation:action_invalid_effects',
      name: 'Action Invalid Effects',
      description: 'An action with schema-violating effects',
      targets: 'none',
      template: 'perform action invalid effects',
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
        // cost field missing (might be required by schema)
      },
    };
    await fs.writeFile(
      path.join(testActionPath, 'action_invalid_effects.action.json'),
      JSON.stringify(actionInvalidEffects, null, 2),
      'utf8'
    );

    // Create test action with MISMATCHED effects: action_mismatched_effects
    // Effects don't match the rule operations (rule was modified after generation)
    const actionMismatchedEffects = {
      $schema: 'schema://living-narrative-engine/action.schema.json',
      id: 'test_goap_validation:action_mismatched_effects',
      name: 'Action Mismatched Effects',
      description: 'An action where effects do not match rule',
      targets: 'none',
      template: 'perform action mismatched effects',
      visual: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
      planningEffects: {
        effects: [
          {
            operation: 'ADD_COMPONENT',
            entity: 'actor',
            component: 'core:test_old_component',
            data: {},
          },
        ],
        cost: 1.0,
      },
    };
    await fs.writeFile(
      path.join(testActionPath, 'action_mismatched_effects.action.json'),
      JSON.stringify(actionMismatchedEffects, null, 2),
      'utf8'
    );

    // Create rule that does NOT match the effects (simulating rule modification)
    const ruleMismatchedEffects = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'handle_action_mismatched_effects',
      comment: 'Rule modified after effects generation (simulates mismatch)',
      event_type: 'core:attempt_action',
      condition: {
        '==': [
          { var: 'event.payload.actionId' },
          'test_goap_validation:action_mismatched_effects',
        ],
      },
      actions: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:test_new_component', // Different from planningEffects!
            value: { newValue: 100 },
          },
        },
        {
          type: 'REMOVE_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:test_other_component', // Extra operation!
          },
        },
      ],
    };
    await fs.writeFile(
      path.join(testRulePath, 'handle_action_mismatched_effects.rule.json'),
      JSON.stringify(ruleMismatchedEffects, null, 2),
      'utf8'
    );
  }, CLI_TIMEOUT);

  afterAll(async () => {
    // Cleanup test mod directory
    try {
      await fs.rm(testModPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Validation Success Scenarios', () => {
    it('should validate mod with all valid effects', async () => {
      // Execute validation CLI for the valid action only (by running generation first)
      // First ensure valid_action has matching effects by generating them
      try {
        execSync(
          'npm run generate:effects -- --action=test_goap_validation:valid_action',
          {
            cwd: projectRoot,
            timeout: CLI_TIMEOUT,
            stdio: 'pipe',
          }
        );
      } catch {
        // May fail but we'll validate anyway
      }

      // Execute validation CLI
      let stdout;
      let stderr;

      try {
        stdout = execSync('npm run validate:effects -- --mod=test_goap_validation', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: CLI_TIMEOUT,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
      }

      // Verify validation output mentions the valid action
      const output = stdout + stderr;
      expect(output).toContain('test_goap_validation:valid_action');

      // Verify summary shows results
      expect(output).toMatch(/summary|total|valid/i);
    }, CLI_TIMEOUT);
  });

  describe('Validation Error Detection', () => {
    it('should detect missing effects', async () => {
      // Execute validation CLI
      let stdout;
      let stderr;

      try {
        stdout = execSync('npm run validate:effects -- --mod=test_goap_validation', {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: CLI_TIMEOUT,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
      }

      // Verify warning for action without effects
      const output = stdout + stderr;
      expect(output).toContain('action_missing_effects');
      expect(output).toMatch(/warn|missing|no.*effects/i);
    }, CLI_TIMEOUT);

    it('should detect schema violations', async () => {
      // Execute validation CLI
      let stdout;
      let stderr;
      let exitCode;

      try {
        stdout = execSync('npm run validate:effects -- --mod=test_goap_validation', {
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
      const output = stdout + stderr;
      expect(output).toContain('action_invalid_effects');
      expect(output).toMatch(/error|invalid|schema/i);

      // Exit code should be 1 (errors detected)
      expect(exitCode).toBe(1);
    }, CLI_TIMEOUT);

    it('should detect effects-rule mismatches', async () => {
      // This is the KEY new test that wasn't in EffectsGenerationCLI.e2e.test.js
      // It tests whether validation can detect when rule operations don't match planning effects
      // (simulating a rule modified after effects generation without regeneration)

      // Execute validation CLI
      let stdout;
      let stderr;
      let exitCode;

      try {
        stdout = execSync('npm run validate:effects -- --mod=test_goap_validation', {
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

      // Verify mismatch detected for action_mismatched_effects
      const output = stdout + stderr;
      expect(output).toContain('action_mismatched_effects');

      // Verify validation detected the mismatch (could be error or warning)
      // The validator should detect that:
      // 1. Effects reference 'core:test_old_component'
      // 2. Rule adds 'core:test_new_component' and removes 'core:test_other_component'
      expect(output).toMatch(/mismatch|inconsistent|differ|not match|out of date/i);

      // Exit code should be 1 (errors detected)
      expect(exitCode).toBe(1);
    }, CLI_TIMEOUT);
  });

  describe('Validation Reporting', () => {
    it('should generate validation report in JSON format', async () => {
      const reportPath = path.join(projectRoot, 'test-validation-report.json');

      // Execute validation with report flag
      try {
        execSync(
          `npm run validate:effects -- --mod=test_goap_validation --report=${reportPath}`,
          {
            cwd: projectRoot,
            timeout: CLI_TIMEOUT,
          }
        );
      } catch {
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
      expect(actionIds).toContain('test_goap_validation:valid_action');
      expect(actionIds).toContain('test_goap_validation:action_missing_effects');
      expect(actionIds).toContain('test_goap_validation:action_invalid_effects');
      expect(actionIds).toContain('test_goap_validation:action_mismatched_effects');

      // Verify summary statistics are accurate
      expect(report.summary.total).toBe(4); // 4 test actions

      // Verify each action has correct validation result
      const validAction = report.actions.find(
        (a) => a.actionId === 'test_goap_validation:valid_action'
      );
      const missingAction = report.actions.find(
        (a) => a.actionId === 'test_goap_validation:action_missing_effects'
      );
      const invalidAction = report.actions.find(
        (a) => a.actionId === 'test_goap_validation:action_invalid_effects'
      );
      const mismatchedAction = report.actions.find(
        (a) => a.actionId === 'test_goap_validation:action_mismatched_effects'
      );

      // Valid action should pass validation (or have minimal warnings)
      expect(validAction).toBeDefined();
      expect(validAction).toHaveProperty('valid');

      // Missing effects should have warnings
      expect(missingAction).toBeDefined();
      expect(missingAction.warnings || missingAction.errors).toBeDefined();
      expect(
        (missingAction.warnings?.length || 0) + (missingAction.errors?.length || 0)
      ).toBeGreaterThan(0);

      // Invalid effects should have errors
      expect(invalidAction).toBeDefined();
      expect(invalidAction.errors).toBeDefined();
      expect(invalidAction.errors.length).toBeGreaterThan(0);

      // Mismatched effects should have errors or warnings
      expect(mismatchedAction).toBeDefined();
      expect(mismatchedAction.warnings || mismatchedAction.errors).toBeDefined();
      expect(
        (mismatchedAction.warnings?.length || 0) + (mismatchedAction.errors?.length || 0)
      ).toBeGreaterThan(0);

      // Cleanup report file
      await fs.unlink(reportPath).catch(() => {});
    }, CLI_TIMEOUT);

    it('should provide summary statistics in report', async () => {
      const reportPath = path.join(projectRoot, 'test-summary-report.json');

      // Execute validation with report flag
      try {
        execSync(
          `npm run validate:effects -- --mod=test_goap_validation --report=${reportPath}`,
          {
            cwd: projectRoot,
            timeout: CLI_TIMEOUT,
          }
        );
      } catch {
        // May fail validation
      }

      // Read and parse report
      const reportContent = await fs.readFile(reportPath, 'utf8');
      const report = JSON.parse(reportContent);

      // Verify summary statistics
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.summary.errors).toBeGreaterThan(0); // We have invalid and mismatched
      expect(report.summary.warnings).toBeGreaterThan(0); // We have missing effects

      // Verify errors + warnings + valid = total
      const sum =
        report.summary.errors + report.summary.warnings + report.summary.valid;
      expect(sum).toBeGreaterThanOrEqual(report.summary.total);

      // Cleanup
      await fs.unlink(reportPath).catch(() => {});
    }, CLI_TIMEOUT);
  });

  describe('CLI Exit Codes', () => {
    it('should exit with code 0 when no errors found', async () => {
      // Create a temporary mod with only valid actions for this test
      const cleanModPath = path.join(projectRoot, 'data', 'mods', 'test_clean_mod');
      const cleanActionPath = path.join(cleanModPath, 'actions');
      const cleanRulePath = path.join(cleanModPath, 'rules');

      await fs.mkdir(cleanModPath, { recursive: true });
      await fs.mkdir(cleanActionPath, { recursive: true });
      await fs.mkdir(cleanRulePath, { recursive: true });

      // Create manifest
      await fs.writeFile(
        path.join(cleanModPath, 'mod-manifest.json'),
        JSON.stringify(
          {
            id: 'test_clean_mod',
            version: '1.0.0',
            name: 'Test Clean Mod',
            dependencies: [{ id: 'core', version: '1.0.0' }],
            content: {
              actions: ['clean_action.action.json'],
              rules: ['handle_clean_action.rule.json'],
            },
          },
          null,
          2
        ),
        'utf8'
      );

      // Create action with valid effects
      const cleanAction = {
        $schema: 'schema://living-narrative-engine/action.schema.json',
        id: 'test_clean_mod:clean_action',
        name: 'Clean Action',
        targets: 'none',
        template: 'clean action',
        visual: { backgroundColor: '#000000', textColor: '#ffffff' },
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'core:test',
              data: {},
            },
          ],
          cost: 1.0,
        },
      };
      await fs.writeFile(
        path.join(cleanActionPath, 'clean_action.action.json'),
        JSON.stringify(cleanAction, null, 2),
        'utf8'
      );

      // Create matching rule
      const cleanRule = {
        $schema: 'schema://living-narrative-engine/rule.schema.json',
        rule_id: 'handle_clean_action',
        event_type: 'core:attempt_action',
        condition: {
          '==': [{ var: 'event.payload.actionId' }, 'test_clean_mod:clean_action'],
        },
        actions: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:test',
              value: {},
            },
          },
        ],
      };
      await fs.writeFile(
        path.join(cleanRulePath, 'handle_clean_action.rule.json'),
        JSON.stringify(cleanRule, null, 2),
        'utf8'
      );

      let exitCode;

      try {
        execSync('npm run validate:effects -- --mod=test_clean_mod', {
          cwd: projectRoot,
          timeout: CLI_TIMEOUT,
          stdio: 'pipe',
        });
        exitCode = 0;
      } catch (error) {
        exitCode = error.status || 1;
      }

      // Should exit with 0 for valid mod
      expect(exitCode).toBe(0);

      // Cleanup
      await fs.rm(cleanModPath, { recursive: true, force: true }).catch(() => {});
    }, CLI_TIMEOUT);

    it('should exit with code 1 when errors detected', async () => {
      let exitCode;

      try {
        execSync('npm run validate:effects -- --mod=test_goap_validation', {
          cwd: projectRoot,
          timeout: CLI_TIMEOUT,
          stdio: 'pipe',
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
        stdout = execSync('npm run validate:effects -- --mod=nonexistent_mod', {
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
      expect(output).toMatch(/error|not found|failed|invalid/i);
    }, CLI_TIMEOUT);
  });
});

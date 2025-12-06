/**
 * @file Simplified integration tests for mod validation workflow
 * @description Tests the integration test bed enhancements and helper functions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

describe('Mod Validation Workflow - Simple Integration Tests', () => {
  let testBed;
  let tempDir;
  let modsDir;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    // Create temporary directory for test mods
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'simple-validation-test-')
    );
    modsDir = path.join(tempDir, 'data', 'mods');
    await fs.mkdir(modsDir, { recursive: true });
  });

  afterEach(async () => {
    await testBed.cleanup();
    // Clean up temporary directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  describe('Ecosystem Creation Helpers', () => {
    it('should create a basic mod ecosystem', async () => {
      // Arrange & Act: Create ecosystem
      const ecosystem = await createBasicModEcosystem(modsDir);

      // Assert: Files are created correctly
      expect(ecosystem.modCount).toBe(3);
      expect(ecosystem.modIds).toEqual(['core', 'positioning', 'affection']);

      // Verify core mod files
      const coreManifest = await fs.readFile(
        path.join(modsDir, 'core', 'mod-manifest.json'),
        'utf-8'
      );
      const coreData = JSON.parse(coreManifest);
      expect(coreData.id).toBe('core');
      expect(coreData.dependencies).toEqual([]);

      // Verify positioning mod files
      const positioningManifest = await fs.readFile(
        path.join(modsDir, 'positioning', 'mod-manifest.json'),
        'utf-8'
      );
      const positioningData = JSON.parse(positioningManifest);
      expect(positioningData.id).toBe('positioning');
      expect(positioningData.dependencies).toEqual([
        { id: 'core', version: '^1.0.0', required: true },
      ]);

      // Verify component files exist
      const actorComponent = await fs.readFile(
        path.join(modsDir, 'core', 'components', 'actor.component.json'),
        'utf-8'
      );
      const actorData = JSON.parse(actorComponent);
      expect(actorData.id).toBe('core:actor');
    });

    it('should create ecosystem with violations', async () => {
      // Arrange & Act: Create ecosystem with violations
      const ecosystem = await createEcosystemWithViolations(modsDir, {
        violationCount: 2,
      });

      // Assert: Violation files are created
      expect(ecosystem.modCount).toBe(3);

      // Check that violation files exist
      const violationFile1 = await fs.readFile(
        path.join(modsDir, 'positioning', 'actions', 'violation-0.action.json'),
        'utf-8'
      );
      const violation1 = JSON.parse(violationFile1);
      expect(violation1.required_components.actor).toContain(
        'unknown-mod-0:component'
      );

      const violationFile2 = await fs.readFile(
        path.join(modsDir, 'positioning', 'actions', 'violation-1.action.json'),
        'utf-8'
      );
      const violation2 = JSON.parse(violationFile2);
      expect(violation2.required_components.actor).toContain(
        'unknown-mod-1:component'
      );
    });

    it('should create large ecosystem for performance testing', async () => {
      // Arrange & Act: Create large ecosystem
      const ecosystem = await createLargeModEcosystem(modsDir, {
        modCount: 10,
        includeViolations: 2,
      });

      // Assert: Large ecosystem is created
      expect(ecosystem.modCount).toBe(10);
      expect(ecosystem.modIds).toHaveLength(10);
      expect(ecosystem.modIds[0]).toBe('core');
      expect(ecosystem.modIds[1]).toBe('mod-001');

      // Verify that some mods have violations
      const mod001Action = await fs.readFile(
        path.join(modsDir, 'mod-001', 'actions', 'mod-001-action.action.json'),
        'utf-8'
      );
      const action1 = JSON.parse(mod001Action);
      expect(action1.required_components.target).toContain(
        'violation-mod:missing-component'
      );
    });

    it('should create real positioning/intimacy violation scenario', async () => {
      // Arrange & Act: Create the actual violation scenario
      const scenario = await createRealPositioningIntimacyViolation(modsDir);

      // Assert: Scenario is created correctly
      expect(scenario.modCount).toBe(3);
      expect(scenario.modIds).toEqual(['core', 'positioning', 'affection']);

      // Verify the actual violation
      const turnAroundAction = await fs.readFile(
        path.join(modsDir, 'positioning', 'actions', 'turn_around.action.json'),
        'utf-8'
      );
      const turnAround = JSON.parse(turnAroundAction);
      expect(turnAround.forbidden_components.actor).toContain(
        'kissing:kissing'
      );

      // Verify positioning manifest doesn't declare intimacy dependency
      const positioningManifest = await fs.readFile(
        path.join(modsDir, 'positioning', 'mod-manifest.json'),
        'utf-8'
      );
      const positioning = JSON.parse(positioningManifest);
      const intimacyDep = positioning.dependencies.find(
        (dep) => dep.id === 'intimacy'
      );
      expect(intimacyDep).toBeUndefined();
    });

    it('should create production-like ecosystem', async () => {
      // Arrange & Act: Create complex ecosystem
      const ecosystem = await createProductionLikeEcosystem(modsDir, {
        coreMods: ['core', 'anatomy'],
        gameplayMods: ['positioning', 'intimacy'],
        includeRealViolations: true,
      });

      // Assert: Complex ecosystem is created
      expect(ecosystem.modCount).toBeGreaterThanOrEqual(4);
      expect(ecosystem.coreMods).toEqual(['core', 'anatomy']);
      expect(ecosystem.gameplayMods).toEqual(['positioning', 'intimacy']);

      // Verify anatomy mod exists
      const anatomyManifest = await fs.readFile(
        path.join(modsDir, 'anatomy', 'mod-manifest.json'),
        'utf-8'
      );
      const anatomy = JSON.parse(anatomyManifest);
      expect(anatomy.id).toBe('anatomy');

      // Verify violation is included
      const turnAroundPath = path.join(
        modsDir,
        'positioning',
        'actions',
        'turn_around.action.json'
      );
      const turnAroundExists = await fs
        .access(turnAroundPath)
        .then(() => true)
        .catch(() => false);
      expect(turnAroundExists).toBe(true);
    });
  });

  describe('File Modification Helpers', () => {
    it('should apply file changes to existing ecosystem', async () => {
      // Arrange: Create initial ecosystem
      await createBasicModEcosystem(modsDir);

      // Act: Apply file changes
      const changes = {
        'positioning/actions/new_action.action.json': {
          id: 'positioning:new_action',
          required_components: { actor: ['new_mod:component'] },
        },
        'core/components/new_component.component.json': {
          id: 'core:new_component',
          dataSchema: { type: 'object' },
        },
      };

      const changedFiles = await applyFileChanges(modsDir, changes);

      // Assert: Changes are applied correctly
      expect(changedFiles).toHaveLength(2);

      // Verify new files exist and have correct content
      const newAction = await fs.readFile(
        path.join(modsDir, 'positioning', 'actions', 'new_action.action.json'),
        'utf-8'
      );
      const actionData = JSON.parse(newAction);
      expect(actionData.id).toBe('positioning:new_action');

      const newComponent = await fs.readFile(
        path.join(
          modsDir,
          'core',
          'components',
          'new_component.component.json'
        ),
        'utf-8'
      );
      const componentData = JSON.parse(newComponent);
      expect(componentData.id).toBe('core:new_component');
    });

    it('should handle directory creation during file changes', async () => {
      // Arrange: Create minimal ecosystem
      await createBasicModEcosystem(modsDir);

      // Act: Apply changes that require new directories
      const changes = {
        'positioning/rules/new_rule.rule.json': {
          id: 'positioning:new_rule',
          conditions: [],
        },
        'core/scripts/setup.script.json': {
          id: 'core:setup',
          operations: [],
        },
      };

      await applyFileChanges(modsDir, changes);

      // Assert: Directories and files are created
      const ruleFile = await fs.readFile(
        path.join(modsDir, 'positioning', 'rules', 'new_rule.rule.json'),
        'utf-8'
      );
      const ruleData = JSON.parse(ruleFile);
      expect(ruleData.id).toBe('positioning:new_rule');

      const scriptFile = await fs.readFile(
        path.join(modsDir, 'core', 'scripts', 'setup.script.json'),
        'utf-8'
      );
      const scriptData = JSON.parse(scriptFile);
      expect(scriptData.id).toBe('core:setup');
    });
  });

  describe('Error Scenario Creation', () => {
    it('should create circular dependency scenario', async () => {
      // Arrange & Act: Create circular dependencies
      await createEcosystemWithCircularDependency(modsDir);

      // Assert: Circular dependencies are created
      const modAManifest = await fs.readFile(
        path.join(modsDir, 'mod-a', 'mod-manifest.json'),
        'utf-8'
      );
      const modA = JSON.parse(modAManifest);
      expect(modA.dependencies).toContainEqual({
        id: 'mod-b',
        version: '^1.0.0',
        required: true,
      });

      const modBManifest = await fs.readFile(
        path.join(modsDir, 'mod-b', 'mod-manifest.json'),
        'utf-8'
      );
      const modB = JSON.parse(modBManifest);
      expect(modB.dependencies).toContainEqual({
        id: 'mod-c',
        version: '^1.0.0',
        required: true,
      });

      const modCManifest = await fs.readFile(
        path.join(modsDir, 'mod-c', 'mod-manifest.json'),
        'utf-8'
      );
      const modC = JSON.parse(modCManifest);
      expect(modC.dependencies).toContainEqual({
        id: 'mod-a',
        version: '^1.0.0',
        required: true,
      });
    });

    it('should create corrupted files scenario', async () => {
      // Arrange: Create basic ecosystem
      await createBasicModEcosystem(modsDir);

      // Act: Create corrupted files
      const corruptedFiles = {
        'positioning/actions/broken.action.json': '{ invalid json content',
        'positioning/components/empty.component.json': '',
      };

      await applyFileChanges(modsDir, corruptedFiles);

      // Assert: Corrupted files exist
      const brokenContent = await fs.readFile(
        path.join(modsDir, 'positioning', 'actions', 'broken.action.json'),
        'utf-8'
      );
      expect(brokenContent).toBe('{ invalid json content');

      const emptyContent = await fs.readFile(
        path.join(modsDir, 'positioning', 'components', 'empty.component.json'),
        'utf-8'
      );
      expect(emptyContent).toBe('');
    });
  });

  describe('Temporary Directory Management', () => {
    it('should create and clean up temporary directories', async () => {
      // Arrange & Act: Create temporary directory
      const tempTestDir = await createTempDirectory('test-cleanup');

      // Verify directory exists
      const stats = await fs.stat(tempTestDir);
      expect(stats.isDirectory()).toBe(true);

      // Create some files in it
      await fs.writeFile(path.join(tempTestDir, 'test.txt'), 'test content');

      // Clean up
      await fs.rm(tempTestDir, { recursive: true, force: true });

      // Assert: Directory is cleaned up
      const exists = await fs
        .access(tempTestDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });
});

// Helper Functions (these would normally be in the enhanced IntegrationTestBed)

/**
 * Creates a basic mod ecosystem for testing
 *
 * @param {string} baseDir - Base directory for mods
 * @returns {Promise<object>} Created ecosystem metadata
 */
async function createBasicModEcosystem(baseDir) {
  const ecosystemSpec = {
    core: {
      manifest: {
        id: 'core',
        version: '1.0.0',
        name: 'Core Mod',
        dependencies: [],
      },
      files: {
        'components/actor.component.json': {
          id: 'core:actor',
          dataSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    },
    positioning: {
      manifest: {
        id: 'positioning',
        version: '1.0.0',
        name: 'Positioning Mod',
        dependencies: [{ id: 'core', version: '^1.0.0', required: true }],
      },
      files: {
        'components/closeness.component.json': {
          id: 'positioning:closeness',
          dataSchema: {
            type: 'object',
            properties: { distance: { type: 'string' } },
          },
        },
      },
    },
    affection: {
      manifest: {
        id: 'affection',
        version: '1.0.0',
        name: 'Intimacy Mod',
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
          { id: 'positioning', version: '^1.0.0', required: true },
        ],
      },
      files: {
        'components/kissing.component.json': {
          id: 'kissing:kissing',
          dataSchema: {
            type: 'object',
            properties: { intensity: { type: 'number' } },
          },
        },
      },
    },
  };

  return await createModEcosystem(baseDir, ecosystemSpec);
}

/**
 * Creates ecosystem with violations for testing
 *
 * @param {string} baseDir - Base directory for mods
 * @param {object} options - Options for violation creation
 * @returns {Promise<object>} Created ecosystem metadata
 */
async function createEcosystemWithViolations(baseDir, options = {}) {
  const { violationCount = 3 } = options;

  // Create basic ecosystem first
  const ecosystem = await createBasicModEcosystem(baseDir);

  // Add violation files to positioning mod
  for (let i = 0; i < violationCount; i++) {
    const actionPath = path.join(
      baseDir,
      'positioning',
      'actions',
      `violation-${i}.action.json`
    );
    await fs.mkdir(path.dirname(actionPath), { recursive: true });
    await fs.writeFile(
      actionPath,
      JSON.stringify(
        {
          id: `positioning:violation-${i}`,
          required_components: {
            actor: [`unknown-mod-${i}:component`], // Reference to non-existent mod
          },
        },
        null,
        2
      )
    );
  }

  return ecosystem;
}

/**
 * Creates large ecosystem for performance testing
 *
 * @param {string} baseDir - Base directory for mods
 * @param {object} options - Options for ecosystem creation
 * @returns {Promise<object>} Created ecosystem metadata
 */
async function createLargeModEcosystem(baseDir, options = {}) {
  const { modCount = 50, includeViolations = 5 } = options;

  const ecosystemSpec = {};

  // Create core mod
  ecosystemSpec.core = {
    manifest: { id: 'core', version: '1.0.0', name: 'Core', dependencies: [] },
    files: {
      'components/actor.component.json': {
        id: 'core:actor',
        dataSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
    },
  };

  // Generate additional mods
  for (let i = 1; i < modCount; i++) {
    const modId = `mod-${i.toString().padStart(3, '0')}`;
    const hasViolation = i <= includeViolations;

    const dependencies = [{ id: 'core', version: '^1.0.0', required: true }];

    ecosystemSpec[modId] = {
      manifest: { id: modId, version: '1.0.0', name: modId, dependencies },
      files: {
        [`components/${modId}-component.component.json`]: {
          id: `${modId}:component`,
          dataSchema: {
            type: 'object',
            properties: { value: { type: 'string' } },
          },
        },
        [`actions/${modId}-action.action.json`]: hasViolation
          ? {
              id: `${modId}:action`,
              required_components: {
                actor: [`${modId}:component`],
                target: [`violation-mod:missing-component`], // ← Violation
              },
            }
          : {
              id: `${modId}:action`,
              required_components: { actor: [`${modId}:component`] },
            },
      },
    };
  }

  return createModEcosystem(baseDir, ecosystemSpec);
}

/**
 * Creates the exact positioning/intimacy violation scenario
 *
 * @param {string} baseDir - Base directory for mods
 * @returns {Promise<object>} Created scenario metadata
 */
async function createRealPositioningIntimacyViolation(baseDir) {
  const violationScenario = {
    core: {
      manifest: {
        id: 'core',
        version: '1.0.0',
        name: 'Core',
        dependencies: [],
      },
      files: {
        'components/actor.component.json': {
          id: 'core:actor',
          dataSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    },
    positioning: {
      manifest: {
        id: 'positioning',
        version: '1.0.0',
        name: 'Positioning',
        dependencies: [{ id: 'core', version: '^1.0.0', required: true }], // Missing intimacy dependency
      },
      files: {
        'components/closeness.component.json': {
          id: 'positioning:closeness',
          dataSchema: {
            type: 'object',
            properties: {
              distance: { type: 'string' },
              partners: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        'actions/turn_around.action.json': {
          id: 'physical-control:turn_around',
          required_components: { actor: ['positioning:closeness'] },
          forbidden_components: { actor: ['kissing:kissing'] }, // ← The actual violation
          operations: [
            {
              type: 'set_component_value',
              target: 'actor',
              component: 'positioning:closeness',
              field: 'direction',
              value: 'opposite',
            },
          ],
        },
      },
    },
    affection: {
      manifest: {
        id: 'affection',
        version: '1.0.0',
        name: 'Intimacy',
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
          { id: 'positioning', version: '^1.0.0', required: true }, // Correctly declares positioning
        ],
      },
      files: {
        'components/kissing.component.json': {
          id: 'kissing:kissing',
          dataSchema: {
            type: 'object',
            properties: {
              intensity: { type: 'number', minimum: 0, maximum: 100 },
            },
          },
        },
      },
    },
  };

  return createModEcosystem(baseDir, violationScenario);
}

/**
 * Creates production-like ecosystem with realistic mod structure
 *
 * @param {string} baseDir - Base directory for mods
 * @param {object} options - Ecosystem options
 * @returns {Promise<object>} Created ecosystem metadata
 */
async function createProductionLikeEcosystem(baseDir, options = {}) {
  const {
    coreMods = ['core', 'anatomy'],
    gameplayMods = ['positioning', 'intimacy'],
    includeRealViolations = false,
  } = options;

  const productionSpec = {};

  // Core mods (foundation)
  if (coreMods.includes('core')) {
    productionSpec.core = {
      manifest: {
        id: 'core',
        version: '1.0.0',
        name: 'Core',
        dependencies: [],
      },
      files: {
        'components/actor.component.json': {
          id: 'core:actor',
          dataSchema: { type: 'object' },
        },
        'components/position.component.json': {
          id: 'core:position',
          dataSchema: { type: 'object' },
        },
      },
    };
  }

  if (coreMods.includes('anatomy')) {
    productionSpec.anatomy = {
      manifest: {
        id: 'anatomy',
        version: '1.0.0',
        name: 'Anatomy',
        dependencies: [{ id: 'core', version: '^1.0.0', required: true }],
      },
      files: {
        'components/body.component.json': {
          id: 'anatomy:body',
          dataSchema: { type: 'object' },
        },
        'blueprints/human.blueprint.json': {
          id: 'anatomy:human',
          parts: ['anatomy:body'],
        },
      },
    };
  }

  // Gameplay mods (level 2)
  if (gameplayMods.includes('positioning')) {
    productionSpec.positioning = {
      manifest: {
        id: 'positioning',
        version: '1.0.0',
        name: 'Positioning',
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
          ...(coreMods.includes('anatomy')
            ? [{ id: 'anatomy', version: '^1.0.0', required: true }]
            : []),
        ],
      },
      files: {
        'components/closeness.component.json': {
          id: 'positioning:closeness',
          dataSchema: { type: 'object' },
        },
        'actions/move_to.action.json': {
          id: 'positioning:move_to',
          required_components: { actor: ['positioning:closeness'] },
        },
      },
    };

    // Add violation if requested
    if (includeRealViolations) {
      productionSpec.positioning.files['actions/turn_around.action.json'] = {
        id: 'physical-control:turn_around',
        forbidden_components: { actor: ['kissing:kissing'] }, // ← Violation
      };
    }
  }

  if (gameplayMods.includes('intimacy')) {
    productionSpec.intimacy = {
      manifest: {
        id: 'affection',
        version: '1.0.0',
        name: 'Intimacy',
        dependencies: [
          { id: 'core', version: '^1.0.0', required: true },
          ...(coreMods.includes('anatomy')
            ? [{ id: 'anatomy', version: '^1.0.0', required: true }]
            : []),
          ...(gameplayMods.includes('positioning')
            ? [{ id: 'positioning', version: '^1.0.0', required: true }]
            : []),
        ],
      },
      files: {
        'components/kissing.component.json': {
          id: 'kissing:kissing',
          dataSchema: { type: 'object' },
        },
      },
    };
  }

  const result = await createModEcosystem(baseDir, productionSpec);

  return {
    ...result,
    coreMods: coreMods.filter((id) => productionSpec[id]),
    gameplayMods: gameplayMods.filter((id) => productionSpec[id]),
  };
}

/**
 * Creates ecosystem with circular dependencies
 *
 * @param {string} baseDir - Base directory for mods
 * @returns {Promise<object>} Created ecosystem metadata
 */
async function createEcosystemWithCircularDependency(baseDir) {
  const ecosystemSpec = {
    'mod-a': {
      manifest: {
        id: 'mod-a',
        version: '1.0.0',
        name: 'Mod A',
        dependencies: [{ id: 'mod-b', version: '^1.0.0', required: true }],
      },
      files: {},
    },
    'mod-b': {
      manifest: {
        id: 'mod-b',
        version: '1.0.0',
        name: 'Mod B',
        dependencies: [{ id: 'mod-c', version: '^1.0.0', required: true }],
      },
      files: {},
    },
    'mod-c': {
      manifest: {
        id: 'mod-c',
        version: '1.0.0',
        name: 'Mod C',
        dependencies: [{ id: 'mod-a', version: '^1.0.0', required: true }],
      },
      files: {},
    },
  };

  return createModEcosystem(baseDir, ecosystemSpec);
}

/**
 * Creates a mod ecosystem with specified structure
 *
 * @param {string} baseDir - Base directory for mods
 * @param {object} ecosystemSpec - Specification for ecosystem structure
 * @returns {Promise<object>} Created ecosystem metadata
 */
async function createModEcosystem(baseDir, ecosystemSpec) {
  const createdMods = [];

  for (const [modId, modSpec] of Object.entries(ecosystemSpec)) {
    const modDir = path.join(baseDir, modId);
    await fs.mkdir(modDir, { recursive: true });

    // Create manifest
    const manifestPath = path.join(modDir, 'mod-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(modSpec.manifest, null, 2));

    // Create files
    for (const [filePath, content] of Object.entries(modSpec.files || {})) {
      const fullFilePath = path.join(modDir, filePath);
      const fileDir = path.dirname(fullFilePath);

      await fs.mkdir(fileDir, { recursive: true });

      const fileContent =
        typeof content === 'string'
          ? content
          : JSON.stringify(content, null, 2);

      await fs.writeFile(fullFilePath, fileContent);
    }

    createdMods.push(modId);
  }

  return {
    modsDir: baseDir,
    modCount: createdMods.length,
    modIds: createdMods,
  };
}

/**
 * Applies file changes to existing ecosystem
 *
 * @param {string} baseDir - Base directory for mods
 * @param {object} changes - File changes to apply
 * @returns {Promise<Array>} Array of changed file paths
 */
async function applyFileChanges(baseDir, changes) {
  const changedFiles = [];

  for (const [relativePath, content] of Object.entries(changes)) {
    const fullPath = path.join(baseDir, relativePath);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });

    const fileContent =
      typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    await fs.writeFile(fullPath, fileContent);
    changedFiles.push(fullPath);
  }

  return changedFiles;
}

/**
 * Creates a temporary directory for testing
 *
 * @param {string} prefix - Prefix for the temporary directory name
 * @returns {Promise<string>} Path to the created temporary directory
 */
async function createTempDirectory(prefix) {
  return await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

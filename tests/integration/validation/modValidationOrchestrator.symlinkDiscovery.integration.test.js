/**
 * @file Integration tests for symlink discovery in ModValidationOrchestrator
 * @description Tests that symlinked mod directories are discovered and validated
 * correctly, matching the behavior of updateManifest.js and mod-manager.html
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  jest,
} from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { ModValidationOrchestrator } from '../../../cli/validation/modValidationOrchestrator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('ModValidationOrchestrator symlink discovery integration', () => {
  let tempDir;
  let modsDir;
  let symlinkTarget;
  let originalCwd;

  beforeAll(async () => {
    // Create a temporary directory structure for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mod-validation-test-'));
    modsDir = path.join(tempDir, 'data', 'mods');
    symlinkTarget = path.join(tempDir, 'external-mods');

    // Create the mods directory structure
    await fs.mkdir(modsDir, { recursive: true });
    await fs.mkdir(symlinkTarget, { recursive: true });

    // Store original cwd for restoration
    originalCwd = process.cwd();
  });

  afterAll(async () => {
    // Restore original cwd
    process.chdir(originalCwd);

    // Clean up temporary directories
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Change to temp directory so mod discovery uses our test structure
    process.chdir(tempDir);
  });

  afterEach(async () => {
    // Clean up mods directory contents between tests
    const entries = await fs.readdir(modsDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(modsDir, entry.name);
      await fs.rm(fullPath, { recursive: true, force: true });
    }

    // Clean up external mods directory contents
    const externalEntries = await fs.readdir(symlinkTarget, {
      withFileTypes: true,
    });
    for (const entry of externalEntries) {
      const fullPath = path.join(symlinkTarget, entry.name);
      await fs.rm(fullPath, { recursive: true, force: true });
    }
  });

  const createMod = async (modPath, manifest) => {
    await fs.mkdir(modPath, { recursive: true });
    await fs.writeFile(
      path.join(modPath, 'mod-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
  };

  const createMinimalDependencies = () => {
    const logger = createMockLogger();
    return {
      logger,
      modDependencyValidator: {
        validate: jest.fn(),
      },
      modCrossReferenceValidator: {
        validateModReferences: jest.fn(async () => ({
          hasViolations: false,
          violations: [],
        })),
        validateAllModReferences: jest.fn(async () => new Map()),
      },
      modLoadOrderResolver: {
        resolve: jest.fn((ids) => [...ids]),
      },
      modManifestLoader: {
        loadRequestedManifests: jest.fn(async (ids) =>
          new Map(ids.map((id) => [id, { id, dependencies: [] }]))
        ),
        loadModManifests: jest.fn(),
      },
      pathResolver: {
        resolveModManifestPath: jest.fn(),
        resolveModPath: jest.fn((id) => path.join(modsDir, id)),
      },
      configuration: {
        getContentTypeSchemaId: jest.fn(),
      },
      fileExistenceValidator: {
        validateAllMods: jest.fn(async () => new Map()),
        validateAllModsUnregistered: jest.fn(async () => new Map()),
      },
    };
  };

  it('discovers symlinked mod directories alongside regular directories', async () => {
    // Create a regular mod directory
    await createMod(path.join(modsDir, 'regular_mod'), {
      id: 'regular_mod',
      name: 'Regular Mod',
      version: '1.0.0',
      dependencies: [],
    });

    // Create an external mod and symlink it
    const externalModPath = path.join(symlinkTarget, 'p_symlinked_mod');
    await createMod(externalModPath, {
      id: 'p_symlinked_mod',
      name: 'Symlinked Mod',
      version: '1.0.0',
      dependencies: [],
    });

    // Create symlink in mods directory pointing to external mod
    const symlinkPath = path.join(modsDir, 'p_symlinked_mod');
    await fs.symlink(externalModPath, symlinkPath);

    // Verify symlink was created
    const stat = await fs.lstat(symlinkPath);
    expect(stat.isSymbolicLink()).toBe(true);

    // Create orchestrator and run discovery
    const deps = createMinimalDependencies();
    const orchestrator = new ModValidationOrchestrator(deps);

    const result = await orchestrator.validateEcosystem();

    expect(result.isValid).toBe(true);
    // Verify both mods were discovered
    expect(
      deps.modManifestLoader.loadRequestedManifests
    ).toHaveBeenCalledWith(
      expect.arrayContaining(['regular_mod', 'p_symlinked_mod'])
    );
  });

  it('discovers multiple symlinked mod directories', async () => {
    // Create multiple external mods and symlink them
    const symlinkNames = [
      'p_erotica_duchess',
      'p_erotica_irun',
      'p_erotica_main',
    ];

    for (const name of symlinkNames) {
      const externalModPath = path.join(symlinkTarget, name);
      await createMod(externalModPath, {
        id: name,
        name: `Mod ${name}`,
        version: '1.0.0',
        dependencies: [],
      });

      const symlinkPath = path.join(modsDir, name);
      await fs.symlink(externalModPath, symlinkPath);
    }

    const deps = createMinimalDependencies();
    const orchestrator = new ModValidationOrchestrator(deps);

    const result = await orchestrator.validateEcosystem();

    expect(result.isValid).toBe(true);
    expect(
      deps.modManifestLoader.loadRequestedManifests
    ).toHaveBeenCalledWith(expect.arrayContaining(symlinkNames));
  });

  it('skips broken symlinks gracefully', async () => {
    // Create a working mod
    await createMod(path.join(modsDir, 'working_mod'), {
      id: 'working_mod',
      name: 'Working Mod',
      version: '1.0.0',
      dependencies: [],
    });

    // Create a broken symlink (points to non-existent target)
    const brokenSymlinkPath = path.join(modsDir, 'broken_symlink');
    await fs.symlink('/non/existent/path', brokenSymlinkPath);

    const deps = createMinimalDependencies();
    const orchestrator = new ModValidationOrchestrator(deps);

    const result = await orchestrator.validateEcosystem();

    expect(result.isValid).toBe(true);
    // Should only include the working mod, not the broken symlink
    expect(
      deps.modManifestLoader.loadRequestedManifests
    ).toHaveBeenCalledWith(['working_mod']);
  });

  it('handles symlinked directory without manifest', async () => {
    // Create a working mod
    await createMod(path.join(modsDir, 'valid_mod'), {
      id: 'valid_mod',
      name: 'Valid Mod',
      version: '1.0.0',
      dependencies: [],
    });

    // Create external directory without manifest and symlink it
    const externalDirPath = path.join(symlinkTarget, 'no_manifest_dir');
    await fs.mkdir(externalDirPath, { recursive: true });
    // Don't create mod-manifest.json

    const symlinkPath = path.join(modsDir, 'no_manifest_dir');
    await fs.symlink(externalDirPath, symlinkPath);

    const deps = createMinimalDependencies();
    const orchestrator = new ModValidationOrchestrator(deps);

    const result = await orchestrator.validateEcosystem();

    expect(result.isValid).toBe(true);
    // Should only include the valid mod
    expect(
      deps.modManifestLoader.loadRequestedManifests
    ).toHaveBeenCalledWith(['valid_mod']);
  });

  it('respects excluded directories for symlinks', async () => {
    // Create a regular mod
    await createMod(path.join(modsDir, 'my_mod'), {
      id: 'my_mod',
      name: 'My Mod',
      version: '1.0.0',
      dependencies: [],
    });

    // Create external 'examples' directory and symlink it
    const externalExamplesPath = path.join(symlinkTarget, 'examples');
    await createMod(externalExamplesPath, {
      id: 'examples',
      name: 'Examples',
      version: '1.0.0',
      dependencies: [],
    });

    const symlinkPath = path.join(modsDir, 'examples');
    await fs.symlink(externalExamplesPath, symlinkPath);

    const deps = createMinimalDependencies();
    const orchestrator = new ModValidationOrchestrator(deps);

    const result = await orchestrator.validateEcosystem();

    expect(result.isValid).toBe(true);
    // Should only include my_mod, not examples
    expect(
      deps.modManifestLoader.loadRequestedManifests
    ).toHaveBeenCalledWith(['my_mod']);
    expect(deps.logger.debug).toHaveBeenCalledWith(
      'Skipping excluded directory: examples'
    );
  });
});

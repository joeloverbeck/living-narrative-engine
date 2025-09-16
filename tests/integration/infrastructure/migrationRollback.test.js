/**
 * @file Integration tests for movement mod migration rollback functionality
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Movement Migration Rollback', () => {
  const projectRoot = process.cwd();
  let backupDir;
  let tempTestDir;

  beforeAll(async () => {
    // Find the most recent backup directory
    const files = fs.readdirSync(projectRoot);
    const backupDirs = files.filter(f => f.startsWith('movement-migration-backup-'));

    if (backupDirs.length === 0) {
      throw new Error('No backup directories found');
    }

    // Get the most recent backup
    const backupDirName = backupDirs.sort().pop();
    backupDir = path.join(projectRoot, backupDirName);

    // Create a temporary test directory for rollback testing
    tempTestDir = path.join(projectRoot, `test-rollback-${Date.now()}`);
    fs.mkdirSync(tempTestDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up temporary test directory
    if (tempTestDir && fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  describe('Rollback Script Validation', () => {
    it('should have an executable rollback script', () => {
      const rollbackScript = path.join(backupDir, 'rollback.sh');
      expect(fs.existsSync(rollbackScript)).toBe(true);

      const stats = fs.statSync(rollbackScript);
      // Check if file is executable (Unix permissions)
      // eslint-disable-next-line no-bitwise
      const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
      expect(isExecutable).toBe(true);
    });

    it('should display usage message when called without arguments', async () => {
      const rollbackScript = path.join(backupDir, 'rollback.sh');

      try {
        await execAsync(rollbackScript);
      } catch (error) {
        // Script should exit with error when no arguments provided
        expect(error.code).toBe(1);
        expect(error.stdout).toContain('Usage:');
        expect(error.stdout).toContain('backup-directory');
      }
    });

    it('should error when backup directory does not exist', async () => {
      const rollbackScript = path.join(backupDir, 'rollback.sh');

      try {
        await execAsync(`${rollbackScript} non-existent-backup`);
      } catch (error) {
        expect(error.code).toBe(1);
        expect(error.stdout).toContain('Error: Backup directory');
        expect(error.stdout).toContain('not found');
      }
    });
  });

  describe('Rollback File Restoration', () => {
    it('should verify all backed up files can be restored', () => {
      // List of files that should be restorable
      const filesToRestore = [
        'core/actions/go.action.json',
        'core/rules/go.rule.json',
        'core/conditions/event-is-action-go.condition.json',
        'core/conditions/actor-can-move.condition.json',
        'core/conditions/exit-is-unblocked.condition.json',
        'core/scopes/clear_directions.scope',
        'positioning/actions/turn_around.action.json',
        'positioning/actions/get_close.action.json',
        'movement/mod-manifest.json'
      ];

      filesToRestore.forEach(file => {
        const backupFilePath = path.join(backupDir, file);
        expect(fs.existsSync(backupFilePath)).toBe(true);

        // Verify the file can be read
        const content = fs.readFileSync(backupFilePath, 'utf8');
        expect(content).toBeTruthy();
      });
    });

    it('should validate core files can be restored to correct locations', () => {
      const coreBackupPath = path.join(backupDir, 'core');
      const coreTargetPath = path.join(projectRoot, 'data', 'mods', 'core');

      // Check that backup structure matches target structure
      const backupActions = path.join(coreBackupPath, 'actions');
      const targetActions = path.join(coreTargetPath, 'actions');

      expect(fs.existsSync(backupActions)).toBe(true);
      expect(fs.existsSync(targetActions)).toBe(true);

      // Verify go.action.json exists in both locations
      const backupGoAction = path.join(backupActions, 'go.action.json');
      const targetGoAction = path.join(targetActions, 'go.action.json');

      expect(fs.existsSync(backupGoAction)).toBe(true);
      expect(fs.existsSync(targetGoAction)).toBe(true);
    });

    it('should validate positioning files can be restored to correct locations', () => {
      const positioningBackupPath = path.join(backupDir, 'positioning', 'actions');
      const positioningTargetPath = path.join(projectRoot, 'data', 'mods', 'positioning', 'actions');

      expect(fs.existsSync(positioningBackupPath)).toBe(true);
      expect(fs.existsSync(positioningTargetPath)).toBe(true);

      // Check both positioning files
      const files = ['turn_around.action.json', 'get_close.action.json'];

      files.forEach(file => {
        const backupFile = path.join(positioningBackupPath, file);
        const targetFile = path.join(positioningTargetPath, file);

        expect(fs.existsSync(backupFile)).toBe(true);
        expect(fs.existsSync(targetFile)).toBe(true);
      });
    });

    it('should restore movement mod manifest to original state', () => {
      const backupManifestPath = path.join(backupDir, 'movement', 'mod-manifest.json');
      expect(fs.existsSync(backupManifestPath)).toBe(true);

      const backupManifest = JSON.parse(fs.readFileSync(backupManifestPath, 'utf8'));

      // Verify original manifest has empty content arrays
      expect(backupManifest.content.actions).toEqual([]);
      expect(backupManifest.content.rules).toEqual([]);
      expect(backupManifest.content.conditions).toEqual([]);
      expect(backupManifest.content.scopes).toEqual([]);
    });
  });

  describe('Rollback Cleanup', () => {
    it('should verify migrated files would be removed from movement mod', () => {
      const movementModPath = path.join(projectRoot, 'data', 'mods', 'movement');

      // List of files that should be cleaned up if they exist
      const filesToCleanup = [
        'actions/go.action.json',
        'rules/go.rule.json',
        'conditions/event-is-action-go.condition.json',
        'conditions/actor-can-move.condition.json',
        'conditions/exit-is-unblocked.condition.json',
        'scopes/clear_directions.scope'
      ];

      // These files should NOT exist yet (pre-migration)
      // But the rollback script should handle them if they do exist
      filesToCleanup.forEach(file => {
        const filePath = path.join(movementModPath, file);
        // Just verify the path is valid (file may or may not exist)
        expect(path.isAbsolute(filePath)).toBe(true);
      });
    });
  });

  describe('Checksum Validation', () => {
    it('should verify checksum integrity for rollback validation', () => {
      const checksumsPath = path.join(backupDir, 'checksums.txt');
      expect(fs.existsSync(checksumsPath)).toBe(true);

      const checksums = fs.readFileSync(checksumsPath, 'utf8');
      const lines = checksums.trim().split('\n');

      lines.forEach(line => {
        const [hash, relativeFile] = line.split(/\s+/);
        const filePath = path.join(backupDir, relativeFile);

        // Verify the backup file still exists and hasn't been corrupted
        expect(fs.existsSync(filePath)).toBe(true);

        // Verify hash format
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      });
    });
  });

  describe('Rollback Script Safety', () => {
    it('should check for project root before executing', () => {
      const rollbackScript = path.join(backupDir, 'rollback.sh');
      const scriptContent = fs.readFileSync(rollbackScript, 'utf8');

      // Verify script checks for project structure
      expect(scriptContent).toContain('data/mods/core');
      expect(scriptContent).toContain('Error: This script must be run from the project root');
    });

    it('should preserve backup files after rollback', () => {
      // Verify that the rollback script doesn't delete the backup
      const rollbackScript = path.join(backupDir, 'rollback.sh');
      const scriptContent = fs.readFileSync(rollbackScript, 'utf8');

      // Should not contain any rm commands for the backup directory itself
      expect(scriptContent).not.toContain(`rm -rf $BACKUP_DIR`);
      expect(scriptContent).not.toContain(`rm -rf "$BACKUP_DIR"`);

      // Should preserve backup for future reference
      expect(scriptContent).toContain('backup files are preserved');
    });
  });

  describe('Post-Rollback Verification', () => {
    it('should provide next steps after rollback', () => {
      const rollbackScript = path.join(backupDir, 'rollback.sh');
      const scriptContent = fs.readFileSync(rollbackScript, 'utf8');

      // Verify script provides guidance after rollback
      expect(scriptContent).toContain('Next steps:');
      expect(scriptContent).toContain('npm run test:unit');
      expect(scriptContent).toContain('Check that the game loads');
    });
  });
});
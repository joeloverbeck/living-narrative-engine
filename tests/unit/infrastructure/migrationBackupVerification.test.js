/**
 * @file Tests for movement mod migration backup verification
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

describe('Movement Migration Backup Verification', () => {
  const projectRoot = process.cwd();
  let backupDir;

  beforeAll(() => {
    // Find the most recent backup directory
    const files = fs.readdirSync(projectRoot);
    const backupDirs = files.filter(f => f.startsWith('movement-migration-backup-'));

    if (backupDirs.length === 0) {
      throw new Error('No backup directories found');
    }

    // Get the most recent backup (they're timestamped so alphabetical sort works)
    backupDir = path.join(projectRoot, backupDirs.sort().pop());
  });

  describe('Backup Directory Structure', () => {
    it('should have the correct directory structure', () => {
      expect(fs.existsSync(backupDir)).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'core'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'core', 'actions'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'core', 'rules'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'core', 'conditions'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'core', 'scopes'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'positioning'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'positioning', 'actions'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'movement'))).toBe(true);
    });
  });

  describe('Core Files Backup', () => {
    it('should have all required core files in backup directory', () => {
      const coreFiles = [
        'core/actions/go.action.json',
        'core/rules/go.rule.json',
        'core/conditions/event-is-action-go.condition.json',
        'core/conditions/actor-can-move.condition.json',
        'core/conditions/exit-is-unblocked.condition.json',
        'core/scopes/clear_directions.scope'
      ];

      coreFiles.forEach(file => {
        const filePath = path.join(backupDir, file);
        expect(fs.existsSync(filePath)).toBe(true);

        // Verify file is not empty
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);
      });
    });
  });

  describe('Positioning Files Backup', () => {
    it('should have all required positioning files in backup directory', () => {
      const positioningFiles = [
        'positioning/actions/turn_around.action.json',
        'positioning/actions/get_close.action.json'
      ];

      positioningFiles.forEach(file => {
        const filePath = path.join(backupDir, file);
        expect(fs.existsSync(filePath)).toBe(true);

        // Verify file is not empty
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);
      });
    });
  });

  describe('Movement Mod Backup', () => {
    it('should have movement mod manifest in backup directory', () => {
      const manifestPath = path.join(backupDir, 'movement', 'mod-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      // Verify file is valid JSON
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      expect(() => JSON.parse(manifestContent)).not.toThrow();

      const manifest = JSON.parse(manifestContent);
      expect(manifest.id).toBe('movement');
    });
  });

  describe('Checksum Verification', () => {
    it('should have valid checksums for all backed up files', () => {
      const checksumsPath = path.join(backupDir, 'checksums.txt');
      expect(fs.existsSync(checksumsPath)).toBe(true);

      const checksums = fs.readFileSync(checksumsPath, 'utf8');
      const lines = checksums.trim().split('\n');

      // Should have 9 files with checksums
      expect(lines.length).toBe(9);

      lines.forEach(line => {
        const [hash, relativeFile] = line.split(/\s+/);
        const filePath = path.join(backupDir, relativeFile);

        // Verify file exists
        expect(fs.existsSync(filePath)).toBe(true);

        // Verify checksum format (SHA256 is 64 hex characters)
        expect(hash).toMatch(/^[a-f0-9]{64}$/);

        // Calculate actual checksum and compare
        const fileContent = fs.readFileSync(filePath);
        const actualHash = crypto.createHash('sha256').update(fileContent).digest('hex');
        expect(actualHash).toBe(hash);
      });
    });
  });

  describe('Backup Documentation', () => {
    it('should have complete backup documentation', () => {
      const readmePath = path.join(backupDir, 'README.txt');
      expect(fs.existsSync(readmePath)).toBe(true);

      const readme = fs.readFileSync(readmePath, 'utf8');

      // Check for required sections
      expect(readme).toContain('Movement Mod Migration Backup');
      expect(readme).toContain('Backup Date:');
      expect(readme).toContain('Purpose:');
      expect(readme).toContain('Files Backed Up:');
      expect(readme).toContain('Core Mod:');
      expect(readme).toContain('Positioning Mod:');
      expect(readme).toContain('Movement Mod:');
      expect(readme).toContain('Rollback Instructions:');
    });

    it('should have dependency map JSON', () => {
      const depMapPath = path.join(backupDir, 'dependency-map.json');
      expect(fs.existsSync(depMapPath)).toBe(true);

      const depMapContent = fs.readFileSync(depMapPath, 'utf8');
      expect(() => JSON.parse(depMapContent)).not.toThrow();

      const depMap = JSON.parse(depMapContent);
      expect(depMap.dependencies).toBeDefined();
      expect(depMap.affectedMods).toBeDefined();
      expect(depMap.migrationImpact).toBeDefined();

      // Verify core dependencies are documented
      expect(depMap.dependencies['core:go']).toBeDefined();
      expect(depMap.dependencies['core:actor-can-move']).toBeDefined();
      expect(depMap.dependencies['core:exit-is-unblocked']).toBeDefined();
      expect(depMap.dependencies['core:clear_directions']).toBeDefined();
      expect(depMap.dependencies['core:event-is-action-go']).toBeDefined();
    });

    it('should have executable rollback script', () => {
      const rollbackPath = path.join(backupDir, 'rollback.sh');
      expect(fs.existsSync(rollbackPath)).toBe(true);

      const stats = fs.statSync(rollbackPath);
      // Check if file is executable (Unix permissions)
      // eslint-disable-next-line no-bitwise
      const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
      expect(isExecutable).toBe(true);

      const rollbackContent = fs.readFileSync(rollbackPath, 'utf8');
      expect(rollbackContent).toContain('#!/bin/bash');
      expect(rollbackContent).toContain('Movement Migration Rollback Script');
    });
  });

  describe('File Integrity', () => {
    it('should have valid JSON files in backup', () => {
      const jsonFiles = [
        'core/actions/go.action.json',
        'core/rules/go.rule.json',
        'core/conditions/event-is-action-go.condition.json',
        'core/conditions/actor-can-move.condition.json',
        'core/conditions/exit-is-unblocked.condition.json',
        'positioning/actions/turn_around.action.json',
        'positioning/actions/get_close.action.json',
        'movement/mod-manifest.json'
      ];

      jsonFiles.forEach(file => {
        const filePath = path.join(backupDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        expect(() => JSON.parse(content)).not.toThrow();

        const json = JSON.parse(content);

        // Check for required id field (except manifest and rules)
        if (!file.includes('mod-manifest') && !file.includes('.rule.json')) {
          expect(json.id).toBeDefined();
        } else if (file.includes('.rule.json')) {
          // Rules use rule_id instead of id
          expect(json.rule_id).toBeDefined();
        }
      });
    });

    it('should have valid scope file in backup', () => {
      const scopePath = path.join(backupDir, 'core/scopes/clear_directions.scope');
      const scopeContent = fs.readFileSync(scopePath, 'utf8');

      // Scope files should contain valid scope DSL syntax
      expect(scopeContent).toBeTruthy();
      expect(scopeContent.length).toBeGreaterThan(0);
    });
  });
});
#!/usr/bin/env node

/**
 * @file Migration Rollback Script
 * @description Safety rollback tool to revert schema ID migration changes
 * if issues are encountered during or after migration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class MigrationRollback {
  constructor() {
    this.backupSuffix = '.backup';
    this.errors = [];
    this.restored = [];
  }

  async rollback() {
    console.log('🔄 Starting migration rollback...');
    console.log('');

    try {
      // 1. Restore schema directory
      console.log('📋 Phase 1: Restoring schema directory...');
      this.restoreDirectory('data/schemas');

      // 2. Restore source files
      console.log('📁 Phase 2: Restoring source files...');
      this.restoreFile('src/configuration/staticConfiguration.js');

      // 3. Reset test files via git
      console.log('🧪 Phase 3: Resetting test files...');
      this.resetTestFiles();

      // 4. Verify rollback
      console.log('✅ Phase 4: Verifying rollback...');
      await this.verifyRollback();

      if (this.errors.length > 0) {
        console.log('❌ Rollback completed with errors:');
        this.errors.forEach((error) => console.log(`   - ${error}`));
        return false;
      }

      console.log('✅ Rollback completed successfully!');
      return true;
    } catch (error) {
      console.error('💥 Rollback failed:', error.message);
      this.errors.push(`Rollback script error: ${error.message}`);
      return false;
    }
  }

  restoreDirectory(dirPath) {
    const backupPath = dirPath + this.backupSuffix;

    if (fs.existsSync(backupPath)) {
      console.log(`   Restoring directory: ${dirPath}`);

      try {
        // Remove current directory
        if (fs.existsSync(dirPath)) {
          fs.rmSync(dirPath, { recursive: true });
        }

        // Restore from backup
        fs.renameSync(backupPath, dirPath);
        this.restored.push(dirPath);
        console.log(`   ✅ Restored ${dirPath} from backup`);
      } catch (error) {
        const errorMsg = `Failed to restore directory ${dirPath}: ${error.message}`;
        console.error(`   ❌ ${errorMsg}`);
        this.errors.push(errorMsg);
      }
    } else {
      const warningMsg = `Backup not found: ${backupPath}`;
      console.warn(`   ⚠️  ${warningMsg}`);
      this.errors.push(warningMsg);
    }
  }

  restoreFile(filePath) {
    const backupPath = filePath + this.backupSuffix;

    if (fs.existsSync(backupPath)) {
      console.log(`   Restoring file: ${filePath}`);

      try {
        fs.copyFileSync(backupPath, filePath);
        this.restored.push(filePath);
        console.log(`   ✅ Restored ${filePath} from backup`);
      } catch (error) {
        const errorMsg = `Failed to restore file ${filePath}: ${error.message}`;
        console.error(`   ❌ ${errorMsg}`);
        this.errors.push(errorMsg);
      }
    } else {
      const warningMsg = `Backup not found: ${backupPath}`;
      console.warn(`   ⚠️  ${warningMsg}`);
      this.errors.push(warningMsg);
    }
  }

  resetTestFiles() {
    console.log('   Resetting test files via git...');

    try {
      // Check if we're in a git repository
      execSync('git status', { stdio: 'pipe' });

      // Reset test files to HEAD
      execSync('git checkout HEAD -- tests/', { stdio: 'pipe' });
      console.log('   ✅ Test files reset via git');
    } catch (error) {
      const warningMsg =
        'Git reset failed, test files may need manual restoration';
      console.warn(`   ⚠️  ${warningMsg}`);
      this.errors.push(warningMsg);
    }
  }

  async verifyRollback() {
    console.log('   Verifying rollback...');

    try {
      // Check if old domain references are back
      const oldDomain = 'http://example.com/schemas/';
      const sampleFiles = [
        'data/schemas/component.schema.json',
        'data/schemas/common.schema.json',
        'src/configuration/staticConfiguration.js',
      ];

      let verificationPassed = true;

      for (const sampleFile of sampleFiles) {
        if (fs.existsSync(sampleFile)) {
          const content = fs.readFileSync(sampleFile, 'utf8');
          if (content.includes(oldDomain)) {
            console.log(`   ✅ Old domain references found in ${sampleFile}`);
          } else {
            console.log(
              `   ❌ Old domain references NOT found in ${sampleFile}`
            );
            verificationPassed = false;
          }
        } else {
          console.log(`   ⚠️  Sample file not found: ${sampleFile}`);
          verificationPassed = false;
        }
      }

      if (!verificationPassed) {
        this.errors.push(
          'Rollback verification failed - old domain references not properly restored'
        );
      }

      // Try to run tests to verify functionality
      console.log('   Running test suite to verify rollback...');
      try {
        execSync('npm run test:ci', { stdio: 'pipe', timeout: 60000 });
        console.log('   ✅ Test suite passed after rollback');
      } catch (error) {
        const warningMsg =
          'Test suite failed after rollback - manual intervention may be needed';
        console.warn(`   ⚠️  ${warningMsg}`);
        this.errors.push(warningMsg);
      }
    } catch (error) {
      const errorMsg = `Rollback verification failed: ${error.message}`;
      console.error(`   ❌ ${errorMsg}`);
      this.errors.push(errorMsg);
    }
  }

  generateRollbackReport() {
    console.log('');
    console.log('📊 Rollback Report:');
    console.log('===================');
    console.log(`Files restored: ${this.restored.length}`);
    console.log(`Errors: ${this.errors.length}`);

    if (this.restored.length > 0) {
      console.log('');
      console.log('Restored files:');
      this.restored.forEach((file) => console.log(`  ✅ ${file}`));
    }

    if (this.errors.length > 0) {
      console.log('');
      console.log('❌ Errors encountered:');
      this.errors.forEach((error) => console.log(`  - ${error}`));
    }

    console.log('');
    console.log('Next steps:');
    console.log('1. Verify application starts: npm run start');
    console.log('2. Run full test suite: npm run test:ci');
    console.log('3. Check for any remaining issues');
    console.log('4. If needed, clean up backup files manually');
  }
}

// Run rollback
if (require.main === module) {
  const rollback = new MigrationRollback();
  rollback
    .rollback()
    .then((success) => {
      rollback.generateRollbackReport();
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Rollback script failed:', error);
      process.exit(1);
    });
}

module.exports = MigrationRollback;

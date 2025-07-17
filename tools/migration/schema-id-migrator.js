#!/usr/bin/env node

/**
 * @file Schema ID Migration Script
 * @description Automated migration tool to convert schema IDs from placeholder
 * http://example.com/schemas/ format to schema://living-narrative-engine/ format
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

class SchemaIdMigrator {
  constructor() {
    this.oldDomain = 'http://example.com/schemas/';
    this.newDomain = 'schema://living-narrative-engine/';
    this.changes = [];
    this.errors = [];
  }

  async migrateAll() {
    console.log('🚀 Starting schema ID migration...');
    console.log(`   FROM: ${this.oldDomain}`);
    console.log(`   TO:   ${this.newDomain}`);
    console.log('');

    try {
      // 1. Migrate schema files
      console.log('📋 Phase 1: Migrating schema files...');
      await this.migrateSchemaFiles();

      // 2. Migrate source files
      console.log('📁 Phase 2: Migrating source files...');
      await this.migrateSourceFiles();

      // 3. Migrate mod files
      console.log('📦 Phase 3: Migrating mod files...');
      await this.migrateModFiles();

      // 4. Migrate test files
      console.log('🧪 Phase 4: Migrating test files...');
      await this.migrateTestFiles();

      // 5. Generate migration report
      console.log('📊 Phase 5: Generating migration report...');
      this.generateReport();

      if (this.errors.length > 0) {
        console.log('❌ Migration completed with errors:');
        this.errors.forEach((error) => console.log(`   - ${error}`));
        return false;
      }

      console.log('✅ Migration completed successfully!');
      return true;
    } catch (error) {
      console.error('💥 Migration failed:', error.message);
      this.errors.push(error.message);
      return false;
    }
  }

  async migrateSchemaFiles() {
    const schemaFiles = glob.sync('data/schemas/**/*.schema.json');
    console.log(`   Found ${schemaFiles.length} schema files to migrate`);

    for (const filePath of schemaFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const newContent = content.replace(
          new RegExp(this.escapeRegExp(this.oldDomain), 'g'),
          this.newDomain
        );

        if (content !== newContent) {
          // Validate JSON before writing
          JSON.parse(newContent);

          fs.writeFileSync(filePath, newContent);
          this.changes.push({
            file: filePath,
            type: 'schema',
            changes: this.countChanges(content, newContent),
          });
          console.log(`   ✓ Updated ${filePath}`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate schema file ${filePath}: ${error.message}`;
        console.error(`   ✗ ${errorMsg}`);
        this.errors.push(errorMsg);
      }
    }
  }

  async migrateSourceFiles() {
    const sourceFiles = ['src/configuration/staticConfiguration.js'];

    console.log(`   Found ${sourceFiles.length} source files to migrate`);

    for (const filePath of sourceFiles) {
      try {
        if (!fs.existsSync(filePath)) {
          console.warn(`   ⚠️  Source file not found: ${filePath}`);
          continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const newContent = content.replace(
          new RegExp(this.escapeRegExp(this.oldDomain), 'g'),
          this.newDomain
        );

        if (content !== newContent) {
          fs.writeFileSync(filePath, newContent);
          this.changes.push({
            file: filePath,
            type: 'source',
            changes: this.countChanges(content, newContent),
          });
          console.log(`   ✓ Updated ${filePath}`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate source file ${filePath}: ${error.message}`;
        console.error(`   ✗ ${errorMsg}`);
        this.errors.push(errorMsg);
      }
    }
  }

  async migrateModFiles() {
    const modFiles = glob.sync('data/mods/**/*.json');
    let updatedCount = 0;

    console.log(`   Found ${modFiles.length} mod files to check`);

    for (const filePath of modFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const newContent = content.replace(
          new RegExp(this.escapeRegExp(this.oldDomain), 'g'),
          this.newDomain
        );

        if (content !== newContent) {
          // Validate JSON before writing
          JSON.parse(newContent);

          fs.writeFileSync(filePath, newContent);
          this.changes.push({
            file: filePath,
            type: 'mod',
            changes: this.countChanges(content, newContent),
          });
          updatedCount++;
          console.log(`   ✓ Updated ${filePath}`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate mod file ${filePath}: ${error.message}`;
        console.error(`   ✗ ${errorMsg}`);
        this.errors.push(errorMsg);
      }
    }

    console.log(`   Updated ${updatedCount} mod files`);
  }

  async migrateTestFiles() {
    const testFiles = glob.sync('tests/**/*.test.js');
    let updatedCount = 0;

    console.log(`   Found ${testFiles.length} test files to check`);

    for (const filePath of testFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        let newContent = content;

        // Replace schema ID references
        newContent = newContent.replace(
          new RegExp(this.escapeRegExp(this.oldDomain), 'g'),
          this.newDomain
        );

        // Update test assertions that check for http/https pattern
        newContent = newContent.replace(
          /expect\(.*?\)\.toMatch\(\/\^https?\?\:\\\//g,
          'expect($&).toMatch(/^schema:\\/\\/living-narrative-engine\\/'
        );

        // Update test assertions that check for http/https pattern with different quotes
        newContent = newContent.replace(
          /expect\(.*?\)\.toMatch\(\/\^https\?\:\\\//g,
          'expect($&).toMatch(/^schema:\\/\\/living-narrative-engine\\/'
        );

        if (content !== newContent) {
          fs.writeFileSync(filePath, newContent);
          this.changes.push({
            file: filePath,
            type: 'test',
            changes: this.countChanges(content, newContent),
          });
          updatedCount++;
          console.log(`   ✓ Updated ${filePath}`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate test file ${filePath}: ${error.message}`;
        console.error(`   ✗ ${errorMsg}`);
        this.errors.push(errorMsg);
      }
    }

    console.log(`   Updated ${updatedCount} test files`);
  }

  countChanges(oldContent, newContent) {
    const oldMatches = (
      oldContent.match(new RegExp(this.escapeRegExp(this.oldDomain), 'g')) || []
    ).length;
    const newMatches = (
      newContent.match(new RegExp(this.escapeRegExp(this.newDomain), 'g')) || []
    ).length;
    return newMatches;
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  generateReport() {
    console.log('');
    console.log('📊 Migration Summary:');
    console.log('=====================');
    console.log(`Total files changed: ${this.changes.length}`);
    console.log(`Total errors: ${this.errors.length}`);

    const byType = this.changes.reduce((acc, change) => {
      acc[change.type] = acc[change.type] || { count: 0, changes: 0 };
      acc[change.type].count += 1;
      acc[change.type].changes += change.changes;
      return acc;
    }, {});

    console.log('');
    console.log('By file type:');
    Object.entries(byType).forEach(([type, stats]) => {
      console.log(
        `  ${type}: ${stats.count} files, ${stats.changes} schema ID changes`
      );
    });

    if (this.errors.length > 0) {
      console.log('');
      console.log('❌ Errors encountered:');
      this.errors.forEach((error) => console.log(`  - ${error}`));
    }

    console.log('');
    console.log('Next steps:');
    console.log(
      '1. Run validation: node tools/migration/validate-migration.js'
    );
    console.log('2. Run tests: npm run test:ci');
    console.log('3. Start application: npm run start');
  }
}

// Run migration
if (require.main === module) {
  const migrator = new SchemaIdMigrator();
  migrator
    .migrateAll()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = SchemaIdMigrator;

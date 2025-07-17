#!/usr/bin/env node

/**
 * @file Migration Validation Script
 * @description Comprehensive validation tool to verify schema ID migration
 * completed successfully and all references are properly updated
 */

const fs = require('fs');
const glob = require('glob');
const path = require('path');

class MigrationValidator {
  constructor() {
    this.newDomain = 'schema://living-narrative-engine/';
    this.oldDomain = 'http://example.com/schemas/';
    this.errors = [];
    this.warnings = [];
    this.loadedSchemas = new Map();
  }

  async validateMigration() {
    console.log('🔍 Validating schema ID migration...');
    console.log('');

    try {
      // 1. Check for remaining old domain references
      console.log(
        '📋 Phase 1: Checking for remaining old domain references...'
      );
      this.checkForOldReferences();

      // 2. Validate all schema files can be loaded
      console.log('📁 Phase 2: Validating schema file loading...');
      await this.validateSchemaLoading();

      // 3. Validate cross-references work
      console.log('🔗 Phase 3: Validating cross-references...');
      await this.validateCrossReferences();

      // 4. Validate static configuration
      console.log('⚙️  Phase 4: Validating static configuration...');
      await this.validateStaticConfiguration();

      // 5. Validate test files
      console.log('🧪 Phase 5: Validating test files...');
      await this.validateTestFiles();

      // 6. Report results
      console.log('📊 Phase 6: Generating validation report...');
      this.reportResults();

      return this.errors.length === 0;
    } catch (error) {
      console.error('💥 Validation failed:', error.message);
      this.errors.push(`Validation script error: ${error.message}`);
      return false;
    }
  }

  checkForOldReferences() {
    const allFiles = glob
      .sync('data/schemas/**/*.json')
      .concat(glob.sync('data/mods/**/*.json'))
      .concat(glob.sync('src/**/*.js'))
      .concat(glob.sync('tests/**/*.js'));

    console.log(
      `   Checking ${allFiles.length} files for old domain references...`
    );

    let foundCount = 0;
    for (const filePath of allFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(this.oldDomain)) {
          this.errors.push(`Old domain reference found in: ${filePath}`);
          foundCount++;
        }
      } catch (error) {
        this.warnings.push(`Could not read file ${filePath}: ${error.message}`);
      }
    }

    if (foundCount === 0) {
      console.log('   ✅ No old domain references found');
    } else {
      console.log(`   ❌ Found ${foundCount} files with old domain references`);
    }
  }

  async validateSchemaLoading() {
    const schemaFiles = glob.sync('data/schemas/**/*.schema.json');
    console.log(`   Validating ${schemaFiles.length} schema files...`);

    let validCount = 0;
    for (const filePath of schemaFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const schema = JSON.parse(content);

        // Check $id format
        if (!schema.$id) {
          this.errors.push(`Missing $id in ${filePath}`);
          continue;
        }

        if (!schema.$id.startsWith(this.newDomain)) {
          this.errors.push(
            `Invalid $id in ${filePath}: ${schema.$id} (should start with ${this.newDomain})`
          );
          continue;
        }

        // Store schema for cross-reference validation
        this.loadedSchemas.set(schema.$id, {
          filePath,
          schema,
          content,
        });

        validCount++;
      } catch (error) {
        this.errors.push(`Failed to load schema ${filePath}: ${error.message}`);
      }
    }

    console.log(
      `   ✅ Successfully loaded ${validCount}/${schemaFiles.length} schemas`
    );
  }

  async validateCrossReferences() {
    console.log(
      `   Validating cross-references in ${this.loadedSchemas.size} schemas...`
    );

    let validRefs = 0;
    let totalRefs = 0;

    for (const [schemaId, { filePath, schema, content }] of this
      .loadedSchemas) {
      try {
        // Find all $ref patterns
        const refs = this.findReferences(schema);
        totalRefs += refs.length;

        for (const ref of refs) {
          if (ref.startsWith(this.newDomain)) {
            // Extract schema ID (part before #)
            const targetSchemaId = ref.split('#')[0];

            if (!this.loadedSchemas.has(targetSchemaId)) {
              this.errors.push(
                `Missing referenced schema: ${ref} in ${filePath}`
              );
            } else {
              validRefs++;
            }
          } else if (ref.startsWith('./') || ref.startsWith('../')) {
            // Handle relative references
            const resolvedRef = this.resolveRelativeReference(filePath, ref);
            if (resolvedRef && !this.loadedSchemas.has(resolvedRef)) {
              this.errors.push(
                `Missing relative referenced schema: ${ref} in ${filePath} (resolved to ${resolvedRef})`
              );
            } else if (resolvedRef) {
              validRefs++;
            }
          } else if (ref.startsWith('#')) {
            // Internal reference - validate it exists in current schema
            validRefs++;
          }
        }
      } catch (error) {
        this.errors.push(
          `Failed to validate references in ${filePath}: ${error.message}`
        );
      }
    }

    console.log(`   ✅ Validated ${validRefs}/${totalRefs} cross-references`);
  }

  resolveRelativeReference(filePath, ref) {
    const refPath = ref.split('#')[0];
    const schemaDir = path.dirname(filePath);
    const resolvedPath = path.resolve(schemaDir, refPath);
    const relativePath = path.relative(process.cwd(), resolvedPath);

    // Convert file path to schema ID
    const schemaName = path.basename(resolvedPath);
    if (relativePath.startsWith('data/schemas/operations/')) {
      return `${this.newDomain}operations/${schemaName}`;
    } else if (relativePath.startsWith('data/schemas/')) {
      return `${this.newDomain}${schemaName}`;
    }

    return null;
  }

  findReferences(obj, refs = []) {
    if (typeof obj === 'object' && obj !== null) {
      if (obj.$ref) {
        refs.push(obj.$ref);
      }

      for (const key in obj) {
        this.findReferences(obj[key], refs);
      }
    }

    return refs;
  }

  async validateStaticConfiguration() {
    const configPath = 'src/configuration/staticConfiguration.js';

    try {
      const content = fs.readFileSync(configPath, 'utf8');

      // Check that all schema IDs use new domain
      const schemaIdMatches = content.match(/'[^']*\.schema\.json'/g) || [];

      let newDomainCount = 0;
      let oldDomainCount = 0;

      for (const match of schemaIdMatches) {
        const schemaId = match.slice(1, -1); // Remove quotes
        if (schemaId.startsWith(this.newDomain)) {
          newDomainCount++;
        } else if (schemaId.startsWith(this.oldDomain)) {
          oldDomainCount++;
          this.errors.push(
            `Old domain schema ID in staticConfiguration.js: ${schemaId}`
          );
        }
      }

      console.log(`   ✅ Found ${newDomainCount} new domain schema IDs`);
      if (oldDomainCount > 0) {
        console.log(`   ❌ Found ${oldDomainCount} old domain schema IDs`);
      }
    } catch (error) {
      this.errors.push(
        `Failed to validate static configuration: ${error.message}`
      );
    }
  }

  async validateTestFiles() {
    const testFiles = glob.sync('tests/**/*.test.js');
    console.log(`   Checking ${testFiles.length} test files...`);

    let updatedAssertions = 0;
    let oldAssertions = 0;

    for (const filePath of testFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check for old domain references
        if (content.includes(this.oldDomain)) {
          this.errors.push(`Old domain reference in test file: ${filePath}`);
          oldAssertions++;
        }

        // Check for updated test assertions
        const newDomainMatches = (
          content.match(new RegExp(this.escapeRegExp(this.newDomain), 'g')) ||
          []
        ).length;
        updatedAssertions += newDomainMatches;
      } catch (error) {
        this.warnings.push(
          `Could not read test file ${filePath}: ${error.message}`
        );
      }
    }

    console.log(`   ✅ Found ${updatedAssertions} updated test assertions`);
    if (oldAssertions > 0) {
      console.log(
        `   ❌ Found ${oldAssertions} test files with old domain references`
      );
    }
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  reportResults() {
    console.log('');
    console.log('📊 Validation Report:');
    console.log('====================');
    console.log(`Schemas loaded: ${this.loadedSchemas.size}`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);

    if (this.errors.length === 0) {
      console.log('');
      console.log('✅ Migration validation PASSED!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Run full test suite: npm run test:ci');
      console.log('2. Start application: npm run start');
      console.log('3. Test schema validation manually');
    } else {
      console.log('');
      console.log('❌ Migration validation FAILED!');
      console.log('');
      console.log('Errors found:');
      this.errors.forEach((error) => console.log(`  - ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log('');
      console.log('⚠️  Warnings:');
      this.warnings.forEach((warning) => console.log(`  - ${warning}`));
    }
  }
}

// Run validation
if (typeof require !== 'undefined' && require.main === module) {
  const validator = new MigrationValidator();
  validator
    .validateMigration()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation script failed:', error);
      process.exit(1);
    });
}

if (typeof module !== 'undefined') {
  module.exports = MigrationValidator;
}

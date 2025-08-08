#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ACTIONS_DIR = path.join(__dirname, '../data/mods/intimacy/actions');
const SCHEMA_PATH = path.join(__dirname, '../data/schemas/action.schema.json');
const COMMON_SCHEMA_PATH = path.join(
  __dirname,
  '../data/schemas/common.schema.json'
);

/**
 *
 */
async function validateSchemas() {
  console.log('📋 Validating Intimacy Actions Against JSON Schema\n');

  // Setup AJV
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    verbose: true,
  });
  addFormats(ajv);

  // Load all required schemas
  const schemasDir = path.join(__dirname, '../data/schemas');
  const schemaFiles = await fs.readdir(schemasDir);

  // Load all schemas first to resolve references (except action.schema.json)
  for (const schemaFile of schemaFiles) {
    if (
      schemaFile.endsWith('.schema.json') &&
      schemaFile !== 'action.schema.json'
    ) {
      const schemaPath = path.join(schemasDir, schemaFile);
      try {
        const schema = JSON.parse(await fs.readFile(schemaPath, 'utf8'));
        if (schema.$id) {
          ajv.addSchema(schema, schema.$id);
        }
      } catch (err) {
        console.warn(
          `Warning: Could not load schema ${schemaFile}: ${err.message}`
        );
      }
    }
  }

  // Load and compile action schema last
  const actionSchema = JSON.parse(await fs.readFile(SCHEMA_PATH, 'utf8'));
  const validate = ajv.compile(actionSchema);

  // Get all action files
  const files = await fs.readdir(ACTIONS_DIR);
  const actionFiles = files.filter((f) => f.endsWith('.action.json'));

  console.log(`Found ${actionFiles.length} action files to validate\n`);

  const results = {
    valid: [],
    invalid: [],
  };

  for (const file of actionFiles) {
    const filePath = path.join(ACTIONS_DIR, file);
    let content;

    try {
      content = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch (err) {
      results.invalid.push({
        file,
        error: `Failed to parse JSON: ${err.message}`,
      });
      continue;
    }

    const valid = validate(content);

    if (valid) {
      results.valid.push(file);
      console.log(`✅ ${file}`);
    } else {
      results.invalid.push({
        file,
        errors: validate.errors,
      });
      console.log(`❌ ${file}`);
      console.log(`   Errors:`, JSON.stringify(validate.errors, null, 2));
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('SCHEMA VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════\n');

  console.log(
    `✅ Valid actions: ${results.valid.length}/${actionFiles.length}`
  );
  console.log(
    `❌ Invalid actions: ${results.invalid.length}/${actionFiles.length}`
  );

  if (results.invalid.length > 0) {
    console.error('\n❌ INVALID ACTIONS:');
    for (const item of results.invalid) {
      console.error(`\n  ${item.file}:`);
      if (item.error) {
        console.error(`    ${item.error}`);
      } else if (item.errors) {
        for (const err of item.errors) {
          console.error(`    - ${err.instancePath || '/'}: ${err.message}`);
          if (err.params) {
            console.error(`      params:`, err.params);
          }
        }
      }
    }
    process.exit(1);
  } else {
    console.log('\n✅ All actions pass schema validation!');
    process.exit(0);
  }
}

validateSchemas().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

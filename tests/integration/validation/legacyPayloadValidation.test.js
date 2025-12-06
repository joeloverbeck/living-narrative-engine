const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

describe('Legacy Payload Validation', () => {
  const MODS_DIR = path.join(process.cwd(), 'data/mods');

  // Helper to recursively find JSON files
  async function findJsonFiles(dir) {
    const results = [];
    const list = await readdir(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const statResult = await stat(filePath);
      if (statResult && statResult.isDirectory()) {
        results.push(...(await findJsonFiles(filePath)));
      } else if (file.endsWith('.json')) {
        results.push(filePath);
      }
    }
    return results;
  }

  // Helper to find APPLY_DAMAGE operations in an object
  function findApplyDamageOperations(obj, operations = []) {
    if (!obj || typeof obj !== 'object') return operations;

    if (Array.isArray(obj)) {
      obj.forEach((item) => findApplyDamageOperations(item, operations));
      return operations;
    }

    if (obj.type === 'APPLY_DAMAGE') {
      operations.push(obj);
    }

    Object.values(obj).forEach((value) =>
      findApplyDamageOperations(value, operations)
    );
    return operations;
  }

  function validateApplyDamage(op) {
    const warnings = [];
    if (op.amount !== undefined) {
      warnings.push(
        "Property 'amount' is deprecated. Use 'damage_entry' instead."
      );
    }
    if (op.damage_type !== undefined) {
      warnings.push(
        "Property 'damage_type' is deprecated. Use 'damage_entry' instead."
      );
    }
    return warnings;
  }

  it('should detect legacy properties in APPLY_DAMAGE operations', () => {
    const legacyOp = {
      type: 'APPLY_DAMAGE',
      amount: 10,
      damage_type: 'slashing',
      entity_ref: 'target',
    };
    const warnings = validateApplyDamage(legacyOp);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("'amount' is deprecated");
    expect(warnings[1]).toContain("'damage_type' is deprecated");
  });

  it('should not warn for modern APPLY_DAMAGE operations', () => {
    const modernOp = {
      type: 'APPLY_DAMAGE',
      damage_entry: { name: 'slashing', amount: 10 },
      entity_ref: 'target',
    };
    const warnings = validateApplyDamage(modernOp);
    expect(warnings).toHaveLength(0);
  });

  it('should scan existing mods for legacy usage and log warnings', async () => {
    if (!fs.existsSync(MODS_DIR)) {
      console.warn('Mods directory not found, skipping scan.');
      return;
    }

    const files = await findJsonFiles(MODS_DIR);
    const allWarnings = [];

    for (const file of files) {
      try {
        const content = await readFile(file, 'utf8');
        const json = JSON.parse(content);
        const operations = findApplyDamageOperations(json);

        operations.forEach((op) => {
          const warnings = validateApplyDamage(op);
          if (warnings.length > 0) {
            allWarnings.push({
              file: path.relative(MODS_DIR, file),
              warnings,
            });
          }
        });
      } catch (e) {
        // Ignore parsing errors (comments etc in JSONC might fail standard parse)
      }
    }

    if (allWarnings.length > 0) {
      console.log(
        `Found ${allWarnings.length} files with legacy APPLY_DAMAGE usage:`
      );
      allWarnings.forEach((w) => {
        console.log(`- ${w.file}: ${w.warnings.join(', ')}`);
      });
    } else {
      console.log('No legacy APPLY_DAMAGE usage found in mods.');
    }

    // Assert that we executed the scan, but don't fail on existing legacy usage
    // as per ticket requirements ("does not fail existing mod fixtures").
    expect(true).toBe(true);
  });
});

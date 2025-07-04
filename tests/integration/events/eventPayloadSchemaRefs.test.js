const fs = require('fs');
const path = require('path');

// Utility to recursively find all .event.json files in a directory
/**
 * Recursively find all event files within a directory if it exists.
 *
 * @param {string} dir - directory to search
 * @returns {string[]} array of event file paths
 */
function findEventFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      return;
    }
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findEventFiles(filePath));
    } else if (file.endsWith('.event.json')) {
      results.push(filePath);
    }
  });
  return results;
}

// Recursively search for $ref fields in an object
/**
 * Recursively search an object tree for "$ref" values.
 *
 * @param {object} obj - object to inspect
 * @param {string[]} refs - accumulator for refs
 * @returns {string[]} collected refs
 */
function findRefs(obj, refs = []) {
  if (typeof obj !== 'object' || obj === null) return refs;
  for (const key of Object.keys(obj)) {
    if (key === '$ref' && typeof obj[key] === 'string') {
      refs.push(obj[key]);
    } else {
      findRefs(obj[key], refs);
    }
  }
  return refs;
}

describe('Event payload schemas use only absolute $ref paths to shared schemas', () => {
  const eventDir = path.join(__dirname, '../../../data/mods');
  const eventFiles = findEventFiles(eventDir);

  test.each(eventFiles)(
    '%s does not use relative $ref to shared schemas',
    (eventFile) => {
      const json = JSON.parse(fs.readFileSync(eventFile, 'utf8'));
      const payloadSchema = json.payloadSchema;
      if (!payloadSchema) return; // No payloadSchema, skip
      const refs = findRefs(payloadSchema);
      // Only check refs that reference common.schema.json or other shared schemas
      refs.forEach((ref) => {
        const isCommon = ref.includes('common.schema.json');
        expect(
          !isCommon ||
            ref.startsWith('http://example.com/schemas/common.schema.json')
        ).toBe(true);
        // Optionally, add more checks for other shared schemas here
      });
    }
  );
});

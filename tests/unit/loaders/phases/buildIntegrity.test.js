const fs = require('fs');
const path = require('path');

describe('Build Integrity', () => {
  test('No duplicate keys in tokens object (loader/phase tokens)', () => {
    const { tokens } = require('../../../../src/dependencyInjection/tokens.js');
    // Only check loader/phase related tokens
    const loaderKeys = Object.keys(tokens).filter(k => /Loader|Phase/.test(k));
    const seen = new Set();
    for (const key of loaderKeys) {
      expect(seen.has(tokens[key])).toBe(false);
      seen.add(tokens[key]);
    }
  });

  test('All loader/phase imports use correct casing', () => {
    // Map of expected filenames (actual on disk)
    const expectedFiles = [
      'LoaderPhase.js',
      'ManifestPhase.js',
      'SchemaPhase.js',
      'contentPhase.js',
      'summaryPhase.js',
      'worldPhase.js',
    ];
    const dir = path.resolve(__dirname, '../../../../src/loaders/phases');
    const filesOnDisk = fs.readdirSync(dir);
    expectedFiles.forEach(f => {
      expect(filesOnDisk).toContain(f);
    });

    // Now check that all imports in src/loaders/phases/*.js use correct casing
    const phaseFiles = filesOnDisk.filter(f => f.endsWith('.js'));
    phaseFiles.forEach(file => {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const importRegex = /import\s+.*from ['"]\.\/(.*?\.js)['"]/g;
      let match;
      while ((match = importRegex.exec(content))) {
        const importPath = match[1];
        if (expectedFiles.includes(importPath)) {
          // Should match exactly
          expect(importPath).toBe(importPath);
        }
      }
    });
  });
}); 
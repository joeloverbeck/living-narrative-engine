const fs = require('fs');
const path = require('path');

/**
 * Test suite to validate that import paths in JavaScript files match the actual filenames
 * to prevent case sensitivity issues on different file systems.
 */
describe('Import Path Case Validation', () => {
  // Use __dirname to get the correct project root
  const projectRoot = path.resolve(__dirname, '../../..');
  const srcDir = path.join(projectRoot, 'src');

  /**
   * Recursively find all JavaScript files in a directory.
   *
   * @param {string} dir - Directory to search.
   * @returns {string[]} Array of JavaScript file paths.
   */
  function findJsFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findJsFiles(fullPath));
      } else if (item.endsWith('.js')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Extract static import statements from a file.
   * Only matches: `import ... from '...'` and ignores dynamic imports.
   *
   * @param {string} filePath - File to parse.
   * @returns {Array<{importPath:string, line:number, fullMatch:string}>} Parsed imports.
   */
  function extractStaticImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Only match static ES6 imports
    const importRegex = /^import\s+[^'"`]+['"`]([^'"`]+)['"`]/gm;
    const imports = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // Only check relative imports and imports from src directory
      if (importPath.startsWith('.') || importPath.startsWith('src/')) {
        imports.push({
          importPath,
          line: content.substring(0, match.index).split('\n').length,
          fullMatch: match[0],
        });
      }
    }

    return imports;
  }

  /**
   * Check if a file exists with the exact case.
   *
   * @param {string} filePath - Path to check.
   * @returns {boolean} True if file exists with matching case.
   */
  function fileExistsWithCase(filePath) {
    try {
      const dir = path.dirname(filePath);
      const filename = path.basename(filePath);
      const files = fs.readdirSync(dir);
      return files.includes(filename);
    } catch {
      return false;
    }
  }

  /**
   * Resolve an import path to an absolute path.
   *
   * @param {string} importPath - Import path from the file.
   * @param {string} currentFile - File containing the import.
   * @returns {string} Absolute resolved path.
   */
  function resolveImportPath(importPath, currentFile) {
    if (importPath.startsWith('src/')) {
      return path.join(projectRoot, importPath);
    }
    return path.resolve(path.dirname(currentFile), importPath);
  }

  describe('JavaScript files in src directory', () => {
    const jsFiles = findJsFiles(srcDir);

    test.each(jsFiles)(
      'should have valid static import paths in %s',
      (filePath) => {
        const imports = extractStaticImports(filePath);
        const errors = [];

        for (const importInfo of imports) {
          const resolvedPath = resolveImportPath(
            importInfo.importPath,
            filePath
          );

          // Skip if the resolved path doesn't exist (might be a package import)
          if (!fs.existsSync(resolvedPath)) {
            continue;
          }

          // Check if the file exists with the exact case
          if (!fileExistsWithCase(resolvedPath)) {
            const relativePath = path.relative(projectRoot, filePath);
            errors.push(
              `Line ${importInfo.line}: Import path "${importInfo.importPath}" ` +
                `does not match actual filename case in ${relativePath}`
            );
          }
        }

        if (errors.length > 0) {
          throw new Error(
            `Case sensitivity issues found:\n${errors.join('\n')}`
          );
        }
        expect(errors).toHaveLength(0);
      }
    );
  });

  describe('Specific known problematic patterns', () => {
    test('should not have contentLoadManager.js static imports', () => {
      const jsFiles = findJsFiles(srcDir);
      const errors = [];

      for (const filePath of jsFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        // Only match static import ... from 'contentLoadManager.js'
        const staticImportRegex =
          /^import\s+[^'"`]+['"`][^'"`]*contentLoadManager\.js['"`]/gm;
        if (staticImportRegex.test(content)) {
          const relativePath = path.relative(projectRoot, filePath);
          errors.push(`Found incorrect static import case in ${relativePath}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(
          `Found incorrect static import case for ContentLoadManager:\n${errors.join('\n')}`
        );
      }
      expect(errors).toHaveLength(0);
    });
  });
});

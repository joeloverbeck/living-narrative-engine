/**
 * @file Integration test to verify import/export consistency across the codebase
 * Prevents issues like named imports from default exports
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const projectRoot = path.join(__dirname, '../../..');

describe('Import/Export Consistency', () => {
  describe('Dependency Injection Services', () => {
    it('should have consistent import/export patterns for anatomy services', () => {
      const errors = [];

      // Services that use default exports in anatomy module
      const anatomyServices = [
        {
          file: 'src/anatomy/partSelectionService.js',
          className: 'PartSelectionService',
        },
        {
          file: 'src/anatomy/DescriptionPersistenceService.js',
          className: 'DescriptionPersistenceService',
        },
      ];

      // Check each service file for default export
      for (const service of anatomyServices) {
        const filePath = path.join(projectRoot, service.file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');

          // Check if it's a default export
          const hasDefaultExport = content.includes(
            `export default ${service.className}`
          );

          if (!hasDefaultExport) {
            // Check if it's a named export instead
            const hasNamedExport =
              content.includes(`export { ${service.className} }`) ||
              content.includes(`export class ${service.className}`);

            if (hasNamedExport) {
              errors.push(
                `${service.file} exports ${service.className} as named export but should use default export`
              );
            } else {
              errors.push(
                `${service.file} does not export ${service.className}`
              );
            }
          }
        } catch (err) {
          errors.push(`Could not read ${service.file}: ${err.message}`);
        }
      }

      // Check imports in worldAndEntityRegistrations.js
      const registrationFile = path.join(
        projectRoot,
        'src/dependencyInjection/registrations/worldAndEntityRegistrations.js'
      );
      try {
        const content = fs.readFileSync(registrationFile, 'utf-8');

        for (const service of anatomyServices) {
          const correctImport = `import ${service.className} from`;
          const incorrectImport = `import { ${service.className} }`;

          if (
            content.includes(incorrectImport) &&
            content.includes(service.file.replace('src/', '../../'))
          ) {
            errors.push(
              `worldAndEntityRegistrations.js uses named import for ${service.className} but should use default import`
            );
          }
        }
      } catch (err) {
        errors.push(
          `Could not read worldAndEntityRegistrations.js: ${err.message}`
        );
      }

      if (errors.length > 0) {
        console.error('Import/Export consistency errors:', errors);
      }

      expect(errors).toEqual([]);
    });

    it('should verify critical anatomy services are imported correctly', () => {
      const registrationFile = path.join(
        projectRoot,
        'src/dependencyInjection/registrations/worldAndEntityRegistrations.js'
      );
      const content = fs.readFileSync(registrationFile, 'utf-8');

      // Verify these services are imported as default exports
      const defaultImports = [
        'PartSelectionService',
        'DescriptionPersistenceService',
      ];

      for (const serviceName of defaultImports) {
        const hasDefaultImport = new RegExp(
          `import\\s+${serviceName}\\s+from`
        ).test(content);
        expect(hasDefaultImport).toBe(true);
      }
    });
  });
});

/**
 * @file Finds all files related to validation errors
 * @see ./ValidationReport.js
 */

/**
 * Extracts and lists all file references from validation results
 */
export class RelatedFileFinder {
  /**
   * Extract all file references from validation report
   *
   * @param {object} report - ValidationReport instance
   * @returns {object} Categorized file references
   */
  static extractFiles(report) {
    const files = {
      recipes: new Set(),
      blueprints: new Set(),
      components: new Set(),
      other: new Set(),
    };

    const summary = report.summary;

    // Add recipe file
    if (summary.recipePath) {
      files.recipes.add(summary.recipePath);
    }

    // Extract from errors
    for (const error of report.errors) {
      this.#extractFromIssue(error, files);
    }

    // Extract from warnings
    for (const warning of report.warnings) {
      this.#extractFromIssue(warning, files);
    }

    // Extract from suggestions
    for (const suggestion of report.suggestions) {
      this.#extractFromIssue(suggestion, files);
    }

    // Convert Sets to sorted arrays
    return {
      recipes: Array.from(files.recipes).sort(),
      blueprints: Array.from(files.blueprints).sort(),
      components: Array.from(files.components).sort(),
      other: Array.from(files.other).sort(),
      total: files.recipes.size + files.blueprints.size + files.components.size + files.other.size,
    };
  }

  /**
   * Extract file references from a single issue
   *
   * @param {object} issue - Error, warning, or suggestion object
   * @param {object} files - File collection object to populate
   */
  static #extractFromIssue(issue, files) {
    // Extract blueprint references
    if (issue.blueprintId) {
      const blueprintPath = this.#blueprintIdToPath(issue.blueprintId);
      if (blueprintPath) {
        files.blueprints.add(blueprintPath);
      }
    }

    // Extract component references
    if (issue.componentId) {
      const componentPath = this.#componentIdToPath(issue.componentId);
      if (componentPath) {
        files.components.add(componentPath);
      }
    }

    // Extract from fix message
    if (issue.fix) {
      const extractedPath = this.#extractPathFromMessage(issue.fix);
      if (extractedPath) {
        this.#categorizeAndAddPath(extractedPath, files);
      }
    }

    // Extract from suggestion
    if (issue.suggestion) {
      const extractedPath = this.#extractPathFromMessage(issue.suggestion);
      if (extractedPath) {
        this.#categorizeAndAddPath(extractedPath, files);
      }
    }
  }

  /**
   * Convert blueprint ID to file path
   *
   * @param {string} blueprintId - Blueprint ID (e.g., "core:humanoid")
   * @returns {string|null} File path or null
   */
  static #blueprintIdToPath(blueprintId) {
    if (!blueprintId || !blueprintId.includes(':')) {
      return null;
    }

    const [modId, name] = blueprintId.split(':');
    return `data/mods/${modId}/blueprints/${name}.blueprint.json`;
  }

  /**
   * Convert component ID to file path
   *
   * @param {string} componentId - Component ID (e.g., "core:actor")
   * @returns {string|null} File path or null
   */
  static #componentIdToPath(componentId) {
    if (!componentId || !componentId.includes(':')) {
      return null;
    }

    const [modId, name] = componentId.split(':');
    return `data/mods/${modId}/components/${name}.component.json`;
  }

  /**
   * Extract file path from message text
   *
   * @param {string} message - Message that may contain file paths
   * @returns {string|null} Extracted path or null
   */
  static #extractPathFromMessage(message) {
    // Match patterns like: data/mods/*/components/...
    const patterns = [
      /data\/mods\/[^\s]+\.json/,
      /data\/mods\/[^\s]+\.blueprint\.json/,
      /data\/mods\/[^\s]+\.component\.json/,
      /data\/mods\/[^\s]+\.recipe\.json/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Categorize and add path to appropriate collection
   *
   * @param {string} path - File path to categorize
   * @param {object} files - File collection object
   */
  static #categorizeAndAddPath(path, files) {
    if (path.includes('.blueprint.json')) {
      files.blueprints.add(path);
    } else if (path.includes('.component.json')) {
      files.components.add(path);
    } else if (path.includes('.recipe.json')) {
      files.recipes.add(path);
    } else {
      files.other.add(path);
    }
  }

  /**
   * Generate file list report
   *
   * @param {object} fileList - Result from extractFiles()
   * @returns {string} Formatted file list
   */
  static formatFileList(fileList) {
    let output = 'Related Files:\n';
    output += '='.repeat(80) + '\n\n';

    if (fileList.recipes.length > 0) {
      output += `Recipes (${fileList.recipes.length}):\n`;
      for (const file of fileList.recipes) {
        output += `  - ${file}\n`;
      }
      output += '\n';
    }

    if (fileList.blueprints.length > 0) {
      output += `Blueprints (${fileList.blueprints.length}):\n`;
      for (const file of fileList.blueprints) {
        output += `  - ${file}\n`;
      }
      output += '\n';
    }

    if (fileList.components.length > 0) {
      output += `Components (${fileList.components.length}):\n`;
      for (const file of fileList.components) {
        output += `  - ${file}\n`;
      }
      output += '\n';
    }

    if (fileList.other.length > 0) {
      output += `Other (${fileList.other.length}):\n`;
      for (const file of fileList.other) {
        output += `  - ${file}\n`;
      }
      output += '\n';
    }

    output += `Total: ${fileList.total} file(s)\n`;

    return output;
  }

  /**
   * Generate file creation commands
   *
   * @param {object} fileList - Result from extractFiles()
   * @returns {Array<string>} Array of shell commands
   */
  static generateFileCommands(fileList) {
    const commands = [];

    const allFiles = [
      ...fileList.recipes,
      ...fileList.blueprints,
      ...fileList.components,
      ...fileList.other,
    ];

    for (const file of allFiles) {
      commands.push(`# Check if file exists: ${file}`);
      commands.push(`if [ ! -f "${file}" ]; then`);
      commands.push(`  echo "Missing: ${file}"`);
      commands.push(`  mkdir -p "$(dirname "${file}")"`);
      commands.push(`  # TODO: Create ${file}`);
      commands.push('fi');
      commands.push('');
    }

    return commands;
  }
}

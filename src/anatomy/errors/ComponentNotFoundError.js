/**
 * @file Error for component not found in registry
 * @description Enhanced error for missing component references in anatomy recipes
 */

import AnatomyError from './AnatomyError.js';

/**
 * Error thrown when a component referenced in a recipe does not exist
 *
 * @class
 * @augments {AnatomyError}
 */
class ComponentNotFoundError extends AnatomyError {
  /**
   * Creates a new ComponentNotFoundError instance
   *
   * @param {object} params - Error parameters
   * @param {string} params.recipeId - The recipe ID where the error occurred
   * @param {object} params.location - Location within the recipe
   * @param {string} params.location.type - Type of location (e.g., 'slot', 'pattern')
   * @param {string} params.location.name - Name of the location (e.g., slot name)
   * @param {string} params.componentId - The component ID that was not found
   * @param {string} [params.recipePath] - File path to the recipe
   */
  constructor({ recipeId, location, componentId, recipePath }) {
    super({
      context: `Recipe '${recipeId}', ${location.type} '${location.name}'`,
      problem: `Component '${componentId}' does not exist in the component registry`,
      impact: `${location.type} cannot be processed, anatomy generation will fail`,
      fix: [
        `Create component at: data/mods/*/components/${componentId.split(':')[1]}.component.json`,
        '',
        'Example Component Structure:',
        '{',
        `  "$schema": "schema://living-narrative-engine/component.schema.json",`,
        `  "id": "${componentId}",`,
        '  "description": "Component description",',
        '  "dataSchema": {',
        '    "type": "object",',
        '    "properties": { ... }',
        '  }',
        '}',
      ],
      references: [
        'docs/anatomy/anatomy-system-guide.md',
        'data/mods/anatomy/components/part.component.json (example)',
      ],
    });

    this.recipeId = recipeId;
    this.componentId = componentId;
    this.location = location;
    this.recipePath = recipePath;
  }
}

export default ComponentNotFoundError;

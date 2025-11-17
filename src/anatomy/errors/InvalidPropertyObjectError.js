import AnatomyError from './AnatomyError.js';

/**
 * Error thrown when slot or pattern property payloads are not plain objects keyed by component IDs.
 */
class InvalidPropertyObjectError extends AnatomyError {
  /**
   * @param {object} params - Error parameters.
   * @param {string} params.recipeId - Recipe identifier.
   * @param {{ type: string, name: string }} params.location - Recipe location metadata.
   * @param {string} [params.recipePath] - Optional recipe file path.
   * @param {string} [params.receivedType] - Description of the invalid value type.
   */
  constructor({ recipeId, location, recipePath, receivedType }) {
    const prettyLocation = `Recipe '${recipeId}', ${location.type} '${location.name}'`;
    super({
      context: prettyLocation,
      problem:
        'Property requirements must be declared as an object keyed by component IDs (e.g., "components:foo": { ... }).',
      impact:
        'Component checks and schema validation cannot run until properties use the componentId → payload structure.',
      fix: [
        'Ensure each slot or pattern sets "properties" to a plain object keyed by component IDs:',
        '{',
        '  "slots": {',
        '    "arm": {',
        '      "properties": {',
        '        "descriptors:size_category": { "size": "tall" }',
        '      }',
        '    }',
        '  }',
        '}',
        receivedType
          ? `Current value type: ${receivedType}. Replace it with an object literal.`
          : 'Replace arrays, numbers, or strings with an object literal.',
      ],
      references: [
        'docs/anatomy/anatomy-system-guide.md#fail-fast-validators',
        'docs/anatomy/anatomy-system-guide.md#validation-pipeline',
      ],
    });

    this.recipeId = recipeId;
    this.location = location;
    this.recipePath = recipePath;
    this.receivedType = receivedType;
  }
}

export default InvalidPropertyObjectError;

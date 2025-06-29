/**
 * Service for formatting descriptor component values into readable text
 */
export class DescriptorFormatter {
  /**
   * Orders in which descriptors should appear in descriptions
   */
  static DESCRIPTOR_ORDER = [
    'descriptors:length_category',
    'descriptors:length_hair',
    'descriptors:size_category',
    'descriptors:size_specific',
    'descriptors:weight_feel',
    'descriptors:color_basic',
    'descriptors:color_extended',
    'descriptors:shape_general',
    'descriptors:shape_eye',
    'descriptors:hair_style',
    'descriptors:texture',
    'descriptors:firmness',
    'descriptors:build',
  ];

  /**
   * Descriptor types that should use commas instead of hyphens
   */
  static COMMA_SEPARATED = new Set([
    'descriptors:shape_eye',
    'descriptors:size_specific',
    'descriptors:weight_feel',
  ]);

  /**
   * Format multiple descriptor values into a readable string
   * @param {Array<{componentId: string, value: string}>} descriptors - Array of descriptor objects
   * @returns {string} Formatted descriptor string
   */
  formatDescriptors(descriptors) {
    if (!descriptors || descriptors.length === 0) {
      return '';
    }

    // Sort descriptors by the defined order
    const sortedDescriptors = descriptors.sort((a, b) => {
      const indexA = DescriptorFormatter.DESCRIPTOR_ORDER.indexOf(
        a.componentId
      );
      const indexB = DescriptorFormatter.DESCRIPTOR_ORDER.indexOf(
        b.componentId
      );

      // If not in the order list, put at the end
      const orderA =
        indexA === -1 ? DescriptorFormatter.DESCRIPTOR_ORDER.length : indexA;
      const orderB =
        indexB === -1 ? DescriptorFormatter.DESCRIPTOR_ORDER.length : indexB;

      return orderA - orderB;
    });

    // Format the values
    const formattedValues = sortedDescriptors.map((desc) =>
      this.formatSingleDescriptor(desc)
    );

    // Join with commas
    return this.joinDescriptors(formattedValues);
  }

  /**
   * Format a single descriptor value
   * @param {{componentId: string, value: string}} descriptor
   * @returns {string}
   */
  formatSingleDescriptor(descriptor) {
    const { componentId, value } = descriptor;

    // Handle multi-word values that should stay hyphenated
    if (
      value.includes('-') &&
      !DescriptorFormatter.COMMA_SEPARATED.has(componentId)
    ) {
      return value;
    }

    // Handle special cases
    if (componentId === 'descriptors:shape_eye' && value.includes('_')) {
      // Convert underscore to hyphen for eye shapes
      return value.replace('_', '-');
    }

    return value;
  }

  /**
   * Join descriptor values with appropriate punctuation
   * @param {string[]} values
   * @returns {string}
   */
  joinDescriptors(values) {
    if (values.length === 0) return '';
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]}, ${values[1]}`;

    // For 3+ values, use commas with 'and' before the last
    const allButLast = values.slice(0, -1).join(', ');
    const last = values[values.length - 1];
    return `${allButLast}, and ${last}`;
  }

  /**
   * Extract descriptor values from an entity's components
   * @param {Object} components - Entity components object
   * @returns {Array<{componentId: string, value: string}>}
   */
  extractDescriptors(components) {
    const descriptors = [];

    for (const [componentId, componentData] of Object.entries(components)) {
      if (componentId.startsWith('descriptors:') && componentData) {
        // Extract the value based on the descriptor type
        const value = this.extractDescriptorValue(componentId, componentData);
        if (value) {
          descriptors.push({ componentId, value });
        }
      }
    }

    return descriptors;
  }

  /**
   * Extract the value from a descriptor component
   * @param {string} componentId
   * @param {Object} componentData
   * @returns {string|null}
   */
  extractDescriptorValue(componentId, componentData) {
    // Common patterns for descriptor values
    const possibleKeys = [
      'value',
      'color',
      'size',
      'shape',
      'length',
      'style',
      'texture',
      'firmness',
      'build',
      'weight',
    ];

    for (const key of possibleKeys) {
      if (componentData[key]) {
        return componentData[key];
      }
    }

    // If no known key found, try to get the first string value
    const values = Object.values(componentData);
    const stringValue = values.find((v) => typeof v === 'string');
    return stringValue || null;
  }
}

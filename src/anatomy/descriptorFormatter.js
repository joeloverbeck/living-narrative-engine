/**
 * Service for formatting descriptor component values into readable text
 */
export class DescriptorFormatter {
  constructor(params = {}) {
    this.anatomyFormattingService = params.anatomyFormattingService;

    // Default values for backward compatibility when no service is provided
    this._defaultDescriptorOrder = [
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
      'descriptors:embellishment',
      'descriptors:firmness',
      'descriptors:projection',
      'descriptors:build',
    ];

    this._defaultDescriptorValueKeys = [
      'value',
      'color',
      'size',
      'shape',
      'length',
      'style',
      'texture',
      'embellishment',
      'firmness',
      'build',
      'weight',
      'projection',
    ];
  }

  /**
   * Format multiple descriptor values into a readable string
   *
   * @param {Array<{componentId: string, value: string}>} descriptors - Array of descriptor objects
   * @returns {string} Formatted descriptor string
   */
  formatDescriptors(descriptors) {
    if (!descriptors || descriptors.length === 0) {
      return '';
    }

    // Sort descriptors by the defined order
    const descriptorOrder = this.anatomyFormattingService?.getDescriptorOrder
      ? this.anatomyFormattingService.getDescriptorOrder()
      : this._defaultDescriptorOrder;

    const sortedDescriptors = descriptors.sort((a, b) => {
      const indexA = descriptorOrder.indexOf(a.componentId);
      const indexB = descriptorOrder.indexOf(b.componentId);

      // If not in the order list, put at the end
      const orderA = indexA === -1 ? descriptorOrder.length : indexA;
      const orderB = indexB === -1 ? descriptorOrder.length : indexB;

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
   *
   * @param {{componentId: string, value: string}} descriptor
   * @returns {string}
   */
  formatSingleDescriptor(descriptor) {
    const { componentId, value } = descriptor;

    // Handle embellishment descriptors with "embellished with" prefix
    if (componentId === 'descriptors:embellishment') {
      return `embellished with ${value}`;
    }

    // Handle multi-word values that should stay hyphenated
    if (value.includes('-')) {
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
   *
   * @param {string[]} values
   * @returns {string}
   */
  joinDescriptors(values) {
    if (values.length === 0) return '';
    // Simply join all values with commas
    return values.join(', ');
  }

  /**
   * Extract descriptor values from an entity's components
   *
   * @param {object} components - Entity components object
   * @returns {Array<{componentId: string, value: string}>}
   */
  extractDescriptors(components) {
    const descriptors = [];

    // Handle null/undefined components gracefully
    if (!components || typeof components !== 'object') {
      return descriptors;
    }

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
   *
   * @param {string} componentId
   * @param {object} componentData
   * @returns {string|null}
   */
  extractDescriptorValue(componentId, componentData) {
    // Get configured patterns for descriptor values
    const possibleKeys = this.anatomyFormattingService?.getDescriptorValueKeys
      ? this.anatomyFormattingService.getDescriptorValueKeys()
      : this._defaultDescriptorValueKeys;

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

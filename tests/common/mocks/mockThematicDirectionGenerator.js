/**
 * @file Mock implementation of ThematicDirectionGenerator for testing
 */

/**
 * Mock ThematicDirectionGenerator for testing purposes
 */
export class MockThematicDirectionGenerator {
  constructor() {
    this.generateDirections = jest.fn();
  }

  /**
   * Mock implementation that returns empty array by default
   * Can be configured in tests using mockReturnValue or mockImplementation
   */
  async generateDirections(conceptId, characterDescription, options = {}) {
    // Default mock implementation returns empty array
    return [];
  }
}
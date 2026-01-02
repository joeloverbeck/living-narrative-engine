import TargetSelector from '../../../../src/domUI/damage-simulator/TargetSelector.js';

describe('TargetSelector', () => {
  const parts = [
    { id: 'part-a', name: 'Part A', weight: 1 },
    { id: 'part-b', name: 'Part B', weight: 1 },
    { id: 'part-c', name: 'Part C', weight: 1 },
  ];

  describe('constructor', () => {
    it('should accept parts, mode, and focusPartId', () => {
      const selector = new TargetSelector(parts, 'random', 'part-b');
      expect(selector.getNextTarget()).toBeDefined();
    });

    it('should handle empty parts array', () => {
      const selector = new TargetSelector([], 'random', 'part-b');
      expect(selector.getNextTarget()).toBeNull();
    });
  });

  describe('getNextTarget - random mode', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return a valid part id from parts array', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.75);
      const selector = new TargetSelector(parts, 'random', null);
      expect(selector.getNextTarget()).toBe('part-c');
    });

    it('should return null for empty parts', () => {
      const selector = new TargetSelector([], 'random', null);
      expect(selector.getNextTarget()).toBeNull();
    });
  });

  describe('getNextTarget - round-robin mode', () => {
    it('should cycle through parts in order', () => {
      const selector = new TargetSelector(parts, 'round-robin', null);
      expect(selector.getNextTarget()).toBe('part-a');
      expect(selector.getNextTarget()).toBe('part-b');
      expect(selector.getNextTarget()).toBe('part-c');
    });

    it('should wrap around after last part', () => {
      const selector = new TargetSelector(parts, 'round-robin', null);
      selector.getNextTarget();
      selector.getNextTarget();
      selector.getNextTarget();
      expect(selector.getNextTarget()).toBe('part-a');
    });

    it('should return null for empty parts', () => {
      const selector = new TargetSelector([], 'round-robin', null);
      expect(selector.getNextTarget()).toBeNull();
    });
  });

  describe('getNextTarget - focus mode', () => {
    it('should always return focusPartId when parts exist', () => {
      const selector = new TargetSelector(parts, 'focus', 'part-b');
      expect(selector.getNextTarget()).toBe('part-b');
      expect(selector.getNextTarget()).toBe('part-b');
    });

    it('should return null with empty parts', () => {
      const selector = new TargetSelector([], 'focus', 'part-b');
      expect(selector.getNextTarget()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset round-robin index to 0', () => {
      const selector = new TargetSelector(parts, 'round-robin', null);
      selector.getNextTarget();
      selector.getNextTarget();
      selector.reset();
      expect(selector.getNextTarget()).toBe('part-a');
    });

    it('should not affect focus mode output', () => {
      const selector = new TargetSelector(parts, 'focus', 'part-b');
      selector.getNextTarget();
      selector.reset();
      expect(selector.getNextTarget()).toBe('part-b');
    });
  });
});

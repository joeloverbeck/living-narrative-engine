import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Breaching Conditions', () => {
  describe('Event Is Action Saw Through Barred Blocker Condition', () => {
    let condition;

    beforeEach(() => {
      const conditionPath = path.resolve(
        process.cwd(),
        'data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker.condition.json'
      );
      const conditionContent = fs.readFileSync(conditionPath, 'utf8');
      condition = JSON.parse(conditionContent);
    });

    it('should have correct ID', () => {
      expect(condition.id).toBe('breaching:event-is-action-saw-through-barred-blocker');
    });

    it('should have valid logic', () => {
      expect(condition.logic).toBeDefined();
      const logicStr = JSON.stringify(condition.logic);
      expect(logicStr).toContain('breaching:saw_through_barred_blocker');
    });
  });
});

/**
 * @file Integration tests for the positioning:crawl_to action discovery and metadata.
 * @description Tests action metadata validation and basic discoverability requirements.
 */

import { describe, it, expect } from '@jest/globals';
import crawlToAction from '../../../../data/mods/positioning/actions/crawl_to.action.json';

describe('positioning:crawl_to - Action Discovery', () => {
  describe('Action Metadata Validation', () => {
    it('should have correct action structure and properties', () => {
      expect(crawlToAction.id).toBe('positioning:crawl_to');
      expect(crawlToAction.name).toBe('Crawl To');
      expect(crawlToAction.description).toBe(
        'Crawl submissively to the entity you are kneeling before, entering their personal space.'
      );
      expect(crawlToAction.template).toBe('crawl to {target}');

      // Verify targets
      expect(crawlToAction.targets.primary.scope).toBe(
        'positioning:entity_actor_is_kneeling_before'
      );
      expect(crawlToAction.targets.primary.placeholder).toBe('target');

      // Verify required components
      expect(crawlToAction.required_components.actor).toContain(
        'positioning:kneeling_before'
      );

      // Verify forbidden components for actor
      expect(crawlToAction.forbidden_components.actor).toContain(
        'positioning:closeness'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'positioning:sitting_on'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'positioning:bending_over'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'positioning:lying_down'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'positioning:straddling_waist'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'positioning:being_hugged'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'positioning:hugging'
      );

      // Verify forbidden components for primary target
      expect(crawlToAction.forbidden_components.primary).toContain(
        'positioning:kneeling_before'
      );
      expect(crawlToAction.forbidden_components.primary).toContain(
        'positioning:lying_down'
      );
      expect(crawlToAction.forbidden_components.primary).toContain(
        'positioning:bending_over'
      );

      // Verify visual scheme matches get_close
      expect(crawlToAction.visual.backgroundColor).toBe('#bf360c');
      expect(crawlToAction.visual.textColor).toBe('#ffffff');
      expect(crawlToAction.visual.hoverBackgroundColor).toBe('#8d2c08');
      expect(crawlToAction.visual.hoverTextColor).toBe('#ffffff');

      // Verify prerequisites
      expect(crawlToAction.prerequisites).toHaveLength(1);
      expect(crawlToAction.prerequisites[0].logic.condition_ref).toBe(
        'core:actor-mouth-available'
      );
    });
  });

  describe('Discovery Requirements', () => {
    it('should require actor to be kneeling before someone', () => {
      // The action requires positioning:kneeling_before component on actor
      expect(crawlToAction.required_components.actor).toContain(
        'positioning:kneeling_before'
      );
    });

    it('should prevent crawling when already close', () => {
      // The action forbids positioning:closeness component on actor
      expect(crawlToAction.forbidden_components.actor).toContain(
        'positioning:closeness'
      );
    });

    it('should prevent crawling while sitting', () => {
      // The action forbids positioning:sitting_on component on actor
      expect(crawlToAction.forbidden_components.actor).toContain(
        'positioning:sitting_on'
      );
    });

    it('should prevent crawling to kneeling targets', () => {
      // The action forbids positioning:kneeling_before component on target
      expect(crawlToAction.forbidden_components.primary).toContain(
        'positioning:kneeling_before'
      );
    });

    it('should prevent crawling to lying targets', () => {
      // The action forbids positioning:lying_down component on target
      expect(crawlToAction.forbidden_components.primary).toContain(
        'positioning:lying_down'
      );
    });
  });
});

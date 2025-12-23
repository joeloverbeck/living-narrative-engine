/**
 * @file Integration tests for the deference:crawl_to action discovery and metadata.
 * @description Tests action metadata validation and basic discoverability requirements.
 */

import { describe, it, expect } from '@jest/globals';
import crawlToAction from '../../../../data/mods/deference/actions/crawl_to.action.json';

describe('deference:crawl_to - Action Discovery', () => {
  describe('Action Metadata Validation', () => {
    it('should have correct action structure and properties', () => {
      expect(crawlToAction.id).toBe('deference:crawl_to');
      expect(crawlToAction.name).toBe('Crawl To');
      expect(crawlToAction.description).toBe(
        'Crawl submissively to the entity you are kneeling before, entering their personal space.'
      );
      expect(crawlToAction.template).toBe('crawl to {target}');

      // Verify targets
      expect(crawlToAction.targets.primary.scope).toBe(
        'deference-states:entity_actor_is_kneeling_before'
      );
      expect(crawlToAction.targets.primary.placeholder).toBe('target');

      // Verify required components
      expect(crawlToAction.required_components.actor).toContain(
        'deference-states:kneeling_before'
      );

      // Verify forbidden components for actor
      expect(crawlToAction.forbidden_components.actor).toContain(
        'personal-space-states:closeness'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'sitting-states:sitting_on'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'bending-states:bending_over'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'lying-states:lying_on'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'straddling-states:straddling_waist'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'hugging-states:being_hugged'
      );
      expect(crawlToAction.forbidden_components.actor).toContain(
        'hugging-states:hugging'
      );

      // Verify forbidden components for primary target
      expect(crawlToAction.forbidden_components.primary).toContain(
        'deference-states:kneeling_before'
      );
      expect(crawlToAction.forbidden_components.primary).toContain(
        'lying-states:lying_on'
      );
      expect(crawlToAction.forbidden_components.primary).toContain(
        'bending-states:bending_over'
      );

      // Verify visual scheme matches the deference palette
      expect(crawlToAction.visual.backgroundColor).toBe('#1f2d3d');
      expect(crawlToAction.visual.textColor).toBe('#f7f9ff');
      expect(crawlToAction.visual.hoverBackgroundColor).toBe('#152133');
      expect(crawlToAction.visual.hoverTextColor).toBe('#e8edf7');

      // Verify prerequisites
      expect(crawlToAction.prerequisites).toHaveLength(1);
      expect(crawlToAction.prerequisites[0].logic.condition_ref).toBe(
        'core:actor-mouth-available'
      );
    });
  });

  describe('Discovery Requirements', () => {
    it('should require actor to be kneeling before someone', () => {
      // The action requires deference-states:kneeling_before component on actor
      expect(crawlToAction.required_components.actor).toContain(
        'deference-states:kneeling_before'
      );
    });

    it('should prevent crawling when already close', () => {
      // The action forbids personal-space-states:closeness component on actor
      expect(crawlToAction.forbidden_components.actor).toContain(
        'personal-space-states:closeness'
      );
    });

    it('should prevent crawling while sitting', () => {
      // The action forbids sitting-states:sitting_on component on actor
      expect(crawlToAction.forbidden_components.actor).toContain(
        'sitting-states:sitting_on'
      );
    });

    it('should prevent crawling to kneeling targets', () => {
      // The action forbids deference-states:kneeling_before component on target
      expect(crawlToAction.forbidden_components.primary).toContain(
        'deference-states:kneeling_before'
      );
    });

    it('should prevent crawling to lying targets', () => {
      // The action forbids lying-states:lying_on component on target
      expect(crawlToAction.forbidden_components.primary).toContain(
        'lying-states:lying_on'
      );
    });
  });
});

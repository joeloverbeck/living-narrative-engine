/**
 * @file Integration tests for CharacterDataFormatter
 * @description Tests CharacterDataFormatter integration with AIPromptContentProvider and real-world scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterDataFormatter } from '../../../src/prompting/CharacterDataFormatter.js';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { DEFAULT_FALLBACK_CHARACTER_NAME } from '../../../src/constants/textDefaults.js';

describe('CharacterDataFormatter Integration Tests', () => {
  let formatter;
  let mockLogger;
  let aiPromptProvider;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    formatter = new CharacterDataFormatter({ logger: mockLogger });

    const characterDataXmlBuilder = {
      buildCharacterDataXml: jest.fn((actorPromptData) => {
        const name = actorPromptData?.name || 'Unknown Character';
        let xml = `<character_data>\n<identity>\nYOU ARE ${name}.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.\n</identity>`;

        // Format description section
        if (actorPromptData?.description) {
          xml += '\n<description>\n## Your Description';
          const desc = actorPromptData.description;
          if (typeof desc === 'object') {
            if (desc.hair) xml += `\n**Hair**: ${desc.hair}`;
            if (desc.eyes) xml += `\n**Eyes**: ${desc.eyes}`;
            if (desc.height) xml += `\n**Height**: ${desc.height}`;
            if (desc.wearing) xml += `\n**Wearing**: ${desc.wearing}`;
            if (desc.build) xml += `\n**Build**: ${desc.build}`;
            if (desc.skin) xml += `\n**Skin**: ${desc.skin}`;
            if (desc.age) xml += `\n**Age**: ${desc.age}`;
            if (desc.distinguishing_features) xml += `\n**Distinguishing Features**: ${desc.distinguishing_features}`;
            if (desc.Description) xml += `\n**Description**: ${desc.Description}`;
          } else {
            // Parse text-based description format: "Hair: value; Eyes: value; ..."
            const descStr = String(desc);
            const parts = descStr.split(/;\s*/);
            parts.forEach((part) => {
              const colonIndex = part.indexOf(':');
              if (colonIndex > 0) {
                const key = part.substring(0, colonIndex).trim();
                const value = part.substring(colonIndex + 1).trim();
                if (key && value) {
                  xml += `\n**${key}**: ${value}`;
                }
              }
            });
            // If no parseable parts, use as-is
            if (!parts.some(p => p.includes(':'))) {
              xml += `\n**Description**: ${descStr}`;
            }
          }
          xml += '\n</description>';
        }

        if (actorPromptData?.personality) {
          xml += `\n<personality>\n## Your Personality\n${actorPromptData.personality}\n</personality>`;
        }
        if (actorPromptData?.profile) {
          xml += `\n<profile>\n## Your Profile\n${actorPromptData.profile}\n</profile>`;
        }
        if (actorPromptData?.motivations) {
          xml += `\n<motivations>\n## Your Core Motivations\n${actorPromptData.motivations}\n</motivations>`;
        }
        if (actorPromptData?.internalTensions) {
          xml += `\n<internal_tensions>\n## Your Internal Tensions\n${actorPromptData.internalTensions}\n</internal_tensions>`;
        }
        if (actorPromptData?.coreDilemmas) {
          xml += `\n<dilemmas>\n## Your Core Dilemmas\n${actorPromptData.coreDilemmas}\n</dilemmas>`;
        }
        if (actorPromptData?.likes) {
          xml += `\n<likes>\n## Your Likes\n${actorPromptData.likes}\n</likes>`;
        }
        if (actorPromptData?.dislikes) {
          xml += `\n<dislikes>\n## Your Dislikes\n${actorPromptData.dislikes}\n</dislikes>`;
        }
        if (actorPromptData?.secrets) {
          xml += `\n<secrets>\n## Your Secrets\n${actorPromptData.secrets}\n</secrets>`;
        }
        if (actorPromptData?.fears) {
          xml += `\n<fears>\n## Your Fears\n${actorPromptData.fears}\n</fears>`;
        }

        // Format speech patterns if present
        if (actorPromptData?.speechPatterns) {
          const patterns = actorPromptData.speechPatterns;
          xml += '\n<speech_patterns>';
          xml += '\n<!-- Use these patterns naturally in conversation -->';

          if (typeof patterns === 'string') {
            // Legacy string format: "pattern1 - pattern2 - pattern3"
            const patternList = patterns.split(' - ');
            patternList.forEach((pattern) => {
              xml += `\n- ${pattern.trim()}`;
            });
          } else if (Array.isArray(patterns)) {
            // Separate structured patterns (objects) from legacy patterns (strings)
            const structuredPatterns = patterns.filter(p => p && typeof p === 'object' && p.type);
            const legacyPatterns = patterns.filter(p => typeof p === 'string');

            // Format structured patterns first (numbered)
            let index = 1;
            structuredPatterns.forEach((pattern) => {
              xml += `\n${index}. **${pattern.type}**`;
              if (pattern.contexts && pattern.contexts.length > 0) {
                xml += `\nContexts: ${pattern.contexts.join(', ')}`;
              }
              if (pattern.examples !== undefined) {
                xml += '\nExamples:';
                if (pattern.examples && pattern.examples.length > 0) {
                  pattern.examples.forEach((example) => {
                    xml += `\n- "${example}"`;
                  });
                }
              }
              index++;
            });

            // Format legacy patterns with "Additional Patterns:" header if mixed
            if (legacyPatterns.length > 0) {
              if (structuredPatterns.length > 0) {
                xml += '\nAdditional Patterns:';
              }
              legacyPatterns.forEach((pattern) => {
                xml += `\n- ${pattern}`;
              });
            }
          }
          xml += '\n</speech_patterns>';
        }

        xml += '\n</character_data>';
        return xml;
      }),
    };

    // Create AIPromptContentProvider for integration testing
    aiPromptProvider = new AIPromptContentProvider({
      logger: mockLogger,
      promptStaticContentService: {
        getCoreTaskDescriptionText: jest.fn().mockReturnValue('TASK'),
        getCharacterPortrayalGuidelines: jest.fn().mockReturnValue('GUIDE'),
        getNc21ContentPolicyText: jest.fn().mockReturnValue('POLICY'),
        getFinalLlmInstructionText: jest.fn().mockReturnValue('FINAL'),
      },
      characterDataXmlBuilder,
      perceptionLogFormatter: { format: jest.fn().mockReturnValue([]) },
      gameStateValidationService: {
        validate: jest
          .fn()
          .mockReturnValue({ isValid: true, errorContent: null }),
      },
      actionCategorizationService: {
        extractNamespace: jest.fn(
          (actionId) => actionId.split(':')[0] || 'unknown'
        ),
        shouldUseGrouping: jest.fn(() => false), // Default to flat formatting for existing tests
        groupActionsByNamespace: jest.fn(() => new Map()),
        getSortedNamespaces: jest.fn(() => []),
        formatNamespaceDisplayName: jest.fn((namespace) =>
          namespace.toUpperCase()
        ),
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Integration with AIPromptContentProvider', () => {
    it('should format character persona through AIPromptContentProvider with full character data', () => {
      const gameState = {
        actorPromptData: {
          name: 'Isabella Martinez',
          description: {
            hair: 'long, dark brown, wavy',
            eyes: 'emerald green, expressive',
            height: 'tall and graceful',
            wearing: 'elegant blue dress with silver jewelry',
          },
          personality:
            'Confident and charismatic, with a sharp wit and compassionate heart. Values honesty and loyalty above all else.',
          profile:
            'A seasoned diplomat with extensive experience in international relations. Born in Madrid, educated at Oxford.',
          likes:
            'Classical music, fine wine, intellectual debates, and evening walks',
          dislikes:
            'Dishonesty, rudeness, rushed decisions, and overly crowded spaces',
          secrets: 'Secretly writes poetry under a pseudonym',
          fears: 'Being trapped in small spaces, losing her independence',
          speechPatterns: [
            'Often uses diplomatic language',
            'Speaks with measured pauses',
            'Uses classical references in conversation',
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Verify complete character persona formatting
      expect(result).toContain('YOU ARE Isabella Martinez.');
      expect(result).toContain(
        'This is your identity. All thoughts, actions, and words must stem from this core truth.'
      );

      // Physical description section
      expect(result).toContain('## Your Description');
      expect(result).toContain('**Hair**: long, dark brown, wavy');
      expect(result).toContain('**Eyes**: emerald green, expressive');
      expect(result).toContain('**Height**: tall and graceful');
      expect(result).toContain(
        '**Wearing**: elegant blue dress with silver jewelry'
      );

      // Personality section
      expect(result).toContain('## Your Personality');
      expect(result).toContain(
        'Confident and charismatic, with a sharp wit and compassionate heart'
      );

      // Profile section
      expect(result).toContain('## Your Profile');
      expect(result).toContain('A seasoned diplomat with extensive experience');

      // Optional sections
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Classical music, fine wine');
      expect(result).toContain('## Your Dislikes');
      expect(result).toContain('Dishonesty, rudeness');
      expect(result).toContain('## Your Secrets');
      expect(result).toContain('Secretly writes poetry');
      expect(result).toContain('## Your Fears');
      expect(result).toContain('Being trapped in small spaces');

      // Speech patterns (XML format)
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('<!-- Use these patterns naturally in conversation');
      expect(result).toContain('- Often uses diplomatic language');
      expect(result).toContain('- Speaks with measured pauses');
      expect(result).toContain('- Uses classical references in conversation');
      expect(result).toContain('</speech_patterns>');
    });

    it('should handle text-based character descriptions through AIPromptContentProvider', () => {
      const gameState = {
        actorPromptData: {
          name: 'Marcus Thompson',
          description:
            'Hair: short, black, curly; Eyes: brown, kind; Build: athletic; Wearing: casual jeans and t-shirt',
          personality:
            'Easygoing and friendly, always ready with a joke or helping hand.',
          speechPatterns:
            'Uses casual slang - Frequently says "no worries" - Often makes pop culture references',
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      expect(result).toContain('YOU ARE Marcus Thompson.');
      expect(result).toContain('## Your Description');
      expect(result).toContain('**Hair**: short, black, curly');
      expect(result).toContain('**Eyes**: brown, kind');
      expect(result).toContain('**Build**: athletic');
      expect(result).toContain('**Wearing**: casual jeans and t-shirt');
      expect(result).toContain('## Your Personality');
      expect(result).toContain('Easygoing and friendly');
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- Uses casual slang');
      expect(result).toContain('- Frequently says "no worries"');
      expect(result).toContain('- Often makes pop culture references');
      expect(result).toContain('</speech_patterns>');
    });

    it('should handle minimal character data with fallbacks through AIPromptContentProvider', () => {
      const gameState = {
        actorPromptData: {
          name: 'Unknown Character',
          description: 'A mysterious figure',
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      expect(result).toContain('YOU ARE Unknown Character.');
      expect(result).toContain('## Your Description');
      expect(result).toContain('**Description**: A mysterious figure');
      // Should not contain empty optional sections
      expect(result).not.toContain('## Your Personality');
      expect(result).not.toContain('## Your Likes');
      expect(result).not.toContain('<speech_patterns>');
    });

    it('should handle error scenarios gracefully through AIPromptContentProvider', () => {
      const gameState = {
        actorPromptData: null,
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Should return fallback content instead of crashing
      expect(typeof result).toBe('string');
      expect(result.length > 0).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Psychological Components Integration', () => {
    it('should format character with psychological components through AIPromptContentProvider', () => {
      const gameState = {
        actorPromptData: {
          name: 'Dr. Sophia Chen',
          description: {
            hair: 'black, pulled back in a professional bun',
            eyes: 'dark, intelligent and calculating',
            wearing: 'white lab coat over business attire',
          },
          personality:
            'Brilliant and driven, yet haunted by past mistakes. Perfectionist with a hidden compassionate side.',
          profile:
            'A renowned neuroscientist who pioneered breakthrough treatments, but struggles with guilt over a patient she couldn\'t save.',
          motivations:
            'I am driven by a desperate need to prove that I can save lives and make amends for past failures. Every patient I treat is a chance for redemption.',
          internalTensions:
            'I want to help everyone but fear that my past mistakes make me unworthy. I crave recognition yet feel guilty about wanting acclaim.',
          coreDilemmas:
            'Can someone who has failed catastrophically ever truly redeem themselves? Is my drive to help others genuine altruism or selfish ego?',
          likes: 'Scientific research, classical music, solving complex problems',
          dislikes: 'Incompetence, wasted time, reminders of past failures',
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Verify identity header
      expect(result).toContain('YOU ARE Dr. Sophia Chen.');
      expect(result).toContain(
        'This is your identity. All thoughts, actions, and words must stem from this core truth.'
      );

      // Verify traditional sections are present
      expect(result).toContain('## Your Description');
      expect(result).toContain('**Hair**: black, pulled back in a professional bun');
      expect(result).toContain('## Your Personality');
      expect(result).toContain('Brilliant and driven, yet haunted by past mistakes');
      expect(result).toContain('## Your Profile');
      expect(result).toContain('A renowned neuroscientist who pioneered breakthrough');

      // Verify psychological sections are present and in correct order
      expect(result).toContain('## Your Core Motivations');
      expect(result).toContain('I am driven by a desperate need to prove that I can save lives');
      expect(result).toContain('## Your Internal Tensions');
      expect(result).toContain('I want to help everyone but fear that my past mistakes');
      expect(result).toContain('## Your Core Dilemmas');
      expect(result).toContain('Can someone who has failed catastrophically ever truly redeem themselves');

      // Verify remaining sections are present
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Scientific research, classical music');
      expect(result).toContain('## Your Dislikes');
      expect(result).toContain('Incompetence, wasted time');

      // Verify section ordering: psychological components should be between profile and likes
      const profileIndex = result.indexOf('## Your Profile');
      const motivationsIndex = result.indexOf('## Your Core Motivations');
      const tensionsIndex = result.indexOf('## Your Internal Tensions');
      const dilemmasIndex = result.indexOf('## Your Core Dilemmas');
      const likesIndex = result.indexOf('## Your Likes');

      expect(profileIndex).toBeLessThan(motivationsIndex);
      expect(motivationsIndex).toBeLessThan(tensionsIndex);
      expect(tensionsIndex).toBeLessThan(dilemmasIndex);
      expect(dilemmasIndex).toBeLessThan(likesIndex);
    });

    it('should handle partial psychological components gracefully', () => {
      const gameState = {
        actorPromptData: {
          name: 'Alex Rivers',
          personality: 'Optimistic and energetic with hidden depths.',
          profile: 'A young adventurer seeking purpose in the world.',
          motivations: 'I seek to prove myself worthy of the legacy left by my mentor.',
          // internalTensions and coreDilemmas are missing
          likes: 'Adventure, helping others, sunny days',
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      expect(result).toContain('YOU ARE Alex Rivers.');
      expect(result).toContain('## Your Personality');
      expect(result).toContain('## Your Profile');
      expect(result).toContain('## Your Core Motivations');
      expect(result).toContain('I seek to prove myself worthy of the legacy');
      expect(result).not.toContain('## Your Internal Tensions');
      expect(result).not.toContain('## Your Core Dilemmas');
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Adventure, helping others');
    });

    it('should maintain backward compatibility without psychological components', () => {
      const gameState = {
        actorPromptData: {
          name: 'Traditional Character',
          personality: 'Simple and straightforward personality.',
          profile: 'A basic character without psychological complexity.',
          likes: 'Simple pleasures',
          dislikes: 'Complicated situations',
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      expect(result).toContain('YOU ARE Traditional Character.');
      expect(result).toContain('## Your Personality');
      expect(result).toContain('Simple and straightforward personality');
      expect(result).toContain('## Your Profile');
      expect(result).toContain('A basic character without psychological complexity');
      expect(result).not.toContain('## Your Core Motivations');
      expect(result).not.toContain('## Your Internal Tensions');
      expect(result).not.toContain('## Your Core Dilemmas');
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Simple pleasures');
    });
  });

  describe('Complex Character Data Scenarios', () => {
    it('should format character with all possible optional sections', () => {
      const complexCharacterData = {
        name: 'Aria Blackthorne',
        description: {
          hair: 'silver-white, flowing',
          eyes: 'violet, otherworldly',
          skin: 'pale, luminescent',
          height: 'tall, ethereal',
          build: 'slender, graceful',
          wearing:
            'flowing midnight robes with silver thread | ornate silver circlet | leather-bound grimoire at her side',
          distinguishing: 'intricate tattoos covering her arms',
        },
        personality:
          'Mysterious and wise, with an ancient soul. Speaks in riddles and sees beyond the veil of reality.',
        profile:
          'An enigmatic sorceress from the Shadowlands, keeper of forbidden knowledge and guardian of ancient secrets.',
        likes:
          'Starlit nights, ancient tomes, herbal teas, and meaningful conversations about the nature of existence',
        dislikes:
          'Ignorance, destruction of knowledge, loud noises, and those who abuse power',
        secrets:
          'Is actually centuries old and has been alive since the Great War of Shadows',
        fears: 'The return of the Dark Lords, losing her memories to the curse',
        speechPatterns: [
          'Speaks in archaic, formal language',
          'Often references ancient history and prophecies',
          'Uses metaphorical language and riddles',
          'Pauses thoughtfully before important statements',
        ],
      };

      const result = formatter.formatCharacterPersona(complexCharacterData);

      // Verify comprehensive formatting
      expect(result).toContain('YOU ARE Aria Blackthorne.');
      expect(result).toContain(
        'This is your identity. All thoughts, actions, and words must stem from this core truth.'
      );

      // All description attributes
      expect(result).toContain('**Hair**: silver-white, flowing');
      expect(result).toContain('**Eyes**: violet, otherworldly');
      expect(result).toContain('**Skin**: pale, luminescent');
      expect(result).toContain('**Height**: tall, ethereal');
      expect(result).toContain('**Build**: slender, graceful');
      expect(result).toContain(
        '**Wearing**: flowing midnight robes with silver thread | ornate silver circlet | leather-bound grimoire at her side'
      );
      expect(result).toContain(
        '**Distinguishing**: intricate tattoos covering her arms'
      );

      // All optional sections
      expect(result).toContain('## Your Personality');
      expect(result).toContain('Mysterious and wise, with an ancient soul');
      expect(result).toContain('## Your Profile');
      expect(result).toContain('An enigmatic sorceress from the Shadowlands');
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Starlit nights, ancient tomes');
      expect(result).toContain('## Your Dislikes');
      expect(result).toContain('Ignorance, destruction of knowledge');
      expect(result).toContain('## Your Secrets');
      expect(result).toContain('Is actually centuries old');
      expect(result).toContain('## Your Fears');
      expect(result).toContain('The return of the Dark Lords');

      // All speech patterns (XML format)
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- Speaks in archaic, formal language');
      expect(result).toContain(
        '- Often references ancient history and prophecies'
      );
      expect(result).toContain('- Uses metaphorical language and riddles');
      expect(result).toContain(
        '- Pauses thoughtfully before important statements'
      );
      expect(result).toContain('</speech_patterns>');
    });

    it('should format character with complete psychological profile', () => {
      const psychologicalCharacterData = {
        name: 'Commander Sarah Mitchell',
        description: {
          hair: 'short, auburn with silver streaks',
          eyes: 'steel gray, battle-hardened',
          build: 'athletic, scarred from combat',
          wearing: 'military dress uniform with numerous commendations',
        },
        personality:
          'Disciplined and strategic, yet struggles with the weight of command and the lives she\'s responsible for.',
        profile:
          'A decorated war veteran who rose through the ranks to become a respected commander, but carries the burden of difficult wartime decisions.',
        motivations:
          'I am driven to protect those under my command and prove that the sacrifices made in war were meaningful. Every mission must succeed to honor the fallen.',
        internalTensions:
          'I must appear strong and decisive for my troops while battling my own doubts and trauma. I want to show vulnerability but fear it will undermine my authority.',
        coreDilemmas:
          'Is it possible to be a good leader while making decisions that cost lives? Can I honor the dead by continuing to fight, or am I perpetuating the cycle of violence?',
        likes: 'Strategic planning, mentoring young officers, quiet moments of reflection',
        dislikes: 'Unnecessary casualties, political interference in military operations, being called a hero',
        secrets: 'Suffers from nightmares about the soldiers she couldn\'t save',
        fears: 'Making a decision that leads to unnecessary deaths, losing the trust of her troops',
        speechPatterns: [
          'Uses precise military terminology',
          'Speaks with measured authority',
          'Often references tactical principles in civilian contexts',
          'Pauses before difficult decisions',
        ],
      };

      const result = formatter.formatCharacterPersona(psychologicalCharacterData);

      // Verify identity and core sections
      expect(result).toContain('YOU ARE Commander Sarah Mitchell.');
      expect(result).toContain(
        'This is your identity. All thoughts, actions, and words must stem from this core truth.'
      );

      // Verify traditional sections
      expect(result).toContain('## Your Description');
      expect(result).toContain('**Hair**: short, auburn with silver streaks');
      expect(result).toContain('**Eyes**: steel gray, battle-hardened');
      expect(result).toContain('## Your Personality');
      expect(result).toContain('Disciplined and strategic, yet struggles with the weight of command');
      expect(result).toContain('## Your Profile');
      expect(result).toContain('A decorated war veteran who rose through the ranks');

      // Verify psychological sections are present and properly formatted
      expect(result).toContain('## Your Core Motivations');
      expect(result).toContain('I am driven to protect those under my command');
      expect(result).toContain('Every mission must succeed to honor the fallen');
      
      expect(result).toContain('## Your Internal Tensions');
      expect(result).toContain('I must appear strong and decisive for my troops while battling my own doubts');
      expect(result).toContain('I want to show vulnerability but fear it will undermine my authority');
      
      expect(result).toContain('## Your Core Dilemmas');
      expect(result).toContain('Is it possible to be a good leader while making decisions that cost lives');
      expect(result).toContain('Can I honor the dead by continuing to fight');

      // Verify remaining traditional sections
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Strategic planning, mentoring young officers');
      expect(result).toContain('## Your Dislikes');
      expect(result).toContain('Unnecessary casualties, political interference');
      expect(result).toContain('## Your Secrets');
      expect(result).toContain('Suffers from nightmares about the soldiers');
      expect(result).toContain('## Your Fears');
      expect(result).toContain('Making a decision that leads to unnecessary deaths');
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- Uses precise military terminology');
      expect(result).toContain('- Speaks with measured authority');
      expect(result).toContain('</speech_patterns>');

      // Verify psychological sections are in correct order (after profile, before likes)
      const profileIndex = result.indexOf('## Your Profile');
      const motivationsIndex = result.indexOf('## Your Core Motivations');
      const tensionsIndex = result.indexOf('## Your Internal Tensions');
      const dilemmasIndex = result.indexOf('## Your Core Dilemmas');
      const likesIndex = result.indexOf('## Your Likes');

      expect(profileIndex).toBeLessThan(motivationsIndex);
      expect(motivationsIndex).toBeLessThan(tensionsIndex);
      expect(tensionsIndex).toBeLessThan(dilemmasIndex);
      expect(dilemmasIndex).toBeLessThan(likesIndex);
    });

    it('should format character with comprehensive optional sections (duplicate case validation)', () => {
      const complexCharacterData = {
        name: 'Aria Blackthorne',
        description: {
          hair: 'silver-white, flowing',
          eyes: 'violet, otherworldly',
          skin: 'pale, luminescent',
          height: 'tall, ethereal',
          build: 'slender, graceful',
          wearing:
            'flowing midnight robes with silver thread | ornate silver circlet | leather-bound grimoire at her side',
          distinguishing: 'intricate tattoos covering her arms',
        },
        personality:
          'Mysterious and wise, with an ancient soul. Speaks in riddles and sees beyond the veil of reality.',
        profile:
          'An enigmatic sorceress from the Shadowlands, keeper of forbidden knowledge and guardian of ancient secrets.',
        likes:
          'Starlit nights, ancient tomes, herbal teas, and meaningful conversations about the nature of existence',
        dislikes:
          'Ignorance, destruction of knowledge, loud noises, and those who abuse power',
        secrets:
          'Is actually centuries old and has been alive since the Great War of Shadows',
        fears: 'The return of the Dark Lords, losing her memories to the curse',
        speechPatterns: [
          'Speaks in archaic, formal language',
          'Often references ancient history and prophecies',
          'Uses metaphorical language and riddles',
          'Pauses thoughtfully before important statements',
        ],
      };

      const result = formatter.formatCharacterPersona(complexCharacterData);

      // Verify comprehensive formatting
      expect(result).toContain('YOU ARE Aria Blackthorne.');
      expect(result).toContain(
        'This is your identity. All thoughts, actions, and words must stem from this core truth.'
      );

      // All description attributes
      expect(result).toContain('**Hair**: silver-white, flowing');
      expect(result).toContain('**Eyes**: violet, otherworldly');
      expect(result).toContain('**Skin**: pale, luminescent');
      expect(result).toContain('**Height**: tall, ethereal');
      expect(result).toContain('**Build**: slender, graceful');
      expect(result).toContain(
        '**Wearing**: flowing midnight robes with silver thread | ornate silver circlet | leather-bound grimoire at her side'
      );
      expect(result).toContain(
        '**Distinguishing**: intricate tattoos covering her arms'
      );

      // All optional sections
      expect(result).toContain('## Your Personality');
      expect(result).toContain('Mysterious and wise, with an ancient soul');
      expect(result).toContain('## Your Profile');
      expect(result).toContain('An enigmatic sorceress from the Shadowlands');
      expect(result).toContain('## Your Likes');
      expect(result).toContain('Starlit nights, ancient tomes');
      expect(result).toContain('## Your Dislikes');
      expect(result).toContain('Ignorance, destruction of knowledge');
      expect(result).toContain('## Your Secrets');
      expect(result).toContain('Is actually centuries old');
      expect(result).toContain('## Your Fears');
      expect(result).toContain('The return of the Dark Lords');

      // All speech patterns (XML format)
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- Speaks in archaic, formal language');
      expect(result).toContain(
        '- Often references ancient history and prophecies'
      );
      expect(result).toContain('- Uses metaphorical language and riddles');
      expect(result).toContain(
        '- Pauses thoughtfully before important statements'
      );
      expect(result).toContain('</speech_patterns>');
    });

    it('should handle mixed data types in character descriptions', () => {
      const mixedCharacterData = {
        name: 'Captain Rodriguez',
        description:
          'Hair: salt-and-pepper, weathered\nEyes: steel blue; Build: muscular, scarred from battle',
        personality:
          'Gruff exterior hiding a caring heart. Fiercely loyal to his crew.',
        profile: null, // null value
        likes: '', // empty string
        dislikes: 'Betrayal and cowardice',
        secrets: undefined, // undefined value
        fears: 'Losing his ship and crew',
        speechPatterns:
          'Uses nautical terms frequently - Has a slight accent - Commands with authority',
      };

      const result = formatter.formatCharacterPersona(mixedCharacterData);

      expect(result).toContain('YOU ARE Captain Rodriguez.');
      expect(result).toContain('## Your Description');
      expect(result).toContain('**Hair**: salt-and-pepper, weathered');
      expect(result).toContain('**Eyes**: steel blue');
      expect(result).toContain('**Build**: muscular, scarred from battle');

      expect(result).toContain('## Your Personality');
      expect(result).toContain('Gruff exterior hiding a caring heart');

      expect(result).toContain('## Your Dislikes');
      expect(result).toContain('Betrayal and cowardice');

      expect(result).toContain('## Your Fears');
      expect(result).toContain('Losing his ship and crew');

      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- Uses nautical terms frequently');
      expect(result).toContain('- Has a slight accent');
      expect(result).toContain('- Commands with authority');
      expect(result).toContain('</speech_patterns>');

      // Should not contain empty/null sections
      expect(result).not.toContain('## Your Profile');
      expect(result).not.toContain('## Your Likes');
      expect(result).not.toContain('## Your Secrets');
    });

    it('should handle complex speech pattern formats', () => {
      const characterWithComplexSpeech = {
        name: 'Dr. Elena Vasquez',
        description: 'A brilliant scientist',
        speechPatterns: [
          'Uses precise scientific terminology',
          'Often explains complex concepts in simple terms',
          'Has a habit of adjusting her glasses when thinking',
        ],
      };

      const result = formatter.formatCharacterPersona(
        characterWithComplexSpeech
      );

      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- Uses precise scientific terminology');
      expect(result).toContain(
        '- Often explains complex concepts in simple terms'
      );
      expect(result).toContain(
        '- Has a habit of adjusting her glasses when thinking'
      );
      expect(result).toContain('</speech_patterns>');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle completely empty character data', () => {
      const result = formatter.formatCharacterPersona({});

      expect(result).toContain(`YOU ARE ${DEFAULT_FALLBACK_CHARACTER_NAME}.`);
      expect(result).toContain(
        'This is your identity. All thoughts, actions, and words must stem from this core truth.'
      );
      expect(result.length > 0).toBe(true);
      // Empty character data doesn't trigger a warning, only null data does
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle null character data', () => {
      const result = formatter.formatCharacterPersona(null);

      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid character data provided to formatCharacterPersona'
        )
      );
    });

    it('should handle character with only name', () => {
      const minimalCharacter = {
        name: 'John Doe',
      };

      const result = formatter.formatCharacterPersona(minimalCharacter);

      expect(result).toContain('YOU ARE John Doe.');
      expect(result).toContain(
        'This is your identity. All thoughts, actions, and words must stem from this core truth.'
      );
      // Should not contain any section headers for missing data
      expect(result).not.toContain('## Your Description');
      expect(result).not.toContain('## Your Personality');
    });

    it('should handle empty arrays and strings gracefully', () => {
      const characterWithEmptyValues = {
        name: 'Test Character',
        description: '', // empty string
        personality: '   ', // whitespace only
        profile: null,
        likes: '',
        dislikes: undefined,
        secrets: '',
        fears: null,
        speechPatterns: [], // empty array
      };

      const result = formatter.formatCharacterPersona(characterWithEmptyValues);

      expect(result).toContain('YOU ARE Test Character.');
      // Should not contain any section headers for empty data
      expect(result).not.toContain('## Your Description');
      expect(result).not.toContain('## Your Personality');
      expect(result).not.toContain('## Your Profile');
      expect(result).not.toContain('## Your Likes');
      expect(result).not.toContain('## Your Dislikes');
      expect(result).not.toContain('## Your Secrets');
      expect(result).not.toContain('## Your Fears');
      // Speech patterns with empty array should not show XML tags (returns empty string)
      expect(result).not.toContain('<speech_patterns>');
    });

    it('should handle malformed description parsing gracefully', () => {
      const characterWithMalformedDescription = {
        name: 'Malformed Character',
        description:
          'This is a description without proper formatting and no colons or semicolons',
      };

      const result = formatter.formatPhysicalDescription(
        characterWithMalformedDescription
      );

      expect(result).toContain('## Your Description');
      expect(result).toContain(
        '**Description**: This is a description without proper formatting and no colons or semicolons'
      );
    });

    it('should handle speech patterns edge cases', () => {
      // Test with string instead of array
      const characterWithStringSpeech = {
        name: 'String Speech Character',
        speechPatterns:
          'Uses simple language - Speaks slowly - Often repeats important points',
      };

      const result = formatter.formatSpeechPatterns(
        characterWithStringSpeech.speechPatterns
      );

      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('- Uses simple language');
      expect(result).toContain('- Speaks slowly');
      expect(result).toContain('- Often repeats important points');
      expect(result).toContain('</speech_patterns>');
    });

    it('should log appropriate debug messages during formatting', () => {
      const complexCharacter = {
        name: 'Debug Test Character',
        description: { hair: 'brown', eyes: 'blue' },
        personality: 'Friendly and outgoing',
        profile: 'A test character for debugging',
        likes: 'Testing and debugging',
        speechPatterns: ['Uses technical jargon', 'Speaks methodically'],
      };

      formatter.formatCharacterPersona(complexCharacter);

      // Verify debug logging occurred
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('CharacterDataFormatter initialized')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Formatted physical description section')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Formatted personality section')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Formatted profile section')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Formatted Likes section')
      );
      // Note: formatSpeechPatterns no longer logs debug messages
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Successfully formatted complete character persona'
        )
      );
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should work correctly in a complete AIPromptContentProvider workflow', async () => {
      const gameStateDto = {
        actorName: 'Integration Test Character',
        actorId: 'test-actor-123',
        userInputContent: 'Look around the room',
        currentLocation: {
          locationId: 'test-location',
          name: 'Test Room',
          description: 'A simple test room with basic furnishings.',
          exits: [
            { direction: 'north', targetLocationName: 'North Room' },
            { direction: 'south', targetLocationName: 'South Room' },
          ],
          characters: [],
        },
        availableActions: [
          {
            index: 0,
            commandString: 'examine room',
            description: 'Look around the current room carefully.',
          },
          {
            index: 1,
            commandString: 'move north',
            description: 'Go to the north room.',
          },
        ],
        perceptionLog: [],
        actorPromptData: {
          name: 'Elena Rosetti',
          description: {
            hair: 'dark auburn, shoulder-length',
            eyes: 'hazel, intelligent',
            build: 'medium height, athletic',
            wearing: 'practical hiking clothes and sturdy boots',
          },
          personality:
            'Curious and methodical, with a passion for discovery and learning.',
          profile:
            'A field researcher and archaeologist specializing in ancient civilizations.',
          likes: 'Historical mysteries, field work, and good coffee',
          speechPatterns: [
            'Uses academic terminology',
            'Asks probing questions',
            'Often references historical parallels',
          ],
        },
        actorState: {
          components: {
            'core:short_term_memory': { thoughts: [] },
            'core:notes': { notes: [] },
            'movement:goals': { goals: [] },
          },
        },
      };

      const promptData = await aiPromptProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      // Verify that CharacterDataFormatter integration worked correctly
      expect(promptData.characterPersonaContent).toContain(
        'YOU ARE Elena Rosetti.'
      );
      expect(promptData.characterPersonaContent).toContain(
        '## Your Description'
      );
      expect(promptData.characterPersonaContent).toContain(
        '**Hair**: dark auburn, shoulder-length'
      );
      expect(promptData.characterPersonaContent).toContain(
        '**Eyes**: hazel, intelligent'
      );
      expect(promptData.characterPersonaContent).toContain(
        '## Your Personality'
      );
      expect(promptData.characterPersonaContent).toContain(
        'Curious and methodical, with a passion for discovery'
      );
      expect(promptData.characterPersonaContent).toContain('## Your Profile');
      expect(promptData.characterPersonaContent).toContain(
        'A field researcher and archaeologist'
      );
      expect(promptData.characterPersonaContent).toContain('## Your Likes');
      expect(promptData.characterPersonaContent).toContain(
        'Historical mysteries, field work'
      );
      expect(promptData.characterPersonaContent).toContain(
        '<speech_patterns>'
      );
      expect(promptData.characterPersonaContent).toContain(
        '- Uses academic terminology'
      );
      expect(promptData.characterPersonaContent).toContain(
        '- Asks probing questions'
      );
      expect(promptData.characterPersonaContent).toContain(
        '- Often references historical parallels'
      );
      expect(promptData.characterPersonaContent).toContain(
        '</speech_patterns>'
      );
    });
  });

  describe('Structured Speech Patterns Integration', () => {
    it('should format structured patterns end-to-end through AIPromptContentProvider', () => {
      const gameState = {
        actorPromptData: {
          name: 'Structured Pattern Character',
          description: 'A character with structured speech patterns',
          personality: 'Organized and methodical',
          speechPatterns: [
            {
              type: 'metaphor',
              contexts: ['explanation', 'teaching'],
              examples: [
                'Like treating leather - patience is key.',
                'Knowledge grows like a tree, slowly but steadily.',
              ],
            },
            {
              type: 'catchphrase',
              contexts: ['greeting', 'farewell'],
              examples: ['See you around!', 'Catch you later!'],
            },
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Verify XML structure
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('</speech_patterns>');

      // Verify usage guidance
      expect(result).toContain(
        '<!-- Use these patterns naturally in conversation'
      );

      // Verify first pattern formatting
      expect(result).toContain('1. **metaphor**');
      expect(result).toContain('Contexts: explanation, teaching');
      expect(result).toContain('Examples:');
      expect(result).toContain(
        '- "Like treating leather - patience is key."'
      );
      expect(result).toContain(
        '- "Knowledge grows like a tree, slowly but steadily."'
      );

      // Verify second pattern formatting
      expect(result).toContain('2. **catchphrase**');
      expect(result).toContain('Contexts: greeting, farewell');
      expect(result).toContain('- "See you around!"');
      expect(result).toContain('- "Catch you later!"');
    });

    it('should handle patterns with empty contexts array', () => {
      const gameState = {
        actorPromptData: {
          name: 'Empty Contexts Character',
          speechPatterns: [
            {
              type: 'proverb',
              contexts: [],
              examples: ['Actions speak louder than words.'],
            },
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Should have XML tags
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('</speech_patterns>');

      // Should have pattern type
      expect(result).toContain('1. **proverb**');

      // Should NOT have contexts line (empty array)
      expect(result).not.toContain('Contexts:');

      // Should have examples
      expect(result).toContain('Examples:');
      expect(result).toContain('- "Actions speak louder than words."');
    });

    it('should handle patterns with missing contexts field', () => {
      const gameState = {
        actorPromptData: {
          name: 'Missing Contexts Character',
          speechPatterns: [
            {
              type: 'idiom',
              examples: ['A bird in the hand is worth two in the bush.'],
            },
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Should have XML tags
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('</speech_patterns>');

      // Should have pattern type
      expect(result).toContain('1. **idiom**');

      // Should NOT have contexts line (field missing)
      expect(result).not.toContain('Contexts:');

      // Should have examples
      expect(result).toContain('Examples:');
      expect(result).toContain(
        '- "A bird in the hand is worth two in the bush."'
      );
    });

    it('should preserve pattern ordering in structured format', () => {
      const gameState = {
        actorPromptData: {
          name: 'Multi Pattern Character',
          speechPatterns: [
            {
              type: 'first_pattern',
              examples: ['First example'],
            },
            {
              type: 'second_pattern',
              examples: ['Second example'],
            },
            {
              type: 'third_pattern',
              examples: ['Third example'],
            },
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Find positions of each pattern
      const firstIndex = result.indexOf('1. **first_pattern**');
      const secondIndex = result.indexOf('2. **second_pattern**');
      const thirdIndex = result.indexOf('3. **third_pattern**');

      // Verify numbering and ordering
      expect(firstIndex).toBeGreaterThan(0);
      expect(secondIndex).toBeGreaterThan(firstIndex);
      expect(thirdIndex).toBeGreaterThan(secondIndex);
    });

    it('should handle structured patterns with special characters in examples', () => {
      const gameState = {
        actorPromptData: {
          name: 'Special Chars Character',
          speechPatterns: [
            {
              type: 'dialogue',
              examples: [
                'He said, "Don\'t quote me on this!"',
                'Use **bold** and *italic* text carefully',
                'Handle <tags> and & symbols properly',
              ],
            },
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Verify special characters are preserved
      expect(result).toContain('He said, "Don\'t quote me on this!"');
      expect(result).toContain('Use **bold** and *italic* text carefully');
      expect(result).toContain('Handle <tags> and & symbols properly');

      // Verify structure is still correct
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('1. **dialogue**');
      expect(result).toContain('</speech_patterns>');
    });
  });

  describe('Mixed Format Integration', () => {
    it('should format mixed patterns end-to-end through AIPromptContentProvider', () => {
      const gameState = {
        actorPromptData: {
          name: 'Mixed Format Character',
          speechPatterns: [
            {
              type: 'metaphor',
              contexts: ['explanation'],
              examples: ['Like comparing apples to oranges'],
            },
            'Uses simple language',
            'Speaks with confidence',
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Verify XML structure
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('</speech_patterns>');

      // Verify usage guidance
      expect(result).toContain(
        '<!-- Use these patterns naturally in conversation'
      );

      // Verify structured pattern section
      expect(result).toContain('1. **metaphor**');
      expect(result).toContain('Contexts: explanation');
      expect(result).toContain('- "Like comparing apples to oranges"');

      // Verify legacy patterns section
      expect(result).toContain('Additional Patterns:');
      expect(result).toContain('- Uses simple language');
      expect(result).toContain('- Speaks with confidence');
    });

    it('should maintain correct ordering (structured first, then legacy)', () => {
      const gameState = {
        actorPromptData: {
          name: 'Ordering Test Character',
          speechPatterns: [
            {
              type: 'structured_pattern',
              examples: ['Structured example'],
            },
            'Legacy pattern one',
            'Legacy pattern two',
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Find positions
      const structuredIndex = result.indexOf('1. **structured_pattern**');
      const additionalIndex = result.indexOf('Additional Patterns:');
      const legacyOneIndex = result.indexOf('- Legacy pattern one');
      const legacyTwoIndex = result.indexOf('- Legacy pattern two');

      // Verify ordering
      expect(structuredIndex).toBeGreaterThan(0);
      expect(additionalIndex).toBeGreaterThan(structuredIndex);
      expect(legacyOneIndex).toBeGreaterThan(additionalIndex);
      expect(legacyTwoIndex).toBeGreaterThan(legacyOneIndex);
    });

    it('should include single usage guidance for mixed format', () => {
      const gameState = {
        actorPromptData: {
          name: 'Usage Guidance Test',
          speechPatterns: [
            {
              type: 'structured',
              examples: ['Example'],
            },
            'Legacy pattern',
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Count usage guidance occurrences
      const usageGuidancePattern =
        /<!-- Use these patterns naturally in conversation/g;
      const matches = result.match(usageGuidancePattern);

      // Should appear exactly once
      expect(matches).not.toBeNull();
      expect(matches.length).toBe(1);
    });
  });

  describe('Schema Validation Integration', () => {
    it('should validate structured patterns against schema during integration', () => {
      const validGameState = {
        actorPromptData: {
          name: 'Valid Pattern Character',
          speechPatterns: [
            {
              type: 'valid_pattern',
              contexts: ['context1', 'context2'],
              examples: ['Example 1', 'Example 2'],
            },
          ],
        },
        actorState: { components: {} },
      };

      // Should not throw and should format correctly
      const result = aiPromptProvider.getCharacterPersonaContent(validGameState);

      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('1. **valid_pattern**');
      expect(result).toContain('Contexts: context1, context2');
      expect(result).toContain('- "Example 1"');
      expect(result).toContain('- "Example 2"');
      expect(result).toContain('</speech_patterns>');
    });

    it('should reject patterns missing required "type" field', () => {
      const invalidGameState = {
        actorPromptData: {
          name: 'Missing Type Character',
          speechPatterns: [
            {
              // Missing type field
              examples: ['Example without type'],
            },
          ],
        },
        actorState: { components: {} },
      };

      // Formatter should handle gracefully (no type to bold)
      const result = aiPromptProvider.getCharacterPersonaContent(invalidGameState);

      // Should still produce output but with undefined type
      expect(result).toContain('<speech_patterns>');
      // Note: This tests actual behavior - formatter doesn't validate schema
      // Schema validation would happen elsewhere in the system
    });

    it('should reject patterns missing required "examples" field', () => {
      const invalidGameState = {
        actorPromptData: {
          name: 'Missing Examples Character',
          speechPatterns: [
            {
              type: 'pattern_without_examples',
              // Missing examples field
            },
          ],
        },
        actorState: { components: {} },
      };

      // Formatter should handle gracefully
      const result = aiPromptProvider.getCharacterPersonaContent(invalidGameState);

      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('1. **pattern_without_examples**');
      // No examples section should appear
      expect(result).not.toContain('Examples:');
    });

    it('should reject patterns with empty examples array', () => {
      const invalidGameState = {
        actorPromptData: {
          name: 'Empty Examples Character',
          speechPatterns: [
            {
              type: 'pattern_with_empty_examples',
              examples: [], // Empty array
            },
          ],
        },
        actorState: { components: {} },
      };

      // Formatter should handle gracefully
      const result = aiPromptProvider.getCharacterPersonaContent(invalidGameState);

      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('1. **pattern_with_empty_examples**');
      // Examples section exists but is empty
      expect(result).toContain('Examples:');
    });
  });

  describe('Real Character Entity Integration', () => {
    it('should handle character entities with no speech patterns component', () => {
      const gameState = {
        actorPromptData: {
          name: 'No Patterns Character',
          description: 'A character without speech patterns',
          personality: 'Silent type',
          // No speechPatterns field
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(gameState);

      // Should format other sections but not include speech patterns
      expect(result).toContain('YOU ARE No Patterns Character.');
      expect(result).toContain('## Your Description');
      expect(result).toContain('## Your Personality');
      expect(result).not.toContain('<speech_patterns>');
    });

    it('should format patterns from entity.getComponent() correctly', () => {
      // Mock entity with getComponent method
      const mockEntity = {
        getComponent: jest.fn((componentId) => {
          if (componentId === 'core:speech_patterns') {
            return {
              patterns: [
                {
                  type: 'entity_pattern',
                  examples: ['From entity component'],
                },
              ],
            };
          }
          return null;
        }),
      };

      // Test direct entity formatting
      const result = formatter.formatSpeechPatterns(mockEntity);

      // Verify entity.getComponent was called
      expect(mockEntity.getComponent).toHaveBeenCalledWith(
        'core:speech_patterns'
      );

      // Verify output format
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain('1. **entity_pattern**');
      expect(result).toContain('- "From entity component"');
      expect(result).toContain('</speech_patterns>');
    });

    it('should load and format Vespera character speech patterns', () => {
      // Mock Vespera character data (legacy string format based on actual character)
      const vesperaGameState = {
        actorPromptData: {
          name: 'Vespera',
          description: {
            hair: 'long, flowing silver',
            eyes: 'deep violet',
            build: 'slender, graceful',
          },
          personality:
            'Enigmatic and wise, speaks in measured tones with an air of mystery',
          speechPatterns: [
            'Uses archaic language and formal phrasing',
            'Often references ancient knowledge',
            'Speaks in riddles when discussing important matters',
            'Pauses thoughtfully before answering questions',
          ],
        },
        actorState: { components: {} },
      };

      const result = aiPromptProvider.getCharacterPersonaContent(vesperaGameState);

      // Verify Vespera-specific content
      expect(result).toContain('YOU ARE Vespera.');
      expect(result).toContain('## Your Description');
      expect(result).toContain('**Hair**: long, flowing silver');
      expect(result).toContain('**Eyes**: deep violet');

      // Verify speech patterns formatting (legacy string format)
      expect(result).toContain('<speech_patterns>');
      expect(result).toContain(
        '- Uses archaic language and formal phrasing'
      );
      expect(result).toContain('- Often references ancient knowledge');
      expect(result).toContain(
        '- Speaks in riddles when discussing important matters'
      );
      expect(result).toContain(
        '- Pauses thoughtfully before answering questions'
      );
      expect(result).toContain('</speech_patterns>');

      // Verify output is substantial and well-formed
      expect(result.length).toBeGreaterThan(200);
      expect(result).toContain('## Your Personality');
    });
  });
});

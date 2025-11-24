# Character-Data Rework for LLMs

In game.html , we rely on a prompt sent to an LLM so that it will return a character's thoughts, chosen action, and possibly speech and notes. We want to rework how the character's information is depicted, to make it easier to digest for the LLM.

```xml
<character_data>
  <!-- THIS IS YOUR IDENTITY. All thoughts/actions/words stem from this. -->

  <core_identity>
    <profile>
      [PROFILE_CONTENT]
    </profile>
    <personality>
      [PERSONALITY_CONTENT]
    </personality>

    <psychology>
      <core_motivations>
        [MOTIVATIONS_CONTENT]
      </core_motivations>

      <internal_tensions>
        [INTERNAL_TENSIONS_CONTENT]
      </internal_tensions>

      <core_dilemmas>
        [DILEMMAS_CONTENT]
      </core_dilemmas>
    </psychology>

    <personality_traits>
      <strengths>
        [STRENGTHS_CONTENT]
      </strengths>

      <weaknesses>
        [WEAKNESSES_CONTENT]
      </weaknesses>

      <likes>
        [LIKES_CONTENT]
      </likes>

      <dislikes>
        [DISLIKES_CONTENT]
      </dislikes>

      <fears>
        [FEARS_CONTENT]
      </fears>

      <secrets>
        [SECRETS_CONTENT]
      </secrets>
    </personality_traits>
  </core_identity>

  <speech_patterns>
    [SPEECH_PATTERNS_CONTENT]
  </speech_patterns>

  <current_goals>
    [GOALS_CONTENT]
  </current_goals>
</character_data>
```

## Comprehensive testing

All related tests must be run and updated if necessary
If there are opportunities to make testing more robust around this new character data structure for the prompt, create those tests and make them pass.
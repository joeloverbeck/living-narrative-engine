#!/bin/bash
# Bash/Zsh completion script for validateMods CLI tool
# 
# Installation:
#   For bash:
#     source scripts/completion/validateMods-completion.bash
#     or add to ~/.bashrc
#   
#   For zsh:
#     autoload -U +X bashcompinit && bashcompinit
#     source scripts/completion/validateMods-completion.bash
#     or add to ~/.zshrc

_validate_mods_completion() {
    local cur prev opts
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Available options
    opts="--help --version --mod --ecosystem --no-dependencies --no-cross-references
          --check-load-order --format --output --colors --no-colors --verbose --quiet
          --fail-fast --strict --no-suggestions --no-summary --concurrency --timeout
          --severity --mod-filter --include-metadata --no-cache"

    case "${prev}" in
        --format|-f)
            COMPREPLY=($(compgen -W "console json html markdown junit csv" -- ${cur}))
            return 0
            ;;
        --severity)
            COMPREPLY=($(compgen -W "critical high medium low" -- ${cur}))
            return 0
            ;;
        --mod|-m)
            # Complete with available mod names
            local mods_dir="data/mods"
            if [[ -d "$mods_dir" ]]; then
                local mods=$(ls -1 "$mods_dir" 2>/dev/null)
                COMPREPLY=($(compgen -W "$mods" -- ${cur}))
            fi
            return 0
            ;;
        --output|-o)
            # Complete with file names
            COMPREPLY=($(compgen -f -- ${cur}))
            return 0
            ;;
        --concurrency|-c)
            COMPREPLY=($(compgen -W "1 2 3 4 5 6 7 8 9 10" -- ${cur}))
            return 0
            ;;
        --timeout)
            COMPREPLY=($(compgen -W "30000 60000 120000 180000" -- ${cur}))
            return 0
            ;;
    esac

    # Handle --flag=value format
    if [[ ${cur} == *=* ]]; then
        local flag="${cur%%=*}"
        local value="${cur#*=}"
        
        case "${flag}" in
            --format|-f)
                COMPREPLY=($(compgen -W "console json html markdown junit csv" -P "${flag}=" -- ${value}))
                return 0
                ;;
            --severity)
                COMPREPLY=($(compgen -W "critical high medium low" -P "${flag}=" -- ${value}))
                return 0
                ;;
            --mod|-m)
                local mods_dir="data/mods"
                if [[ -d "$mods_dir" ]]; then
                    local mods=$(ls -1 "$mods_dir" 2>/dev/null)
                    COMPREPLY=($(compgen -W "$mods" -P "${flag}=" -- ${value}))
                fi
                return 0
                ;;
            --concurrency|-c)
                COMPREPLY=($(compgen -W "1 2 3 4 5 6 7 8 9 10" -P "${flag}=" -- ${value}))
                return 0
                ;;
            --timeout)
                COMPREPLY=($(compgen -W "30000 60000 120000 180000" -P "${flag}=" -- ${value}))
                return 0
                ;;
        esac
    fi

    COMPREPLY=($(compgen -W "${opts}" -- ${cur}))
    return 0
}

# Register completion for various commands
complete -F _validate_mods_completion validateMods
complete -F _validate_mods_completion node scripts/validateMods.js
complete -F _validate_mods_completion npm run validate
complete -F _validate_mods_completion npx living-narrative-validate
complete -F _validate_mods_completion ln-validate

# Export for use in other scripts
export -f _validate_mods_completion
#!/bin/bash

# Script to remove p_erotica file from Git history completely
# This is needed for privacy - the file was accidentally committed

echo "Git History Cleanup Script for p_erotica privacy issue"
echo "========================================================"
echo ""
echo "WARNING: This will rewrite Git history!"
echo "All collaborators will need to re-clone or reset their repositories."
echo ""
read -p "Are you sure you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Method 1: Using BFG Repo-Cleaner (Recommended)"
echo "-----------------------------------------------"
echo "If you have BFG installed, run these commands:"
echo ""
echo "  java -jar bfg.jar --delete-files p_erotica"
echo "  git reflog expire --expire=now --all && git gc --prune=now --aggressive"
echo ""

echo "Method 2: Using git filter-branch"
echo "----------------------------------"
echo "To use git's built-in tools, we'll run filter-branch now..."
echo ""
read -p "Use git filter-branch method? (yes/no): " use_filter

if [ "$use_filter" == "yes" ]; then
    echo "Running git filter-branch to remove p_erotica from history..."
    
    git filter-branch --force --index-filter \
        "git rm --cached --ignore-unmatch data/mods/p_erotica" \
        --prune-empty --tag-name-filter cat -- --all
    
    echo ""
    echo "Cleaning up refs and garbage collection..."
    git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
    
    echo ""
    echo "History cleaned locally!"
fi

echo ""
echo "IMPORTANT NEXT STEPS:"
echo "====================="
echo ""
echo "1. Verify the file is completely removed from history:"
echo "   git log --all -- data/mods/p_erotica"
echo "   (Should return nothing)"
echo ""
echo "2. Force push to remote (coordinate with team first!):"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "3. Notify all collaborators to reset their local repos:"
echo "   git fetch origin"
echo "   git reset --hard origin/main"
echo ""
echo "4. Consider rotating any sensitive information that may have been exposed."
echo ""
echo "Done!"
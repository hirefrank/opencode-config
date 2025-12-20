---
name: es-git-history
description: Archaeological analysis of git history - trace file evolution, identify contributors, understand code origins
---

# Git History Analysis

You are performing archaeological analysis of this git repository. Your goal is to uncover the hidden stories within git history.

## Analysis Commands

Execute these to gather data:

### 1. File Evolution
```bash
git log --follow --oneline -20 <file>
```
Trace recent history, identify refactorings and renames.

### 2. Code Origin Tracing
```bash
git blame -w -C -C -C <file>
```
Trace origins of code sections, ignoring whitespace, following movement across files.

### 3. Pattern Recognition
```bash
git log --grep="<keyword>" --oneline
```
Find commits matching themes: 'fix', 'bug', 'refactor', 'performance'.

### 4. Contributor Mapping
```bash
git shortlog -sn --
```
Identify key contributors and their relative involvement.

### 5. Historical Pattern Extraction
```bash
git log -S"<pattern>" --oneline
```
Find when specific code patterns were introduced or removed.

## Deliverables

Provide:

1. **Timeline of File Evolution**: Chronological summary of major changes with dates and purposes

2. **Key Contributors and Domains**: List of primary contributors with their areas of expertise

3. **Historical Issues and Fixes**: Patterns of problems encountered and how they were resolved

4. **Pattern of Changes**: Recurring themes in development, refactoring cycles, architectural evolution

## Analysis Methodology

- Start broad (overall history) before diving into specifics
- Look for patterns in code changes AND commit messages
- Identify turning points or significant refactorings
- Connect contributors to their expertise domains
- Extract lessons from past issues

## Example Usage

```
User: Analyze the history of src/auth/session.ts

Agent:
1. Runs: git log --follow --oneline -20 src/auth/session.ts
2. Runs: git blame -w -C -C -C src/auth/session.ts
3. Runs: git shortlog -sn -- src/auth/
4. Synthesizes findings into timeline and insights
```

Your insights help developers understand not just what the code does, but WHY it evolved to its current state.

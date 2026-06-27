# story-saint

AI-animated short film production toolkit.

1. **Skills** (`skills/`) — Claude Code skills for story development, storyboarding, and prompt generation
2. **Platform** (`platform/`) — PromptSync web dashboard for production tracking
3. **Extension** (`extension/`) — Chrome extension for prompt injection into OpenArt

## Skills

Main skill: `skills/SKILL.md`. It reads its own reference files on activation.

Production phases: script lock → character design → storyboard → animation prompts.

Output structure (in the user's project directory). Two layouts:

**Single project** (one self-contained film/Short):

```
{project}/
├── project.yaml
├── {project}_storyboard.tsv
├── elevenlabs.md
├── suno.md
├── voice_design.md                       ← voice profiles + ElevenLabs settings (created during voice design phase)
└── storyboard/
    ├── characters/{name}.md              ← created first, during character design phase
    ├── environments/{world-name}.md      ← optional, during storyboard phase (Step 2b)
    ├── continuity/scene-{N}-objects.md    ← object continuity manifests per scene
    ├── shots/{code}/shot.md + nb-prompt.md
    ├── video-prompts/{code}/kling-prompt.md + seedance-prompt.md
    └── styles/{name}.md
```

**Series** (multiple episodes sharing a cast and world):

```
{series}/
├── series.yaml                           ← series manifest (global_elements dir, bible dir, episodes)
├── bible/                                ← narrative canon (story truth) — Documents only
│   └── characters/{name}.md
├── storyboard/                           ← GLOBAL element library, shared across episodes
│   └── characters/ environments/ props/  ← global sheets carry `scope: global` + `canon:` link
└── episodes/{epNN-slug}/
    ├── project.yaml
    └── storyboard/                       ← EPISODE-LOCAL elements + this episode's shots/video-prompts
```

An episode's effective elements = **global ∪ local** (local wins on `element_name` collision). The platform presents a series as one openable project: a series-wide **Global** elements view plus the **Episodes**. Single projects have no `series.yaml` and are presented standalone. Formalized in `skills/story-saint-storyboard/SKILL.md` → PROJECT LAYOUT.

## Platform

- Stack: React (Vite) + Express + SQLite + chokidar + WebSocket
- Dev: `cd platform && npm run dev`
- Port: 3456
- **Structure tool** (`cd platform && npm run structure`): scaffold a correct single-project/series layout and validate/auto-fix adherence. `scaffold-series|scaffold-episode|scaffold-project|new-element` create files with correct frontmatter in the correct place; `validate --root <dir> --fix` enforces the layout (used by the storyboard skill's STRUCTURE AUDIT gate).

## Extension

- Manifest V3, content scripts for OpenArt
- Talks to platform server at localhost:3456

## Conventions

- YAML frontmatter + markdown body for all prompt/storyboard files
- Shot codes: `0A`, `1A`, `1B`, `2A`, etc.
- `asset_type`: `still | kling | seedance | kling-reuse`
- `status`: `draft → nb-ready → nb-done → kling-ready → kling-done → seedance-ready → seedance-done → complete`

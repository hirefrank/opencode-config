# opencode-config

Personal OpenCode configuration optimized for Edge-first development.

> **Edge Stack** is a Cloudflare Workers-first development framework optimized for edge computing, modern React (TanStack Start), and token-efficient AI workflows.

---

## ⚡ Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/hirefrank/opencode-config ~/.config/opencode
cd ~/.config/opencode
```

### 2. Verify
```bash
opencode doctor
```

---

## 🏗️ Structure

- **`agent/`**: 27 specialized agents with MCP integration.
- **`command/`**: 26 workflow commands (setup, development, validation).
- **`skills/`**: 14 autonomous SKILLs for continuous validation.
- **`knowledge/`**: Context-triggers and edge development patterns.
- **`tool/`**: Hard Tools (JS/TS validators) for runtime and UI checks.
- **`plugin/`**: Pre-tool-use hooks and validation scripts.

---

## 🛠️ Key Features

- **Edge-first architecture**: Optimized for Workers, KV, R2, D1, and Durable Objects.
- **Modern Stack**: TanStack Start (React 19), Server Functions, shadcn/ui, and Tailwind 4.
- **Token-efficient**: "Hard Tools" over "Soft Instructions" to reduce context bloat.
- **Ground Truth**: Integrated MCP servers (Context7, shadcn, Better Auth) prevent AI hallucinations.

---

## 📖 Commands

| Task | Command |
|------|---------|
| Start work | `/es-work` |
| Validate commit | `/es-validate` |
| New worker | `/es-worker` |
| Code review | `/es-review` |
| Release | `/es-release` |
| Check upstream | `/es-upstream` |

---

## Credits

- **[joelhooks/opencode-config](https://github.com/joelhooks/opencode-config)** - Inspiration for structure and workflow patterns.
- **[OpenCode](https://opencode.ai)** - The foundation.

---

## License

MIT

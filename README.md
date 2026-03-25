# AI Deep Dive

AI Deep Dive is an open-source interactive learning platform for understanding language models through lessons, visualizations, and coding challenges.

Live: [aideepdive.dev](https://aideepdive.dev)

![Challenge workspace](https://github.com/user-attachments/assets/ff2c9a80-0a66-4552-aaa8-73d667e5e0e6)

![Build GPT from Scratch roadmap](https://github.com/user-attachments/assets/e0a74b0e-c3c4-4f3a-aad0-5cfd34ae75b5)

## What's live
- `Build GPT from Scratch`: 11 chapters and 20 coding challenges
  - interactive lessons, visuals, and project chapters
  - a full path from raw text to training and generation
    
- `Mechanistic Interpretability` is the next course on the roadmap.

## Repo layout
- `web/` — Next.js app and course content in `web/content/`
- `judge/` — backend judge for hidden tests and torch-backed problems
- `cli/` — python cli for local project workflows and implementation validation (coming soon)

## Local development

Requirements:
- Node.js
- Python 3.10+
- Redis, only if you want to run the judge locally

### Run the web app

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run the judge locally

See [judge/README.md](./judge/README.md) for the local API and worker setup.

## Content

- lesson and project chapters live in `web/content/` as MDX
- judge problem definitions live in `judge/problems/`

## License

MIT

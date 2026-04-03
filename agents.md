# AGENTS.md — Pivot Dataing App

> Written for LLM coding agents. Describes the project, architecture rules, and Luzmo integration points.

---

## 1. Project Overview

- **Name:** Pivot Dataing App
- **Purpose:** A Luzmo-powered data discovery and dashboarding app demonstrating how to build interactive analytics experiences using React.
- **Stack:** React + TypeScript + Vite + Luzmo Embed + Analytics Components Kit (ACK) + Lucero
- **What it does:** Enables users to explore visualizations, edit charts, manage dashboards, and interact with AI-assisted analytics features using Luzmo embedded components.

---

## Luzmo (embedded analytics)

When implementing Luzmo functionality (embed elements, dashboards, editing panels, exports, or AI features), refer to:

https://developer.luzmo.com/agents.md

Use the Luzmo SDKs and components already present in the project. Do not introduce alternative charting libraries.

---

## 2. Module Structure

```text
├── public/
├── src/
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   ├── luzmo-custom-elements.d.ts
│   ├── luzmo-elements.ts
│   └── main.tsx
├── .env
├── .env.example
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig*.json
└── vite.config.ts
```

### Architecture Notes

- `main.tsx` → bootstrap only (no logic)
- `luzmo-elements.ts` → single place to register Luzmo components
- `luzmo-custom-elements.d.ts` → typings for custom elements
- `App.tsx` → main orchestration (must stay readable and not bloated)

If complexity grows, introduce:

- `components/`
- `hooks/`
- `utils/`
- `types/`

---

## 3. Code Quality Standard

1. Zero type errors (`npx tsc --noEmit`)
2. Lint passes (`npm run lint`)
3. No dead code
4. No `any`
5. Immutable state only
6. Validate external data
7. Clean imports
8. Accessibility required
9. No console noise
10. Readable logic

---

## 4. Showcase Quality Requirement (STRICT)

This is a **showcase/demo application**.

### Core Principles

- Clarity over cleverness
- Minimalism over flexibility
- Readability over abstraction
- Demo-quality over production complexity

### Hard Rules

- No unnecessary abstractions
- No speculative code
- No unused helpers
- No over-engineering
- Components must stay small
- No nested ternaries
- No demo-breaking code
- UI must feel polished

Before adding code ask:

"Would I confidently show this in a demo?"

If not → refactor.

---

## 5. Styling Rules

- Follow existing styling approach
- No new styling systems
- Keep styles minimal and consistent
- Preserve accessibility

---

## 6. Luzmo Rules

Use:
- @luzmo/embed
- @luzmo/analytics-components-kit
- @luzmo/lucero

Do:
- Use Luzmo for analytics UI
- Validate data
- Keep typings updated

Don't:
- No Chart.js / D3 / Recharts
- No duplicate setup
- No hardcoded secrets

---

## 7. Refactor Guidance

- Small change → inline
- Reusable UI → component
- Async → hook
- Parsing → utility

---

## 8. Environment

- Use `.env`
- Never commit secrets
- Update `.env.example`
- Use `import.meta.env`

---

## 9. Running

npm install  
npm run dev  

http://localhost:5173

---

## 10. Definition of Done

- Types pass
- Lint passes
- Build works
- No dead code
- Clean & minimal
- Showcase ready

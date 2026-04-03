---
title: "Pivot Dataing App"
description: "A React + TypeScript + Vite app showcasing a data discovery and dashboarding flow built with Luzmo"
tags:
  - API
  - Dashboard
  - Flex
  - AI
  - React
  - Typescript
author: "Luzmo"
image: "https://cdn.luzmo.com/showcases/pivot-dataing-app.png"
---

# Pivot Dataing App

A data discovery and dashboarding experience built on Luzmo. Match or unmatch charts to build your favorite dashboard. 

This project demonstrates how to build an interactive analytics application using **React**, **TypeScript**, and **Vite**, powered by Luzmo embedded analytics and Analytics Components Kit (ACK).

## Features

- **React + Vite architecture** — modern frontend setup
- **Luzmo embedded analytics** — render dashboards and visualizations
- **ACK editing panels** — configure chart slots and options
- **Dashboard flow** — create and manage dashboard-like experiences
- **AI-assisted analytics** — generate charts and summaries
- **CSV export** — export visualization data where supported
- **Lucero components** — UI elements like buttons and loaders

## Tech Stack

- **React**
- **TypeScript**
- **Vite**
- **[@luzmo/embed](https://www.npmjs.com/package/@luzmo/embed)**
- **[@luzmo/analytics-components-kit](https://www.npmjs.com/package/@luzmo/analytics-components-kit)**
- **[@luzmo/lucero](https://www.npmjs.com/package/@luzmo/lucero)**

## Getting Started

1. Create a `.env` file based on `.env.example`.
2. Add your Luzmo credentials and any other required configuration values.

Example:

```env
VITE_LUZMO_AUTH_KEY=your-luzmo-auth-key
VITE_LUZMO_AUTH_TOKEN=your-luzmo-auth-token
VITE_LUZMO_API_HOST=https://api.luzmo.com
VITE_LUZMO_APP_SERVER=https://app.luzmo.com
```

3. Install dependencies and start the development server:

```bash
npm install
npm run dev
```

The Vite dev server starts at [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Further Reading

See [AGENTS.md](./AGENTS.md) for coding standards, architecture rules, and agent guidance.

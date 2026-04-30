# Benefitly

**The personal coverage layer for modern life.**

Benefitly ingests every policy, warranty, card benefit, and employer perk a user holds, parses each with AI, and answers four questions on demand: _Am I covered? By whom? For how long? For how much?_

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Runtime:** React 19

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Entry point — renders AppShell
│   └── globals.css         # Global styles + Tailwind
├── components/
│   ├── layout/             # AppShell, Sidebar, BottomTabBar
│   ├── dashboard/          # Dashboard summary view
│   ├── coverage/           # CoverageCard, CoverageDetail, AddCoverageView
│   ├── search/             # Situation search ("What's Covered?")
│   ├── alerts/             # Alerts view
│   ├── transactions/       # Transaction coverage analysis
│   ├── assets/             # Asset registry
│   ├── claims/             # Claims tracker
│   ├── optimiser/          # Coverage optimiser
│   └── vault/              # Document vault
├── data/
│   ├── categories.ts       # Coverage categories and status styles
│   └── seed.ts             # Sample data for development
├── lib/
│   ├── hooks.ts            # useBreakpoint, responsive grid helpers
│   └── store.ts            # App state context (for future use)
└── types/
    └── coverage.ts         # TypeScript interfaces for the domain model
```

## MVP Scope (v1)

- Document upload (PDF and image) with AI parsing
- Manual coverage entry via guided form
- Coverage dashboard with category view and coverage cards
- "What's Covered?" natural-language situation search
- Expiration and renewal alerts
- Document vault with search
- Household support (up to 5 family members)

## Launch Market

UK first — PSD2 + FCA + Section 75 give a clean regulatory footing.

## Licence

Private — all rights reserved.

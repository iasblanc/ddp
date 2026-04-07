# DONT DREAM. PLAN.

> Stop dreaming. Start planning. Find your North.

AI-first app that transforms dreams into real plans through natural conversation, 30-minute blocks in your real calendar, and North — an AI present at every moment of the journey.

---

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Shadcn/ui
- **Backend**: Next.js API Routes → Supabase Edge Functions (after 5k users)
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: Claude API (Anthropic) — Sonnet for critical conversations, Haiku for operational
- **Auth**: Supabase Auth (magic link + Google OAuth)
- **Calendar**: Google Calendar API (OAuth 2.0)
- **Notifications**: Web Push API (PWA)
- **Automations**: n8n
- **Deploy**: Vercel

## Getting Started

```bash
# Clone
git clone https://github.com/iasblanc/ddp.git
cd ddp

# Install dependencies
npm install

# Setup environment
cp .env.local.example .env.local
# Fill in your credentials in .env.local

# Run development server
npm run dev
```

## Environment Variables

See `.env.local.example` for all required variables.

**Required for Phase 1:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

## Database Setup

Run the SQL schema in your Supabase project:

```bash
# In Supabase Dashboard → SQL Editor
# Run: supabase/schema.sql
```

## Development Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Foundation | 🚧 In Progress | Next.js + Supabase + Auth + PWA |
| 2. Onboarding | 📋 Planned | Design system + 10-minute onboarding flow |
| 3. North & Memory | 📋 Planned | Conversation engine + memory system |
| 4. Calendar | 📋 Planned | Google Calendar integration + adaptive plan |
| 5. Blocks | 📋 Planned | Execution blocks + notifications |
| 6. Retention | 📋 Planned | Inactivity protocol + social layer |
| 7. Monetization | 📋 Planned | Free/Pro plans + payment |

## Languages

Supported from day 1:
- 🇺🇸 English (`en`)
- 🇧🇷 Portuguese Brazil (`pt-BR`)
- 🇪🇸 Spanish (`es`)

## North — The AI

North is not a generic assistant. It's a presence with:
- **3 voices**: Listens / Thinks / Challenges
- **4 memory types**: Dream profile, execution profile, emotional profile, conversation history
- **6 conversation types**: Extraction, check-in, pre-block, post-block, crisis, revaluation

---

*Dont Dream. Plan. — Find your North.*

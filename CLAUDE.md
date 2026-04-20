# CLAUDE.md

Sempre responda em português brasileiro.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (one-shot)
npm run test:watch   # Vitest watch mode
```

## Architecture

**Stack:** React 18 + TypeScript + Vite, React Router v6, Supabase (auth + DB), Tailwind CSS, shadcn/ui (Radix UI), TanStack React Query, Lucide icons.

**Entry point:** `src/App.tsx` — sets up `QueryClientProvider`, `AuthProvider`, `TooltipProvider`, and all routes. Protected routes wrap pages in `<ProtectedRoute>`.

**Routes:**
- `/auth` → `Auth.tsx` (public)
- `/` → `Index.tsx` (dashboard + client list)
- `/radar/:clienteId` → `RadarCliente.tsx` (client detail)
- `/admin` → `Admin.tsx` (user/goal management)

**Auth:** `src/context/AuthContext.tsx` subscribes to Supabase auth state and provides `useAuth()`. `ProtectedRoute` blocks unauthenticated access and redirects to `/auth`. Password recovery is detected via `type=recovery` in the URL hash.

**Data layer:** No API abstraction — all pages query Supabase directly via `useEffect`. The Supabase client and all TypeScript types live in `src/lib/supabase.ts`. Key types: `RadarConsultivoRow`, `InteracaoRow`, `AcaoConsultivaRow`, `SemaforoStatus` ("verde" | "atencao" | "critico").

**Supabase tables used:** `radar_consultivo` (view aggregating client radar data), `clientes` (master client record), `interacoes` (interaction log), `acoes_consultivas` (open advisory actions), `usuarios`, `activity_logs`.

**Styling approach:** Mixed — `Index.tsx`, `Auth.tsx`, and `RadarCliente.tsx` use **inline styles** (React.CSSProperties) for layout and colors, while shadcn/ui components use Tailwind internally. Design tokens (CSS variables) are defined in `src/index.css`. Use `cn()` from `src/lib/utils.ts` for conditional Tailwind classes.

**Premium layout pattern (Index + RadarCliente):** Fixed sidebar (`width: 220px`, `background: #0f172a`), main content with `marginLeft: 220px`, page background `#f0f4ff`. Cards use `background: #fff`, `border: 1px solid #e8eaed`, `borderRadius: 12px`.

**Modal pattern:** Modals are shadcn `Dialog`-based components in `src/components/` (`NovoClienteModal`, `RegistrarOrientacaoModal`). They manage local form state and submit directly to Supabase, then call an `onSaved` callback to trigger a reload in the parent.

**Reload pattern:** Pages use a `reloadKey` state (incremented after mutations) or call a `load()` callback to re-fetch data — there is no React Query cache invalidation.

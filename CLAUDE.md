# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Polarier-Auto is a Spanish-language chat application built with React + TypeScript + Vite. It uses Supabase for auth, database, and storage, and forwards chat messages to an n8n webhook for AI-powered responses. The UI is built with shadcn/ui components and Tailwind CSS.

Beyond the chat, the app has an **audit module** (control de almacén hotelero) for the `auditor` role: daily control forms per hotel, a monthly-report section, client-side PDF, and email sending via n8n. See "Audit module" below and the `/vault` docs.

## Project context & history — READ THE VAULT FIRST

`/vault` is an Obsidian vault (versioned in git) that is the **source of truth for project state, decisions, and history**. Before non-trivial work, read `vault/Inicio.md` (index + current state), then the relevant note. Key notes: `Generacion-Documentos.md` (rules for every generated document: which uploaded file name triggers what, master files and where they live, polo codes, formats, year), `Modulo-Auditoria.md`, `Routine-Informe-Mensual.md`, `Supabase.md`, `Decisiones.md`, `Pendientes.md`. Keep the vault updated when something important changes.

## n8n

Any work inside n8n (creating, changing, debugging or auditing a flow, reading executions) goes to the global `n8n-worker` agent. Instance: `polarierauto-n8n` (self-hosted). This repo's flows live in the n8n folder **Polarier** (`0792aLggmkSLKn0l`).

| Workflow | ID | Folder | What it does |
|---|---|---|---|
| Polarier Auto App | `BQoya6xrMaF1UAkU` | Polarier | Chat webhook (`sendToN8n`), one webhook per document branch for the «Automatizaciones» section, and the document branches themselves (Modelo 1, TABLA CA, Carla, Integral…). ~140 nodes. |
| Emails | `TIwrYY0MIntv5GLj` | Polarier | Sends the audit report by Gmail with the PDF in base64 (`src/services/informeCorreo.ts`). Replaces the old n8n cloud flow `Komb1YycRFKXTvkX`. |

`HwhQ5VLp9QpoAAP6` is an inactive copy of "Polarier Auto App" (2026-10-15) with no use: do not work on it by mistake.

Detail: `vault/Integracion-n8n.md` (webhooks, payload and response contract, infra, known debt and decisions such as the Carla branch staying broken), `vault/Automatizaciones.md` (per-branch triggers), `vault/Generacion-Documentos.md` (which file triggers what). Python scripts run on the VPS under `/data/Polarier/` (`Carla`, `Leslie`, `Leslie Global 2025`, `python-runner`) through the pythonrunner; local copies in `C:\Trabajo\N8N\Polarier` may be stale, and scripts versioned in this repo live in `vps/`.

## Document generation (n8n + VPS)

Read `vault/Generacion-Documentos.md` before touching any n8n branch, VPS script or app code that reads or writes documents. In short: in the chat, the **uploaded file name is the contract** (`Switch3` in n8n "Polarier Auto App" routes by substring, first match: `MU` → `CP` → `Integral` → zip → `Informe` → agent). Masters live on the VPS at `/data/Polarier/` (local copies under `C:\Trabajo\N8N\Polarier` may be stale). Python runs only through the internal pythonrunner (`POST http://polarierauto_pythonrunner:8000/run`) — the n8n container has no Python. Excel output must be real `.xlsx` (force `googleFileConversion` on Drive downloads). Polo codes differ per legacy system — use the table in that note.

## Informe del Consejo de Dirección (`consejo-direccion/`)

Python sub-project (its own `CLAUDE.md`, read it before touching anything there) that writes Polarier's **monthly Consejo de Dirección report** — not to be confused with the audit module's monthly report. Today a single input DOCX supplies every table; the AI writes only the narrative into `data/processed/analisis_{mes}_{año}.json`; `scripts/generate_report.py` clones the approved master template and swaps markers. **Not integrated into the app yet** — today it runs by hand from that folder. **Being redesigned** (Leo, 2026-10-21): no upload; the tables will be built from the GLOBAL and the TABLA CA for a chosen month, with a data-availability check. `vault/Informe-Consejo-Origen-Datos.md` maps every table to its source. **The repo is public:** `consejo-direccion/data/` is git-ignored, and no real figure, report or person's name may be committed. Read `vault/Informe-Consejo-Direccion.md` first: it covers the flow, the three absolute rules (clone the design, never invent data, no absolute figures in the prose) and how each input table is matched to its `{TABLA_*}` marker by its title (`config/table_markers.yaml`). An unrecognised table stops the run on purpose: add its pattern there, never place tables by position.

## Commands

- `bun dev` — Start dev server on port 8080
- `bun run build` — Production build
- `bun run lint` — ESLint
- `bun run test` — Run all tests (vitest)
- `bun run test:watch` — Watch mode
- `bunx vitest run src/path/to/file.test.ts` — Run a single test file

## Architecture

**Routing & Auth Flow:** `App.tsx` defines all routes using react-router-dom. Routes are wrapped in `ProtectedRoute` (redirects to `/login` if unauthenticated) or `PublicRoute` (redirects to `/lobby` if already logged in). Password recovery flow is detected via URL params and redirects to `/reset-password`.

**Layout:** Authenticated pages under `/chat`, `/documents`, `/history`, `/settings` render inside `AppLayout`, which provides a sidebar + main content area via `<Outlet />`. The `/lobby` page is protected but uses its own layout.

**Backend Integration:**
- `src/lib/supabaseClient.ts` — Supabase client (uses `sessionStorage` for auth persistence)
- `src/services/auth.ts` — Auth operations (email/password, Google OAuth, sign out)
- `src/services/chat.ts` — Chat CRUD, message CRUD, profile management, and n8n webhook integration
- `src/services/storage.ts` — File uploads (avatars to `avatars` bucket, documents to `documents` bucket) with type/size validation
- `src/context/AuthContext.tsx` — Global auth state via React context, exposes `useAuth()` hook

**Chat Flow:** User messages are saved to Supabase `chat_messages` table, then forwarded to the n8n webhook (`sendToN8n`). The webhook response is parsed with `extractTextContent` which handles nested JSON structures, looking for keys like `respuesta`, `response`, `message`, etc. File responses (PDF, XLSX, DOCX) are returned as blob download links.

**Supabase Tables:** `chats`, `chat_messages`, `profiles`, `documents` (chat); `polos_turisticos`, `hoteles`, `user_hotel_roles`, `catalogo_prendas`, `catalogo_ubicaciones`, `dotacion_lenceria`, `form_definitions`, `form_submissions`, `monthly_reports` (audit module)

**Supabase Storage Buckets:** `avatars`, `documents` (the monthly report PDF is generated client-side; the old `informes-mensuales` bucket and `monthly_reports.pdf_url` were retired in migration `011`)

## Audit module (control de almacén hotelero)

Native module for the `auditor` role (sees forms + history, no chat). Multi-hotel (polos → hoteles). Migrations in `supabase/migrations/` are run manually by the user in the Supabase SQL editor.

- **Layout/routing:** `AuditLayout` (sidebar sin chat), routes `/auditoria`, `/auditoria/formulario/:defId`, `/auditoria/historico`, `/auditoria/historico/:anioMes`, guarded by `AuditorRoute` (any audit role, not just `auditor` — an admin enters to review). `RoleContext` holds active role/hotel and exposes `hasAuditAccess` / `isAdmin`; `AppSidebar` shows an "Auditoría" entry for non-pure-auditors who have a role.
- **Admins read the whole hotel, nobody edits anyone else's parte (migration `008`):** `admin` sees every submission of their hotels (`form_submissions`, `audit_daily`, `audit_daily_detalle`) plus the `profiles` of people with a role there, so the history can name who filled each one. Insert/update/delete stay `user_id = auth.uid()`, so someone else's parte opens read-only. `getSubmission()` therefore filters by the caller's own `user_id` — without it an admin would get multiple rows or silently fork a copy on save; `getSubmissionById()` (`?sub=<id>`) is how the history opens a specific one.
- **Forms:** three types driven by JSONB config in `form_definitions.config` (no schema migration per change): lencería (matriz ubicación×prenda), producción (vales), cuadrador Lavatín (layout `cuadrador`: líneas por prenda con Producción prenda/kg auto). Components in `src/components/audit/`. Responsive: table on desktop, cards on mobile.
- **Daily data:** `form_submissions` (one row per hotel+form+date+user; `data` and `totales` are jsonb whose shape varies by form type).
- **Report (client-side):** `src/lib/informe.ts` (pure logic → structure) + `informePdf.ts` (jsPDF) + `InformePreview.tsx`. Email via `EnviarCorreoModal` → n8n webhook.
- **Monthly report:** `monthly_reports` table + `AuditHistory` (list of months) → `AuditMonth` (month detail + monthly report block). Generated by a **Claude cloud routine** (claude.ai/code/routines) that reads a pre-aggregated data layer, never raw `form_submissions`: migration `006` adds `audit_daily` / `audit_daily_detalle` (kept in sync by a trigger) plus the `audit_mes` / `audit_mes_dias` views. The app's "Generar informe" button queues the request (`monthly_reports.solicitado_at`) and wakes the routine through the `disparar-informe-mensual` Edge Function. Once written, the month's box offers **Descargar** and **Enviar por correo** instead of "Regenerar": `src/lib/informeMensual.ts` maps the `monthly_reports` row onto the same `Informe` type the daily PDF and the email modal already consume, so neither is duplicated. See `vault/Routine-Informe-Mensual.md` for the prompt and setup.
- **Linen stock (dotación) is a master table:** a hotel's linen is a fixed quantity that only circulates between locations and must add up to the same total at month end. `dotacion_lenceria` (hotel × ubicación × prenda, migration `007`) holds it; `src/lib/dotacion.ts` is the pure logic. The lencería form opens pre-filled with it, the matrix and the daily report show count vs dotación (per row, per prenda, total), the dashboard uses it as the month target (priority: manual > table > highest lencería count) and raises `inventario_desviado`, and the monthly views expose `dotacion_hotel`, `diferencia_dotacion` and `audit_mes_dotacion` for the routine. Every screen that reads it swallows errors, so the app still works if the migration is not applied.
- **Deviation rules are duplicated on purpose:** the thresholds (0.5 / 0.75 / 1.5 vs the month median) **and** the rule that a `borrador` is never classified as a deviation live both in `src/lib/dashboard.ts` (`detectarAlertas()` and `clasificarDia()`) and in the `audit_mes_dias` view (migration `009`). Drafts still count towards totals and the median on both sides — only the judgement is skipped, because an unclosed parte may be half-filled. Change one, change the other.
- **Services:** `src/services/audit.ts`.

## Android (Capacitor)

The project is wrapped with Capacitor to produce a native Android app from the web build.

- `npm run android:sync` — Build web + sync to Android project
- `npm run android:open` — Open the Android project in Android Studio
- `npm run android:run` — Build, sync, and run on connected device/emulator
- Android project lives in `android/` (generated, do not edit manually except for native configs)
- Config in `capacitor.config.ts` — appId: `com.polarier.auto`

## Key Conventions

- Path alias: `@/` maps to `src/`
- Lobby, chat and login use the neo design layer in `src/index.css` (`.neo-ground` / `.neo-chat` scopes + `.neo-*` classes, background `.polarier-pattern`); read `vault/Diseno-Neoformista.md` before restyling them. Use `PolarierLogo` instead of the raw logo PNG (the yellow logo is invisible on the light background).
- UI components live in `src/components/ui/` (shadcn/ui, do not edit manually)
- Custom components in `src/components/`
- All user-facing text is in Spanish
- Package manager is bun (lockfile: `bun.lock`)
- TypeScript is configured with `strictNullChecks: false` and `noImplicitAny: false`

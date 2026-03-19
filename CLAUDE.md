# GreenOR — Claude Code Reference

## What This Is
Surgical sustainability platform. Surgeons log OR cases, select instruments/supplies, and see carbon emissions calculated automatically. Gamification (streaks), dashboards, institutional benchmarking.

---

## Stack
| Layer | Choice |
|-------|--------|
| Framework | Next.js 14, App Router, TypeScript |
| Styling | Tailwind CSS + custom globals.css animations |
| Backend | Supabase (PostgreSQL + magic link auth + RLS) |
| Hosting | Vercel |
| Email | Resend (magic link delivery) |
| Env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

---

## Design System
- **Font:** Palatino always — never Inter, Arial, or system fonts
- **Background:** `bg-beige` (`#F9F5EE` light / `#0A120D` dark) — use CSS var `--c-beige`
- **Primary:** `#1B4332` (forest green) → Tailwind `green-900`
- **Cards:** `card` class (uses `--c-card-bg`) + `hover-lift`; do NOT hardcode `bg-white`
- **Inputs:** `input-base` class (uses `--c-input-bg`, `--c-beige-300`, `--c-green-900`)
- **Primary button:** `btn-primary` class; hover uses inset box-shadow (not pseudo-element)
- **Secondary button:** `btn-secondary` class; hover lightens border to `green-100`
- **Color tokens:** All Tailwind `green-*` and `beige-*` colors are CSS variables (`--c-green-*`, `--c-beige-*`) in RGB triplet format — dark mode switches them automatically via `@media (prefers-color-scheme: dark)`
- **Emissions colors:** `text-green-700` < 4 kg · `text-amber-700` 4–8 kg · `text-red-700` > 8 kg
- **Animations:** `fade-up`, `slide-right`, `slide-left`, `scale-in` — defined in globals.css
- **Dark mode:** Automatic via `prefers-color-scheme`. Use CSS variable tokens, not hardcoded hex. Never use `bg-white` directly — use `bg-[rgb(var(--c-card-bg))]` or the `.card`/`.input-base` classes
- **Mobile:** All pages must work at 375px. No horizontal overflow ever.

---

## File Structure
```
app/
  page.tsx                    — Landing page
  login/page.tsx              — Magic link login
  auth/callback/route.ts      — Auth redirect handler
  complete-profile/page.tsx   — Post-signup onboarding
  dev-login/page.tsx          — Preview auth bypass
  dashboard/page.tsx          — Main dashboard
  dashboard/log/page.tsx      — 7-step case logging wizard (large file ~1200 lines)
  dashboard/case/[id]/page.tsx — Case detail
  dashboard/history/page.tsx  — Case history + filters

components/
  Onboarding.tsx
  HistoryFilters.tsx
  Icons.tsx                   — Custom SVGs: Clipboard, Leaf, ChartBar, Flame, Sprout
  SignOutButton.tsx

lib/
  types.ts                    — All interfaces, enums, constants, WizardState
  emissions.ts                — calcItemEmissions, calcSetEmissions, calcTotalEmissions, fmtEmissions, emColor, emBgColor
  supabase-browser.ts         — Browser Supabase client
  supabase-server.ts          — Server Supabase client

middleware.ts                 — Protects /dashboard/* routes
```

---

## Database
| Table | Key Columns |
|-------|-------------|
| `profiles` | id, email, full_name, role, institution |
| `cpt_codes` | code, description, category, common_approaches[] |
| `equipment` | id, name, category, emission_factor_kg, is_reusable |
| `instrument_sets` | id, name, institution, per_use_emission_kg |
| `cases` | id, user_id, cpt_code, surgical_approach, case_date, duration_minutes, anesthesia_type, anesthesia_gas, total_emissions_kg |
| `case_items` | case_id, equipment_id, quantity, subtotal_emissions_kg |
| `case_sets` | case_id, instrument_set_id, quantity, subtotal_emissions_kg |

**Views:** `cases_with_details` (cases + procedure name/category + logged_by), `emissions_by_approach` (aggregated avg/min/max by procedure + approach)

---

## Emission Formula
```
total = Σ(item.quantity × item.emission_factor_kg) + Σ(set.quantity × set.per_use_emission_kg)
```
Utilities: `lib/emissions.ts` — use `calcTotalEmissions(items, sets)`, `fmtEmissions(kg)`, `emColor(kg)`

---

## Key Rules / Gotchas
1. **Cookie type:** In `supabase-server.ts` and `middleware.ts`, type `cookiesToSet` as `{ name: string; value: string; options?: any }[]` explicitly
2. **iOS viewport:** Export `viewport` config in `layout.tsx` with `maximumScale: 1`
3. **375px constraint:** Every page works at 375px. No horizontal overflow.
4. **Expandable sections:** Use `collapse-content`/`open` CSS pattern
5. **Auth:** Magic link only — no passwords, no OAuth
6. **Required case fields:** `duration_minutes`, `anesthesia_type`, `anesthesia_gas` — always validate these
7. **Enums:** `SurgicalApproach` = laparoscopic | robotic | open | hybrid | endoscopic; `Role` = attending | fellow | resident | student | other

---

## Mobile App
Lives in `/mobile` — Expo managed workflow, TypeScript, NativeWind, Expo Router, same Supabase backend.
Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

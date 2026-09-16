# Build decisions and open questions

Decisions made while building the first cut, where the spec was silent or where I deviated. Each one is cheap to reverse. Items marked **your call** are the ones worth a minute of your attention.

## Deviations from the spec

- **WhatsApp shows as Connected for every tenant.** The spec says only the POS (and 7shifts for two tenants) are connected. The Today page badge says "Sent to WhatsApp", so leaving WhatsApp as Available would have been incoherent in the demo. **Your call.**
- **Two ports added beyond the seven listed:** `ApprovalQueue` and `IntegrationRegistry`. The rule that pages never import fixtures directly needed a port for each. They are interfaces only.
- **Flagged shifts are front-of-house only.** Kitchen shifts are sized by prep, not covers, and flagging them made the labour list noisy. The planted Tuesdays and Friday are all FOH.
- **The orchestrator panel is computed from the run data**, not hard-coded to "4 agents, 11 steps, 1 approval pending". On a Wednesday it reads "4 agents, 13 steps, 2 approvals pending, 0 errors" because the Labour Optimizer proposes the morning after a Tuesday. Real numbers over the spec's illustrative ones.
- **Fixtures regenerate on every build** (`prebuild`). Otherwise "yesterday" goes stale the day after deploy. The generator is seeded, so the same date gives the same numbers. Set `FIXTURE_TODAY` to pin it.
- **Reorder quantity is one par**, rounded to a pack. That is what makes the spec's "40 lb chicken thigh from Sysco ($212)" come out exactly.
- **shadcn/ui components are hand-authored** in `src/components/ui` on top of Radix, following shadcn's conventions and `components.json`. The shadcn registry was unreachable from the build environment. Drop-in replacement with `npx shadcn add` works whenever you like.

## Things to decide before the first demo

- **Which tenant opens by default.** Currently Prairie Table. If the first meeting is a hotel, switch `DEFAULT_LOCATION` in `src/components/providers/app-state.tsx`.
- **Session on reload.** The spec says in-memory only, so a phone refresh sends you back to login. Any email works, so it costs ten seconds. If that will annoy you mid-demo, a one-line `sessionStorage` flag fixes it, at the cost of the spec's "memory only" rule.
- **Room service as a channel.** I added `room_service` as a fourth channel so the hotel's Today tile reads "Room service share" instead of "Delivery share". If the hotels don't think of it that way, rename the label.
- **Labour target for the hotel is 30%**, the restaurants 28%. The settings page lets you change it per tenant during the demo.

## Working notes

Session one built the whole spec in one pass rather than stopping at each checkpoint, because the session was unattended. Every checkpoint's acceptance (build passes, screenshot, no console errors, no placeholder text, 390px layout) was verified with a Playwright sweep across all four tenants and both viewports before commit.

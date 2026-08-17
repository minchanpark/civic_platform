# CivicPin Design System

Status: canonical implementation contract  
Updated: 2026-08-16  
Sources:

- Citizen service: `/Users/minchanpark/Desktop/service-portal-design-system.md`
- Manager service: `/Users/minchanpark/Desktop/manager_page_design_system.md`

This document resolves the two source systems into one path-scoped contract. It does not average or mix their visual languages.

## 1. Surface ownership

| Surface | Routes | Design language | Theme root |
|---|---|---|---|
| Citizen service | `/`, `/report`, `/tickets`, `/tickets/*` | Service Portal | `:root` / `.citizen-page` |
| Public player | `/player` | Service Portal data-display composition | `.player-page` |
| Manager service | `/admin` including auth, denied, loading, dashboard and dialog | KRDS manager | `.admin-page` |

When a shared class is rendered below `.admin-page`, the KRDS variables override the citizen defaults. Product code must use semantic variables and component classes; route-specific colors and spacing are not allowed.

## 2. Shared non-negotiables

- WCAG 2.2 AA is the minimum. Text contrast is at least 4.5:1 and non-text UI contrast at least 3:1.
- Every actionable target is at least 44×44px, fully keyboard-operable, and has a visible `:focus-visible` indicator.
- A skip link is the first focusable item. Focus order follows visual order and no content is lost at 200% browser zoom or 320px viewport width.
- Motion is optional feedback. `prefers-reduced-motion: reduce` removes nonessential transition and animation.
- Persistent labels are required. Errors are summarized, linked to fields, announced, and also attached to each invalid field with `aria-invalid` and `aria-describedby`.
- Status is always communicated in text. Color and icons are supplementary.
- Navigation uses links; mutations use buttons. Loading preserves control size and exposes `aria-busy` where applicable.
- Maps always have a textual or native-control alternative. Public chart/map aggregates have an equivalent table.
- Card content grows naturally. Fixed heights may only be minimum visual targets, never clipping constraints.

## 3. Citizen service tokens

```css
--color-primary: #25798a;
--color-primary-hover: #1e6573;
--color-primary-active: #194f5a;
--color-on-primary: #ffffff;
--color-accent: #f39126;
--color-focus: #7c3aed;
--color-success: #087a4b;
--color-warning: #b54708;
--color-error: #b42318;
--color-info: #175cd3;
--color-text: #222222;
--color-text-secondary: #5f666b;
--color-text-muted: #7e858a;
--color-background: #eef1f3;
--color-surface: #ffffff;
--color-surface-subtle: #f4f5f7;
--color-surface-strong: #e5e9ec;
--color-border: #d7dee2;
--color-border-strong: #a0b3b0;
```

Typography uses `system-ui`, Apple system fonts, `Noto Sans KR`, and `Noto Sans TC`. Body is 16/24. Page titles are 28/36 on mobile and 36/44 on desktop. Card titles are 22–24px. Labels are 14/20.

Spacing follows 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px. Radii are 8, 12, 16px and full. Default controls are 48px high.

Containers use these caps and gutters:

| Viewport | Gutter | Maximum content width |
|---|---:|---:|
| 0–599 | 16px | 480px |
| 600–959 | 24px | 720px |
| 960–1199 | 32px | 960px |
| 1200+ | 40px | 1120px |

Citizen components:

- App header: sticky, 60px mobile and 72px desktop; native disclosure menu on compact screens; active link has `aria-current="page"`.
- Action grid: two mobile columns, three tablet columns and four desktop columns with 16px mobile and 24px desktop gaps. Cards use a 4:3 category-colored gradient visual, a white line icon, a separate white text panel, `shadow-md` and 16px radius. Labels grow naturally and a 390px viewport shows two columns.
- Form card/section: full width on mobile, maximum 700px on desktop, 24×16px mobile and 32×40px desktop padding, 12px radius. Primary mobile submit is full width.
- Map controls: the citizen report map opens at maximum zoom around the permitted current location; district selection moves the map to that district. A valid PIN displays its latitude, longitude and server-resolved address below the coordinate fields. A compact 44×44 current-location icon overlays the bottom-right without visible text or overlap with Leaflet controls, while its accessible name announces the action and status. General photo intake exposes a device-file action and a separate live rear-camera preview/capture action; the source actions collapse to one column below 600px.
- Content/data cards: one column mobile, two tablet, up to three desktop. Tables remain the equivalent representation for map/chart aggregates.
- Footer: policy, contact, accessibility and copyright are separate groups and wrap naturally.

## 4. Manager service tokens

```css
--color-primary: #256ef4;
--color-primary-hover: #0b50d0;
--color-primary-active: #083891;
--color-on-primary: #ffffff;
--color-text: #1e2124;
--color-text-secondary: #464c53;
--color-text-muted: #6d7882;
--color-background: #f4f5f6;
--color-surface: #ffffff;
--color-surface-primary: #ecf2fe;
--color-border: #b1b8be;
--color-border-strong: #58616a;
--color-error: #de3412;
--color-warning: #ffb114;
--color-success: #228738;
--color-info: #0b78cb;
--color-point: #d63d4a;
```

Typography uses `Pretendard GOV`, Pretendard and Korean system fallbacks. Body is 17px/1.5 with only 400 and 700 weights. Manager H1 is 40px desktop and 28px mobile.

Spacing follows 2, 4, 8, 16, 24, 32, 40px. Panels use 1px borders, 8px radius and no shadow. Shadows are reserved for overlays. The desktop content cap is 1200px with 24px gutters at 1280px and above.

Manager components:

- Buttons: 48px high, 16px horizontal padding, 6px radius, 17px/400.
- Text inputs and selects: 56px high, 16px horizontal padding, 6–8px radius, 19px/400.
- Focus: 4px government-blue halo on every interactive element.
- Status badge: 24px high, 8px horizontal padding, 4px radius, 15px/400. All five workflow states have text and semantic color.
- Detail dialog: preserve the PRD-required bottom-sheet placement, while using the KRDS overlay surface: 12px top radius, 40px desktop padding, black 0.5 backdrop and modal shadow. On mobile it is full width with safe-area padding and contained scrolling.
- Dialog behavior: initial focus, Tab/Shift+Tab trap, Escape close and focus restoration to the opener are required. The backdrop is not a tab stop.
- Text display controls offer 90/100/110/130/150%. High-contrast mode is a token override, not alternate markup.
- Loading exposes `aria-busy`; errors provide retry/recovery; empty states provide a next action or filter reset where applicable.

## 5. Status semantics

| State | Citizen treatment | Manager treatment | Meaning |
|---|---|---|---|
| `received` | warning text/surface | warning badge | Received, not yet opened |
| `viewed` | info text/surface | information badge | Opened by a manager |
| `in_progress` | primary text/surface | primary badge | Work or transfer has started |
| `on_hold` | error/point text/surface | point badge | Paused with reason and next review |
| `completed` | success text/surface | success badge | Final manager confirmation completed |

Administrative and field status remain separate in content and data. Styling must never imply that administrative completion proves field resolution.

## 6. Responsive and localization rules

- Citizen breakpoints: 360, 600, 960 and 1200px. Manager breakpoints: 360, 768, 1024 and 1280px.
- Reflow existing components; do not replace them with different mobile-only implementations.
- Long Korean, Traditional Chinese, English, email, ticket and district strings wrap without overlap. Do not truncate information required to complete a task.
- Dates, counts and units stay in localizable text nodes. Icons do not contain essential text.
- At 320px there is no page-level horizontal scroll. Data tables may use a labelled internal scroll region when their textual equivalent must remain tabular.

## 7. Definition of 100% design-system application

“100%” means every applicable item below passes; optional source-document patterns that the product does not use are not fabricated.

- [x] All rendered routes use the correct path-owned theme and semantic tokens.
- [x] No legacy palette variables or route-local arbitrary visual values remain in application UI CSS.
- [x] Typography, container widths, spacing, radii, controls, cards, statuses and overlays match this contract.
- [x] Citizen header, action grid, form, content/data cards and footer match their required responsive compositions.
- [x] Manager dashboard, filters, badges, panels and dialog match KRDS specifications.
- [x] Skip link, current navigation, field errors, live updates, map alternatives, focus trap/restoration, text scaling, high contrast and reduced motion work.
- [x] Automated lint, typecheck, unit, build and browser acceptance tests pass.
- [x] Visual inspection passes at 320px, 390px, desktop widths and equivalent 200% reflow, including authenticated manager UI.
- [x] A final Ponytail review finds no safe in-scope simplification left unapplied.

Verification record (2026-08-16): unit 21/21, DB 147/147, browser 8/8, typecheck/lint/build/DB lint pass; authenticated dialog initial focus, trap and restoration all pass; report error summary receives focus and links all seven invalid fields; 320/390/1440px and manager 150%/high-contrast views have zero page-level horizontal overflow. Final Ponytail review: `Lean already. Ship.`

# Darra Frontend — Design System & UI Guide

## What Darra Is

Darra is a **digital products marketplace**. Sellers list digital goods (eBooks, templates, courses, software, music, art, design assets). Buyers browse, purchase, and download them instantly. The purchase receipt is a QR-coded "ticket" used for access/download verification.

**Never use "event" or "ticket" language in UI copy.** Always say "product", "library", "purchase".

---

## Design System — Google Material Design 3

### Primary Color
```
#3800ff  —  Darra Indigo
```

### Color Tokens (globals.css)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--md-primary` | `#3800ff` | `#beb2ff` | Buttons, links, active states |
| `--md-on-primary` | `#ffffff` | `#1b00a6` | Text on filled primary |
| `--md-primary-container` | `#e8deff` | `#2800c4` | Tonal button bg, chip bg |
| `--md-on-primary-container` | `#12005e` | `#e8deff` | Text in primary container |
| `--md-secondary` | `#5e5a7d` | `#c9c3ea` | Secondary actions |
| `--md-surface` | `#fefbff` | `#1b1b1f` | Page background |
| `--md-surface-variant` | `#e5deff` | `#46464f` | Card, input backgrounds |
| `--md-on-surface` | `#1b1b1f` | `#e6e1e5` | Body text |
| `--md-on-surface-variant` | `#49454f` | `#cac4d0` | Secondary text, labels |
| `--md-outline` | `#79747e` | `#938f99` | Input borders, dividers |
| `--md-error` | `#b3261e` | `#f2b8b5` | Error states |
| `--md-on-error` | `#ffffff` | `#601410` | Text on error |

### Typography Scale (Inter font)

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display Large | 57px / 3.5rem | 400 | 64px | Hero headline |
| Display Medium | 45px / 2.8rem | 400 | 52px | Section hero |
| Headline Large | 32px / 2rem | 400 | 40px | Page titles |
| Headline Medium | 28px / 1.75rem | 400 | 36px | Section titles |
| Title Large | 22px / 1.375rem | 500 | 28px | Card titles |
| Title Medium | 16px / 1rem | 500 | 24px | Sub-titles |
| Body Large | 16px / 1rem | 400 | 24px | Body text |
| Body Medium | 14px / 0.875rem | 400 | 20px | Secondary body |
| Label Large | 14px / 0.875rem | 500 | 20px | Button labels |
| Label Medium | 12px / 0.75rem | 500 | 16px | Chip labels, captions |

### Spacing & Shape

- **Border radius — small:** `rounded` (4px) — chips, badges  
- **Border radius — medium:** `rounded-xl` (12px) — cards, inputs, buttons  
- **Border radius — large:** `rounded-2xl` (16px) — modals, drawers  
- **Border radius — full:** `rounded-full` — avatar, FAB  
- **Elevation 1 (card):** `shadow-sm` + subtle border  
- **Elevation 2 (raised card):** `shadow-md`  
- **Elevation 3 (modal):** `shadow-xl`  

---

## Component Patterns

### Buttons

```tsx
// Filled (primary action)
<button className="bg-[#3800ff] text-white rounded-xl px-6 py-3 font-medium hover:bg-[#2d00d4] transition-colors">

// Outlined (secondary action)  
<button className="border border-[#3800ff] text-[#3800ff] rounded-xl px-6 py-3 font-medium hover:bg-[#e8deff] transition-colors">

// Text (tertiary action)
<button className="text-[#3800ff] rounded-xl px-4 py-2 font-medium hover:bg-[#e8deff] transition-colors">

// Tonal (alternative filled)
<button className="bg-[#e8deff] text-[#12005e] rounded-xl px-6 py-3 font-medium hover:bg-[#d4c9ff] transition-colors">
```

### Text Fields (MD3 Outlined)

- Border: `border border-[--md-outline] rounded-xl`
- On focus: `border-[#3800ff] ring-1 ring-[#3800ff]`
- Label: static `<Label>` above field (not floating, for simplicity)
- Height: `py-3 px-4` (48px effective)

### Cards (MD3 Elevated)

```tsx
<div className="bg-white rounded-xl shadow-sm border border-[--md-surface-variant] p-4">
```

### Chips (Filter / Category)

```tsx
// Unselected
<button className="rounded border border-[--md-outline] px-4 py-1.5 text-sm font-medium text-[--md-on-surface-variant] hover:bg-[--md-surface-variant]">

// Selected  
<button className="rounded border border-[#3800ff] bg-[#e8deff] px-4 py-1.5 text-sm font-medium text-[#12005e]">
```

---

## Pages — Design Specs

### `/` Landing Page
- **Hero:** White/light surface, large headline, subhead, two CTA buttons + search
- **Headline:** "Your marketplace for digital products"
- **Subhead:** "Discover, buy, and sell eBooks, templates, courses & more"
- **Primary CTA:** Filled — "Browse Products" → `/tickets`
- **Secondary CTA:** Outlined — "Start Selling" → `/register`
- **Categories row:** Scrollable chips — All, eBooks, Templates, Courses, Software, Music, Art
- **Featured Products grid:** MD3 elevated cards with cover image, title, price, "View" button
- **Feature highlights section:** 4 cards — Secure Payments, Instant Download, QR Access, Seller Tools

### `/login` Sign In
- **Layout:** Two-column split (desktop) / single column (mobile)
- **Left panel:** `bg-[#3800ff]` — white Darra logo, tagline "The marketplace for creators and learners"
- **Right panel:** White surface, form
- **Fields:** Email, Password (with show/hide toggle)
- **Actions:** Filled "Sign in" button, Text "Forgot password?" link
- **Footer:** "Don't have an account? Create one" → `/register`

### `/register` Sign Up
- **Layout:** Same split as login
- **Left panel:** Same brand panel
- **Right panel:** Form with role selector
- **Role selector:** Two-button segmented control — "Buyer" (ShoppingBag icon) / "Seller" (Store icon)
- **Fields:** Full Name, Email, Password, Confirm Password
- **Seller extra fields:** Brand Name (required), Brand URL (optional) — shown when Seller selected
- **Actions:** Filled "Create account" button
- **Footer:** "Already have an account? Sign in" → `/login`

### `/verify-otp` OTP Verification
- Centered card on white surface
- 6-digit OTP input boxes (MD3 outlined style)
- Auto-advance between boxes
- "Resend code" text button

### `/tickets` Products Browse
- **Page title:** "Browse Products" (not "Browse Tickets")
- MD3 search bar
- Category filter chips below search
- Responsive product grid (1→2→3 cols)
- Card: cover image, title, seller name, price badge, "Add to Cart" button

### `/tickets/[id]` Product Detail
- Cover image header
- Title, seller, description
- Price + "Add to Cart" filled button
- "Digital product" — instant access after purchase copy

### `/cart` Cart
- MD3 list-style cart items
- Quantity stepper (− qty +)
- Order summary card
- "Pay now" filled button (`#3800ff`)

### `/account/tickets` My Library
- **Page title:** "My Library"  
- Purchased products as cards
- "Download" / "Access" button on each
- QR code viewer for access verification

### `/dashboard/seller/*` Seller Dashboard
- MD3 Navigation Rail (desktop sidebar replacement)
- Surface-colored backgrounds
- Stat summary cards (MD3 elevated)
- Replace "event"/"ticket" language with "product"/"order"

### `/dashboard/buyer/*` Buyer Dashboard
- Same navigation style
- "My Library" link (not "My Tickets")

---

## Header & Footer

### Header (`site-header.tsx`)
- Logo: Small `#3800ff` square with "D" or simple mark + "Darra" wordmark
- Nav link: "Browse" → `/tickets` (not "Browse Tickets")
- Auth: cart icon, "Dashboard", "My Library" (not "My Tickets")
- Sign in button: filled `#3800ff`

### Footer (`site-footer.tsx`)
- Tagline: "Your trusted marketplace for digital products and creative assets."
- Platform links: Browse Products, Sell on Darra, My Account, Support
- Replace all ticket/event references with product/digital language

---

## Rules

1. **No blue-to-purple gradients** — use flat `#3800ff` fills instead
2. **No "ticket", "event", "venue" copy** in user-facing text
3. **Primary color is always `#3800ff`** — never `blue-600` or `indigo-600`
4. **All logic, hooks, API calls stay unchanged** — UI only
5. **Keep all existing imports** from `@/lib/auth/auth-context`, `@/lib/cart/cart-context`, etc.
6. **Forms use the same state, validation, and submit handlers** — only className changes

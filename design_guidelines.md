# Wolfpack Wash D2D Canvassing App - Design Guidelines

## 1. Brand Identity

**Purpose**: Field sales tool for door-to-door reps to log visits, capture quotes, and track follow-ups while standing on homeowners' doorsteps.

**Aesthetic Direction**: **Professional-Utilitarian** - Clean, high-contrast, task-focused interface optimized for outdoor use. Think "field clipboard meets modern CRM" - trustworthy, efficient, zero fluff.

**Memorable Element**: Map-centric workflow with instant address recognition. The app feels like a "smart territory manager" that remembers every door knocked.

**Color Strategy**: High-contrast palette for outdoor readability with strong CTAs that work in bright sunlight.

---

## 2. Navigation Architecture

**Root Navigation**: Tab Bar (4 tabs)
- **Map** (Canvass) - Primary action, leftmost position
- **Leads** - List/grid view
- **Follow-ups** - Time-sensitive tasks
- **Profile** - Settings, sync status, logout

**Floating Action Button**: "Log Touch" button appears when viewing lead detail (not on map - map uses bottom sheet).

**Key Screens**:
- `/login` - Google OAuth
- `/canvass` - Map + bottom sheet form (Stack)
- `/leads` - Filterable list (Tab: Leads)
- `/leads/[id]` - Lead detail timeline (Stack)
- `/followups` - Priority queue (Tab: Follow-ups)
- `/admin` - Admin dashboard (Stack, admin-only)

---

## 3. Screen-by-Screen Specifications

### Login Screen
- **Layout**: Centered card on white background
- **Header**: None (full-screen splash)
- **Content**: 
  - App logo (splash-icon.png) centered
  - "Sign in with Google" button (bold, primary color)
  - Small text: "Wolfpack Wash Field App"
- **Safe Area**: Standard insets

### Canvass Screen (Map)
- **Header**: Custom transparent header with search bar + "Use My Location" button
- **Main Content**: Google Map (full screen)
  - Dropped pins show lead status colors (new/contacted/interested/booked)
  - Current location dot
- **Bottom Sheet**: Slides up when pin dropped or address searched
  - Draggable handle at top
  - Form fields (see Form Specifications below)
  - Sticky "Save Touch" button at bottom
- **Safe Area**: 
  - Top: insets.top + Spacing.xl (header is transparent)
  - Bottom: Dynamic based on bottom sheet height

### Bottom Sheet Form (Canvass)
- **Layout**: Scrollable form with card-style field groups
- **Fields** (in order):
  1. Address preview (large text, editable icon)
  2. Outcome dropdown (required, bold label)
  3. Homeowner Name (optional)
  4. Phone (optional, formatted)
  5. Email (optional)
  6. Services checkboxes (from d2d_services table)
  7. Quote builder (conditional, appears if "Quoted" selected)
  8. Follow-up controls (date picker + channel + priority)
  9. Notes textarea
  10. Media upload button (camera icon + gallery)
- **Save Button**: Fixed at bottom of sheet, full-width, primary color
- **Empty State**: "Tap map or search address to start"

### Leads List Screen
- **Header**: Standard with search bar and filter icon (right)
- **Content**: Scrollable list of lead cards
  - Each card shows: Address, last touch date, status badge, next follow-up indicator
  - Swipe actions: Call, Text (iOS style)
- **Filters Sheet**: Modal from bottom with chips for status/outcome/service
- **Empty State**: Illustration (empty-leads.png) + "No leads yet. Start canvassing!"
- **Safe Area**: Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl

### Lead Detail Screen
- **Header**: Standard with "Edit" button (right)
- **Content**: Scrollable with sections:
  1. Lead card (address, contact info, quick action buttons)
  2. Timeline (chronological touches with outcome icons)
  3. Quotes (expandable cards with line items)
  4. Media gallery (grid of thumbnails)
- **Floating Button**: "New Touch" (bottom-right corner with shadow)
- **Safe Area**: Top: Spacing.xl, Bottom: insets.bottom + Spacing.xl + 72px (for FAB)

### Follow-ups Screen
- **Header**: Standard with "Today/This Week/All" segmented control
- **Content**: Grouped list by priority (High/Med/Low)
  - Each item shows lead address, follow-up time, channel icon
  - Overdue items highlighted in warning color
- **Empty State**: "You're all caught up!" (empty-followups.png)
- **Safe Area**: Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl

---

## 4. Color Palette

**Primary**: `#0066CC` (strong blue, high contrast)
**Secondary**: `#FF6B35` (safety orange, urgent actions)
**Background**: `#FFFFFF` (white)
**Surface**: `#F5F5F7` (light gray for cards)
**Text Primary**: `#1C1C1E` (near black)
**Text Secondary**: `#8E8E93` (gray)

**Status Colors**:
- New: `#34C759` (green)
- Interested: `#007AFF` (blue)
- Quoted: `#FF9500` (orange)
- Booked: `#5856D6` (purple)
- Do Not Knock: `#FF3B30` (red)

**Semantic**:
- Success: `#34C759`
- Warning: `#FFCC00`
- Error: `#FF3B30`
- Info: `#007AFF`

---

## 5. Typography

**Font**: System font (SF Pro for iOS, Roboto for Android)

**Type Scale**:
- Title: 28px, Bold
- Headline: 22px, Semibold
- Body: 17px, Regular
- Caption: 13px, Regular
- Button: 17px, Semibold

---

## 6. Visual Design Notes

- **Buttons**: Rounded corners (8px), solid primary color, white text, subtle drop shadow for floating elements
- **Form Fields**: 1px gray border, 8px rounded corners, 44px min height for touch targets
- **Cards**: White background, 1px gray border, 12px rounded corners, 2px bottom shadow
- **Icons**: Feather icons from @expo/vector-icons, 24px default size
- **Spacing**: Use 4px base unit (Spacing.xs=4, sm=8, md=12, lg=16, xl=24, xxl=32)
- **Bottom Sheet**: Frosted glass effect (blur + transparency) on handle area
- **Map Pins**: Custom markers with status color dot, white circle background

---

## 7. Assets to Generate

1. **icon.png** - App icon with "WW" monogram in primary blue, clean sans-serif, used on device home screen
2. **splash-icon.png** - Same as icon.png but larger, used during app launch
3. **empty-leads.png** - Minimalist illustration of clipboard with checkmarks, used on Leads List when empty
4. **empty-followups.png** - Minimalist illustration of calendar with bell, used on Follow-ups when empty
5. **avatar-placeholder.png** - Generic user avatar (simple circle with initials "R" for Rep), used in Profile tab

All illustrations should use the primary blue color with light gray accents, simple line-art style, transparent background.
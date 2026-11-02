---
name: MotionLab
description: Local video editing in a compact neutral dark workbench.
colors:
  bg: "#0d0e11"
  panel: "#121316"
  raised: "#202228"
  border: "#2b2e36"
  text: "#edf0f5"
  muted: "#a0a8b8"
  accent: "#69a7ff"
  blue: "#216bd1"
  green: "#43d76c"
  danger: "#ff9d9d"
typography:
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 750
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.5
  secondary:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  compact: "4px"
  control: "6px"
  symbol: "8px"
  transport: "12px"
spacing:
  compact: "8px"
  control: "12px"
  panel: "16px"
  rail: "18px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "#fff"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  button-command:
    backgroundColor: "{colors.green}"
    textColor: "#062211"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  input:
    backgroundColor: "#191b21"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px"
  media-card:
    backgroundColor: "#1c1e24"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px"
  metadata-pill:
    backgroundColor: "#20232a"
    textColor: "#c1cde1"
    rounded: "{rounded.compact}"
    padding: "4px 7px"
---

# Design System: MotionLab

## Overview

**Creative North Star: "Compact NLE workspace"**

MotionLab uses the restrained material language of a local editing desk: dark neutral work surfaces, direct controls and precise time data. The visual hierarchy gives user footage the largest quiet surface and keeps editing decisions close to their context.

Density serves the task. Tonal panels, narrow dividers and modest corners establish regions; saturated color identifies actions and state. The interface remains a browser application, without simulated operating-system window chrome.

**Key Characteristics:**
- Neutral dark panels with thin structural dividers.
- Blue editing actions and selection; green command application and local state.
- Local Manrope, compact labels and tabular time data.
- Real user media and state-driven metadata.

## Colors

The neutral foundation separates work regions while two purposeful accents organize interaction.

### Primary
- **Action Blue** (`blue`): export and transport actions.
- **Selection Blue** (`accent`): selection outlines, focus rings, links and playhead.

### Secondary
- **Command Green** (`green`): command application and local-state indicators.

### Tertiary
- **Warning Rose** (`danger`): destructive action text, supported by dark rose backgrounds and borders.

### Neutral
- **Workspace Black** (`bg`): application foundation.
- **Panel Charcoal** (`panel`): library and inspector.
- **Control Graphite** (`raised`): standard buttons.
- **Divider Graphite** (`border`): structural region borders.
- **Reading White** (`text`): primary content.
- **Metadata Slate** (`muted`): secondary copy and metadata.

**The Action Color Rule.** Blue identifies editing actions and selection; green identifies command application and local state.

## Typography

Manrope is served locally through `/font.ttf` as a variable face (weights 200–800), with system-ui and sans-serif fallbacks. It supplies both interface labels and headings; there is no separate display or monospace family.

### Hierarchy
- **Title:** panel headings use the title token; the brand is 18px, weight 700 by its strong element, with tighter tracking. Mobile section headings are 14px.
- **Body:** the body token is the default for controls and copy.
- **Label:** media names, clip names and selected-source labels use 12px; names use weight 650.
- **Secondary:** 11px metadata, help, counts and time annotations.
- **Time data:** tabular numerals stabilize duration, trim fields, ruler and transport. The principal transport clock uses weight 750, growing to 14px at wide desktop widths.

**The Legible Hierarchy Rule.** Use 12px or larger for primary labels; reserve 11px for secondary information.

## Layout

The current Workbench uses a 58px header, a flexible upper workspace, one full-width timeline and a separate command strip. Desktop columns are `clamp(220px,22vw,320px) minmax(0,1fr) clamp(245px,22vw,310px)`. The timeline row is 215px, increasing to 230px at 1500px. The shell uses `100dvh` with a 690px minimum; shorter desktop viewports may scroll. Library and inspector scroll internally.

At 1200px the side columns become 210px and 240px and secondary header detail is hidden. At 960px the library and preview remain paired in a 450px row, followed by timeline and inspector. At 600px the page stacks preview, library, timeline, inspector and command strip. The final mobile preview rule fixes its height at 375px. Timeline content scrolls horizontally inside its own region.

Panel padding is generally 16px, with 12px mobile edges. Common control gaps are 8–12px. These measurements describe Workbench; they do not require every future MotionLab surface to reproduce its editing layout.

## Elevation & Depth

Depth comes from tonal layering, one-pixel borders and contained black video space. There are no box shadows. Selection uses an inset blue outline; keyboard focus uses an outward two-pixel blue outline with a three-pixel offset. Toasts overlay the workspace with colored fills and borders, without shadow. Button transitions last 150ms and toast opacity lasts 160ms; reduced-motion preference removes transitions.

## Shapes

Controls and media cards use modest six-pixel corners. Monitor, timeline clips and metadata pills use four-pixel corners; symbol wells use eight pixels. The play button and count badge use twelve-pixel corners. Stroke SVG icons are normally 18px, with current-color strokes; large pictograms belong to empty states. Dashed outlines communicate import or empty/drop affordances.

## Components

### Buttons
Standard buttons use graphite fill, a visible border and compact padding. Hover lightens fill and border; active darkens the pressed surface. Disabled controls use opacity 0.45 and a not-allowed cursor. Export uses solid blue with white text; command application uses solid green with dark text. Destructive removal uses rose text over a dark rose surface. Icon controls retain accessible names.

### Inputs / Fields
Dark inset fields use a visible gray border, six-pixel corners and blue caret/focus. Trim values use tabular numerals and source-relative seconds. Native select, checkbox and range controls retain semantics; range and checkbox accents are blue.

### Cards / Containers
Media cards pair actual video thumbnails with truncated source names, metadata and a direct add button. Repeated cards use eight-pixel padding and gaps. Panels are structural regions rather than floating cards.

### Navigation
The header contains the MotionLab home link, project context, local status and export action. It does not present unimplemented editing modes as tabs. At smaller widths secondary header copy disappears before the main action.

### Metadata Pills
Compact rounded tonal labels display actual format and counts. They are readouts, not invented navigation or filters.

### Timeline and Monitor
One sequence track carries video and source audio. Selected clips use a blue inset outline and expose their trim values in the inspector. A two-pixel playhead links time and position. The monitor contains an output-ratio frame and fits source footage within it, retaining letterboxing where necessary. Empty states provide direct import guidance.

### Command Strip
A distinct bottom region contains a labeled command field, green application button and concise supported-command help. Complex requests continue in the Codex conversation; the strip does not imply arbitrary natural-language capabilities.

## Do's and Don'ts

### Do:
- **Do** use real source thumbnails and state-driven counts, format and export data.
- **Do** keep semantic controls, visible keyboard focus and reduced-motion support.
- **Do** preserve the distinction between primary labels and secondary metadata.
- **Do** keep fonts and application resources local.

### Don't:
- **Don't** add macOS traffic-light window controls.
- **Don't** use generated demo footage or invented metadata as product state.
- **Don't** imply multitrack audio, a mixer or unimplemented mode tabs.
- **Don't** introduce external font or script CDNs.

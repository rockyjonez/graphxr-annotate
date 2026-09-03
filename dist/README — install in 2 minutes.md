# GXR Annotate v0.6.0 — try it out

A live annotation layer for GraphXR / Kineviz Desktop: mark up the canvas in place
(callouts, cluster circles, arrows, text, numbered tour steps, a view title),
saved per view, with a built-in presentation tour and PNG export to clipboard.

No installation into the app — the whole tool lives inside a grovebook file.

## Requirements

- Kineviz Desktop 0.17.x (or GraphXR web with the Grove panel)
- A project with a canvas open

## Try the demo (recommended first run)

1. Open (or create) a project.
2. Open the **Grove** panel → **FILES** → add `GXR Annotate Showcase.md` to the project.
   (Alternatively, copy the file into the project's grove folder on disk.)
3. Open the book and run its three cells in order:
   ① installs the layer (a floating toolbar appears over the canvas)
   ② seeds a small demo graph
   ③ builds sample annotations on a saved view — safe to re-run any time.
4. Play: wheel-zoom (marks stay glued to the graph), run a force layout
   (the cluster circle follows its nodes), hit ▶ for the guided tour,
   📤 to export a PNG to your clipboard.

## Use it in a real project

Add `GXR Annotate Layer.md` to any project instead — it only installs the layer,
no demo data. Run its single cell once; the toolbar survives closing the panel.

Quick reference:
- ✏️ toggles draw mode (blue edge glow = clicks create marks; Esc exits).
  Draw mode off = the layer is inert glass; camera gestures never touch marks.
- 💬 callout on a node · → arrow (tip snaps to nodes) · ⬭ drag around nodes for a
  cluster circle · ◯ ellipse · T text · ① tour steps · 🏷 view title
- Click a mark (in draw mode) to select; drag to move; double-click text to edit;
  colors/A−/A+/Aa restyle the selection. With nothing selected, A−/A+ scales the
  whole display (projector mode).
- 👁 hides the marks; ⌄ minimizes the toolbar to a 🖍 pill; the "view · N" chip
  flies the camera to the current view's annotations.
- Annotations save automatically per view into the project
  (`annotations.sidecar.json`); saving is merge-safe for multiple users.

## Known limitations

- Annotations are 2D (graph-plane); the layer fades when the view goes edge-on in 3D.
- The layer relies on app internals; if a GraphXR update changes them it fails
  with a visible banner (your annotations stay safe in the project file).

Source, issues, roadmap: https://github.com/rockyjonez/graphxr-annotate

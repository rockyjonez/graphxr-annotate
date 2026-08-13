#!/usr/bin/env node
/*
 * Generates grovebook/GXR Annotate.md by embedding annotate-core.js into a
 * Grove cell. Run after any change to annotate-core.js:  node build-grovebook.js
 */
const fs = require("fs");
const path = require("path");

const core = fs.readFileSync(path.join(__dirname, "annotate-core.js"), "utf8");
if (core.includes("```")) {
  console.error("ERROR: annotate-core.js contains a triple-backtick — would break the grovebook cell fence.");
  process.exit(1);
}

const F = "```"; // fence

const cells = [];
function cell(dname, codeMode, hide, body) {
  cells.push(
    `<!--{"pinCode":false,"dname":"${dname}","codeMode":"${codeMode}","hide":${hide}}-->\n` +
    `${F}${codeMode === "md" ? "md" : "js"}\n${body}\n${F}`
  );
}

// ---------------------------------------------------------------- hero
cell("annotate-hero", "js", true, `{
  return html\`<div style="background:linear-gradient(135deg,#0d1117 0%,#161b22 60%,#1f2933 100%);color:#e6edf3;border:1px solid rgba(48,54,61,.8);border-radius:12px;padding:28px 32px;margin-bottom:16px;font-family:-apple-system,system-ui,sans-serif;">
    <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#58a6ff;font-weight:600;">Kineviz · Canvas Annotation</div>
    <h1 style="margin:6px 0 10px;font-size:30px;line-height:1.15;color:#fff;">GXR <span style="color:#7b6cff;">Annotate</span></h1>
    <p style="margin:0;max-width:760px;color:#c9d1d9;font-size:15px;line-height:1.6;">
      Mark up the canvas without leaving Desktop. Capture the current view, draw arrows, boxes,
      highlights, text and numbered steps right here, then export the finished PNG — or copy it
      straight to your clipboard for the deck. No export → image editor → re-export round-trip.
    </p>
  </div>\`;
}`);

// ---------------------------------------------------------------- shared styles
cell("brief-styles", "js", true, `{
  const id = "nk-brief-styles";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = \`
      .nk-card{background:#161b22;border:1px solid #30363d;border-radius:12px;
        padding:22px 26px;margin-bottom:16px;color:#c9d1d9;overflow-x:hidden;
        font-family:-apple-system,system-ui,sans-serif;font-size:14px;line-height:1.65;}
      .nk-card .nk-eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;
        color:#58a6ff;font-weight:600;margin-bottom:6px;}
      .nk-card h3{color:#fff;font-size:18px;margin:2px 0 12px;}
      .nk-card h4{color:#e6edf3;font-size:13.5px;margin:18px 0 6px;letter-spacing:.01em;}
      .nk-card p{margin:0 0 10px;}
      .nk-card code{background:#0d1117;border:1px solid #30363d;border-radius:4px;
        padding:1px 5px;font-size:12.5px;color:#79c0ff;}
      .nk-card ul{margin:4px 0 10px;padding-left:18px;}
      .nk-card li{margin:3px 0;}
      .nk-table{width:100%;border-collapse:collapse;margin:8px 0 4px;font-size:12.5px;table-layout:fixed;}
      .nk-table td,.nk-table th{overflow:hidden;text-overflow:ellipsis;}
      .nk-table th{text-align:left;color:#8b949e;font-weight:600;
        border-bottom:1px solid #21262d;padding:6px 8px;}
      .nk-table td{border-bottom:1px solid rgba(255,255,255,0.04);padding:6px 8px;color:#c9d1d9;vertical-align:top;}
      .nk-step{display:inline-flex;align-items:center;justify-content:center;
        width:22px;height:22px;border-radius:50%;background:#1f6feb;color:#fff;
        font-size:12px;font-weight:700;margin-right:8px;}
    \`;
    document.head.appendChild(el);
  }
  return html\`<span style="display:none"></span>\`;
}`);

// ---------------------------------------------------------------- how it works
cell("annotate-howto", "js", true, `{
  return html\`<div class="nk-card">
    <div class="nk-eyebrow">Workflow</div>
    <h3>Three steps, zero external tools</h3>
    <p><span class="nk-step">1</span><strong>Make your view.</strong> Lay out the graph on the canvas exactly the way you want it to appear in the deliverable.</p>
    <p><span class="nk-step">2</span><strong>Capture.</strong> Pick what to include below, then hit <code>Capture current canvas view</code>. The screenshot appears in the editor without moving your camera.</p>
    <p><span class="nk-step">3</span><strong>Annotate &amp; export.</strong> Draw on it, then <code>Export PNG</code> to download — or <code>Copy PNG</code> to paste straight into Slides/Slack.</p>
    <h4>Tools</h4>
    <table class="nk-table">
      <tr><th style="width:110px;">Tool</th><th style="width:50px;">Key</th><th>What it does</th></tr>
      <tr><td>Select</td><td>V</td><td>Click to select · drag to move · drag white handles to reshape · double-click text to edit · Del deletes</td></tr>
      <tr><td>Arrow</td><td>A</td><td>Drag from tail to tip</td></tr>
      <tr><td>Box</td><td>R</td><td>Rectangle outline</td></tr>
      <tr><td>Ellipse</td><td>E</td><td>Circle / ellipse outline</td></tr>
      <tr><td>Pen</td><td>P</td><td>Freehand line</td></tr>
      <tr><td>Highlight</td><td>H</td><td>Wide translucent marker stroke</td></tr>
      <tr><td>Text</td><td>T</td><td>Click, type, Enter. Shift+Enter for a new line. Auto-outlined for legibility.</td></tr>
      <tr><td>1,2,3</td><td>N</td><td>Numbered step badges, auto-incrementing</td></tr>
    </table>
    <p style="margin-top:10px;color:#8b949e;">Undo/redo: Cmd/Ctrl+Z · Shift+Cmd/Ctrl+Z. Selecting a shape then clicking a color / width / text size restyles it. Re-capturing replaces the image and clears annotations.</p>
  </div>\`;
}`);

// ---------------------------------------------------------------- core library
cell("annotate-core-lib", "js", true, `AnnotateCore = {
${core.trimEnd()}
  return window.GXRAnnotate;
}`);

// ---------------------------------------------------------------- state
cell("annotate-shot-state", "js", true, `mutable shot = null`);

// ---------------------------------------------------------------- capture options
cell("annotate-capture-options", "js", false,
`viewof capOpts = Inputs.checkbox(
  ["Legends", "Info panel", "Navigation tools", "Frame all nodes first"],
  { value: ["Legends"], label: "Include in capture" }
)`);

// ---------------------------------------------------------------- capture button
cell("annotate-capture-button", "js", false, `{
  return await Button("📸 Capture current canvas view", async () => {
    try {
      const blob = await gxr.screenshot({
        frameNodes: capOpts.includes("Frame all nodes first"),
        includeLegends: capOpts.includes("Legends"),
        includeInfoPanel: capOpts.includes("Info panel"),
        includeNavigationTools: capOpts.includes("Navigation tools"),
        format: "png"
      });
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      mutable shot = dataUrl;
    } catch (err) {
      mutable shot = "ERROR:" + (err && err.message ? err.message : String(err));
    }
  });
}`);

// ---------------------------------------------------------------- editor
cell("annotate-editor", "js", false, `{
  if (typeof shot === "string" && shot.indexOf("ERROR:") === 0) {
    return html\`<div class="nk-card" style="border-color:rgba(248,81,73,.5);color:#ff7b72;">
      Screenshot failed: \${shot.slice(6)} — is the canvas loaded? (gxr.screenshot needs an open project view)</div>\`;
  }
  if (!shot) {
    return html\`<div class="nk-card" style="text-align:center;color:#8b949e;">
      No capture yet — arrange your canvas, then hit <strong style="color:#e6edf3;">📸 Capture current canvas view</strong> above.</div>\`;
  }
  const container = html\`<div style="max-width:100%;"></div>\`;
  AnnotateCore.mount(container, { imageDataUrl: shot, fileBaseName: "graphxr-annotated" });
  return container;
}`);

// ---------------------------------------------------------------- footer / provenance
cell("annotate-footer", "js", true, `{
  return html\`<div class="nk-card" style="font-size:12.5px;color:#8b949e;">
    <div class="nk-eyebrow">How this was created</div>
    Built by Tiby's assistant (2026-08-12) to cut the annotate-a-view workflow from five steps to three.
    Capture uses <code>gxr.screenshot()</code> (current view, camera untouched unless "Frame all nodes first" is checked);
    the editor is a self-contained SVG overlay embedded in this grovebook — no network, no external libraries.
    Source &amp; standalone version: <code>github.com/rockyjonez/graphxr-annotate</code>.
    Exported PNGs render at the capture's native resolution.
  </div>\`;
}`);

const out = cells.join("\n\n") + "\n";
const outPath = path.join(__dirname, "grovebook", "GXR Annotate.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log("Wrote", outPath, "(" + out.length + " bytes, " + cells.length + " cells)");

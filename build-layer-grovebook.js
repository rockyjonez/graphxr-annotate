#!/usr/bin/env node
/*
 * Generates grovebook/GXR Annotate Layer.md — the bootstrap book that injects
 * annotate-overlay.js into the main app window (where it survives the Grove
 * panel closing). Run after editing annotate-overlay.js.
 */
const fs = require("fs");
const path = require("path");

let core = fs.readFileSync(path.join(__dirname, "annotate-overlay.js"), "utf8");
if (core.includes("```")) { console.error("ERROR: triple backtick in overlay source"); process.exit(1); }

// strip the file's own IIFE wrapper; the cell re-wraps it via Function.toString
const open = core.indexOf("(function () {");
const close = core.lastIndexOf("})();");
if (open < 0 || close < 0) { console.error("ERROR: IIFE wrapper not found"); process.exit(1); }
const body = core.slice(open + "(function () {".length, close);

const F = "```";
const cells = [];
function cell(dname, hide, code) {
  cells.push('<!--{"pinCode":false,"dname":"' + dname + '","codeMode":"js","hide":' + hide + '}-->\n' + F + "js\n" + code + "\n" + F);
}

cell("layer-hero", "true", `{
  return html\`<div style="background:linear-gradient(135deg,#0d1117 0%,#161b22 60%,#1f2933 100%);color:#e6edf3;border:1px solid rgba(48,54,61,.8);border-radius:12px;padding:24px 28px;margin-bottom:14px;font-family:-apple-system,system-ui,sans-serif;">
    <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#58a6ff;font-weight:600;">Kineviz · Canvas Annotation</div>
    <h1 style="margin:6px 0 8px;font-size:26px;color:#fff;">GXR Annotate <span style="color:#7b6cff;">Layer</span></h1>
    <p style="margin:0;max-width:720px;color:#c9d1d9;font-size:14px;line-height:1.6;">
      A transparent annotation layer over the live canvas. Annotations are anchored to the graph
      (they follow pan/zoom/rotate, and arrows snapped to nodes follow layout moves) and are saved
      <strong>per view</strong> into this project. Run the cell below once — the floating toolbar stays even
      if you close this panel.
    </p>
    <p style="margin:10px 0 0;color:#8b949e;font-size:12.5px;">
      ✏️ Annotate toggles draw mode · → arrow (tip snaps to nodes) · ◯ ellipse · T text · ① step badges ·
      ⌫ delete selected · ↩ undo · 📤 export PNG (clipboard + preview) · Esc exits draw mode.
      Load a saved view to see (or edit) its annotations; unsaved canvases keep a per-project draft set.
    </p>
  </div>\`;
}`);

cell("layer-bootstrap", "false", `{
  function __gxrAnnotateInstall() {${body}}
  const src = "(" + __gxrAnnotateInstall.toString() + ")();";
  const doc = window.parent.document;
  const s = doc.createElement("script");
  s.textContent = src;
  doc.body.appendChild(s);
  s.remove();
  const ok = !!window.parent.__GXR_ANNOTATE__;
  return html\`<div style="font-family:-apple-system,system-ui,sans-serif;font-size:13px;padding:10px 14px;border-radius:8px;border:1px solid \${ok ? "rgba(63,185,80,.5)" : "rgba(248,81,73,.5)"};color:\${ok ? "#3fb950" : "#ff7b72"};background:#161b22;">
    \${ok ? "✅ Annotation layer active — look for the floating toolbar over the canvas. You can close this panel." : "❌ Layer failed to install — is a project canvas open? Check the console."}
  </div>\`;
}`);

const out = cells.join("\n\n") + "\n";
const outPath = path.join(__dirname, "grovebook", "GXR Annotate Layer.md");
fs.writeFileSync(outPath, out);
console.log("Wrote", outPath, "(" + out.length + " bytes)");

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
  return html\`<div style="background:#141414;color:#ACACAC;border:1px solid #303030;border-radius:6px;padding:24px 28px;margin-bottom:14px;font-family:'Lato','Helvetica',sans-serif;">
    <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#65B7F3;font-weight:600;">Kineviz · Canvas Annotation</div>
    <h1 style="margin:6px 0 8px;font-size:26px;color:#E8E8E8;">GXR Annotate <span style="color:#65B7F3;">Layer</span></h1>
    <p style="margin:0;max-width:720px;color:#ACACAC;font-size:14px;line-height:1.6;">
      A transparent annotation layer over the live canvas. Annotations are anchored to the graph
      (they follow pan/zoom/rotate, and arrows snapped to nodes follow layout moves) and are saved
      <strong>per view</strong> into this project. Run the cell below once — the floating toolbar stays even
      if you close this panel.
    </p>
    <p style="margin:10px 0 0;color:#7D7D7D;font-size:12.5px;">
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
  return html\`<div style="font-family:'Lato','Helvetica',sans-serif;font-size:13px;padding:10px 14px;border-radius:8px;border:1px solid \${ok ? "rgba(73,170,25,.5)" : "rgba(232,71,73,.5)"};color:\${ok ? "#49AA19" : "#E84749"};background:#1d1d1d;">
    \${ok ? "✅ Annotation layer active — look for the floating toolbar over the canvas. You can close this panel." : "❌ Layer failed to install — is a project canvas open? Check the console."}
  </div>\`;
}`);

const out = cells.join("\n\n") + "\n";
const outPath = path.join(__dirname, "grovebook", "GXR Annotate Layer.md");
fs.writeFileSync(outPath, out);
console.log("Wrote", outPath, "(" + out.length + " bytes)");

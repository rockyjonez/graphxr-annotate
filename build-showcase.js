#!/usr/bin/env node
/*
 * Generates grovebook/GXR Annotate Showcase.md — the demo book:
 * hero → bootstrap the v0.5 layer → seed a 3-community demo graph →
 * one-click sample annotations (all three anchor classes + tour steps) →
 * guided "try this" card. Run after editing annotate-overlay.js.
 */
const fs = require("fs");
const path = require("path");

let core = fs.readFileSync(path.join(__dirname, "annotate-overlay.js"), "utf8");
if (core.includes("```")) { console.error("ERROR: triple backtick in overlay source"); process.exit(1); }
const open = core.indexOf("(function () {");
const close = core.lastIndexOf("})();");
if (open < 0 || close < 0) { console.error("ERROR: IIFE wrapper not found"); process.exit(1); }
const body = core.slice(open + "(function () {".length, close);

const F = "```";
const cells = [];
function cell(dname, hide, code) {
  cells.push('<!--{"pinCode":false,"dname":"' + dname + '","codeMode":"js","hide":' + hide + '}-->\n' + F + "js\n" + code + "\n" + F);
}

// ---------------------------------------------------------------- hero
cell("showcase-hero", "true", `{
  return html\`<div style="background:linear-gradient(135deg,#0d1117 0%,#161b22 60%,#1f2933 100%);color:#e6edf3;border:1px solid rgba(48,54,61,.8);border-radius:12px;padding:24px 28px;margin-bottom:14px;font-family:-apple-system,system-ui,sans-serif;">
    <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#58a6ff;font-weight:600;">Kineviz · Canvas Annotation · Showcase</div>
    <h1 style="margin:6px 0 8px;font-size:26px;color:#fff;">GXR Annotate <span style="color:#7b6cff;">v0.5</span> — live demo</h1>
    <p style="margin:0 0 8px;max-width:740px;color:#c9d1d9;font-size:14px;line-height:1.6;">
      A transparent annotation layer over the live canvas. Marks are saved <strong>per view</strong> and come in three kinds:
      <strong>attached to nodes</strong> (callouts &amp; cluster circles that follow the data through layout moves),
      <strong>floating in graph space</strong> (glued through pan/zoom), and <strong>fixed on screen</strong> (the view title).
      Saving is merge-safe — two people can annotate the same project without erasing each other.
    </p>
    <p style="margin:0;color:#8b949e;font-size:12.5px;">
      Run the three cells below in order: ① install the layer → ② seed the demo graph → ③ build sample annotations.
      Then play with the floating toolbar over the canvas.
    </p>
  </div>\`;
}`);

// ---------------------------------------------------------------- bootstrap
cell("showcase-bootstrap", "false", `{
  function __gxrAnnotateInstall() {${body}}
  const src = "(" + __gxrAnnotateInstall.toString() + ")();";
  const doc = window.parent.document;
  const s = doc.createElement("script");
  s.textContent = src;
  doc.body.appendChild(s);
  s.remove();
  const ok = !!window.parent.__GXR_ANNOTATE__;
  return html\`<div style="font-family:-apple-system,system-ui,sans-serif;font-size:13px;padding:10px 14px;border-radius:8px;border:1px solid \${ok ? "rgba(63,185,80,.5)" : "rgba(248,81,73,.5)"};color:\${ok ? "#3fb950" : "#ff7b72"};background:#161b22;">
    \${ok ? "✅ ① Annotation layer installed — the floating toolbar is over the canvas. You can close this panel any time." : "❌ Layer failed to install — is a project canvas open? Check the console."}
  </div>\`;
}`);

// ---------------------------------------------------------------- seed graph
cell("showcase-seed", "false", `{
  return await Button("🌱 ② Seed demo graph (3 communities, 54 nodes)", async () => {
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(1337);
    const nodes = [], edges = [];
    const comms = [
      { tag: "a", cat: "Suppliers",  n: 16 },
      { tag: "b", cat: "Shell Cos",  n: 20 },
      { tag: "c", cat: "Retailers",  n: 15 }
    ];
    comms.forEach(c => {
      nodes.push({ id: "hub-" + c.tag, category: c.cat, properties: { name: c.cat + " HUB", role: "hub" } });
      for (let i = 0; i < c.n; i++) {
        const id = c.tag + i;
        nodes.push({ id, category: c.cat, properties: { name: c.cat + "_" + i, score: Math.round(rng() * 100) } });
        edges.push({ sourceId: id, targetId: "hub-" + c.tag, relationship: "MEMBER" });
        if (i > 1 && rng() < 0.5) edges.push({ sourceId: id, targetId: c.tag + Math.floor(rng() * i), relationship: "LINKED" });
      }
    });
    edges.push({ sourceId: "hub-a", targetId: "hub-b", relationship: "FUNNELS" });
    edges.push({ sourceId: "hub-b", targetId: "hub-c", relationship: "FUNNELS" });
    for (let x = 0; x < 6; x++) {
      const c1 = comms[Math.floor(rng() * 3)], c2 = comms[Math.floor(rng() * 3)];
      edges.push({ sourceId: c1.tag + Math.floor(rng() * c1.n), targetId: c2.tag + Math.floor(rng() * c2.n), relationship: "LINKED" });
    }
    await gxr.addNodes(nodes);
    await gxr.addEdges(edges);
    await gxr.forceLayout();
    await gxr.flyOut();
    gxr.dispatchGraphDataUpdate();
    console.log("[showcase] seeded", nodes.length, "nodes /", edges.length, "edges");
  });
}`);

// ---------------------------------------------------------------- demo annotations
cell("showcase-demo-annotations", "false", `{
  return await Button("🖍 ③ Build sample annotations + save the view", async () => {
    const A = window.parent.__GXR_ANNOTATE__;
    if (!A) { console.error("layer not installed — run cell ① first"); return; }
    // a real saved view so per-view persistence is exercised
    const v = await gxr.views.saveAs({ name: "Showcase — annotated" });
    await new Promise(r => setTimeout(r, 1500));
    await A.refreshKey(true);
    A.clearView();
    // screen-fixed title
    A.setTitle("Shell companies funnel both supply chains", "#4A36EC");
    // node-anchored callout on the middle hub
    A.addAnnotation({ type: "callout", nodeId: "hub-b", text: "20 shells, one operator\\n(all registered same week)", color: "#FF4D4F", off: { x: 90, y: -70 } });
    // cluster circle around the shell community
    const shellIds = []; for (let i = 0; i < 20; i++) shellIds.push("b" + i);
    shellIds.push("hub-b");
    A.addAnnotation({ type: "cluster", nodeIds: shellIds, color: "#FAAD14", width: 3, pad: 30 });
    // free arrow in graph space pointing at the a→b funnel
    const hb = gxr.getNode("hub-a");
    if (hb && hb.position) {
      A.addAnnotation({ type: "arrow", p1: { x: hb.position.x - 0.9, y: hb.position.y - 0.7, z: 0 }, p2: { nodeId: "hub-a" }, color: "#13C2C2", width: 3 });
    }
    // tour steps on the three hubs
    ["hub-a", "hub-b", "hub-c"].forEach(id => {
      const n = gxr.getNode(id);
      if (n && n.position) A.addAnnotation({ type: "step", p: { x: n.position.x, y: n.position.y + 0.25, z: 0 }, color: "#FF4D4F" });
    });
    await A.save();
    console.log("[showcase] sample annotations created + saved for view", v && v.name);
  });
}`);

// ---------------------------------------------------------------- try-this card
cell("showcase-trythis", "true", `{
  return html\`<div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px 24px;margin-bottom:14px;color:#c9d1d9;font-family:-apple-system,system-ui,sans-serif;font-size:14px;line-height:1.65;">
    <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#58a6ff;font-weight:600;margin-bottom:6px;">Try this</div>
    <ul style="margin:4px 0 10px;padding-left:18px;">
      <li><strong>Glue</strong> — wheel-zoom and pan: every mark moves with the graph; the title stays put.</li>
      <li><strong>Living anchors</strong> — run a layout (e.g. force layout) and watch the amber cluster circle follow its nodes, the callout track its hub.</li>
      <li><strong>Tour</strong> — hit <code>▶</code>: flies to each numbered step, →/← to move, Esc to exit.</li>
      <li><strong>Edit</strong> — click any mark (draw mode not needed) to select; drag it; drag arrow endpoints; double-click text/callouts to rewrite; Del deletes; colors restyle the selection.</li>
      <li><strong>Draw</strong> — ✏️ then: 💬 callout on a node · → arrow · ⬭ drag around nodes for a cluster circle · ◯ ellipse · T text · ① steps · 🏷 title.</li>
      <li><strong>Per view</strong> — switch to another view: clean slate. Come back to "Showcase — annotated": everything returns, re-anchored.</li>
      <li><strong>Hide</strong> — 👁 toggles the layer without deleting anything. <code>📤</code> exports the composited PNG to your clipboard.</li>
    </ul>
    <div style="color:#8b949e;font-size:12.5px;">Safety under the hood: saving refuses to run until the annotation file has been read successfully (no clobbering), each save merges only this view's changes (teammate-safe), a backup is written before every save, and if a GraphXR update breaks the internals the layer says so instead of failing silently.</div>
  </div>\`;
}`);

// ---------------------------------------------------------------- footer
cell("showcase-footer", "true", `{
  return html\`<div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:14px 20px;color:#8b949e;font-family:-apple-system,system-ui,sans-serif;font-size:12.5px;line-height:1.6;">
    <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#58a6ff;font-weight:600;margin-bottom:4px;">How this was created</div>
    Built from the expert-roundtable decisions (2026-08-13): three anchor classes in one layer, per-view persistence, merge-safe saves, tour mode with camera fly.
    Source: <code>github.com/rockyjonez/graphxr-annotate</code> — annotate-overlay.js v0.5, embedded by build-showcase.js. Uses <code>gxr.files</code> for the project sidecar and the app's own <code>convertCloudPoint</code> projection; the five-function SDK proposal to make those dependencies official is in the roundtable doc.
  </div>\`;
}`);

const out = cells.join("\n\n") + "\n";
const outPath = path.join(__dirname, "grovebook", "GXR Annotate Showcase.md");
fs.writeFileSync(outPath, out);
console.log("Wrote", outPath, "(" + out.length + " bytes, " + cells.length + " cells)");

#!/usr/bin/env node
/*
 * Generates grovebook/GXR Annotate Showcase.md.
 * Card styling follows the GraphXR dark theme (DarkThemeConfig.js):
 * primary #65B7F3, bgBase #141414, card #1d1d1d, border #303030/#434343,
 * text #ACACAC, headings #E8E8E8, font Lato.
 * Cell ③ is idempotent: seeds the graph if missing, reuses the existing
 * "Showcase — annotated" view instead of duplicating it.
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

// shared seed routine (used by cell ② and by cell ③ when the graph is missing)
const SEED_FN = `async function seedShowcaseGraph() {
    const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(1337);
    const nodes = [], edges = [];
    const comms = [
      { tag: "a", cat: "Suppliers", n: 16 },
      { tag: "b", cat: "Shell Cos", n: 20 },
      { tag: "c", cat: "Retailers", n: 15 }
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
    return nodes.length;
  }`;

// ---------------------------------------------------------------- hero
cell("showcase-hero", "true", `{
  return html\`<div style="background:#141414;color:#ACACAC;border:1px solid #303030;border-radius:6px;padding:22px 26px;margin-bottom:12px;font-family:'Lato','Helvetica',sans-serif;">
    <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#65B7F3;font-weight:700;">Kineviz · Canvas Annotation · Showcase</div>
    <h1 style="margin:6px 0 8px;font-size:24px;color:#E8E8E8;font-weight:700;">GXR Annotate <span style="color:#65B7F3;">v0.5</span> — live demo</h1>
    <p style="margin:0 0 8px;max-width:740px;font-size:13.5px;line-height:1.6;">
      A transparent annotation layer over the live canvas. Marks are saved <strong style="color:#E8E8E8;">per view</strong> and come in three kinds:
      <strong style="color:#E8E8E8;">attached to nodes</strong> (callouts &amp; cluster circles that follow the data through layout moves),
      <strong style="color:#E8E8E8;">floating in graph space</strong> (glued through pan/zoom), and <strong style="color:#E8E8E8;">fixed on screen</strong> (the view title).
      Saving is merge-safe — two people can annotate the same project without erasing each other.
    </p>
    <p style="margin:0;color:#7D7D7D;font-size:12px;">
      Run ① then ② then ③ below. The floating toolbar appears over the canvas (drag it by the ⠿ grip).
      ③ is safe to run repeatedly — it reuses the "Showcase — annotated" view and seeds the graph if the canvas is empty.
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
  return html\`<div style="font-family:'Lato','Helvetica',sans-serif;font-size:13px;padding:10px 14px;border-radius:6px;border:1px solid \${ok ? "rgba(73,170,25,.5)" : "rgba(232,71,73,.5)"};color:\${ok ? "#49AA19" : "#E84749"};background:#1d1d1d;">
    \${ok ? "✅ ① Annotation layer installed — the floating toolbar is over the canvas (drag it by ⠿). You can close this panel any time." : "❌ Layer failed to install — is a project canvas open? Check the console."}
  </div>\`;
}`);

// ---------------------------------------------------------------- seed graph
cell("showcase-seed", "false", `{
  ${SEED_FN}
  return await Button("🌱 ② Seed demo graph (3 communities, 54 nodes)", async () => {
    const n = await seedShowcaseGraph();
    console.log("[showcase] seeded", n, "nodes");
  });
}`);

// ---------------------------------------------------------------- demo annotations (idempotent)
cell("showcase-demo-annotations", "false", `{
  ${SEED_FN}
  return await Button("🖍 ③ Build sample annotations (reuses the demo view)", async () => {
    const A = window.parent.__GXR_ANNOTATE__;
    if (!A) { console.error("layer not installed — run cell ① first"); return; }
    // load the demo view FIRST if it exists (it carries the graph); loading a view
    // MERGES edges with whatever is on canvas, so never seed before loading
    const existing = (await gxr.views.list()).find(v => v.name === "Showcase — annotated");
    if (existing) {
      await gxr.views.load({ id: existing._id || existing.id });
      await new Promise(r => setTimeout(r, 4000));
    }
    if (!gxr.getNode("hub-b")) {
      console.log("[showcase] no demo graph — seeding");
      await seedShowcaseGraph();
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!existing) {
      await gxr.views.saveAs({ name: "Showcase — annotated" });
      await new Promise(r => setTimeout(r, 1500));
    }
    await A.refreshKey(true);
    A.clearView();
    A.setTitle("Shell companies funnel both supply chains", "#65B7F3");
    A.addAnnotation({ type: "callout", nodeId: "hub-b", text: "20 shells, one operator\\n(all registered same week)", color: "#E84749", off: { x: 90, y: -70 } });
    const shellIds = []; for (let i = 0; i < 20; i++) shellIds.push("b" + i);
    shellIds.push("hub-b");
    A.addAnnotation({ type: "cluster", nodeIds: shellIds, color: "#D89614", width: 3, pad: 30 });
    const ha = gxr.getNode("hub-a");
    if (ha && ha.position) {
      A.addAnnotation({ type: "arrow", p1: { x: ha.position.x - 0.9, y: ha.position.y - 0.7, z: 0 }, p2: { nodeId: "hub-a" }, color: "#13A8A8", width: 3 });
    }
    ["hub-a", "hub-b", "hub-c"].forEach(id => {
      const n = gxr.getNode(id);
      if (n && n.position) A.addAnnotation({ type: "step", p: { x: n.position.x, y: n.position.y + 0.25, z: 0 }, color: "#E84749" });
    });
    await A.save();
    console.log("[showcase] annotations ready on view 'Showcase — annotated'");
  });
}`);

// ---------------------------------------------------------------- try-this card
cell("showcase-trythis", "true", `{
  return html\`<div style="background:#1d1d1d;border:1px solid #303030;border-radius:6px;padding:18px 22px;margin-bottom:12px;color:#ACACAC;font-family:'Lato','Helvetica',sans-serif;font-size:13.5px;line-height:1.65;">
    <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#65B7F3;font-weight:700;margin-bottom:6px;">Try this</div>
    <ul style="margin:4px 0 10px;padding-left:18px;">
      <li><strong style="color:#E8E8E8;">Glue</strong> — wheel-zoom and pan: every mark moves with the graph; the title stays put.</li>
      <li><strong style="color:#E8E8E8;">Living anchors</strong> — run a force layout and watch the amber cluster circle follow its nodes, the callout track its hub.</li>
      <li><strong style="color:#E8E8E8;">Tour</strong> — hit <code style="color:#65B7F3;">▶</code>: flies to each numbered step, →/← to move, Esc to exit.</li>
      <li><strong style="color:#E8E8E8;">Edit</strong> — click any mark to select (no draw mode needed); drag it; drag arrow endpoints; double-click text/callouts to rewrite; Del deletes; colors restyle the selection.</li>
      <li><strong style="color:#E8E8E8;">Draw</strong> — ✏️ then: 💬 callout on a node · → arrow · ⬭ drag around nodes for a cluster circle · ◯ ellipse · T text · ① steps · 🏷 title.</li>
      <li><strong style="color:#E8E8E8;">Per view</strong> — switch views: clean slate. Return to "Showcase — annotated": everything comes back, re-anchored.</li>
      <li><strong style="color:#E8E8E8;">Hide</strong> — 👁 toggles the layer without deleting anything. 📤 exports the composited PNG to your clipboard.</li>
    </ul>
    <div style="color:#7D7D7D;font-size:12px;">Under the hood: saving refuses to run until the annotation file has been read (no clobbering), each save merges only this view's changes (teammate-safe), a backup is written first, and if a GraphXR update breaks the internals the layer says so instead of failing silently.</div>
  </div>\`;
}`);

// ---------------------------------------------------------------- footer
cell("showcase-footer", "true", `{
  return html\`<div style="background:#141414;border:1px solid #303030;border-radius:6px;padding:12px 18px;color:#7D7D7D;font-family:'Lato','Helvetica',sans-serif;font-size:12px;line-height:1.6;">
    <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#65B7F3;font-weight:700;margin-bottom:4px;">How this was created</div>
    Built from the expert-roundtable decisions (2026-08-13): three anchor classes in one layer, per-view persistence, merge-safe saves, tour mode.
    Styled to the GraphXR dark theme (DarkThemeConfig.js tokens). Source: <code>github.com/rockyjonez/graphxr-annotate</code>.
    Uses <code>gxr.files</code> for the project sidecar and the app's <code>convertCloudPoint</code> projection; the five-function SDK proposal to make those official is in the roundtable doc.
  </div>\`;
}`);

const out = cells.join("\n\n") + "\n";
const outPath = path.join(__dirname, "grovebook", "GXR Annotate Showcase.md");
fs.writeFileSync(outPath, out);
console.log("Wrote", outPath, "(" + out.length + " bytes, " + cells.length + " cells)");

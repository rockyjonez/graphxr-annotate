<!--{"pinCode":false,"dname":"layer-hero","codeMode":"js","hide":true}-->
```js
{
  return html`<div style="background:linear-gradient(135deg,#0d1117 0%,#161b22 60%,#1f2933 100%);color:#e6edf3;border:1px solid rgba(48,54,61,.8);border-radius:12px;padding:24px 28px;margin-bottom:14px;font-family:-apple-system,system-ui,sans-serif;">
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
  </div>`;
}
```

<!--{"pinCode":false,"dname":"layer-bootstrap","codeMode":"js","hide":false}-->
```js
{
  function __gxrAnnotateInstall() {
  var w = window;
  if (w.__GXR_ANNOTATE__ && w.__GXR_ANNOTATE__.destroy) { try { w.__GXR_ANNOTATE__.destroy(); } catch (e) {} }

  var THREE = w.THREE;
  var gxr = w.gxr;
  var app = w._app;
  if (!THREE || !gxr || !app || !app.controller || !app.controller.drawing) {
    console.error("[gxr-annotate] missing THREE/gxr/_app — is a project open?");
    return;
  }
  var renderer = document.getElementById("renderer");
  if (!renderer) { console.error("[gxr-annotate] no #renderer canvas"); return; }

  var BRAND = { purple: "#4A36EC", dark: "#1C1D20", panel: "#26272B", line: "#3A3B40", text: "#EAEAF0", dim: "#9A9AA5" };
  var COLORS = ["#FF4D4F", "#4A36EC", "#FAAD14", "#52C41A", "#13C2C2", "#FFFFFF"];
  var FONT = "'Open Sans', 'Helvetica Neue', Arial, sans-serif";
  var SVGNS = "http://www.w3.org/2000/svg";
  var SIDECAR = "/annotations.sidecar.json";

  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function el(tag, css, parent) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (parent) parent.appendChild(n);
    return n;
  }

  // ---------- state ----------
  var state = {
    mode: false,              // annotate mode on/off
    tool: "arrow",
    color: COLORS[0],
    sets: {},                 // key -> [annotations]  (key = view id or draft key)
    key: null,                // active set key
    selectedId: null,
    idSeq: 1,
    stepCounter: 1,
    undoStack: [],
    dirty: false,
    destroyed: false
  };
  function anns() { if (!state.key) return []; return state.sets[state.key] = state.sets[state.key] || []; }

  // ---------- projection ----------
  // Coordinates are stored in cloudScene-LOCAL space — the same space node
  // .position lives in. The app renders cloudScene.localToWorld(pos) through
  // dr.camera (see graphxr drawing.js convertCloudPoint), and pan/zoom mutate
  // the cloudScene transform, so cloud-local coords are stable across pan/zoom
  // and annotations projected per-frame stay glued to the graph.
  var dr = app.controller.drawing;
  var _v = new THREE.Vector3();
  function rendRect() { return renderer.getBoundingClientRect(); }
  function worldToScreen(p) {
    _v.set(p.x, p.y, p.z || 0);
    var s = dr.convertCloudPoint(_v); // returns CSS px in renderer space
    var r = rendRect();
    return { x: s.x, y: s.y, behind: s.x < -r.width || s.x > r.width * 2 };
  }
  function screenToWorld(sx, sy) {
    var r = rendRect();
    var ndc = new THREE.Vector3(sx / r.width * 2 - 1, -(sy / r.height) * 2 + 1, 0.5);
    var pWorld = ndc.unproject(dr.camera);
    var oLocal = dr.cloudScene.worldToLocal(dr.camera.position.clone());
    var pLocal = dr.cloudScene.worldToLocal(pWorld);
    var dir = pLocal.sub(oLocal).normalize();
    var t = Math.abs(dir.z) > 1e-9 ? -oLocal.z / dir.z : 100;
    var hit = oLocal.add(dir.multiplyScalar(t));
    return { x: hit.x, y: hit.y, z: hit.z };
  }
  function nodeById(id) { try { return gxr.getNode(id); } catch (e) { return null; } }
  function nearestNode(sx, sy, maxPx) {
    var best = null, bestD = maxPx;
    try {
      gxr.nodes().forEach(function (n) {
        if (!n || !n.position || n.hidden) return;
        var s = worldToScreen(n.position);
        if (s.behind) return;
        var dd = Math.hypot(s.x - sx, s.y - sy);
        if (dd < bestD) { bestD = dd; best = n; }
      });
    } catch (e) {}
    return best;
  }
  // resolve an endpoint {x,y,z} | {nodeId} to world coords
  function pt(p) {
    if (p.nodeId) {
      var n = nodeById(p.nodeId);
      if (n && n.position) return { x: n.position.x, y: n.position.y, z: n.position.z || 0 };
    }
    return p;
  }

  // ---------- DOM ----------
  var host = renderer.parentElement;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  var layer = el("div", "position:absolute;inset:0;pointer-events:none;z-index:40;", host);
  var svg = document.createElementNS(SVGNS, "svg");
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
  layer.appendChild(svg);

  // floating toolbar
  var bar = el("div",
    "position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:50;display:flex;gap:5px;align-items:center;" +
    "background:" + BRAND.panel + ";border:1px solid " + BRAND.line + ";border-radius:999px;padding:6px 10px;" +
    "font-family:" + FONT + ";box-shadow:0 4px 18px rgba(0,0,0,0.45);pointer-events:auto;user-select:none;", host);
  var statusTip = el("div",
    "position:absolute;top:62px;left:50%;transform:translateX(-50%);z-index:50;display:none;" +
    "background:rgba(28,29,32,0.92);color:" + BRAND.dim + ";border:1px solid " + BRAND.line + ";border-radius:8px;" +
    "padding:4px 12px;font-family:" + FONT + ";font-size:11.5px;pointer-events:none;white-space:nowrap;", host);
  function tip(msg) { statusTip.textContent = msg; statusTip.style.display = msg ? "block" : "none"; }

  function mkBtn(label, title, cb) {
    var b = el("button",
      "background:transparent;border:1px solid " + BRAND.line + ";color:" + BRAND.text + ";border-radius:999px;" +
      "padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit;line-height:1.2;", bar);
    b.textContent = label; b.title = title;
    b.addEventListener("click", function (e) { e.stopPropagation(); cb(b); });
    return b;
  }
  function setOn(b, on) {
    b.style.background = on ? BRAND.purple : "transparent";
    b.style.borderColor = on ? BRAND.purple : BRAND.line;
  }

  var toolBtns = {};
  var modeBtn = mkBtn("✏️ Annotate", "Toggle annotate mode (draw on the canvas)", function () { setMode(!state.mode); });
  [["arrow", "→", "Arrow (drag tail to tip; tip snaps to nodes)"],
   ["ellipse", "◯", "Ellipse (drag)"],
   ["text", "T", "Text (click, type, Enter)"],
   ["step", "①", "Numbered badge (click)"]].forEach(function (t) {
    toolBtns[t[0]] = mkBtn(t[1], t[2], function () { setTool(t[0]); });
  });
  var colorBtns = [];
  COLORS.forEach(function (c) {
    var b = el("button", "width:16px;height:16px;border-radius:50%;cursor:pointer;padding:0;background:" + c + ";border:2px solid transparent;", bar);
    b.title = c;
    b.addEventListener("click", function (e) { e.stopPropagation(); setColor(c); });
    colorBtns.push([b, c]);
  });
  mkBtn("↩", "Undo", undo);
  mkBtn("⌫", "Delete selected", deleteSelected);
  mkBtn("✖", "Clear this view's annotations", function () {
    if (!anns().length) return;
    pushUndo(); state.sets[state.key] = []; state.stepCounter = 1; markDirty(); tip("Cleared.");
  });
  var exportBtn = mkBtn("📤 Export", "Export annotated PNG (clipboard + preview)", doExport);
  exportBtn.style.background = BRAND.purple; exportBtn.style.borderColor = BRAND.purple;
  mkBtn("—", "Hide layer (re-run the grovebook cell to bring it back)", function () { api.destroy(); });

  var viewBadge = el("span", "font-size:11px;color:" + BRAND.dim + ";padding:0 4px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", bar);

  function setMode(on) {
    state.mode = on;
    setOn(modeBtn, on);
    layer.style.pointerEvents = on ? "auto" : "none";
    layer.style.cursor = on ? "crosshair" : "default";
    svg.style.pointerEvents = on ? "auto" : "none";
    tip(on ? "Annotate mode — drawing on the canvas. Toggle off to interact with the graph again." : "");
    if (!on) { state.selectedId = null; closeTextInput(false); }
  }
  function setTool(t, keepMode) {
    state.tool = t;
    Object.keys(toolBtns).forEach(function (k) { setOn(toolBtns[k], k === t); });
    if (!state.mode && !keepMode) setMode(true);
  }
  function setColor(c) {
    state.color = c;
    colorBtns.forEach(function (p) { p[0].style.borderColor = p[1] === c ? "#fff" : "transparent"; });
    if (state.selectedId) { var a = findAnn(state.selectedId); if (a) { pushUndo(); a.color = c; markDirty(); } }
  }
  function findAnn(id) { var A = anns(); for (var i = 0; i < A.length; i++) if (A[i].id === id) return A[i]; return null; }
  function pushUndo() { state.undoStack.push(JSON.parse(JSON.stringify(anns()))); if (state.undoStack.length > 60) state.undoStack.shift(); }
  function undo() { if (!state.undoStack.length) { tip("Nothing to undo."); return; } state.sets[state.key] = state.undoStack.pop(); state.selectedId = null; markDirty(); }
  function deleteSelected() {
    if (!state.selectedId) { tip("Click an annotation first (annotate mode on)."); return; }
    pushUndo();
    state.sets[state.key] = anns().filter(function (a) { return a.id !== state.selectedId; });
    state.selectedId = null; markDirty();
  }

  // ---------- drawing interactions ----------
  var drag = null;
  function evPos(e) { var r = rendRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  svg.addEventListener("pointerdown", function (e) {
    if (!state.mode) return;
    e.stopPropagation();
    var s = evPos(e);
    var g = e.target.closest ? e.target.closest("g[data-id]") : null;
    if (g) {
      state.selectedId = parseInt(g.getAttribute("data-id"), 10);
      pushUndo();
      drag = { kind: "move", last: screenToWorld(s.x, s.y) };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    state.selectedId = null;
    if (state.tool === "text") { openTextInput(s); return; }
    if (state.tool === "step") {
      pushUndo();
      var nextN = anns().filter(function (a) { return a.type === "step"; }).length + 1;
      anns().push({ id: state.idSeq++, type: "step", p: screenToWorld(s.x, s.y), n: nextN, color: state.color, size: 16 });
      markDirty();
      return;
    }
    pushUndo();
    var wpt = screenToWorld(s.x, s.y);
    var a = { id: state.idSeq++, type: state.tool, p1: wpt, p2: { x: wpt.x, y: wpt.y, z: wpt.z }, color: state.color, width: 3 };
    anns().push(a);
    drag = { kind: "draw", id: a.id };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", function (e) {
    if (!drag || !state.mode) return;
    var s = evPos(e);
    if (drag.kind === "draw") {
      var a = findAnn(drag.id);
      if (a) a.p2 = screenToWorld(s.x, s.y);
    } else if (drag.kind === "move" && state.selectedId) {
      var cur = screenToWorld(s.x, s.y);
      var dx = cur.x - drag.last.x, dy = cur.y - drag.last.y, dz = (cur.z || 0) - (drag.last.z || 0);
      var m = findAnn(state.selectedId);
      if (m) ["p", "p1", "p2"].forEach(function (k) {
        if (m[k] && !m[k].nodeId) { m[k].x += dx; m[k].y += dy; m[k].z = (m[k].z || 0) + dz; }
      });
      drag.last = cur;
    }
  });
  svg.addEventListener("pointerup", function (e) {
    if (!drag) return;
    if (drag.kind === "draw") {
      var a = findAnn(drag.id);
      if (a && a.type === "arrow") {
        // snap the arrow TIP to a nearby node so it follows layout moves
        var s2 = worldToScreen(pt(a.p2));
        var n = nearestNode(s2.x, s2.y, 26);
        if (n) a.p2 = { nodeId: n.id };
        var s1 = worldToScreen(pt(a.p1));
        if (Math.hypot(s2.x - s1.x, s2.y - s1.y) < 6) { state.sets[state.key] = anns().filter(function (x) { return x.id !== a.id; }); state.undoStack.pop(); }
      }
      if (a && a.type === "ellipse") {
        var q1 = worldToScreen(pt(a.p1)), q2 = worldToScreen(pt(a.p2));
        if (Math.abs(q1.x - q2.x) < 6 && Math.abs(q1.y - q2.y) < 6) { state.sets[state.key] = anns().filter(function (x) { return x.id !== a.id; }); state.undoStack.pop(); }
      }
    }
    drag = null;
    markDirty();
  });
  document.addEventListener("keydown", function (e) {
    if (!state.mode || textInput) return;
    if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) { e.preventDefault(); deleteSelected(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    if (e.key === "Escape") setMode(false);
  });

  // ---------- text input ----------
  var textInput = null;
  function openTextInput(s, existing) {
    closeTextInput(false);
    var ta = el("textarea",
      "position:absolute;z-index:60;min-width:170px;min-height:32px;resize:both;background:rgba(28,29,32,0.94);color:#fff;" +
      "border:2px solid " + BRAND.purple + ";border-radius:6px;font-family:" + FONT + ";font-size:14px;padding:4px 6px;outline:none;pointer-events:auto;", layer);
    ta.style.left = s.x + "px"; ta.style.top = s.y + "px";
    if (existing) ta.value = existing.text;
    textInput = { ta: ta, s: s, existing: existing || null };
    setTimeout(function () { ta.focus(); }, 0);
    ta.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); closeTextInput(true); }
      if (e.key === "Escape") closeTextInput(false);
    });
    ta.addEventListener("blur", function () { closeTextInput(true); });
  }
  function closeTextInput(commit) {
    if (!textInput) return;
    var t = textInput; textInput = null;
    var val = t.ta.value.replace(/\s+$/, "");
    t.ta.remove();
    if (commit && val) {
      pushUndo();
      if (t.existing) t.existing.text = val;
      else anns().push({ id: state.idSeq++, type: "text", p: screenToWorld(t.s.x, t.s.y), text: val, color: state.color, size: 18 });
      markDirty();
    }
  }

  // ---------- render loop ----------
  function baseFontPx() {
    // keep labels readable: scale text/badges with zoom but clamp
    var r = rendRect();
    var a = worldToScreen({ x: 0, y: 0, z: 0 }), b = worldToScreen({ x: 1, y: 0, z: 0 });
    var unitPx = Math.hypot(b.x - a.x, b.y - a.y);
    return Math.max(11, Math.min(42, unitPx * 0.28)) * (r.width > 0 ? 1 : 1);
  }
  function render() {
    var r = rendRect();
    svg.setAttribute("viewBox", "0 0 " + r.width + " " + r.height);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var defs = svgEl("defs", null, svg);
    var fpx = baseFontPx();
    anns().forEach(function (a) {
      var g = svgEl("g", { "data-id": a.id }, svg);
      if (state.mode) g.style.cursor = "move";
      g.style.pointerEvents = state.mode ? "auto" : "none";
      var sel = a.id === state.selectedId;
      if (a.type === "arrow") {
        var s1 = worldToScreen(pt(a.p1)), s2 = worldToScreen(pt(a.p2));
        if (s1.behind || s2.behind) return;
        var mid = "gxran-" + a.id;
        var mk = svgEl("marker", { id: mid, viewBox: "0 0 10 10", refX: "8.5", refY: "5", markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
        svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: a.color }, mk);
        svgEl("line", { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, stroke: a.color, "stroke-width": a.width, "stroke-linecap": "round", "marker-end": "url(#" + mid + ")" }, g);
        svgEl("line", { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, stroke: "rgba(0,0,0,0)", "stroke-width": 14 }, g);
      } else if (a.type === "ellipse") {
        var q1 = worldToScreen(pt(a.p1)), q2 = worldToScreen(pt(a.p2));
        if (q1.behind || q2.behind) return;
        svgEl("ellipse", { cx: (q1.x + q2.x) / 2, cy: (q1.y + q2.y) / 2, rx: Math.abs(q2.x - q1.x) / 2, ry: Math.abs(q2.y - q1.y) / 2, fill: "none", stroke: a.color, "stroke-width": a.width }, g);
        svgEl("ellipse", { cx: (q1.x + q2.x) / 2, cy: (q1.y + q2.y) / 2, rx: Math.abs(q2.x - q1.x) / 2 + 7, ry: Math.abs(q2.y - q1.y) / 2 + 7, fill: "rgba(0,0,0,0)", stroke: "rgba(0,0,0,0)", "stroke-width": 14 }, g);
      } else if (a.type === "text") {
        var s = worldToScreen(pt(a.p));
        if (s.behind) return;
        var t = svgEl("text", {
          x: s.x, y: s.y, fill: a.color, "font-size": Math.max(12, fpx), "font-family": FONT, "font-weight": "600",
          "paint-order": "stroke", stroke: "rgba(28,29,32,0.8)", "stroke-width": Math.max(2, fpx / 8)
        }, g);
        a.text.split("\n").forEach(function (line, i) {
          svgEl("tspan", { x: s.x, dy: i === 0 ? 0 : fpx * 1.25 }, t).textContent = line;
        });
      } else if (a.type === "step") {
        var sp = worldToScreen(pt(a.p));
        if (sp.behind) return;
        var rr = Math.max(11, fpx * 0.85);
        svgEl("circle", { cx: sp.x, cy: sp.y, r: rr, fill: a.color, stroke: "#FFF", "stroke-width": 2.5 }, g);
        var st = svgEl("text", { x: sp.x, y: sp.y, fill: a.color === "#FFFFFF" ? BRAND.dark : "#FFF", "font-size": rr * 1.1, "font-family": FONT, "font-weight": "700", "text-anchor": "middle", "dominant-baseline": "central" }, g);
        st.textContent = String(a.n);
      }
      if (sel) {
        var bb = g.getBBox();
        svgEl("rect", { x: bb.x - 5, y: bb.y - 5, width: bb.width + 10, height: bb.height + 10, fill: "none", stroke: BRAND.purple, "stroke-width": 1.5, "stroke-dasharray": "5 4" }, g);
      }
    });
  }
  function loop() {
    if (state.destroyed) return;
    try { render(); } catch (e) {}
    requestAnimationFrame(loop);
  }

  // ---------- persistence ----------
  var saveTimer = null;
  function markDirty() {
    state.dirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSidecar, 900);
  }
  function draftKey() { return "draft:" + (gxr.getProjectId ? gxr.getProjectId() : "project"); }
  async function currentKey() {
    try {
      var v = await gxr.views.getCurrent();
      if (v && (v._id || v.id)) return "view:" + (v._id || v.id);
    } catch (e) {}
    return draftKey();
  }
  async function loadSidecar() {
    try {
      var resp = await gxr.files.get(SIDECAR);
      var data = resp && resp.json ? await resp.json() : null;
      if (data && data.sets) {
        state.sets = data.sets;
        state.idSeq = data.idSeq || 1000;
        state.stepCounter = data.stepCounter || 1;
      }
    } catch (e) { /* no sidecar yet */ }
  }
  async function saveSidecar() {
    if (!state.dirty) return;
    state.dirty = false;
    try {
      var payload = { version: 1, savedAt: new Date().toISOString(), idSeq: state.idSeq, stepCounter: state.stepCounter, sets: state.sets };
      var f = new File([JSON.stringify(payload)], "annotations.sidecar.json", { type: "application/json" });
      await gxr.files.upload({ file: f, path: SIDECAR });
      tip("Annotations saved.");
      setTimeout(function () { tip(state.mode ? "Annotate mode." : ""); }, 1200);
    } catch (e) { console.error("[gxr-annotate] save failed", e); tip("Save failed: " + e.message); }
  }
  var viewPoll = setInterval(async function () {
    if (state.destroyed) return;
    var k = await currentKey();
    if (k !== state.key) {
      if (state.dirty) await saveSidecar();
      state.key = k;
      state.selectedId = null;
      state.undoStack = [];
      var name = k.indexOf("view:") === 0 ? null : "unsaved view";
      if (!name) {
        try { var v = await gxr.views.getCurrent(); name = v && v.name; } catch (e) {}
      }
      viewBadge.textContent = "🗂 " + (name || "view") + (anns().length ? " · " + anns().length : "");
    } else {
      viewBadge.textContent = viewBadge.textContent.replace(/ · \d+$/, "") + (anns().length ? " · " + anns().length : "");
    }
  }, 1200);

  // ---------- export ----------
  function doExport() {
    tip("Rendering export...");
    gxr.screenshot({ frameNodes: false, includeLegends: true, format: "png" }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var r = rendRect();
        var scale = img.naturalWidth / r.width;
        var canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        // serialize current overlay svg scaled to capture resolution
        var clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", SVGNS);
        clone.setAttribute("width", img.naturalWidth);
        clone.setAttribute("height", img.naturalHeight);
        // note: screenshot may be larger than the on-screen canvas if it includes side panels;
        // overlay covers the renderer area only — draw it aligned at the renderer offset scaled.
        var svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
        var svgUrl = URL.createObjectURL(svgBlob);
        var ov = new Image();
        ov.onload = function () {
          ctx.drawImage(ov, 0, 0, img.naturalWidth, img.naturalHeight);
          URL.revokeObjectURL(svgUrl);
          canvas.toBlob(function (out) {
            if (!out) { tip("Export failed."); return; }
            var copied = false;
            if (navigator.clipboard && window.ClipboardItem) {
              navigator.clipboard.write([new ClipboardItem({ "image/png": out })]).then(function () { copied = true; showExport(canvas, true); }, function () { showExport(canvas, false); });
            } else showExport(canvas, false);
          }, "image/png");
        };
        ov.onerror = function () { tip("Export overlay render failed."); };
        ov.src = svgUrl;
      };
      img.src = url;
    }, function (err) { tip("Screenshot failed: " + err.message); });
  }
  var exportPanel = null;
  function showExport(canvas, copied) {
    if (exportPanel) exportPanel.remove();
    exportPanel = el("div",
      "position:absolute;bottom:16px;right:16px;z-index:60;max-width:44%;background:" + BRAND.panel + ";border:1px solid " + BRAND.line + ";" +
      "border-radius:10px;padding:10px;font-family:" + FONT + ";box-shadow:0 6px 24px rgba(0,0,0,0.5);pointer-events:auto;", host);
    var head = el("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;color:" + BRAND.dim + ";font-size:11.5px;gap:10px;", exportPanel);
    el("span", "", head).textContent = copied ? "Copied to clipboard — paste anywhere." : "Export ready (clipboard blocked — right-click to copy).";
    var x = el("button", "background:transparent;border:1px solid " + BRAND.line + ";color:" + BRAND.text + ";border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;", head);
    x.textContent = "✕";
    x.addEventListener("click", function () { exportPanel.remove(); exportPanel = null; });
    var im = el("img", "display:block;max-width:100%;height:auto;border-radius:6px;border:1px solid " + BRAND.line + ";", exportPanel);
    im.src = canvas.toDataURL("image/png");
    tip("");
  }

  // ---------- boot ----------
  var api = {
    version: "0.3.0",
    destroy: function () {
      state.destroyed = true;
      clearInterval(viewPoll);
      if (saveTimer) clearTimeout(saveTimer);
      if (state.dirty) saveSidecar();
      layer.remove(); bar.remove(); statusTip.remove();
      if (exportPanel) exportPanel.remove();
      delete w.__GXR_ANNOTATE__;
    },
    state: state
  };
  w.__GXR_ANNOTATE__ = api;

  // let users wheel-zoom the graph even while annotate mode has the layer armed
  svg.addEventListener("wheel", function (e) {
    var clone = new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode });
    renderer.dispatchEvent(clone);
    e.preventDefault();
  }, { passive: false });

  loadSidecar().then(async function () {
    state.key = await currentKey();
    setTool("arrow", true);
    setColor(state.color);
    setMode(false);
    loop();
    tip("GXR Annotate layer active — hit ✏️ Annotate to draw. Annotations save per view.");
    setTimeout(function () { tip(""); }, 4000);
  });
}
  const src = "(" + __gxrAnnotateInstall.toString() + ")();";
  const doc = window.parent.document;
  const s = doc.createElement("script");
  s.textContent = src;
  doc.body.appendChild(s);
  s.remove();
  const ok = !!window.parent.__GXR_ANNOTATE__;
  return html`<div style="font-family:-apple-system,system-ui,sans-serif;font-size:13px;padding:10px 14px;border-radius:8px;border:1px solid ${ok ? "rgba(63,185,80,.5)" : "rgba(248,81,73,.5)"};color:${ok ? "#3fb950" : "#ff7b72"};background:#161b22;">
    ${ok ? "✅ Annotation layer active — look for the floating toolbar over the canvas. You can close this panel." : "❌ Layer failed to install — is a project canvas open? Check the console."}
  </div>`;
}
```

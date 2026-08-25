<!--{"pinCode":false,"dname":"layer-hero","codeMode":"js","hide":true}-->
```js
{
  return html`<div style="background:#141414;color:#ACACAC;border:1px solid #303030;border-radius:6px;padding:24px 28px;margin-bottom:14px;font-family:'Lato','Helvetica',sans-serif;">
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
  </div>`;
}
```

<!--{"pinCode":false,"dname":"layer-bootstrap","codeMode":"js","hide":false}-->
```js
{
  function __gxrAnnotateInstall() {
  var w = window;
  if (w.__GXR_ANNOTATE__ && w.__GXR_ANNOTATE__.destroy) { try { w.__GXR_ANNOTATE__.destroy(); } catch (e) {} }

  // GraphXR dark-theme tokens (web/react_views/configure/DarkThemeConfig.js + Common.css)
  var BRAND = {
    purple: "#65B7F3",          // colorPrimary (kept key name for compatibility)
    primaryHover: "#7DCBFF",
    dark: "#141414",            // colorBgBase
    panel: "#303030",           // colorBgContainer
    elevated: "#434343",        // colorBgElevated
    input: "#262626",           // Input colorBgContainer
    line: "#434343",            // colorBorder
    text: "#ACACAC",            // colorText
    bright: "#E8E8E8",
    dim: "#7D7D7D",             // colorTextSecondary
    primaryTint: "rgba(101, 183, 243, 0.15)",
    red: "#E84749"
  };
  var COLORS = ["#E84749", "#65B7F3", "#D89614", "#49AA19", "#13A8A8", "#FFFFFF"];
  var FONT = "'Lato', 'Helvetica', sans-serif";
  var SVGNS = "http://www.w3.org/2000/svg";
  var SIDECAR = "/annotations.sidecar.json";
  var SIDECAR_BAK = "/annotations.sidecar.bak";

  // ---------- feature detection (fail visibly, never silently) ----------
  function installBanner(msg) {
    var b = document.createElement("div");
    b.style.cssText = "position:fixed;top:12px;right:12px;z-index:99999;background:#2a1215;color:#E84749;" +
      "border:1px solid rgba(232,71,73,.55);border-radius:6px;padding:10px 14px;font-family:" + FONT + ";" +
      "font-size:12.5px;max-width:360px;box-shadow:0 4px 18px rgba(0,0,0,.5);";
    b.textContent = "GXR Annotate: " + msg;
    var x = document.createElement("span");
    x.textContent = "  ✕";
    x.style.cursor = "pointer";
    x.addEventListener("click", function () { b.remove(); });
    b.appendChild(x);
    document.body.appendChild(b);
    return b;
  }
  var THREE = w.THREE, gxr = w.gxr, app = w._app;
  var dr = app && app.controller && app.controller.drawing;
  var renderer = document.getElementById("renderer");
  var missing = [];
  if (!THREE) missing.push("THREE");
  if (!gxr || !gxr.files || !gxr.views) missing.push("gxr.files/views");
  if (!dr) missing.push("_app.controller.drawing");
  if (dr && typeof dr.convertCloudPoint !== "function") missing.push("convertCloudPoint");
  if (dr && !dr.cloudScene) missing.push("cloudScene");
  if (!renderer) missing.push("#renderer");
  if (missing.length) {
    installBanner("cannot start — app internals changed or no project open (missing: " + missing.join(", ") + "). The annotation layer needs an update for this GraphXR version.");
    console.error("[gxr-annotate] missing:", missing);
    return;
  }

  function el(tag, css, parent) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (parent) parent.appendChild(n);
    return n;
  }
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function deepCopy(x) { return JSON.parse(JSON.stringify(x)); }
  function clientId() {
    try {
      var k = "gxr-annotate.clientId";
      var v = w.localStorage.getItem(k);
      if (!v) { v = "c" + Math.random().toString(36).slice(2, 10); w.localStorage.setItem(k, v); }
      return v;
    } catch (e) { return "c-anon"; }
  }
  var CLIENT = clientId();

  // ---------- state ----------
  var state = {
    mode: false, tool: "callout", color: COLORS[0],
    sets: {},            // key -> {savedAt, clientId, anns:[]}
    dirtyKeys: {},       // key -> true (unsaved local changes)
    key: null,
    loadOk: false,       // sidecar load succeeded (or clean 404) — saves refused until then
    layerVisible: true,
    selectedId: null, idSeq: 1,
    undoStacks: {},      // per key
    tour: null,          // {order:[ids], i}
    destroyed: false, loopErrors: 0, version: 3
  };
  function setFor(k) { if (!state.sets[k]) state.sets[k] = { savedAt: null, clientId: CLIENT, anns: [] }; return state.sets[k]; }
  function anns(k) { return setFor(k || state.key).anns; }
  function findAnn(id) { var A = anns(); for (var i = 0; i < A.length; i++) if (A[i].id === id) return A[i]; return null; }

  // ---------- projection ----------
  var _v = new THREE.Vector3();
  function rendRect() { return renderer.getBoundingClientRect(); }
  function worldToScreen(p) {
    _v.set(p.x, p.y, p.z || 0);
    var s = dr.convertCloudPoint(_v);
    // behind-camera: compute view-space z (project() mirrors behind-camera points into view)
    _v.set(p.x, p.y, p.z || 0);
    var pw = dr.cloudScene.localToWorld(_v.clone());
    pw.applyMatrix4(dr.camera.matrixWorldInverse);
    return { x: s.x, y: s.y, behind: pw.z > -0.001 };
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
  function nodePos(id) {
    try {
      var n = dr.graph && dr.graph.nodeSet ? dr.graph.nodeSet[id] : null;
      if (!n || !n.position) { var g = gxr.getNode(id); n = g; }
      if (n && n.position && isFinite(n.position.x)) return { x: n.position.x, y: n.position.y, z: n.position.z || 0 };
    } catch (e) {}
    return null;
  }
  // resolve endpoint {x,y,z}|{nodeId}; keeps lastPos for orphan rendering
  function pt(p) {
    if (p && p.nodeId !== undefined) {
      var np = nodePos(p.nodeId);
      if (np) { p.lastPos = np; return np; }
      return p.lastPos || null; // orphaned
    }
    return (p && isFinite(p.x)) ? p : null;
  }
  function isOrphan(p) { return p && p.nodeId !== undefined && !nodePos(p.nodeId); }
  function nearestNode(sx, sy, maxPx) {
    var best = null, bestD = maxPx;
    try {
      var ns = dr.graph.nodeSet;
      Object.keys(ns).forEach(function (id) {
        var n = ns[id];
        if (!n || !n.position || n.hidden) return;
        var s = worldToScreen(n.position);
        if (s.behind) return;
        var dd = Math.hypot(s.x - sx, s.y - sy);
        if (dd < bestD) { bestD = dd; best = id; }
      });
    } catch (e) {}
    return best;
  }
  function nodesInScreenRect(x1, y1, x2, y2) {
    var out = [];
    try {
      var ns = dr.graph.nodeSet;
      var mx = Math.min(x1, x2), Mx = Math.max(x1, x2), my = Math.min(y1, y2), My = Math.max(y1, y2);
      Object.keys(ns).forEach(function (id) {
        var n = ns[id];
        if (!n || !n.position || n.hidden) return;
        var s = worldToScreen(n.position);
        if (!s.behind && s.x >= mx && s.x <= Mx && s.y >= my && s.y <= My) out.push(id);
      });
    } catch (e) {}
    return out;
  }

  // ---------- view key (URL watching + draw-time resolution; poll only as fallback) ----------
  function keyFromUrl() {
    // /p/<projectId>/<projectName>/<viewId>/<viewName>
    var m = w.location.pathname.match(/\/p\/([0-9a-f]{16,})\/[^/]+\/([0-9a-f]{16,})/);
    if (m) return "view:" + m[2];
    var pm = w.location.pathname.match(/\/p\/([0-9a-f]{16,})/);
    return "draft:" + (pm ? pm[1] : (gxr.getProjectId ? gxr.getProjectId() : "unknown"));
  }
  var histPatched = [];
  function patchHistory(fn) {
    ["pushState", "replaceState"].forEach(function (m) {
      var orig = w.history[m];
      histPatched.push([m, orig]);
      w.history[m] = function () { var r = orig.apply(this, arguments); try { fn(); } catch (e) {} return r; };
    });
    w.addEventListener("popstate", fn);
  }
  function unpatchHistory(fn) {
    histPatched.forEach(function (p) { w.history[p[0]] = p[1]; });
    histPatched = [];
    w.removeEventListener("popstate", fn);
  }

  // ---------- DOM ----------
  var host = renderer.parentElement;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  var layer = el("div", "position:absolute;inset:0;pointer-events:none;z-index:40;", host);
  var svg = document.createElementNS(SVGNS, "svg");
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
  layer.appendChild(svg);

  // toolbar sits BELOW the app's floating header (which owns the top ~56px, centered)
  // and is draggable by its grip; position persists per browser.
  var savedBarPos = null;
  try { savedBarPos = JSON.parse(w.localStorage.getItem("gxr-annotate.barPos") || "null"); } catch (e) {}
  var bar = el("div",
    "position:absolute;z-index:50;display:flex;gap:4px;align-items:center;" +
    "background:" + BRAND.dark + ";border:1px solid " + BRAND.line + ";border-radius:50px;padding:5px 10px;" +
    "font-family:" + FONT + ";box-shadow:0 4px 18px rgba(0,0,0,0.55);pointer-events:auto;user-select:none;flex-wrap:wrap;max-width:92%;", host);
  if (savedBarPos && isFinite(savedBarPos.x) && isFinite(savedBarPos.y)) {
    bar.style.left = savedBarPos.x + "px"; bar.style.top = savedBarPos.y + "px";
  } else {
    // bottom-center: clear of the app's search bar (top-left), header pill
    // (top-center), legend (right), minimap (bottom-right) and icon row (very bottom)
    bar.style.left = "50%"; bar.style.transform = "translateX(-50%)"; bar.style.bottom = "104px";
  }
  var grip = el("span", "cursor:grab;color:" + BRAND.dim + ";padding:0 4px;font-size:13px;letter-spacing:-1px;", bar);
  grip.textContent = "⠿";
  grip.title = "Drag to move the toolbar (any empty spot on the bar works too)";
  (function () {
    var dragging = null;
    function start(e) {
      var br = bar.getBoundingClientRect(), hr = host.getBoundingClientRect();
      dragging = { dx: e.clientX - br.left, dy: e.clientY - br.top, hr: hr };
      bar.setPointerCapture(e.pointerId);
      bar.style.cursor = "grabbing";
    }
    bar.addEventListener("pointerdown", function (e) {
      // drag from the grip or any non-button area of the bar
      if (e.target === grip || e.target === bar || e.target === viewBadge) { e.stopPropagation(); start(e); }
    });
    bar.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var x = Math.max(4, Math.min(dragging.hr.width - 60, e.clientX - dragging.hr.left - dragging.dx));
      var y = Math.max(4, Math.min(dragging.hr.height - 40, e.clientY - dragging.hr.top - dragging.dy));
      bar.style.transform = "none";
      bar.style.bottom = "auto";
      bar.style.left = x + "px"; bar.style.top = y + "px";
      dragging.moved = true;
    });
    bar.addEventListener("pointerup", function (e) {
      if (!dragging) return;
      var moved = dragging.moved;
      dragging = null;
      bar.style.cursor = "";
      if (moved) {
        try { w.localStorage.setItem("gxr-annotate.barPos", JSON.stringify({ x: parseFloat(bar.style.left), y: parseFloat(bar.style.top) })); } catch (err) {}
      } else if (e.target === viewBadge) {
        flyToAnnotations();
      }
    });
  })();
  var statusTip = el("div",
    "position:absolute;top:112px;left:50%;transform:translateX(-50%);z-index:50;display:none;" +
    "background:" + BRAND.input + ";color:" + BRAND.text + ";border:1px solid " + BRAND.line + ";border-radius:6px;" +
    "padding:4px 12px;font-family:" + FONT + ";font-size:12px;pointer-events:none;white-space:nowrap;", host);
  function tip(msg, ms) {
    statusTip.textContent = msg || "";
    statusTip.style.display = msg ? "block" : "none";
    if (msg && ms) setTimeout(function () { if (statusTip.textContent === msg) tip(""); }, ms);
  }

  function mkBtn(label, title, cb) {
    var b = el("button",
      "background:transparent;border:1px solid " + BRAND.line + ";color:" + BRAND.text + ";border-radius:50px;" +
      "padding:4px 9px;font-size:12px;cursor:pointer;font-family:inherit;line-height:1.2;transition:border-color .15s,color .15s;", bar);
    b.textContent = label; b.title = title;
    b.addEventListener("mouseenter", function () { if (b.__on !== true) { b.style.borderColor = BRAND.primaryHover; b.style.color = BRAND.primaryHover; } });
    b.addEventListener("mouseleave", function () { if (b.__on !== true) { b.style.borderColor = BRAND.line; b.style.color = BRAND.text; } });
    b.addEventListener("click", function (e) { e.stopPropagation(); cb(b); });
    return b;
  }
  function setOn(b, on) {
    b.__on = on;
    b.style.background = on ? BRAND.primaryTint : "transparent";
    b.style.borderColor = on ? BRAND.purple : BRAND.line;
    b.style.color = on ? BRAND.purple : BRAND.text;
  }

  var toolBtns = {};
  var modeBtn = mkBtn("✏️", "Toggle draw mode (A). Off: graph works normally; you can still click/move existing annotations.", function () { setMode(!state.mode); });
  [["callout", "💬", "Callout: click a node → label + leader line that follow it (C)"],
   ["arrow", "→", "Arrow: drag tail to tip; tip snaps to nodes (R)"],
   ["cluster", "⬭", "Cluster circle: drag around nodes; circle follows them through layout (G)"],
   ["ellipse", "◯", "Free ellipse in graph space (E)"],
   ["text", "T", "Text: click, type, Enter (T)"],
   ["step", "①", "Numbered tour step: click to place (S)"],
   ["title", "🏷", "View title: screen-fixed caption for this view (L)"]].forEach(function (t) {
    toolBtns[t[0]] = mkBtn(t[1], t[2], function () { setTool(t[0]); });
  });
  var colorBtns = [];
  COLORS.forEach(function (c) {
    var b = el("button", "width:15px;height:15px;border-radius:50%;cursor:pointer;padding:0;background:" + c + ";border:2px solid transparent;", bar);
    b.title = c;
    b.addEventListener("click", function (e) { e.stopPropagation(); setColor(c); });
    colorBtns.push([b, c]);
  });
  var eyeBtn = mkBtn("👁", "Show/hide the annotation layer (does not delete anything)", function () {
    state.layerVisible = !state.layerVisible;
    setOn(eyeBtn, !state.layerVisible);
    svg.style.display = state.layerVisible ? "" : "none";
    tip(state.layerVisible ? "Layer visible." : "Layer hidden — annotations are safe, hit 👁 to bring them back.", 2500);
  });
  var playBtn = mkBtn("▶", "Play tour: fly through numbered steps (→/← advance, Esc exits)", function () { startTour(); });
  mkBtn("↩", "Undo (Cmd/Ctrl+Z in draw mode)", undo);
  mkBtn("⌫", "Delete selected (Del)", deleteSelected);
  var exportBtn = mkBtn("📤", "Export annotated PNG (clipboard + preview)", doExport);
  exportBtn.style.background = BRAND.purple; exportBtn.style.borderColor = BRAND.purple; exportBtn.style.color = "#141414"; exportBtn.style.fontWeight = "700";
  mkBtn("—", "Remove the layer from this session (annotations stay saved)", function () { api.destroy(); });
  var viewBadge = el("span", "font-size:11px;color:" + BRAND.dim + ";padding:2px 8px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;border:1px solid transparent;border-radius:50px;", bar);
  viewBadge.title = "Click: fly to this view's annotations";
  viewBadge.addEventListener("mouseenter", function () { viewBadge.style.color = BRAND.purple; viewBadge.style.borderColor = BRAND.line; });
  viewBadge.addEventListener("mouseleave", function () { viewBadge.style.color = BRAND.dim; viewBadge.style.borderColor = "transparent"; });

  function setMode(on) {
    state.mode = on;
    setOn(modeBtn, on);
    svg.style.pointerEvents = on ? "auto" : "none"; // committed shapes keep their own pointer-events
    svg.style.cursor = on ? "crosshair" : "default";
    if (!on) closeTextInput(true);
    tip(on ? "Draw mode — " + (toolTips[state.tool] || "") : "", on ? 4000 : 0);
  }
  var toolTips = {
    callout: "click a node to attach a label.",
    arrow: "drag from tail to tip (tip snaps to nodes).",
    cluster: "drag a box around the nodes to circle.",
    ellipse: "drag to draw an ellipse in graph space.",
    text: "click where the text starts, type, Enter.",
    step: "click to drop numbered tour steps.",
    title: "type this view's caption."
  };
  function setTool(t) {
    state.tool = t;
    Object.keys(toolBtns).forEach(function (k) { setOn(toolBtns[k], k === t); });
    if (!state.mode) setMode(true); else tip("Draw mode — " + (toolTips[t] || ""), 4000);
    if (t === "title") openTitleEditor();
  }
  function setColor(c) {
    state.color = c;
    colorBtns.forEach(function (p) { p[0].style.borderColor = p[1] === c ? "#fff" : "transparent"; });
    if (state.selectedId) { var a = findAnn(state.selectedId); if (a) { pushUndo(); a.color = c; markDirty(); } }
  }
  function pushUndo() {
    var k = state.key;
    if (!state.undoStacks[k]) state.undoStacks[k] = [];
    state.undoStacks[k].push(deepCopy(anns()));
    if (state.undoStacks[k].length > 60) state.undoStacks[k].shift();
  }
  function undo() {
    var st = state.undoStacks[state.key];
    if (!st || !st.length) { tip("Nothing to undo.", 1500); return; }
    setFor(state.key).anns = st.pop();
    state.selectedId = null;
    markDirty();
  }
  function deleteSelected() {
    if (!state.selectedId) { tip("Click an annotation first.", 1800); return; }
    pushUndo();
    var s = setFor(state.key);
    s.anns = s.anns.filter(function (a) { return a.id !== state.selectedId; });
    renumberSteps(s.anns);
    state.selectedId = null;
    markDirty();
  }
  function renumberSteps(list) {
    var steps = list.filter(function (a) { return a.type === "step"; }).sort(function (a, b) { return a.n - b.n; });
    steps.forEach(function (s, i) { s.n = i + 1; });
  }

  // ---------- interactions ----------
  var drag = null;
  function evPos(e) { var r = rendRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  svg.addEventListener("pointerdown", function (e) {
    var s = evPos(e);
    var g = e.target.closest ? e.target.closest("g[data-id]") : null;
    if (g) { // selecting/moving works regardless of draw mode (shapes carry pointer-events:auto)
      e.stopPropagation();
      var id = parseInt(g.getAttribute("data-id"), 10);
      var handle = e.target.getAttribute && e.target.getAttribute("data-handle");
      state.selectedId = id;
      pushUndo();
      drag = handle ? { kind: "handle", handle: handle, id: id, moved: false }
                    : { kind: "move", id: id, last: screenToWorld(s.x, s.y), lastScreen: s, moved: false };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    if (!state.mode) return;
    e.stopPropagation();
    state.selectedId = null;
    var tool = state.tool;
    if (tool === "callout") {
      var nid = nearestNode(s.x, s.y, 40);
      if (!nid) { tip("Click closer to a node — callouts attach to nodes.", 2500); return; }
      openTextInput(s, null, function (val) {
        pushUndo();
        anns().push({ id: state.idSeq++, viewKey: state.key, type: "callout", nodeId: nid, text: val, color: state.color, off: { x: 70, y: -50 } });
        markDirty();
      });
      return;
    }
    if (tool === "text") {
      openTextInput(s, null, function (val) {
        pushUndo();
        anns().push({ id: state.idSeq++, viewKey: state.key, type: "text", p: screenToWorld(s.x, s.y), text: val, color: state.color });
        markDirty();
      });
      return;
    }
    if (tool === "step") {
      pushUndo();
      var stepCount = anns().filter(function (a) { return a.type === "step"; }).length;
      anns().push({ id: state.idSeq++, viewKey: state.key, type: "step", p: screenToWorld(s.x, s.y), n: stepCount + 1, color: state.color });
      markDirty();
      return;
    }
    if (tool === "title") { openTitleEditor(); return; }
    pushUndo();
    var wpt = screenToWorld(s.x, s.y);
    var a = { id: state.idSeq++, viewKey: state.key, type: tool, p1: wpt, p2: { x: wpt.x, y: wpt.y, z: wpt.z }, color: state.color, width: 3 };
    if (tool === "cluster") { a.type = "cluster"; a.startScreen = s; a.curScreen = s; }
    anns().push(a);
    drag = { kind: "draw", id: a.id };
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var s = evPos(e);
    var a = findAnn(drag.id !== undefined ? drag.id : -1);
    if (drag.kind === "draw" && a) {
      if (a.type === "cluster") a.curScreen = s;
      else a.p2 = screenToWorld(s.x, s.y);
    } else if (drag.kind === "move" && a) {
      drag.moved = true;
      if (a.type === "callout") { // dragging a callout moves its label offset (screen px)
        a.off = { x: a.off.x + (s.x - drag.lastScreen.x), y: a.off.y + (s.y - drag.lastScreen.y) };
        drag.lastScreen = s;
      } else if (a.type === "cluster" || a.type === "title") {
        // node-derived / screen-fixed: no positional move
      } else {
        var cur = screenToWorld(s.x, s.y);
        ["p", "p1", "p2"].forEach(function (k) {
          if (a[k] && a[k].nodeId === undefined) { a[k].x += cur.x - drag.last.x; a[k].y += cur.y - drag.last.y; a[k].z = (a[k].z || 0) + ((cur.z || 0) - (drag.last.z || 0)); }
        });
        drag.last = cur;
      }
    } else if (drag.kind === "handle" && a) {
      drag.moved = true;
      var cw = screenToWorld(s.x, s.y);
      if (drag.handle === "p1") a.p1 = cw;
      else if (drag.handle === "p2") a.p2 = cw;
    }
  });

  svg.addEventListener("pointerup", function (e) {
    if (!drag) return;
    var a = findAnn(drag.id);
    if (drag.kind === "draw" && a) {
      if (a.type === "arrow") {
        var s2 = worldToScreen(pt(a.p2) || a.p2);
        var nid = nearestNode(s2.x, s2.y, 26);
        if (nid) a.p2 = { nodeId: nid };
        var s1 = worldToScreen(pt(a.p1) || a.p1);
        if (Math.hypot(s2.x - s1.x, s2.y - s1.y) < 6) removeAnn(a.id, true);
      } else if (a.type === "cluster") {
        var ids = nodesInScreenRect(a.startScreen.x, a.startScreen.y, a.curScreen.x, a.curScreen.y);
        delete a.startScreen; delete a.curScreen; delete a.p1; delete a.p2;
        if (ids.length) { a.nodeIds = ids; a.pad = 26; tip("Cluster circle: " + ids.length + " nodes — it follows them through layout moves.", 3000); }
        else removeAnn(a.id, true);
      } else if (a.type === "ellipse") {
        var q1 = worldToScreen(pt(a.p1) || a.p1), q2 = worldToScreen(pt(a.p2) || a.p2);
        if (Math.abs(q1.x - q2.x) < 6 && Math.abs(q1.y - q2.y) < 6) removeAnn(a.id, true);
      }
    }
    if ((drag.kind === "move" || drag.kind === "handle") && !drag.moved) {
      var st = state.undoStacks[state.key]; if (st) st.pop(); // click-select only
      // double-click editing handled via dblclick
    } else if (drag.kind === "handle" && a && a.type === "arrow" && drag.handle === "p2") {
      var sp = worldToScreen(pt(a.p2) || a.p2);
      var nid2 = nearestNode(sp.x, sp.y, 26);
      if (nid2) a.p2 = { nodeId: nid2 };
    }
    drag = null;
    markDirty();
  });

  svg.addEventListener("dblclick", function (e) {
    var g = e.target.closest ? e.target.closest("g[data-id]") : null;
    if (!g) return;
    var a = findAnn(parseInt(g.getAttribute("data-id"), 10));
    if (!a) return;
    if (a.type === "text" || a.type === "callout") {
      var s = evPos(e);
      openTextInput(s, a.text, function (val) { pushUndo(); a.text = val; markDirty(); });
    } else if (a.type === "title") openTitleEditor();
  });
  function removeAnn(id, dropUndo) {
    var s = setFor(state.key);
    s.anns = s.anns.filter(function (x) { return x.id !== id; });
    if (dropUndo) { var st = state.undoStacks[state.key]; if (st) st.pop(); }
  }

  function onKeydown(e) {
    if (state.tour) {
      if (e.key === "ArrowRight") { e.preventDefault(); tourStep(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); tourStep(-1); }
      else if (e.key === "Escape") { e.preventDefault(); endTour(); }
      return;
    }
    if (textInput) return;
    if (!state.mode) return;
    var mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); return; }
    if (e.key === "Escape") { setMode(false); return; }
    var map = { c: "callout", r: "arrow", g: "cluster", e: "ellipse", t: "text", s: "step", l: "title" };
    if (!mod && map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
    if (!mod && e.key.toLowerCase() === "a") setMode(!state.mode);
  }
  document.addEventListener("keydown", onKeydown);

  // wheel-zoom passthrough while draw mode has the svg armed
  function onWheel(e) {
    var clone = new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode });
    renderer.dispatchEvent(clone);
    e.preventDefault();
  }
  svg.addEventListener("wheel", onWheel, { passive: false });

  // ---------- text inputs ----------
  var textInput = null;
  function openTextInput(s, existing, commit) {
    closeTextInput(false);
    var ta = el("textarea",
      "position:absolute;z-index:60;min-width:180px;min-height:34px;resize:both;background:rgba(38,38,38,0.96);color:#fff;" +
      "border:2px solid " + BRAND.purple + ";border-radius:6px;font-family:" + FONT + ";font-size:14px;padding:4px 6px;outline:none;pointer-events:auto;", layer);
    ta.style.left = Math.min(s.x, rendRect().width - 200) + "px";
    ta.style.top = s.y + "px";
    if (existing) ta.value = existing;
    textInput = { ta: ta, commit: commit };
    setTimeout(function () { ta.focus(); }, 0);
    ta.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); closeTextInput(true); }
      if (e.key === "Escape") closeTextInput(false);
    });
    ta.addEventListener("blur", function () { closeTextInput(true); });
  }
  function closeTextInput(doCommit) {
    if (!textInput) return;
    var t = textInput; textInput = null;
    var val = t.ta.value.replace(/\s+$/, "");
    t.ta.remove();
    if (doCommit && val && t.commit) t.commit(val);
  }
  function openTitleEditor() {
    var existing = anns().filter(function (a) { return a.type === "title"; })[0];
    var r = rendRect();
    openTextInput({ x: r.width / 2 - 120, y: 70 }, existing ? existing.text : "", function (val) {
      pushUndo();
      if (existing) existing.text = val;
      else anns().push({ id: state.idSeq++, viewKey: state.key, type: "title", text: val, color: state.color });
      markDirty();
    });
  }

  // ---------- rendering ----------
  var frameHash = "";
  var renderVersion = 0;
  function markDirty(keyArg) {
    var k = keyArg || state.key;
    state.dirtyKeys[k] = true;
    setFor(k).savedAt = null;
    renderVersion++;
    scheduleSave();
  }
  function hashFrame() {
    var h = renderVersion + "|" + state.selectedId + "|" + (state.tour ? state.tour.i : "-") + "|";
    var e = dr.camera.matrixWorld.elements, c = dr.cloudScene.matrixWorld.elements;
    for (var i = 0; i < 16; i++) h += e[i].toFixed(5) + "," + c[i].toFixed(5) + ";";
    // node-derived anchors need per-frame refresh while layouts run — sample one anchor
    var A = anns();
    for (var j = 0; j < A.length; j++) {
      var a = A[j];
      var p = a.nodeId !== undefined ? nodePos(a.nodeId) : (a.nodeIds ? nodePos(a.nodeIds[0]) : (a.p2 && a.p2.nodeId !== undefined ? nodePos(a.p2.nodeId) : null));
      if (p) { h += (p.x + p.y).toFixed(4); break; }
    }
    return h;
  }
  function fontPx() {
    var d = dr.camera.position.distanceTo(new THREE.Vector3());
    var r = rendRect();
    var unitPx = 0.5 * r.height / (Math.max(0.01, d) * Math.tan((dr.camera.fov / 2) * Math.PI / 180));
    var sc = dr.cloudScene.scale ? dr.cloudScene.scale.x : 1;
    return Math.max(12, Math.min(40, unitPx * sc * 0.22));
  }
  function render() {
    var r = rendRect();
    svg.setAttribute("viewBox", "0 0 " + r.width + " " + r.height);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!state.layerVisible) return;
    var defs = svgEl("defs", null, svg);
    var fpx = fontPx();
    var A = anns();
    var tourDim = !!state.tour;
    A.forEach(function (a) {
      var g = svgEl("g", { "data-id": a.id }, svg);
      g.style.pointerEvents = "auto";
      g.style.cursor = "move";
      var dimmed = tourDim && !(a.type === "step" && state.tour.order[state.tour.i] === a.id) && a.type !== "title";
      if (dimmed) g.setAttribute("opacity", "0.18");
      var sel = a.id === state.selectedId && !tourDim;
      var orphan = false;
      if (a.type === "arrow") {
        var P1 = pt(a.p1), P2 = pt(a.p2);
        if (!P1 || !P2) return;
        orphan = isOrphan(a.p2);
        var s1 = worldToScreen(P1), s2 = worldToScreen(P2);
        if (s1.behind || s2.behind) return;
        var mid = "gxran-" + a.color.replace("#", "");
        if (!defs.querySelector("#" + mid)) {
          var mk = svgEl("marker", { id: mid, viewBox: "0 0 10 10", refX: "8.5", refY: "5", markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
          svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: a.color }, mk);
        }
        svgEl("line", { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, stroke: a.color, "stroke-width": a.width, "stroke-linecap": "round", "marker-end": "url(#" + mid + ")", "stroke-dasharray": orphan ? "5 5" : "none" }, g);
        svgEl("line", { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, stroke: "rgba(0,0,0,0)", "stroke-width": 14 }, g);
        if (sel) {
          [["p1", s1], ["p2", s2]].forEach(function (h) {
            var c = svgEl("circle", { cx: h[1].x, cy: h[1].y, r: 8, fill: "#FFF", stroke: BRAND.purple, "stroke-width": 3, "data-handle": h[0] }, g);
            c.style.cursor = "grab";
          });
        }
      } else if (a.type === "ellipse") {
        var Q1 = pt(a.p1), Q2 = pt(a.p2);
        if (!Q1 || !Q2) return;
        var q1 = worldToScreen(Q1), q2 = worldToScreen(Q2);
        if (q1.behind || q2.behind) return;
        svgEl("ellipse", { cx: (q1.x + q2.x) / 2, cy: (q1.y + q2.y) / 2, rx: Math.abs(q2.x - q1.x) / 2, ry: Math.abs(q2.y - q1.y) / 2, fill: "none", stroke: a.color, "stroke-width": a.width }, g);
        if (sel) {
          var hc = svgEl("circle", { cx: Math.max(q1.x, q2.x), cy: Math.max(q1.y, q2.y), r: 8, fill: "#FFF", stroke: BRAND.purple, "stroke-width": 3, "data-handle": "p2" }, g);
          hc.style.cursor = "grab";
        }
      } else if (a.type === "cluster") {
        if (a.startScreen) { // being drawn: show marquee
          var ms = a.startScreen, mc = a.curScreen;
          svgEl("rect", { x: Math.min(ms.x, mc.x), y: Math.min(ms.y, mc.y), width: Math.abs(mc.x - ms.x), height: Math.abs(mc.y - ms.y), fill: "rgba(101,183,243,0.08)", stroke: a.color, "stroke-dasharray": "5 4", "stroke-width": 1.5 }, g);
          return;
        }
        var pts = (a.nodeIds || []).map(nodePos).filter(Boolean).map(worldToScreen).filter(function (s) { return !s.behind; });
        if (!pts.length) return;
        var cx = 0, cy = 0;
        pts.forEach(function (p) { cx += p.x; cy += p.y; });
        cx /= pts.length; cy /= pts.length;
        var rad = 0;
        pts.forEach(function (p) { rad = Math.max(rad, Math.hypot(p.x - cx, p.y - cy)); });
        rad += a.pad || 26;
        svgEl("circle", { cx: cx, cy: cy, r: rad, fill: "none", stroke: a.color, "stroke-width": a.width || 3 }, g);
        svgEl("circle", { cx: cx, cy: cy, r: rad, fill: "rgba(0,0,0,0)", stroke: "rgba(0,0,0,0)", "stroke-width": 14 }, g);
      } else if (a.type === "text") {
        var TP = pt(a.p);
        if (!TP) return;
        var ts = worldToScreen(TP);
        if (ts.behind) return;
        drawLabel(g, ts.x, ts.y, a.text, a.color, fpx, false);
      } else if (a.type === "callout") {
        var np = nodePos(a.nodeId);
        orphan = !np;
        var base = np || (a.lastPos ? a.lastPos : null);
        if (np) a.lastPos = np;
        if (!base) return;
        var bs = worldToScreen(base);
        if (bs.behind) return;
        var lx = bs.x + a.off.x, ly = bs.y + a.off.y;
        // leader line from label toward node, stopping short of the node
        var dx = bs.x - lx, dy = bs.y - ly, dl = Math.max(1, Math.hypot(dx, dy));
        var ex = bs.x - dx / dl * 14, ey = bs.y - dy / dl * 14;
        svgEl("line", { x1: lx, y1: ly + 4, x2: ex, y2: ey, stroke: a.color, "stroke-width": 2, "stroke-dasharray": orphan ? "5 5" : "none" }, g);
        svgEl("circle", { cx: ex, cy: ey, r: 3, fill: a.color }, g);
        drawLabel(g, lx, ly, a.text, a.color, Math.max(13, fpx * 0.8), true);
      } else if (a.type === "step") {
        var SP = pt(a.p);
        if (!SP) return;
        var sp = worldToScreen(SP);
        if (sp.behind) return;
        var rr = Math.max(12, fpx * 0.8);
        var active = state.tour && state.tour.order[state.tour.i] === a.id;
        if (active) svgEl("circle", { cx: sp.x, cy: sp.y, r: rr + 8, fill: "none", stroke: a.color, "stroke-width": 2, opacity: 0.6 }, g);
        svgEl("circle", { cx: sp.x, cy: sp.y, r: rr, fill: a.color, stroke: "#FFF", "stroke-width": 2.5 }, g);
        var st = svgEl("text", { x: sp.x, y: sp.y, fill: a.color === "#FFFFFF" ? BRAND.dark : "#FFF", "font-size": rr * 1.1, "font-family": FONT, "font-weight": "700", "text-anchor": "middle", "dominant-baseline": "central" }, g);
        st.textContent = String(a.n);
      } else if (a.type === "title") {
        var rw = rendRect().width;
        var tg = svgEl("text", { x: rw / 2, y: 148, fill: "#FFF", "font-size": 20, "font-family": FONT, "font-weight": "700", "text-anchor": "middle" }, g);
        tg.textContent = a.text;
        var bb2 = tg.getBBox();
        var bgr = svgEl("rect", { x: bb2.x - 14, y: bb2.y - 7, width: bb2.width + 28, height: bb2.height + 14, rx: 8, fill: "rgba(20,20,20,0.88)", stroke: a.color, "stroke-width": 1.5 }, g);
        g.insertBefore(bgr, tg);
      }
      if (sel && a.type !== "arrow" && a.type !== "ellipse") {
        try {
          var bb = g.getBBox();
          svgEl("rect", { x: bb.x - 5, y: bb.y - 5, width: bb.width + 10, height: bb.height + 10, fill: "none", stroke: BRAND.purple, "stroke-width": 1.5, "stroke-dasharray": "5 4" }, g);
        } catch (e) {}
      }
    });
  }
  function drawLabel(g, x, y, text, color, size, pill) {
    var t = svgEl("text", { x: x, y: y, fill: pill ? "#FFF" : color, "font-size": size, "font-family": FONT, "font-weight": "600", "paint-order": "stroke", stroke: pill ? "none" : "rgba(20,20,20,0.8)", "stroke-width": pill ? 0 : Math.max(2, size / 8) }, g);
    String(text).split("\n").forEach(function (line, i) {
      svgEl("tspan", { x: x, dy: i === 0 ? 0 : size * 1.25 }, t).textContent = line;
    });
    if (pill) {
      try {
        var bb = t.getBBox();
        var bg = svgEl("rect", { x: bb.x - 8, y: bb.y - 5, width: bb.width + 16, height: bb.height + 10, rx: 6, fill: color, opacity: 0.92 }, g);
        g.insertBefore(bg, t);
      } catch (e) {}
    }
  }
  var loopBanner = null;
  function loop() {
    if (state.destroyed) return;
    try {
      var h = hashFrame();
      if (h !== frameHash) { frameHash = h; render(); }
      state.loopErrors = 0;
      if (loopBanner) { loopBanner.remove(); loopBanner = null; }
    } catch (e) {
      state.loopErrors++;
      if (state.loopErrors === 90 && !loopBanner) {
        loopBanner = installBanner("rendering failed repeatedly (" + e.message + ") — a GraphXR update may have changed internals. Annotations are safe in the sidecar.");
      }
    }
    requestAnimationFrame(loop);
  }

  // click the view badge → bring this view's annotations back into view
  function flyToAnnotations() {
    var A = anns();
    var pts = [];
    A.forEach(function (a) {
      ["p", "p1", "p2"].forEach(function (k) { var P = a[k] && pt(a[k]); if (P) pts.push(P); });
      if (a.nodeIds) a.nodeIds.forEach(function (id) { var P = nodePos(id); if (P) pts.push(P); });
      if (a.nodeId !== undefined) { var P2 = nodePos(a.nodeId); if (P2) pts.push(P2); }
    });
    if (!pts.length) { try { gxr.flyOut(); } catch (e) {} tip("No positioned annotations in this view.", 2000); return; }
    var c = { x: 0, y: 0, z: 0 };
    pts.forEach(function (p) { c.x += p.x / pts.length; c.y += p.y / pts.length; c.z += (p.z || 0) / pts.length; });
    try { gxr.flyToPosition(c); tip("Flying to this view's annotations…", 2000); }
    catch (e) { try { gxr.flyOut(); } catch (e2) {} }
  }

  // ---------- tour ----------
  function startTour() {
    var steps = anns().filter(function (a) { return a.type === "step"; }).sort(function (a, b) { return a.n - b.n; });
    if (!steps.length) { tip("No numbered steps in this view — drop some with ① first.", 3000); return; }
    state.tour = { order: steps.map(function (s) { return s.id; }), i: -1 };
    setMode(false);
    setOn(playBtn, true);
    tourStep(1);
  }
  function tourStep(dirn) {
    if (!state.tour) return;
    var ni = state.tour.i + dirn;
    if (ni < 0) ni = 0;
    if (ni >= state.tour.order.length) { endTour(); return; }
    state.tour.i = ni;
    renderVersion++;
    var a = findAnn(state.tour.order[ni]);
    var P = a && pt(a.p);
    if (P && gxr.flyToPosition) {
      try { gxr.flyToPosition({ x: P.x, y: P.y, z: P.z || 0 }); } catch (e) {}
    }
    tip("Step " + (ni + 1) + " / " + state.tour.order.length + " — →/← to move, Esc to exit.", 0);
  }
  function endTour() {
    state.tour = null;
    setOn(playBtn, false);
    renderVersion++;
    tip("Tour ended.", 1500);
  }

  // ---------- persistence (merge-safe) ----------
  var saveTimer = null, saving = false;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSidecar, 900);
  }
  async function fetchSidecar() {
    // returns {ok:bool, notFound:bool, data:object|null}
    try {
      var resp = await gxr.files.get(SIDECAR);
      if (resp && resp.ok === false && resp.status === 404) return { ok: true, notFound: true, data: null };
      var data = await resp.json();
      return { ok: true, notFound: false, data: data };
    } catch (e) {
      var msg = String(e && e.message || e);
      if (/not found|404/i.test(msg)) return { ok: true, notFound: true, data: null };
      return { ok: false, notFound: false, data: null, err: msg };
    }
  }
  function normalize(data) {
    if (!data) return {};
    if (data.version >= 2 && data.sets) return data.sets;
    // migrate v1 {sets:{key:[anns]}}
    var out = {};
    if (data.sets) Object.keys(data.sets).forEach(function (k) {
      var v = data.sets[k];
      out[k] = Array.isArray(v) ? { savedAt: data.savedAt || null, clientId: "v1", anns: v } : v;
    });
    return out;
  }
  async function loadSidecar() {
    var r = await fetchSidecar();
    if (!r.ok) {
      state.loadOk = false;
      installBanner("could not read saved annotations (" + r.err + "). Drawing is disabled from saving until a re-read succeeds — nothing will be overwritten. It will retry automatically.");
      setTimeout(loadSidecar, 5000);
      return;
    }
    var remote = normalize(r.data);
    Object.keys(remote).forEach(function (k) {
      if (!state.dirtyKeys[k]) state.sets[k] = remote[k]; // never clobber local unsaved work
    });
    if (r.data && r.data.idSeq) state.idSeq = Math.max(state.idSeq, r.data.idSeq);
    state.loadOk = true;
    renderVersion++;
  }
  async function saveSidecar() {
    if (saving) { scheduleSave(); return; }
    var keys = Object.keys(state.dirtyKeys);
    if (!keys.length) return;
    if (!state.loadOk) { tip("Not saving yet — waiting for a successful read of the annotation file.", 3000); return; }
    saving = true;
    try {
      var r = await fetchSidecar();
      if (!r.ok) throw new Error("re-read failed: " + r.err);
      var remote = normalize(r.data);
      // backup current remote before we touch it
      if (r.data) {
        try {
          var bak = new File([JSON.stringify(r.data)], "annotations.sidecar.bak", { type: "application/json" });
          await gxr.files.upload({ file: bak, path: SIDECAR_BAK });
        } catch (e) {}
      }
      // merge: keep remote for keys we haven't touched; replace only our dirty keys
      var merged = remote;
      var now = new Date().toISOString();
      keys.forEach(function (k) {
        var s = setFor(k);
        s.savedAt = now; s.clientId = CLIENT;
        merged[k] = s;
      });
      // adopt remote-only keys locally too (fresh from teammates)
      Object.keys(merged).forEach(function (k) { if (!state.dirtyKeys[k]) state.sets[k] = merged[k]; });
      var payload = { version: 2, savedAt: now, clientId: CLIENT, idSeq: state.idSeq, sets: merged };
      var f = new File([JSON.stringify(payload)], "annotations.sidecar.json", { type: "application/json" });
      await gxr.files.upload({ file: f, path: SIDECAR });
      keys.forEach(function (k) { delete state.dirtyKeys[k]; });
      tip("Annotations saved.", 1200);
    } catch (e) {
      console.error("[gxr-annotate] save failed", e);
      tip("Save failed (" + e.message + ") — will retry.", 3000);
      scheduleSave(); // dirtyKeys untouched → retried
    } finally { saving = false; }
  }

  // ---------- view switching ----------
  async function refreshKey(force) {
    var k = keyFromUrl();
    if (k.indexOf("draft:") === 0) {
      // URL may lack the view id even when a view is loaded — confirm via API (slow path)
      try {
        var v = await gxr.views.getCurrent();
        if (v && (v._id || v.id)) k = "view:" + (v._id || v.id);
      } catch (e) {}
    }
    if (k !== state.key || force) {
      if (Object.keys(state.dirtyKeys).length) await saveSidecar();
      state.key = k;
      state.selectedId = null;
      if (state.tour) endTour();
      renderVersion++;
    }
    var label = k.indexOf("view:") === 0 ? "view" : "unsaved";
    viewBadge.textContent = "🗂 " + label + " · " + anns().length;
  }
  function onNav() { refreshKey(false); }
  patchHistory(onNav);
  var pollTimer = setInterval(function () { refreshKey(false); }, 2500); // fallback only

  function onVisChange() { if (document.visibilityState === "hidden") saveSidecar(); }
  document.addEventListener("visibilitychange", onVisChange);

  // ---------- export ----------
  function doExport() {
    tip("Rendering export...");
    gxr.screenshot({ frameNodes: false, includeLegends: false, format: "png" }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var r = rendRect();
        var ratioImg = img.naturalWidth / img.naturalHeight, ratioRend = r.width / r.height;
        var canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        if (Math.abs(ratioImg - ratioRend) / ratioRend > 0.02) {
          tip("Export aspect mismatch (capture " + img.naturalWidth + "x" + img.naturalHeight + " vs canvas) — annotations skipped to avoid misalignment. Report this.", 6000);
          finishExport(canvas);
          return;
        }
        var clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", SVGNS);
        clone.setAttribute("width", img.naturalWidth);
        clone.setAttribute("height", img.naturalHeight);
        var svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
        var svgUrl = URL.createObjectURL(svgBlob);
        var ov = new Image();
        ov.onload = function () {
          ctx.drawImage(ov, 0, 0, img.naturalWidth, img.naturalHeight);
          URL.revokeObjectURL(svgUrl);
          finishExport(canvas);
        };
        ov.onerror = function () { URL.revokeObjectURL(svgUrl); tip("Overlay render failed during export.", 4000); };
        ov.src = svgUrl;
      };
      img.src = url;
    }, function (err) { tip("Screenshot failed: " + err.message, 4000); });
  }
  var exportPanel = null;
  function finishExport(canvas) {
    canvas.toBlob(function (out) {
      if (!out) { tip("Export failed.", 3000); return; }
      var done = function (copied) { showExport(canvas, copied); };
      if (navigator.clipboard && w.ClipboardItem) {
        navigator.clipboard.write([new w.ClipboardItem({ "image/png": out })]).then(function () { done(true); }, function () { done(false); });
      } else done(false);
    }, "image/png");
  }
  function showExport(canvas, copied) {
    if (exportPanel) exportPanel.remove();
    exportPanel = el("div",
      "position:absolute;bottom:16px;right:16px;z-index:60;max-width:44%;background:" + BRAND.panel + ";border:1px solid " + BRAND.line + ";" +
      "border-radius:10px;padding:10px;font-family:" + FONT + ";box-shadow:0 6px 24px rgba(0,0,0,0.5);pointer-events:auto;", host);
    var head = el("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;color:" + BRAND.dim + ";font-size:11.5px;gap:10px;", exportPanel);
    el("span", "", head).textContent = copied ? "Copied to clipboard — paste anywhere." : "Export ready (clipboard blocked).";
    var x = el("button", "background:transparent;border:1px solid " + BRAND.line + ";color:" + BRAND.text + ";border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;", head);
    x.textContent = "✕";
    x.addEventListener("click", function () { exportPanel.remove(); exportPanel = null; });
    var im = el("img", "display:block;max-width:100%;height:auto;border-radius:6px;border:1px solid " + BRAND.line + ";", exportPanel);
    im.src = canvas.toDataURL("image/png");
    tip("");
  }

  // ---------- public api (used by the showcase grovebook) ----------
  var api = {
    version: "0.5.2",
    state: state,
    addAnnotation: function (a) {
      a.id = state.idSeq++;
      a.viewKey = state.key;
      anns().push(a);
      if (a.type === "step") { var list = anns(); a.n = list.filter(function (x) { return x.type === "step"; }).length; }
      markDirty();
      return a.id;
    },
    setTitle: function (text, color) {
      var ex = anns().filter(function (a) { return a.type === "title"; })[0];
      if (ex) ex.text = text; else anns().push({ id: state.idSeq++, viewKey: state.key, type: "title", text: text, color: color || state.color });
      markDirty();
    },
    clearView: function () { setFor(state.key).anns = []; markDirty(); },
    save: saveSidecar,
    refreshKey: refreshKey,
    startTour: startTour,
    setMode: setMode,
    setTool: setTool,
    destroy: function () {
      state.destroyed = true;
      clearInterval(pollTimer);
      if (saveTimer) clearTimeout(saveTimer);
      saveSidecar();
      unpatchHistory(onNav);
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("visibilitychange", onVisChange);
      layer.remove(); bar.remove(); statusTip.remove();
      if (exportPanel) exportPanel.remove();
      if (loopBanner) loopBanner.remove();
      delete w.__GXR_ANNOTATE__;
    }
  };
  w.__GXR_ANNOTATE__ = api;

  // ---------- boot ----------
  loadSidecar().then(function () { return refreshKey(true); }).then(function () {
    setTool("callout");
    setMode(false);
    setColor(state.color);
    loop();
    tip("Annotation layer active. ✏️ toggles draw mode; existing marks are clickable any time. Saves per view.", 5000);
  });
}
  const src = "(" + __gxrAnnotateInstall.toString() + ")();";
  const doc = window.parent.document;
  const s = doc.createElement("script");
  s.textContent = src;
  doc.body.appendChild(s);
  s.remove();
  const ok = !!window.parent.__GXR_ANNOTATE__;
  return html`<div style="font-family:'Lato','Helvetica',sans-serif;font-size:13px;padding:10px 14px;border-radius:8px;border:1px solid ${ok ? "rgba(73,170,25,.5)" : "rgba(232,71,73,.5)"};color:${ok ? "#49AA19" : "#E84749"};background:#1d1d1d;">
    ${ok ? "✅ Annotation layer active — look for the floating toolbar over the canvas. You can close this panel." : "❌ Layer failed to install — is a project canvas open? Check the console."}
  </div>`;
}
```

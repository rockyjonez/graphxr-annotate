<!--{"pinCode":false,"dname":"annotate-hero","codeMode":"js","hide":true}-->
```js
{
  return html`<div style="background:linear-gradient(135deg,#0d1117 0%,#161b22 60%,#1f2933 100%);color:#e6edf3;border:1px solid rgba(48,54,61,.8);border-radius:12px;padding:28px 32px;margin-bottom:16px;font-family:-apple-system,system-ui,sans-serif;">
    <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#58a6ff;font-weight:600;">Kineviz · Canvas Annotation</div>
    <h1 style="margin:6px 0 10px;font-size:30px;line-height:1.15;color:#fff;">GXR <span style="color:#7b6cff;">Annotate</span></h1>
    <p style="margin:0;max-width:760px;color:#c9d1d9;font-size:15px;line-height:1.6;">
      Mark up the canvas without leaving Desktop. Capture the current view, draw arrows, boxes,
      highlights, text and numbered steps right here, then export the finished PNG — or copy it
      straight to your clipboard for the deck. No export → image editor → re-export round-trip.
    </p>
  </div>`;
}
```

<!--{"pinCode":false,"dname":"brief-styles","codeMode":"js","hide":true}-->
```js
{
  const id = "nk-brief-styles";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
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
    `;
    document.head.appendChild(el);
  }
  return html`<span style="display:none"></span>`;
}
```

<!--{"pinCode":false,"dname":"annotate-howto","codeMode":"js","hide":true}-->
```js
{
  return html`<div class="nk-card">
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
  </div>`;
}
```

<!--{"pinCode":false,"dname":"annotate-core-lib","codeMode":"js","hide":true}-->
```js
AnnotateCore = {
/*
 * GXR Annotate — annotation editor core for GraphXR canvas captures.
 * Framework-free: plain DOM + SVG overlay. Single global: window.GXRAnnotate.
 *
 * Usage:
 *   const editor = GXRAnnotate.mount(containerEl, {
 *     imageDataUrl: "data:image/png;base64,...",   // base image (canvas capture)
 *     fileBaseName: "graphxr-annotated",            // export filename prefix
 *     onStatus: (msg) => {}                         // optional status callback
 *   });
 *   editor.setImage(dataUrl)  // replace base image (keeps annotations)
 *   editor.clear()            // remove all annotations
 *   editor.destroy()
 *
 * NOTE (Grove compatibility): no top-level function declarations other than the
 * IIFE pattern below; no triple-backtick sequences anywhere in this file.
 */
window.GXRAnnotate = (function () {
  var BRAND = {
    purple: "#4A36EC",
    dark: "#1C1D20",
    panel: "#26272B",
    line: "#3A3B40",
    text: "#EAEAF0",
    dim: "#9A9AA5"
  };
  var COLORS = ["#4A36EC", "#FF4D4F", "#FAAD14", "#52C41A", "#13C2C2", "#FFFFFF", "#1C1D20"];
  // Kineviz Desktop's Electron shell silently drops <a download> clicks from the
  // Grove iframe (no will-download handler), so exports there go to an inline
  // result panel + clipboard instead. Verified live on Desktop 0.17.1.
  var IS_DESKTOP = /kineviz-desktop/i.test(navigator.userAgent);
  var WIDTHS = [2, 4, 8];
  var FONTS = [16, 24, 36];
  var FONT_FAMILY = "'Open Sans', 'Helvetica Neue', Arial, sans-serif";
  var SVGNS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "style") n.style.cssText = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
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

  function mount(container, opts) {
    opts = opts || {};
    var fileBase = opts.fileBaseName || "graphxr-annotated";
    var onStatus = opts.onStatus || function () {};

    // ---------- state ----------
    var state = {
      tool: "select",
      color: COLORS[1],       // red default: reads well on graph canvases
      width: WIDTHS[1],
      font: FONTS[1],
      annotations: [],        // {id,type,...}
      selectedId: null,
      undoStack: [],
      redoStack: [],
      stepCounter: 1,
      natural: { w: 1600, h: 900 },
      idSeq: 1
    };
    var drag = null; // transient pointer-interaction state

    // ---------- DOM scaffold ----------
    container.innerHTML = "";
    var root = el("div", {
      tabindex: "0",
      style: "background:" + BRAND.dark + ";border:1px solid " + BRAND.line + ";border-radius:10px;" +
        "font-family:" + FONT_FAMILY + ";color:" + BRAND.text + ";outline:none;overflow:hidden;"
    }, container);

    var toolbar = el("div", {
      style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;" +
        "background:" + BRAND.panel + ";border-bottom:1px solid " + BRAND.line + ";"
    }, root);

    var stageWrap = el("div", { style: "position:relative;width:100%;background:#0e0e10;" }, root);
    var img = el("img", { style: "display:block;width:100%;height:auto;user-select:none;-webkit-user-drag:none;pointer-events:none;" }, stageWrap);
    var svg = document.createElementNS(SVGNS, "svg");
    svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair;";
    stageWrap.appendChild(svg);

    var statusBar = el("div", {
      style: "padding:6px 10px;font-size:12px;color:" + BRAND.dim + ";background:" + BRAND.panel + ";" +
        "border-top:1px solid " + BRAND.line + ";display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;"
    }, root);
    var statusLeft = el("span", { text: "Pick a tool, then draw on the image." }, statusBar);
    var statusRight = el("span", { text: "" }, statusBar);

    // inline export-result panel (primary export surface inside Kineviz Desktop)
    var resultPanel = el("div", {
      style: "display:none;padding:10px;background:" + BRAND.panel + ";border-top:1px solid " + BRAND.line + ";"
    }, root);
    function showResult(dataUrl, note) {
      resultPanel.innerHTML = "";
      var head = el("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:12px;color:" + BRAND.dim + ";" }, resultPanel);
      el("span", { text: note }, head);
      var close = el("button", {
        text: "✕ Close",
        style: "background:transparent;border:1px solid " + BRAND.line + ";color:" + BRAND.text + ";border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit;"
      }, head);
      close.addEventListener("click", function () { resultPanel.style.display = "none"; });
      el("img", {
        src: dataUrl,
        style: "display:block;max-width:100%;height:auto;border:1px solid " + BRAND.line + ";border-radius:6px;"
      }, resultPanel);
      resultPanel.style.display = "block";
      resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function say(msg) { statusLeft.textContent = msg; onStatus(msg); }

    // ---------- toolbar ----------
    function btn(label, title, onclick) {
      var b = el("button", {
        title: title || label,
        style: "background:transparent;border:1px solid " + BRAND.line + ";color:" + BRAND.text + ";" +
          "border-radius:6px;padding:5px 9px;font-size:12px;cursor:pointer;font-family:inherit;line-height:1;"
      }, toolbar);
      b.textContent = label;
      b.addEventListener("click", onclick);
      return b;
    }
    function divider() {
      el("span", { style: "width:1px;height:22px;background:" + BRAND.line + ";margin:0 2px;" }, toolbar);
    }

    var TOOLS = [
      ["select", "Select", "Select / move / edit (V)"],
      ["arrow", "Arrow", "Arrow (A)"],
      ["rect", "Box", "Rectangle (R)"],
      ["ellipse", "Ellipse", "Ellipse (E)"],
      ["pen", "Pen", "Freehand pen (P)"],
      ["highlight", "Highlight", "Highlighter (H)"],
      ["text", "Text", "Text label (T)"],
      ["step", "1,2,3", "Numbered step badge (N)"]
    ];
    var toolButtons = {};
    TOOLS.forEach(function (t) {
      toolButtons[t[0]] = btn(t[1], t[2], function () { setTool(t[0]); });
    });
    divider();

    var colorButtons = [];
    COLORS.forEach(function (c) {
      var b = el("button", {
        title: c,
        style: "width:20px;height:20px;border-radius:50%;cursor:pointer;padding:0;" +
          "background:" + c + ";border:2px solid " + (c === "#1C1D20" ? "#555" : "transparent") + ";"
      }, toolbar);
      b.addEventListener("click", function () { setColor(c); });
      colorButtons.push([b, c]);
    });
    divider();

    var widthButtons = [];
    WIDTHS.forEach(function (w, i) {
      var b = btn(["Thin", "Med", "Thick"][i], "Stroke width " + w + "px", function () { setWidth(w); });
      widthButtons.push([b, w]);
    });
    var fontButtons = [];
    FONTS.forEach(function (f, i) {
      var b = btn(["aA", "aA+", "aA++"][i], "Text size " + f + "px", function () { setFont(f); });
      fontButtons.push([b, f]);
    });
    divider();

    btn("Undo", "Undo (Cmd/Ctrl+Z)", undo);
    btn("Redo", "Redo (Cmd/Ctrl+Shift+Z)", redo);
    btn("Delete", "Delete selected (Del)", deleteSelected);
    btn("Clear", "Remove all annotations", function () {
      if (!state.annotations.length) return;
      pushUndo();
      state.annotations = [];
      state.selectedId = null;
      state.stepCounter = 1;
      render();
      say("Cleared all annotations.");
    });
    divider();

    var exportPngBtn = btn("Export PNG", "Download annotated PNG", function () { exportPNG(false); });
    exportPngBtn.style.background = BRAND.purple;
    exportPngBtn.style.borderColor = BRAND.purple;
    btn("Copy PNG", "Copy annotated PNG to clipboard", function () { exportPNG(true); });
    btn("Export SVG", "Download as editable SVG", exportSVG);

    function setTool(t) {
      state.tool = t;
      TOOLS.forEach(function (tt) {
        var b = toolButtons[tt[0]];
        var on = tt[0] === t;
        b.style.background = on ? BRAND.purple : "transparent";
        b.style.borderColor = on ? BRAND.purple : BRAND.line;
      });
      svg.style.cursor = t === "select" ? "default" : (t === "text" || t === "step") ? "copy" : "crosshair";
      if (t !== "select") { state.selectedId = null; render(); }
      var tip = {
        select: "Click a shape to select; drag to move; Del to delete.",
        arrow: "Drag from tail to tip.",
        rect: "Drag to draw a box.",
        ellipse: "Drag to draw an ellipse.",
        pen: "Draw freehand.",
        highlight: "Drag a translucent highlight stroke.",
        text: "Click where the text should start, then type. Enter commits, Esc cancels.",
        step: "Click to drop numbered badges (1, 2, 3, ...)."
      }[t];
      say(tip || "");
    }
    function setColor(c) {
      state.color = c;
      colorButtons.forEach(function (p) {
        p[0].style.outline = p[1] === c ? "2px solid " + BRAND.text : "none";
        p[0].style.outlineOffset = "1px";
      });
      restyleSelected("color", c);
    }
    function setWidth(w) {
      state.width = w;
      widthButtons.forEach(function (p) {
        p[0].style.background = p[1] === w ? BRAND.purple : "transparent";
        p[0].style.borderColor = p[1] === w ? BRAND.purple : BRAND.line;
      });
      restyleSelected("width", w);
    }
    function setFont(f) {
      state.font = f;
      fontButtons.forEach(function (p) {
        p[0].style.background = p[1] === f ? BRAND.purple : "transparent";
        p[0].style.borderColor = p[1] === f ? BRAND.purple : BRAND.line;
      });
      restyleSelected("font", f);
    }
    function restyleSelected(key, val) {
      if (state.tool !== "select" || !state.selectedId) return;
      var a = findAnn(state.selectedId);
      if (!a) return;
      pushUndo();
      if (key === "color") a.color = val;
      if (key === "width" && a.width !== undefined) a.width = val;
      if (key === "font" && a.font !== undefined) a.font = val;
      render();
    }

    // ---------- coordinates ----------
    function toImageCoords(e) {
      var r = stageWrap.getBoundingClientRect();
      var sx = state.natural.w / r.width;
      var sy = state.natural.h / r.height;
      return {
        x: Math.max(0, Math.min(state.natural.w, (e.clientX - r.left) * sx)),
        y: Math.max(0, Math.min(state.natural.h, (e.clientY - r.top) * sy))
      };
    }
    function findAnn(id) {
      for (var i = 0; i < state.annotations.length; i++) if (state.annotations[i].id === id) return state.annotations[i];
      return null;
    }

    // ---------- undo/redo ----------
    function pushUndo() {
      state.undoStack.push(deepCopy(state.annotations));
      if (state.undoStack.length > 100) state.undoStack.shift();
      state.redoStack = [];
    }
    function undo() {
      if (!state.undoStack.length) { say("Nothing to undo."); return; }
      state.redoStack.push(deepCopy(state.annotations));
      state.annotations = state.undoStack.pop();
      state.selectedId = null;
      render();
      say("Undo.");
    }
    function redo() {
      if (!state.redoStack.length) { say("Nothing to redo."); return; }
      state.undoStack.push(deepCopy(state.annotations));
      state.annotations = state.redoStack.pop();
      state.selectedId = null;
      render();
      say("Redo.");
    }
    function deleteSelected() {
      if (!state.selectedId) { say("Nothing selected."); return; }
      pushUndo();
      state.annotations = state.annotations.filter(function (a) { return a.id !== state.selectedId; });
      state.selectedId = null;
      render();
      say("Deleted.");
    }

    // ---------- annotation geometry helpers ----------
    function annBBox(a) {
      if (a.type === "rect" || a.type === "ellipse") {
        return { x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2), w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1) };
      }
      if (a.type === "arrow") {
        return { x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2), w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1) };
      }
      if (a.type === "pen" || a.type === "highlight") {
        var xs = a.pts.map(function (p) { return p[0]; });
        var ys = a.pts.map(function (p) { return p[1]; });
        var mx = Math.min.apply(null, xs), Mx = Math.max.apply(null, xs);
        var my = Math.min.apply(null, ys), My = Math.max.apply(null, ys);
        return { x: mx, y: my, w: Mx - mx, h: My - my };
      }
      if (a.type === "text") {
        var lines = a.text.split("\n");
        var wMax = 0;
        lines.forEach(function (l) { wMax = Math.max(wMax, l.length * a.font * 0.55); });
        return { x: a.x, y: a.y - a.font, w: wMax, h: lines.length * a.font * 1.25 };
      }
      if (a.type === "step") {
        var r = a.font * 0.9;
        return { x: a.x - r, y: a.y - r, w: r * 2, h: r * 2 };
      }
      return { x: 0, y: 0, w: 0, h: 0 };
    }
    function shiftAnn(a, dx, dy) {
      if (a.type === "rect" || a.type === "ellipse" || a.type === "arrow") {
        a.x1 += dx; a.y1 += dy; a.x2 += dx; a.y2 += dy;
      } else if (a.type === "pen" || a.type === "highlight") {
        a.pts = a.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; });
      } else if (a.type === "text" || a.type === "step") {
        a.x += dx; a.y += dy;
      }
    }

    // ---------- rendering ----------
    function render() {
      svg.setAttribute("viewBox", "0 0 " + state.natural.w + " " + state.natural.h);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var defs = svgEl("defs", null, svg);
      state.annotations.forEach(function (a) { renderAnn(a, svg, defs, true); });
      renderSelection();
      statusRight.textContent = state.annotations.length + " annotation" + (state.annotations.length === 1 ? "" : "s");
    }
    function renderAnn(a, parent, defs, interactive) {
      var g = svgEl("g", { "data-id": a.id }, parent);
      if (interactive) g.style.cursor = state.tool === "select" ? "move" : "inherit";
      if (a.type === "arrow") {
        var mid = "gxr-arrow-" + a.id;
        var marker = svgEl("marker", {
          id: mid, viewBox: "0 0 10 10", refX: "8.5", refY: "5",
          markerWidth: Math.max(4, 10 - a.width * 0.6), markerHeight: Math.max(4, 10 - a.width * 0.6),
          orient: "auto-start-reverse"
        }, defs);
        svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: a.color }, marker);
        svgEl("line", {
          x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2,
          stroke: a.color, "stroke-width": a.width, "stroke-linecap": "round",
          "marker-end": "url(#" + mid + ")"
        }, g);
        // invisible fat hit line
        if (interactive) svgEl("line", { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2, stroke: "rgba(0,0,0,0)", "stroke-width": Math.max(16, a.width * 3) }, g);
      } else if (a.type === "rect") {
        var b = annBBox(a);
        svgEl("rect", {
          x: b.x, y: b.y, width: Math.max(1, b.w), height: Math.max(1, b.h), rx: 3,
          fill: "none", stroke: a.color, "stroke-width": a.width
        }, g);
        if (interactive) svgEl("rect", { x: b.x, y: b.y, width: Math.max(1, b.w), height: Math.max(1, b.h), fill: "rgba(0,0,0,0)", stroke: "rgba(0,0,0,0)", "stroke-width": 16 }, g);
      } else if (a.type === "ellipse") {
        var bb = annBBox(a);
        svgEl("ellipse", {
          cx: bb.x + bb.w / 2, cy: bb.y + bb.h / 2, rx: Math.max(1, bb.w / 2), ry: Math.max(1, bb.h / 2),
          fill: "none", stroke: a.color, "stroke-width": a.width
        }, g);
        if (interactive) svgEl("ellipse", { cx: bb.x + bb.w / 2, cy: bb.y + bb.h / 2, rx: Math.max(8, bb.w / 2), ry: Math.max(8, bb.h / 2), fill: "rgba(0,0,0,0)", stroke: "rgba(0,0,0,0)", "stroke-width": 16 }, g);
      } else if (a.type === "pen" || a.type === "highlight") {
        var d = a.pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
        svgEl("path", {
          d: d, fill: "none", stroke: a.color,
          "stroke-width": a.type === "highlight" ? a.width * 6 : a.width,
          "stroke-linecap": "round", "stroke-linejoin": "round",
          opacity: a.type === "highlight" ? 0.35 : 1
        }, g);
      } else if (a.type === "text") {
        var t = svgEl("text", {
          x: a.x, y: a.y, fill: a.color, "font-size": a.font,
          "font-family": FONT_FAMILY, "font-weight": "600",
          "paint-order": "stroke", stroke: a.color === "#1C1D20" ? "rgba(255,255,255,0.85)" : "rgba(28,29,32,0.75)",
          "stroke-width": Math.max(2, a.font / 8)
        }, g);
        a.text.split("\n").forEach(function (line, i) {
          svgEl("tspan", { x: a.x, dy: i === 0 ? 0 : a.font * 1.25 }, t).textContent = line;
        });
      } else if (a.type === "step") {
        var r = a.font * 0.9;
        svgEl("circle", { cx: a.x, cy: a.y, r: r, fill: a.color, stroke: "#FFFFFF", "stroke-width": Math.max(2, r / 8) }, g);
        var st = svgEl("text", {
          x: a.x, y: a.y, fill: a.color === "#FFFFFF" ? BRAND.dark : "#FFFFFF",
          "font-size": a.font, "font-family": FONT_FAMILY, "font-weight": "700",
          "text-anchor": "middle", "dominant-baseline": "central"
        }, g);
        st.textContent = String(a.n);
      }
      return g;
    }
    function renderSelection() {
      if (!state.selectedId) return;
      var a = findAnn(state.selectedId);
      if (!a) return;
      var b = annBBox(a);
      var pad = 8;
      svgEl("rect", {
        x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2,
        fill: "none", stroke: BRAND.purple, "stroke-width": 2, "stroke-dasharray": "6 4"
      }, svg);
      // endpoint handles for arrow; corner handle for rect/ellipse
      var handles = [];
      if (a.type === "arrow") {
        handles.push(["p1", a.x1, a.y1]);
        handles.push(["p2", a.x2, a.y2]);
      } else if (a.type === "rect" || a.type === "ellipse") {
        handles.push(["corner", Math.max(a.x1, a.x2), Math.max(a.y1, a.y2)]);
      }
      handles.forEach(function (h) {
        var c = svgEl("circle", {
          cx: h[1], cy: h[2], r: 9, fill: "#FFFFFF", stroke: BRAND.purple, "stroke-width": 3,
          "data-handle": h[0]
        }, svg);
        c.style.cursor = "grab";
      });
    }

    // ---------- text input overlay ----------
    var textEditor = null;
    function openTextEditor(pt, existing) {
      closeTextEditor(false);
      var r = stageWrap.getBoundingClientRect();
      var scale = r.width / state.natural.w;
      var ta = el("textarea", {
        style: "position:absolute;z-index:5;min-width:160px;min-height:34px;resize:both;" +
          "background:rgba(28,29,32,0.92);color:#fff;border:2px solid " + BRAND.purple + ";border-radius:6px;" +
          "font-family:" + FONT_FAMILY + ";font-size:" + Math.max(12, state.font * scale) + "px;padding:4px 6px;outline:none;"
      }, stageWrap);
      ta.style.left = (pt.x * scale) + "px";
      ta.style.top = ((pt.y - state.font) * scale) + "px";
      if (existing) ta.value = existing.text;
      textEditor = { ta: ta, pt: pt, existing: existing || null };
      setTimeout(function () { ta.focus(); }, 0);
      ta.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); closeTextEditor(true); }
        if (e.key === "Escape") closeTextEditor(false);
      });
      ta.addEventListener("blur", function () { closeTextEditor(true); });
    }
    function closeTextEditor(commit) {
      if (!textEditor) return;
      var t = textEditor; textEditor = null;
      var val = t.ta.value.replace(/\s+$/, "");
      t.ta.remove();
      if (commit && val) {
        pushUndo();
        if (t.existing) {
          t.existing.text = val;
        } else {
          state.annotations.push({ id: state.idSeq++, type: "text", x: t.pt.x, y: t.pt.y, text: val, color: state.color, font: state.font });
        }
        render();
        say("Text added. Enter = commit, Shift+Enter = new line.");
      }
    }

    // ---------- pointer interactions ----------
    svg.addEventListener("pointerdown", function (e) {
      if (textEditor) { closeTextEditor(true); return; }
      root.focus({ preventScroll: true });
      var pt = toImageCoords(e);
      var tool = state.tool;

      if (tool === "select") {
        var handle = e.target.getAttribute && e.target.getAttribute("data-handle");
        if (handle && state.selectedId) {
          pushUndo();
          drag = { kind: "handle", handle: handle, id: state.selectedId };
          svg.setPointerCapture(e.pointerId);
          return;
        }
        var g = e.target.closest ? e.target.closest("g[data-id]") : null;
        if (g) {
          var id = parseInt(g.getAttribute("data-id"), 10);
          state.selectedId = id;
          var a = findAnn(id);
          render();
          if (a && a.type === "text" && e.detail === 2) { openTextEditor({ x: a.x, y: a.y }, a); return; }
          pushUndo();
          drag = { kind: "move", id: id, last: pt, moved: false };
          svg.setPointerCapture(e.pointerId);
        } else {
          state.selectedId = null;
          render();
        }
        return;
      }
      if (tool === "text") { openTextEditor(pt, null); return; }
      if (tool === "step") {
        pushUndo();
        state.annotations.push({ id: state.idSeq++, type: "step", x: pt.x, y: pt.y, n: state.stepCounter++, color: state.color, font: state.font });
        render();
        return;
      }
      // drawing tools
      pushUndo();
      var ann;
      if (tool === "arrow") ann = { id: state.idSeq++, type: "arrow", x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, color: state.color, width: state.width };
      else if (tool === "rect") ann = { id: state.idSeq++, type: "rect", x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, color: state.color, width: state.width };
      else if (tool === "ellipse") ann = { id: state.idSeq++, type: "ellipse", x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, color: state.color, width: state.width };
      else if (tool === "pen") ann = { id: state.idSeq++, type: "pen", pts: [[pt.x, pt.y]], color: state.color, width: state.width };
      else if (tool === "highlight") ann = { id: state.idSeq++, type: "highlight", pts: [[pt.x, pt.y]], color: state.color === "#1C1D20" ? "#FAAD14" : state.color, width: state.width };
      if (!ann) return;
      state.annotations.push(ann);
      drag = { kind: "draw", id: ann.id };
      svg.setPointerCapture(e.pointerId);
      render();
    });

    svg.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var pt = toImageCoords(e);
      var a = findAnn(drag.id);
      if (!a) { drag = null; return; }
      if (drag.kind === "draw") {
        if (a.type === "pen" || a.type === "highlight") {
          var lp = a.pts[a.pts.length - 1];
          if (Math.hypot(pt.x - lp[0], pt.y - lp[1]) > 2) a.pts.push([pt.x, pt.y]);
        } else { a.x2 = pt.x; a.y2 = pt.y; }
        render();
      } else if (drag.kind === "move") {
        var dx = pt.x - drag.last.x, dy = pt.y - drag.last.y;
        if (Math.abs(dx) + Math.abs(dy) > 0) drag.moved = true;
        shiftAnn(a, dx, dy);
        drag.last = pt;
        render();
      } else if (drag.kind === "handle") {
        if (drag.handle === "p1") { a.x1 = pt.x; a.y1 = pt.y; }
        else if (drag.handle === "p2" || drag.handle === "corner") { a.x2 = pt.x; a.y2 = pt.y; }
        render();
      }
    });

    svg.addEventListener("pointerup", function (e) {
      if (!drag) return;
      var a = findAnn(drag.id);
      if (drag.kind === "draw" && a && (a.type === "rect" || a.type === "ellipse" || a.type === "arrow")) {
        var b = annBBox(a);
        if (b.w < 4 && b.h < 4) { // degenerate: discard
          state.annotations = state.annotations.filter(function (x) { return x.id !== a.id; });
          state.undoStack.pop();
        }
      }
      if (drag.kind === "move" && !drag.moved) state.undoStack.pop(); // click-select only, no move: drop the noop undo entry
      drag = null;
      render();
    });

    root.addEventListener("keydown", function (e) {
      if (textEditor) return;
      var mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); return; }
      var map = { v: "select", a: "arrow", r: "rect", e: "ellipse", p: "pen", h: "highlight", t: "text", n: "step" };
      var t = map[e.key.toLowerCase()];
      if (t && !mod) setTool(t);
    });

    // ---------- export ----------
    function buildExportSVG(withImage) {
      var out = document.createElementNS(SVGNS, "svg");
      out.setAttribute("xmlns", SVGNS);
      out.setAttribute("viewBox", "0 0 " + state.natural.w + " " + state.natural.h);
      out.setAttribute("width", state.natural.w);
      out.setAttribute("height", state.natural.h);
      if (withImage) {
        var im = svgEl("image", { x: 0, y: 0, width: state.natural.w, height: state.natural.h }, out);
        im.setAttribute("href", img.src);
      }
      var defs = svgEl("defs", null, out);
      state.annotations.forEach(function (a) { renderAnn(a, out, defs, false); });
      return out;
    }
    function svgToString(node) {
      return new XMLSerializer().serializeToString(node);
    }
    function download(blob, name) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }
    function stamp() {
      var d = new Date();
      function p(n) { return (n < 10 ? "0" : "") + n; }
      return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    }
    function exportPNG(toClipboard) {
      say(toClipboard ? "Copying PNG..." : "Rendering PNG...");
      var canvas = document.createElement("canvas");
      canvas.width = state.natural.w;
      canvas.height = state.natural.h;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, state.natural.w, state.natural.h);
      var svgStr = svgToString(buildExportSVG(false));
      var svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(svgBlob);
      var overlay = new Image();
      overlay.onload = function () {
        ctx.drawImage(overlay, 0, 0, state.natural.w, state.natural.h);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) { say("PNG export failed (canvas tainted?)."); return; }
          var copy = function (okMsg, failMsg) {
            if (navigator.clipboard && window.ClipboardItem) {
              return navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(function () {
                say(okMsg);
              }, function (err) {
                say(failMsg + " (" + err.message + ")");
              });
            }
            say(failMsg + " (clipboard API unavailable)");
          };
          if (toClipboard) {
            copy("PNG copied to clipboard — paste straight into your deck.",
              IS_DESKTOP ? "Clipboard blocked — use the preview below" : "Clipboard blocked — downloading instead");
            if (!navigator.clipboard || !window.ClipboardItem) {
              if (IS_DESKTOP) showResult(canvas.toDataURL("image/png"), "Exported PNG (" + state.natural.w + "x" + state.natural.h + ")");
              else download(blob, fileBase + "-" + stamp() + ".png");
            }
          } else if (IS_DESKTOP) {
            // downloads are dropped by the Desktop shell: show the result inline + copy
            showResult(canvas.toDataURL("image/png"),
              "Exported PNG (" + state.natural.w + "x" + state.natural.h + ") — also copied to your clipboard; paste it anywhere.");
            copy("PNG ready below and copied to clipboard.",
              "PNG ready below — clipboard copy blocked, click Copy PNG to retry");
          } else {
            download(blob, fileBase + "-" + stamp() + ".png");
            say("PNG downloaded.");
          }
        }, "image/png");
      };
      overlay.onerror = function () { URL.revokeObjectURL(url); say("PNG export failed rendering overlay."); };
      overlay.src = url;
    }
    function exportSVG() {
      var svgStr = svgToString(buildExportSVG(true));
      if (IS_DESKTOP) {
        say("SVG export needs a browser (Desktop drops downloads) — open this grovebook on GraphXR web, or use Export PNG / Copy PNG here.");
        return;
      }
      download(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }), fileBase + "-" + stamp() + ".svg");
      say("SVG downloaded (image embedded — re-editable in Figma/Illustrator).");
    }

    // ---------- image handling ----------
    function setImage(dataUrl) {
      return new Promise(function (resolve, reject) {
        var probe = new Image();
        probe.onload = function () {
          state.natural = { w: probe.naturalWidth, h: probe.naturalHeight };
          img.src = dataUrl;
          render();
          say("Image loaded (" + state.natural.w + "x" + state.natural.h + "). Annotate away.");
          resolve();
        };
        probe.onerror = reject;
        probe.src = dataUrl;
      });
    }

    // ---------- init ----------
    setTool("select");
    setColor(state.color);
    setWidth(state.width);
    setFont(state.font);
    var ready = opts.imageDataUrl ? setImage(opts.imageDataUrl) : Promise.resolve();

    return {
      ready: ready,
      setImage: setImage,
      clear: function () { state.annotations = []; state.selectedId = null; state.stepCounter = 1; render(); },
      getAnnotations: function () { return deepCopy(state.annotations); },
      setAnnotations: function (arr) { state.annotations = deepCopy(arr); render(); },
      exportPNG: exportPNG,
      exportSVG: exportSVG,
      destroy: function () { container.innerHTML = ""; }
    };
  }

  return { mount: mount, version: "0.1.0" };
})();
  return window.GXRAnnotate;
}
```

<!--{"pinCode":false,"dname":"annotate-shot-state","codeMode":"js","hide":true}-->
```js
mutable shot = null
```

<!--{"pinCode":false,"dname":"annotate-capture-options","codeMode":"js","hide":false}-->
```js
viewof capOpts = Inputs.checkbox(
  ["Legends", "Info panel", "Navigation tools", "Frame all nodes first"],
  { value: ["Legends"], label: "Include in capture" }
)
```

<!--{"pinCode":false,"dname":"annotate-capture-button","codeMode":"js","hide":false}-->
```js
{
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
}
```

<!--{"pinCode":false,"dname":"annotate-editor","codeMode":"js","hide":false}-->
```js
{
  if (typeof shot === "string" && shot.indexOf("ERROR:") === 0) {
    return html`<div class="nk-card" style="border-color:rgba(248,81,73,.5);color:#ff7b72;">
      Screenshot failed: ${shot.slice(6)} — is the canvas loaded? (gxr.screenshot needs an open project view)</div>`;
  }
  if (!shot) {
    return html`<div class="nk-card" style="text-align:center;color:#8b949e;">
      No capture yet — arrange your canvas, then hit <strong style="color:#e6edf3;">📸 Capture current canvas view</strong> above.</div>`;
  }
  const container = html`<div style="max-width:100%;"></div>`;
  AnnotateCore.mount(container, { imageDataUrl: shot, fileBaseName: "graphxr-annotated" });
  return container;
}
```

<!--{"pinCode":false,"dname":"annotate-footer","codeMode":"js","hide":true}-->
```js
{
  return html`<div class="nk-card" style="font-size:12.5px;color:#8b949e;">
    <div class="nk-eyebrow">How this was created</div>
    Built by Tiby's assistant (2026-08-12) to cut the annotate-a-view workflow from five steps to three.
    Capture uses <code>gxr.screenshot()</code> (current view, camera untouched unless "Frame all nodes first" is checked);
    the editor is a self-contained SVG overlay embedded in this grovebook — no network, no external libraries.
    Source &amp; standalone version: <code>github.com/rockyjonez/graphxr-annotate</code>.
    Exported PNGs render at the capture's native resolution.
  </div>`;
}
```

// Builds step-by-step evidence for the QA Interview Ready labs from Playwright traces.
// Reads results.json and opens each test's trace.zip. For every top-level step it renders the
// DOM snapshot Playwright recorded right after the step (or right before the next input) with the
// run's own Chromium, so the picture shows exactly what the test saw. When a step has no snapshot
// or the browser is unavailable it falls back to the screencast frame painted after the step.
// API calls get no page screenshot: their evidence is the request line and the response status.
// Writes evidence.json + evidence/*.jpeg. The zip is read with node:zlib; the browser comes from
// the lab's own @playwright/test install.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const resultsFile = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME || path.join(process.cwd(), "results.json");
const outDir = path.join(process.cwd(), "evidence");
const MAX_FRAMES = 120;
const API_METHODS = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
const JPEG_QUALITY = 72;

function zipEntries(buf) {
  const entries = new Map();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return entries;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    entries.set(name, () => {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compressed);
      return method === 0 ? Buffer.from(data) : method === 8 ? zlib.inflateRawSync(data) : null;
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function lines(buf) {
  const out = [];
  for (const l of buf.toString("utf8").split("\n")) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch { /* skip */ }
  }
  return out;
}

const strip = (s) => String(s || "").replace(/\u001b\[[0-9;]*m/g, "");
const shortUrl = (u) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };

function readTrace(entries) {
  // test runner steps live in test.trace; screencast frames, DOM snapshots and API results in <n>-trace.trace
  const steps = [];
  const open = new Map();
  const frames = [];
  const responses = new Map(); // stepId -> { status, statusText, url }
  const snapshots = new Map(); // stepId -> { before, action, after } main-frame snapshots
  const frameSeries = new Map(); // frameId -> snapshot[] in trace order (node references point back into it)
  for (const [name, read] of entries) {
    if (!/(^|\/)(test\.trace|\d+-trace\.trace|trace\.trace)$/.test(name)) continue;
    let clock = null;
    const calls = new Map(); // callId -> stepId
    for (const e of lines(read())) {
      if (e.type === "context-options") {
        if (typeof e.wallTime === "number" && typeof e.monotonicTime === "number") clock = { wall: e.wallTime, mono: e.monotonicTime };
      } else if (e.type === "screencast-frame") {
        const file = e.file || (e.sha1 ? `resources/${e.sha1}.jpeg` : null);
        if (!file) continue;
        const rendered = clock && typeof e.frameSwapWallTime === "number" ? e.frameSwapWallTime - clock.wall + clock.mono : e.timestamp;
        frames.push({ t: Math.min(rendered, e.timestamp), file });
      } else if (e.type === "frame-snapshot" && e.snapshot) {
        const s = e.snapshot;
        if (!frameSeries.has(s.frameId)) frameSeries.set(s.frameId, []);
        const series = frameSeries.get(s.frameId);
        s._index = series.length;
        s._series = series;
        series.push(s);
        const stepId = calls.get(s.callId);
        if (!stepId || !s.isMainFrame) continue;
        if (!snapshots.has(stepId)) snapshots.set(stepId, {});
        snapshots.get(stepId)[s.phase || "after"] = s;
      } else if (e.type === "before" && e.stepId && e.class !== "Test") {
        calls.set(e.callId, e.stepId);
      } else if (e.type === "after" && calls.has(e.callId) && e.result && e.result.response && typeof e.result.response.status === "number") {
        const r = e.result.response;
        responses.set(calls.get(e.callId), { status: r.status, statusText: r.statusText, url: r.url });
      } else if (e.type === "before" && e.class === "Test" && !e.parentId && ["pw:api", "expect", "test.step", "attach", "test.attach"].includes(e.method)) {
        if (e.method === "test.attach" || e.method === "attach") continue;
        const s = { title: strip(e.title) || e.method, subtitle: strip(e.subtitle), start: e.startTime, end: null, error: null, method: e.method, stepId: e.stepId || e.callId };
        open.set(e.callId, s);
        steps.push(s);
      } else if (e.type === "before" && e.class === "Test" && e.parentId && e.method === "expect") {
        // expect() inside a test.step: keep it as its own line
        const s = { title: strip(e.title) || e.method, start: e.startTime, end: null, error: null, method: e.method, stepId: e.stepId || e.callId, child: true };
        open.set(e.callId, s);
        steps.push(s);
      } else if (e.type === "after" && open.has(e.callId)) {
        const s = open.get(e.callId);
        s.end = e.endTime;
        if (e.error) s.error = strip(e.error.message || e.error.error?.message || JSON.stringify(e.error)).split("\n").slice(0, 6).join("\n");
      }
    }
  }
  frames.sort((a, b) => a.t - b.t);
  steps.sort((a, b) => a.start - b.start);
  for (const s of steps) {
    s.api = s.method === "pw:api" && API_METHODS.test(s.title);
    s.snapshots = snapshots.get(s.stepId) || {};
    if (s.api) {
      const r = responses.get(s.stepId);
      s.title = `${s.title} ${r && r.url ? shortUrl(r.url) : s.subtitle || ""}`.trim() + (r ? ` → ${r.status} ${r.statusText || ""}`.trimEnd() : "");
    } else if (s.title === "Navigate" && s.subtitle) s.title = `Navigate ${s.subtitle}`;
  }
  return { steps, frames };
}

// ---- DOM snapshots -> HTML (same encoding as Playwright's trace viewer) ----

function snapshotNodes(snapshot) {
  if (!snapshot._nodes) {
    const nodes = [];
    const visit = (n) => {
      if (typeof n === "string") nodes.push(n);
      else if (typeof n[0] === "string") { for (let i = 2; i < n.length; i++) visit(n[i]); nodes.push(n); }
    };
    visit(snapshot.html);
    snapshot._nodes = nodes;
  }
  return snapshot._nodes;
}

const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const VOID = new Set(["AREA", "BASE", "BR", "COL", "EMBED", "HR", "IMG", "INPUT", "LINK", "META", "SOURCE", "TRACK", "WBR"]);

function snapshotHtml(snapshot) {
  const series = snapshot._series;
  const visit = (n, snapshotIndex, parentTag) => {
    if (typeof n === "string") return parentTag === "STYLE" || parentTag === "TEXTAREA" ? n : escText(n);
    if (n._string !== undefined) return n._string;
    let out = "";
    if (Array.isArray(n[0])) {
      const refIndex = snapshotIndex - n[0][0];
      if (refIndex >= 0 && refIndex <= snapshotIndex && series[refIndex]) {
        const nodes = snapshotNodes(series[refIndex]);
        const idx = n[0][1];
        if (idx >= 0 && idx < nodes.length) out = visit(nodes[idx], refIndex, parentTag);
      }
    } else if (typeof n[0] === "string") {
      const tag = n[0];
      const attrs = n[1] || {};
      if (tag === "SCRIPT" || tag === "NOSCRIPT") { n._string = ""; return ""; }
      const isShadow = tag === "TEMPLATE" && attrs.__playwright_shadow_root_;
      const renderTag = isShadow ? "DIV" : tag;
      let a = "";
      let target = false;
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "__playwright_value_") a += ` value="${escAttr(v)}"`;
        else if (k === "__playwright_checked_") a += v === "true" ? " checked" : "";
        else if (k === "__playwright_selected_") a += v === "true" ? " selected" : "";
        else if (k === "__playwright_current_src_") a += ` src="${escAttr(v)}"`;
        else if (k === "__playwright_scroll_top_") a += ` data-pw-scroll-top="${escAttr(v)}"`;
        else if (k === "__playwright_scroll_left_") a += ` data-pw-scroll-left="${escAttr(v)}"`;
        else if (k === "__playwright_target__") target = true;
        else if (k.startsWith("__playwright_")) continue;
        else if (k === "srcset" || (k.startsWith("on") && k.length > 2)) continue;
        else a += ` ${k}="${escAttr(v)}"`;
      }
      if (isShadow) a += ' style="display:contents"';
      if (target) a += " data-pw-target";
      out = `<${renderTag}${a}>`;
      if (!VOID.has(tag)) {
        for (let i = 2; i < n.length; i++) out += visit(n[i], snapshotIndex, tag);
        out += `</${renderTag}>`;
      }
    }
    n._string = out;
    return out;
  };
  const body = visit(snapshot.html, snapshot._index, "");
  const marker = "<style>[data-pw-target]{outline:3px solid #e11d48 !important;outline-offset:2px !important}</style>";
  return (snapshot.doctype ? `<!DOCTYPE ${snapshot.doctype}>` : "<!DOCTYPE html>") + body.replace(/<\/HEAD>/i, marker + "</HEAD>");
}

async function renderer() {
  let chromium = null;
  try { ({ chromium } = require("@playwright/test")); } catch { try { ({ chromium } = require("playwright")); } catch { /* no browser */ } }
  if (!chromium) return null;
  let browser;
  try { browser = await chromium.launch(); } catch (e) { console.log("lab-evidence: cannot launch Chromium, using screencast frames:", e.message); return null; }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.route(/.*/, (route) => {
    const type = route.request().resourceType();
    if (type === "script" || type === "xhr" || type === "fetch" || type === "websocket" || type === "eventsource" || type === "media") return route.abort();
    return route.continue();
  });
  const cache = new Map(); // snapshot -> file
  return {
    async render(snapshot, file) {
      if (cache.has(snapshot)) return cache.get(snapshot);
      const vp = snapshot.viewport && snapshot.viewport.width ? snapshot.viewport : { width: 1280, height: 720 };
      await page.setViewportSize({ width: Math.min(vp.width, 1920), height: Math.min(vp.height, 1200) });
      try {
        await page.setContent(snapshotHtml(snapshot), { waitUntil: "load", timeout: 8000 });
      } catch (e) {
        if (!/Timeout/i.test(String(e.message))) throw e;
      }
      await page.evaluate(() => {
        for (const el of document.querySelectorAll("[data-pw-scroll-top],[data-pw-scroll-left]")) {
          const top = Number(el.getAttribute("data-pw-scroll-top") || 0);
          const left = Number(el.getAttribute("data-pw-scroll-left") || 0);
          if (el === document.documentElement || el === document.body) window.scrollTo(left, top);
          else { el.scrollTop = top; el.scrollLeft = left; }
        }
      }).catch(() => {});
      await page.screenshot({ path: file, type: "jpeg", quality: JPEG_QUALITY });
      cache.set(snapshot, file);
      return file;
    },
    async close() { await browser.close().catch(() => {}); },
  };
}

// The picture for a step is the DOM right before the next input touches the page (Playwright's
// "action" snapshot, taken after its actionability wait), or else the DOM right after the step.
function snapshotFor(steps, i) {
  const next = steps[i + 1];
  if (next && next.snapshots.action) return next.snapshots.action;
  const own = steps[i].snapshots;
  return own.after || own.action || own.before || null;
}

// Screencast fallback: frames are emitted on repaint, so the page's state at any moment is the
// last frame rendered at or before it. Use the last frame painted before the next page-changing
// action starts, with a small grace for paints that land just after it has begun.
const PAINT_GRACE_MS = 25;
function frameFor(frames, steps, i) {
  if (!frames.length) return null;
  let next = Infinity;
  for (let k = i + 1; k < steps.length; k++) if (steps[k].method === "pw:api" && !steps[k].api) { next = steps[k].start + PAINT_GRACE_MS; break; }
  let last = null;
  for (const f of frames) { if (f.t > next) break; last = f; }
  return last || frames[0];
}

async function main() {
  if (!fs.existsSync(resultsFile)) { console.log("lab-evidence: no results.json, nothing to do"); return; }
  const report = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const evidence = {};
  let frameCount = 0;
  let rendered = 0;
  const copied = new Map();
  const draw = await renderer();
  const nextFile = () => `evidence/${String(++frameCount).padStart(3, "0")}.jpeg`;
  const results = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) for (const t of spec.tests || []) for (const r of t.results || []) results.push(r);
    for (const s of suite.suites || []) walk(s);
  };
  for (const s of report.suites || []) walk(s);
  for (const r of results) {
    const att = (r.attachments || []).find((a) => a.name === "trace" && a.path);
    if (!att || !fs.existsSync(att.path)) continue;
    let entries;
    try { entries = zipEntries(fs.readFileSync(att.path)); } catch (e) { console.log("lab-evidence: cannot read", att.path, e.message); continue; }
    const { steps, frames } = readTrace(entries);
    const out = [];
    let afterApi = false;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.api) afterApi = true;
      else if (s.method !== "expect") afterApi = false;
      let shot = null;
      // API calls, and the assertions on their responses, are evidenced by the request line, not the page
      if (!s.api && !afterApi && frameCount < MAX_FRAMES) {
        const snap = draw ? snapshotFor(steps, i) : null;
        if (snap) {
          if (snap._file) shot = snap._file;
          else {
            const file = nextFile();
            try {
              await draw.render(snap, path.join(process.cwd(), file));
              snap._file = file;
              rendered++;
              shot = file;
            } catch (e) {
              console.log("lab-evidence: snapshot render failed for", s.title, e.message);
              frameCount--;
            }
          }
        }
        if (!shot) {
          const f = frameFor(frames, steps, i);
          if (f && entries.has(f.file)) {
            if (copied.has(f.file)) shot = copied.get(f.file);
            else {
              shot = nextFile();
              fs.writeFileSync(path.join(process.cwd(), shot), entries.get(f.file)());
              copied.set(f.file, shot);
            }
          }
        }
      }
      out.push({ title: s.title, ok: !s.error, durationMs: s.end != null ? Math.round(s.end - s.start) : undefined, error: s.error || undefined, screenshot: shot || undefined, child: s.child || undefined, api: s.api || undefined });
    }
    evidence[att.path] = { steps: out };
  }
  if (draw) await draw.close();
  fs.writeFileSync(path.join(process.cwd(), "evidence.json"), JSON.stringify(evidence));
  console.log(`lab-evidence: ${Object.keys(evidence).length} trace(s), ${frameCount} screenshot(s) (${rendered} rendered from DOM snapshots)`);
}

main().catch((e) => { console.log("lab-evidence: failed", e && e.stack || e); process.exitCode = 0; });

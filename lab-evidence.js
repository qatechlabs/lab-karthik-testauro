// Builds step-by-step evidence for the QA Interview Ready labs from Playwright traces.
// Reads results.json, opens each test's trace.zip, lists the top-level steps and picks the
// screencast frame taken right after each step. Writes evidence.json + evidence/*.jpeg.
// No dependencies: the zip is read with node:zlib.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const resultsFile = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME || path.join(process.cwd(), "results.json");
const outDir = path.join(process.cwd(), "evidence");
const MAX_FRAMES = 120;

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

function traceSteps(entries) {
  // test runner steps live in test.trace; screencast frames in <n>-trace.trace
  const steps = [];
  const open = new Map();
  const frames = [];
  for (const [name, read] of entries) {
    if (!/(^|\/)(test\.trace|\d+-trace\.trace|trace\.trace)$/.test(name)) continue;
    for (const e of lines(read())) {
      if (e.type === "screencast-frame") {
        const file = e.file || (e.sha1 ? `resources/${e.sha1}.jpeg` : null);
        if (file) frames.push({ t: e.timestamp, file });
      } else if (e.type === "before" && e.class === "Test" && !e.parentId && ["pw:api", "expect", "test.step", "attach", "test.attach"].includes(e.method)) {
        const s = { title: strip(e.title) || e.method, start: e.startTime, end: null, error: null, method: e.method };
        if (e.method === "test.attach" || e.method === "attach") continue;
        open.set(e.callId, s);
        steps.push(s);
      } else if (e.type === "before" && e.class === "Test" && e.parentId && e.method === "expect") {
        // expect() inside a test.step: keep it as its own line
        const s = { title: strip(e.title) || e.method, start: e.startTime, end: null, error: null, method: e.method, child: true };
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
  return { steps, frames };
}

function frameAfter(frames, end) {
  if (!frames.length || end == null) return null;
  let after = null;
  for (const f of frames) { if (f.t >= end) { after = f; break; } }
  if (after && after.t - end < 2500) return after;
  let before = null;
  for (const f of frames) { if (f.t <= end) before = f; else break; }
  return before || after;
}

function main() {
  if (!fs.existsSync(resultsFile)) { console.log("lab-evidence: no results.json, nothing to do"); return; }
  const report = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const evidence = {};
  let frameCount = 0;
  const copied = new Map();
  const walk = (suite) => {
    for (const spec of suite.specs || []) for (const t of spec.tests || []) for (const r of t.results || []) {
      const att = (r.attachments || []).find((a) => a.name === "trace" && a.path);
      if (!att || !fs.existsSync(att.path)) continue;
      let entries;
      try { entries = zipEntries(fs.readFileSync(att.path)); } catch (e) { console.log("lab-evidence: cannot read", att.path, e.message); continue; }
      const { steps, frames } = traceSteps(entries);
      const out = [];
      for (const s of steps) {
        const f = frameAfter(frames, s.end ?? s.start);
        let shot = null;
        if (f && entries.has(f.file)) {
          if (copied.has(f.file)) shot = copied.get(f.file);
          else if (frameCount < MAX_FRAMES) {
            shot = `evidence/${String(++frameCount).padStart(3, "0")}.jpeg`;
            fs.writeFileSync(path.join(process.cwd(), shot), entries.get(f.file)());
            copied.set(f.file, shot);
          }
        }
        out.push({ title: s.title, ok: !s.error, durationMs: s.end != null ? Math.round(s.end - s.start) : undefined, error: s.error || undefined, screenshot: shot || undefined, child: s.child || undefined });
      }
      evidence[att.path] = { steps: out };
    }
    for (const s of suite.suites || []) walk(s);
  };
  for (const s of report.suites || []) walk(s);
  fs.writeFileSync(path.join(process.cwd(), "evidence.json"), JSON.stringify(evidence));
  console.log(`lab-evidence: ${Object.keys(evidence).length} trace(s), ${frameCount} screenshot(s)`);
}

main();

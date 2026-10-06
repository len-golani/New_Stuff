/* ============================================================================
   audit-help.mjs — offline coverage audit for the beginner help system.

   Renders every view of index.html inside a stub DOM (no browser, no network),
   then reports every interactive control that has no `data-help` key, every
   `data-help` key that does not exist in the HELP dictionary, and every HELP
   entry nothing uses.

   Usage:
     node tools/audit-help.mjs          # audit, exit 1 if any gap
     node tools/audit-help.mjs --list   # print the full inventory, grouped
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(HERE, "..", "index.html"), "utf8");

/* ---------- 1. pull the app's <script> body out of the page ---------- */
const open = HTML.indexOf("<script>");
const body = HTML.slice(HTML.indexOf("\n", open) + 1, HTML.lastIndexOf("</script>"));

/* ---------- 2. smallest DOM that boots the app ---------- */
const store = new Map();
/* Seeded before boot: an empty tracker hides every per-project control, which
   is exactly where a gap would otherwise go unnoticed. */
store.set("ghc:accounts", JSON.stringify([
  { id: "personal", label: "Personal", user: "ada", email: "ada@example.com", color: "#2f81f7", host: "github-personal" },
  { id: "work", label: "Work", user: "ada-work", email: "work@example.com", color: "#a371f7", host: "github-work" }
]));
store.set("ghc:repos", JSON.stringify([
  { id: "p1", name: "my-app", label: "My App", path: "C:\\Users\\ada\\projects\\my-app", account: "personal", branch: "main", status: "clean", tags: ["client"], notes: "", remoteUrl: "git@github-personal:ada/my-app.git" },
  { id: "p2", name: "internal-api", label: "Internal API", path: "C:\\Users\\ada\\projects\\internal-api", account: "work", branch: "main", status: "dirty", tags: ["server"], notes: "", remoteUrl: "git@github-work:ada-work/internal-api.git" }
]));
store.set("ghc:done", JSON.stringify([0, 1, 2]));
const el = () => new Proxy({
  dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
  children: [], value: "", textContent: "", innerHTML: "", innerText: "",
  className: "", tagName: "DIV", checked: false, disabled: false,
  addEventListener() {}, removeEventListener() {}, appendChild() {},
  remove() {}, focus() {}, click() {}, scrollIntoView() {}, getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  querySelector: () => el(), querySelectorAll: () => []
}, { get: (t, k) => (k in t ? t[k] : el()), set: (t, k, v) => (t[k] = v, true) });

const document = {
  documentElement: el(), body: el(), head: el(),
  getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [],
  createElement: el, addEventListener() {}, removeEventListener() {}
};
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
const window = {
  addEventListener() {}, removeEventListener() {}, crypto: globalThis.crypto,
  location: { hash: "#/home" }, scrollTo() {}, innerWidth: 1280, innerHeight: 900
};
const location = window.location;
const navigator = { clipboard: { writeText: async () => {} } };
const context = {
  document, window, localStorage, location, navigator, crypto: globalThis.crypto,
  console, setTimeout, clearTimeout, requestAnimationFrame: () => 0, alert: () => {},
  addEventListener: window.addEventListener, matchMedia: () => ({ matches: false })
};
const TAIL = `;try{window.VIEWS=VIEWS}catch(e){};try{window.HELP=HELP}catch(e){};try{window.MODAL_HELP=MODAL_HELP}catch(e){};`;
new Function(...Object.keys(context), `"use strict";${body}${TAIL}`)(...Object.values(context));

const { RENDER, VIEWS, HELP, MODAL_HELP } = window;
const MODAL_HELP_KEYS = new Map(Object.entries(MODAL_HELP || {}));

/* ---------- 3. a quote-aware tag scanner (inline onclick can hold '>') ---------- */
const CLICKABLE_TAGS = new Set(["button", "a", "input", "select", "textarea", "summary"]);
const CLICKABLE_ATTR = /\b(onclick|data-act|data-copy|data-term|data-bulk|data-bulkproj|data-help)\b/;

function* tags(html) {
  for (let i = 0; i < html.length; i++) {
    if (html[i] !== "<") continue;
    if (/[a-zA-Z!/?]/.test(html[i + 1] || "")) {
      const m = /^<([a-zA-Z][\w-]*)/.exec(html.slice(i));
      if (!m) continue;
      const name = m[1].toLowerCase();
      let j = i + m[0].length, attrs = "", quote = null;
      while (j < html.length) {
        const c = html[j];
        if (quote) { if (c === quote) quote = null; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === ">") break;
        j++;
      }
      attrs = html.slice(i + m[0].length, j);
      yield { name, attrs, raw: html.slice(i, j + 1) };
      i = j;
    }
  }
}
const textOf = html => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
function labelAround(html, index) {
  return textOf(html.slice(index, index + 240)).slice(0, 70);
}
function isInteractive(t) {
  /* a <label> is only a control when it points at or wraps an input; <option>
     belongs to its <select>, and hidden/file inputs are never seen. */
  if (t.name === "label" && !/\bfor=|onclick|data-/.test(t.attrs)) return false;
  if (t.name === "option") return false;
  if (t.name === "input" && /type="(hidden|file)"/.test(t.attrs)) return false;
  if (CLICKABLE_TAGS.has(t.name)) return true;
  if (CLICKABLE_ATTR.test(t.attrs)) return true;
  return /class="[^"]*\b(chip|tab|navitem|opt|tile|rowlink|linkish)\b/.test(t.attrs);
}
const attr = (attrs, name) => {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
  return m ? m[1] : null;
};

/* ---------- 4. walk every view, plus the static shell around the script ---------- */
const inventory = [];
const scan = (html, view) => {
  for (const t of tags(html)) {
    if (!isInteractive(t)) continue;
    inventory.push({
      view, tag: t.name, help: attr(t.attrs, "data-help"),
      label: labelAround(html, html.indexOf(t.raw)),
      onclick: (attr(t.attrs, "onclick") || "").slice(0, 60)
    });
  }
};
for (const v of VIEWS) {
  let html = "";
  try { html = RENDER[v.id](); } catch (e) { console.error(`  !! ${v.id} threw: ${e.message}`); continue; }
  scan(html, v.id);
}
scan(HTML.slice(0, HTML.indexOf("<script>")) + HTML.slice(HTML.lastIndexOf("</script>")), "shell");

const HELPKEYS = HELP ? Object.keys(HELP) : [];
const used = new Set(inventory.map(i => i.help).filter(Boolean));
/* nav links, topbar and modal footers are built in render()/modal(), so the
   views alone would call their keys "unused". Scan those templates too. */
for (const t of tags(body)) {
  const k = attr(t.attrs, "data-help");
  if (k && !/[${}]/.test(k)) used.add(k);   /* ${...} are resolved at runtime */
  const lbl = attr(t.attrs, "data-lab");
  if (lbl && MODAL_HELP_KEYS.has(lbl)) used.add(MODAL_HELP_KEYS.get(lbl));
}
/* nav menus: the key lives on the VIEWS entry and is interpolated at runtime */
for (const v of VIEWS) if (v.help) used.add(v.help);
for (const m of body.matchAll(/t:"([^"]+)"/g)) if (MODAL_HELP_KEYS.has(m[1])) used.add(MODAL_HELP_KEYS.get(m[1]));
/* a pop-up button with no dictionary entry falls back to a neutral sentence at
   runtime, so it is a warning rather than an error */
const unmappedModal = [...new Set([...body.matchAll(/\{\s*t:(?:isNew\s*\?\s*")([^"]+)/g)].map(m => m[1]))]
  .filter(l => !MODAL_HELP_KEYS.has(l) && l !== "Save");
const gaps = inventory.filter(i => !i.help);
const dangling = [...used].filter(k => !HELPKEYS.includes(k));
const unused = HELPKEYS.filter(k => !used.has(k));

/* ---------- 4b. source lint ----------
   Some UI is built at runtime (the vault list, pop-up footers) and never
   appears in a view's markup. Scan the raw file for any interactive tag that
   still lacks data-help, and report it with its line number. */
const LINT_TAGS = /<(button|a|input|select|textarea|summary)\b/gi;
const runtime = [];
HTML.split("\n").forEach((line, i) => {
  for (const t of tags(line)) {
    if (!isInteractive(t)) continue;
    if (attr(t.attrs, "data-help")) continue;
    if (t.name === "input" && /id="(gsearch|cheats|filein|explin)"/.test(t.attrs) && !/data-help/.test(t.attrs) === false) continue;
    runtime.push({ line: i + 1, tag: t.name, snippet: line.trim().slice(0, 96) });
  }
});

/* ---------- 5. report ---------- */
if (process.argv.includes("--list")) {
  const only = process.argv[process.argv.indexOf("--list") + 1];
  for (const v of VIEWS) {
    if (only && only !== v.id) continue;
    const rows = inventory.filter(i => i.view === v.id);
    if (!rows.length) continue;
    console.log(`\n\x1b[1m${v.id} (${rows.length})\x1b[0m`);
    for (const r of rows) console.log(`  ${r.help ? "\x1b[32m✓\x1b[0m" : "\x1b[31m·\x1b[0m"} ${r.tag.padEnd(8)} ${(r.help || "—").padEnd(22)} ${r.label}`);
  }
  const shell = inventory.filter(i => i.view === "shell");
  if (shell.length && !only) {
    console.log(`\n\x1b[1mshell (${shell.length})\x1b[0m`);
    for (const r of shell) console.log(`  ${r.help ? "\x1b[32m✓\x1b[0m" : "\x1b[31m·\x1b[0m"} ${r.tag.padEnd(8)} ${(r.help || "—").padEnd(22)} ${r.label}`);
  }
}

const pct = inventory.length ? Math.round((100 * (inventory.length - gaps.length)) / inventory.length) : 100;
console.log(`\ninteractive controls : ${inventory.length}`);
console.log(`with data-help       : ${inventory.length - gaps.length}  (${pct}%)`);
console.log(`HELP entries         : ${HELPKEYS.length}`);
console.log(`dangling keys        : ${dangling.length ? dangling.join(", ") : "none"}`);
console.log(`unused HELP entries  : ${unused.length ? unused.join(", ") : "none"}`);
console.log(`unmapped modal labels: ${unmappedModal.length ? unmappedModal.join(", ") : "none"}`);
if (gaps.length) {
  console.log(`\n\x1b[31mgaps (${gaps.length}):\x1b[0m`);
  for (const g of gaps) console.log(`  ${g.view.padEnd(8)} ${g.tag.padEnd(8)} ${g.label}${g.onclick ? `   [${g.onclick}]` : ""}`);
}
if (runtime.length) {
  console.log(`\n\x1b[33mruntime tags without data-help (${runtime.length}):\x1b[0m`);
  for (const r of runtime) console.log(`  index.html:${r.line}  ${r.snippet}`);
}
process.exit(gaps.length || dangling.length || runtime.length ? 1 : 0);

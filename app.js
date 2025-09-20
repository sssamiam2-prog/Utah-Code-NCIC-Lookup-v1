// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const create = (tag, attrs = {}) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  return el;
};

// Build official Utah Code URL from a violation code string.
// Examples:
//   76-9-1503    -> https://le.utah.gov/xcode/Title76/Chapter9/76-9-S1503.html
//   41-6a-1102   -> https://le.utah.gov/xcode/Title41/Chapter6a/41-6a-S1102.html
//   76-9-702.3   -> https://le.utah.gov/xcode/Title76/Chapter9/76-9-S702.3.html
// If code has subsections like "(2)+(3A)", we strip them for the URL.
function buildUtahCodeUrl(codeRaw) {
  if (!codeRaw) return null;
  const code = String(codeRaw).trim();

  // Take only the first token (drop trailing text), then drop subsection hints
  const main = code.split(/\s/)[0];
  const base = main.split(/[()\+]/)[0];

  const parts = base.split("-");
  if (parts.length < 3) return null;
  const title = parts[0];
  const chapter = parts[1];
  const section = parts.slice(2).join("-");

  if (!/^\d+$/.test(title)) return null;
  if (!/^[0-9a-zA-Z]+$/.test(chapter)) return null;   // allows "6a"
  if (!/^[0-9a-zA-Z.]+$/.test(section)) return null;  // allows decimals

  const chapPart = chapter.toLowerCase();
  return `https://le.utah.gov/xcode/Title${title}/Chapter${chapPart}/${title}-${chapPart}-S${section}.html`;
}

// ===== State =====
let allRows = [];
let headers = [];
let currentPage = 1;
let pageSize = 100;

// ===== Load Data =====
async function loadData() {
  const loading = $("#loading");
  loading.style.display = "flex";
  try {
    const res = await fetch("./smot_data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load smot_data.json (HTTP ${res.status})`);
    allRows = await res.json();
    headers = Object.keys(allRows[0] || {});
  } catch (e) {
    console.error(e);
    alert("Could not load data file smot_data.json. Make sure it exists at the repo root.");
  } finally {
    loading.style.display = "none";
  }
}

// ===== Filters =====
function buildFilters() {
  // Jurisdiction dropdown (Gov Code Literal)
  const sel = $("#jurisdiction");
  sel.innerHTML = "";

  const values = [...new Set(allRows.map(r => r["Gov Code Literal"]).filter(Boolean))].sort();
  sel.appendChild(new Option("(All)", ""));
  values.forEach(v => sel.appendChild(new Option(v, v)));

  const ch = new Choices(sel, { searchEnabled: true, itemSelectText: "" });

  // Default to STATE OF UTAH if present
  if (values.includes("STATE OF UTAH")) {
    try { ch.setChoiceByValue("STATE OF UTAH"); } catch {}
    sel.value = "STATE OF UTAH";
  }

  sel.addEventListener("change", () => { currentPage = 1; render(); });
  $("#search").addEventListener("input", () => { currentPage = 1; render(); });
}

// ===== Filtering =====
function getFilters() {
  const juris = $("#jurisdiction").value || "";
  const txt = $("#search").value.trim().toLowerCase();
  return { juris, txt };
}

function rowMatches(row, f) {
  if (f.juris && row["Gov Code Literal"] !== f.juris) return false;
  if (f.txt) {
    const desc = (row["Short Description"] || "").toString().toLowerCase();
    const ncic = (row["NCIC Code"] || "").toString().toLowerCase();
    if (!(desc.includes(f.txt) || ncic.includes(f.txt))) return false;
  }
  return true;
}

// ===== Render =====
function render() {
  const thead = $("#head");
  const tbody = $("#body");
  const { juris, txt } = getFilters();

  const filtered = allRows.filter(r => rowMatches(r, { juris, txt }));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  $("#count").textContent = `${total.toLocaleString()} rows`;
  $("#page").textContent = `Page ${currentPage}/${totalPages}`;
  $("#prev").disabled = currentPage <= 1;
  $("#next").disabled = currentPage >= totalPages;

  // header (once)
  if (!thead.innerHTML) {
    headers.forEach(h => thead.appendChild(create("th", { text: h })));
  }

  // body
  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();

  pageRows.forEach(row => {
    const tr = document.createElement("tr");

    headers.forEach(h => {
      const td = document.createElement("td");
      const val = (row[h] ?? "").toString();

      if (h === "Violation Code" && val) {
        const url = buildUtahCodeUrl(val);
        if (url) {
          const a = create("a", { href: url, class: "link", text: val, title: "Preview Utah Code" });
          a.addEventListener("click", (e) => {
            e.preventDefault();
            openPreview(url, `Utah Code: ${val}`);
          });
          td.appendChild(a);
        } else {
          // Fallback to Google search if we can't build a section URL
          const a = create("a", { href: `https://www.google.com/search?q=${encodeURIComponent("Utah " + val)}`, class: "link", text: val, target: "_blank", rel: "noopener" });
          td.appendChild(a);
        }
      } else {
        td.textContent = val;
      }

      tr.appendChild(td);
    });

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

// ===== Pagination & size =====
function setupPager() {
  $("#prev").addEventListener("click", () => { if (currentPage > 1) { currentPage--; render(); } });
  $("#next").addEventListener("click", () => { currentPage++; render(); });
  $("#size").addEventListener("change", (e) => { pageSize = parseInt(e.target.value, 10) || 100; currentPage = 1; render(); });
}

// ===== Preview Modal (iframe with fallback) =====
const backdrop = $("#preview-backdrop");
const frame = $("#preview-frame");
const titleEl = $("#preview-title");
const urlEl = $("#preview-url");
const openBtn = $("#open-newtab");
const copyBtn = $("#copy-link");
const closeBtn = $("#close-preview");
const iframeMsg = $("#iframe-msg");

function openPreview(url, title) {
  titleEl.textContent = title || "Utah Code Preview";
  urlEl.textContent = url;
  urlEl.title = url;

  openBtn.onclick = () => window.open(url, "_blank", "noopener,noreferrer");
  copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(url); copyBtn.textContent = "Copied!"; setTimeout(()=>copyBtn.textContent="Copy link", 1200); }
    catch { copyBtn.textContent = "Copy failed"; setTimeout(()=>copyBtn.textContent="Copy link", 1200); }
  };

  // reset iframe UI
  iframeMsg.style.display = "none";
  const loader = backdrop.querySelector(".iframe-loading");
  loader.style.display = "flex";
  frame.src = "about:blank";

  // If site blocks framing, we won't get content — show fallback after timeout
  const timer = setTimeout(() => {
    loader.style.display = "none";
    iframeMsg.style.display = "flex";
  }, 3500);

  frame.addEventListener("load", () => { clearTimeout(timer); loader.style.display = "none"; }, { once: true });
  frame.src = url;

  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");
}

function closePreview() {
  frame.src = "about:blank";
  backdrop.style.display = "none";
  backdrop.setAttribute("aria-hidden", "true");
}

closeBtn.addEventListener("click", closePreview);
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closePreview(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePreview(); });

// ===== Init =====
(async function init() {
  await loadData();
  if (!allRows.length) return;
  // Build header immediately so table structure exists before first render
  const head = $("#head"); head.innerHTML = ""; headers.forEach(h => head.appendChild(create("th", { text: h })));
  buildFilters();
  setupPager();
  render();
})();

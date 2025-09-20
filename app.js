// ===== Utilities =====
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
// - Handles "41-6a-1102", "76-9-1503", "76-9-702.3"
// - Strips subsection suffixes like "(2)+(3A)" for the URL
function buildUtahCodeUrl(codeRaw) {
  if (!codeRaw) return null;
  const code = String(codeRaw).trim();
  const main = code.split(/\s/)[0];          // drop trailing text
  const base = main.split(/[()\+]/)[0];      // drop subsection hints
  const parts = base.split("-");
  if (parts.length < 3) return null;

  const title = parts[0];
  const chapter = parts[1];
  const section = parts.slice(2).join("-");  // join back if section had extra hyphens

  if (!/^\d+$/.test(title)) return null;
  if (!/^[0-9a-zA-Z]+$/.test(chapter)) return null;   // allows 6a
  if (!/^[0-9a-zA-Z.]+$/.test(section)) return null;  // allows decimals

  const chap = chapter.toLowerCase();
  return `https://le.utah.gov/xcode/Title${title}/Chapter${chap}/${title}-${chap}-S${section}.html`;
}

// ===== State =====
let allRows = [];
let headers = [];
let currentPage = 1;
let pageSize = 100;

// ===== Data load =====
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

// ===== Filters (Jurisdiction + Search) =====
function buildFilters() {
  const sel = $("#jurisdiction");
  sel.innerHTML = "";
  const values = [...new Set(allRows.map(r => r["Gov Code Literal"]).filter(Boolean))].sort();
  sel.appendChild(new Option("(All)", ""));
  values.forEach(v => sel.appendChild(new Option(v, v)));

  const ch = new Choices(sel, { searchEnabled: true, itemSelectText: "" });

  if (values.includes("STATE OF UTAH")) {
    try { ch.setChoiceByValue("STATE OF UTAH"); } catch {}
    sel.value = "STATE OF UTAH";
  }

  sel.addEventListener("change", () => { currentPage = 1; render(); });
  $("#search").addEventListener("input", () => { currentPage = 1; render(); });
}

// ===== Dense mode =====
function applyDenseFromStorage() {
  const on = localStorage.getItem("ncic_dense") === "1";
  $("#denseToggle").checked = on;
  document.body.classList.toggle("dense", on);
}
function setupDenseToggle() {
  applyDenseFromStorage();
  $("#denseToggle").addEventListener("change", (e) => {
    const on = e.target.checked;
    document.body.classList.toggle("dense", on);
    localStorage.setItem("ncic_dense", on ? "1" : "0");
  });
}

// ===== Filtering logic =====
function rowMatches(row, juris, txt) {
  if (juris && row["Gov Code Literal"] !== juris) return false;
  if (txt) {
    const d = (row["Short Description"] || "").toString().toLowerCase();
    const n = (row["NCIC Code"] || "").toString().toLowerCase();
    if (!(d.includes(txt) || n.includes(txt))) return false;
  }
  return true;
}

// ===== Render =====
function render() {
  const thead = $("#head");
  const tbody = $("#body");

  const juris = $("#jurisdiction").value || "";
  const txt = $("#search").value.trim().toLowerCase();

  const filtered = allRows.filter(r => rowMatches(r, juris, txt));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  $("#count").textContent = `${total.toLocaleString()} rows`;
  $("#page").textContent = `Page ${currentPage}/${totalPages}`;
  $("#prev").disabled = currentPage <= 1;
  $("#next").disabled = currentPage >= totalPages;

  // header once
  if (!thead.innerHTML) {
    headers.forEach(h => thead.appendChild(create("th", { text: h })));
  }

  // body
  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();

  pageRows.forEach(row => {
    const tr = document.createElement("tr");
    tr.addEventListener("click", () => openDetails(row));

    headers.forEach(h => {
      const td = document.createElement("td");
      const val = (row[h] ?? "").toString();

      if (h === "Violation Code" && val) {
        const url = buildUtahCodeUrl(val);
        const a = create("a", { href: url || "#", class: "code-link", text: val, title: "Preview Utah Code" });
        a.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation(); // don't trigger row modal
          if (url) openPreview(url, `Utah Code: ${val}`);
          else window.open(`https://www.google.com/search?q=${encodeURIComponent("Utah " + val)}`, "_blank", "noopener");
        });
        td.appendChild(a);
      } else {
        td.textContent = val;
      }

      tr.appendChild(td);
    });

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

// ===== Record Details Modal (includes clickable code link) =====
const detailsBackdrop = $("#details-backdrop");
const detailsContent = $("#details-content");
const detailsTitle = $("#details-title");
$("#close-details").addEventListener("click", closeDetails);
detailsBackdrop.addEventListener("click", (e)=>{ if (e.target === detailsBackdrop) closeDetails(); });
document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeDetails(); });

function openDetails(row) {
  detailsTitle.textContent = row["Short Description"] || "Record Details";
  detailsContent.innerHTML = "";

  headers.forEach(h => {
    const kv = create("div", { class: "kv" });
    kv.appendChild(create("div", { class: "k", text: h }));
    const value = (row[h] ?? "").toString();

    if (h === "Violation Code" && value) {
      const url = buildUtahCodeUrl(value);
      const v = create("div", { class: "v" });
      const a = create("a", { href: url || "#", class: "code-link", text: value });
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (url) openPreview(url, `Utah Code: ${value}`);
        else window.open(`https://www.google.com/search?q=${encodeURIComponent("Utah " + value)}`, "_blank", "noopener");
      });
      v.appendChild(a);
      kv.appendChild(v);
    } else {
      kv.appendChild(create("div", { class: "v", text: value }));
    }
    detailsContent.appendChild(kv);
  });

  detailsBackdrop.style.display = "flex";
  detailsBackdrop.setAttribute("aria-hidden", "false");
}
function closeDetails(){
  detailsBackdrop.style.display = "none";
  detailsBackdrop.setAttribute("aria-hidden", "true");
}

// ===== Preview Modal (iframe + fallback) =====
const previewBackdrop = $("#preview-backdrop");
const frame = $("#preview-frame");
const previewTitle = $("#preview-title");
const previewUrlEl = $("#preview-url");
const openNew = $("#open-newtab");
const copyLink = $("#copy-link");
const closePreviewBtn = $("#close-preview");
const iframeMsg = $("#iframe-msg");

function openPreview(url, title){
  previewTitle.textContent = title || "Utah Code Preview";
  previewUrlEl.textContent = url;
  previewUrlEl.title = url;

  openNew.onclick = () => window.open(url, "_blank", "noopener,noreferrer");
  copyLink.onclick = async () => {
    try { await navigator.clipboard.writeText(url); copyLink.textContent = "Copied!"; setTimeout(()=>copyLink.textContent="Copy link", 1200); }
    catch { copyLink.textContent = "Copy failed"; setTimeout(()=>copyLink.textContent="Copy link", 1200); }
  };

  // Reset
  iframeMsg.style.display = "none";
  const loader = previewBackdrop.querySelector(".iframe-loading");
  loader.style.display = "flex";
  frame.src = "about:blank";

  const timer = setTimeout(()=>{ loader.style.display="none"; iframeMsg.style.display="flex"; }, 3500);
  frame.addEventListener("load", ()=>{ clearTimeout(timer); loader.style.display="none"; }, { once:true });
  frame.src = url;

  previewBackdrop.style.display = "flex";
  previewBackdrop.setAttribute("aria-hidden","false");
}
function closePreview(){
  frame.src = "about:blank";
  previewBackdrop.style.display = "none";
  previewBackdrop.setAttribute("aria-hidden","true");
}
closePreviewBtn.addEventListener("click", closePreview);
previewBackdrop.addEventListener("click", (e)=>{ if (e.target === previewBackdrop) closePreview(); });
document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closePreview(); });

// ===== Pager =====
function setupPager(){
  $("#prev").addEventListener("click", ()=>{ if (currentPage>1){ currentPage--; render(); }});
  $("#next").addEventListener("click", ()=>{ currentPage++; render(); });
  $("#size").addEventListener("change", (e)=>{ pageSize = parseInt(e.target.value,10) || 100; currentPage = 1; render(); });
}

// ===== Init =====
(async function init(){
  await loadData();
  if (!allRows.length) return;

  // Build header once
  const head = $("#head"); head.innerHTML = ""; headers.forEach(h => head.appendChild(create("th", { text: h })));

  buildFilters();
  setupPager();
  setupDenseToggle();
  render();
})();

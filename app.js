// ====== CONFIG ======
const DATA_URL = "./smot_data.json"; // local JSON
const DEFAULT_JURISDICTION = "STATE OF UTAH";
const HIDE_FILTERS = new Set([
  "FTA Flag","Suggested Fine","Warr Flag","BCI Rpt",
  "Man Appearance Flag","Mand Appear Flag","Spec Process Attr",
  "Default Severity","Compliance Credit","DL Reportable",
  "Short Description","Violation Code","NCIC Code"
]);

// ====== UTIL ======
const $ = (s)=>document.querySelector(s);
const create = (t, attrs={}) => {
  const el = document.createElement(t);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k,v);
  }
  return el;
};
const showLoading = (on)=>{ const el=$("#loading"); if (!el) return; el.style.display = on? "flex":"none"; el.setAttribute("aria-hidden", on? "false":"true"); };
const friendly = (name)=> name === "Gov Code Literal" ? "Jurisdiction" : name;

function uniqSort(values){
  return [...new Set(values.filter(v=>v!==undefined && v!==null && v!==""))]
    .sort((a,b)=> String(a).localeCompare(String(b), undefined, {sensitivity:"base"}));
}

// Build official Utah Code URL from a violation code string.
function buildUtahCodeUrl(codeRaw){
  if (!codeRaw) return null;
  const code = String(codeRaw).trim();
  const main = code.split(/\s/)[0];
  const base = main.split(/[()\+]/)[0];
  const parts = base.split("-");
  if (parts.length < 3) return `https://www.google.com/search?q=${encodeURIComponent(`Utah ${code}`)}`;
  const title = parts[0];
  const chapter = parts[1];
  const section = parts.slice(2).join("-");
  if (!/^\d+$/.test(title) || !/^[0-9a-zA-Z.]+$/.test(section)) return `https://www.google.com/search?q=${encodeURIComponent(`Utah ${code}`)}`;
  if (!/^[0-9a-zA-Z]+$/.test(chapter)) return `https://www.google.com/search?q=${encodeURIComponent(`Utah ${code}`)}`;
  return `https://le.utah.gov/xcode/Title${title}/Chapter${chapter.toLowerCase()}/${title}-${chapter.toLowerCase()}-S${section}.html`;
}

// ====== STATE ======
let headers = [];
let allRows = [];
let page = 1;
let pageSize = 100;
let searchQuery = "";
const choices = {}; // column -> Choices instance

// ====== LOAD DATA ======
async function loadData() {
  showLoading(true);
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Unable to load smot_data.json");
    allRows = await res.json();
    if (!Array.isArray(allRows) || !allRows.length) throw new Error("smot_data.json is empty");
    headers = Object.keys(allRows[0]);
  } finally {
    showLoading(false);
  }
}

// ====== FILTERS ======
function buildFilters(){
  const filters = $("#filters");
  filters.innerHTML = "";
  headers.forEach(col=>{
    if (HIDE_FILTERS.has(col)) return;
    const wrap = create("div");
    wrap.appendChild(create("label", { class:"label", text: friendly(col) }));
    const sel = create("select", { "data-col": col });
    sel.appendChild(create("option", { value:"", text:"(All)"}));
    uniqSort(allRows.map(r=>r[col])).forEach(v =>{
      sel.appendChild(create("option", { value:String(v), text:String(v) }));
    });
    wrap.appendChild(sel);
    filters.appendChild(wrap);
    const isJur = col === "Gov Code Literal";
    const ch = new Choices(sel, {
      searchEnabled: true,
      removeItemButton: !isJur,
      duplicateItemsAllowed: false,
      shouldSort: true,
      itemSelectText: "",
      placeholderValue: "(All)"
    });
    if (!isJur) sel.setAttribute("multiple","multiple");
    choices[col] = ch;
  });
  if (choices["Gov Code Literal"]) {
    const j = choices["Gov Code Literal"];
    const exists = allRows.some(r => (r["Gov Code Literal"]||"") === DEFAULT_JURISDICTION);
    if (exists) {
      try { j.setChoiceByValue(DEFAULT_JURISDICTION); } catch(e){}
      j.passedElement.element.value = DEFAULT_JURISDICTION;
    }
  }
  Object.values(choices).forEach(ch => ch.passedElement.element
    .addEventListener("change", ()=>{ page=1; render(); }));
}

// ====== TABLE ======
function getActiveFilters(){
  const f = {};
  for (const [col, ch] of Object.entries(choices)) {
    const val = ch.getValue(true);
    if (Array.isArray(val) && val.length) f[col] = new Set(val.filter(x=>x!==""));
    else if (typeof val === "string" && val) f[col] = new Set([val]);
  }
  return f;
}
function rowMatches(row, f){
  for (const [col, set] of Object.entries(f)){
    const v = (row[col] ?? "").toString();
    if (!set.has(v)) return false;
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const sd = (row["Short Description"]||"").toString().toLowerCase();
    const nc = (row["NCIC Code"]||"").toString().toLowerCase();
    if (!(sd.includes(q) || nc.includes(q))) return false;
  }
  return true;
}
function render(){
  const f = getActiveFilters();
  const rows = (Object.keys(f).length || searchQuery) ? allRows.filter(r=>rowMatches(r,f)) : allRows;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (page > pages) page = pages;
  const start = (page-1)*pageSize;
  const slice = rows.slice(start, start+pageSize);
  $("#count").textContent = `${total.toLocaleString()} rows`;
  $("#page").textContent = `Page ${page} / ${pages}`;
  $("#prev").disabled = page <= 1;
  $("#next").disabled = page >= pages;
  const thead = $("#thead"); thead.innerHTML = "";
  headers.forEach((h, idx) => {
    const th = create("th", { text:h });
    if (idx === 0) th.style.left = "0";
    thead.appendChild(th);
  });
  const tbody = $("#tbody"); tbody.innerHTML = "";
  const frag = document.createDocumentFragment();
  slice.forEach(row=>{
    const tr = create("tr", { class:"tap", role:"button", tabindex:"0" });
    tr.addEventListener("click", ()=> openModalFromFiltered(row));
    tr.addEventListener("keydown", (e)=>{ if (e.key==="Enter"||e.key===" ") { e.preventDefault(); openModalFromFiltered(row); }});
    headers.forEach((h, idx)=>{
      if (h === "Violation Code") {
        const code = (row[h] ?? "").toString();
        const url = buildUtahCodeUrl(code);
        const td = create("td");
        if (url) {
          const a = create("a", { href:url, text: code, title:"Preview Utah Code", class:"code-link" });
          a.addEventListener("click", (e)=>{ e.preventDefault(); openIframePreview(url, code); });
          td.appendChild(a);
        } else td.textContent = code;
        if (idx === 0) td.style.left = "0";
        tr.appendChild(td);
      } else {
        const td = create("td", { text: (row[h] ?? "").toString() });
        if (idx === 0) td.style.left = "0";
        tr.appendChild(td);
      }
    });
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
}

// ====== MODALS ======
const backdrop = $("#backdrop");
const modalContent = $("#modal-content");
const modalTitle = $("#modal-title");
$("#close").addEventListener("click", closeModal);
backdrop.addEventListener("click", (e)=>{ if (e.target === backdrop) closeModal(); });
document.addEventListener("keydown", (e)=>{ if (e.key==="Escape") closeModal(); });

function getCurrentFiltered(){ const f = getActiveFilters(); return (Object.keys(f).length || searchQuery) ? allRows.filter(r=>rowMatches(r,f)) : allRows; }
function openModalFromFiltered(row){
  const list = getCurrentFiltered();
  const idx = list.indexOf(row);
  modalTitle.textContent = `Record: ${(row["Violation Code"]||"")} – ${(row["Short Description"]||"")}`;
  modalContent.innerHTML = "";
  headers.forEach(h=>{
    const kv = create("div", { class:"kv" });
    kv.appendChild(create("div", { class:"k", text: friendly(h) }));
    const val = (row[h] ?? "").toString();
    if (h === "Violation Code") {
      const url = buildUtahCodeUrl(val);
      const vDiv = create("div", { class:"v" });
      if (url) {
        const a = create("a", { href:url, text: val, class:"code-link" });
        a.addEventListener("click", (e)=>{ e.preventDefault(); openIframePreview(url, val); });
        vDiv.appendChild(a);
      } else vDiv.textContent = val;
      kv.appendChild(vDiv);
    } else {
      kv.appendChild(create("div", { class:"v", text: val }));
    }
    modalContent.appendChild(kv);
  });
  backdrop.style.display = "flex"; backdrop.setAttribute("aria-hidden","false");
}
function closeModal(){ backdrop.style.display = "none"; backdrop.setAttribute("aria-hidden","true"); }

// ====== IFRAME PREVIEW ======
const iframeBackdrop = $("#iframe-backdrop");
const iframeEl = $("#iframe");
$("#iframe-close").addEventListener("click", ()=>{ iframeBackdrop.style.display="none"; iframeEl.src=""; });
iframeBackdrop.addEventListener("click", (e)=>{ if (e.target===iframeBackdrop){ iframeBackdrop.style.display="none"; iframeEl.src=""; }});
function openIframePreview(url, code){
  iframeEl.src = url;
  $("#iframe-title").textContent = `Preview Utah Code – ${code}`;
  iframeBackdrop.style.display = "flex";
}

// ====== INIT ======
async function init(){
  $("#prev").addEventListener("click", ()=>{ if (page>1){ page--; render(); }});
  $("#next").addEventListener("click", ()=>{ page++; render(); });
  $("#size").addEventListener("change", (e)=>{ pageSize = parseInt(e.target.value, 10) || 100; page=1; render(); });
  const debounce = (fn,ms=140)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
  $("#q").addEventListener("input", debounce(()=>{ searchQuery = $("#q").value.trim(); page=1; render(); }, 140));
  $("#clear").addEventListener("click", ()=>{
    Object.values(choices).forEach(ch=>ch.clearStore());
    if (choices["Gov Code Literal"]) {
      const j = choices["Gov Code Literal"];
      try { j.setChoiceByValue(DEFAULT_JURISDICTION); } catch(e){}
      j.passedElement.element.value = DEFAULT_JURISDICTION;
    }
    $("#q").value = ""; searchQuery = ""; page=1; render();
  });
  await loadData(); buildFilters(); page=1; render();
}
init();

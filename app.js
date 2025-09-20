let allRows = [];
let headers = [];
let currentPage = 1;
let pageSize = 100;
let jurisdictionControl;

async function loadData() {
  document.getElementById("loading").style.display = "flex";
  const res = await fetch("./smot_data.json", { cache: "no-store" });
  const data = await res.json();
  allRows = data;
  headers = Object.keys(allRows[0] || {});
  document.getElementById("loading").style.display = "none";
}

function buildFilters() {
  const filtersDiv = document.getElementById("filters");
  filtersDiv.innerHTML = "";

  // Jurisdiction dropdown (Gov Code Literal)
  const wrap = document.createElement("div");
  const label = document.createElement("label");
  label.className = "label";
  label.textContent = "Jurisdiction";
  const sel = document.createElement("select");
  sel.setAttribute("data-col", "Gov Code Literal");
  wrap.appendChild(label);
  wrap.appendChild(sel);
  filtersDiv.appendChild(wrap);

  // Populate unique jurisdiction values
  const values = [...new Set(allRows.map(r => r["Gov Code Literal"]).filter(Boolean))].sort();
  sel.appendChild(new Option("(All)", ""));
  values.forEach(v => sel.appendChild(new Option(v, v)));

  jurisdictionControl = new Choices(sel, {
    searchEnabled: true,
    removeItemButton: false,
    shouldSort: true,
    placeholderValue: "(All)",
    itemSelectText: ""
  });

  // Default Jurisdiction
  jurisdictionControl.setChoiceByValue("STATE OF UTAH");
}

function getFilters() {
  const filters = {};
  const val = jurisdictionControl.getValue(true);
  if (val) filters["Gov Code Literal"] = new Set([val]);
  return filters;
}

function rowMatches(row, filters) {
  for (const [col, set] of Object.entries(filters)) {
    const v = (row[col] ?? "").toString();
    if (!set.has(v)) return false;
  }
  return true;
}

function render() {
  const tbody = document.getElementById("tbody");
  const q = document.getElementById("q").value.toLowerCase();
  const filters = getFilters();

  let filtered = allRows.filter(r => rowMatches(r, filters));

  if (q) {
    filtered = filtered.filter(r =>
      (r["Short Description"] || "").toLowerCase().includes(q) ||
      (r["NCIC Code"] || "").toLowerCase().includes(q)
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  document.getElementById("count").textContent = `${total.toLocaleString()} rows`;
  document.getElementById("page").textContent = `Page ${currentPage} / ${totalPages}`;
  document.getElementById("prev").disabled = currentPage <= 1;
  document.getElementById("next").disabled = currentPage >= totalPages;

  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();

  pageRows.forEach(r => {
    const tr = document.createElement("tr");
    tr.className = "tap";
    headers.forEach(h => {
      const td = document.createElement("td");
      let val = r[h] ?? "";

      if (h === "Violation Code" && val) {
        const link = document.createElement("a");
        link.href = `https://www.google.com/search?q=Utah+${encodeURIComponent(val)}`;
        link.target = "_blank";
        link.className = "code-link";
        link.textContent = val;
        td.appendChild(link);
      } else {
        td.textContent = val;
      }
      tr.appendChild(td);
    });

    tr.addEventListener("click", () => showRecord(r));
    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

function showRecord(row) {
  const backdrop = document.getElementById("backdrop");
  const modalTitle = document.getElementById("modal-title");
  const modalContent = document.getElementById("modal-content");

  modalTitle.textContent = row["Short Description"] || "Record";
  modalContent.innerHTML = "";

  headers.forEach(h => {
    const kv = document.createElement("div");
    kv.className = "kv";
    const k = document.createElement("div"); k.className = "k"; k.textContent = h;
    const v = document.createElement("div"); v.className = "v"; v.textContent = row[h] || "";
    kv.appendChild(k); kv.appendChild(v);
    modalContent.appendChild(kv);
  });

  backdrop.style.display = "flex";
}

function initEvents() {
  document.getElementById("q").addEventListener("input", () => { currentPage = 1; render(); });
  document.getElementById("prev").addEventListener("click", () => { if (currentPage > 1) { currentPage--; render(); } });
  document.getElementById("next").addEventListener("click", () => { currentPage++; render(); });
  document.getElementById("size").addEventListener("change", e => { pageSize = parseInt(e.target.value, 10) || 100; currentPage = 1; render(); });

  document.getElementById("close").addEventListener("click", () => { document.getElementById("backdrop").style.display = "none"; });
  document.getElementById("iframe-close").addEventListener("click", () => { document.getElementById("iframe-backdrop").style.display = "none"; });
}

async function init() {
  await loadData();
  buildFilters();
  initEvents();

  const headRow = document.getElementById("thead");
  headRow.innerHTML = "";
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  });

  render();
}

init();

let allRows = [];
let headers = [];
let currentPage = 1;
let pageSize = 100;

const $ = (sel) => document.querySelector(sel);
const createEl = (tag, attrs={}) => {
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k==="text") el.textContent = v;
    else if (k==="html") el.innerHTML = v;
    else el.setAttribute(k,v);
  }
  return el;
};

// ===== Load Data =====
async function loadData(){
  const loading = $("#loading");
  loading.style.display = "flex";
  try {
    const res = await fetch("./smot_data.json",{cache:"no-store"});
    if(!res.ok) throw new Error("Failed to load JSON");
    allRows = await res.json();
    headers = Object.keys(allRows[0]||{});
  } catch(e){
    console.error(e);
    alert("Could not load data file smot_data.json");
  } finally {
    loading.style.display = "none";
  }
}

// ===== Build Filters =====
function buildFilters(){
  const jurisSel = $("#jurisdiction");
  jurisSel.innerHTML = "";
  const jurisVals = [...new Set(allRows.map(r=>r["Gov Code Literal"]))].filter(Boolean).sort();
  jurisVals.unshift("(All)");
  jurisVals.forEach(v=>{
    const opt = createEl("option",{value:v,text:v});
    jurisSel.appendChild(opt);
  });
  // default "State of Utah"
  jurisSel.value = "STATE OF UTAH";
  new Choices(jurisSel,{searchEnabled:true,itemSelectText:""});
}

// ===== Filtering =====
function getFilters(){
  const juris = $("#jurisdiction").value;
  const txt = $("#search").value.trim().toLowerCase();
  return {juris,txt};
}

function rowMatches(row,f){
  if(f.juris && f.juris!=="(All)" && row["Gov Code Literal"]!==f.juris) return false;
  if(f.txt){
    const desc = (row["Short Description"]||"").toString().toLowerCase();
    const ncic = (row["NCIC Code"]||"").toString().toLowerCase();
    if(!desc.includes(f.txt) && !ncic.includes(f.txt)) return false;
  }
  return true;
}

// ===== Rendering =====
function render(){
  const tbody=$("#body"), thead=$("#head");
  const filters=getFilters();
  const filtered = allRows.filter(r=>rowMatches(r,filters));

  const total=filtered.length;
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  if(currentPage>totalPages) currentPage=totalPages;
  const start=(currentPage-1)*pageSize;
  const pageRows=filtered.slice(start,start+pageSize);

  $("#count").textContent=`${total.toLocaleString()} rows`;
  $("#page").textContent=`Page ${currentPage}/${totalPages}`;
  $("#prev").disabled=currentPage<=1;
  $("#next").disabled=currentPage>=totalPages;

  // header once
  if(!thead.innerHTML){
    headers.forEach(h=>thead.appendChild(createEl("th",{text:h})));
  }

  tbody.innerHTML="";
  const frag=document.createDocumentFragment();
  pageRows.forEach(r=>{
    const tr=document.createElement("tr");
    headers.forEach(h=>{
      let val=(r[h]??"").toString();
      if(h==="Violation Code" && val){
        const a=createEl("a",{href:"#",class:"link",text:val});
        a.addEventListener("click",e=>{
          e.preventDefault();
          openPreview(val);
        });
        const td=document.createElement("td");
        td.appendChild(a);
        tr.appendChild(td);
      } else {
        tr.appendChild(createEl("td",{text:val}));
      }
    });
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
}

// ===== Modal Preview =====
function openPreview(code){
  const url=`https://le.utah.gov/xcode/Title${code.split("-")[0]}.html`; 
  $("#preview").src=url;
  $("#modal").style.display="flex";
}
function closePreview(){
  $("#modal").style.display="none";
  $("#preview").src="";
}

// ===== Events =====
function setupEvents(){
  $("#jurisdiction").addEventListener("change",()=>{currentPage=1;render();});
  $("#search").addEventListener("input",()=>{currentPage=1;render();});
  $("#prev").addEventListener("click",()=>{if(currentPage>1){currentPage--;render();}});
  $("#next").addEventListener("click",()=>{currentPage++;render();});
  $("#size").addEventListener("change",e=>{pageSize=parseInt(e.target.value,10);currentPage=1;render();});
  $("#close").addEventListener("click",closePreview);
  $("#modal").addEventListener("click",e=>{if(e.target.id==="modal") closePreview();});
}

// ===== Init =====
(async function(){
  await loadData();
  if(!allRows.length) return;
  buildFilters();
  setupEvents();
  render();
})();

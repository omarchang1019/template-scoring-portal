function scoreToPriority(avg){
  if (avg >= 4.0) return "P0";
  if (avg >= 3.5) return "P1";
  if (avg >= 3.0) return "P2";
  return "P3";
}

function fmt(n){
  return Number.isFinite(n) ? n.toFixed(1) : "-";
}

function escapeHtml(s){
  return String(s || "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function el(id){ return document.getElementById(id); }

async function loadSummary(){
  // cache-bust
  const res = await fetch(`./data/summary.json?ts=${Date.now()}`);
  if (!res.ok) throw new Error(`Failed to load summary.json (${res.status})`);
  return res.json();
}

function computeNeedsScoring(item){
  if (!Array.isArray(item.reviewers) || item.reviewers.length === 0) {
    return item.score_count === 0; // no reviewers defined -> needs at least one score
  }
  return (item.score_count || 0) < item.reviewers.length;
}

function renderStats(items){
  const total = items.length;
  const scored = items.filter(x => Number.isFinite(x.avg)).length;
  const needs = items.filter(x => computeNeedsScoring(x)).length;
  const p0 = items.filter(x => x.priority === "P0").length;
  const p1 = items.filter(x => x.priority === "P1").length;
  const p2 = items.filter(x => x.priority === "P2").length;
  const p3 = items.filter(x => x.priority === "P3").length;

  el("stats").innerHTML = `
    <div><b>Total</b>: ${total} · <b>Scored</b>: ${scored} · <b>Needs scoring</b>: ${needs}</div>
    <div class="muted">P0: ${p0} · P1: ${p1} · P2: ${p2} · P3: ${p3}</div>
  `;
}

function renderList(items){
  const list = el("list");
  list.innerHTML = "";

  if (!items.length){
    list.innerHTML = `<div class="muted">No ideas found.</div>`;
    return;
  }

  for (const it of items){
    const meta = it.meta || {};
    const needs = computeNeedsScoring(it);
    const avg = it.avg;
    const p = (avg === null || avg === undefined) ? "-" : scoreToPriority(avg);

    const reviewers = Array.isArray(it.reviewers) && it.reviewers.length
      ? it.reviewers.map(u => `@${u}`).join(", ")
      : "-";

    const scores = Array.isArray(it.scores) ? it.scores : [];

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <div style="font-weight:700">${escapeHtml(it.title)} <span class="muted">#${it.number}</span></div>
          <div class="muted">${escapeHtml(meta.platform || "Unknown platform")} · ${escapeHtml(meta.date || "")}</div>
        </div>
        <div class="badge">
          ${needs ? "Needs scoring" : `Avg ${fmt(avg)} · ${p}`}
        </div>
      </div>

      <div class="meta">
        ${meta.reference_link ? `<span class="pill"><a href="${escapeHtml(meta.reference_link)}" target="_blank" rel="noreferrer">Reference</a></span>` : ""}
        ${meta.screenshot_url ? `<span class="pill"><a href="${escapeHtml(meta.screenshot_url)}" target="_blank" rel="noreferrer">Screenshot</a></span>` : ""}
        <span class="pill"><a href="${escapeHtml(it.html_url)}" target="_blank" rel="noreferrer">Open in GitHub</a></span>
      </div>

      <div class="muted">
        <b>Reviewers</b>: ${escapeHtml(reviewers)}<br/>
        <b>Scores</b>: ${scores.length ? scores.map(s => `@${s.user}=${s.score}`).join(", ") : "None yet"}<br/>
        ${it.missing_count !== null ? `<b>Missing</b>: ${it.missing_count}` : ""}
      </div>
    `;
    list.appendChild(div);
  }
}

async function refresh(){
  el("status").textContent = "Loading...";
  try{
    const data = await loadSummary();
    const items = Array.isArray(data.items) ? data.items : [];
    const filter = el("filterSelect").value;

    let shown = items;

    if (filter === "needs_scoring"){
      shown = items.filter(x => computeNeedsScoring(x));
    } else if (filter === "scored"){
      shown = items.filter(x => Number.isFinite(x.avg));
    } else if (["P0","P1","P2","P3"].includes(filter)){
      shown = items.filter(x => x.priority === filter);
    }

    renderStats(items);
    renderList(shown);

    el("status").textContent =
      `Last generated: ${data.generated_at ? new Date(data.generated_at).toLocaleString() : "N/A"} · Showing ${shown.length} item(s).`;
  }catch(e){
    el("status").textContent = e.message || String(e);
  }
}

(function init(){
  el("btnRefresh").onclick = refresh;
  el("filterSelect").onchange = refresh;
  refresh();
})();

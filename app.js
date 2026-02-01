function requireUnlocked() {
  if (sessionStorage.getItem("unlocked") !== "yes") {
    window.location.href = "index.html";
  }
}
function pad2(n){ return String(n).padStart(2, "0"); }
function msParts(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ---------- Storage ---------- */
const STORE = {
  posts: "love_posts_v4",
  media: "love_media_v1",        // {id,type,dataUrl,createdAt}
  counters: "love_counters_v2",  // {title,mode,targetLocal}
  events: "love_events_v2"       // {title,text,createdAt,eventLocal,media?}
};

function safeLoad(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function safeSave(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function loadPosts(){ return safeLoad(STORE.posts, []); }
function savePosts(x){ safeSave(STORE.posts, x); }

function loadMedia(){ return safeLoad(STORE.media, []); }
function saveMedia(x){ safeSave(STORE.media, x); }

function loadEvents(){ return safeLoad(STORE.events, []); }
function saveEvents(x){ safeSave(STORE.events, x); }

function loadCounters(){
  const defaults = [
    { title: "How long we’ve been together ❤️", mode: "since", targetLocal: "2025-09-21T00:00" },
    { title: "Until we see each other 🥺", mode: "until", targetLocal: "2026-02-20T18:00" }
  ];
  const data = safeLoad(STORE.counters, []);
  if (Array.isArray(data) && data.length) return data;
  safeSave(STORE.counters, defaults);
  return defaults;
}
function saveCounters(x){ safeSave(STORE.counters, x); }

/* datetime-local string -> LOCAL Date */
function localDateFromInput(dtLocalStr){
  const [datePart, timePart] = dtLocalStr.split("T");
  const [Y,M,D] = datePart.split("-").map(Number);
  const [h,m] = timePart.split(":").map(Number);
  return new Date(Y, M-1, D, h, m, 0);
}

/* file -> dataURL */
function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---------- Modal helpers ---------- */
function ensureModal(){
  let modal = document.getElementById("modal");
  if (!modal){
    modal = document.createElement("div");
    modal.id = "modal";
    modal.className = "modal";
    modal.innerHTML = `<div class="modalInner card" id="modalInner"></div>`;
    document.body.appendChild(modal);
  }
  return modal;
}
function openModal(html){
  const modal = ensureModal();
  const inner = document.getElementById("modalInner");
  inner.innerHTML = html;
  modal.style.display = "grid";
  modal.addEventListener("click", (e)=> { if (e.target === modal) closeModal(); }, { once:true });
  return { modal, inner };
}
function closeModal(){
  const modal = document.getElementById("modal");
  if (modal) modal.style.display = "none";
}

/* ---------- Lightbox ---------- */
function openLightbox(item){
  const title = item.type === "video" ? "Video" : "Photo";
  const body = item.type === "video"
    ? `<video class="lightMedia" src="${item.dataUrl}" controls autoplay playsinline></video>`
    : `<img class="lightMedia" src="${item.dataUrl}" alt="photo">`;

  const { inner } = openModal(`
    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <h2 style="margin:0;">${title}</h2>
      <button class="btn" id="closeX">✕</button>
    </div>
    <div class="hr"></div>
    ${body}
  `);
  inner.querySelector("#closeX").addEventListener("click", closeModal);
}

/* ---------- Media helpers ---------- */
function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function getAllMedia(){
  return loadMedia().sort((a,b)=> b.createdAt - a.createdAt);
}

/* ---------- Events: show next upcoming only ---------- */
function getNextUpcomingEvent(){
  const now = new Date();
  const events = loadEvents().slice();

  // keep only events in the future (or within 1 min grace)
  const future = events.filter(e => {
    const dt = localDateFromInput(e.eventLocal);
    return (dt.getTime() - now.getTime()) > -60000;
  });

  future.sort((a,b)=> localDateFromInput(a.eventLocal) - localDateFromInput(b.eventLocal));
  return future.length ? future[0] : null;
}

/* ------------------------------------------------------------------
   Pixel Heart FX: FIX Mickey look (better heart mask)
   - Use a heart equation but apply a "top valley" carve
   - Also tighten threshold and scale parameters
------------------------------------------------------------------- */
function runPixelHeartFX({durationMs = 2400} = {}){
  const overlay = document.getElementById("fxOverlay");
  const canvas = document.getElementById("fxCanvas");
  const ctx = canvas.getContext("2d");

  overlay.style.display = "block";

  function resize(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();

  const W = window.innerWidth, H = window.innerHeight;
  const size = Math.min(W, H) * 0.58;
  const left = (W - size) / 2;
  const top  = (H - size) / 2;

  const cell = Math.max(6, Math.floor(size / 78));
  const cols = Math.floor(size / cell);
  const rows = Math.floor(size / cell);

  const heartCells = [];
  for (let y = 0; y < rows; y++){
    for (let x = 0; x < cols; x++){
      // narrower x, taller y
      const nx = (x - cols/2) / (cols * 0.30);
      const ny = - (y - rows/2) / (rows * 0.40);

      // classic implicit heart
      const a = (nx*nx + ny*ny - 1);
      const v = a*a*a - (nx*nx)*(ny*ny*ny);

      // carve the top valley so it doesn't look like "ears"
      // valley around x≈0, y≈0.6..1.1
      const valley = (Math.abs(nx) < 0.35 && ny > 0.65 && ny < 1.18);

      // keep only strong inside points
      if (v <= -0.11 && !valley) heartCells.push({x,y});
    }
  }

  const particles = heartCells.map(t => ({
    x: Math.random() * cols,
    y: Math.random() * rows,
    tx: t.x, ty: t.y,
    vx: (Math.random()-0.5) * 0.9,
    vy: (Math.random()-0.5) * 0.9,
    hue: 330 + Math.random()*14
  }));

  const start = performance.now();

  function draw(now){
    const p = Math.min(1, (now-start)/durationMs);
    const settle = p*p;

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(0,0,W,H);

    // glow
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,79,166,0.13)";
    ctx.arc(W/2, H/2, size*0.42, 0, Math.PI*2);
    ctx.fill();

    for (const s of particles){
      const ax = (s.tx - s.x) * 0.12 * settle;
      const ay = (s.ty - s.y) * 0.12 * settle;

      s.vx = (s.vx + ax) * (0.82 + 0.14*settle);
      s.vy = (s.vy + ay) * (0.82 + 0.14*settle);

      const jitter = (1-settle) * 0.14;
      s.vx += (Math.random()-0.5) * jitter;
      s.vy += (Math.random()-0.5) * jitter;

      s.x += s.vx; s.y += s.vy;

      const px = left + Math.floor(s.x) * cell;
      const py = top  + Math.floor(s.y) * cell;

      const alpha = 0.22 + 0.74*settle;
      ctx.fillStyle = `hsla(${s.hue}, 95%, ${56+8*settle}%, ${alpha})`;
      ctx.fillRect(px, py, cell-1, cell-1);
    }

    if (p > 0.9){
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.font = "900 22px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("❤️", W/2, H*0.78);
    }

    if (p < 1) requestAnimationFrame(draw);
    else setTimeout(()=> overlay.style.display="none", 450);
  }
  requestAnimationFrame(draw);
}

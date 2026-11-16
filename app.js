/* ============================================================
   MOTIONLAB — app.js
   Catalogue, filtres, animations d'interface
   ============================================================ */
"use strict";

/* ---------- Catalogue de presets (placeholders — les vraies animations arrivent ensuite) ---------- */
const CATS = {
  texte: { label: "Texte" },
  transition: { label: "Transition" },
  element: { label: "Élément" },
  overlay: { label: "Overlay" },
  social: { label: "Social" },
  mc: { label: "Minecraft" },
};

const PRESETS = [
  { name: "Titre Chroma",     cat: "texte",     dur: "4 s",  style: "ph-grad",  h: 262, desc: "Titre avec ombres RGB décalées",        badge: "Populaire" },
  { name: "Kinetic Lecture",  cat: "texte",     dur: "18 s", style: "ph-grad",  h: 200, desc: "Texte au rythme de ta voice-over",      badge: "Nouveau", isNew: true },
  { name: "Mot qui Barré",    cat: "texte",     dur: "3 s",  style: "ph-strike", h: 348, desc: "Un mot barré d'un trait rouge" },
  { name: "Souligné Impact",  cat: "texte",     dur: "3 s",  style: "ph-grad",  h: 45,  desc: "Soulignement qui glisse sous le mot" },
  { name: "Bulle Cercle",     cat: "texte",     dur: "3 s",  style: "ph-ring",  h: 190, desc: "Un mot entouré à la main" },
  { name: "Mot Punch",        cat: "texte",     dur: "2 s",  style: "ph-grad",  h: 348, desc: "Impact + zoom caméra sur un mot",       badge: "Populaire" },
  { name: "Étincelles",       cat: "element",   dur: "4 s",  style: "ph-ring",  h: 45,  desc: "Étincelles scintillantes autour d'un mot" },
  { name: "Compteur de Vues", cat: "element",   dur: "4 s",  style: "ph-count", h: 145, desc: "Compteur qui grimpe jusqu'à ta valeur" },
  { name: "Barres Croissantes", cat: "element", dur: "4 s",  style: "ph-bars",  h: 145, desc: "Graphique en barres qui monte" },
  { name: "Zoom Punch",       cat: "transition", dur: "1 s", style: "ph-grad",  h: 348, desc: "Zoom brutal sur le beat",               badge: "Populaire" },
  { name: "Flash Blanc",      cat: "transition", dur: "1 s", style: "ph-ring",  h: 0,   desc: "Flash à l'impact" },
  { name: "Fondu Chroma",     cat: "transition", dur: "2 s", style: "ph-grad",  h: 262, desc: "Fondu avec aberration chromatique" },
  { name: "Bouton SUBSCRIBE", cat: "social",    dur: "4 s",  style: "ph-grad",  h: 348, desc: "Pastille abonne-toi qui pop",           badge: "Nouveau", isNew: true },
  { name: "Cloche Notif",     cat: "social",    dur: "3 s",  style: "ph-ring",  h: 45,  desc: "Cloche de notification qui sonne" },
  { name: "Like Pop",         cat: "social",    dur: "2 s",  style: "ph-count", h: 348, desc: "Cœur qui explose + compteur" },
  { name: "Lower Third Pro",  cat: "social",    dur: "6 s",  style: "ph-grad",  h: 220, desc: "Bandeau nom + fonction élégant" },
  { name: "Emoji Rain",       cat: "overlay",   dur: "5 s",  style: "ph-orbit", h: 45,  desc: "Pluie d'emojis réaction" },
  { name: "Split Reveal",     cat: "transition", dur: "2 s", style: "ph-scan",  h: 262, desc: "L'écran se découpe en deux" },
  { name: "Étiquette Prix",   cat: "element",   dur: "3 s",  style: "ph-grad",  h: 145, desc: "Tag prix qui rebondit" },
  { name: "Pièce Dollar",     cat: "element",   dur: "3 s",  style: "ph-ring",  h: 145, desc: "Pièce $ qui tourne et rebondit" },
  { name: "Barre de Vies MC",   cat: "mc", dur: "4 s", style: "ph-grad", h: 348, desc: "Cœurs du HUD qui encaissent un coup", badge: "Minecraft" },
  { name: "Hotbar MC",          cat: "mc", dur: "4 s", style: "ph-grad", h: 45,  desc: "Sélection qui glisse sur la vraie hotbar", badge: "Minecraft" },
  { name: "Niveau XP MC",       cat: "mc", dur: "4 s", style: "ph-grad", h: 145, desc: "Barre d'XP + niveau qui grimpe", badge: "Minecraft" },
  { name: "Boss Bar MC",        cat: "mc", dur: "4 s", style: "ph-grad", h: 262, desc: "Barre de boss façon Ender Dragon", badge: "Minecraft" },
  { name: "Coup Critique MC",   cat: "mc", dur: "2 s", style: "ph-grad", h: 25,  desc: "Particules de crit + dégâts volants", badge: "Minecraft" },
  { name: "Succès Débloqué MC", cat: "mc", dur: "4 s", style: "ph-grad", h: 145, desc: "Toast de succès qui glisse depuis la droite", badge: "Minecraft" },
  { name: "Orbe d'XP MC",       cat: "mc", dur: "4 s", style: "ph-grad", h: 145, desc: "Orbes d'XP flottants qui se font attirer", badge: "Minecraft" },
  { name: "Décompte",         cat: "texte",   dur: "4 s", style: "ph-ring",  h: 348, desc: "3, 2, 1… GO avec anneau de progression", badge: "Nouveau", isNew: true },
  { name: "Machine à Écrire", cat: "texte",   dur: "4 s", style: "ph-grad",  h: 145, desc: "Texte tapé lettre par lettre avec curseur", badge: "Nouveau", isNew: true },
  { name: "Glitch Texte",     cat: "texte",   dur: "3 s", style: "ph-scan",  h: 262, desc: "Bugs RGB et tranches déplacées" },
  { name: "Néon Flicker",     cat: "texte",   dur: "4 s", style: "ph-grad",  h: 190, desc: "Enseigne néon qui scintille" },
  { name: "Confettis",        cat: "social",  dur: "4 s", style: "ph-ring",  h: 145, desc: "Explosion de confettis en éventail" },
  { name: "Onde Sonore",      cat: "element", dur: "5 s", style: "ph-bars",  h: 190, desc: "Barres audio façon égaliseur" },
  { name: "Sticker Pop",      cat: "element", dur: "3 s", style: "ph-grad",  h: 262, desc: "Autocollant qui pop avec rebond" },
  { name: "Bandeau Défilant", cat: "social",  dur: "6 s", style: "ph-scan",  h: 145, desc: "Texte défilant en continu" },
];

/* ---------- Rendu de la grille ---------- */
const grid = document.getElementById("libGrid");
const emptyMsg = document.getElementById("libEmpty");
let activeCat = "all";

function renderGrid() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const items = PRESETS.filter(p =>
    (activeCat === "all" || p.cat === activeCat) &&
    (!q || (p.name + " " + p.desc + " " + p.cat).toLowerCase().includes(q))
  );
  emptyMsg.hidden = items.length > 0;
  grid.innerHTML = items.map((p, i) => `
    <article class="lib-card tilt" style="--h:${p.h}; animation-delay:${Math.min(i * 0.04, 0.5)}s" data-name="${p.name}">
      <div class="ph ph-anim"><canvas class="pv" data-pv="${p.name}"></canvas></div>
      <span class="lib-tag">${CATS[p.cat].label}</span>
      ${p.isNew ? '<span class="lib-new">NEW</span>' : ""}
      <div class="lib-meta"><h4>${p.name}</h4><p>${p.dur} · ${p.desc}</p></div>
    </article>
  `).join("");
  bindTilt(grid);
  Preview.bind(grid);
}

/* ---------- Filtres + recherche ---------- */
document.getElementById("chips").addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === chip));
  activeCat = chip.dataset.cat;
  renderGrid();
});
document.getElementById("search").addEventListener("input", renderGrid);

/* ---------- Modal aperçu ---------- */
const modal = document.getElementById("modal");
const modalPlayer = document.getElementById("modalPlayer");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");

function openModal(preset) {
  const p = PRESETS.find(x => x.name === preset) || PRESETS[0];
  modalTitle.textContent = p.name;
  modalMeta.textContent = `${p.dur} · 4K 60 fps · MP4 · ${p.desc}`;
  const STUDIO_MAP = {
    "Titre Chroma": "titre-chroma", "Compteur de Vues": "compteur", "Barres Croissantes": "barres",
    "Bouton SUBSCRIBE": "subscribe", "Zoom Punch": "punch", "Lower Third Pro": "lower-third",
    "Souligné Impact": "souligne", "Mot qui Barré": "barre", "Split Reveal": "split",
    "Barre de Vies MC": "mc-vies", "Hotbar MC": "mc-hotbar", "Niveau XP MC": "mc-xp",
    "Boss Bar MC": "mc-bossbar", "Coup Critique MC": "mc-crit", "Kinetic Lecture": "kinetic", "Bulle Cercle": "bulle", "Mot Punch": "mot-punch", "Étincelles": "etincelles", "Flash Blanc": "flash", "Fondu Chroma": "fond-chroma", "Cloche Notif": "cloche", "Like Pop": "like-pop", "Emoji Rain": "emoji-rain", "Étiquette Prix": "etiquette", "Pièce Dollar": "piece", "Succès Débloqué MC": "mc-succes", "Orbe d'XP MC": "mc-orb", "Décompte": "decompte", "Machine à Écrire": "typewriter", "Glitch Texte": "glitch", "Néon Flicker": "neon", "Confettis": "confettis", "Onde Sonore": "onde", "Sticker Pop": "sticker", "Bandeau Défilant": "marquee",
  };
  const sid = STUDIO_MAP[p.name];
  document.getElementById("modalStudio").href = sid ? `studio.html?preset=${sid}` : "studio.html";
  modalPlayer.innerHTML = `
    <canvas class="pv" data-pv="${p.name}"></canvas>
    <div class="tc-track" style="position:absolute; bottom:14px; left:16px; gap:4px;">
      <i class="tc-clip c1" style="width:40px"></i><i class="tc-clip c2" style="width:26px"></i><i class="tc-clip c3" style="width:33px"></i>
    </div>`;
  modal.classList.add("open");
  Preview.bind(modalPlayer);
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
grid.addEventListener("click", e => {
  const card = e.target.closest(".lib-card");
  if (card) openModal(card.dataset.name);
});
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalBackdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ---------- Reveal au scroll ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); } });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));

/* ---------- Compteurs animés ---------- */
const counterIO = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    counterIO.unobserve(en.target);
    const el = en.target, target = +el.dataset.count, suffix = el.dataset.suffix || "";
    const t0 = performance.now(), dur = 1600;
    (function tick(now) {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased).toLocaleString("fr-FR") + suffix;
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  });
}, { threshold: 0.5 });
document.querySelectorAll(".stat-num").forEach(el => counterIO.observe(el));

/* ---------- Tilt 3D + spotlight ---------- */
function bindTilt(scope) {
  (scope || document).querySelectorAll(".tilt").forEach(card => {
    if (card._tiltBound) return;
    card._tiltBound = true;
    card.addEventListener("mousemove", e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.transform = `perspective(800px) rotateY(${(x - .5) * 9}deg) rotateX(${(.5 - y) * 7}deg) translateY(-4px)`;
      if (card.classList.contains("feature-card")) {
        card.style.setProperty("--mx", x * 100 + "%");
        card.style.setProperty("--my", y * 100 + "%");
      }
    });
    card.addEventListener("mouseleave", () => { card.style.transform = ""; });
  });
}
bindTilt();

/* ---------- Curseur personnalisé ---------- */
const dot = document.getElementById("cursorDot");
const ring = document.getElementById("cursorRing");
let mx = -100, my = -100, rx = -100, ry = -100;
document.addEventListener("mousemove", e => { mx = e.clientX; my = e.clientY; });
(function followCursor() {
  rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
  dot.style.transform = `translate(${mx}px, ${my}px)`;
  ring.style.transform = `translate(${rx}px, ${ry}px)`;
  requestAnimationFrame(followCursor);
})();
document.querySelectorAll("a, button, .lib-card, input, summary").forEach(el => {
  el.addEventListener("mouseenter", () => ring.classList.add("hovering"));
  el.addEventListener("mouseleave", () => ring.classList.remove("hovering"));
});

/* ---------- Boutons magnétiques + ripple ---------- */
document.querySelectorAll(".magnetic").forEach(btn => {
  btn.addEventListener("mousemove", e => {
    const r = btn.getBoundingClientRect();
    btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
  });
  btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
  btn.addEventListener("click", e => {
    const r = btn.getBoundingClientRect();
    const rip = document.createElement("span");
    rip.className = "ripple";
    rip.style.left = e.clientX - r.left + "px";
    rip.style.top = e.clientY - r.top + "px";
    rip.style.width = rip.style.height = Math.max(r.width, r.height) + "px";
    btn.appendChild(rip);
    setTimeout(() => rip.remove(), 550);
  });
});

/* ---------- Nav : scroll, lien actif, burger ---------- */
const nav = document.getElementById("nav");
const links = [...document.querySelectorAll(".nav-links a")].filter(a => a.getAttribute("href").startsWith("#"));
const sections = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", scrollY > 30);
  const y = scrollY + 120;
  let current = null;
  sections.forEach(s => { if (s.offsetTop <= y) current = s.id; });
  links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + current));
  updateProgress();
}, { passive: true });
document.getElementById("burger").addEventListener("click", () => nav.classList.toggle("open"));
links.forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

/* ---------- Progression de lecture + retour en haut ---------- */
const scrollProgress = document.getElementById("scrollProgress");
const toTop = document.getElementById("toTop");
const ttRing = document.getElementById("ttRing");
const CIRC = 2 * Math.PI * 16;
function updateProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const k = max > 0 ? scrollY / max : 0;
  scrollProgress.style.width = k * 100 + "%";
  ttRing.style.strokeDashoffset = CIRC * (1 - k);
  toTop.classList.toggle("show", scrollY > 600);
}
toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

/* ---------- Mot rotatif du hero ---------- */
const WORDS = ["tes montages", "tes Shorts", "tes intros", "tes TikToks", "tes clients"];
const rotator = document.getElementById("rotator");
let wIdx = 0;
function typeWord(word) {
  return new Promise(res => {
    let i = 0;
    rotator.textContent = "";
    const type = setInterval(() => {
      rotator.textContent = word.slice(0, ++i);
      if (i >= word.length) { clearInterval(type); setTimeout(res, 1700); }
    }, 55);
  });
}
function eraseWord(word) {
  return new Promise(res => {
    let i = word.length;
    const del = setInterval(() => {
      rotator.textContent = word.slice(0, --i);
      if (i <= 0) { clearInterval(del); setTimeout(res, 350); }
    }, 28);
  });
}
(async function rotate() {
  for (;;) {
    await typeWord(WORDS[wIdx]);
    await eraseWord(WORDS[wIdx]);
    wIdx = (wIdx + 1) % WORDS.length;
  }
})();

/* ---------- Parallaxe légère du hero ---------- */
const heroVisual = document.getElementById("heroVisual");
document.addEventListener("mousemove", e => {
  if (!heroVisual) return;
  const dx = (e.clientX / innerWidth - .5), dy = (e.clientY / innerHeight - .5);
  heroVisual.style.transform = `translate(${dx * -14}px, ${dy * -10}px)`;
});

/* ---------- Init ---------- */
renderGrid();
updateProgress();
Preview.bind(document.getElementById("heroVisual"));

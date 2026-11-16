/* ============================================================
   MOTIONLAB — studio.js
   Moteur de rendu canvas + presets personnalisables + export MP4
   ============================================================ */
"use strict";

/* ---------- Utils ---------- */
const TAU = Math.PI * 2;

function shadeColor(hex, pct) {
  const n = parseInt(hex.replace("#", ""), 16);
  let r = (n >> 16) + pct, g = ((n >> 8) & 0xff) + pct, b = (n & 0xff) + pct;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const norm = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeOutExpo = x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeInExpo = x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeInOutCubic = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const VW = 1280, VH = 720;

/* ---------- Textures Minecraft (HUD réel du jeu) ---------- */
const MC_IMG = {};
const MC_SRC = {
  heart_full: "mc/heart_full.png", heart_half: "mc/heart_half.png", heart_container: "mc/heart_container.png",
  heart_poisoned: "mc/heart_poisoned.png", heart_withered: "mc/heart_withered.png",
  hotbar: "mc/hotbar.png", hotbar_sel: "mc/hotbar_selection.png",
  xp_bg: "mc/xp_bg.png", xp_fill: "mc/xp_fill.png", crosshair: "mc/crosshair.png",
  boss_purple_bg: "mc/boss_purple_bg.png", boss_purple_fill: "mc/boss_purple_fill.png",
  boss_red_bg: "mc/boss_red_bg.png", boss_red_fill: "mc/boss_red_fill.png",
  crit: "mc/particle_critical_hit.png", pheart: "mc/particle_heart.png", flame: "mc/particle_flame.png",
  sword: "mc/item_diamond_sword.png", nsword: "mc/item_netherite_sword.png",
  gapple: "mc/item_golden_apple.png", bow: "mc/item_bow.png", potion: "mc/item_potion.png", diamond: "mc/item_diamond.png",
};
for (const [k, src] of Object.entries(MC_SRC)) {
  const im = new Image(); im.src = src; MC_IMG[k] = im;
}
/* Dessine une texture MC en pixels nets (sans lissage). Retourne false si pas chargée. */
function mcDraw(c, key, x, y, w, h) {
  const im = MC_IMG[key];
  if (im && im.complete && im.naturalWidth > 1) {
    c.imageSmoothingEnabled = false;
    c.drawImage(im, x, y, w, h);
    return true;
  }
  return false;
}
/* Texte style Minecraft : gros contour noir */
function mcText(c, str, x, y, size, color, o = {}) {
  c.font = `${o.w || 800} ${size}px ${o.f || '"Trebuchet MS", "Segoe UI", sans-serif'}`;
  c.textAlign = o.a || "center";
  c.textBaseline = o.b || "middle";
  c.lineJoin = "round";
  c.strokeStyle = "#1a1a1a";
  c.lineWidth = Math.max(3, size * 0.14);
  c.strokeText(str, x, y);
  c.fillStyle = color;
  c.fillText(str, x, y);
}

/* ---------- Canvas ---------- */
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

const RESOLUTIONS = {
  "720p30":  { w: 1280, h: 720,  fps: 30, bitrate: 2_500_000 },
  "1080p30": { w: 1920, h: 1080, fps: 30, bitrate: 5_000_000 },
  "1080p60": { w: 1920, h: 1080, fps: 60, bitrate: 8_000_000 },
  "4k60":    { w: 3840, h: 2160, fps: 60, bitrate: 20_000_000 },
};

/* ---------- Helpers de dessin (espace virtuel 1280×720) ---------- */
function setFont(size, weight = "900", family = '"Arial Black", Arial, sans-serif') {
  ctx.font = `${weight} ${size}px ${family}`;
}
function fitScale(text, size, maxW) {
  setFont(size);
  return Math.min(1, maxW / Math.max(1, ctx.measureText(text).width));
}
function drawText(str, x, y, size, color, opts = {}) {
  setFont(size, opts.weight || "900", opts.family || '"Arial Black", Arial, sans-serif');
  ctx.textAlign = opts.align || "center";
  ctx.textBaseline = opts.baseline || "middle";
  const ga = ctx.globalAlpha;
  if (opts.alpha != null) ctx.globalAlpha = ga * opts.alpha;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = ga;
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
const ACCENT = P => (typeof P.color === "string" ? P.color : "#f2f2fb");

/* ---------- Catalogue de presets ---------- */
/* Chaque preset : { id, name, cat, desc, params:[…], draw(ctx, t, P) }
   t ∈ [0, P.dur) — tout est déterministe → export identique à l'aperçu. */
const PRESETS = [
  {
    id: "titre-chroma", name: "Titre Chroma", cat: "texte", dot: "#a34dff",
    desc: "Titre avec aberration chromatique et pop d'entrée.",
    params: [
      { k: "text", type: "text", label: "Texte", def: "MON TITRE" },
      { k: "color", type: "color", label: "Couleur du texte", def: "#f2f2fb" },
      { k: "offset", type: "range", label: "Intensité chroma", min: 0, max: 26, step: 1, def: 12 },
      { k: "size", type: "range", label: "Taille", min: 60, max: 180, step: 2, def: 130 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      const pop = easeOutBack(norm(t, 0, 0.55));
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      const fs = P.size * fitScale(P.text, P.size, 1080);
      const s = pop * (1 + 0.015 * Math.sin(t * 2.4)) * (1 - 0.15 * out);
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.scale(s, s);
      ctx.globalAlpha = pop * (1 - out);
      setFont(fs);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (P.offset > 0) {
        ctx.globalAlpha *= 0.85; ctx.fillStyle = "#ff4d6d"; ctx.fillText(P.text, -P.offset, 0);
        ctx.fillStyle = "#789bff"; ctx.fillText(P.text, P.offset, 0);
        ctx.globalAlpha = pop * (1 - out);
      }
      ctx.fillStyle = P.color; ctx.fillText(P.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  {
    id: "compteur", name: "Compteur de Vues", cat: "element", dot: "#34e6a8",
    desc: "Nombre qui grimpe — parfait pour les stats et résultats.",
    params: [
      { k: "start", type: "number", label: "Valeur de départ", def: 0, min: 0, max: 1e9 },
      { k: "end", type: "number", label: "Valeur finale", def: 320, min: 0, max: 1e9 },
      { k: "prefix", type: "text", label: "Préfixe", def: "+" },
      { k: "suffix", type: "text", label: "Suffixe", def: "%" },
      { k: "label", type: "text", label: "Légende", def: "DE VUES EN 7 JOURS" },
      { k: "color", type: "color", label: "Couleur", def: "#34e6a8" },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      const k = easeOutExpo(norm(t, 0.35, P.dur - 0.5));
      const val = Math.round(P.start + (P.end - P.start) * k);
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      const pop = easeOutBack(norm(t, 0, 0.45));
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.scale(pop * (1 - 0.15 * out), pop * (1 - 0.15 * out));
      ctx.globalAlpha = pop * (1 - out);
      const valStr = P.prefix + val.toLocaleString("fr-FR") + P.suffix;
      const vSize = 170 * fitScale(valStr, 170, 1080);
      drawText(valStr, 0, -20, vSize, P.color, { family: '"Sora", "Arial Black", Arial, sans-serif' });
      drawText(P.label, 0, 95, 30, "#a0a2c7", { weight: "700", family: '"Inter", Arial, sans-serif' });
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  {
    id: "barres", name: "Barres Croissantes", cat: "element", dot: "#789bff",
    desc: "Graphique en barres qui monte — compare des chiffres.",
    params: [
      { k: "labels", type: "text", label: "Étiquettes (séparées par ,)", def: "Vidéos, Shorts, Lives, Reels" },
      { k: "values", type: "text", label: "Valeurs (séparées par ,)", def: "40, 75, 30, 100" },
      { k: "color", type: "color", label: "Couleur des barres", def: "#789bff" },
      { k: "unit", type: "text", label: "Unité", def: "k" },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      const labels = P.labels.split(",").map(s => s.trim());
      const values = P.values.split(",").map(s => parseFloat(s.trim()) || 0);
      const n = Math.min(6, Math.max(1, labels.length));
      const maxV = Math.max(...values.slice(0, n), 1);
      const bw = Math.min(110, 900 / n - 50), gap = 900 / n;
      const x0 = VW / 2 - 450 + gap / 2;
      const baseY = VH / 2 + 150;
      const maxH = 330;
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      ctx.save();
      ctx.globalAlpha = 1 - out;
      // ligne de base
      ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0 - 40, baseY); ctx.lineTo(x0 + gap * n - gap / 2 + 20, baseY); ctx.stroke();
      for (let i = 0; i < n; i++) {
        const g = easeOutBack(norm(t, 0.3 + i * 0.16, 0.8 + i * 0.16));
        const h = Math.max(2, (values[i] / maxV) * maxH * g);
        const x = x0 + i * gap - bw / 2;
        ctx.save();
        ctx.shadowColor = P.color; ctx.shadowBlur = 26 * g;
        ctx.fillStyle = P.color;
        roundRect(x, baseY - h, bw, h, Math.min(14, bw / 3));
        ctx.fill();
        ctx.restore();
        if (g > 0.5) {
          ctx.globalAlpha = (1 - out) * clamp((g - 0.5) * 2, 0, 1);
          drawText(values[i] + P.unit, x + bw / 2, baseY - h - 26, 30, "#f2f2fb");
          drawText(labels[i] || "—", x + bw / 2, baseY + 34, 22, "#a0a2c7", { weight: "600", family: '"Inter", Arial, sans-serif' });
          ctx.globalAlpha = 1 - out;
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  {
    id: "subscribe", name: "Pastille Abonne-toi", cat: "social", dot: "#ff4d6d",
    desc: "Bouton d'abonnement qui pop — le classique YouTube.",
    params: [
      { k: "text", type: "text", label: "Texte du bouton", def: "S'ABONNER" },
      { k: "color", type: "color", label: "Couleur", def: "#ff0033" },
      { k: "scale", type: "range", label: "Taille", min: 60, max: 140, step: 1, def: 100 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      const pop = easeOutBack(norm(t, 0.2, 0.8));
      const pulse = 1 + 0.02 * Math.sin(t * 5);
      const out = easeInExpo(norm(t, P.dur - 0.4, P.dur));
      const k = pop * pulse * (1 - out);
      // le texte définit la taille du bouton, plafonné à l'écran (jamais rogné)
      const pad = 100;                                   // marge horizontale totale
      const maxW = VW - 160;                             // largeur max à l'écran
      let fs = 60 * P.scale / 100;
      setFont(fs);
      let tw = ctx.measureText(P.text).width;
      if (tw + pad > maxW) {                             // texte trop long → police réduite
        fs = Math.max(16, fs * (maxW - pad) / tw);
        setFont(fs);
        tw = ctx.measureText(P.text).width;
      }
      const w = Math.min(maxW, tw + pad);
      const h = Math.max(0.78 * P.scale, fs * 1.45);
      // ondes
      const rp = norm(t, 0.5, 1.6) % 1;
      if (rp > 0 && rp < 1) {
        ctx.globalAlpha = (1 - rp) * 0.4 * pop;
        ctx.strokeStyle = P.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(VW / 2, VH / 2, w / 2 + 60 + 190 * rp, h / 2 + 30 + 80 * rp, 0, 0, TAU); ctx.stroke();
      }
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.scale(k, k);
      ctx.shadowColor = P.color; ctx.shadowBlur = 44;
      ctx.fillStyle = P.color;
      roundRect(-w / 2, -h / 2, w, h, h / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      drawText(P.text, 0, 2, fs, "#ffffff");
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  {
    id: "punch", name: "Zoom Punch", cat: "transition", dot: "#ff7a93",
    desc: "Impact caméra + flash — colle-le sur un beat.",
    params: [
      { k: "text", type: "text", label: "Texte (optionnel)", def: "BOOM" },
      { k: "color", type: "color", label: "Couleur", def: "#ffcf3f" },
      { k: "intensity", type: "range", label: "Intensité du zoom", min: 4, max: 30, step: 1, def: 14 },
      { k: "flash", type: "range", label: "Flash", min: 0, max: 100, step: 1, def: 55 },
      { k: "dur", type: "range", label: "Durée (s)", min: 1, max: 4, step: 0.5, def: 2 },
    ],
    draw(ctx, t, P) {
      const zoomIn = easeInExpo(norm(t, 0, 0.22));
      const settle = easeOutExpo(norm(t, 0.22, 1.0));
      const scale = 1 + (P.intensity / 100) * (zoomIn * (1 - settle) * 3.2);
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      // flash
      const fp = 1 - norm(t, 0, 0.14);
      if (fp > 0 && P.flash > 0) {
        ctx.globalAlpha = fp * (P.flash / 100);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-120, -120, VW + 240, VH + 240);
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.scale(scale * (1 - 0.2 * out), scale * (1 - 0.2 * out));
      if (P.text) {
        const pop = easeOutBack(norm(t, 0.1, 0.5));
        ctx.globalAlpha = pop * (1 - out);
        const fs = fitScale(P.text, 140, 1000) * 140;
        setFont(fs);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.save(); ctx.scale(pop, pop);
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillText(P.text, 8, 8);
        ctx.fillStyle = P.color; ctx.fillText(P.text, 0, 0);
        ctx.restore();
      }
      // traits d'impact
      const sp = norm(t, 0.05, 0.5);
      if (sp > 0 && sp < 1) {
        ctx.globalAlpha = (1 - sp) * 0.9;
        ctx.strokeStyle = P.color; ctx.lineWidth = 5; ctx.lineCap = "round";
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + 0.3;
          const r1 = 240 + 210 * sp, r2 = r1 + 60;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.72);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 * 0.72);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  {
    id: "lower-third", name: "Bandeau Identité", cat: "social", dot: "#873bff",
    desc: "Lower third pro — nom + rôle, entrée et sortie glissées.",
    params: [
      { k: "name", type: "text", label: "Nom", def: "Alex Martin" },
      { k: "role", type: "text", label: "Rôle", def: "Créateur YouTube — 240k abonnés" },
      { k: "color", type: "color", label: "Couleur d'accent", def: "#873bff" },
      { k: "dur", type: "range", label: "Durée (s)", min: 3, max: 12, step: 0.5, def: 6 },
    ],
    draw(ctx, t, P) {
      const inK = easeOutExpo(norm(t, 0.1, 0.8));
      const outK = easeInExpo(norm(t, P.dur - 0.8, P.dur - 0.1));
      const x = -520 + inK * 580 - outK * 620;
      const y = VH / 2 + 170;
      // la largeur du bandeau s'adapte aux textes
      setFont(46, "700", '"Sora", Arial, sans-serif');
      const nameW = ctx.measureText(P.name).width;
      setFont(24, "500", '"Inter", Arial, sans-serif');
      const roleW = ctx.measureText(P.role).width;
      const bw = Math.max(430, Math.min(1020, Math.max(nameW, roleW) + 96));
      const bh = 118;
      ctx.save();
      // barre accent
      ctx.fillStyle = P.color;
      ctx.shadowColor = P.color; ctx.shadowBlur = 30;
      roundRect(x, y - bh / 2, 10, bh, 5); ctx.fill();
      ctx.shadowBlur = 0;
      // fond
      ctx.fillStyle = "rgba(13,13,23,.88)";
      roundRect(x + 10, y - bh / 2, bw, bh, 16); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1.5;
      roundRect(x + 10, y - bh / 2, bw, bh, 16); ctx.stroke();
      // textes
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const nk = easeOutExpo(norm(t, 0.35, 0.9));
      ctx.globalAlpha = nk;
      setFont(46, "700", '"Sora", Arial, sans-serif'); ctx.fillStyle = "#f2f2fb";
      ctx.fillText(P.name, x + 46, y - 18 + (1 - nk) * 16);
      const rk = easeOutExpo(norm(t, 0.5, 1.05));
      ctx.globalAlpha = rk * 0.85;
      setFont(24, "500", '"Inter", Arial, sans-serif'); ctx.fillStyle = "#a0a2c7";
      ctx.fillText(P.role, x + 46, y + 28 + (1 - rk) * 14);
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  {
    id: "souligne", name: "Souligné Impact", cat: "texte", dot: "#ffcf3f",
    desc: "Un mot souligné qui claque — pour insister.",
    params: [
      { k: "text", type: "text", label: "Mot", def: "GRATUIT" },
      { k: "color", type: "color", label: "Couleur du trait", def: "#ffcf3f" },
      { k: "size", type: "range", label: "Taille", min: 60, max: 190, step: 2, def: 120 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 3 },
    ],
    draw(ctx, t, P) {
      const pop = easeOutBack(norm(t, 0, 0.5));
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      const fs = fitScale(P.text, P.size, 1060) * P.size;
      setFont(fs);
      const w = ctx.measureText(P.text).width;
      ctx.save();
      ctx.translate(VW / 2, VH / 2 - 20);
      ctx.scale(pop * (1 - 0.15 * out), pop * (1 - 0.15 * out));
      ctx.globalAlpha = pop * (1 - out);
      setFont(fs);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#f2f2fb"; ctx.fillText(P.text, 0, 0);
      const up = easeOutExpo(norm(t, 0.45, 0.95));
      if (up > 0) {
        ctx.save();
        ctx.shadowColor = P.color; ctx.shadowBlur = 24;
        ctx.fillStyle = P.color;
        roundRect(-w * 0.47 * up, fs * 0.52, w * 0.94 * up, 16, 8);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  {
    id: "barre", name: "Mot Barré", cat: "texte", dot: "#ff4d6d",
    desc: "Un mot frappé d'un trait — Nie l'idée d'avant.",
    params: [
      { k: "text", type: "text", label: "Mot", def: "CHER" },
      { k: "color", type: "color", label: "Couleur du trait", def: "#ff4d6d" },
      { k: "size", type: "range", label: "Taille", min: 60, max: 190, step: 2, def: 120 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 3 },
    ],
    draw(ctx, t, P) {
      const pop = easeOutBack(norm(t, 0, 0.5));
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      const fs = fitScale(P.text, P.size, 1060) * P.size;
      setFont(fs);
      const w = ctx.measureText(P.text).width;
      const struck = norm(t, 0.5, 0.8);
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.rotate(struck * -0.05);
      ctx.scale(pop * (1 - 0.15 * out), pop * (1 - 0.15 * out));
      ctx.globalAlpha = pop * (1 - 0.45 * struck) * (1 - out);
      setFont(fs);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#f2f2fb"; ctx.fillText(P.text, 0, 0);
      const sp = easeInOutCubic(norm(t, 0.35, 0.65));
      if (sp > 0) {
        ctx.strokeStyle = P.color; ctx.lineWidth = fs * 0.09; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-w / 2 - 16, 0);
        ctx.lineTo(-w / 2 - 16 + (w + 32) * sp, 0);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  {
    id: "split", name: "Transition Split", cat: "transition", dot: "#34e6a8",
    desc: "Deux volets couvrent l'écran — insère-la entre deux plans.",
    params: [
      { k: "colorL", type: "color", label: "Volet gauche", def: "#873bff" },
      { k: "colorR", type: "color", label: "Volet droit", def: "#ff4d6d" },
      { k: "label", type: "text", label: "Texte au centre", def: "ATTENTION" },
      { k: "dur", type: "range", label: "Durée (s)", min: 1, max: 4, step: 0.5, def: 2 },
    ],
    draw(ctx, t, P) {
      const inK = easeInOutCubic(norm(t, 0, P.dur * 0.36));
      const outK = easeInOutCubic(norm(t, P.dur * 0.62, P.dur));
      const half = VW / 2;
      const lW = half * inK * (1 - outK);
      const rW = half * inK * (1 - outK);
      ctx.save();
      ctx.fillStyle = P.colorL;
      ctx.fillRect(-40, -40, lW + 40, VH + 80);
      ctx.fillStyle = P.colorR;
      ctx.fillRect(VW - rW, -40, rW + 40, VH + 80);
      if (inK >= 1 && outK <= 0) {
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.fillRect(half - 2, 0, 4, VH);
        const lk = easeOutBack(norm(t, P.dur * 0.4, P.dur * 0.6));
        if (P.label && lk > 0) {
          ctx.save();
          ctx.translate(VW / 2, VH / 2);
          const fs = 92 * fitScale(P.label, 92, VW * 0.9);
          ctx.scale(lk, lk);
          drawText(P.label, 0, 0, fs, "#ffffff");
          ctx.restore();
        }
      }
      ctx.restore();
    },
  },


  /* ================= MINECRAFT (HUD réel du jeu) ================= */
  {
    id: "mc-vies", name: "Barre de Vies MC", cat: "minecraft", dot: "#ff4d6d",
    desc: "Cœurs du HUD qui se remplissent puis encaissent un coup.",
    params: [
      { k: "hearts", type: "range", label: "Cœurs au départ", min: 1, max: 10, step: 1, def: 10 },
      { k: "loss", type: "range", label: "Cœurs perdus", min: 0, max: 9, step: 1, def: 4 },
      { k: "variant", type: "select", label: "Effet", opts: [["normal", "Normal"], ["poison", "Poison"], ["wither", "Wither"]], def: "normal" },
      { k: "scale", type: "range", label: "Taille du HUD", min: 2, max: 7, step: 1, def: 5 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, VW, VH); }
      const S = P.scale, HW = 9 * S, GAP = 8 * S + 1;
      const n = Math.round(P.hearts), lost = Math.min(Math.round(P.loss), n);
      const totalW = n * GAP - (GAP - HW);
      const x0 = VW / 2 - totalW / 2, y = VH / 2;
      const variant = P.variant === "poison" ? "heart_poisoned" : P.variant === "wither" ? "heart_withered" : "heart_full";
      // secousse à l'impact
      const hitT = 1.3;
      const shake = t > hitT && t < hitT + 0.5 ? Math.sin(t * 60) * 4 * (1 - norm(t, hitT, hitT + 0.5)) : 0;
      ctx.save(); ctx.translate(shake, 0);
      for (let i = 0; i < n; i++) {
        const appear = easeOutBack(norm(t, i * 0.09, 0.45 + i * 0.09));
        const x = x0 + i * GAP;
        mcDraw(ctx, "heart_container", x, y, HW, HW);
        // remplissage
        const filled = t < hitT ? 1 : (i < n - lost ? 1 : 0);
        if (filled) {
          const blink = t > hitT && t < hitT + 0.55 ? (Math.sin(t * 28) > 0 ? 0.35 : 1) : 1;
          ctx.globalAlpha = appear * blink;
          mcDraw(ctx, variant, x, y, HW, HW);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
      if (t > hitT && t < hitT + 0.3) {
        // dégâts qui volent
        mcText(ctx, `-${lost * 2}`, VW / 2 + 30, y - 60 * (1 - norm(t, hitT, hitT + 0.3)) - 20, 40 * S * 0.6, "#ff5252");
      }
    },
  },

  {
    id: "mc-hotbar", name: "Hotbar MC", cat: "minecraft", dot: "#ffcf3f",
    desc: "Barre d'objets réelle avec la sélection qui glisse.",
    params: [
      { k: "items", type: "text", label: "Objets (sword,nsword,gapple,bow,potion,diamond)", def: "sword,nsword,gapple,bow,potion,diamond" },
      { k: "speed", type: "range", label: "Vitesse de sélection", min: 1, max: 6, step: 0.5, def: 2.5 },
      { k: "scale", type: "range", label: "Taille du HUD", min: 2, max: 7, step: 1, def: 4 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, VW, VH); }
      const S = P.scale;
      const W = 182 * S, H = 22 * S;
      const x = VW / 2 - W / 2, y = VH / 2;
      const inK = easeOutBack(norm(t, 0, 0.6));
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.scale(inK, inK);
      ctx.translate(-VW / 2, -VH / 2);
      mcDraw(ctx, "hotbar", x, y, W, H);
      // objets dans les slots (16 px de sprite, pitch 20.22 px)
      const items = P.items.split(",").map(s => s.trim()).filter(s => MC_SRC[s] || ["sword","nsword","gapple","bow","potion","diamond"].includes(s));
      const pitch = W / 9;
      items.slice(0, 9).forEach((key, i) => {
        const pop = easeOutBack(norm(t, 0.3 + i * 0.08, 0.75 + i * 0.08));
        const size = 16 * S * pop;
        mcDraw(ctx, key, x + i * pitch + (pitch - size) / 2, y + (H - size) / 2, size, size);
      });
      // sélection qui glisse en continu
      const selF = (t * P.speed) % 9;
      const selI = Math.min(8, Math.floor(selF));
      const frac = selI === 8 ? 0 : (selF - selI);
      const selX = x + selI * pitch - 3 * S + frac * pitch;
      ctx.globalAlpha = 0.9;
      mcDraw(ctx, "hotbar_sel", selX, y - 3 * S, 24 * S, 23 * S);
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  {
    id: "mc-xp", name: "Niveau XP MC", cat: "minecraft", dot: "#34e6a8",
    desc: "Barre d'expérience qui se remplit + niveau qui grimpe.",
    params: [
      { k: "level", type: "number", label: "Niveau final", def: 30, min: 1, max: 999 },
      { k: "fill", type: "range", label: "Remplissage final (%)", min: 10, max: 100, step: 5, def: 100 },
      { k: "scale", type: "range", label: "Taille du HUD", min: 2, max: 7, step: 1, def: 4 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, VW, VH); }
      const S = P.scale;
      const W = 182 * S, H = 5 * S;
      const x = VW / 2 - W / 2, y = VH / 2 + 40;
      mcDraw(ctx, "xp_bg", x, y, W, H);
      const k = easeOutExpo(norm(t, 0.2, P.dur - 0.8));
      const fillW = W * (P.fill / 100) * k;
      if (fillW > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, fillW, H); ctx.clip();
        mcDraw(ctx, "xp_fill", x, y, W, H);
        ctx.restore();
      }
      // niveau qui grimpe, style Minecraft
      const lvl = Math.round(P.level * easeOutExpo(norm(t, 0.2, P.dur - 0.8)));
      const popT = easeOutBack(norm(t, P.dur - 0.85, P.dur - 0.5));
      const size = 22 * S * (0.9 + 0.1 * Math.sin(t * 3)) * (t > P.dur - 0.85 ? 1 + 0.25 * (1 - popT) : 1);
      mcText(ctx, String(lvl), VW / 2, y - 22, size, "#80ff20");
    },
  },

  {
    id: "mc-bossbar", name: "Boss Bar MC", cat: "minecraft", dot: "#a16bff",
    desc: "Barre de boss du jeu — Ender Dragon, Wither…",
    params: [
      { k: "name", type: "text", label: "Nom du boss", def: "Ender Dragon" },
      { k: "color", type: "select", label: "Couleur", opts: [["purple", "Violet"], ["red", "Rouge"]], def: "purple" },
      { k: "fill", type: "range", label: "Vie finale (%)", min: 5, max: 100, step: 5, def: 35 },
      { k: "scale", type: "range", label: "Taille du HUD", min: 2, max: 7, step: 1, def: 4 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, VW, VH); }
      const S = P.scale;
      const W = 182 * S, H = 5 * S;
      const x = VW / 2 - W / 2, y = VH / 2;
      mcDraw(ctx, `boss_${P.color}_bg`, x, y, W, H);
      const k = easeOutExpo(norm(t, 0.3, P.dur - 0.6));
      const fillW = W * (P.fill / 100) * k;
      if (fillW > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, fillW, H); ctx.clip();
        mcDraw(ctx, `boss_${P.color}_fill`, x, y, W, H);
        ctx.restore();
      }
      mcText(ctx, P.name, VW / 2, y - 24, 17 * S, "#ffffff");
    },
  },

  {
    id: "mc-crit", name: "Coup Critique MC", cat: "minecraft", dot: "#ff9d3b",
    desc: "Particules de coup critique + dégâts qui volent.",
    params: [
      { k: "damage", type: "number", label: "Dégâts affichés", def: 12, min: 1, max: 999 },
      { k: "crits", type: "range", label: "Nombre de particules", min: 2, max: 16, step: 1, def: 8 },
      { k: "scale", type: "range", label: "Taille", min: 2, max: 7, step: 1, def: 4 },
      { k: "dur", type: "range", label: "Durée (s)", min: 1, max: 4, step: 0.5, def: 2 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, VW, VH); }
      const S = P.scale;
      // crosshair
      const chIn = easeOutExpo(norm(t, 0, 0.3));
      ctx.globalAlpha = chIn;
      mcDraw(ctx, "crosshair", VW / 2 - 15 * S / 2, VH / 2 - 15 * S / 2, 15 * S, 15 * S);
      ctx.globalAlpha = 1;
      // particules de critique
      const burst = easeOutExpo(norm(t, 0.25, 1.4));
      const out = easeInExpo(norm(t, P.dur - 0.35, P.dur));
      for (let i = 0; i < P.crits; i++) {
        const a = (i / P.crits) * TAU + (i % 2) * 0.4;
        const r = 60 * S * burst;
        const wob = Math.sin(t * 9 + i * 2) * 6;
        const px = VW / 2 + Math.cos(a) * r + wob;
        const py = VH / 2 + Math.sin(a) * r * 0.8 + Math.pow(burst, 1.6) * 30 - wob;
        const sz = 8 * S * (0.7 + 0.3 * Math.sin(t * 7 + i)) * (1 - burst * 0.35);
        ctx.globalAlpha = (1 - out) * Math.min(1, burst * 3) * (1 - burst * 0.4);
        mcDraw(ctx, "crit", px - sz / 2, py - sz / 2, sz, sz);
      }
      // dégâts qui montent
      const dT = norm(t, 0.35, P.dur);
      if (dT > 0) {
        const pop = easeOutBack(norm(t, 0.3, 0.55));
        ctx.globalAlpha = 1 - easeInExpo(norm(t, P.dur - 0.7, P.dur));
        mcText(ctx, `-${P.damage}`, VW / 2, VH / 2 - 60 * S * 0.6 - dT * 70, 26 * S * 0.6 * pop, "#ff5252");
      }
      ctx.globalAlpha = 1;
    },
  },


  /* ---------- Succès débloqué (toast) ---------- */
  {
    id: "mc-succes", name: "Succès Débloqué MC", cat: "minecraft", dot: "#ffcf3f",
    desc: "Toast de succès qui glisse depuis la droite.",
    params: [
      { k: "title", type: "text", label: "Titre du succès", def: "Diamants !" },
      { k: "desc", type: "text", label: "Description", def: "Trouver des diamants" },
      { k: "icon", type: "select", label: "Icône", opts: [["diamond","Diamant"],["gapple","Pomme d'or"],["sword","Épée"],["potion","Potion"]], def: "diamond" },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 8, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, VW, VH); }
      const inK = easeOutBack(norm(t, 0.15, 0.7));
      const outK = easeInExpo(norm(t, P.dur - 0.7, P.dur));
      const x = VW - 520 * inK * (1 - outK) + 60 * outK;
      const y = 120;
      // toast
      ctx.fillStyle = "rgba(0,0,0,.72)";
      roundRect(x, y, 460, 96, 8); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2;
      roundRect(x, y, 460, 96, 8); ctx.stroke();
      // icône (item 16px * 4) avec rebond
      const iconPop = easeOutBack(norm(t, 0.3, 0.85));
      ctx.save();
      ctx.translate(x + 48, y + 48);
      ctx.scale(iconPop, iconPop);
      ctx.rotate(Math.sin(t * 4) * 0.08);
      mcDraw(ctx, P.icon, -32, -32, 64, 64);
      ctx.restore();
      mcText(ctx, "Succès débloqué !", x + 96, y + 26, 22, "#ffffff", { a: "left", w: 700 });
      mcText(ctx, P.title, x + 96, y + 52, 20, "#ffcf3f", { a: "left", w: 700 });
      mcText(ctx, P.desc, x + 96, y + 76, 15, "#a0a2c7", { a: "left" });
    },
  },

  /* ---------- You Died ---------- */


  /* ---------- Item enchanté ---------- */

  /* ---------- Fiche d'item ---------- */

  /* ---------- Comparateur d'items ---------- */

  /* ---------- Loot drop ---------- */

  /* ---------- Orbe d'XP ---------- */
  {
    id: "mc-orb", name: "Orbe d'XP MC", cat: "minecraft", dot: "#34e6a8",
    desc: "Orbes d'expérience flottants qui se font attirer.",
    params: [
      { k: "count", type: "range", label: "Nombre d'orbes", min: 1, max: 12, step: 1, def: 6 },
      { k: "value", type: "number", label: "Valeur totale", def: 42, min: 1, max: 999 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 8, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, VW, VH); }
      const cx = VW/2, cy = VH/2;
      // orbes qui volent vers le centre
      for (let i = 0; i < P.count; i++) {
        const seed = (i * 137.5) % 360;
        const startR = 280;
        const a = seed * Math.PI / 180;
        const sx = cx + Math.cos(a) * startR;
        const sy = cy + Math.sin(a) * startR * 0.6;
        const k = easeInExpo(norm(t, 0.3 + i*0.06, 1.5 + i*0.06));
        const x = sx + (cx - sx) * k;
        const y = sy + (cy - sy) * k;
        const size = 14 * (1 - k*0.6);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, size*2.5);
        glow.addColorStop(0, "rgba(128,255,32,.9)"); glow.addColorStop(1, "rgba(128,255,32,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, size*2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#80ff20";
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#c8ff80";
        ctx.beginPath(); ctx.arc(x - size*0.3, y - size*0.3, size*0.4, 0, Math.PI*2); ctx.fill();
      }
      // compteur qui grimpe
      const pk = easeOutExpo(norm(t, 1.2, P.dur));
      mcText(ctx, "+" + Math.round(P.value * pk), cx, cy, 44 * pk, "#80ff20");
    },
  },

  /* ---------- Potion effet ---------- */

  /* ---------- Netherite upgrade ---------- */

  /* ---------- Crafting 2x2 ---------- */

  /* ---------- Bannière MC ---------- */

  /* ---------- Coffre qui s'ouvre ---------- */


  /* ---------- Cube 3D MC ---------- */

  /* ---------- Portail du Nether 3D ---------- */

  /* ---------- Item 3D ---------- */


  /* ---------- Kinetic Lecture ---------- */
  {
    id: "kinetic", name: "Kinetic Lecture", cat: "texte", dot: "#789bff",
    desc: "Texte qui apparaît au rythme d'une voice-over.",
    params: [
      { k: "words", type: "text", label: "Mots (séparés par ,)", def: "CE QUE,PERSONNE,NE DIT,À HAUT VOIX,EN PUBLIC" },
      { k: "color", type: "color", label: "Couleur", def: "#f2f2fb" },
      { k: "dur", type: "range", label: "Durée (s)", min: 6, max: 24, step: 1, def: 18 },
    ],
    draw(ctx, t, P) {
      const words = P.words.split(",").map(s => s.trim()).filter(Boolean);
      const slot = P.dur / words.length;
      const i = Math.floor(t / slot) % words.length;
      const lt = t % slot;
      const pop = easeOutBack(norm(lt, 0, 0.4));
      const out = easeInExpo(norm(lt, slot - 0.4, slot));
      const w = words[i];
      const fs = 90 * fitScale(w, 90, 1080);
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.scale(pop * (1 - 0.15 * out), pop * (1 - 0.15 * out));
      ctx.globalAlpha = pop * (1 - out);
      drawText(w, 0, 0, fs, P.color, { weight: 800 });
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Bulle Cercle ---------- */
  {
    id: "bulle", name: "Bulle Cercle", cat: "texte", dot: "#789bff",
    desc: "Un mot entouré à la main.",
    params: [
      { k: "text", type: "text", label: "Mot", def: "VRAI" },
      { k: "color", type: "color", label: "Couleur du trait", def: "#789bff" },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 8, step: 0.5, def: 3 },
    ],
    draw(ctx, t, P) {
      const pop = easeOutBack(norm(t, 0, 0.5));
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.scale(pop, pop);
      ctx.globalAlpha = pop * (1 - out);
      drawText(P.text, 0, 0, 90, "#f2f2fb");
      const d = easeOutExpo(norm(t, 0.4, 1.3)) * TAU;
      ctx.strokeStyle = P.color; ctx.lineWidth = 8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.ellipse(0, 0, 150, 90, -0.14, -Math.PI / 2, -Math.PI / 2 + d); ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Mot Punch ---------- */
  {
    id: "mot-punch", name: "Mot Punch", cat: "texte", dot: "#ff4d6d",
    desc: "Impact + zoom caméra sur un mot.",
    params: [
      { k: "text", type: "text", label: "Mot", def: "BOOM" },
      { k: "color", type: "color", label: "Couleur", def: "#ff4d6d" },
      { k: "dur", type: "range", label: "Durée (s)", min: 1, max: 4, step: 0.5, def: 2 },
    ],
    draw(ctx, t, P) {
      const zoom = easeInExpo(norm(t, 0, 0.2));
      const settle = easeOutExpo(norm(t, 0.2, 0.9));
      const s = 1 + 2.6 * zoom * (1 - settle);
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.scale(s * (1 - 0.2 * out), s * (1 - 0.2 * out));
      drawText(P.text, 8, 8, 100, "rgba(0,0,0,.4)");
      drawText(P.text, 0, 0, 100, P.color);
      ctx.restore();
      // traits d'impact
      const sp = norm(t, 0.05, 0.5);
      if (sp > 0 && sp < 1) {
        ctx.globalAlpha = (1 - sp) * 0.9;
        ctx.strokeStyle = P.color; ctx.lineWidth = 6; ctx.lineCap = "round";
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + 0.3;
          const r1 = 140 + 120 * sp, r2 = r1 + 40;
          ctx.beginPath();
          ctx.moveTo(VW/2 + Math.cos(a) * r1, VH/2 + Math.sin(a) * r1 * 0.72);
          ctx.lineTo(VW/2 + Math.cos(a) * r2, VH/2 + Math.sin(a) * r2 * 0.72);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    },
  },

  /* ---------- Étincelles ---------- */
  {
    id: "etincelles", name: "Étincelles", cat: "element", dot: "#ffcf3f",
    desc: "Étincelles scintillantes autour d'un mot.",
    params: [
      { k: "text", type: "text", label: "Mot", def: "MAGIQUE" },
      { k: "color", type: "color", label: "Couleur", def: "#ffcf3f" },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 8, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      const pop = easeOutBack(norm(t, 0, 0.5));
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      drawText(P.text, VW / 2, VH / 2, 80 * pop * (1 - out), "#f2f2fb", { alpha: pop * (1 - out) });
      ctx.strokeStyle = P.color; ctx.lineCap = "round";
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.4;
        const tw = Math.max(0, Math.sin(t * 7 + i * 2.2));
        const r1 = (130 + 20 * Math.sin(t * 3 + i)) , r2 = r1 + 22 * tw;
        ctx.globalAlpha = tw * 0.9 * pop * (1 - out); ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(VW/2 + Math.cos(a) * r1, VH/2 + Math.sin(a) * r1 * 0.8);
        ctx.lineTo(VW/2 + Math.cos(a) * r2, VH/2 + Math.sin(a) * r2 * 0.8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Scan Lumineux ---------- */

  /* ---------- Nuit VHS ---------- */

  /* ---------- Glissement Flou ---------- */

  /* ---------- Flash Blanc ---------- */
  {
    id: "flash", name: "Flash Blanc", cat: "transition", dot: "#f2f2fb",
    desc: "Flash à l'impact.",
    params: [
      { k: "text", type: "text", label: "Texte", def: "IMPACT" },
      { k: "dur", type: "range", label: "Durée (s)", min: 0.5, max: 3, step: 0.5, def: 1 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#1a1a22"; ctx.fillRect(0, 0, VW, VH); }
      const f = Math.max(0, 1 - t / 0.35);
      if (f > 0) { ctx.globalAlpha = f; if (bgMode === "dark") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, VW, VH); } ctx.globalAlpha = 1; }
      const pop = easeOutBack(norm(t, 0.2, 0.6));
      drawText(P.text, VW / 2, VH / 2, 74 * pop, "#f2f2fb", { alpha: pop * Math.max(0, 1 - t / 0.95) });
    },
  },

  /* ---------- Fondu Chroma ---------- */
  {
    id: "fond-chroma", name: "Fondu Chroma", cat: "transition", dot: "#789bff",
    desc: "Fondu avec aberration chromatique.",
    params: [
      { k: "text", type: "text", label: "Texte", def: "APRÈS" },
      { k: "color", type: "color", label: "Couleur", def: "#789bff" },
      { k: "dur", type: "range", label: "Durée (s)", min: 1, max: 4, step: 0.5, def: 2 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#231033"; ctx.fillRect(0, 0, VW, VH); }
      const a = norm(t, 0, 1), b = norm(t, 1, 2);
      const s1 = 1 - easeInOutCubic(a), s2 = easeOutBack(norm(b, 0.15, 0.8));
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      drawText("AVANT", 0, 0, 70, "#789bff", { alpha: s1 * 0.9 });
      ctx.save();
      ctx.scale(Math.max(0.001, s2), Math.max(0.001, s2));
      drawText(P.text, -5, 0, 78, "#ff4d6d", { alpha: 0.55 });
      drawText(P.text, 5, 0, 78, "#789bff", { alpha: 0.55 });
      drawText(P.text, 0, 0, 78, "#f2f2fb");
      ctx.restore();
      ctx.restore();
    },
  },

  /* ---------- Cloche Notif ---------- */
  {
    id: "cloche", name: "Cloche Notif", cat: "social", dot: "#ffcf3f",
    desc: "Cloche de notification qui sonne, avec ondes et badge.",
    params: [
      { k: "text", type: "text", label: "Texte (optionnel)", def: "Nouvelle notif" },
      { k: "color", type: "color", label: "Couleur", def: "#ffcf3f" },
      { k: "count", type: "number", label: "Badge (nombre)", def: 3, min: 0, max: 99 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 6, step: 0.5, def: 3 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, VW, VH); }
      const out = easeInExpo(norm(t, P.dur - 0.4, P.dur));
      // oscillation qui s'amortit
      const ring = t < 2.2 ? Math.sin(t * 14) * Math.max(0, 1 - t / 1.6) : 0;
      const swing = ring * 0.22;
      // ondes sonores
      const r2 = norm(t % 0.9, 0, 0.9);
      ctx.globalAlpha = (1 - r2) * 0.55 * (1 - out);
      ctx.strokeStyle = P.color; ctx.lineWidth = 4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(VW / 2, VH / 2 - 20, (80 + 50 * r2), side > 0 ? -1.1 : Math.PI + 1.4, side > 0 ? -0.3 : Math.PI - 0.3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // cloche
      ctx.save();
      ctx.translate(VW / 2, VH / 2 - 10);
      ctx.rotate(swing);
      // ombre portée
      ctx.globalAlpha = 0.3 * (1 - out);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(0, 70, 60, 12, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1 - out;
      // dôme
      const g = ctx.createLinearGradient(-50, -60, 50, 40);
      g.addColorStop(0, shadeColor(P.color, 40)); g.addColorStop(1, P.color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-56, 50); ctx.quadraticCurveTo(-56, -46, 0, -58); ctx.quadraticCurveTo(56, -46, 56, 50); ctx.closePath(); ctx.fill();
      // bande
      ctx.fillStyle = shadeColor(P.color, -20);
      roundRect(-64, 50, 128, 14, 6); ctx.fill();
      // battant
      ctx.fillStyle = shadeColor(P.color, -50);
      ctx.beginPath(); ctx.arc(0, 72, 12 * (1 + 0.3 * Math.abs(ring)), 0, TAU); ctx.fill();
      ctx.restore();
      // badge (nombre)
      if (P.count > 0) {
        const bPop = easeOutBack(norm(t, 0.3, 0.75));
        ctx.save();
        ctx.translate(VW / 2 + 52, VH / 2 - 62);
        ctx.scale(bPop, bPop);
        ctx.fillStyle = "#ff4d6d";
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill();
        drawText(String(P.count), 0, 1, 16, "#ffffff", { weight: 700 });
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (P.text) drawText(P.text, VW / 2, VH / 2 + 130, 28, "#f2f2fb", { alpha: 1 - out });
    },
  },


  /* ---------- Like Pop ---------- */
  {
    id: "like-pop", name: "Like Pop", cat: "social", dot: "#ff4d6d",
    desc: "Cœur qui explose + compteur.",
    params: [
      { k: "color", type: "color", label: "Couleur", def: "#ff4d6d" },
      { k: "count", type: "number", label: "Nombre de likes", def: 1248, min: 0, max: 999999 },
      { k: "dur", type: "range", label: "Durée (s)", min: 1, max: 4, step: 0.5, def: 2 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#260d18"; ctx.fillRect(0, 0, VW, VH); }
      const pop = easeOutBack(norm(t, 0, 0.6));
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      const s = pop * (1 + 0.12 * Math.sin(t * 10)) * (1 - out);
      ctx.save();
      ctx.translate(VW / 2, VH / 2 - 10);
      ctx.scale(s, s);
      ctx.fillStyle = P.color; ctx.shadowColor = P.color; ctx.shadowBlur = 36;
      const r = 28;
      ctx.beginPath();
      ctx.moveTo(0, 22); ctx.bezierCurveTo(-52, -10, -28, -48, 0, -20); ctx.bezierCurveTo(28, -48, 52, -10, 0, 22);
      ctx.fill();
      ctx.restore();
      const pk = norm(t, 0.2, 0.7);
      drawText("+" + Math.round(P.count * pk).toLocaleString("fr-FR"), VW / 2 + 70, VH / 2 - 50 - 30 * pk, 36, "#f2f2fb", { alpha: 1 - norm(t, 0.5, 1) });
      drawText(P.count.toLocaleString("fr-FR"), VW / 2, VH / 2 + 60, 28, "#a0a2c7", { weight: 700, family: '"Inter", Arial, sans-serif' });
    },
  },

  /* ---------- Emoji Rain ---------- */
  {
    id: "emoji-rain", name: "Emoji Rain", cat: "overlay", dot: "#ffcf3f",
    desc: "Pluie d'emojis réaction.",
    params: [
      { k: "dur", type: "range", label: "Durée (s)", min: 3, max: 8, step: 0.5, def: 5 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#1c1c10"; ctx.fillRect(0, 0, VW, VH); }
      const em = ["🔥", "😂", "❤️", "😮", "👏", "💯", "🎉"];
      ctx.font = '900 36px "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let i = 0; i < 18; i++) {
        const seed = Math.sin(i * 91.7) * 43758.5;
        const x = (seed - Math.floor(seed)) * VW;
        const sp = 0.35 + (Math.sin(i * 33.3) * 0.5 + 0.5) * 0.3;
        const y = ((t * sp + (seed - Math.floor(seed))) % 1.15 - 0.1) * VH;
        ctx.globalAlpha = Math.min(1, Math.max(0, 1.1 - Math.abs(y / VH - 0.5) * 1.4));
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + i) * 0.3);
        ctx.fillText(em[i % em.length], 0, 0); ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Étiquette Prix ---------- */
  {
    id: "etiquette", name: "Étiquette Prix", cat: "element", dot: "#34e6a8",
    desc: "Tag prix qui rebondit.",
    params: [
      { k: "text", type: "text", label: "Libellé", def: "PROMO" },
      { k: "price", type: "text", label: "Prix", def: "9,99 €" },
      { k: "color", type: "color", label: "Couleur", def: "#ffcf3f" },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 6, step: 0.5, def: 3 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#1e2a10"; ctx.fillRect(0, 0, VW, VH); }
      const b = easeOutBack(norm(t, 0.2, 0.9));
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.rotate((1 - b) * -0.5 + Math.sin(t * 2.4) * 0.02);
      ctx.scale(b, b);
      ctx.globalAlpha = 1 - out;
      ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-140, 0); ctx.lineTo(-190, -36); ctx.stroke();
      ctx.fillStyle = P.color;
      roundRect(-136, -50, 272, 100, 16); ctx.fill();
      ctx.fillStyle = "#141414";
      ctx.beginPath(); ctx.arc(136, 0, 10, 0, TAU); ctx.fill();
      drawText(P.text, -10, -12, 24, "#141414");
      drawText(P.price, -10, 24, 34, "#141414", { weight: 800 });
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Pièce Dollar ---------- */
  {
    id: "piece", name: "Pièce Dollar", cat: "element", dot: "#ffcf3f",
    desc: "Pièce $ qui tourne et rebondit.",
    params: [
      { k: "symbol", type: "text", label: "Symbole", def: "$" },
      { k: "color", type: "color", label: "Couleur", def: "#ffcf3f" },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 6, step: 0.5, def: 3 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#241c06"; ctx.fillRect(0, 0, VW, VH); }
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      const spin = t * 5.2;
      const sx = Math.abs(Math.cos(spin)) * 0.85 + 0.15;
      const bounce = Math.abs(Math.sin(t * 2.6)) * 22 * (1 - norm(t, 2.2, P.dur));
      ctx.save();
      ctx.translate(VW / 2, VH / 2 - bounce);
      ctx.scale(sx, 1);
      ctx.globalAlpha = 1 - out;
      ctx.fillStyle = P.color; ctx.shadowColor = P.color; ctx.shadowBlur = 30 * sx;
      ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = shadeColor(P.color, -40);
      ctx.beginPath(); ctx.arc(0, 0, 56, 0, TAU); ctx.fill();
      drawText(P.symbol, 0, 3, 66 * Math.max(0.3, sx), P.color, { alpha: Math.min(1, sx * 1.6) });
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Décompte ---------- */
  {
    id: "decompte", name: "Décompte", cat: "texte", dot: "#873bff",
    desc: "3, 2, 1… GO avec anneau de progression.",
    params: [
      { k: "from", type: "number", label: "Partir de", def: 3, min: 2, max: 10 },
      { k: "color", type: "color", label: "Couleur du GO", def: "#873bff" },
      { k: "dur", type: "range", label: "Durée (s)", min: 3, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#140b28"; ctx.fillRect(0, 0, VW, VH); }
      const isGo = t >= P.dur - 0.8;
      const out = easeInExpo(norm(t, P.dur - 0.25, P.dur));
      if (!isGo) {
        const nSec = Math.max(1, Math.min(P.from, Math.floor(P.dur - 0.8)));
        const idx = Math.min(nSec, Math.floor(t));
        const remain = nSec - idx;
        const ph = t % 1;
        const pop = easeOutBack(norm(ph, 0, 0.3));
        const fade = easeInExpo(norm(ph, 0.75, 1));
        ctx.save();
        ctx.translate(VW / 2, VH / 2);
        ctx.globalAlpha = 1 - out;
        ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 10; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.stroke();
        ctx.strokeStyle = P.color;
        ctx.beginPath(); ctx.arc(0, 0, 150, -Math.PI / 2, -Math.PI / 2 + (1 - ph) * TAU); ctx.stroke();
        const sc = pop * (1 - 0.2 * fade);
        ctx.scale(sc, sc);
        drawText(String(remain), 0, 6, 190, "#f2f2fb", { alpha: 1 - fade });
        ctx.restore();
      } else {
        const gp = norm(t, P.dur - 0.8, P.dur - 0.5);
        const s = easeOutBack(gp) * (1 + 0.05 * Math.sin((t - P.dur + 0.8) * 30) * (1 - gp));
        ctx.save();
        ctx.translate(VW / 2, VH / 2);
        ctx.scale(s, s);
        ctx.globalAlpha = 1 - out;
        drawText("GO !", 10, 8, 210, "rgba(0,0,0,.35)", { alpha: 0.9 });
        drawText("GO !", 0, 0, 210, P.color);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Machine à Écrire ---------- */
  {
    id: "typewriter", name: "Machine à Écrire", cat: "texte", dot: "#f2f2fb",
    desc: "Texte tapé lettre par lettre avec curseur.",
    params: [
      { k: "text", type: "text", label: "Texte", def: "ENFIN DISPONIBLE" },
      { k: "color", type: "color", label: "Couleur du texte", def: "#f2f2fb" },
      { k: "cursor", type: "color", label: "Couleur du curseur", def: "#873bff" },
      { k: "dur", type: "range", label: "Durée (s)", min: 3, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0d0d16"; ctx.fillRect(0, 0, VW, VH); }
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      const p = norm(t, 0.3, P.dur - 1.1);
      const n = Math.floor(p * P.text.length);
      const shown = P.text.slice(0, n);
      ctx.globalAlpha = 1 - out;
      setFont(64, "700", '"Consolas", "Courier New", monospace');
      const wFull = ctx.measureText(P.text).width;
      const fs = Math.min(64, 64 * (VW * 0.8) / Math.max(1, wFull));
      setFont(fs, "700", '"Consolas", "Courier New", monospace');
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const full = ctx.measureText(P.text).width;
      const x = VW / 2 - full / 2, y = VH / 2;
      ctx.fillStyle = P.color;
      ctx.fillText(shown, x, y);
      const cw = ctx.measureText(shown).width;
      if ((t * 2.6) % 1 < 0.55) {
        ctx.fillStyle = P.cursor;
        ctx.fillRect(x + cw + 6, y - fs * 0.55, fs * 0.55, fs * 1.1);
      }
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Glitch Texte ---------- */
  {
    id: "glitch", name: "Glitch Texte", cat: "texte", dot: "#ff4d6d",
    desc: "Bugs RGB et tranches déplacées.",
    params: [
      { k: "text", type: "text", label: "Texte", def: "SIGNAL PERDU" },
      { k: "color", type: "color", label: "Couleur", def: "#f2f2fb" },
      { k: "size", type: "range", label: "Taille", min: 60, max: 160, step: 2, def: 110 },
      { k: "intensity", type: "range", label: "Intensité", min: 0, max: 30, step: 1, def: 14 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 8, step: 0.5, def: 3 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0b0b16"; ctx.fillRect(0, 0, VW, VH); }
      const out = easeInExpo(norm(t, P.dur - 0.25, P.dur));
      const inP = easeOutBack(norm(t, 0, 0.4));
      const fs = P.size * fitScale(P.text, P.size, VW * 0.85);
      const burst = Math.max(0, Math.sin(t * 9.3) * Math.sin(t * 13.7));
      const g = Math.pow(burst, 3) * (P.intensity / 14);
      const jx = Math.sin(t * 61) * Math.sin(t * 47) * P.intensity * g;
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.scale(inP, inP);
      ctx.globalAlpha = 1 - out;
      setFont(fs);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (g > 0.02) {
        const slices = 6;
        for (let i = 0; i < slices; i++) {
          const seed = Math.sin(i * 127.1 + Math.floor(t * 18) * 311.7) * 43758.55;
          const rnd = seed - Math.floor(seed);
          if (rnd < 0.55) continue;
          const sy = -fs / 2 + (i / slices) * fs;
          const sh = fs / slices + 2;
          const dx = (rnd - 0.5) * 2 * P.intensity * g;
          ctx.save();
          ctx.beginPath(); ctx.rect(-VW, sy, VW * 2, sh); ctx.clip();
          ctx.fillStyle = P.color;
          ctx.fillText(P.text, dx, 0);
          ctx.restore();
        }
      }
      ctx.globalAlpha = (1 - out) * 0.85;
      ctx.fillStyle = "#ff4d6d"; ctx.fillText(P.text, jx - 6 * g - 4, 0);
      ctx.fillStyle = "#789bff"; ctx.fillText(P.text, -jx + 6 * g + 4, 0);
      ctx.globalAlpha = 1 - out;
      ctx.fillStyle = P.color; ctx.fillText(P.text, jx * 0.3, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Néon Flicker ---------- */
  {
    id: "neon", name: "Néon Flicker", cat: "texte", dot: "#789bff",
    desc: "Enseigne néon qui scintille.",
    params: [
      { k: "text", type: "text", label: "Texte", def: "OPEN" },
      { k: "color", type: "color", label: "Couleur néon", def: "#789bff" },
      { k: "dur", type: "range", label: "Durée (s)", min: 3, max: 10, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#090a18"; ctx.fillRect(0, 0, VW, VH); }
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      const warm = easeOutExpo(norm(t, 0, 0.6));
      const n1 = Math.sin(t * 23.7) * Math.sin(t * 9.1 + 2);
      const flick = n1 > 0.965 ? 0.15 : (n1 > 0.9 ? 0.55 : 1);
      const glow = warm * flick * (1 - out);
      const fs = 150 * fitScale(P.text, 150, VW * 0.66);
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.globalAlpha = 1 - out;
      ctx.strokeStyle = "rgba(255,255,255," + (0.14 * glow) + ")";
      ctx.lineWidth = 5; ctx.lineJoin = "round";
      roundRect(-VW * 0.36, -150, VW * 0.72, 300, 40); ctx.stroke();
      setFont(fs);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = P.color; ctx.shadowBlur = 60 * glow;
      ctx.lineWidth = 2; ctx.strokeStyle = P.color;
      ctx.strokeText(P.text, 0, 0);
      ctx.strokeText(P.text, 0, 0);
      ctx.shadowBlur = 24 * glow;
      ctx.globalAlpha = glow;
      ctx.fillStyle = shadeColor(P.color, Math.round(150 * glow));
      ctx.fillText(P.text, 0, 0);
      ctx.restore();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    },
  },

  /* ---------- Confettis ---------- */
  {
    id: "confettis", name: "Confettis", cat: "social", dot: "#34e6a8",
    desc: "Explosion de confettis en éventail.",
    params: [
      { k: "count", type: "number", label: "Nombre", def: 90, min: 20, max: 200 },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 8, step: 0.5, def: 4 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#141024"; ctx.fillRect(0, 0, VW, VH); }
      const out = 1 - easeInExpo(norm(t, P.dur - 0.4, P.dur));
      const pal = ["#873bff", "#789bff", "#ff4d6d", "#ffcf3f", "#34e6a8", "#f2f2fb"];
      const T = t;
      for (let i = 0; i < P.count; i++) {
        const s1 = Math.sin(i * 91.7) * 43758.5, s2 = Math.sin(i * 33.3) * 24634.6, s3 = Math.sin(i * 57.7) * 12345.7;
        const r1 = s1 - Math.floor(s1), r2 = s2 - Math.floor(s2), r3 = s3 - Math.floor(s3);
        const a = (r1 - 0.5) * Math.PI * 0.9 - Math.PI / 2;
        const v = 350 + r2 * 400;
        const vx = Math.cos(a) * v * 0.55;
        const vy = Math.sin(a) * v * 0.8;
        const G = 520;
        const x = VW / 2 + vx * T;
        const y = VH * 0.72 + vy * T + 0.5 * G * T * T;
        if (y < -30 || y > VH + 30 || x < -30 || x > VW + 30) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(r3 * TAU + T * (4 + r1 * 6));
        ctx.scale(1, Math.abs(Math.sin(T * 5 + i)) * 0.7 + 0.3);
        ctx.globalAlpha = out;
        ctx.fillStyle = pal[i % pal.length];
        ctx.fillRect(-(5 + r2 * 6) / 2, -(9 + r3 * 8) / 2, 5 + r2 * 6, 9 + r3 * 8);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Onde Sonore ---------- */
  {
    id: "onde", name: "Onde Sonore", cat: "element", dot: "#789bff",
    desc: "Barres audio façon égaliseur.",
    params: [
      { k: "bars", type: "number", label: "Barres", def: 36, min: 10, max: 60 },
      { k: "color", type: "color", label: "Couleur", def: "#789bff" },
      { k: "dur", type: "range", label: "Durée (s)", min: 3, max: 10, step: 0.5, def: 5 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#0d0d18"; ctx.fillRect(0, 0, VW, VH); }
      const inP = easeOutExpo(norm(t, 0, 0.5));
      const out = 1 - easeInExpo(norm(t, P.dur - 0.4, P.dur));
      const n = Math.round(P.bars);
      const gap = 6;
      const bw = Math.min(18, (VW * 0.72 - gap * (n - 1)) / n);
      const totalW = bw * n + gap * (n - 1);
      const x0 = VW / 2 - totalW / 2, cy = VH / 2;
      ctx.globalAlpha = inP * out;
      for (let i = 0; i < n; i++) {
        const ph = i * 0.55;
        const hRaw =
          0.30 + 0.24 * Math.sin(t * 7.1 + ph) +
          0.18 * Math.sin(t * 11.3 + ph * 1.7) +
          0.16 * Math.sin(t * 4.7 + ph * 0.6) +
          0.12 * Math.sin(t * 17.9 + i);
        const env = Math.pow(Math.sin(Math.PI * (i + 0.5) / n), 0.6);
        const h = clamp(hRaw, 0.06, 1) * 230 * env;
        ctx.fillStyle = P.color;
        const x = x0 + i * (bw + gap);
        roundRect(x, cy - h / 2, bw, h, Math.min(bw / 2, 4)); ctx.fill();
      }
      ctx.globalAlpha = inP * out * 0.25;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x0 - 14, cy - 1, totalW + 28, 2);
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Sticker Pop ---------- */
  {
    id: "sticker", name: "Sticker Pop", cat: "element", dot: "#ffcf3f",
    desc: "Autocollant qui pop avec rebond.",
    params: [
      { k: "text", type: "text", label: "Texte", def: "TOP !" },
      { k: "color", type: "color", label: "Couleur", def: "#ffcf3f" },
      { k: "dur", type: "range", label: "Durée (s)", min: 2, max: 6, step: 0.5, def: 3 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#181028"; ctx.fillRect(0, 0, VW, VH); }
      const pop = easeOutBack(norm(t, 0.15, 0.7));
      const out = easeInExpo(norm(t, P.dur - 0.3, P.dur));
      const wob = Math.sin(t * 3.1) * 0.035;
      ctx.save();
      ctx.translate(VW / 2, VH / 2);
      ctx.rotate(-0.14 + wob);
      ctx.scale(pop, pop * (2 - pop));
      ctx.globalAlpha = 1 - out;
      ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
      ctx.fillStyle = "#ffffff";
      roundRect(-190, -110, 380, 220, 30); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = P.color;
      roundRect(-170, -90, 340, 180, 20); ctx.fill();
      const fs = 84 * fitScale(P.text, 84, 300);
      drawText(P.text, 0, 4, fs, "#ffffff");
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

  /* ---------- Bandeau Défilant ---------- */
  {
    id: "marquee", name: "Bandeau Défilant", cat: "social", dot: "#873bff",
    desc: "Texte défilant en continu.",
    params: [
      { k: "text", type: "text", label: "Texte", def: "NOUVELLE VIDÉO • ABONNE-TOI • " },
      { k: "color", type: "color", label: "Couleur du bandeau", def: "#873bff" },
      { k: "speed", type: "range", label: "Vitesse", min: 40, max: 300, step: 10, def: 140 },
      { k: "dur", type: "range", label: "Durée (s)", min: 3, max: 12, step: 0.5, def: 6 },
    ],
    draw(ctx, t, P) {
      if (bgMode === "dark") { ctx.fillStyle = "#101018"; ctx.fillRect(0, 0, VW, VH); }
      const inP = easeOutExpo(norm(t, 0, 0.4));
      const out = 1 - easeInExpo(norm(t, P.dur - 0.4, P.dur));
      const bh = 96, cy = VH / 2;
      ctx.save();
      ctx.globalAlpha = inP * out;
      ctx.translate(VW / 2, cy);
      ctx.rotate(-0.045);
      ctx.fillStyle = P.color;
      ctx.fillRect(-VW * 0.65, -bh / 2, VW * 1.3, bh);
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.fillRect(-VW * 0.65, bh / 2, VW * 1.3, 10);
      setFont(44);
      const tw = Math.max(1, ctx.measureText(P.text).width);
      const off = (t * P.speed) % tw;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      for (let x = -VW * 0.65 - off; x < VW * 0.65; x += tw) {
        ctx.fillText(P.text, x, 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  },

];



/* ---------- État du studio ---------- */
let currentPreset = PRESETS[0];
let P = {};                 // valeurs des paramètres
let playing = true;
let t0 = performance.now();
let tCur = 0;
let exporting = false;

const $ = id => document.getElementById(id);

/* ---------- Paramètres par défaut + lecture ?preset= de l'URL ---------- */
function applyPreset(preset) {
  currentPreset = preset;
  P = {};
  preset.params.forEach(p => { P[p.k] = p.def; });
  const wanted = new URLSearchParams(location.search).get("preset");
  if (wanted && preset.id !== wanted && PRESETS.some(x => x.id === wanted)) {
    const target = PRESETS.find(x => x.id === wanted);
    if (target !== preset) { markActive(target.id); return applyPreset(target); }
  }
  markActive(preset.id);
  $("stageTitle").textContent = preset.name;
  $("stageMeta").textContent = preset.desc;
  buildControls();
}

function markActive(id) {
  document.querySelectorAll(".preset-item").forEach(b => b.classList.toggle("active", b.dataset.id === id));
}

/* ---------- Liste des presets ---------- */
function renderPresetList(filter = "", cat = "all") {
  const list = $("presetList");
  const items = PRESETS.filter(p =>
    (cat === "all" || p.cat === cat) &&
    (!filter || (p.name + " " + p.desc + " " + p.cat).toLowerCase().includes(filter.toLowerCase()))
  );
  list.innerHTML = items.map(p => `
    <button class="preset-item${p === currentPreset ? " active" : ""}" data-id="${p.id}">
      <span class="preset-dot" style="background:${p.dot}; color:${p.dot}"></span>
      <span><b>${p.name}</b><small>${P_duration(p)} · ${p.desc}</small></span>
    </button>
  `).join("") || '<p style="color:var(--muted); font-size:13px; padding:10px;">Aucun preset trouvé.</p>';
}
function P_duration(p) { const d = p.params.find(x => x.k === "dur"); return d ? d.def + " s" : ""; }

$("presetList").addEventListener("click", e => {
  const btn = e.target.closest(".preset-item");
  if (btn) { tCur = 0; t0 = performance.now(); applyPreset(PRESETS.find(p => p.id === btn.dataset.id)); }
});
$("presetSearch").addEventListener("input", e => renderPresetList(e.target.value, activeCat));
let activeCat = "all";
$("sChips").addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll("#sChips .chip").forEach(c => c.classList.toggle("active", c === chip));
  activeCat = chip.dataset.cat;
  renderPresetList($("presetSearch").value, activeCat);
});

/* ---------- Panneau de réglages ---------- */
function buildControls() {
  const box = $("controls");
  box.innerHTML = currentPreset.params.map(p => {
    const v = P[p.k];
    if (p.type === "text") return `
      <div class="ctrl"><label>${p.label}</label>
      <input type="text" data-k="${p.k}" value="${escapeHtml(v)}"></div>`;
    if (p.type === "color") return `
      <div class="ctrl"><label>${p.label}</label>
      <input type="color" data-k="${p.k}" value="${v}"></div>`;
    if (p.type === "range") return `
      <div class="ctrl"><label>${p.label} <span class="val">${v}</span></label>
      <input type="range" data-k="${p.k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}"></div>`;
    if (p.type === "number") return `
      <div class="ctrl"><label>${p.label}</label>
      <input type="number" data-k="${p.k}" value="${v}" min="${p.min ?? 0}" max="${p.max ?? 1e9}"></div>`;
    if (p.type === "select") return `
      <div class="ctrl"><label>${p.label}</label>
      <select data-k="${p.k}">${p.opts.map(o => `<option value="${o[0]}"${v === o[0] ? " selected" : ""}>${o[1]}</option>`).join("")}</select></div>`;
    return "";
  }).join("") + `
    <div class="ctrl-sep"></div>
    <p class="ctrl-note">🖼️ Fond configurable pour l'export : utilise « Vert » pour incruster la vidéo sur n'importe quel fond dans ton logiciel de montage.</p>
    <div class="ctrl"><label>Fond</label>
    <select id="bgSelect">
      <option value="dark" selected>Sombre (par défaut)</option>
      <option value="black">Noir</option>
      <option value="white">Blanc</option>
      <option value="green">Vert (chroma key)</option>
    </select></div>`;

  box.querySelectorAll("[data-k]").forEach(inp => {
    inp.addEventListener("input", () => {
      const k = inp.dataset.k;
      const def = currentPreset.params.find(p => p.k === k);
      P[k] = def.type === "number" || def.type === "range" ? parseFloat(inp.value) || 0 : inp.value;
      if (def.type === "range") {
        const lab = inp.closest(".ctrl").querySelector(".val");
        if (lab) lab.textContent = inp.value;
        inp.style.setProperty("--fill", ((inp.value - def.min) / (def.max - def.min) * 100) + "%");
      }
    });
    if (inp.type === "range") {
      inp.style.setProperty("--fill", ((inp.value - inp.min) / (inp.max - inp.min) * 100) + "%");
    }
  });
  $("bgSelect").value = bgMode;
  $("bgSelect").addEventListener("change", e => { bgMode = e.target.value; });
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

$("resetBtn").addEventListener("click", () => {
  currentPreset.params.forEach(p => { P[p.k] = p.def; });
  buildControls();
});

/* ---------- Fond de scène ---------- */
let bgMode = "dark";
function renderBackground(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (bgMode === "black") { ctx.fillStyle = "#000000"; }
  else if (bgMode === "white") { ctx.fillStyle = "#ffffff"; }
  else if (bgMode === "green") { ctx.fillStyle = "#00b140"; }
  else {
    ctx.fillStyle = "#0f0f12";
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (bgMode === "dark") {
    const blobs = [
      { c: "rgba(124,92,255,.20)", r: 520, k: 1, ph: 0.0, cx: 0.2, cy: 0.3 },
      { c: "rgba(255,59,78,.14)", r: 460, k: 1, ph: 0.45, cx: 0.8, cy: 0.7 },
      { c: "rgba(53,214,255,.10)", r: 380, k: 2, ph: 0.2, cx: 0.7, cy: 0.2 },
    ];
    const s = canvas.width / VW;
    for (const b of blobs) {
      const ang = (t / P.dur) * TAU * b.k + b.ph * TAU;
      const x = (VW * b.cx + Math.cos(ang) * 130) * s;
      const y = (VH * b.cy + Math.sin(ang) * 90) * s;
      const g = ctx.createRadialGradient(x, y, 0, x, y, b.r * s);
      g.addColorStop(0, b.c); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
}

/* ---------- Rendu ---------- */
function render(t) {
  t = clamp(t, 0, P.dur - 0.001);
  renderBackground(t);
  ctx.save();
  ctx.scale(canvas.width / VW, canvas.height / VH);
  currentPreset.draw(ctx, t, P);
  ctx.restore();
}

/* ---------- Boucle ---------- */
function loop(now) {
  if (playing && !exporting) {
    tCur = ((now - t0) / 1000) % P.dur;
  }
  render(tCur);
  $("phFill").style.width = (tCur / P.dur * 100) + "%";
  $("phTime").textContent = `${tCur.toFixed(1)} / ${P.dur.toFixed(1)} s`;
  requestAnimationFrame(loop);
}

$("playBtn").addEventListener("click", () => {
  if (playing) { playing = false; $("playBtn").textContent = "▶ Lecture"; }
  else { playing = true; t0 = performance.now() - tCur * 1000; $("playBtn").textContent = "⏸ Pause"; }
});

/* ---------- Choix résolution ---------- */
$("resSelect").addEventListener("change", e => {
  const r = RESOLUTIONS[e.target.value];
  canvas.width = r.w; canvas.height = r.h;
  $("stageRes").textContent = `${r.w}×${r.h} · ${r.fps} fps`;
});

/* ---------- Export MP4 ---------- */
async function pickCodec(w, h, fps, bitrate) {
  const list = ["avc1.640034", "avc1.640033", "avc1.640042", "avc1.4D0042", "avc1.4D0028", "avc1.42E01E"];
  for (const codec of list) {
    try {
      const s = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate, framerate: fps });
      if (s.supported) return codec;
    } catch (e) { /* suivant */ }
  }
  throw new Error("Aucun codec H.264 supporté pour cette résolution.");
}

const statusEl = $("status");
function setStatus(msg, cls = "") { statusEl.textContent = msg; statusEl.className = "stage-status " + cls; }

async function exportCurrent() {
  if (exporting) return;
  // Condition d'accès : compte Discord relié (quand l'app Discord est configurée)
  if (window.MLAuth && MLAuth.configured() && !MLAuth.user()) {
    setStatus("🔐 Connecte ton Discord pour exporter (bouton en haut à droite).", "error");
    return;
  }
  if (!("VideoEncoder" in window)) { setStatus("WebCodecs non disponible — utilise Chrome ou Edge.", "error"); return; }
  exporting = true;
  playing = false;
  $("playBtn").textContent = "▶ Lecture";
  $("exportBtn").disabled = true;
  setStatus("Préparation de l'export…");

  try {
    const r = RESOLUTIONS[$("resSelect").value];
    const frames = Math.round(P.dur * r.fps);
    const prevW = canvas.width, prevH = canvas.height;
    canvas.width = r.w; canvas.height = r.h;
    const codec = await pickCodec(r.w, r.h, r.fps, r.bitrate);
    const { Muxer, ArrayBufferTarget } = Mp4Muxer;
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width: r.w, height: r.h },
      fastStart: "in-memory",
    });
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: e => { throw e; },
    });
    encoder.configure({
      codec, width: r.w, height: r.h, bitrate: r.bitrate,
      framerate: r.fps, latencyMode: "quality",
    });

    const frameDur = Math.round(1e6 / r.fps);
    for (let i = 0; i < frames; i++) {
      render(i / r.fps);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / r.fps), duration: frameDur });
      encoder.encode(frame, { keyFrame: i % (r.fps * 2) === 0 });
      frame.close();
      if (encoder.encodeQueueSize > 8) await new Promise(res => setTimeout(res, 0));
      if (i % 20 === 0) {
        setStatus(`Exportation… ${Math.round(i / frames * 100)} % (${i}/${frames} images)`);
        await new Promise(res => setTimeout(res, 0));
      }
    }

    setStatus("Finalisation du fichier…");
    await encoder.flush();
    muxer.finalize();

    const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
    const base = currentPreset.id;
    const PART = 4 * 1024 * 1024;
    if (window.__EXPORT_MODE === "capture") {
      const n = Math.ceil(blob.size / PART);
      for (let k = 0; k < n; k++) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob.slice(k * PART, (k + 1) * PART));
        a.download = `${base}.part${k + 1}of${n}`;
        a.click();
        await new Promise(res => setTimeout(res, 800));
      }
      setStatus(`✅ Terminé — ${n} partie(s), ${(blob.size / 1e6).toFixed(1)} Mo.`, "ok");
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${base}.mp4`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatus(`✅ Terminé — ${(blob.size / 1e6).toFixed(1)} Mo téléchargés.`, "ok");
    }
  } catch (err) {
    console.error(err);
    setStatus("Erreur : " + (err && err.message ? err.message : err), "error");
  } finally {
    exporting = false;
    $("exportBtn").disabled = false;
    // restaurer la taille d'affichage
    if (typeof prevW !== "undefined") { canvas.width = prevW; canvas.height = prevH; }
  }
}
$("exportBtn").addEventListener("click", exportCurrent);

/* ---------- Init ---------- */
applyPreset(PRESETS[0]);
renderPresetList();
requestAnimationFrame(loop);

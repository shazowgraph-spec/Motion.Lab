/* ============================================================
   MOTIONLAB — previews.js
   Moteur de mini-previews animées pour les cartes du catalogue
   et le modal. Déterministe (t → image), léger (rendu visible
   uniquement via IntersectionObserver).
   ============================================================ */
"use strict";

/* ---------- Helpers ---------- */
const PV_EASE = {
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inOut: x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  bounce: x => {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + .75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + .9375;
    return n1 * (x -= 2.625 / d1) * x + .984375;
  },
};
const PV_C = { V: "#873bff", C: "#789bff", R: "#ff4d6d", Y: "#ffcf3f", G: "#34e6a8", W: "#f2f2fb", M: "#a0a2c7" };
const PV_TAU = Math.PI * 2;
const PV_norm = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

function pvText(ctx, s, x, y, size, color, o = {}) {
  ctx.font = `${o.w || 900} ${size}px ${o.f || '"Sora","Arial Black",Arial,sans-serif'}`;
  ctx.textAlign = o.a || "center";
  ctx.textBaseline = o.b || "middle";
  ctx.fillStyle = color;
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.fillText(s, x, y);
  ctx.globalAlpha = 1;
}
function pvBg(ctx, W, H, c1, c2) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function pvFit(ctx, s, size, maxW) {
  ctx.font = `900 ${size}px "Sora","Arial Black",Arial,sans-serif`;
  return Math.min(1, maxW / Math.max(1, ctx.measureText(s).width));
}
function pvRound(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

/* ---------- Textures Minecraft partagées par les previews ---------- */
const PV_MC = {};
const PV_MC_SRC = {
  heart_full: "mc/heart_full.png", heart_container: "mc/heart_container.png",
  heart_poisoned: "mc/heart_poisoned.png", heart_withered: "mc/heart_withered.png",
  hotbar: "mc/hotbar.png", hotbar_sel: "mc/hotbar_selection.png",
  xp_bg: "mc/xp_bg.png", xp_fill: "mc/xp_fill.png", crosshair: "mc/crosshair.png",
  boss_purple_bg: "mc/boss_purple_bg.png", boss_purple_fill: "mc/boss_purple_fill.png",
  boss_red_bg: "mc/boss_red_bg.png", boss_red_fill: "mc/boss_red_fill.png",
  crit: "mc/particle_critical_hit.png",
};
for (const [k, src] of Object.entries(PV_MC_SRC)) {
  const im = new Image(); im.src = src; PV_MC[k] = im;
}
function pvMc(c, key, x, y, w, h) {
  const im = PV_MC[key];
  if (im && im.complete && im.naturalWidth > 1) {
    c.imageSmoothingEnabled = false;
    c.drawImage(im, x, y, w, h);
    return true;
  }
  return false;
}
function pvMcText(c, s, x, y, size, color, o = {}) {
  c.font = `${o.w || 800} ${size}px ${o.f || '"Trebuchet MS","Segoe UI",sans-serif'}`;
  c.textAlign = o.a || "center"; c.textBaseline = o.b || "middle";
  c.lineJoin = "round";
  c.strokeStyle = "#1a1a1a"; c.lineWidth = Math.max(2, size * .14);
  c.strokeText(s, x, y);
  c.fillStyle = color; c.fillText(s, x, y);
}

/* ---------- Les 24 previews (une par preset du catalogue) ---------- */
const PV = {
  "Titre Chroma": { dur: 4, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#171126", "#0d0d16");
    const K = H / 270, pop = PV_EASE.outBack(PV_norm(t, 0, .55)), out = PV_EASE.inExpo(PV_norm(t, 3.7, 4));
    const s = pop * (1 - .15 * out);
    const fs = 46 * K * pvFit(ctx, "MON TITRE", 46 * K, W * .8);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s);
    pvText(ctx, "MON TITRE", -5 * K, 0, fs, "#ff4d6d", { alpha: .8 });
    pvText(ctx, "MON TITRE", 5 * K, 0, fs, "#789bff", { alpha: .8 });
    pvText(ctx, "MON TITRE", 0, 0, fs, PV_C.W);
    ctx.restore();
  } },

  "Kinetic Lecture": { dur: 18, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#0d1a26", "#0d0d16");
    const K = H / 270, words = ["CE QUE", "PERSONNE", "NE DIT", "À HAUT VOIX", "EN PUBLIC"], i = Math.floor(t / 3.6) % words.length, lt = t % 3.6;
    const pop = PV_EASE.outBack(PV_norm(lt, 0, .4)), out = PV_EASE.inExpo(PV_norm(lt, 3.25, 3.6));
    const w = words[i], fs = (i === 2 ? 52 : 40) * K * pvFit(ctx, w, 40 * K, W * .82);
    pvText(ctx, w, W / 2, H / 2, fs, PV_C.W, { alpha: pop * (1 - out) * pop, w: 800 });
    pvText(ctx, w, W / 2 + (i % 2 ? 4 : -4) * K, H / 2, fs, i % 2 ? PV_C.R : PV_C.C, { alpha: .25 * pop * (1 - out), w: 800 });
  } },

  "Mot qui Barré": { dur: 3, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#241022", "#3d1220");
    const K = H / 270, pop = PV_EASE.outBack(PV_norm(t, 0, .5)), out = PV_EASE.inExpo(PV_norm(t, 2.7, 3));
    const fs = 52 * K * pvFit(ctx, "CHER", 52 * K, W * .7);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(PV_norm(t, .5, .8) * -.05); ctx.scale(pop, pop);
    pvText(ctx, "CHER", 0, 0, fs, PV_C.W, { alpha: pop * (1 - .45 * PV_norm(t, .5, .8)) * (1 - out) });
    const sp = PV_EASE.inOut(PV_norm(t, .35, .65));
    if (sp > 0) {
      const w = ctx.measureText("CHER").width;
      ctx.strokeStyle = PV_C.R; ctx.lineWidth = fs * .09; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-w / 2 - 8 * K, 0); ctx.lineTo(-w / 2 - 8 * K + (w + 16 * K) * sp, 0); ctx.stroke();
    }
    ctx.restore();
  } },

  "Souligné Impact": { dur: 3, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#1d1508", "#141010");
    const K = H / 270, pop = PV_EASE.outBack(PV_norm(t, 0, .5)), out = PV_EASE.inExpo(PV_norm(t, 2.7, 3));
    const word = "GRATUIT", fs = 48 * K * pvFit(ctx, word, 48 * K, W * .78);
    ctx.save(); ctx.translate(W / 2, H / 2 - 8 * K); ctx.scale(pop, pop);
    pvText(ctx, word, 0, 0, fs, PV_C.W, { alpha: pop * (1 - out) });
    const w = ctx.measureText(word).width, up = PV_EASE.outExpo(PV_norm(t, .45, .95));
    ctx.shadowColor = PV_C.Y; ctx.shadowBlur = 14 * K;
    ctx.fillStyle = PV_C.Y;
    pvRound(ctx, -w * .47 * up, fs * .5, w * .94 * up, 8 * K, 4 * K); ctx.fill();
    ctx.restore();
  } },

  "Bulle Cercle": { dur: 3, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#082226", "#0d0d16");
    const K = H / 270, pop = PV_EASE.outBack(PV_norm(t, 0, .5)), out = PV_EASE.inExpo(PV_norm(t, 2.7, 3));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(pop, pop);
    pvText(ctx, "VRAI", 0, 0, 54 * K, PV_C.W, { alpha: pop * (1 - out) });
    const d = PV_EASE.outExpo(PV_norm(t, .4, 1.3)) * PV_TAU;
    ctx.strokeStyle = PV_C.C; ctx.lineWidth = 5 * K; ctx.lineCap = "round";
    ctx.beginPath(); ctx.ellipse(0, 0, 88 * K, 52 * K, -.14, -Math.PI / 2, -Math.PI / 2 + d); ctx.stroke();
    ctx.restore();
  } },

  "Mot Punch": { dur: 2, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#26102a", "#101020");
    const K = H / 270, zoom = PV_EASE.inExpo(PV_norm(t, 0, .2)), settle = PV_EASE.outExpo(PV_norm(t, .2, .9));
    const s = 1 + 2.6 * zoom * (1 - settle), out = PV_EASE.inExpo(PV_norm(t, 1.7, 2));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s * (1 - .2 * out), s * (1 - .2 * out));
    pvText(ctx, "BOOM", 6 * K, 6 * K, 56 * K, "rgba(0,0,0,.4)");
    pvText(ctx, "BOOM", 0, 0, 56 * K, PV_C.R);
    ctx.restore();
  } },

  "Étincelles": { dur: 4, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#221a06", "#12100c");
    const K = H / 270, pop = PV_EASE.outBack(PV_norm(t, 0, .5)), out = PV_EASE.inExpo(PV_norm(t, 3.7, 4));
    pvText(ctx, "MAGIQUE", W / 2, H / 2, 44 * K * pop * (1 - out), PV_C.W, { alpha: pop * (1 - out) });
    ctx.strokeStyle = PV_C.Y; ctx.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PV_TAU + .4;
      const tw = Math.max(0, Math.sin(t * 7 + i * 2.2));
      const r1 = (78 + 14 * Math.sin(t * 3 + i)) * K, r2 = r1 + 13 * K * tw;
      ctx.globalAlpha = tw * .9 * pop * (1 - out); ctx.lineWidth = 2.4 * K;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1 * .8);
      ctx.lineTo(W / 2 + Math.cos(a) * r2, H / 2 + Math.sin(a) * r2 * .8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } },

  "Compteur de Vues": { dur: 4, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#0e2019", "#0d0d16");
    const K = H / 270, k = PV_EASE.outExpo(PV_norm(t, .35, 3.5)), out = PV_EASE.inExpo(PV_norm(t, 3.7, 4));
    const pop = PV_EASE.outBack(PV_norm(t, 0, .45));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(pop * (1 - .15 * out), pop * (1 - .15 * out));
    pvText(ctx, "+" + Math.round(320 * k).toLocaleString("fr-FR") + "%", 0, -10 * K, 56 * K, PV_C.G);
    pvText(ctx, "DE VUES EN 7 JOURS", 0, 44 * K, 13 * K, PV_C.M, { w: 700, f: '"Inter",Arial,sans-serif' });
    ctx.restore();
  } },

  "Barres Croissantes": { dur: 4, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#0e2430", "#103a2c");
    const K = H / 270, out = PV_EASE.inExpo(PV_norm(t, 3.7, 4));
    const labels = ["Vidéos", "Shorts", "Lives", "Reels"], vals = [40, 75, 30, 100];
    const maxV = 100, bw = 30 * K, gap = W / 4.6, baseY = H * .78, maxH = H * .52;
    const x0 = W / 2 - gap * 1.5;
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2 * K;
    ctx.beginPath(); ctx.moveTo(x0 - bw, baseY); ctx.lineTo(x0 + gap * 3 + bw, baseY); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const g = PV_EASE.outBack(PV_norm(t, .3 + i * .16, .85 + i * .16));
      const h = Math.max(2, (vals[i] / maxV) * maxH * g);
      const x = x0 + i * gap - bw / 2;
      ctx.save(); ctx.shadowColor = PV_C.C; ctx.shadowBlur = 16 * K * g;
      ctx.fillStyle = i === 3 ? PV_C.G : PV_C.C;
      pvRound(ctx, x, baseY - h, bw, h, 6 * K); ctx.fill(); ctx.restore();
      if (g > .5) {
        pvText(ctx, vals[i] + "k", x + bw / 2, baseY - h - 13 * K, 14 * K, PV_C.W, { alpha: PV_norm(g, .5, 1) * (1 - out) });
        pvText(ctx, labels[i], x + bw / 2, baseY + 16 * K, 11 * K, PV_C.M, { w: 600, f: '"Inter",Arial,sans-serif', alpha: (1 - out) });
      }
    }
  } },

  "Zoom Punch": { dur: 1, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#26102a", "#101020");
    const K = H / 270, zoom = PV_EASE.inExpo(PV_norm(t, 0, .22)), settle = PV_EASE.outExpo(PV_norm(t, .22, .9));
    const s = 1 + 2.4 * zoom * (1 - settle);
    pvText(ctx, "GO !", W / 2, H / 2, 60 * K * s, PV_C.Y);
    const sp = PV_norm(t, .05, .5);
    if (sp > 0 && sp < 1) {
      ctx.strokeStyle = PV_C.Y; ctx.lineWidth = 3.4 * K; ctx.lineCap = "round";
      ctx.globalAlpha = (1 - sp) * .9;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PV_TAU + .3, r1 = 74 + 62 * sp, r2 = r1 + 18;
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(a) * r1 * K, H / 2 + Math.sin(a) * r1 * K * .72);
        ctx.lineTo(W / 2 + Math.cos(a) * r2 * K, H / 2 + Math.sin(a) * r2 * K * .72);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  } },

  "Flash Blanc": { dur: 1, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#1a1a22", "#101018");
    const K = H / 270, f = Math.max(0, 1 - t / .35);
    if (f > 0) { ctx.globalAlpha = f; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    const pop = PV_EASE.outBack(PV_norm(t, .2, .6));
    pvText(ctx, "IMPACT", W / 2, H / 2, 42 * K * pop, PV_C.W, { alpha: pop * Math.max(0, 1 - t / .95) });
  } },

  "Fondu Chroma": { dur: 2, draw(ctx, W, H, t) {
    const K = H / 270;
    const a = PV_norm(t, 0, 1), b = PV_norm(t, 1, 2);
    pvBg(ctx, W, H, "#231033", "#101024");
    const s1 = 1 - PV_EASE.inOut(a), s2 = PV_EASE.outBack(PV_norm(b, .15, .8));
    ctx.save(); ctx.translate(W / 2, H / 2);
    pvText(ctx, "AVANT", 0, 0, 40 * K, PV_C.C, { alpha: s1 * .9 });
    ctx.save(); ctx.scale(Math.max(.001, s2), Math.max(.001, s2));
    pvText(ctx, "APRÈS", -3 * K, 0, 44 * K, "#ff4d6d", { alpha: .55 });
    pvText(ctx, "APRÈS", 3 * K, 0, 44 * K, "#789bff", { alpha: .55 });
    pvText(ctx, "APRÈS", 0, 0, 44 * K, PV_C.W);
    ctx.restore(); ctx.restore();
  } },

  "Bouton SUBSCRIBE": { dur: 4, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#201016", "#120d12");
    const K = H / 270, pop = PV_EASE.outBack(PV_norm(t, .2, .8)), out = PV_EASE.inExpo(PV_norm(t, 3.6, 4));
    const k = pop * (1 + .02 * Math.sin(t * 5)) * (1 - out);
    const rp = PV_norm(t, .5, 1.6) % 1;
    if (rp > 0 && rp < 1 && t > .5) {
      ctx.globalAlpha = (1 - rp) * .4 * pop;
      ctx.strokeStyle = PV_C.R; ctx.lineWidth = 2.4 * K;
      ctx.beginPath(); ctx.ellipse(W / 2, H / 2, (110 + 66 * rp) * K, (48 + 30 * rp) * K, 0, 0, PV_TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k);
    const label = "S'ABONNER", baseFs = 20 * K;
    ctx.font = `900 ${baseFs}px "Sora","Arial Black",Arial,sans-serif`;
    const tw = ctx.measureText(label).width;
    const pw = Math.max(210 * K, tw + 52 * K);
    ctx.shadowColor = PV_C.R; ctx.shadowBlur = 26 * K;
    ctx.fillStyle = PV_C.R;
    pvRound(ctx, -pw / 2, -26 * K, pw, 52 * K, 26 * K); ctx.fill();
    ctx.shadowBlur = 0;
    pvText(ctx, label, 0, 1 * K, baseFs, "#fff");
    ctx.restore();
  } },

  "Cloche Notif": { dur: 3, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#241c06", "#14110a");
    const K = H / 270, out = PV_EASE.inExpo(PV_norm(t, 2.7, 3));
    const ring = t < 2.2 ? Math.sin(t * 14) * Math.max(0, 1 - t / 1.4) : 0;
    ctx.save(); ctx.translate(W / 2, H / 2 - 12 * K); ctx.rotate(ring * .18);
    ctx.globalAlpha = 1 - out;
    ctx.fillStyle = PV_C.Y;
    ctx.beginPath();
    ctx.moveTo(-26 * K, 26 * K);
    ctx.quadraticCurveTo(-26 * K, -24 * K, 0, -28 * K);
    ctx.quadraticCurveTo(26 * K, -24 * K, 26 * K, 26 * K);
    ctx.closePath(); ctx.fill();
    pvRound(ctx, -32 * K, 26 * K, 64 * K, 7 * K, 4 * K); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 38 * K, 6 * K * (1 + .3 * Math.abs(ring)), 0, PV_TAU); ctx.fill();
    ctx.restore();
    const r2 = PV_norm(t % .9, 0, .9);
    ctx.globalAlpha = (1 - r2) * .5 * (1 - out);
    ctx.strokeStyle = PV_C.Y; ctx.lineWidth = 2.6 * K;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(W / 2, H / 2 - 12 * K, (46 + 26 * r2) * K, side > 0 ? -1 : Math.PI + 1.4, side > 0 ? -.4 : Math.PI - .4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } },

  "Like Pop": { dur: 2, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#260d18", "#140b12");
    const K = H / 270, pop = PV_EASE.bounce(PV_norm(t, 0, .6)), out = PV_EASE.inExpo(PV_norm(t, 1.7, 2));
    const s = pop * (1 + .12 * Math.sin(t * 10)) * (1 - out);
    ctx.save(); ctx.translate(W / 2, H / 2 - 6 * K); ctx.scale(s, s);
    ctx.fillStyle = PV_C.R; ctx.shadowColor = PV_C.R; ctx.shadowBlur = 22 * K;
    const r = 16 * K;
    ctx.beginPath();
    ctx.moveTo(0, 14 * K);
    ctx.bezierCurveTo(-30 * K, -6 * K, -16 * K, -28 * K, 0, -12 * K);
    ctx.bezierCurveTo(16 * K, -28 * K, 30 * K, -6 * K, 0, 14 * K);
    ctx.fill();
    ctx.restore();
    pvText(ctx, "+1", W / 2 + 42 * K, H / 2 - 30 * K - 20 * K * PV_norm(t, .2, .7), 22 * K, PV_C.W, { alpha: 1 - PV_norm(t, .5, 1) });
    pvText(ctx, "1 248", W / 2, H / 2 + 34 * K, 16 * K, PV_C.M, { w: 700, f: '"Inter",Arial,sans-serif' });
  } },

  "Lower Third Pro": { dur: 6, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#12101e", "#0d0d16");
    const K = H / 270, inK = PV_EASE.outExpo(PV_norm(t, .1, .8)), outK = PV_EASE.inExpo(PV_norm(t, 5.2, 5.9));
    const x = -W * .5 + inK * W * .56 - outK * W * .6, y = H * .68, bw = W * .46, bh = 52 * K;
    ctx.fillStyle = PV_C.V; ctx.shadowColor = PV_C.V; ctx.shadowBlur = 18 * K;
    pvRound(ctx, x, y - bh / 2, 5 * K, bh, 3 * K); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(13,13,23,.88)";
    pvRound(ctx, x + 5 * K, y - bh / 2, bw, bh, 8 * K); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1.2 * K;
    pvRound(ctx, x + 5 * K, y - bh / 2, bw, bh, 8 * K); ctx.stroke();
    const nk = PV_EASE.outExpo(PV_norm(t, .35, .9));
    // les textes s'adaptent à la largeur du bandeau
    ctx.font = `700 ${20 * K}px "Sora","Arial Black",Arial,sans-serif`;
    const nameFs = 20 * K * Math.min(1, (bw - 44 * K) / Math.max(1, ctx.measureText("Alex Martin").width));
    pvText(ctx, "Alex Martin", x + 22 * K, y - 9 * K + (1 - nk) * 8 * K, nameFs, PV_C.W, { a: "left", alpha: nk });
    const rk = PV_EASE.outExpo(PV_norm(t, .5, 1.05));
    ctx.font = `500 ${11 * K}px "Inter",Arial,sans-serif`;
    const roleFs = 11 * K * Math.min(1, (bw - 44 * K) / Math.max(1, ctx.measureText("Créateur YouTube — 240k abonnés").width));
    pvText(ctx, "Créateur YouTube — 240k abonnés", x + 22 * K, y + 14 * K + (1 - rk) * 7 * K, roleFs, PV_C.M, { a: "left", w: 500, f: '"Inter",Arial,sans-serif', alpha: rk * .9 });
  } },

  "Emoji Rain": { dur: 5, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#1c1c10", "#0d0d14");
    const K = H / 270, em = ["🔥", "😂", "❤️", "😮", "👏", "💯"];
    ctx.font = `900 ${24 * K}px "Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let i = 0; i < 14; i++) {
      const seed = Math.sin(i * 91.7) * 43758.5;
      const x = ((seed - Math.floor(seed)) * W);
      const sp = .35 + (Math.sin(i * 33.3) * .5 + .5) * .3;
      const y = ((t * sp + (seed - Math.floor(seed))) % 1.15 - .1) * H;
      ctx.globalAlpha = Math.min(1, Math.max(0, (1.1 - Math.abs(y / H - .5) * 1.4)));
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + i) * .3);
      ctx.fillText(em[i % em.length], 0, 0); ctx.restore();
    }
    ctx.globalAlpha = 1;
  } },

  "Split Reveal": { dur: 2, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#151520", "#0d0d16");
    const K = H / 270, inK = PV_EASE.inOut(PV_norm(t, 0, .72)), outK = PV_EASE.inOut(PV_norm(t, 1.24, 2));
    const half = W / 2, w = half * inK * (1 - outK);
    ctx.fillStyle = PV_C.V; ctx.fillRect(-10, -10, w + 10, H + 20);
    ctx.fillStyle = PV_C.R; ctx.fillRect(W - w, -10, w + 10, H + 20);
    if (inK >= 1 && outK <= 0) {
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(half - 1.5 * K, 0, 3 * K, H);
      const lk = PV_EASE.outBack(PV_norm(t, .8, 1.2));
      pvText(ctx, "ATTENTION", W / 2, H / 2, 40 * K * lk, "#fff");
    }
  } },

  "Étiquette Prix": { dur: 3, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#1e2a10", "#10140c");
    const K = H / 270, b = PV_EASE.bounce(PV_norm(t, .2, .9)), out = PV_EASE.inExpo(PV_norm(t, 2.7, 3));
    ctx.save(); ctx.translate(W / 2, H / 2);
    ctx.rotate((1 - b) * -.5 + Math.sin(t * 2.4) * .02);
    ctx.scale(b, b); ctx.globalAlpha = 1 - out;
    ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 2 * K;
    ctx.beginPath(); ctx.moveTo(-86 * K, 0); ctx.lineTo(-118 * K, -22 * K); ctx.stroke();
    ctx.fillStyle = PV_C.Y;
    pvRound(ctx, -84 * K, -30 * K, 168 * K, 60 * K, 10 * K); ctx.fill();
    ctx.fillStyle = "#141414";
    ctx.beginPath(); ctx.arc(84 * K, 0, 6 * K, 0, PV_TAU); ctx.fill();
    pvText(ctx, "9,99 €", -6 * K, 1 * K, 26 * K, "#141414", { alpha: 1 });
    ctx.restore(); ctx.globalAlpha = 1;
  } },

  "Pièce Dollar": { dur: 3, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#241c06", "#141108");
    const K = H / 270, out = PV_EASE.inExpo(PV_norm(t, 2.7, 3));
    const spin = t * 5.2;
    const sx = Math.abs(Math.cos(spin)) * .85 + .15;
    const bounce = Math.abs(Math.sin(t * 2.6)) * 14 * K * (1 - PV_norm(t, 2.2, 3));
    ctx.save(); ctx.translate(W / 2, H / 2 - bounce); ctx.scale(sx, 1); ctx.globalAlpha = 1 - out;
    ctx.fillStyle = PV_C.Y; ctx.shadowColor = PV_C.Y; ctx.shadowBlur = 20 * K * sx;
    ctx.beginPath(); ctx.arc(0, 0, 42 * K, 0, PV_TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#c79a10";
    ctx.beginPath(); ctx.arc(0, 0, 33 * K, 0, PV_TAU); ctx.fill();
    pvText(ctx, "$", 0, 2 * K, 40 * K * Math.max(.3, sx), PV_C.Y, { alpha: Math.min(1, sx * 1.6) });
    ctx.restore(); ctx.globalAlpha = 1;
  } },

  /* ================= MINECRAFT (textures réelles) ================= */
  "Barre de Vies MC": { dur: 4, draw(ctx, W, H, t) {
    ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, W, H);
    const S = H / 90, HW = 9 * S, GAP = 8 * S + 1;
    const n = 10, hitT = 1.3;
    const x0 = W / 2 - (n * GAP - (GAP - HW)) / 2, y = H / 2;
    const shake = t > hitT && t < hitT + .5 ? Math.sin(t * 60) * 2 * (1 - PV_norm(t, hitT, hitT + .5)) : 0;
    ctx.save(); ctx.translate(shake, 0);
    for (let i = 0; i < n; i++) {
      const appear = PV_EASE.outBack(PV_norm(t, i * .09, .45 + i * .09));
      const x = x0 + i * GAP;
      pvMc(ctx, "heart_container", x, y, HW, HW);
      const filled = t < hitT ? 1 : (i < 6 ? 1 : 0);
      if (filled) {
        const blink = t > hitT && t < hitT + .55 ? (Math.sin(t * 28) > 0 ? .35 : 1) : 1;
        ctx.globalAlpha = appear * blink;
        pvMc(ctx, "heart_full", x, y, HW, HW);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  } },

  "Hotbar MC": { dur: 4, draw(ctx, W, H, t) {
    ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, W, H);
    const S = H / 60;
    const hbW = 182 * S, hbH = 22 * S;
    const x = W / 2 - hbW / 2, y = H / 2 - hbH / 2;
    const inK = PV_EASE.outBack(PV_norm(t, 0, .6));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(inK, inK); ctx.translate(-W / 2, -H / 2);
    pvMc(ctx, "hotbar", x, y, hbW, hbH);
    const items = ["sword", "nsword", "gapple", "bow", "potion", "diamond"];
    const pitch = hbW / 9;
    items.forEach((key, i) => {
      const pop = PV_EASE.outBack(PV_norm(t, .3 + i * .08, .75 + i * .08));
      const size = 16 * S * pop;
      pvMc(ctx, key, x + i * pitch + (pitch - size) / 2, y + (hbH - size) / 2, size, size);
    });
    const selF = (t * 2.5) % 9;
    const i0 = Math.min(8, Math.floor(selF)), frac = selF - i0;
    pvMc(ctx, "hotbar_sel", x + i0 * pitch - 3 * S + frac * pitch, y - 3 * S, 24 * S, 23 * S);
    ctx.restore();
  } },

  "Niveau XP MC": { dur: 4, draw(ctx, W, H, t) {
    ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, W, H);
    const S = H / 60;
    const Wb = 182 * S, Hb = 5 * S;
    const x = W / 2 - Wb / 2, y = H * .68;
    pvMc(ctx, "xp_bg", x, y, Wb, Hb);
    const k = PV_EASE.outExpo(PV_norm(t, .2, 3.2));
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, Wb * k, Hb); ctx.clip();
    pvMc(ctx, "xp_fill", x, y, Wb, Hb);
    ctx.restore();
    const lvl = Math.round(30 * k);
    pvMcText(ctx, String(lvl), W / 2, y - 14 * S, 13 * S, "#80ff20");
  } },

  "Boss Bar MC": { dur: 4, draw(ctx, W, H, t) {
    ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, W, H);
    const S = H / 60;
    const Wb = 182 * S, Hb = 5 * S;
    const x = W / 2 - Wb / 2, y = H * .55;
    pvMc(ctx, "boss_purple_bg", x, y, Wb, Hb);
    const k = PV_EASE.outExpo(PV_norm(t, .3, 3.4)) * .75;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, Wb * k, Hb); ctx.clip();
    pvMc(ctx, "boss_purple_fill", x, y, Wb, Hb);
    ctx.restore();
    pvMcText(ctx, "Ender Dragon", W / 2, y - 14 * S, 11 * S, "#ffffff");
  } },

  "Coup Critique MC": { dur: 2, draw(ctx, W, H, t) {
    ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, W, H);
    const S = H / 90;
    ctx.globalAlpha = PV_EASE.outExpo(PV_norm(t, 0, .3));
    pvMc(ctx, "crosshair", W / 2 - 15 * S / 2, H / 2 - 15 * S / 2, 15 * S, 15 * S);
    ctx.globalAlpha = 1;
    const burst = PV_EASE.outExpo(PV_norm(t, .25, 1.4));
    const out = PV_EASE.inExpo(PV_norm(t, 1.65, 2));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PV_TAU + (i % 2) * .4;
      const r = 60 * S * burst;
      const px = W / 2 + Math.cos(a) * r + Math.sin(t * 9 + i * 2) * 4;
      const py = H / 2 + Math.sin(a) * r * .8 + Math.pow(burst, 1.6) * 20;
      const sz = 8 * S * (1 - burst * .35);
      ctx.globalAlpha = (1 - out) * Math.min(1, burst * 3) * (1 - burst * .4);
      pvMc(ctx, "crit", px - sz / 2, py - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1 - PV_EASE.inExpo(PV_norm(t, 1.3, 2));
    pvMcText(ctx, "-12", W / 2, H / 2 - 34 - PV_norm(t, .35, 2) * 44, 15 * S, "#ff5252");
    ctx.globalAlpha = 1;
  } },

  "_mc": { dur: 4, draw(ctx, W, H, t) {
    ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, W, H);
    const S = H / 90;
    for (let i = 0; i < 14; i++) {
      const a = t * 1.4 + i * 0.9;
      const r = 40 + (i % 5) * 18;
      const x = W/2 + Math.cos(a) * r;
      const y = H/2 + Math.sin(a) * r * 0.6 + Math.sin(t*2+i)*6;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t*3+i);
      ctx.fillStyle = i % 3 === 0 ? "#34e6a8" : (i % 3 === 1 ? "#873bff" : "#789bff");
      ctx.beginPath(); ctx.arc(x, y, 3 + (i % 3), 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const Wb = W * 0.7, Hb = 6, x = W/2 - Wb/2, y = H * 0.78;
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(x, y, Wb, Hb);
    ctx.fillStyle = "#34e6a8";
    ctx.fillRect(x, y, Wb * (0.3 + 0.7 * (Math.sin(t*1.2)*.5+.5)), Hb);
    pvMcText(ctx, "MINECRAFT", W/2, H*0.45, Math.min(22, H*0.09), "#ffffff");
  } },
  "Décompte": { dur: 4, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#1b1036", "#0d0a1c");
    const K = H / 270;
    if (t < 3) {
      const ph = t % 1, n = 3 - Math.floor(t);
      const pop = PV_EASE.outBack(PV_norm(ph, 0, .3)), fade = PV_EASE.inExpo(PV_norm(ph, .75, 1));
      ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 5 * K;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 60 * K, 0, PV_TAU); ctx.stroke();
      ctx.strokeStyle = "#873bff"; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 60 * K, -Math.PI / 2, -Math.PI / 2 + (1 - ph) * PV_TAU); ctx.stroke();
      pvText(ctx, String(n), W / 2, H / 2, 76 * K * pop * (1 - .2 * fade), "#f2f2fb", { alpha: pop * (1 - fade) });
    } else {
      const s = PV_EASE.outBack(PV_norm(t, 3, 3.3));
      pvText(ctx, "GO !", W / 2, H / 2, 84 * K * s, "#873bff");
    }
  } },

  "Machine à Écrire": { dur: 4, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#101018", "#0d0d16");
    const K = H / 270, full = "ENFIN DISPONIBLE";
    const n = Math.floor(PV_norm(t, .3, 2.9) * full.length);
    const shown = full.slice(0, n);
    ctx.font = `700 ${30 * K}px Consolas, "Courier New", monospace`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const w = ctx.measureText(full).width, x = W / 2 - w / 2;
    ctx.fillStyle = "#f2f2fb"; ctx.fillText(shown, x, H / 2);
    if ((t * 2.6) % 1 < .55) { ctx.fillStyle = "#873bff"; ctx.fillRect(x + ctx.measureText(shown).width + 3, H / 2 - 15 * K, 12 * K, 30 * K); }
  } },

  "Glitch Texte": { dur: 3, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#0b0b16", "#12081f");
    const K = H / 270;
    const burst = Math.max(0, Math.sin(t * 9.3) * Math.sin(t * 13.7));
    const g = Math.pow(burst, 3);
    const jx = Math.sin(t * 61) * Math.sin(t * 47) * 12 * g;
    pvText(ctx, "SIGNAL PERDU", jx - 4 * K, H / 2, 32 * K, "rgba(255,77,109,.8)");
    pvText(ctx, "SIGNAL PERDU", -jx + 4 * K, H / 2, 32 * K, "rgba(120,155,255,.8)");
    pvText(ctx, "SIGNAL PERDU", jx * .3, H / 2, 32 * K, "#f2f2fb");
  } },

  "Néon Flicker": { dur: 4, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#090a18", "#0b0d22");
    const K = H / 270;
    const n1 = Math.sin(t * 23.7) * Math.sin(t * 9.1 + 2);
    const flick = n1 > .965 ? .15 : (n1 > .9 ? .55 : 1);
    const glow = PV_EASE.outExpo(PV_norm(t, 0, .6)) * flick;
    ctx.strokeStyle = `rgba(255,255,255,${.14 * glow})`; ctx.lineWidth = 2.4 * K;
    pvRound(ctx, W * .2, H * .22, W * .6, H * .56, 16 * K); ctx.stroke();
    ctx.shadowColor = "#789bff"; ctx.shadowBlur = 26 * K * glow;
    ctx.strokeStyle = "#789bff"; ctx.lineWidth = 1.6 * K;
    ctx.font = `900 ${38 * K}px "Arial Black",Arial,sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeText("OPEN", W / 2, H / 2); ctx.strokeText("OPEN", W / 2, H / 2);
    ctx.fillStyle = "#cdd8ff"; ctx.globalAlpha = glow;
    ctx.fillText("OPEN", W / 2, H / 2);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  } },

  "Confettis": { dur: 4, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#181233", "#0f0d1e");
    const K = H / 270, pal = ["#873bff", "#789bff", "#ff4d6d", "#ffcf3f", "#34e6a8", "#f2f2fb"];
    for (let i = 0; i < 46; i++) {
      const s1 = Math.sin(i * 91.7) * 43758.5, s2 = Math.sin(i * 33.3) * 24634.6, s3 = Math.sin(i * 57.7) * 12345.7;
      const r1 = s1 - Math.floor(s1), r2 = s2 - Math.floor(s2), r3 = s3 - Math.floor(s3);
      const a = (r1 - .5) * Math.PI * .9 - Math.PI / 2;
      const v = 220 + r2 * 260;
      const vx = Math.cos(a) * v * .55, vy = Math.sin(a) * v * .8;
      const x = W / 2 + vx * t, y = H * .72 + vy * t + 0.5 * 340 * t * t;
      if (y < -20 || y > H + 20) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(r3 * PV_TAU + t * 5);
      ctx.scale(1, Math.abs(Math.sin(t * 5 + i)) * .7 + .3);
      ctx.fillStyle = pal[i % pal.length]; ctx.globalAlpha = Math.max(0, 1 - PV_norm(t, 3.6, 4));
      ctx.fillRect(-3 * K, -4 * K, 6 * K, 8 * K); ctx.restore();
    }
    ctx.globalAlpha = 1;
  } },

  "Onde Sonore": { dur: 5, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#0d0d18", "#101024");
    const K = H / 270, n = 24, gap = 4 * K;
    const bw = Math.min(10 * K, (W * .7 - gap * (n - 1)) / n);
    const totalW = bw * n + gap * (n - 1), x0 = W / 2 - totalW / 2, cy = H / 2;
    for (let i = 0; i < n; i++) {
      const hRaw = .3 + .24 * Math.sin(t * 7.1 + i * .55) + .18 * Math.sin(t * 11.3 + i * .95) + .16 * Math.sin(t * 4.7 + i * .33);
      const env = Math.pow(Math.sin(Math.PI * (i + .5) / n), .6);
      const h = Math.max(4, Math.min(1, Math.max(.05, hRaw)) * 110 * K * env);
      ctx.fillStyle = i % 2 ? "#789bff" : "#873bff";
      pvRound(ctx, x0 + i * (bw + gap), cy - h / 2, bw, h, bw / 2); ctx.fill();
    }
  } },

  "Sticker Pop": { dur: 3, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#1c1230", "#120d20");
    const K = H / 270, pop = PV_EASE.outBack(PV_norm(t, .15, .7)), out = PV_EASE.inExpo(PV_norm(t, 2.7, 3));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-.14 + Math.sin(t * 3.1) * .035);
    ctx.scale(pop, pop * (2 - pop));
    ctx.globalAlpha = 1 - out;
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 14 * K; ctx.shadowOffsetY = 7 * K;
    ctx.fillStyle = "#fff"; pvRound(ctx, -95 * K, -56 * K, 190 * K, 112 * K, 16 * K); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#ffcf3f"; pvRound(ctx, -85 * K, -46 * K, 170 * K, 92 * K, 12 * K); ctx.fill();
    pvText(ctx, "TOP !", 0, 3 * K, 42 * K, "#fff");
    ctx.restore(); ctx.globalAlpha = 1;
  } },

  "Bandeau Défilant": { dur: 6, draw(ctx, W, H, t) {
    pvBg(ctx, W, H, "#101018", "#0d0d16");
    const K = H / 270, inP = PV_EASE.outExpo(PV_norm(t, 0, .4)), out = 1 - PV_EASE.inExpo(PV_norm(t, 5.6, 6));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-.045); ctx.globalAlpha = inP * out;
    ctx.fillStyle = "#873bff"; ctx.fillRect(-W * .62, -24 * K, W * 1.24, 48 * K);
    ctx.font = `900 ${20 * K}px "Arial Black",Arial,sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
    const txt = "NOUVELLE VIDÉO • ABONNE-TOI • ";
    const tw = Math.max(1, ctx.measureText(txt).width);
    const off = (t * 70 * K) % tw;
    for (let x = -W * .62 - off; x < W * .62; x += tw) ctx.fillText(txt, x, 2);
    ctx.restore(); ctx.globalAlpha = 1;
  } },
};


/* ---------- Moteur : bind + boucle de rendu ---------- */
const Preview = (() => {
  const items = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function size(canvas) {
    const el = canvas;
    const w = Math.max(160, el.clientWidth || 280), h = Math.max(90, el.clientHeight || 108);
    canvas.width = Math.min(960, Math.round(w * 1.6));
    canvas.height = Math.round(canvas.width * (h / w)) || 216;
  }

  function bind(root) {
    // purge les éléments détachés
    for (let i = items.length - 1; i >= 0; i--) if (!items[i].el.isConnected) items.splice(i, 1);
    (root || document).querySelectorAll("canvas.pv").forEach(cv => {
      if (cv._pvBound) return;
      cv._pvBound = true;
      const name = cv.dataset.pv;
      const key = PV[name] ? name : (name && name.indexOf("MC") !== -1 ? "_mc" : null);
      if (!key) return;
      size(cv);
      items.push({ el: cv, ctx: cv.getContext("2d"), name: key, visible: false });
      if (reduced) { // une seule frame figée
        PV[name].draw(cv.getContext("2d"), cv.width, cv.height, Math.min(PV[name].dur / 2, 1.2));
      }
    });
  }

  addEventListener("resize", () => {
    items.forEach(it => { if (it.el.isConnected) size(it.el); });
  });

  function tick(now) {
    const t = now / 1000;
    const vh = innerHeight;
    for (const it of items) {
      if (!it.el.isConnected) continue;
      // visibilité par géométrie (plus fiable qu'IntersectionObserver ici)
      const r = it.el.getBoundingClientRect();
      const vis = r.bottom > -40 && r.top < vh + 40 && r.width > 0;
      if (vis && r.width !== it.el.width) size(it.el); // re-scale si la carte change de taille
      if (!vis) continue;
      const spec = PV[it.name];
      if (spec && !reduced) spec.draw(it.ctx, it.el.width, it.el.height, t % spec.dur);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { bind, has: name => !!PV[name] };
})();

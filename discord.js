/* ============================================================
   MOTIONLAB — discord.js
   Connexion Discord (OAuth2 — Authorization Code + PKCE, 100 % navigateur)

   ⚙️  CONFIGURATION (2 minutes) :
   1. Va sur https://discord.com/developers/applications → ton application
   2. Onglet "OAuth2" → Redirects : ajoute l'adresse exacte de oauth.html
      (ex. https://ton-site.github.io/MonRepo/oauth.html)
   3. CLIENT_ID + GUILD_ID + GUILD_INVITE ci-dessous
   ============================================================ */
"use strict";

const DISCORD_CONFIG = {
  CLIENT_ID: "1571928334428930161",
  GUILD_INVITE: "https://discord.gg/h5HkpJRtyP",
  GUILD_ID: "1571177274537943171",     // ← identifiant du serveur (vérification d'appartenance)
  SCOPES: "identify guilds.members.read",
};

const MLAuth = (() => {
  const KEY = "ml_discord_user";

  function user() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
    catch { return null; }
  }
  function configured() { return !!DISCORD_CONFIG.CLIENT_ID; }

  function redirectUri() {
    // oauth.html à côté de la page courante
    const base = location.href.replace(/[^/]*$/, "");
    return base + "oauth.html";
  }

  function login() {
    if (!configured()) {
      alert(
        "Connexion Discord pas encore configurée.\n\n" +
        "1. Crée une application sur discord.com/developers/applications\n" +
        "2. Copie ton Client ID dans site/discord.js (DISCORD_CONFIG.CLIENT_ID)\n" +
        "3. Ajoute " + redirectUri() + " dans les Redirects de l'app\n\n" +
        "En attendant, tout reste accessible : c'est un site statique."
      );
      return;
    }
    (async () => {
      const state = Math.random().toString(36).slice(2);
      const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
      sessionStorage.setItem("ml_oauth_state", state);
      sessionStorage.setItem("ml_oauth_verifier", verifier);
      const url = "https://discord.com/oauth2/authorize" +
        "?response_type=code" +
        `&client_id=${encodeURIComponent(DISCORD_CONFIG.CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri())}` +
        `&scope=${encodeURIComponent(DISCORD_CONFIG.SCOPES)}` +
        `&state=${state}` +
        `&code_challenge=${challenge}` +
        "&code_challenge_method=S256";
      location.href = url;
    })();
  }

  function b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /* Reçoit ?code=… : échange contre un token (PKCE, aucun secret nécessaire) */
  function saveFromHash() {
    const q = new URLSearchParams(location.search);
    if (q.get("error")) return false;          // connexion annulée
    const code = q.get("code");
    if (!code) return false;
    const state = q.get("state");
    const verifier = sessionStorage.getItem("ml_oauth_verifier");
    const p = document.querySelector("p");
    const fail = msg => { if (p) p.textContent = msg; };
    if (!verifier || (state && state !== sessionStorage.getItem("ml_oauth_state"))) {
      fail("Connexion expirée — réessaie depuis le bouton « Se connecter ».");
      return true;
    }
    (async () => {
      const r = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: DISCORD_CONFIG.CLIENT_ID,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri(),
          code_verifier: verifier,
        }),
      });
      const tok = await r.json();
      if (!tok || !tok.access_token) { fail("Échec de la connexion — réessaie."); return; }
      sessionStorage.setItem("ml_oauth_token", tok.access_token);
      const ur = await fetch("https://discord.com/api/users/@me",
        { headers: { Authorization: "Bearer " + tok.access_token } });
      const u = await ur.json();
      if (!u || !u.id) { fail("Échec de la connexion — réessaie."); return; }
      const joined = await checkJoined(tok.access_token);
      localStorage.setItem(KEY, JSON.stringify({
        id: u.id,
        name: u.global_name || u.username,
        avatar: u.avatar
          ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
          : `https://cdn.discordapp.com/embed/avatars/${(Number(u.discriminator) || 0) % 5}.png`,
        joined: joined === true,
      }));
      sessionStorage.removeItem("ml_oauth_verifier");
      location.replace(location.pathname.replace(/oauth\.html$/, "index.html") +
        "?bienvenue=1" + (joined ? "&joined=1" : "&join=need"));
    })().catch(() => fail("Échec de la connexion — réessaie."));
    return true;
  }

  /* Vérifie l'appartenance au serveur (nécessite GUILD_ID + bot dans le serveur) */
  async function checkJoined(token) {
    if (!DISCORD_CONFIG.GUILD_ID) return null; // pas vérifiable
    try {
      const r = await fetch(`https://discord.com/api/users/@me/guilds/${DISCORD_CONFIG.GUILD_ID}/member`,
        { headers: { Authorization: "Bearer " + token } });
      return r.ok;
    } catch { return null; }
  }

  /* Re-vérifie l'appartenance avec le token en mémoire */
  async function refreshJoin() {
    const token = sessionStorage.getItem("ml_oauth_token");
    if (!token) return false;
    const joined = await checkJoined(token);
    if (joined !== null) {
      const u = user();
      if (u) { u.joined = joined; localStorage.setItem(KEY, JSON.stringify(u)); }
    }
    return joined === true;
  }

  /* Export autorisé ? → connecté ET membre du serveur */
  function canExport() {
    const u = user();
    if (!u) return false;
    return DISCORD_CONFIG.GUILD_ID ? !!u.joined : true;
  }

  function logout() { localStorage.removeItem(KEY); location.reload(); }

  return { user, configured, login, logout, saveFromHash, refreshJoin, canExport, showGate,
           invite: () => DISCORD_CONFIG.GUILD_INVITE };
})();
window.MLAuth = MLAuth;   // exposé pour studio.js (le garde `window.MLAuth`)

/* ---------- Modale d'accès : connecté ET membre du serveur ---------- */
function showGate(onOk) {
  const ov = document.createElement("div");
  ov.className = "dc-join show dg";
  const card = document.createElement("div");
  card.className = "dc-join-card";
  card.innerHTML = `
    <img src="discord-logo.webp" alt="" class="dc-join-logo">
    <h3>Oups — export réservé aux membres</h3>
    <p>Impossible de télécharger cette animation. Il faut d'abord <b>se connecter avec Discord</b> <span class="dg-et">et</span> <b>rejoindre le serveur</b>.</p>
    <div class="dg-steps"></div>
    <button class="dc-join-later dg-close" type="button">Fermer</button>`;
  ov.appendChild(card);
  document.body.appendChild(ov);
  const steps = card.querySelector(".dg-steps");
  const close = () => ov.remove();
  card.querySelector(".dg-close").addEventListener("click", close);
  ov.addEventListener("click", e => { if (e.target === ov) close(); });

  function render() {
    const uu = MLAuth.user();
    const inServer = uu && uu.joined;
    steps.innerHTML = `
      <div class="dg-step ${uu ? "dg-ok" : ""}">
        <span class="dg-num">${uu ? "✓" : "1"}</span>
        <span class="dg-label">${uu ? "Connecté : <b>" + escapeHtml_(uu.name) + "</b>" : "Se connecter avec Discord"}</span>
        ${uu ? "" : `<button class="dc-join-btn dg-login" type="button"><img src="discord-logo.webp" alt="" class="dc-logo"><span>Se connecter</span></button>`}
      </div>
      <div class="dg-step ${inServer ? "dg-ok" : ""}">
        <span class="dg-num">${inServer ? "✓" : "2"}</span>
        <span class="dg-label">${inServer ? "Membre du serveur" : "Rejoindre le serveur Discord"}</span>
        ${uu && !inServer ? `<button class="dc-join-btn dg-invite" type="button"><img src="discord-logo.webp" alt="" class="dc-logo"><span>Rejoindre</span></button>` : ""}
      </div>
      <div class="dg-msg"></div>
      ${uu && !inServer ? `<button class="dg-check" type="button">J'ai rejoint — vérifier ✓</button>` : ""}
    `;
    const loginBtn = steps.querySelector(".dg-login");
    if (loginBtn) loginBtn.addEventListener("click", () => MLAuth.login());
    const inv = steps.querySelector(".dg-invite");
    if (inv) inv.addEventListener("click", () => window.open(DISCORD_CONFIG.GUILD_INVITE, "_blank"));
    const chk = steps.querySelector(".dg-check");
    if (chk) chk.addEventListener("click", async () => {
      chk.disabled = true; chk.textContent = "Vérification…";
      const ok = await MLAuth.refreshJoin();
      if (ok) { close(); onOk(); }
      else {
        const m = steps.querySelector(".dg-msg");
        m.textContent = "Pas encore détecté — rejoins le serveur sur Discord, puis réessaie (quelques secondes).";
        chk.disabled = false; chk.textContent = "J'ai rejoint — vérifier ✓";
      }
    });
    if (uu && inServer) { close(); onOk(); }
  }
  render();
}

/* ---------- Câblage UI (toutes les pages) ---------- */
function initDiscordUI() {
  const u = MLAuth.user();

  // Boutons de connexion / profil
  document.querySelectorAll(".discord-login").forEach(el => {
    if (u) {
      el.innerHTML = `<img src="discord-logo.webp" alt="" class="dc-logo"><img src="${u.avatar}" alt="" class="dc-ava"><span>${escapeHtml_(u.name)}</span>`;
      el.title = "Se déconnecter";
      el.addEventListener("click", e => { e.preventDefault(); MLAuth.logout(); });
    } else {
      el.innerHTML = `<img src="discord-logo.webp" alt="" class="dc-logo"><span>Se connecter</span>`;
      el.addEventListener("click", e => { e.preventDefault(); MLAuth.login(); });
    }
  });

  // CTA tarifs
  const cta = document.getElementById("discordCta");
  if (cta) {
    cta.addEventListener("click", () => u ? location.href = MLAuth.invite() : MLAuth.login());
    const lab = document.getElementById("discordCtaLabel");
    if (lab && u) lab.textContent = "Rejoindre le serveur Discord";
  }

  // Accueil : message de bienvenue après connexion
  const qp = new URLSearchParams(location.search);
  if (qp.get("bienvenue") && u) {
    const b = document.createElement("div");
    b.className = "dc-welcome";
    b.innerHTML = `✅ Bienvenue <b>${escapeHtml_(u.name)}</b> — MOTIONLAB est débloqué !`;
    document.body.appendChild(b);
    setTimeout(() => b.classList.add("show"), 50);
    setTimeout(() => b.classList.remove("show"), 5000);
    setTimeout(() => b.remove(), 5500);
  }

  // Juste après la connexion : carte « rejoins le serveur » si pas encore membre
  if (qp.get("join") && u && DISCORD_CONFIG.GUILD_INVITE) {
    const ov = document.createElement("div");
    ov.className = "dc-join";
    ov.innerHTML = `
      <div class="dc-join-card">
        <img src="discord-logo.webp" alt="" class="dc-join-logo">
        <h3>Dernière étape !</h3>
        <p>Rejoins le serveur Discord MOTIONLAB pour débloquer les exports :</p>
        <a class="dc-join-btn" href="${DISCORD_CONFIG.GUILD_INVITE}" target="_blank" rel="noopener">
          <img src="discord-logo.webp" alt="" class="dc-logo"><span>Rejoindre le serveur</span>
        </a>
        <button class="dg-check" type="button">J'ai rejoint — vérifier ✓</button>
        <div class="dg-msg"></div>
        <button class="dc-join-later" type="button">Plus tard</button>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    const close = () => { ov.classList.remove("show"); setTimeout(() => ov.remove(), 300); };
    ov.querySelector(".dc-join-later").addEventListener("click", close);
    ov.addEventListener("click", e => { if (e.target === ov) close(); });
    const chk = ov.querySelector(".dg-check");
    if (chk) chk.addEventListener("click", async () => {
      chk.disabled = true; chk.textContent = "Vérification…";
      const ok = await refreshJoin();
      if (ok) { close(); location.reload(); }
      else {
        ov.querySelector(".dg-msg").textContent = "Pas encore détecté — rejoins le serveur sur Discord, puis réessaie.";
        chk.disabled = false; chk.textContent = "J'ai rejoint — vérifier ✓";
      }
    });
    // nettoyage de l'URL pour ne pas réafficher la carte au rafraîchissement
    history.replaceState(null, "", location.pathname);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDiscordUI);
} else {
  initDiscordUI();
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

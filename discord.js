/* ============================================================
   MOTIONLAB — discord.js
   Connexion Discord (OAuth2, flux implicite, 100 % navigateur)

   ⚙️  CONFIGURATION (2 minutes) :
   1. Va sur https://discord.com/developers/applications → New Application
   2. Onglet "OAuth2" → copie ton "Client ID" ci-dessous
   3. Dans "Redirects", ajoute l'adresse exacte de oauth.html une fois le site
      hébergé (ex. https://ton-site.pages.dev/oauth.html)
      — en local : http://localhost:8000/oauth.html (nécessite un petit serveur)
   4. Mets ton lien d'invitation de serveur dans GUILD_INVITE

   La session est stockée en localStorage : le studio vérifie que
   l'utilisateur est connecté avant d'autoriser l'export.
   ============================================================ */
"use strict";

const DISCORD_CONFIG = {
  CLIENT_ID: "1571928334428930161",
  GUILD_INVITE: "https://discord.gg/h5HkpJRtyP",
  SCOPES: "identify",
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
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem("ml_oauth_state", state);
    const url = "https://discord.com/oauth2/authorize" +
      `?client_id=${encodeURIComponent(DISCORD_CONFIG.CLIENT_ID)}` +
      "&response_type=token" +
      `&redirect_uri=${encodeURIComponent(redirectUri())}` +
      `&scope=${encodeURIComponent(DISCORD_CONFIG.SCOPES)}` +
      `&state=${state}`;
    location.href = url;
  }

  function saveFromHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const token = h.get("access_token");
    if (!token) return false;
    fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json())
      .then(u => {
        if (!u || !u.id) return;
        localStorage.setItem(KEY, JSON.stringify({
          id: u.id,
          name: u.global_name || u.username,
          avatar: u.avatar
            ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
            : `https://cdn.discordapp.com/embed/avatars/${(Number(u.discriminator) || 0) % 5}.png`,
        }));
        location.replace(location.pathname.replace(/oauth\.html$/, "index.html") + "?bienvenue=1");
      })
      .catch(console.error);
    return true;
  }

  function logout() { localStorage.removeItem(KEY); location.reload(); }

  return { user, configured, login, logout, saveFromHash, invite: () => DISCORD_CONFIG.GUILD_INVITE };
})();

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
  if (new URLSearchParams(location.search).get("bienvenue") && u) {
    const b = document.createElement("div");
    b.className = "dc-welcome";
    b.innerHTML = `✅ Bienvenue <b>${escapeHtml_(u.name)}</b> — MOTIONLAB est débloqué !`;
    document.body.appendChild(b);
    setTimeout(() => b.classList.add("show"), 50);
    setTimeout(() => b.classList.remove("show"), 5000);
    setTimeout(() => b.remove(), 5500);
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

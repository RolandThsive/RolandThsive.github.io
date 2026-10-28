/* =============================================================================
   3D viewer engine for ro-h-bots posts.  Include in a post with:

     <link rel="stylesheet" href="https://RolandThsive.github.io/engine/viewer.css">
     <script src="https://RolandThsive.github.io/engine/viewer.js"></script>

   Everything below used to live inline in each post. One copy here means a fix
   reaches every post at once. Site folders come from /paths.txt on this site.
   ============================================================================= */
(() => {
  // mvReady(fn): run fn once the engine has built every viewer (they are created after paths.txt
  // is read, so post-specific scripts must not touch #modelViewerX before this).
  window.mvReadyQueue = [];
  window.mvReady = (fn) => (document.documentElement.dataset.mvReady ? fn() : window.mvReadyQueue.push(fn));

})();

(() => {
  // A small full-screen button in the top-left corner of every 3D viewer.
  // Exposed as a function because the viewers are built by the engine after page load.
  window.mvAddFullscreenButtons = () => {
    const ENTER = '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
    const EXIT = '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5"/></svg>';
    const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;

    document.querySelectorAll("model-viewer").forEach((viewer) => {
      const host = viewer.parentElement;
      if (!host || host.querySelector(":scope > .mv-fs-btn")) return;
      host.classList.add("mv-fs-host");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mv-fs-btn";
      btn.title = "Full screen";
      btn.setAttribute("aria-label", "Full screen");
      btn.innerHTML = ENTER;
      host.appendChild(btn);

      const show = (on) => {
        btn.innerHTML = on ? EXIT : ENTER;
        btn.title = on ? "Exit full screen" : "Full screen";
        btn.setAttribute("aria-label", btn.title);
      };
      const exitFallback = () => {
        host.classList.remove("mv-fs-on");
        document.body.classList.remove("mv-fs-lock");
        show(false);
      };

      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (fsElement()) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else if (host.classList.contains("mv-fs-on")) {
          exitFallback();
        } else if (host.requestFullscreen) {
          const p = host.requestFullscreen();
          if (p && p.catch) p.catch(() => {});
        } else if (host.webkitRequestFullscreen) {
          host.webkitRequestFullscreen();
        } else {
          host.classList.add("mv-fs-on");
          document.body.classList.add("mv-fs-lock");
          show(true);
        }
      });

      const sync = () => show(fsElement() === host);
      document.addEventListener("fullscreenchange", sync);
      document.addEventListener("webkitfullscreenchange", sync);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && host.classList.contains("mv-fs-on")) exitFallback();
      });
    });
  };

})();

(() => {
  // KiCanvas viewers: use the KiCad colours and controls (must run before KiCanvas starts)
  try {
    localStorage.setItem("kc:prefs:theme", JSON.stringify({ val: "kicad" }));
    localStorage.setItem("kc:prefs:alignControlsWithKiCad", JSON.stringify({ val: true }));
  } catch (e) {}

  // Fullscreen buttons on the schematic and PCB viewers (called again by the engine after it builds them)
  window.kcAddFullscreenButtons = () => {
    document.querySelectorAll(".kc-fs-btn:not([data-bound])").forEach((btn) => {
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const wrap = btn.parentElement;
        if (document.fullscreenElement) document.exitFullscreen();
        else if (wrap.requestFullscreen) wrap.requestFullscreen();
        else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
      });
    });
  };
  document.addEventListener("fullscreenchange", () => {
    document.querySelectorAll(".kc-fs-btn").forEach((b) => {
      b.textContent = document.fullscreenElement ? "Exit" : "Fullscreen";
    });
  });

})();

(() => {
  // =============================================================================
  //  3D viewer engine
  //
  //  SITE LAYOUT comes from  BASE/paths.txt  (one line per folder, key = URL):
  //    Model = .../3D_models        Poster = .../posters
  //    ModelParameters = .../ModelParameters        PCBAssets = .../PCB Assests
  //  so   Model/Name.glb   Poster/Name.png   ModelParameters/Name.txt   PCBAssets/<project>/<file>
  //
  //  IN THE POST, one block per viewer, one model per line as  Name | Label :
  //    <div class="model-set" data-viewer="modelViewer3">
  //      VIM_Housing_1 | Housing - Top
  //      VIM_Housing_2.gltf | Housing - Bottom        (no extension = .glb)
  //    </div>
  //  The script turns it into the viewer, its "Load 3D Model" button, the slide strip
  //  (only when there is more than one line) and the caption.
  //  Add  data-eager  to a block to load its first model immediately (no Load button).
  //
  //  Optional third field = a switch key, used with  data-switch="<id of a container>":
  //      BaseBody_Displacement.gltf | Displacement | fem-legend-label1
  //  Whenever that slide is shown, the children of the container that carry any key
  //  used in the block are shown (display: flex) if they have this key, hidden otherwise.
  //  (Used for FEM colour-scale legends that differ per result.)
  //
  //  KiCad viewer, one file per line as  file | Label | PosterName  (files live in PCBAssets/<data-folder>):
  //    <div class="kicad-set" data-folder="TheMainBoard - VolatileIndexMeter">
  //      TheMainBoard.kicad_sch | The Main Board - Interactive Schematic | VIM_MainBoard_Schematic
  //      TheMainBoard.kicad_pcb | The Main Board - Interactive PCB | VIM_MainBoard_PCB
  //    </div>
  //
  //  PARAMETER FILE  (key = value per line; none = not set; true/false for flags):
  //    any model-viewer attribute.
  //
  //  HOOKS FOR POST-SPECIFIC SCRIPTS (animation dropdowns etc. live in the post, not here):
  //    - viewers are built after paths.txt is read, so wait for them with
  //          mvReady(() => { const v = document.getElementById("modelViewer1"); ... });
  //    - any element with  data-attach="modelViewerX"  is moved to sit directly under
  //      that viewer (above its caption).
  //
  //  CACHE BUSTING: paths.txt and every Name.txt are requested with ?v=PARAMS_VERSION.
  //  Browsers and the GitHub Pages CDN cache by full URL, so bumping PARAMS_VERSION after
  //  editing any txt makes every visitor fetch the fresh copies instead of stale cached ones.
  // =============================================================================
  const BASE = new URL(document.currentScript.src).origin;   // the site this script is served from (paths.txt lives at its root)
  const PARAMS_VERSION = "1";

  // folder URLs, filled from paths.txt (model, poster, modelparameters, pcbassets)
  const PATH = {};
  const REQUIRED = ["model", "poster", "modelparameters", "pcbassets"];
  const url = (folder, file) => encodeURI(`${PATH[folder]}/${file}`);
  const modelUrl  = (name, ext = ".glb") => url("model", `${name}${ext}`);
  const posterUrl = (name) => url("poster", `${name}.png`);
  const paramsUrl = (name) => url("modelparameters", `${name}.txt`) + `?v=${PARAMS_VERSION}`;
  const kicadUrl  = (folder, file) => url("pcbassets", `${folder}/${file}`);

  // Returns an error message, or "" when every folder is known
  const loadPaths = async () => {
    const src = `${BASE}/paths.txt?v=${PARAMS_VERSION}`;
    try {
      const res = await fetch(src);
      if (!res.ok) return `${src} answered ${res.status}`;
      Object.entries(parseParams(await res.text())).forEach(([k, v]) => {
        PATH[k.replace(/[^a-z]/g, "")] = v.replace(/\/+$/, "");   // "PCB Assets" / "pcb-assets" -> pcbassets
      });
    } catch (e) { return `${src} could not be read (${e.message})`; }
    const missing = REQUIRED.filter((k) => !PATH[k]);
    return missing.length ? `paths.txt is missing: ${missing.join(", ")}` : "";
  };

  const MANAGED = [
    "loading", "reveal",
    "camera-orbit", "camera-target", "field-of-view", "min-camera-orbit", "max-camera-orbit",
    "min-field-of-view", "max-field-of-view", "interpolation-decay", "camera-controls", "disable-pan",
    "disable-tap", "disable-zoom", "orbit-sensitivity", "zoom-sensitivity", "pan-sensitivity", "touch-action",
    "auto-rotate", "auto-rotate-delay", "rotation-per-second",
    "interaction-prompt", "interaction-prompt-style", "interaction-prompt-threshold",
    "exposure", "tone-mapping", "shadow-intensity", "shadow-softness", "environment-image", "skybox-image", "skybox-height",
    "autoplay", "animation-name", "animation-crossfade-duration",
    "variant-name", "orientation", "scale",
    "ar", "ar-modes", "ar-scale", "ar-placement", "ios-src", "xr-environment",
    "alt", "a11y", "bounds", "with-credentials", "generate-schema"
  ];
  // libraries (loaded from CDN on demand; KiCanvas only when a KiCad viewer is actually opened)
  const MODEL_VIEWER_URL = "https://unpkg.com/@google/model-viewer@4.4.0/dist/model-viewer.min.js";
  const KICANVAS_URL = "https://kicanvas.org/kicanvas/kicanvas.js";
  let modelViewerLoaded = null, kicanvasLoaded = null;
  const loadModelViewer = () => (modelViewerLoaded ||= import(MODEL_VIEWER_URL));
  const loadKicanvas = () => (kicanvasLoaded ||= import(KICANVAS_URL));
  // pages that only use the mvEngine API (no model-set) load model-viewer themselves, on demand
  if (document.querySelector(".model-set")) loadModelViewer();

  const LOAD_ICON = '<svg viewBox="0 0 24 24"><path d="M12 3v12M6 9l6 6 6-6M4 21h16"/></svg>';
  const CAPTION_STYLE = "font-family: Shadows Into Light; font-weight: normal;";

  // ---------- parameter files ----------
  const parseParams = (text) => {
    const out = {};
    text.split(/\r?\n/).forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith("#")) return;
      const i = line.indexOf("=");
      if (i < 0) return;
      const key = line.slice(0, i).trim().toLowerCase();
      const value = line.slice(i + 1).trim();
      if (value !== "" && value.toLowerCase() !== "none") out[key] = value;
    });
    return out;
  };

  // Parameter files are fetched once and cached; every model of a set is prefetched when the
  // page builds, so a slide click never waits on the network before the model starts loading.
  const paramCache = new Map();
  const fetchParams = (name) => {
    if (!paramCache.has(name)) {
      paramCache.set(name, (async () => {
        try {
          const res = await fetch(paramsUrl(name));
          if (res.ok) return parseParams(await res.text());
        } catch (e) { /* no file: keep defaults */ }
        return {};
      })());
    }
    return paramCache.get(name);
  };

  const applyParams = (viewer, params) => {
    if (!viewer._defaults) {
      viewer._defaults = {};
      MANAGED.forEach((k) => { if (viewer.hasAttribute(k)) viewer._defaults[k] = viewer.getAttribute(k); });
    }
    MANAGED.forEach((k) => {
      const v = k in params ? params[k] : viewer._defaults[k];
      if (v === undefined || v === "false") viewer.removeAttribute(k);
      else viewer.setAttribute(k, v === "true" ? "" : v);
    });
    // a model's file may turn the Load button off (reveal = auto / interaction)
    if (viewer.getAttribute("reveal") !== "manual") {
      viewer.dataset.loaded = "1";
      const poster = viewer.querySelector(".mv-poster");
      if (poster) poster.remove();
    }
  };

  // ---------- show one model of a set ----------
  const showModel = async (set, index) => {
    const { viewer, models, caption } = set._mv;
    const { name, ext, label, key } = models[index];
    const poster = posterUrl(name);
    viewer.setAttribute("poster", poster);
    const custom = viewer.querySelector(".mv-poster");
    if (custom) custom.style.backgroundImage = `url('${poster}')`;
    caption.textContent = label;
    set.querySelectorAll(".slide").forEach((el, i) => el.classList.toggle("selected", i === index));

    // per-slide switch (e.g. FEM legend scales): show the container's children carrying this key
    const switchBox = set.dataset.switch && document.getElementById(set.dataset.switch);
    if (switchBox) {
      const keys = models.map((m) => m.key).filter(Boolean);
      [...switchBox.children].forEach((el) => {
        if (keys.some((k) => el.classList.contains(k))) el.style.display = el.classList.contains(key) ? "flex" : "none";
      });
    }

    const params = await fetchParams(name);
    if (!("alt" in params)) params.alt = `3D model - ${label}`;
    applyParams(viewer, params);
    const loaded = viewer.dataset.loaded === "1";
    // Switching models on a viewer that is already showing one: model-viewer would keep rendering the
    // old model until the new one arrives (which looks frozen), so show the new poster right away...
    if (loaded && typeof viewer.showPoster === "function") viewer.showPoster();
    viewer.setAttribute("src", modelUrl(name, ext));   // with reveal=manual nothing downloads until Load is pressed
    // ...and, once the src change has been committed, ask for the poster to go as soon as the model is in.
    if (loaded) customElements.whenDefined("model-viewer").then(async () => {
      if (viewer.updateComplete) await viewer.updateComplete;
      viewer.dismissPoster();
    });
  };

  // ---------- build every <div class="model-set"> ----------
  // "Name | field | field ..."  ->  { name, fields[] }  (HTML entities in fields decoded)
  const parseSet = (set) => set.innerHTML.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const parts = l.split("|").map((x) => new DOMParser().parseFromString(x.trim(), "text/html").body.textContent);
      return { name: parts[0], fields: parts.slice(1) };
    });

  const esc = (t) => t.replace(/&/g, "&").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  const buildModelSets = () => document.querySelectorAll(".model-set").forEach((set, n) => {
    const models = parseSet(set).map(({ name, fields }) => {
      const m = name.match(/^(.*?)(\.(?:glb|gltf))?$/i);               // optional .glb / .gltf
      return { name: m[1], ext: m[2] || ".glb", label: fields[0] || m[1], key: fields[1] || "" };
    });
    if (!models.length) return;
    const id = set.dataset.viewer || `modelViewer${n + 1}`;
    const eager = set.hasAttribute("data-eager");
    const first = models[0];

    const posterSlot = eager ? "" : `
            <div slot="poster" class="mv-poster" style="background-image: url('${posterUrl(first.name)}');">
              <button type="button" class="mv-load-btn">${LOAD_ICON}<span>Load 3D Model</span></button>
            </div>`;
    const slides = models.length < 2 ? "" : `
        <div class="slider"><div class="slides">${models.map((m, i) =>
          `<button class="slide${i === 0 ? " selected" : ""}" type="button" title="${esc(m.label)}" style="background-image: url('${posterUrl(m.name)}');"></button>`).join("")}
        </div></div>`;

    set.innerHTML = `
      <div class="parent-container">
        <div class="model-container model-container-wide">
          <model-viewer id="${id}" camera-controls touch-action="pan-y"${eager ? "" : ' loading="lazy" reveal="manual"'} poster="${posterUrl(first.name)}" alt="${esc("3D model - " + first.label)}">${posterSlot}
          </model-viewer>
        </div>${slides}
      </div>
      <div><h2 style="text-align: center;"><span class="mv-caption" style="${CAPTION_STYLE}"></span></h2></div>`;

    const viewer = set.querySelector("model-viewer");
    set._mv = { viewer, models, caption: set.querySelector(".mv-caption") };
    set.style.display = "block";
    models.forEach((m) => fetchParams(m.name));          // prefetch every slide's parameter file

    const loadBtn = set.querySelector(".mv-load-btn");
    if (loadBtn) loadBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      viewer.dataset.loaded = "1";
      customElements.whenDefined("model-viewer").then(() => {
        viewer.dismissPoster();
        const custom = viewer.querySelector(".mv-poster");   // from now on the plain poster image is enough
        if (custom) custom.remove();
      });
    });
    set.querySelectorAll(".slide").forEach((btn, i) => btn.addEventListener("click", () => showModel(set, i)));
    set.querySelectorAll(".slider").forEach((sl) => sl.addEventListener("beforexrselect", (ev) => ev.preventDefault()));

    showModel(set, 0);
  });

  // ---------- KiCanvas (schematic / PCB) ----------
  // KiCanvas has no lazy mode, so the embed is only created when its Load button is pressed,
  // and rebuilt when a slide changes the file (KiCanvas does not re-read a changed source).
  const buildKicanvas = (wrap, fileUrl) => {
    const oldEmbed = wrap.querySelector("kicanvas-embed");
    const embed = document.createElement("kicanvas-embed");
    embed.setAttribute("controls", "full");
    embed.setAttribute("controlslist", "nodownload");
    const source = document.createElement("kicanvas-source");
    source.setAttribute("src", fileUrl);
    embed.appendChild(source);
    if (oldEmbed) oldEmbed.replaceWith(embed); else wrap.appendChild(embed);
  };

  const buildKicadSets = () => document.querySelectorAll(".kicad-set").forEach((set, n) => {
    const files = parseSet(set).map(({ name, fields }) =>   // "file | Label | PosterName"
      ({ file: name, label: fields[0] || name, poster: fields[1] || "" }));
    if (!files.length) return;
    const folder = set.dataset.folder || "";
    const id = set.dataset.viewer || `kicanvasWrap${n + 1}`;
    const posterOf = (f) => (f.poster ? posterUrl(f.poster) : "");
    const first = files[0];

    set.innerHTML = `
      <div class="parent-container">
        <div class="kc-wrap" id="${id}">
          <button class="kc-fs-btn" type="button">Fullscreen</button>
          <div class="mv-poster" style="background-image: url('${posterOf(first)}');">
            <button type="button" class="mv-load-btn">${LOAD_ICON}<span>Load Interactive Viewer</span></button>
          </div>
        </div>${files.length < 2 ? "" : `
        <div class="slider"><div class="slides">${files.map((f, i) =>
          `<button class="slide${i === 0 ? " selected" : ""}" type="button" title="${esc(f.label)}" style="background-image: url('${posterOf(f)}');"></button>`).join("")}
        </div></div>`}
      </div>
      <div><h2 style="text-align: center;"><span class="mv-caption" style="${CAPTION_STYLE}">${esc(first.label)}</span></h2></div>`;

    const wrap = set.querySelector(".kc-wrap");
    const caption = set.querySelector(".mv-caption");
    let current = kicadUrl(folder, first.file);
    set.style.display = "block";

    set.querySelector(".mv-load-btn").addEventListener("click", (ev) => {
      ev.stopPropagation();
      loadKicanvas();                                    // the KiCanvas library is only fetched now
      buildKicanvas(wrap, current);
      wrap.querySelector(".mv-poster").remove();
    });
    set.querySelectorAll(".slide").forEach((btn, i) => btn.addEventListener("click", () => {
      const f = files[i];
      current = kicadUrl(folder, f.file);
      caption.textContent = f.label;
      set.querySelectorAll(".slide").forEach((el, j) => el.classList.toggle("selected", j === i));
      const poster = wrap.querySelector(".mv-poster");
      if (poster) poster.style.backgroundImage = `url('${posterOf(f)}')`;   // not loaded yet: just queue it
      else buildKicanvas(wrap, current);
    }));
  });

  // ---------- hooks for post-specific scripts ----------
  const attachExtras = () => document.querySelectorAll("[data-attach]").forEach((el) => {
    const viewer = document.getElementById(el.dataset.attach);
    const anchor = viewer && viewer.closest(".model-set") && viewer.closest(".model-set").querySelector(".parent-container");
    if (anchor) anchor.after(el);
  });

  // ---------- public API for pages with their own viewer UI (e.g. the Circuits page) ----------
  const pathsReady = loadPaths();
  window.mvEngine = {
    ready: pathsReady.then((err) => { if (err) throw new Error(err); return PATH; }),   // resolves to the folder URLs
    modelUrl, posterUrl, paramsUrl, fetchParams, applyParams, loadModelViewer, loadKicanvas,
    libraries: { modelViewer: MODEL_VIEWER_URL, kicanvas: KICANVAS_URL }
  };

  // ---------- go ----------
  const go = async () => {
  if (document.querySelector(".model-set")) loadModelViewer();
  const pathsError = await pathsReady;
  if (pathsError) {
    console.error("3D viewers not built:", pathsError);
    document.querySelectorAll(".model-set, .kicad-set").forEach((set) => {
      set.innerHTML = `<p style="text-align: center; color: #a93e33;">3D viewer unavailable: ${esc(pathsError)}</p>`;
      set.style.display = "block";
    });
  } else {
    buildModelSets();
    buildKicadSets();
    attachExtras();
    window.mvAddFullscreenButtons();
    window.kcAddFullscreenButtons();
    document.documentElement.dataset.mvReady = "1";
    window.mvReadyQueue.splice(0).forEach((fn) => fn());
  }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();

})();

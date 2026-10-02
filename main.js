/* ==========================================================================
   scroll-portfolio — main.js
   --------------------------------------------------------------------------
   Two independent systems, wired to the same input: scroll position.

   1. Three.js  — a shape generated at runtime, no video/asset. Its rotation,
                  scale and camera distance are a pure function of scroll
                  progress through the #stage section. Stop scrolling → it
                  stops. This is the "scrubber" behaviour, not a looping video.
   2. GSAP + ScrollTrigger — reveals, the pinned stage, and the horizontal
                  work row. ScrollTrigger converts scroll distance into a
                  0..1 progress value that we can map to anything.

   If WebGL or the CDN fails, the page still works: content is visible by
   default and only hidden once JS has confirmed it can animate it.
   ========================================================================== */

/* --- Project data (was in projects.json in the older build) -------------- */
const PROJECTS = [
  {
    index: "01", title: "ICE", tag: ["Python", "Ollama", "SQLite"],
    tagline: "A local-first coding agent that asks before it touches your system.",
    image: "assets/img/ice.png",
  },
  {
    index: "02", title: "Telegram Assistant Bot", tag: ["Java 17", "Docker"],
    tagline: "The one that is actually running in production.",
    image: "assets/img/telegram-bot.png",
  },
  {
    index: "03", title: "Ices Mail", tag: ["TypeScript", "Workers", "D1"],
    tagline: "Disposable email that you can promote to permanent.",
    image: "assets/img/ices-mail.png",
  },
  {
    index: "04", title: "SIGNAL/90", tag: ["Vanilla JS", "localStorage"],
    tagline: "A 99-day security curriculum you answer your way through.",
    image: "assets/img/signal-90.png",
  },
  {
    index: "05", title: "MYOSAI", tag: ["Python", "Whisper", "Tkinter"],
    tagline: "A desktop assistant where the model is a swappable part.",
    image: "assets/img/myosai.png",
  },
  {
    index: "06", title: "browser-cli", tag: ["Python", "curses"],
    tagline: "A browser that lives in a terminal and parses HTML itself.",
    image: "assets/img/browser-cli.png",
  },
  {
    index: "07", title: "Terminal Games", tag: ["Python", "stdlib"],
    tagline: "Eleven games, standard library only.",
    image: "assets/img/terminal-games.png",
  },
];

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasGSAP = typeof window.gsap !== "undefined";
const hasST = hasGSAP && typeof window.ScrollTrigger !== "undefined";

/* ==========================================================================
   1. Build the horizontal work cards
   ========================================================================== */
function buildCards() {
  const track = document.getElementById("work-track");
  if (!track) return;

  track.innerHTML = PROJECTS.map((p) => `
    <article class="card">
      <div class="card-figure">
        <span class="card-index">${p.index}</span>
        <img src="${p.image}" alt="${p.title} screenshot" loading="lazy" />
      </div>
      <div class="card-body">
        <h3 class="card-title">${p.title}</h3>
        <p class="card-tagline">${p.tagline}</p>
        <div class="card-specs">${p.tag.map((t) => `<span>${t}</span>`).join("")}</div>
      </div>
    </article>
  `).join("");

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
}

/* ==========================================================================
   2. Three.js — the runtime shape driven by scroll
   ========================================================================== */
function initThree() {
  const canvas = document.getElementById("gl");
  if (!canvas) return null;

  // Fail quietly if WebGL is unavailable — the page is still fully usable.
  // Only the core is needed now; the planet is built from textures.
  return import("three")
    .then((THREE) => setup(THREE, canvas))
    .catch(() => null);
}

function setup(THREE, canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  // Filmic tone mapping + sRGB output is what makes the planet read as a
  // photographed object instead of a flat-shaded ball.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    40, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.set(0, 0, 7);

  const group = new THREE.Group();
  scene.add(group);

  // Base longitude so the opening view lands on land (Africa/Europe) rather
  // than the middle of the Pacific. Chosen by sampling the texture.
  const EARTH_FACE = (240 * Math.PI) / 180;

  // --- The planet: one solid sphere, wrapped in Earth maps ---------------
  // Textures are 4K WebP (day/normal/night) and a 2K cloud mask. They are
  // stored as WebP rather than the original 8K JPEGs: same sharpness on
  // screen, a fraction of the bytes.
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  function loadTex(file, srgb = false) {
    const tex = loader.load(`assets/img/${file}`);
    // Anisotropic filtering is what keeps the surface sharp at grazing
    // angles near the silhouette — without it, the poles smear.
    tex.anisotropy = maxAniso;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Everything that should spin together lives in one group, so a drag only
  // has to rotate this, not four separate meshes. Adding more planets later
  // means adding them to this group (or a sibling one).
  const planet = new THREE.Group();
  group.add(planet);

  const earth = new THREE.Mesh(
    // 256 segments: dense enough that the silhouette stays round even when the
    // planet fills the viewport and is inspected up close.
    new THREE.SphereGeometry(1.85, 256, 256),
    new THREE.MeshStandardMaterial({
      map: loadTex("earth_day_4k.webp", true),
      normalMap: loadTex("earth_normal_4k.webp"),
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.9,
      metalness: 0.0,
    })
  );
  planet.add(earth);

  // Cloud layer: a slightly larger, transparent shell that drifts faster than
  // the surface, which sells the sense of an atmosphere in motion.
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.875, 128, 128),
    new THREE.MeshStandardMaterial({
      map: loadTex("earth_clouds_2k.webp", true),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  planet.add(clouds);

  // Atmosphere: a back-side shell that glows at the rim (a cheap "fresnel").
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.05, 96, 96),
    new THREE.MeshBasicMaterial({
      color: 0x5a8cff,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  planet.add(atmosphere);

  // Night-side city lights, added on top of the day map with additive
  // blending so they only show where the surface is already dark.
  const lights = new THREE.Mesh(
    new THREE.SphereGeometry(1.855, 128, 128),
    new THREE.MeshBasicMaterial({
      map: loadTex("earth_night_4k.webp", true),
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );
  planet.add(lights);

  // --- Lighting ----------------------------------------------------------
  // One sun, placed toward the camera and to the upper right, so most of the
  // disk we can see is lit and the terminator falls near the left edge.
  const sun = new THREE.DirectionalLight(0xfff4e6, 4.2);
  sun.position.set(3.5, 1.6, 7);
  scene.add(sun);

  // Faint blue rim from behind-left to catch the atmosphere edge.
  const rim = new THREE.DirectionalLight(0x6f8bff, 1.4);
  rim.position.set(-6, -1, -3);
  scene.add(rim);

  // A soft cool fill lifts the night side out of pure black, the way Earth's
  // own atmosphere scatters a little light around the globe.
  const fill = new THREE.DirectionalLight(0x8fa8ff, 0.5);
  fill.position.set(-3, 2, 5);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  // --- Star field --------------------------------------------------------
  // A full sphere of stars around the camera, so the planet reads as being
  // in space rather than floating in an empty black page.
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 16 + Math.random() * 20;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(positions, 3)),
    new THREE.PointsMaterial({ color: 0xcfcabf, size: 0.06, transparent: true, opacity: 0.75 })
  );
  scene.add(stars);

  // The values scroll + pointer feed into. Updated by GSAP/events; read here.
  const state = { progress: 0, heroProgress: 0 };
  window.__scrollState = state;

  // --- Pointer parallax + grab-and-spin ---------------------------------
  // Two different pointer behaviours:
  //   - parallax: a light tilt that follows the cursor, always on
  //   - drag: press on the globe and spin it, with inertia on release
  // They are kept separate so a drag never fights the parallax tilt.
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  const spin = {
    rotY: 0, rotX: 0,        // accumulated drag rotation
    velY: 0, velX: 0,        // inertia carried after release
    dragging: false,
    everDragged: false,
    lastX: 0, lastY: 0,
  };

  // A cheap, low-poly proxy used only for hit-testing. Raycasting the real
  // 256x256 sphere on every mouse move would test ~130k triangles; this proxy
  // tests 512 and is invisible.
  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(1.95, 16, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  planet.add(hitProxy);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function isOverGlobe(clientX, clientY) {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(hitProxy, false).length > 0;
  }

  window.addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1..1
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;

    if (spin.dragging) {
      const dx = e.clientX - spin.lastX;
      const dy = e.clientY - spin.lastY;
      spin.rotY += dx * 0.006;
      spin.rotX = clamp(spin.rotX + dy * 0.005, -1.1, 1.1);
      // Remember the last frame's motion — that becomes the inertia on release.
      spin.velY = dx * 0.006;
      spin.velX = dy * 0.005;
      spin.lastX = e.clientX;
      spin.lastY = e.clientY;
      return;
    }

    // Hover feedback: only show the grab cursor over the globe itself.
    // Touch is skipped — dragging a finger is how you scroll on mobile.
    if (e.pointerType !== "touch") {
      document.body.style.cursor = isOverGlobe(e.clientX, e.clientY) ? "grab" : "";
    }
  });

  window.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;                       // left button only
    if (e.pointerType === "touch") return;            // keep touch = scroll
    if (e.target.closest("a, button, input")) return; // let links work
    if (!isOverGlobe(e.clientX, e.clientY)) return;
    spin.dragging = true;
    spin.everDragged = true;
    spin.lastX = e.clientX;
    spin.lastY = e.clientY;
    spin.velY = 0;
    spin.velX = 0;
    document.body.style.cursor = "grabbing";
    document.body.classList.add("is-spinning");
    e.preventDefault();
  });

  function endDrag() {
    if (!spin.dragging) return;
    spin.dragging = false;
    document.body.classList.remove("is-spinning");
    document.body.style.cursor = "";
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  // If the pointer leaves the window mid-drag, release cleanly.
  window.addEventListener("blur", endDrag);

  // Planet sits to the right on wide screens (clear of the copy) and centres
  // on narrow ones where the layout stacks.
  function lateralOffset() {
    return window.innerWidth < 820 ? 0 : 1.6;
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  window.addEventListener("resize", resize);

  // Render loop. Motion is a pure function of state.progress → deterministic,
  // reversible, and frozen the moment scrolling stops.
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    const p = state.progress; // 0..1 through #stage

    // Ease the pointer toward its target so parallax glides, never snaps.
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    // Inertia: after a drag is released, keep spinning and decay. This is what
    // makes the globe feel like it has weight instead of stopping dead.
    if (!spin.dragging) {
      spin.rotY += spin.velY;
      spin.rotX = clamp(spin.rotX + spin.velX, -1.1, 1.1);
      spin.velY *= 0.94;
      spin.velX *= 0.94;
      if (Math.abs(spin.velY) < 0.0001) spin.velY = 0;
      if (Math.abs(spin.velX) < 0.0001) spin.velX = 0;
    }

    // The planet spins. Scroll adds three extra turns on top of the idle spin,
    // so the same input that moves the page also moves the globe. The base
    // offset is chosen so the opening view lands on land (Africa/Europe)
    // rather than the middle of the Pacific. Drag rotation is layered on top.
    const idleSpin = spin.everDragged ? 0 : t * 0.05;   // stop idle spin once user takes over
    planet.rotation.y = EARTH_FACE + p * Math.PI * 3 + idleSpin + spin.rotY;
    planet.rotation.x = spin.rotX;

    clouds.rotation.y = t * 0.012;   // clouds drift relative to the surface
    lights.rotation.y = 0;

    // Tilt the whole group slightly toward the pointer for parallax — muted
    // while dragging so the globe tracks the cursor 1:1 instead of lagging.
    const tiltAmt = spin.dragging ? 0.2 : 1;
    group.rotation.x = -0.25 + pointer.y * 0.12 * tiltAmt + p * 0.15;
    group.rotation.z = pointer.x * 0.05 * tiltAmt;

    const scale = 0.72 + p * 0.95;
    group.scale.setScalar(scale);

    // Drift from right (hero) toward centre as the stage takes over.
    const drift = lateralOffset() * (1 - p * 0.55);
    group.position.x = drift;
    group.position.y = -state.heroProgress * 0.6;

    // Camera eases closer as you scroll, so the planet grows to fill the stage.
    camera.position.z = 7 - p * 2.4;
    camera.position.x = drift * 0.4 + pointer.x * 0.3 * tiltAmt;
    camera.position.y = -pointer.y * 0.3 * tiltAmt;
    camera.lookAt(drift * 0.5, 0, 0);

    // The star field counter-rotates slowly, giving a parallax backdrop.
    stars.rotation.y = -t * 0.01 - p * 0.3;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  return { state };
}

/* ==========================================================================
   3. GSAP wiring — reveals, pinning, horizontal scroll
   ========================================================================== */
function initGSAP(state) {
  if (!hasST || prefersReduced) {
    // No GSAP or user prefers reduced motion: reveal everything, no pinning.
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      el.style.opacity = "1";
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* --- Reveals ----------------------------------------------------------- */
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 22 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      }
    );
  });

  /* --- Hero parallax ----------------------------------------------------- */
  ScrollTrigger.create({
    trigger: ".hero",
    start: "top top",
    end: "bottom top",
    scrub: true,
    onUpdate: (self) => {
      if (state) state.heroProgress = self.progress;
    },
  });

  /* --- Progress bar ------------------------------------------------------ */
  const bar = document.getElementById("progress-bar");
  const hudP = document.getElementById("hud-progress");
  const hudR = document.getElementById("hud-rot");
  ScrollTrigger.create({
    trigger: document.documentElement,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      if (bar) bar.style.width = (self.progress * 100).toFixed(2) + "%";
      if (hudP) hudP.textContent = self.progress.toFixed(3);
      if (hudR) hudR.textContent = (self.progress * Math.PI * 3).toFixed(2);
    },
  });

  /* --- Pinned 3D stage --------------------------------------------------- */
  const stage = document.querySelector(".stage");
  if (stage && state) {
    const roP = document.getElementById("ro-progress");
    const roR = document.getElementById("ro-rot");
    const roS = document.getElementById("ro-scale");

    gsap.to(".stage", {
      scrollTrigger: {
        trigger: ".stage",
        start: "top top",
        end: "+=180%",        // how much scroll the pinned scene consumes
        pin: ".stage-pin",
        pinSpacing: true,
        scrub: 0.6,          // 0.6s smoothing → feels weighty, not jittery
        onUpdate: (self) => {
          state.progress = self.progress;
          if (roP) roP.textContent = self.progress.toFixed(2);
          if (roR) roR.textContent = (self.progress * Math.PI * 3).toFixed(2);
          if (roS) roS.textContent = (0.6 + self.progress * 1.15).toFixed(2);
        },
      },
    });

    // Fade the copy out as the shape takes over.
    gsap.to(".stage-copy", {
      opacity: 0,
      y: -40,
      ease: "none",
      scrollTrigger: {
        trigger: ".stage", start: "top top", end: "+=120%", scrub: true,
      },
    });
  }

  /* --- Horizontal work row ---------------------------------------------- */
  const track = document.getElementById("work-track");
  const workBar = document.getElementById("work-bar");
  const workIndex = document.getElementById("work-index");

  if (track) {
    // Distance the row must travel = total width minus one viewport.
    const getDistance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    gsap.to(track, {
      x: () => -getDistance(),
      ease: "none",
      scrollTrigger: {
        trigger: ".work",
        start: "top top",
        end: () => "+=" + getDistance(),
        pin: ".work-pin",
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (workBar) workBar.style.width = (self.progress * 100).toFixed(1) + "%";
          if (workIndex) {
            const i = Math.min(
              PROJECTS.length,
              Math.floor(self.progress * PROJECTS.length) + 1
            );
            workIndex.textContent = String(i).padStart(2, "0");
          }
        },
      },
    });
  }

  ScrollTrigger.refresh();
}

/* ==========================================================================
   4. Boot
   ========================================================================== */
function boot() {
  document.documentElement.classList.add("js");
  buildCards();

  // Three.js first (async), then GSAP, so scroll state exists before
  // ScrollTrigger starts reading it. If Three fails, GSAP still runs.
  const threePromise = initThree();

  if (threePromise && typeof threePromise.then === "function") {
    threePromise.then((api) => {
      initGSAP(api ? api.state : null);
    });
  } else {
    initGSAP(null);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

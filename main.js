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
  let THREE;
  try {
    // Dynamic import keeps a CDN failure from breaking the rest of the module.
    return import("three").then((mod) => setup(mod, canvas)).catch(() => null);
  } catch {
    return null;
  }
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

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.set(0, 0, 6);

  const group = new THREE.Group();
  scene.add(group);

  // Outer wireframe shell — an icosahedron reads as "generated", not a stock cube.
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.9, 1),
    new THREE.MeshBasicMaterial({
      color: 0xff5c2e, wireframe: true, transparent: true, opacity: 0.9,
    })
  );
  group.add(shell);

  // A slightly larger, dimmer shell adds depth without more geometry.
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.35, 0),
    new THREE.MeshBasicMaterial({
      color: 0xff8156, wireframe: true, transparent: true, opacity: 0.28,
    })
  );
  group.add(halo);

  // Inner core — paper-coloured, so the shape reads as a solid volume.
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.15, 1),
    new THREE.MeshBasicMaterial({
      color: 0xf4f1ea, wireframe: true, transparent: true, opacity: 0.35,
    })
  );
  group.add(core);

  // Scatter of points, so motion is legible even when the wireframe is thin.
  const count = 520;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 2.8 + Math.random() * 2.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const field = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(positions, 3)),
    new THREE.PointsMaterial({ color: 0x9a958b, size: 0.035, transparent: true, opacity: 0.9 })
  );
  scene.add(field);

  // The single value scroll feeds into. Updated by ScrollTrigger; read here.
  const state = { progress: 0, heroProgress: 0 };
  window.__scrollState = state;

  // Shape sits to the right on wide screens (clear of the copy) and centres
  // on narrow ones where the layout stacks.
  function lateralOffset() {
    return window.innerWidth < 820 ? 0 : 1.7;
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

    // A slow idle spin keeps it alive when the reader pauses; the scroll term
    // is what makes it respond to input.
    group.rotation.y = p * Math.PI * 3 + t * 0.06;
    group.rotation.x = p * Math.PI * 0.6 + Math.sin(t * 0.3) * 0.05;

    const scale = 0.72 + p * 1.05;
    group.scale.setScalar(scale);

    // Drift from right (hero) toward centre as the stage takes over.
    const drift = lateralOffset() * (1 - p * 0.55);
    group.position.x = drift;
    group.position.y = -state.heroProgress * 0.6;

    halo.rotation.y = -t * 0.1;
    halo.rotation.z = t * 0.05;

    // Camera drifts back as you scroll, so the shape "recedes".
    camera.position.z = 6.5 - p * 1.6;
    camera.position.x = drift * 0.35;
    camera.lookAt(drift * 0.4, 0, 0);

    field.rotation.y = -p * Math.PI * 0.8 + t * 0.02;
    field.rotation.z = p * 0.4;

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

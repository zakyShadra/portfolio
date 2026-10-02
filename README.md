# scroll-portfolio

A single-page portfolio that demonstrates **scroll-driven animation** — no
video, no pre-rendered animation files. Everything moves because of your
scroll position.

## Run

```bash
python3 serve.py          # serves on :8000 and opens a browser
```

Or any static server:

```bash
python3 -m http.server 8000
```

There is **no build step** — open `index.html` through a server (not `file://`,
because ES modules and the CDN import need a real origin).

## What the animation actually is

Two systems read the same input (scroll):

1. **Three.js** — a solid, lit planet. A 256-segment sphere mapped with 4K
   Earth textures (colour, normal map for relief, a cloud layer, night-side
   city lights and an atmosphere shell), lit by a single sun. Inside the
   pinned *"A planet, rendered live"* section, scroll progress drives its spin
   and the camera. Scroll forward → it advances; scroll back → it reverses;
   stop → it freezes. You can also **grab the globe and spin it** — drag it,
   let go, and it coasts with inertia.
2. **GSAP + ScrollTrigger** — element reveals, the pinned stage, and the
   horizontal work row. `scrub` ties an animation's timeline to scroll
   distance, which is the "scroll = playhead" behaviour.

No `.mp4`, `.webm`, or image-sequence files exist in this project. The binary
assets are the seven project screenshots plus four Earth textures (colour,
normal, clouds, city lights) — still images, not animation.

### Textures

Sourced from [Solar System Scope](https://www.solarsystemscope.com/textures/)
(CC BY 4.0). The originals are 8K JPEG/TIFF (~19 MB total); they are converted
to 4K/2K WebP here, which keeps the on-screen sharpness while cutting the
download to ~1.5 MB. Credit: Solar System Scope.

## Files

```
index.html      structure + CDN imports (GSAP, Three via importmap)
styles.css      design tokens, layout, responsive
main.js         project data, Three.js scene, GSAP wiring
assets/img/     seven project screenshots (from the running programs)
serve.py        local dev server
```

## Notes

- Fonts: Fraunces (display), Alegreya Sans (about prose), DM Sans (UI),
  Space Mono (metadata).
- Two themes (light / dark) with a toggle; the choice persists in
  localStorage and defaults to the OS preference. All text colours clear
  WCAG AA in both themes.
- `prefers-reduced-motion` is respected: content shows immediately and the
  pinned/scrub effects are skipped.
- If WebGL or the CDN is unavailable, the page still renders — content is
  only hidden once JS confirms it can animate it.

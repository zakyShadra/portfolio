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

1. **Three.js** — an icosahedron wireframe + particle field generated at
   runtime. Inside the pinned *"There is no video here"* section, scroll
   progress maps directly to `rotation`, `scale` and camera distance. Scroll
   forward → it advances; scroll back → it reverses; stop → it freezes.
2. **GSAP + ScrollTrigger** — element reveals, the pinned stage, and the
   horizontal work row. `scrub` ties an animation's timeline to scroll
   distance, which is the "scroll = playhead" behaviour.

No `.mp4`, `.webm`, or image-sequence files exist in this project. The only
binary assets are the seven project screenshots.

## Files

```
index.html      structure + CDN imports (GSAP, Three via importmap)
styles.css      design tokens, layout, responsive
main.js         project data, Three.js scene, GSAP wiring
assets/img/     seven project screenshots (from the running programs)
serve.py        local dev server
```

## Notes

- Fonts: Instrument Serif (display), Space Grotesk (UI), JetBrains Mono
  (metadata).
- `prefers-reduced-motion` is respected: content shows immediately and the
  pinned/scrub effects are skipped.
- If WebGL or the CDN is unavailable, the page still renders — content is
  only hidden once JS confirms it can animate it.

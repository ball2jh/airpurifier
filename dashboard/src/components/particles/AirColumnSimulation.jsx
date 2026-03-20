import { useRef, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { computeDifferentialBins, BIN_COLORS, BIN_SHORT_LABELS } from '@/utils/particleSource';

// Demo presets — fake pmNumber data for testing visuals
const DEMO_PRESETS = [
  null, // live data
  { label: 'Combustion', nc_pm0_5: 800, nc_pm1_0: 850, nc_pm2_5: 860, nc_pm4_0: 862, nc_pm10: 863 },
  { label: 'Cooking', nc_pm0_5: 200, nc_pm1_0: 500, nc_pm2_5: 580, nc_pm4_0: 590, nc_pm10: 595 },
  { label: 'Dust Storm', nc_pm0_5: 50, nc_pm1_0: 100, nc_pm2_5: 250, nc_pm4_0: 500, nc_pm10: 700 },
  { label: 'Mixed Heavy', nc_pm0_5: 300, nc_pm1_0: 450, nc_pm2_5: 550, nc_pm4_0: 650, nc_pm10: 750 },
  { label: 'Clean Air', nc_pm0_5: 3, nc_pm1_0: 4, nc_pm2_5: 5, nc_pm4_0: 5, nc_pm10: 5 },
];

// Representative diameters per bin (µm)
const BIN_DIAMETERS = [0.3, 0.7, 1.5, 3.2, 6.0];

// Visual radius: r = 1.5 * (d/0.3)^0.45
const BIN_RADII = BIN_DIAMETERS.map(d => 1.5 * Math.pow(d / 0.3, 0.45));

// Brownian motion base (displacement scales as BASE / d)
const BROWNIAN_BASE = 1.0;

// Gravitational settling speed (px/s) per bin — 100x time acceleration
const SETTLE_SPEEDS = [0.4, 2, 9, 40, 150];

// Convection parameters
const CONVECTION_MAX_X = 0.3; // px/frame
const CONVECTION_MAX_Y = 0.15;
const CONVECTION_LERP = 0.02;
const CONVECTION_INTERVAL_MIN = 3000; // ms
const CONVECTION_INTERVAL_MAX = 8000;

// Spawn/removal fade duration in frames
const FADE_FRAMES = 30;
const MAX_TRANSITIONS_PER_FRAME = 3;
const MAX_PARTICLES = 250;

function mapCount(count) {
  if (count <= 0) return 0;
  return Math.round(count);
}

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function createState(width, height) {
  return {
    particles: [],
    targetCounts: [0, 0, 0, 0, 0],
    convection: { x: 0, y: 0 },
    convectionTarget: { x: 0, y: 0 },
    nextConvectionTime: performance.now() + randomBetween(CONVECTION_INTERVAL_MIN, CONVECTION_INTERVAL_MAX),
    spawnQueue: [],
    spawnHead: 0,
    removeQueue: [],
    removeHead: 0,
    lastTime: performance.now(),
    width,
    height,
    bgGradient: null,
    sortScratch: new Array(MAX_PARTICLES),
    binCounts: [0, 0, 0, 0, 0],
    sortOffsets: [0, 0, 0, 0, 0],
  };
}

function createSprites(dpr) {
  const sprites = new Array(5);
  for (let bin = 0; bin < 5; bin++) {
    const r = BIN_RADII[bin];
    const color = BIN_COLORS[bin];

    // Particle sprite
    const pSize = Math.ceil((r + 1) * 2 * dpr);
    const pCanvas = document.createElement('canvas');
    pCanvas.width = pSize;
    pCanvas.height = pSize;
    const pCtx = pCanvas.getContext('2d');
    pCtx.scale(dpr, dpr);
    const pOff = (r + 1);
    pCtx.fillStyle = color;
    pCtx.beginPath();
    pCtx.arc(pOff, pOff, r, 0, Math.PI * 2);
    pCtx.fill();

    // Glow sprite
    const gr = r * 2.5;
    const gSize = Math.ceil((gr + 1) * 2 * dpr);
    const gCanvas = document.createElement('canvas');
    gCanvas.width = gSize;
    gCanvas.height = gSize;
    const gCtx = gCanvas.getContext('2d');
    gCtx.scale(dpr, dpr);
    const gOff = (gr + 1);
    gCtx.globalAlpha = 0.08;
    gCtx.fillStyle = color;
    gCtx.beginPath();
    gCtx.arc(gOff, gOff, gr, 0, Math.PI * 2);
    gCtx.fill();

    const pCssSize = (r + 1) * 2;
    const gCssSize = (gr + 1) * 2;
    sprites[bin] = { particle: pCanvas, pOff, pCssSize, glow: gCanvas, gOff, gCssSize };
  }
  return sprites;
}

export default function AirColumnSimulation({ pmNumber }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const dataRef = useRef(pmNumber);
  const [demoIndex, setDemoIndex] = useState(0);

  const activePreset = DEMO_PRESETS?.[demoIndex] ?? null;
  const effectiveData = activePreset || pmNumber;

  // Keep dataRef in sync without triggering re-renders
  useEffect(() => {
    dataRef.current = effectiveData;
  }, [effectiveData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let lastDpr = window.devicePixelRatio || 1;
    let sprites = createSprites(lastDpr);

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = Math.min(500, Math.max(300, w * 1.2));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (dpr !== lastDpr) {
        lastDpr = dpr;
        sprites = createSprites(dpr);
      }
      if (stateRef.current) {
        stateRef.current.width = w;
        stateRef.current.height = h;
        stateRef.current.bgGradient = null;
      } else {
        stateRef.current = createState(w, h);
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const ctx = canvas.getContext('2d');
    let rafId;

    function updateTargets(state) {
      const pm = dataRef.current;
      const bins = computeDifferentialBins(pm);
      if (!bins) {
        state.targetCounts = [0, 0, 0, 0, 0];
        return;
      }

      const rawCounts = bins.map(b => mapCount(b.count));
      let total = rawCounts.reduce((s, c) => s + c, 0);

      // Proportionally scale down if over cap
      if (total > MAX_PARTICLES) {
        const scale = MAX_PARTICLES / total;
        for (let i = 0; i < 5; i++) rawCounts[i] = Math.round(rawCounts[i] * scale);
        total = rawCounts.reduce((s, c) => s + c, 0);
        while (total > MAX_PARTICLES) {
          let maxIdx = 0;
          for (let i = 1; i < 5; i++) if (rawCounts[i] > rawCounts[maxIdx]) maxIdx = i;
          rawCounts[maxIdx]--;
          total--;
        }
      }

      state.targetCounts = rawCounts;

      // Clear pending queues before recomputing diffs
      state.spawnQueue.length = 0;
      state.spawnHead = 0;
      state.removeQueue.length = 0;
      state.removeHead = 0;

      // Queue spawns/removals per bin
      for (let bin = 0; bin < 5; bin++) {
        let current = 0;
        for (let j = 0; j < state.particles.length; j++) {
          if (state.particles[j].bin === bin && !state.particles[j].dying) current++;
        }
        const target = state.targetCounts[bin];
        const diff = target - current;
        if (diff > 0) {
          for (let i = 0; i < diff; i++) {
            state.spawnQueue.push(bin);
          }
        } else if (diff < 0) {
          // Collect alive particles for this bin, sorted youngest-first
          const alive = [];
          for (let j = 0; j < state.particles.length; j++) {
            if (state.particles[j].bin === bin && !state.particles[j].dying) alive.push(state.particles[j]);
          }
          alive.sort((a, b) => a.age - b.age);
          // Remove from tail (oldest)
          const toRemove = Math.min(-diff, alive.length);
          for (let i = alive.length - 1; i >= alive.length - toRemove; i--) {
            state.removeQueue.push(alive[i]);
          }
        }
      }
    }

    function spawnParticle(state, bin) {
      return {
        x: randomBetween(0, state.width),
        y: randomBetween(0, state.height),
        bin,
        opacity: 0,
        dying: false,
        age: 0,
        depthOpacity: randomBetween(0.7, 1.0),
      };
    }

    function drainSpawnQueue(state, max) {
      let count = 0;
      while (state.spawnHead < state.spawnQueue.length && count < max) {
        const bin = state.spawnQueue[state.spawnHead++];
        state.particles.push(spawnParticle(state, bin));
        count++;
      }
      if (state.spawnHead >= state.spawnQueue.length) {
        state.spawnQueue.length = 0;
        state.spawnHead = 0;
      }
    }

    function drainRemoveQueue(state, max) {
      let count = 0;
      while (state.removeHead < state.removeQueue.length && count < max) {
        const p = state.removeQueue[state.removeHead++];
        if (!p.dying) {
          p.dying = true;
          p.fadeFrame = 0;
        }
        count++;
      }
      if (state.removeHead >= state.removeQueue.length) {
        state.removeQueue.length = 0;
        state.removeHead = 0;
      }
    }

    function updateConvection(state, now) {
      if (now >= state.nextConvectionTime) {
        state.convectionTarget = {
          x: randomBetween(-CONVECTION_MAX_X, CONVECTION_MAX_X),
          y: randomBetween(-CONVECTION_MAX_Y, CONVECTION_MAX_Y),
        };
        state.nextConvectionTime = now + randomBetween(CONVECTION_INTERVAL_MIN, CONVECTION_INTERVAL_MAX);
      }
      state.convection.x += (state.convectionTarget.x - state.convection.x) * CONVECTION_LERP;
      state.convection.y += (state.convectionTarget.y - state.convection.y) * CONVECTION_LERP;
    }

    function applyPhysics(state, dt) {
      const { width, height, convection } = state;
      const particles = state.particles;
      let writeIdx = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age++;

        // Fade in/out
        if (p.dying) {
          p.fadeFrame = (p.fadeFrame || 0) + 1;
          p.opacity = Math.max(0, 1 - p.fadeFrame / FADE_FRAMES);
          if (p.fadeFrame >= FADE_FRAMES) {
            continue; // drop particle by not copying to writeIdx
          }
        } else if (p.opacity < 1) {
          p.opacity = Math.min(1, p.opacity + 1 / FADE_FRAMES);
        }

        const d = BIN_DIAMETERS[p.bin];

        // Brownian motion
        p.x += (BROWNIAN_BASE / d) * (Math.random() * 2 - 1);
        p.y += (BROWNIAN_BASE / d) * (Math.random() * 2 - 1);

        // Gravitational settling
        p.y += SETTLE_SPEEDS[p.bin] * dt;

        // Convective drift
        p.x += convection.x;
        p.y += convection.y;

        // Horizontal wrap
        if (p.x < 0) p.x += width;
        else if (p.x > width) p.x -= width;

        // Top: soft bounce + clamp
        if (p.y < 0) {
          p.y = Math.min(-p.y, height);
        }

        // Bottom: bins 0-1 soft-bounce, bins 2-4 recycle to top
        if (p.y > height) {
          if (p.bin <= 1) {
            p.y = Math.max(0, height - (p.y - height));
          } else {
            p.x = randomBetween(0, width);
            p.y = randomBetween(-10, 0);
            p.opacity = 0; // fade in again on recycle
          }
        }

        // Compact: keep surviving particle
        if (writeIdx !== i) particles[writeIdx] = p;
        writeIdx++;
      }
      particles.length = writeIdx;

      // Counting sort by bin (largest first so small particles render on top)
      const counts = state.binCounts;
      counts[0] = counts[1] = counts[2] = counts[3] = counts[4] = 0;
      for (let i = 0; i < writeIdx; i++) counts[particles[i].bin]++;
      // Compute offsets: bin 4 first, then 3, 2, 1, 0
      const offsets = state.sortOffsets;
      offsets[4] = 0;
      offsets[3] = counts[4];
      offsets[2] = offsets[3] + counts[3];
      offsets[1] = offsets[2] + counts[2];
      offsets[0] = offsets[1] + counts[1];
      const scratch = state.sortScratch;
      for (let i = 0; i < writeIdx; i++) {
        scratch[offsets[particles[i].bin]++] = particles[i];
      }
      for (let i = 0; i < writeIdx; i++) particles[i] = scratch[i];
    }

    function draw(state, sprites) {
      const { width, height, particles, binCounts } = state;
      const currentDpr = window.devicePixelRatio || 1;

      ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);

      // Cached background gradient (invalidated on resize)
      if (!state.bgGradient) {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#1e1e2e');
        grad.addColorStop(1, '#181825');
        state.bgGradient = grad;
      }
      ctx.fillStyle = state.bgGradient;
      ctx.fillRect(0, 0, width, height);

      const isMobile = width < 400;

      // Bin-batched draw: particles sorted largest-first by applyPhysics
      let idx = 0;
      for (let bin = 4; bin >= 0; bin--) {
        const s = sprites[bin];
        const end = idx + binCounts[bin];
        for (; idx < end; idx++) {
          const p = particles[idx];
          ctx.globalAlpha = p.opacity * p.depthOpacity;
          if (!isMobile) ctx.drawImage(s.glow, p.x - s.gOff, p.y - s.gOff, s.gCssSize, s.gCssSize);
          ctx.drawImage(s.particle, p.x - s.pOff, p.y - s.pOff, s.pCssSize, s.pCssSize);
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // Initial target update
    updateTargets(stateRef.current);

    // Update targets every 2s
    const dataInterval = setInterval(() => {
      if (stateRef.current) updateTargets(stateRef.current);
    }, 1000);

    function frame(now) {
      const state = stateRef.current;
      if (!state) { rafId = requestAnimationFrame(frame); return; }

      const dt = Math.min((now - state.lastTime) / 1000, 0.05);
      state.lastTime = now;

      updateConvection(state, now);
      drainSpawnQueue(state, MAX_TRANSITIONS_PER_FRAME);
      drainRemoveQueue(state, MAX_TRANSITIONS_PER_FRAME);
      applyPhysics(state, dt);
      draw(state, sprites);

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(dataInterval);
      ro.disconnect();
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">Air Column</CardTitle>
          {DEMO_PRESETS && (
            <button
              onClick={() => setDemoIndex(i => (i + 1) % DEMO_PRESETS.length)}
              className="text-xs px-1.5 py-0.5 rounded bg-surface-1 text-subtext hover:text-text transition-colors"
            >
              {activePreset ? activePreset.label : 'Live'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {BIN_COLORS.map((color, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-overlay">{BIN_SHORT_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div ref={containerRef} className="w-full">
          <canvas
            ref={canvasRef}
            className="rounded-lg w-full"
            style={{ minHeight: 300, maxHeight: 500 }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

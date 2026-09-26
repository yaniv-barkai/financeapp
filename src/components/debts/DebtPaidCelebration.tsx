"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PartyPopper } from "lucide-react";

type Props = {
  open: boolean;
  debtName: string;
  title: string;
  onDone: () => void;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
  decay: number;
};

const COLORS = [
  "#22c55e",
  "#16a34a",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#fb7185",
  "#ffffff",
];

const DURATION_MS = 3200;

function spawnBurst(
  particles: Particle[],
  cx: number,
  cy: number,
  count: number
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 14;
    particles.push({
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 12,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      life: 1,
      decay: 0.004 + Math.random() * 0.007,
    });
  }
}

export function DebtPaidCelebration({
  open,
  debtName,
  title,
  onDone,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!open) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    const list: Particle[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    // Center burst + side cannons for a big full-screen feel
    spawnBurst(list, width / 2, height * 0.42, 90);
    spawnBurst(list, width * 0.15, height * 0.7, 55);
    spawnBurst(list, width * 0.85, height * 0.7, 55);
    spawnBurst(list, width / 2, height * 0.15, 40);

    let raf = 0;
    let finished = false;
    const started = performance.now();

    const tick = (now: number) => {
      const elapsed = now - started;
      ctx.clearRect(0, 0, width, height);

      // Extra mid-celebration bursts
      if (elapsed > 400 && elapsed < 450 && list.length < 200) {
        spawnBurst(list, width * 0.3, height * 0.35, 35);
        spawnBurst(list, width * 0.7, height * 0.35, 35);
      }

      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]!;
        p.vy += 0.22;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.decay;

        if (p.life <= 0 || p.y > height + 40) {
          list.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < DURATION_MS && list.length > 0) {
        raf = requestAnimationFrame(tick);
      } else if (!finished) {
        finished = true;
        onDoneRef.current();
      }
    };

    raf = requestAnimationFrame(tick);

    const fallback = window.setTimeout(() => {
      if (!finished) {
        finished = true;
        onDoneRef.current();
      }
    }, DURATION_MS + 200);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={() => onDone()}
    >
      <div className="absolute inset-0 bg-background/55 backdrop-blur-[2px] animate-in fade-in duration-300" />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div className="relative z-10 mx-6 max-w-lg animate-in zoom-in-95 fade-in duration-500 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 shadow-[0_0_60px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/30">
          <PartyPopper className="h-10 w-10" strokeWidth={1.75} />
        </div>
        <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </p>
        <p className="mt-2 truncate text-lg text-muted-foreground sm:text-xl">
          {debtName}
        </p>
      </div>
    </div>,
    document.body
  );
}

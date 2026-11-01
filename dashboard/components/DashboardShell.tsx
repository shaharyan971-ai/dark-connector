"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Navbar from "./Navbar";

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let parallaxFrame = 0;
    let resizeTimer: number | undefined;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const animateParallax = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      if (mapRef.current) {
        mapRef.current.style.transform = `scale(1.06) translate(${(currentX * 9).toFixed(2)}px,${(currentY * 9 * 0.7).toFixed(2)}px)`;
      }
      if (canvasRef.current) {
        canvasRef.current.style.transform = `translate(${(-currentX * 5).toFixed(2)}px,${(-currentY * 5 * 0.7).toFixed(2)}px)`;
      }
      parallaxFrame = requestAnimationFrame(animateParallax);
    };

    const handleMouseMove = (event: MouseEvent) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    const handleMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const drawPcb = () => {
      const canvas = canvasRef.current;
      const host = dashboardRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !host || !context) return;

      const width = host.clientWidth;
      const height = Math.max(host.scrollHeight, window.innerHeight);
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const random = seededRandom(88);
      const gridX = 26;
      const gridY = 18;
      const cellW = width / gridX;
      const cellH = height / gridY;
      const nodes = Array.from({ length: 34 }, () => ({
        x: Math.floor(random() * gridX) * cellW + cellW / 2,
        y: Math.floor(random() * gridY) * cellH + cellH / 2,
      }));

      context.strokeStyle = "rgba(120,150,255,0.12)";
      context.lineWidth = 1;
      for (let index = 0; index < nodes.length - 1; index += 1) {
        if (random() > 0.5) continue;
        const first = nodes[index];
        const second = nodes[index + 1];
        context.beginPath();
        context.moveTo(first.x, first.y);
        context.lineTo(second.x, first.y);
        context.lineTo(second.x, second.y);
        context.stroke();
      }

      for (let index = 0; index < 6; index += 1) {
        const centerX = random() * width * 0.85 + width * 0.075;
        const centerY = random() * height * 0.85 + height * 0.075;
        const chipW = 34;
        const chipH = 20;
        context.strokeStyle = "rgba(150,170,255,0.16)";
        context.fillStyle = "rgba(10,14,24,0.25)";
        context.lineWidth = 1;
        context.fillRect(centerX - chipW / 2, centerY - chipH / 2, chipW, chipH);
        context.strokeRect(centerX - chipW / 2, centerY - chipH / 2, chipW, chipH);
        for (let leg = 0; leg < 4; leg += 1) {
          const legX = centerX - chipW / 2 + (chipW / 3) * leg;
          context.beginPath();
          context.moveTo(legX, centerY - chipH / 2);
          context.lineTo(legX, centerY - chipH / 2 - 6);
          context.stroke();
          context.beginPath();
          context.moveTo(legX, centerY + chipH / 2);
          context.lineTo(legX, centerY + chipH / 2 + 6);
          context.stroke();
        }
      }

      const violetRgb = getComputedStyle(document.documentElement)
        .getPropertyValue("--violet-fg-rgb").trim() || "167,139,250";
      nodes.forEach((node, index) => {
        if (index % 4 !== 0) return;
        const glow = context.createRadialGradient(node.x, node.y, 0, node.x, node.y, 7);
        glow.addColorStop(0, `rgba(${violetRgb},0.7)`);
        glow.addColorStop(1, `rgba(${violetRgb},0)`);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(node.x, node.y, 7, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = `rgba(${violetRgb},1)`;
        context.beginPath();
        context.arc(node.x, node.y, 1.3, 0, Math.PI * 2);
        context.fill();
      });
    };

    drawPcb();
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(drawPcb, 150);
    };

    window.addEventListener("resize", handleResize);
    if (!reducedMotion) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseleave", handleMouseLeave);
      parallaxFrame = requestAnimationFrame(animateParallax);
    }

    return () => {
      cancelAnimationFrame(parallaxFrame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div className="dashboard" ref={dashboardRef}>
      <div className="bg-layer" id="bg-map" ref={mapRef} />
      <canvas className="bg-layer" id="bg-pcb" ref={canvasRef} aria-hidden="true" />
      <div className="bg-vignette" />
      <div className="shimmer" />
      <Navbar />
      {children}
    </div>
  );
}

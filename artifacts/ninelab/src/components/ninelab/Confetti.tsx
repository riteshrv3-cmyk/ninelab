import { motion } from "framer-motion";

/**
 * Canopy-colored confetti burst. Shared by AIChat (profile milestones) and
 * Home/Today (streak + all-tasks-done celebrations) — one component so the
 * two moments feel like the same brand, not two different implementations.
 * Mount behind `AnimatePresence` and toggle visibility with a timed state
 * flag; unmounting stops the particles.
 */
const CONFETTI_COLORS = ["#4a55c7", "#8b93e0", "#eef0fb"];

export function Confetti({ zClass = "z-50" }: { zClass?: string } = {}) {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: 20 + Math.random() * 60, // % from left
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 7,
    rotate: Math.random() * 720,
    delay: Math.random() * 0.3,
  }));

  return (
    <div className={`fixed inset-0 pointer-events-none ${zClass} overflow-hidden`}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: "-10px", opacity: 1, rotate: 0, scale: 1 }}
          animate={{ y: "110vh", opacity: [1, 1, 0], rotate: p.rotate, scale: [1, 1.2, 0.8] }}
          transition={{ duration: 1.8 + Math.random() * 0.8, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}

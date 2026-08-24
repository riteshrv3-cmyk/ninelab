const base = import.meta.env.BASE_URL;

export default function Slide01Title() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F18", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <img src={`${base}hero-bg.png`} crossOrigin="anonymous" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.12 }} />
      <div style={{ position: "absolute", top: "-8vh", right: "-4vw", width: "45vw", height: "55vh", background: "radial-gradient(circle, rgba(249,115,22,0.14) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "-10vh", left: "-5vw", width: "35vw", height: "45vh", background: "radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", left: "7vw", top: 0, width: "0.22vw", height: "100vh", background: "linear-gradient(to bottom, #F97316 0%, rgba(249,115,22,0.08) 65%, transparent 100%)" }} />
      <div style={{ position: "absolute", left: "12vw", right: "10vw", top: "50%", transform: "translateY(-50%)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.7vw", border: "1px solid rgba(249,115,22,0.35)", borderRadius: "999px", padding: "0.7vh 1.4vw", marginBottom: "4vh" }}>
          <div style={{ width: "0.5vw", height: "0.5vw", borderRadius: "50%", background: "#F97316" }} />
          <span style={{ fontSize: "1.5vw", color: "#F97316", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Idea Stage — Pre-Seed 2026</span>
        </div>
        <div style={{ fontSize: "9vw", fontWeight: 800, color: "#F97316", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: "2.5vh" }}>
          ninelab
        </div>
        <div style={{ fontSize: "2.4vw", fontWeight: 400, color: "#F8FAFC", lineHeight: 1.4, marginBottom: "2vh", opacity: 0.88, textWrap: "balance" }}>
          India's AI career platform for engineering students.
        </div>
        <div style={{ fontSize: "1.8vw", color: "#94A3B8", fontWeight: 400 }}>
          From first year to first offer — verified, data-driven, AI-powered.
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "5vh", left: "12vw", right: "8vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.6vw" }}>
          <div style={{ width: "0.45vw", height: "0.45vw", borderRadius: "50%", background: "#F97316" }} />
          <div style={{ width: "0.45vw", height: "0.45vw", borderRadius: "50%", background: "rgba(249,115,22,0.35)" }} />
          <div style={{ width: "0.45vw", height: "0.45vw", borderRadius: "50%", background: "rgba(249,115,22,0.12)" }} />
        </div>
        <div style={{ fontSize: "1.5vw", color: "#64748B" }}>Confidential — For Discussion Only</div>
      </div>
    </div>
  );
}

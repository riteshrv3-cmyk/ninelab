const base = import.meta.env.BASE_URL;

export default function Slide10Closing() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F18", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <img src={`${base}hero-bg.png`} crossOrigin="anonymous" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.08 }} />
      <div style={{ position: "absolute", top: "-5vh", left: "-5vw", width: "40vw", height: "50vh", background: "radial-gradient(circle, rgba(249,115,22,0.1) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", bottom: "-10vh", right: "-5vw", width: "45vw", height: "55vh", background: "radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", left: "8vw", right: "8vw", top: "50%", transform: "translateY(-50%)", textAlign: "center" }}>
        <div style={{ fontSize: "1.6vw", color: "#F97316", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4vh" }}>The Vision</div>
        <div style={{ fontSize: "5.5vw", fontWeight: 800, color: "#F8FAFC", lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "4vh", textWrap: "balance" }}>
          Every engineer in India deserves a fair shot.
        </div>
        <div style={{ fontSize: "2.2vw", color: "#94A3B8", fontWeight: 400, marginBottom: "7vh", lineHeight: 1.5 }}>
          We are building the infrastructure that turns raw talent into verified, hirable engineers — at scale.
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "6vw" }}>
          <div>
            <div style={{ fontSize: "1.5vw", color: "#94A3B8", marginBottom: "0.8vh" }}>Email</div>
            <div style={{ fontSize: "1.9vw", color: "#F8FAFC", fontWeight: 600 }}>[your@email.com]</div>
          </div>
          <div style={{ width: "0.15vw", background: "rgba(148,163,184,0.15)" }} />
          <div>
            <div style={{ fontSize: "1.5vw", color: "#94A3B8", marginBottom: "0.8vh" }}>Website</div>
            <div style={{ fontSize: "1.9vw", color: "#F97316", fontWeight: 600 }}>ninelab.in</div>
          </div>
          <div style={{ width: "0.15vw", background: "rgba(148,163,184,0.15)" }} />
          <div>
            <div style={{ fontSize: "1.5vw", color: "#94A3B8", marginBottom: "0.8vh" }}>LinkedIn</div>
            <div style={{ fontSize: "1.9vw", color: "#F8FAFC", fontWeight: 600 }}>[your/linkedin]</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "5vh", left: "8vw", right: "8vw", display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: "2vw", fontWeight: 800, color: "#F97316" }}>ninelab</div>
        <div style={{ fontSize: "1.5vw", color: "#3D4255" }}>Confidential — For Discussion Only</div>
      </div>
    </div>
  );
}

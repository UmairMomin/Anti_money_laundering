import { useEffect, useState } from "react";

const datasets = ["IBM AML", "ICIJ Offshore Leaks", "FinCEN Files", "Panama Papers"];

const HeroSection = () => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  const stagger = (i) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? "translateY(0)" : "translateY(20px)",
    transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms`,
  });

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover opacity-30"
        style={{ zIndex: 0 }}
      >
        <source src="/bg-video-graphP.webm" type="video/webm" />
      </video>

      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 800px 500px at 50% 40%, rgba(34,197,94,0.08) 0%, transparent 70%)",
          zIndex: 1,
        }}
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-background/60" style={{ zIndex: 1 }} />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[640px] px-6 text-center pt-24">
        <div style={stagger(0)}>
          <span className="pill-badge">FINTECH · ANTI-MONEY LAUNDERING · FT2</span>
        </div>

        <h1 className="mt-8 text-5xl md:text-[64px] leading-[1.1] text-foreground" style={stagger(1)}>
          Follow the money.
          <br />
          <span className="font-bold">Unmask the network.</span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-[480px] text-[17px] leading-[1.7] text-muted-foreground"
          style={stagger(2)}
        >
          AML Shield maps fund flows across shell company networks to surface
          laundering patterns that single-transaction systems can't see.
        </p>

        <div style={stagger(3)} className="mt-8">
          <a href="#demo" className="btn-primary animate-glow-pulse">
            Get Started Today
          </a>
        </div>

        <p
          className="mt-6 text-xs text-muted-foreground font-mono"
          style={stagger(4)}
        >
          810,000+ entities analyzed · 28 typologies detected · Multi-hop graph
          tracing
        </p>

        {/* Dataset logos */}
        <div className="mt-10" style={stagger(5)}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Used Datasets
          </p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {datasets.map((d) => (
              <span
                key={d}
                className="text-sm font-mono text-foreground"
                style={{ opacity: 0.4 }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

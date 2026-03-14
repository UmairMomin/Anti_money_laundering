import { useState } from "react";

const navLinks = ["How It Works", "Features", "Demo", "About"];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-border"
      style={{
        backdropFilter: "blur(12px)",
        background: "color-mix(in srgb, var(--background) 82%, transparent)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img
            src="/main-logo.png"
            alt="AML Shield logo"
            className="h-8 w-8 rounded-md"
          />
          <span className="font-serif text-lg text-foreground font-semibold tracking-tight">
            AML Shield
          </span>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s/g, "-")}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link}
            </a>
          ))}
          <a href="/chat" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Chat with our AI
          </a>
        </div>

        {/* CTA */}
        <a
          href="#demo"
          className="hidden md:inline-flex btn-primary !py-2 !px-5 text-sm animate-glow-pulse"
        >
          View Demo
        </a>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-t border-border px-6 py-4 flex flex-col gap-4"
          style={{ background: "color-mix(in srgb, var(--background) 94%, transparent)" }}
        >
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/\s/g, "-")}`}
              className="text-sm text-muted-foreground"
              onClick={() => setMobileOpen(false)}
            >
              {link}
            </a>
          ))}
          <a href="#demo" className="btn-primary !py-2 !px-5 text-sm text-center">
            View Demo
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

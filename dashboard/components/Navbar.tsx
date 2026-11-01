"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { label: "Overview", href: "/" },
  { label: "Sites", href: "/sites" },
  { label: "Patterns", href: "/patterns" },
  { label: "Alerts", href: "/alerts" },
  { label: "Settings", href: "/settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const renderNavigation = (mobile = false) =>
    navItems.map(({ label, href }) => {
      const active = pathname === href;
      return (
        <Link
          href={href}
          className={active ? "active" : ""}
          key={label}
          aria-current={active ? "page" : undefined}
          onClick={mobile ? () => setMobileNavOpen(false) : undefined}
        >
          {label}
        </Link>
      );
    });

  return (
    <>
      <nav className="navbar">
        <div className="nav-left">
          <div className="brand">
            <div className="dot" />
            <div className="name">DARK<span>CONNECTOR</span></div>
          </div>
          <div className="nav-links">{renderNavigation()}</div>
        </div>
        <div className="nav-right">
          <div className="status-pill"><div className="dot" /><span>SYSTEM ONLINE</span></div>
          <div className="avatar">DC</div>
          <button
            className="hamburger-btn"
            type="button"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileNavOpen((isOpen) => !isOpen)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </nav>

      <div className={`mobile-nav${mobileNavOpen ? " open" : ""}`} id="mobile-nav">
        {renderNavigation(true)}
      </div>
    </>
  );
}

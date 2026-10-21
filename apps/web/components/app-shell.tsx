'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Activity, ArrowUpRight, BookOpen, ChartNoAxesCombined, ChevronLeft, ChevronRight, FlaskConical, House, Map, Menu, X } from 'lucide-react';
import { useUIStore } from '@/lib/ui-store';
const Workspace = dynamic(() => import('./workspace'), { loading: () => <p className="loading-state">Loading geographic workspace…</p> });
const links = [
  { href: '/', label: 'Home', icon: House },
  { href: '/dashboard', label: 'Explore Map', icon: Map },
  { href: '/dashboard/simulation', label: 'Simulation', icon: FlaskConical },
  { href: '/dashboard/insights', label: 'Insights', icon: ChartNoAxesCombined },
  { href: '/about', label: 'About / Methodology', icon: BookOpen },
];
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inWorkspace = pathname.startsWith('/dashboard');
  const [visitedWorkspace, setVisitedWorkspace] = useState(inWorkspace);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggleSidebar } = useUIStore();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (inWorkspace) setVisitedWorkspace(true);
    setMobileOpen(false);
    if (previousPath.current !== pathname) main.current?.focus();
    previousPath.current = pathname;
  }, [pathname, inWorkspace]);
  const current = links.find((link) => link.href === pathname);
  return (
    <div className={`app-shell ${collapsed ? 'nav-collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Application navigation" onKeyDown={(e) => { if (e.key === 'Escape') { setMobileOpen(false); menu.current?.focus(); } }}>
        <Link className="brand" href="/" aria-label="NCR Dengue Intelligence home"><span className="brand-mark"><Activity size={25}/></span><span className="brand-name">NCR Dengue<span>Intelligence</span></span></Link>
        <div className="nav-label">PREPAREDNESS STARTS HERE</div>
        <nav aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${pathname === href ? 'active' : ''}`} aria-current={pathname === href ? 'page' : undefined} title={collapsed ? label : undefined}><Icon size={19}/><span>{label}</span>{pathname === href && <i className="nav-indicator"/>}</Link>)}</nav>
        <div className="sidebar-bottom"><div className="prototype-note"><span className="status-dot"/> Historical-data prototype<p>Evidence for planning.<br/>People at the center.</p></div><div className="sidebar-footer"><span>PJDSC <b>2026</b></span><button type="button" className="icon-button collapse-toggle" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={toggleSidebar}>{collapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}</button></div></div>
      </aside>
      <div className="app-content">
        <header className="topbar"><div className="topbar-leading"><button ref={menu} className="icon-button mobile-toggle" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={20}/> : <Menu size={20}/>}</button><span className="breadcrumb">NCR Dengue Intelligence <span>/</span> <strong>{current?.label ?? 'Page'}</strong></span></div><Link href="/about" className="research-badge"><span className="status-dot"/>Research prototype <ArrowUpRight size={13}/></Link></header>
        <main id="main-content" ref={main} tabIndex={-1}>
          {children}
          {(visitedWorkspace || inWorkspace) && <div hidden={!inWorkspace}><Workspace view={pathname.endsWith('/insights') ? 'insights' : pathname.endsWith('/simulation') ? 'simulation' : 'map'}/></div>}
        </main>
      </div>
    </div>
  );
}

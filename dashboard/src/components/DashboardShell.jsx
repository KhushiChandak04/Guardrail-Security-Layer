import Link from "next/link"
import { useRouter } from "next/router"

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/analytics", label: "Analytics" },
  { href: "/logs", label: "Incident Logs" }
]

export default function DashboardShell({ title, subtitle, children }) {
  const router = useRouter()

  return (
    <main className="dash-layout">
      <section className="dash-hero">
        <p className="dash-kicker">Guardrail Command Center</p>
        <h1>{title}</h1>
        {subtitle ? <p className="dash-subtitle">{subtitle}</p> : null}
        <nav className="dash-nav" aria-label="Dashboard pages">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={router.pathname === item.href ? "dash-nav-link active" : "dash-nav-link"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </section>
      <section className="dash-body">{children}</section>
    </main>
  )
}
import Link from "next/link";

const features = [
  {
    title: "Property Management",
    description:
      "Manage properties, availability, details, and operations from one centralized workspace.",
    icon: "🏠",
  },
  {
    title: "Reservations",
    description:
      "Track bookings, guests, dates, status, and reservation activity with a unified workflow.",
    icon: "📅",
  },
  {
    title: "Guest Management",
    description:
      "Keep guest information organized and accessible across your property operations.",
    icon: "👥",
  },
  {
    title: "Cleaning & Maintenance",
    description:
      "Coordinate cleaning tasks and maintenance tickets so nothing gets missed.",
    icon: "🛠️",
  },
  {
    title: "Inventory",
    description:
      "Monitor supplies, stock levels, categories, and low-stock items across properties.",
    icon: "📦",
  },
  {
    title: "Reports & Insights",
    description:
      "Turn operational data into useful insights for better property management decisions.",
    icon: "📊",
  },
];

const stats = [
  ["01", "Centralized platform"],
  ["02", "Property operations"],
  ["03", "Guest & booking management"],
  ["04", "AI-ready workflows"],
];

export default function HomePage() {
  return (
    <main className="landing-page">
      {/* NAVBAR */}
      <header className="landing-nav">
        <div className="landing-container nav-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">AI</span>
            <span>AI-PMS</span>
          </Link>

          <nav className="desktop-nav">
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
            <a href="#about">About</a>
          </nav>

          <div className="nav-actions">
            <Link href="/auth/login" className="login-link">
              Login
            </Link>

            <Link href="/auth/register" className="nav-button">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-glow glow-one" />
        <div className="hero-glow glow-two" />

        <div className="landing-container hero-grid">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Intelligent Property Management
            </div>

            <h1>
              Manage your properties.
              <span> Smarter.</span>
            </h1>

            <p className="hero-description">
              AI-PMS brings property management, reservations, guests,
              cleaning, maintenance, inventory and reporting together in one
              powerful workspace.
            </p>

            <div className="hero-actions">
              <Link href="/auth/register" className="primary-button">
                Get Started
                <span>→</span>
              </Link>

              <a href="#features" className="secondary-button">
                Explore Platform
              </a>
            </div>

            <div className="hero-note">
              <span>✓</span>
              Built for modern property management teams
            </div>
          </div>

          {/* PRODUCT PREVIEW */}
          <div className="dashboard-preview">
            <div className="preview-window">
              <div className="preview-topbar">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>

                <div className="preview-url">
                  ai-pms.app/dashboard
                </div>
              </div>

              <div className="preview-body">
                <aside className="preview-sidebar">
                  <div className="mini-logo">AI</div>

                  <div className="mini-menu active">
                    <span>▦</span>
                    Dashboard
                  </div>

                  <div className="mini-menu">
                    <span>⌂</span>
                    Properties
                  </div>

                  <div className="mini-menu">
                    <span>◷</span>
                    Reservations
                  </div>

                  <div className="mini-menu">
                    <span>♙</span>
                    Guests
                  </div>

                  <div className="mini-menu">
                    <span>✓</span>
                    Cleaning
                  </div>
                </aside>

                <div className="preview-main">
                  <div className="preview-heading">
                    <div>
                      <small>Overview</small>
                      <h3>Dashboard</h3>
                    </div>

                    <div className="preview-avatar">A</div>
                  </div>

                  <div className="mini-stats">
                    <div>
                      <small>Properties</small>
                      <strong>24</strong>
                      <em>+12%</em>
                    </div>

                    <div>
                      <small>Reservations</small>
                      <strong>138</strong>
                      <em>+18%</em>
                    </div>

                    <div>
                      <small>Guests</small>
                      <strong>421</strong>
                      <em>+9%</em>
                    </div>
                  </div>

                  <div className="mini-chart">
                    <div className="chart-header">
                      <span>Reservation activity</span>
                      <small>Last 30 days</small>
                    </div>

                    <div className="chart-bars">
                      <i style={{ height: "38%" }} />
                      <i style={{ height: "52%" }} />
                      <i style={{ height: "45%" }} />
                      <i style={{ height: "67%" }} />
                      <i style={{ height: "58%" }} />
                      <i style={{ height: "78%" }} />
                      <i style={{ height: "70%" }} />
                      <i style={{ height: "90%" }} />
                      <i style={{ height: "82%" }} />
                      <i style={{ height: "96%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-card floating-one">
              <span>●</span>
              <div>
                <small>Occupancy</small>
                <strong>87.4%</strong>
              </div>
            </div>

            <div className="floating-card floating-two">
              <span>✓</span>
              <div>
                <small>Tasks completed</small>
                <strong>94 today</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST / INTRO */}
      <section className="intro-section" id="about">
        <div className="landing-container">
          <div className="section-label">ONE PLATFORM</div>

          <div className="intro-grid">
            <h2>
              Everything your property
              <br />
              operation needs.
            </h2>

            <p>
              AI-PMS is designed to simplify the day-to-day work behind
              successful property operations. Instead of switching between
              spreadsheets, booking tools, task lists and separate systems,
              your team can manage everything from one connected platform.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section" id="features">
        <div className="landing-container">
          <div className="section-heading">
            <div>
              <div className="section-label">THE PLATFORM</div>
              <h2>Built around your workflow.</h2>
            </div>

            <p>
              Powerful tools designed to make property operations organized,
              visible and easier to manage.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <div className="feature-card" key={feature.title}>
                <div className="feature-number">
                  0{index + 1}
                </div>

                <div className="feature-icon">
                  {feature.icon}
                </div>

                <h3>{feature.title}</h3>

                <p>{feature.description}</p>

                <span className="feature-arrow">↗</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="workflow-section" id="workflow">
        <div className="landing-container">
          <div className="workflow-card">
            <div className="workflow-content">
              <div className="section-label">HOW IT WORKS</div>

              <h2>
                One workspace.
                <br />
                Complete visibility.
              </h2>

              <p>
                From the moment a reservation arrives to the final operational
                task, AI-PMS keeps your team connected and your information in
                one place.
              </p>

              <Link href="/auth/register" className="primary-button">
                Enter AI-PMS
                <span>→</span>
              </Link>
            </div>

            <div className="workflow-steps">
              {stats.map(([number, title]) => (
                <div className="workflow-step" key={number}>
                  <span>{number}</span>
                  <strong>{title}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="landing-container">
          <div className="cta-content">
            <div className="section-label">READY TO START?</div>

            <h2>
              Take control of
              <br />
              your properties.
            </h2>

            <p>
              Sign in to your AI-PMS workspace and manage your operations from
              one place.
            </p>

            <Link href="/auth/login" className="primary-button large">
              Go to Login
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-container footer-inner">
          <Link href="/" className="brand">
            <span className="brand-mark">AI</span>
            <span>AI-PMS</span>
          </Link>

          <p>
            Intelligent property management for modern operations.
          </p>

          <span>© {new Date().getFullYear()} AI-PMS</span>
        </div>
      </footer>
    </main>
  );
}
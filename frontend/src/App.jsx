import { useEffect, useState } from "react";
import { useProviders } from "./useBalance.js";
import Overview from "./Overview.jsx";
import ProviderPage from "./ProviderPage.jsx";

// Minimal hash router: #/ = overview, #/<provider-id> = that dashboard.
function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, "");
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export default function App() {
  const { providers, error } = useProviders();
  const route = useRoute();
  const current = providers?.find((p) => p.id === route);

  return (
    <div className="layout">
      <nav className="nav" aria-label="Providers">
        <a className="brand" href="#/">
          <span className="logo" aria-hidden="true">B</span>
          Balances
        </a>
        <ul>
          <li>
            <a href="#/" className={!current ? "active" : ""}>
              Overview
            </a>
          </li>
          {providers?.map((p) => (
            <li key={p.id}>
              <a href={`#/${p.id}`} className={current?.id === p.id ? "active" : ""}>
                <span className={`dot dot-${p.id}`} aria-hidden="true" />
                {p.name}
                {p.status !== "ready" && <span className="nav-dim" aria-hidden="true">·</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="content">
        {error && <p className="status error">{error}</p>}
        {!providers && !error && <div className="skeleton" />}
        {providers && (current ? <ProviderPage key={current.id} provider={current} /> : <Overview providers={providers} />)}
        <p className="foot">API keys stay on the server and never reach this page.</p>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <div className="card">
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: ".08em", fontSize: 12 }}>FLIGHT DEAL ENGINE</p>
        <h1 style={{ fontSize: 42, marginBottom: 12 }}>Lowest legitimate executable cash cost.</h1>
        <p>
          This backend compares award availability with cash pricing and converts points-based strategies into the real amount of cash a passenger must spend.
        </p>
        <p>
          API health: <code>/api/health</code><br />
          Award search: <code>/api/awards/search?origin=MPM&amp;destination=KUL&amp;startDate=2026-11-10&amp;endDate=2026-11-10&amp;cabin=economy</code>
        </p>
      </div>
    </main>
  );
}

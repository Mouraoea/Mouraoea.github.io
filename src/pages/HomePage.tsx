import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <main className="home-page">
      <h1>Portfolio</h1>
      <p>Projects and tools will live here.</p>
      <nav>
        <Link to="/idleclans/market">IdleClans Market Data</Link>
        {" · "}
        <Link to="/idleclans/recipes">IdleClans Recipes</Link>
        {" · "}
        <Link to="/idleclans/profit">IdleClans Profit Calculator</Link>
      </nav>
    </main>
  );
}

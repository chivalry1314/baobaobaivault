export default function Panel({ title, subtitle, children, delay = 0 }) {
  return (
    <section className="card" style={{ animationDelay: `${delay}ms` }}>
      <header className="card-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}


export default function Panel({ title, subtitle, children, delay = 0, style, className = "" }) {
  const animationStyle = delay > 0 ? { animation: `slideDown 0.4s ease-out ${delay}ms both` } : {};

  return (
    <div className={`card ${className}`} style={{ ...animationStyle, ...style }}>
      {(title || subtitle) && (
        <div className="card-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}

type Props = {
  items: string[];
};

export function ErrorDrawer({ items }: Props) {
  return (
    <div className="card">
      <div className="panel-header">
        <h2>Logs</h2>
        {items.length > 0 ? <span className="count-chip">{items.length}</span> : null}
      </div>
      <div className="log-list">
        {items.length ? (
          items.map((item, index) => <pre key={`${item.slice(0, 40)}-${index}`}>{item}</pre>)
        ) : (
          <p className="inline-note">No recent backend logs.</p>
        )}
      </div>
    </div>
  );
}

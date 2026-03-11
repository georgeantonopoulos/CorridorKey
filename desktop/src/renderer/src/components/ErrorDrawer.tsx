type Props = {
  items: string[];
};

export function ErrorDrawer({ items }: Props) {
  return (
    <div className="card">
      <div className="panel-header">
        <h2>Logs</h2>
      </div>
      <div className="log-list">
        {items.length ? items.map((item, index) => <pre key={`${item}-${index}`}>{item}</pre>) : <p>No recent backend logs.</p>}
      </div>
    </div>
  );
}

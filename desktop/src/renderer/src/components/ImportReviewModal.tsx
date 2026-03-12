import { describeImportSource, type ImportReview } from "../lib/workflow";

type Props = {
  draft: ImportReview | null;
  busy: boolean;
  onClose: () => void;
  onToggleCopySource: (copySource: boolean) => void;
  onConfirm: () => void;
};

export function ImportReviewModal({ draft, busy, onClose, onToggleCopySource, onConfirm }: Props) {
  if (!draft) {
    return null;
  }

  const canChooseVideoMode = draft.videoCount > 0;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="import-review-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Import Review</p>
            <h2 id="import-review-title">Choose how CorridorKey should stage these files</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        <div className="modal-grid">
          <section className="modal-section">
            <h3>Selected sources</h3>
            <div className="import-source-list">
              {draft.paths.map((targetPath, index) => (
                <div key={`${targetPath}-${index}`} className="import-source-row">
                  <div>
                    <strong>{targetPath.split(/[\\/]/).pop() ?? targetPath}</strong>
                    <p>{targetPath}</p>
                  </div>
                  <span className="state-pill">{describeImportSource(draft.sourceKinds[index])}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="modal-section">
            <h3>Staging behavior</h3>
            {canChooseVideoMode ? (
              <div className="choice-stack">
                <label className={`choice-card ${draft.copySource ? "" : "selected"}`}>
                  <input
                    type="radio"
                    name="video-import-mode"
                    checked={!draft.copySource}
                    onChange={() => onToggleCopySource(false)}
                  />
                  <div>
                    <strong>Reference original video in place</strong>
                    <p>Recommended for iteration. The project keeps a pointer to the source file instead of duplicating it.</p>
                  </div>
                </label>
                <label className={`choice-card ${draft.copySource ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="video-import-mode"
                    checked={draft.copySource}
                    onChange={() => onToggleCopySource(true)}
                  />
                  <div>
                    <strong>Copy video into the managed project</strong>
                    <p>Use this when you need a fully self-contained project folder that can move with the source media.</p>
                  </div>
                </label>
              </div>
            ) : (
              <p className="inline-note">No loose video files were selected, so there is no in-place video reference option for this import.</p>
            )}

            {draft.managedCount > 0 ? (
              <div className="import-note">
                <strong>Sequence note</strong>
                <p>
                  Image sequences and folders are still normalized into each clip&apos;s managed <code>Frames/</code> folder today. That gives
                  CorridorKey a stable place to scrub, validate, and write outputs against.
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "Importing..." : "Import into CorridorKey"}
          </button>
        </div>
      </div>
    </div>
  );
}

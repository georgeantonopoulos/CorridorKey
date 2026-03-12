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
            <p className="eyebrow">Import review</p>
            <h2 id="import-review-title">How should CorridorKey stage these files?</h2>
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
                    <strong>Reference in place</strong>
                    <p>Recommended. Keeps a pointer to the source file without duplicating it.</p>
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
                    <strong>Copy into project</strong>
                    <p>Creates a self-contained project folder that can be moved with source media.</p>
                  </div>
                </label>
              </div>
            ) : (
              <p className="inline-note">No video files selected — image sequences will be normalized into the managed frame folder.</p>
            )}

            {draft.managedCount > 0 ? (
              <div className="import-note">
                <p>
                  Image sequences and folders are normalized into each clip&apos;s <code>Frames/</code> folder for
                  reliable scrubbing and inference.
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={busy}>
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

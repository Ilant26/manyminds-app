'use client';

interface DeepModeModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeepModeModal({ open, onConfirm, onCancel }: DeepModeModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="text-xl font-bold text-neutral-900">Deep mode uses more credits</h2>
        <p className="mt-3 text-neutral-500">
          Deep mode is designed for complex questions and in-depth analysis.
          It uses <strong>5 credits</strong> instead of 1 — use it when you really need a thorough answer. For
          long documents like business plans, ManyMinds will automatically generate more content.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-neutral-900 px-4 py-3 font-bold text-white hover:bg-neutral-800"
          >
            Use Deep mode
          </button>
        </div>
      </div>
    </div>
  );
}


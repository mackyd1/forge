"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-screen">
      <p className="rail-mark">Forge</p>
      <h1>This screen hit a fault.</h1>
      <p>{error.message || "Something went wrong while rendering."}</p>
      <button type="button" className="text-btn" onClick={reset}>
        Try again
      </button>
    </div>
  );
}

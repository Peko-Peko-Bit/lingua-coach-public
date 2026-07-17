export function Spinner() {
  return (
    <div
      className="w-5 h-5 rounded-full"
      style={{
        border: "2px solid transparent",
        borderTopColor: "var(--accent)",
        animation: "spin 1.2s linear infinite",
      }}
    />
  );
}

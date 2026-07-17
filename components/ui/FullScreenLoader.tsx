export function FullScreenLoader() {
  return (
    <div className="flex h-[var(--app-height)] items-center justify-center bg-[var(--bg-base)]">
      <div className="relative">
        <img
          src="/linguacoach_icon.svg"
          alt="LinguaCoach"
          className="w-14 h-14 rounded-xl"
        />
        <div
          className="absolute inset-[-7px] rounded-[19px]"
          style={{
            border: "2px solid transparent",
            borderTopColor: "var(--accent)",
            animation: "spin 1.2s linear infinite",
          }}
        />
      </div>
    </div>
  );
}

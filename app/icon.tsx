import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(iconJSX(32), { ...size });
}

export function iconJSX(sz: number) {
  const pad  = Math.round(sz * 0.18);
  const icon = sz - pad * 2;

  return (
    <div
      style={{
        width: sz,
        height: sz,
        background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: icon,
          height: icon,
          background: "rgba(99,102,241,0.18)",
          borderRadius: Math.round(icon * 0.22),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={Math.round(icon * 0.6)}
          height={Math.round(icon * 0.6)}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            stroke="#a5b4fc"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

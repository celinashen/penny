import { ImageResponse } from "next/og";

// The home-screen icon on iPhone and iPad. iOS rounds the corners itself, so
// the ink runs to the edges and only the coin is drawn.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e1512",
        }}
      >
        <div style={{ width: 74, height: 74, borderRadius: 37, background: "#4ade80" }} />
      </div>
    ),
    size,
  );
}

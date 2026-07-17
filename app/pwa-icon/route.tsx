import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { iconJSX } from "@/app/icon";

export async function GET(req: NextRequest) {
  const size = Number(req.nextUrl.searchParams.get("size") ?? "192");
  const sz   = [192, 512].includes(size) ? size : 192;

  return new ImageResponse(iconJSX(sz), { width: sz, height: sz });
}

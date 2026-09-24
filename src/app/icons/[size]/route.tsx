import { appIcon } from "@/lib/app-icon";

// PWA manifest icons: /icons/192, /icons/512, /icons/maskable-512
const SIZES: Record<string, { size: number; maskable: boolean }> = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  const icon = SIZES[size];
  if (!icon) return new Response("Not found", { status: 404 });
  return appIcon(icon.size, { maskable: icon.maskable });
}

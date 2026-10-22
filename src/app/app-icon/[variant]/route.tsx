import { renderAppIcon } from "@/lib/app-icon";

// Icons für das Web-App-Manifest; werden beim Build statisch erzeugt.
export const dynamic = "force-static";

const VARIANTS: Record<string, { size: number; inset: number }> = {
  "192.png": { size: 192, inset: 0.18 },
  "512.png": { size: 512, inset: 0.18 },
  "maskable-512.png": { size: 512, inset: 0.26 },
};

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const v = VARIANTS[(await params).variant];
  if (!v) return new Response("Nicht gefunden", { status: 404 });
  return renderAppIcon(v.size, v.inset);
}

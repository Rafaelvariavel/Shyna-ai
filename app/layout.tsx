import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shyna AI — seu espaço de inteligência artificial",
  description: "Converse com a Shyna AI, gere imagens, classifique idiomas e analise imagens.",
  applicationName: "Shyna AI",
};
export const viewport: Viewport = { themeColor: "#17191c", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

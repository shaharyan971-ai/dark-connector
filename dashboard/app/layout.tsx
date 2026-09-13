import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dark Connector | Surveillance Console",
  description: "Monitor deceptive interface patterns across the web.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}

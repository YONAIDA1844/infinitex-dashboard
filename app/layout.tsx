import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "InfiniteX | Sicoben Ediciones",
    description: "Agente de Trafico InfiniteX - Sicoben Ediciones Panama",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
          <html lang="es">
                <body>{children}</body>body>
          </html>html>
        );
}
</html>

import "./globals.css";
import { MiniKitProvider } from "@/components/MiniKitProvider";

export const metadata = { title: "Signal Market - Alien Mini App" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MiniKitProvider>{children}</MiniKitProvider>
      </body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "AdStreamHQ Partner Reports",
  description: "Partner reporting dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

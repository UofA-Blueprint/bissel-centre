import "../globals.css";

export default function CardsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 max-h-screen">
      <main className="mx-auto max-w-8xl p-6">{children}</main>
    </div>
  );
}

import AppShell from "../../components/AppShell";

export default function DashboardPage() {
  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 backdrop-blur-md">
          <p className="text-sm tracking-[0.2em] text-green-500 uppercase">
            Afacere
          </p>

          <h1 className="mt-3 text-3xl font-bold text-white">
            Angajati afacere
          </h1>

          <p className="mt-4 max-w-2xl text-zinc-300">
            Aici vor apărea informațiile generale despre angajatii din afacere.
            Acestia pot fi adaugati sau sterși doar de catre liderul afacerii.
            (ADMIN)
          </p>
        </div>
      </div>
    </AppShell>
  );
}

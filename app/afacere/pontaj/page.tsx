import AppShell from "../../components/AppShell";

export default function InventoryPage() {
  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 backdrop-blur-md">
          <p className="text-sm tracking-[0.2em] text-[#B8904D] uppercase">
            Afacere
          </p>

          <h1 className="mt-3 text-3xl font-bold text-white">Pontaj</h1>

          <p className="mt-4 text-zinc-300">
            Aici vor apărea informațiile despre pontaj.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

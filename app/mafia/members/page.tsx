export default function MafiaMembersPage() {
  return (
    <div className="p-8">
      <div className="rounded-2xl border border-red-500/20 bg-black/30 p-8 backdrop-blur-md">
        <p className="text-sm tracking-[0.2em] text-red-400 uppercase">Mafia</p>

        <h1 className="mt-3 text-3xl font-bold text-white">Membri</h1>

        <p className="mt-4 text-zinc-300">
          Lista cu toti membrii care fac parte din organizatia mafiota. Acestia
          pot fi vizualizati doar de catre membrii care fac parte din MAFIE.
          Membrii pot fi adaugati sau eliminati doar de catre liderul
          organizatiei mafiote. (ADMIN)
        </p>
      </div>
    </div>
  );
}

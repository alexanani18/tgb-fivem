import { useRef, useState } from "react";
import {
  Footprints,
  MapPin,
  Shield,
  Shirt,
  Crown,
} from "lucide-react";

interface Uniform {
  id: number;
  type: "MALE" | "FEMALE";
  title: string;
  image_path: string | null;
  store_name: string;
  shoes_rack: number;
  pants_rack: number;
  jacket_rack: number;
  hat_rack: number;
  updated_by: number | null;
  updated_at: string;
}

interface UniformCardProps {
  uniform: Uniform;
  isAdmin: boolean;
  onUpdated: (uniform: Uniform) => void;
}

export default function UniformCard({ uniform, isAdmin, onUpdated, }: UniformCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const [storeName, setStoreName] = useState(
    uniform.store_name ?? "",
  );

  const [shoesRack, setShoesRack] = useState(
    uniform.shoes_rack?.toString() ?? "",
  );

  const [pantsRack, setPantsRack] = useState(
    uniform.pants_rack?.toString() ?? "",
  );

  const [jacketRack, setJacketRack] = useState(
    uniform.jacket_rack?.toString() ?? "",
  );

  const [hatRack, setHatRack] = useState(
    uniform.hat_rack?.toString() ?? "",
  );

  const [imagePath, setImagePath] = useState(uniform.image_path);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updatedAt, setUpdatedAt] = useState(uniform.updated_at);
  const API_URL = process.env.NEXT_PUBLIC_API_URL!;

  const handleSave = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/uniforms/${uniform.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: uniform.title,
            storeName,
            shoesRack: Number(shoesRack),
            pantsRack: Number(pantsRack),
            jacketRack: Number(jacketRack),
            hatRack: Number(hatRack),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Actualizarea a eșuat.");
      }
      if (selectedImage) {
        const formData = new FormData();

        formData.append("image", selectedImage);

        const imageResponse = await fetch(
          `${API_URL}/api/uniforms/${uniform.id}/image`,
          {
            method: "PATCH",
            credentials: "include",
            body: formData,
          },
        );

        const imageData = await imageResponse.json();

        if (!imageResponse.ok || !imageData.success) {
          throw new Error(
            imageData.message ?? "Imaginea nu a putut fi actualizată.",
          );
        }

        setImagePath(imageData.uniform.image_path);
        setSelectedImage(null);
        onUpdated(imageData.uniform);

      }
      setStoreName(data.uniform.store_name ?? "");
      setShoesRack(data.uniform.shoes_rack?.toString() ?? "");
      setPantsRack(data.uniform.pants_rack?.toString() ?? "");
      setJacketRack(data.uniform.jacket_rack?.toString() ?? "");
      setHatRack(data.uniform.hat_rack?.toString() ?? "");
      setUpdatedAt(data.uniform.updated_at);
      onUpdated(data.uniform);
      setIsEditing(false);
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Actualizarea a eșuat.",
      );
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-[#B8904D]/30 bg-black/65 shadow-2xl backdrop-blur-md">
      <header className="border-b border-[#B8904D]/20 px-6 py-5">
        <h2 className="text-center text-2xl font-bold tracking-wide text-[#B8904D]">
          {uniform.title}
        </h2>
      </header>

      <div className="p-6">
        <div className="relative mb-6 aspect-[16/10] overflow-hidden rounded-xl border border-[#B8904D]/20 bg-zinc-900">
          <>
            {imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  imagePath?.startsWith("blob:")
                    ? imagePath
                    : `${API_URL}/${imagePath}`
                }
                alt={uniform.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm tracking-wide text-zinc-500">
                Imagine indisponibilă
              </div>
            )}

            {isAdmin && isEditing && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (!file) {
                      return;
                    }

                    setSelectedImage(file);

                    const preview = URL.createObjectURL(file);

                    setImagePath(preview);
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/65 text-sm font-semibold tracking-wide text-white opacity-0 transition hover:opacity-100"
                >
                  Schimbă imaginea
                </button>
              </>
            )}
          </>
        </div>

        <div className="flex min-h-[380px] flex-col rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
          <div className="space-y-5">

            {/* Magazin */}
            <div className="grid grid-cols-[24px_110px_1fr] items-center gap-4">
              <MapPin className="h-5 w-5 text-[#B8904D]" />

              <span className="text-sm font-medium text-zinc-300">
                Magazin
              </span>

              {isEditing ? (
                <input
                  type="text"
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  className="w-full max-w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none transition focus:border-[#B8904D]"
                />
              ) : (
                <span className="text-white">
                  {storeName}
                </span>
              )}
            </div>

            {/* Pantofi */}
            <div className="grid grid-cols-[24px_110px_1fr] items-center gap-4">
              <Footprints className="h-5 w-5 text-[#B8904D]" />

              <span className="text-sm font-medium text-zinc-300">
                Pantofi
              </span>

              {isEditing ? (
                <input
                  type="text"
                  value={shoesRack}
                  onChange={(event) => setShoesRack(event.target.value)}
                  className="h-7 w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-white outline-none transition focus:border-[#B8904D]"
                />
              ) : (
                <span className="text-white">
                  Raft #{shoesRack}
                </span>
              )}
            </div>

            {/* Pantaloni */}
            <div className="grid grid-cols-[24px_110px_1fr] items-center gap-4">
              <Shirt className="h-5 w-5 text-[#B8904D]" />

              <span className="text-sm font-medium text-zinc-300">
                Pantaloni
              </span>

              {isEditing ? (
                <input
                  type="text"
                  value={pantsRack}
                  onChange={(event) => setPantsRack(event.target.value)}
                  className="h-7 w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-white outline-none transition focus:border-[#B8904D]"
                />
              ) : (
                <span className="text-white">
                  Raft #{pantsRack}
                </span>
              )}
            </div>

            {/* Geacă */}
            <div className="grid grid-cols-[24px_110px_1fr] items-center gap-4">
              <Shield className="h-5 w-5 text-[#B8904D]" />

              <span className="text-sm font-medium text-zinc-300">
                Geacă
              </span>

              {isEditing ? (
                <input
                  type="text"
                  value={jacketRack}
                  onChange={(event) => setJacketRack(event.target.value)}
                  className="h-7 w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-white outline-none transition focus:border-[#B8904D]"
                />
              ) : (
                <span className="text-white">
                  Raft #{jacketRack}
                </span>
              )}
            </div>

            {/* Pălărie */}
            <div className="grid grid-cols-[24px_110px_1fr] items-center gap-4">
              <Crown className="h-5 w-5 text-[#B8904D]" />

              <span className="text-sm font-medium text-zinc-300">
                Pălărie
              </span>

              {isEditing ? (
                <input
                  type="text"
                  value={hatRack}
                  onChange={(event) => setHatRack(event.target.value)}
                  className="h-7 w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-center text-white outline-none transition focus:border-[#B8904D]"
                />
              ) : (
                <span className="text-white">
                  Raft #{hatRack}
                </span>
              )}
            </div>
          </div>

          <div className="mt-auto border-t border-zinc-800 pt-2">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Ultima actualizare
            </p>

            <p className="mt-1 text-sm text-zinc-300">
              {new Date(updatedAt).toLocaleString("ro-RO")}
            </p>
          </div>

          {isAdmin && (
            <div className="border-t border-zinc-800 pt-5">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full rounded-xl border border-[#B8904D]/40 bg-[#B8904D]/10 px-4 py-3 text-sm font-semibold text-[#B8904D] transition hover:bg-[#B8904D]/20"
                >
                  Editează
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStoreName(uniform.store_name ?? "");
                      setShoesRack(uniform.shoes_rack?.toString() ?? "");
                      setPantsRack(uniform.pants_rack?.toString() ?? "");
                      setJacketRack(uniform.jacket_rack?.toString() ?? "");
                      setHatRack(uniform.hat_rack?.toString() ?? "");
                      setUpdatedAt(uniform.updated_at);
                      setImagePath(uniform.image_path);
                      setSelectedImage(null);

                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }

                      setIsEditing(false);
                    }}
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Anulează
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-xl border border-[#B8904D]/40 bg-[#B8904D] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                  >
                    Salvează
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
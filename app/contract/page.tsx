"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import AppShell from "../components/AppShell";

type ContractStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED";

interface ContractData {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  age: number;
  gameId: string;
  ciSeries: string;
  phoneNumber: string;
  cityHours: number;
  identityImagePath: string;
  acceptedRules: boolean;
  employeeSignatureName: string | null;
  status: ContractStatus;
  rejectionReason: string | null;
  contractCreationBlocked: boolean;
  signedAt: string | null;
  approvedByUserId: number | null;
  approvedByName: string | null;
  adminSignaturePath: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContractResponse {
  success: boolean;
  contract: ContractData | null;
  canCreateContract: boolean;
  message?: string;
}

export default function ContractPage() {
  const [contract, setContract] = useState<ContractData | null>(null);
  const [canCreateContract, setCanCreateContract] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gameId, setGameId] = useState("");
  const [ciSeries, setCiSeries] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [cityHours, setCityHours] = useState("");
  const [identityImage, setIdentityImage] = useState<File | null>(null);
  const [identityImagePreview, setIdentityImagePreview] = useState("");
  const [identityImageError, setIdentityImageError] = useState("");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  function handleIdentityImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    setIdentityImageError("");

    if (!file) {
      setIdentityImage(null);
      setIdentityImagePreview("");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png"];
    const maximumSize = 5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      event.target.value = "";
      setIdentityImage(null);
      setIdentityImagePreview("");
      setIdentityImageError(
        "Poza buletinului trebuie să fie în format JPG sau PNG.",
      );
      return;
    }

    if (file.size > maximumSize) {
      event.target.value = "";
      setIdentityImage(null);
      setIdentityImagePreview("");
      setIdentityImageError("Poza buletinului poate avea maximum 5 MB.");
      return;
    }

    setIdentityImage(file);
    setIdentityImagePreview(URL.createObjectURL(file));
  }

  useEffect(() => {
    return () => {
      if (identityImagePreview) {
        URL.revokeObjectURL(identityImagePreview);
      }
    };
  }, [identityImagePreview]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      async function loadContract() {
        try {
          setIsLoading(true);
          setErrorMessage("");

          const response = await fetch("http://localhost:5000/contracts/me", {
            method: "GET",
            credentials: "include",
          });

          const data = (await response.json()) as ContractResponse;

          if (!response.ok || !data.success) {
            throw new Error(
              data.message ?? "Contractul nu a putut fi încărcat.",
            );
          }

          setContract(data.contract);
          setCanCreateContract(data.canCreateContract);
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "A apărut o eroare necunoscută.",
          );
        } finally {
          setIsLoading(false);
        }
      }

      void loadContract();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  async function handleSignContract() {
    setSubmitMessage("");
    setSubmitError("");

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedAge = Number(age);
    const normalizedCityHours = Number(cityHours);

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !age ||
      !gameId.trim() ||
      !ciSeries.trim() ||
      !phoneNumber.trim() ||
      !cityHours ||
      !identityImage ||
      !acceptedRules
    ) {
      setSubmitError(
        "Trebuie să completezi toate câmpurile, să încarci poza buletinului și să accepți regulamentul.",
      );
      return;
    }

    if (
      !Number.isInteger(normalizedAge) ||
      normalizedAge < 1 ||
      normalizedAge > 100
    ) {
      setSubmitError("Vârsta introdusă nu este validă.");
      return;
    }

    if (
      !Number.isInteger(normalizedCityHours) ||
      normalizedCityHours < 0 ||
      normalizedCityHours > 100000
    ) {
      setSubmitError("Valoarea introdusă la luni pe oraș nu este validă.");
      return;
    }

    const formData = new FormData();

    formData.append("firstName", normalizedFirstName);
    formData.append("lastName", normalizedLastName);
    formData.append("age", String(normalizedAge));
    formData.append("gameId", gameId.trim());
    formData.append("ciSeries", ciSeries.trim());
    formData.append("phoneNumber", phoneNumber.trim());
    formData.append("cityHours", String(normalizedCityHours));
    formData.append("acceptedRules", "true");
    formData.append("identityImage", identityImage);

    try {
      setIsSubmitting(true);

      const response = await fetch("http://localhost:5000/contracts/sign", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        contract?: ContractData;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Contractul nu a putut fi semnat.");
      }

      setSubmitMessage(
        data.message ??
          "Contractul a fost semnat și trimis către ADMIN pentru verificare.",
      );

      const refreshedResponse = await fetch(
        "http://localhost:5000/contracts/me",
        {
          method: "GET",
          credentials: "include",
        },
      );

      const refreshedData =
        (await refreshedResponse.json()) as ContractResponse;

      if (refreshedResponse.ok && refreshedData.success) {
        setContract(refreshedData.contract);
        setCanCreateContract(refreshedData.canCreateContract);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la semnarea contractului.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const employeeSignatureName =
    lastName.trim() && firstName.trim()
      ? `${lastName.trim()} ${firstName.trim()}`
      : "";

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="min-h-full p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-amber-500/20 bg-black/75 p-8 shadow-2xl backdrop-blur-md">
            <p className="text-sm font-semibold tracking-[0.25em] text-amber-400 uppercase">
              The Gentleman Blackfold
            </p>

            <h1 className="mt-3 text-3xl font-bold text-white">
              Contract de angajare
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              Completează toate datele solicitate pentru a trimite contractul
              către administrație.
            </p>

            <div className="mt-8 border-t border-white/10 pt-8">
              {isLoading && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                  <p className="text-sm text-zinc-300">
                    Se încarcă informațiile contractului...
                  </p>
                </div>
              )}

              {!isLoading && errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
                  <p className="text-sm font-medium text-red-300">
                    {errorMessage}
                  </p>
                </div>
              )}

              {!isLoading &&
                !errorMessage &&
                !contract &&
                canCreateContract && (
                  <div className="rounded-2xl border border-amber-500/20 bg-black/40 p-6">
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
                          Secțiunea 01
                        </p>

                        <h2 className="mt-2 text-xl font-semibold text-white">
                          Date personale
                        </h2>

                        <p className="mt-2 text-sm text-zinc-400">
                          Completează datele personajului exact așa cum trebuie
                          să apară în contract.
                        </p>
                      </div>

                      <div className="hidden rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 md:block">
                        Toate câmpurile sunt obligatorii
                      </div>
                    </div>

                    <div className="mt-10 border-t border-white/10 pt-8">
                      <div>
                        <h2 className=" text-xl font-semibold text-white">
                          Poză buletin
                        </h2>

                        <p className="mt-2 text-sm text-zinc-400">
                          Încarcă o imagine clară a actului de identitate al
                          personajului.
                        </p>
                      </div>

                      <div className="mt-6 grid gap-6 lg:grid-cols-2">
                        <label
                          htmlFor="identityImage"
                          className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-amber-500/30 bg-black/30 px-8 py-10 text-center transition hover:border-amber-400/60 hover:bg-amber-500/5"
                        >
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-2xl text-amber-400">
                            +
                          </div>

                          <p className="mt-4 font-semibold text-white">
                            Selectează poza buletinului
                          </p>

                          <p className="mt-2 text-sm text-zinc-500">
                            Formate acceptate: JPG și PNG
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            Dimensiune maximă: 5 MB
                          </p>

                          {identityImage && (
                            <p className="mt-4 max-w-full truncate text-sm font-medium text-amber-300">
                              {identityImage.name}
                            </p>
                          )}

                          <input
                            id="identityImage"
                            type="file"
                            accept="image/jpeg,image/png"
                            onChange={handleIdentityImageChange}
                            className="sr-only"
                          />
                        </label>

                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                          {identityImagePreview ? (
                            <div className="relative min-h-64 w-full">
                              <Image
                                src={identityImagePreview}
                                alt="Previzualizare buletin"
                                fill
                                unoptimized
                                className="object-contain p-4"
                              />
                            </div>
                          ) : (
                            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                              <p className="text-sm font-medium text-zinc-400">
                                Previzualizare imagine
                              </p>

                              <p className="mt-2 text-xs text-zinc-600">
                                Imaginea selectată va apărea aici.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {identityImageError && (
                        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                          <p className="text-sm font-medium text-red-300">
                            {identityImageError}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="lastName"
                          className="text-sm font-medium text-zinc-200"
                        >
                          Nume
                        </label>

                        <input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
                          placeholder="Ex: Popescu"
                          maxLength={100}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="firstName"
                          className="text-sm font-medium text-zinc-200"
                        >
                          Prenume
                        </label>

                        <input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                          placeholder="Ex: Andrei"
                          maxLength={100}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="age"
                          className="text-sm font-medium text-zinc-200"
                        >
                          Vârstă
                        </label>

                        <input
                          id="age"
                          type="number"
                          value={age}
                          onChange={(event) => setAge(event.target.value)}
                          placeholder="Ex: 24"
                          min={1}
                          max={100}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="gameId"
                          className="text-sm font-medium text-zinc-200"
                        >
                          CNP / ID joc
                        </label>

                        <input
                          id="gameId"
                          type="text"
                          value={gameId}
                          onChange={(event) => setGameId(event.target.value)}
                          placeholder="Ex: 14352"
                          maxLength={50}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ciSeries"
                          className="text-sm font-medium text-zinc-200"
                        >
                          Serie CI
                        </label>

                        <input
                          id="ciSeries"
                          type="text"
                          value={ciSeries}
                          onChange={(event) =>
                            setCiSeries(event.target.value.toUpperCase())
                          }
                          placeholder="Ex: AR 123456"
                          maxLength={50}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white uppercase outline-none transition placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="phoneNumber"
                          className="text-sm font-medium text-zinc-200"
                        >
                          Număr de telefon
                        </label>

                        <input
                          id="phoneNumber"
                          type="text"
                          value={phoneNumber}
                          onChange={(event) =>
                            setPhoneNumber(event.target.value)
                          }
                          placeholder="Ex: 0722 123 456"
                          maxLength={30}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label
                          htmlFor="cityHours"
                          className="text-sm font-medium text-zinc-200"
                        >
                          Luni pe oraș
                        </label>

                        <input
                          id="cityHours"
                          type="number"
                          value={cityHours}
                          onChange={(event) => setCityHours(event.target.value)}
                          placeholder="Ex: 250"
                          min={0}
                          max={100000}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10"
                        />

                        <p className="mt-2 text-xs text-zinc-500">
                          Introdu doar valoarea numerică, fără text suplimentar.
                        </p>
                      </div>
                    </div>
                    <div className="mt-10 border-t border-white/10 pt-8">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
                          Secțiunea 03
                        </p>

                        <h2 className="mt-2 text-xl font-semibold text-white">
                          Regulament intern
                        </h2>

                        <p className="mt-2 text-sm text-zinc-400">
                          Citește regulamentul complet înainte de a continua.
                        </p>
                      </div>

                      <div className="mt-6 overflow-hidden rounded-2xl border border-amber-500/20 bg-black/30">
                        <div className="max-h-80 overflow-y-auto p-6">
                          <div className="space-y-6 text-sm leading-7 text-zinc-300">
                            <div>
                              <h3 className="font-semibold text-amber-300">
                                1. Respect și conduită
                              </h3>

                              <p className="mt-2">
                                Fiecare membru trebuie să păstreze un
                                comportament respectuos față de ceilalți membri
                                și față de conducerea organizației.
                              </p>
                            </div>

                            <div>
                              <h3 className="font-semibold text-amber-300">
                                2. Confidențialitate
                              </h3>

                              <p className="mt-2">
                                Informațiile interne, activitățile, deciziile și
                                materialele organizației nu pot fi distribuite
                                persoanelor din exterior.
                              </p>
                            </div>

                            <div>
                              <h3 className="font-semibold text-amber-300">
                                3. Activitate
                              </h3>

                              <p className="mt-2">
                                Membrii trebuie să participe activ și să își
                                îndeplinească responsabilitățile asumate.
                              </p>
                            </div>

                            <div>
                              <h3 className="font-semibold text-amber-300">
                                4. Sancțiuni
                              </h3>

                              <p className="mt-2">
                                Încălcarea regulamentului poate duce la
                                avertisment, suspendare sau eliminarea
                                definitivă din organizație.
                              </p>
                            </div>

                            <div>
                              <h3 className="font-semibold text-amber-300">
                                5. Confirmare
                              </h3>

                              <p className="mt-2">
                                Prin semnarea contractului, utilizatorul
                                confirmă că a citit, înțeles și acceptat toate
                                regulile prezentate.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-white/10 bg-black/30 p-5">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={acceptedRules}
                              onChange={(event) =>
                                setAcceptedRules(event.target.checked)
                              }
                              className="mt-1 h-4 w-4 rounded border-white/20 bg-black accent-amber-500"
                            />

                            <span className="text-sm leading-6 text-zinc-300">
                              Am citit și accept regulamentul intern și sunt de
                              acord cu termenii acestui contract.
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="mt-10 border-t border-white/10 pt-8">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
                          Secțiunea 04
                        </p>

                        <h2 className="mt-2 text-xl font-semibold text-white">
                          Semnătura ta
                        </h2>

                        <p className="mt-2 text-sm text-zinc-400">
                          Semnătura se va genera automat folosind numele și
                          prenumele completate mai sus.
                        </p>
                      </div>

                      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
                          <p className="text-xs font-semibold tracking-[0.15em] text-zinc-500 uppercase">
                            Data semnării
                          </p>

                          <p className="mt-2 text-sm font-medium text-white">
                            Se va completa automat la trimiterea contractului.
                          </p>

                          <div className="mt-6 border-t border-white/10 pt-6">
                            <p className="text-xs font-semibold tracking-[0.15em] text-zinc-500 uppercase">
                              Semnatar
                            </p>

                            <p className="mt-2 text-lg font-semibold text-white">
                              {employeeSignatureName || "Nume Prenume"}
                            </p>
                          </div>
                        </div>

                        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-amber-500/20 bg-black/30 p-8 text-center">
                          <p className="text-xs font-semibold tracking-[0.15em] text-zinc-500 uppercase">
                            Semnătură automată
                          </p>

                          <p
                            className="mt-8 text-4xl text-amber-300 sm:text-5xl"
                            style={{
                              fontFamily: "cursive",
                            }}
                          >
                            {employeeSignatureName || "Semnătura ta"}
                          </p>

                          <p className="mt-8 max-w-md text-xs leading-5 text-zinc-500">
                            Prin apăsarea butonului de semnare confirmi că toate
                            datele introduse sunt corecte.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      {submitError && (
                        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                          <p className="text-sm font-medium text-red-300">
                            {submitError}
                          </p>
                        </div>
                      )}

                      {submitMessage && (
                        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                          <p className="text-sm font-medium text-emerald-300">
                            {submitMessage}
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleSignContract()}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-amber-400/30 bg-gradient-to-b from-amber-500/80 to-amber-700/80 px-6 py-4 text-base font-semibold tracking-wide text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSubmitting
                          ? "Se trimite contractul..."
                          : "Semnează și trimite contractul"}
                      </button>

                      <p className="mt-3 text-center text-xs text-zinc-500">
                        După semnare, contractul nu mai poate fi modificat cât
                        timp este în verificare.
                      </p>
                    </div>
                  </div>
                )}

              {!isLoading && !errorMessage && contract && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                  <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                    Status contract
                  </p>

                  <p className="mt-2 text-lg font-semibold text-amber-400">
                    {contract.status}
                  </p>

                  <p className="mt-3 text-sm text-zinc-300">
                    Contract pentru{" "}
                    <span className="font-semibold text-white">
                      {contract.lastName} {contract.firstName}
                    </span>
                  </p>
                </div>
              )}

              {!isLoading &&
                !errorMessage &&
                !contract &&
                !canCreateContract && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
                    <p className="font-semibold text-red-300">
                      Nu poți crea un contract.
                    </p>

                    <p className="mt-2 text-sm text-red-200/70">
                      Contul tău nu are permisiunea necesară pentru această
                      acțiune.
                    </p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

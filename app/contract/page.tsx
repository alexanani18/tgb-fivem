"use client";

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
                  <div className="rounded-xl border border-amber-500/20 bg-white/5 p-6">
                    <p className="font-semibold text-white">
                      Nu ai încă un contract.
                    </p>

                    <p className="mt-2 text-sm text-zinc-400">
                      Formularul de completare va apărea în această zonă.
                    </p>
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

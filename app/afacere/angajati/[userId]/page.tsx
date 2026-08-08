"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Car,
  FileText,
  IdCard,
  LoaderCircle,
  RefreshCw,
  Save,
  Shirt,
  UserRound,
} from "lucide-react";

import AppShell from "../../../components/AppShell";

type EmployeeStatus = "ACTIV" | "CONCEDIU" | "DEMISIONAT";

type ContractStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | null;

type ActiveTab = "general" | "contract";

interface EmployeeContract {
  firstName: string;
  lastName: string;
  age: number | null;
  iban: string | number;
  ciSeries: string;
  phoneNumber: string;
  cityHours: string | number;
  identityImagePath: string | null;
  employeeSignatureName: string | null;
  status: ContractStatus;
  signedAt: string | null;
  approvedByName: string | null;
  adminSignaturePath: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
}

interface Employee {
  id: number;
  username: string;
  websiteRole: string;

  rankId: number | null;
  rank: string;

  isActive: boolean;
  status: EmployeeStatus;

  createdAt: string;
  updatedAt: string;

  meetingAttendance: boolean;
  hasUniform: boolean;
  hasCar: boolean;

  discordId: string;
  observations: string;

  contract: EmployeeContract;
}

interface EmployeeResponse {
  success: boolean;
  message?: string;
  employee?: Employee;
}

interface Rank {
  id: number;
  name: string;
  sortOrder: number;
}

interface RanksResponse {
  success: boolean;
  message?: string;
  ranks?: Rank[];
}

interface UpdateEmployeeResponse {
  success: boolean;
  message?: string;
}

interface EmployeeEditForm {
  rankId: number | null;
  status: EmployeeStatus;
  isActive: boolean;
  discordId: string;
  observations: string;
  meetingAttendance: boolean;
  hasUniform: boolean;
  hasCar: boolean;
}

interface ContractEditForm {
  firstName: string;
  lastName: string;
  age: string;
  iban: string;
  ciSeries: string;
  phoneNumber: string;
  cityHours: string;
  status: Exclude<ContractStatus, null>;
  employeeSignatureName: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function formatDate(dateValue: string | null): string {
  if (!dateValue) {
    return "—";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Dată indisponibilă";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function createEditForm(employee: Employee): EmployeeEditForm {
  return {
    rankId: employee.rankId,
    status: employee.status,
    isActive: employee.isActive,
    discordId: employee.discordId,
    observations: employee.observations,
    meetingAttendance: employee.meetingAttendance,
    hasUniform: employee.hasUniform,
    hasCar: employee.hasCar,
  };
}

export default function EmployeeDetailsPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = params.userId;

  const searchParams = useSearchParams();

  const cameFromArchive = searchParams.get("from") === "archive";

  const backHref = cameFromArchive
    ? "/afacere/angajati/arhiva"
    : "/afacere/angajati";

  const backLabel = cameFromArchive ? "Înapoi la arhivă" : "Înapoi la angajați";

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [editForm, setEditForm] = useState<EmployeeEditForm | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("general");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResigning, setIsResigning] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  const [contractEditForm, setContractEditForm] =
    useState<ContractEditForm | null>(null);

  const [isSavingContract, setIsSavingContract] = useState(false);
  const [contractSaveMessage, setContractSaveMessage] = useState("");
  const [contractErrorMessage, setContractErrorMessage] = useState("");

  const [selectedIdentityImage, setSelectedIdentityImage] =
    useState<File | null>(null);

  const [isUploadingIdentityImage, setIsUploadingIdentityImage] =
    useState(false);

  const loadEmployee = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage("");

        const response = await fetch(`${API_URL}/users/${userId}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = (await response.json()) as EmployeeResponse;

        if (!response.ok || !data.employee) {
          setEmployee(null);
          setEditForm(null);

          setErrorMessage(
            data.message || "Datele angajatului nu au putut fi încărcate.",
          );

          return;
        }

        setEmployee(data.employee);
        setContractEditForm({
          firstName: data.employee.contract.firstName,
          lastName: data.employee.contract.lastName,
          age:
            data.employee.contract.age !== null
              ? String(data.employee.contract.age)
              : "",
          iban: String(data.employee.contract.iban ?? ""),
          ciSeries: data.employee.contract.ciSeries,
          phoneNumber: data.employee.contract.phoneNumber,
          cityHours: String(data.employee.contract.cityHours ?? ""),
          status: data.employee.contract.status ?? "DRAFT",
          employeeSignatureName:
            data.employee.contract.employeeSignatureName ?? "",
        });
        setEditForm(createEditForm(data.employee));
      } catch (error) {
        console.error("Load employee details request error:", error);

        setEmployee(null);
        setEditForm(null);

        setErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId],
  );

  const loadRanks = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/users/ranks`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await response.json()) as RanksResponse;

      if (!response.ok) {
        setRanks([]);
        return;
      }

      setRanks(data.ranks ?? []);
    } catch (error) {
      console.error("Load ranks request error:", error);
      setRanks([]);
    }
  }, []);

  async function handleSaveEmployee() {
    if (!employee || !editForm) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");
      setSaveErrorMessage("");

      const response = await fetch(`${API_URL}/users/${employee.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      const data = (await response.json()) as UpdateEmployeeResponse;

      if (!response.ok) {
        setSaveErrorMessage(
          data.message || "Modificările nu au putut fi salvate.",
        );

        return;
      }

      setSaveMessage(data.message || "Datele angajatului au fost actualizate.");

      await loadEmployee(true);
    } catch (error) {
      console.error("Save employee request error:", error);

      setSaveErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleResetForm() {
    if (!employee) {
      return;
    }

    setEditForm(createEditForm(employee));
    setSaveMessage("");
    setSaveErrorMessage("");
  }

  async function handleResignEmployee() {
    if (!employee) {
      return;
    }

    const confirmed = window.confirm(
      `Ești sigur că vrei să marchezi angajatul ${
        employee.contract.firstName || employee.username
      } ${employee.contract.lastName} ca demisionat? Contul va fi dezactivat.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsResigning(true);
      setSaveMessage("");
      setSaveErrorMessage("");

      const response = await fetch(`${API_URL}/users/${employee.id}/resign`, {
        method: "PATCH",
        credentials: "include",
      });

      const data = (await response.json()) as UpdateEmployeeResponse;

      if (!response.ok) {
        setSaveErrorMessage(
          data.message || "Angajatul nu a putut fi marcat ca demisionat.",
        );

        return;
      }

      router.push("/afacere/angajati");
      router.refresh();
    } catch (error) {
      console.error("Resign employee request error:", error);

      setSaveErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
    } finally {
      setIsResigning(false);
    }
  }

  async function handleSaveContract() {
    if (!employee || !contractEditForm) {
      return;
    }

    try {
      setIsSavingContract(true);
      setContractSaveMessage("");
      setContractErrorMessage("");

      const response = await fetch(`${API_URL}/users/${employee.id}/contract`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...contractEditForm,
          age: Number(contractEditForm.age),
          cityHours: Number(contractEditForm.cityHours),
        }),
      });

      const data = (await response.json()) as UpdateEmployeeResponse;

      if (!response.ok) {
        setContractErrorMessage(
          data.message || "Datele contractului nu au putut fi salvate.",
        );

        return;
      }

      setContractSaveMessage(
        data.message || "Datele contractului au fost actualizate.",
      );

      await loadEmployee(true);
    } catch (error) {
      console.error("Save employee contract error:", error);

      setContractErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
    } finally {
      setIsSavingContract(false);
    }
  }

  async function handleUploadIdentityImage() {
    if (!employee || !selectedIdentityImage) {
      return;
    }

    try {
      setIsUploadingIdentityImage(true);
      setContractSaveMessage("");
      setContractErrorMessage("");

      const formData = new FormData();

      formData.append("identityImage", selectedIdentityImage);

      const response = await fetch(
        `${API_URL}/users/${employee.id}/contract/identity-image`,
        {
          method: "PATCH",
          credentials: "include",
          body: formData,
        },
      );

      const data = (await response.json()) as UpdateEmployeeResponse;

      if (!response.ok) {
        setContractErrorMessage(
          data.message || "Poza de buletin nu a putut fi actualizată.",
        );

        return;
      }

      setSelectedIdentityImage(null);

      setContractSaveMessage(
        data.message || "Poza de buletin a fost actualizată.",
      );

      await loadEmployee(true);
    } catch (error) {
      console.error("Upload identity image error:", error);

      setContractErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
    } finally {
      setIsUploadingIdentityImage(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void Promise.all([loadEmployee(), loadRanks()]);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadEmployee, loadRanks]);

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="mx-auto w-full rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-md">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
              >
                <ArrowLeft size={17} />
                {backLabel}
              </Link>

              <p className="mt-6 text-sm tracking-[0.2em] text-[#B8904D] uppercase">
                Fișă angajat
              </p>

              <h1 className="mt-3 text-3xl font-bold text-white">
                {employee
                  ? `${employee.contract.firstName || employee.username} ${
                      employee.contract.lastName
                    }`.trim()
                  : "Arhiva"}
              </h1>

              {employee ? (
                <p className="mt-3 text-zinc-400">@{employee.username}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void loadEmployee(true)}
              disabled={isLoading || isRefreshing || isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={isRefreshing ? "animate-spin" : ""}
              />
              Reîncarcă
            </button>
          </div>

          {isLoading ? (
            <div className="flex min-h-[450px] items-center justify-center">
              <div className="flex items-center gap-3 text-zinc-300">
                <LoaderCircle
                  size={23}
                  className="animate-spin text-[#B8904D]"
                />
                Se încarcă datele angajatului...
              </div>
            </div>
          ) : errorMessage ? (
            <div className="mt-8 flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-6 text-center">
              <AlertCircle size={35} className="text-red-400" />

              <p className="mt-4 font-medium text-white">
                Angajatul nu a putut fi încărcat
              </p>

              <p className="mt-2 text-sm text-zinc-400">{errorMessage}</p>

              <button
                type="button"
                onClick={() => void loadEmployee()}
                className="mt-5 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
              >
                Încearcă din nou
              </button>
            </div>
          ) : employee ? (
            <>
              <div className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10">
                <TabButton
                  active={activeTab === "general"}
                  onClick={() => setActiveTab("general")}
                >
                  General
                </TabButton>

                <TabButton
                  active={activeTab === "contract"}
                  onClick={() => setActiveTab("contract")}
                >
                  Contract
                </TabButton>

                <TabButton disabled>Istoric</TabButton>
                <TabButton disabled>Pontaj</TabButton>
                <TabButton disabled>Documente</TabButton>
              </div>

              {activeTab === "general" ? (
                <GeneralTab
                  employee={employee}
                  ranks={ranks}
                  editForm={editForm}
                  isSaving={isSaving}
                  isResigning={isResigning}
                  saveMessage={saveMessage}
                  saveErrorMessage={saveErrorMessage}
                  onFormChange={setEditForm}
                  onSave={() => void handleSaveEmployee()}
                  onReset={handleResetForm}
                  onResign={() => void handleResignEmployee()}
                />
              ) : (
                <ContractTab
                  employee={employee}
                  editForm={contractEditForm}
                  isSaving={isSavingContract}
                  isUploadingImage={isUploadingIdentityImage}
                  saveMessage={contractSaveMessage}
                  errorMessage={contractErrorMessage}
                  selectedIdentityImage={selectedIdentityImage}
                  onFormChange={setContractEditForm}
                  onSelectIdentityImage={setSelectedIdentityImage}
                  onSave={() => void handleSaveContract()}
                  onUploadIdentityImage={() => void handleUploadIdentityImage()}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

interface GeneralTabProps {
  employee: Employee;
  ranks: Rank[];
  editForm: EmployeeEditForm | null;
  isSaving: boolean;
  isResigning: boolean;
  saveMessage: string;
  saveErrorMessage: string;
  onResign: () => void;
  onFormChange: (form: EmployeeEditForm) => void;
  onSave: () => void;
  onReset: () => void;
}

function GeneralTab({
  employee,
  ranks,
  editForm,
  isSaving,
  isResigning,
  saveMessage,
  saveErrorMessage,
  onFormChange,
  onSave,
  onReset,
  onResign,
}: GeneralTabProps) {
  if (!editForm) {
    return null;
  }

  function updateForm<Key extends keyof EmployeeEditForm>(
    key: Key,
    value: EmployeeEditForm[Key],
  ) {
    onFormChange({
      ...(editForm as EmployeeEditForm),
      [key]: value,
    });
  }

  return (
    <div className="mt-8 space-y-8">
      <section>
        <SectionTitle icon={UserRound} title="Informații generale" />

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InformationCard label="Username" value={employee.username} />

          <InformationCard label="Rol website" value={employee.websiteRole} />

          <EditableField label="Grad">
            <select
              value={editForm.rankId ?? ""}
              onChange={(event) =>
                updateForm(
                  "rankId",
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-[#B8904D]/60"
            >
              <option value="">Fără grad</option>

              {ranks.map((rank) => (
                <option key={rank.id} value={rank.id}>
                  {rank.name}
                </option>
              ))}
            </select>
          </EditableField>

          <EditableField label="Status">
            <select
              value={editForm.status}
              onChange={(event) =>
                updateForm("status", event.target.value as EmployeeStatus)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-[#B8904D]/60"
            >
              <option value="ACTIV">Activ</option>
              <option value="CONCEDIU">Concediu</option>
              <option value="DEMISIONAT">Demisionat</option>
            </select>
          </EditableField>

          <EditableField label="Cont activ">
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/50 px-4">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(event) =>
                  updateForm("isActive", event.target.checked)
                }
                className="h-5 w-5 cursor-pointer accent-[#B8904D]"
              />

              <span className="text-sm text-white">
                {editForm.isActive ? "Activ" : "Inactiv"}
              </span>
            </label>
          </EditableField>

          <InformationCard
            label="Data angajării"
            value={formatDate(employee.createdAt)}
          />

          <InformationCard
            label="Ultima actualizare"
            value={formatDate(employee.updatedAt)}
          />

          <EditableField label="ID Discord">
            <input
              type="text"
              value={editForm.discordId}
              maxLength={30}
              onChange={(event) => updateForm("discordId", event.target.value)}
              placeholder="ID Discord"
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#B8904D]/60"
            />
          </EditableField>
        </div>
      </section>

      <section>
        <SectionTitle icon={BadgeCheck} title="Administrare" />

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <EditableBooleanCard
            icon={CalendarDays}
            label="Prezență ședință"
            checked={editForm.meetingAttendance}
            onChange={(checked) => updateForm("meetingAttendance", checked)}
          />

          <EditableBooleanCard
            icon={Shirt}
            label="Uniformă"
            checked={editForm.hasUniform}
            onChange={(checked) => updateForm("hasUniform", checked)}
          />

          <EditableBooleanCard
            icon={Car}
            label="Mașină"
            checked={editForm.hasCar}
            onChange={(checked) => updateForm("hasCar", checked)}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon={FileText} title="Observații" />

        <textarea
          value={editForm.observations}
          maxLength={1000}
          rows={6}
          onChange={(event) => updateForm("observations", event.target.value)}
          placeholder="Adaugă observații despre angajat..."
          className="mt-4 w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-5 text-sm leading-7 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#B8904D]/60"
        />

        <p className="mt-2 text-right text-xs text-zinc-500">
          {editForm.observations.length}/1000
        </p>
      </section>

      {saveMessage ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {saveMessage}
        </div>
      ) : null}

      {saveErrorMessage ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={18} />
          {saveErrorMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onReset}
          disabled={isSaving}
          className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Renunță la modificări
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || editForm.rankId === null}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8904D] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#D0A65D] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}

          {isSaving ? "Se salvează..." : "Salvează modificările"}
        </button>

        <button
          type="button"
          onClick={onResign}
          disabled={isSaving || isResigning}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-5 py-3 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResigning ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : null}

          {isResigning ? "Se procesează..." : "Demisionează"}
        </button>
      </div>
    </div>
  );
}

interface ContractTabProps {
  employee: Employee;
  editForm: ContractEditForm | null;
  isSaving: boolean;
  isUploadingImage: boolean;
  saveMessage: string;
  errorMessage: string;
  selectedIdentityImage: File | null;
  onFormChange: (form: ContractEditForm) => void;
  onSelectIdentityImage: (file: File | null) => void;
  onSave: () => void;
  onUploadIdentityImage: () => void;
}

function ContractTab({
  employee,
  editForm,
  isSaving,
  isUploadingImage,
  saveMessage,
  errorMessage,
  selectedIdentityImage,
  onFormChange,
  onSelectIdentityImage,
  onSave,
  onUploadIdentityImage,
}: ContractTabProps) {
  const contract = employee.contract;

  if (!editForm) {
    return null;
  }

  function updateContractForm<Key extends keyof ContractEditForm>(
    key: Key,
    value: ContractEditForm[Key],
  ) {
    const updatedForm: ContractEditForm = {
      ...editForm,
      [key]: value,
    } as ContractEditForm;

    onFormChange(updatedForm);
  }

  return (
    <div className="mt-8 space-y-8">
      <section>
        <SectionTitle icon={FileText} title="Date contract" />

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <EditableField label="Nume">
            <input
              value={editForm.firstName}
              maxLength={100}
              onChange={(event) =>
                updateContractForm("firstName", event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/60"
            />
          </EditableField>

          <EditableField label="Prenume">
            <input
              value={editForm.lastName}
              maxLength={100}
              onChange={(event) =>
                updateContractForm("lastName", event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/60"
            />
          </EditableField>

          <EditableField label="Vârstă">
            <input
              type="number"
              min={18}
              max={100}
              value={editForm.age}
              onChange={(event) =>
                updateContractForm("age", event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/60"
            />
          </EditableField>

          <EditableField label="IBAN">
            <input
              value={editForm.iban}
              maxLength={50}
              onChange={(event) =>
                updateContractForm("iban", event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/60"
            />
          </EditableField>

          <EditableField label="Serie CI">
            <input
              value={editForm.ciSeries}
              maxLength={50}
              onChange={(event) =>
                updateContractForm("ciSeries", event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/60"
            />
          </EditableField>

          <EditableField label="Nr. telefon">
            <input
              value={editForm.phoneNumber}
              maxLength={50}
              onChange={(event) =>
                updateContractForm("phoneNumber", event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/60"
            />
          </EditableField>

          <EditableField label="Luni">
            <input
              type="number"
              min={0}
              value={editForm.cityHours}
              onChange={(event) =>
                updateContractForm("cityHours", event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/60"
            />
          </EditableField>

          <EditableField label="Status contract">
            <select
              value={editForm.status}
              onChange={(event) =>
                updateContractForm(
                  "status",
                  event.target.value as ContractEditForm["status"],
                )
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/60"
            >
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">În așteptare</option>
              <option value="APPROVED">Aprobat</option>
              <option value="REJECTED">Respins</option>
            </select>
          </EditableField>

          <EditableField label="Semnătura angajatului">
            <input
              value={editForm.employeeSignatureName}
              maxLength={200}
              onChange={(event) =>
                updateContractForm("employeeSignatureName", event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/60"
            />
          </EditableField>

          <InformationCard
            label="Semnat la"
            value={formatDate(contract.signedAt)}
          />

          <InformationCard
            label="Aprobat de"
            value={contract.approvedByName || "—"}
          />

          <InformationCard
            label="Aprobat la"
            value={formatDate(contract.approvedAt)}
          />

          <InformationCard
            label="Respins la"
            value={formatDate(contract.rejectedAt)}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon={IdCard} title="Buletin" />

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5">
          {contract.identityImagePath ? (
            <div className="relative h-[500px] w-full">
              <Image
                src={`${API_URL}/users/${employee.id}/contract/identity-image`}
                alt="Buletin angajat"
                fill
                unoptimized
                sizes="(max-width: 1024px) 100vw, 900px"
                className="rounded-xl object-contain"
              />
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center">
              <IdCard size={42} className="text-zinc-600" />

              <p className="mt-4 text-sm text-zinc-400">
                Nu există o imagine de buletin.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(event) =>
                onSelectIdentityImage(event.target.files?.[0] ?? null)
              }
              className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />

            <button
              type="button"
              onClick={onUploadIdentityImage}
              disabled={!selectedIdentityImage || isUploadingImage}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {isUploadingImage ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : null}
              Înlocuiește poza
            </button>
          </div>
        </div>
      </section>

      {saveMessage ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {saveMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={18} />
          {errorMessage}
        </div>
      ) : null}

      <div className="flex justify-end border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8904D] px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {isSaving ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}

          {isSaving ? "Se salvează..." : "Salvează contractul"}
        </button>
      </div>
    </div>
  );
}

interface TabButtonProps {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function TabButton({
  children,
  active = false,
  disabled = false,
  onClick,
}: TabButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition ${
        active
          ? "border-[#B8904D] text-[#D8B979]"
          : "border-transparent text-zinc-400 hover:text-white"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

interface SectionTitleProps {
  icon: typeof UserRound;
  title: string;
}

function SectionTitle({ icon: Icon, title }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B8904D]/10 text-[#B8904D]">
        <Icon size={20} />
      </div>

      <h2 className="text-xl font-semibold text-white">{title}</h2>
    </div>
  );
}

interface InformationCardProps {
  label: string;
  value: string;
}

function InformationCard({ label, value }: InformationCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <p className="text-xs tracking-wider text-zinc-500 uppercase">{label}</p>

      <p className="mt-3 break-words font-medium text-white">{value}</p>
    </div>
  );
}

interface EditableFieldProps {
  label: string;
  children: React.ReactNode;
}

function EditableField({ label, children }: EditableFieldProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <p className="mb-3 text-xs tracking-wider text-zinc-500 uppercase">
        {label}
      </p>

      {children}
    </div>
  );
}

interface EditableBooleanCardProps {
  icon: typeof CalendarDays;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function EditableBooleanCard({
  icon: Icon,
  label,
  checked,
  onChange,
}: EditableBooleanCardProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-white/20 hover:bg-black/40">
      <div className="flex items-center gap-3">
        <Icon size={20} className="text-[#B8904D]" />

        <span className="text-sm text-zinc-300">{label}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">{checked ? "Da" : "Nu"}</span>

        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-5 w-5 cursor-pointer accent-[#B8904D]"
        />
      </div>
    </label>
  );
}

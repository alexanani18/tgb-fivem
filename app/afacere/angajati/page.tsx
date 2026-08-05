"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import AppShell from "../../components/AppShell";

type EmployeeStatus = "ACTIV" | "CONCEDIU" | "DEMISIONAT";

type BooleanEmployeeField = "meetingAttendance" | "hasUniform" | "hasCar";

interface Employee {
  id: number;

  firstName: string;
  lastName: string;

  iban: string | number;

  status: EmployeeStatus;

  phoneNumber: string;
  ciSeries: string;
  cityHours: string | number;

  rank: string;

  meetingAttendance: boolean;

  createdAt: string;

  observations: string;

  discordId: string;

  hasUniform: boolean;
  hasCar: boolean;
}

interface EmployeesResponse {
  success: boolean;
  message?: string;
  users?: Employee[];
}

interface UpdateEmployeeDetailsResponse {
  success: boolean;
  message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const EMPLOYEES_PER_PAGE = 20;

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Dată indisponibilă";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatStatus(status: EmployeeStatus): string {
  if (status === "CONCEDIU") {
    return "Concediu";
  }

  if (status === "DEMISIONAT") {
    return "Demisionat";
  }

  return "Activ";
}

function getUpdateKey(employeeId: number, field: BooleanEmployeeField): string {
  return `${employeeId}-${field}`;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [updateErrorMessage, setUpdateErrorMessage] = useState("");

  const [updatingFields, setUpdatingFields] = useState<Set<string>>(new Set());

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredEmployees = employees.filter((employee) => {
    if (!normalizedSearchTerm) {
      return true;
    }

    const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();

    return (
      fullName.includes(normalizedSearchTerm) ||
      String(employee.iban).toLowerCase().includes(normalizedSearchTerm) ||
      employee.status.toLowerCase().includes(normalizedSearchTerm) ||
      employee.phoneNumber.toLowerCase().includes(normalizedSearchTerm) ||
      employee.ciSeries.toLowerCase().includes(normalizedSearchTerm) ||
      String(employee.cityHours).toLowerCase().includes(normalizedSearchTerm) ||
      employee.rank.toLowerCase().includes(normalizedSearchTerm) ||
      employee.observations.toLowerCase().includes(normalizedSearchTerm) ||
      employee.discordId.toLowerCase().includes(normalizedSearchTerm)
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / EMPLOYEES_PER_PAGE),
  );

  const firstEmployeeIndex = (currentPage - 1) * EMPLOYEES_PER_PAGE;

  const lastEmployeeIndex = firstEmployeeIndex + EMPLOYEES_PER_PAGE;

  const paginatedEmployees = filteredEmployees.slice(
    firstEmployeeIndex,
    lastEmployeeIndex,
  );

  const loadEmployees = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage("");
      setUpdateErrorMessage("");

      const response = await fetch(`${API_URL}/users`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await response.json()) as EmployeesResponse;

      if (!response.ok) {
        setEmployees([]);
        setCurrentPage(1);

        setErrorMessage(data.message || "Angajații nu au putut fi încărcați.");

        return;
      }

      setEmployees(data.users ?? []);
      setCurrentPage(1);
    } catch (error) {
      console.error("Load employees request error:", error);

      setEmployees([]);
      setCurrentPage(1);

      setErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  async function updateBooleanField(
    employeeId: number,
    field: BooleanEmployeeField,
    newValue: boolean,
  ) {
    const updateKey = getUpdateKey(employeeId, field);

    if (updatingFields.has(updateKey)) {
      return;
    }

    const previousEmployee = employees.find(
      (employee) => employee.id === employeeId,
    );

    if (!previousEmployee) {
      return;
    }

    setUpdateErrorMessage("");

    setUpdatingFields((currentFields) => {
      const nextFields = new Set(currentFields);

      nextFields.add(updateKey);

      return nextFields;
    });

    setEmployees((currentEmployees) =>
      currentEmployees.map((employee) =>
        employee.id === employeeId
          ? {
              ...employee,
              [field]: newValue,
            }
          : employee,
      ),
    );

    try {
      const response = await fetch(`${API_URL}/users/${employeeId}/details`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [field]: newValue,
        }),
      });

      const data = (await response.json()) as UpdateEmployeeDetailsResponse;

      if (!response.ok) {
        setEmployees((currentEmployees) =>
          currentEmployees.map((employee) =>
            employee.id === employeeId
              ? {
                  ...employee,
                  [field]: previousEmployee[field],
                }
              : employee,
          ),
        );

        setUpdateErrorMessage(
          data.message || "Modificarea nu a putut fi salvată.",
        );
      }
    } catch (error) {
      console.error("Update employee field error:", error);

      setEmployees((currentEmployees) =>
        currentEmployees.map((employee) =>
          employee.id === employeeId
            ? {
                ...employee,
                [field]: previousEmployee[field],
              }
            : employee,
        ),
      );

      setUpdateErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
    } finally {
      setUpdatingFields((currentFields) => {
        const nextFields = new Set(currentFields);

        nextFields.delete(updateKey);

        return nextFields;
      });
    }
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    setCurrentPage(1);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadEmployees();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadEmployees]);

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 backdrop-blur-md">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm tracking-[0.2em] text-[#B8904D] uppercase">
                Afacere
              </p>

              <h1 className="mt-3 text-3xl font-bold text-white">Angajați</h1>

              <p className="mt-4 max-w-2xl text-zinc-300">
                Lista angajaților din The Blackfold Skatehouse.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadEmployees(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={isRefreshing ? "animate-spin" : ""}
              />
              Reîncarcă
            </button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatisticCard label="Total angajați" value={employees.length} />

            <StatisticCard
              label="Manageri"
              value={
                employees.filter(
                  (employee) => employee.rank === "Blackfold Manager",
                ).length
              }
            />

            <StatisticCard
              label="Specialiști"
              value={
                employees.filter(
                  (employee) => employee.rank === "Blackfold Specialist",
                ).length
              }
            />

            <StatisticCard
              label="Crew"
              value={
                employees.filter(
                  (employee) => employee.rank === "Blackfold Crew",
                ).length
              }
            />
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-xl">
              <Search
                size={18}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-500"
              />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Caută după nume, IBAN, telefon, grad sau Discord..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pr-4 pl-11 text-sm text-white outline-none transition placeholder:text-zinc-500 hover:border-white/20 focus:border-[#B8904D]/60"
              />
            </div>

            <p className="text-sm text-zinc-400">
              {filteredEmployees.length}{" "}
              {filteredEmployees.length === 1
                ? "angajat găsit"
                : "angajați găsiți"}
            </p>
          </div>

          {updateErrorMessage ? (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle size={18} />

              {updateErrorMessage}
            </div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            {isLoading ? (
              <div className="flex min-h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-300">
                  <LoaderCircle
                    size={22}
                    className="animate-spin text-[#B8904D]"
                  />
                  Se încarcă angajații...
                </div>
              </div>
            ) : errorMessage ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <AlertCircle size={32} className="text-red-400" />

                <p className="mt-4 font-medium text-white">
                  Angajații nu au putut fi încărcați
                </p>

                <p className="mt-2 text-sm text-zinc-400">{errorMessage}</p>

                <button
                  type="button"
                  onClick={() => void loadEmployees()}
                  className="mt-5 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
                >
                  Încearcă din nou
                </button>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <Users size={34} className="text-zinc-500" />

                <p className="mt-4 font-medium text-white">
                  {searchTerm ? "Nu există rezultate" : "Nu există angajați"}
                </p>

                <p className="mt-2 text-sm text-zinc-400">
                  {searchTerm
                    ? "Niciun angajat nu corespunde căutării."
                    : "Momentan nu există angajați disponibili."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1900px] border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <TableHeader>Nume Prenume</TableHeader>
                        <TableHeader>IBAN</TableHeader>
                        <TableHeader>Status</TableHeader>
                        <TableHeader>Nr. Telefon</TableHeader>
                        <TableHeader>Serie CI</TableHeader>
                        <TableHeader>Luni</TableHeader>
                        <TableHeader>Grad</TableHeader>

                        <TableHeader centered>Prezență Ședință</TableHeader>
                        <TableHeader centered>Uniformă</TableHeader>
                        <TableHeader centered>Mașină</TableHeader>

                        <TableHeader>Data angajării</TableHeader>
                        <TableHeader>Obs</TableHeader>
                        <TableHeader>ID Discord</TableHeader>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedEmployees.map((employee) => (
                        <tr
                          key={employee.id}
                          className="border-b border-white/5 transition last:border-b-0 hover:bg-white/5"
                        >
                          <td className="px-4 py-4">
                            <Link
                              href={`/afacere/angajati/${employee.id}`}
                              className="font-medium whitespace-nowrap text-[#D8B979] transition hover:text-[#F0D49A] hover:underline"
                            >
                              {employee.firstName} {employee.lastName}
                            </Link>
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {employee.iban}
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge status={employee.status} />
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {employee.phoneNumber || "—"}
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {employee.ciSeries || "—"}
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {employee.cityHours || "—"}
                          </td>

                          <td className="px-4 py-4">
                            <RankBadge rank={employee.rank} />
                          </td>

                          <td className="px-4 py-4 text-center">
                            <EmployeeCheckbox
                              checked={employee.meetingAttendance}
                              disabled={updatingFields.has(
                                getUpdateKey(employee.id, "meetingAttendance"),
                              )}
                              label={`Prezență ședință pentru ${employee.firstName} ${employee.lastName}`}
                              onChange={(checked) =>
                                void updateBooleanField(
                                  employee.id,
                                  "meetingAttendance",
                                  checked,
                                )
                              }
                            />
                          </td>

                          <td className="px-4 py-4 text-center">
                            <EmployeeCheckbox
                              checked={employee.hasUniform}
                              disabled={updatingFields.has(
                                getUpdateKey(employee.id, "hasUniform"),
                              )}
                              label={`Uniformă pentru ${employee.firstName} ${employee.lastName}`}
                              onChange={(checked) =>
                                void updateBooleanField(
                                  employee.id,
                                  "hasUniform",
                                  checked,
                                )
                              }
                            />
                          </td>

                          <td className="px-4 py-4 text-center">
                            <EmployeeCheckbox
                              checked={employee.hasCar}
                              disabled={updatingFields.has(
                                getUpdateKey(employee.id, "hasCar"),
                              )}
                              label={`Mașină pentru ${employee.firstName} ${employee.lastName}`}
                              onChange={(checked) =>
                                void updateBooleanField(
                                  employee.id,
                                  "hasCar",
                                  checked,
                                )
                              }
                            />
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {formatDate(employee.createdAt)}
                          </td>

                          <td
                            className="max-w-[260px] px-4 py-4 text-sm text-zinc-300"
                            title={employee.observations || undefined}
                          >
                            <span className="block truncate">
                              {employee.observations || "—"}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {employee.discordId || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-400">
                    Se afișează{" "}
                    <span className="font-medium text-white">
                      {firstEmployeeIndex + 1}
                    </span>
                    {" - "}
                    <span className="font-medium text-white">
                      {Math.min(lastEmployeeIndex, filteredEmployees.length)}
                    </span>
                    {" din "}
                    <span className="font-medium text-white">
                      {filteredEmployees.length}
                    </span>
                    {" angajați"}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) => Math.max(1, page - 1))
                      }
                      disabled={currentPage === 1}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Înapoi
                    </button>

                    <span className="px-3 text-sm text-zinc-400">
                      Pagina{" "}
                      <span className="font-medium text-white">
                        {currentPage}
                      </span>
                      {" din "}
                      <span className="font-medium text-white">
                        {totalPages}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Următoarea
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

interface StatisticCardProps {
  label: string;
  value: number;
}

function StatisticCard({ label, value }: StatisticCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>

          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B8904D]/10 text-[#B8904D]">
          <Users size={21} />
        </div>
      </div>
    </div>
  );
}

interface TableHeaderProps {
  children: React.ReactNode;
  centered?: boolean;
}

function TableHeader({ children, centered = false }: TableHeaderProps) {
  return (
    <th
      className={`px-4 py-4 text-xs font-semibold tracking-wider whitespace-nowrap text-zinc-400 uppercase ${
        centered ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

interface StatusBadgeProps {
  status: EmployeeStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusClasses: Record<EmployeeStatus, string> = {
    ACTIV: "border-green-500/20 bg-green-500/10 text-green-300",

    CONCEDIU: "border-blue-500/20 bg-blue-500/10 text-blue-300",

    DEMISIONAT: "border-red-500/20 bg-red-500/10 text-red-300",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusClasses[status]}`}
    >
      {formatStatus(status)}
    </span>
  );
}

interface RankBadgeProps {
  rank: string;
}

function RankBadge({ rank }: RankBadgeProps) {
  return (
    <span className="inline-flex rounded-full border border-[#B8904D]/25 bg-[#B8904D]/10 px-3 py-1 text-xs font-semibold whitespace-nowrap text-[#D8B979]">
      {rank}
    </span>
  );
}

interface EmployeeCheckboxProps {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

function EmployeeCheckbox({
  checked,
  disabled,
  label,
  onChange,
}: EmployeeCheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 cursor-pointer rounded border-white/20 bg-black/50 accent-[#B8904D] disabled:cursor-wait disabled:opacity-50"
      />

      {disabled ? (
        <LoaderCircle size={15} className="ml-2 animate-spin text-[#B8904D]" />
      ) : null}
    </label>
  );
}

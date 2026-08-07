"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Clipboard,
  FileText,
  House,
  Hourglass,
  KeyRound,
  LogOut,
  Mail,
  ServerCog,
  Shield,
  UserLock,
  UserPlus,
  UserRoundArrowLeft,
  UserRoundCog,
  UserShield,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "DEV" | "GUEST";

type SidebarSectionId =
  | "business"
  | "mafia"
  | "control-panel"
  | "dev"
  | "cont"
  | "contract";

interface DashboardSidebarProps {
  username: string;
  role: UserRole;
  rank: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface SidebarSubItem {
  label: string;
  href: string;
  icon: typeof House;
  roles?: UserRole[];
}

interface SidebarItem {
  label: string;
  href?: string;
  icon: typeof House;
  children?: SidebarSubItem[];
  roles?: UserRole[];
  showUnreadBadge?: boolean;
  showPendingContractsBadge?: boolean;
  showPendingRequestsBadge?: boolean;
}

interface SidebarSection {
  id: SidebarSectionId;
  label: string;
  icon: typeof House;
  roles: UserRole[];
  children: SidebarItem[];
}

interface UnreadCountResponse {
  success: boolean;
  unreadCount?: number;
  message?: string;
}

interface PendingContractsCountResponse {
  success: boolean;
  pendingCount?: number;
  message?: string;
}

interface PendingRequestsCountResponse {
  success: boolean;
  count?: number;
  message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const sidebarSections: SidebarSection[] = [
  {
    id: "contract",
    label: "Contracte",
    icon: UserRoundCog,
    roles: ["ADMIN", "ANGAJAT", "MAFIA", "DEV", "GUEST"],
    children: [
      {
        label: "Contracte",
        href: "/contract",
        icon: UserRoundCog,
      },
    ],
  },
  {
    id: "business",
    label: "Afacere",
    icon: House,
    roles: ["ADMIN", "ANGAJAT", "MAFIA"],
    children: [
      {
        label: "Dashboard",
        href: "/afacere",
        icon: BriefcaseBusiness,
      },
      {
        label: "Notificări",
        href: "/afacere/notificari",
        icon: Mail,
        showUnreadBadge: true,
      },
      {
        label: "Uniformă",
        href: "/afacere/uniforma",
        icon: Shield,
      },
      {
        label: "Cereri",
        icon: Clipboard,
        roles: ["ADMIN", "ANGAJAT", "MAFIA"],
        children: [
          {
            label: "Demisie",
            icon: UserRoundArrowLeft,
            href: "/afacere/cereri/demisie",
          },
          {
            label: "Inactivitate",
            icon: Hourglass,
            href: "/afacere/cereri/inactivitate",
          },
          {
            label: "Concediu",
            icon: FileText,
            href: "/afacere/cereri/concediu",
          },
        ],
      },
    ],
  },
  {
    id: "control-panel",
    label: "Control Panel",
    icon: UserLock,
    roles: ["ADMIN"],
    children: [
      {
        label: "Review Dovadă",
        href: "/afacere/notificari/review",
        icon: UserShield,
      },
      {
        label: "Cereri",
        href: "/afacere/cereri",
        icon: Clipboard,
        showPendingRequestsBadge: true,
      },
      {
        label: "Adaugă utilizator",
        href: "/afacere/add_user",
        icon: UserPlus,
      },
      {
        label: "Angajați",
        icon: Users,
        children: [
          {
            label: "Angajați activi",
            href: "/afacere/angajati",
            icon: Users,
          },
          {
            label: "Arhivă",
            href: "/afacere/angajati/arhiva",
            icon: Archive,
          },
        ],
      },
      {
        label: "Contracte",
        href: "/afacere/contracte",
        icon: UserRoundCog,
        showPendingContractsBadge: true,
      },
      {
        label: "Management tabele",
        icon: UserRoundCog,
        children: [
          {
            label: "Management rank-uri",
            href: "/afacere/management/ranks",
            icon: Archive,
          },
          {
            label: "Discord - Cereri",
            href: "/afacere/management/discord-workflow",
            icon: ServerCog,
          },
        ],
      },
    ],
  },
  {
    id: "dev",
    label: "Dev",
    icon: ServerCog,
    roles: ["DEV", "ADMIN"],
    children: [
      {
        label: "Pontaj afacere",
        href: "/afacere/pontaj",
        icon: Hourglass,
      },
      {
        label: "Învoiri afacere",
        href: "/afacere/invoiri",
        icon: UserShield,
      },
      {
        label: "Angajați afacere",
        href: "/afacere/employees",
        icon: Users,
      },
    ],
  },
  {
    id: "mafia",
    label: "Mafia",
    icon: UserLock,
    roles: ["MAFIA", "ADMIN"],
    children: [
      {
        label: "Dashboard",
        href: "/mafia",
        icon: Shield,
      },
      {
        label: "Membri",
        href: "/mafia/members",
        icon: Users,
      },
    ],
  },
  {
    id: "cont",
    label: "Cont",
    icon: UserRoundCog,
    roles: ["ADMIN", "ANGAJAT", "MAFIA", "DEV", "GUEST"],
    children: [
      {
        label: "Schimbare parola",
        href: "/cont/schimbare-parola",
        icon: KeyRound,
      },
    ],
  },
];

function isEmployeesPath(pathname: string) {
  return pathname.startsWith("/afacere/angajati");
}

function isManagementTablesPath(pathname: string) {
  return pathname.startsWith("/afacere/management");
}

function isEmployeeRequestsPath(pathname: string) {
  return (
    pathname.startsWith("/afacere/cereri/") && pathname !== "/afacere/cereri"
  );
}

function isAccountPath(pathname: string) {
  return pathname === "/cont" || pathname.startsWith("/cont/");
}

function isContractPath(pathname: string) {
  return pathname === "/contract" || pathname.startsWith("/contract/");
}

function isControlPanelPath(pathname: string) {
  return (
    pathname.startsWith("/afacere/notificari/review") ||
    pathname === "/afacere/cereri" ||
    pathname.startsWith("/afacere/add_user") ||
    pathname.startsWith("/afacere/angajati") ||
    pathname.startsWith("/afacere/contracte") ||
    pathname.startsWith("/afacere/management")
  );
}

function isDevPath(pathname: string) {
  return (
    pathname.startsWith("/dev") ||
    pathname.startsWith("/afacere/pontaj") ||
    pathname.startsWith("/afacere/invoiri") ||
    pathname.startsWith("/afacere/employees")
  );
}

function isBusinessPath(pathname: string) {
  return (
    pathname.startsWith("/afacere") &&
    !isControlPanelPath(pathname) &&
    !isDevPath(pathname)
  );
}

function getRouteOpenSections(
  pathname: string,
): Record<SidebarSectionId, boolean> {
  return {
    business: isBusinessPath(pathname),
    mafia: pathname === "/mafia" || pathname.startsWith("/mafia/"),
    "control-panel": isControlPanelPath(pathname),
    dev: isDevPath(pathname),
    cont: isAccountPath(pathname),
    contract: isContractPath(pathname),
  };
}

function normalizeDisplayValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

function getFullName(
  firstName: string | null,
  lastName: string | null,
  username: string,
) {
  const normalizedFirstName = normalizeDisplayValue(firstName);
  const normalizedLastName = normalizeDisplayValue(lastName);

  const fullName = [normalizedFirstName, normalizedLastName]
    .filter(Boolean)
    .join(" ");

  return fullName || username;
}

function getSidebarIdentity(role: UserRole, rank: string | null) {
  const normalizedRank = normalizeDisplayValue(rank);

  switch (role) {
    case "ADMIN":
      return {
        label: normalizedRank ?? "Administrator",
        icon: UserShield,
        accentClassName: "text-[#D6AE62]",
      };

    case "ANGAJAT":
      return {
        label: normalizedRank ?? "Angajat",
        icon: Shield,
        accentClassName: "text-emerald-400",
      };

    case "MAFIA":
      return {
        label: normalizedRank ? `Mafia • ${normalizedRank}` : "Mafia",
        icon: Users,
        accentClassName: "text-purple-400",
      };

    case "DEV":
      return {
        label: "Developer",
        icon: ServerCog,
        accentClassName: "text-red-400",
      };

    case "GUEST":
      return {
        label: "Guest",
        icon: UserRoundCog,
        accentClassName: "text-amber-400",
      };
  }
}

function canRoleSeeItem(item: SidebarItem, role: UserRole) {
  return !item.roles || item.roles.includes(role);
}

function canRoleSeeSubItem(item: SidebarSubItem, role: UserRole) {
  return !item.roles || item.roles.includes(role);
}

function getItemId(item: SidebarItem) {
  switch (item.label) {
    case "Angajați":
      return "employees";
    case "Management tabele":
      return "management";
    case "Cereri":
      return "requests";
    default:
      return item.label.toLowerCase().replace(/\s+/g, "-");
  }
}

export default function DashboardSidebar({
  username,
  role,
  rank,
  firstName,
  lastName,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const displayName = getFullName(firstName, lastName, username);
  const sidebarIdentity = getSidebarIdentity(role, rank);
  const SidebarIdentityIcon = sidebarIdentity.icon;

  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingContractsCount, setPendingContractsCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const [itemOverrides, setItemOverrides] = useState<{
    pathname: string;
    values: Record<string, boolean>;
  }>({
    pathname,
    values: {},
  });

  const [sectionOverrides, setSectionOverrides] = useState<{
    pathname: string;
    values: Partial<Record<SidebarSectionId, boolean>>;
  }>({
    pathname,
    values: {},
  });

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/notifications/unread-count`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      const data = (await response.json()) as UnreadCountResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ??
            "Numărul notificărilor necitite nu a putut fi încărcat.",
        );
      }

      setUnreadCount(Number(data.unreadCount ?? 0));
    } catch (error) {
      console.error("Failed to load unread notification count:", error);
      setUnreadCount(0);
    }
  }, []);

  const loadPendingContractsCount = useCallback(async () => {
    if (role !== "ADMIN") {
      setPendingContractsCount(0);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/contracts/admin/pending-count`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await response.json()) as PendingContractsCountResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ??
            "Numărul contractelor în așteptare nu a putut fi încărcat.",
        );
      }

      setPendingContractsCount(Number(data.pendingCount ?? 0));
    } catch (error) {
      console.error("Failed to load pending contracts count:", error);
      setPendingContractsCount(0);
    }
  }, [role]);

  const loadPendingRequestsCount = useCallback(async () => {
    if (role !== "ADMIN") {
      setPendingRequestsCount(0);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/workflows/admin/pending-count`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await response.json()) as PendingRequestsCountResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ??
            "Numărul cererilor în așteptare nu a putut fi încărcat.",
        );
      }

      setPendingRequestsCount(Number(data.count ?? 0));
    } catch (error) {
      console.error("Failed to load pending workflow request count:", error);
      setPendingRequestsCount(0);
    }
  }, [role]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUnreadCount();
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadUnreadCount();
    }, 30_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadUnreadCount]);

  useEffect(() => {
    function handleNotificationsUpdated() {
      void loadUnreadCount();
    }

    window.addEventListener(
      "notifications-updated",
      handleNotificationsUpdated,
    );

    return () => {
      window.removeEventListener(
        "notifications-updated",
        handleNotificationsUpdated,
      );
    };
  }, [loadUnreadCount]);

  useEffect(() => {
    if (role !== "ADMIN") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadPendingContractsCount();
      void loadPendingRequestsCount();
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadPendingContractsCount();
      void loadPendingRequestsCount();
    }, 30_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadPendingContractsCount, loadPendingRequestsCount, role]);

  useEffect(() => {
    function handleContractsUpdated() {
      void loadPendingContractsCount();
    }

    function handleWorkflowRequestsUpdated() {
      void loadPendingRequestsCount();
    }

    window.addEventListener("contracts-updated", handleContractsUpdated);
    window.addEventListener(
      "workflow-requests-updated",
      handleWorkflowRequestsUpdated,
    );

    return () => {
      window.removeEventListener("contracts-updated", handleContractsUpdated);
      window.removeEventListener(
        "workflow-requests-updated",
        handleWorkflowRequestsUpdated,
      );
    };
  }, [loadPendingContractsCount, loadPendingRequestsCount]);

  async function handleLogout() {
    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed.");
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const visibleSections = sidebarSections.filter((section) =>
    section.roles.includes(role),
  );

  const routeOpenItems: Record<string, boolean> = {
    employees: isEmployeesPath(pathname),
    management: isManagementTablesPath(pathname),
    requests: isEmployeeRequestsPath(pathname),
  };

  const routeOpenSections = getRouteOpenSections(pathname);

  const currentItemOverrides =
    itemOverrides.pathname === pathname ? itemOverrides.values : {};

  const currentSectionOverrides =
    sectionOverrides.pathname === pathname ? sectionOverrides.values : {};

  const effectiveOpenItems: Record<string, boolean> = {
    ...routeOpenItems,
    ...currentItemOverrides,
  };

  const effectiveOpenSections: Record<SidebarSectionId, boolean> = {
    business: currentSectionOverrides.business ?? routeOpenSections.business,
    mafia: currentSectionOverrides.mafia ?? routeOpenSections.mafia,
    dev: currentSectionOverrides.dev ?? routeOpenSections.dev,
    cont: currentSectionOverrides.cont ?? routeOpenSections.cont,
    contract: currentSectionOverrides.contract ?? routeOpenSections.contract,
    "control-panel":
      currentSectionOverrides["control-panel"] ??
      routeOpenSections["control-panel"],
  };

  function toggleSection(sectionId: SidebarSectionId) {
    setSectionOverrides((previousOverrides) => {
      const previousValues =
        previousOverrides.pathname === pathname ? previousOverrides.values : {};

      return {
        pathname,
        values: {
          ...previousValues,
          [sectionId]: !effectiveOpenSections[sectionId],
        },
      };
    });
  }

  function toggleItem(itemId: string) {
    setItemOverrides((previousOverrides) => {
      const previousValues =
        previousOverrides.pathname === pathname ? previousOverrides.values : {};

      return {
        pathname,
        values: {
          ...previousValues,
          [itemId]: !(effectiveOpenItems[itemId] ?? false),
        },
      };
    });
  }

  function isItemActive(href: string) {
    if (href === "/afacere") {
      return pathname === "/afacere";
    }

    if (href === "/mafia") {
      return pathname === "/mafia";
    }

    if (href === "/afacere/angajati") {
      return pathname === "/afacere/angajati";
    }

    if (href === "/afacere/angajati/arhiva") {
      return pathname.startsWith("/afacere/angajati/arhiva");
    }

    if (href === "/afacere/notificari") {
      return pathname === "/afacere/notificari";
    }

    if (href === "/afacere/cereri") {
      return pathname === "/afacere/cereri";
    }

    if (href === "/cont/schimbare-parola") {
      return pathname.startsWith("/cont/schimbare-parola");
    }

    if (href === "/contract") {
      return pathname.startsWith("/contract");
    }

    return pathname.startsWith(href);
  }

  function formatBadgeCount(count: number) {
    return count > 99 ? "99+" : String(count);
  }

  return (
    <aside className="hidden h-screen w-[300px] shrink-0 border-r border-white/10 bg-black/45 px-3 py-6 backdrop-blur-md md:flex md:flex-col">
      <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {visibleSections.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = effectiveOpenSections[section.id];

          const visibleItems = section.children.filter((item) =>
            canRoleSeeItem(item, role),
          );

          return (
            <div key={section.id}>
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-white/5"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <SectionIcon
                    className="h-5 w-5 text-[#B8904D]"
                    strokeWidth={1.8}
                  />

                  <span className="font-medium text-white">
                    {section.label}
                  </span>
                </div>

                {isOpen ? (
                  <ChevronDown
                    className="h-4 w-4 text-zinc-400"
                    strokeWidth={1.8}
                  />
                ) : (
                  <ChevronRight
                    className="h-4 w-4 text-zinc-400"
                    strokeWidth={1.8}
                  />
                )}
              </button>

              {isOpen && (
                <div className="mt-1 ml-7 space-y-1 border-l border-white/10 pl-4">
                  {visibleItems.map((item) => {
                    const ItemIcon = item.icon;

                    const visibleChildren =
                      item.children?.filter((child) =>
                        canRoleSeeSubItem(child, role),
                      ) ?? [];

                    const hasChildren = visibleChildren.length > 0;
                    const itemId = getItemId(item);

                    const isNestedItemOpen =
                      effectiveOpenItems[itemId] ?? false;

                    const isParentActive =
                      hasChildren &&
                      visibleChildren.some((child) => isItemActive(child.href));

                    const isActive =
                      typeof item.href === "string"
                        ? isItemActive(item.href)
                        : isParentActive;

                    const shouldShowUnreadBadge =
                      item.showUnreadBadge === true && unreadCount > 0;

                    const shouldShowPendingContractsBadge =
                      item.showPendingContractsBadge === true &&
                      pendingContractsCount > 0;

                    const shouldShowPendingRequestsBadge =
                      item.showPendingRequestsBadge === true &&
                      pendingRequestsCount > 0;

                    if (hasChildren) {
                      return (
                        <div key={itemId}>
                          <button
                            type="button"
                            onClick={() => toggleItem(itemId)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                              isActive
                                ? "bg-white/10 text-[#B8904D]"
                                : "text-zinc-300 hover:bg-white/5 hover:text-white"
                            }`}
                            aria-expanded={isNestedItemOpen}
                          >
                            <ItemIcon
                              className="h-4 w-4 shrink-0"
                              strokeWidth={1.8}
                            />

                            <span className="min-w-0 flex-1 whitespace-nowrap text-left">
                              {item.label}
                            </span>

                            {isNestedItemOpen ? (
                              <ChevronDown
                                className="h-3.5 w-3.5 shrink-0"
                                strokeWidth={1.8}
                              />
                            ) : (
                              <ChevronRight
                                className="h-3.5 w-3.5 shrink-0"
                                strokeWidth={1.8}
                              />
                            )}
                          </button>

                          {isNestedItemOpen && (
                            <div className="mt-1 ml-5 space-y-1 border-l border-white/10 pl-3">
                              {visibleChildren.map((child) => {
                                const ChildIcon = child.icon;
                                const isChildActive = isItemActive(child.href);

                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                                      isChildActive
                                        ? "bg-white/10 text-[#B8904D]"
                                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                    }`}
                                  >
                                    <ChildIcon
                                      className="h-3.5 w-3.5 shrink-0"
                                      strokeWidth={1.8}
                                    />

                                    <span className="min-w-0 flex-1 whitespace-nowrap">
                                      {child.label}
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (!item.href) {
                      return null;
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-white/10 text-[#B8904D]"
                            : "text-zinc-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <ItemIcon
                          className="h-4 w-4 shrink-0"
                          strokeWidth={1.8}
                        />

                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>

                        {shouldShowUnreadBadge && (
                          <span
                            className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-black"
                            aria-label={`${unreadCount} notificări necitite`}
                          >
                            {formatBadgeCount(unreadCount)}
                          </span>
                        )}

                        {shouldShowPendingContractsBadge && (
                          <span
                            className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-black"
                            aria-label={`${pendingContractsCount} contracte în așteptare`}
                          >
                            {formatBadgeCount(pendingContractsCount)}
                          </span>
                        )}

                        {shouldShowPendingRequestsBadge && (
                          <span
                            className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-black"
                            aria-label={`${pendingRequestsCount} cereri în așteptare`}
                          >
                            {formatBadgeCount(pendingRequestsCount)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-5">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mb-4 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-zinc-300 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>

        <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.30)] backdrop-blur-md">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(184,144,77,0.10),transparent_58%)]" />

          <div className="relative flex min-w-0 items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[#B8904D]/50 shadow-[0_0_18px_rgba(184,144,77,0.25)]">
              <Image
                src="/img/login-image.png"
                alt="The Gentleman Blackfold"
                fill
                sizes="56px"
                className="object-cover"
                priority
              />
            </div>

            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-semibold text-white"
                title={displayName}
              >
                {displayName}
              </p>

              <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                <SidebarIdentityIcon
                  className={`h-3.5 w-3.5 shrink-0 ${sidebarIdentity.accentClassName}`}
                  strokeWidth={1.8}
                />

                <p
                  className={`min-w-0 truncate text-xs font-medium ${sidebarIdentity.accentClassName}`}
                  title={sidebarIdentity.label}
                >
                  {sidebarIdentity.label}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

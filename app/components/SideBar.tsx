"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  House,
  Mail,
  Shield,
  UserLock,
  Users,
  Hourglass,
  UserShield,
  LogOut,
  ServerCog,
  UserPlus,
  KeyRound,
  UserRoundCog,
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
}

interface SidebarItem {
  label: string;
  href: string;
  icon: typeof House;
  showUnreadBadge?: boolean;
  showPendingContractsBadge?: boolean;
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

const API_URL = "http://localhost:5000";

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
        label: "Adaugă utilizator",
        href: "/afacere/add_user",
        icon: UserPlus,
      },
      {
        label: "Angajați",
        href: "/afacere/angajati",
        icon: Users,
      },
      {
        label: "Contracte",
        href: "/afacere/contracte",
        icon: UserRoundCog,
        showPendingContractsBadge: true,
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

export default function DashboardSidebar({
  username,
  role,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingContractsCount, setPendingContractsCount] = useState(0);

  const [openSections, setOpenSections] = useState<
    Record<SidebarSectionId, boolean>
  >({
    business: pathname.startsWith("/afacere"),
    mafia: pathname.startsWith("/mafia"),
    "control-panel":
      pathname.startsWith("/afacere/notificari/review") ||
      pathname.startsWith("/afacere/add_user") ||
      pathname.startsWith("/afacere/angajati") ||
      pathname.startsWith("/afacere/contracte"),
    dev: pathname.startsWith("/dev"),
    cont: pathname.startsWith("/cont/schimbare-parola"),
    contract: pathname.startsWith("/contract"),
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

  useEffect(() => {
    if (role !== "ADMIN") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadPendingContractsCount();
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadPendingContractsCount();
    }, 30_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadPendingContractsCount, role]);

  useEffect(() => {
    function handleContractsUpdated() {
      void loadPendingContractsCount();
    }

    window.addEventListener("contracts-updated", handleContractsUpdated);

    return () => {
      window.removeEventListener("contracts-updated", handleContractsUpdated);
    };
  }, [loadPendingContractsCount]);

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

  function toggleSection(sectionId: keyof typeof openSections) {
    setOpenSections((previousSections) => ({
      ...previousSections,
      [sectionId]: !previousSections[sectionId],
    }));
  }

  function isItemActive(href: string) {
    if (href === "/afacere") {
      return pathname === "/afacere";
    }

    if (href === "/mafia") {
      return pathname === "/mafia";
    }

    if (href === "/afacere/notificari") {
      return pathname.startsWith("/afacere/notificari");
    }

    if (href === "cont/schimbare-parola") {
      return pathname.startsWith("/cont/schimbare-parola");
    }

    if (href === "/contract") {
      return pathname.startsWith("/contract");
    }

    return pathname.startsWith(href);
  }

  function formatUnreadCount(count: number) {
    if (count > 99) {
      return "99+";
    }

    return String(count);
  }

  return (
    <aside className="hidden min-h-screen w-[235px] shrink-0 border-r border-white/10 bg-black/35 py-6 backdrop-blur-md md:flex md:flex-col">
      <nav className="space-y-3">
        {visibleSections.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = openSections[section.id];

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
                  {section.children.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = isItemActive(item.href);

                    const shouldShowUnreadBadge =
                      item.showUnreadBadge === true && unreadCount > 0;

                    const shouldShowPendingContractsBadge =
                      item.showPendingContractsBadge === true &&
                      pendingContractsCount > 0;

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
                            {formatUnreadCount(unreadCount)}
                          </span>
                        )}

                        {shouldShowPendingContractsBadge && (
                          <span
                            className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-black"
                            aria-label={`${pendingContractsCount} contracte în așteptare`}
                          >
                            {formatUnreadCount(pendingContractsCount)}
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

        <p className="truncate px-3 text-sm text-zinc-300">{username}</p>

        <p className="mt-1 px-3 text-xs tracking-wider text-[#B8904D] uppercase">
          {role}
        </p>
      </div>
    </aside>
  );
}

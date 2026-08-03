"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  LaptopMinimalCheck,
  UserShield,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA";

interface DashboardSidebarProps {
  username: string;
  role: UserRole;
}

interface SidebarItem {
  label: string;
  href: string;
  icon: typeof House;
}

interface SidebarSection {
  id: "business" | "mafia";
  label: string;
  icon: typeof House;
  roles: UserRole[];
  children: SidebarItem[];
}

const sidebarSections: SidebarSection[] = [
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
        label: "Angajați",
        href: "/afacere/employees",
        icon: Users,
      },
      {
        label: "Notificari",
        href: "/afacere/notificari",
        icon: Mail,
      },
      {
        label: "Pontaj",
        href: "/afacere/pontaj",
        icon: Hourglass,
      },
      {
        label: "Invoiri",
        href: "/afacere/invoiri",
        icon: UserShield,
      },
    ],
  },
  {
    id: "mafia",
    label: "Mafia",
    icon: UserLock,

    // Mafia apare doar utilizatorilor cu rolul MAFIA.
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
      {
        label: "Task",
        href: "/mafia/task",
        icon: LaptopMinimalCheck,
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

  async function handleLogout() {
    try {
      await fetch("http://localhost:5000/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      router.replace("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const [openSections, setOpenSections] = useState({
    business: pathname.startsWith("/afacere"),
    mafia: pathname.startsWith("/mafia"),
  });

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
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    if (href === "/mafia") {
      return pathname === "/mafia";
    }

    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden min-h-screen w-[235px] shrink-0 border-r border-white/10 bg-black/35 px-5 py-6 backdrop-blur-md md:flex md:flex-col">
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
                    className="h-5 w-5 text-green-400"
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

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? "bg-white/10 text-green-400"
                            : "text-zinc-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <ItemIcon
                          className="h-4 w-4 shrink-0"
                          strokeWidth={1.8}
                        />

                        <span>{item.label}</span>
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
          onClick={handleLogout}
          className="mb-4 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-zinc-300 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-5 w-5" />

          <span>Logout</span>
        </button>

        <p className="truncate px-3 text-sm text-zinc-300">{username}</p>

        <p className="mt-1 px-3 text-xs uppercase tracking-wider text-green-500">
          {role}
        </p>
      </div>
    </aside>
  );
}

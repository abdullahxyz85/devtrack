"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

function getInitial(name?: string | null) {
  return name?.trim().charAt(0).toUpperCase() || "?";
}

export default function UserAvatar() {
  const { data: session } = useSession();
  const [imageFailed, setImageFailed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const name = session?.user?.name ?? session?.githubLogin ?? "GitHub user";
  const image = session?.user?.image;
  const showImage = image && !imageFailed;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--card-foreground)] hover:border-[var(--accent)]/50 transition-colors cursor-pointer"
        aria-label="User menu"
        aria-expanded={showMenu}
      >
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--control)] text-sm font-semibold text-[var(--card-foreground)]">
          {showImage ? (
            <Image
              src={image}
              alt={`${name} avatar`}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span aria-hidden="true">{getInitial(name)}</span>
          )}
        </div>
        <span className="max-w-32 truncate text-sm font-medium leading-none text-[var(--card-foreground)]">
          {name}
        </span>
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg z-50">
          <Link
            href="/dashboard/settings"
            className="block px-4 py-2 text-sm text-[var(--card-foreground)] hover:bg-[var(--control)] transition-colors rounded-t-lg"
            onClick={() => setShowMenu(false)}
          >
            ⚙️ Settings
          </Link>
          <button
            onClick={() => setShowMenu(false)}
            className="w-full text-left px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--control)] transition-colors rounded-b-lg border-t border-[var(--border)]"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

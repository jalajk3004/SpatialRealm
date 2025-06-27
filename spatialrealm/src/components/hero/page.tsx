"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaEye } from "react-icons/fa";
import { useSession } from "next-auth/react";

interface Workspace {
  id: string;
  name: string;
  image?: string;
}

export default function MyWorkspaces() {
  const { data: session, status } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/myworkspaces")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setWorkspaces(data.workspaces);
          }
        })
        .catch((err) => console.error("Failed to fetch workspaces:", err))
        .finally(() => setLoading(false));
    }
  }, [status]);

  if (status === "loading" || loading) {
    return <p className="text-gray-500 ml-8 mt-12">Loading your workspaces...</p>;
  }

  if (workspaces.length === 0) {
    return <p className="text-gray-500 ml-8 mt-12">No workspaces found.</p>;
  }

  return (
    <section className="flex flex-wrap gap-4 mt-12 ml-8">
      {workspaces.map((ws) => (
        <div
          key={ws.id}
          className="relative group h-48 w-64 rounded-3xl overflow-hidden transition-all duration-300 bg-amber-50 shadow-md"
        >
          <Image
            src={ws.image || "/spatialrealm.png"}
            alt={ws.name}
            layout="fill"
            objectFit="cover"
            className="rounded-3xl"
          />
          <div className="absolute inset-0 bg-zinc-800 opacity-0 group-hover:opacity-70 transition-opacity duration-300 rounded-3xl" />
          <Link
            href={`/workspace/${ws.id}`}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white"
          >
            <FaEye className="text-2xl" />
          </Link>
          <div className="absolute bottom-2 left-0 w-full px-4 flex justify-between text-white z-10 text-sm">
            <h3 className="font-semibold">{ws.name}</h3>
            <p className="opacity-80">Last visited</p>
          </div>
        </div>
      ))}
    </section>
  );
}

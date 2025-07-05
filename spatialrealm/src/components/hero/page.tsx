"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaEye, FaTrashAlt } from "react-icons/fa";
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

  const fetchWorkspaces = () => {
    fetch("/api/myworkspaces")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setWorkspaces(data.workspaces);
        }
      })
      .catch((err) => console.error("Failed to fetch workspaces:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchWorkspaces();
    }
  }, [status]);

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete workspace "${name}"?`)) return;

    try {
      const res = await fetch("/api/deleteworkspace", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (data.success) {
        setWorkspaces((prev) => prev.filter((ws) => ws.name !== name));
      } else {
        alert(data.error || "Failed to delete workspace.");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Something went wrong.");
    }
  };

  if (status === "loading" || loading) {
    return <p className="text-gray-500 ml-8 mt-12">Loading your workspaces...</p>;
  }

  if (workspaces.length === 0) {
    return <p className="text-gray-500 ml-8 mt-12">No workspaces found.</p>;
  }

  return (
    <section className="flex flex-wrap gap-4 mt-12 ml-8 md:ml-28">
      {workspaces.map((ws) => (
        <div
          key={ws.id}
          className="relative group h-48 w-64 rounded-3xl overflow-hidden transition-all duration-300 bg-amber-50 shadow-md"
        >
          <Image
            src={"/maps/map.png"}
            alt={ws.name}
            layout="fill"
            objectFit="cover"
            className="rounded-3xl"
          />

          {/* Hover dark overlay */}
          <div className="absolute inset-0 bg-zinc-800 opacity-0 group-hover:opacity-70 transition-opacity duration-300 rounded-3xl" />

          {/* View button */}
          <Link
            href={`/workspace/${ws.id}`}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white"
          >
            <FaEye className="text-2xl" />
          </Link>

          {/* Delete icon */}
          <button
            onClick={() => handleDelete(ws.name)}
            className="absolute top-2 right-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 hover:text-red-500"
            title="Delete workspace"
          >
            <FaTrashAlt className="text-lg" />
          </button>

          {/* Footer */}
          <div className="absolute bottom-2 left-0 w-full px-4 flex justify-between text-white z-10 text-sm">
            <h3 className="font-semibold">{ws.name}</h3>
            <p className="opacity-80">Last visited</p>
          </div>
        </div>
      ))}
    </section>
  );
}

"use client";
import Image from "next/image";
import { Button } from "../ui/button";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";


export default function Navbar() {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const { data: session, status } = useSession();

  const createWorkspace = async () => {
    const name = nameRef.current?.value?.trim();

    if (!name) {
      alert("Please enter a workspace name.");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/createworkspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (data.success && data.workspace?.id) {
        router.push(`/workspace/${data.workspace.id}`);
      } else {
        console.error("Workspace creation failed", data);
        alert("Failed to create workspace.");
      }
    } catch (err) {
      console.error("Error:", err);
      alert("An error occurred.");
    } finally {
      setCreating(false);
    }
  };
  return (
    <>
      <section>
        <nav className="flex items-center justify-between  text-white shadow-2xl">
          <div className="flex items-center ml-4">
            <Link href="/">
              <Image
                src="/images/logo.png"
                alt="Spatial Realm Logo"
                width={100}
                height={100}
              />
            </Link>
          </div>
          <div className="flex space-x-4 mr-4">
            <Sheet >
              <SheetTrigger asChild >
                <Button variant="ghost" className="text-white font-bold hover:bg-gray-600">Create Workspace</Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Creating your Space</SheetTitle>
                </SheetHeader>
                <div className="grid flex-1 auto-rows-min gap-6 px-4">
                  <div className="grid gap-3">
                    <Label htmlFor="sheet-demo-name">Name</Label>
                    <Input id="sheet-demo-name" ref={nameRef} placeholder="Enter workspace name" />
                  </div>
                </div>
                <SheetFooter>
                  <Button type="submit" variant="ghost" className="text-white font-bold hover:bg-gray-600" onClick={createWorkspace}>Create Workspace</Button>
                  <SheetClose asChild>
                    <Button variant="ghost" className="text-white font-bold hover:bg-gray-600">Close</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <DropdownMenu>

              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white font-bold hover:bg-gray-600">
                  <Avatar>
                    <AvatarImage src={session?.user?.image || "/default-avatar.png"} />
                    <AvatarFallback />
                  </Avatar>
                  {session?.user ? (
                    <span className="ml-2">{session.user.name}</span>
                  ) : (
                    <span className="ml-2">User</span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuLabel onClick={() => signOut({ callbackUrl: "/auth" })} className="cursor-pointer" >LogOut</DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </section>
    </>
  );
}

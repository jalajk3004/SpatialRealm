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
import { signOut } from "next-auth/react";

export default function Navbar() {


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
            <Button variant="ghost" className="text-white font-bold hover:bg-gray-600">
                <Link href="/">Create Space</Link>
            </Button>
            <DropdownMenu>

            <DropdownMenuTrigger >
            <Button variant="ghost" className="text-white font-bold hover:bg-gray-600">
              <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback></AvatarFallback>
              </Avatar>
                  <Link href="/about">User</Link>
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

import Image from "next/image";
import Link from "next/link";
import { FaEye } from "react-icons/fa";

export default function Hero() {
  return (
    <section className="mt-12 ml-8">
      <div className="relative group h-48 w-64 rounded-3xl overflow-hidden transition-all duration-300 bg-amber-50 shadow-md">
        {/* Image */}
        <Image
          src="/spatialrealm.png"
          alt="Spatial Realm Logo"
          layout="fill"
          objectFit="cover"
          className="rounded-3xl"
        />

        {/* Dark overlay on hover */}
        <div className="absolute inset-0 bg-zinc-800 opacity-0 group-hover:opacity-70 transition-opacity duration-300 rounded-3xl" />

        {/* Eye Icon (visible only on hover) */}
        <Link
          href="/spatialrealm"
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white"
        >
          <FaEye className="text-2xl" />
        </Link>

        {/* Text inside the card at bottom */}
        <div className="absolute bottom-2 left-0 w-full px-4 flex justify-between text-white z-10 text-sm">
          <h3 className="font-semibold">Your Title</h3>
          <p className="opacity-80">Last visited</p>
        </div>
      </div>
    </section>
  );
}

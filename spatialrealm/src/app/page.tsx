import Hero from "@/components/hero/page";
import Navbar from "@/components/navbar/page";
import Image from "next/image";

export default function Home() {
  return (
    <>
    <main>
      <Navbar />
      
        <Hero />
      
    </main>
    </>
  );
}

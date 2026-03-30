import Navbar from '@/components/Navbar';
import HomeClient from '@/components/HomeClient';

export default function Home() {
  return (
    <>
      {/* Dark background */}
      <div className="party-bg"></div>

      {/* Party Light Rays - Visible colored beams from top center */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-10 overflow-hidden">
        {/* Red beam - far left */}
        <div className="absolute top-0 left-1/2 w-[300px] h-[120vh] origin-top -translate-x-1/2 rotate-[-55deg] bg-gradient-to-b from-red-500/40 via-red-500/10 to-transparent blur-2xl"></div>

        {/* Orange beam */}
        <div className="absolute top-0 left-1/2 w-[250px] h-[110vh] origin-top -translate-x-1/2 rotate-[-35deg] bg-gradient-to-b from-orange-500/35 via-orange-500/8 to-transparent blur-2xl"></div>

        {/* Yellow beam */}
        <div className="absolute top-0 left-1/2 w-[200px] h-[100vh] origin-top -translate-x-1/2 rotate-[-18deg] bg-gradient-to-b from-yellow-400/30 via-yellow-400/5 to-transparent blur-2xl"></div>

        {/* Green beam - center left */}
        <div className="absolute top-0 left-1/2 w-[180px] h-[95vh] origin-top -translate-x-1/2 rotate-[-5deg] bg-gradient-to-b from-emerald-400/25 via-emerald-400/5 to-transparent blur-2xl"></div>

        {/* Blue beam - center */}
        <div className="absolute top-0 left-1/2 w-[200px] h-[100vh] origin-top -translate-x-1/2 rotate-[8deg] bg-gradient-to-b from-blue-500/30 via-blue-500/8 to-transparent blur-2xl"></div>

        {/* Violet beam */}
        <div className="absolute top-0 left-1/2 w-[250px] h-[110vh] origin-top -translate-x-1/2 rotate-[25deg] bg-gradient-to-b from-violet-500/35 via-violet-500/10 to-transparent blur-2xl"></div>

        {/* Pink beam */}
        <div className="absolute top-0 left-1/2 w-[280px] h-[115vh] origin-top -translate-x-1/2 rotate-[42deg] bg-gradient-to-b from-pink-500/35 via-pink-500/8 to-transparent blur-2xl"></div>

        {/* Magenta beam - far right */}
        <div className="absolute top-0 left-1/2 w-[300px] h-[120vh] origin-top -translate-x-1/2 rotate-[58deg] bg-gradient-to-b from-fuchsia-500/40 via-fuchsia-500/10 to-transparent blur-2xl"></div>

        {/* Central white glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-gradient-to-b from-white/30 via-white/5 to-transparent blur-3xl"></div>
      </div>

      <main className="relative min-h-screen z-20">
        <Navbar />
        <HomeClient />
      </main>
    </>
  );
}

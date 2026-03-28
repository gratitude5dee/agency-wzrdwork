import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Shield, Workflow, Plug, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import wzrdLogo from "@/assets/wzrdtechlogo.png";

const features = [
  {
    icon: Workflow,
    title: "3D Agent Sandbox",
    description:
      "Watch your autonomous agents collaborate in a real-time 3D office environment with full delegation control.",
  },
  {
    icon: Bot,
    title: "Delegation System",
    description:
      "Define reporting hierarchies, approve actions, and let AI agents self-organize around your company goals.",
  },
  {
    icon: Shield,
    title: "Identity & Payments",
    description:
      "ERC-8004 on-chain identity, MetaMask delegations, x402 invoicing, and Celo stablecoin transactions.",
  },
  {
    icon: Plug,
    title: "Adapter Ecosystem",
    description:
      "Connect Claude, Codex, Gemini, Cursor, and custom HTTP endpoints through a unified adapter interface.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="dark relative min-h-screen overflow-hidden bg-black text-zinc-100">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-[hsl(20,100%,30%)] opacity-[0.07] blur-[120px]" />
        <div className="absolute -bottom-60 -right-40 h-[500px] w-[500px] rounded-full bg-[hsl(220,80%,30%)] opacity-[0.06] blur-[120px]" />
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[hsl(20,100%,40%)] opacity-[0.04] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-3">
          <img src={wzrdLogo} alt="WZRD.tech" className="h-16" />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/auth")}
            className="text-zinc-400 hover:text-white hover:bg-white/5"
          >
            Sign In
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/auth")}
            className="bg-[hsl(20,100%,45%)] text-white hover:bg-[hsl(20,100%,50%)] border-0"
          >
            Launch App
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 pt-16 text-center md:pt-28">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex justify-center"
        >
          <img src={wzrdLogo} alt="WZRD.tech" className="h-32 md:h-40" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-[hsl(20,100%,45%)]/20 bg-[hsl(20,100%,45%)]/10 px-4 py-1.5"
        >
          <Sparkles className="h-3.5 w-3.5 text-[hsl(20,100%,55%)]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(20,100%,65%)]">
            Autonomous Agent OS
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="mx-auto max-w-3xl text-4xl font-black uppercase leading-[1.1] tracking-tight md:text-6xl"
        >
          YOUR AUTONOMOUS BUSINESS OPERATIONS,{" "}
          <span className="bg-gradient-to-r from-[hsl(20,100%,55%)] to-[hsl(35,100%,60%)] bg-clip-text text-transparent">
            ORCHESTRATED
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg"
        >
          Deploy, delegate, and supervise autonomous AI agents in a real-time 3D
          command center. Built on-chain with ERC-8004 identity and x402
          payments.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.7 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-[hsl(20,100%,45%)] text-white hover:bg-[hsl(20,100%,50%)] border-0 px-8 text-sm font-bold uppercase tracking-wider"
          >
            Launch App
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="border-white/10 bg-white/5 text-zinc-300 backdrop-blur hover:bg-white/10 hover:text-white px-8 text-sm font-bold uppercase tracking-wider"
          >
            Explore
          </Button>
        </motion.div>
      </section>

      {/* Screenshot preview */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-xl shadow-2xl shadow-black/50"
        >
          <div className="rounded-xl bg-[hsl(222,60%,3%)] overflow-hidden">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              </div>
              <div className="ml-4 flex-1 rounded-md bg-white/5 px-3 py-1 text-[10px] text-zinc-600">
                app.wzrd.tech/cockpit
              </div>
            </div>
            {/* Placeholder for screenshot */}
            <div className="relative aspect-video bg-gradient-to-br from-[hsl(222,60%,5%)] to-[hsl(222,60%,8%)] flex items-center justify-center">
              <div className="text-center">
                <Workflow className="mx-auto h-12 w-12 text-zinc-700 mb-3" />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  3D Agent Sandbox
                </p>
                <p className="mt-1 text-[10px] text-zinc-700">
                  Real-time autonomous delegation environment
                </p>
              </div>
              {/* Glass overlay cards to simulate UI */}
              <div className="absolute left-4 top-4 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl w-48">
                <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Live Brief</p>
                <p className="mt-1 text-[10px] text-zinc-400 leading-snug">Agent workforce coordinating across projects...</p>
              </div>
              <div className="absolute right-4 top-4 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl w-40">
                <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Inspector</p>
                <div className="mt-2 space-y-1.5">
                  <div className="h-1.5 rounded-full bg-zinc-700/50 w-full" />
                  <div className="h-1.5 rounded-full bg-zinc-700/50 w-3/4" />
                  <div className="h-1.5 rounded-full bg-zinc-700/50 w-1/2" />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="h-5 w-5 rounded-full bg-[hsl(20,100%,45%)]/20 border border-[hsl(20,100%,45%)]/30" />
                    <div className="h-5 w-5 rounded-full bg-blue-500/20 border border-blue-500/30" />
                    <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-zinc-700/50 w-1/3" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-5xl px-6 pb-32">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-12 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500"
        >
          Core Capabilities
        </motion.p>
        <div className="grid gap-5 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <f.icon className="h-5 w-5 text-[hsl(20,100%,55%)]" />
              </div>
              <h3 className="mb-2 text-sm font-black uppercase tracking-wider">
                {f.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-zinc-500">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={wzrdLogo} alt="WZRD.tech" className="h-10 opacity-40" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
            © {new Date().getFullYear()} WZRD.tech
          </p>
        </div>
      </footer>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { arbitrum } from "thirdweb/chains";
import { getDefaultToken } from "thirdweb/react";
import { useThirdwebClient } from "@/providers/ThirdwebProvider";
import wzrdLogo from "@/assets/wzrdtechlogo.png";

const wallets = [
  inAppWallet({
    auth: { options: ["google", "email", "passkey"] },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
];

const usdcToken = getDefaultToken(arbitrum, "USDC");

export default function AuthPage() {
  const client = useThirdwebClient();
  const account = useActiveAccount();
  const navigate = useNavigate();

  // Once connected, redirect to cockpit
  useEffect(() => {
    if (account) navigate("/cockpit", { replace: true });
  }, [account, navigate]);

  if (!client) return null;

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-[hsl(20,100%,30%)] opacity-[0.06] blur-[120px]" />
        <div className="absolute -right-32 bottom-1/4 h-[400px] w-[400px] rounded-full bg-[hsl(220,80%,30%)] opacity-[0.05] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex w-full max-w-md flex-col items-center gap-10 px-6"
      >
        {/* Logo + branding */}
        <div className="flex flex-col items-center gap-4">
          <img src={wzrdLogo} alt="WZRD.tech" className="h-14" />
          <div className="text-center">
            <h1 className="text-xl font-black uppercase tracking-[0.12em] text-zinc-100">
              Welcome Back
            </h1>
            <p className="mt-2 max-w-xs text-sm text-zinc-500">
              Connect your wallet to access the autonomous agent operating system.
            </p>
          </div>
        </div>

        {/* Glass card with connect button */}
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              Sign in with wallet
            </p>
            <ConnectButton
              client={client}
              wallets={wallets}
              chain={arbitrum}
              connectButton={{ label: "Connect Wallet" }}
              supportedTokens={usdcToken ? { [arbitrum.id]: [usdcToken] } : undefined}
              detailsButton={
                usdcToken
                  ? { displayBalanceToken: { [arbitrum.id]: usdcToken.address } }
                  : undefined
              }
              theme="dark"
            />
          </div>
        </div>

        {/* Back to landing link */}
        <button
          onClick={() => navigate("/")}
          className="text-[11px] uppercase tracking-[0.2em] text-zinc-600 transition-colors hover:text-zinc-400"
        >
          ← Back to home
        </button>
      </motion.div>
    </div>
  );
}

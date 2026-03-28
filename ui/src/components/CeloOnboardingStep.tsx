import { useState, useEffect } from "react";
import { AlertCircle, Wallet, Settings, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "../lib/utils";

export interface CeloOnboardingStepProps {
  onComplete: () => void;
  onSkip: () => void;
  companyId: string;
}

const STABLECOINS = [
  {
    symbol: "cUSD",
    name: "Celo Dollar",
    chain: "Celo Mainnet",
    icon: "💵",
  },
  {
    symbol: "cEUR",
    name: "Celo Euro",
    chain: "Celo Mainnet",
    icon: "€",
  },
  {
    symbol: "cREAL",
    name: "Celo Brazilian Real",
    chain: "Celo Mainnet",
    icon: "R$",
  },
];

export function CeloOnboardingStep({
  onComplete,
  onSkip,
  companyId,
}: CeloOnboardingStepProps) {
  const [step, setStep] = useState<"options" | "configure" | "complete">(
    "options"
  );
  const [selectedStablecoins, setSelectedStablecoins] = useState<string[]>([
    "cUSD",
  ]);
  const [useMinipay, setUseMinipay] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate wallet connection
      // In real implementation, would use @celo/react-celo or similar
      const mockAddress = `0x${Math.random().toString(16).substring(2, 42)}`;
      setWalletAddress(mockAddress);
      setStep("configure");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect wallet"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfigurations = (config: string) => {
    if (config === "cUSD" || config === "cEUR" || config === "cREAL") {
      if (!selectedStablecoins.includes(config)) {
        setSelectedStablecoins([...selectedStablecoins, config]);
      }
    }
  };

  const handleRemoveStablecoin = (symbol: string) => {
    setSelectedStablecoins(selectedStablecoins.filter((s) => s !== symbol));
  };

  const handleCompleteSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API call to save configuration
      // In real implementation would call Celo API
      console.log("Celo config saved:", {
        companyId,
        walletAddress,
        stablecoins: selectedStablecoins,
        minipay: useMinipay,
      });
      setStep("complete");
      setTimeout(onComplete, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save configuration"
      );
    } finally {
      setLoading(false);
    }
  };

  if (step === "complete") {
    return (
      <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-50/50 border-emerald-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-xl">✓</span>
          </div>
          <h3 className="font-semibold text-base">Celo Setup Complete</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Your Celo payment integrations are ready to use.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-transparent">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[#35D07F] flex items-center justify-center text-white font-semibold text-sm">
              C
            </div>
            <h2 className="font-semibold text-lg">Set Up Celo Payments</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Enable fast, low-cost payments using Celo stablecoins for your
            agents.
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {step === "options" && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="grid gap-3">
              <button
                onClick={handleConnectWallet}
                disabled={loading}
                className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors flex items-center gap-3 text-left"
              >
                <Wallet className="h-5 w-5 text-[#35D07F] flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Connect Celo Wallet</p>
                  <p className="text-xs text-muted-foreground">
                    Link your wallet for payments
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleConfigurations("cUSD")}
                className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors flex items-center gap-3 text-left"
              >
                <Settings className="h-5 w-5 text-[#35D07F] flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    Configure cUSD Stablecoin
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Set up payment preferences
                  </p>
                </div>
              </button>
            </div>

            {/* Stablecoins Grid */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                SUPPORTED STABLECOINS
              </p>
              <div className="grid grid-cols-3 gap-2">
                {STABLECOINS.map((coin) => (
                  <div
                    key={coin.symbol}
                    className="p-3 border border-border rounded-lg text-center hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <p className="text-xl mb-1">{coin.icon}</p>
                    <p className="font-semibold text-xs">{coin.symbol}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {coin.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Minipay option */}
            <div className="p-3 border border-border rounded-lg bg-blue-50/30">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMinipay}
                  onChange={(e) => setUseMinipay(e.target.checked)}
                  className="rounded"
                />
                <div className="flex-1 text-sm">
                  <p className="font-medium">Use Minipay (Optional)</p>
                  <p className="text-xs text-muted-foreground">
                    Celo's mobile wallet integration
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {step === "configure" && walletAddress && (
          <div className="space-y-4">
            {/* Wallet Info */}
            <div className="p-3 border border-border rounded-lg bg-accent/30">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Connected Wallet
              </p>
              <p className="font-mono text-xs break-all">{walletAddress}</p>
            </div>

            {/* Balance Placeholder */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border border-border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">
                  cUSD Balance
                </p>
                <p className="font-semibold text-sm">$0.00</p>
              </div>
              <div className="p-3 border border-border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">
                  cEUR Balance
                </p>
                <p className="font-semibold text-sm">€0.00</p>
              </div>
            </div>

            {/* Configured Stablecoins */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                CONFIGURED STABLECOINS
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedStablecoins.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No stablecoins selected
                  </p>
                ) : (
                  selectedStablecoins.map((coin) => (
                    <Badge
                      key={coin}
                      variant="outline"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleRemoveStablecoin(coin)}
                    >
                      {coin}
                      <span className="ml-1">×</span>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Add more stablecoins */}
            <div className="p-3 border border-border rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                ADD STABLECOINS
              </p>
              <div className="flex gap-2">
                {STABLECOINS.filter((c) => !selectedStablecoins.includes(c.symbol)).map(
                  (coin) => (
                    <Button
                      key={coin.symbol}
                      size="sm"
                      variant="outline"
                      onClick={() => handleConfigurations(coin.symbol)}
                    >
                      {coin.symbol}
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSkip}
            disabled={loading}
            className="flex-1"
          >
            <SkipForward className="h-3 w-3 mr-1" />
            Skip for now
          </Button>

          {step === "options" && (
            <Button
              size="sm"
              onClick={handleConnectWallet}
              disabled={loading}
              className="flex-1 bg-[#35D07F] hover:bg-[#35D07F]/90"
            >
              {loading ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}

          {step === "configure" && (
            <Button
              size="sm"
              onClick={handleCompleteSetup}
              disabled={
                loading || selectedStablecoins.length === 0 || !walletAddress
              }
              className="flex-1 bg-[#35D07F] hover:bg-[#35D07F]/90"
            >
              {loading ? "Saving..." : "Complete Setup"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

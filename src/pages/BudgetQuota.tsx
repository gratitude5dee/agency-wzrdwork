import { DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// TODO (M4.2.3): Integrate with compat-client for budget and quota data.
export function BudgetQuotaPage() {
  const policies = [], quotas = [];
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-black text-zinc-100">Budgets & Quotas</h1>
        <p className="mt-1 text-sm text-zinc-500">Track spending and quotas.</p>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-zinc-100">Budget Policies</h2>
        {policies.length === 0 ? (
          <Card className="border-white/10 bg-[#0d1118]">
            <CardContent className="flex items-center justify-center py-6">
              <DollarSign className="mr-2 h-5 w-5 text-zinc-600" />
              <p className="text-sm text-zinc-400">No policies configured.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {policies.map((p: any) => (
              <Card key={p.id} className="border-white/10 bg-[#0d1118]">
                <CardContent className="pt-3">
                  <p className="text-sm font-medium text-zinc-100">{p.name}</p>
                  <p className="text-xs text-zinc-400 mt-1">${p.spent} / ${p.limit}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">Quotas</h2>
        {quotas.length === 0 ? (
          <Card className="border-white/10 bg-[#0d1118]">
            <CardContent className="flex items-center justify-center py-4">
              <p className="text-sm text-zinc-400">No quotas configured.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {quotas.map((q: any) => (
              <Card key={q.id} className="border-white/10 bg-[#0d1118]">
                <CardContent className="pt-3">
                  <p className="text-sm font-medium text-zinc-100">{q.resource}</p>
                  <p className="text-xs text-zinc-400">{q.used} / {q.limit}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

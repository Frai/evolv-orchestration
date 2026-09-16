"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import type { DeliveryChannel, Settings } from "@/core/types";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CHANNELS: { id: DeliveryChannel; label: string; hint: string }[] = [
  { id: "whatsapp", label: "WhatsApp", hint: "Best for reading on your phone" },
  { id: "email", label: "Email", hint: "Easy to forward to a partner" },
  { id: "both", label: "Both", hint: "WhatsApp and email" },
];

export function SettingsPage() {
  const { settings, updateSettings, location } = useAppState();
  // Remount the form when the tenant changes so its local state re-initialises from that tenant's settings.
  return <SettingsForm key={location?.id ?? "none"} settings={settings} updateSettings={updateSettings} locationName={location?.name ?? ""} />;
}

function SettingsForm({ settings, updateSettings, locationName }: { settings: Settings; updateSettings: (p: Partial<Settings>) => void; locationName: string }) {
  const [channel, setChannel] = useState(settings.deliveryChannel);
  const [sendTime, setSendTime] = useState(settings.sendTime);
  const [recipients, setRecipients] = useState(settings.recipients.join("\n"));
  const [target, setTarget] = useState(String(Math.round(settings.targetLabourPct * 100)));
  const [saved, setSaved] = useState(false);

  const save = () => {
    const t = Math.min(60, Math.max(10, Number(target) || 28)) / 100;
    updateSettings({
      deliveryChannel: channel,
      sendTime,
      recipients: recipients
        .split(/\n|,/)
        .map((r) => r.trim())
        .filter(Boolean),
      targetLabourPct: t,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" description={`How ${locationName} gets its brief. Changes apply to this location.`} />

      <Section title="Morning brief delivery">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Channel</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChannel(c.id)}
                  className={cn(
                    "flex cursor-pointer flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-colors",
                    channel === c.id ? "border-primary bg-accent" : "hover:bg-muted",
                  )}
                  aria-pressed={channel === c.id}
                >
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-muted-foreground text-xs">{c.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="send-time">Send time</Label>
              <Input id="send-time" type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} className="sm:max-w-40" />
              <p className="text-muted-foreground text-xs">Local time. The day closes in the POS around 23:30, so anything after 5:00 AM works.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="recipients">Recipients</Label>
              <Textarea id="recipients" rows={3} value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder={"+1 403 555 0100\nowner@restaurant.ca"} />
              <p className="text-muted-foreground text-xs">One per line. Phone numbers get WhatsApp, addresses get email.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Targets">
        <div className="flex flex-col gap-2 sm:max-w-xs">
          <Label htmlFor="target">Target labour, % of net sales</Label>
          <div className="flex items-center gap-2">
            <Input id="target" type="number" inputMode="numeric" min={10} max={60} value={target} onChange={(e) => setTarget(e.target.value)} className="max-w-24" />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
          <p className="text-muted-foreground text-xs">Drives the labour alerts, the target line on the Labour page and the Labour Optimizer.</p>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <Button onClick={save} size="lg" className="w-full sm:w-auto">
          Save changes
        </Button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
            <Check className="size-4" /> Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { Bot, Check, CheckCircle2, Pencil, X, XCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import type { Agent, AgentMode, Approval } from "@evolv/contracts/types";
import { dateTime, money } from "@evolv/contracts/format";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function ApprovalsPage() {
  const { approvals, approvalsLoading, resolveApproval, resolvingApprovalId, location, agentModes, setAgentMode } = useAppState();
  const agents = useAsync(() => apiClient.agents.listAgents(), []);
  const [editing, setEditing] = useState<Approval | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const pending = approvals.filter((a) => a.status === "pending");
  const done = approvals.filter((a) => a.status !== "pending").sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""));
  const agentName = (id: string) => agents.data?.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Approvals" description={`Actions agents want to take at ${location?.name}. Nothing happens until you say so.`} />

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">
            Queue {pending.length ? <span className="bg-primary text-primary-foreground tnum rounded-full px-1.5 text-[11px]">{pending.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          {approvalsLoading ? (
            <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
          ) : pending.length ? (
            <div className="flex flex-col gap-3">
              {pending.map((a) => (
                <ApprovalCard
                  key={a.id}
                  approval={a}
                  agentName={agentName(a.agentId)}
                  pending={resolvingApprovalId === a.id}
                  onApprove={() => void resolveApproval(a.id, "approved").catch(() => {})}
                  onReject={() => void resolveApproval(a.id, "rejected").catch(() => {})}
                  onEdit={() => {
                    setEditing(a);
                    setDraft(a.action);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Queue is clear" description="Agents will add proposals here when they find something worth acting on." />
          )}
        </TabsContent>

        <TabsContent value="done">
          {approvalsLoading ? (
            <Skeleton className="h-32" />
          ) : done.length ? (
            <div className="flex flex-col gap-3">
              {done.map((a) => (
                <ApprovalCard key={a.id} approval={a} agentName={agentName(a.agentId)} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing resolved yet" />
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Section title="How much freedom each agent gets" description="Ask me first sends a proposal here. Act automatically lets the agent do it and tells you afterwards. Visual only in this demo.">
            {agents.loading ? (
              <Skeleton className="h-40" />
            ) : (
              <ul className="flex flex-col divide-y">
                {agents.data?.map((ag) => (
                  <AgentModeRow key={ag.id} agent={ag} mode={agentModes[ag.id] ?? ag.defaultMode} onChange={(m) => setAgentMode(ag.id, m)} />
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="pr-6">Edit before approving</DialogTitle>
            <DialogDescription>Change what the agent will do. The edited action is what gets sent.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="action">Action</Label>
            <Textarea id="action" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                if (!editing) return;
                setSaving(true);
                try {
                  await resolveApproval(editing.id, "approved", draft.trim() || editing.action);
                  setEditing(null);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save and approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovalCard({
  approval: a,
  agentName,
  pending,
  onApprove,
  onReject,
  onEdit,
}: {
  approval: Approval;
  agentName: string;
  pending?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
}) {
  const resolved = a.status !== "pending";
  return (
    <Card className={cn("gap-3 px-4", resolved && a.status === "rejected" && "opacity-80")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1"><Bot className="size-3.5" /> {agentName}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{dateTime(a.proposedAt)}</span>
        {a.runId ? (
          <Link href={`/agents/?run=${encodeURIComponent(a.runId)}`} className="text-primary underline-offset-2 hover:underline">
            View trace
          </Link>
        ) : null}
        {resolved ? (
          <Badge variant={a.status === "approved" ? "success" : "danger"} className="ml-auto">
            {a.status === "approved" ? <CheckCircle2 /> : <XCircle />}
            {a.status === "approved" ? "Approved" : "Rejected"}
          </Badge>
        ) : null}
      </div>
      <div>
        <h3 className="font-semibold leading-snug">{a.title}</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{a.summary}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        {a.evidence.map((e) => (
          <div key={e.label} className="bg-muted/50 rounded-md px-2.5 py-1.5">
            <dt className="text-muted-foreground text-[11px]">{e.label}</dt>
            <dd className="tnum font-medium">
              <Link href={e.href} className="underline-offset-2 hover:underline">
                {e.value}
              </Link>
            </dd>
          </div>
        ))}
        {a.amount && a.agentId === "inventory-guard" ? (
          <div className="bg-muted/50 rounded-md px-2.5 py-1.5">
            <dt className="text-muted-foreground text-[11px]">Amount</dt>
            <dd className="tnum font-medium">{money(a.amount)}</dd>
          </div>
        ) : null}
      </dl>
      {a.action !== a.title && !resolved ? <p className="text-muted-foreground text-xs">Will do: {a.action}</p> : null}
      {resolved ? (
        <p className={cn("rounded-md border px-3 py-2 text-sm", a.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900")}>
          {a.confirmation}
          {a.resolvedAt ? <span className="ml-1 opacity-70">({dateTime(a.resolvedAt)})</span> : null}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end">
          <Button variant="outline" onClick={onReject} disabled={pending}>
            <X /> Reject
          </Button>
          <Button variant="outline" onClick={onEdit} disabled={pending}>
            <Pencil /> Edit
          </Button>
          <Button onClick={onApprove} disabled={pending}>
            <Check /> {pending ? "Working…" : "Approve"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function AgentModeRow({ agent, mode, onChange }: { agent: Agent; mode: AgentMode; onChange: (m: AgentMode) => void }) {
  const disabled = agent.status === "coming_soon";
  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{agent.name}</span>
          {disabled ? <Badge variant="muted">Coming soon</Badge> : null}
        </div>
        <p className="text-muted-foreground text-xs">{mode === "auto" ? "Acts automatically and tells you afterwards" : "Asks you first"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        <span className={cn(mode === "ask_first" ? "font-medium" : "text-muted-foreground")}>Ask me first</span>
        <Switch checked={mode === "auto"} onCheckedChange={(c) => onChange(c ? "auto" : "ask_first")} disabled={disabled} aria-label={`${agent.name} mode`} />
        <span className={cn(mode === "auto" ? "font-medium" : "text-muted-foreground")}>Act automatically</span>
      </div>
    </li>
  );
}

"use client";
import { MessageCircle } from "lucide-react";
import type { Approval, Brief } from "@evolv/contracts/types";
import type { BriefInput } from "@evolv/contracts/brief";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { timeOfDay } from "@evolv/contracts/format";
import { QuickBrief } from "./quick-brief";

export function BriefCard({
  brief,
  loading,
  input,
  numbersLoading,
  pendingApprovals,
  approvalsLoading,
  targetLabourPct,
  roomService,
}: {
  brief: Brief | undefined;
  loading: boolean;
  input: BriefInput | null;
  numbersLoading: boolean;
  pendingApprovals: Approval[];
  approvalsLoading: boolean;
  targetLabourPct: number;
  roomService: boolean;
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <div className="text-muted-foreground text-xs font-medium">Morning brief</div>
          {loading ? <Skeleton className="mt-1.5 h-5 w-64 max-w-full" /> : <CardTitle className="mt-1 text-lg leading-snug">{brief?.headline ?? "No brief for this day"}</CardTitle>}
        </div>
        {brief ? (
          <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
            <MessageCircle className="size-3.5" /> {timeOfDay(brief.deliveredAt)}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {!loading && !brief ? (
          <EmptyState title="Nothing written yet" description="The brief is written at 5:45 AM once the day has closed in the POS." />
        ) : (
          <Tabs defaultValue="quick">
            <TabsList>
              <TabsTrigger value="quick">Quick</TabsTrigger>
              <TabsTrigger value="glance">At a glance</TabsTrigger>
            </TabsList>
            <TabsContent value="quick" className="pt-3">
              <QuickBrief input={input} loading={numbersLoading} pendingApprovals={pendingApprovals} approvalsLoading={approvalsLoading} targetLabourPct={targetLabourPct} roomService={roomService} />
            </TabsContent>
            <TabsContent value="glance" className="pt-3">
              {loading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <div className="flex flex-col gap-3 text-[15px] leading-relaxed">
                  {brief!.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

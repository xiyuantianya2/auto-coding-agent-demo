import { AgentConsole } from "@/components/agent/AgentConsole";
import { Header } from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Agent 控制台 · 全自动编程",
  description: "查看任务清单与进度，复制 Agent 工作流提示词",
};

export default async function AgentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <Header user={user} />
      <AgentConsole />
    </div>
  );
}

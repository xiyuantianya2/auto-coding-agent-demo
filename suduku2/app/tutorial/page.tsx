import type { Metadata } from "next";

import { TutorialCurriculumView } from "@/app/tutorial/tutorial-curriculum-view";

export const metadata: Metadata = {
  title: "教学大纲 | 数独2",
  description: "数独技巧教学：从裸单到 X-Wing，渐进解锁与专项练习。",
};

export default function TutorialPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--s2-page-bg)]">
      <TutorialCurriculumView />
    </div>
  );
}

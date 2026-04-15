import type { Metadata } from "next";

import { Sudoku2EntryScreen } from "@/app/sudoku2-entry-shell";
import { TutorialCurriculumView } from "@/app/tutorial/tutorial-curriculum-view";

export const metadata: Metadata = {
  title: "教学大纲 | 数独2",
  description: "数独技巧教学：从裸单到 X-Wing，渐进解锁与专项练习。",
};

export default function TutorialPage() {
  return (
    <Sudoku2EntryScreen>
      <TutorialCurriculumView />
    </Sudoku2EntryScreen>
  );
}

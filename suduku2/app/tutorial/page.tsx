import Link from "next/link";

export default function TutorialPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">教学</h1>
        <p className="mt-3 text-sm text-zinc-400">
          技巧目录与解锁关系将在后续任务中从教学大纲数据渲染。
        </p>
        <p className="mt-6">
          <Link
            href="/"
            className="text-emerald-400 underline-offset-4 hover:underline"
          >
            返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}

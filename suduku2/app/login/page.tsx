import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">登录</h1>
        <p className="mt-3 text-sm text-zinc-400">
          登录与注册表单将在后续任务中接入服务端 API。
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

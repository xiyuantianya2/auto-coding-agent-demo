import type { Metadata } from "next";
import type { JSX } from "react";

import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = {
  title: "登录 | 数独2",
  description: "注册或登录数独2 局域网账号",
};

export default function LoginPage(): JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold">账号</h1>
        <p className="mt-2 text-sm text-zinc-400">使用用户名与密码登录，或注册新账号。</p>
        <div className="mt-10">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

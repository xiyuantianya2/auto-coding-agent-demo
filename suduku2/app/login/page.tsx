import type { Metadata } from "next";
import { Suspense, type JSX } from "react";

import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = {
  title: "登录 | 数独2",
  description: "注册或登录数独2 局域网账号",
};

export default function LoginPage(): JSX.Element {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[var(--s2-page-bg)] px-6 py-16 text-[var(--s2-text)]">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold">账号</h1>
        <p className="mt-2 text-sm text-[var(--s2-text-muted)]">使用用户名与密码登录，或注册新账号。</p>
        <div className="mt-10">
          <Suspense
            fallback={
              <p className="text-center text-sm text-[var(--s2-text-muted)]" data-testid="login-form-suspense">
                加载中…
              </p>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

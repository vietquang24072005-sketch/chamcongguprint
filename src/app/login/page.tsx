import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-semibold">Chấm công online</h1>
        <p className="mt-1 text-sm text-slate-500">Đăng nhập bằng email hoặc mã nhân viên</p>
        <LoginForm />
      </div>
    </main>
  );
}

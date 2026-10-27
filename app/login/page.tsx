import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Logo, PawPattern } from "@/components/ui/Logo";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  // A checagem "já logado" precisa ser aqui (com acesso ao banco), não no
  // middleware: um JWT pode estar criptograficamente válido mas já invalidado
  // (sessionVersion mudou) ou apontar pra um usuário apagado. Se o middleware
  // decidisse isso só pela assinatura do JWT, esses casos ficariam presos
  // num loop entre "/" e "/login" (a página manda pro /login, o middleware
  // manda de volta pra "/").
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-background px-4 py-10 overflow-hidden">
      <PawPattern className="absolute inset-0 w-full h-full text-brand-100/60 -z-0" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center gap-4">
          <Logo markClassName="w-20 h-20" withText={false} />
          <div>
            <h1 className="font-display text-2xl font-extrabold text-brand-800">Bem-vindo ao Mon Petit</h1>
            <p className="text-neutral-500 mt-1">Pet Shop — Campo Largo/PR</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-8 shadow-[0_4px_12px_rgba(23,20,16,0.06),0_24px_56px_rgba(16,127,127,0.16)]">
          <LoginForm />
        </div>
        <p className="text-center text-xs text-neutral-400 mt-6">Sistema interno · Mon Petit</p>
      </div>
    </main>
  );
}

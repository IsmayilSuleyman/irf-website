import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyAccess } from "@/lib/access";
import { Logo } from "@/components/Logo";
import { RegisterForm } from "@/components/RegisterForm";

export const dynamic = "force-dynamic";

/**
 * Where a nameless login lands (see lib/auth-guard.ts): a fresh Google
 * sign-in types Ad + Soyad, then waits here until İsmayıl approves the
 * request in the cabinet or links it to an existing profile. Approved
 * logins have no business here and go on to /portal.
 */
export default async function RegisterPage() {
  await requireSignedIn("/register");
  const access = await getMyAccess(await createSupabaseServerClient());
  if (access.status === "approved") {
    redirect("/portal");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="glass p-10">
          <div className="mb-8 flex w-full flex-col items-center">
            <div className="w-full max-w-[250px]">
              <Logo width={250} priority />
            </div>
          </div>
          <RegisterForm
            status={access.status}
            email={access.email}
            firstName={access.firstName ?? ""}
            lastName={access.lastName ?? ""}
          />
        </div>
      </div>
    </main>
  );
}

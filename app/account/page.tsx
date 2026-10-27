import { AuthForm } from "@/components/auth-form";
import { requireSession } from "@/lib/server/auth";
export default async function AccountPage(){const session=await requireSession();return <AuthForm mode="change" csrfToken={session.csrfToken} email={session.email}/>;}

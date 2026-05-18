import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user?.id && session.accessToken) {
    redirect("/dashboard");
  }
  redirect("/login");
}

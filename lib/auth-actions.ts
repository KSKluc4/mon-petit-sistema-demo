"use server";

import { redirect } from "next/navigation";
import { destroySessionCookie } from "./auth";

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/login");
}

"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";

import { paddle } from "@/lib/paddle";
import { absoluteUrl } from "@/lib/utils";

export type responseAction = {
  status: "success" | "error";
  stripeUrl?: string;
};

const billingUrl = absoluteUrl("/dashboard/billing");

export async function openCustomerPortal() {
  redirect("https://my.paddle.com/");
}

// export async function openCustomerPortal(
//   userStripeId: string,
// ): Promise<responseAction> {
//   let redirectUrl: string = "";

//   try {
//     const session = await auth();

//     if (!session?.user || !session?.user.email) {
//       throw new Error("Unauthorized");
//     }

//     if (userStripeId) {
//       const stripeSession = await paddle.billingPortal.sessions.create({
//         customer: userStripeId,
//         return_url: billingUrl,
//       });

//       redirectUrl = stripeSession.url as string;
//     }
//   } catch (error) {
//     throw new Error("Failed to generate user stripe session");
//   }

//   redirect(redirectUrl);
// }

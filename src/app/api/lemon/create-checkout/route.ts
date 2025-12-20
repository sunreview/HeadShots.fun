import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/lemon";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { amount, quantity, description, userId, emailAddress } = await req.json();

    if (!amount || !quantity || !description || !userId || !emailAddress) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const session = await createCheckoutSession(amount, quantity, description, userId, emailAddress);

    if (!session || !session.url) {
      throw new Error("Failed to create checkout session");
    }

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
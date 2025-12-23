// app/api/webhooks/paddle/route.ts
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { handleLemonWebhook } from "@/lib/paddle"
import { env } from "@/env.mjs"

// ✅ 处理 POST 请求 - 真正的 Paddle webhook
export async function POST(req: Request) {
  try {
    const h = headers();
    console.log("🔔 Webhook POST request received")
  // Lemon 发送的是 X-Signature（取的时候用小写也行）
    const signature = h.get("x-signature");
    const eventName = h.get("x-event-name"); // 有些事件会带这个头（可选）
    const rawBody = await req.text();

  // 方便你先观察：到底有哪些头
    console.log("Webhook received", { eventName, hasSig: !!signature });
    
    if (!signature) {
      console.error("❌ Missing paddle-signature header")
      return NextResponse.json(
        { error: "Missing paddle-signature header" },
        { status: 400 }
      )
    }

    // 2. 获取原始请求体
    // const rawBody = await req.text()
    
    console.log("📝 Raw body length:", rawBody.length)
    console.log("🔑 Signature present:", !!signature)
    
    // 3. 验证 webhook secret 是否配置
    const webhookSecret = env.LEMON_WEBHOOK_SECRET
    
    if (!webhookSecret) {
      console.error("❌ PADDLE_WEBHOOK_SECRET not configured")
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      )
    }
    
    console.log("🔑 Webhook secret exists:", !!webhookSecret)
    console.log("🔑 Webhook secret length:", webhookSecret.length)
    
    // 4. 处理 webhook
    console.log("⚙️ Processing webhook...")
    await handleLemonWebhook(rawBody, signature)
    
    console.log("✅ Webhook processed successfully")
    
    return NextResponse.json({ received: true })
    
  } catch (error: any) {
    console.error("❌ Webhook error:", error)
    console.error("❌ Error message:", error.message)
    console.error("❌ Error stack:", error.stack)
    
    return NextResponse.json(
      { 
        error: "Webhook handler failed",
        message: error.message 
      },
      { status: 400 }
    )
  }
}

// ✅ 处理 GET 请求 - 测试端点
export async function GET(req: Request) {
  try {
    console.log("🔍 Webhook GET request received (test)")
    console.debug("req",req.json);
    
    // 检查配置
    const webhookSecret = env.PADDLE_WEBHOOK_SECRET
    const apiKey = env.PADDLE_API_KEY
    
    const status = {
      endpoint: "Paddle Webhook",
      status: "active",
      method: "POST only (GET is for testing)",
      timestamp: new Date().toISOString(),
      config: {
        webhookSecretConfigured: !!webhookSecret,
        webhookSecretLength: webhookSecret?.length || 0,
        apiKeyConfigured: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
      }
    }
    
    console.log("📊 Webhook status:", status)
    
    return NextResponse.json(status)
    
  } catch (error: any) {
    console.error("❌ GET request error:", error)
    
    return NextResponse.json(
      { 
        error: "Failed to get webhook status",
        message: error.message 
      },
      { status: 500 }
    )
  }
}
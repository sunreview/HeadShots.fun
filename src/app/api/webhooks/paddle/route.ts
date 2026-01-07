// app/api/webhooks/paddle/route.ts
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { handleTransactionCompleted } from "@/lib/paddle"
import { env } from "@/env.mjs"
import { handleCallback } from "@/lib/hupi";
import { NextRequest } from "next/server";

// ✅ 处理 POST 请求 - 真正的 Paddle webhook
export async function POST(req: NextRequest) {
  try {


    //     console.log("\n=================================");
    console.log("⏰ Webhook 收到请求");
    console.log("=================================\n");
    
    // 🔑 关键：虎皮椒使用 URL-encoded 格式，不是 JSON
    const formData = await req.formData();
    
    // 将 formData 转换为普通对象
    const body: Record<string, any> = {};
    formData.forEach((value, key) => {
      body[key] = value;
    });
    
    console.log("📦 接收到的数据:", JSON.stringify(body, null, 2));

        // 提取关键字段
    const {
      trade_order_id,    // 虎皮椒订单号
      total_fee,         // 支付金额（元）
      transaction_id,    // 微信/支付宝交易号
      open_order_id,     // 虎皮椒内部订单号
      order_title,       // 订单标题
      status,            // 订单状态：OD=已支付, CD=已退款, RD=退款中, UD=退款失败
      nonce_str,         // 你的系统订单号
      time,              // 时间戳
      appid,             // 应用ID
      hash,              // 签名
    } = body;

    if (status == 'OD') {

        const webhookData = {
    trade_order_id,
    total_fee,
    transaction_id,
    open_order_id,
    order_title,
    status,
    nonce_str,
    time,
    appid,
    hash,
  };

    await handleTransactionCompleted(
        webhookData
        );
    }
    
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
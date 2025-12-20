import { Environment, Paddle } from "@paddle/paddle-node-sdk"
import { env } from "@/env.mjs"
import { prisma } from "@/lib/db"
import crypto from "crypto"

// export const paddle = new Paddle(env.PADDLE_API_KEY)



export const paddle = new Paddle(env.PADDLE_API_KEY, {
  environment: Environment.sandbox,  
})

const FIXED_PRICE_ID = 'pri_01kbw1p0m97m8k8rdz9v0k4jk7'



const PRICE_MAP: Record<number, { variantId: string; credits: number }> = {
  3:   { variantId: env.LEMONSQUEEZY_VARIANT_ID, credits: 3 },   // 你自己改
  10:  { variantId: env.LEMONSQUEEZY_VARIANT_ID, credits: 120 },
  20:  { variantId: env.LEMONSQUEEZY_VARIANT_ID, credits: 260 },
  50:  { variantId: env.LEMONSQUEEZY_VARIANT_ID, credits: 700 },
  100: { variantId: env.LEMONSQUEEZY_VARIANT_ID, credits: 1600 },
}


// 创建 Paddle Checkout Session
export async function createCheckoutSession(
  amount: number,
  quantity: number,
  description: string,
  userId: string,
  emailAddress: string
) {

    const apiKey = env.LEMONSQUEEZY_API_KEY
    const storeId = env.LEMONSQUEEZY_STORE_ID
    const appUrl = env.APP_URL
    const nextUrl = env.NEXT_PUBLIC_APP_URL


    console.log("LEMON KEY exists:", !!apiKey);
    console.log("LEMON KEY prefix:", apiKey?.slice(0, 10));
    console.log("STORE_ID:", storeId);

    const picked = PRICE_MAP[amount]
    if (!picked) throw new Error(`Unsupported amount: ${amount}`)

    const localTxnId = crypto.randomUUID()

    await prisma.lemonTransaction.create({
    data: {
      // 你 Prisma 里自己设计：建议加 localTxnId 字段（unique）
      localTxnId,
      userId,
      amount,
      credits: quantity,
      status: "pending",
      currency: "USD",
      // lemonOrderId: null (成交后 webhook 回来再补)
    },
    })

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: emailAddress, // 可选：预填邮箱
          custom: {
            localTxnId,
            userId,
            credits: String(quantity),
            amount: String(amount),
          },
        },
        product_options: {
          // 购买后跳转
          redirect_url: `${nextUrl}/payment-status?session_id=${localTxnId}`,
        },
      },
      relationships: {
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: '1155352' } },
      },
    },
  }

  const r = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  })

  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Create checkout failed: ${text}`)
  }

  const json = await r.json()

  // checkout url 一般在返回的 attributes 里（不同字段名你以实际返回为准）
  const checkoutUrl =
    json?.data?.attributes?.url ||
    json?.data?.attributes?.checkout_url ||
    json?.data?.attributes?.checkoutUrl

  return {
    localTxnId,
    url: checkoutUrl,
    raw: json,
  }
}


    // let priceId;

    // let customer;

  //   const customersCollection = await paddle.customers.list({
  //       email: [emailAddress],
  //   })
    
  //   // 获取第一页结果
  //   const customersPage = await customersCollection.next()
      
  //   if (customersPage  && customersPage.length > 0) {
  //       customer = customersPage[0]
  //       console.log('✅ Found existing customer:', customer.id)
  //   } else {
    
  //   customer = await paddle.customers.create({
  //     email: emailAddress,
  //     // name: "可选的客户名字",
  //   })  
  // }

  //   console.log('env.PADDLE_API_KEY', env.PADDLE_API_KEY)
  //   const price = await paddle.prices.get(FIXED_PRICE_ID)
  //   console.log('✅ Price read successful:', price.id)

  //   if (amount == 3) {
  //     priceId = 'pri_01kbw1p0m97m8k8rdz9v0k4jk7'
  //   } else if (amount == 10) {
  //     priceId = 'pri_01kbw1bhxxyrmt0qar0p51vy65'
  //   } else if (amount == 20) {
  //     priceId = 'pri_01kbw13v27jv90rj5car0qy0dg'
  //   } else if (amount == 50) {
  //     priceId = 'pri_01kc3ka88327zy5prprjm630a7'
  //   } else if (amount == 100) {
  //     priceId = 'pri_01kc3kavpkfedy3mt0391xvvcj'
  //   }
    
  //   // 直接创建 Transaction，使用固定价格 ID
  //   const transaction = await paddle.transactions.create({
  //     items: [
  //       {
  //         priceId: priceId,
  //         quantity: 1,
  //       },
  //     ],
  //     customData: {
  //       userId,
  //       credits: quantity.toString(),
  //     },
  //     // customerId: customer.id, 
  //   })

  //   // 保存订单记录到数据库
  //   await prisma.paddleTransaction.create({
  //     data: {
  //       paddleTransactionId: transaction.id,
  //       userId,
  //       amount: amount,
  //       credits: quantity,
  //       status: "pending",
  //     },
  //   })


  //   console.debug("transactionId",transaction.id);

  //   return {
  //     transactionId: transaction.id,
  //     url: transaction.checkout?.url, // 返回支付页面 URL
  //   }
  // } catch (error) {
  //   console.error("Error creating Paddle checkout:", error)
  //   throw error
  // }


// 处理 Paddle Webhook
export async function handleLemonWebhook(
  rawBody: string,
  signature: string
) {
  try {
    // 验证 webhook 签名
    const secret = env.LEMON_WEBHOOK_SECRET;
    if (!secret) throw new Error("LEMON_WEBHOOK_SECRET not configured");

    const digestHex = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");
    
    const a = Buffer.from(digestHex, "utf8");
    const b = Buffer.from(signature, "utf8");
    
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) {
      console.log("Signature mismatch", { digestHex, signature });
      throw new Error("[Lemon] Invalid webhook signature");
    }
  
  console.debug("rawBody",rawBody);
  // 通过验签后再 parse JSON
  const payload = JSON.parse(rawBody);
  console.log("payload", payload);



    // 根据事件类型处理
    switch (payload.meta.event_name) {
      case "order_created":
        await handleOrderPaid(payload)
        break
      // 等待完成
      case "order_refunded":
        await handleTransactionFailed(payload.data)
        break
      // 可以添加其他事件类型
      default:
        console.log(`Unhandled event type: ${payload.eventType}`)
    }

    return { received: true }
  } catch (error) {
    console.error("Webhook error:", error)
    throw error
  }
}

// 处理交易完成
async function handleOrderPaid(payload: any) {

  // 自己补充的逻辑

    // const localTxnId = crypto.randomUUID()

    // await prisma.lemonTransaction.create({
    // data: {
    //   // 你 Prisma 里自己设计：建议加 localTxnId 字段（unique）
    //   localTxnId,
    //   userId:payload.meta.custom_data.userId,
    //   amount:payload.meta.custom_data.amount,
    //   credits: payload.meta.custom_data.credits,
    //   status: "completed",
    //   currency: "USD",
    //   lemonOrderId: payload.data.id
    // },
    // })
  const updatedTxn = await prisma.lemonTransaction.update({
    where: { localTxnId: payload.meta.custom_data.localTxnId },
    data: {
      status: "completed",
      lemonOrderId: payload.data.id || null,
    },
  }) 

  console.log("✅ updatedTxn", updatedTxn);

  const userId = payload.meta.custom_data.userId
  const credits = Number(payload.meta.custom_data.credits)

  if (!userId || !credits) {
    throw new Error("Invalid custom data in transaction")
  }


  // 增加用户积分
  await prisma.user.update({
    where: { id: userId },
    data: {
      credits: { increment: credits },
    },
  })

  // 记录积分交易
  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: credits,
      type: "PURCHASE",
    },
  })
}

// 处理交易失败
async function handleTransactionFailed(transactionData: any) {
  const transactionId = transactionData.id

  await prisma.lemonTransaction.update({
    where: { lemonOrderId: transactionId },
    data: { status: "failed" },
  })
}

// 查询支付状态
export async function handleSuccessfulPayment(transactionId: string) {
  // 先检查数据库
  const transaction = await prisma.lemonTransaction.findUnique({
    where: { localTxnId: transactionId },
  })

  if (transaction?.status === "completed") {
    return transaction // 已经处理过
  }

  // 从 Paddle 获取最新状态
  try {
    const paddleTransaction = await paddle.transactions.get(transactionId)

    if (paddleTransaction.status !== "completed") {
      return null // 支付未完成
    }

    const customData = paddleTransaction.customData as any
    const userId = customData?.userId
    const credits = parseInt(customData?.credits || "0", 10)

    if (!userId || !credits) {
      throw new Error("Invalid custom data in transaction")
    }

    // 更新交易状态
    const updatedTransaction = await prisma.lemonTransaction.update({
      where: { lemonOrderId: transactionId },
      data: {
        status: "completed",
        lemonOrderId: paddleTransaction.id,
      },
    })

    // 增加用户积分
    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: { increment: credits },
      },
    })

    // 记录积分交易
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: credits,
        type: "PURCHASE",
      },
    })

    return updatedTransaction
  } catch (error) {
    console.error("Error fetching transaction:", error)
    throw error
  }
}
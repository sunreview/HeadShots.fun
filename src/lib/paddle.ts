import { Environment, Paddle } from "@paddle/paddle-node-sdk"
import { env } from "@/env.mjs"
import { prisma } from "@/lib/db"

// export const paddle = new Paddle(env.PADDLE_API_KEY)

export const paddle = new Paddle(env.PADDLE_API_KEY, {
  environment: Environment.sandbox,  // 这个很重要！
})

const FIXED_PRICE_ID = 'pri_01kbw1p0m97m8k8rdz9v0k4jk7'

// 创建 Paddle Checkout Session
export async function createCheckoutSession(
  amount: number,
  quantity: number,
  description: string,
  userId: string,
  emailAddress: string
) {
    try {

    let priceId;

    let customer;

    const customersCollection = await paddle.customers.list({
        email: [emailAddress],
    })
    
    // 获取第一页结果
    const customersPage = await customersCollection.next()
      
    if (customersPage  && customersPage.length > 0) {
        customer = customersPage[0]
        console.log('✅ Found existing customer:', customer.id)
    } else {
    
    customer = await paddle.customers.create({
      email: emailAddress,
      // name: "可选的客户名字",
    })  
  }

    console.log('env.PADDLE_API_KEY', env.PADDLE_API_KEY)
    const price = await paddle.prices.get(FIXED_PRICE_ID)
    console.log('✅ Price read successful:', price.id)

    if (amount == 3) {
      priceId = 'pri_01kbw1p0m97m8k8rdz9v0k4jk7'
    } else if (amount == 10) {
      priceId = 'pri_01kbw1bhxxyrmt0qar0p51vy65'
    } else if (amount == 20) {
      priceId = 'pri_01kbw13v27jv90rj5car0qy0dg'
    } else if (amount == 50) {
      priceId = 'pri_01kc3ka88327zy5prprjm630a7'
    } else if (amount == 100) {
      priceId = 'pri_01kc3kavpkfedy3mt0391xvvcj'
    }
    
    // 直接创建 Transaction，使用固定价格 ID
    const transaction = await paddle.transactions.create({
      items: [
        {
          priceId: priceId,
          quantity: 1,
        },
      ],
      customData: {
        userId,
        credits: quantity.toString(),
      },
      // customerId: customer.id, 
    })

    // 保存订单记录到数据库
    await prisma.paddleTransaction.create({
      data: {
        paddleTransactionId: transaction.id,
        userId,
        amount: amount,
        credits: quantity,
        status: "pending",
      },
    })


    console.debug("transactionId",transaction.id);

    return {
      transactionId: transaction.id,
      url: transaction.checkout?.url, // 返回支付页面 URL
    }
  } catch (error) {
    console.error("Error creating Paddle checkout:", error)
    throw error
  }
}

// 处理 Paddle Webhook
export async function handlePaddleWebhook(
  rawBody: string,
  signature: string
) {
  try {
    // 验证 webhook 签名
    const secretKey = env.PADDLE_WEBHOOK_SECRET
    
    // Paddle 的签名验证
    const eventData = await paddle.webhooks.unmarshal(rawBody, secretKey, signature) as any

    console.log(`Received Paddle webhook: ${eventData.json}`)

    // console.log(`Received Paddle webhook: ${eventData.json}`)

    // 根据事件类型处理
    switch (eventData.eventType) {
      case "transaction.completed":
        await handleTransactionCompleted(eventData.data)
        break
      case "transaction.payment_failed":
        await handleTransactionFailed(eventData.data)
        break
      // 可以添加其他事件类型
      default:
        console.log(`Unhandled event type: ${eventData.eventType}`)
    }

    return { received: true }
  } catch (error) {
    console.error("Webhook error:", error)
    throw error
  }
}

// 处理交易完成
async function handleTransactionCompleted(transactionData: any) {
  const transactionId = transactionData.id
  const customData = transactionData.customData
  const userId = customData?.userId
  const credits = parseInt(customData?.credits || "0", 10)

  if (!userId || !credits) {
    throw new Error("Invalid custom data in transaction")
  }

  // 检查是否已处理
  const existing = await prisma.paddleTransaction.findUnique({
    where: { paddleTransactionId: transactionId },
  })

  if (existing?.status === "completed") {
    return // 已经处理过
  }

  // 更新交易状态
  await prisma.paddleTransaction.update({
    where: { paddleTransactionId: transactionId },
    data: {
      status: "completed",
      paddlePaymentId: transactionData.payments?.[0]?.id || null,
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
}

// 处理交易失败
async function handleTransactionFailed(transactionData: any) {
  const transactionId = transactionData.id

  await prisma.paddleTransaction.update({
    where: { paddleTransactionId: transactionId },
    data: { status: "failed" },
  })
}

// 查询支付状态
export async function handleSuccessfulPayment(transactionId: string) {
  // 先检查数据库
  const transaction = await prisma.paddleTransaction.findUnique({
    where: { paddleTransactionId: transactionId },
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
    const updatedTransaction = await prisma.paddleTransaction.update({
      where: { paddleTransactionId: transactionId },
      data: {
        status: "completed",
        paddlePaymentId: paddleTransaction.id,
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
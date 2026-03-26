import { Environment, Paddle } from "@paddle/paddle-node-sdk"
import { env } from "@/env.mjs"
import { prisma } from "@/lib/db"

// export const paddle = new Paddle(env.PADDLE_API_KEY)

export const paddle = new Paddle(env.PADDLE_API_KEY, {
  environment: Environment.sandbox,  // 这个很重要！
})

const FIXED_PRICE_ID = 'pri_01kd2cqca4v1r97z71wrpdpqfe'

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
      priceId = 'pri_01kd2cqca4v1r97z71wrpdpqfe'
    } else if (amount == 10) {
      priceId = 'pri_01kd2csakh7ax9mnhspf5qz32e'
    } else if (amount == 20) {
      priceId = 'pri_01kd2ctf1b151p39jntq6f0g2j'
    } else if (amount == 50) {
      priceId = 'pri_01kd2cvrsdet15engy9xzmj4j0'
    } else if (amount == 100) {
      priceId = 'pri_01kd2cwp4yt2k8yj7pr0r9tcse'
    }

    console.log("[PADDLE] key prefix:", env.PADDLE_API_KEY.slice(0, 24))
console.log("[PADDLE] amount:", amount, "quantity:", quantity, "priceId:", priceId)

if (!priceId) {
  throw new Error(`[PADDLE] priceId is empty. amount=${amount}`)
}

const chosen = await paddle.prices.get(priceId)
console.log("[PADDLE] chosen price:", chosen.id, "raw:", JSON.stringify(chosen, null, 2))

// 1. 先验证 userId 是否存在
const user = await prisma.user.findUnique({
  where: { id: userId }
});

if (!user) {
  throw new Error(`User with id ${userId} not found`);
}

console.debug("userId",userId);
    
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

    // 1. 先打印 transaction 的完整信息
console.log('Paddle transaction:', JSON.stringify(transaction, null, 2));
console.log('Transaction ID:', transaction.id);
console.log('Transaction ID length:', transaction.id?.length);

// 2. 尝试先查询用户确认存在
const userExists = await prisma.user.findUnique({
  where: { id: userId }
});
console.log('User exists:', !!userExists);


    // 保存订单记录到数据库
    // await prisma.paddleTransaction.create({
    //   data: {
    //     paddleTransactionId: transaction.id,
    //     userId,
    //     amount: amount,
    //     credits: quantity,
    //     status: "pending",
    //   },
    // })


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

    console.log("Received Paddle webhook eventType:", eventData.eventType)
    console.log("Received Paddle webhook data:", JSON.stringify(eventData.data, null, 2))

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
export async function handleTransactionCompleted(hupiCallbackData: any) {
  console.debug("hupiCallbackData",hupiCallbackData.json)
  const transactionId = hupiCallbackData.transaction_id
  const order_id = hupiCallbackData.trade_order_id
  console.debug("order_id",order_id)

  const hupiTransaction = await prisma.hupiTransaction.findUnique({
    where: { hupiOrderId: order_id },
    include: { user: true } // 可选：如果需要用户的完整信息
  })
  
  if (!hupiTransaction) {
    console.error("❌ 订单不存在:", order_id);
    throw new Error(`Transaction not found: ${order_id}`)
  }

  console.log("✅ 找到订单:", {
    orderId: order_id,
    userId: hupiTransaction.userId,
    credits: hupiTransaction.credits,
    currentStatus: hupiTransaction.status
  });
  
  // 从订单中获取 userId 和 credits
  const userId = hupiTransaction.userId
  const credits = hupiTransaction.credits

  if (!userId || !credits) {
    throw new Error("Invalid custom data in transaction")
  }

  // 检查是否已处理
  const existing = await prisma.hupiTransaction.findUnique({
    where: { hupiOrderId: order_id },
  })

  if (existing?.status === "completed") {
    return // 已经处理过
  }

    // 更新 HupiTransaction，插入 transaction_id
await prisma.hupiTransaction.update({
  where: { hupiOrderId: order_id },
  data: {
    status: "completed",
    hupiTransactionId: transactionId, // 插入交易ID
    updatedAt: new Date()
  }
})

 console.log("✅ transaction_id 已插入到数据库");


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

  await prisma.hupiTransaction.update({
    where: { hupiOrderId: transactionId },
    data: { status: "failed" },
  })
}

// 查询支付状态
export async function handleSuccessfulPayment(transactionId: string) {
  // 先检查数据库
  const transaction = await prisma.hupiTransaction.findUnique({
    where: { hupiOrderId: transactionId },
  })

  if (transaction?.status === "completed") {
    return transaction // 已经处理过
  }

  // 从 Paddle 获取最新状态
  try {
    // 更新交易状态
    const updatedTransaction = await prisma.hupiTransaction.update({
      where: { hupiOrderId: transactionId },
      data: {
        status: "completed",
      },
    })

    return updatedTransaction
  } catch (error) {
    console.error("Error fetching transaction:", error)
    throw error
  }
}
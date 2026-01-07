import md5 from "spark-md5";
import { prisma } from "./db";
import crypto from 'crypto';
import { env } from "@/env.mjs"
import { NextRequest, NextResponse } from "next/server";

const appId = process.env.XUNHU_PAY_APPID??'201906156736';
const appSecret = process.env.XUNHU_PAY_APPSECRET??'5707ba7ebda873b8d68c1af010bf3c11';
const wapName = process.env.PAY_WAPNAME ?? "店铺名称";

const domain = process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3000";
const callbackDomain = process.env.NEXT_PUBLIC_APP_URL??'http://localhost:3000';

interface PaymentArgs {
  version: string;
  appid: string;
  trade_order_id: string;
  total_fee: number;
  title: string;
  time: number;
  notify_url: string;
  return_url?: string;
  callback_url?: string;
  plugins?: string;
  attach?: string;
  nonce_str: string;
  type: string;
  wap_url: string;
  wap_name: string;
}

interface PaymentResponse {
  openid: number; // 来自文档：订单id(此处有个历史遗留错误，返回名称是openid，值是orderid，一般对接不需要这个参数)
  url_qrcode: string;
  url: string;
  errcode: number;
  errmsg: string;
  hash?: string;
}

export interface CallbackBody {
  trade_order_id: string;
  trade_fee: number;
  transaction_id: number;
  open_order_id: string;
  order_title: string;
  status: string;
  plugins?: string;
  appid: string;
  time: string;
  nonce_str: string;
  hash?: string;
}

export async function createCheckoutSession(
  amount: number,
  quantity: number,
  description: string,
  userId: string,
  emailAddress: string
) {
    try {

    let priceId;

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

// 自己的逻辑
const user = await prisma.user.findUnique({
  where: { id: userId }
});

if (!user) {
  throw new Error(`User with id ${userId} not found`);
}

console.debug("userId",userId);

const orderId = generateOrderId(userId,priceId, quantity.toString())

console.debug("orderId",userId);

const data = {
  hupiOrderId: orderId,
  userId,
  amount,
  credits: quantity,
  status: "pending",
};


    // 保存订单记录到数据库
    await prisma.hupiTransaction.create({
      data
    })

    const paymentResponse = await startPay({
  orderId: orderId,
  price: amount,
  title: description,
  attach: "",
});

console.log("完整支付响应:", JSON.stringify(paymentResponse, null, 2));

return paymentResponse;





    // return {
    //   transactionId: orderId,
    // }
  } catch (error) {
    console.error("Error creating Paddle checkout:", error)
    throw error
  }
}


function generateOrderId(userId, priceId, credits) {
  // 1. 时间戳部分 (毫秒级,确保时序性)
  const timestamp = Date.now();
  
  // 2. 创建唯一标识组合
  const uniqueString = `${timestamp}-${userId}-${priceId}-${credits}`;
  
  // 3. 生成8位短hash (避免ID过长)
  const hash = crypto
    .createHash('sha256')
    .update(uniqueString)
    .digest('hex')
    .substring(0, 8);
  
  // 4. 组合最终订单ID
  // 格式: ORD-1703686800000-a1b2c3d4
  return `ORD-${timestamp}-${hash}`;
}

/**
 * Sort the key names and link together
 * @param parameters
 * @return linked sting
 */
function sortAndSignParameters(parameters: PaymentArgs | CallbackBody): string {
  // 过滤空值参数
  const filteredParameters = Object.entries(parameters).filter(
    ([, value]) => value !== null
  );

  // 按照参数名的ASCII码从小到大排序（字典序）
  const sortedParameters = filteredParameters.sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB)
  );

  // 使用URL键值对的格式拼接成字符串
  const stringA = sortedParameters
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return stringA;
}

/**
 * Request a order
 * @param orderId internal order id
 * @param price the price need to be paid
 * @param attach encrypted field being transmitted.
 * @param title payment title
 */
export async function startPay({
  orderId,
  price,
  attach,
  title,
}: {
  orderId: string;
  price: number;
  attach: string;
  title?: string;
}) {
  const fetchBody: PaymentArgs = {
    version: "1.1",
    appid: appId,
    trade_order_id: orderId,
    total_fee: price,
    title: title ?? "Admin-Web",
    time: Math.floor(Date.now() / 1000),
    notify_url: `https://censerless-easton-gamily.ngrok-free.dev/api/webhooks/paddle`,
    return_url: `${domain}/payment-status?session_id=${orderId}`, // After the user has successfully made the payment, we will automatically redirect the user's browser to this URL.
    callback_url: `${domain}`, // After the user cancels the payment, we may guide the user to redirect to this URL to make the payment again.
    // plugins: string;
    attach, // Return as is during callback. 📢We use it to confirm that the order has not been tampered with.
    nonce_str: orderId, // 1. Avoid server page caching 2. Prevent security keys from being guessed
    type: "WAP",
    wap_url: `${domain}`,
    wap_name: wapName,
  };
  const stringA = sortAndSignParameters(fetchBody);
  const hash = md5.hash(stringA + appSecret);
  // console.debug("startplay");

  const resp = await fetch("https://api.xunhupay.com/payment/do.html", {
    cache: "no-store",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...fetchBody,
      hash,
    }),
  });
  try {
    return (await resp.json()) as PaymentResponse;
  } catch (e) {
    return null;
  }
}

function urlEncodedStringToJson(encodedString: string): Record<string, string> {
  const urlParams = new URLSearchParams(encodedString);
  return Object.fromEntries(urlParams.entries());
}

/**
 * Verification callback data
 * @param req
 * @return return order id in system
 */
export async function handleCallback(req: NextRequest) {
  const body = urlEncodedStringToJson(
    await req.text()
  ) as unknown as CallbackBody;
  /* == Verify Security field == */
  /*
   Currently only the appId is being validated.
   In the future, attach will also need to be validated to improve security.
   */
  if (body.appid !== appId) return null;

  /* == Verify Signature == */
  // const trueHash = body.hash!
  // delete body.hash /* remove hash before sign */
  //
  // const stringA = sortAndSignParameters(body);
  // const hash = md5.hash(stringA + appSecret);
  //
  // if (hash !== trueHash)
  //   return null
  /* ====================== */

  return body.trade_order_id;
}

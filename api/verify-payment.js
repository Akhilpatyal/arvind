const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

function verifySignature({ orderId, paymentId, signature }) {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);

  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function formatAmount(amountInPaise, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency
  }).format(amountInPaise / 100);
}

async function sendPurchaseEmail({ customer, order }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not configured. Skipping email delivery.");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const downloadUrl = process.env.EBOOK_DOWNLOAD_URL || "https://example.com/downloads/master-social-confidence.pdf";
  const from = process.env.EMAIL_FROM || "Master Social Confidence <onboarding@resend.dev>";
  const amount = formatAmount(order.amount, order.currency);

  await resend.emails.send({
    from,
    to: customer.email,
    subject: "Your Master Social Confidence eBook is ready",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#101828">
        <h1>Thank you for your purchase, ${customer.full_name}.</h1>
        <p>Your eBook has been sent to your email. You can download it here:</p>
        <p><a href="${downloadUrl}" style="display:inline-block;padding:12px 18px;background:#101828;color:#ffffff;text-decoration:none;border-radius:8px">Download eBook</a></p>
        <h2>Payment Receipt</h2>
        <p><strong>Product:</strong> ${order.product_name}</p>
        <p><strong>Amount:</strong> ${amount}</p>
        <p><strong>Order ID:</strong> ${order.razorpay_order_id}</p>
        <p><strong>Payment ID:</strong> ${order.razorpay_payment_id}</p>
      </div>
    `
  });
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  try {
    const missingEnv = ["RAZORPAY_KEY_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
      (key) => !process.env[key]
    );

    if (missingEnv.length) {
      return sendJson(response, 500, { error: `Missing environment variables: ${missingEnv.join(", ")}` });
    }

    const razorpayOrderId = String(request.body?.razorpay_order_id || "");
    const razorpayPaymentId = String(request.body?.razorpay_payment_id || "");
    const razorpaySignature = String(request.body?.razorpay_signature || "");

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return sendJson(response, 400, { error: "Missing Razorpay payment verification fields." });
    }

    const isAuthentic = verifySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    });

    if (!isAuthentic) {
      return sendJson(response, 400, { error: "Payment verification failed." });
    }

    const supabase = getSupabase();
    const paidAt = new Date().toISOString();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .update({
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        payment_status: "paid",
        paid_at: paidAt
      })
      .eq("razorpay_order_id", razorpayOrderId)
      .select(
        "id, customer_id, razorpay_order_id, razorpay_payment_id, amount, currency, product_name, payment_status, paid_at"
      )
      .single();

    if (orderError || !order) {
      return sendJson(response, 404, { error: "Order not found." });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, full_name, email, phone")
      .eq("id", order.customer_id)
      .single();

    if (customerError || !customer) {
      return sendJson(response, 404, { error: "Customer not found." });
    }

    try {
      await sendPurchaseEmail({ customer, order });
      await supabase
        .from("orders")
        .update({
          email_status: "sent",
          email_sent_at: new Date().toISOString()
        })
        .eq("id", order.id);
    } catch (emailError) {
      console.error("purchase email error", emailError);
      await supabase
        .from("orders")
        .update({
          email_status: "failed"
        })
        .eq("id", order.id);
    }

    return sendJson(response, 200, {
      purchase: {
        status: order.payment_status,
        name: customer.full_name,
        email: customer.email,
        phone: customer.phone,
        orderId: order.razorpay_order_id,
        paymentId: order.razorpay_payment_id,
        amount: order.amount,
        currency: order.currency,
        paidAt: order.paid_at
      }
    });
  } catch (error) {
    console.error("verify-payment error", error);
    return sendJson(response, 500, { error: "Unable to verify payment. Please contact support." });
  }
};

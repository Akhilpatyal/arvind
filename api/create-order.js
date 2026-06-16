const Razorpay = require("razorpay");
const { createClient } = require("@supabase/supabase-js");

const AMOUNT_IN_PAISE = 49900;
const CURRENCY = "INR";
const PRODUCT_NAME = "Master Social Confidence eBook";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

function validateCustomer(customer = {}) {
  const fullName = String(customer.fullName || "").trim();
  const email = String(customer.email || "").trim().toLowerCase();
  const phone = String(customer.phone || "").replace(/\s+/g, "");

  if (fullName.length < 2) return { error: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!/^[6-9]\d{9}$/.test(phone)) return { error: "Enter a valid 10-digit Indian phone number." };

  return { customer: { fullName, email, phone } };
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  try {
    const { customer: validCustomer, error } = validateCustomer(request.body?.customer);
    if (error) return sendJson(response, 400, { error });

    const missingEnv = [
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY"
    ].filter((key) => !process.env[key]);

    if (missingEnv.length) {
      return sendJson(response, 500, { error: `Missing environment variables: ${missingEnv.join(", ")}` });
    }

    const supabase = getSupabase();
    const razorpay = getRazorpay();

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(
        {
          full_name: validCustomer.fullName,
          email: validCustomer.email,
          phone: validCustomer.phone
        },
        { onConflict: "email" }
      )
      .select("id, full_name, email, phone")
      .single();

    if (customerError) throw customerError;

    const receipt = `ebook_${Date.now()}`;
    const razorpayOrder = await razorpay.orders.create({
      amount: AMOUNT_IN_PAISE,
      currency: CURRENCY,
      receipt,
      notes: {
        product: PRODUCT_NAME,
        customer_id: customer.id,
        email: customer.email
      }
    });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: customer.id,
        razorpay_order_id: razorpayOrder.id,
        amount: AMOUNT_IN_PAISE,
        currency: CURRENCY,
        product_name: PRODUCT_NAME,
        payment_status: "created"
      })
      .select("id")
      .single();

    if (orderError) throw orderError;

    return sendJson(response, 200, {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: razorpayOrder.id,
      localOrderId: order.id,
      customerId: customer.id,
      amount: AMOUNT_IN_PAISE,
      currency: CURRENCY
    });
  } catch (error) {
    console.error("create-order error", error);
    return sendJson(response, 500, { error: "Unable to create payment order. Please try again." });
  }
};

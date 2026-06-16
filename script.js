const PRODUCT = {
  name: "Master Social Confidence eBook",
  currency: "INR"
};

const form = document.querySelector("#purchaseForm");
const fields = {
  fullName: document.querySelector("#fullName"),
  email: document.querySelector("#email"),
  phone: document.querySelector("#phone")
};

function setError(fieldName, message) {
  const field = fields[fieldName];
  const error = document.querySelector(`[data-error-for="${fieldName}"]`);

  field.setAttribute("aria-invalid", message ? "true" : "false");
  error.textContent = message;
}

function setCheckoutState(isLoading) {
  const button = form?.querySelector(".checkout-button");
  if (!button) return;

  button.disabled = isLoading;
  button.textContent = isLoading ? "Preparing secure checkout..." : "Pay securely with Razorpay";
}

function getCustomer() {
  return {
    fullName: fields.fullName.value.trim(),
    email: fields.email.value.trim(),
    phone: fields.phone.value.trim().replace(/\s+/g, "")
  };
}

function validateForm() {
  const customer = getCustomer();
  let isValid = true;

  if (customer.fullName.length < 2) {
    setError("fullName", "Enter your full name.");
    isValid = false;
  } else {
    setError("fullName", "");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    setError("email", "Enter a valid email address.");
    isValid = false;
  } else {
    setError("email", "");
  }

  if (!/^[6-9]\d{9}$/.test(customer.phone)) {
    setError("phone", "Enter a valid 10-digit Indian phone number.");
    isValid = false;
  } else {
    setError("phone", "");
  }

  return { isValid, customer };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }

  return data;
}

function saveVerifiedPurchase(purchase) {
  localStorage.setItem("ebookPurchase", JSON.stringify(purchase));
}

async function createOrder(customer) {
  return postJson("/api/create-order", {
    customer,
    product: PRODUCT.name
  });
}

async function verifyPayment(payload) {
  return postJson("/api/verify-payment", payload);
}

function openRazorpay({ customer, order }) {
  if (!window.Razorpay) {
    throw new Error("Razorpay Checkout could not load. Check your internet connection and try again.");
  }

  const checkout = new window.Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    name: "Master Social Confidence",
    description: PRODUCT.name,
    order_id: order.orderId,
    prefill: {
      name: customer.fullName,
      email: customer.email,
      contact: customer.phone
    },
    notes: {
      product: PRODUCT.name,
      customer_id: order.customerId,
      local_order_id: order.localOrderId
    },
    theme: {
      color: "#101828"
    },
    async handler(response) {
      try {
        setCheckoutState(true);
        const verified = await verifyPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        });

        saveVerifiedPurchase(verified.purchase);
        window.location.href = "thank-you.html";
      } catch (error) {
        alert(error.message);
        setCheckoutState(false);
      }
    },
    modal: {
      ondismiss() {
        setCheckoutState(false);
      }
    }
  });

  checkout.open();
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const { isValid, customer } = validateForm();
    if (!isValid) return;

    try {
      setCheckoutState(true);
      const order = await createOrder(customer);
      localStorage.setItem("ebookLead", JSON.stringify({ customer, orderId: order.orderId }));
      openRazorpay({ customer, order });
    } catch (error) {
      alert(error.message);
      setCheckoutState(false);
    }
  });
}

document.querySelectorAll(".faq-question").forEach((button) => {
  button.addEventListener("click", () => {
    const item = button.closest(".faq-item");
    const answer = item.querySelector(".faq-answer");
    const isOpen = item.classList.toggle("is-open");

    button.setAttribute("aria-expanded", String(isOpen));
    answer.style.maxHeight = isOpen ? `${answer.scrollHeight}px` : "0";
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

document.querySelectorAll(".reveal").forEach((element) => {
  revealObserver.observe(element);
});

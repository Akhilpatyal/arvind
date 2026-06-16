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
  button.textContent = isLoading ? "Preparing secure checkout..." : "Download Now";
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
      color: "#ff6b00"
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

/* ---------------------------------------------------------
   UI enhancements (loader, mobile bar, carousel, counters,
   coupon, footer year). These are presentation-only and do
   not touch the payment flow above.
--------------------------------------------------------- */

// Page loader — hide once everything is ready.
window.addEventListener("load", () => {
  const loader = document.getElementById("pageLoader");
  if (loader) {
    loader.classList.add("is-hidden");
    window.setTimeout(() => loader.remove(), 600);
  }
});

// Footer year.
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// Sticky mobile CTA — show after the hero/checkout scrolls out of view.
const mobileBar = document.getElementById("mobileBar");
const checkoutCard = document.getElementById("checkout");
if (mobileBar && checkoutCard && "IntersectionObserver" in window) {
  const barObserver = new IntersectionObserver(
    ([entry]) => {
      mobileBar.classList.toggle("is-visible", !entry.isIntersecting);
    },
    { rootMargin: "-40px 0px 0px 0px", threshold: 0 }
  );
  barObserver.observe(checkoutCard);
}

// Animated stat counters.
function animateCount(el) {
  const target = Number(el.dataset.count || "0");
  const suffix = el.dataset.suffix || "";
  const duration = 1400;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);
    el.textContent = value.toLocaleString("en-IN") + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const countObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.6 }
);
document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

// Testimonial carousel.
(function initCarousel() {
  const root = document.querySelector("[data-carousel]");
  if (!root) return;

  const track = root.querySelector("[data-carousel-track]");
  const slides = Array.from(root.querySelectorAll("[data-slide]"));
  const dotsWrap = root.querySelector("[data-carousel-dots]");
  const prevBtn = root.querySelector("[data-carousel-prev]");
  const nextBtn = root.querySelector("[data-carousel-next]");
  if (!track || slides.length === 0) return;

  let index = 0;

  const dots = slides.map((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Go to testimonial ${i + 1}`);
    dot.addEventListener("click", () => goTo(i));
    dotsWrap?.appendChild(dot);
    return dot;
  });

  function goTo(next) {
    index = (next + slides.length) % slides.length;
    track.scrollTo({ left: slides[index].offsetLeft - track.offsetLeft, behavior: "smooth" });
    dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
  }

  prevBtn?.addEventListener("click", () => goTo(index - 1));
  nextBtn?.addEventListener("click", () => goTo(index + 1));

  // Keep dots in sync when the user swipes the track directly.
  let scrollTimer;
  track.addEventListener("scroll", () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      const nearest = slides.reduce(
        (best, slide, i) => {
          const dist = Math.abs(slide.offsetLeft - track.offsetLeft - track.scrollLeft);
          return dist < best.dist ? { dist, i } : best;
        },
        { dist: Infinity, i: 0 }
      ).i;
      index = nearest;
      dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
    }, 90);
  });

  goTo(0);

  // Gentle auto-advance; pauses on hover.
  let timer = window.setInterval(() => goTo(index + 1), 6000);
  root.addEventListener("mouseenter", () => window.clearInterval(timer));
  root.addEventListener("mouseleave", () => {
    timer = window.setInterval(() => goTo(index + 1), 6000);
  });
})();

// Coupon field (display/UX only — the charged amount stays server-controlled
// in /api/create-order.js). Validates a sample code and gives feedback.
(function initCoupon() {
  const input = document.getElementById("coupon");
  const applyBtn = document.getElementById("applyCoupon");
  const msg = document.getElementById("couponMsg");
  if (!input || !applyBtn || !msg) return;

  const VALID_CODES = ["WELCOME10", "SAVE10"];

  function setMsg(text, state) {
    msg.textContent = text;
    msg.classList.toggle("is-ok", state === "ok");
    msg.classList.toggle("is-bad", state === "bad");
  }

  function apply() {
    const code = input.value.trim().toUpperCase();
    if (!code) {
      setMsg("Enter a coupon code to apply.", "bad");
      return;
    }
    if (VALID_CODES.includes(code)) {
      setMsg(`Code "${code}" applied — discount confirmed at checkout. 🎉`, "ok");
    } else {
      setMsg("This code isn't valid. The launch price is already 90% off.", "bad");
    }
  }

  applyBtn.addEventListener("click", apply);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
    }
  });
})();

// Restrict phone input to digits for a smoother mobile experience.
const phoneInput = document.getElementById("phone");
if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 10);
  });
}

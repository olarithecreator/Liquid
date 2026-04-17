import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './legalScreen.css'

type TabId = 'terms' | 'privacy'

function normalizeTab(value: string | null): TabId {
  return value === 'privacy' ? 'privacy' : 'terms'
}

export default function LegalScreen() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const tab = useMemo(() => normalizeTab(params.get('tab')), [params])

  useEffect(() => {
    const current = params.get('tab')
    const normalized = normalizeTab(current)
    if (current !== normalized) {
      setParams({ tab: normalized }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setTab(next: TabId) {
    setParams({ tab: next }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="legal-root">
      <nav className="legal-nav">
        <button type="button" className="legal-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <button type="button" className="legal-logo" onClick={() => navigate('/')}>
          Liquid.
        </button>
        <div className="legal-spacer" aria-hidden="true" />
      </nav>

      <div className="legal-wrap">
        <div className="legal-tabs" role="tablist" aria-label="Legal documents">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'terms'}
            className={`legal-tab ${tab === 'terms' ? 'active' : ''}`}
            onClick={() => setTab('terms')}
          >
            Terms of Service
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'privacy'}
            className={`legal-tab ${tab === 'privacy' ? 'active' : ''}`}
            onClick={() => setTab('privacy')}
          >
            Privacy Policy
          </button>
        </div>

        {tab === 'terms' ? (
          <div className="legal-doc" role="tabpanel">
            <header className="legal-header">
              <div className="legal-eyebrow">Legal</div>
              <h1 className="legal-title">
                Terms of <em>Service</em>
              </h1>
              <div className="legal-meta">
                <div className="legal-meta-item">Effective date: April 2026</div>
                <div className="legal-meta-dot" />
                <div className="legal-meta-item">Last updated: April 2026</div>
                <div className="legal-meta-dot" />
                <div className="legal-meta-item">Applies to: Liquid App &amp; Website</div>
              </div>
            </header>

            <div className="legal-intro">
              <strong>Please read these terms carefully before using Liquid.</strong> By creating an account or accessing any
              part of the Liquid platform — including the P2P exchange and intelligence subscription — you agree to be bound
              by these Terms of Service. If you do not agree, do not use the platform.
            </div>

            <section className="legal-section">
              <div className="legal-section-num">01</div>
              <h2>About Liquid</h2>
              <p>Liquid is a digital asset intelligence platform that offers two core services:</p>
              <ul>
                <li>
                  <strong>Intelligence Subscriptions</strong> — tiered subscription plans (Essential, Business, Institutional)
                  that provide macro analysis, liquidity flow reports, capital allocation frameworks, and portfolio strategy
                  content.
                </li>
                <li>
                  <strong>P2P Exchange</strong> — a manual peer-to-peer exchange service that facilitates the buying and
                  selling of USDT (Tether) against Nigerian Naira (NGN), verified and executed by the Liquid operations team.
                </li>
              </ul>
              <p>Liquid is operated as a private platform. We reserve the right to refuse access to any user at our discretion.</p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">02</div>
              <h2>Eligibility</h2>
              <p>To use Liquid, you must:</p>
              <ul>
                <li>Be at least 18 years of age</li>
                <li>Have the legal capacity to enter into a binding agreement</li>
                <li>Not be prohibited from accessing digital asset services under the laws of your country of residence</li>
                <li>Provide accurate and complete information when creating your account</li>
              </ul>
              <div className="legal-highlight warning">
                <p>
                  <strong>Important:</strong> By registering, you confirm that you meet all eligibility requirements. If you do
                  not, you must not use Liquid. We may suspend or terminate accounts found to be in breach of eligibility
                  requirements.
                </p>
              </div>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">03</div>
              <h2>Account Registration &amp; Security</h2>
              <p>When you create a Liquid account, you are responsible for:</p>
              <ul>
                <li>Providing truthful, accurate, and up-to-date registration information</li>
                <li>Maintaining the confidentiality of your password and login credentials</li>
                <li>All activity that occurs under your account, whether authorised by you or not</li>
                <li>
                  Notifying us immediately at <strong>support@stayliquid.app</strong> if you suspect unauthorised access to your
                  account
                </li>
              </ul>
              <p>
                Liquid will never ask for your password via email, phone, or any channel other than the official app login
                screen. Do not share your login details with anyone.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">04</div>
              <h2>Intelligence Subscription Terms</h2>
              <p>
                Liquid offers three intelligence subscription tiers — Essential ($20/mo), Business ($50/mo), and Institutional
                ($100/mo). Subscriptions may be purchased for 3-month, 6-month, or 1-year durations, with discounts applied
                accordingly.
              </p>
              <p>
                <strong>Payment:</strong> All subscription payments are made in USDT (TRC-20). Upon selecting a plan, you will be
                provided with Liquid&apos;s USDT wallet address and required to upload proof of payment. Your subscription will
                be activated within 24 hours of payment verification by our team.
              </p>
              <p>
                <strong>Access:</strong> Intelligence content is tiered. Each post specifies a minimum subscription tier required
                to access it. Subscribing to a tier grants access to all content at that tier and below.
              </p>
              <p>
                <strong>Renewal:</strong> Subscriptions do not renew automatically. You will be notified before your subscription
                expires and must initiate a new payment to continue access.
              </p>
              <p>
                <strong>Refunds:</strong> Due to the digital nature of intelligence content, subscription payments are
                non-refundable once access has been granted. If you experience a technical issue preventing access, contact us
                within 48 hours and we will investigate.
              </p>
              <div className="legal-highlight info">
                <p>
                  <strong>Not financial advice:</strong> Intelligence content published on Liquid is for informational purposes
                  only. It does not constitute financial, investment, legal, or tax advice. Always conduct your own research and
                  consult a qualified professional before making capital allocation decisions.
                </p>
              </div>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">05</div>
              <h2>P2P Exchange Terms</h2>
              <p>The Liquid P2P exchange is a manually operated service. When you place an order:</p>
              <ul>
                <li>You will receive a live rate locked for a 20-minute window from order creation</li>
                <li>You must complete payment within this window or the order will expire</li>
                <li>You are required to upload proof of payment within the app</li>
                <li>Our operations team will verify your payment and process your order</li>
                <li>Completed buy orders result in USDT being sent to your specified TRC-20 wallet address</li>
                <li>Completed sell orders result in Naira being sent to your specified Nigerian bank account</li>
              </ul>
              <p>
                <strong>Order limits:</strong> Minimum and maximum order sizes are set by Liquid and displayed within the app.
                These may change at any time at our discretion.
              </p>
              <p>
                <strong>Exchange availability:</strong> The exchange may be closed during certain hours or for operational reasons
                at any time. When closed, you will be notified in the app and orders cannot be placed.
              </p>
              <p>
                <strong>No guarantees on rate:</strong> The rate displayed at order creation is the rate that applies to that
                order. We do not guarantee any particular rate on future orders. Rates reflect market conditions and are updated
                regularly.
              </p>
              <div className="legal-highlight warning">
                <p>
                  <strong>Expired orders:</strong> If your 20-minute payment window expires before payment is confirmed, your
                  order will be cancelled. No funds will be held by Liquid — you simply create a new order at the current rate.
                  Liquid is not liable for any rate differences between an expired and a new order.
                </p>
              </div>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">06</div>
              <h2>Prohibited Conduct</h2>
              <p>You agree not to use Liquid for any of the following:</p>
              <ul>
                <li>Money laundering, terrorist financing, or any activity in violation of applicable anti-money laundering (AML) laws</li>
                <li>Fraud, misrepresentation, or providing false payment proofs</li>
                <li>Attempting to manipulate exchange rates or exploit platform errors</li>
                <li>Creating multiple accounts to circumvent restrictions or limits</li>
                <li>Reverse engineering, scraping, or accessing the platform by automated means</li>
                <li>Reselling intelligence content or sharing subscription access with third parties</li>
                <li>Any activity that violates applicable local, national, or international laws</li>
              </ul>
              <p>
                Liquid reserves the right to immediately suspend or terminate accounts found to be engaged in prohibited conduct
                and to report such activity to relevant authorities where required by law.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">07</div>
              <h2>Intellectual Property</h2>
              <p>
                All intelligence content published on Liquid — including reports, analysis, frameworks, briefings, and any other
                written materials — is the exclusive intellectual property of Liquid. You may not reproduce, redistribute,
                publish, sell, or share this content in any form without explicit written permission from Liquid.
              </p>
              <p>
                Your subscription grants you a personal, non-transferable licence to read and reference intelligence content for
                your own use. This licence does not transfer ownership of the content to you.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">08</div>
              <h2>Limitation of Liability</h2>
              <p>To the fullest extent permitted by applicable law, Liquid and its operators shall not be liable for:</p>
              <ul>
                <li>Any loss of funds arising from exchange rate movements between order creation and execution</li>
                <li>Losses resulting from decisions made based on intelligence content published on the platform</li>
                <li>Delays in order processing caused by banking system outages, network issues, or force majeure events</li>
                <li>Losses arising from unauthorised access to your account due to failure to protect your credentials</li>
                <li>Any indirect, incidental, or consequential loss of any kind</li>
              </ul>
              <p>
                Our total liability to you for any claim arising out of your use of Liquid shall not exceed the total amount
                paid by you to Liquid in the 30 days preceding the event giving rise to the claim.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">09</div>
              <h2>Platform Availability</h2>
              <p>
                Liquid does not guarantee uninterrupted access to the platform. We may suspend or discontinue any part of the
                service for maintenance, security, or operational reasons at any time, with or without notice. We are not liable
                for any inconvenience or loss caused by platform downtime.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">10</div>
              <h2>Changes to These Terms</h2>
              <p>
                Liquid reserves the right to update or modify these Terms of Service at any time. When changes are made, we will
                update the effective date at the top of this page and, where material changes are made, notify you via email or
                in-app notification. Your continued use of Liquid after the updated terms take effect constitutes your acceptance
                of the revised terms.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">11</div>
              <h2>Governing Law</h2>
              <p>
                These Terms of Service are governed by and construed in accordance with the laws of the Federal Republic of
                Nigeria. Any disputes arising from these terms or your use of Liquid shall be subject to the exclusive
                jurisdiction of the courts of Nigeria.
              </p>
            </section>

            <div className="legal-contact">
              <div className="legal-contact-title">Questions about these terms?</div>
              <div className="legal-contact-body">
                Contact our support team at <a href="mailto:support@stayliquid.app">support@stayliquid.app</a>. We aim to respond
                to all enquiries within 2 business days.
              </div>
            </div>
          </div>
        ) : (
          <div className="legal-doc" role="tabpanel">
            <header className="legal-header">
              <div className="legal-eyebrow">Legal</div>
              <h1 className="legal-title">
                Privacy <em>Policy</em>
              </h1>
              <div className="legal-meta">
                <div className="legal-meta-item">Effective date: April 2026</div>
                <div className="legal-meta-dot" />
                <div className="legal-meta-item">Last updated: April 2026</div>
                <div className="legal-meta-dot" />
                <div className="legal-meta-item">Applies to: Liquid App &amp; Website</div>
              </div>
            </header>

            <div className="legal-intro">
              <strong>Your privacy matters to us.</strong> This policy explains what personal information Liquid collects, how we
              use it, and how we protect it. We collect only what we need to operate the platform. We do not sell your data. We
              do not share it with advertisers.
            </div>

            <section className="legal-section">
              <div className="legal-section-num">01</div>
              <h2>Who We Are</h2>
              <p>
                Liquid is a digital asset intelligence platform offering intelligence subscriptions and a P2P USDT/NGN exchange
                service. When we refer to &quot;Liquid&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot; in this policy, we
                mean the operators of the Liquid platform accessible at stayliquid.app and via the Liquid mobile and web
                application.
              </p>
              <p>
                For data-related enquiries, contact us at: <strong>support@stayliquid.app</strong>
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">02</div>
              <h2>Information We Collect</h2>
              <p>We collect the following categories of information:</p>

              <p>
                <strong>Account information</strong>
              </p>
              <ul>
                <li>Full name</li>
                <li>Email address</li>
                <li>Phone number (Nigerian format)</li>
                <li>Password (stored in encrypted form via Supabase Auth — we never see your raw password)</li>
              </ul>

              <p>
                <strong>Exchange information</strong>
              </p>
              <ul>
                <li>Bank account details you provide for sell orders (bank name, account number, account holder name)</li>
                <li>USDT wallet addresses you provide for buy orders</li>
                <li>Payment proof images you upload to complete orders</li>
                <li>Order history including amounts, rates, timestamps, and order status</li>
                <li>Transaction IDs (blockchain hashes) for completed buy orders</li>
              </ul>

              <p>
                <strong>Subscription information</strong>
              </p>
              <ul>
                <li>Your current subscription plan and duration</li>
                <li>Subscription payment proof images you upload</li>
                <li>Subscription start and expiry dates</li>
              </ul>

              <p>
                <strong>Usage information</strong>
              </p>
              <ul>
                <li>Intelligence posts you have viewed or unlocked</li>
                <li>Notification preferences you have set</li>
                <li>In-app notifications sent to your account</li>
              </ul>

              <p>
                <strong>Device and technical information</strong>
              </p>
              <ul>
                <li>Browser type and version</li>
                <li>Device type and operating system</li>
                <li>IP address (used for security and fraud detection only)</li>
              </ul>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">03</div>
              <h2>How We Use Your Information</h2>
              <p>We use your information strictly to operate and improve the Liquid platform. Specifically:</p>
              <ul>
                <li>
                  <strong>To create and manage your account</strong> — authentication, account settings, and profile management
                </li>
                <li>
                  <strong>To process P2P exchange orders</strong> — verifying payments, executing orders, and maintaining an audit
                  trail for every transaction
                </li>
                <li>
                  <strong>To manage your intelligence subscription</strong> — activating your plan, controlling content access by
                  tier, and managing expiry
                </li>
                <li>
                  <strong>To communicate with you</strong> — sending order confirmations, status updates, subscription activation
                  emails, and support responses via Resend
                </li>
                <li>
                  <strong>To send admin alerts</strong> — notifying our operations team of new orders and subscription requests via
                  Telegram (your name and order details only, never shared externally)
                </li>
                <li>
                  <strong>To secure the platform</strong> — detecting fraud, preventing abuse, and enforcing our Terms of Service
                </li>
                <li>
                  <strong>To improve the product</strong> — understanding how the platform is used in aggregate to make it better
                </li>
              </ul>
              <p>We do not use your information for advertising, profiling, or any purpose not listed above.</p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">04</div>
              <h2>How We Store Your Information</h2>
              <p>
                All Liquid data is stored on <strong>Supabase</strong>, a secure database infrastructure provider. Your data is
                protected by:
              </p>
              <ul>
                <li>
                  <strong>Row-Level Security (RLS)</strong> — every database table is protected so that each user can only access
                  their own data. This is enforced at the database level, not just the application level.
                </li>
                <li>
                  <strong>TLS 1.3 encryption</strong> — all data transmitted between your device and our servers is encrypted in
                  transit
                </li>
                <li>
                  <strong>Encrypted authentication</strong> — passwords are never stored in plain text. Supabase Auth handles
                  authentication using industry-standard hashing
                </li>
                <li>
                  <strong>Private file storage</strong> — payment proof images and subscription proof images are stored in a
                  private Supabase storage bucket. They are not publicly accessible and can only be retrieved by authenticated
                  requests
                </li>
              </ul>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">05</div>
              <h2>Who We Share Your Information With</h2>
              <p>We share your data only with the service providers required to operate Liquid:</p>
              <ul>
                <li>
                  <strong>Supabase</strong> — database, authentication, and file storage. Your data is hosted on their
                  infrastructure.
                </li>
                <li>
                  <strong>Resend</strong> — transactional email delivery. We send your email address and order/subscription details
                  to Resend solely to deliver emails to you.
                </li>
                <li>
                  <strong>Telegram</strong> — our operations team receives admin alerts (new orders, subscription requests) via a
                  private Telegram bot. Only order reference, amount, and your name are included. This channel is private to our
                  team.
                </li>
              </ul>
              <p>
                We do not share your data with any other third parties. We do not sell your data. We do not share your data with
                advertisers, data brokers, or marketing platforms.
              </p>
              <div className="legal-highlight warning">
                <p>
                  <strong>Legal disclosure:</strong> We may disclose your information to law enforcement or regulatory authorities
                  if required to do so by applicable law, court order, or to prevent fraud or financial crime.
                </p>
              </div>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">06</div>
              <h2>Payment Proof Images</h2>
              <p>
                When you upload a payment proof image — whether for an exchange order or a subscription request — that image is
                stored securely in our private file storage. It is accessible only to our operations team for the purpose of
                verifying your payment.
              </p>
              <p>
                Payment proof images are retained for a minimum of 12 months for audit and dispute resolution purposes. After this
                period, they may be deleted at our discretion unless required to be retained by applicable law.
              </p>
              <p>We do not use payment proof images for any purpose other than order and subscription verification.</p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">07</div>
              <h2>Bank Account &amp; Wallet Details</h2>
              <p>
                Bank account details and USDT wallet addresses you provide are used solely to process your exchange orders. Bank
                details saved to your profile (&quot;Saved Bank Accounts&quot;) are stored in your user record and accessible only
                to you and, where necessary for order processing, to our operations team.
              </p>
              <p>
                We do not store your bank account details for any purpose beyond processing your sell orders and auto-filling your
                future sell order forms for your convenience.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">08</div>
              <h2>Your Rights</h2>
              <p>You have the following rights with respect to your personal data:</p>
              <ul>
                <li>
                  <strong>Access</strong> — you may request a copy of the personal data we hold about you
                </li>
                <li>
                  <strong>Correction</strong> — you may update your name, phone number, and notification preferences directly
                  within the app at any time
                </li>
                <li>
                  <strong>Deletion</strong> — you may request deletion of your account and associated personal data by contacting
                  us at support@stayliquid.app. Note that we may be required to retain certain transaction records for legal and
                  audit purposes even after account deletion
                </li>
                <li>
                  <strong>Portability</strong> — you may request a copy of your transaction history in a portable format
                </li>
                <li>
                  <strong>Objection</strong> — you may object to any processing of your data that you believe is not justified by a
                  legitimate purpose
                </li>
              </ul>
              <p>
                To exercise any of these rights, contact us at <strong>support@stayliquid.app</strong>. We will respond within 14
                business days.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">09</div>
              <h2>Data Retention</h2>
              <p>We retain your personal data for as long as your account is active and for a reasonable period thereafter. Specifically:</p>
              <ul>
                <li>
                  <strong>Account data</strong> — retained for the duration of your account plus 24 months after deletion, or as
                  required by applicable law
                </li>
                <li>
                  <strong>Order records</strong> — retained for a minimum of 5 years for financial record-keeping and audit purposes
                </li>
                <li>
                  <strong>Payment proof images</strong> — retained for a minimum of 12 months
                </li>
                <li>
                  <strong>Notification data</strong> — retained for 12 months, then automatically deleted
                </li>
              </ul>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">10</div>
              <h2>Cookies &amp; Tracking</h2>
              <p>
                The Liquid app uses minimal local storage to maintain your session and remember your onboarding status. We do not
                use third-party tracking cookies, advertising pixels, or analytics tools that share your behaviour data with
                external platforms.
              </p>
              <p>
                The Liquid website (stayliquid.app) may use first-party cookies to maintain navigation state. No third-party
                advertising or tracking cookies are used.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">11</div>
              <h2>Children&apos;s Privacy</h2>
              <p>
                Liquid is not intended for use by anyone under the age of 18. We do not knowingly collect personal data from
                children. If you believe a child has created an account on Liquid, please contact us immediately at
                support@stayliquid.app and we will delete the account and associated data promptly.
              </p>
            </section>

            <section className="legal-section">
              <div className="legal-section-num">12</div>
              <h2>Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. When we do, we will update the effective date at the top of
                this page. For material changes, we will notify you via email or in-app notification. Your continued use of Liquid
                after a policy update constitutes your acceptance of the revised policy.
              </p>
            </section>

            <div className="legal-contact">
              <div className="legal-contact-title">Privacy concerns or data requests?</div>
              <div className="legal-contact-body">
                Contact us at <a href="mailto:support@stayliquid.app">support@stayliquid.app</a>. We take all privacy enquiries
                seriously and will respond within 14 business days.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


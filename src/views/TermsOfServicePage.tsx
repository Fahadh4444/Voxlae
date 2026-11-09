"use client";

/**
 * TermsOfServicePage — Terms of Service for Voxlae
 *
 * Public page accessible at /terms (no authentication required).
 * Reuses the Privacy Policy stylesheet for a consistent legal-page layout.
 */

import React from 'react';
import { Link } from '@/lib/router';
import Seo from '../components/common/Seo';
import '../styles/pages/PrivacyPolicy.css';

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="privacy-page">
      <Seo
        title="Terms of Service — Voxlae"
        description="The terms that govern your use of Voxlae, including connected social accounts, Instagram automations, acceptable use, and governing law."
        canonicalPath="/terms"
        type="article"
      />
      <div className="privacy-container">
        <header className="privacy-header">
          <Link to="/" className="privacy-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Home
          </Link>
          <h1 className="privacy-title">Terms of Service</h1>
          <p className="privacy-updated">Last updated: July 29, 2026</p>
        </header>

        <div className="privacy-content">
          {/* Agreement */}
          <section className="privacy-section">
            <h2>1. Agreement to These Terms</h2>
            <p>
              These Terms of Service ("Terms") form a legally binding agreement between you and
              Voxlae ("Voxlae", "we", "us", or "our") governing your access to and use of our
              website at voxlae.com and our related products and services (collectively, the
              "Service").
            </p>
            <p>
              By creating an account or otherwise using the Service, you agree to these Terms and to
              our <Link to="/privacy">Privacy Policy</Link>, which is incorporated by reference. If
              you do not agree, do not use the Service.
            </p>
          </section>

          {/* Who we are */}
          <section className="privacy-section">
            <h2>2. Who We Are</h2>
            <p>
              Voxlae is operated as a sole proprietorship based in India and registered under the
              Government of India's Udyam (MSME) registration. Voxlae is a creator growth platform
              that helps users connect their social media accounts, view analytics, and run approved
              automations to grow their audience.
            </p>
          </section>

          {/* Eligibility */}
          <section className="privacy-section">
            <h2>3. Eligibility</h2>
            <p>
              To use the Service you must be at least 18 years old (or the age of majority in your
              jurisdiction) and capable of entering into a binding contract. You must also meet the
              minimum age and eligibility requirements of any third-party platform you connect. By
              using the Service, you represent that you meet these requirements and that the
              information you provide is accurate.
            </p>
          </section>

          {/* Description of the Service */}
          <section className="privacy-section">
            <h2>4. The Service</h2>
            <p>
              The Service allows you to connect supported social accounts (such as Instagram and
              YouTube), view analytics and insights, create and share profiles, and
              configure automations such as Instagram comment-triggered replies and direct messages.
              We may add, modify, or discontinue features at any time.
            </p>
          </section>

          {/* Accounts */}
          <section className="privacy-section">
            <h2>5. Your Account</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and
              for all activity that occurs under your account. You agree to provide accurate
              information, keep it up to date, and notify us promptly of any unauthorized use. We may
              suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          {/* Connecting third-party accounts */}
          <section className="privacy-section">
            <h2>6. Connecting Third-Party Accounts</h2>
            <p>
              When you connect a third-party account (such as Instagram, YouTube, or
              Google), you authorize Voxlae to access and process data from that platform through its
              official APIs, as described in our <Link to="/privacy">Privacy Policy</Link>. You
              represent that you own or are authorized to connect those accounts.
            </p>
            <p>
              Your use of each connected platform remains subject to that platform's own terms and
              policies, and you agree to comply with them. Voxlae is an independent service and is not
              endorsed by, certified by, or affiliated with Meta Platforms, Inc., Instagram,
              Google, or YouTube. You may disconnect any platform at any time.
            </p>
          </section>

          {/* Instagram Automations */}
          <section className="privacy-section">
            <h2>7. Instagram Automations &amp; Messaging</h2>
            <p>
              If you use Instagram Automations, you are solely responsible for the automations you
              configure and the messages sent from your connected account, including all reply and
              direct-message content and links. You agree to:
            </p>
            <ul className="privacy-list">
              <li>
                use automations only on accounts and content you own or are authorized to manage;
              </li>
              <li>
                comply with Meta's Platform Terms, Community Guidelines, and messaging and automation
                policies;
              </li>
              <li>
                honor opt-out requests (for example, recipients replying "STOP");
              </li>
              <li>
                not use the Service to send spam, deceptive, unlawful, harmful, or infringing
                content, or to harass any person.
              </li>
            </ul>
            <p>
              We may throttle, suspend, or disable automations that appear to violate these Terms or
              any platform policy, in order to protect you, other users, and the connected platforms.
            </p>
          </section>

          {/* Acceptable use */}
          <section className="privacy-section">
            <h2>8. Acceptable Use</h2>
            <p>When using the Service, you agree not to:</p>
            <ul className="privacy-list">
              <li>violate any applicable law or the rights of others;</li>
              <li>
                access, interfere with, or disrupt the Service, its security, or its underlying
                systems, or attempt to circumvent any rate limits or access controls;
              </li>
              <li>
                reverse engineer, scrape, or copy the Service except as permitted by law;
              </li>
              <li>
                upload malicious code, or use the Service to distribute spam or unauthorized
                advertising;
              </li>
              <li>
                misrepresent your identity or your authority to connect an account, or use the
                Service to infringe intellectual property or privacy rights.
              </li>
            </ul>
          </section>

          {/* User content */}
          <section className="privacy-section">
            <h2>9. Your Content</h2>
            <p>
              You retain ownership of the content and information you provide or connect to the
              Service ("Your Content"). You grant Voxlae a limited, non-exclusive license to host,
              process, and display Your Content solely to operate and provide the Service to you and
              to deliver the features you enable. You are responsible for Your Content and for having
              the rights necessary to use it with the Service.
            </p>
          </section>

          {/* IP */}
          <section className="privacy-section">
            <h2>10. Intellectual Property</h2>
            <p>
              The Service, including its software, design, and the Voxlae name and logo, is owned by
              Voxlae and protected by intellectual-property laws. Except for the rights expressly
              granted to you in these Terms, we reserve all rights in the Service. You may not use our
              branding without our prior written permission.
            </p>
          </section>

          {/* Fees */}
          <section className="privacy-section">
            <h2>11. Plans, Fees &amp; Payments</h2>
            <p>
              Some features of the Service may be offered free of charge, while others may require a
              paid plan. Where fees apply, the applicable pricing, billing cycle, and any renewal or
              cancellation terms will be presented to you at the time of purchase. Unless required by
              law or stated otherwise, fees are non-refundable. We may change our pricing on a
              prospective basis with reasonable notice.
            </p>
          </section>

          {/* Third-party services */}
          <section className="privacy-section">
            <h2>12. Third-Party Services</h2>
            <p>
              The Service relies on and interoperates with third-party platforms and services. We do
              not control those platforms and are not responsible for their availability, content, or
              policies, or for changes they make to their APIs that affect the Service. Your use of
              third-party services is governed by their respective terms.
            </p>
          </section>

          {/* Disclaimers */}
          <section className="privacy-section">
            <h2>13. Disclaimers</h2>
            <p>
              The Service is provided on an "as is" and "as available" basis, without warranties of
              any kind, whether express or implied, including warranties of merchantability, fitness
              for a particular purpose, and non-infringement. We do not warrant that the Service will
              be uninterrupted, error-free, or secure. Voxlae provides analytics and growth tools;
              we do not guarantee any particular results, follower growth, reach, revenue, or other
              outcome from your use of the Service.
            </p>
          </section>

          {/* Limitation of liability */}
          <section className="privacy-section">
            <h2>14. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Voxlae and its operator will not be liable for
              any indirect, incidental, special, consequential, or punitive damages, or for any loss
              of profits, data, goodwill, or business, arising out of or related to your use of the
              Service. To the extent liability cannot be excluded, our total aggregate liability for
              any claim relating to the Service will not exceed the greater of the amount you paid us
              for the Service in the three months before the claim, or INR 5,000.
            </p>
          </section>

          {/* Indemnification */}
          <section className="privacy-section">
            <h2>15. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Voxlae and its operator from any claims,
              damages, liabilities, and expenses (including reasonable legal fees) arising from your
              use of the Service, Your Content, your automations and messages, or your violation of
              these Terms or any applicable law or third-party platform policy.
            </p>
          </section>

          {/* Termination */}
          <section className="privacy-section">
            <h2>16. Suspension &amp; Termination</h2>
            <p>
              You may stop using the Service and delete your account at any time. We may suspend or
              terminate your access if you violate these Terms, if required to protect the Service or
              other users, or if required by law or by a connected platform. Upon termination, the
              rights granted to you under these Terms end, while the provisions that by their nature
              should survive (such as those on intellectual property, disclaimers, liability, and
              governing law) will continue to apply.
            </p>
          </section>

          {/* Changes */}
          <section className="privacy-section">
            <h2>17. Changes to the Service &amp; Terms</h2>
            <p>
              We may modify the Service and these Terms from time to time. When we make material
              changes to these Terms, we will update the "Last updated" date above and, where
              appropriate, provide additional notice. Your continued use of the Service after an
              update means you accept the revised Terms.
            </p>
          </section>

          {/* Governing law */}
          <section className="privacy-section">
            <h2>18. Governing Law &amp; Disputes</h2>
            <p>
              These Terms are governed by the laws of India, without regard to conflict-of-laws
              rules. You agree that the courts located in India will have exclusive jurisdiction over
              any dispute arising out of or relating to these Terms or the Service, subject to any
              non-waivable rights you may have under applicable law.
            </p>
          </section>

          {/* Contact */}
          <section className="privacy-section">
            <h2>19. Contact Us</h2>
            <p>
              If you have questions about these Terms, please contact us at:
            </p>
            <p className="privacy-contact">
              <a href="mailto:info@voxlae.com">info@voxlae.com</a>
            </p>
          </section>
        </div>

        <footer className="privacy-footer">
          <p>© {new Date().getFullYear()} Voxlae. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default TermsOfServicePage;

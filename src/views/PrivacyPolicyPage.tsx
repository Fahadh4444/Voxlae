"use client";

/**
 * PrivacyPolicyPage — Privacy Policy for Voxlae
 *
 * Public page accessible at /privacy (no authentication required).
 */

import React from 'react';
import { Link } from '@/lib/router';
import Seo from '../components/common/Seo';
import '../styles/pages/PrivacyPolicy.css';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="privacy-page">
      <Seo
        title="Privacy Policy — Voxlae"
        description="How Voxlae collects, uses, shares, retains and protects your data, including data obtained through Instagram, YouTube and Google."
        canonicalPath="/privacy"
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
          <h1 className="privacy-title">Privacy Policy</h1>
          <p className="privacy-updated">Last updated: July 29, 2026</p>
        </header>

        <div className="privacy-content">
          {/* Introduction */}
          <section className="privacy-section">
            <h2>1. Introduction</h2>
            <p>
              This Privacy Policy explains how Voxlae ("Voxlae", "we", "us", or "our") collects,
              uses, shares, retains, and protects information when you use our website at
              voxlae.com and our related products and services (collectively, the "Service").
            </p>
            <p>
              Voxlae is operated as a sole proprietorship based in India and registered under the
              Government of India's Udyam (MSME) registration. Voxlae is a creator growth platform
              that helps users connect their social media accounts, view analytics, and run
              approved automations to grow their audience.
            </p>
            <p>
              By accessing or using the Service, you acknowledge that you have read and understood
              this Privacy Policy. If you do not agree with it, please do not use the Service. This
              Policy should be read together with our{' '}
              <Link to="/terms">Terms of Service</Link>.
            </p>
          </section>

          {/* Who this applies to */}
          <section className="privacy-section">
            <h2>2. Scope</h2>
            <p>
              This Policy applies to all users of the Service, including creators, freelancers,
              brands, and visitors. It covers information we collect directly from you, information
              we receive from third-party platforms you choose to connect (such as Instagram,
              YouTube, and Google), and information generated automatically as you use the
              Service.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="privacy-section">
            <h2>3. Information We Collect</h2>
            <p>We collect the following categories of information to provide and improve the Service:</p>
            <ul className="privacy-list">
              <li>
                <strong>Account Information:</strong> Your name, email address, and authentication
                details when you create a Voxlae account or sign in with Google.
              </li>
              <li>
                <strong>Profile &amp; Role Information:</strong> Information you add to your profile,
                the role you use on the platform (for example creator, freelancer, or brand), and
                content you choose to publish, such as a freelancer profile.
              </li>
              <li>
                <strong>Connected Platform Data:</strong> When you connect a social account
                (Instagram, YouTube), we access data through the platform's official APIs
                with your explicit authorization. This is described in detail in Sections 5 and 6.
              </li>
              <li>
                <strong>Analytics &amp; Performance Metrics:</strong> Metrics from your connected
                platforms such as views, likes, comments, followers, reach, impressions, and
                engagement rates.
              </li>
              <li>
                <strong>Automation Data:</strong> If you use Instagram Automations, the comment and
                messaging data required to run the automations you configure (see Section 6).
              </li>
              <li>
                <strong>Feedback &amp; Support Communications:</strong> Feedback, support requests,
                and any messages you send to us.
              </li>
              <li>
                <strong>Usage &amp; Device Data:</strong> Information about how you interact with the
                Service, such as pages visited, features used, approximate location derived from IP
                address, browser type, and device information, collected to operate, secure, and
                improve the Service.
              </li>
            </ul>
          </section>

          {/* How We Use Data */}
          <section className="privacy-section">
            <h2>4. How We Use Your Data</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="privacy-list">
              <li>
                <strong>Provide the Service:</strong> To operate your account, display your
                analytics, and run the features and automations you enable.
              </li>
              <li>
                <strong>Deliver Insights &amp; Recommendations:</strong> To analyze your connected
                platform data and provide meaningful insights, trends, and growth guidance.
              </li>
              <li>
                <strong>Communicate With You:</strong> To send service-related notices, respond to
                your requests, and provide support.
              </li>
              <li>
                <strong>Maintain Safety &amp; Security:</strong> To authenticate users, prevent
                fraud and abuse, and protect the integrity of the Service.
              </li>
              <li>
                <strong>Improve the Service:</strong> To understand usage patterns and develop new
                features. Where we publish aggregate insights, they are anonymized and contain no
                information that identifies you or any individual.
              </li>
              <li>
                <strong>Comply With Law:</strong> To meet legal obligations and enforce our{' '}
                <Link to="/terms">Terms of Service</Link>.
              </li>
            </ul>
            <p>
              We do <strong>not</strong> sell your personal information, and we do not use data
              obtained through platform APIs for advertising or to build profiles for purposes
              unrelated to the features you have enabled.
            </p>
          </section>

          {/* Instagram Platform Data (Meta-specific) */}
          <section className="privacy-section">
            <h2>5. Instagram Platform Data</h2>
            <p>
              When you connect an Instagram account, you authorize Voxlae to access certain
              information through Instagram's official API (provided by Meta). We only request the
              minimum permissions needed for the features you use. Depending on the features you
              enable, we may access:
            </p>
            <ul className="privacy-list">
              <li>
                <strong>Account &amp; profile details:</strong> your Instagram account ID,
                username, account type, and profile information made available by the API.
              </li>
              <li>
                <strong>Content &amp; media:</strong> your posts, reels, and media, together with
                their captions and identifiers, so you can select them within Voxlae.
              </li>
              <li>
                <strong>Insights &amp; metrics:</strong> performance metrics such as reach,
                impressions, engagement, follower counts, and comment counts.
              </li>
              <li>
                <strong>Comments &amp; messaging:</strong> for Instagram Automations, the comment and
                direct-message data described in Section 6.
              </li>
            </ul>
            <p>
              <strong>Use limited to enabled features.</strong> We use data obtained through Meta's
              APIs solely to provide the Voxlae features you have enabled. We do not transfer this
              data to data brokers, ad networks, or any party for advertising. Our access, storage,
              and use of Meta platform data complies with the Meta Platform Terms and Developer
              Policies. If our access is revoked or a feature is discontinued, we stop using the
              associated data and delete it in line with Section 9.
            </p>
            <p>
              <strong>Not affiliated with Meta.</strong> Voxlae is an independent service. It is not
              endorsed, certified, or otherwise affiliated with Meta Platforms, Inc. or Instagram.
            </p>
          </section>

          {/* Instagram Comment Automations */}
          <section className="privacy-section">
            <h2>6. Instagram Comment Automations</h2>
            <p>
              If you enable Instagram Automations (a Creator Tool), you authorize Voxlae to read
              comments on the posts you target and to send automated replies and direct messages on
              your behalf. To operate this feature we process:
            </p>
            <ul className="privacy-list">
              <li>
                <strong>Comment data:</strong> the comment text, comment ID, and the commenter's
                Instagram username/ID for the posts you target, so we can match your keywords and
                respond.
              </li>
              <li>
                <strong>Messages we send:</strong> the public replies and direct messages —
                including the links and content you configure — sent from your connected account.
              </li>
              <li>
                <strong>Follower status (optional):</strong> for "unlock only for followers"
                automations, and only after a commenter interacts with our message, we check whether
                that person follows you, solely to decide whether to deliver your link.
              </li>
            </ul>
            <p>
              This data is used only to run the automations you create. People who receive an
              automated message can opt out at any time by replying "STOP". You can pause or delete
              an automation, or disconnect the Instagram account, at any time. Disconnecting the
              account or deleting your Voxlae account removes the associated automation data.
            </p>
          </section>

          {/* Cookies & Tracking */}
          <section className="privacy-section">
            <h2>7. Cookies &amp; Similar Technologies</h2>
            <p>
              We use cookies and similar technologies to keep you signed in, remember your
              preferences, secure the Service, and understand how it is used. Essential cookies are
              required for the Service to function; you can control non-essential cookies through
              your browser settings, though disabling some cookies may affect functionality.
            </p>
          </section>

          {/* How We Share Information */}
          <section className="privacy-section">
            <h2>8. How We Share Information</h2>
            <p>
              We do not sell your personal information. We share information only in the limited
              circumstances below:
            </p>
            <ul className="privacy-list">
              <li>
                <strong>Service providers:</strong> With vendors who process data on our behalf to
                run the Service (for example, cloud hosting, database, and authentication providers),
                under contracts that require them to protect your data and use it only for us.
              </li>
              <li>
                <strong>At your direction:</strong> When you choose to publish content (such as a
                public freelancer profile) or run an automation that sends messages you configured.
              </li>
              <li>
                <strong>Legal &amp; safety:</strong> When required by law, legal process, or to
                protect the rights, safety, and security of Voxlae, our users, or the public.
              </li>
              <li>
                <strong>Business transfers:</strong> In connection with a merger, acquisition, or
                sale of assets, subject to this Policy.
              </li>
            </ul>
          </section>

          {/* Data Retention */}
          <section className="privacy-section">
            <h2>9. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to
              provide the Service. When you disconnect a platform, we stop accessing new data from
              that platform and delete or de-identify the associated data within a reasonable period.
              When you delete your account, we delete your personal data from our active systems,
              except where we are required to retain limited information to comply with legal
              obligations, resolve disputes, or enforce our agreements. Backups are purged on a
              rolling schedule.
            </p>
          </section>

          {/* Data Security */}
          <section className="privacy-section">
            <h2>10. Data Security</h2>
            <p>
              We take data security seriously. OAuth access tokens used to connect your platforms are
              encrypted and stored securely, and access to production data is restricted. We
              implement industry-standard technical and organizational measures to protect your data
              against unauthorized access, disclosure, alteration, or destruction. However, no method
              of transmission or storage is completely secure, and we cannot guarantee absolute
              security.
            </p>
          </section>

          {/* Your Rights & Choices */}
          <section className="privacy-section">
            <h2>11. Your Rights &amp; Choices</h2>
            <p>You have the following controls over your data:</p>
            <ul className="privacy-list">
              <li>
                <strong>Access &amp; correction:</strong> You can review and update your account and
                profile information at any time from your account settings.
              </li>
              <li>
                <strong>Disconnect platforms:</strong> You can disconnect any connected social
                account from your settings, which revokes our access to that platform's data. You can
                also revoke access from the platform's own settings (for example, Instagram or Google
                account settings).
              </li>
              <li>
                <strong>Delete your account:</strong> You can permanently delete your Voxlae account,
                which removes your personal data as described in Sections 9 and 12.
              </li>
              <li>
                <strong>Communication preferences:</strong> You can opt out of non-essential
                communications while continuing to receive service-related messages.
              </li>
            </ul>
          </section>

          {/* Data Deletion (dedicated, Meta-required) */}
          <section className="privacy-section">
            <h2>12. How to Delete Your Data</h2>
            <p>
              You can request deletion of your data in either of the following ways:
            </p>
            <ul className="privacy-list">
              <li>
                <strong>In the app:</strong> Go to the Account page and select "Delete Account". This
                permanently deletes your account and removes your personal data, including data
                obtained from connected Instagram, YouTube, and Google accounts, and any Instagram
                Automation data.
              </li>
              <li>
                <strong>By email:</strong> Send a request from your registered email address to{' '}
                <a href="mailto:support@voxlae.com">support@voxlae.com</a> with the subject "Data
                Deletion Request". We will verify your request and delete your data within 30 days,
                except where limited retention is required by law.
              </li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section className="privacy-section">
            <h2>13. Children's Privacy</h2>
            <p>
              The Service is not directed to children. You must meet the minimum age required by your
              country and by the platforms you connect to use Voxlae. We do not knowingly collect
              personal information from children. If you believe a child has provided us with
              personal data, please contact us and we will delete it.
            </p>
          </section>

          {/* International Transfers */}
          <section className="privacy-section">
            <h2>14. International Data Transfers</h2>
            <p>
              We are based in India and may process and store information on servers located in India
              or other countries. Where data is transferred across borders, we take steps to ensure
              it remains protected consistent with this Policy and applicable law.
            </p>
          </section>

          {/* Third-Party Services */}
          <section className="privacy-section">
            <h2>15. Third-Party Services</h2>
            <p>The Service integrates with the following third-party services:</p>
            <ul className="privacy-list">
              <li>
                <strong>Google OAuth:</strong> For secure sign-in when you choose to sign in with
                Google.
              </li>
              <li>
                <strong>Instagram (Meta) API:</strong> To access your Instagram data and to run
                Instagram Automations, as described in Sections 5 and 6.
              </li>
              <li>
                <strong>YouTube APIs:</strong> To access your YouTube channel analytics and video
                performance data when you connect your channel.
              </li>
            </ul>
            <p>
              These services are governed by their own privacy policies, and we encourage you to
              review them. We request only the minimum permissions necessary to provide our features.
            </p>
          </section>

          {/* Changes */}
          <section className="privacy-section">
            <h2>16. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we
              will update the "Last updated" date above and, where appropriate, provide additional
              notice. Your continued use of the Service after an update means you accept the revised
              Policy.
            </p>
          </section>

          {/* Contact */}
          <section className="privacy-section">
            <h2>17. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your data, please
              contact us at:
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

export default PrivacyPolicyPage;

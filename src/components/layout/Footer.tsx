"use client";

import React from 'react';
import { Link } from '@/lib/router';
import VoxlaeLogo from '../common/VoxlaeLogo';
import '../../styles/components/Footer.css';

const FOOTER_LINKS = {
  product: [
    { label: 'Features', href: '#' },
    { label: 'Pricing', href: '#' },
    { label: 'Integrations', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press', href: '#' },
  ],
  resources: [
    { label: 'Help Center', href: '#' },
    { label: 'Community', href: '#' },
    { label: 'Contact', href: '#' },
    { label: 'Status', href: '#' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Cookies', href: '#' },
  ],
};

const SOCIAL_LINKS = [
  { 
    name: 'Twitter', 
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },
  { 
    name: 'Instagram', 
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    )
  },
  { 
    name: 'LinkedIn', 
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    )
  },
  { 
    name: 'YouTube', 
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    )
  },
];

const Footer: React.FC = () => (
  <footer className="vx-footer">
    {/* Large animated globe network */}
    <div className="vx-footer__globe">
      <svg className="vx-footer__globe-svg" viewBox="0 0 400 400">
        {/* Outer ring */}
        <circle className="vx-footer__ring vx-footer__ring--outer" cx="200" cy="200" r="180" />
        <circle className="vx-footer__ring vx-footer__ring--middle" cx="200" cy="200" r="140" />
        <circle className="vx-footer__ring vx-footer__ring--inner" cx="200" cy="200" r="100" />
        
        {/* Orbiting dots */}
        <circle className="vx-footer__orbit vx-footer__orbit--1" cx="200" cy="20" r="8" />
        <circle className="vx-footer__orbit vx-footer__orbit--2" cx="380" cy="200" r="6" />
        <circle className="vx-footer__orbit vx-footer__orbit--3" cx="200" cy="380" r="7" />
        <circle className="vx-footer__orbit vx-footer__orbit--4" cx="60" cy="100" r="5" />
        <circle className="vx-footer__orbit vx-footer__orbit--5" cx="340" cy="300" r="6" />
        
        {/* Connection lines */}
        <line className="vx-footer__connection" x1="200" y1="20" x2="380" y2="200" />
        <line className="vx-footer__connection" x1="380" y1="200" x2="200" y2="380" />
        <line className="vx-footer__connection" x1="200" y1="380" x2="60" y2="100" />
        <line className="vx-footer__connection" x1="60" y1="100" x2="340" y2="300" />
        <line className="vx-footer__connection" x1="340" y1="300" x2="200" y2="20" />
        
        {/* Center pulse */}
        <circle className="vx-footer__center-pulse" cx="200" cy="200" r="30" />
        <circle className="vx-footer__center-dot" cx="200" cy="200" r="15" />
      </svg>
    </div>
    
    {/* Smooth wave transition */}
    <div className="vx-footer__wave">
      <svg className="vx-footer__wave-svg" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path 
          d="M0,0 L1440,0 L1440,40 Q1080,120 720,80 Q360,40 0,80 L0,0 Z" 
          fill="#1A2D5A" 
        />
        <path 
          d="M0,80 Q360,40 720,80 Q1080,120 1440,40 L1440,120 L0,120 Z" 
          fill="#FF6B2C" 
        />
      </svg>
    </div>
    
    {/* Logo badge */}
    <div className="vx-footer__brand">
      <div className="vx-footer__logo-circle">
        <VoxlaeLogo size={52} variant="icon" />
      </div>
      <span className="vx-footer__brand-name">VOXLAE</span>
    </div>

    <div className="vx-footer__inner">
      {/* Links grid */}
      <div className="vx-footer__links">
        <div className="vx-footer__col">
          <h4 className="vx-footer__col-title">Product</h4>
          <ul className="vx-footer__col-list">
            {FOOTER_LINKS.product.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div className="vx-footer__col">
          <h4 className="vx-footer__col-title">Company</h4>
          <ul className="vx-footer__col-list">
            {FOOTER_LINKS.company.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div className="vx-footer__col">
          <h4 className="vx-footer__col-title">Resources</h4>
          <ul className="vx-footer__col-list">
            {FOOTER_LINKS.resources.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div className="vx-footer__col">
          <h4 className="vx-footer__col-title">Legal</h4>
          <ul className="vx-footer__col-list">
            {FOOTER_LINKS.legal.map((link) => (
              <li key={link.label}>
                {link.href.startsWith('/') ? (
                  <Link to={link.href}>{link.label}</Link>
                ) : (
                  <a href={link.href}>{link.label}</a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom section with tagline & social */}
      <div className="vx-footer__bottom-section">
        <p className="vx-footer__tagline">
          Grow your social media the smart way
        </p>
        <div className="vx-footer__social">
          {SOCIAL_LINKS.map((social) => (
            <a 
              key={social.name} 
              href={social.href} 
              className="vx-footer__social-link"
              aria-label={social.name}
            >
              {social.icon}
            </a>
          ))}
        </div>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="vx-footer__copyright">
      <p>&copy; {new Date().getFullYear()} VOXLAE. All rights reserved.</p>
      <div className="vx-footer__legal-links">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <a href="#">Cookies</a>
      </div>
    </div>
  </footer>
);

export default Footer;

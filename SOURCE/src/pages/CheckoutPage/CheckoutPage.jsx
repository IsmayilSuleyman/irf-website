import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import emailjs from '@emailjs/browser';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { validateEmail } from '../../utils/cardValidation';
import styles from './CheckoutPage.module.css';

const EMAILJS_SERVICE_ID  = 'service_pqx48nr';
const EMAILJS_TEMPLATE_ID = 'template_gck17u7';
const EMAILJS_PUBLIC_KEY  = 'Q41GlKlgWj4MjnsIn';

function Section({ title, subtitle, children }) {
  return (
    <motion.div
      className={styles.section}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

export default function CheckoutPage() {
  const { items, cartTotal, clearCart } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    whatsapp: '',
    telegram: '',
    otherContact: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (items.length === 0 && !submittingRef.current) navigate('/');
  }, [items.length, navigate]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }

  function validate() {
    const e = {};
    const req = t('checkout.errors.required');

    if (!form.fullName) e.fullName = req;
    if (!form.email) e.email = req;
    else if (!validateEmail(form.email)) e.email = t('checkout.errors.email');
    if (!form.phone) e.phone = req;

    // At least one additional contact method
    if (!form.whatsapp && !form.telegram && !form.otherContact) {
      e.whatsapp = t('checkout.errors.contactMethod');
    }

    if (!form.address) e.address = req;
    if (!form.city) e.city = req;
    if (!form.postalCode) e.postalCode = req;
    if (!form.country) e.country = req;

    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.getElementById(Object.keys(errs)[0])?.focus();
      return;
    }

    setIsProcessing(true);
    submittingRef.current = true;

    const order = {
      id: 'GR-' + Date.now(),
      items: items.map(i => ({ ...i })),
      total: cartTotal,
      contact: {
        fullName:     form.fullName,
        email:        form.email,
        phone:        form.phone,
        whatsapp:     form.whatsapp,
        telegram:     form.telegram,
        otherContact: form.otherContact,
      },
      shipping: {
        address:    form.address,
        city:       form.city,
        postalCode: form.postalCode,
        country:    form.country,
      },
      notes: form.notes,
    };

    const itemLines = order.items
      .map(({ product, quantity }) =>
        `• ${product.name} × ${quantity} — ${(product.price * quantity).toFixed(2)} ₼`
      )
      .join('\n');

    const contactLines = [
      form.whatsapp     && `WhatsApp: ${form.whatsapp}`,
      form.telegram     && `Telegram: ${form.telegram}`,
      form.otherContact && `Other: ${form.otherContact}`,
    ].filter(Boolean).join('\n');

    const templateParams = {
      order_id:         order.id,
      customer_name:    form.fullName,
      customer_email:   form.email,
      customer_phone:   form.phone,
      customer_contact: contactLines || '—',
      shipping_address: `${form.address}, ${form.city}, ${form.postalCode}, ${form.country}`,
      items_list:       itemLines,
      order_total:      `${cartTotal.toFixed(2)} ₼`,
      order_notes:      form.notes || '—',
    };

    emailjs
      .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY)
      .catch(() => {/* silent — order still goes through */})
      .finally(() => {
        clearCart();
        navigate(`/order-confirmation/${order.id}`, { state: { order } });
      });
  }

  function field(name, label, type = 'text', placeholder = '', optional = false) {
    return (
      <div className={styles.fieldGroup}>
        <label htmlFor={name} className={styles.label}>
          {label}
          {optional && <span className={styles.optionalTag}>{t('checkout.optional')}</span>}
        </label>
        <input
          id={name}
          name={name}
          type={type}
          value={form[name]}
          onChange={handleChange}
          placeholder={placeholder}
          className={`${styles.input} ${errors[name] ? styles.inputError : ''}`}
          disabled={isProcessing}
        />
        {errors[name] && <span className={styles.errorMsg}>{errors[name]}</span>}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backLink}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        {t('checkout.backToShop')}
      </Link>

      <h1 className={styles.pageTitle}>{t('checkout.title')}</h1>

      <div className={styles.layout}>
        {/* ── LEFT: Form ── */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>

          {/* Contact info */}
          <Section title={t('checkout.contactSection')}>
            {field('fullName', t('checkout.fullName'), 'text', 'John Doe')}
            <div className={styles.grid2}>
              {field('email', t('checkout.email'), 'email', 'you@example.com')}
              {field('phone', t('checkout.phone'), 'tel', '+994 50 000 00 00')}
            </div>
          </Section>

          {/* How to reach you */}
          <Section
            title={t('checkout.reachSection')}
            subtitle={t('checkout.reachSubtitle')}
          >
            <div className={styles.grid2}>
              <div className={styles.fieldGroup}>
                <label htmlFor="whatsapp" className={styles.label}>
                  <span className={styles.contactIcon}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </span>
                  WhatsApp
                  <span className={styles.optionalTag}>{t('checkout.optional')}</span>
                </label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={handleChange}
                  placeholder="+994 50 000 00 00"
                  className={`${styles.input} ${errors.whatsapp ? styles.inputError : ''}`}
                  disabled={isProcessing}
                />
                {errors.whatsapp && <span className={styles.errorMsg}>{errors.whatsapp}</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="telegram" className={styles.label}>
                  <span className={styles.contactIcon}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  </span>
                  Telegram
                  <span className={styles.optionalTag}>{t('checkout.optional')}</span>
                </label>
                <input
                  id="telegram"
                  name="telegram"
                  type="text"
                  value={form.telegram}
                  onChange={handleChange}
                  placeholder="@username"
                  className={`${styles.input} ${errors.telegram ? styles.inputError : ''}`}
                  disabled={isProcessing}
                />
              </div>
            </div>

            {field('otherContact', t('checkout.otherContact'), 'text', t('checkout.otherContactPlaceholder'), true)}
          </Section>

          {/* Shipping address */}
          <Section title={t('checkout.shippingSection')}>
            {field('address', t('checkout.address'), 'text', '123 Main St')}
            <div className={styles.grid3}>
              {field('city', t('checkout.city'), 'text', 'Baku')}
              {field('postalCode', t('checkout.postalCode'), 'text', 'AZ1000')}
              {field('country', t('checkout.country'), 'text', 'Azerbaijan')}
            </div>
          </Section>

          {/* Order notes */}
          <Section title={t('checkout.notesSection')}>
            <div className={styles.fieldGroup}>
              <label htmlFor="notes" className={styles.label}>
                {t('checkout.notesLabel')}
                <span className={styles.optionalTag}>{t('checkout.optional')}</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder={t('checkout.notesPlaceholder')}
                className={styles.textarea}
                rows={3}
                disabled={isProcessing}
              />
            </div>
          </Section>

          <button type="submit" className={styles.submitBtn} disabled={isProcessing}>
            {isProcessing ? (
              <span className={styles.processingWrap}>
                <span className={styles.spinner} />
                {t('checkout.processing')}
              </span>
            ) : (
              `${t('checkout.placeOrder')} — ${cartTotal.toFixed(2)} ₼`
            )}
          </button>
        </form>

        {/* ── RIGHT: Order summary ── */}
        <div className={styles.summaryBox}>
          <h3 className={styles.summaryTitle}>{t('checkout.summary')}</h3>
          <ul className={styles.summaryItems}>
            {items.map(({ product, quantity }) => (
              <li key={product.id} className={styles.summaryItem}>
                <img src={product.image} alt={product.name} className={styles.summaryImg} />
                <div className={styles.summaryInfo}>
                  <span className={styles.summaryName}>{product.name}</span>
                  <span className={styles.summaryQty}>× {quantity}</span>
                </div>
                <span className={styles.summaryPrice}>
                  {(product.price * quantity).toFixed(2)} ₼
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.summaryTotal}>
            <span>{t('checkout.totalLabel')}</span>
            <span className={styles.summaryTotalPrice}>{cartTotal.toFixed(2)} ₼</span>
          </div>
          <p className={styles.secureNote}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {t('checkout.orderNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
